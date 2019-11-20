

module.exports = function (app) {
    'use strict'
    let dataModels = ["Regions", "Municipalities"];
    var db = app.dataSources.db;
    let modelArr = Object.keys(app.models);
    for (let i = 0; i < modelArr.length; ++i) {
        let model = modelArr[i];
        //let munici = app.models.Municipalities;
        //munici.co
        db.autoupdate(model, function (err, result) {
            console.log("Auto-updated model " + model + " successfully.");
        });
        if (model === "Regions" || model === "Municipalities") {
            db.isActual(model, function (err, actual) {
                console.log(actual);
                if (!actual) {
                    let locationData = data[model];
                    app.models[model].create(locationData), (err, rec) => {
                        if (err) {
                            console.error(err)
                            console.log(rec)
                        } else {
                            console.log("Added data")
                        }
                    }
                }
            })


        }
    }
}