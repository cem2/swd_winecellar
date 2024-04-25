const express = require("express");
let router = express.Router();

const db = require ('../database');
const log = require('../logger');

const validator = require('validator');

/* lists all users wines for this cellar */
router.route("/listCellarWine/:id").get(function(req,res,next) {

    try {
        log.info('listCellarWine:+' +req.params.id);

        // session check
        // if they are logged in
        // go to dashboard
        const user = req.session.user;
        const cellarId = req.params.id;
        const cellarName = req.query.name;
        const namePattern =  /^[a-zA-Z0-9\s-]+$/;

        // handle any error messages
        let message = req.query.message || '';
    
        if (!validator.isEmpty(message)) {
            message = validator.escape(message);
        }

        //check param ok
        if (!validator.isNumeric(cellarId) || ((typeof cellarName != 'undefined') && !namePattern.test(cellarName))) {
            return res.redirect('/?message="We had an issue fetching your wines');
        }
  
        if (user) {    
  
            let username = user.username;
            let userId = user.userId;

            const cellarData = {cellarName:cellarName,cellarId:cellarId};
  
            // get all user wines 
            let query = "select \
                            wa.winery_id, \
                            w.wine_id, \
                            wa.name as wineryName, \
                            w.name as wineName, \
                            w.year, \
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
                            and uw.cellar_id = ? \
                            and uw.wine_id = w.wine_id \
                            and uw.cellar_id = c.cellar_id \
                            and w.winery_id = wa.winery_id \
                            and wa.region_id = wr.region_id";

            db.query(query, [userId,cellarId], (error, wineResults) => {

                if (error) {
                    log.error('Error executing query' + error.stack);
                    next(error); // pass back to error handler
                    return
                } else {

                    try {
                        //we also need to pull out winery info so new wines can be added
                        let query2 = `select distinct country from winery_regions GROUP BY country`;

                        db.query(query2, (error2, countryResults) => {
                            if (error2) {
                                log.error('Error executing query' + error2.stack);
                                next(error2); // pass back to error handler
                                return
                            } else {
                                res.render('cellar',{wineResults:wineResults,firstName:username,cellarData:cellarData,country_data : countryResults, message:message});
                            }
                        });

                    } catch (e) {
                        next(e);
                    }
                }
            });
           
        } else {
            res.redirect('/auth/playLogin');
        }
    } catch (error) {
        // catch any sync code and send back to error handler
        next(error);
    }
});


// for drop downs
router.route("/get_data")
.get((request,response) => {

    var type = request.query.type;

    var search_query = request.query.parent_value;

    let query = '';

    if(type == 'load_region')
    {
        query = `
        select distinct region as Data, region_id as id FROM winery_regions 
        WHERE country = '${search_query}' 
        ORDER BY region ASC
        `;
    }

    if(type == 'load_winery')
    {
        query = `
        SELECT w.name AS Data, winery_id as id FROM winery w, winery_regions r
        WHERE r.region = '${search_query}' 
        and w.region_id = r.region_id
        ORDER BY w.name ASC
        `;
    }

    db.query(query, function(error, data){

        var data_arr = [];

        data.forEach(function(row){
            data_arr.push({ data: row.Data, id: row.id });
        });

        response.json(data_arr);
    });
});

router.route("/addCellar").post(function(req,res,next) {

    log.info("addCellar:+");
    const user = req.session.user;

    // check session
    if (user) {    

        let userId = user.userId;
        let newCellarName = req.body.newCellarName
        let newCellarDesc = req.body.newCellarDesc
        const namePattern =  /^[a-zA-Z0-9\s-]+$/;

        let errCount = 0;
        let errMessage = "";

        if (validator.isEmpty(newCellarDesc) || !namePattern.test(newCellarDesc)) {
            errCount++;
            errMessage = errMessage + " \nInvalid description"
        }
    
        if (validator.isEmpty(newCellarName) || !namePattern.test(newCellarName)) {
            errCount++;
            errMessage = errMessage + " \nInvalid name"
        }

        // sanitize - make sure no dodgy content 
        newCellarName = validator.escape(newCellarName);
        newCellarDesc = validator.escape(newCellarDesc);

        if (errCount > 0) {
            // redirect to load wine page again
            errMessage = "We had an issue adding your cellar: "+errMessage;
            return res.redirect('/?message='+errMessage);
        }

        const q1 = 'insert into cellars(name,description,user_id) values (?,?,?);'

        db.query(q1,[newCellarName,newCellarDesc,userId], (err,result) => {

            if (err) {
                log.error('Error executing query' + err.stack);
                next(err); // pass back to error handler
                return
            } else {
                log.info ("new cellar created: "+ result.insertId)
                res.redirect('/');
            }
        });
    } else {
        res.redirect('/auth/playLogin');
    }
});

/* add wine to cellar */
router.route("/addWine").post(function(req,res,next) {

    try {
        log.info ("addWine:+");
        const user = req.session.user;

       /* const csrfToken = req.csrfToken();
        const submittedCsrfToken = req.body._csrf;
        if (!submittedCsrfToken || submittedCsrfToken !== csrfToken) {
            res.redirect('/auth/logout');
        }*/

        // check session
        if (user) {

            let userId = user.userId;
            let name = req.body.newWineName;
            let errCount = 0;
            let errMessage = "";

            const colour = req.body.newWineColour
            const year = req.body.newWineYear
            const region = req.body.region
            const country = req.body.country
            const wineryId = req.body.winery
            const cellarId = req.body.cellarId
            const namePattern =  /^[a-zA-Z0-9\s-]+$/;
            
            // check we've a value for everything
            // validate and sanitize fields
            if (!validator.isNumeric(cellarId)) {
                log.error("invalid cellarId found")
                errMessage = errMessage + " \ninvalid params"
                errCount++;
            }

            if (!validator.isNumeric(wineryId)) {
                log.error("invalid wineryId found")
                errMessage = errMessage + " \ninvalid params"
                errCount++;
            }

            if (!validator.isEmpty(name)) {
                name = validator.escape(name);
            } else {
                errMessage = errMessage + " \nPlease specify a valid name"
                errCount++;
            }

            if (validator.isEmpty(year) || !validator.isNumeric(year)) {
                errCount++;
                errMessage = errMessage + " \nPlease specify a valid year"
            } 

            if (validator.isEmpty(colour) || !validator.isAlphanumeric(colour)) {
                errCount++;
                errMessage = errMessage + " \nPlease specify a valid colour"
            }

            if (validator.isEmpty(country) || !namePattern.test(country)) {
                errCount++;
                errMessage = errMessage + " \nInvalid country"
            }

            if (validator.isEmpty(region) || !namePattern.test(region)) {
                errCount++;
                errMessage = errMessage + " \nInvalid region"
            }

            if (errCount > 0) {
                // redirect to load wine page again
                errMessage = "We had an issue adding your wine: "+errMessage;
                return res.redirect('/cellar/listCellarWine/'+cellarId+'?message='+errMessage);
            }

            // Begin a transaction
            db.beginTransaction();

            const q1 = 'insert into wines(winery_id,name,year,colour) values (?,?,?,?);'

            db.query(q1,[wineryId,name,year,colour], (err,result) => {

                if (err) {
                    log.error('Error executing query' + err.stack);
                    next(err); // pass back to error handler
                    return
                } else {
                    let wineId = result.insertId;
                    const q2 = 'insert into usercellarwines(cellar_id,wine_id,user_Id) values (?,?,?);';

                    db.query(q2,[cellarId,wineId,userId], (err2,result) => {
                        if (err2) {
                            log.error('Error executing query' + err2.stack);
                            next(err2); // pass back to error handler
                            return
                        } else {
                            let userWineId = result.insertId;
                            log.info("new wine id:" + userWineId)
                            
                            // redirect to load cellar again
                            res.redirect('/cellar/listCellarWine/'+cellarId);
                        }     
                    });
                }
            });

            db.commit();

        } else {
            res.redirect('/auth/playLogin');
        }
    } catch (error) {
        try { 
            db.rollback();
        } catch {
            log.error("failed to roll back transaction:" +error);
        }
        next.error();
    }
});


//handle cellar landing page
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


/* delete a cellar */
router.route("/delete/:cellarId").delete(function(req,res) {

    // session check
    // if they are logged in
    // go to dashboard
    const user = req.session.user;

    if (user) {  
            const cellarId = req.params.cellarId;
            const userId = user.userId

            // check ok
            if (!validator.isNumeric(cellarId)) {
                return res.redirect('/');
            }

            // this will only work if there is no wines in it
            const q = 'delete usercellarwines, cellars \
                        from usercellarwines \
                        left join cellars on usercellarwines.cellar_id = cellars.cellar_id \
                        where usercellarwines.user_Id = ? and usercellarwines.cellar_id = ?';

            db.query(q,[userId,cellarId], (err) => {
                if (err) {
                    console.error("deleting cellar error running query" +err);
                    // redirects to home dashboard
                    return res.redirect('/');
                } else {
                    console.info('Cellar deleted successfully:', cellarId);
                    res.sendStatus(204);
                }     
            });
    } else {
        res.redirect('/auth/playLogin');
    }
});

module.exports = router;