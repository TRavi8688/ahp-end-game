#!/bin/sh
# entrypoint.sh — waits for PostgreSQL to be ready before starting the service
# DO NOT run alembic migrations here; run them as a separate deploy step
set -e

PORT="${PORT:-8080}"
MAX_RETRIES=30
RETRY_INTERVAL=2

# Wait for PostgreSQL to be ready
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Waiting for database..."
  retries=0
  until python3 -c "
import asyncio, sys, os
import asyncpg

async def check():
    url = os.environ['DATABASE_URL'].replace('postgresql+asyncpg://', 'postgresql://')
    try:
        conn = await asyncpg.connect(url, timeout=3)
        await conn.close()
        sys.exit(0)
    except Exception as e:
        sys.exit(1)

asyncio.run(check())
" 2>/dev/null; do
    retries=$((retries + 1))
    if [ "$retries" -ge "$MAX_RETRIES" ]; then
      echo "ERROR: Database not ready after ${MAX_RETRIES} attempts. Exiting."
      exit 1
    fi
    echo "  Database not ready (attempt $retries/$MAX_RETRIES) — retrying in ${RETRY_INTERVAL}s..."
    sleep "$RETRY_INTERVAL"
  done
  echo "Database ready."
fi

# exec replaces this shell with uvicorn, so signals (SIGTERM) reach uvicorn directly
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port "$PORT" \
  --workers "${UVICORN_WORKERS:-1}" \
  --loop uvloop \
  --log-level "${LOG_LEVEL:-info}"
