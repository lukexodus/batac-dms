# ADR-IAC-003 — Immutable Cold Backup Copy: Backblaze B2 with Object Lock

**Status:** Decided
**Date:** June 2026
**Resolves:** L5 §8.2 (Immutable Cold-Backup Copy), the S3 bucket lifecycle/object-lock `[SPEC GAP]` flagged in `a1-tasks/infra.md` TASK-INFRA-016 and TASK-INFRA-017, and Open Items §13.6
**Domain:** Infrastructure as Code (L5), Backup / DR (L4)

---

## Context

The consolidated reference §11.14 (Disaster Recovery and Backup) requires:

> "At least one cold copy in write-once (object lock) storage; 1-year cold retention."

DigitalOcean Spaces, chosen for live-document storage (ADR-IAC-002, L5 §8.1), does not support S3 Object Lock as of the time this document was written. `[Unverified]` — the team should verify this constraint remains current before provisioning, since provider feature sets do change; check DigitalOcean's current Spaces documentation. If Object Lock has been added to Spaces since this was written, the B2 second provider is no longer required and this ADR should be revisited.

A second cloud provider is therefore needed for the immutable backup tier only. `a1-tasks/infra.md` TASK-INFRA-016 and TASK-INFRA-017 both flagged this as `[SPEC GAP]` because no loaded document specified the exact S3 lifecycle rule JSON or object-lock retention-mode configuration. This ADR closes that gap.

---

## Decision

**Use Backblaze B2 as the sole destination for the immutable cold-backup bucket (`S3_BACKUP_BUCKET`), with Object Lock enabled at bucket creation.**

---

## Rationale

### 1. Native S3 Object Lock (WORM) support

Backblaze B2 supports S3-compatible Object Lock in "Governance" and "Compliance" modes. Object Lock is configured at bucket creation — it cannot be retroactively enabled on an existing bucket. The Pulumi program must create the bucket with Object Lock enabled from the first `pulumi up` (see §Consequences below).

**Compliance mode** is selected as the default retention mode because it satisfies the "write-once" requirement in the strictest sense: no user (including root credentials) can delete or overwrite objects before the retention period expires. Governance mode allows authorized users to bypass the lock, which is weaker than what the consolidated reference's "write-once storage" language implies.

### 2. S3 API compatibility

Backblaze B2 supports the S3-compatible API (`s3.us-west-004.backblazeb2.com` or the bucket-specific endpoint). The existing backup scripts (`pg_dump_backup.sh`, `base-backup-cron.sh`) use the `aws` CLI with `--endpoint-url` to target any S3-compatible endpoint — they require only a change in `S3_BACKUP_ENDPOINT`, `S3_BACKUP_ACCESS_KEY`, and `S3_BACKUP_SECRET_KEY` environment variables, not a code change. This is consistent with the S3-endpoint-swap agnosticism established for the live-document bucket.

### 3. Cost

Backblaze B2 is consistently among the lowest-cost S3-compatible object storage providers. Cold backup data (compressed, encrypted `pg_dump` files) grows slowly; the cost difference between B2 and AWS S3 or DigitalOcean Spaces (if it supported Object Lock) would be meaningful at scale but is minor at Phase 1 volumes. Cost is a secondary rationale; the primary is Object Lock support.

### 4. Region selection — `[Unverified]`

`[Unverified]` — Backblaze B2's available regions should be verified at provisioning time via the B2 web console or API. At the time of this writing, known B2 regions include US-West, EU-Central, and potentially additional APAC regions. Select the closest available region to `sgp1` (Singapore). If no APAC region is available, fall back to the US-West region — backup data is at-rest encrypted with AES-256 (GPG symmetric, `BACKUP_ENCRYPTION_KEY`), so the physical storage location is a latency concern, not a confidentiality one.

---

## Object Lock Configuration (Closing the SPEC GAP)

This section specifies the exact Object Lock and lifecycle configuration previously unspecified in any loaded document.

### Retention period

The consolidated reference §11.14 requires "1-year cold retention." Object Lock retention is therefore set to **365 days** from object creation, in **Compliance mode**.

### Pulumi resource

```typescript
// /infra/index.ts — excerpt for the B2 backup bucket
// One-time setup: pulumi package add terraform-provider backblaze/b2
import * as b2 from '@pulumi/b2'; // generated SDK name may differ — confirm after `pulumi package add`

const backupBucket = new b2.Bucket(`batac-backups-${stack}`, {
  bucketName: `batac-backups-${stack}`,
  bucketType: 'allPrivate',
  // Object Lock must be set at bucket-creation time — cannot be added later.
  // [Unverified] — confirm the generated `b2.Bucket` resource exposes a
  // `defaultRetention` or `objectLockEnabled` argument. If it does not,
  // enable Object Lock manually in the B2 web console when creating the bucket,
  // then `pulumi import` the bucket for ongoing management:
  //   pulumi import b2:index/bucket:Bucket batac-backups-production <bucket-id>
  // The manual Object Lock configuration in the B2 console:
  //   - Enable Object Lock: YES (cannot be reversed)
  //   - Default retention mode: COMPLIANCE
  //   - Default retention period: 365 days
});
```

If the Pulumi B2 provider does not expose Object Lock as a resource argument, the fallback is:

1. Create the bucket manually in the B2 web console with Object Lock enabled (Compliance mode, 365-day default retention).
2. `pulumi import` the bucket so Pulumi manages subsequent lifecycle-rule and policy changes.
3. Document the manual step in `./tools/ops/bootstrap-host.sh` (L5 §11) so future reprovisioning does not silently create a bucket without Object Lock.

### Application-side pruning (hot tier — 30-day window)

The hot-tier pruning in `pg_dump_backup.sh` (TASK-INFRA-017) deletes objects older than `BACKUP_RETENTION_DAYS_HOT` (default 30) using `aws s3 rm`. In Compliance Object Lock mode, this command will **fail** for any object within its 365-day retention window — this is the correct behavior. The intent is:

- Objects < 30 days old: retained by both the application pruning logic AND Object Lock.
- Objects 30–365 days old: the pruning script attempts deletion; Object Lock in Compliance mode blocks the deletion. The object is retained for the full 365-day period.
- Objects > 365 days old: Object Lock has expired; deletion by the pruning script succeeds.

The pruning script will log deletion failures for the 30–365 day objects. These failures are expected and should be treated as informational, not as errors requiring escalation. The implementation in TASK-INFRA-017 should add a log line distinguishing Object Lock rejections from other S3 errors. A simple check: if `aws s3 rm` exits non-zero AND the error message contains "Object Lock" or "OBJECT_LOCK", log as `[INFO - Object Lock active, retention preserved]` rather than `[ALERT]`.

---

## Consequences

- A Backblaze B2 account is required. **Account ownership: Lead Developer in collaboration with LGU IT Office** (confirmed 2026-06). The B2 application key (`backblazeKeyId` / `backblazeApplicationKey`) for the backup bucket is stored as a Pulumi config secret and also as a Docker secret (`./secrets/s3_backup_access_key.txt`, `./secrets/s3_backup_secret_key.txt`) on the production host. Key rotation is the responsibility of the Lead Developer.
- `S3_BACKUP_ENDPOINT` in L1's environment variable catalog points to the B2 bucket's S3-compatible endpoint (e.g., `https://s3.us-west-004.backblazeb2.com`). `S3_BACKUP_ACCESS_KEY` and `S3_BACKUP_SECRET_KEY` are the B2 application key credentials. These fields already exist in L1 as distinct from the live-document `S3_*` fields — no schema change is required.
- TASK-INFRA-016 and TASK-INFRA-017's `[SPEC GAP]` annotations regarding bucket lifecycle/object-lock are closed by this ADR. See the "Application-side pruning" section above for the expected behavior of `aws s3 rm` against an Object Lock-protected bucket.
- The B2 bucket must be created **with Object Lock enabled from the first `pulumi up`** (or first manual creation). Object Lock cannot be retroactively enabled. If the bucket already exists without Object Lock, it must be deleted and recreated (losing any existing backups in the bucket).

## Rejected alternatives

**DigitalOcean Spaces for the backup bucket as well:** Only one bucket provider is simpler operationally, but DigitalOcean Spaces does not support Object Lock — the "write-once storage" requirement cannot be met.

**AWS S3 with Object Lock:** Functionally equivalent to B2 for this use case, but more expensive and requires managing AWS IAM credentials in addition to DigitalOcean credentials. B2's S3-API compatibility means the backup scripts are identical; the only difference is the endpoint URL and credentials.
