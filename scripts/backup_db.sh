#!/bin/bash
# AHP 2.0 Enterprise Backup Script

# Config
BACKUP_DIR="/backups"
DB_NAME="${DB_NAME:-ahp_prod}"
DB_USER="${DB_USER:-ahpadmin}"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql.gz"

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

echo "STARTING BACKUP: ${FILENAME}..."

# Run pg_dump (assumes environment variables like PGPASSWORD are set or in .pgpass)
pg_dump -h db -U $DB_USER $DB_NAME | gzip > $FILENAME

if [ $? -eq 0 ]; then
    echo "BACKUP_SUCCESS: ${FILENAME}"
    # Delete backups older than 30 days
    find $BACKUP_DIR -name "*.sql.gz" -type f -mtime +30 -delete
    echo "CLEANUP_COMPLETE: Older backups purged."
else
    echo "BACKUP_FAILURE: Check database connectivity and permissions."
    exit 1
fi
