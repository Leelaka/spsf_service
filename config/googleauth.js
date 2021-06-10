const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
//user model 
const User = require('../models/userTest');
const findOrCreate = require("mongoose-findorcreate");

passport.serializeUser((user, done) => {
    done(null, user.id);
})

passport.deserializeUser((user, done) => {
    done(null, user.id);
})

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_GOOGLE,
    passReqToCallback: true
  },
  function(accessToken, refreshToken, profile, done) {
    console.log(profile);
    return done(null, profile);
  }
));