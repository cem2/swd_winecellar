const express = require("express");
const router = express.Router();

const db = require ('../database');

const validator = require('validator');
const log = require('../logger');


router.route("/").get(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;

    if (user) {    
            // redirects to home dashboard
            res.redirect('/');
    } else {
        res.redirect('/auth/playLogin');
    }

});

/* add wine tasting notes for a bottle*/
router.route("/addNote").post(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;

    if (user) {   
        
        // get info on the wine
        const userId = user.userId;
        const wineId = req.body.wineId;
        let note = req.body.note

        // check comment is not empty, if its not then escape it
        // to avoid cross-site scripting and injection attacks
        if (!validator.isEmpty(note)) {
            
            note = validator.escape(note);

            const query = "insert into privateComment(user_id,wine_id,comment) values (?,?,?)"

            db.query(query,[userId,wineId,note], (err) => {
                if (err) {
                    log.error("addNote error running query" +err);
                    // redirects to home dashboard
                    res.redirect('/');
                    return
                } else {
                    // redirect to load wine page again
                    res.redirect('/wines/'+wineId);
                }     
            });
        } else {
            res.redirect('/wines/'+wineId);
        }

    } else {
        res.redirect('/auth/playLogin');
    }


});

// update wine info
router.route("/updateWine").post(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;

    if (user) {   
        
        // get info on the wine
        const userId = user.userId;
        const wineId = req.body.wineId;

        let colour = req.body.newWineColour;
        let year = req.body.newWineYear;
        let name = req.body.newWineName;
        let count = req.body.count;
        let status = req.body.selectedStatus;
        let errCount = 0;
        let errMessage = "";

        // validate and sanitize fields
        if (!validator.isEmpty(name)) {
            name = validator.escape(name);
        } else {
            errMessage = errMessage + " \nPlease specify a name"
            errCount++;
        }

        if (validator.isEmpty(year) || !validator.isNumeric(year)) {
            errCount++;
            errMessage = errMessage + " \nPlease specify a year"
        } 

        if (validator.isEmpty(colour) || !validator.isAlphanumeric(colour)) {
            errCount++;
            errMessage = errMessage + " \nPlease specify a colour"
        }

        if (validator.isEmpty(count) || !validator.isNumeric(count)) {
            errCount++;
            errMessage = errMessage + " \nPlease specify a how many bottles"
        }

        if (validator.isEmpty(status) || !(/^[SXD]$/.test(status))) {
            errCount++;
            errMessage = errMessage + " \nInvalid status"
        }

        if (errCount > 0) {
            // redirect to load wine page again
            errMessage = "We had an issue updating your wine: "+errMessage;
            return res.redirect('/wines/'+wineId+'?message='+errMessage);
        } else {

            const query = "update wines set year = ?, name = ?, colour = ? where wine_id = ? "

            db.query(query,[year,name,colour,wineId], (err) => {
                if (err) {
                    log.error("updateWine error running query" +err);
                    // redirects to dashboard
                    return res.redirect('/');
                } else {

                    // now get all the comments
                    const q2 = 'update usercellarwines set count = ?,status = ? where user_id = ? and wine_id = ?';

                    db.query(q2,[count,status,userId,wineId], (err) => {
                        if (err) {
                            console.error("updateWine error running query" +err);
                            // redirects to dashboard
                            return res.redirect('/');
                        } else {
                            // redirect to load wine page again
                            res.redirect('/wines/'+wineId);
                        }
                    });
                }
            });
        }
    } else {
        res.redirect('/auth/playLogin');
    }
});

// update the comments on this wine
router.route("/updateNotes").post(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;

    if (user) {   
        
        // get info on the wine
        const userId = user.userId;
        let note = req.body.note;
        const wineId = req.body.wineId;
        const privCommentId = req.body.priv_comment_id;

        if (!validator.isEmpty(note)) {
            
            note = validator.escape(note);

            const query = "update privateComment set comment = ? where wine_id = ? and user_id = ? and priv_comment_id = ?"

            db.query(query,[note,wineId,userId,privCommentId], (err) => {
                if (err) {
                    log.error("updateNotes error running query" +err);
                    // redirects to dashboard
                    return res.redirect('/');
                } else {
                    // redirect to load wine page again
                    return res.redirect('/wines/'+wineId);
                }     
            });
        } else {
            res.redirect('/wines/'+wineId);
        }

    } else {
        res.redirect('/auth/playLogin');
    }

});

router.route("/listAll").get(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;
    if (user) {   
        
            // get info on the wine
            let userId = user.userId;

            // get all user wines 
            let query = "select \
                            wa.winery_id, \
                            w.wine_id as wineId, \
                            wa.name as wineryName, \
                            w.name as wineName, \
                            w.year, \
                            w.colour, \
                            w.name, \
                            uw.count, \
                            c.cellar_id as cellarId, \
                            c.name as cellarName, \
                            c.description as cellarDesc, \
                            wr.region, \
                            wr.country, \
                        case \
                            when uw.status = 'A' then 'Stored' \
                            when uw.status = 'X' then 'Gone' \
                            when uw.status = 'D' then 'Drinking' \
                        end as status \
                        from  \
                            winery wa, \
                            wines w, \
                            usercellarwines uw, \
                            winery_regions wr, \
                            cellars c \
                        where \
                            uw.user_id = ? \
                            and uw.wine_id = w.wine_id \
                            and uw.cellar_id = c.cellar_id \
                            and w.winery_id = wa.winery_id \
                            and wa.region_id = wr.region_id";


            db.query(query, [userId], (error, wineResults) => {
                if (error) {
                    log.error('Error executing query: ' + error.stack);
                    return res.redirect('/'); 
                    
                } else {
                    log.info('success');
                    return res.render('wines',{wineResults:wineResults});
                    
                }
            });            
    } else {
        res.redirect('/auth/playLogin');
    }

});


router.route("/:id").get(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;
    const wineId = req.params.id;

    // handle any error messages
    let message = req.query.message || '';
    
    if (!validator.isEmpty(message)) {
        message = validator.escape(message);
    }

    if (user) {   
        
            // get info on the wine
            let userId = user.userId;

            // get all user wines 
            let query = "select \
                            wa.winery_id, \
                            w.wine_id as wineId, \
                            wa.name as wineryName, \
                            w.name as wineName, \
                            w.year, \
                            w.colour, \
                            w.name, \
                            uw.count, \
                            c.cellar_id as cellarId, \
                            c.name as cellarName, \
                            c.description as cellarDesc, \
                            wr.region, \
                            wr.country, \
                        case \
                            when uw.status = 'S' then 'Stored' \
                            when uw.status = 'X' then 'Gone' \
                            when uw.status = 'D' then 'Drinking' \
                        end as status \
                        from  \
                            winery wa, \
                            wines w, \
                            usercellarwines uw, \
                            winery_regions wr, \
                            cellars c \
                        where \
                            uw.user_id = ? \
                            and uw.wine_id = ? \
                            and uw.wine_id = w.wine_id \
                            and uw.cellar_id = c.cellar_id \
                            and w.winery_id = wa.winery_id \
                            and wa.region_id = wr.region_id";


            db.query(query, [userId, wineId], (error, wineResults) => {
                if (error) {
                    log.error('Error executing query: ' + error.stack);
                    return res.redirect('/');  
                } else {

                    log.info('success');

                    // now get all the comments
                    const q2 = 'select comment, priv_comment_id, wine_id as wineId from privateComment where user_id = ? and wine_id = ?';

                    db.query(q2,[userId,wineId], (err,result) => {
                        if (err) {
                            log.error("error running query" +err);
                            // redirects to home dashboard
                            return res.redirect('/');
                        } else {
                            // redirect to load wine page again
                            res.render('wineBottle',{wineResults:wineResults,wineComments:result,message:message});
                        }     
                    });
                }
            });            
    } else {
        res.redirect('/auth/playLogin');
    }
});


/* delete a wine from a cellar */
router.route("/delete/:cellarId/:wineId").delete(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;

    if (user) {  
            const wineId = req.params.wineId;
            const cellarId = req.params.cellarId;
            const userId = user.userId

            if (!validator.isNumeric(wineId) || !validator.isNumeric(cellarId)) {
                return res.redirect('/');
            }

            const q = 'delete from usercellarwines where user_id = ? and wine_id = ? and cellar_id = ?';

            //don't delete from wines in case its commented on by other users in global list
            //not yet implemented

            db.query(q,[userId,wineId,cellarId], (err) => {
                if (err) {
                    log.error("deleting wine error running query" +err);
                    // redirects to home dashboard
                    return res.redirect('/');
                } else {
                    log.info('Wine deleted successfully:', wineId);
                    res.sendStatus(204);
                }     
            });
    } else {
        res.redirect('/auth/playLogin');
    }
});


router.route("/deleteComment/:id").delete(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;

    if (user) {  
            const commentId = req.params.id;
            const userId = user.userId

            const q = 'delete from privateComment where user_id = ? and priv_comment_id = ?';

            db.query(q,[userId,commentId], (err) => {
                if (err) {
                    console.error("deleting comment error running query" +err);
                    // redirects to home dashboard
                    res.redirect('/');
                    return
                } else {
                    console.log('Comment deleted successfully:', commentId);
                    res.sendStatus(204);
                }     
            });
    } else {
        res.redirect('/auth/playLogin');
    }
});

module.exports = router;

