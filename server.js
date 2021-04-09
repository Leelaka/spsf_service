var express = require('express'),
    app = express();

const req = require('request');

var port = process.env.PORT || 8080;   

app.use(express.static(__dirname +'/public'));

app.get('/',function(request,response){
   response.send('spsf_service')
})

app.get('/name',function(request,response){
    response.send('name - spsf_service')
 })

app.listen(port);
console.log('Server listening on : '+port);