const express = require('express');
const app = express();
const path = require('path');
const env = require('dotenv').config();
const session = require('express-session');
const passport = require('./config/passport')
const db = require('./config/db');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
db()
const nocache = require('nocache');
const MongoStore = require('connect-mongo')
const cors = require('cors')

app.use(cors())

app.use(nocache());
app.use(express.json());    
app.use(express.urlencoded({extended:true}))

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});


app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    },
    store : MongoStore.create({
        mongoUrl :process.env.MONGODB_URI,
        ttl: 14 * 24 * 60 * 60
    })
}))


app.use(passport.initialize());
app.use(passport.session());




app.set('view engine','ejs');
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,'public')));
app.use(express.static(path.join(__dirname,'public/admin/public')));
app.use(express.static(path.join(__dirname,'public/admin/public')));


app.use('/admin',adminRouter);
app.use('/',userRouter);


app.listen(process.env.PORT,()=>{
    console.log(`server running ${process.env.PORT}`);
    
})



module.exports=app;


