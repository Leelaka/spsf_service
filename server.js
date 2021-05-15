const MongoClient = require('mongodb').MongoClient;
var express = require('express')
const req = require('request');
const session = require('express-session'); //session
const MongoDBSession = require('connect-mongodb-session')(session)
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const passport = require('passport');

//passport js
require('./passport')(passport)

app = express();
var port = process.env.PORT || 8080;   
//var spsfUrl = 'https://spsfwebfront.mybluemix.net';
//var spsfDataanalysisUrl = 'https://spsfdataanalysis.us-south.cf.appdomain.cloud';
var spsfUrl = 'http://localhost:3000';
var spsfDataanalysisUrl = 'http://localhost:8081';
var parkingData;

const uri = "mongodb+srv://sit725:sit725@sit725.gwuvj.mongodb.net/spsf?retryWrites=true&w=majority";
// const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true})

const userModel = require("./models/userTest");

app.use(express.static(__dirname +'/public'));

//use express body parser to get view data
app.use(express.urlencoded({ extended: true }));

//db collections
try {
  // Connect to the MongoDB cluster
  mongoose.connect(
uri,
    { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true},
    () => console.log(" Mongoose is connected...")
  );
} catch (e) {
  console.log("could not connect...");
}

const store = new MongoDBSession({
  uri: uri,
  collection: 'userSessions',
});

//express sesssion 

app.use(
  session({
    secret: "key that will sign cookies",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

//passport midware 
app.use(passport.initialize());
app.use(passport.session());

//authenticate users and pass to dashboard 
// const isAuth = (req, res, next) => {
//   if(req.session.isAuth) {
//     next()
//   } else {
//     res.loggedIn=false;
//   }
// }

//registration process
app.get('/register', async (request,response) => {

    let username = request.query.username
    let email = request.query.email
    let password = request.query.password
    let confirmPassword = request.query.confirmpassword

    const hashPassword = await bcrypt.hash(password, saltRounds);

    // let userDetails = await userModel.findOne({email});

    if (password === confirmPassword) {

      userModel.findOne({ email }, function (err, result) {
        if (err) throw err;
        if (result === null) {
          const new_user_Model = new userModel
          ({ 
            username, 
            email, 
            password: hashPassword
          });
          new_user_Model.save();
          response.json({registration:'true', message:''})
          console.log(new_user_Model)
        } else {
          response.json({registration:'false', message:'Error: username is already exist.'}) 
        }
      });  
    } else {
      response.json({registration:'false', message:'Error: password mismatched.'})
    }
});


//Authenticate user process
app.get('/authenticate', passport.authenticate('local'), async (request, response) => {
  
  let username = request.query.username
  let password = request.query.password

  const user = await userModel.findOne({username : username});
  
  if(!username)
  {
      throw err;
  }
  
  const comparePassword = await bcrypt.compare(password, user.password);


  if (!comparePassword){
      response.json({authorisation:'false', message:'Error: invalid credentials.'})
  }
  else
  {
      request.session.isAuth = true;
      response.json({authorisation:'true', message:''}) 

  }
  
  // collectionUsers.findOne({ username: username, password: password }, function (err, result) {
  //   if (err) throw err;
  //   if (result === null){
  //     response.json({authorisation:'false', message:'Error: invalid credentials.'})
  //   }else{
  //     response.json({authorisation:'true', message:''})
  //   }
  // })

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

app.get('/signoff', (req, res) => {
  req.session.destroy((err) => {
    if(err) throw err;
    res.redirect('/');
    //res.loggedIn=false;
  });
});


app.listen(port);
console.log('Server listening on : '+port);


