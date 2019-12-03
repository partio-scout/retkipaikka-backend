'use strict'
const uuidv4 = require('uuid/v4');

module.exports = function (Triplocations) {


    Triplocations.fetchLocations = async function (filter, req, res) {
        let wFilter = {}
        if (filter) {
            wFilter = filter.where ? filter.where : {};
        }

        let query = {
            where: wFilter,
            include: [

                {
                    relation: "filters",
                    scope: { // further filter filters
                        fields: ['object_name']
                    }
                },

                {
                    relation: "categories",
                    scope: { // further filter categories
                        fields: ['object_name']
                    }
                },
                {
                    relation: "regions",
                    scope: { // further filter regions
                        fields: ['object_name']
                    }
                },
                {
                    relation: "municipalities",
                    scope: { // further filter municipalities
                        fields: ['object_name']
                    }
                },


            ]
        };
        // "location_municipality": {
        //     "type": "number",
        //     "required": false
        //   },
        //   "location_region": {
        //     "type": "number",
        //     "required": true
        //   },    
        let locations = await Triplocations.find(query).then(obj => {
            let objs = []
            for (let i = 0; i < obj.length; ++i) {
                let trip = obj[i];
                trip = JSON.parse(JSON.stringify(trip));
                trip.location_category = trip.categories.object_name;
                trip.location_region = trip.regions.object_name;
                trip.location_municipality = trip.location_municipality ? trip.municipalities.object_name : null;
                trip["filters"] = trip["filters"].map(t => t.object_name)
                delete trip.regions;
                delete trip.municipalities;
                delete trip.categories
                objs.push(trip);
            }
            return objs;
        });
        console.log("returned " + locations.length + " locations");
        return locations;
    };

    Triplocations.addNewLocation = async function (locationData, req, res) {
        let newObject = JSON.parse(JSON.stringify(locationData));
        let Filters = Triplocations.app.models.Filters;
        let Categories = Triplocations.app.models.Categories;
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        let dataFilters = locationData.filters;
        //let newObj = getLocationSchema()

        await Categories.exists(locationData.location_category).then(res => {
            if (!res) {
                return "fail"
            }
        }).catch(err => {
            console.error(err)
            return "fail"
        });

        if (dataFilters) {
            if (dataFilters.length > 0) {
                for (let i = 0; i < dataFilters.length; ++i) {
                    let value = await Filters.exists(dataFilters[i]);
                    if (!value)
                        return "fail"
                }
            }
        }

        delete newObject["filters"];
        const uuid = uuidv4();
        newObject["location_id"] = uuid;


        Triplocations.create(newObject).then(res => {

        }).catch(err => {
            console.error(err);
            return "fail"
        });
        if (dataFilters) {
            for (let i = 0; i < dataFilters.length; ++i) {
                let relationObject = {
                    location_id: uuid,
                    filter_id: dataFilters[i]
                }
                await Locationfeatures.create(relationObject);
            }
        }


        console.log("1 location succesfully added")
        return "success"
    }


    Triplocations.editLocation = async function (locationData, req, res) {
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        let newObject = JSON.parse(JSON.stringify(locationData));
        const locationuuid = locationData.location_id;
        let query = {
            location_id: locationuuid
        };
        console.log(locationData);
        if (locationData.location_region && !locationData.location_municipality) {
            newObject.location_municipality = null;
        }
        if (locationData.filters) {
            if (locationData.filters.length >= 0) {
                let dataFilters = locationData.filters;
                await Locationfeatures.destroyAll(query).then(async res => {

                    for (let i = 0; i < dataFilters.length; ++i) {
                        let relationObject = {
                            location_id: locationuuid,
                            filter_id: dataFilters[i]
                        }
                        await Locationfeatures.create(relationObject);
                    }
                }).catch(err => {
                    console.error(err);
                    return "fail"
                });
            }
            delete newObject["filters"];

        }


        await Triplocations.updateAll({ location_id: locationuuid }, newObject).then(res => {
            return "success"
        }).catch(err => {
            console.error(err);
            return "fail"
        })
        console.log("location succesfully updated")
        return "success"

    }

    Triplocations.deleteLocation = async function (locationData, req, res) {
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        const locationuuid = locationData.location_id;
        let query = {
            location_id: locationuuid
        };

        await Locationfeatures.destroyAll(query).then(res => {
            Triplocations.destroyById(locationuuid)
        }).catch(err => {
            console.error(err);
            return "fail"
        });
        console.log("location succesfully deleted")
        return "success"

    }







    Triplocations.remoteMethod(
        'fetchLocations', {
        http: { path: '/fetchlocations', verb: 'get' },
        accepts: [
            { arg: 'filter', type: 'object', http: { source: 'query' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "returns all locations with all data",
        returns: { type: Triplocations, root: true }
    }
    );

    Triplocations.remoteMethod(
        'editLocation', {
        http: { path: '/editLocation', verb: 'patch' },
        accepts: [
            { arg: 'locationData', type: 'object', http: { source: 'query' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Edits a triplocation",
        returns: { type: String, root: true }
    }

    );
    Triplocations.remoteMethod(
        'addNewLocation', {
        http: { path: '/addNewLocation', verb: 'post' },
        accepts: [
            { arg: 'locationData', type: 'object', http: { source: 'query' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Add a new instance of triplocation",
        returns: { type: String, root: true }
    });

    Triplocations.remoteMethod(
        'deleteLocation', {
        http: { path: '/deleteLocation', verb: 'delete' },
        accepts: [
            { arg: 'locationData', type: 'object', http: { source: 'query' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Deletes a triplocation and its relations",
        returns: { type: String, root: true }
    });
};

