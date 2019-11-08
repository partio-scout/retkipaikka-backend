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
                    scope: { // further filter categories
                        fields: ['filter_name']
                    }
                },

                {
                    relation: "categories",
                    scope: { // further filter categories
                        fields: ['category_name']
                    }
                }


            ]
        };

        let locations = await Triplocations.find(query).then(obj => {
            let objs = []
            for (let i = 0; i < obj.length; ++i) {
                let trip = obj[i];
                trip = JSON.parse(JSON.stringify(trip));
                trip.location_category = trip.categories.category_name;
                trip["filters"] = trip["filters"].map(t => t.filter_name)
                delete trip.categories
                objs.push(trip);
            }
            return objs;
        });
        console.log("returned " + locations.length + " locations");
        return locations;
    };

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
};

