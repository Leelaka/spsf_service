const MongoClient = require('mongodb').MongoClient;
var express = require('express')
const req = require('request');
app = express();

var port = process.env.PORT || 8080;   
var spsfUrl = 'https://spsfwebfront.mybluemix.net';
var spsfDataanalysisUrl = 'https://spsfdataanalysis.us-south.cf.appdomain.cloud';
//var spsfUrl = 'http://localhost:3000';
//var spsfDataanalysisUrl = 'http://localhost:8081';
var parkingData;

const uri = "mongodb+srv://sit725:sit725@sit725.gwuvj.mongodb.net/spsf?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true});

app.use(express.static(__dirname +'/public'));

//use express body parser to get view data
app.use(express.urlencoded({ extended: true }));

//db collections
client.connect(err => {
  collectionUsers = client.db("spsf").collection("user");
  collectionHistory=client.db("spsf").collection("history");

});

//registration process
app.get('/register', function (request,response) {

    let username = request.query.username
    let email = request.query.email
    let password = request.query.password
    let confirmPassword = request.query.confirmpassword

    if (password === confirmPassword) {
  
      collectionUsers.findOne({ email: email }, function (err, result) {
        if (err) throw err;
  
        if (result === null) {
          collectionUsers.insertOne({ username: username, email: email , password: password });
          response.json({registration:'true', message:''})
        } else {
          response.json({registration:'false', message:'Error: username is already exist.'}) 
        }
      });  
    } else {
      response.json({registration:'false', message:'Error: password mismatched.'})
    }
})
  
//Authenticate user process
app.get('/authenticate', function (request, response) {

  let username = request.query.username
  let password = request.query.password

  collectionUsers.findOne({ username: username, password: password }, function (err, result) {
    if (err) throw err;
    if (result === null){
      response.json({authorisation:'false', message:'Error: invalid credentials.'})
    }else{
      response.json({authorisation:'true', message:''})
    }
  })
})
  
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


app.listen(port);
console.log('Server listening on : '+port);
