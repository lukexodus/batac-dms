# L4. Backup and DR Runbooks — Early-Dev

**Document:** L4
**Platform:** Batac City LGU Platform
**Status:** Pre-Production Baseline — must be reviewed and signed off before any production data is written
**Last Updated:** June 2026
**Audience:** Development team (authoring and initial testing); LGU IT Office (operational ownership from Production Rollout onward)
**Related documents:** C1 (Full Database Schema DDL), D5 (Deployment Diagram), L1 (Environment Catalog)

---

## Prerequisite: Conditions Before Production Rollout

These runbooks must be tested end-to-end in the staging environment before any production data is written. The development team holds authorship; the LGU IT Office holds operational ownership in production. No production credential is embedded in this document or in version control — all credentials are provisioned via the secrets vault (L1 §23) and, for break-glass purposes, the sealed physical envelope described in Runbook 6.

**Production Rollout gate — all boxes must be checked:**

- [ ] Runbook 1 (WAL PITR archiving) tested in staging; results logged in `docs/ops/staging-test-log.md`
- [ ] Runbook 2 (daily `pg_dump`) tested in staging; a successful upload and checksum verified
- [ ] Runbook 3 (streaming replication) tested in staging; lag verified ≤ 60 s under load
- [ ] Runbook 4 (monthly restoration) executed at least once against a staging backup
- [ ] Runbook 5 (quarterly DR drill) executed at least once in staging with minimum two team members
- [ ] Runbook 6 (break-glass envelope) prepared, sealed, logged into IT Office safe, and verified intact by IT Director
- [ ] DR runbooks committed and versioned in repository; confirmed readable by minimum two team members who can execute them independently

---

## Service Commitments

These are binding SLAs for the production environment. Every runbook in this document exists to protect them.

| Metric                         | Target                               | Source                            |
| ------------------------------ | ------------------------------------ | --------------------------------- |
| Recovery Time Objective (RTO)  | ≤ 4 hours                            | Consolidated reference Part 11.14 |
| Recovery Point Objective (RPO) | ≤ 1 hour                             | Consolidated reference Part 11.14 |
| Replication lag ceiling        | ≤ 60 seconds                         | D5 — WAL streaming replication    |
| Failover trigger threshold     | 60 seconds of primary heartbeat loss | D5 — failover behavior            |
| Hot backup retention           | 30 days                              | Consolidated reference Part 11.14 |
| Cold backup retention          | 1 year, write-once (object lock)     | Consolidated reference Part 11.14 |
| Restoration test frequency     | Monthly                              | Consolidated reference Part 11.14 |
| DR drill frequency             | Quarterly                            | Consolidated reference Part 11.14 |

---

## Architecture Reference

```
PostgreSQL Primary ─── WAL streaming (TCP) ──────────────► PostgreSQL Standby
       │                                                     (hot standby, lag ≤ 60 s)
       │
       ├── WAL archive (PITR) ─── HTTPS / S3 API ──────────► Cloudflare R2 (Phase 1)
       │                                                          MinIO (on-premise path)
       └── daily pg_dump (encrypted) ─── HTTPS / S3 API ───► Cloudflare R2 / MinIO
```

**Three database roles (C1 §0.2):**

| Role | Env var | Purpose | Notes |
|---|---|---|---|
| `migrate_user` | `DATABASE_URL_MIGRATE` | DDL; schema migrations | Never used at application runtime |
| `app_user` | `DATABASE_URL_APP` | DML; SELECT/INSERT/UPDATE/DELETE | No access to `audit` schema |
| `audit_user` | `DATABASE_URL_AUDIT` | INSERT + SELECT on `audit` schema only | UPDATE/DELETE revoked explicitly |

**Object storage environment variables:**

| Variable | Used by |
|---|---|
| `S3_ENDPOINT` | Application, backups; R2 Phase 1 → MinIO on-premise |
| `S3_BUCKET` | Application document file store |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Application + backup scripts |
| `S3_BACKUP_BUCKET` | WAL archive + `pg_dump` (separate bucket; object versioning enabled) |
| `S3_COLD_BUCKET` | Monthly dumps retained 1 year; write-once object lock (COMPLIANCE mode) |
| `BACKUP_ENCRYPTION_KEY` | AES-256-CBC key for `pg_dump` encryption; held in secrets vault + break-glass envelope |

---

## Runbook 1 — WAL-Based PITR Archiving Configuration

### 1.1 Purpose

Continuous Write-Ahead Log archiving to S3-compatible storage enables Point-in-Time Recovery (PITR). This is the primary mechanism for meeting the 1-hour RPO. It provides recovery to any point within the retention window, not just the previous daily snapshot.

### 1.2 Tools Required

| Tool | Purpose | Installed on |
|---|---|---|
| `wal-g` v2.x or later | WAL push/fetch, base backup, S3 upload, encryption | PostgreSQL Primary container |
| `aws` CLI v2 | Bucket setup and verification only | PostgreSQL host or ops workstation |
| `psql` | Verification queries; matches PostgreSQL server version | Any network-accessible host |

Verify `wal-g` is installed:

```bash
wal-g --version
# Expected: wal-g version 2.x.x
```

### 1.3 Backup Bucket Setup

WAL archives use a **separate** S3 bucket (`S3_BACKUP_BUCKET`) from the document file store (`S3_BUCKET`). This bucket requires S3 versioning and object lock enabled at creation time — both are immutable bucket settings that cannot be applied retroactively.

For Cloudflare R2, configure via the R2 dashboard. For MinIO:

```bash
# Create the backup bucket with object locking
mc mb --with-lock minio/${S3_BACKUP_BUCKET}

# Enable versioning
mc version enable minio/${S3_BACKUP_BUCKET}

# Verify
mc ls --recursive minio/${S3_BACKUP_BUCKET}
```

For the cold storage bucket (`S3_COLD_BUCKET`), set a default object lock configuration of COMPLIANCE mode for 365 days. This prevents deletion — even by the bucket owner — for 1 year.

### 1.4 `wal-g` Environment Configuration

Place in `/etc/wal-g/environment` on the PostgreSQL host (mounted as a Docker secret in production — never baked into the image). These values must never appear in version control.

```bash
# S3-compatible target (Cloudflare R2 or MinIO)
WALG_S3_PREFIX=s3://${S3_BACKUP_BUCKET}/wal-archive
AWS_ACCESS_KEY_ID=${S3_ACCESS_KEY}
AWS_SECRET_ACCESS_KEY=${S3_SECRET_KEY}
AWS_ENDPOINT_URL=${S3_ENDPOINT}
AWS_REGION=auto

# Encryption (libsodium symmetric key, 32 bytes hex-encoded)
# Generate once: openssl rand -hex 32
# Store the output in the secrets vault AND in the break-glass envelope.
# Never store it in this file directly — load at runtime from the vault.
WALG_LIBSODIUM_KEY=<32-byte hex key loaded from secrets vault at runtime>

# Compression
WALG_COMPRESSION_METHOD=lz4

# Upload/download concurrency
WALG_UPLOAD_CONCURRENCY=2
WALG_DOWNLOAD_CONCURRENCY=4

# PostgreSQL connection (migrate_user; WAL push requires a superuser or replication privilege)
PGHOST=localhost
PGPORT=5432
PGUSER=migrate_user
PGDATABASE=batac_production
```

### 1.5 PostgreSQL Configuration Changes

Edit `postgresql.conf`. Changes to `wal_level` and `archive_mode` require a server restart — schedule a maintenance window before enabling these for the first time.

```ini
# WAL level — must be 'replica' or higher for streaming replication + archiving
wal_level = replica

# Archiving
archive_mode = on
archive_command = 'wal-g wal-push %p >> /var/log/postgresql/walg_archive.log 2>&1'
archive_timeout = 60           # Force a new WAL segment every 60 s (supports ≤ 1 h RPO)

# Standby / sender settings (also used by streaming replication — Runbook 3)
hot_standby = on
max_wal_senders = 5
wal_keep_size = 1024           # Keep 1 GB of WAL locally as a buffer if S3 is briefly slow
wal_sender_timeout = 60s

# Checkpoint tuning
checkpoint_timeout = 15min
checkpoint_completion_target = 0.9
max_wal_size = 4GB
```

After editing, reload without restart (for `archive_command` only):

```bash
docker exec -it batac_postgres_primary \
  psql -U migrate_user -c "SELECT pg_reload_conf();"
```

Restart when changing `wal_level` or `archive_mode`:

```bash
docker restart batac_postgres_primary
# Wait for primary to accept connections before restarting standby
docker restart batac_postgres_standby
```

### 1.6 Initial Base Backup

The first base backup establishes the PITR starting point. Run immediately after archiving is confirmed active.

```bash
# Push base backup to S3 (runs as the postgres OS user or migrate_user)
wal-g backup-push ${PGDATA}

# Verify upload succeeded
wal-g backup-list
```

Expected output:

```
name                           last_modified          wal_segment_backup_start
base_000000010000000000000001  2026-06-18T02:00:00Z   000000010000000000000001
```

If this command hangs or errors, check `/var/log/postgresql/walg_archive.log` for the underlying S3 error before proceeding.

### 1.7 Scheduling Recurring Base Backups

A daily base backup reduces PITR recovery time by shortening the WAL segment replay chain. Schedule as a cron job on the database host for independence from application availability.

```bash
# /etc/cron.d/walg-base-backup
# 02:00 Asia/Manila (UTC+8 → 18:00 UTC previous day)
0 18 * * * postgres \
  /usr/local/bin/wal-g backup-push ${PGDATA} \
  >> /var/log/postgresql/walg_base_backup.log 2>&1
```

### 1.8 Verifying the Archive Is Active

Run after configuration and daily after the first backup is expected:

```bash
# Confirm recent WAL segments are landing in S3
wal-g wal-verify timeline

# Check the most recent base backup is not stale
wal-g backup-list DETAIL | head -5
```

Set a Sentry alert (via the Fastify health-check endpoint) if `wal-g backup-list` shows the most recent backup is older than 26 hours.

### 1.9 Retention — Hot and Cold

Hot retention (30 days): delete older backups weekly.

```bash
# Keep base backups newer than 30 days; prune the rest
wal-g delete retain FULL 30 --confirm

# Run weekly, Sunday 03:00 Asia/Manila (19:00 UTC Saturday)
0 19 * * 0 postgres \
  /usr/local/bin/wal-g delete retain FULL 30 --confirm \
  >> /var/log/postgresql/walg_delete.log 2>&1
```

Cold retention (1 year, write-once): before pruning, copy the first base backup of each month to `S3_COLD_BUCKET`. Object lock in the cold bucket prevents deletion for 365 days even by an administrator.

```bash
#!/usr/bin/env bash
# Run on the 2nd of each month, before the weekly prune job.
# Copy the oldest base backup (from the start of last month) to cold storage.
OLDEST_KEY=$(wal-g backup-list | tail -1 | awk '{print $1}')

aws s3 cp \
  "s3://${S3_BACKUP_BUCKET}/wal-archive/basebackups_005/${OLDEST_KEY}" \
  "s3://${S3_COLD_BUCKET}/monthly-wal/${OLDEST_KEY}" \
  --recursive \
  --endpoint-url "${S3_ENDPOINT}"
```

### 1.10 PITR Recovery — Step by Step

Use when a target restore point is needed (for example, recovering deleted data). For full server failure, use the standby failover path in Runbook 3.6 instead.

```bash
# Step 1: Stop the primary to prevent further writes during recovery.
# For an in-place recovery: stop first, then restore on the same PGDATA.
# For a parallel check before committing: restore to a fresh host first.
docker stop batac_postgres_primary

# Step 2: Fetch the most recent base backup into a fresh PGDATA directory.
export PGDATA_RECOVERY=/var/lib/postgresql/data_recovery
rm -rf ${PGDATA_RECOVERY}
wal-g backup-fetch ${PGDATA_RECOVERY} LATEST

# Step 3: Write recovery configuration (PostgreSQL 12+).
cat >> ${PGDATA_RECOVERY}/postgresql.conf <<'EOF'
restore_command = 'wal-g wal-fetch %f %p'
recovery_target_time = '2026-06-18 10:30:00+08'    # ← adjust to the desired recovery point
recovery_target_action = 'promote'
EOF

touch ${PGDATA_RECOVERY}/recovery.signal

# Step 4: Start PostgreSQL in recovery mode.
# It will replay WAL segments from S3 until it reaches recovery_target_time.
PGDATA=${PGDATA_RECOVERY} docker run \
  --env-file /etc/wal-g/environment \
  -v ${PGDATA_RECOVERY}:/var/lib/postgresql/data \
  postgres:16

# Watch the log:
docker logs -f batac_postgres_recovery
# Look for: "recovery stopping before commit of transaction ... at 2026-06-18 10:30:00+08"
# Then: "database system is ready to accept connections"

# Step 5: Verify the recovered data against expectations, then either:
#   (a) promote this instance to replace the failed primary, or
#   (b) extract the specific data needed and restore to the production primary.

# Step 6: Log the PITR event in docs/ops/pitr-log.md (date, target time,
# data affected, reason, verified by, resolved at).
```

---

## Runbook 2 — Daily Encrypted `pg_dump` to S3

### 2.1 Purpose

A daily `pg_dump` provides a second, independently verifiable backup alongside the WAL archive. It is the recovery option when the WAL chain is broken or unavailable, and it is the source for monthly restoration tests (Runbook 4). Belt-and-suspenders: both backups must succeed nightly.

### 2.2 Backup Script

Save as `/opt/batac/scripts/pg_dump_backup.sh` on the PostgreSQL host. Owned by `postgres`, mode `700`. This script must never be readable by `app_user` or `audit_user`.

```bash
#!/usr/bin/env bash
# L4 Runbook 2 — Daily encrypted pg_dump
# Called by cron as the postgres OS user.
# All credentials arrive via environment variables — never hardcoded here.
set -euo pipefail

TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DB_NAME="batac_production"
DUMP_FILE="/tmp/batac_dump_${TIMESTAMP}.dump"
ENC_FILE="${DUMP_FILE}.enc"
S3_KEY="daily-dumps/${TIMESTAMP}/batac_dump.dump.enc"
CHECKSUM_KEY="daily-dumps/${TIMESTAMP}/SHA256SUMS"
LOG_PREFIX="[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [pg_dump_backup]"

log() { echo "${LOG_PREFIX} $*"; }
die() { echo "${LOG_PREFIX} ERROR: $*" >&2; exit 1; }

log "Starting — timestamp: ${TIMESTAMP}"

# ── Step 1: Dump in custom format (compressed; restores with pg_restore --jobs) ──
pg_dump \
  --format=custom \
  --compress=9 \
  --dbname="${DATABASE_URL_MIGRATE}" \
  --file="${DUMP_FILE}" \
  || die "pg_dump failed"

DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
log "Dump complete — unencrypted size: ${DUMP_SIZE}"

# ── Step 2: Encrypt with AES-256-CBC, PBKDF2, 600 000 iterations ──
# BACKUP_ENCRYPTION_KEY is loaded from the secrets vault at cron call time
# (see §2.3). It must be a minimum of 32 printable ASCII characters.
openssl enc -aes-256-cbc \
  -pbkdf2 -iter 600000 \
  -pass "env:BACKUP_ENCRYPTION_KEY" \
  -in "${DUMP_FILE}" \
  -out "${ENC_FILE}" \
  || die "Encryption failed"

log "Encryption complete"

# ── Step 3: Upload encrypted dump to S3-compatible backup bucket ──
aws s3 cp "${ENC_FILE}" "s3://${S3_BACKUP_BUCKET}/${S3_KEY}" \
  --endpoint-url "${S3_ENDPOINT}" \
  --storage-class STANDARD \
  || die "S3 upload failed"

log "Upload complete — s3://${S3_BACKUP_BUCKET}/${S3_KEY}"

# ── Step 4: Verify object is readable (head-object returns 200) ──
aws s3api head-object \
  --bucket "${S3_BACKUP_BUCKET}" \
  --key "${S3_KEY}" \
  --endpoint-url "${S3_ENDPOINT}" > /dev/null \
  || die "Upload verification failed — object not readable after upload"

log "S3 upload verified"

# ── Step 5: Compute SHA-256 checksum and upload as sidecar ──
SHA256=$(sha256sum "${ENC_FILE}" | awk '{print $1}')
log "SHA-256: ${SHA256}"

echo "${SHA256}  batac_dump.dump.enc" | \
  aws s3 cp - "s3://${S3_BACKUP_BUCKET}/${CHECKSUM_KEY}" \
  --endpoint-url "${S3_ENDPOINT}" \
  || die "Checksum sidecar upload failed"

# ── Step 6: Clean up local temp files ──
rm -f "${DUMP_FILE}" "${ENC_FILE}"

log "Cleanup complete"
log "Backup succeeded — key: ${S3_KEY} — dump size: ${DUMP_SIZE} — SHA-256: ${SHA256}"
```

### 2.3 Schedule

```bash
# /etc/cron.d/batac-daily-dump
# 03:00 Asia/Manila daily (UTC+8 → 19:00 UTC previous day)
# Runs 1 hour after the wal-g base backup job (02:00) to avoid I/O contention.
0 19 * * * postgres \
  BACKUP_ENCRYPTION_KEY="$(cat /run/secrets/backup_encryption_key)" \
  DATABASE_URL_MIGRATE="${DATABASE_URL_MIGRATE}" \
  S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET}" \
  S3_ENDPOINT="${S3_ENDPOINT}" \
  AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY}" \
  AWS_SECRET_ACCESS_KEY="${S3_SECRET_KEY}" \
  /opt/batac/scripts/pg_dump_backup.sh \
  >> /var/log/batac/pg_dump_backup.log 2>&1
```

A Sentry alert fires if the log shows no successful completion for more than 26 hours. The Fastify health-check endpoint reads the most recent completion timestamp from a file the script writes on success (`/var/run/batac/last_dump_success`).

### 2.4 Retention Policy

Hot retention (30 days): run daily, immediately after the new backup is uploaded.

```bash
#!/usr/bin/env bash
# /opt/batac/scripts/pg_dump_prune.sh
# Deletes daily-dumps/ prefixes older than 30 days.
CUTOFF=$(date -u -d "30 days ago" +"%Y%m%d")

aws s3 ls "s3://${S3_BACKUP_BUCKET}/daily-dumps/" \
  --endpoint-url "${S3_ENDPOINT}" \
  | awk '{print $2}' \
  | while read -r prefix; do
      DUMP_DATE=$(echo "${prefix}" | grep -oE '[0-9]{8}' | head -1)
      if [[ -n "${DUMP_DATE}" && "${DUMP_DATE}" < "${CUTOFF}" ]]; then
        echo "Pruning: daily-dumps/${prefix}"
        aws s3 rm "s3://${S3_BACKUP_BUCKET}/daily-dumps/${prefix}" \
          --recursive \
          --endpoint-url "${S3_ENDPOINT}"
      fi
    done
```

Cold retention (1 year): on the 2nd of each month, before the prune job, copy the first-of-month dump to `S3_COLD_BUCKET`. The object lock (COMPLIANCE, 365 days) on that bucket prevents deletion even by the bucket administrator.

```bash
#!/usr/bin/env bash
# /opt/batac/scripts/pg_dump_cold_copy.sh  — run on the 2nd of each month
FIRST_OF_MONTH=$(date -u -d "last month" +"%Y%m01")

FIRST_KEY=$(aws s3 ls "s3://${S3_BACKUP_BUCKET}/daily-dumps/" \
  --endpoint-url "${S3_ENDPOINT}" \
  | awk '{print $2}' \
  | grep "^${FIRST_OF_MONTH}" \
  | head -1)

if [[ -n "${FIRST_KEY}" ]]; then
  aws s3 cp \
    "s3://${S3_BACKUP_BUCKET}/daily-dumps/${FIRST_KEY}" \
    "s3://${S3_COLD_BUCKET}/monthly-dumps/${FIRST_KEY}" \
    --recursive \
    --endpoint-url "${S3_ENDPOINT}"
  echo "Cold copy complete: ${FIRST_KEY}"
else
  echo "WARNING: No dump found for ${FIRST_OF_MONTH} — cold copy skipped" >&2
  exit 1
fi
```

### 2.5 Decryption (Used in Restoration — See Runbook 4)

```bash
# Verify checksum before decryption — if this fails, stop and escalate
sha256sum -c SHA256SUMS
# Expected: batac_dump.dump.enc: OK

# Decrypt
openssl enc -aes-256-cbc \
  -d -pbkdf2 -iter 600000 \
  -pass "env:BACKUP_ENCRYPTION_KEY" \
  -in batac_dump.dump.enc \
  -out batac_dump.dump

# Restore to target database (4 parallel workers)
pg_restore \
  --format=custom \
  --dbname="postgresql://migrate_user:<pw>@<target_host>/<target_db>" \
  --jobs=4 \
  --verbose \
  batac_dump.dump \
  2>&1 | tee restore_output.log
```

---

## Runbook 3 — Streaming Replication Setup and Lag Monitoring

### 3.1 Purpose

The hot standby is the fastest recovery path for primary server failure. It must be continuously synchronized (lag ≤ 60 s) and promotable within the 4-hour RTO. This runbook covers initial setup, ongoing monitoring, and the failover procedure.

### 3.2 Initial Setup — Primary

Run once, before the standby is provisioned.

```bash
# Step 1: Create the replication user on the primary
docker exec -it batac_postgres_primary \
  psql -U migrate_user -c "
    CREATE ROLE replicator
      WITH LOGIN REPLICATION
      PASSWORD '<strong-password-store-in-vault>';
  "

# Step 2: Allow replication connections in pg_hba.conf
# Replace <standby_ip> with the actual private IP of the standby host.
echo "host replication replicator <standby_ip>/32 scram-sha-256" \
  >> ${PGDATA}/pg_hba.conf

# Step 3: Reload pg_hba.conf (no restart required)
docker exec -it batac_postgres_primary \
  psql -U migrate_user -c "SELECT pg_reload_conf();"
```

Confirm `postgresql.conf` on the primary already has (from Runbook 1, §1.5):

```ini
wal_level = replica
max_wal_senders = 5
wal_keep_size = 1024
wal_sender_timeout = 60s
hot_standby = on
```

### 3.3 Initial Setup — Standby

Run once when provisioning the standby, and again after any DR drill that rebuilds the standby from scratch.

```bash
# Step 1: Stop the standby container if running; clear its PGDATA.
docker stop batac_postgres_standby 2>/dev/null || true
rm -rf ${PGDATA_STANDBY}/*

# Step 2: Stream a base backup from the primary into the standby's PGDATA.
# This may take several minutes for a large database.
pg_basebackup \
  --host=<primary_ip> \
  --port=5432 \
  --username=replicator \
  --pgdata=${PGDATA_STANDBY} \
  --wal-method=stream \
  --checkpoint=fast \
  --progress \
  --verbose

# Step 3: Configure the standby (PostgreSQL 12+ — no recovery.conf file).
cat >> ${PGDATA_STANDBY}/postgresql.conf <<EOF
hot_standby = on
primary_conninfo = 'host=<primary_ip> port=5432 user=replicator \
  password=<password> application_name=batac_standby sslmode=require'
# Fallback: replay from WAL archive if the streaming connection is briefly broken
restore_command = 'wal-g wal-fetch %f %p'
EOF

# Mark this instance as a standby (PostgreSQL 12+)
touch ${PGDATA_STANDBY}/standby.signal

# Step 4: Start the standby.
docker start batac_postgres_standby
```

Wait 60 seconds, then run the verification queries in §3.4.

### 3.4 Verifying Replication Is Active

Run on the **primary** as `migrate_user`:

```sql
SELECT
    application_name,
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state
FROM pg_stat_replication;
```

Expected healthy output:

```
 application_name | client_addr | state     | replay_lag  | sync_state
------------------+-------------+-----------+-------------+------------
 batac_standby    | 10.0.0.11   | streaming | 00:00:00.08 | async
```

If `state` is `startup` or `catchup`, the standby is still replaying history — wait and retry. If `state` is absent or the row is missing, check `pg_hba.conf` and network connectivity between primary and standby.

Run on the **standby** to confirm it is receiving and replaying:

```sql
SELECT
    now() - pg_last_xact_replay_timestamp() AS replication_lag,
    pg_is_in_recovery()                      AS is_standby;
-- Expected: lag ~ a few milliseconds; is_standby = t
```

If `pg_last_xact_replay_timestamp()` returns `NULL`, no transactions have been replayed yet. Check `pg_stat_wal_receiver` on the standby for connection errors:

```sql
SELECT * FROM pg_stat_wal_receiver;
```

### 3.5 Lag Monitoring

Replication lag must stay ≤ 60 seconds. The Fastify health-check process runs the following query every 30 seconds and emits alerts accordingly.

```sql
-- Run on primary as app_user (read-only view; no DML needed)
SELECT
    application_name,
    EXTRACT(EPOCH FROM replay_lag)::integer AS lag_seconds,
    CASE
        WHEN EXTRACT(EPOCH FROM replay_lag) > 60 THEN 'ALERT'
        WHEN EXTRACT(EPOCH FROM replay_lag) > 30 THEN 'WARN'
        ELSE 'OK'
    END AS lag_status
FROM pg_stat_replication
WHERE application_name = 'batac_standby';
```

**Alert routing on `lag_status = 'ALERT'`:**

1. Pino structured log at `error` level — collected by log aggregator
2. Sentry event at `warning` level (error if lag > 120 s)
3. In-app SSE notification to Platform Administrator and IT Admin roles
4. If lag exceeds 300 s (5 minutes): page the IT Admin on-call by phone

Common causes of lag spikes: sustained write burst on primary; S3 slowness affecting `restore_command` fallback; network congestion between primary and standby. Investigate the standby's `pg_stat_wal_receiver.last_msg_receipt_time` first.

### 3.6 Failover Procedure — Unplanned Standby Promotion

Use when the primary is irrecoverably down. For planned maintenance failover, follow the same steps but stop the primary deliberately in Step 1 and skip the reachability checks.

**Split-brain rule (read before acting):** Never promote a standby while there is any possibility the primary is still running and accepting writes. A split-brain scenario produces two diverging databases and is worse than extended downtime. Physically stop or power off the primary before promoting the standby if there is any doubt.

```bash
# ── Step 1: Confirm the primary is truly unreachable ──────────────────────────
# Check from both the standby server AND from an independent network location.
psql -h <primary_ip> -U migrate_user \
  -c "SELECT 1;" 2>&1 \
  && echo "Primary still reachable — do NOT promote yet" \
  || echo "Primary unreachable — proceed"

# If possible, explicitly stop the primary to eliminate split-brain risk:
ssh <primary_host> "docker stop batac_postgres_primary" 2>/dev/null || true

# ── Step 2: Check the standby's current replay position ──────────────────────
docker exec -it batac_postgres_standby \
  psql -U migrate_user -c "
    SELECT pg_last_xact_replay_timestamp(),
           now() - pg_last_xact_replay_timestamp() AS lag_at_promotion;
  "
# Record lag_at_promotion — this is the data loss window. Must be < 1 hour (RPO).

# ── Step 3: Promote the standby to primary ───────────────────────────────────
docker exec -it batac_postgres_standby \
  su postgres -c "pg_ctl promote -D ${PGDATA_STANDBY}"

# Alternative (if pg_ctl is unavailable in the container):
# docker exec -it batac_postgres_standby psql -U migrate_user -c "SELECT pg_promote();"

# ── Step 4: Confirm promotion ─────────────────────────────────────────────────
docker exec -it batac_postgres_standby \
  psql -U migrate_user -c "SELECT pg_is_in_recovery();"
# Expected: f  (false = now acting as primary)

# ── Step 5: Update DNS to point to the promoted host ─────────────────────────
# The DNS A record for the database hostname must be changed to <standby_ip>.
# Keep DNS TTL ≤ 60 s on the DB DNS entry so propagation is fast.
# Record the exact time DNS was updated.

# ── Step 6: Restart the Fastify application to force reconnection ─────────────
docker restart batac_fastify

# ── Step 7: Verify the application is healthy ─────────────────────────────────
curl -f https://<app_domain>/api/health
# Expected: {"status":"ok"}

# ── Step 8: Log the failover event in the audit system ───────────────────────
# The application will emit a system event; confirm it appears in audit.events.
docker exec -it batac_postgres_standby \
  psql -U audit_user -c "
    SELECT * FROM audit.events
    WHERE event_type LIKE '%failover%' OR event_type LIKE '%promote%'
    ORDER BY occurred_at DESC LIMIT 5;
  "

# ── Step 9: Rebuild a new standby from the promoted primary (§3.3) ────────────
# Start this immediately after the application is confirmed stable.
# Target: new standby synchronized within 2 hours.
```

### 3.7 Failover Checklist

| # | Action | Actor | Completed at |
|---|---|---|---|
| 1 | Primary unreachable from ≥ 2 independent sources | IT Admin | |
| 2 | Primary process stopped or confirmed dead | IT Admin | |
| 3 | Standby replay lag at promotion recorded | IT Admin | |
| 4 | Lag at promotion < 1 hour (RPO satisfied) | IT Admin | |
| 5 | `pg_ctl promote` executed on standby | IT Admin | |
| 6 | `pg_is_in_recovery()` returns `f` | IT Admin | |
| 7 | DNS updated to promoted host IP | IT Admin | |
| 8 | `batac_fastify` restarted | IT Admin | |
| 9 | Application health check passes | Developer on call | |
| 10 | SP Secretary and Platform Admin notified of service restoration | IT Admin | |
| 11 | Audit log entry confirmed for failover event | Developer on call | |
| 12 | Rebuild of new standby started (Runbook 3.3) | IT Admin | |

---

## Runbook 4 — Monthly Restoration Test Procedure

### 4.1 Purpose

A backup that has not been tested is not a backup. This procedure verifies that the daily encrypted `pg_dump` can be decrypted, restored to a test environment, and produces data that matches production expectations. It does not test WAL PITR recovery — that is covered in Runbook 5 (DR drill, Phase 4).

**Frequency:** Once per calendar month, on the first working Tuesday after the 1st.
**Environment:** Dedicated restoration test host — never restore to the production or staging environment.
**Estimated duration:** 3–4 hours including queries and log entry.
**Participants:** One person runs; one person witnesses and co-signs the test log entry.

### 4.2 Pre-Test Checklist

| Check | Owner |
|---|---|
| Restoration test environment is available and its database is empty or expendable | Developer |
| `BACKUP_ENCRYPTION_KEY` is available in the test environment's secrets vault | IT Admin |
| The target daily dump was confirmed uploaded (check S3 listing) | Developer |
| No production maintenance window conflicts | IT Admin |
| Two team members are available for the full duration | Both |

### 4.3 Identify the Backup to Test

```bash
# List recent daily dumps; pick the most recent successful one.
aws s3 ls "s3://${S3_BACKUP_BUCKET}/daily-dumps/" \
  --endpoint-url "${S3_ENDPOINT}" \
  | sort | tail -5

# Note the full prefix, e.g.:
RESTORE_PREFIX="20260618T190000Z"
RESTORE_KEY="daily-dumps/${RESTORE_PREFIX}/batac_dump.dump.enc"
CHECKSUM_KEY="daily-dumps/${RESTORE_PREFIX}/SHA256SUMS"
```

### 4.4 Restoration Steps

```bash
# ── Step 1: Download encrypted dump and checksum sidecar ─────────────────────
aws s3 cp "s3://${S3_BACKUP_BUCKET}/${RESTORE_KEY}" ./batac_dump.dump.enc \
  --endpoint-url "${S3_ENDPOINT}"

aws s3 cp "s3://${S3_BACKUP_BUCKET}/${CHECKSUM_KEY}" ./SHA256SUMS \
  --endpoint-url "${S3_ENDPOINT}"

# ── Step 2: Verify checksum BEFORE decryption ─────────────────────────────────
sha256sum -c SHA256SUMS
# Expected: batac_dump.dump.enc: OK
#
# If FAILED: stop immediately. Do not decrypt. Do not restore.
# Escalate to IT Director — possible corruption or tampering.
# File a break-glass log entry if the issue cannot be explained within 1 hour.

# ── Step 3: Decrypt ───────────────────────────────────────────────────────────
openssl enc -aes-256-cbc \
  -d -pbkdf2 -iter 600000 \
  -pass "env:BACKUP_ENCRYPTION_KEY" \
  -in batac_dump.dump.enc \
  -out batac_dump.dump

echo "Decrypted dump size: $(du -sh batac_dump.dump | cut -f1)"

# ── Step 4: Create a clean test database ─────────────────────────────────────
psql -h <test_host> -U migrate_user -c "
  DROP DATABASE IF EXISTS batac_restoration_test;
  CREATE DATABASE batac_restoration_test;
"

# ── Step 5: Restore ───────────────────────────────────────────────────────────
pg_restore \
  --format=custom \
  --dbname="postgresql://migrate_user:<pw>@<test_host>/batac_restoration_test" \
  --jobs=4 \
  --verbose \
  batac_dump.dump \
  2>&1 | tee restore_output.log

echo "Restore exit code: $?"

# ── Step 6: Check restore output for errors ──────────────────────────────────
grep -icE 'error|fatal' restore_output.log \
  && echo "ERRORS FOUND — review restore_output.log before proceeding" \
  || echo "No errors detected in restore output"
```

### 4.5 Post-Restoration Verification Queries

Run on the test database. Compare counts against the most recent figures in the production audit log or from the previous month's restoration test log.

```sql
-- 1. All 8 Phase 1 schemas present
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name IN (
  'iam','organization','documents','workflow',
  'tracking','records','notifications','audit'
)
ORDER BY schema_name;
-- Expected: exactly 8 rows

-- 2. Key table row counts (compare to prior month's test log)
SELECT 'iam.users'              AS tbl, COUNT(*) AS n FROM iam.users           WHERE deleted_at IS NULL
UNION ALL
SELECT 'documents.documents'   ,        COUNT(*)       FROM documents.documents WHERE deleted_at IS NULL
UNION ALL
SELECT 'workflow.instances'    ,        COUNT(*)       FROM workflow.instances  WHERE deleted_at IS NULL
UNION ALL
SELECT 'audit.events'          ,        COUNT(*)       FROM audit.events;

-- 3. Most recent document — should be within 26 hours of backup start time
SELECT
  MAX(created_at)                                           AS latest_document_at,
  now() AT TIME ZONE 'Asia/Manila' - MAX(created_at)       AS age
FROM documents.documents;

-- 4. Numbering series sanity — confirm sequences are present
SELECT series_key, is_active
FROM documents.number_series
ORDER BY series_key;
-- Expected: 11 rows (10 Phase 1 + 1 panlalawigan_review_log)

-- 5. Audit log chain integrity
-- Call the application's chain-verify endpoint against the test DB.
-- If the application cannot be pointed at the test DB, verify manually:
SELECT
  id,
  chain_hash,
  occurred_at
FROM audit.events
ORDER BY occurred_at DESC
LIMIT 20;
-- Visually confirm chain_hash values are non-null and uniform length (HMAC-SHA-256 = 64 hex chars — ADR-B2-2)
```

### 4.6 Recording the Test Result

Complete a new entry in `docs/ops/restoration-test-log.md` in the repository. Both the runner and the witness must sign.

```markdown
## Restoration Test — YYYY-MM-DD

| Field | Value |
|---|---|
| Date | |
| Backup tested (S3 prefix) | `daily-dumps/YYYYMMDDTHHMMSSZ/` |
| Backup nominal production timestamp | |
| Download completed at | |
| Checksum verified | YES / NO |
| Decryption succeeded | YES / NO |
| Restore completed without pg_restore errors | YES / NO |
| Schema count | _ / 8 |
| `iam.users` count | |
| `documents.documents` count | |
| `audit.events` count | |
| Most recent document `created_at` | |
| Age of most recent document at restore time | |
| Audit chain spot check | PASSED / FAILED / NOT RUN |
| Total elapsed time (download → verification complete) | |
| Conducted by | |
| Witnessed by | |
| Issues noted | |
| Follow-up action items | |
```

If any item is FAILED or the row count differs from the previous test by more than 10% without a known cause, raise an incident with IT Admin and IT Director before the next business day.

---

## Runbook 5 — Quarterly DR Drill Procedure

### 5.1 Purpose

The quarterly DR drill validates the full end-to-end recovery path: primary failure, standby promotion, DNS failover, application reconnection, and PITR spot check. It also confirms that the two designated team members can execute the failover under pressure without reading the runbook for the first time.

**Frequency:** Once per quarter. Target weeks: March (Q1), June (Q2), September (Q3), December (Q4).
**Window:** Saturday 08:00–12:00 Asia/Manila, when legislative session activity is lowest.
**Minimum participants:** One developer (application layer) + one LGU IT Admin (infrastructure layer). Both must complete the drill — it cannot be executed solo.
**Advance notice:** SP Secretary, Mayor's Office IT liaison, and Platform Administrator — at least 5 working days before the drill.

### 5.2 Pre-Drill Checklist

| Check | Owner | Due |
|---|---|---|
| Stakeholder notification sent (SP Secretary, Mayor's Office, Platform Admin) | IT Admin | D-5 working days |
| Maintenance window confirmed with SP Secretary | IT Admin | D-3 working days |
| Standby replication lag is < 60 s at drill start | IT Admin | Drill morning |
| Most recent `wal-g` base backup is < 26 hours old | Developer | Drill morning |
| Most recent daily `pg_dump` is < 26 hours old | Developer | Drill morning |
| Break-glass envelope is in the IT Office safe and seal is intact (do not open) | IT Admin | Drill morning |
| Drill participant phones exchanged (in case of split locations) | Both | Drill morning |
| `docs/ops/dr-drill-log.md` open and ready for recording | Both | 08:00 |

### 5.3 Drill Phases and Steps

All times relative to the declared failover trigger (T=0). Recorder notes actual clock time for each event.

**Phase 1 — Simulated Primary Failure (T+0 to T+15 min)**

```bash
# T+0: Declare drill start. Both participants note the wall-clock time.
# Record: DRILL_START=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Simulate primary failure by stopping the primary container.
docker stop batac_postgres_primary
# Record: PRIMARY_STOPPED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Confirm primary is unreachable from the application host.
psql -h <primary_ip> -U migrate_user -c "SELECT 1;" 2>&1
# Expected: connection refused or timeout

# Confirm primary is unreachable from a second location (developer's machine or standby host).
# This satisfies the split-brain prevention rule.
```

**Phase 2 — Standby Promotion (T+15 to T+30 min)**

```bash
# Record the standby's replay position at promotion time.
docker exec -it batac_postgres_standby \
  psql -U migrate_user -c "
    SELECT
      pg_last_xact_replay_timestamp()             AS last_replayed_at,
      now() - pg_last_xact_replay_timestamp()     AS lag_at_promotion;
  "
# Record both values. lag_at_promotion must be < 1 hour (RPO). If > 1 hour, escalate and
# halt the drill — the RPO target is at risk and root cause must be found before re-drilling.

# Promote the standby.
docker exec -it batac_postgres_standby \
  su postgres -c "pg_ctl promote -D ${PGDATA_STANDBY}"
# Record: STANDBY_PROMOTED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Confirm promotion.
docker exec -it batac_postgres_standby \
  psql -U migrate_user -c "SELECT pg_is_in_recovery();"
# Expected: f
```

**Phase 3 — Application Reconnection (T+30 to T+60 min)**

```bash
# Update DNS A record for the database hostname to the promoted standby's IP.
# Record: DNS_UPDATED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Restart Fastify to force immediate reconnection to the new primary.
docker restart batac_fastify
# Record: FASTIFY_RESTARTED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Health check — retry every 10 seconds for up to 5 minutes.
for i in $(seq 1 30); do
  curl -sf https://<app_domain>/api/health && break
  echo "Attempt ${i} — waiting..."; sleep 10
done
# Record: HEALTH_OK=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Application smoke test: log in as the test SP Secretary account and
# confirm the dashboard loads and shows the correct document queue.
# Record: DASHBOARD_OK=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

**Phase 4 — PITR Spot Check (T+60 to T+90 min)**

On the restoration test host only — not on production. This confirms the WAL archive can recover to a point 2 hours before drill start, demonstrating the ≤ 1-hour RPO capability.

```bash
# Calculate target recovery time: 2 hours before drill start.
TARGET_TIME=$(date -u -d "2 hours ago" +'%Y-%m-%d %H:%M:%S+08')

# Follow Runbook 1 §1.10, using TARGET_TIME for recovery_target_time.
# Confirm PostgreSQL reaches "ready to accept connections" after WAL replay.
# Record: PITR_VERIFIED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

**Phase 5 — Rebuild New Standby (T+90 to T+150 min)**

Restore normal topology. The promoted standby is now the primary. A new standby must be built from it.

```bash
# Provision or re-use the old primary host as the new standby.
# Follow Runbook 3.3 entirely.
# Record: NEW_STANDBY_SYNCED=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Verify lag on the new primary:
docker exec -it batac_postgres_primary \
  psql -U migrate_user -c "
    SELECT application_name, replay_lag FROM pg_stat_replication;
  "
# Expected: lag < 60 s
```

**Phase 6 — Close and Record (T+150 to T+180 min)**

Confirm all systems are in steady state, record the drill log entry, and shred any physical notes containing credentials.

### 5.4 Timing Targets and Pass/Fail

| Milestone | Target from T+0 | Status |
|---|---|---|
| Primary confirmed unreachable | T+5 min | |
| Standby promoted | T+15 min | |
| Lag at promotion < 60 min (RPO) | At promotion time | |
| DNS updated | T+25 min | |
| Health check passes | T+40 min | |
| SP Secretary dashboard accessible | T+60 min | |
| PITR spot check passes | T+90 min | |
| New standby synchronized (lag < 60 s) | T+150 min | |
| Full RTO (all services operational) | T+240 min max | |

If RTO exceeds 4 hours during any drill, halt and file a P1 incident report before the next business day. Do not mark the drill as passed. The root cause must be resolved and documented before the following quarter's drill.

### 5.5 Drill Log Entry

Complete in `docs/ops/dr-drill-log.md`. Both participants must sign.

```markdown
## DR Drill — YYYY-MM-DD

| Field | Value |
|---|---|
| Date | |
| Quarter | Q1 / Q2 / Q3 / Q4 |
| Participants | Developer: ___  IT Admin: ___ |
| T+0 (drill start) | |
| Standby lag at T+0 | |
| Primary stopped at | |
| Standby promoted at | |
| Lag at promotion | |
| RPO satisfied (< 1 h) | YES / NO |
| DNS updated at | |
| Health check passed at | |
| Dashboard accessible at | |
| PITR spot check passed | YES / NO |
| New standby synced at | |
| Drill end (all steady) | |
| Total elapsed | |
| RTO met (≤ 4 hours) | YES / NO |
| Break-glass envelope seal confirmed intact | YES / NO |
| Issues observed | |
| Action items and owners | |
| Signed by (Developer) | |
| Signed by (IT Admin) | |
```

---

## Runbook 6 — Break-Glass Procedure

### 6.1 Purpose

The break-glass envelope is the last-resort access mechanism for the production system when all normal credential access paths fail — secrets vault unavailable, key holders unreachable, or a time-critical emergency requiring direct database access.

**Non-negotiable boundary:** The development team has zero access to production data at all times (consolidated reference Part 11.20). The break-glass envelope is sealed and held exclusively by the LGU IT Office. The development team may assist remotely with commands or queries, but the IT Admin in possession of the open envelope executes all actions and sees all credentials.

### 6.2 Envelope Contents

The sealed envelope contains one printed sheet only. The printed document lists the following items:

| Item | Description |
|---|---|
| `DATABASE_URL_MIGRATE` | Full production connection string for `migrate_user` (DDL; emergency schema access) |
| `DATABASE_URL_APP` | Full production connection string for `app_user` (application runtime role) |
| `DATABASE_URL_AUDIT` | Full production connection string for `audit_user` (audit schema access) |
| `replicator` password | PostgreSQL streaming replication credential |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Cloudflare R2 (Phase 1) or MinIO production credentials |
| `S3_ENDPOINT` | Production S3 endpoint URL |
| `S3_BUCKET` | Application document file bucket name |
| `S3_BACKUP_BUCKET` | Backup and WAL archive bucket name |
| `S3_COLD_BUCKET` | Cold-retention (object lock) bucket name |
| `BACKUP_ENCRYPTION_KEY` | AES-256-CBC key for `pg_dump` decryption |
| `WALG_LIBSODIUM_KEY` | `wal-g` encryption key for PITR archive |
| Docker host SSH key or sudo password | For direct server access to the PostgreSQL and Fastify hosts |
| Emergency contact list | City IT Director phone + personal; SP Secretary phone; on-call developer phone |
| Sealed date | Date the envelope was last sealed and the name of the person who sealed it |

The contents are printed — not stored on any digital medium at the time of sealing. The envelope is sealed with tamper-evident security tape. The sealed envelope is stored in the LGU IT Office safe.

### 6.3 Who May Authorize Opening

Opening requires verbal or written authorization from at least **one** of:

| Role | Name (update at Production Rollout) | Contact |
|---|---|---|
| City IT Director | [Confirmed at Production Rollout] | [Phone] |
| SP Secretary | Gladys R. Lagura | [Phone from staff directory] |
| Platform Administrator | [Designated at Production Rollout] | [Phone] |

If none of the above are reachable within 30 minutes of a critical emergency, the Mayor or Vice Mayor may authorize opening as a last resort. This must be documented in the log entry.

### 6.4 Opening Procedure

```
Step 1.  The IT Admin on duty determines that normal credential access has
         failed and that the emergency cannot be resolved by other means.
         Documents the trigger event with timestamp.

Step 2.  The IT Admin contacts one of the authorized roles listed in §6.3.
         States clearly:
           (a) what the system issue is,
           (b) why normal credentials are unavailable,
           (c) which specific credential(s) are needed.
         The authorizer confirms verbally (phone), by SMS, or by email.
         Record: authorizer name, contact method used, time of authorization,
         and the exact words of authorization (e.g. "I authorize opening the
         break-glass envelope to restore database access").

Step 3.  The IT Admin opens the IT Office safe and retrieves the sealed
         envelope.

Step 4.  BEFORE opening: photograph the intact envelope showing the
         tamper-evident tape and the outer label. The photo must be
         timestamped. Upload to the secure IT Office shared drive immediately.

Step 5.  Open the envelope. Use only the minimum credentials required
         for the immediate incident. Do not transcribe or photograph
         the contents — read from the page as needed.

Step 6.  Write the following entry in the Physical Break-Glass Log
         (a bound, numbered notebook kept in the IT Office safe alongside
         the envelope):

           Opening number:         [sequential, never reused]
           Date and time opened:
           Opened by (name + role):
           Authorized by (name + role):
           Authorization method:
           Reason for opening:
           Credentials actually used:
           Incident declared resolved at:
           Credentials to be rotated by:
           New envelope to be sealed by:

Step 7.  Write an audit log entry in the application's audit system with
         event_type = 'break_glass.opened' as soon as the application is
         available. Include the same fields as Step 6. If the application
         is offline, write the entry within 1 hour of it coming back online.

Step 8.  Notify the City IT Director (if not the authorizer) by phone that
         the break-glass envelope was opened, the reason, and the time.

Step 9.  After the incident is resolved, close the Physical Break-Glass Log
         entry with the resolution time and a brief description of the outcome.
         Shred the printed credential sheet using a cross-cut shredder.
         Do not leave the opened envelope or any loose paper in the safe.

Step 10. Rotate all credentials listed in §6.2 within 24 hours (see §6.5).
         Print and seal a new envelope within 24 hours of credential rotation.
```

### 6.5 Credential Rotation After Opening

Every credential in §6.2 must be rotated after any break-glass opening, in the order below, to ensure the old credentials are invalid before the new envelope is sealed.

```bash
# 1. Rotate PostgreSQL user passwords (run as migrate_user from the secrets vault)
psql -d batac_production -c "ALTER ROLE migrate_user WITH PASSWORD '<new-password>';"
psql -d batac_production -c "ALTER ROLE app_user    WITH PASSWORD '<new-password>';"
psql -d batac_production -c "ALTER ROLE audit_user  WITH PASSWORD '<new-password>';"
psql -d batac_production -c "ALTER ROLE replicator  WITH PASSWORD '<new-password>';"

# 2. Rotate S3/R2 API credentials via the Cloudflare R2 dashboard or MinIO
#    admin console. Revoke the old key AFTER the new key is confirmed working.

# 3. Rotate BACKUP_ENCRYPTION_KEY and WALG_LIBSODIUM_KEY
#    Generate new keys:
openssl rand -hex 32   # for BACKUP_ENCRYPTION_KEY
openssl rand -hex 32   # for WALG_LIBSODIUM_KEY
#    Update secrets vault. Update /etc/wal-g/environment on the DB host.
#    Re-run one backup with the new key to confirm it works before sealing the envelope.

# 4. Rotate Docker host SSH key or sudo password.

# 5. Update all rotated credentials in the secrets vault.

# 6. Update DATABASE_URL_* in the application environment and restart Fastify.
docker restart batac_fastify
curl -f https://<app_domain>/api/health

# 7. Verify streaming replication is still active after password rotation.
docker exec -it batac_postgres_primary \
  psql -U migrate_user -c "SELECT application_name, replay_lag FROM pg_stat_replication;"
```

After all credentials are rotated and tested: follow §6.6 to print and seal a new envelope.

### 6.6 Sealing a New Envelope

```
Step 1.  Print the credential document (§6.2 template) on a single sheet
         of white paper using the IT Office printer. Verify every field
         against the updated secrets vault before printing.

Step 2.  Read the document once to confirm no field is missing or incorrect.

Step 3.  Fold the sheet and place in a new plain opaque envelope.

Step 4.  Seal the envelope flap with tamper-evident security tape.
         Initial or date across the tape seal so any removal is visible.

Step 5.  Write on the outer face of the envelope:
           "Batac City LGU Platform — Production Break-Glass Credentials"
           "Sealed: [DATE] by [FULL NAME]"
           "Authorized to open: City IT Director | SP Secretary | Platform Administrator"
           "See Physical Break-Glass Log for opening history"

Step 6.  Place the sealed envelope in the IT Office safe. Log the sealing
         event in the Physical Break-Glass Log:
           Sealed date:
           Sealed by:
           Triggered by: [routine quarterly review / post-opening rotation / personnel change]

Step 7.  Shred the printer's internal memory/cache if the printer stores
         recent print jobs. Cross-cut shred any trial prints, the old
         credential sheet, and any paper that touched the credential content.

Step 8.  Clear terminal history, clipboard, and any temporary files used
         during the printing and rotation process:
           history -c && history -w
```

### 6.7 Envelope Replacement Schedule

| Trigger | Action | Deadline |
|---|---|---|
| After any break-glass opening | Rotate all credentials; print and seal new envelope | Within 24 hours of resolution |
| After any secrets vault credential rotation | Print and seal new envelope | Within 24 hours |
| Quarterly DR drill (Runbook 5) | Visually verify seal integrity; do not open | During drill pre-check |
| Personnel change — IT Director or Platform Admin leaves | Rotate credentials; print and seal new envelope | Before departing person's last day |
| Annual credential rotation (January) | Full credential rotation + new envelope | January 15 |

### 6.8 Quarterly Seal Verification (Without Opening)

During the quarterly DR drill pre-check, one authorized role physically confirms:
- The envelope is present in the safe
- The tamper-evident seal is intact and unmarked
- The date on the outer label is consistent with the last known sealing event

Record in the drill log: "Break-glass envelope seal confirmed intact: YES/NO — verified by [name]." No opening is required or permitted for this check.

---

## Appendix A — Alert Summary

| Alert | Trigger | Recipient | Channels |
|---|---|---|---|
| Replication lag exceeded | `replay_lag > 60 s` on primary | IT Admin, Platform Admin | Pino error log, Sentry warning, SSE notification |
| Replication lag critical | `replay_lag > 300 s` (5 min) | IT Admin | Sentry error + phone call |
| Daily dump missing | No successful dump in S3 for > 26 h | IT Admin | Pino error log, Sentry error |
| WAL archive stale | `wal-g backup-list` most recent > 26 h | IT Admin | Pino error log, Sentry error |
| Primary heartbeat loss | No TCP response for 60 s | IT Admin | Infrastructure monitoring alert + phone |
| Break-glass envelope opened | `break_glass.opened` audit event | IT Director, SP Secretary, Platform Admin | Audit log SSE notification |
| Checksum mismatch (monthly restore) | `sha256sum -c` fails during Runbook 4 | IT Director, Developer | Immediate phone call |
| PITR base backup > 26 h old | wal-g health check job | IT Admin, Developer | Pino error log, Sentry error |

---

## Appendix B — Key Contacts

| Role | Responsibility | Name / Contact |
|---|---|---|
| City IT Director | Break-glass authorizer; DR drill co-signer; post-incident review within 5 working days | [Confirmed at Production Rollout] |
| LGU IT Admin (on-call) | Executes all runbooks in production; holds physical break-glass envelope access | [Confirmed at Production Rollout] |
| SP Secretary | Break-glass authorizer; stakeholder notification on service disruption | Gladys R. Lagura |
| Platform Administrator | Break-glass authorizer; receives in-app alerts | [Designated at Production Rollout] |
| Developer (on-call) | Remote assistance for runbook execution; application-layer recovery; runbook authorship | [Development team contact] |

---

## Appendix C — Operational Calendar

| Task | Frequency | Months / Trigger | Owner |
|---|---|---|---|
| Monthly restoration test | Monthly | First working Tuesday after the 1st | IT Admin + Developer |
| Quarterly DR drill | Quarterly | March, June, September, December | IT Admin + Developer |
| Break-glass seal verification | Quarterly | Same week as DR drill | IT Admin |
| `wal-g` delete (hot retention prune) | Weekly | Sunday 03:00 Asia/Manila | Cron (automated) |
| Monthly cold copy to write-once bucket | Monthly | 2nd of each month | Cron (automated) |
| Annual credential rotation | Annually | January 15 | IT Director + IT Admin |
| Cold storage verification (confirm objects readable) | Annually | January | IT Admin |
| Year-boundary sequence pre-provisioning (`documents.fn_get_next_sequence_value`) | Annually | December 15 (before year rollover) | Developer |
| DR runbook review and update | After any drill, incident, or infrastructure change | As triggered | Developer + IT Admin |

---

## Appendix D — Document Maintenance

This document is the authoritative operational reference. After each of the following events, update this document and commit to the repository before closing the change:

- Any DR drill that reveals a timing gap, missing step, or tool version change
- Any production incident that exercises one of these runbooks
- Any infrastructure change (new provider, new PostgreSQL major version, migration from Cloudflare R2 to MinIO)
- Annual review in January alongside the credential rotation

The printed, signed copy in the IT Office constitutes the offline operational version. If the repository copy and the printed copy diverge, the repository copy is authoritative for procedure; the IT Director must approve printing a new copy and replacing the old one.

---

*This document is part of the L-series pre-development reference set. Version-controlled in the repository at `docs/ops/l4-backup-dr-runbooks.md`. Must exist and be tested before any production data is written.*
