# C1. Full Database Schema DDL — All Phase 1 Schemas

**Document:** C1
**Platform:** Batac City LGU Platform
**Status:** BLOCKING — this document is the foundation for C2 (ERDs), C3 (RLS Policies), C4 (Index Strategy), C5 (Migration Conventions), E1/E2/E3 (API and schema catalogs), and ultimately A1 (Master Phased Task List). No schema-dependent document or implementation work should begin before this document is reviewed and accepted.
**Last Updated:** June 2026
**Audience:** Backend development team; LGU IT Office (DBA reviewers)
**Source Documents (reviewed for this document):**

- `b2-module-boundary-and-internal-api-contracts.md` — module ownership of each schema; Published API DTOs used to infer columns not otherwise specified; the Master Event Bus Registry and API Call Matrix (used to confirm which cross-module references must exist)
- `b4-workflow-engine-specification.md` — authoritative data model for the `workflow` schema (Section 2), enum definitions, engine invariants (Section 9), and several columns referenced only in pseudocode, gap-filled here
- `d4-domain-class-diagram.md` — the 61-entity domain model; primary source for `organization`, `tracking`, `records`, `notifications`, `audit` schemas and for several `documents`/`workflow` entities not detailed elsewhere
- `h2-document-type-catalog-with-jsonb-metadata-schemas.md` — authoritative non-JSONB column list for `documents.documents`; the eight Phase 1 `document_types` rows and their `metadata` JSON Schemas
- `h3-numbering-series-configuration-specification.md` — the eleven `number_series` rows, their format strings, padding, and PostgreSQL sequence naming convention
- `consolidated-architecture-and-requirements-reference-iteration-3.md` — Parts 5, 9, 10, 11, 12 (numbering, schema map, module boundaries, key design decisions, architectural invariants)
- `2-stack-context.md` — PostgreSQL non-negotiables, audit log integrity design, migration rules

---

## About This Document

### Scope

This document specifies the complete, target-state PostgreSQL DDL for the eight Phase 1 schemas named in the task brief: `iam`, `organization`, `documents`, `workflow`, `tracking`, `records`, `notifications`, `audit`. It is presented as a single logical script, ordered so that every `REFERENCES` clause points to an object already defined earlier in the document. In actual implementation, Drizzle Kit will generate incremental migration files from schema diffs against this target state (per the forthcoming C5 Migration Strategy document); this document is the authoritative reference for the *resulting structure*, not a literal sequence of migration files.

This document delivers, against the C1 brief verbatim:

| Requirement | Where addressed |
|---|---|
| All columns with types | Every `CREATE TABLE` below |
| NOT NULL constraints | Every column not explicitly marked nullable |
| UNIQUE constraints | Named `uq_*` constraints and partial unique indexes throughout |
| CHECK constraints, including for state transitions | Named `ck_*` constraints (single-row) and `BEFORE UPDATE` trigger functions (cross-row OLD/NEW comparison — see §2.6 below for why transitions cannot be pure `CHECK` constraints) |
| Foreign keys, within schema only | Named `fk_*` constraints; every cross-schema reference is a plain `UUID` column with a `-- logical FK` comment and no constraint (§2.5) |
| All sequences for numbering series | §6.2 (eleven sequences matching H3 Table 2, year 2026) |
| Soft-delete columns on every table | `deleted_at` / `deleted_by` on all 49 tables, with one explicitly-flagged exception discussed in §2.4 |
| `city_id UUID NOT NULL` | On all 49 tables (§2.3) |
| `TIMESTAMPTZ` on all timestamp columns | Throughout |
| UUID v4 primary keys everywhere | `DEFAULT gen_random_uuid()` throughout (§2.2) |

### Explicit Non-Scope

The following are deliberately **not** in this document, because they are the stated scope of other documents in the prerequisite chain (`document-list.md`):

- **Row-Level Security policies.** This document does not call `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or define any `CREATE POLICY` statement. C3 (`PostgreSQL RLS Policy Specifications`) lists C1 as a prerequisite and owns this concern entirely.
- **Performance indexes.** Beyond the indexes required to enforce uniqueness or a structural invariant (e.g., "at most one active definition per document type"), no indexes are added for query-performance reasons alone. C4 (`Index Strategy Document`) owns GIN indexes on JSONB, `owning_office_id`/`status`/`deleted_at` indexes, etc.
- **Seed data (DML).** This document defines table *structure* only. The actual rows for `documents.document_types` (eight rows) and `documents.number_series` (eleven rows) are specified in H2 and H3 respectively; the actual rows for `iam.roles`/`iam.permissions` are I2's job. Seed scripts live in `/tools/scripts` per the monorepo layout (Part 9 of the consolidated reference) and are an implementation task, not reproduced here.
- **Entity-Relationship diagrams.** C2 lists C1 as a prerequisite and owns the Mermaid ERDs.
- **Drizzle ORM schema files.** This document specifies PostgreSQL DDL. Translating it into `/packages/database` Drizzle TypeScript schema definitions is a development task, not a documentation one.

### A Scope Tension Worth Flagging

H2 Implementation Note 10 states that the `portal` schema requires partial Phase 1 initialization (for `citizen_requests` and `complaints`) despite the `portal` module formally being Phase 3. The task brief for this document fixes the schema list to exactly eight schemas and does not include `portal`. This document follows the task brief literally: **`portal` is out of scope here.** Citizen Complaint and Document Request Form are represented in this document only as `documents.document_types` catalog entries (per H2) whose lifecycle rows live in `documents.documents` — the citizen-facing identity and portal-status-view entities (`Citizen`, `PublicDocument`, `Announcement`) are not modeled. The `search_meta` and `reporting` schemas (Phase 2, per Part 10.2) are excluded for the same reason — they are not in the task's eight-schema list. A future schema addendum should resolve the `portal` partial-initialization question explicitly rather than have it resolved implicitly by omission, as it is here.

---

## Part 1 — Conventions

These conventions apply uniformly across every schema in this document. Where a specific table deviates, the deviation is called out at the point it occurs.

### 1.1 Notation

| Tag | Meaning |
|---|---|
| `[Confirmed — source]` | Stated directly in a cited source document |
| `[Inference]` | Reasoned from confirmed facts in the source documents, but not stated verbatim |
| `[Unverified]` | No reliable source for this specific detail; a reasonable placeholder is supplied and flagged for confirmation (matches H2/H3's own use of this tag) |
| `[Gap-fill]` | A column, table, or mechanism that a source document's *prose* clearly requires (often visible only in pseudocode or a behavioral description) but that the same document's *formal data-model section* omitted. Specific to this document, since C1 is the first place these gaps become visible as missing columns rather than missing sentences. |

### 1.2 Primary Keys

Every table has `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. `gen_random_uuid()` produces a version 4 (random) UUID and is a built-in PostgreSQL function from version 13 onward — no extension is strictly required on a modern server, but `pgcrypto` is created defensively in §0 in case an older minor build is targeted.

### 1.3 Tenant Isolation — `city_id`

Every table — not only the entities the source documents call "core" — carries `city_id UUID NOT NULL`. The task brief requires it on "all core entity tables"; this document applies it to every table without exception, including join tables and append-only logs. The reason is forward-looking: C3's RLS policies will almost certainly filter by `city_id` on every table, and a uniform column means every RLS policy has the same shape with no special-cased joins to reach a parent table's `city_id`. `city_id` is a plain `UUID` column with no FK — it is a multi-tenant anchor, not a relationship to a `city` entity that exists anywhere in this schema (the city UUID is seeded via `CITY_ID` per L1 §4, not stored as its own row).

### 1.4 Timestamps

Every timestamp column is `TIMESTAMPTZ`. `created_at` defaults to `now()`. `updated_at`, where present, defaults to `now()` and is maintained automatically by the generic trigger in §0.4 — application code never sets it directly. Tables that are genuinely append-only and immutable by design (`workflow.workflow_events`, `audit.events`, `tracking.routing_entries`, `notifications.delivery_log`) deliberately **omit** `updated_at` — there is nothing to update, and including the column would imply a mutability the table does not have. `created_at` (or, for `audit.events`, `occurred_at` alone) serves as the row's single immutable timestamp in those cases.

### 1.5 Soft Delete

Every table carries `deleted_at TIMESTAMPTZ NULL` and `deleted_by UUID NULL` (logical FK to `iam.users.id`), per Architectural Invariant #2 (no hard deletes) and the explicit task requirement. `b4-workflow-engine-specification.md` itself only added these "on tables that support deletion semantics" (its own §2 preamble) — this document overrides that narrower framing in favor of the task brief's literal "on every table," for schema-wide consistency.

**One explicit, deliberate exception in spirit rather than column presence:** `audit.events` carries `deleted_at`/`deleted_by` columns for schema-wide tooling consistency, but they are **structurally inert**. `UPDATE` is revoked from `audit_user` at the database-grant level (§9), which means there is no role capable of ever setting these columns to a non-null value in normal operation. They exist so that generic tooling expecting the platform-wide column set does not need a special case for one table; they should never actually be populated. This is called out again at the table definition itself.

### 1.6 Cross-Schema References — Architectural Invariant #1

This is the single most load-bearing convention in this document. **A column that conceptually references a row in a *different* schema is always a plain `UUID` column with no `REFERENCES` clause and no `FOREIGN KEY` constraint.** It carries an inline comment of the form:

```sql
originating_office_id  UUID NOT NULL,  -- logical FK -> organization.offices.id (cross-schema; no DB constraint, Invariant #1)
```

This is not a stylistic choice — it is the literal mechanism by which Architectural Invariant #1 ("Schema-per-module; no cross-schema foreign keys") is satisfied at the DDL level, and it is enforced separately (not by this document) by automated migration linting per the consolidated reference, Part 12.

Two further conventions for cross-schema columns:

- **Audit-trail actor columns** (`created_by`, `assigned_by`, `approved_by`, `revoked_by`, `cancelled_by`, `bypassed_by`, `completed_by`, `deleted_by`, etc.) are, unless the column name says otherwise, a logical FK to `iam.users.id`. This blanket rule is stated once here rather than repeated at every one of the ~60 occurrences across the 49 tables. The Cross-Schema Reference Index (Part 10) lists only the *non-blanket*, structurally significant cross-references.
- **JSONB-embedded UUID references** (e.g., `documents.documents.metadata->>'certification_of_urgency_document_id'`, `workflow.step_instances.assigned_to[].user_id`) are a third category, distinct from both same-schema FKs and logical-FK columns. PostgreSQL cannot enforce referential integrity inside a JSONB value at all, by any column-level mechanism — this is stated explicitly in H2 Implementation Note 4 and is not re-litigated here. These are noted at the relevant table but are not part of the Cross-Schema Reference Index, since they are not even informally-typed columns.

### 1.7 Same-Schema Foreign Keys

Where both tables in a relationship live in the same schema, a real, named `FOREIGN KEY` constraint is used — the task brief is explicit that within-schema FKs are expected, only *cross*-schema ones are prohibited. The default action is `ON DELETE RESTRICT` uniformly. Because the no-hard-delete invariant means `DELETE` statements against these tables should essentially never execute in normal operation, the choice of `ON DELETE` behavior is mostly a defensive backstop; `RESTRICT` is the most conservative choice and is used everywhere rather than selecting `CASCADE` or `SET NULL` case-by-case.

One deliberate exception to "FK by primary key": `workflow.transition_rules.from_step_id` / `to_step_id` use a **composite foreign key** against `workflow.steps (definition_version_id, id)` rather than a simple FK against `workflow.steps(id)`. This is explained in full at §5.4 — it converts B4 Engine Invariant #12 ("no transition may point to a step from a different definition version") from an application-level check into a real, DB-enforced constraint, which is a strict improvement over B4's own stated enforcement mechanism for that invariant.

### 1.8 Enum Casing

PostgreSQL `ENUM` types are used for closed, code-significant value sets. All enum values use `lower_snake_case`. This is a deliberate normalization: B4's own enum definitions (§2.3, §2.8) are already lowercase (`action`, `approval`, `pending`, `completed`, …), while D4's prose and the consolidated reference's prose render the same concepts in PascalCase or Title Case with separators (`InWorkflow`, `In-Workflow`). This document follows B4's precedent, since B4 is itself DDL-adjacent and the only one of the five reviewed documents to define literal enum syntax. The PascalCase/Title-Case renderings elsewhere are presentation-layer (UI/i18n) concerns, not storage format.

Fields that are explicitly **Administrator-configurable without developer involvement** (per consolidated reference Part 11.21, Tier 2) are deliberately **not** native `ENUM` types, even where the underlying value set looks closed — adding a value to a Postgres `ENUM` is itself a schema migration, which contradicts "no developer." Where this distinction matters for a specific column, it is called out there.

### 1.9 CHECK Constraints and State Transitions

A native PostgreSQL `CHECK` constraint validates a single row in isolation; it has no access to the row's prior values. It **cannot** express "valid transition from state X to state Y," because that comparison requires `OLD` and `NEW`, which only a trigger can see. Three tables in this schema have a documented state-transition graph (`documents.documents.lifecycle_state`, `workflow.instances.status`, `workflow.step_instances.status`); for these, "CHECK for state transitions" is implemented as a `BEFORE UPDATE` trigger function that raises an exception on an illegal `OLD.status → NEW.status` jump. This satisfies the same "second line of defense at the DB level" intent that `2-stack-context.md` describes under "Check constraints for state transitions," using the only mechanism PostgreSQL actually offers for it. Plain `CHECK` constraints are still used extensively throughout this document for same-row invariants that do not involve a transition (value ranges, non-empty-comment requirements, mutual-exclusivity rules).

### 1.10 Naming

All identifiers are `lower_snake_case`. Constraints are explicitly named with a prefix convention: `pk_` (rarely needed explicitly, since `PRIMARY KEY` inline is unambiguous), `fk_`, `uq_`, `ck_`, `idx_` for indexes that are not themselves a named constraint. Explicit names exist so that a future migration can `ALTER TABLE ... DROP CONSTRAINT <name>` precisely, consistent with the change-discipline the forthcoming C5 document is expected to formalize.

### 1.11 Where Source Documents Conflict

Several places in this document resolve a genuine disagreement between two of the five reviewed source documents — most often between D4 (an explicitly abstract "domain model, not a database schema diagram," per D4's own framing) and a more implementation-specific document (B4 for `workflow`, H2 for `documents`). In every such case, this document follows the more specific, more recently-detailed source and states the resolution at the point of conflict, the same way H2 itself resolves tensions with footnotes. A consolidated list of every such resolution is in Part 11.

---

## Part 0 — Extensions, Roles, and Schemas

### 0.1 Extension

```sql
-- Defensive only: gen_random_uuid() is a built-in function from PostgreSQL 13
-- onward and pgcrypto is not strictly required on a modern target. Created
-- here in case an older minor build is encountered during on-premise migration.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### 0.2 Database Roles

Three roles, matching `l1-env-catalog.md` §5.1 exactly (`DATABASE_URL_APP`, `DATABASE_URL_AUDIT`, `DATABASE_URL_MIGRATE`). Actual passwords are never embedded in this document or in version control — they are set post-creation via `ALTER ROLE ... WITH PASSWORD '...'` from the secrets vault described in L1 §23. `PASSWORD NULL` below is the literal, valid PostgreSQL syntax for "no password configured yet," used only as a placeholder at role-creation time.

```sql
-- migrate_user: DDL only. Owns every schema below. Never used at application
-- runtime (L1 §5.1: "This role has DDL privileges. It is never used at
-- application runtime.").
CREATE ROLE migrate_user WITH LOGIN PASSWORD NULL;

-- app_user: SELECT/INSERT/UPDATE/DELETE on every schema EXCEPT audit, where
-- it has NO access at all — not even SELECT (L1 §5.1). Audit reads, like
-- audit writes, go through the Audit module's own service code over the
-- audit_user connection (Architectural Law #3).
CREATE ROLE app_user WITH LOGIN PASSWORD NULL;

-- audit_user: INSERT and SELECT only on the audit schema. UPDATE and DELETE
-- are revoked explicitly in Part 9, even though they are not granted by
-- default, as a documentation-level statement of intent matching B4
-- Engine Invariant #13 and 2-stack-context.md's audit log design.
CREATE ROLE audit_user WITH LOGIN PASSWORD NULL;
```

### 0.3 Schemas

```sql
CREATE SCHEMA iam            AUTHORIZATION migrate_user;
CREATE SCHEMA organization   AUTHORIZATION migrate_user;
CREATE SCHEMA documents      AUTHORIZATION migrate_user;
CREATE SCHEMA workflow       AUTHORIZATION migrate_user;
CREATE SCHEMA tracking       AUTHORIZATION migrate_user;
CREATE SCHEMA records        AUTHORIZATION migrate_user;
CREATE SCHEMA notifications  AUTHORIZATION migrate_user;
CREATE SCHEMA audit          AUTHORIZATION migrate_user;
```

### 0.4 Generic `updated_at` Trigger Function

A single, schema-agnostic trigger function maintains `updated_at` on every mutable table. It is placed in `public` (the one schema every PostgreSQL database has by default) rather than duplicated eight times or owned by one business module, because it touches no business data and is pure infrastructure — using it does not create a module-boundary dependency in the sense Architectural Law #2 is concerned with (no schema's *data* is read or written by another schema's module through this function).

```sql
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
```

Every table below that has an `updated_at` column gets a `BEFORE UPDATE ... EXECUTE FUNCTION public.fn_set_updated_at()` trigger immediately after its `CREATE TABLE` statement. This is not repeated as prose at every table — only the trigger statement itself appears.

---

## Part 2 — Schema `iam`

**Owning module:** IAM (B2 Module 1). **Responsibility:** authentication, session control, JWT/refresh-token lifecycle, role and permission resolution. **Tables:** `users`, `credentials`, `sessions`, `refresh_tokens`, `roles`, `permissions`, `role_permissions`, `role_assignments`, `mfa_records` — nine tables, matching B2's table list with the two many-to-many relationships D4 shows as plain associations (`User *--* Role`, `Role *--* Permission`) made explicit as join tables.

This schema has exactly one cross-schema outbound reference (`role_assignments.office_scope_id` → `organization.offices`) and is otherwise self-contained — every other module in the platform references *into* `iam.users`, not the reverse.

### 2.1 Types

```sql
CREATE TYPE iam.user_status_enum AS ENUM (
    'active', 'inactive', 'suspended', 'deactivated'
);
-- [Confirmed — D4 UserStatus]

CREATE TYPE iam.mfa_type_enum AS ENUM (
    'totp'
);
-- [Inference] Only TOTP is wired in Phase 1 (L1 §6.5, AUTH_MFA_TOTP_*).
-- Single-value enum now; expand if a second MFA method is ever introduced
-- (e.g. recovery codes), which would itself be a developer-tier change.

CREATE TYPE iam.session_termination_reason_enum AS ENUM (
    'user_logout', 'forced', 'timeout'
);
-- [Confirmed — consolidated reference Part 11.17: "forced" = IT/security
-- admin terminates; "timeout" = inactivity; "user_logout" = self-initiated.]
```

### 2.2 `iam.users`

Source: B2 §Module 1; D4 entity `User`. Root identity record for every system user with platform login access (LGU employees, Platform/System Administrators). Citizens are **not** represented here — citizen identity is a `portal`-schema concern, out of scope (see "A Scope Tension Worth Flagging" above).

```sql
CREATE TABLE iam.users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID NOT NULL,
    username        TEXT NOT NULL,
    email           TEXT NOT NULL,
    status          iam.user_status_enum NOT NULL DEFAULT 'active',
    mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID NULL,

    CONSTRAINT uq_users_city_username UNIQUE (city_id, username),
    CONSTRAINT uq_users_city_email UNIQUE (city_id, email)
);

CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON iam.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 2.3 `iam.credentials`

Source: D4 entity `Credential`, `User "1" *-- "1" Credential`. Holds the Argon2id password hash, separated from `users` so that credential rotation and password-policy logic do not require touching the identity row itself.

```sql
CREATE TABLE iam.credentials (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID NOT NULL,
    user_id             UUID NOT NULL,
    password_hash       TEXT NOT NULL,
    last_changed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID NULL,

    CONSTRAINT fk_credentials_user
        FOREIGN KEY (user_id) REFERENCES iam.users (id) ON DELETE RESTRICT,
    CONSTRAINT uq_credentials_user UNIQUE (user_id)
);

CREATE TRIGGER trg_credentials_set_updated_at
    BEFORE UPDATE ON iam.credentials
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 2.4 `iam.sessions`

Source: D4 entity `Session`; consolidated reference Part 11.17 (single active session per user, forced logout, "Switch User / Lock Screen"). Represents the logical browser/device session used for single-active-session enforcement — distinct from the JWT access token (never persisted) and from refresh tokens (§2.5, rotated independently).

`session_token_hash` stores a hash, not the raw session identifier, consistent with the project's general "never store sensitive tokens in plaintext" posture for `refresh_tokens.token_hash` — D4 itself names the attribute `sessionToken` without specifying hashing, but this document applies the stricter, more defensible pattern. `[Inference]`

```sql
CREATE TABLE iam.sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                 UUID NOT NULL,
    user_id                 UUID NOT NULL,
    session_token_hash      TEXT NOT NULL,
    ip_address              INET NULL,
    user_agent              TEXT NULL,
    expires_at              TIMESTAMPTZ NOT NULL,
    terminated_at           TIMESTAMPTZ NULL,
    terminated_by           UUID NULL,  -- logical FK -> iam.users.id; the IT/security admin for 'forced' (self-schema, but no FK named here — see note below)
    termination_reason      iam.session_termination_reason_enum NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ NULL,
    deleted_by              UUID NULL,

    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id) REFERENCES iam.users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_sessions_terminated_by
        FOREIGN KEY (terminated_by) REFERENCES iam.users (id) ON DELETE RESTRICT,
    CONSTRAINT uq_sessions_token_hash UNIQUE (session_token_hash),
    CONSTRAINT ck_sessions_termination_consistency
        CHECK (
            (terminated_at IS NULL AND termination_reason IS NULL) OR
            (terminated_at IS NOT NULL AND termination_reason IS NOT NULL)
        )
);

CREATE TRIGGER trg_sessions_set_updated_at
    BEFORE UPDATE ON iam.sessions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

`terminated_by` *is* given a real FK here (rather than treated as a logical-only reference) because it targets `iam.users` from within the `iam` schema itself — same-schema, so a real constraint is correct and required by §1.7, not an exception to the cross-schema rule.

### 2.5 `iam.refresh_tokens`

Source: D4 entity `RefreshToken`; consolidated reference Part 11.1 (server-side storage, rotated on every refresh). `replaced_by_token_id` is a `[Inference]` addition — D4 lists only `tokenHash`, `expiresAt`, `isRevoked`, but "rotated on every refresh" (Part 11.1) is not fully traceable without a pointer from the old token to its replacement.

```sql
CREATE TABLE iam.refresh_tokens (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                 UUID NOT NULL,
    user_id                 UUID NOT NULL,
    session_id              UUID NULL,
    token_hash              TEXT NOT NULL,
    expires_at              TIMESTAMPTZ NOT NULL,
    is_revoked              BOOLEAN NOT NULL DEFAULT false,
    replaced_by_token_id    UUID NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ NULL,
    deleted_by              UUID NULL,

    CONSTRAINT fk_refresh_tokens_user
        FOREIGN KEY (user_id) REFERENCES iam.users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_refresh_tokens_session
        FOREIGN KEY (session_id) REFERENCES iam.sessions (id) ON DELETE RESTRICT,
    CONSTRAINT fk_refresh_tokens_replaced_by
        FOREIGN KEY (replaced_by_token_id) REFERENCES iam.refresh_tokens (id) ON DELETE RESTRICT,
    CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash)
);
```

No `updated_at` — a refresh token's only mutable field (`is_revoked`) is set exactly once on rotation/revocation and the row's history is fully recoverable from `replaced_by_token_id`; treating it as append-only-after-creation keeps the rotation chain auditable without a separate log table. `[Inference]`

### 2.6 `iam.roles`

Source: D4 entity `Role`.

```sql
CREATE TABLE iam.roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID NOT NULL,
    name            TEXT NOT NULL,
    code            TEXT NOT NULL,
    description     TEXT NULL,
    is_system_role  BOOLEAN NOT NULL DEFAULT false,  -- [Inference] distinguishes Tier 1 hardcoded roles (Part 11.8) from admin-defined ones
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID NULL,

    CONSTRAINT uq_roles_city_code UNIQUE (city_id, code)
);

CREATE TRIGGER trg_roles_set_updated_at
    BEFORE UPDATE ON iam.roles
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 2.7 `iam.permissions`

Source: D4 entity `Permission` (`resource`, `action`).

```sql
CREATE TABLE iam.permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID NOT NULL,
    resource        TEXT NOT NULL,
    action          TEXT NOT NULL,
    description     TEXT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID NULL,

    CONSTRAINT uq_permissions_city_resource_action UNIQUE (city_id, resource, action)
);

CREATE TRIGGER trg_permissions_set_updated_at
    BEFORE UPDATE ON iam.permissions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 2.8 `iam.role_permissions`

Source: D4 association `Role "*" --> "*" Permission : grants`. This is also the physical home of the I2 Role-Permission Matrix's per-cell decision (Allow / Deny / Conditional), per `document-list.md`'s description of I2: "Mark each cell: Allow, Deny, or Conditional (with condition reference to I1)."

```sql
CREATE TYPE iam.permission_decision_enum AS ENUM (
    'allow', 'deny', 'conditional'
);
-- [Confirmed — document-list.md description of I2]

CREATE TABLE iam.role_permissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID NOT NULL,
    role_id             UUID NOT NULL,
    permission_id       UUID NOT NULL,
    decision            iam.permission_decision_enum NOT NULL DEFAULT 'allow',
    condition_reference TEXT NULL,  -- references an I1 ABAC policy key when decision = 'conditional'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID NULL,

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES iam.roles (id) ON DELETE RESTRICT,
    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES iam.permissions (id) ON DELETE RESTRICT,
    CONSTRAINT uq_role_permissions_role_permission UNIQUE (role_id, permission_id),
    CONSTRAINT ck_role_permissions_condition_required
        CHECK (decision <> 'conditional' OR condition_reference IS NOT NULL)
);

CREATE TRIGGER trg_role_permissions_set_updated_at
    BEFORE UPDATE ON iam.role_permissions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 2.9 `iam.role_assignments`

Source: D4 association `User "*" --> "*" Role : assigned`; B2 IAM domain events `role.assigned` / `role.revoked` (payload fields `userId`, `roleId`, `roleName`, `assignedBy`, `officeScope?`, `revokedBy`) — these payload fields are the basis for this table's column list, since D4's class diagram shows the association without its own attributes.

```sql
CREATE TABLE iam.role_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID NOT NULL,
    user_id             UUID NOT NULL,
    role_id             UUID NOT NULL,
    office_scope_id     UUID NULL,  -- logical FK -> organization.offices.id (cross-schema; no DB constraint, Invariant #1). B2 event payload field "officeScope?"
    assigned_by         UUID NULL,  -- logical FK -> iam.users.id; same-schema target, but see note below
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at          TIMESTAMPTZ NULL,
    revoked_by          UUID NULL,
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID NULL,

    CONSTRAINT fk_role_assignments_user
        FOREIGN KEY (user_id) REFERENCES iam.users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_role_assignments_role
        FOREIGN KEY (role_id) REFERENCES iam.roles (id) ON DELETE RESTRICT,
    CONSTRAINT fk_role_assignments_assigned_by
        FOREIGN KEY (assigned_by) REFERENCES iam.users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_role_assignments_revoked_by
        FOREIGN KEY (revoked_by) REFERENCES iam.users (id) ON DELETE RESTRICT,
    CONSTRAINT ck_role_assignments_revocation_consistency
        CHECK (is_active = true OR revoked_at IS NOT NULL)
);

-- Partial unique index: a user may not hold two simultaneous *active*
-- assignments of the same role at the same office scope. NULL office_scope_id
-- (a city-wide / unscoped assignment) is coalesced to a sentinel UUID so that
-- Postgres's "NULLs are distinct" unique-index behavior does not silently
-- allow duplicate unscoped assignments.
CREATE UNIQUE INDEX uq_role_assignments_active
    ON iam.role_assignments (user_id, role_id, COALESCE(office_scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE is_active = true AND deleted_at IS NULL;
```

`assigned_by` allows `NULL` to accommodate the initial bootstrap/seed-time role assignment (e.g., the first Platform Administrator), which has no human assigner. No `updated_at` — every mutation this row undergoes (`is_active`/`revoked_*`) is itself a discrete, timestamped, audited business event (`role.revoked`), not a generic "this row changed" fact; the revocation fields already capture the only state change that matters.

### 2.10 `iam.mfa_records`

Source: D4 entity `MfaRecord`; `User "1" *-- "0..1" MfaRecord`. Schema-reserved in Phase 1 per L1 §6.5 ("MFA infrastructure is wired into the authentication flow in Phase 1 but not enforced until Phase 2") — D4 itself lists this entity's phase as 2, but the *table* must exist in Phase 1 so the auth flow can be built against it from day one, consistent with `FEATURE_MFA_ENABLED` defaulting to `false` rather than the column set not existing at all.

```sql
CREATE TABLE iam.mfa_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID NOT NULL,
    user_id             UUID NOT NULL,
    mfa_type            iam.mfa_type_enum NOT NULL DEFAULT 'totp',
    secret_encrypted    TEXT NULL,  -- encrypted by application logic before storage; not pgcrypto-encrypted at the DB layer
    is_active           BOOLEAN NOT NULL DEFAULT false,
    activated_at        TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID NULL,

    CONSTRAINT fk_mfa_records_user
        FOREIGN KEY (user_id) REFERENCES iam.users (id) ON DELETE RESTRICT,
    CONSTRAINT uq_mfa_records_user UNIQUE (user_id),
    CONSTRAINT ck_mfa_records_activation_consistency
        CHECK (is_active = false OR (secret_encrypted IS NOT NULL AND activated_at IS NOT NULL))
);

CREATE TRIGGER trg_mfa_records_set_updated_at
    BEFORE UPDATE ON iam.mfa_records
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

**`iam` schema complete — 9 tables: `users`, `credentials`, `sessions`, `refresh_tokens`, `roles`, `permissions`, `role_permissions`, `role_assignments`, `mfa_records`.**

---

## Part 3 — Schema `organization`

**Owning module:** Organization (B2 Module 2). **Responsibility:** office hierarchy, employee records, position assignments, committee structure, and delegation management. **Tables:** `offices`, `positions`, `employees`, `assignments`, `delegation_grants`, `committees`, `committee_memberships` — seven tables. D4 places `Committee` and `CommitteeMembership` under this module's section (D4 Relationship Note 8 explicitly anticipates this), even though the consolidated reference's top-level schema map (Part 9/10.2) does not list them by name; they are included here on D4's authority since they have no more specific competing source and a real implementation need (committee membership drives `multi_referral` step assignee resolution in `workflow`).

Per consolidated reference Part 11.13/4.12, **delegation is a routine, high-frequency, first-class feature** (10+ Acting-Mayor designations/year), not an edge case — `delegation_grants` is written and queried far more than its modest column count might suggest.

### 3.1 Types

```sql
CREATE TYPE organization.office_type_enum AS ENUM (
    'sp_office', 'mayors_office', 'city_department', 'barangay', 'other'
);
-- [Unverified] D4 lists an OfficeType enum on Office but does not enumerate
-- its values anywhere in this document's reviewed sources. These five values
-- are a reasonable placeholder derived from Part 1's LGU scope (SP Office,
-- Mayor's Office, City Hall departments, Barangays) and should be confirmed
-- against B1/B5 (not in this document's reviewed set) before Phase 1 seed.

CREATE TYPE organization.authority_level_enum AS ENUM (
    'executive', 'managerial', 'staff', 'support'
);
-- [Unverified] Same situation as office_type_enum: D4 names an AuthorityLevel
-- enum on Position without listing values. Placeholder pending confirmation.

CREATE TYPE organization.committee_role_enum AS ENUM (
    'chairman', 'vice_chairman', 'member'
);
-- [Confirmed — D4 CommitteeRole enum]
```

### 3.2 `organization.offices`

Source: D4 entity `Office`. Self-referential for the office hierarchy (`Office "*" --> "0..1" Office : parentOf`), which `iam`'s ABAC engine consumes via `Organization.getOfficeHierarchy()` (B2 Published API).

```sql
CREATE TABLE organization.offices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID NOT NULL,
    name                TEXT NOT NULL,
    code                TEXT NOT NULL,
    office_type         organization.office_type_enum NOT NULL,
    parent_office_id    UUID NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID NULL,

    CONSTRAINT fk_offices_parent
        FOREIGN KEY (parent_office_id) REFERENCES organization.offices (id) ON DELETE RESTRICT,
    CONSTRAINT uq_offices_city_code UNIQUE (city_id, code),
    CONSTRAINT ck_offices_not_self_parent CHECK (parent_office_id IS DISTINCT FROM id)
);

CREATE TRIGGER trg_offices_set_updated_at
    BEFORE UPDATE ON organization.offices
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 3.3 `organization.positions`

Source: D4 entity `Position`; `Office "1" *-- "*" Position`.

```sql
CREATE TABLE organization.positions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID NOT NULL,
    office_id           UUID NOT NULL,
    title               TEXT NOT NULL,
    code                TEXT NOT NULL,
    authority_level     organization.authority_level_enum NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID NULL,

    CONSTRAINT fk_positions_office
        FOREIGN KEY (office_id) REFERENCES organization.offices (id) ON DELETE RESTRICT,
    CONSTRAINT uq_positions_city_code UNIQUE (city_id, code)
);

CREATE TRIGGER trg_positions_set_updated_at
    BEFORE UPDATE ON organization.positions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 3.4 `organization.employees`

Source: D4 entity `Employee`; `Employee "1" --> "0..1" User : hasAccount`. `user_id` is nullable because Barangay officials explicitly have **no** system access in Phase 1 (consolidated reference Part 4.4) — they exist as `employees` rows (so they can be a `delegation_grants` party, a `Designation` subject, or an attendance/committee record) without ever having a corresponding `iam.users` row.

```sql
CREATE TABLE organization.employees (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID NOT NULL,
    user_id             UUID NULL,  -- logical FK -> iam.users.id (cross-schema; no DB constraint, Invariant #1). NULL for system-access-less employees (e.g. Barangay officials, Part 4.4)
    employee_number     TEXT NULL,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    email                TEXT NULL,
    phone_number        TEXT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID NULL,

    CONSTRAINT uq_employees_user UNIQUE (user_id)
);

CREATE UNIQUE INDEX uq_employees_city_employee_number
    ON organization.employees (city_id, employee_number)
    WHERE employee_number IS NOT NULL;

CREATE TRIGGER trg_employees_set_updated_at
    BEFORE UPDATE ON organization.employees
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 3.5 `organization.assignments`

Source: D4 entity `Assignment`; `Employee "1" *-- "*" Assignment`, `Assignment "*" --> "1" Position : atPosition`, `Assignment "*" --> "1" Office : inOffice`.

A blanket "only one active assignment per position" partial unique index was considered and rejected: many positions (e.g., "City Councilor") are legitimately held by multiple people simultaneously (12 of 12 councilors), while singular positions (Mayor, Vice Mayor, SP Secretary) are not — and `positions` has no `is_singular` flag to discriminate the two cases at the DB level. Enforcing "exactly one active holder" for singular positions is therefore an **application-level** invariant (the `resolveCurrentHolder()` published API caller's responsibility), not a DB constraint, and is noted here rather than encoded incorrectly. `[Inference]`

```sql
CREATE TABLE organization.assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID NOT NULL,
    employee_id     UUID NOT NULL,
    position_id     UUID NOT NULL,
    office_id       UUID NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID NULL,

    CONSTRAINT fk_assignments_employee
        FOREIGN KEY (employee_id) REFERENCES organization.employees (id) ON DELETE RESTRICT,
    CONSTRAINT fk_assignments_position
        FOREIGN KEY (position_id) REFERENCES organization.positions (id) ON DELETE RESTRICT,
    CONSTRAINT fk_assignments_office
        FOREIGN KEY (office_id) REFERENCES organization.offices (id) ON DELETE RESTRICT,
    CONSTRAINT ck_assignments_date_order
        CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TRIGGER trg_assignments_set_updated_at
    BEFORE UPDATE ON organization.assignments
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 3.6 `organization.delegation_grants`

Source: D4 entity `DelegationGrant`; B2 `DelegationSummary` type; H2's Designation JSONB schema (`delegating_authority_user_id`, `designated_person_user_id`, `scope_description`, `effective_from`/`effective_until`, `legal_basis`, `delegation_grant_id` back-reference); Architectural Invariant #16 ("one active designation per person").

D4 models the two parties as `Employee`, not `User` (`DelegationGrant "*" --> "1" Employee : delegatedBy/delegatedTo`) — this document follows D4 here rather than H2's `*_user_id` naming, since the FK target needs to be a real, same-schema constraint, and `organization.employees` (not `iam.users`) is the table that lives in this schema. The Designation *document*'s own JSONB (H2) separately denormalizes the user-facing display names at the time of issuance, per H2 Implementation Note 5.

```sql
CREATE TABLE organization.delegation_grants (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                     UUID NOT NULL,
    designation_document_id     UUID NOT NULL,  -- logical FK -> documents.documents.id (cross-schema; no DB constraint, Invariant #1). The "D {YEAR}-{NN}" document evidencing this grant.
    delegating_employee_id      UUID NOT NULL,
    delegated_to_employee_id    UUID NOT NULL,
    office_id                   UUID NOT NULL,
    position_id                 UUID NOT NULL,
    scope_description           TEXT NOT NULL,
    legal_basis                 TEXT NULL,
    valid_from                  DATE NOT NULL,
    valid_until                 DATE NOT NULL,  -- NOT NULL: open-ended delegations are prohibited (Part 11.13)
    is_active                   BOOLEAN NOT NULL DEFAULT true,
    revoked_at                  TIMESTAMPTZ NULL,
    revoked_by                  UUID NULL,  -- logical FK -> iam.users.id (cross-schema; no DB constraint, Invariant #1)
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                  TIMESTAMPTZ NULL,
    deleted_by                  UUID NULL,

    CONSTRAINT fk_delegation_grants_delegating_employee
        FOREIGN KEY (delegating_employee_id) REFERENCES organization.employees (id) ON DELETE RESTRICT,
    CONSTRAINT fk_delegation_grants_delegated_to_employee
        FOREIGN KEY (delegated_to_employee_id) REFERENCES organization.employees (id) ON DELETE RESTRICT,
    CONSTRAINT fk_delegation_grants_office
        FOREIGN KEY (office_id) REFERENCES organization.offices (id) ON DELETE RESTRICT,
    CONSTRAINT fk_delegation_grants_position
        FOREIGN KEY (position_id) REFERENCES organization.positions (id) ON DELETE RESTRICT,
    CONSTRAINT ck_delegation_grants_distinct_parties
        CHECK (delegating_employee_id <> delegated_to_employee_id),
    CONSTRAINT ck_delegation_grants_date_order
        CHECK (valid_until >= valid_from)
);

-- Architectural Invariant #16, enforced exactly as the invariant table
-- prescribes: "Application-level validation + DB partial unique index on
-- active delegation_grants per user."
CREATE UNIQUE INDEX uq_delegation_grants_one_active_per_delegatee
    ON organization.delegation_grants (delegated_to_employee_id)
    WHERE is_active = true AND deleted_at IS NULL;

CREATE TRIGGER trg_delegation_grants_set_updated_at
    BEFORE UPDATE ON organization.delegation_grants
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 3.7 `organization.committees`

Source: D4 entity `Committee`; consolidated reference Part 6 (22 standing committees, 7th SP).

```sql
CREATE TABLE organization.committees (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                     UUID NOT NULL,
    name                        TEXT NOT NULL,
    code                        TEXT NOT NULL,
    chaired_by_employee_id      UUID NULL,  -- [Inference] nullable for transient vacancy during chair reassignment, despite D4's strict "1" multiplicity
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                  TIMESTAMPTZ NULL,
    deleted_by                  UUID NULL,

    CONSTRAINT fk_committees_chaired_by
        FOREIGN KEY (chaired_by_employee_id) REFERENCES organization.employees (id) ON DELETE RESTRICT,
    CONSTRAINT uq_committees_city_code UNIQUE (city_id, code)
);

CREATE TRIGGER trg_committees_set_updated_at
    BEFORE UPDATE ON organization.committees
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 3.8 `organization.committee_memberships`

Source: D4 entity `CommitteeMembership` (`role`, `startDate`, `isActive` — no `endDate` attribute is listed in D4, and none is added here, for fidelity).

```sql
CREATE TABLE organization.committee_memberships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID NOT NULL,
    committee_id    UUID NOT NULL,
    employee_id     UUID NOT NULL,
    committee_role  organization.committee_role_enum NOT NULL,
    start_date      DATE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID NULL,

    CONSTRAINT fk_committee_memberships_committee
        FOREIGN KEY (committee_id) REFERENCES organization.committees (id) ON DELETE RESTRICT,
    CONSTRAINT fk_committee_memberships_employee
        FOREIGN KEY (employee_id) REFERENCES organization.employees (id) ON DELETE RESTRICT
);

-- One active membership row per (committee, employee) at a time — a person
-- holds exactly one role on a given committee at any moment, even though
-- they may be promoted (Member -> Vice Chairman) over time via separate rows.
CREATE UNIQUE INDEX uq_committee_memberships_active
    ON organization.committee_memberships (committee_id, employee_id)
    WHERE is_active = true AND deleted_at IS NULL;

CREATE TRIGGER trg_committee_memberships_set_updated_at
    BEFORE UPDATE ON organization.committee_memberships
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

**`organization` schema complete — 7 tables: `offices`, `positions`, `employees`, `assignments`, `delegation_grants`, `committees`, `committee_memberships`.**

---

## Part 4 — Schema `documents`

**Owning module:** Documents (B2 Module 3). **Responsibility:** document lifecycle state machine, immutable versioning, two-stage series numbering, OCR-on-upload metadata, QR cover sheet generation, Secretariat decision logging. **Tables:** `document_types`, `number_series`, `documents`, `versions`, `attachments`, `numbers`, `signatures`, `panlalawigan_reviews` — eight tables, using the literal short table names from the consolidated reference's own schema map (Part 9/10.2: "`documents → document_types, documents, versions, attachments, numbers, number_series, signatures`") plus one addition (`panlalawigan_reviews`) justified at §4.8.

### 4.1 Three Resolutions Made Before Any DDL in This Schema

D4 models several entities that conflict with H2's more specific, more detailed physical-storage guidance. Per Convention §1.11, the more specific source wins in every case below, and the resolution is stated once here rather than repeated at each table:

1. **`DocumentSponsorship` and `PublicationRecord`** (D4 classes) are **not** separate tables. H2's JSON Schemas for `SP_RESOLUTION`/`SP_ORDINANCE` explicitly place `sponsors` (an array) and `publication` (an object) *inside* `documents.documents.metadata` JSONB. H2 is the specific, itemized source for what actually lives in that column; D4's own preamble disclaims that it is "a domain model, not a database schema diagram." No `document_sponsorships` or `publication_records` table is created.
2. **`CertificationOfUrgency` and `TransmittalLetter`** (D4 classes) are **not** separate tables either. D4 Note 6 describes the Certification of Urgency as "stored as a typed attachment," but H2 is explicit and detailed to the point of giving the Certification its own `documents.document_types` catalog row, its own JSON Schema, and the statement that "`documents.final_number` and `documents.control_number` are both NULL for Certification of Urgency records" — language that only makes sense if the Certification *is* a `documents.documents` row. This document follows H2: both are realized purely as `document_types` rows whose lifecycle data lives in `documents.documents`, with no dedicated table.
3. **`DocumentNumber`** (D4 class, with an `isCurrent` flag) and H2's denormalized `preliminary_number`/`final_number` columns directly on `documents.documents` are **both implemented**, as complementary rather than conflicting designs: `documents.numbers` (§4.6) is the append-only *history* of every numbering event (satisfying D4's `isCurrent`-flagged, one-to-many model and the consolidated reference's "preliminary numbers can be replaced" rule), while the two columns on `documents.documents` are denormalized *current-value* mirrors for fast, join-free access, kept in sync by the same application/database-function write path (§4.9).

### 4.2 Types

```sql
CREATE TYPE documents.lifecycle_state_enum AS ENUM (
    'draft', 'submitted', 'in_workflow', 'pending_approval',
    'completed', 'released', 'archived', 'disposed', 'cancelled'
);
-- [Confirmed — consolidated reference Part 11.4, lower_snake_case per Convention §1.8]

CREATE TYPE documents.classification_level_enum AS ENUM (
    'public', 'internal', 'confidential', 'restricted'
);
-- [Confirmed — consolidated reference Part 11.4]

CREATE TYPE documents.public_visibility_rule_enum AS ENUM (
    'title_and_first_page_public', 'not_public',
    'complainant_restricted', 'requester_restricted'
);
-- [Confirmed — H2 "Public Visibility Rule Definitions"]

CREATE TYPE documents.owning_module_enum AS ENUM (
    'iam', 'organization', 'documents', 'workflow', 'tracking',
    'records', 'notifications', 'audit', 'search_meta', 'portal', 'reporting'
);
-- [Confirmed — consolidated reference Part 10.2, the 11-module list]

CREATE TYPE documents.number_type_enum AS ENUM (
    'preliminary', 'final'
);
-- [Confirmed — D4 NumberType]

CREATE TYPE documents.attachment_type_enum AS ENUM (
    'certification_of_urgency', 'committee_report', 'transmittal_letter', 'scan', 'other'
);
-- [Confirmed — D4 AttachmentType. NOTE: certification_of_urgency and
-- transmittal_letter values are retained for fidelity to D4 but are NOT the
-- primary implementation path for those concepts (see §4.1 item 2, which
-- realizes them as full document_types/documents rows). These enum values
-- remain available for ad hoc supplementary scans that do not warrant full
-- document-lifecycle tracking (e.g. a quick reference copy of a faxed CoU).

CREATE TYPE documents.signature_type_enum AS ENUM (
    'presiding_officer', 'mayor', 'sp_secretary', 'vice_mayor', 'committee_chair'
);
-- [Confirmed — D4 SignatureType]

CREATE TYPE documents.panlalawigan_outcome_enum AS ENUM (
    'valid', 'valid_in_part', 'returned', 'operative_in_its_entirety', 'deemed_approved'
);
-- [Confirmed — D4 PanlalawiganOutcome / consolidated reference Part 4.3]

CREATE TYPE documents.scan_quality_category_enum AS ENUM (
    'good', 'fair', 'poor'
);
-- [Confirmed — D4 ScanQuality]
```

### 4.3 `documents.document_types`

Source: H2 catalog summary table; B2 `DocumentTypeSummary`; Architectural Invariant #11 ("Document type must have retention schedule before activation").

`required_step_types` is a `[Inference]` addition: B2's `DocumentTypeSummary.requiredStepTypes` is returned by the Published API, but B4's own treatment of "legally mandated minimum steps" (§11.3 table, Invariant #14) frames enforcement as a workflow-editor-validation concern rather than naming a storage column — this column gives that validation logic somewhere concrete to read from.

`metadata_schema` stores the JSON Schema (draft-07) itself, exactly as catalogued in H2 — this document does not reproduce the eight schemas (that is H2's content, not C1's); the column type and its role are what matters here.

`owning_module`, `classification_default`, and `public_visibility_rule` are native enums rather than admin-extensible free text, per Convention §1.8: H2 frames the *value chosen per document type* as admin-configurable (Part 11.21), not the *set of four/eleven possible values itself*, which is structurally tied to actual code behavior elsewhere (portal rendering rules, ABAC tier evaluation, module routing).

```sql
CREATE TABLE documents.document_types (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                     UUID NOT NULL,
    name                        TEXT NOT NULL,
    code                        TEXT NOT NULL,
    owning_module               documents.owning_module_enum NOT NULL,
    number_series_id            UUID NULL,  -- FK below; NULL for types with no numbering series (e.g. CERTIFICATION_OF_URGENCY, CITIZEN_COMPLAINT, DOCUMENT_REQUEST_FORM per H2)
    preliminary_numbering       BOOLEAN NOT NULL DEFAULT false,
    control_number_deferred     BOOLEAN NOT NULL DEFAULT false,
    retention_schedule_id       UUID NULL,  -- logical FK -> records.retention_schedules.id (cross-schema; no DB constraint, Invariant #1). Nullable until activation per Invariant #11; application enforces non-null before is_active = true.
    classification_default      documents.classification_level_enum NOT NULL,
    public_visibility_rule      documents.public_visibility_rule_enum NOT NULL,
    metadata_schema              JSONB NOT NULL,
    required_step_types         JSONB NULL,
    is_active                   BOOLEAN NOT NULL DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                  TIMESTAMPTZ NULL,
    deleted_by                  UUID NULL,

    CONSTRAINT uq_document_types_city_code UNIQUE (city_id, code)
    -- fk_document_types_number_series added after documents.number_series exists, §4.4
);

CREATE TRIGGER trg_document_types_set_updated_at
    BEFORE UPDATE ON documents.document_types
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 4.4 `documents.number_series`

Source: H3 Tables 1–3 and the Global Field Values table in full.

Format strings (`preliminary_format`, `final_format`) are interpreted as containing a literal `{prefix}` substitution token — e.g. `'Draft {prefix} {YEAR}-{NN}'` — rather than the prefix baked in as static text, even though H3 Table 1's own example renderings show the literal value (`'Draft 7SP {YEAR}-{NN}'`) already substituted in. This interpretation follows H2 Part 5.2's explicit assembly formula (`"Draft " + {series_prefix} + " " + {YEAR} + "-" + {NN}`) and directly enables H3 Implementation Note 1's own suggestion — keeping the SP ordinal "separately configurable" so that an 8th-SP administration change is a single `prefix` column update rather than three string edits across `sp_resolution`/`sp_ordinance`/`sp_appropriation_ordinance`. `[Inference — resolves an ambiguity between H2 and H3's literal table examples]`

`document_type_code` is a **real, same-schema, composite foreign key** into `document_types(city_id, code)` — both tables live in `documents`, so Convention §1.7 applies. It is nullable specifically because `panlalawigan_review_log` has no corresponding `documents.document_types` row in this document (§4.8 places `panlalawigan_reviews` as its own table, not a document type) — H3 Note 5 explicitly leaves this open ("[Unverified — H3 Implementation Note 5 explicitly defers this]"), and a nullable composite FK is the clean way to let one series opt out of the document-type linkage while the other ten remain referentially enforced.

```sql
CREATE TABLE documents.number_series (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                         UUID NOT NULL,
    series_key                      TEXT NOT NULL,
    document_type_code              TEXT NULL,
    prefix                          TEXT NOT NULL DEFAULT '',
    delimiter                       TEXT NOT NULL DEFAULT ' ',
    year_format                     TEXT NOT NULL DEFAULT 'YYYY',
    sequence_padding                SMALLINT NOT NULL,
    preliminary_format              TEXT NULL,
    final_format                    TEXT NOT NULL,
    resets_annually                 BOOLEAN NOT NULL DEFAULT true,
    authority_office_id             UUID NOT NULL,  -- logical FK -> organization.offices.id (cross-schema; no DB constraint, Invariant #1). SP Secretariat for all 11 Phase 1 series (H3 Global Field Values).
    sequence_name_pattern           TEXT NOT NULL,
    preliminary_assignment_event    TEXT NULL,
    final_assignment_event          TEXT NOT NULL,
    deferred_final_assignment       BOOLEAN NOT NULL DEFAULT false,
    is_active                       BOOLEAN NOT NULL DEFAULT true,  -- [Inference] resolves H3 Implementation Note 8's open question affirmatively: Phase 1B series may be seeded inactive
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                      TIMESTAMPTZ NULL,
    deleted_by                      UUID NULL,

    CONSTRAINT uq_number_series_city_key UNIQUE (city_id, series_key),
    CONSTRAINT uq_number_series_city_doctype_code UNIQUE (city_id, document_type_code),
    CONSTRAINT fk_number_series_document_type
        FOREIGN KEY (city_id, document_type_code)
        REFERENCES documents.document_types (city_id, code)
        ON DELETE RESTRICT,
    CONSTRAINT ck_number_series_padding CHECK (sequence_padding BETWEEN 1 AND 6)
);

CREATE TRIGGER trg_number_series_set_updated_at
    BEFORE UPDATE ON documents.number_series
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Now that documents.number_series exists, close the loop on document_types:
ALTER TABLE documents.document_types
    ADD CONSTRAINT fk_document_types_number_series
        FOREIGN KEY (number_series_id) REFERENCES documents.number_series (id) ON DELETE RESTRICT;
```

### 4.5 `documents.documents`

Source: H2's "What Is Not in `documents.metadata` JSONB" table, transcribed almost verbatim — that table is explicitly the canonical non-JSONB column list for this exact table.

```sql
CREATE TABLE documents.documents (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                     UUID NOT NULL,
    document_type_id            UUID NOT NULL,
    title                       TEXT NOT NULL,
    lifecycle_state              documents.lifecycle_state_enum NOT NULL DEFAULT 'draft',
    classification_level        documents.classification_level_enum NOT NULL,
    qr_tracking_number           UUID NOT NULL,
    preliminary_number           TEXT NULL,
    final_number                TEXT NULL,
    control_number              TEXT NULL,
    number_series_id             UUID NULL,
    originating_office_id        UUID NOT NULL,  -- logical FK -> organization.offices.id (cross-schema; no DB constraint, Invariant #1)
    owned_by_office_id           UUID NOT NULL,  -- logical FK -> organization.offices.id (cross-schema; no DB constraint, Invariant #1)
    created_by                  UUID NOT NULL,  -- logical FK -> iam.users.id (cross-schema; no DB constraint, Invariant #1)
    workflow_instance_id         UUID NULL,  -- logical FK -> workflow.instances.id (cross-schema; no DB constraint, Invariant #1)
    retention_schedule_id        UUID NOT NULL,  -- logical FK -> records.retention_schedules.id (cross-schema; no DB constraint, Invariant #1)
    version_number               INTEGER NOT NULL DEFAULT 1,
    metadata                    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                  TIMESTAMPTZ NULL,
    deleted_by                  UUID NULL,

    CONSTRAINT fk_documents_document_type
        FOREIGN KEY (document_type_id) REFERENCES documents.document_types (id) ON DELETE RESTRICT,
    CONSTRAINT fk_documents_number_series
        FOREIGN KEY (number_series_id) REFERENCES documents.number_series (id) ON DELETE RESTRICT,
    CONSTRAINT uq_documents_qr_tracking_number UNIQUE (qr_tracking_number),
    CONSTRAINT ck_documents_version_positive CHECK (version_number >= 1),
    -- H2: "Removed when final number is assigned" — both columns are never
    -- simultaneously non-null. Combined with the final_number-immutability
    -- trigger below (§4.5.1), this is how "Draft" promotion is enforced.
    CONSTRAINT ck_documents_number_mutual_exclusion
        CHECK (final_number IS NULL OR preliminary_number IS NULL)
);

CREATE TRIGGER trg_documents_set_updated_at
    BEFORE UPDATE ON documents.documents
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

#### 4.5.1 Lifecycle Transition Trigger and Final-Number Immutability

Per Convention §1.9, "CHECK for state transitions" on this table is a `BEFORE UPDATE` trigger, not a plain `CHECK` constraint. The transition graph below is `[Inference]`, reasoned from the linear description in consolidated reference Part 11.4 ("Draft → Submitted → In-Workflow → Pending Approval → Completed → Released → Archived → Disposed," with "Cancelled... reachable from any active state"); the fully authoritative source would be D3 (State Machine Diagrams), which is outside this document's five-document review scope. `pending_approval → in_workflow` is included as a reasonable back-transition for a `RETURNED_FOR_REVISION` workflow outcome (B4 §4.2). "Any active state" is read as the six forward-progressing states (excluding `archived`/`disposed`, which are end-of-life states distinct from "active" processing, and excluding `cancelled` itself).

The same trigger also enforces final-number immutability ("Final numbers (Draft prefix removed) are immutable — no editing by any user or role," consolidated reference Part 11.5) — combined here rather than as a second trigger, since both are `BEFORE UPDATE` checks on the same table and event.

```sql
CREATE OR REPLACE FUNCTION documents.fn_enforce_document_lifecycle_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Final number immutability (consolidated reference Part 11.5;
    -- Architectural Invariant #10 is the general numbering-immutability rule).
    IF OLD.final_number IS NOT NULL AND NEW.final_number IS DISTINCT FROM OLD.final_number THEN
        RAISE EXCEPTION
            'documents.documents.final_number is immutable once assigned (document %, old %, attempted %)',
            OLD.id, OLD.final_number, NEW.final_number;
    END IF;

    -- Lifecycle state transition validity. See prose above for the
    -- [Inference] basis of this transition graph.
    IF NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state THEN
        IF NOT (
            (OLD.lifecycle_state = 'draft'            AND NEW.lifecycle_state IN ('submitted', 'cancelled')) OR
            (OLD.lifecycle_state = 'submitted'         AND NEW.lifecycle_state IN ('in_workflow', 'cancelled')) OR
            (OLD.lifecycle_state = 'in_workflow'       AND NEW.lifecycle_state IN ('pending_approval', 'cancelled')) OR
            (OLD.lifecycle_state = 'pending_approval'  AND NEW.lifecycle_state IN ('completed', 'in_workflow', 'cancelled')) OR
            (OLD.lifecycle_state = 'completed'         AND NEW.lifecycle_state IN ('released', 'cancelled')) OR
            (OLD.lifecycle_state = 'released'          AND NEW.lifecycle_state IN ('archived', 'cancelled')) OR
            (OLD.lifecycle_state = 'archived'          AND NEW.lifecycle_state IN ('disposed'))
        ) THEN
            RAISE EXCEPTION
                'Invalid document lifecycle transition: % -> % (document %)',
                OLD.lifecycle_state, NEW.lifecycle_state, OLD.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_documents_lifecycle_transition
    BEFORE UPDATE ON documents.documents
    FOR EACH ROW
    EXECUTE FUNCTION documents.fn_enforce_document_lifecycle_transition();
```

### 4.6 `documents.numbers`

Source: D4 entity `DocumentNumber`; H3 Note 3 ("The DB unique constraint is scoped to `(series_id, year, sequence_number)` — not to the rendered format string alone," since two different series can legitimately render the same text, e.g. a resolution and an ordinance both as `7SP 2026-05`). See §4.1 item 3 for why this table coexists with the denormalized columns on `documents.documents`.

```sql
CREATE TABLE documents.numbers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID NOT NULL,
    document_id         UUID NOT NULL,
    series_id           UUID NOT NULL,
    number_type         documents.number_type_enum NOT NULL,
    number_value        TEXT NOT NULL,
    sequence_year        SMALLINT NOT NULL,
    sequence_number      INTEGER NOT NULL,
    is_current          BOOLEAN NOT NULL DEFAULT true,
    assigned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    assigned_by          UUID NOT NULL,  -- logical FK -> iam.users.id (cross-schema; no DB constraint, Invariant #1)
    superseded_at        TIMESTAMPTZ NULL,
    cancellation_reason  TEXT NULL,  -- H3 Note 9: gaps are permitted only for cancelled documents, and the gap is logged with a cancellation reason
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ NULL,
    deleted_by           UUID NULL,

    CONSTRAINT fk_numbers_document
        FOREIGN KEY (document_id) REFERENCES documents.documents (id) ON DELETE RESTRICT,
    CONSTRAINT fk_numbers_series
        FOREIGN KEY (series_id) REFERENCES documents.number_series (id) ON DELETE RESTRICT,
    -- H3 Note 3, verbatim.
    CONSTRAINT uq_numbers_series_year_sequence UNIQUE (series_id, sequence_year, sequence_number)
);

-- At most one *current* preliminary and one current final number per
-- document (D4's isCurrent flag, made structural).
CREATE UNIQUE INDEX uq_numbers_document_type_current
    ON documents.numbers (document_id, number_type)
    WHERE is_current = true AND deleted_at IS NULL;
```

No `updated_at` — rows in this history log are written once and only ever transition `is_current = true -> false` via `superseded_at`, which is itself the timestamped record of that one change; treated as append-only-with-one-flag-flip rather than freely mutable. `[Inference]`

### 4.7 `documents.versions`

Source: D4 entity `DocumentVersion`; B2 `AttachmentRef` type (for the numeric `scanQualityScore`); Architectural Law #4 ("All file references are UUID storage keys. Never original filenames"); consolidated reference Part 11.10 ("Original filename: Stored as metadata in PostgreSQL only").

Both a numeric confidence score and a derived display category are stored for OCR scan quality — D4's class attribute is the enum (`ScanQuality`), while L1 §10 (`OCR_QUALITY_THRESHOLD`, a 0.0–1.0 confidence value) is the actual configuration mechanism that produces it. The category is computed by application logic at OCR-completion time against the env-configurable threshold, not by a DB generated column (a `GENERATED ALWAYS` column cannot read an environment variable). `[Inference]`

```sql
CREATE TABLE documents.versions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                 UUID NOT NULL,
    document_id             UUID NOT NULL,
    version_number           INTEGER NOT NULL,
    s3_key                  TEXT NOT NULL,
    original_filename        TEXT NULL,
    mime_type                TEXT NOT NULL,
    file_size_bytes           BIGINT NOT NULL,
    page_count               INTEGER NULL,
    scan_quality_score        NUMERIC(4,3) NULL,
    scan_quality_category     documents.scan_quality_category_enum NULL,
    ocr_processed             BOOLEAN NOT NULL DEFAULT false,
    ocr_text                 TEXT NULL,
    uploaded_by              UUID NOT NULL,  -- logical FK -> iam.users.id (cross-schema; no DB constraint, Invariant #1)
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                TIMESTAMPTZ NULL,
    deleted_by                UUID NULL,

    CONSTRAINT fk_versions_document
        FOREIGN KEY (document_id) REFERENCES documents.documents (id) ON DELETE RESTRICT,
    CONSTRAINT uq_versions_document_version UNIQUE (document_id, version_number),
    CONSTRAINT ck_versions_scan_quality_range
        CHECK (scan_quality_score IS NULL OR (scan_quality_score >= 0 AND scan_quality_score <= 1)),
    CONSTRAINT ck_versions_file_size_positive CHECK (file_size_bytes > 0)
);

CREATE TRIGGER trg_versions_set_updated_at
    BEFORE UPDATE ON documents.versions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 4.8 `documents.attachments`

Source: D4 entity `Attachment`; consolidated reference Part 9 schema map.

```sql
CREATE TABLE documents.attachments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID NOT NULL,
    document_id         UUID NOT NULL,
    s3_key              TEXT NOT NULL,
    attachment_type      documents.attachment_type_enum NOT NULL,
    description         TEXT NULL,
    mime_type            TEXT NOT NULL,
    file_size_bytes       BIGINT NOT NULL,
    uploaded_by          UUID NOT NULL,  -- logical FK -> iam.users.id (cross-schema; no DB constraint, Invariant #1)
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ NULL,
    deleted_by            UUID NULL,

    CONSTRAINT fk_attachments_document
        FOREIGN KEY (document_id) REFERENCES documents.documents (id) ON DELETE RESTRICT,
    CONSTRAINT ck_attachments_file_size_positive CHECK (file_size_bytes > 0)
);

CREATE TRIGGER trg_attachments_set_updated_at
    BEFORE UPDATE ON documents.attachments
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 4.9 `documents.signatures`

Source: D4 entity `Signature`; consolidated reference Part 11.1 ("Scanned signature images stored with audit trail").

`signed_by_employee_id` follows D4's choice of `Employee` (not `User`) as the signatory reference, and `signed_by_display_name` denormalizes the name at signing time, per the project-wide convention stated in H2 Implementation Note 5 ("the displayed name must reflect the name as of the signing event, not any subsequent account rename").

```sql
CREATE TABLE documents.signatures (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                     UUID NOT NULL,
    document_id                 UUID NOT NULL,
    signed_by_employee_id        UUID NOT NULL,  -- logical FK -> organization.employees.id (cross-schema; no DB constraint, Invariant #1)
    signed_by_display_name       TEXT NOT NULL,
    signature_type               documents.signature_type_enum NOT NULL,
    signed_at                   TIMESTAMPTZ NOT NULL,
    is_wet_ink                  BOOLEAN NOT NULL DEFAULT true,
    signature_image_s3_key       TEXT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                   TIMESTAMPTZ NULL,
    deleted_by                   UUID NULL,

    CONSTRAINT fk_signatures_document
        FOREIGN KEY (document_id) REFERENCES documents.documents (id) ON DELETE RESTRICT,
    CONSTRAINT uq_signatures_document_type UNIQUE (document_id, signature_type)
);

CREATE TRIGGER trg_signatures_set_updated_at
    BEFORE UPDATE ON documents.signatures
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 4.10 `documents.panlalawigan_reviews` — `[Gap-fill]`

Source: D4 entity `PanlalawiganReview`; consolidated reference Part 4.3 (the SP Secretariat's own log fields: Control No., Date Received, SP Reso. No., Subject, Date Approved/Disapproved, Date Referred, Remarks).

Both H2 Implementation Note 8 and H3 Note 5 explicitly leave open whether this entity is "a row in `documents.document_types`... or a distinct entity in the `tracking` or `records` schema" — neither commits to an answer. This document resolves the question: **`panlalawigan_reviews` is its own table in the `documents` schema**, one row per `Document` (matching D4's explicit "each Document has its own PanlalawiganReview record... for independent outcome tracking"), because (a) it needs the dedicated `panlalawigan_review_log` number series from H3 for `control_number`, which a JSONB field cannot consume from a PostgreSQL sequence as cleanly as a real column can; (b) D4's column list (seven structured fields) is detailed enough to suggest a genuine relational need, most plausibly for the Index of Ordinances report (Part 5.3: "Sangguniang Panlalawigan Action Taken"); and (c) it is described throughout as "the SP Secretariat's log" — i.e. a registry, the canonical use case for a relational table. `control_number` is deliberately **not** unique, since the Panlalawigan frequently acts on multiple SP documents under one shared control/batch reference (Part 4.3: "Multiple documents per batch").

```sql
CREATE TABLE documents.panlalawigan_reviews (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                         UUID NOT NULL,
    document_id                     UUID NOT NULL,
    control_number                  TEXT NULL,
    subject                         TEXT NULL,
    transmitted_at                   TIMESTAMPTZ NULL,
    received_at                      TIMESTAMPTZ NULL,
    date_referred                    TIMESTAMPTZ NULL,
    outcome                         documents.panlalawigan_outcome_enum NULL,
    panlalawigan_resolution_number    TEXT NULL,
    remarks                         TEXT NULL,
    days_elapsed                     INTEGER NULL,
    created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                       TIMESTAMPTZ NULL,
    deleted_by                       UUID NULL,

    CONSTRAINT fk_panlalawigan_reviews_document
        FOREIGN KEY (document_id) REFERENCES documents.documents (id) ON DELETE RESTRICT,
    CONSTRAINT uq_panlalawigan_reviews_document UNIQUE (document_id)
);

CREATE TRIGGER trg_panlalawigan_reviews_set_updated_at
    BEFORE UPDATE ON documents.panlalawigan_reviews
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

### 4.11 Sequences for Numbering Series

Eleven sequences, one per `number_series` row, matching H3 Table 2 exactly, created for the current year (2026). They live in the `documents` schema, owned by `migrate_user`.

```sql
CREATE SEQUENCE documents.ns_sp_resolution_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_sp_ordinance_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_sp_appropriation_ordinance_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_nch_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_nosp_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_designation_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_letters_received_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_letters_sent_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_memo_outgoing_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_memo_incoming_2026_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE documents.ns_panlalawigan_review_log_2026_seq START WITH 1 INCREMENT BY 1;
```

Per H3's "Sequence creation policy" ("A year-boundary maintenance process... must create the following year's sequences before the calendar rollover. On-demand creation at first use of a new year is also acceptable"), the function below provides the on-demand fallback. It must perform `CREATE SEQUENCE`, a DDL operation that `app_user` should not hold directly (principle of least privilege, L1 §1.3) — so it is `SECURITY DEFINER`, owned by `migrate_user`, with an explicit `search_path` to close the standard search-path-injection risk for `SECURITY DEFINER` functions, and `EXECUTE` is revoked from `PUBLIC` and re-granted only to `app_user`.

```sql
CREATE OR REPLACE FUNCTION documents.fn_get_next_sequence_value(
    p_series_key TEXT,
    p_year INTEGER
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = documents, pg_temp
AS $$
DECLARE
    v_pattern   TEXT;
    v_seq_name  TEXT;
    v_next_val  INTEGER;
BEGIN
    SELECT sequence_name_pattern INTO v_pattern
    FROM documents.number_series
    WHERE series_key = p_series_key AND deleted_at IS NULL;

    IF v_pattern IS NULL THEN
        RAISE EXCEPTION 'Unknown or inactive number series: %', p_series_key;
    END IF;

    v_seq_name := replace(v_pattern, '{YEAR}', p_year::TEXT);

    -- On-demand creation for a year not yet pre-provisioned by the
    -- year-boundary maintenance job (H3 "Sequence creation policy").
    EXECUTE format(
        'CREATE SEQUENCE IF NOT EXISTS documents.%I START WITH 1 INCREMENT BY 1',
        v_seq_name
    );

    EXECUTE format('SELECT nextval(''documents.%I'')', v_seq_name) INTO v_next_val;

    RETURN v_next_val;
END;
$$;

ALTER FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) OWNER TO migrate_user;
REVOKE ALL ON FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) TO app_user;
```

### 4.12 Number Assignment Helper Functions `[Inference — reference implementation]`

These two functions are not required by the letter of the task brief, but they demonstrate that the schema above is actually usable end-to-end for the two confirmed assignment events (H3 Table 3) and directly implement H3 Notes 1–4 and the `ck_documents_number_mutual_exclusion` constraint's intent. The application's TypeScript service layer (B2's `Documents.assignFinalNumber()`, etc.) is expected to call these inside the same transaction it uses to emit the corresponding domain event (`document.number_assigned`) — domain event emission is an application-layer concern (B2), not something a SQL function performs.

```sql
CREATE OR REPLACE FUNCTION documents.fn_assign_preliminary_number(
    p_document_id UUID,
    p_actor_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_series_id            UUID;
    v_series_key           TEXT;
    v_prefix                TEXT;
    v_padding               SMALLINT;
    v_preliminary_format     TEXT;
    v_year                  INTEGER := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Manila'))::INTEGER;
    v_seq                   INTEGER;
    v_padded                TEXT;
    v_rendered               TEXT;
BEGIN
    SELECT d.number_series_id, ns.series_key, ns.prefix, ns.sequence_padding, ns.preliminary_format
      INTO v_series_id, v_series_key, v_prefix, v_padding, v_preliminary_format
      FROM documents.documents d
      JOIN documents.number_series ns ON ns.id = d.number_series_id
     WHERE d.id = p_document_id
     FOR UPDATE OF d;

    IF v_series_id IS NULL THEN
        RAISE EXCEPTION 'Document % has no number_series_id; preliminary numbering does not apply', p_document_id;
    END IF;
    IF v_preliminary_format IS NULL THEN
        RAISE EXCEPTION 'Series % has no preliminary_format configured', v_series_key;
    END IF;

    v_seq := documents.fn_get_next_sequence_value(v_series_key, v_year);
    v_padded := lpad(v_seq::TEXT, v_padding, '0');
    v_rendered := replace(replace(v_preliminary_format, '{prefix}', v_prefix), '{YEAR}', v_year::TEXT);
    v_rendered := replace(v_rendered, '{NN}', v_padded);

    -- Retire any existing current preliminary number for this document
    -- (consolidated reference Part 5.2: "Preliminary numbers can be replaced
    -- before finalization").
    UPDATE documents.numbers
       SET is_current = false, superseded_at = now()
     WHERE document_id = p_document_id
       AND number_type = 'preliminary'
       AND is_current = true;

    INSERT INTO documents.numbers (
        document_id, city_id, series_id, number_type, number_value,
        sequence_year, sequence_number, is_current, assigned_by
    )
    SELECT p_document_id, d.city_id, v_series_id, 'preliminary', v_rendered,
           v_year, v_seq, true, p_actor_id
      FROM documents.documents d WHERE d.id = p_document_id;

    UPDATE documents.documents
       SET preliminary_number = v_rendered
     WHERE id = p_document_id;

    RETURN v_rendered;
END;
$$;

CREATE OR REPLACE FUNCTION documents.fn_assign_final_number(
    p_document_id UUID,
    p_actor_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_series_id        UUID;
    v_existing_final     TEXT;
    v_series_key        TEXT;
    v_prefix             TEXT;
    v_padding            SMALLINT;
    v_final_format        TEXT;
    v_year               INTEGER := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Manila'))::INTEGER;
    v_seq                INTEGER;
    v_padded             TEXT;
    v_rendered            TEXT;
BEGIN
    SELECT d.number_series_id, d.final_number, ns.series_key, ns.prefix, ns.sequence_padding, ns.final_format
      INTO v_series_id, v_existing_final, v_series_key, v_prefix, v_padding, v_final_format
      FROM documents.documents d
      JOIN documents.number_series ns ON ns.id = d.number_series_id
     WHERE d.id = p_document_id
     FOR UPDATE OF d;

    IF v_series_id IS NULL THEN
        RAISE EXCEPTION 'Document % has no number_series_id; final numbering does not apply', p_document_id;
    END IF;
    -- Architectural Invariant #10 / consolidated reference Part 11.5: final
    -- numbers are immutable. This re-checks at the function level in
    -- addition to the trigger in §4.5.1, since the trigger only fires on
    -- UPDATE of documents.documents, not on a misuse of this function alone.
    IF v_existing_final IS NOT NULL THEN
        RAISE EXCEPTION 'Document % already has an immutable final_number (%): cannot reassign', p_document_id, v_existing_final;
    END IF;

    v_seq := documents.fn_get_next_sequence_value(v_series_key, v_year);
    v_padded := lpad(v_seq::TEXT, v_padding, '0');
    v_rendered := replace(replace(v_final_format, '{prefix}', v_prefix), '{YEAR}', v_year::TEXT);
    v_rendered := replace(v_rendered, '{NN}', v_padded);

    UPDATE documents.numbers
       SET is_current = false, superseded_at = now()
     WHERE document_id = p_document_id
       AND number_type = 'preliminary'
       AND is_current = true;

    INSERT INTO documents.numbers (
        document_id, city_id, series_id, number_type, number_value,
        sequence_year, sequence_number, is_current, assigned_by
    )
    SELECT p_document_id, d.city_id, v_series_id, 'final', v_rendered,
           v_year, v_seq, true, p_actor_id
      FROM documents.documents d WHERE d.id = p_document_id;

    -- preliminary_number is cleared in the same statement that sets
    -- final_number, satisfying ck_documents_number_mutual_exclusion.
    UPDATE documents.documents
       SET final_number = v_rendered,
           preliminary_number = NULL
     WHERE id = p_document_id;

    RETURN v_rendered;
END;
$$;
```

**`documents` schema complete — 8 tables: `document_types`, `number_series`, `documents`, `versions`, `attachments`, `numbers`, `signatures`, `panlalawigan_reviews`. Plus: 11 sequences, 1 lifecycle trigger function, 1 sequence-management function, 2 number-assignment helper functions.**
