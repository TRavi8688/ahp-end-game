#!/usr/bin/env bash
# backup.sh
# PHASE 08 FIX: Backups now uploaded to GCS after local compression.
# Previously, backups were written to /var/backups/hospyn ONLY — meaning
# a server failure would destroy both the primary database AND all backups.
#
# This script:
#   1. Dumps PostgreSQL to local compressed file
#   2. Dumps Redis RDB snapshot
#   3. Uploads both to GCS bucket (offsite)
#   4. Verifies the GCS upload succeeded
#   5. Sends alert to Slack if backup fails
#   6. Cleans up local files older than 7 days
#   7. Exits non-zero on any failure (so cron can alert)

set -euo pipefail

# ─── CONFIGURATION ───────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/hospyn}"
GCS_BUCKET="${GCS_BUCKET:-gs://hospyn-backups-prod}"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="hospyn_backup_${DATE}"

# Required environment variables — fail fast if missing
: "${POSTGRES_HOST:?POSTGRES_HOST must be set}"
: "${POSTGRES_USER:?POSTGRES_USER must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
: "${POSTGRES_DB:?POSTGRES_DB must be set}"
: "${GCS_BUCKET:?GCS_BUCKET must be set}"

# Optional Slack webhook for failure alerts
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# ─── HELPERS ─────────────────────────────────────────────────────────────────
log() { echo "[$(date +'%Y-%m-%dT%H:%M:%S')] $*"; }

alert_failure() {
    local message="$1"
    log "ERROR: $message"
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -s -X POST "$SLACK_WEBHOOK" \
          -H 'Content-type: application/json' \
          -d "{\"text\":\"🚨 *Hospyn Backup FAILED* on $(hostname): ${message}\"}" \
          || true  # don't fail if Slack is unreachable
    fi
    exit 1
}

# Run alert_failure on any unexpected exit
trap 'alert_failure "Backup script exited unexpectedly at line $LINENO"' ERR

# ─── SETUP ───────────────────────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
log "Starting Hospyn backup: $BACKUP_NAME"

# ─── POSTGRES DUMP ───────────────────────────────────────────────────────────
log "Dumping PostgreSQL database: $POSTGRES_DB"
PG_DUMP_FILE="${BACKUP_DIR}/${BACKUP_NAME}_postgres.sql.gz"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
    -h "$POSTGRES_HOST" \
    -U "$POSTGRES_USER" \
    "$POSTGRES_DB" \
    | gzip -9 > "$PG_DUMP_FILE"

if [ ! -s "$PG_DUMP_FILE" ]; then
    alert_failure "PostgreSQL dump is empty — something went wrong"
fi
log "PostgreSQL dump complete: $(du -sh "$PG_DUMP_FILE" | cut -f1)"

# ─── REDIS SNAPSHOT ──────────────────────────────────────────────────────────
log "Copying Redis RDB snapshot"
REDIS_DUMP_FILE="${BACKUP_DIR}/${BACKUP_NAME}_redis.rdb"
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

if [ -n "$REDIS_PASSWORD" ]; then
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" BGSAVE 2>/dev/null
else
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BGSAVE
fi
sleep 3  # wait for BGSAVE to complete

# Copy the RDB file from the redis volume path if accessible
REDIS_RDB_PATH="${REDIS_RDB_PATH:-/data/dump.rdb}"
if [ -f "$REDIS_RDB_PATH" ]; then
    cp "$REDIS_RDB_PATH" "$REDIS_DUMP_FILE"
    gzip -9 "$REDIS_DUMP_FILE"
    REDIS_DUMP_FILE="${REDIS_DUMP_FILE}.gz"
    log "Redis snapshot copied: $(du -sh "$REDIS_DUMP_FILE" | cut -f1)"
else
    log "WARNING: Redis RDB file not found at $REDIS_RDB_PATH — skipping Redis backup"
fi

# ─── BUNDLE INTO TAR ─────────────────────────────────────────────────────────
log "Bundling backup archive"
BUNDLE_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
tar -czf "$BUNDLE_FILE" -C "$BACKUP_DIR" \
    "${BACKUP_NAME}_postgres.sql.gz" \
    $([ -f "${BACKUP_DIR}/${BACKUP_NAME}_redis.rdb.gz" ] && echo "${BACKUP_NAME}_redis.rdb.gz" || true)

log "Bundle created: $(du -sh "$BUNDLE_FILE" | cut -f1)"

# ─── FIX: UPLOAD TO GCS ──────────────────────────────────────────────────────
log "Uploading to GCS: ${GCS_BUCKET}/daily/${BACKUP_NAME}.tar.gz"
gsutil cp "$BUNDLE_FILE" "${GCS_BUCKET}/daily/${BACKUP_NAME}.tar.gz" \
    || alert_failure "GCS upload failed — local backup exists but offsite copy NOT made"

# ─── FIX: VERIFY THE UPLOAD ──────────────────────────────────────────────────
log "Verifying GCS upload..."
GCS_SIZE=$(gsutil stat "${GCS_BUCKET}/daily/${BACKUP_NAME}.tar.gz" 2>/dev/null \
    | grep 'Content-Length' | awk '{print $2}' || echo "0")
LOCAL_SIZE=$(stat -c%s "$BUNDLE_FILE")

if [ "$GCS_SIZE" -eq 0 ] || [ "$GCS_SIZE" -ne "$LOCAL_SIZE" ]; then
    alert_failure "GCS upload verification FAILED — sizes don't match (local: $LOCAL_SIZE, gcs: $GCS_SIZE)"
fi
log "GCS upload verified ✓ (size: ${GCS_SIZE} bytes)"

# ─── CLEAN UP LOCAL FILES > 7 DAYS ───────────────────────────────────────────
log "Cleaning local backups older than 7 days"
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -exec rm {} \;
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +1 -exec rm {} \;
find "$BACKUP_DIR" -name "*.rdb.gz" -mtime +1 -exec rm {} \;

# ─── SUCCESS ─────────────────────────────────────────────────────────────────
log "✓ Backup completed successfully: ${BACKUP_NAME}"
log "  GCS: ${GCS_BUCKET}/daily/${BACKUP_NAME}.tar.gz"
log "  Local: ${BUNDLE_FILE}"

# Send success notification (optional)
if [ -n "$SLACK_WEBHOOK" ]; then
    curl -s -X POST "$SLACK_WEBHOOK" \
      -H 'Content-type: application/json' \
      -d "{\"text\":\"✅ Hospyn backup completed: \`${BACKUP_NAME}\` ($(du -sh "$BUNDLE_FILE" | cut -f1))\"}" \
      || true
fi
