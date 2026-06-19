#!/bin/bash
set -eo pipefail

# Hospyn Production Database Restore Verification Script
# This script simulates a disaster recovery restore process.
# It expects a gzipped SQL dump as input and restores it to a target database.
#
# Usage: ./pg_restore.sh /tmp/hospyn_backups/hospyn_backup_YYYYMMDD_HHMMSS.sql.gz

echo "=================================================="
echo " Hospyn Disaster Recovery - Database Restore "
echo "=================================================="

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "[ERROR] You must provide the path to the backup file."
    echo "Usage: ./pg_restore.sh <path_to_backup.sql.gz>"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "[ERROR] Backup file not found: $BACKUP_FILE"
    exit 1
fi

if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_DB" ]; then
    echo "[ERROR] POSTGRES_USER and POSTGRES_DB must be set in the environment."
    exit 1
fi

echo "[WARNING] This will overwrite the existing database: $POSTGRES_DB on ${POSTGRES_SERVER:-localhost}"
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "[INFO] Restore cancelled."
    exit 1
fi

echo "[INFO] Terminating active connections to $POSTGRES_DB..."
PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -h "${POSTGRES_SERVER:-localhost}" -p "${POSTGRES_PORT:-5432}" -d postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();"

echo "[INFO] Dropping and recreating database $POSTGRES_DB..."
PGPASSWORD=$POSTGRES_PASSWORD dropdb -U "$POSTGRES_USER" -h "${POSTGRES_SERVER:-localhost}" -p "${POSTGRES_PORT:-5432}" "$POSTGRES_DB" || true
PGPASSWORD=$POSTGRES_PASSWORD createdb -U "$POSTGRES_USER" -h "${POSTGRES_SERVER:-localhost}" -p "${POSTGRES_PORT:-5432}" "$POSTGRES_DB"

echo "[INFO] Restoring backup from $BACKUP_FILE..."
zcat "$BACKUP_FILE" | PGPASSWORD=$POSTGRES_PASSWORD psql -U "$POSTGRES_USER" -h "${POSTGRES_SERVER:-localhost}" -p "${POSTGRES_PORT:-5432}" -d "$POSTGRES_DB"

if [ $? -eq 0 ]; then
    echo "[SUCCESS] Database restored successfully!"
else
    echo "[ERROR] Database restore failed!"
    exit 1
fi

echo "[INFO] Running database migrations to ensure schema is up-to-date..."
alembic upgrade head

echo "[SUCCESS] Restore validation complete."
exit 0
