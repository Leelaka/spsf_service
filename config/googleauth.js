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
    clientID: '453724700226-0h2fj3ijlmkkbc3inl37mdpi7vbc2qdn.apps.googleusercontent.com',
    clientSecret: 'swrlV8tlVbyLzZj1F_619E8k',
    callbackURL: "http://localhost:3000/google/callback",
    passReqToCallback: true
  },
  function(accessToken, refreshToken, profile, done) {
    console.log(profile);
    return done(null, profile);
  }
));