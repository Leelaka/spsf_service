const MongoClient = require('mongodb').MongoClient;
//var express = require('express')
const req = require('request');
 
var spsfUrl = 'https://spsfwebfront.mybluemix.net';
var spsfDataanalysisUrl = 'https://spsfdataanalysis.us-south.cf.appdomain.cloud';
//var spsfUrl = 'http://localhost:3000';
//var spsfDataanalysisUrl = 'http://localhost:8081';
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const passport = require('passport');
const jwt = require('jsonwebtoken');
const session = require('express-session');//session
const MongoDBSession = require('connect-mongodb-session')(session)
const User = require('./models/userTest');

const app = express();

//passport local
require('./config/auth')(passport);
  
var moment = require("moment")

require('dotenv').config({path: __dirname + '/.env'})

const accountSid = "ACcee13ca196223b861bbfe2919bfdd10d"
const authToken = "933f291d7a25eedcaae64a23fbd169e7";
const Twilioclient = require('twilio')(accountSid, authToken);

//var spsfUrl = 'https://spsfwebfront.mybluemix.net';
//var spsfDataanalysisUrl = 'https://spsfdataanalysis.us-south.cf.appdomain.cloud';
// var spsfUrl = 'http://localhost:3000';
// var spsfDataanalysisUrl = 'http://localhost:8081';
var parkingData;

const uri = "mongodb+srv://sit725:sit725@sit725.gwuvj.mongodb.net/spsf?retryWrites=true&w=majority";
const mongooseuri = "mongodb+srv://sit780:sit780@vaccinetracker.4wro0.mongodb.net/account?retryWrites=true&w=majority";
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
   // store: store
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

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
              messagingServiceSid: 'MGabeffbb29ea545b088fe9df43117d6ee',   
              from: '+12816231993',   
              to: element.mobile 
            }) 
            .then(message => collectionSentNotification.insertOne({mobile:element.mobile,sid:message.sid,date:element.time,body:message.body,status:message.status})) 
            .done();
        } catch (e) {
          console.log(e);
        }

        try {          
          collectionNotification.deleteOne( { "_id" : element._id } );
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
}, 60000);


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
          console.log(new_user_Model);
          passport.authenticate("local")
        } else {
          response.json({registration:'false', message:'Error: username is already exist.'}); 
        }
      });  
    } else {
      response.json({registration:'false', message:'Error: password mismatched.'});
    }
});

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
  let confirmPassword = req.query.confirmpassword;

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

const JWT_SECRET = 'its something secret';

//forget password
app.get('/sendpassword', function(request, response){
  let email = request.query.email; 
  let secretkey; 
  let payload;
  let token;
  let link;

  if(email !== null){
    User.findOne({email: email})
    .then(user => {
      if(user){
        console.log('user exists');
        secretkey = JWT_SECRET + user.password;
        payload = {
          email: user.email,
          id: user.id
        }
        token = jwt.sign(payload, secretkey, {expiresIn: '15m'});
        link = `http://localhost:3000/reset-password/${user.id}/${token}`;
        console.log(link);
        console.log('Password reset link has been sent to your e-mail address...');
        return response.json({reset:'true'});
      } else {
        console.log('no user found');
      }
    }).catch(err => console.log('invalid user, try again'));
  } else {
    console.log('invalid email');
  }
});

// app.post('/rest-password/:id/:token', (req, res, next) => {
//   const {id, token} = req.params;
//   res.send(user);
// })

app.get('/reset-password', async(request, response, next) => {
  let { id, token } = request.params;
  let newpassword = request.query.password;
  let confirmpassword = request.query.confirmpassword;
  console.log('click'+newpassword+confirmpassword+id);
  const hashedpassword = await bcrypt.hash(newpassword, saltRounds);

  if(newpassword !== confirmpassword){
    return false;
  } else {
    User.findById({_id: id})
    .then(user => {
      const secretkey = JWT_SECRET + user.password;
      try{
        const payload = jwt.verify(token, secretkey);
        User.findOneAndUpdate({email: user.email}, {password: hashedpassword}, (err) =>{
        if(err){
          throw(err)
        } else {
          //res.send("alert('successfully changed!')");
          console.log('successfully reset password');
          return res.json({shift:'true'});
        }
      }) 
      }catch(error){
        console.log(error);
      }
    })
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
  //let username='ruwan';
  //console.log(request.query.username);
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

app.listen(port, console.log('Server listening on : '+port));


//Notify feature handling
app.get('/notify', function (request, response) {

  let mobile = request.query.mobile
  mobile = '+61'+mobile.slice(1)
  let time = request.query.time
  array = time.split(':')
  hours = array[0].trim()
  mins = array[1].trim()
  var dateTime =  moment().format('DD/MM/YYYY HH:mm')

  dateTime = moment(dateTime).add(parseInt(mins), 'minutes').format('DD/MM/YYYY HH:mm');
  dateTime = moment(dateTime).add(parseInt(hours), 'hours').format('DD/MM/YYYY HH:mm');

  if(request.query){
     collectionNotification.insertOne({mobile:mobile, time:dateTime}, function (err, result) {
      if (err) throw err;
     })
  }
  response.end()
})


