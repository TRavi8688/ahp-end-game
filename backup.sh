#!/bin/bash
# ============================================================
# backup.sh — FIXED VERSION
# FIXES APPLIED:
#   - Uploads encrypted backup to GCS (was local-only)
#   - AES-256 encryption before upload
#   - SHA256 integrity checksum
#   - 7-year retention via GCS lifecycle (healthcare requirement)
#   - Local temp files cleaned up after upload
#   - Error handling with set -euo pipefail
#   - Backup completion logged with GCS path
# ============================================================
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_DIR="/tmp/hospyn_backup_${TIMESTAMP}"
GCS_BUCKET="${GCS_BACKUP_BUCKET:-gs://hospyn-backups-prod}"
LOG_PREFIX="[Hospyn Backup ${TIMESTAMP}]"

# Required environment variables
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
: "${POSTGRES_HOST:?POSTGRES_HOST must be set}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY must be set}"

mkdir -p "${TEMP_DIR}"

echo "${LOG_PREFIX} Starting Hospyn backup..."

# ── 1. PostgreSQL Dump ────────────────────────────────────────
echo "${LOG_PREFIX} Dumping PostgreSQL: hospyn_auth..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${POSTGRES_HOST}" \
    -U hospyn \
    -d hospyn_auth \
    -F c \
    --no-password \
    -f "${TEMP_DIR}/auth_${TIMESTAMP}.dump"

echo "${LOG_PREFIX} Dumping PostgreSQL: hospyn_healthcare..."
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h "${POSTGRES_HOST}" \
    -U hospyn \
    -d hospyn_healthcare \
    -F c \
    --no-password \
    -f "${TEMP_DIR}/healthcare_${TIMESTAMP}.dump"

# ── 2. Compress both dumps into one archive ───────────────────
echo "${LOG_PREFIX} Compressing..."
tar -czf \
    "${TEMP_DIR}/hospyn_backup_${TIMESTAMP}.tar.gz" \
    -C "${TEMP_DIR}" \
    "auth_${TIMESTAMP}.dump" \
    "healthcare_${TIMESTAMP}.dump"

# Remove uncompressed dumps
rm -f \
    "${TEMP_DIR}/auth_${TIMESTAMP}.dump" \
    "${TEMP_DIR}/healthcare_${TIMESTAMP}.dump"

ARCHIVE="${TEMP_DIR}/hospyn_backup_${TIMESTAMP}.tar.gz"

# ── 3. Encrypt with AES-256-CBC before upload ─────────────────
# FIXED: Original backup had no encryption at rest
echo "${LOG_PREFIX} Encrypting with AES-256..."
ENCRYPTED="${TEMP_DIR}/hospyn_backup_${TIMESTAMP}.tar.gz.enc"
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 \
    -pass "env:BACKUP_ENCRYPTION_KEY" \
    -in "${ARCHIVE}" \
    -out "${ENCRYPTED}"
rm -f "${ARCHIVE}"

# ── 4. Generate integrity checksum ───────────────────────────
# FIXED: Original backup had no integrity verification
echo "${LOG_PREFIX} Computing SHA256 checksum..."
CHECKSUM_FILE="${TEMP_DIR}/hospyn_backup_${TIMESTAMP}.sha256"
sha256sum "${ENCRYPTED}" > "${CHECKSUM_FILE}"
echo "${LOG_PREFIX} Checksum: $(cat ${CHECKSUM_FILE})"

# ── 5. Upload to GCS ──────────────────────────────────────────
# FIXED: Original backup stored locally only (total data loss risk)
echo "${LOG_PREFIX} Uploading to GCS: ${GCS_BUCKET}/postgres/..."
gsutil -m cp \
    "${ENCRYPTED}" \
    "${CHECKSUM_FILE}" \
    "${GCS_BUCKET}/postgres/"

echo "${LOG_PREFIX} Upload complete."
echo "${LOG_PREFIX} Backup path: ${GCS_BUCKET}/postgres/hospyn_backup_${TIMESTAMP}.tar.gz.enc"

# ── 6. Clean up local temp files ─────────────────────────────
rm -rf "${TEMP_DIR}"
echo "${LOG_PREFIX} Local temp files cleaned up."

# ── 7. Verify the upload exists in GCS ───────────────────────
gsutil stat "${GCS_BUCKET}/postgres/hospyn_backup_${TIMESTAMP}.tar.gz.enc" > /dev/null
echo "${LOG_PREFIX} GCS verification: OK"

echo "${LOG_PREFIX} Backup completed successfully."

# ──────────────────────────────────────────────────────────────
# RETENTION POLICY:
# Set via GCS lifecycle rule (NOT via this script).
# Run once to configure:
#   gsutil lifecycle set scripts/gcs-lifecycle.json gs://hospyn-backups-prod
#
# gcs-lifecycle.json should contain:
# {
#   "lifecycle": {
#     "rule": [{
#       "action": {"type": "Delete"},
#       "condition": {"age": 2555}  <- 7 years (healthcare requirement)
#     }]
#   }
# }
# ──────────────────────────────────────────────────────────────
