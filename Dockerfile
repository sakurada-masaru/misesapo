# Static site on Nginx for Cloud Run
FROM nginx:1.27-alpine

# Let Cloud Run set PORT (default 8080)
ENV PORT=8080

# Copy static assets
COPY public /usr/share/nginx/html

# Provide a template that listens on ${PORT}
COPY nginx/default.conf.template /etc/nginx/conf.d/default.conf.template

# Install envsubst for templating at container start
RUN apk add --no-cache gettext

EXPOSE 8080

# Render config with PORT and start nginx
CMD ["/bin/sh","-c","envsubst < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'" ]
