// server.js
require('dotenv').config()

// set up ======================================================================
// get all the tools we need
const express  = require('express');
const app      = express();
const port     = process.env.PORT || 3000;

//goes into making a https:
const https  = require('https')
const fs = require('fs')
let privateKey 
let certificate 
let credentials 
if(process.env.ENVIRONMENT !== "production"){
  privateKey = fs.readFileSync('server.key', 'utf8');
  certificate = fs.readFileSync('server.cert', 'utf8');
  credentials= { key: privateKey, cert: certificate };
}
require('dotenv').config()


//stripe for payment
const stripe = require('stripe')(
  process.env.STRIPE_SECRET_KEY
)

//node fetch
const fetch = require('node-fetch')

// multer
const multer = require('multer')
const path = require('path')

const MongoClient = require('mongodb').MongoClient
const mongoose = require('mongoose');
const passport = require('passport');
const flash    = require('connect-flash');

const morgan       = require('morgan');
//logs everything that happens on your server
const cookieParser = require('cookie-parser');
//look at the cookies we store on comp keep track of who's logged in
const bodyParser   = require('body-parser');
//we can see what's inside a request
const session      = require('express-session');
//keeps an open session/ users logged in

const configDB = require('./config/database.js');
//url for database, file is an object

const ObjectId = require('mongodb').ObjectID

let db


// configuration ===============================================================
mongoose.connect(configDB.url, (err, database) => {
  if (err) return console.log(err)
  db = database
  require('./app/routes.js')(app, passport, db, ObjectId, stripe, fetch, multer, fs);
}); // connect to our database


require('./config/passport')(passport); // pass passport for configuration
//calling a function

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'))


app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
app.use(session({
    secret: 'rcbootcamp2021b', // session secret
    resave: true,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session


// launch ======================================================================
// app.listen(port); 
if(process.env.ENVIRONMENT !== "production"){
  const server = https.createServer(credentials, app);
  server.listen(port);
  console.log('The magic happens on port ' + port);
}else{
  app.listen(port);
  console.log('The magic happens on port ' + port);
}
