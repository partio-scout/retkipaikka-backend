'use strict'
const uuidv4 = require('uuid/v4');
const multiparty = require('multiparty');
const fs = require('fs');
const path = require('path')
const { sendEmail } = require("../helpers/helpers");



module.exports = function (Triplocations) {

    Triplocations.fetchLocations = async (filter, req, res) => {
        let wFilter = {}
        var fileSystem = Triplocations.app.models.Images;
        let limitFields = false;
        let count = null;
        let order = null;
        if (filter != null) {
            limitFields = filter.limitedFields ? filter.limitedFields : false;
            wFilter = filter.where ? filter.where : {};
            count = filter.limit ? filter.limit : null;
            order = filter.order ? filter.order : null;
        }
        let fields = limitFields ? ["location_id", "location_geo", "location_name", "location_category", "location_region", "location_municipality"] : [];
        // include all relations of triplocation
        let query = {
            where: wFilter,
            fields: fields,
            order: "updatedAt DESC",
            include: [
                {
                    relation: "filters",
                    scope: { // further filter filters
                        fields: ["filter_id"],

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


            ],

        };
        if (count != null) {
            query.limit = count;
        }
        if (order != null) {
            query.order = order
        }
        // find all matching triplocations
        let locations = await Triplocations.find(query).then(async arr => {
            let tempLocs = [];

            for (let trip of arr) {
                trip = JSON.parse(JSON.stringify(trip));
                if (!limitFields) {
                    // get image names of triplocation
                    let imagesArr = await fileSystem.getFiles(trip.location_id);
                    trip.images = imagesArr.map(val => val.name);
                    // remove other values from filters array, leaving only its name
                }
                trip.location_region = trip.regions.object_name;
                trip.location_municipality = trip.location_municipality ? trip.municipalities.object_name : null;
                trip["filters"] = trip["filters"].map(t => t.filter_id)
                delete trip.regions;
                delete trip.municipalities;
                tempLocs.push(trip);
            }
            return tempLocs;

        });
        console.log("returned " + locations.length + " locations")
        return locations;
    };

    const getFileFromRequest = (req) => new Promise((resolve, reject) => {
        //use multiparty to parse the multipart/formdata data from the request
        const form = new multiparty.Form();
        form.parse(req, (err, fields, files) => {
            if (err || !fields || !files) {
                reject("fail");
            } else {
                const images = files['image'] || fields['image'] // get images from the parsed object
                const data = fields['object'][0] //get dataobject from the parsed object
                if (!data) reject("fail");
                else resolve([data, images]);
            }
        });
    });

    const generateMainFilter = (locationIds, data) => {
        if (locationIds.length === 0) {
            return null;
        }
        let mainFilter = {
            where: {
                and: [
                    { location_accepted: true },
                    { location_id: { inq: locationIds } }
                ]
            }
        }

        let orExists = false;
        if (data.municipalities.length > 0) {
            mainFilter.where.and.push({ or: [{ location_municipality: { inq: data.municipalities } }] });
            orExists = true;
        }
        if (data.regions.length > 0) {
            if (orExists) {
                mainFilter.where.and[2].or.push({ location_region: { inq: data.regions } });
            } else {
                mainFilter.where.and.push({ or: [{ location_region: { inq: data.regions } }] });
            }
        }
        if (data.categories.length > 0) {
            mainFilter.where.and.push({ location_category: { inq: data.categories } })
        }
        return mainFilter;
    }


    Triplocations.handleFiltering = async (data, req, res) => {
        if (!data.filters || !data.categories || !data.municipalities || !data.regions) {
            return []
        }
        if (data.filters.length == 0 && data.categories.length == 0 && data.municipalities.length == 0 && data.regions.length == 0) {
            return Triplocations.fetchLocations({ limitedFields: data.limitedFields != null ? data.limitedFields : true });
        }
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        let filterQuery = {
            where: {}
        }

        if (data.filters.length > 0) {
            filterQuery.where = { filter_id: { inq: data.filters } }
        }

        return await Locationfeatures.find(filterQuery).then(async res => {
            let tempIdObj = {};
            res.forEach(loc => {
                let id = loc.location_id;
                if (tempIdObj[id]) {
                    tempIdObj[id].push(loc.filter_id)
                } else {
                    tempIdObj[id] = [loc.filter_id]
                }
            })
            let dataFilterLen = data.filters.length;
            let locationIds = []
            Object.keys(tempIdObj).forEach(locId => {
                if (tempIdObj[locId].length == dataFilterLen || dataFilterLen == 0) {
                    locationIds.push(locId);
                }
            })
            let mainFilter = generateMainFilter(locationIds, data)
            if (!mainFilter) {
                return [];
            }
            mainFilter.limitedFields = data.limitedFields != null ? data.limitedFields : true;
            return await Triplocations.fetchLocations(mainFilter)

        })



    }

    const checkModelExists = (model, id) => {
        // check if entry exists in database
        return model.exists(id);
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
        let municipalityBool = objData.location_municipality != null ? await checkModelExists(Municipalities, objData.location_municipality) : true;
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
        let returnObj = {};
        // inserta new triplocation to database
        try {
            returnObj = await Triplocations.create(newObject);
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
        }

        // generate image folder for triplocation
        let fileSystem = Triplocations.app.models.Images;
        await fileSystem.createContainer({ "name": uuid })
        console.log("1 location succesfully added")
        return returnObj

    }
    const handleAdminEmailSend = async (data) => {
        const { location_region, location_id } = data;
        const UserRegions = Triplocations.app.models.UsersRegions;
        const Admin = Triplocations.app.models.Admin;
        const Email = Triplocations.app.models.Email;
        const FRONTEND_URL = process.env.FRONTEND_URL;
        const filter = {
            where: { region_id: location_region },
            include: [
                {
                    relation: "admin",
                    scope: {
                        fields: ["email"]
                    }


                }

            ]
        }
        const adminFilter = {
            where: { notifications: "all" },
            fields: ["email"]
        }
        let normalUrl = `${FRONTEND_URL}/hallinta/uudet`
        let uuidUrl = `${FRONTEND_URL}/retkipaikka/${location_id}`
        let html = `<div><h3>Uusi retkipaikka</h3><br /> Uusi retkipaikka lisätty alueelle, josta olet aktivoinut ilmoituksen. 
                <br/> <br/> Voit katsoa ilmoitusta hallintasivun kautta <a href=${normalUrl}>${normalUrl}</a> tai suoraan osoitteesta <a href=${uuidUrl}>${uuidUrl}</a></div>`
        await UserRegions.find(filter).then(async res => {
            let emails = []
            res.forEach(item => {
                let temp = JSON.parse(JSON.stringify(item));
                emails.push(temp.admin.email);
            })

            let aRes = await Admin.find(adminFilter)

            aRes.forEach(a => {
                if (!emails.includes(a.email)) {
                    emails.push(a.email)
                }
            })

            if (emails.length !== 0) {
                sendEmail(Email, emails, html, "Ilmoitus uudesta retkipaikasta")
            }
        });
        return "test";


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
                await handleImageCreation(postRes.location_id, images, res)
            }

        }
        handleAdminEmailSend(postRes)
        return postRes.location_id;

    }

    Triplocations.addNewLocation_obj = async function (locationData, req, res) {
        // try to add new triplocation (from json object )
        let postRes = await handleLocationPost(locationData);
        if (postRes === "fail") {
            res.status(422);
        }
        return postRes;

    }
    function getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min) + min); //The maximum is exclusive and the minimum is inclusive
    }
    /*     Triplocations.createLocations = async function (data, req, res) {
            let obj = {
                "object_type": "city",
                "location_category": 2,
                "location_municipality": 837,
                "location_region": 5,
                "location_name": "testiobjekti",
                "location_geo": {
                    "lat": 0,
                    "lng": 0
                },
                "location_description": "stringstringstringstringstringstringstringstringstringstringstringstring",
                "location_pricing": "asdasd",
                "location_accepted": true,
                "location_owner": "dsadasd",
                "location_website": "asdasdasd",
                "location_phone": "dsad",
                "location_mail": "dsadsad",
                "location_editor": "asdasdasd",
            }
            for (let i = 0; i < 5000; i++) {
                let temp = JSON.parse(JSON.stringify(obj));
                let x = getRandomInt(60, 68)
                let y = getRandomInt(24, 30)
                temp.location_geo.lat = x;
                temp.location_geo.lng = y;
                console.log(i)
                await Triplocations.create(temp)
            }
        }
     */

    Triplocations.editLocation = (locationData, req, res) => {
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        let newObject = JSON.parse(JSON.stringify(locationData));
        const locationuuid = locationData.location_id;
        let query = {
            location_id: locationuuid
        };
        if (locationData.location_region && !locationData.location_municipality) {
            newObject.location_municipality = null;
        }

        return Promise.resolve().then(async (res) => {
            // if filters are not in query, don't modify, 
            // otherwise replace old ones with array contents
            if (locationData.filters) {
                if (locationData.filters.length >= 0) {
                    let dataFilters = locationData.filters;
                    await Locationfeatures.destroyAll(query)
                    for (let i = 0; i < dataFilters.length; ++i) {
                        let relationObject = {
                            location_id: locationuuid,
                            filter_id: dataFilters[i]
                        }
                        await Locationfeatures.create(relationObject);
                    }





                }
                delete newObject["filters"];
            }


            await Triplocations.updateAll({ location_id: locationuuid }, newObject)


            console.log("location succesfully updated")
            return "success"

        }).catch((err) => {
            console.error(err)
            res.status(err.statusCode ? err.statusCode : 422)
            return err
        })
    }


    Triplocations.deleteLocation = async function (locationData, req, res) {
        let Locationfeatures = Triplocations.app.models.Locationfeatures;
        const locationuuid = locationData.location_id;
        let query = {
            location_id: locationuuid
        };
        // delete relationdata and triplocation
        return Locationfeatures.destroyAll(query).then(async res => {
            return Triplocations.destroyById(locationuuid)
        }).then(() => {
            console.log("location succesfully deleted")
            return "success"
        }).catch((error) => {
            console.error(error);
            res.status(err.statusCode ? err.statusCode : 422)
            return err
        })


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
    /*   Triplocations.remoteMethod(
          'createLocations', {
          http: { path: '/createLocations', verb: 'get' },
          accepts: [
              { arg: 'filter', type: 'object', http: { source: 'query' } },
              { arg: 'req', type: 'object', http: { source: 'req' } },
              { arg: 'res', type: 'object', http: { source: 'res' } }
          ],
          description: "returns all locations with all data",
          returns: { type: Triplocations, root: true }
      }
      ); */


    Triplocations.remoteMethod(
        'handleFiltering', {
        http: { path: '/handleFiltering', verb: 'get' },
        accepts: [
            { arg: 'data', type: 'object', http: { source: 'query' } },
            { arg: 'req', type: 'object', http: { source: 'req' } },
            { arg: 'res', type: 'object', http: { source: 'res' } }
        ],
        description: "Handle ui filtering",
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

