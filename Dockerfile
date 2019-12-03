FROM node:alpine
RUN npm install -g nodemon
ADD package.json package.json
RUN npm install 
