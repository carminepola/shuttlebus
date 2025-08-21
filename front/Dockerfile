FROM nginx:latest
WORKDIR /usr/share/nginx/pintour
COPY ./dist/shuttlebus-frontend .

COPY ./nginx/default.conf /etc/nginx/conf.d/default.conf

COPY ./nginx/nginx.conf /etc/nginx/nginx.conf