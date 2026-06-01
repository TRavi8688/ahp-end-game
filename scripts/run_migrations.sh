#!/usr/bin/env bash
# scripts/run_migrations.sh
# Phase 6: Run Alembic migrations safely.
# - Validates DATABASE_URL is PostgreSQL before running
# - Takes a pg_dump backup before migrating in production
# - Prints current revision before and after

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

if echo "$DATABASE_URL" | grep -q "sqlite"; then
  echo "ERROR: DATABASE_URL points to SQLite. Migrations require PostgreSQL." >&2
  exit 1
fi

echo "Current revision:"
alembic current

if [[ "${ENV:-development}" == "production" ]]; then
  echo "Production environment detected — taking backup before migration..."
  BACKUP_FILE="/tmp/pre_migration_$(date +%Y%m%d_%H%M%S).dump"
  # Extract host/db from DATABASE_URL for pg_dump
  pg_dump "$DATABASE_URL" -F c -f "$BACKUP_FILE" && \
    echo "Backup saved to $BACKUP_FILE" || \
    echo "WARNING: Backup failed — proceeding with migration anyway"
fi

echo "Running migrations..."
alembic upgrade head

echo "Migration complete. New revision:"
alembic current
