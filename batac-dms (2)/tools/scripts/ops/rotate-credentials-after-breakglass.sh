#!/bin/bash
# tools/scripts/ops/rotate-credentials-after-breakglass.sh
#
# Generates and rotates passwords for the core service accounts
# (batac_app, batac_audit, and batac_migrate) after a break-glass incident.
#
# Requirements:
#   - Generates 32-character base64 secure passwords.
#   - Prints credentials ONLY to stdout for manual transcription.
#   - Never writes them to a file or log.
#
# Usage:
#   ./tools/scripts/ops/rotate-credentials-after-breakglass.sh
#
# Requires:
#   - DB_HOST (default: localhost)
#   - DB_PORT (default: 5432)
#   - PGUSER (default: postgres)
#   - PGPASSWORD (must be set in environment)

set -euo pipefail

# Ensure we're not logging the script execution with set -x
set +x

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
PGUSER="${PGUSER:-postgres}"

if [ -z "${PGPASSWORD:-}" ]; then
  echo "Error: PGPASSWORD environment variable must be set for the admin user." >&2
  exit 1
fi

echo "=========================================================================="
echo " BREAK-GLASS CREDENTIAL ROTATION"
echo "=========================================================================="
echo "Generating new secure credentials..."

# Generate new passwords
NEW_APP_PASSWORD=$(openssl rand -base64 32)
NEW_AUDIT_PASSWORD=$(openssl rand -base64 32)
NEW_MIGRATE_PASSWORD=$(openssl rand -base64 32)

echo "Applying new credentials to the database at ${DB_HOST}:${DB_PORT}..."

# We pass the queries via stdin to prevent them from showing in process lists.
psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${PGUSER}" -d postgres -v ON_ERROR_STOP=1 --no-psqlrc <<-EOSQL
  ALTER ROLE batac_app PASSWORD '${NEW_APP_PASSWORD}';
  ALTER ROLE batac_audit PASSWORD '${NEW_AUDIT_PASSWORD}';
  ALTER ROLE batac_migrate PASSWORD '${NEW_MIGRATE_PASSWORD}';
EOSQL

echo "=========================================================================="
echo " CREDENTIALS SUCCESSFULLY ROTATED"
echo "=========================================================================="
echo ""
echo "Please manually transcribe the following passwords into the corresponding"
echo "files in the ./secrets/ directory on the deployment host:"
echo ""
echo "batac_app     : ${NEW_APP_PASSWORD}"
echo "batac_audit   : ${NEW_AUDIT_PASSWORD}"
echo "batac_migrate : ${NEW_MIGRATE_PASSWORD}"
echo ""
echo "=========================================================================="
echo " WARNING: THESE PASSWORDS HAVE NOT BEEN SAVED TO DISK."
echo " YOU MUST COPY THEM NOW BEFORE CLOSING THIS TERMINAL."
echo "=========================================================================="
