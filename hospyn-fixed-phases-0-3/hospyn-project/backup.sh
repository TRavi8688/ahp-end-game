#!/usr/bin/env bash
# backup.sh — PostgreSQL + Redis backup with offsite S3/GCS upload
#
# ─────────────────────────────────────────────────────────────────────────────
# CRONTAB SETUP (AUDIT FIX L2):
# To run this script automatically every day at 2:00 AM server time,
# add the following line to the server's crontab (run: crontab -e):
#
#   0 2 * * * BACKUP_DIR=/var/backups/hospyn GCS_BUCKET=gs://hospyn-backups-prod POSTGRES_CONTAINER=hospyn-postgres-1 REDIS_CONTAINER=hospyn-redis-1 POSTGRES_USER=hospyn POSTGRES_DB=hospyn POSTGRES_PASSWORD=<from secrets manager> REDIS_PASSWORD=<from secrets manager> /opt/hospyn/backup.sh >> /var/log/hospyn_backup.log 2>&1
#
# Or use a wrapper script that sources the env and calls this:
#   0 2 * * * /opt/hospyn/run_backup.sh >> /var/log/hospyn_backup.log 2>&1
#
# Verify cron is working by checking /var/log/hospyn_backup.log after first run.
# ─────────────────────────────────────────────────────────────────────────────
#
# AUDIT FIXES APPLIED:
#   H4a: PGPASSWORD set before pg_dump — prevents interactive password prompt
#   H4b: Redis LASTSAVE polling instead of sleep 5 — reliable completion detection
#   H4c: Container names read from env vars — not hardcoded
#   L1:  S3/GCS upload after compression — configurable via GCS_BUCKET or S3_BUCKET
#   L2:  Crontab entry documented above
#   5.2: Container names from environment variables

set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_DIR:-/var/backups/hospyn}"
# AUDIT FIX L1: Offsite storage — set ONE of these:
GCS_BUCKET="${GCS_BUCKET:-}"     # Example: gs://hospyn-backups-prod
S3_BUCKET="${S3_BUCKET:-}"       # Example: s3://hospyn-backups-prod
# AUDIT FIX H4c / L2 (5.2): Container names from env vars — not hardcoded
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-hospyn_postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-hospyn_redis}"
POSTGRES_USER="${POSTGRES_USER:-hospyn}"
POSTGRES_DB="${POSTGRES_DB:-hospyn}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

mkdir -p "$BACKUP_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# PostgreSQL dump (AUDIT FIX H4a: PGPASSWORD prevents interactive prompt)
# ─────────────────────────────────────────────────────────────────────────────
log "Starting PostgreSQL backup..."
PG_DUMP_FILE="$BACKUP_DIR/hospyn_pg_${DATE}.dump"

PGPASSWORD="$POSTGRES_PASSWORD" docker exec "$POSTGRES_CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f "/tmp/hospyn_pg_${DATE}.dump" \
  || fail "pg_dump failed"

docker cp "${POSTGRES_CONTAINER}:/tmp/hospyn_pg_${DATE}.dump" "$PG_DUMP_FILE" \
  || fail "Failed to copy dump from container"

docker exec "$POSTGRES_CONTAINER" rm -f "/tmp/hospyn_pg_${DATE}.dump"

PG_SIZE=$(stat -c%s "$PG_DUMP_FILE")
if [[ "$PG_SIZE" -lt 1024 ]]; then
  fail "PostgreSQL dump is suspiciously small (${PG_SIZE} bytes). Aborting."
fi
log "PostgreSQL dump: ${PG_SIZE} bytes — OK"

# ─────────────────────────────────────────────────────────────────────────────
# Redis backup (AUDIT FIX H4b: LASTSAVE polling, not sleep 5)
# ─────────────────────────────────────────────────────────────────────────────
log "Starting Redis backup..."
LASTSAVE_BEFORE=$(docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning LASTSAVE)
docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning BGSAVE > /dev/null

# Poll until LASTSAVE timestamp changes (means BGSAVE completed)
BGSAVE_DONE=false
for i in $(seq 1 30); do
  sleep 1
  LASTSAVE_AFTER=$(docker exec "$REDIS_CONTAINER" redis-cli -a "$REDIS_PASSWORD" --no-auth-warning LASTSAVE)
  if [[ "$LASTSAVE_AFTER" != "$LASTSAVE_BEFORE" ]]; then
    log "Redis BGSAVE complete after ${i}s."
    BGSAVE_DONE=true
    break
  fi
done

if [[ "$BGSAVE_DONE" != "true" ]]; then
  fail "Redis BGSAVE did not complete within 30 seconds."
fi

REDIS_DUMP="$BACKUP_DIR/hospyn_redis_${DATE}.rdb"
docker cp "${REDIS_CONTAINER}:/data/dump.rdb" "$REDIS_DUMP" \
  || fail "Failed to copy Redis dump"

log "Redis dump: $(stat -c%s "$REDIS_DUMP") bytes — OK"

# ─────────────────────────────────────────────────────────────────────────────
# Compress into a single archive
# ─────────────────────────────────────────────────────────────────────────────
ARCHIVE="$BACKUP_DIR/hospyn_backup_${DATE}.tar.gz"
tar -czf "$ARCHIVE" -C "$BACKUP_DIR" \
  "hospyn_pg_${DATE}.dump" \
  "hospyn_redis_${DATE}.rdb"

rm -f "$PG_DUMP_FILE" "$REDIS_DUMP"

ARCHIVE_SIZE=$(stat -c%s "$ARCHIVE")
log "Compressed archive: ${ARCHIVE_SIZE} bytes — $ARCHIVE"

# ─────────────────────────────────────────────────────────────────────────────
# AUDIT FIX L1: Offsite upload (optional — skip if neither bucket is set)
# ─────────────────────────────────────────────────────────────────────────────
if [[ -n "$GCS_BUCKET" ]]; then
  log "Uploading to GCS: ${GCS_BUCKET}/$(basename "$ARCHIVE")"
  gsutil cp "$ARCHIVE" "${GCS_BUCKET}/$(basename "$ARCHIVE")" \
    || fail "GCS upload failed — backup is LOCAL ONLY at $ARCHIVE"
  gsutil stat "${GCS_BUCKET}/$(basename "$ARCHIVE")" > /dev/null \
    || fail "GCS verification failed — object not found after upload"
  log "GCS upload verified."
elif [[ -n "$S3_BUCKET" ]]; then
  log "Uploading to S3: ${S3_BUCKET}/$(basename "$ARCHIVE")"
  aws s3 cp "$ARCHIVE" "${S3_BUCKET}/$(basename "$ARCHIVE")" \
    || fail "S3 upload failed — backup is LOCAL ONLY at $ARCHIVE"
  log "S3 upload complete."
else
  log "WARNING: Neither GCS_BUCKET nor S3_BUCKET is set — backup is LOCAL ONLY."
  log "         Set GCS_BUCKET=gs://your-bucket or S3_BUCKET=s3://your-bucket"
  log "         for offsite disaster recovery."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Local retention: keep last 7 days
# ─────────────────────────────────────────────────────────────────────────────
find "$BACKUP_DIR" -name "hospyn_backup_*.tar.gz" -mtime +7 -exec rm -v {} \;

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "hospyn_backup_*.tar.gz" | wc -l)
log "Backup complete: $ARCHIVE"
log "Local backups retained: $BACKUP_COUNT"
