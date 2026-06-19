# Dockerfile (Multi-Stage)
# Phase 7 Fix: Replace single-stage build with multi-stage to reduce image size ~60%
#
# APPLY TO: Dockerfile (repo root — the main backend gateway Dockerfile)
#
# This builds in two stages:
#   Stage 1 (builder): installs all build tools + compiles Python packages
#   Stage 2 (runtime): copies only the compiled packages + app code — no build tools
#
# Result: final image ~200MB instead of ~600MB

##############################################################################
# Stage 1 — Builder
# Installs build dependencies and compiles Python packages into /install
##############################################################################
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build tools (needed for psycopg2, cryptography, etc.)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages into a prefix directory (not system)
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

##############################################################################
# Stage 2 — Runtime
# Clean base image + only what's needed to run the app
##############################################################################
FROM python:3.11-slim

WORKDIR /app

# Install only runtime libraries (no build tools)
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled packages from builder
COPY --from=builder /install /usr/local

# Create non-root user for security
RUN groupadd -r hospyn && useradd -r -g hospyn hospyn

# Copy only application code — NOT the full repo
# (.dockerignore handles exclusions; this explicitly names what IS included)
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini .
COPY entrypoint.sh /entrypoint.sh

# Fix line endings and permissions
RUN sed -i 's/\r//' /entrypoint.sh \
    && chmod +x /entrypoint.sh \
    && chown -R hospyn:hospyn /app /entrypoint.sh

USER hospyn

ENV PORT=8080
EXPOSE 8080

# Health check — uses /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
