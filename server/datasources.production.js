var datasource = require('./datasources.json');

let use_DB = process.env.USE_DB
let dbObj = {}
if (use_DB === "true") {
    dbObj = {
        host: process.env.DB_HOST || "localhost",
        port: 5432,
        url: process.env.DATABASE_URL || "postgres://postgres:tuni@localhost:5432/retkipaikka_beta?ssl=false",
        database: process.env.DB_DATABASE || "retkipaikka_beta",
        password: process.env.DB_PASSWORD || "tuni",
        name: "db",
        connector: "postgresql",
        user: process.env.DB_USER || "postgres",
        ssl: process.env.SSL === "false" ? false : true
    }
} else {
    dbObj = {
        name: "db",
        connector: "memory",
        file: "data.json"
    }

}

datasource.db = dbObj

module.exports = datasource;



