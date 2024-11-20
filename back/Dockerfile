FROM node:latest
WORKDIR /
RUN echo "i"
COPY ./dist/src .
COPY  package*.json .
RUN npm i 
CMD ["node", "index.js"]