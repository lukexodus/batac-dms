# L5 — Infrastructure as Code Specification

**Status:** Baseline — all open items resolved (see §13 Resolved Items Log). Three accompanying ADRs: `ADR-IAC-001` (tool choice), `ADR-IAC-002` (cloud provider), `ADR-IAC-003` (immutable backup). **Project Phase:** Pre-Development — Iteration 3 (Post-Interview 2 + Developer Decisions Resolved) **Last Updated:** June 2026 **Audience:** Development team; LGU IT Office (post-delivery reference)

This document specifies the infrastructure-as-code layer that provisions the
compute, networking, DNS, and object-storage substrate that L2's Docker
Compose files (`compose.yml`, `compose.prod.yml`) and L4's backup/DR runbooks
run on top of. It does **not** cover application deployment (handled by
`TASK-INFRA-014`'s CI/CD jobs) or the Docker Compose service definitions
themselves (L2) — only the cloud resources those containers need to exist on.

Per the sourcing convention established across this docset:
unmarked statements are confirmed decisions; `[Inference]` is a reasoned
synthesis; `[Unverified]` is a claim — usually about a third-party tool's
current behavior — that was checked but not exhaustively confirmed;
`[SPEC GAP]` is something left for human resolution. Three ADRs accompany
this document (`l5-infrastructure-as-code-specification-adrs/`); their
resolutions are summarized inline where relevant and not repeated in full.

---

## Table of Contents

- [L41–L73] 1. Scope and Non-Goals — Definement of what cloud resources are provisioned and explicit out-of-scope items.
- [L74–L83] 2. Tool Choice — Pulumi (TypeScript) — Decision to use Pulumi and TypeScript for infrastructure definition and tooling integration.
- [L84–L89] 3. Cloud Provider — DigitalOcean (`sgp1`) — Confirmed DigitalOcean sgp1 region for primary compute and live storage.
- [L90–L122] 4. Project Structure — Directory structure and configuration files for staging and production stacks.
- [L123–L128] 5. State Management — Rationale and confirmation of Pulumi Cloud free tier for state storage.
- [L129–L201] 6. Compute — Sizing, provisioning, and two-host topology for staging and production hosts.
- [L202–L250] 7. Networking — VPC and firewall rules restricting inbound access to ports 22, 80, and 443.
- [L251–L313] 8. Object Storage — Configuration of live storage on DigitalOcean and immutable cold-backups on Backblaze B2.
- [L314–L340] 9. Block Storage — Provisioning of a separate block storage volume for PostgreSQL data persistence.
- [L341–L370] 10. DNS — Setup of staging and production subdomains under batac.gov.ph and DNS delegation.
- [L371–L410] 11. Secrets Handling in IaC vs. at Runtime — Separation of Pulumi config secrets from application runtime secrets.
- [L411–L425] 12. Relationship to the CI/CD Pipeline (L3 / `TASK-INFRA-013`/`014`) — Separation of infrastructure runs from continuous application deployments.
- [L426–L438] 13. Resolved Items Log — Final dispositions and log of all resolved infrastructure open items.

---

## 1. Scope and Non-Goals

**In scope:**

- Compute provisioning: one Droplet (VPS) per environment (staging,
  production).
- Networking: a private VPC per environment, a Cloud Firewall restricting
  inbound traffic to the ports L2's `nginx` service actually uses.
- DNS: A-records for the application domain, pointing at each environment's
  Droplet.
- Object storage: the live-document bucket (`S3_BUCKET`) and the immutable
  cold-backup bucket (`S3_BACKUP_BUCKET`) — two different providers, per
  ADR-IAC-003.
- Block storage: a separate volume for the PostgreSQL data directory,
  decoupled from the Droplet's boot disk.
- Pulumi project structure, stack configuration, and state-backend choice.

**Explicitly out of scope (`[Inference]`, stated for clarity, not
contradicting any source):**

- Deploying application code or running `docker compose up -d` — that
  remains `TASK-INFRA-014`'s SSH-based CI job. Infrastructure changes
  (this document) and application deployments (L3/L4) are deliberately
  decoupled: the former is infrequent and high-blast-radius; the latter
  happens on every merge to `main`.
- Kubernetes, managed PostgreSQL, managed container platforms, or any
  multi-region/multi-cloud topology — all ruled out elsewhere in this
  project (consolidated ref Part 9/10; `j5-initial-adrs/ADR-GEN-001`) as
  inappropriate for this team size and user count.
- The on-premise deployment path (D5) — it runs on LGU-owned hardware with
  no cloud provider involved, by definition, and is not provisioned by this
  document.

---

## 2. Tool Choice — Pulumi (TypeScript)

**Resolved — ADR-IAC-001.** This project's infrastructure is written as a
Pulumi program in TypeScript, not Terraform/HCL. See the ADR for full
rationale; in summary: the entire stack is already TypeScript, and Pulumi
shares the same lint/typecheck/format tooling already built in
`TASK-INFRA-001`.

---

## 3. Cloud Provider — DigitalOcean (`sgp1`)

**Resolved — ADR-IAC-002.** DigitalOcean, region `sgp1` (Singapore), is the confirmed provider for compute, networking, and the live-document object store. The decision satisfies the geographic proximity requirement for Philippines-based users, aligns with the project's operating budget, and preserves cloud agnosticism at the application layer (the application connects via S3-compatible APIs and standard PostgreSQL connection strings, not DigitalOcean-specific SDKs). See ADR-IAC-002 for full rationale, data-residency considerations, and the legal clearance action item that the LGU IT Office must complete before production data is written.

---

## 4. Project Structure

```
/infra
├── Pulumi.yaml                 # Project definition (name, runtime: nodejs)
├── Pulumi.staging.yaml         # Stack config: staging
├── Pulumi.production.yaml     # Stack config: production
├── package.json                # @batac/infra workspace package
├── tsconfig.json                # extends @batac/config/tsconfig.base.json
└── index.ts                     # Program entry point
```

`/infra` is added as a new workspace member, alongside the existing `apps/*`,
`packages/*`, `tools/*` globs (`pnpm-workspace.yaml`, originally written in
`TASK-INFRA-001`) — `[Inference]`: add `infra` as an explicit fourth glob entry
(or fold it under `tools/*` by renaming to `/tools/infra` — naming is a
free choice at implementation time; this document uses `/infra` for
brevity and because it is conceptually distinct from build/ops tooling).

`Pulumi.yaml`:

```yaml
name: batac-infra
runtime: nodejs
description: Cloud infrastructure for the Batac City LGU Platform
```

Two stacks — `staging` and `production` — each with their own DigitalOcean
region/size/domain configuration and their own DigitalOcean API token,
stored as encrypted Pulumi config secrets (`pulumi config set --secret
digitalocean:token`), never committed in plaintext.

---

## 5. State Management

**Confirmed.** Pulumi Cloud's free tier (app.pulumi.com) is the state backend. It provides locking, history, and encrypted secrets out of the box with zero additional infrastructure to bootstrap. The alternative — a self-managed state backend in a DigitalOcean Spaces bucket — creates a chicken-and-egg problem: the bucket that stores Pulumi's state would need to be hand-created outside Pulumi or provisioned by a second, separately-bootstrapped program. That is unnecessary complexity for a four-person team. Revisit only if Pulumi Cloud's free-tier limits become a real constraint.

---

## 6. Compute

**Two-host production topology confirmed — see §6.1.** Sizing below is a starting point for ~100–250 concurrent staff users (consolidated ref Part 9/10), not a load test result — re-evaluate after the first month of real usage.

| Host                     | Environment | Droplet size (slug) | vCPU | Memory | Services                                            |
| ------------------------ | ----------- | ------------------- | ---- | ------ | --------------------------------------------------- |
| Droplet A (app host)     | production  | `s-2vcpu-4gb`       | 2    | 4 GB   | `nginx`, `server`, `web-build`, `postgres-primary`  |
| Droplet B (standby host) | production  | `s-1vcpu-2gb`       | 1    | 2 GB   | `postgres-standby` only                             |
| Single Droplet           | staging     | `s-1vcpu-2gb`       | 1    | 2 GB   | All services (both postgres containers on one host) |

Image: the DigitalOcean Marketplace "Docker on Ubuntu" image (`[Unverified]`
exact current slug — confirm via `doctl compute image list-distribution` or
the DigitalOcean Marketplace listing at implementation time; do not assume
the slug below is still current) ships Docker and Docker Compose
pre-installed, removing a manual provisioning step:

```typescript
import * as digitalocean from '@pulumi/digitalocean';

const appHost = new digitalocean.Droplet(`batac-${stack}-app-host`, {
  region,
  size: dropletSize,
  image: 'docker-20-04', // [Unverified] — confirm current Marketplace slug
  vpcUuid: vpc.id,
  sshKeys: [deployKey.fingerprint],
  tags: [stack, 'app-host'],
});
```

### 6.1 Production Topology — Two-Host (Resolved)

**Resolved.** The two-Droplet production topology is confirmed to fully satisfy the consolidated reference's RTO (≤ 4 hours) and RPO (≤ 1 hour) commitments (§11.14). Running both `postgres-primary` and `postgres-standby` on the same host protects against software-level failure only — if the Droplet itself dies, the failover runbook has nothing to fail over to, defeating its purpose.

**Droplet A** (app host — `s-2vcpu-4gb`) runs the application stack:

```typescript
const appHost = new digitalocean.Droplet(`batac-${stack}-app`, {
  region,
  size: stack === 'production' ? 's-2vcpu-4gb' : 's-1vcpu-2gb',
  image: 'docker-20-04', // [Unverified] — confirm current Marketplace slug via `doctl compute image list-distribution` at provisioning time
  vpcUuid: vpc.id,
  sshKeys: [deployKey.fingerprint],
  tags: [stack, 'app-host'],
});
```

**Droplet B** (standby host — `s-1vcpu-2gb`, production only) runs only `postgres-standby`:

```typescript
// Production only — staging uses a single Droplet for cost efficiency
const standbyHost =
  stack === 'production'
    ? new digitalocean.Droplet(`batac-${stack}-standby`, {
        region,
        size: 's-1vcpu-2gb',
        image: 'docker-20-04', // [Unverified] — same slug as appHost
        vpcUuid: vpc.id,
        sshKeys: [deployKey.fingerprint],
        tags: [stack, 'standby-host'],
      })
    : undefined;
```

Both Droplets are in the same VPC (`10.10.0.0/24`, §7). Replication traffic between `postgres-primary` (Droplet A) and `postgres-standby` (Droplet B) traverses the private VPC network only — never the public internet.

**Compose file split for production:** `compose.prod.yml` as written in L2 Part 3 runs all services on a single host (correct for staging). For production, two separate compose invocations are needed:

- **Droplet A:** `compose.prod.yml` minus the `postgres-standby` service. `postgres-primary` must expose port 5432 on the VPC private interface (`${DB_PRIMARY_VPC_IP}:5432:5432`) so the standby can connect from Droplet B.
- **Droplet B:** A separate `compose.prod.standby.yml` containing only `postgres-standby`, with `POSTGRESQL_MASTER_HOST` set to Droplet A's private VPC IP (from the Pulumi stack output `appHost.ipv4AddressPrivate`), not the Docker service hostname.

`TASK-INFRA-012` must deliver both compose files (or a split mechanism equivalent to the above) as part of its deliverables. See also L2 Part 3's updated topology note and L4 Runbook 3 §3.2–§3.3.

---

## 7. Networking

```typescript
const vpc = new digitalocean.Vpc(`batac-${stack}-vpc`, {
  region,
  ipRange: '10.10.0.0/24',
});

const firewall = new digitalocean.Firewall(`batac-${stack}-firewall`, {
  dropletIds: [appHost.id],
  inboundRules: [
    {
      protocol: 'tcp',
      portRange: '22',
      sourceAddresses: sshAllowedCidrs, // Pulumi stack config variable — populate with LGU IT Office CIDRs before pulumi up; never 0.0.0.0/0 in production (see §7 note below)
    },
    { protocol: 'tcp', portRange: '80', sourceAddresses: ['0.0.0.0/0', '::/0'] },
    { protocol: 'tcp', portRange: '443', sourceAddresses: ['0.0.0.0/0', '::/0'] },
    { protocol: 'icmp', sourceAddresses: ['0.0.0.0/0', '::/0'] },
  ],
  outboundRules: [
    { protocol: 'tcp', portRange: '1-65535', destinationAddresses: ['0.0.0.0/0', '::/0'] },
    { protocol: 'udp', portRange: '1-65535', destinationAddresses: ['0.0.0.0/0', '::/0'] },
  ],
});
```

Only 22 (SSH, restricted), 80, and 443 are open inbound — matching exactly
what `nginx` in `compose.prod.yml` (`TASK-INFRA-012`) listens on. Port 3000
(the `server` container) is never exposed to this Firewall at all, consistent
with `TASK-INFRA-012`'s `127.0.0.1:3000:3000` loopback-only binding — the
Firewall is a second, independent layer enforcing the same boundary, not a
substitute for it.

**`sshAllowedCidrs` has no default and must be explicitly set before `pulumi up`.**

```bash
# Get your current egress IP (run on your development machine):
curl -s https://checkip.amazonaws.com
# e.g. → 203.0.113.42

# Set in the Pulumi stack config (example — add all developer IPs that need SSH):
pulumi config set --path 'sshAllowedCidrs[0]' '203.0.113.42/32'   # lead developer
# pulumi config set --path 'sshAllowedCidrs[1]' '<LGU_OFFICE_IP>/32'  # LGU IT Office if known
```

The Cloud Firewall is provisioned with this value by `pulumi up`. If your ISP changes your egress IP, use **DigitalOcean's Web Console** (accessible from the DigitalOcean dashboard — it bypasses the Cloud Firewall entirely via an authenticated in-browser terminal) to update `sshAllowedCidrs` and run `pulumi up` again. Never set `sshAllowedCidrs: ["0.0.0.0/0"]` in production.

---

## 8. Object Storage

### 8.1 Live Documents — DigitalOcean Spaces

```typescript
const documentsBucket = new digitalocean.SpacesBucket(`batac-documents-${stack}`, {
  region,
  acl: 'private',
});
```

This becomes `S3_ENDPOINT`/`S3_BUCKET` (`TASK-INFRA-002`/`003`) for the
corresponding environment. DigitalOcean Spaces' lack of Object Lock (§8.2)
does not matter here — this bucket holds the _live_, actively-read/written
document store, which is backed up separately (L4), not itself the
immutable copy.

### 8.2 Immutable Cold-Backup Copy — Backblaze B2

**Resolved — ADR-IAC-003.** DigitalOcean Spaces does not support Object Lock (`[Unverified]` — re-verify at provisioning time, since provider feature sets change). The consolidated reference's "write-once (object lock) storage" requirement (§11.14) is met with a **separate Backblaze B2 bucket** in Object Lock Compliance mode, 365-day retention.

```typescript
// One-time: pulumi package add terraform-provider backblaze/b2
import * as b2 from '@pulumi/b2'; // generated SDK name — confirm after `pulumi package add`

const backupBucket = new b2.Bucket(`batac-backups-${stack}`, {
  bucketName: `batac-backups-${stack}`,
  bucketType: 'allPrivate',
  // Object Lock must be enabled at bucket creation — cannot be added later.
  // [Unverified] — confirm the generated resource exposes a defaultRetention
  // argument. If it does not, enable Object Lock manually in the B2 web
  // console (Compliance mode, 365-day default retention), then:
  //   pulumi import b2:index/bucket:Bucket batac-backups-${stack} <bucket-id>
  // See ADR-IAC-003 for the full Object Lock specification, including the
  // expected behavior of `aws s3 rm` against Object-Lock-protected objects.
});
```

This becomes `S3_BACKUP_ENDPOINT` / `S3_BACKUP_ACCESS_KEY` / `S3_BACKUP_SECRET_KEY` (distinct fields in `TASK-INFRA-002`'s schema) — `TASK-INFRA-017`'s `pg_dump_backup.sh` requires no code change, only different credential values. See ADR-IAC-003 §Application-side pruning for the expected interaction between the pruning script's `aws s3 rm` calls and Object Lock retention.

### 8.3 Lifecycle Rules

`[Inference]` — closing the second half of the `[SPEC GAP]` `infra.md`
originally flagged (the bucket lifecycle/retention policy itself, as
distinct from Object Lock):

```typescript
const backupLifecycle = new digitalocean.SpacesBucketLifecycleRule? // N/A — see note below
```

`[SPEC GAP]` carried forward, narrowed: DigitalOcean's `SpacesBucket`
resource does support a `lifecycleRule` configuration block for the
_live-document_ bucket (expiration/transition by age), but that bucket has
no defined retention policy in any source document — documents are retained
per the (not-yet-generated) `RECORDS` module's retention-schedule logic, not
a blanket bucket-level expiration, so no lifecycle rule is written here for
`documentsBucket`. For the `backupBucket` (B2), retention is enforced by
Object Lock's own retention-period setting (§8.2) plus the _application-side_
pruning already in `TASK-INFRA-016`/`017` (`wal-g delete retain`, the `aws s3
rm` loop) — no additional bucket-level lifecycle rule is needed there either.
This narrows the original gap to just the Object Lock `[Unverified]` item
above; it does not leave a second, separate lifecycle-policy gap open.

---

## 9. Block Storage

```typescript
const postgresVolume = new digitalocean.Volume(`batac-${stack}-postgres-data`, {
  region,
  size: 50, // GiB — [Inference] starting point; resize after real usage data
  filesystemType: 'ext4',
});

const postgresVolumeAttachment = new digitalocean.VolumeAttachment(
  `batac-${stack}-postgres-data-attach`,
  { dropletId: appHost.id, volumeId: postgresVolume.id },
);
```

A separate block-storage volume — rather than the Droplet's boot disk — for
the PostgreSQL data directory means the database survives a Droplet rebuild
and can be resized independently of compute. `compose.prod.yml`
(`TASK-INFRA-012`) must mount this volume's device path (DigitalOcean
attaches volumes at a predictable `/dev/disk/by-id/...` path,
`[Unverified]` exact path — confirm at first provisioning) to wherever the
`postgres_primary_data` named volume's underlying storage driver expects it,
or bind-mount it directly in place of the named Docker volume — this wiring
detail is `[SPEC GAP]`, left for whoever first provisions production to
confirm against the actual attached device.

---

## 10. DNS

**Resolved.** The application domain is `batac.gov.ph`. URLs:

- Production: `dms.batac.gov.ph`
- Staging: `staging.dms.batac.gov.ph`

The preferred DNS management approach is nameserver delegation to DigitalOcean (or Cloudflare), which allows Pulumi to manage A-records automatically and enables automated TLS certificate renewal via ACME DNS-01 challenges:

```typescript
const appDomain = 'batac.gov.ph';

const domain = new digitalocean.Domain(`batac-domain`, { name: appDomain });

const aRecord = new digitalocean.DnsRecord(`batac-${stack}-a-record`, {
  domain: domain.id,
  type: 'A',
  name: stack === 'production' ? 'dms' : 'staging.dms',
  value: appHost.ipv4Address,
  ttl: 300, // Keep TTL low (5 min) to allow fast failover DNS updates
});
```

**Fallback — static A-record:** If the `.gov.ph` domain registry (administered by DICT) does not permit nameserver delegation to a commercial provider, the LGU IT Office configures A-records manually via the DICT DNS registry portal:

- `dms.batac.gov.ph` → Droplet A's public IPv4
- `staging.dms.batac.gov.ph` → staging Droplet's public IPv4

In the fallback case, the `digitalocean.Domain` and `digitalocean.DnsRecord` Pulumi resources are omitted from the stack (the domain is not imported into DigitalOcean DNS). TLS certificate renewal must then be handled via HTTP-01 challenge (Certbot `--webroot` or `--standalone`) rather than DNS-01. The LGU IT Office must confirm which DNS path applies before the first `pulumi up`.

---

## 11. Secrets Handling in IaC vs. at Runtime

Two separate secret-handling layers exist in this project, and they must not
be confused:

- **Pulumi config secrets** (`digitalocean:token`, the B2 application key,
  the SSH deploy key) — used only by `pulumi up`/`pulumi preview`, encrypted
  in Pulumi's state backend (§5), never written to any file in this repo.
- **Application runtime secrets** (`AUTH_JWT_ACCESS_SECRET`,
  `DATABASE_URL_APP`, etc.) — handled entirely by L2/L1's existing
  mechanism: the `./secrets/*.txt` files referenced in `compose.prod.yml`
  (`TASK-INFRA-012`) and Docker's native `secrets:` block, populated
  manually by the LGU IT Office per ADR-INF-006. Pulumi does not generate,
  see, or manage these — they remain entirely outside the IaC layer.

The only overlap: once Pulumi provisions the Droplet, _something_ must place the `./secrets/*.txt` files and the TLS certificate onto that host for the first time. **Resolved:** this is handled by `./tools/ops/bootstrap-host.sh`, a local script run once by the operator immediately after `pulumi up` completes and before the CI/CD pipeline's first deploy job runs.

```bash
# tools/ops/bootstrap-host.sh — run locally, once, after pulumi up
# Usage: ./tools/ops/bootstrap-host.sh <host-ip> <ssh-key-path>
# Copies secrets and TLS certificates to a freshly provisioned Droplet.
set -e
HOST="$1"
SSH_KEY="${2:-~/.ssh/id_ed25519}"

echo "Copying secrets to ${HOST}..."
ssh -i "$SSH_KEY" "root@${HOST}" "mkdir -p /opt/batac/secrets"
scp -i "$SSH_KEY" ./secrets/*.txt "root@${HOST}:/opt/batac/secrets/"

echo "Copying TLS certificates..."
# Assumes certificates are already obtained locally (e.g., via certbot or
# a manual CSR process with the .gov.ph registrar).
scp -i "$SSH_KEY" -r ./certs/ "root@${HOST}:/etc/letsencrypt/"

echo "Bootstrap complete. Run the CI deploy job to start containers."
```

This script runs on the operator's local machine, not in CI. It is a one-time step per freshly provisioned Droplet; subsequent secret updates use the same `scp` pattern manually, not automated CI. The script is committed to the repository (without actual secret values) as documentation of the handoff process.

---

## 12. Relationship to the CI/CD Pipeline (L3 / `TASK-INFRA-013`/`014`)

`pulumi up` is **not** part of the automated CI/CD pipeline. Infrastructure
changes are infrequent, high-blast-radius, and reviewed by running `pulumi
preview` locally before a deliberate, manually-invoked `pulumi up` —
deliberately decoupled from the on-every-merge `docker compose pull && up -d`
flow in `TASK-INFRA-014`'s `deploy-staging`/`deploy-production` jobs.
`[Inference]`: a `workflow_dispatch`-triggered GitHub Actions job that runs
`pulumi preview` (never `up`) on every PR touching `/infra/**`, purely as a
visibility/review aid, would be a reasonable Phase 1B addition — not
specified further here, since it is optional tooling, not a requirement any
source document states.

---

## 13. Resolved Items Log

All original open items are resolved. This section records the final disposition of each.

| #   | Original item                                                  | Resolution                                                                                                                                                                                                                                                                                                                                           | Authority                                                            |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Cloud provider confirmation                                    | **DigitalOcean `sgp1`** confirmed. See ADR-IAC-002.                                                                                                                                                                                                                                                                                                  | Developer decision                                                   |
| 2   | Philippine government data-residency / procurement constraints | DigitalOcean `sgp1` (Singapore) satisfies the data-residency intent of RA 10173 and DICT Circular 2017-002. `[Unverified]` — LGU IT Office must obtain legal confirmation before production data is written.                                                                                                                                         | Developer assessment; legal confirmation required from LGU IT Office |
| 3   | Domain name and DNS authority                                  | **`batac.gov.ph`**. Production: `dms.batac.gov.ph`; staging: `staging.dms.batac.gov.ph`. Preferred: DigitalOcean nameserver delegation. Fallback: static A-records via DICT DNS registry portal. See §10.                                                                                                                                            | Developer decision                                                   |
| 4   | SSH source IP range (`sshAllowedCidrs`)                        | **No default set.** Lead developers populate `sshAllowedCidrs` in the Pulumi stack config with their own egress IP(s) before `pulumi up`. Helper: `curl -s https://checkip.amazonaws.com` returns current egress IP. DigitalOcean Web Console (authenticated in-browser terminal, bypasses the Cloud Firewall) is the emergency access path. See §7. | Developer decision                                                   |
| 5   | Single- vs. two-Droplet production topology                    | **Two-Droplet topology confirmed.** Droplet A (app + postgres-primary, `s-2vcpu-4gb`); Droplet B (postgres-standby only, `s-1vcpu-2gb`). Staging uses a single `s-1vcpu-2gb` Droplet. See §6.1 and ADR rationale in that section.                                                                                                                    | Developer decision                                                   |
| 6   | Backblaze B2 account ownership                                 | **Lead Developer in collaboration with LGU IT Office.** The B2 application key is stored as a Pulumi config secret and as Docker secrets on the production host. Key rotation is the responsibility of the Lead Developer.                                                                                                                           | Developer + LGU IT Office decision                                   |
| 7   | Initial-provisioning secrets handoff                           | **Resolved: `./tools/ops/bootstrap-host.sh`** — a one-time operator-run local script that `scp`s `./secrets/*.txt` and TLS certificates to the freshly provisioned Droplet. Runs after `pulumi up`, before the first CI deploy. See §11.                                                                                                             | Developer decision                                                   |
