# Partio-retkipaikka-loopback
Partion retkipaikkasovelluksen backend

git clone https://gitlab.tamk.cloud/courses/tietokannat/3005/jani.niittymaki.git




Luo .env tiedosto tiedostopolun juureen
```
NODE_ENV = development
DB_HOST = localhost
DB_DATABASE = retkipaikka_beta
DB_PASSWORD =password
DB_USER  = postgres
DB_URL = postgres://postgres:password@localhost:5432/retkipaikka_beta?ssl=false
LB_EMAIL = hallinta@retkipaikka.com
LB_PASSWORD = password
DB_POSTGRES_EMAIL = hallinta@retkipaikka.com
DB_POSTGRES_PW = password
```

## Ajaminen ilman dockeria

Luo Postgresiin DB_DATABASE kentän arvon nimellä tietokanta

Käynnistä komennolla,
 ```
nodemon -r dotenv/config --exitcrash
```
niin .env latautuu

Jos nodemonia ei ole, asenna komennolla npm install -g nodemon

## Ajaminen Dockerilla
```
docker-compose -f docker-compose.yml build
```
```
docker-compose -f docker-compose.yml up
```



