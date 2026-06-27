#!/bin/bash
# tools/scripts/ops/base-backup-cron.sh
# Crontab entry on the production host (NOT inside the container):
#   0 2 * * 0  /opt/batac/scripts/base-backup-cron.sh >> /var/log/batac/pitr-backup.log 2>&1
# Schedule: weekly full base backup, Sunday 02:00 Asia/Manila.
set -e

source /opt/batac/scripts/wal-g-env

echo "[$(date -Iseconds)] Starting weekly base backup..."
if wal-g backup-push "$PGDATA"; then
  echo "[$(date -Iseconds)] Base backup succeeded."
else
  echo "[$(date -Iseconds)] [ALERT] Base backup FAILED. Escalate immediately — PITR coverage may have a gap." >&2
  exit 1
fi

echo "[$(date -Iseconds)] Pruning backups older than retention window..."
wal-g delete retain FULL 4 --confirm
