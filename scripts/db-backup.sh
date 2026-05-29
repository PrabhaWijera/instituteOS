#!/usr/bin/env bash
# =============================================================================
# NexClass — PostgreSQL Automated Backup Script
#
# Usage:
#   ./scripts/db-backup.sh                    # uses $DATABASE_URL
#   DATABASE_URL=postgresql://... ./scripts/db-backup.sh
#
# Environment variables:
#   DATABASE_URL          - PostgreSQL connection string (required)
#                           Works with Neon, Supabase, or any PostgreSQL URL
#
#   ── Cloudflare R2 upload (recommended — free, no egress fees) ──
#   BACKUP_R2_BUCKET      - R2 bucket name (e.g. nexclass-db-backups)
#   R2_ACCOUNT_ID         - Cloudflare account ID (32 hex chars)
#   R2_ACCESS_KEY_ID      - R2 API token access key
#   R2_SECRET_ACCESS_KEY  - R2 API token secret key
#
#   ── AWS S3 upload (optional fallback) ──
#   BACKUP_S3_BUCKET      - S3 bucket name
#   AWS_ACCESS_KEY_ID     - AWS access key
#   AWS_SECRET_ACCESS_KEY - AWS secret key
#   AWS_REGION            - AWS region (default: us-east-1)
#
#   ── Other ──
#   BACKUP_RETAIN_DAYS    - Local backups to keep in days (default: 7)
#   BACKUP_DIR            - Local backup directory (default: /var/backups/nexclass)
#   SLACK_WEBHOOK_URL     - Slack webhook for alerts (optional)
#
# Crontab example (daily at 01:30 UTC):
#   30 1 * * * /opt/nexclass/scripts/db-backup.sh >> /var/log/nexclass-backup.log 2>&1
# =============================================================================

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nexclass}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/nexclass_${TIMESTAMP}.sql.gz"
LOG_PREFIX="[backup]"

# ── Parse DATABASE_URL ────────────────────────────────────────────────────────
if [[ -z "${DATABASE_URL:-}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENV_FILE="${SCRIPT_DIR}/../.env"
  if [[ -f "$ENV_FILE" ]]; then
    set -o allexport
    source "$ENV_FILE"
    set +o allexport
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "${LOG_PREFIX} ERROR: DATABASE_URL is not set" >&2
  exit 1
fi

# Extract components from DATABASE_URL
# Supports: postgresql:// and postgres:// schemes
# Format: postgresql://user:password@host:port/dbname?params
DB_URL_CLEAN="${DATABASE_URL%%\?*}"  # strip query params
DB_REGEX='^postgres(ql)?://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/(.+)$'
if [[ $DB_URL_CLEAN =~ $DB_REGEX ]]; then
  DB_USER="${BASH_REMATCH[2]}"
  DB_PASS="${BASH_REMATCH[3]}"
  DB_HOST="${BASH_REMATCH[4]}"
  DB_PORT="${BASH_REMATCH[5]:-5432}"
  DB_NAME="${BASH_REMATCH[6]}"
else
  echo "${LOG_PREFIX} ERROR: Could not parse DATABASE_URL" >&2
  exit 1
fi

export PGPASSWORD="$DB_PASS"

# Neon/Supabase require SSL — detect and pass sslmode
SSL_ARGS=""
if [[ "$DATABASE_URL" == *"neon.tech"* ]] || [[ "$DATABASE_URL" == *"supabase.co"* ]]; then
  SSL_ARGS="sslmode=require"
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
log()  { echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") ${LOG_PREFIX} $*"; }
fail() { log "ERROR: $*"; notify_slack "FAILED: $*"; exit 1; }

notify_slack() {
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-type: application/json' \
      --data "{\"text\":\"NexClass DB Backup: $1\"}" \
      || true
  fi
}

# ── Pre-flight ────────────────────────────────────────────────────────────────
log "Starting backup — DB: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
mkdir -p "$BACKUP_DIR"
command -v pg_dump >/dev/null 2>&1 || fail "pg_dump not found. Install: apt-get install postgresql-client"

# ── Dump ──────────────────────────────────────────────────────────────────────
log "Running pg_dump..."
pg_dump \
  --host="$DB_HOST" \
  --port="$DB_PORT" \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  ${SSL_ARGS:+--no-password} \
  --format=plain \
  --no-owner \
  --no-privileges \
  --verbose \
  2>>"${BACKUP_DIR}/backup_${TIMESTAMP}.log" \
  | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Backup created: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ── Upload to Cloudflare R2 (preferred — free, S3-compatible) ─────────────────
if [[ -n "${BACKUP_R2_BUCKET:-}" ]]; then
  log "Uploading to Cloudflare R2: ${BACKUP_R2_BUCKET}..."

  command -v aws >/dev/null 2>&1 || fail "aws CLI not found. Install: apt-get install awscli"

  R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
  AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
  aws s3 cp "$BACKUP_FILE" \
    "s3://${BACKUP_R2_BUCKET}/db-backups/$(basename "$BACKUP_FILE")" \
    --endpoint-url "$R2_ENDPOINT" \
    --region auto \
    --checksum-algorithm CRC32

  log "R2 upload complete → ${R2_ENDPOINT}/${BACKUP_R2_BUCKET}/db-backups/$(basename "$BACKUP_FILE")"

# ── Upload to AWS S3 (optional fallback) ──────────────────────────────────────
elif [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  log "Uploading to S3: s3://${BACKUP_S3_BUCKET}/db-backups/"
  command -v aws >/dev/null 2>&1 || fail "aws CLI not found but BACKUP_S3_BUCKET is set"

  aws s3 cp "$BACKUP_FILE" \
    "s3://${BACKUP_S3_BUCKET}/db-backups/$(basename "$BACKUP_FILE")" \
    --storage-class STANDARD_IA \
    --sse AES256 \
    --region "${AWS_REGION:-us-east-1}"

  log "S3 upload complete"
else
  log "No remote storage configured — backup kept locally only"
  log "  Set BACKUP_R2_BUCKET + R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY for Cloudflare R2"
fi

# ── Rotate local backups ──────────────────────────────────────────────────────
log "Rotating local backups older than ${RETAIN_DAYS} days..."
find "$BACKUP_DIR" -name "nexclass_*.sql.gz" -mtime "+${RETAIN_DAYS}" -delete
find "$BACKUP_DIR" -name "backup_*.log"      -mtime "+${RETAIN_DAYS}" -delete

REMAINING=$(find "$BACKUP_DIR" -name "nexclass_*.sql.gz" | wc -l)
log "Rotation complete — ${REMAINING} backup(s) retained locally"

# ── Verify backup integrity ───────────────────────────────────────────────────
log "Verifying backup integrity..."
gzip -t "$BACKUP_FILE" 2>/dev/null || fail "Integrity check FAILED for ${BACKUP_FILE}"
log "Integrity check PASSED"

# ── Done ──────────────────────────────────────────────────────────────────────
log "Backup complete — ${BACKUP_FILE} (${BACKUP_SIZE})"
notify_slack "SUCCESS — ${BACKUP_FILE} (${BACKUP_SIZE})"
