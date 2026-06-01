# Hospyn API - Cloud Run optimised two-stage build
# AUDIT FIX M4: Two-stage build — only app/ and requirements.txt in final image.
# AUDIT FIX M5: Base image pinned to SHA256 digest (python:3.11-slim).
#   Digest verified: 2026-06-01. Re-pin periodically via:
#   docker pull python:3.11-slim && docker inspect python:3.11-slim --format '{{index .RepoDigests 0}}'
# AUDIT FIX L4: .dockerignore covers enc.key, *.key, .env, backups/, archive/,
#   store_room/, scratch/, *.key — confirmed in .dockerignore file.

# ── Stage 1: Build dependencies ───────────────────────────────────────────────
FROM python:3.11-slim@sha256:ad5dadd957a63c42c30e49f6bf1d1a7e24a020da94c3bf0e0c16f6da80b58f57 AS builder

WORKDIR /build

# Install build-only system deps
RUN apt-get update && \
    apt-get install -y gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies into /install prefix for copying to final stage
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM python:3.11-slim@sha256:ad5dadd957a63c42c30e49f6bf1d1a7e24a020da94c3bf0e0c16f6da80b58f57

WORKDIR /app

# Install only runtime system dependencies (no gcc, no build tools)
RUN apt-get update && \
    apt-get install -y libpq5 tesseract-ocr curl postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Create a non-root user for security
RUN groupadd -r hospyn && useradd -r -g hospyn hospyn

# FIX M4: Explicit selective COPY — only app code and config.
# No COPY . . — prevents enc.key, .env, backups/, archive/ from entering the image
# even if .dockerignore has a gap. Defence in depth.
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

# HEALTHCHECK — without this, Docker reports "healthy" even when
# the app is returning 500 on every request.
# --start-period=15s gives uvicorn time to boot before health is checked.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
