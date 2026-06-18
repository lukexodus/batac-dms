# Batac City LGU Platform — Consolidated Architecture & Requirements Reference

**Status:** Post-Interview 2 (June 15) | Developer Decisions Resolved | Pre-Development Baseline **Last Updated:** June 2026 **Audience:** Development team (internal reference)

---

## Part 9 — Technology Stack

No changes from pre-development reference. Stack decisions confirmed and unchanged.

|Layer|Choice|Constraint|
|---|---|---|
|Backend framework|Fastify|Schema-first routes; plugin scope enforces module encapsulation|
|Internal API|tRPC on Fastify|End-to-end type safety for `/web` — no REST for internal routes|

**Monorepo structure:**

```
/apps
  /web        — Vite + React SPA (internal authenticated app)
  /server     — Fastify backend (tRPC + REST routes, single process)
  /portal     — Next.js (public citizen portal — Phase 3 only)

/packages
  /shared     — Zod schemas, TypeScript types, API contracts, constants
  /ui         — Shared React component library (shadcn/ui + Tailwind)
  /config     — Shared ESLint, TypeScript, Prettier, tsconfig
  /database   — Drizzle schema, migrations, query helpers, seed data

/tools
  /scripts    — Deployment, DB seeding, maintenance, migration scripts
```

**Package manager:** pnpm workspaces. **Build orchestration:** Turborepo (remote caching; only rebuilds packages whose inputs changed).

---

## Part 10 — Architecture Pattern and Module Boundaries

### 10.1 Pattern: Modular Monolith with Internal Event Bus

Microservices at 100–250 users with a 4-person team is an operational anti-pattern. The modular monolith gives clean domain separation with an extraction path if needed. The internal in-process event bus decouples modules without distributed systems overhead.

### 10.2 Module Boundaries

Each module owns its own PostgreSQL schema. Modules communicate only through the internal event bus or published module API interfaces. No module reads another module's schema directly. No cross-schema foreign key constraints.

```
Modules:
  iam           → users, credentials, sessions, roles, permissions
  organization  → offices, positions, employees, assignments, delegations
  documents     → document types, documents, versions, attachments, numbers, signatures
  workflow      → definitions, versions, steps, instances, step instances, events
  tracking      → tracking records, routing entries, qr codes
  records       → records, retention schedules, archive entries, classification
  notifications → templates, events, delivery logs
  audit         → events (append-only, hash-chained)
  search_meta   → search index metadata (Phase 2)
  portal        → public documents, citizen requests, complaints, announcements (Phase 3)
  reporting     → report definitions, schedules, outputs (Phase 2)
```

### 10.3 Architectural Laws (Non-Negotiable)

1. Each module owns its own PostgreSQL schema. No cross-schema foreign key constraints.
2. Modules communicate through the event bus or published module APIs only. Never by direct schema access.
3. Audit writes go through the audit service only. No module writes directly to the audit schema.
4. All file references are UUID storage keys. Never original filenames.
5. All infrastructure is defined in code. No manual cloud resource creation.

### 10.4 Multi-Committee Referral Implication

The `workflow` module's step type for committee referral must support a list of assigned committee roles. The data model already reserves `parallel_split` and `parallel_join` step types for Phase 2. Phase 1 requires a `multi_referral` step type where: **all assigned committees must sign/contribute to the unified report** (not just one); committees that miss the Thursday cutoff cause Second Reading to be delayed; absent committees are marked red in the Order of Business but do not stop the hearing itself; and SP Secretary can manually advance with a mandatory audit-logged comment. This is a schema decision to make before the first workflow module migration.

---

## Part 11 — Key Design Decisions (Consolidated)

### 11.9 Database Conventions (Invariants)

|Convention|Decision|
|---|---|
|Primary keys|UUID v4 (`gen_random_uuid()`) everywhere|
|Timestamps|`TIMESTAMPTZ` on every timestamp column|
|Soft-delete|`deleted_at TIMESTAMPTZ` + `deleted_by UUID` on every table — no hard deletes|
|Tenant isolation|`city_id UUID NOT NULL` in all core entity tables (default: Batac City UUID)|
|Cross-schema FKs|Prohibited — enforced by automated migration linting|

**Schema map:**

```
schema: iam           → users, credentials, sessions, refresh_tokens, roles, permissions, mfa_records
schema: organization  → offices, positions, employees, assignments, delegations
schema: documents     → document_types, documents, versions, attachments, numbers, number_series, signatures
schema: workflow      → definitions, definition_versions, steps, transition_rules, instances, step_instances, workflow_events
schema: tracking      → tracking_records, routing_entries, qr_codes
schema: records       → records, retention_schedules, archive_entries, classification_rules, dispositions
schema: notifications → templates, notification_events, delivery_log
schema: audit         → events (append-only; INSERT-only DB permissions)
schema: search_meta   → index_metadata, index_jobs (Phase 2)
schema: portal        → public_documents, citizen_requests, complaints, announcements (Phase 3)
schema: reporting     → report_definitions, schedules, outputs (Phase 2)
```

**PostgreSQL non-negotiables:** JSONB (admin-configurable metadata), Row-Level Security (office-level data isolation), Append-only audit (REVOKE UPDATE/DELETE on audit schema from application DB user), Check constraints for state transitions, Sequences for gapless document numbering.

---

### 11.20 Post-Delivery and Governance

|Decision|Value|
|---|---|
|Post-delivery owner|Internal LGU IT Office|
|Development team role|Consultation and support; not primary maintainers|
|Source code escrow|LGU receives source code, schemas, IaC, ADRs, runbooks from Phase 1 — not only at contract end|
|ADRs|Mandatory for every non-obvious architectural decision|
|Automated coupling tests|Required — enforce module boundary isolation on every PR|
|Development team production access|Zero access to production data — credentials held exclusively by LGU IT Office|
|Emergency break-glass|Physical sealed envelope in LGU IT Office safe; logged on opening|

---

### 11.21 Extensibility Tiers

**User-configurable (no admin approval):** Notification preferences, dashboard layout, saved search filters, display preferences.

**Administrator-configurable (no developer):** All workflow definitions and step configurations; document type definitions and JSONB metadata schemas; office hierarchy; role definitions and permission assignments; notification templates; retention schedules; SLA thresholds; escalation targets; numbering series; report definitions; document type public visibility.

**Developer-only (code change + deployment):** New bounded context modules; new domain event types; changes to audit log schema; new auth provider integration; new file storage provider; ABAC policy engine changes; database schema migrations; new notification delivery channels; infrastructure changes.

**Must be hardcoded by design:** Audit log append-only (database permission level); no permanent deletion; hash-chaining mechanism; module boundary definitions; workflow instance version pinning at creation.

---

## Part 12 — Architectural Invariants

These decisions are protected by design and are extremely expensive or impossible to change after production data exists. Enforced from the first migration.

|#|Invariant|Enforcement Method|
|---|---|---|
|1|Schema-per-module; no cross-schema foreign keys|Automated migration linting; code review policy|
|2|Soft-delete everywhere; no hard deletes|Repository layer; code review policy|
|3|Audit log INSERT-only at DB role level|PostgreSQL role permissions set in migration|
|4|Workflow instance pins to definition version at creation|DB column `definition_version_id`; all resolution uses pinned version|
|5|S3-compatible API only; UUID file keys|No provider SDK imports allowed; code review policy|
|6|UUID v4 primary keys everywhere|Migration linting|
|7|TIMESTAMPTZ for all timestamps|Migration linting|
|8|`city_id UUID NOT NULL` in all core entity tables|Migration schema|
|9|Numbering assigned at defined lifecycle event only|Workflow engine constraint|
|10|IT admin has no document content access|PostgreSQL RLS + application ABAC policy|
|11|Document type must have retention schedule before activation|Application validation constraint|
|12|Platform Administrator role cannot be combined with operational roles|Role assignment validation|
|13|Encoder and final approver of same document cannot be the same user|Workflow engine constraint|
|14|Workflow constraints per document type (legally mandated minimum steps)|Workflow editor validation|
|15|Backup credentials separate from production credentials|Infrastructure policy; Terraform|
|16|One active designation per person at any time|Application-level validation + DB partial unique index on active delegation_grants per user `[ADDED — Interview 2]`|

---