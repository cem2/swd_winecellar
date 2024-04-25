// Handles registration, login and logout
// as well as setting up sessions

const express = require("express");
const router = express.Router();

// password hashing
const bcrypt = require("bcrypt");
const validator = require('validator');

/*db connection*/
const db = require ('../database');
const log = require('../logger');

// password policy rules
const MIN_PASSWORD_LENGTH = 8;
const SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/* register a new user */
router.route("/register").post(function(req,res,next) {

    log.info("register:+");

    let username = req.body.username; 
    const password = req.body.password
    const firstName = req.body.firstName
    const lastName = req.body.lastName
    const email = req.body.email

    var userId,groupId,role;

    if (validator.isEmpty(email) || !validator.isEmail(email)) {
        return res.render('register',{ message: 'Invalid email' });
    }

    if (validator.isEmpty(username) || !validator.isAlphanumeric(username) || !validator.isLength(username, {min:3})) {
        return res.render('register',{ message: 'Please enter a valid username of at least 3 characters' });
    }
    username = username.toLowerCase();

    if (validator.isEmpty(firstName) || !validator.isAlphanumeric(firstName)) {
        return res.render('register',{ message: 'Please enter a valid  firstName' });
    }

    if (validator.isEmpty(lastName) || !validator.isAlphanumeric(lastName)) {
        return res.render('register',{ message: 'Please enter a valid lastName' });
    }

    log.info("Register: username "+username +",firstName "+firstName +",lastName "+lastName+"email "+email);

    // Validate password against policy rules
    if (
        password.length < MIN_PASSWORD_LENGTH ||
        !(/[A-Z]/.test(password) && /[a-z]/.test(password)) ||
        !/\d/.test(password) ||
        !SPECIAL_CHARS_REGEX.test(password)
    ) {
        return res.render('register',{ message: 'Passwords must be '+MIN_PASSWORD_LENGTH+' long and contain upper \
                                        and lower case characters as well as special characters and digits' });
    }

    try {
        const hashedPassword = bcrypt.hashSync(password, 10); // hash password 10 salt rounds

        // check if user already exists
        const q = 'select 1 from users where username = ? or email = ?'

        db.query(q,[username,email], (err,rs) => {
            if (err) {
                log.error('Error executing query' + err.stack);
                next(err); // pass back to error handler
                return
            } else if (rs.length == 0) {

                // insert user into the database - parameterised query
                // to avoid SQL injection

                const q2 = 'insert into users(username,password,firstname,lastname,email,group_id) \
                            values (?,?,?,?,?,(select group_id from usergroups where role = \'users\'));'
    
                db.query(q2,[username,hashedPassword,firstName,lastName,email], (err2,result) => {

                    if (err2) {
                        log.error('Error executing query' + err2.stack);
                        next(err2); // pass back to error handler
                        return
                    } else {

                        userId = result.insertId;
                        log.info ("new userId" + userId);

                        const q3 = "select * from users u, usergroups ug where u.group_id = ug.group_id and u.user_id = ?"

                        // Select the inserted row using the ID
                        db.query(q3, [userId], (err3, res2) => {
                            if (err3) {
                                log.error('Error executing query' + err2.stack);
                                next(err3); // pass back to error handler
                                return
                            }
                            
                            console.log('New user created:', res2[0]);
                            groupId = res2[0].group_id;
                            role = res2[0].role; // group role

                            req.session.user = { userId: userId, username: username, groupId: groupId, role:role};

                            log.info ("on registration - session:" +JSON.stringify(req.session.user));
    
                            // replay home page
                            return res.redirect('/');
                        });
                    }
                });
            } else {
                return res.render('register',{ message: 'username or email already exists' });
            }
        });

    } catch (err) {
        log.error("error registation: " + err);
        next(err);
    }
});



router.route("/submitlogin").post(function(req,res,next) {

    log.info("submitlogin:+");

    try {
        const user = req.session.user;

        /*const csrfToken = req.csrfToken();
        const submittedCsrfToken = req.body._csrf;
        if (!submittedCsrfToken || submittedCsrfToken !== csrfToken) {
            res.redirect('/auth/logout');
        }*/

        if (user) {
            // play dashboard
            return res.render('dashboard',{message:"Welcome back"});
        } else {
            //login them in
            let username = req.body.username; 
            const password = req.body.password

            if (validator.isEmpty(username) || !validator.isAlphanumeric(username) || !validator.isLength(username, {min:3})) {
                console.log("returning on username" + validator.isEmpty(username) + validator.isAlphanumeric(username) + validator.isLength(username, {min:3}));
                return res.render('login-page',{ message: 'Please enter a valid username of at least 3 characters' });
            }

            //lowercase
            username = username.toLowerCase();

            if (
                password.length < MIN_PASSWORD_LENGTH ||
                !(/[A-Z]/.test(password) && /[a-z]/.test(password)) ||
                !/\d/.test(password) ||
                !SPECIAL_CHARS_REGEX.test(password)
            ) {
                return res.render('login-page',{ message: 'Passwords must be '+MIN_PASSWORD_LENGTH+' long and contain upper \
                                                and lower case characters as well as special characters and digits' });
            }

            let query = `select * from users u, usergroups ug where u.group_id = ug.group_id and u.username = ?`;

            db.query(query, [username], (error, results) => {
                if (error) {
                    log.error('Error executing query' + error.stack);
                    next(error); // pass back to error handler
                    return
                }
            
                // we should only have one entry
                if (results.length === 1) {
                    const hashedpwd = results[0].password;

                    bcrypt.compare(password, hashedpwd, function(err, result) {

                        if (err) {
                            log.error('error checking password' + err.stack);
                            next(err); // pass back to error handler
                            return
                        } else {
                            if (result) {
                                let userId = results[0].user_id;
                                let userName = results[0].username;
                                let groupId = results[0].group_id;
                                let role = results[0].role;

                                // set up session
                                req.session.user = { userId: userId, username: userName, groupId: groupId, role:role};

                                log.info ("session:" +req.session.user.role);

                                // replay home page
                                return res.redirect('/');
                            
                            } else {
                                return res.render('login-page',{ message: 'Invalid username or password' });
                            }
                        }
                    });
                } else {
                    // No user found or credentials don't match
                    return res.render('login-page',{ message: 'Invalid username or password' });
                }
            });  
        }
    } catch (error) {
        log.error("error submitLogin: " + error);
        next(error);
    }
});


/* plays login page */
router.route("/playLogin")
.get((req,res) => {

    log.info("playLogin");

    const user = req.session.user;
    
    if (user) {
        // play dashboard
        res.render('dashboard',{message: ''});
    } else {
        res.render('login-page', {message: ''});
    }
});

/* plays login page */
router.route("/playRegister")
.get((req,res) => {

    log.info("playRegister");

    const user = req.session.user;
    
    if (user) {
        const username = user.username;
        // play dashboard
        res.render('dashboard',{firstName: username, message: 'welcome back'});
    } else {
        res.render('register', {message: ''});
    }
});

router.route("/playResetPassword")
.get((req,res) => {

    log.info("playResetPassword");

    const user = req.session.user;
    
    if (user) {
        // play dashboard
        res.render('reset-password',{message: ''});
    } else {
        res.render('login-page', {message: ''});
    }
});

router.route("/resetPassword").post(function(req,res,next) {

    log.info("resetPassword:+");

    try {

        const user = req.session.user;

        if (user) {

            const userId = user.userId;
            const currentPassword = req.body.currentPassword;
            const newPassword1 = req.body.newpassword1;
            const newPassword2 = req.body.newpassword2;
            const passwordCheck = [currentPassword,newPassword1,newPassword2]
             

            /*for (const v of passwordCheck) {
                console.log(v);
                if (
                    v.length < MIN_PASSWORD_LENGTH ||
                    !(/[A-Z]/.test(v) && /[a-z]/.test(v)) ||
                    !/\d/.test(v) ||
                    !SPECIAL_CHARS_REGEX.test(v)
                ) {
                    return res.render('reset-password',{ message: 'Passwords should be '+MIN_PASSWORD_LENGTH+' long and contain upper \
                                                and lower case characters as well as special characters and digits' });
                }
            }*/
            
            passwordCheck.forEach(v => {
                // validate passwords meet criteria
                if (
                    v.length < MIN_PASSWORD_LENGTH ||
                    !(/[A-Z]/.test(v) && /[a-z]/.test(v)) ||
                    !/\d/.test(v) ||
                    !SPECIAL_CHARS_REGEX.test(v)
                ) {
                    return res.render('reset-password',{ message: 'Passwords should be '+MIN_PASSWORD_LENGTH+' long and contain upper \
                                                and lower case characters as well as special characters and digits' });
                }
            });

            // check newPassword fields match
            if (newPassword1 != newPassword2) {
                return res.render('reset-password',{message:"New passwords do not match"});
            }

            // verify old password
            let query = `select * from users u, usergroups ug where u.group_id = ug.group_id and u.user_id = ?`;

            db.query(query, [userId], (error, results) => {
                if (error) {
                    log.error('Error executing query' + error.stack);
                    next(error); // pass back to error handler
                    return
                }
            
                // we should only have one entry
                if (results.length === 1) {
                    const hashedpwd = results[0].password;

                    bcrypt.compare(currentPassword, hashedpwd, function(err, result) {

                        if (err) {
                            log.error('error checking password' + err.stack);
                            next(err); // pass back to error handler
                            return
                        } else {
                            if (result) {
                                const hashedNewPassword = bcrypt.hashSync(newPassword1, 10);
                               
                                let q2 = 'update users set password = ? where user_id = ?'

                                db.query(q2, [hashedNewPassword, userId], (err2) => {
                                    if (err2) {
                                        log.error('Error executing query' + err2.stack);
                                        next(err2); // pass back to error handler
                                        return
                                    } else {

                                        // ideally you would send an email now also

                                        // destroy session
                                        req.session.destroy(err => {
                                            if (err) {
                                                log.error('Error destroying session:', err);
                                                res.status(500).send('Error updating password');
                                            } else {
                                                // Redirect the user to the login page or any other appropriate page
                                                res.redirect('login-page');
                                            }
                                        });
                                    }
                                });
                            } else {
                                return res.render('reset-password',{message:"Incorrect password"});
                            }
                        }
                    });
                }
            });
        } else {
            // they should be logged in
            res.render('login-page', {message: ''});
        }
    } catch (error) {
        log.error("error reset-password: " + error);
        next(error);
    }
});


/*  logout  */
router.route("/logout")
.get((req,res) => {

    log.info("logout");
    req.session.destroy(err => {
        if (err) {
            log.error('Error destroying session:', err);
            res.status(500).send('Error logging out');
        } else {
            // Redirect the user to the login page or any other appropriate page
            res.redirect('/auth/playLogin');
        }
    });
});


module.exports = router;


