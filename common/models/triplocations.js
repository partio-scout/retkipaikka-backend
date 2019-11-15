'use strict'

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
                }


            ]
        };

        let locations = await Triplocations.find(query).then(obj => {
            let objs = []
            for (let i = 0; i < obj.length; ++i) {
                let trip = obj[i];
                trip = JSON.parse(JSON.stringify(trip));
                trip.location_category = trip.categories.object_name;
                trip["filters"] = trip["filters"].map(t => t.object_name)
                delete trip.categories
                objs.push(trip);
            }
            return objs;
        });
        console.log("returned " + locations.length + " locations");
        return locations;
    };

    Triplocations.addNewLocation = async function (locationData, req, res) {
        console.log(locationData);
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
    }
    );
};

