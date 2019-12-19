
//const data = require("../scripts/locationdata.js");
module.exports = function (app, callback) {
    'use strict'
    let updateCount = 0;
    let modelArr = Object.keys(app.models);
    var db = app.dataSources.db;
    let checkLength = function () {
        if (updateCount === modelArr.length) {
            console.log("Ended autoupdate");
            callback()

        }
    }
    console.log("Started autoupdate");
    // on server startup, check if any modifications are made to tables
    for (let i = 0; i < modelArr.length; ++i) {
        let model = modelArr[i];
        // update all models
        db.autoupdate(model, function () {
            console.log("Auto-updated model " + model + " successfully.");
            updateCount++;
            checkLength();
        });

    }

}



