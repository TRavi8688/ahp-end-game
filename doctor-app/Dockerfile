# Build Stage
FROM node:18-alpine AS build-stage

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# Production Stage
FROM nginx:stable-alpine

# Copy built files to Nginx
COPY --from=build-stage /app/build /usr/share/nginx/html

# Add custom Nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["/bin/sh", "-c", "sed -i 's/listen 80;/listen '\"$PORT\"';/' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
