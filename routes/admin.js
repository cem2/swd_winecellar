const express = require("express");
const router = express.Router();

const db = require('../database');
const log = require('../logger');

router.route("/").get(function(req,res) {

    // session check
    const user = req.session.user;

    if (user) {  
        const role =  user.role;
        if (role != "admin") {

            // this person cannot access this function
            //return res.status(403).send('Access Forbidden: You are not authorized for this function');
            log.error ("unauthorized access attempt");
            return res.status(403).redirect('/');
        }
        
        // render admin page
        res.render('admin');
    } else {
        res.redirect('/auth/playLogin');
    }
});


router.route("/getUsers").get(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;

    if (user) {
        const role = user.role;

        if (role != "admin") {
            // this person cannot access this function
            log.error ("unauthorized access attempt");
            return res.status(403).redirect('/');   
        }
        
        const email = req.query.search;

        const query = "select * from users where email = ?"
        let message = ""
        db.query(query, [email], (error, searchResults) => {
            if (error) {
                log.error('Error executing query: ' + error.stack);

                return res.render('admin',{message:"something went wrong"});
            } else {
                if (searchResults.length > 0) {
                    message = "Results"
                } else {
                    message = "Sorry no such user"
                }
                return res.render('admin',{searchResults:searchResults, message:message});
            }
        });
    } else {
        res.redirect('/auth/playLogin');
    }
});


/* add wine tasting notes for a bottle*/
router.route("/deleteUser").post(function(req,res,next) {

    // session check

    const user = req.session.user;

    try {

        if (user) {   
        
            // get info on the wine
            const role =  user.role;
            const deleteUserId = req.body.deleteUserId;
            const deleteUsername = req.body.deleteUsername;

            if (role != "admin") {
                // this person cannot access this function
                return res.status(403).send('Access Forbidden: You are not authorized for this function');
            }

            db.beginTransaction((err) => {
                if (err) {
                  console.error('Error beginning transaction:', err);
                  return;
                }

                const q0 = 'delete from usercellarwines where user_id = ?';
                const q1 = 'delete from cellars where user_id = ?';
                const q2 = "delete from privatecomment where user_id = ?"
                const q3 = "delete from users where user_id = ? AND userName = ?";

                db.query(q0,[deleteUserId], (err0) => {
                    if (err0) {
                        log.error("delete user error running query" +err0);
                        // redirects to admin dashboard
                        if (err0) {
                            db.rollback(() => {
                              console.error('Error performing transaction:', err0);
                              db.end(); // Close the connection in case of error
                            });
                            return res.render('admin',{message:"Could not delete user " +deleteUsername});
                          }
                    } else {

                        db.query(q1,[deleteUserId], (err1) => {
                            if (err1) {
                                db.rollback(() => {
                                    console.error('Error performing transaction:', err1);
                                    db.end(); // Close the connection in case of error
                                });
                                return res.render('admin',{message:"Could not delete user " +deleteUsername});
                        
                            } else {
                                db.query(q2,[deleteUserId], (err2) => {
                                    if (err2) {
                                        db.rollback(() => {
                                            console.error('Error performing transaction:', err2);
                                            db.end(); 
                                        });
                                        return res.render('admin',{message:"Could not delete user " +deleteUsername});
                                    } else {
                                        db.query(q3,[deleteUserId, deleteUsername], (err3) => {
                                            if (err3) {
                                                db.rollback(() => {
                                                    console.error('Error performing transaction:', err3);
                                                    db.end(); 
                                                });
                                                return res.render('admin',{message:"Could not delete user " +deleteUsername});
                                            } else {
                                                db.commit((err4) => {
                                                    if (err4) {
                                                      return db.rollback(() => {
                                                        console.error('Error committing transaction:', err4);
                                                        db.end(); 
                                                      });
                                                    }
                                                })
                                              
                                                log.info("successfully deleted user "+deleteUsername);
        
                                                return res.render('admin',{message:"Successfully deleted user "+deleteUsername});
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            });
        } else {
            res.redirect('/auth/playLogin');
        }
    } catch (err) {
        db.rollback(() => {
            console.error('Error performing transaction:', err);
            db.end(); 
        });
        log.error ("issue in deleteUser ");
        next(err);
    }
});

module.exports = router;

