#!/usr/bin/env bash
set -e

# Wait for PostgreSQL to be ready (max 30 seconds)
for i in {1..30}; do
  if pg_isready -h "${POSTGRES_HOST:-db}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
    break
  fi
  echo "⏳ Waiting for Postgres… ($i/30)"
  sleep 1
done

# Apply Alembic migrations
alembic upgrade head

# Start the FastAPI server
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
