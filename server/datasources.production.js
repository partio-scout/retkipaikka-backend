var datasource = require('./datasources.json');
datasource.db.host = process.env.DB_HOST || "localhost"
datasource.db.database = process.env.DB_DATABASE || "retkipaikka_beta";
datasource.db.password = process.env.DB_PASSWORD || "tuni";
datasource.db.user = process.env.DB_USER || "postgres";
datasource.db.url = process.env.DB_URL || "postgres://postgres:tuni@localhost:5432/retkipaikka_beta?ssl=false"
module.exports = datasource;



