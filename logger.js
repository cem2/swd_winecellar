
//const fs = require('fs'); 
const bunyan = require('bunyan');

const logFile = process.env.LOGFILE || './logs/server.log';

const log = bunyan.createLogger({
    name: 'winecellar',
    streams: [{
        path: logFile, 
        verbose: false
    }]
});

module.exports = log;