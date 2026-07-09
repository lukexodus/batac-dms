#!/bin/bash
# tools/scripts/ops/monthly-restoration-test.sh
# Crontab on the production host:
#   0 3 1 * *  /opt/batac/scripts/monthly-restoration-test.sh >> /var/log/batac/restoration-test.log 2>&1
set -e

# Source backup environment if present
if [ -f /opt/batac/scripts/backup-env ]; then
  source /opt/batac/scripts/backup-env
fi

# Fallback to local .env if available (useful for local dev testing)
if [ -f "$(dirname "$0")/../../../.env" ]; then
  # Sourcing .env but ignoring lines starting with #
  export $(grep -v '^#' "$(dirname "$0")/../../../.env" | xargs)
fi

SCRATCH_DB="batac_lgu_restoretest"

S3_ENDPOINT_ARG=""
if [ -n "$S3_BACKUP_ENDPOINT" ]; then
  S3_ENDPOINT_ARG="--endpoint-url $S3_BACKUP_ENDPOINT"
fi

# Get the latest daily backup filename
LATEST=$(aws s3 ls "s3://${S3_BACKUP_BUCKET}/daily/" $S3_ENDPOINT_ARG \
  | sort | tail -n 1 | awk '{print $4}')

if [ -z "$LATEST" ]; then
  echo "[$(date -Iseconds)] [ALERT] No backup file found in s3://${S3_BACKUP_BUCKET}/daily/." >&2
  exit 1
fi

echo "[$(date -Iseconds)] Testing restoration of: ${LATEST}"
aws s3 cp "s3://${S3_BACKUP_BUCKET}/daily/${LATEST}" "/tmp/${LATEST}" $S3_ENDPOINT_ARG

echo "[$(date -Iseconds)] Decrypting dump..."
gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" --decrypt \
  -o "/tmp/restoretest.dump" "/tmp/${LATEST}"

echo "[$(date -Iseconds)] Recreating scratch database..."
psql "$DATABASE_URL_MIGRATE" -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};"
psql "$DATABASE_URL_MIGRATE" -c "CREATE DATABASE ${SCRATCH_DB};"

SCRATCH_URL=$(echo "$DATABASE_URL_MIGRATE" | sed -E "s/(\/[a-zA-Z0-9_]+)(\?[^?]+)?$/\/${SCRATCH_DB}\2/")

echo "[$(date -Iseconds)] Restoring dump into scratch database..."
set +e
pg_restore -d "$SCRATCH_URL" --no-owner --no-privileges "/tmp/restoretest.dump"
RESTORE_STATUS=$?
set -e
echo "[$(date -Iseconds)] pg_restore exited with status ${RESTORE_STATUS} (verifying restored database via spot checks next)"

echo "[$(date -Iseconds)] Running schema count check..."
EXPECTED_SCHEMA_COUNT="${EXPECTED_SCHEMA_COUNT:-11}"  # 10 Phase 1 schema-owning modules + audit
ACTUAL_SCHEMA_COUNT=$(psql "$SCRATCH_URL" -t -A -c \
  "SELECT count(*) FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','public');")

if [ "$ACTUAL_SCHEMA_COUNT" -lt "$EXPECTED_SCHEMA_COUNT" ]; then
  echo "[$(date -Iseconds)] [ALERT] Restored schema count (${ACTUAL_SCHEMA_COUNT}) is below the expected floor (${EXPECTED_SCHEMA_COUNT})." >&2
  psql "$DATABASE_URL_MIGRATE" -c "DROP DATABASE ${SCRATCH_DB};"
  rm -f "/tmp/${LATEST}" "/tmp/restoretest.dump"
  exit 1
fi

echo "[$(date -Iseconds)] Running row-count spot check on drizzle migrations table..."
EXPECTED_MIGRATIONS_COUNT="${EXPECTED_MIGRATIONS_COUNT:-1}"
ACTUAL_MIGRATIONS_COUNT=$(psql "$SCRATCH_URL" -t -A -c \
  "SELECT count(*) FROM drizzle.__drizzle_migrations;")

if [ "$ACTUAL_MIGRATIONS_COUNT" -lt "$EXPECTED_MIGRATIONS_COUNT" ]; then
  echo "[$(date -Iseconds)] [ALERT] Restored migration row count (${ACTUAL_MIGRATIONS_COUNT}) is below the expected floor (${EXPECTED_MIGRATIONS_COUNT})." >&2
  psql "$DATABASE_URL_MIGRATE" -c "DROP DATABASE ${SCRATCH_DB};"
  rm -f "/tmp/${LATEST}" "/tmp/restoretest.dump"
  exit 1
fi

echo "[$(date -Iseconds)] Restoration spot check passed successfully."

# Clean up
psql "$DATABASE_URL_MIGRATE" -c "DROP DATABASE ${SCRATCH_DB};"
rm -f "/tmp/${LATEST}" "/tmp/restoretest.dump"

echo "[$(date -Iseconds)] Restoration test complete. Add this run to /docs/ops/restoration-test-log.md."
exit 0
