const MongoClient = require('mongodb').MongoClient;
var express = require('express')
const req = require('request');
var moment = require("moment")

app = express();
require('dotenv').config({path: __dirname + '/.env'})

const accountSid = process.env.TWILIO_ACCOUNT_SID;//ACcee13ca196223b861bbfe2919bfdd10d
const authToken = process.env.TWILIO_AUTH_TOKEN;//933f291d7a25eedcaae64a23fbd169e7
const Twilioclient = require('twilio')(accountSid, authToken);

//var spsfUrl = 'https://spsfwebfront.mybluemix.net';
//var spsfDataanalysisUrl = 'https://spsfdataanalysis.us-south.cf.appdomain.cloud';
var spsfUrl = 'http://localhost:3000';
var spsfDataanalysisUrl = 'http://localhost:8081';
var parkingData;

const uri = "mongodb+srv://sit725:sit725@sit725.gwuvj.mongodb.net/spsf?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true});
moment.suppressDeprecationWarnings = true;

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
}, 20000);


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


app.listen(port);
console.log('Server listening on : '+port);
