#!/bin/bash
set -euo pipefail

# ============================================
# NexClass Database Backup Script
# Backs up PostgreSQL to S3-compatible storage
# ============================================

# Configuration (override via environment or .env)
: "${DB_HOST:=localhost}"
: "${DB_PORT:=5432}"
: "${DB_NAME:=nexclass}"
: "${DB_USER:=postgres}"
: "${BACKUP_BUCKET:=nexclass-backups}"
: "${BACKUP_RETENTION_DAYS:=30}"
: "${BACKUP_DIR:=/tmp/nexclass-backups}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="nexclass_${TIMESTAMP}.dump"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"; }
error() { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2; }

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Step 1: Create backup
log "Starting database backup: ${DB_NAME}@${DB_HOST}"
pg_dump -Fc -Z9 \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  "${DB_NAME}" > "${BACKUP_PATH}"

BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Step 2: Verify backup integrity
log "Verifying backup integrity..."
pg_restore -l "${BACKUP_PATH}" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  log "Backup verified successfully"
else
  error "Backup verification failed!"
  rm -f "${BACKUP_PATH}"
  exit 1
fi

# Step 3: Upload to S3 (requires aws cli configured)
if command -v aws &> /dev/null; then
  log "Uploading to S3: s3://${BACKUP_BUCKET}/${BACKUP_FILE}"
  aws s3 cp "${BACKUP_PATH}" "s3://${BACKUP_BUCKET}/${BACKUP_FILE}" \
    --storage-class STANDARD_IA \
    --only-show-errors

  if [ $? -eq 0 ]; then
    log "Upload complete"
  else
    error "S3 upload failed!"
    exit 1
  fi

  # Step 4: Clean up old backups from S3
  log "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
  CUTOFF_DATE=$(date -d "-${BACKUP_RETENTION_DAYS} days" +%Y-%m-%d 2>/dev/null || date -v-${BACKUP_RETENTION_DAYS}d +%Y-%m-%d)
  aws s3 ls "s3://${BACKUP_BUCKET}/" | while read -r line; do
    FILE_DATE=$(echo "$line" | awk '{print $1}')
    FILE_NAME=$(echo "$line" | awk '{print $4}')
    if [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]] && [[ "${FILE_NAME}" == nexclass_* ]]; then
      log "Deleting old backup: ${FILE_NAME}"
      aws s3 rm "s3://${BACKUP_BUCKET}/${FILE_NAME}" --only-show-errors
    fi
  done
else
  warn "AWS CLI not found. Backup saved locally only: ${BACKUP_PATH}"
fi

# Step 5: Clean up local temp file
rm -f "${BACKUP_PATH}"

log "Backup completed successfully!"
