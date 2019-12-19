'use strict'
const uuidv4 = require('uuid/v4');
const multiparty = require('multiparty');
const fs = require('fs');
const path = require('path')


module.exports = function (Triplocations) {

    Triplocations.fetchLocations = async function (filter, req, res) {
        let wFilter = {}
        var fileSystem = Triplocations.app.models.Images;
        if (filter) {
            wFilter = filter.where ? filter.where : {};
        }

        // include all relations of triplocation
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
        // find all matching triplocations
        let locations = await Triplocations.find(query).then(async obj => {
            let objs = []
            for (let i = 0; i < obj.length; ++i) {
                let trip = obj[i];
                trip = JSON.parse(JSON.stringify(trip));
                // get image names of triplocation
                let imagesArr = await fileSystem.getFiles(trip.location_id);
                trip.images = imagesArr.map(val => val.name);
                trip.location_category = trip.categories.object_name;
                trip.location_region = trip.regions.object_name;
                trip.location_municipality = trip.location_municipality ? trip.municipalities.object_name : null;
                // remove other values from filters array, leaving only it's name
                trip["filters"] = trip["filters"].map(t => t.object_name)
                // delete unneeded relationdata
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

    const getFileFromRequest = (req) => new Promise((resolve, reject) => {
        //use multiparty to parse the multipart/formdata data from the request
        const form = new multiparty.Form();
        form.parse(req, (err, fields, files) => {
            if (err || !fields || !files) {
                reject("fail");
            } else {
                console.log(fields, files)
                const images = files['image'] // get images from the parsed object
                const data = fields['object'][0] //get dataobject from the parsed object
                if (!data) reject("fail");
                else resolve([data, images]);
            }
        });
    });


    const checkModelExists = async function (model, id) {
        // check if entry exists in database
        let response = await model.exists(id);
        return response;
    }
    const handleImageCreation = async function (id, imgs, res) {
        // add images for correct triplocation
        for (let i = 0; i < imgs.length; ++i) {
            let img = imgs[i];
            await fs.copyFileSync(img.path, path.join(__dirname, "../../images/" + id + "/" + img.originalFilename)), (err) => {
                if (err) throw err;
            };


        }
    }
    const handleLocationPost = async function (objData) {
        let newObject = JSON.parse(JSON.stringify(objData));
        let Filters = Triplocations.app.models.Filters;
        let Categories = Triplocations.app.models.Categories;
        let Municipalities = Triplocations.app.models.Municipalities;
        let Regions = Triplocations.app.models.Regions;
        // check if inputted id's exist
        let categoryBool = await checkModelExists(Categories, objData.location_category);
        let regionBool = await checkModelExists(Regions, objData.location_region);
        let municipalityBool = typeof objData.location_municipality !== "undefined" ? await checkModelExists(Municipalities, objData.location_municipality) : true;
        if (!categoryBool || !regionBool || !municipalityBool) {
            return "fail"
        }
        let dataFilters = objData.filters;
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        if (dataFilters) {
            if (dataFilters.length > 0) {
                for (let i = 0; i < dataFilters.length; ++i) {
                    let value = await checkModelExists(Filters, dataFilters[i]);
                    if (!value) {
                        return "fail"
                    }

                }
            }
        }
        const uuid = uuidv4();
        delete newObject["filters"];
        //make sure that these fields get added
        newObject["location_id"] = uuid;
        newObject["location_accepted"] = false;
        newObject["object_type"] = "city";
        // inserta new triplocation to database
        try {
            await Triplocations.create(newObject);
        } catch (err) {
            console.error(err);
            return "fail"
        }
        // if user gave filters, add them for triplocation
        if (dataFilters) {
            for (let i = 0; i < dataFilters.length; ++i) {
                let relationObject = {
                    location_id: uuid,
                    filter_id: dataFilters[i]
                }
                await Locationfeatures.create(relationObject)

            }
            // generate image folder for triplocation
            let fileSystem = Triplocations.app.models.Images;
            await fileSystem.createContainer({ "name": uuid })

        }
        console.log("1 location succesfully added")
        return uuid

    }
    Triplocations.addNewLocation = async function (locationData, req, res) {
        // parse images and object from data
        let data = await getFileFromRequest(locationData);
        if (data === "fail") {
            res.status(422);
            return data;
        }
        let objData = JSON.parse(data[0]);
        let images = data[1];
        // try to add a new triplocation
        let postRes = await handleLocationPost(objData);
        if (postRes === "fail") {
            res.status(422);
        } else {
            // generate images if user inputted
            if (images) {
                await handleImageCreation(postRes, images, res)
            }

        }

        return postRes;

    }

    Triplocations.addNewLocation_obj = async function (locationData, req, res) {
        // try to add new triplocation (from json object )
        let postRes = await handleLocationPost(locationData);
        if (postRes === "fail") {
            res.status(422);
        }
        return postRes;

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
        // if filters are not in query, don't modify, 
        // otherwise replace old ones with array contents
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
        // delete relationdata and triplocation
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
            { arg: 'locationData', type: 'object', http: { source: 'req' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Add a new instance of triplocation with images",
        returns: { type: String, root: true }
    });
    Triplocations.remoteMethod(
        'addNewLocation_obj', {
        http: { path: '/addNewLocation_obj', verb: 'post' },
        accepts: [
            { arg: 'locationData', type: 'object', http: { source: 'body' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Add a new instance of triplocation without images (used for testing purposes only)",
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

