# ADR-INF-002 (formerly ADR-L2-02) — PostgreSQL Docker Image: Bitnami vs Official

`[Corrected — this file's own title previously said only "ADR-L2-02," a local per-document
numbering scheme predating the project-wide reorganization into the current domain-prefixed
ADR scheme. The filename and ADR Master Index (J5) both use ADR-INF-002. Same pattern found across
this entire L2 cluster and the D3 cluster (see ADR-WFL-003's title note) — evidently
project-wide, not confined to one document. "ADR-L2-02" is preserved as a parenthetical alias.]`

**Status:** Decided  
**Date:** June 2026  
**Resolves:** L2 Part 13 open decision L2-02  
**Author:** Architecture review

---

## Context

The production Compose file (`compose.prod.yml`, Part 3) requires a primary + standby PostgreSQL topology with WAL streaming replication. Two image options were under consideration:

- **`postgres:16-alpine`** (official) — Used in `compose.yml` (local dev, single-instance). Replication setup requires manually providing `pg_hba.conf` entries and `postgresql.conf` / `recovery.conf` (or `standby.signal` + `primary_conninfo` in PostgreSQL 12+) via init scripts or config file mounts.
- **`bitnami/postgresql:16`** — Provides environment-variable-driven replication configuration. Setting `POSTGRESQL_REPLICATION_MODE=master` on primary and `POSTGRESQL_REPLICATION_MODE=slave` on standby, with corresponding credentials, is sufficient to establish streaming replication without manual config file management.

The production Compose file has already been written using `bitnami/postgresql:16` (Part 3). The L2-02 open decision is asking this to be confirmed rather than discovered.

---

## Decision

**Confirm `bitnami/postgresql:16` for production primary and standby containers.**

The local development single-instance container retains `postgres:16-alpine` (no replication needed; official image is simpler and smaller for dev).

Rationale:

1. **The implementation is already written.** `compose.prod.yml` uses Bitnami's environment-variable interface for both primary (`POSTGRESQL_REPLICATION_MODE: master`) and standby (`POSTGRESQL_REPLICATION_MODE: slave`). Switching to the official image at this stage would require writing and maintaining init scripts that replicate what Bitnami already handles declaratively.

2. **Reduces operational error surface.** `pg_hba.conf` and `recovery.conf` management via init scripts introduces a class of errors — entry ordering, quoting, whitespace — that have caused replication outages. Bitnami's environment-variable interface is declarative and well-tested for this use case.

3. **PostgreSQL version is the same.** Both images run PostgreSQL 16. There is no functional difference in the database engine, RLS behavior, JSONB handling, or replication protocol. The image vendor only affects the container bootstrap process.

4. **Bitnami data path confirmed.** Bitnami stores PostgreSQL data at `/bitnami/postgresql` rather than `/var/lib/postgresql/data`. The volume mount in `compose.prod.yml` already reflects this. Init scripts still go in `/docker-entrypoint-initdb.d` as with the official image — confirmed in Part 3 inline comments.

---

## Constraints and notes

- **Init scripts:** The `./tools/db/init` directory is bind-mounted to `/docker-entrypoint-initdb.d:ro` on the primary. This works identically to the official image. The standby does not receive init scripts — it replicates from the primary.
- **Image pinning:** `bitnami/postgresql:16` should be pinned to a minor version (e.g., `bitnami/postgresql:16.9.0`) before production deployment to prevent digest drift. The tag `16` floats on Bitnami's release schedule. Pin in `compose.prod.yml` when cutting the first production release.
- **Superuser credentials:** Bitnami uses `POSTGRESQL_POSTGRES_PASSWORD` for the `postgres` superuser, not `POSTGRES_PASSWORD` (as the official image does). This is already reflected in `compose.prod.yml`.

---

## Consequences

### Status update in L2 Part 13

L2-02 moves from `Recommended, not confirmed [Inference]` to `Confirmed — bitnami/postgresql:16`.

### Action item before first production deploy

Pin the Bitnami image to a specific minor version tag in `compose.prod.yml`:

```yaml
# Before
image: bitnami/postgresql:16

# After — pin before first production deployment
image: bitnami/postgresql:16.9.0
```

Check Bitnami's Docker Hub for the current stable minor release at that time.

---

## Rejected alternative

Switching to `postgres:16-alpine` on primary and standby was rejected. The implementation cost (authoring `pg_hba.conf` and `standby.signal` init scripts, testing replication setup in CI) is non-trivial and provides no benefit over the existing Bitnami approach. The official image is retained for local development where its simplicity is the correct trade-off.