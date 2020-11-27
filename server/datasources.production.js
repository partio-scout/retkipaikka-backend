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
let emailDataSource = {
    "name": "email",
    "connector": "mail",
    "transports": [
        {
            "type": "smtp",
            "host": process.env.SMTP_URL || "smtp.gmail.com",
            "secure": true,
            "port": process.env.SMTP_PORT || 465,
            "auth": {
                "user": process.env.SMTP_EMAIL || "",
                "pass": process.env.SMTP_PASSWORD || ""
            }
        }
    ]
}

datasource.email = emailDataSource;
datasource.db = dbObj

module.exports = datasource;



