    const passport=require('passport');
    const GoogleStrategy = require('passport-google-oauth20').Strategy;
    const User = require('../models/userSChema');
    const env = require('dotenv').config();



    passport.use(new GoogleStrategy({
        clientID:process.env.GOOGLE_CLIENT_ID,
        clientSecret:process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "https://perfuma.shop/auth/google/callback"   

    },

    async (accessToken,refreshToken,profile,done)=>{
        try {
            let user = await User.findOne({googleId:profile.id});
            if(user){
                return done(null,user);
            }else{
                user = new User({
                    name:profile.displayName,
                    email:profile.emails[0].value,
                    googleId:profile.id,
                });
                await user.save();
                return done(null,user);
            }
            
        } catch (err) {
            return done(err,null)
            
        }
    }
))

passport.serializeUser((user,done)=>{
   
    done(null,user.id)
});

passport.deserializeUser(async(id,done)=>{
    try {
        const user = await User.findById(id)
        done(null,user)
    } catch (error) {
        done(err,null)
    }
})


module.exports = passport;