# L5 — Infrastructure as Code Specification

**Status:** New — authored to close the `[SPEC GAP]` flagged in `a1-tasks/infra.md`'s
Module Summary (no Terraform/Pulumi document existed anywhere in
`docs/pre-development/` prior to this). **Project Phase:** Pre-Development —
Iteration 3 (Post-Interview 2 + Developer Decisions Resolved) **Last
Updated:** June 2026 **Audience:** Development team; LGU IT Office
(post-delivery reference)

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

- [L46–L78] 1. Scope and Non-Goals — Definement of what cloud resources are provisioned and explicit out-of-scope items.
- [L79–L88] 2. Tool Choice — Pulumi (TypeScript) — Decision to use Pulumi and TypeScript for infrastructure definition and tooling integration.
- [L89–L102] 3. Cloud Provider — DigitalOcean (Proposed Default, Pending Confirmation) — Choice of DigitalOcean region sgp1 for primary compute and live storage pending approval.
- [L103–L135] 4. Project Structure — Directory structure and configuration files for staging and production stacks.
- [L136–L150] 5. State Management — Rationale for using Pulumi Cloud free tier for locking and state storage.
- [L151–L206] 6. Compute — Sizing and provisioning of Ubuntu Docker Droplets for staging and production hosts.
- [L207–L245] 7. Networking — VPC and firewall rules restricting inbound access to ports 22, 80, and 443.
- [L246–L314] 8. Object Storage — Configuration of live storage on DigitalOcean and immutable cold-backups on Backblaze B2.
- [L315–L341] 9. Block Storage — Provisioning of a separate block storage volume for PostgreSQL data persistence.
- [L342–L366] 10. DNS — Setup of A-records and nameserver delegation for the application domain.
- [L367–L388] 11. Secrets Handling in IaC vs. at Runtime — Separation of Pulumi config secrets from application runtime secrets.
- [L389–L403] 12. Relationship to the CI/CD Pipeline (L3 / `TASK-INFRA-013`/`014`) — Separation of infrastructure runs from continuous application deployments.
- [L404–L425] 13. Open Items Requiring Developer's Input — List of unresolved questions requiring developer decisions before provisioning.

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

## 3. Cloud Provider — DigitalOcean (Proposed Default, Pending Confirmation)

**`[Inference]` — ADR-IAC-002, not fully resolved.** DigitalOcean, region
`sgp1` (Singapore), is proposed as the default provider for compute,
networking, and the live-document object store. **This is a default, not a
final decision** — it requires Arya's confirmation (see Open Items, §13)
before any real account is created or any `pulumi up` is run against it.
Nothing in this document requires DigitalOcean specifically at the
*architecture* level (Pulumi's resource model would look similar against
Hetzner, AWS, or another provider) — the choice mainly affects the exact
resource types named in §5–§9 below.

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

**`[Inference]`** — Pulumi Cloud's free tier (app.pulumi.com) is recommended
as the state backend: it provides locking, history, and encrypted secrets
out of the box with zero additional infrastructure to bootstrap. The
alternative — a self-managed state backend in a DigitalOcean Spaces bucket —
creates a chicken-and-egg problem (the bucket that stores Pulumi's state
would itself need to be either hand-created once outside Pulumi, or
provisioned by a *second*, separately-bootstrapped Pulumi program), which is
unnecessary complexity for a four-person team. Revisit only if Pulumi
Cloud's free-tier limits become a real constraint or if a self-hosted state
backend is mandated by a data-residency requirement (§13).

---

## 6. Compute

One Droplet per environment. `[Inference]` sizing below is a starting point
for ~100–250 concurrent staff users (consolidated ref Part 9/10), not a load
test result — re-evaluate after the first month of real usage.

| Environment | Droplet size (slug) | vCPU | Memory | Notes |
|---|---|---|---|---|
| staging | `s-1vcpu-2gb` | 1 | 2 GB | Mirrors production topology at smaller scale |
| production | `s-2vcpu-4gb` | 2 | 4 GB | Runs `nginx`, `server`, `postgres-primary` together (see §6.1 below) |

Image: the DigitalOcean Marketplace "Docker on Ubuntu" image (`[Unverified]`
exact current slug — confirm via `doctl compute image list-distribution` or
the DigitalOcean Marketplace listing at implementation time; do not assume
the slug below is still current) ships Docker and Docker Compose
pre-installed, removing a manual provisioning step:

```typescript
import * as digitalocean from "@pulumi/digitalocean";

const appHost = new digitalocean.Droplet(`batac-${stack}-app-host`, {
  region,
  size: dropletSize,
  image: "docker-20-04", // [Unverified] — confirm current Marketplace slug
  vpcUuid: vpc.id,
  sshKeys: [deployKey.fingerprint],
  tags: [stack, "app-host"],
});
```

### 6.1 Single-Host vs. Two-Host Production Topology — Open Decision

`compose.prod.yml` (`TASK-INFRA-012`) defines `postgres-primary` and
`postgres-standby` as two containers, and `TASK-INFRA-018` builds a manual
failover procedure between them. **Running both containers on the same
Droplet protects against PostgreSQL software-level failure (corruption, a bad
upgrade) but not against host-level failure** (the Droplet itself going
down) — which means the failover runbook would have nothing to fail over
*to* in the one scenario (a dead host) where failover matters most.

This document does not resolve which topology to build, because it is a
real cost trade-off, not a technical one:

- **One production Droplet** (proposed default above): `postgres-standby`
  runs alongside `postgres-primary` on the same host. Cheaper. The
  consolidated reference's RTO/RPO commitments (§11.14) are only partially
  met — protected against data corruption, not against the host dying.
- **Two production Droplets**: a second, smaller Droplet (`s-1vcpu-2gb` is
  likely sufficient for a standby-only host) running just
  `postgres-standby`. Roughly doubles the production compute bill. Actually
  fulfills the "streaming replication for failover" design intent.

**Flagged to Arya in §13 — this needs a decision, not a default.**

---

## 7. Networking

```typescript
const vpc = new digitalocean.Vpc(`batac-${stack}-vpc`, {
  region,
  ipRange: "10.10.0.0/24",
});

const firewall = new digitalocean.Firewall(`batac-${stack}-firewall`, {
  dropletIds: [appHost.id],
  inboundRules: [
    {
      protocol: "tcp",
      portRange: "22",
      sourceAddresses: sshAllowedCidrs, // see Open Items, §13 — not 0.0.0.0/0
    },
    { protocol: "tcp", portRange: "80", sourceAddresses: ["0.0.0.0/0", "::/0"] },
    { protocol: "tcp", portRange: "443", sourceAddresses: ["0.0.0.0/0", "::/0"] },
    { protocol: "icmp", sourceAddresses: ["0.0.0.0/0", "::/0"] },
  ],
  outboundRules: [
    { protocol: "tcp", portRange: "1-65535", destinationAddresses: ["0.0.0.0/0", "::/0"] },
    { protocol: "udp", portRange: "1-65535", destinationAddresses: ["0.0.0.0/0", "::/0"] },
  ],
});
```
Only 22 (SSH, restricted), 80, and 443 are open inbound — matching exactly
what `nginx` in `compose.prod.yml` (`TASK-INFRA-012`) listens on. Port 3000
(the `server` container) is never exposed to this Firewall at all, consistent
with `TASK-INFRA-012`'s `127.0.0.1:3000:3000` loopback-only binding — the
Firewall is a second, independent layer enforcing the same boundary, not a
substitute for it.

**`sshAllowedCidrs` is an open item** (§13) — it must be the LGU IT Office's
actual office/VPN egress IP range(s), not `0.0.0.0/0`. Until that range is
known, do not `pulumi up` this resource with a wildcard SSH rule.

---

## 8. Object Storage

### 8.1 Live Documents — DigitalOcean Spaces

```typescript
const documentsBucket = new digitalocean.SpacesBucket(`batac-documents-${stack}`, {
  region,
  acl: "private",
});
```
This becomes `S3_ENDPOINT`/`S3_BUCKET` (`TASK-INFRA-002`/`003`) for the
corresponding environment. DigitalOcean Spaces' lack of Object Lock (§8.2)
does not matter here — this bucket holds the *live*, actively-read/written
document store, which is backed up separately (L4), not itself the
immutable copy.

### 8.2 Immutable Cold-Backup Copy — Backblaze B2

**Resolved — ADR-IAC-003.** DigitalOcean Spaces does not support Object Lock
(`[Unverified]` at the time this was checked, confirmed via DigitalOcean's
own community documentation and independent 2026 comparisons — re-verify if
significant time has passed, since provider feature sets do change). The
consolidated reference's "write-once (object lock) storage" requirement
(§11.14) is therefore met with a **separate Backblaze B2 bucket**, bridged
into Pulumi via its Terraform provider:

```typescript
// One-time: pulumi package add terraform-provider backblaze/b2
import * as b2 from "@pulumi/b2"; // name depends on the generated SDK

const backupBucket = new b2.Bucket(`batac-backups-${stack}`, {
  bucketName: `batac-backups-${stack}`,
  bucketType: "allPrivate",
  // [Unverified] — confirm whether this generated resource exposes an
  // Object-Lock / default-retention argument before relying on it. If it
  // does not, enable Object Lock manually in the B2 web console at bucket
  // creation (it cannot be enabled later), then `pulumi import` the bucket
  // for ongoing lifecycle-rule management only.
});
```
This becomes `S3_BACKUP_ENDPOINT`/`S3_BACKUP_ACCESS_KEY`/
`S3_BACKUP_SECRET_KEY` (already distinct, optional fields in
`TASK-INFRA-002`'s schema) — `TASK-INFRA-017`'s `pg_dump_backup.sh` requires
no code change, only different credential values.

### 8.3 Lifecycle Rules

`[Inference]` — closing the second half of the `[SPEC GAP]` `infra.md`
originally flagged (the bucket lifecycle/retention policy itself, as
distinct from Object Lock):

```typescript
const backupLifecycle = new digitalocean.SpacesBucketLifecycleRule? // N/A — see note below
```
`[SPEC GAP]` carried forward, narrowed: DigitalOcean's `SpacesBucket`
resource does support a `lifecycleRule` configuration block for the
*live-document* bucket (expiration/transition by age), but that bucket has
no defined retention policy in any source document — documents are retained
per the (not-yet-generated) `RECORDS` module's retention-schedule logic, not
a blanket bucket-level expiration, so no lifecycle rule is written here for
`documentsBucket`. For the `backupBucket` (B2), retention is enforced by
Object Lock's own retention-period setting (§8.2) plus the *application-side*
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
  filesystemType: "ext4",
});

const postgresVolumeAttachment = new digitalocean.VolumeAttachment(
  `batac-${stack}-postgres-data-attach`,
  { dropletId: appHost.id, volumeId: postgresVolume.id }
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

`[SPEC GAP]` — no domain name or DNS/registrar has been confirmed anywhere in
this project's documents. Flagged in §13. Once known:

```typescript
const domain = new digitalocean.Domain(`batac-domain`, { name: appDomain });

const aRecord = new digitalocean.DnsRecord(`batac-${stack}-a-record`, {
  domain: domain.id,
  type: "A",
  name: stack === "production" ? "@" : "staging",
  value: appHost.ipv4Address,
  ttl: 3600,
});
```
This assumes DigitalOcean manages DNS directly (requires delegating the
domain's nameservers to DigitalOcean). If the domain is a `.gov.ph` domain
under a government-specific registration authority that does not support
nameserver delegation, the A-record may instead need to be created manually
at whatever DNS panel that authority provides — `[SPEC GAP]`, dependent on
the answer to the domain question in §13.

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

The only overlap: once Pulumi provisions the Droplet, *something* must place
the `./secrets/*.txt` files and the TLS certificate onto that host for the
first time. `[SPEC GAP]` — no document specifies this initial-provisioning
handoff step (a one-time `scp`/Ansible-style task, distinct from both Pulumi
and the ongoing CI deploy job). Flagged in §13.

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

## 13. Open Items Requiring Developer's Input

These are not resolved by this document and should not be treated as
decided:

1. **Cloud provider confirmation** (ADR-IAC-002) — accept DigitalOcean, or
   name a different provider/account already in use.
2. **Philippine government data-residency / procurement constraints** — is
   any cloud provider for this system constrained by law or policy?
3. **Domain name and DNS authority** (§10) — what domain will the platform
   use, and who/what controls its DNS (DigitalOcean nameservers, a
   `.gov.ph` registry panel, or something else)?
4. **SSH source IP range** (§7) — the actual CIDR(s) the LGU IT Office
   connects from, to replace the placeholder `sshAllowedCidrs`.
5. **Single- vs. two-Droplet production topology** (§6.1) — accept the
   cheaper single-host default (partial DR value) or budget for a second
   Droplet (full DR value matching the failover runbook's intent).
6. **Backblaze B2 account** (ADR-IAC-003) — a second cloud account beyond
   whatever is chosen for #1; who creates/owns it.
7. **Initial-provisioning secrets handoff** (§11) — how `./secrets/*.txt`
   and the TLS certificate get onto a freshly-provisioned host the first
   time; not yet specified anywhere.
