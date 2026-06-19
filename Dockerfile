# Hospyn API - Cloud Run optimised two-stage build
# AUDIT FIX M4: Two-stage build — only app/ and requirements.txt in final image.
# AUDIT FIX M5: Base image is python:3.11-slim (latest stable)
# AUDIT FIX L4: .dockerignore covers enc.key, *.key, .env, backups/, archive/,
#   store_room/, scratch/, *.key — confirmed in .dockerignore file.

# ── Stage 1: Build dependencies ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build-only system deps
RUN apt-get update && \
    apt-get install -y gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Install python dependencies into /install prefix for copying to final stage
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime image ────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install only runtime system dependencies (no gcc, no build tools)
RUN apt-get update && \
    apt-get install -y libpq5 tesseract-ocr curl postgresql-client && \
    rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Create a non-root user for security
RUN groupadd -r hospyn && useradd -r -g hospyn hospyn

# FIX: Copy the ACTUAL application code from backend/healthcare-core/app/
# The root app/ directory is a legacy stub — real code lives under backend/
COPY backend/healthcare-core/app/ ./app/

# Copy shared modules used by the app (audit, encryption, utils, etc.)
COPY backend/shared/ ./shared/

# Copy alembic migrations and config
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
