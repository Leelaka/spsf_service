var express = require('express'),
    app = express();

var port = process.env.PORT || 8080;   

app.use(express.static(__dirname +'/public'));

app.get('/',function(req,res){
    res.send('spsf_service')
})

app.listen(port);
console.log('Server listening on : '+port);