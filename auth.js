const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');

//user model 
const User = require('./models/userTest');

module.exports = function(passport) { 
    passport.use(
        new LocalStrategy({ usernameField: 'username' }, (username, password, done) => {
            //matching user 
            User.findOne({ username: username})
            .then(user => {
                if(!user) {
                    return done(null, false, {message: "username not registered"});
                }

                //matching password
                bcrypt.compare(password, user.password, (err, isMatch) => {
                    if(err) throw err;
                    if(isMatch) {
                        return done(null, user);
                    } else {
                        return done(null, false, {message: "password incorrect"});
                    }
                });
            })
            .catch(err => console.log(err));
        })
    )

    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });
      
    passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
    });
};