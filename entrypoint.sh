#!/usr/bin/env bash
# entrypoint.sh
# PHASE 07 FIX: Added database readiness wait loop before starting uvicorn.
# Without this, if the container starts before postgres is accepting connections,
# every request fails until postgres is ready — causing silent startup failures.

set -euo pipefail

# Cloud Run injects PORT=8080. Fall back to 8080 for safety.
export PORT="${PORT:-8080}"

echo "=== Hospyn API Starting ==="
echo "PORT: $PORT"
echo "ENVIRONMENT: ${ENVIRONMENT:-not_set}"

# ─── STARTUP KEY VALIDATION ──────────────────────────────────────────────────
# Refuse to start if SECRET_KEY is the default/empty value.
# This prevents accidentally deploying with an insecure key.
if [ -z "${SECRET_KEY:-}" ]; then
    echo "FATAL: SECRET_KEY environment variable is not set. Refusing to start."
    exit 1
fi

if [ "${SECRET_KEY}" = "your-secret-key-here" ] || [ "${SECRET_KEY}" = "changeme" ]; then
    echo "FATAL: SECRET_KEY is set to a known default value. Rotate it immediately."
    exit 1
fi

# ─── DATABASE READINESS WAIT ─────────────────────────────────────────────────
# FIX: Wait for PostgreSQL to be accepting connections before starting uvicorn.
# Avoids "could not connect to database" errors on fresh deployments.
if [ -n "${DATABASE_URL:-}" ] && echo "$DATABASE_URL" | grep -q "postgresql"; then
    echo "Waiting for PostgreSQL to be ready..."
    # Extract host and port from DATABASE_URL
    # Format: postgresql+asyncpg://user:pass@host:port/dbname
    DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
    DB_PORT=$(echo "$DATABASE_URL" | sed -nE 's|.*:([0-9]+)/.*|\1|p')
    DB_PORT="${DB_PORT:-5432}"

    MAX_RETRIES=30
    RETRY_INTERVAL=2
    count=0
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -q 2>/dev/null; do
        count=$((count + 1))
        if [ "$count" -ge "$MAX_RETRIES" ]; then
            echo "FATAL: PostgreSQL at ${DB_HOST}:${DB_PORT} did not become ready after ${MAX_RETRIES} attempts."
            exit 1
        fi
        echo "  Waiting for database... attempt ${count}/${MAX_RETRIES}"
        sleep "$RETRY_INTERVAL"
    done
    echo "Database is ready."
fi

# ─── MIGRATIONS ──────────────────────────────────────────────────────────────
# Migrations are handled by the CI/CD pipeline BEFORE this container starts.
# DO NOT run alembic here — if it fails, uvicorn never starts and Cloud Run
# reports "container failed to start on port".
# For local development only, uncomment the line below:
# alembic upgrade head

# ─── START SERVER ────────────────────────────────────────────────────────────
echo "Starting uvicorn on 0.0.0.0:$PORT"
# exec replaces the shell process with uvicorn — proper PID 1 signal handling
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
