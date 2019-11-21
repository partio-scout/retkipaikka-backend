
const data = require("../scripts/locationdata.js");
module.exports = async function (app) {
    'use strict'
    var db = app.dataSources.db;
    let modelArr = Object.keys(app.models);
    for (let i = 0; i < modelArr.length; ++i) {
        let model = modelArr[i];
        // update all models
        // add data to Regions and Municipalities if they are empty
        await db.autoupdate(model, function () {
            console.log("Auto-updated model " + model + " successfully.");
            if (model === "Regions" || model === "Municipalities") {
                app.models[model].count().then(res => {
                    console.log(res + " entries in model " + model);
                    if (res === 0) {
                        let locationData = data[model];
                        app.models[model].create(locationData).then(res => {
                            console.log("Data added to model " + model)
                        }).catch(err => {
                            console.error(err);
                        })

                    }

                });
            }
        });
    }
}