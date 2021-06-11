const MongoClient = require('mongodb').MongoClient;
//var express = require('express')
const req = require('request');
require('dotenv').config({path: __dirname + '/.env'})
 
var spsfUrl = process.env.FRONT_END_URL
var spsfDataanalysisUrl = process.env.DATA_SERVICE_URL

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const passport = require('passport');
const session = require('express-session');//session
const MongoDBSession = require('connect-mongodb-session')(session)
const User = require('./models/userTest');

const app = express();

//passport local
require('./config/auth')(passport);
  
var moment = require("moment")

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const Twilioclient = require('twilio')(accountSid, authToken);

var parkingData;

const uri = process.env.MONGODB;
const mongooseuri = process.env.MONGOOSE;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true});
moment.suppressDeprecationWarnings = true;

const userModel = require("./models/userTest");

app.use(express.static(__dirname +'/public'));
//use express body parser to get view data
app.use(express.urlencoded({ extended: true }));

var port = process.env.PORT || 8080;   

//db collections
client.connect(err => {
  collectionUsers = client.db("spsf").collection("user");
  collectionHistory=client.db("spsf").collection("history");
  collectionNotification=client.db("spsf").collection("notification");
  collectionSentNotification=client.db("spsf").collection("sentnotification");
});

try {
  // Connect to the MongoDB cluster
  mongoose.connect(
  mongooseuri,{ useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true},
      () => console.log(" Mongoose is connected...")
  ); } catch (e) {
  console.log("could not connect...");
}

const store = new MongoDBSession({
  uri: uri,
  collection: "sessions",
});


//express session
app.use(session({
    secret: "key to cookie",
    resave: true,
    saveUninitialized: true,
    store: store
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

//send sms's as a confirmation
sendSmsConfirmation = function (mobile, checked){

  let currentTime = moment().format('DD/MM/YYYY HH:mm')
  let smsbody = 'Hello, This is SPSF service. Your parking expiry notification has been set up. Thank you for using SPSF.'
  if(checked ==='on'){
    smsbody = 'Hello, This is SPSF service. Your parking info has saved and expiry notification has been set up. Thank you for using SPSF.'
  }

  try {  
      Twilioclient.messages 
      .create({ 
        body: smsbody,  
        messagingServiceSid:process.env.TWILIO_MSG_SERVICE_SID,   
        from:process.env.TWILIO_SERVICE_NUM,   
        to: mobile 
      }) 
      .then(message => collectionSentNotification.insertOne({mobile:mobile,sid:message.sid,date:currentTime,body:message.body,status:message.status})) 

  } catch (e) {
    console.log(e);
  }
}

//send sms's as notifications
sendSmsNotifications = function (){
  collectionNotification.find().sort({time: 1 }).toArray(function(err, result) {
    if(err) throw err;
    let currentTime = moment().format('DD/MM/YYYY HH:mm')
    result.forEach((element) => { 
      if(currentTime >= element.time){
        try {  
            Twilioclient.messages 
            .create({ 
              body: 'Hello, This is SPSF service. Your parking has just expired at ' +element.time+'. Please proceed to the vehicle.',  
              messagingServiceSid:process.env.TWILIO_MSG_SERVICE_SID,   
              from:process.env.TWILIO_SERVICE_NUM,   
              to: element.mobile 
            }) 
            .then(message => collectionSentNotification.insertOne({mobile:element.mobile,sid:message.sid,date:element.time,body:message.body,status:message.status})) 
            .done(()=>{
              try {          
                collectionNotification.deleteOne( { "_id" : element._id } );
              } catch (e) {
                  console.log(e);
              }
            });
        } catch (e) {
          console.log(e);
        }
       }        
    })     
  });
}

//sms sending and updating the Notification collection
setInterval(()=>{
  sendSmsNotifications()
}, 40000);


//registration process
app.get('/register', async (request,response) => {

    let username = request.query.username
    let email = request.query.email
    let password = request.query.password
    let confirmPassword = request.query.confirmpassword

    const hashPassword = await bcrypt.hash(password, saltRounds);

    //let userDetails = await userModel.findOne({email});

    if (password === confirmPassword) {

      userModel.findOne({ email }, function (err, user) {
        if (err) throw err;
        if (user === null) {
          const new_user_Model = new userModel
          ({ 
            username, 
            email, 
            password: hashPassword
          });
          new_user_Model.save();
          response.json({registration:'true', message:''});
          passport.authenticate("local")
        } else {
          response.json({registration:'false', message:'Error: username is already exist.'}); 
        }
      });  
    } else {
      response.json({registration:'false', message:'Error: password mismatched.'});
    }
});

function isLoggedIn(req, res, next) {
   //req.isAuthenticated() ? next() : res.redirect('/login'); 
    req.user ? next() : res.redirect('/login');
}

//Authenticate login user process using passport
app.get('/authenticate', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    if (err) { return next(err); }
    if (!user) { return res.json({authorisation:'false'}); }
    req.logIn(user, function(err) {
      if (err) { return next(err); }
      return res.json({authorisation:'true'});
    });
  })(req, res, next); 
});
 

//compare password get boolean value and update password in database. 
app.get('/changepassword', async(req,res) => {

  let email = req.query.currentemail;
  let oldpassword = req.query.oldpassword;
  let newpassword = req.query.newpassword;
  let confirmPassword = req.query.confirmpassword

  const hashOldPassword = await bcrypt.hash(oldpassword, saltRounds);
  const hashNewPassword = await bcrypt.hash(newpassword, saltRounds);
  //let userDetails = await userModel.findOne({email});

  if(newpassword === confirmPassword){
    User.findOne({email: email})
    .then(user => {
      if(user) {
        console.log('user exist!');
        bcrypt.compare(oldpassword, user.password, (err, isMatch) => {
          if(err) throw err;
          if(isMatch){
            User.findOneAndUpdate({email: email}, {password: hashNewPassword}, (err) =>{
              if(err){
                throw(err)
              } else {
                //res.send("alert('successfully changed!')");
                console.log('successfully changed password');
                return res.json({changed:'true'});
              }
            })
          } else {
            //res.send("alert('incorrect password or email')");
            console.log('password incorrect');
            //return res.json({mismatch:'true'});
          }
        })
      }

    }).catch(err => console.log('incorrect password or email'));
  } else {
    //res.send("alert('entered password does not match')");
    console.log('password dont match');
  }
});

//Request all parking data from data analysis service
app.get('/requestAllParkingData',function (request,response){
    reqObject = spsfDataanalysisUrl+"/generateParkingData";
    req(reqObject,(err,result,body)=> {
        if(err){
            return console.log(err);
        }  
        parkingData = result.body
        response.send(parkingData)
    });     
})

//Get history data by username
app.get('/getUserHistoryData',function(request,response){

  let username=request.query.username;
  collectionHistory.find({username:username}).toArray(function(err,result){
    if(err) throw err;
    response.send(result);
  });

})
              
app.post('/logout', function(req, res){
  req.session = null;
  req.session.destroy((err) => {
    if(err) throw err;
    res.loggedIn('false');
    res.redirect('/');
  })
  req.logout();
});


//Notify feature handling
app.get('/notify', function (request, response) {

  let username = request.query.username
  let bay = request.query.bay
  let lat = request.query.lat
  let lon = request.query.lon
 
  let mobile = request.query.mobile
  mobile = '+61'+mobile.slice(1)
  let time = request.query.time
  array = time.split(':')
  hours = array[0].trim()
  mins = array[1].trim()
  let dateTime =  moment().format('DD/MM/YYYY HH:mm')
  let curTime = dateTime
 
  dateTime = moment(dateTime).add(parseInt(mins), 'minutes').format('DD/MM/YYYY HH:mm');
  dateTime = moment(dateTime).add(parseInt(hours), 'hours').format('DD/MM/YYYY HH:mm');
  
  let duration =  moment(dateTime).diff(moment(curTime), 'minutes')

  //send confirmation
  sendSmsConfirmation(mobile,request.query.save)
  //saving paring info to history
  if(request.query.save==='on'){
    collectionHistory.insertOne({username:username , bay_id:bay , lat:lat , lon:lon, duration:duration , datetime:dateTime}, function (err, result) {
      if (err) throw err;
     })
  }

  if(request.query){
     collectionNotification.insertOne({mobile:mobile, time:dateTime}, function (err, result) {
      if (err) throw err;
     })
  }
  response.end()
})


app.listen(port, console.log('Server listening on : '+port));