#!/bin/bash
set -eo pipefail

# Hospyn Production Database Backup Verification Script
# This script performs a pg_dump of the primary PostgreSQL database
# and uploads it to cloud storage (simulated here for verification).
# 
# Usage: ./pg_backup.sh

echo "=================================================="
echo " Hospyn Disaster Recovery - Database Backup "
echo "=================================================="

if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_DB" ]; then
    echo "[ERROR] POSTGRES_USER and POSTGRES_DB must be set in the environment."
    exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="hospyn_backup_${TIMESTAMP}.sql.gz"
BACKUP_DIR="/tmp/hospyn_backups"

mkdir -p "$BACKUP_DIR"

echo "[INFO] Starting database backup for $POSTGRES_DB..."
# We use custom format for pg_dump (-Fc) for easier partial restores, but gzip for pure SQL
PGPASSWORD=$POSTGRES_PASSWORD pg_dump -U "$POSTGRES_USER" -h "${POSTGRES_SERVER:-localhost}" -p "${POSTGRES_PORT:-5432}" "$POSTGRES_DB" | gzip > "${BACKUP_DIR}/${BACKUP_FILE}"

echo "[INFO] Backup completed successfully: ${BACKUP_DIR}/${BACKUP_FILE}"
echo "[INFO] Verifying backup integrity..."
gzip -t "${BACKUP_DIR}/${BACKUP_FILE}"
if [ $? -eq 0 ]; then
    echo "[SUCCESS] Backup file integrity verified."
else
    echo "[ERROR] Backup file integrity check failed!"
    exit 1
fi

# In a real environment, sync to S3/GCS
# aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" s3://hospyn-prod-backups/db/

echo "[INFO] Backup process finished."
exit 0
