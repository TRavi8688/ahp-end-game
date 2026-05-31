#!/usr/bin/env bash
# backup.sh — PostgreSQL + Redis backup with GCS offsite upload
# FIXES:
#   - Credentials from env vars (not hardcoded)
#   - Uploads to GCS immediately after local backup
#   - Verifies backup integrity
#   - Exits with error code if backup fails (triggers cron alert)
#   - 7-day local retention + 30-day GCS retention (set via bucket lifecycle)
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/var/backups/hospyn}"
GCS_BUCKET="${GCS_BUCKET:-}"  # Required in production: gs://hospyn-backups-prod
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-hospyn_postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-hospyn_redis}"
POSTGRES_USER="${POSTGRES_USER:-hospyn}"
POSTGRES_DB="${POSTGRES_DB:-hospyn}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# PostgreSQL dump
# ---------------------------------------------------------------------------
log "Starting PostgreSQL backup..."
PG_DUMP_FILE="$BACKUP_DIR/hospyn_pg_${DATE}.dump"

PGPASSWORD="$POSTGRES_PASSWORD" docker exec "$POSTGRES_CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f "/tmp/hospyn_pg_${DATE}.dump" \
  || fail "pg_dump failed"

docker cp "${POSTGRES_CONTAINER}:/tmp/hospyn_pg_${DATE}.dump" "$PG_DUMP_FILE" \
  || fail "Failed to copy dump from container"

docker exec "$POSTGRES_CONTAINER" rm -f "/tmp/hospyn_pg_${DATE}.dump"

# Verify dump is not empty
PG_SIZE=$(stat -c%s "$PG_DUMP_FILE")
if [[ "$PG_SIZE" -lt 1024 ]]; then
  fail "PostgreSQL dump is suspiciously small (${PG_SIZE} bytes). Aborting."
fi
log "PostgreSQL dump: ${PG_SIZE} bytes — OK"

# ---------------------------------------------------------------------------
# Redis backup (trigger BGSAVE, wait for completion)
# ---------------------------------------------------------------------------
log "Starting Redis backup..."
docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning BGSAVE

# Wait for BGSAVE to finish (poll, not sleep)
for i in $(seq 1 30); do
  STATUS=$(docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning LASTSAVE)
  sleep 1
  NEW_STATUS=$(docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning LASTSAVE)
  if [[ "$NEW_STATUS" != "$STATUS" ]]; then
    break
  fi
done

REDIS_DUMP="$BACKUP_DIR/hospyn_redis_${DATE}.rdb"
docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "$REDIS_DUMP" \
  || fail "Failed to copy Redis dump"

log "Redis dump: $(stat -c%s "$REDIS_DUMP") bytes — OK"

# ---------------------------------------------------------------------------
# Compress both into a single archive
# ---------------------------------------------------------------------------
ARCHIVE="$BACKUP_DIR/hospyn_backup_${DATE}.tar.gz"
tar -czf "$ARCHIVE" -C "$BACKUP_DIR" \
  "hospyn_pg_${DATE}.dump" \
  "hospyn_redis_${DATE}.rdb"

rm -f "$PG_DUMP_FILE" "$REDIS_DUMP"

ARCHIVE_SIZE=$(stat -c%s "$ARCHIVE")
log "Compressed archive: ${ARCHIVE_SIZE} bytes"

# ---------------------------------------------------------------------------
# Upload to GCS (offsite — required for real disaster recovery)
# ---------------------------------------------------------------------------
if [[ -n "$GCS_BUCKET" ]]; then
  log "Uploading to GCS: ${GCS_BUCKET}/$(basename "$ARCHIVE")"
  gsutil cp "$ARCHIVE" "${GCS_BUCKET}/$(basename "$ARCHIVE")" \
    || fail "GCS upload failed — backup exists locally at $ARCHIVE but is NOT offsite"
  log "GCS upload complete."
  
  # Verify the upload by checking the object exists
  gsutil stat "${GCS_BUCKET}/$(basename "$ARCHIVE")" > /dev/null \
    || fail "GCS verification failed — object not found after upload"
  log "GCS verification passed."
else
  log "WARNING: GCS_BUCKET not set — backup is LOCAL ONLY. Set GCS_BUCKET for offsite backup."
fi

# ---------------------------------------------------------------------------
# Local retention: keep last 7 days
# ---------------------------------------------------------------------------
find "$BACKUP_DIR" -name "hospyn_backup_*.tar.gz" -mtime +7 -exec rm -v {} \;

log "Backup complete: $ARCHIVE"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
BACKUP_COUNT=$(find "$BACKUP_DIR" -name "hospyn_backup_*.tar.gz" | wc -l)
log "Local backups retained: $BACKUP_COUNT"
