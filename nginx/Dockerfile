FROM nginx:1.27-alpine

# Install openssl for certificate generation
RUN apk add --no-cache openssl bash

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy security headers
COPY conf.d/ /etc/nginx/conf.d/

# Create cert directory
RUN mkdir -p /etc/nginx/certs

# Generate self-signed certificate for development (if not mounted)
# This will be used when /etc/nginx/certs/fullchain.pem doesn't exist
# In production, mount real certs via Docker volumes
RUN if [ ! -f /etc/nginx/certs/fullchain.pem ]; then \
    openssl req -x509 -newkey rsa:2048 -keyout /etc/nginx/certs/privkey.pem \
    -out /etc/nginx/certs/fullchain.pem -days 365 -nodes \
    -subj "/C=US/ST=Development/L=Development/O=Hospyn/CN=localhost" && \
    chmod 644 /etc/nginx/certs/fullchain.pem /etc/nginx/certs/privkey.pem; \
    fi

# Create a dummy index.html for health checks
RUN mkdir -p /usr/share/nginx/html && \
    echo '<html><body>OK</body></html>' > /usr/share/nginx/html/index.html

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

EXPOSE 80 443
