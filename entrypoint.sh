#!/usr/bin/env bash
set -e

# Cloud Run injects PORT=8080. Fall back to 8080 for safety.
export PORT="${PORT:-8080}"

echo "=== Hospyn API Starting ==="
echo "PORT: $PORT"
echo "ENVIRONMENT: ${ENVIRONMENT:-not_set}"

# Migrations are handled by the CI/CD pipeline BEFORE this container starts.
# DO NOT run alembic here — if it fails, uvicorn never starts and Cloud Run
# reports "container failed to start on port".

echo "Starting uvicorn on 0.0.0.0:$PORT"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
