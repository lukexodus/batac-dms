#!/bin/bash
# tools/scripts/ops/pg_dump_backup.sh
# Crontab on the production host:
#   0 0 * * *  /opt/batac/scripts/pg_dump_backup.sh >> /var/log/batac/pg-dump-backup.log 2>&1
set -e

if [ -f /opt/batac/scripts/backup-env ]; then
  source /opt/batac/scripts/backup-env
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
DUMP_FILE="/tmp/batac_${TIMESTAMP}.dump"
ENCRYPTED_FILE="${DUMP_FILE}.gpg"

echo "[$(date -Iseconds)] Starting pg_dump..."
if ! pg_dump "$DATABASE_URL_MIGRATE" -F custom -f "$DUMP_FILE"; then
  echo "[$(date -Iseconds)] [ALERT] pg_dump FAILED. No backup file produced for ${TIMESTAMP}." >&2
  rm -f "$DUMP_FILE"
  exit 1
fi

echo "[$(date -Iseconds)] Encrypting dump..."
gpg --batch --yes --passphrase "$BACKUP_ENCRYPTION_KEY" \
    --symmetric --cipher-algo AES256 \
    -o "$ENCRYPTED_FILE" "$DUMP_FILE"
rm -f "$DUMP_FILE"

echo "[$(date -Iseconds)] Uploading to S3..."
S3_ENDPOINT_ARG=""
if [ -n "$S3_BACKUP_ENDPOINT" ]; then
  S3_ENDPOINT_ARG="--endpoint-url $S3_BACKUP_ENDPOINT"
fi

if ! aws s3 cp "$ENCRYPTED_FILE" \
     "s3://${S3_BACKUP_BUCKET}/daily/$(basename "$ENCRYPTED_FILE")" \
     $S3_ENDPOINT_ARG; then
  echo "[$(date -Iseconds)] [ALERT] Upload FAILED for ${ENCRYPTED_FILE}. Local copy retained for manual recovery." >&2
  exit 1
fi
rm -f "$ENCRYPTED_FILE"

echo "[$(date -Iseconds)] Pruning backups older than ${BACKUP_RETENTION_DAYS_HOT:-30} days..."
set +e
aws s3 ls "s3://${S3_BACKUP_BUCKET}/daily/" $S3_ENDPOINT_ARG \
  | awk '{print $4}' \
  | while read -r f; do
      if [ -z "$f" ]; then continue; fi
      timestamp_str=$(echo "$f" | grep -oP '\d{8}T\d{6}Z')
      if [ -z "$timestamp_str" ]; then continue; fi
      formatted_date=$(echo "$timestamp_str" | sed -E 's/([0-9]{4})([0-9]{2})([0-9]{2})T([0-9]{2})([0-9]{2})([0-9]{2})Z/\1-\2-\3T\4:\5:\6Z/')
      file_epoch=$(date -d "$formatted_date" +%s 2>/dev/null)
      if [ -z "$file_epoch" ]; then continue; fi
      
      age_days=$(( ( $(date +%s) - file_epoch ) / 86400 ))
      if [ "$age_days" -gt "${BACKUP_RETENTION_DAYS_HOT:-30}" ]; then
        rm_output=$(aws s3 rm "s3://${S3_BACKUP_BUCKET}/daily/$f" $S3_ENDPOINT_ARG 2>&1)
        rm_status=$?
        if [ $rm_status -ne 0 ]; then
          if echo "$rm_output" | grep -Eiq "Object Lock|OBJECT_LOCK|AccessDenied|forbidden"; then
            echo "[$(date -Iseconds)] [INFO - Object Lock active, retention preserved] Object lock prevented deletion of $f."
          else
            echo "[$(date -Iseconds)] [ALERT] Failed to delete $f: $rm_output" >&2
            exit 1
          fi
        else
          echo "[$(date -Iseconds)] Pruned old backup: $f"
        fi
      fi
    done
loop_status=$?
set -e

if [ $loop_status -ne 0 ]; then
  exit $loop_status
fi

echo "[$(date -Iseconds)] Backup complete: ${TIMESTAMP}"
