const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const passport = require('passport');
const session = require('express-session');//session
// const MongoDBSession = require('connect-mongodb-session')(session)

const app = express();

//passport local
require('./config/auth')(passport);

//passport google 
require('./config/googleauth');
  
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

// const store = new MongoDBSession({
//   uri: uri,
//   collection: "sessions",
// });


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

app.get('/changepassword', async(req,res) => {

  let username = request.query.username
  let email = request.query.email
  let password = request.query.password
  let confirmPassword = request.query.confirmpassword



})

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
})

// app.get('/google', function(req, res){
//   res.send(passport.authenticate('google', {scope: 'profile'}));
// });

// app.get('/google/callback', function(req, res, next) {
//   passport.authenticate('google', function(err, user, info) {
//     if (err) { return next(err); }
//     if (!user) { return res.json({authed:'false'}); }
//     req.logIn(user, function(err) {
//       if (err) { return next(err); }
//       return res.json({authed:'true'});
//     });
//   })(req, res, next);
// });



app.post('/logout', function(req, res){
  req.session.destroy((err) => {
    if(err) throw err;
    res.loggedIn('false');
    res.redirect('/');
  })
  req.logout();
});

const port = process.env.PORT || 8080; 

app.listen(port, console.log('Server listening on : '+port));



