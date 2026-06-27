FROM node:24.15
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY ./dist/src .
USER node
CMD ["node", "index.js"]
