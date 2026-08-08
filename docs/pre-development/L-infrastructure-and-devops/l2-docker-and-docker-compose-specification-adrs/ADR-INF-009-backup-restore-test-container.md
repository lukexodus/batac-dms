# ADR-INF-009 (formerly ADR-L2-09) — Backup Restore Test Container

`[Corrected — this file's own title previously said only "ADR-L2-09," a local per-document
numbering scheme predating the project-wide reorganization into the current domain-prefixed
ADR scheme. The filename and ADR Master Index (J5) both use ADR-INF-009. Same pattern found across
this entire L2 cluster and the D3 cluster (see ADR-WFL-003's title note) — evidently
project-wide, not confined to one document. "ADR-L2-09" is preserved as a parenthetical alias.]`

**Status:** Decided (Phase 1 scope — dormant)  
**Date:** June 2026  
**Resolves:** L2 Part 13 open decision L2-09  
**Author:** Architecture review

---

## Context

L1 §20.2 defines the `BACKUP_RESTORE_TEST_ENABLED` environment variable:

> When `true`, the backup job performs a test restoration to a scratch database after each backup and logs the result. Recommended for production DR compliance.

The variable defaults to `false` and is classified `OPT` (optional). If set to `true`, the backup job requires a scratch PostgreSQL instance to restore into — separate from the primary and standby, to avoid any risk of overwriting live data. That scratch instance is not defined in the current `compose.prod.yml`.

The open decision asks whether the scratch container should be defined now.

---

## Decision

**`BACKUP_RESTORE_TEST_ENABLED` remains `false` in Phase 1. The scratch PostgreSQL container is not added to `compose.prod.yml` at this time.**

This decision is explicitly Phase 1-scoped. The variable and its behavior are documented as a placeholder. The infrastructure gap (undefined scratch container) is recorded here and must be resolved before the flag is activated.

Rationale:

1. **The flag is `false` by default and optional.** L1 §20.2 marks it `OPT` with no `Required: Yes` on either the cloud or on-premise class. Activating it is a DR hardening step, not a launch requirement.

2. **Defining an unused container adds operational surface.** A scratch PostgreSQL container that sits idle but must be kept healthy, backed up (or excluded from backup), and monitored adds noise to the deployment before the system is established. The benefit of defining it now is nil if the flag is not activated.

3. **The gap is fully documented.** This ADR records exactly what is needed to activate the feature. No information is lost by deferring the container definition.

---

## What is required when `BACKUP_RESTORE_TEST_ENABLED=true` is activated

The following additions are required — they are not implemented now but are documented here so the work is well-scoped when it is eventually done.

### 1. Scratch PostgreSQL service in `compose.prod.yml`

```yaml
postgres-restore-scratch:
  image: bitnami/postgresql:16          # match primary image — see ADR-L2-02
  restart: no                           # not a persistent service; started on demand
  profiles:
    - backup-test                       # activated only when backup test runs
  environment:
    POSTGRESQL_POSTGRES_PASSWORD: ${DB_RESTORE_SCRATCH_PASSWORD}
    POSTGRESQL_DATABASE: restore_scratch
    TZ: Asia/Manila
  tmpfs:
    - /bitnami/postgresql/data          # ephemeral — data lives only for the test run
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres -d restore_scratch"]
    interval: 5s
    timeout: 5s
    retries: 10
    start_period: 15s
```

> **[Inference]** The `profiles: [backup-test]` approach is one option. An alternative is to start the scratch container as a one-off via `docker compose run` from within the backup job script. The correct approach depends on how the backup job orchestrates the scratch restore — confirm against the `OcrService`/backup job implementation when that module is built.

### 2. Network access

The scratch container must be on the same Docker network as the Fastify server (`server` service) so the backup job can reach it via the container name. Confirm the network name in `compose.prod.yml` and add it to the scratch service definition.

### 3. Environment variable

Add to `.env.production` and `.env.example`:

```bash
# Required when BACKUP_RESTORE_TEST_ENABLED=true
DB_RESTORE_SCRATCH_PASSWORD=<generate with openssl rand -hex 32>
```

Classify as `SEC` — this is a database credential even for a scratch instance.

### 4. Image version alignment

The scratch PostgreSQL instance must run the same PostgreSQL major version as the primary (currently 16, per ADR-L2-02). A `pg_dump` from PostgreSQL 16 cannot be restored to a scratch instance running a different major version without format incompatibility.

---

## Consequences

### Status update in L2 Part 13

L2-09 moves from `Not specified [Inference]` to `Resolved (Phase 1 dormant) — BACKUP_RESTORE_TEST_ENABLED=false; scratch container definition deferred; gap documented in ADR-L2-09`.

### Activation checklist (future)

Before setting `BACKUP_RESTORE_TEST_ENABLED=true` in production:

- [ ] Define `postgres-restore-scratch` service in `compose.prod.yml` (see above)
- [ ] Confirm network access between Fastify backup job and scratch instance
- [ ] Add `DB_RESTORE_SCRATCH_PASSWORD` to `.env.production`
- [ ] Confirm scratch container is excluded from WAL archiving and pg_dump backup scope
- [ ] Test the full restore cycle in staging before enabling in production
- [ ] Update L2 document Part 3 (`compose.prod.yml` section) to reflect the new service