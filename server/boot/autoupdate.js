module.exports = function (app) {
    'use strict'
    var db = app.dataSources.db;
    let modelArr = Object.keys(app.models);
    for (let i = 0; i < modelArr.length; ++i) {
        let model = modelArr[i];
        db.autoupdate(model, function () {
            console.log("Auto-updated model " + model + " successfully.");
        });
    }
}