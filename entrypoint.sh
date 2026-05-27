#!/usr/bin/env bash
set -e

# Cloud Run injects PORT (usually 8080). Fall back to 8000 for local dev.
export PORT="${PORT:-8000}"

echo "🚀 Starting Hospyn API on port $PORT"

# --- Wait for PostgreSQL (only if POSTGRES_HOST is explicitly set) ---
# On Cloud Run, we connect via DATABASE_URL to an external DB (no pg_isready needed).
# On local Docker Compose, POSTGRES_HOST=db is set, so we wait.
if [ -n "${POSTGRES_HOST}" ]; then
  echo "⏳ Waiting for Postgres at ${POSTGRES_HOST}:${POSTGRES_PORT:-5432}…"
  for i in {1..30}; do
    if pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT:-5432}" -U "${POSTGRES_USER:-postgres}" >/dev/null 2>&1; then
      echo "✅ Postgres is ready."
      break
    fi
    echo "   attempt $i/30 — retrying in 1s"
    sleep 1
  done
else
  echo "ℹ️  POSTGRES_HOST not set — assuming external DB via DATABASE_URL (Cloud Run mode)."
fi

# --- Run Alembic migrations ---
echo "🔄 Running Alembic migrations…"
alembic upgrade head
echo "✅ Migrations complete."

# --- Start the FastAPI server on $PORT ---
echo "🌐 Launching uvicorn on 0.0.0.0:$PORT"
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
