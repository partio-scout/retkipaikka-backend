# Partio-retkipaikka-loopback
Partion retkipaikkasovelluksen backend


Luo .env tiedosto tiedostopolun juureen

NODE_ENV = development
DB_HOST = localhost
DB_DATABASE = retkipaikka_beta
DB_PASSWORD =password
DB_USER  = postgres
DB_URL = postgres://postgres:password@localhost:5432/retkipaikka_beta?ssl=false
LB_EMAIL = hallinta@retkipaikka.com
LB_PASSWORD = hallinta
DB_POSTGRES_EMAIL = hallinta@retkipaikka.com
DB_POSTGRES_PW = password


Käynnistä komennolla, 
nodemon -r dotenv/config --exitcrash
niin .env latautuu

Jos nodemonia ei ole, asenna komennolla npm install -g nodemon


