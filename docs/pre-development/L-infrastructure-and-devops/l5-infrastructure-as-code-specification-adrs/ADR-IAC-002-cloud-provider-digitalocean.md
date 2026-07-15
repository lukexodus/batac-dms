# ADR-IAC-002 — Cloud Provider: DigitalOcean (Singapore `sgp1`)

**Status:** Decided
**Date:** June 2026
**Resolves:** L5 §3 (Cloud Provider, previously pending confirmation) and Open Items §13.1–§13.2
**Domain:** Infrastructure as Code (L5)

---

## Context

L5 §3 proposed DigitalOcean as the default cloud provider but explicitly required developer confirmation before any real account is created or any `pulumi up` is run. This ADR records that confirmation and the reasoning behind it.

The consolidated reference §11.2 (Infrastructure and Cloud Agnosticism) states the platform must be deployable on any S3-compatible, Dockerized environment — DigitalOcean is one valid instantiation of that requirement, not a lock-in.

Philippine government procurement is relevant here. The DICT Department Circular 2017-002 (Cloud First Policy) requires government agencies to consider cloud services that meet data privacy and security standards, with preference for data residency within the Philippines or in jurisdictions with adequate data protection. `[Unverified]` — the team should confirm with the LGU IT Office that the project falls within the scope of this circular and that DigitalOcean sgp1 has been assessed as compliant. The reasoning presented below is the team's current understanding; it is not a legal determination.

---

## Decision

**Use DigitalOcean as the primary cloud provider, with the `sgp1` (Singapore) region for both compute and object storage.**

---

## Rationale

### 1. Geographic proximity and latency

The `sgp1` (Singapore) region is the closest DigitalOcean region to Batac City, Ilocos Norte, Philippines. Network latency from the Philippines to Singapore is substantially lower than to US-based or EU-based regions, which directly affects database connection times, S3 upload speeds, and user-facing API response times for the LGU staff who are the primary users.

### 2. Data residency (current understanding — `[Unverified]`, team must confirm)

DigitalOcean's Singapore region stores data in Singapore, a jurisdiction with strong data protection law (Personal Data Protection Act 2012). Philippine RA 10173 (Data Privacy Act) requires that personal data transferred outside the Philippines be subject to adequate protection — Singapore's legal framework is widely regarded as adequate, though the NPC has not published a formal adequacy determination. The LGU IT Office should obtain a legal opinion on this before production data is written.

All data is encrypted in transit (TLS) and at rest (DigitalOcean Spaces AES-256 encryption). No database port is exposed on the public internet: `postgres-primary` on Droplet A is accessible only on the private VPC network (10.10.0.0/24 per L5 §7); the Cloud Firewall blocks all non-80/443 inbound traffic from the public internet.

### 3. Pricing fit for Phase 1 scope

The two-Droplet production topology (L5 §6.1; ADR rationale in that section) costs approximately:
- Droplet A (`s-2vcpu-4gb`): ~$24/month
- Droplet B (`s-1vcpu-2gb`): ~$12/month
- Block volume (50 GiB): ~$5/month
- Spaces (object storage, first 250 GiB + bandwidth): ~$5–10/month

`[Unverified]` — exact pricing may have changed since this was written; verify at [digitalocean.com/pricing](https://www.digitalocean.com/pricing) before committing to budget.

This is substantially lower than equivalent AWS or GCP configurations and is commensurate with a city-level LGU's operating budget for a Phase 1 deployment serving ~100–250 concurrent staff users.

### 4. Pulumi provider maturity

`@pulumi/digitalocean` is a well-maintained, first-class Pulumi provider with full coverage of the resources needed by L5: Droplets, VPCs, Cloud Firewalls, Block Volumes, Spaces Buckets, and DNS Records. All L5 code blocks are written against this provider.

### 5. Cloud agnosticism preserved

Choosing DigitalOcean for Phase 1 does not lock the application to DigitalOcean. The application connects to PostgreSQL via `DATABASE_URL_*` environment variables (not DigitalOcean-managed DB), uses S3-compatible object storage via standard AWS SDK calls (not DigitalOcean-specific SDK), and is containerized via Docker Compose (runnable on any Docker host). Migrating to a different cloud provider means updating the Pulumi program (replacing `digitalocean.*` resource types) and updating stack config values — the application code does not change.

---

## Consequences

- DigitalOcean `sgp1` is the confirmed region for all L5 resources. The Pulumi stack configs (`Pulumi.staging.yaml`, `Pulumi.production.yaml`) set `region: sgp1`.
- A DigitalOcean account must be created and an API token issued. The token is stored as a Pulumi config secret (`pulumi config set --secret digitalocean:token`).
- The LGU IT Office should review and confirm the data residency position with legal counsel before writing production data. This ADR records the technical decision; the legal clearance is a separate, human-owned action item.
- `S3_ENDPOINT` for the live-document bucket (`documentsBucket`) will be DigitalOcean Spaces: `https://sgp1.digitaloceanspaces.com` (or the bucket's custom endpoint — confirm via `doctl` at provisioning time).

## Rejected alternative

**AWS** — better global brand recognition but ~3× higher cost for equivalent compute in ap-southeast-1 (Singapore), and the monorepo already uses MinIO (an S3-compatible server) for local development, which means the S3-API compatibility layer is already tested. AWS would add no architectural value beyond what DigitalOcean Spaces provides for this scale.

**Hetzner** — lower cost but nearest data centers are in EU (Falkenstein, Nuremberg, Helsinki) and US (Ashburn), not APAC. Unacceptable latency for Philippine users and does not satisfy the data residency goal.