#!/bin/bash
# Hospyn Automated Backup Script (PostgreSQL + Redis)

set -e

BACKUP_DIR="/var/backups/hospyn"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting Hospyn database backups at $(date)"

# 1. PostgreSQL Backup
echo "Dumping PostgreSQL database..."
docker exec hospyn_postgres pg_dump -U postgres -d hospyn -F c -f "/tmp/hospyn_db_$DATE.dump"
docker cp "hospyn_postgres:/tmp/hospyn_db_$DATE.dump" "$BACKUP_DIR/hospyn_db_$DATE.dump"
docker exec hospyn_postgres rm "/tmp/hospyn_db_$DATE.dump"

# 2. Redis Backup (Optional, but good for active sessions)
echo "Triggering Redis BGSAVE and copying dump.rdb..."
docker exec hospyn_redis redis-cli BGSAVE
sleep 5 # Wait for BGSAVE to complete
docker cp "hospyn_redis:/data/dump.rdb" "$BACKUP_DIR/redis_dump_$DATE.rdb"

# 3. Compress Backups
echo "Compressing backups..."
cd "$BACKUP_DIR"
tar -czf "hospyn_backup_$DATE.tar.gz" "hospyn_db_$DATE.dump" "redis_dump_$DATE.rdb"
rm "hospyn_db_$DATE.dump" "redis_dump_$DATE.rdb"

# 4. Retention Policy: Keep last 7 days of backups
echo "Applying retention policy (7 days)..."
find "$BACKUP_DIR" -name "hospyn_backup_*.tar.gz" -mtime +7 -exec rm {} \;

echo "Backup completed successfully: $BACKUP_DIR/hospyn_backup_$DATE.tar.gz"
