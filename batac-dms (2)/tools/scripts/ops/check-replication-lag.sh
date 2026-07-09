#!/bin/bash
# tools/scripts/ops/check-replication-lag.sh
# Usage: ./check-replication-lag.sh [max-allowed-seconds, default 60]
set -e
MAX_LAG="${1:-60}"

LAG_SECONDS=$(docker compose -f compose.prod.yml exec -T postgres-standby \
  psql -U postgres -t -A -c \
  "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))::int;")

# Handle null/empty result if standby hasn't replayed anything yet
if [ -z "$LAG_SECONDS" ]; then
  LAG_SECONDS=0
fi

echo "Replication lag: ${LAG_SECONDS}s (threshold: ${MAX_LAG}s)"

if [ "$LAG_SECONDS" -gt "$MAX_LAG" ]; then
  echo "[ALERT] Replication lag (${LAG_SECONDS}s) exceeds threshold (${MAX_LAG}s)." >&2
  exit 1
fi
exit 0
