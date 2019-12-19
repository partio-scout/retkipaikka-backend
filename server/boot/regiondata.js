const data = require("../scripts/locationdata.js");

module.exports = function (app, callback) {
    let dataUpdateModels = ["Regions", "Municipalities"];
    let updateCount = 0;
    let checkLength = function () {
        if (updateCount === dataUpdateModels.length) {
            callback()

        }
    }
    // add regions and municipality data to tables from file if they are not yet
    for (let i = 0; i < dataUpdateModels.length; ++i) {
        let model = dataUpdateModels[i];
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
            updateCount++;
            checkLength();
        });
    }




}