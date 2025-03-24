FROM node:22.14
WORKDIR /  
COPY  package.json .
RUN npm install
COPY ./dist/src .
CMD ["node", "index.js"]