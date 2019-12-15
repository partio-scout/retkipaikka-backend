'use strict'
const uuidv4 = require('uuid/v4');

module.exports = function (Triplocations) {


    Triplocations.fetchLocations = async function (filter, req, res) {
        let wFilter = {}
        var fileSystem = Triplocations.app.models.Images;
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

        let locations = await Triplocations.find(query).then(async obj => {
            let objs = []
            for (let i = 0; i < obj.length; ++i) {
                let trip = obj[i];
                trip = JSON.parse(JSON.stringify(trip));
                let imagesArr = await fileSystem.getFiles(trip.location_id);
                trip.images = imagesArr.map(val => val.name);
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

    const checkModelExists = async function (model, id) {
        let response = await model.exists(id);
        return response;
    }


    Triplocations.addNewLocation = async function (locationData, req, res) {
        let newObject = JSON.parse(JSON.stringify(locationData));
        let Filters = Triplocations.app.models.Filters;
        let Categories = Triplocations.app.models.Categories;
        let Municipalities = Triplocations.app.models.Municipalities;
        let Regions = Triplocations.app.models.Regions;
        // check if inputted id's exist
        let categoryBool = await checkModelExists(Categories, locationData.location_category);
        let regionBool = await checkModelExists(Regions, locationData.location_region);
        let municipalityBool = typeof locationData.location_municipality !== "undefined" ? await checkModelExists(Municipalities, locationData.location_municipality) : true;
        if (!categoryBool || !regionBool || !municipalityBool) {
            res.status(422);
            return "fail"
        }
        let dataFilters = locationData.filters;
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        var fileSystem = Triplocations.app.models.Images;
        if (dataFilters) {
            if (dataFilters.length > 0) {
                for (let i = 0; i < dataFilters.length; ++i) {
                    let value = await checkModelExists(Filters, dataFilters[i]); //await Filters.exists(dataFilters[i]);
                    if (!value) {
                        res.status(422);
                        return "fail"
                    }

                }
            }
        }
        delete newObject["filters"];
        const uuid = uuidv4();
        newObject["location_id"] = uuid;
        newObject["location_accepted"] = false;
        try {
            await Triplocations.create(newObject);
        } catch (err) {
            console.error(err);
            res.status(err.statusCode ? err.statusCode : 422)
            return err
        }

        if (dataFilters) {
            for (let i = 0; i < dataFilters.length; ++i) {
                let relationObject = {
                    location_id: uuid,
                    filter_id: dataFilters[i]
                }
                await Locationfeatures.create(relationObject)

            }

        }
        await fileSystem.createContainer({ "name": uuid })
        console.log("1 location succesfully added")
        return uuid
    }


    Triplocations.editLocation = async function (locationData, req, res) {
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        let newObject = JSON.parse(JSON.stringify(locationData));
        const locationuuid = locationData.location_id;
        let query = {
            location_id: locationuuid
        };
        if (locationData.location_region && !locationData.location_municipality) {
            newObject.location_municipality = null;
        }
        if (locationData.filters) {
            if (locationData.filters.length >= 0) {
                let dataFilters = locationData.filters;
                try {
                    await Locationfeatures.destroyAll(query).then(async res => {
                        for (let i = 0; i < dataFilters.length; ++i) {
                            let relationObject = {
                                location_id: locationuuid,
                                filter_id: dataFilters[i]
                            }
                            await Locationfeatures.create(relationObject);
                        }
                    })
                } catch (err) {
                    res.status(err.statusCode ? err.statusCode : 422)
                    return err
                }



            }
            delete newObject["filters"];
        }

        try {
            await Triplocations.updateAll({ location_id: locationuuid }, newObject)
        } catch (err) {
            console.error(error);
            res.status(err.statusCode ? err.statusCode : 422)
            return err
        }
        console.log("location succesfully updated")
        return "success"

    }

    Triplocations.deleteLocation = async function (locationData, req, res) {
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        const locationuuid = locationData.location_id;
        let query = {
            location_id: locationuuid
        };
        try {
            await Locationfeatures.destroyAll(query).then(res => {
                Triplocations.destroyById(locationuuid)
            })
        } catch (error) {
            console.error(error);
            res.status(err.statusCode ? err.statusCode : 422)
            return err
        }
        console.log("location succesfully deleted")
        return "success"

    }







    Triplocations.remoteMethod(
        'fetchLocations', {
        http: { path: '/fetchLocations', verb: 'get' },
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
            { arg: 'locationData', type: 'object', http: { source: 'body' } },
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
            { arg: 'locationData', type: 'object', http: { source: 'body' } },
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

