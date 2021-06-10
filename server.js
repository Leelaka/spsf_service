const MongoClient = require('mongodb').MongoClient; //mongodb
const req = require('request');
require('dotenv').config({path: __dirname + '/.env'})
 
var spsfUrl = process.env.FRONT_END_URL
var spsfDataanalysisUrl = process.env.DATA_SERVICE_URL

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt'); //encryption 
const saltRounds = 10; //rounds of hashing 
const passport = require('passport'); //passport 
const session = require('express-session');//session
const MongoDBSession = require('connect-mongodb-session')(session)
const User = require('./models/userTest'); //mongoose model 
const nodemailer = require('nodemailer'); //email module 
const app = express();

//passport local
require('./config/auth')(passport);

//random password generator 
const createPassword = require('./config/randomPassword');
  
var moment = require("moment");

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

    const hashPassword = await bcrypt.hash(password, saltRounds); //hash user password 

    //let userDetails = await userModel.findOne({email});

    if (password === confirmPassword) { //verify pass 

      userModel.findOne({ email }, function (err, user) { //find user 
        if (err) throw err;
        if (user === null) { //if non add user 
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
        } else { //reject user if exist 
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
  let confirmPassword = req.query.confirmpassword;
  //hash both passwords 
  const hashOldPassword = await bcrypt.hash(oldpassword, saltRounds);
  const hashNewPassword = await bcrypt.hash(newpassword, saltRounds);
  //let userDetails = await userModel.findOne({email});

  if(newpassword === confirmPassword){ //verify password 
    User.findOne({email: email}) //verify user in db 
    .then(user => {
      if(user) {
        console.log('user exist!');
        bcrypt.compare(oldpassword, user.password, (err, isMatch) => {
          if(err) throw err;
          if(isMatch){
            User.findOneAndUpdate({email: email}, {password: hashNewPassword}, (err) =>{ //update pass 
              if(err){
                throw(err)
              } else {
                //res.send("alert('successfully changed!')");
                console.log('successfully changed password');
                return res.json({changed:'true'}); //render page 
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

//password generator for new password 
function generatePassword(passwordLength) {
  var numberChars = "0123456789";
  var upperChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var lowerChars = "abcdefghijklmnopqrstuvwxyz";
  var allChars = numberChars + upperChars + lowerChars;
  var randPasswordArray = Array(passwordLength);
  randPasswordArray[0] = numberChars;
  randPasswordArray[1] = upperChars;
  randPasswordArray[2] = lowerChars;
  randPasswordArray = randPasswordArray.fill(allChars, 3);
  return shuffleArray(randPasswordArray.map(function(x) { return x[Math.floor(Math.random() * x.length)] })).join('');
}

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

//forget password
app.get('/sendpassword', async(request, response) => {
  let email = request.query.email; 
  let length = 6;
  let passwordGenerated = generatePassword(length); //generate a random 6 character password 
 
  const currentResetPassword = await bcrypt.hash(passwordGenerated, saltRounds); //hashing the new generated password 

  if(email !== null){
  User.findOne({email: email}) //verifying user 
    .then(user => {
      if(user){
        console.log('user exists');
        console.log('One time password has been sent to your e-mail address...');
        console.log(passwordGenerated);
        var transporter = nodemailer.createTransport({ //connecting to mail 
            service: 'hotmail',
            auth: {
                    // user: 'spsfhelpdesk@gmail.com',
                    // pass: 'spsf1234'
                    user: 'spsfhelpdesk@outlook.com',
                    pass: 'spsf1234'
                }
        });
        const mailOptions = { //mail body and to whom to sent 
          from: 'spsfhelpdesk@outlook.com', // sender address
          to: user.email, // list of receivers
          subject: `Hi ${user.username}, here's your temporary password! `, // Subject line
          html: `<p>Please use this <b>${passwordGenerated}</b> as your temporary password to login</p>`// plain text body
        };
        transporter.sendMail(mailOptions, function (err, info) { //sent function mail, get verification, check SPAM if not received! 
          if(err)
           { 
             console.log(err);
           }
          else{
            User.findOneAndUpdate({email: email}, {password: currentResetPassword}, (err) => { //find user and update password 
              if(err){
                throw (err);
              } else {
                return console.log('success reset pass!');
              }
            })
            console.log(info);
          }
        });
        return response.json({reset:'false'});
      } else {
        console.log('no user found');
      }
    }).catch(err => console.log('invalid user, try again'));
  } else {
    console.log('invalid email');
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
  req.session = null; //rset session 
  req.session.destroy((err) => {  //destroy session, redirect to login
    if(err) throw err;
    res.loggedIn('false');
    res.redirect('/');
  })
  req.logout(); //passport func
});


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


app.listen(port, console.log('Server listening on : '+port));