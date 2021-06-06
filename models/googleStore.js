const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    googleId: {
        type: String,
        required: true
    },
});

const User = mongoose.model('googleUsers', UserSchema);

module.exports = User;