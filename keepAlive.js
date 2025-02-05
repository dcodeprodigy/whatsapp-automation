const cron = require("cron");
const https = require("https");
require('dotenv').config();

const backendUrl = process.env.APP_URL;
const job = new cron.CronJob("*/14 * * * *", function () {
        https.get(backendUrl, (res) => {
            if (res.statusCode >= 300 ) {
                console.error(`Failed to ping server (${backendUrl}) - Status Code ${res.statusCode}`);
            }
        })
    }, null, true, 'Africa/lagos'); 
    
module.exports = { job };