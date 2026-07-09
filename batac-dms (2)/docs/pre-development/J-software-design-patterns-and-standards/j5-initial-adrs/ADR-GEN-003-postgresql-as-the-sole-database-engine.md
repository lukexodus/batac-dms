# ADR-GEN-003: PostgreSQL as the Sole Database Engine


**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

The platform requires several database capabilities that are not universally available across relational engines:

1. **Admin-configurable variable metadata per document type** — Different document types have different custom fields set by the Platform Administrator. These must be stored without requiring a schema migration for each new field.
2. **Office-level data isolation enforced at the database engine level** — The ABAC authorization model requires that Row-Level Security policies prevent any query from returning out-of-scope data, even if application middleware has a bug. This is a defense-in-depth requirement, not just an application convention.
3. **Append-only audit log enforced at the database permission level** — The audit schema must be INSERT-only for the application database user; `UPDATE` and `DELETE` must be revoked at the PostgreSQL grant level, not just prevented in application code. This is an Architectural Invariant (Invariant 3).
4. **Gapless document numbering sequences per document type per year** — Legislative series numbers cannot have unintended gaps. PostgreSQL sequences provide this with correct behavior under concurrent writes.
5. **Full-text search for Phase 1** — `tsvector`/`tsquery` for Filipino government document titles and bodies, without additional infrastructure in Phase 1.
6. **Check constraints for workflow state transitions** — A second enforcement layer at the database level to prevent invalid state transitions even if the application layer has a bug.

### Decision

PostgreSQL is the sole relational database engine for the entire platform. MySQL and MariaDB are excluded entirely and permanently. No other relational database engine is used for any data storage requirement.

### Alternatives Considered

**MySQL / MariaDB** — Lacks JSONB (the MySQL `JSON` type does not support GIN indexing or efficient containment queries), lacks Row-Level Security as a native feature, and lacks the append-only grant model needed for audit log enforcement at the database permission level. All three are load-bearing architectural requirements. MySQL is excluded permanently.

**MongoDB** — Document-oriented storage seems appealing for variable document metadata. However, MongoDB does not provide the same ACID transaction guarantees across collections, has a weaker query model for relational data (committee membership, role assignment chains, delegation hierarchies), lacks the RLS model required for office-scoped isolation, and lacks native sequence support for gapless numbering. Rejected.

**SQLite** — Not suitable for a multi-user server with concurrent writes. Not considered beyond initial evaluation.

**PostgreSQL + a separate document store or time-series database** — Unnecessary complexity at this scale. PostgreSQL with JSONB and GIN indexing handles the variable-metadata requirement within a single engine. A second data store adds operational overhead and synchronization risk. Rejected.

### Consequences

**Positive**

- JSONB with GIN indexing supports admin-configurable metadata fields per document type without schema migrations
- RLS policies enforce office-scoped data isolation at the engine level — a second layer behind application ABAC
- Append-only audit schema enforcement via revoking `UPDATE`/`DELETE` grants from the application database user
- PostgreSQL sequences provide gapless per-series-per-year numbering under concurrent write conditions
- `tsvector`/`tsquery` provides Phase 1 full-text search with no additional infrastructure
- Drizzle ORM provides full TypeScript inference from the PostgreSQL schema with end-to-end type safety

**Negative / Trade-offs**

- Requires PostgreSQL-specific expertise; generic SQL or MySQL knowledge does not transfer fully to RLS, JSONB, and sequence behavior
- RLS policies add schema complexity; queries must be tested with RLS enabled (not bypassed via superuser), or policy gaps will not be caught in development
- JSONB queries are less readable than typed column queries; GIN index maintenance adds storage overhead at high document volumes

**Required Follow-On Actions**

- All migration files must include RLS policy definitions for new tables alongside the table DDL; a table without an RLS policy on a tenant-scoped schema is a migration lint error
- The application runtime database user must never be granted `UPDATE` or `DELETE` on the `audit` schema; this must be enforced in the initial migration and tested in CI
- Check constraints for workflow state machine transitions must be written alongside the workflow schema

### Related Decisions

- ADR-GEN-001 — Modular Monolith (schema-per-module isolation enforced at the PostgreSQL schema boundary)
- ADR-GEN-008 — No-Deletion Invariant (soft-delete is a schema-level convention; no-delete on audit schema is a PostgreSQL grant)

---
