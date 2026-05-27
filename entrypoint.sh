#!/usr/bin/env bash
set -e

export PORT="${PORT:-8080}"
echo "Starting Hospyn API on port $PORT"

# Cloud Run: POSTGRES_HOST is not set, connect via DATABASE_URL directly
if [ -n "${POSTGRES_HOST}" ]; then
  echo "Waiting for Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT:-5432}"
  for i in $(seq 1 30); do
    if pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
      echo "Postgres ready."
      break
    fi
    echo "attempt $i/30 - retrying..."
    sleep 1
  done
else
  echo "Cloud Run mode - connecting via DATABASE_URL"
fi

echo "Running Alembic migrations..."
alembic upgrade head
echo "Migrations complete."

echo "Launching uvicorn on 0.0.0.0:$PORT"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
