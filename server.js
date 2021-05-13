const MongoClient = require('mongodb').MongoClient;
var express = require('express')
const req = require('request');
const session = require('express-session'); //session
const MongoDBSession = require('connect-mongodb-session')(session)
const bcrypt = require('bcrypt');
const saltRounds = 10;

app = express();
var port = process.env.PORT || 8080;   
//var spsfUrl = 'https://spsfwebfront.mybluemix.net';
//var spsfDataanalysisUrl = 'https://spsfdataanalysis.us-south.cf.appdomain.cloud';
var spsfUrl = 'http://localhost:3000';
var spsfDataanalysisUrl = 'http://localhost:8081';
var parkingData;

const uri = "mongodb+srv://sit725:sit725@sit725.gwuvj.mongodb.net/spsf?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true})


app.use(express.static(__dirname +'/public'));

//use express body parser to get view data
app.use(express.urlencoded({ extended: true }));

//db collections
client.connect(err => {
  collectionUsers = client.db("spsf").collection("user");
  if(!err) console.log('user collection connected'); //res db connected 
});

const store = new MongoDBSession({
  uri: uri,
  collection: 'userSessions',
});

app.use(
  session({
    secret: "key that will sign cookies",
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);

//registration process
app.get('/register', async (request,response) => {

    let username = request.query.username
    let email = request.query.email
    let password = request.query.password
    let confirmPassword = request.query.confirmpassword

    const hashPassword = await bcrypt.hash(password, saltRounds);

    if (password === confirmPassword) {
  
      collectionUsers.findOne({ email: email }, function (err, result) {
        if (err) throw err;
  
        if (result === null) {
          collectionUsers.insertOne({ username: username, email: email , password: hashPassword });
          response.json({registration:'true', message:''})
        } else {
          response.json({registration:'false', message:'Error: username is already exist.'}) 
        }
      });  
    } else {
      response.json({registration:'false', message:'Error: password mismatched.'})
    }
});
  
//Authenticate user process
app.get('/authenticate', async (request, response) => {

  let username = request.query.username
  let password = request.query.password

  const user = await collectionUsers.findOne({username : username});

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


app.listen(port);
console.log('Server listening on : '+port);
