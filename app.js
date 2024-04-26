
console.log('Loading .env file...');
require('dotenv').config({path: './CONFIG.env'});

console.log('Loaded .env file:', process.env);

const validator = require('validator'); // validation library
var express = require("express"); // needed for http comms
var cookieParser = require('cookie-parser');
var session = require('express-session'); // session handling
const helmet = require('helmet'); // csp middleware
const cors = require('cors'); //cors middleware

const db = require ('./database'); // database set up
const log = require ('./logger'); //logging

//const fs = require('fs'); 
//const https = require('https'); // for running http server
const http = require('http');

const HTTPS_PORT = process.env.HTTPS_PORT || 8443;
const HTTP_PORT = process.env.HTTP_PORT || 3000;

var app = express();


const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));

// serve static content
app.use(express.static('public'));
 
app.set('view engine', 'ejs'); // Set template engine

// session set up
app.use(cookieParser());

// Session middleware configuration
const sessionConfig = {
  secret: process.env.SESSION_KEY,
  resave: true,
  saveUninitialized: true,
  rolling: true,
  maxAge: process.env.SESSION_TIMEOUT
};

if (app.get('env') === 'production') {
    app.set('trust proxy', 1) 
    sessionConfig.cookie = { secure: true }; // serve secure cookies
}

app.use(session(sessionConfig));

// attach session info so we can access to control what we display on 
// the front end
app.use((req, res, next) => {
  // Assuming user information is stored in the session
  res.locals.user = req.session.user;
  next();
});

// error handler middleware
function errorHandler(err, req, res, next) {
  log.error('Error:', err.stack);
  console.error('Error:', err.stack);
  res.status(500).render('sorry');
}

// Register the middleware function
app.use(errorHandler);


/* CSRF token handling */
const csrf = require('csurf');
app.use(csrf());

// Add CSRF token to response locals
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Use Helmet middleware
app.use(helmet());

const scriptSrc = process.env.SCRIPT_SRC.split(',');
const defaultSrc= process.env.DEFAULT_SRC.split(',');
const scriptSrcAttr= process.env.SCRIPT_SRC_ATTR.split(',');

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: defaultSrc,
      scriptSrc: scriptSrc,
      scriptSrcAttr: scriptSrcAttr
    },
  })
)

// Use CORS middleware
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS']
}));

// routes
const wineRoute = require('./routes/wines');
const cellarRoute = require('./routes/cellar');
const adminRoute = require('./routes/admin');
const auth = require('./routes/auth');
app.use('/wines', wineRoute);
app.use('/cellar', cellarRoute);
app.use('/admin', adminRoute);
app.use("/auth",auth);


// Force redirect to https in production
if (app.get('env') === 'production') {
  const forceHttps = (req, res, next) => {
    if (!req.secure) {
        // If the request is not secure (HTTP), redirect to the HTTPS version
        return res.redirect('https://' + req.hostname+":"+HTTPS_PORT + req.url);
    }
    next();
  };

  app.use(forceHttps);
}


//handle landing page
app.get('/', function(req,res) {    

    // session check
    // if they are logged in go to dashboard
    try {
      const user = req.session.user;

      if (user) {    

        let username = user.username;
        let userId = user.userId;

        // handle any error messages for display
        let message = req.query.message || '';
    
        if (!validator.isEmpty(message)) {
          message = validator.escape(message);
        }

        // if its an admin user play admin dashboard
        if (user.role == "admin") {
            return res.redirect('/admin');
        } else {

          // get all dashboard content - this users list of cellars (for now)       
          let query = `SELECT cellar_id, name, description FROM cellars WHERE user_id = ?`;

          db.query(query, [userId], (error, cellarResults) => {
            if (error) {
              log.error('Error executing query: ' + error.stack);
            } else {
              res.render('dashboard',{cellarResults:cellarResults,firstName:username,message:message, user});
            }
          });
        }
      } else {
          res.redirect('/auth/playLogin');
      }
    } catch (error) {
      log.error("error loading homepage: " + error);
      res.render('sorry');
  }
});

// handle any routes that don't exist
app.use((req, res) => {
  res.redirect('/');
});

 
// **********************************  Code to here **************************

// read certificate credientials
// note - this is for development purposes only - in real life they would be 
// configured with the application on a webserver
//var privateKey  = fs.readFileSync('./cert.key', 'utf8'); // TODO CLODAGH
//var certificate = fs.readFileSync('./cert.crt', 'utf8');
//var credentials = {key: privateKey, cert: certificate};

// create servers to listen to http and https traffic
var httpServer = http.createServer(app);
//var httpsServer = https.createServer(credentials, app);

//listen for traffic
httpServer.listen(HTTP_PORT);
//httpsServer.listen(HTTPS_PORT);
