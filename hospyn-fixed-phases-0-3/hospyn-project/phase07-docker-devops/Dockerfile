# Hospyn API - Cloud Run optimised build
# PHASE 07 FIXES APPLIED:
#   1. COPY . . replaced with explicit selective COPY (blocks secrets)
#   2. HEALTHCHECK added so Docker/Cloud Run detects unhealthy containers
#   3. curl installed for healthcheck probe
#   4. Non-root user retained (was already good)

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies — curl required for HEALTHCHECK
RUN apt-get update && \
    apt-get install -y gcc libpq-dev postgresql-client tesseract-ocr curl && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies BEFORE copying app code
# (better Docker layer cache: deps only reinstall when requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user for security
RUN groupadd -r hospyn && useradd -r -g hospyn hospyn

# FIX: Explicit selective COPY instead of 'COPY . .'
# .dockerignore already blocks enc.key, .env*, scratch*, archive/, backups/
# but explicit COPY here is defence-in-depth and makes the image smaller.
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .

# Copy entrypoint and strip Windows CRLF if present
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r//' /entrypoint.sh && chmod +x /entrypoint.sh

# Transfer ownership BEFORE switching user
RUN chown -R hospyn:hospyn /app /entrypoint.sh

# Switch to non-root user (security hardening)
USER hospyn

# Cloud Run injects PORT; default 8080
ENV PORT=8080
EXPOSE 8080

# FIX: HEALTHCHECK — without this, Docker reports "healthy" even when
# the app is returning 500 on every request.
# --start-period=15s gives uvicorn time to boot before health is checked.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
