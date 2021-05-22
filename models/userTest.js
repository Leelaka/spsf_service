const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const User = new Schema({
    username: {
        type: String,
        required: true
    },
    email: { 
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    // resetLink: {
    //     data: String,
    //     default: ''
    // }

});


module.exports = mongoose.model('UserTest', User);