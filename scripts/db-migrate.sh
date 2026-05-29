#!/usr/bin/env bash
# =============================================================================
# NexClass — Database Migration Script
#
# Migrates your PostgreSQL database from any source (AWS RDS, local Docker,
# self-hosted) to Neon or Supabase (or any other PostgreSQL target).
#
# Usage:
#   ./scripts/db-migrate.sh
#
# Required environment variables:
#   SOURCE_DATABASE_URL   - Connection string of the SOURCE database
#   TARGET_DATABASE_URL   - Connection string of the TARGET (Neon / Supabase)
#
# Optional:
#   MIGRATION_DIR         - Where to store the dump file (default: /tmp)
#   SKIP_DUMP             - Set to "true" to skip pg_dump and use existing dump
#   DUMP_FILE             - Path to an existing dump file (used when SKIP_DUMP=true)
#
# Examples:
#   # Neon (get URL from neon.tech → your project → Connection string)
#   TARGET_DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/nexclass?sslmode=require"
#
#   # Supabase (get URL from app.supabase.com → Project settings → Database)
#   TARGET_DATABASE_URL="postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres"
# =============================================================================

set -euo pipefail

MIGRATION_DIR="${MIGRATION_DIR:-/tmp}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
DUMP_FILE="${DUMP_FILE:-${MIGRATION_DIR}/nexclass_migration_${TIMESTAMP}.sql}"
LOG_PREFIX="[migrate]"

log()  { echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") ${LOG_PREFIX} $*"; }
fail() { log "ERROR: $*" >&2; exit 1; }

# ── Validate inputs ───────────────────────────────────────────────────────────
[[ -z "${SOURCE_DATABASE_URL:-}" ]] && fail "SOURCE_DATABASE_URL is not set"
[[ -z "${TARGET_DATABASE_URL:-}" ]] && fail "TARGET_DATABASE_URL is not set"

command -v pg_dump    >/dev/null 2>&1 || fail "pg_dump not found.    Install: apt-get install postgresql-client"
command -v pg_restore >/dev/null 2>&1 || fail "pg_restore not found. Install: apt-get install postgresql-client"
command -v psql       >/dev/null 2>&1 || fail "psql not found.       Install: apt-get install postgresql-client"

# ── Parse a DATABASE_URL into components ─────────────────────────────────────
parse_url() {
  local url="${1%%\?*}"  # strip query string
  local regex='^postgres(ql)?://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/(.+)$'
  if [[ $url =~ $regex ]]; then
    echo "${BASH_REMATCH[2]}|${BASH_REMATCH[3]}|${BASH_REMATCH[4]}|${BASH_REMATCH[5]:-5432}|${BASH_REMATCH[6]}"
  else
    fail "Could not parse URL: $url"
  fi
}

IFS='|' read -r SRC_USER SRC_PASS SRC_HOST SRC_PORT SRC_DB <<< "$(parse_url "$SOURCE_DATABASE_URL")"
IFS='|' read -r TGT_USER TGT_PASS TGT_HOST TGT_PORT TGT_DB <<< "$(parse_url "$TARGET_DATABASE_URL")"

log "Source: ${SRC_DB}@${SRC_HOST}:${SRC_PORT}"
log "Target: ${TGT_DB}@${TGT_HOST}:${TGT_PORT}"
echo ""

# ── Safety prompt ─────────────────────────────────────────────────────────────
echo "WARNING: This will overwrite ALL data in the TARGET database."
echo "  Target: ${TGT_DB}@${TGT_HOST}"
echo ""
read -p "Type 'yes' to continue: " CONFIRM
[[ "$CONFIRM" != "yes" ]] && { log "Aborted."; exit 0; }

# ── Step 1: Dump source database ──────────────────────────────────────────────
if [[ "${SKIP_DUMP:-false}" == "true" ]]; then
  log "SKIP_DUMP=true — using existing dump file: ${DUMP_FILE}"
  [[ -f "$DUMP_FILE" ]] || fail "Dump file not found: ${DUMP_FILE}"
else
  log "Step 1/4 — Dumping source database..."

  SOURCE_SSL=""
  [[ "$SOURCE_DATABASE_URL" == *"sslmode=require"* ]] && SOURCE_SSL="sslmode=require"

  PGPASSWORD="$SRC_PASS" pg_dump \
    --host="$SRC_HOST" \
    --port="$SRC_PORT" \
    --username="$SRC_USER" \
    --dbname="$SRC_DB" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --no-acl \
    --clean \
    --if-exists \
    ${SOURCE_SSL:+--no-password} \
    --file="$DUMP_FILE"

  DUMP_SIZE=$(du -sh "$DUMP_FILE" | cut -f1)
  log "Dump complete: ${DUMP_FILE} (${DUMP_SIZE})"
fi

# ── Step 2: Enable pg_stat_statements on target ───────────────────────────────
log "Step 2/4 — Enabling pg_stat_statements on target..."
PGPASSWORD="$TGT_PASS" psql \
  --host="$TGT_HOST" \
  --port="$TGT_PORT" \
  --username="$TGT_USER" \
  --dbname="$TGT_DB" \
  --command="CREATE EXTENSION IF NOT EXISTS pg_stat_statements;" \
  || log "  WARNING: Could not create pg_stat_statements extension (may already exist or need superuser)"

# ── Step 3: Restore to target ─────────────────────────────────────────────────
log "Step 3/4 — Restoring to target database..."

TARGET_SSLMODE="require"
if [[ "$TARGET_DATABASE_URL" == *"neon.tech"* ]] || [[ "$TARGET_DATABASE_URL" == *"supabase.co"* ]]; then
  TARGET_SSLMODE="require"
fi

PGPASSWORD="$TGT_PASS" psql \
  --host="$TGT_HOST" \
  --port="$TGT_PORT" \
  --username="$TGT_USER" \
  --dbname="$TGT_DB" \
  "sslmode=${TARGET_SSLMODE}" \
  --file="$DUMP_FILE" \
  2>&1 | grep -v "^NOTICE:" | grep -v "^SET" || true
  # Ignore SET and NOTICE messages; errors will still surface

log "Restore complete"

# ── Step 4: Verify row counts ─────────────────────────────────────────────────
log "Step 4/4 — Verifying row counts (source vs target)..."

TABLES=("users" "students" "institutes" "tuition_classes" "student_enrollments" "attendance_sessions" "attendance_records" "payment_dues")

printf "%-30s %10s %10s %10s\n" "TABLE" "SOURCE" "TARGET" "MATCH"
printf "%-30s %10s %10s %10s\n" "-----" "------" "------" "-----"

ALL_MATCH=true
for TABLE in "${TABLES[@]}"; do
  SRC_COUNT=$(PGPASSWORD="$SRC_PASS" psql \
    --host="$SRC_HOST" --port="$SRC_PORT" --username="$SRC_USER" --dbname="$SRC_DB" \
    --tuples-only --command="SELECT COUNT(*) FROM \"${TABLE}\"" 2>/dev/null | xargs || echo "0")

  TGT_COUNT=$(PGPASSWORD="$TGT_PASS" psql \
    --host="$TGT_HOST" --port="$TGT_PORT" --username="$TGT_USER" --dbname="$TGT_DB" \
    --tuples-only --command="SELECT COUNT(*) FROM \"${TABLE}\"" 2>/dev/null | xargs || echo "0")

  if [[ "$SRC_COUNT" == "$TGT_COUNT" ]]; then
    MATCH="OK"
  else
    MATCH="MISMATCH"
    ALL_MATCH=false
  fi

  printf "%-30s %10s %10s %10s\n" "$TABLE" "$SRC_COUNT" "$TGT_COUNT" "$MATCH"
done

echo ""
if $ALL_MATCH; then
  log "All row counts match — migration verified successfully"
else
  log "WARNING: Row count mismatches detected — review the table above"
  log "  This may be caused by sequences or constraints; verify data manually"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
log "Migration complete!"
log ""
log "Next steps:"
log "  1. Update DATABASE_URL in your .env to: ${TARGET_DATABASE_URL%%\?*}?sslmode=require"
log "  2. Run Prisma migrations: npx prisma migrate deploy"
log "  3. Test your application against the new database"
log "  4. Once confirmed, decommission the source database"
log ""
log "Dump file retained at: ${DUMP_FILE}"
log "  Delete it when no longer needed: rm ${DUMP_FILE}"
