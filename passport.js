const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

//user model loading 
const User = require('./models/userTest');

module.exports = function(passport){ 
    passport.use(
        new LocalStrategy({ username: 'username'}, (username, password, done) =>{
            //validating the user
            User.findOne({ username: username })
            .then(user => {
                if(!user) {
                    return done(null, false, {message: 'user does not exist, please try again'});
                }

                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if(err) throw err;

                    if(isMatch) {
                        return done(null, user);
                    } else {
                        return done(null, false, {message: 'Password incorrect'});
                    }

                })
            })
            .catch(err => console.log(err));
        })
    );

    passport.serializeUser(function(user, done){
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        User.findById(id, function(err, user) {
            done(err, user);
        });
    });

};