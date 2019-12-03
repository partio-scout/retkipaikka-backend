FROM node:alpine
RUN npm install -g nodemon
RUN mkdir /home/app
WORKDIR /home/app
COPY package.json ./
COPY client/ ./client
COPY common/ ./common
COPY server/ ./server
RUN npm install