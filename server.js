// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var port     = process.env.PORT || 3000;

//goes into making a https:
const https  = require('https')
const fs = require('fs')
const privateKey  = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');
const credentials = { key: privateKey, cert: certificate };

//stripe for payment
require('dotenv').config()
const stripe = require('stripe')(
  process.env.STRIPE_SECRET_KEY
)

//email 


const MongoClient = require('mongodb').MongoClient
var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');

var morgan       = require('morgan');
//logs everything that happens on your server
var cookieParser = require('cookie-parser');
//look at the cookies we store on comp keep track of who's logged in
var bodyParser   = require('body-parser');
//we can see what's inside a request
var session      = require('express-session');
//keeps an open session/ users logged in

var configDB = require('./config/database.js');
//url for database, file is an object

const ObjectId = require('mongodb').ObjectID

var db


// configuration ===============================================================
mongoose.connect(configDB.url, (err, database) => {
  if (err) return console.log(err)
  db = database
  require('./app/routes.js')(app, passport, db, ObjectId, stripe);
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
const server = https.createServer(credentials, app);
server.listen(port);
console.log('The magic happens on port ' + port);
