# nginx/Dockerfile — Hospyn reverse proxy
# AUDIT FIX H1: Generates self-signed TLS certs at build time so the container
#   starts without missing cert errors in local/dev environments.
#   PRODUCTION: Mount real Let's Encrypt certs via Docker volume or GCP-managed
#   cert at /etc/nginx/certs/fullchain.pem and /etc/nginx/certs/privkey.pem.
#   The self-signed cert generated here is FOR DEVELOPMENT ONLY.
#   Browsers will show a cert warning for self-signed certs — expected in dev.

FROM nginx:1.27-alpine

# Install openssl for self-signed cert generation
RUN apk add --no-cache openssl

# Create cert directory
RUN mkdir -p /etc/nginx/certs

# Generate self-signed certificate at build time (DEV ONLY).
# In production, this directory is overwritten by a Docker volume mount
# containing your Let's Encrypt / GCP-managed cert.
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/certs/privkey.pem \
    -out /etc/nginx/certs/fullchain.pem \
    -subj "/C=IN/ST=Telangana/L=Hyderabad/O=Hospyn/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:app.hospyn.com,IP:127.0.0.1" && \
    chmod 600 /etc/nginx/certs/privkey.pem && \
    chmod 644 /etc/nginx/certs/fullchain.pem

# Copy nginx config
COPY ../nginx.conf /etc/nginx/nginx.conf

# Healthcheck: nginx should respond on port 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/health 2>/dev/null || exit 1

EXPOSE 80 443
