# =========================================================
# Stage 1: Build dependencies
# =========================================================
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml poetry.lock* requirements.txt* ./

# Install to a prefix so we can copy cleanly
RUN pip install --upgrade pip --break-system-packages && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt 2>/dev/null || \
    pip install --prefix=/install --no-cache-dir .


# =========================================================
# Stage 2: Runtime image
# =========================================================
FROM python:3.12-slim AS runtime

# Security: create non-root user
RUN groupadd --gid 1001 hospyn && \
    useradd --uid 1001 --gid hospyn --shell /bin/bash --create-home hospyn

WORKDIR /app

# Install only runtime system deps (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source ONLY — .dockerignore excludes enc.key, .env, scratch, archive
# enc.key must NEVER be in the image; it is loaded at runtime from GCP Secret Manager
COPY --chown=hospyn:hospyn backend/ ./backend/
COPY --chown=hospyn:hospyn alembic.ini ./
COPY --chown=hospyn:hospyn alembic/ ./alembic/
COPY --chown=hospyn:hospyn entrypoint.sh ./

RUN chmod +x entrypoint.sh

# Switch to non-root user
USER hospyn

# Cloud Run / Kubernetes: PORT env drives the listen port
ENV PORT=8080
EXPOSE 8080

# Health check — Docker/Cloud Run detect unhealthy containers
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
