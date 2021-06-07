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
  
//var spsfUrl = 'https://spsfwebfront.mybluemix.net';
//var spsfDataanalysisUrl = 'https://spsfdataanalysis.us-south.cf.appdomain.cloud';
var spsfUrl = 'http://localhost:3000';
var spsfDataanalysisUrl = 'http://localhost:8081';
var parkingData;

//const uri = "mongodb+srv://sit725:sit725@sit725.gwuvj.mongodb.net/spsf?retryWrites=true&w=majority";
const uri = "mongodb+srv://sit780:sit780@vaccinetracker.4wro0.mongodb.net/account?retryWrites=true&w=majority";

const userModel = require("./models/userTest");

app.use(express.static(__dirname +'/public'));

//use express body parser to get view data
app.use(express.urlencoded({ extended: true }));


//db collections

try {
  // Connect to the MongoDB cluster
  mongoose.connect(
  uri,{ useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true},
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
            return res.json({mismatch:'true'});
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
              
    });
     response.send(parkingData)
});

app.post('/logout', function(req, res){
  req.session = null;
  req.session.destroy((err) => {
    if(err) throw err;
    res.loggedIn('false');
    res.redirect('/');
  })
  req.logout();
});

const port = process.env.PORT || 8080; 

app.listen(port, console.log('Server listening on : '+port));



