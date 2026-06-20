# C1. Full Database Schema DDL — Authoritative

**Document:** C1  
**Platform:** Batac City LGU Platform  
**Status:** Authoritative — Combined from two candidate C1 documents with all conflicts resolved.  
**Last Updated:** June 2026  
**Audience:** Backend development team; LGU IT Office (DBA reviewers)  
**Prerequisite docs:** B2 v1.1, B3, B4, B5, C5, D3, D4, H2, H3, I2, I3, L2

---

## Table of Contents

- [L33–L90] Part 0 — Source Preamble and Notation — Source documents cited, notation tags ([Confirmed]/[Inference]/[Gap-fill]/[Decision]), and conflict-resolution summary.
- [L91–L166] Part 1 — Conventions — Cross-schema FK rules, PK/city_id/timestamp/soft-delete standards, enum strategy, composite FKs, updated_at trigger, number immutability, lifecycle enforcement.
- [L167–L217] Part 2 — Extensions, Roles, and Schemas — pgcrypto extension, fn_set_updated_at trigger function, schema creation (Phase 1 + reserved), and five DB role declarations.
- [L218–L456] Part 3 — Schema `iam` — Users, credentials, sessions (B5 §4.2), refresh tokens (B5 §1.2 family-rotation model), roles, permissions, role_permissions (with decision/condition_reference), role_assignments, mfa_records.
- [L457–L666] Part 4 — Schema `organization` — Offices (5 office_type values), positions, employees (employee_number NOT NULL), assignments, delegation_grants (delegating_employee_id + delegated_to_employee_id, end_date NOT NULL), committees, committee_memberships.
- [L667–L1159] Part 5 — Schema `documents` — Document types, number series, documents (D3 post-ADR-013/014 lifecycle + superseded_by columns), numbers ledger (immutability trigger), versions (OCR + FTS), attachments, signatures, sponsorships, panlalawigan_reviews, fn_get_next_sequence_value (auto-create + was_created flag).
- [L1160–L1497] Part 6 — Schema `workflow` — Workflow native ENUMs, definitions, definition_versions (status GENERATED column), steps, transition_rules, instances (context JSONB for publication data), step_instances, workflow_events (append-only), pending_certified_urgent_bypasses, committee_reports, sp_sessions, session_attendances, order_of_business.
- [L1498–L1576] Part 7 — Schema `tracking` — QR codes (tracking_id mirrors documents.qr_tracking_number), tracking_records (current_custodian_office_id), routing_entries (B2 RoutingEntry shape, append-only).
- [L1577–L1696] Part 8 — Schema `records` — Retention schedules, classification_rules, records (legal_hold columns), archive_entries, dispositions (RA 10173 erasure gate).
- [L1697–L1767] Part 9 — Schema `notifications` — Templates, notification_events, delivery_log — Phase 1 internal employees + external recipient columns.
- [L1768–L1804] Part 10 — Schema `audit` — Append-only BIGINT-sequence hash-chained HMAC-signed audit.events; no soft-delete columns.
- [L1805–L1828] Part 11 — 2026 Numbering Sequences — Eleven INTEGER sequences for Phase 1 series; annual migration pattern; fn_get_next_sequence_value auto-create safety net.
- [L1829–L1936] Part 12 — Roles, Grants, and Row-Level Security — batac_app/audit/it_admin/readonly/migrate grants; DELETE never granted; workflow_events UPDATE/DELETE revoked; RLS on documents.documents and iam.sessions.
- [L1937–L1948] Part 13 — Reserved Phase 2/3 Schemas — search_meta (Phase 2), portal (Phase 3), reporting (Phase 2) — namespaces only; no tables created.
- [L1949–L1969] Part 14 — Invariant and Non-Negotiable Compliance Checklist — 14-row table mapping each architectural invariant/non-negotiable to its DDL enforcement mechanism.
- [L1970–L1984] Part 15 — Open Items Requiring Confirmation — Three resolved (panlalawigan_review_log classification, batac_migrate role name, RecordType enum), one still open (barangay-phase `employee_number` constraint — may resolve with no DDL change, pending Barangay Resolution/Budget detailed design); RecordType retention-period figures remain unverified pending NAP Sanggunian-specific GRDS confirmation.

---

## Part 0 — Source Preamble and Notation

### Sources

This DDL was synthesised from the following documents. Each claim below carries a source tag where non-obvious.

| Doc | Role |
|---|---|
| B2 v1.1 | Module boundary, cross-schema invariant #1, shared types |
| B3 | In-process domain event bus; confirmed no centralised dead-letter table |
| B4 | Workflow engine specification; authoritative for `workflow` schema |
| B5 | Authentication and authorization architecture; `iam.sessions` and `iam.refresh_tokens` schema confirmed |
| C2 | ER diagrams; column names and cardinalities |
| C5 | Migration strategy and conventions |
| D3 | State machine diagrams; authoritative `lifecycle_state` value set (post-ADR-013/ADR-014) |
| D4 | Domain class diagram; entity index; relationship notes; sponsorship FK target |
| H2 | Document type catalog; JSONB metadata schemas; `documents.documents` global columns |
| H3 | Numbering series configuration; sequence naming convention |
| I2 | Role-permission matrix; basis for `decision`/`condition_reference` columns |
| I3 | Confirmed DB role set |
| L2 | Actual grant script; confirmed `batac_app` role name |

### Notation Tags

Every non-trivial structural choice carries one of:

- **[Confirmed]** — Stated directly in a cited source document.
- **[Inference]** — Logically derived from confirmed facts; not stated verbatim.
- **[Gap-fill]** — No source addresses the point; decision made by the DDL author using stated conventions.
- **[Decision]** — Resolved by direct stakeholder decision documented in the C1 Conflict Resolution Reference.

### Conflict-Resolution Summary

All sixteen conflicts between the two candidate C1 drafts (c1-full-database-schema-ddl.md vs c1-full-database-schema-ddl-v1.md) have been resolved and are documented in the accompanying **C1 Conflict Resolution Reference**. The key resolutions affecting DDL structure:

- **Enum strategy** — `TEXT NOT NULL CHECK(...)` for all non-`workflow` schemas; native PostgreSQL `ENUM` retained only for `workflow` status types (3.2b). `lower_snake_case` throughout (3.2c).
- **`office_type` values** — `('executive','legislative','department','barangay','external')` — five values; `barangay` reserved (not seeded) in Phase 1 (3.2a).
- **`iam.role_permissions`** — Includes `decision` and `condition_reference` columns per I2 matrix (3.3).
- **`iam.sessions`** — Uses B5 §4.2 confirmed schema (3.4).
- **`iam.refresh_tokens`** — Uses B5 §1.2 confirmed schema: both `replaced_by` and `revoked_at` columns coexist (3.5).
- **`iam.role_assignments.assigned_by`** — `NOT NULL`; a `system` user row must be pre-seeded (3.6).
- **`iam.mfa_records`** — Row inserted only at verified-enrollment completion; `secret_encrypted NOT NULL` (3.7).
- **`organization.employees`** — `employee_number NOT NULL`, `email NULL` (3.8).
- **`organization.delegation_grants.end_date`** — `NOT NULL`; open-ended delegations prohibited (3.9).
- **`documents.document_types.is_active`** — `DEFAULT false`; types must be explicitly activated (3.10).
- **`documents.number_series`** — Simple UUID FK to `document_types`; `series_type` and `phase` columns added (3.11).
- **`lifecycle_state` values** — Updated to D3 post-ADR-013/ADR-014 authoritative set; includes `pending_mayor_action`, `pending_panlalawigan_review`, `superseded` (Discovered Issue #1).
- **`documents.documents`** — Added `superseded_by`, `superseded_at`, `closure_reason` columns (Discovered Issue #2).
- **`released → cancelled` transition** — Valid per D3; included in trigger (3.12).
- **Sequence helper** — Auto-creates missing year sequence; returns `was_created` flag; `SECURITY DEFINER` owned by `batac_migrate` (3.13).
- **`documents.panlalawigan_reviews`** — Dedicated table; column set sourced from B4 `context` field names; `resolution_number` (not `resolution_no`) (3.14).
- **`public.event_bus_dead_letters`** — Dropped; no component populates it per B3/L2 (3.15).
- **DB roles** — `batac_app`, `batac_audit`, `batac_it_admin`, `batac_readonly`, `batac_migrate` per I3/L2 (3.16 + user decision).
- **`documents.document_sponsorships`** — Dedicated table; `sponsor_employee_id → organization.employees` per D4 L245 (3.1).
- **`documents.publication_records`** — No dedicated table; publication data lives in `workflow.instances.context` JSONB per B4 (3.1).

---

## Part 1 — Conventions

### §1.1 Cross-Schema Isolation (Architectural Invariant #1)

No `FOREIGN KEY` constraint may cross schema boundaries. Every column referencing a row in a different schema is a plain `UUID` column documented with an inline comment: `-- logical FK → <schema>.<table>.<column> (cross-schema)`. These constraints are enforced at the application layer and documented in C2's Logical FK Index tables.

### §1.2 Primary Keys

Every table: `id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()`. No composite PKs, no surrogate integer sequences for business entities.

### §1.3 Tenant Isolation Column

Every table includes `city_id UUID NOT NULL DEFAULT '<batac-uuid>'::uuid`. This is not a FK constraint; it is a tenant isolation sentinel. The default is set for Phase 1 single-tenancy convenience and must not be treated as a permission to omit it from INSERT statements.

The Batac City UUID sentinel used in this document: `'00000000-0000-4000-8000-000000000001'`.

### §1.4 Timestamps

All temporal columns use `TIMESTAMPTZ` (time zone aware). Column naming:
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` — on every table.
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` — on all mutable tables; managed by the `public.fn_set_updated_at()` trigger function.
- **Omitted** on append-only / write-once tables: `tracking.routing_entries`, `workflow.workflow_events`, `notifications.delivery_log`, `audit.events`, `documents.numbers` (one-flag-flip only, not truly mutable).

### §1.5 Soft Delete

All tables implement soft delete via `deleted_at TIMESTAMPTZ NULL` and `deleted_by UUID NULL` (logical FK → `iam.users.id`). **Exceptions** (append-only, no soft-delete columns): `workflow.workflow_events`, `audit.events`.

### §1.6 Enum Strategy

- **`workflow` schema** — Three status columns use native PostgreSQL `ENUM` types because B4 gives complete, authoritative value lists and the step-type enum needs to be safely referenced in generated columns and trigger logic.
- **All other schemas** — `TEXT NOT NULL CHECK (column IN (...))` per table. This avoids `ALTER TYPE` migration friction and allows per-table value subsets. `CREATE DOMAIN` was considered and rejected for the same reason.
- **Casing** — All CHECK values use `lower_snake_case` regardless of the casing in the originating domain document (D4, B4, I2). Domain model documents may keep their own casing; C1 normalises.

### §1.7 Composite Foreign Keys Within `documents`

`transition_rules.from_step_id` and `to_step_id` use a **composite FK** against `workflow.steps(definition_version_id, id)` (per C2 §workflow annotation). This converts B4 Engine Invariant #12 (no cross-version transition) from an application check into a DB-enforced constraint.

### §1.8 `updated_at` Trigger Function

A single generic trigger function lives in `public` and is applied per-table:

```sql
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;
```

Every mutable table gets:
```sql
CREATE TRIGGER trg_<tablename>_set_updated_at
    BEFORE UPDATE ON <schema>.<tablename>
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

Triggers are declared immediately after their table in this document.

### §1.9 Number Assignment and Immutability

- `PRELIMINARY` numbers are replaced (new row, `is_current = true`; old row, `is_current = false`), never edited.
- `FINAL` and `CONTROL` numbers are immutable from the moment of assignment. Enforced by `documents.check_number_immutability()` trigger.
- Sequence auto-creation: `documents.fn_get_next_sequence_value()` auto-creates a missing year sequence on demand and returns a `was_created` boolean so the calling application module can log a structured warning.

### §1.10 Lifecycle State Transition

`documents.documents.lifecycle_state` transitions are enforced by `documents.check_lifecycle_transition()` (`BEFORE UPDATE` trigger). The authoritative state set and transition graph are sourced from D3 (post-ADR-013 / ADR-014).

### §1.11 No Hard Deletes

`DELETE` is revoked from all application roles at the PostgreSQL grant level, reinforcing Architectural Invariant #2. Only `batac_migrate` may execute DDL-level operations.

---

## Part 2 — Extensions, Roles, and Schemas

```sql
-- ============================================================================
-- PART 2 — EXTENSIONS, ROLES, AND SCHEMAS
-- ============================================================================

-- gen_random_uuid() is core in PostgreSQL 13+; created defensively for
-- compatibility and is a no-op on PostgreSQL 16+.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Updated_at trigger function (§1.8) — must exist before any table is created.
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

-- ── Phase 1 schemas ──────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS organization;
CREATE SCHEMA IF NOT EXISTS documents;
CREATE SCHEMA IF NOT EXISTS workflow;
CREATE SCHEMA IF NOT EXISTS tracking;
CREATE SCHEMA IF NOT EXISTS records;
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE SCHEMA IF NOT EXISTS audit;

-- ── Reserved Phase 2/3 namespaces ────────────────────────────────────────────
-- No tables created in these schemas in Phase 1.
CREATE SCHEMA IF NOT EXISTS search_meta;   -- Phase 2: index_metadata, index_jobs
CREATE SCHEMA IF NOT EXISTS portal;        -- Phase 3: public_documents, citizen_requests, complaints, announcements
CREATE SCHEMA IF NOT EXISTS reporting;     -- Phase 2: report_definitions, schedules, outputs

-- ── Database Roles ───────────────────────────────────────────────────────────
-- Confirmed role set per I3 §8.1 [CONFIRMED — Stack Context; B5 §6.2] and L2.
-- Credentials and login provisioning via secrets manager / Terraform (Invariant #15).

CREATE ROLE batac_app     NOLOGIN;   -- Runtime application service account (SELECT, INSERT, UPDATE; RLS applies)
CREATE ROLE batac_audit   NOLOGIN;   -- Audit log writes: INSERT-only on audit.events (Invariant #3)
CREATE ROLE batac_it_admin NOLOGIN;  -- IT Admin ops; DDL via migrations; REVOKE on document content tables
CREATE ROLE batac_readonly NOLOGIN;  -- Read-only monitoring/reporting; RLS applies
CREATE ROLE batac_migrate  NOLOGIN;  -- DDL owner; SECURITY DEFINER function owner; runs migration scripts
                                     -- [Decision] Named here for the first time; no prior document names this role.
                                     -- Seed order: batac_migrate schema-owns all Phase 1 schemas.
```

---

## Part 3 — Schema `iam`

Authentication, session control, JWT-adjacent token storage, role/permission resolution. ABAC office-scoping and Tier 1/2/3 authorization are application-layer concerns (B5 §5); no dedicated ABAC policy table exists in any source document, so none is invented here — `iam.role_assignments.office_scope_id` is the one piece of schema support the source material grounds for office-scoped rules.

```sql
-- ============================================================================
-- PART 3 — SCHEMA: iam
-- ============================================================================

-- Login-capable identities only. Personal/employment data (name, office,
-- position) lives in organization.employees; see D4 Employee.hasAccount
-- (0..1 relationship from Employee to User).
CREATE TABLE iam.users (
    id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id     UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    username    TEXT        NOT NULL,
    email       TEXT        NOT NULL,
    status      TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','suspended','deactivated')),
    -- [Decision] mfa_enabled retained as a fast-path login check per B5 §10.5.
    -- iam.mfa_records holds the actual enrollment data (created only at verified
    -- enrollment completion); this boolean allows the login flow to gate TOTP
    -- without a join in the hot path.
    mfa_enabled BOOLEAN     NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ NULL,
    deleted_by  UUID        NULL REFERENCES iam.users(id),
    CONSTRAINT uq_users_city_username UNIQUE (city_id, username),
    CONSTRAINT uq_users_city_email    UNIQUE (city_id, email)
);

CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON iam.users
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- 1:1 with iam.users (D4: User "1" *-- "1" Credential).
CREATE TABLE iam.credentials (
    id              UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    user_id         UUID        NOT NULL REFERENCES iam.users(id),
    password_hash   TEXT        NOT NULL,
    last_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID        NULL REFERENCES iam.users(id),
    CONSTRAINT uq_credentials_user UNIQUE (user_id)
);

CREATE TRIGGER trg_credentials_set_updated_at
    BEFORE UPDATE ON iam.credentials
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- One active session per user enforced via partial unique index (B5 §4.2,
-- §4.3 [Confirmed]). Schema sourced directly from B5 §4.2 [Inference — not
-- confirmed in source documents, per B5's own label].
CREATE TABLE iam.sessions (
    id                  UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    user_id             UUID        NOT NULL REFERENCES iam.users(id),
    -- session_token_hash: the JTI UUID from the JWT, stored hashed. Used for
    -- revocation lookup at every authenticated request. [Confirmed — B5 §1.1]
    session_token_hash  TEXT        NOT NULL,
    ip_address          INET        NULL,
    user_agent          TEXT        NULL,
    last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- locked_at: set by "Switch User / Lock Screen"; session not terminated.
    -- Re-authentication clears this. [B5 §4.6 Inference]
    locked_at           TIMESTAMPTZ NULL,
    active              BOOLEAN     NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    terminated_at       TIMESTAMPTZ NULL,
    terminated_by       UUID        NULL REFERENCES iam.users(id),
    -- [Decision 3.4] Authoritative value set from B5 §4.2 — replaces both
    -- candidates' incorrect values ('user_action' vs 'user_logout').
    termination_reason  TEXT        NULL
                            CHECK (termination_reason IN
                                ('logout','inactivity','forced','replaced','expired','lock')),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID        NULL REFERENCES iam.users(id),
    CONSTRAINT uq_sessions_token_hash UNIQUE (session_token_hash),
    -- termination pair consistency: both fields must be set or both NULL.
    CONSTRAINT ck_sessions_termination_consistency
        CHECK ((terminated_at IS NULL) = (termination_reason IS NULL))
);

-- DB-level second line of defense for single-active-session invariant
-- (B5 §4.3 [Confirmed — Part 11.17]).
CREATE UNIQUE INDEX idx_sessions_one_active_per_user
    ON iam.sessions(user_id)
    WHERE active = true AND deleted_at IS NULL;

CREATE INDEX idx_sessions_user ON iam.sessions(user_id);

-- Refresh token storage: server-side DB, hashed + salted value (B5 §1.2).
-- Schema sourced directly from B5 §1.2 DDL fragment [Inference].
-- Both rotation-chain (replaced_by) and revocation-timestamp (revoked_at)
-- columns coexist — [Decision 3.5]: both serve different audit purposes.
CREATE TABLE iam.refresh_tokens (
    id                UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id           UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    user_id           UUID        NOT NULL REFERENCES iam.users(id),
    session_id        UUID        NOT NULL REFERENCES iam.sessions(id),
    token_hash        TEXT        NOT NULL,  -- SHA-256(token + salt); B5 §1.2 ADR-AUTH-04
    salt              TEXT        NOT NULL,  -- per-token random salt for token_hash
    family_id         UUID        NOT NULL,  -- groups all tokens in one auth chain
    used_at           TIMESTAMPTZ NULL,      -- NULL = not yet used; set on first (and only) use
    expires_at        TIMESTAMPTZ NOT NULL,
    revoked_at        TIMESTAMPTZ NULL,
    revocation_reason TEXT        NULL,      -- 'logout'|'reuse_detected'|'forced'|'family_revoked'
    replaced_by       UUID        NULL REFERENCES iam.refresh_tokens(id),  -- rotation chain
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ NULL,
    deleted_by        UUID        NULL REFERENCES iam.users(id),
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash)
);

CREATE INDEX idx_rt_user_id    ON iam.refresh_tokens(user_id);
CREATE INDEX idx_rt_family_id  ON iam.refresh_tokens(family_id);
CREATE INDEX idx_rt_expires_at ON iam.refresh_tokens(expires_at)
    WHERE revoked_at IS NULL AND used_at IS NULL;

-- Named role definitions. is_platform_admin separates the Platform Admin
-- (Tier 2 configurator) from operational roles (B5 §8.1).
CREATE TABLE iam.roles (
    id                UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id           UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    name              TEXT        NOT NULL,
    code              TEXT        NOT NULL,
    description       TEXT        NULL,
    is_system_role    BOOLEAN     NOT NULL DEFAULT false,
    is_platform_admin BOOLEAN     NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ NULL,
    deleted_by        UUID        NULL REFERENCES iam.users(id),
    CONSTRAINT uq_roles_city_code UNIQUE (city_id, code)
);

CREATE TRIGGER trg_roles_set_updated_at
    BEFORE UPDATE ON iam.roles
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TABLE iam.permissions (
    id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id     UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    resource    TEXT        NOT NULL,
    action      TEXT        NOT NULL,
    description TEXT        NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ NULL,
    deleted_by  UUID        NULL REFERENCES iam.users(id),
    CONSTRAINT uq_permissions_city_resource_action UNIQUE (city_id, resource, action)
);

CREATE TRIGGER trg_permissions_set_updated_at
    BEFORE UPDATE ON iam.permissions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- [Decision 3.3] decision and condition_reference are required. I2's
-- Allow/Deny/Conditional (✅/❌/🔶) matrix has 26 confirmed 🔶 cells —
-- a plain junction table cannot represent Conditional grants.
-- condition_reference keys into the I1 ABAC policy table (or I2 footnote
-- number). CHECK enforces: conditional → condition_reference must be set.
CREATE TABLE iam.role_permissions (
    role_id             UUID NOT NULL REFERENCES iam.roles(id),
    permission_id       UUID NOT NULL REFERENCES iam.permissions(id),
    decision            TEXT NOT NULL CHECK (decision IN ('allow','deny','conditional')),
    condition_reference TEXT NULL,  -- non-NULL when decision = 'conditional'
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT ck_role_permissions_condition_required
        CHECK (decision <> 'conditional' OR condition_reference IS NOT NULL)
);

-- office_scope_id: NULL = city-wide, unscoped assignment.
-- [Decision 3.6] assigned_by NOT NULL: a 'system' user row must be pre-seeded
-- in iam.users before the first bootstrap Platform Admin assignment.
-- Seed order: iam.users system row → iam.role_assignments bootstrap row.
CREATE TABLE iam.role_assignments (
    id              UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    user_id         UUID        NOT NULL REFERENCES iam.users(id),
    role_id         UUID        NOT NULL REFERENCES iam.roles(id),
    assigned_by     UUID        NOT NULL REFERENCES iam.users(id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- office_scope_id: scopes this assignment to one office; NULL = city-wide.
    -- logical FK → organization.offices.id (cross-schema)
    office_scope_id UUID        NULL,
    revoked_by      UUID        NULL REFERENCES iam.users(id),
    revoked_at      TIMESTAMPTZ NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID        NULL REFERENCES iam.users(id),
    -- Partial unique index: NULL office_scope_id coalesced to sentinel UUID
    -- to prevent PostgreSQL's "NULLs are always distinct" from allowing
    -- duplicate unscoped assignments of the same role to the same user.
    CONSTRAINT ck_role_assignments_revocation_consistency
        CHECK ((revoked_at IS NULL) = (is_active = true))
);

CREATE UNIQUE INDEX uq_role_assignments_active
    ON iam.role_assignments(user_id, role_id, COALESCE(office_scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
    WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX idx_role_assignments_user ON iam.role_assignments(user_id) WHERE is_active = true;
CREATE INDEX idx_role_assignments_role ON iam.role_assignments(role_id);

-- [Decision 3.7] Row inserted ONLY at verified-enrollment completion (secret
-- committed + iam.users.mfa_enabled flipped to true in one transaction).
-- No row exists in a half-enrolled state. secret_encrypted NOT NULL because
-- the row should not exist until the secret is ready.
-- UNIQUE (user_id, method): allows future multi-method MFA without schema change.
-- MFA is Phase 1 wired, Phase 2 enforced (B5 §10.5).
CREATE TABLE iam.mfa_records (
    id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    user_id          UUID        NOT NULL REFERENCES iam.users(id),
    method           TEXT        NOT NULL DEFAULT 'totp' CHECK (method IN ('totp')),
    secret_encrypted TEXT        NOT NULL,
    is_enabled       BOOLEAN     NOT NULL DEFAULT false,
    enabled_at       TIMESTAMPTZ NULL,
    last_verified_at TIMESTAMPTZ NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ NULL,
    deleted_by       UUID        NULL REFERENCES iam.users(id),
    CONSTRAINT uq_mfa_records_user_method UNIQUE (user_id, method)
);

CREATE TRIGGER trg_mfa_records_set_updated_at
    BEFORE UPDATE ON iam.mfa_records
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
```

---

## Part 4 — Schema `organization`

Office hierarchy, positions, employees, assignments, delegation grants, and committees. `Committee`/`CommitteeMembership` are placed here per D4 Relationship Note 8 ("they are not generic Office entities... they have term-bound membership"), but are not `organization.offices` rows.

```sql
-- ============================================================================
-- PART 4 — SCHEMA: organization
-- ============================================================================

-- [Decision 3.2a] Five values confirmed. 'barangay' reserved for a future
-- phase — not seeded or activated in Phase 1. 'external' structurally required
-- for incoming-letter (SPR) documents where the sender is an external party.
CREATE TABLE organization.offices (
    id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    name             TEXT        NOT NULL,
    code             TEXT        NOT NULL,
    office_type      TEXT        NOT NULL
                         CHECK (office_type IN ('executive','legislative','department','barangay','external')),
    parent_office_id UUID        NULL REFERENCES organization.offices(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ NULL,
    deleted_by       UUID        NULL,  -- logical FK → iam.users.id (cross-schema)
    CONSTRAINT uq_offices_city_code UNIQUE (city_id, code),
    CONSTRAINT ck_offices_not_self_parent CHECK (id <> parent_office_id)
);

CREATE TRIGGER trg_offices_set_updated_at
    BEFORE UPDATE ON organization.offices
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_offices_parent ON organization.offices(parent_office_id);

-- authority_level is left unconstrained TEXT: D4 declares Position.level as
-- AuthorityLevel but gives no value list in any source. [Gap-fill]
CREATE TABLE organization.positions (
    id              UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    office_id       UUID        NOT NULL REFERENCES organization.offices(id),
    title           TEXT        NOT NULL,
    code            TEXT        NOT NULL,
    authority_level TEXT        NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID        NULL,
    CONSTRAINT uq_positions_city_code UNIQUE (city_id, code)
);

CREATE TRIGGER trg_positions_set_updated_at
    BEFORE UPDATE ON organization.positions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_positions_office ON organization.positions(office_id);

-- user_id: logical FK → iam.users.id (cross-schema). Not every employee
-- has a platform account (D4 Employee "1" --> "0..1" User : hasAccount).
-- [Decision 3.8] employee_number NOT NULL; email NULL.
-- Barangay officials (office_type = 'barangay') are not populated in Phase 1,
-- so the "officials may lack a number" rationale does not apply to any row
-- actually created in Phase 1. Forward note: this constraint will likely need
-- relaxing via migration when BARANGAY offices activate in a future phase.
CREATE TABLE organization.employees (
    id              UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    user_id         UUID        NULL,  -- logical FK → iam.users.id (cross-schema)
    employee_number TEXT        NOT NULL,
    first_name      TEXT        NOT NULL,
    last_name       TEXT        NOT NULL,
    email           TEXT        NULL,
    phone_number    TEXT        NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID        NULL,
    CONSTRAINT uq_employees_city_number UNIQUE (city_id, employee_number)
);

CREATE TRIGGER trg_employees_set_updated_at
    BEFORE UPDATE ON organization.employees
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Partial unique index: one iam.users account maps to at most one employee.
CREATE UNIQUE INDEX uq_employees_user_id
    ON organization.employees(user_id)
    WHERE user_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE organization.assignments (
    id          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id     UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    employee_id UUID        NOT NULL REFERENCES organization.employees(id),
    position_id UUID        NOT NULL REFERENCES organization.positions(id),
    office_id   UUID        NOT NULL REFERENCES organization.offices(id),
    start_date  DATE        NOT NULL,
    end_date    DATE        NULL,
    is_active   BOOLEAN     NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ NULL,
    deleted_by  UUID        NULL,
    CONSTRAINT ck_assignments_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TRIGGER trg_assignments_set_updated_at
    BEFORE UPDATE ON organization.assignments
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_assignments_employee ON organization.assignments(employee_id);
CREATE INDEX idx_assignments_position ON organization.assignments(position_id);
CREATE INDEX idx_assignments_office   ON organization.assignments(office_id);

-- [Decision 3.9] end_date NOT NULL: open-ended delegations are prohibited.
-- A scheduled pgboss expiry job fires at end_date (B2 L312: "delegation.expired
-- scheduled job fires 'at validUntil'") — the mechanism itself requires a
-- known end date.
-- [User decision] Column names: delegating_employee_id + delegated_to_employee_id
-- (matches C2 ERD and D4 relationship notation).
-- [Discovered Issue #3] Table name is delegation_grants (not "delegations" —
-- I3 is CONFIRMED; B2's "delegations" reference is stale).
CREATE TABLE organization.delegation_grants (
    id                       UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                  UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    delegating_employee_id   UUID        NOT NULL REFERENCES organization.employees(id),
    delegated_to_employee_id UUID        NOT NULL REFERENCES organization.employees(id),
    office_id                UUID        NOT NULL REFERENCES organization.offices(id),
    position_id              UUID        NOT NULL REFERENCES organization.positions(id),
    -- designation_document_id: logical FK → documents.documents.id (cross-schema)
    -- The D {YEAR}-{NN} designation document evidencing this grant.
    designation_document_id  UUID        NULL,
    scope_description        TEXT        NOT NULL,
    -- scope JSONB: required structure per B5 §5.7 ADR-AUTH-06:
    -- { "roles": [...], "office_ids": [...], "actions": [...] }
    scope                    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    legal_basis              TEXT        NULL,
    start_date               DATE        NOT NULL,
    end_date                 DATE        NOT NULL,  -- open-ended delegations prohibited
    is_active                BOOLEAN     NOT NULL DEFAULT true,
    revoked_by               UUID        NULL,  -- logical FK → iam.users.id (cross-schema)
    revoked_at               TIMESTAMPTZ NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at               TIMESTAMPTZ NULL,
    deleted_by               UUID        NULL,
    CONSTRAINT ck_delegation_dates     CHECK (end_date > start_date),
    CONSTRAINT ck_delegation_not_self  CHECK (delegating_employee_id <> delegated_to_employee_id),
    CONSTRAINT ck_delegation_revocation_consistency
        CHECK ((revoked_at IS NULL) = (is_active = true) OR revoked_at IS NOT NULL)
);

CREATE TRIGGER trg_delegation_grants_set_updated_at
    BEFORE UPDATE ON organization.delegation_grants
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Invariant #16: at most one active delegation per person at any time.
CREATE UNIQUE INDEX uq_delegation_one_active_per_delegatee
    ON organization.delegation_grants(delegated_to_employee_id)
    WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX idx_delegation_delegator ON organization.delegation_grants(delegating_employee_id);
CREATE INDEX idx_delegation_delegatee ON organization.delegation_grants(delegated_to_employee_id);

-- D4 multiplicity: "1" (mandatory) on Committee --> Employee : chairedBy.
CREATE TABLE organization.committees (
    id                     UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    name                   TEXT        NOT NULL,
    code                   TEXT        NOT NULL,
    description            TEXT        NULL,
    chaired_by_employee_id UUID        NOT NULL REFERENCES organization.employees(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at             TIMESTAMPTZ NULL,
    deleted_by             UUID        NULL,
    CONSTRAINT uq_committees_city_code UNIQUE (city_id, code)
);

CREATE TRIGGER trg_committees_set_updated_at
    BEFORE UPDATE ON organization.committees
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TABLE organization.committee_memberships (
    id              UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    committee_id    UUID        NOT NULL REFERENCES organization.committees(id),
    employee_id     UUID        NOT NULL REFERENCES organization.employees(id),
    committee_role  TEXT        NOT NULL CHECK (committee_role IN ('chairman','vice_chairman','member')),
    start_date      DATE        NOT NULL,
    end_date        DATE        NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID        NULL
);

CREATE TRIGGER trg_committee_memberships_set_updated_at
    BEFORE UPDATE ON organization.committee_memberships
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Exactly one active membership per person per committee at any time.
CREATE UNIQUE INDEX uq_committee_membership_active
    ON organization.committee_memberships(committee_id, employee_id)
    WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX idx_committee_memberships_employee ON organization.committee_memberships(employee_id);
```

---

## Part 5 — Schema `documents`

Document lifecycle state machine, immutable version storage, two-stage series numbering (preliminary → final), OCR-on-upload, QR cover sheet generation, Panlalawigan review log, scanned signature tracking, and sponsorship tracking.

```sql
-- ============================================================================
-- PART 5 — SCHEMA: documents
-- ============================================================================

-- owning_module is a routing/ownership label for the module that governs this
-- document type's workflow. 'portal' is valid even though no portal.* tables
-- exist in Phase 1 (Citizen Complaint and Document Request Form live in
-- documents.documents, not portal.*).
CREATE TABLE documents.document_types (
    id                        UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                   UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    name                      TEXT        NOT NULL,
    code                      TEXT        NOT NULL,
    owning_module             TEXT        NOT NULL CHECK (owning_module IN ('workflow','organization','portal')),
    -- number_series_id FK added below, after documents.number_series exists
    -- (breaks the circular DDL dependency).
    number_series_id          UUID        NULL,
    -- [Decision 3.2c] has_preliminary_numbering (V1 naming chosen).
    has_preliminary_numbering BOOLEAN     NOT NULL DEFAULT false,
    control_number_deferred   BOOLEAN     NOT NULL DEFAULT false,
    requires_publication      BOOLEAN     NOT NULL DEFAULT false,
    -- retention_schedule_id: logical FK → records.retention_schedules.id (cross-schema)
    -- Invariant #11: application enforces non-NULL before is_active = true.
    retention_schedule_id     UUID        NULL,
    classification_default    TEXT        NOT NULL CHECK (classification_default IN ('public','internal','confidential','restricted')),
    public_visibility_rule    TEXT        NOT NULL CHECK (public_visibility_rule IN
                                  ('title_and_first_page_public','not_public','complainant_restricted','requester_restricted')),
    -- required_step_types: TEXT[] per V1 (B2's requiredStepTypes is a typed
    -- array; TEXT[] is a natural mapping vs. JSONB for an array of string codes).
    required_step_types       TEXT[]      NULL,
    metadata_schema           JSONB       NULL,
    -- [Decision 3.10] DEFAULT false: types must be explicitly activated.
    -- Seed script must set is_active = true for all seven Phase 1 document types.
    is_active                 BOOLEAN     NOT NULL DEFAULT false,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                TIMESTAMPTZ NULL,
    deleted_by                UUID        NULL,
    CONSTRAINT uq_document_types_city_code UNIQUE (city_id, code),
    -- DB-level second line of defense for Invariant #11 (retention schedule
    -- required before activation). Application must also validate.
    CONSTRAINT ck_document_types_retention_before_activation
        CHECK (is_active = false OR retention_schedule_id IS NOT NULL)
);

CREATE TRIGGER trg_document_types_set_updated_at
    BEFORE UPDATE ON documents.document_types
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- [Decision 3.11] Simple UUID FK to document_types (not the original's
-- composite (city_id, document_type_code) FK). document_type_id is NULL
-- specifically for the panlalawigan_review_log series, which has no
-- document_types row (confirmed per ADR-C1-1, not deferred).
-- series_type and phase are load-bearing columns per H3 Table 1/D4 §SeriesType.
CREATE TABLE documents.number_series (
    id                           UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                      UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    series_key                   TEXT        NOT NULL,
    document_type_id             UUID        NULL REFERENCES documents.document_types(id),
    series_type                  TEXT        NOT NULL CHECK (series_type IN ('legislative','administrative')),
    -- phase: '1' = active in Phase 1; '1b' = Phase 1B (seeded inactive, activated later).
    phase                        TEXT        NOT NULL DEFAULT '1' CHECK (phase IN ('1','1b')),
    prefix                       TEXT        NULL,
    -- sp_ordinal: separates the "7" in "7SP" from the prefix string so an
    -- administration change is a single field update. [Inference — H3 Note 1]
    sp_ordinal                   TEXT        NULL,
    delimiter                    TEXT        NOT NULL DEFAULT ' ',
    sequence_padding             SMALLINT    NOT NULL,
    -- sequence_name_prefix: used by fn_get_next_sequence_value() to locate the
    -- target year's PostgreSQL sequence. E.g. 'ns_nch' → 'documents.ns_nch_2026_seq'.
    sequence_name_prefix         TEXT        NOT NULL,
    year_format                  TEXT        NOT NULL DEFAULT 'YYYY',
    preliminary_format           TEXT        NULL,
    final_format                 TEXT        NOT NULL,
    resets_annually              BOOLEAN     NOT NULL DEFAULT true,
    -- authority_office_id: logical FK → organization.offices.id (cross-schema)
    authority_office_id          UUID        NOT NULL,
    preliminary_assignment_event TEXT        NULL,
    final_assignment_event       TEXT        NOT NULL,
    deferred_final_assignment    BOOLEAN     NOT NULL DEFAULT false,
    is_active                    BOOLEAN     NOT NULL DEFAULT true,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                   TIMESTAMPTZ NULL,
    deleted_by                   UUID        NULL,
    CONSTRAINT uq_number_series_city_key UNIQUE (city_id, series_key)
);

CREATE TRIGGER trg_number_series_set_updated_at
    BEFORE UPDATE ON documents.number_series
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Break the circular DDL dependency: number_series must exist before this FK
-- can be added.
ALTER TABLE documents.document_types
    ADD CONSTRAINT fk_document_types_number_series
    FOREIGN KEY (number_series_id) REFERENCES documents.number_series(id);

-- [Discovered Issue #1] lifecycle_state value set corrected to D3 post-
-- ADR-013/ADR-014 authoritative set. Both candidate C1 documents used a stale
-- 'pending_approval' state. The new set adds: pending_mayor_action,
-- pending_panlalawigan_review, superseded.
-- [Discovered Issue #2] superseded_by, superseded_at, closure_reason columns
-- added per D3 L121 (ADR-014: 'Superseded' terminal state requires these).
CREATE TABLE documents.documents (
    id                     UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    document_type_id       UUID        NOT NULL REFERENCES documents.document_types(id),
    title                  TEXT        NOT NULL,
    lifecycle_state        TEXT        NOT NULL DEFAULT 'draft' CHECK (lifecycle_state IN (
                               'draft','submitted','in_workflow',
                               'pending_mayor_action','pending_panlalawigan_review',
                               'completed','released','archived','disposed',
                               'cancelled','superseded'
                           )),
    classification_level   TEXT        NOT NULL CHECK (classification_level IN ('public','internal','confidential','restricted')),
    -- qr_tracking_number: UUID encoded into the physical QR code. Immutable
    -- from QR assignment. D4 Relationship Note 9: same UUID as tracking.qr_codes.tracking_id.
    qr_tracking_number     UUID        NOT NULL,
    -- Denormalized current number values for fast reads. Full assignment history
    -- lives in documents.numbers.
    preliminary_number     TEXT        NULL,
    final_number           TEXT        NULL,
    -- control_number: used only for Letters Received (SPR) / Letters Sent (SPS)
    -- per H2. Other document types use final_number only.
    control_number         TEXT        NULL,
    number_series_id       UUID        NULL REFERENCES documents.number_series(id),
    -- originating_office_id: logical FK → organization.offices.id (cross-schema) NOT NULL
    originating_office_id  UUID        NOT NULL,
    -- owned_by_office_id: logical FK → organization.offices.id (cross-schema) NOT NULL
    owned_by_office_id     UUID        NOT NULL,
    -- drafted_by_employee_id: logical FK → organization.employees.id (cross-schema)
    -- D4: Document "*" --> "0..1" Employee : draftedBy
    drafted_by_employee_id UUID        NULL,
    -- created_by: logical FK → iam.users.id (cross-schema) NOT NULL
    created_by             UUID        NOT NULL,
    -- workflow_instance_id: logical FK → workflow.instances.id (cross-schema)
    workflow_instance_id   UUID        NULL,
    -- retention_schedule_id: logical FK → records.retention_schedules.id (cross-schema) NOT NULL
    retention_schedule_id  UUID        NOT NULL,
    version_number         INTEGER     NOT NULL DEFAULT 1,
    metadata               JSONB       NULL DEFAULT '{}'::jsonb,
    -- tsv: FTS vector for title; maintained by trigger below.
    tsv                    tsvector    NULL,
    -- superseded_by/superseded_at/closure_reason: required for the 'superseded'
    -- terminal state (D3 L121, ADR-014).
    superseded_by          UUID        NULL REFERENCES documents.documents(id),
    superseded_at          TIMESTAMPTZ NULL,
    closure_reason         TEXT        NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at             TIMESTAMPTZ NULL,
    deleted_by             UUID        NULL,
    CONSTRAINT uq_documents_qr_tracking_number UNIQUE (qr_tracking_number)
);

CREATE TRIGGER trg_documents_set_updated_at
    BEFORE UPDATE ON documents.documents
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_documents_type              ON documents.documents(document_type_id);
CREATE INDEX idx_documents_lifecycle_state   ON documents.documents(lifecycle_state);
CREATE INDEX idx_documents_originating_office ON documents.documents(originating_office_id);
CREATE INDEX idx_documents_owned_by_office   ON documents.documents(owned_by_office_id);
CREATE INDEX idx_documents_workflow_instance ON documents.documents(workflow_instance_id);

-- GIN index for JSONB metadata queries (PostgreSQL Non-Negotiables: "Use GIN
-- indexes. Query with @> operator and ->> accessors").
CREATE INDEX idx_documents_metadata_gin          ON documents.documents USING GIN (metadata);
CREATE INDEX idx_documents_metadata_certified_urgent ON documents.documents ((metadata->>'certified_urgent'));
CREATE INDEX idx_documents_metadata_has_penalty  ON documents.documents ((metadata->>'has_penalty_provision'));
CREATE INDEX idx_documents_metadata_outcome_state ON documents.documents ((metadata->>'outcome_state'));

-- FTS trigger to maintain the tsv column.
CREATE TRIGGER trg_documents_tsv_update
    BEFORE INSERT OR UPDATE OF title ON documents.documents
    FOR EACH ROW
    EXECUTE FUNCTION tsvector_update_trigger(tsv, 'pg_catalog.english', title);

-- [Decision 3.12] released → cancelled is a VALID transition per D3 L99,
-- L146 ("Unchanged from Iteration 1. Extremely rare."). V1's trigger omitting
-- this was incorrect.
-- [Discovered Issue #1] pending_mayor_action and pending_panlalawigan_review
-- are new states replacing the obsolete pending_approval.
CREATE OR REPLACE FUNCTION documents.check_lifecycle_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
DECLARE
    v_allowed BOOLEAN := false;
BEGIN
    IF NEW.lifecycle_state IS DISTINCT FROM OLD.lifecycle_state THEN
        v_allowed := CASE OLD.lifecycle_state
            WHEN 'draft'                        THEN NEW.lifecycle_state IN ('submitted','cancelled')
            WHEN 'submitted'                    THEN NEW.lifecycle_state IN ('in_workflow','cancelled')
            WHEN 'in_workflow'                  THEN NEW.lifecycle_state IN
                                                    ('pending_mayor_action','pending_panlalawigan_review','completed','cancelled')
            WHEN 'pending_mayor_action'         THEN NEW.lifecycle_state IN ('in_workflow','completed','cancelled')
            WHEN 'pending_panlalawigan_review'  THEN NEW.lifecycle_state IN ('completed','superseded','cancelled')
            WHEN 'completed'                    THEN NEW.lifecycle_state IN ('released','cancelled')
            WHEN 'released'                     THEN NEW.lifecycle_state IN ('archived','cancelled')
            WHEN 'archived'                     THEN NEW.lifecycle_state IN ('disposed')
            WHEN 'disposed'                     THEN false
            WHEN 'cancelled'                    THEN false
            WHEN 'superseded'                   THEN false
            ELSE false
        END;

        IF NOT v_allowed THEN
            RAISE EXCEPTION 'invalid document lifecycle transition: % → %',
                OLD.lifecycle_state, NEW.lifecycle_state;
        END IF;
    END IF;
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_documents_lifecycle_transition
    BEFORE UPDATE ON documents.documents
    FOR EACH ROW EXECUTE FUNCTION documents.check_lifecycle_transition();

-- Historical/event-sourced ledger of every number assignment (D4's
-- DocumentNumber). PRELIMINARY rows flip is_current = false when superseded,
-- never edited in place. FINAL and CONTROL numbers are immutable once assigned.
CREATE TABLE documents.numbers (
    id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    document_id      UUID        NOT NULL REFERENCES documents.documents(id),
    number_series_id UUID        NOT NULL REFERENCES documents.number_series(id),
    -- number_type: 'control' is for Letters Received/Sent (SPR/SPS) only.
    number_type      TEXT        NOT NULL CHECK (number_type IN ('preliminary','final','control')),
    number_value     TEXT        NOT NULL,
    sequence_year    SMALLINT    NOT NULL,
    sequence_number  INTEGER     NOT NULL,
    is_current       BOOLEAN     NOT NULL DEFAULT true,
    assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- assigned_by: logical FK → iam.users.id (cross-schema) NOT NULL
    assigned_by      UUID        NOT NULL,
    superseded_at    TIMESTAMPTZ NULL,
    cancellation_reason TEXT     NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ NULL,
    deleted_by       UUID        NULL,
    -- Uniqueness scoped to (series, year, sequence) — not the rendered format
    -- string, since two series can legitimately render the same text.
    CONSTRAINT uq_numbers_series_year_seq UNIQUE (number_series_id, sequence_year, sequence_number)
);

-- At most one current number per type per document.
CREATE UNIQUE INDEX uq_numbers_one_current_per_type
    ON documents.numbers(document_id, number_type)
    WHERE is_current = true AND deleted_at IS NULL;

CREATE INDEX idx_numbers_document ON documents.numbers(document_id);

CREATE OR REPLACE FUNCTION documents.check_number_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
    IF OLD.number_type IN ('final','control')
       AND OLD.number_value IS DISTINCT FROM NEW.number_value THEN
        RAISE EXCEPTION 'final and control numbers are immutable once assigned: % %',
            OLD.number_type, OLD.number_value;
    END IF;
    RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_numbers_immutability
    BEFORE UPDATE ON documents.numbers
    FOR EACH ROW EXECUTE FUNCTION documents.check_number_immutability();

-- file_key is UUID, never the original filename (Invariant #5).
-- file_size_bytes and original_filename added from original document.
CREATE TABLE documents.versions (
    id                           UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                      UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    document_id                  UUID        NOT NULL REFERENCES documents.documents(id),
    version_number               INTEGER     NOT NULL,
    file_key                     UUID        NOT NULL,
    original_filename            TEXT        NULL,
    mime_type                    TEXT        NOT NULL,
    file_size_bytes              BIGINT      NULL,
    page_count                   INTEGER     NULL,
    -- scan_quality_score: 0.0–1.0 confidence value from the OCR engine.
    -- scan_quality_category: derived at OCR-completion time by application
    -- against OCR_QUALITY_THRESHOLD env var (not a GENERATED column; see C2).
    scan_quality_score           NUMERIC(4,3) NULL,
    scan_quality_category        TEXT        NULL CHECK (scan_quality_category IN ('good','fair','poor')),
    ocr_processed                BOOLEAN     NOT NULL DEFAULT false,
    ocr_text                     TEXT        NULL,
    -- tsv: FTS vector for OCR text, maintained by trigger below.
    tsv                          tsvector    NULL,
    requires_manual_verification BOOLEAN     NOT NULL DEFAULT false,
    -- verified_by: logical FK → iam.users.id (cross-schema)
    verified_by                  UUID        NULL,
    verified_at                  TIMESTAMPTZ NULL,
    -- created_by: logical FK → iam.users.id (cross-schema) NOT NULL
    created_by                   UUID        NOT NULL,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                   TIMESTAMPTZ NULL,
    deleted_by                   UUID        NULL,
    CONSTRAINT uq_versions_document_number UNIQUE (document_id, version_number),
    CONSTRAINT ck_versions_scan_quality_range
        CHECK (scan_quality_score IS NULL OR (scan_quality_score >= 0 AND scan_quality_score <= 1))
);

CREATE INDEX idx_versions_document ON documents.versions(document_id);

CREATE TRIGGER trg_versions_tsv_update
    BEFORE INSERT OR UPDATE OF ocr_text ON documents.versions
    FOR EACH ROW
    EXECUTE FUNCTION tsvector_update_trigger(tsv, 'pg_catalog.english', ocr_text);

-- CertificationOfUrgency is stored as an attachment row, not as its own table
-- (D4 Relationship Note 6). source_document_id lets one Certification of
-- Urgency Document (type CERTIFICATION_OF_URGENCY) be attached to several
-- measures without re-uploading the file.
CREATE TABLE documents.attachments (
    id                 UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id            UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    document_id        UUID        NOT NULL REFERENCES documents.documents(id),
    attachment_type    TEXT        NOT NULL CHECK (attachment_type IN
                           ('certification_of_urgency','committee_report','transmittal_letter','scan','other')),
    file_key           UUID        NULL,
    source_document_id UUID        NULL REFERENCES documents.documents(id),
    mime_type          TEXT        NULL,
    file_size_bytes    BIGINT      NULL,
    description        TEXT        NULL,
    -- uploaded_by: logical FK → iam.users.id (cross-schema) NOT NULL
    uploaded_by        UUID        NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at         TIMESTAMPTZ NULL,
    deleted_by         UUID        NULL,
    CONSTRAINT ck_attachments_file_or_source CHECK (file_key IS NOT NULL OR source_document_id IS NOT NULL)
);

CREATE INDEX idx_attachments_document        ON documents.attachments(document_id);
CREATE INDEX idx_attachments_source_document ON documents.attachments(source_document_id);

-- signed_by_employee_id → organization.employees (not iam.users) per D4 L244:
-- "Signature '*' --> '1' Employee : signedBy". Employees may sign without
-- having a platform login (e.g., Mayor who exists as employee before account
-- activation).
CREATE TABLE documents.signatures (
    id                    UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id               UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    document_id           UUID        NOT NULL REFERENCES documents.documents(id),
    signature_type        TEXT        NOT NULL CHECK (signature_type IN
                              ('presiding_officer','mayor','sp_secretary','vice_mayor','committee_chair')),
    -- signed_by_employee_id: logical FK → organization.employees.id (cross-schema) NOT NULL
    signed_by_employee_id UUID        NOT NULL,
    signed_by_display_name TEXT       NULL,  -- denormalized for rendering without a join
    signed_at             TIMESTAMPTZ NOT NULL,
    is_wet_ink            BOOLEAN     NOT NULL DEFAULT false,
    signature_image_s3_key TEXT       NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ NULL,
    deleted_by            UUID        NULL
);

CREATE INDEX idx_signatures_document ON documents.signatures(document_id);

-- [Decision 3.1] document_sponsorships IS a dedicated table per D4 Relationship
-- Note 15: "Sponsorship is distinct from the drafter; a document drafted by
-- Secretariat staff may have multiple councilor sponsors. Required for the
-- Index of Ordinances tracked fields."
-- [Resolved] sponsor_employee_id → organization.employees per D4 L245:
-- "DocumentSponsorship '*' --> '1' Employee : sponsor".
CREATE TABLE documents.document_sponsorships (
    id                  UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    document_id         UUID        NOT NULL REFERENCES documents.documents(id),
    -- sponsor_employee_id: logical FK → organization.employees.id (cross-schema) NOT NULL
    sponsor_employee_id UUID        NOT NULL,
    sponsorship_type    TEXT        NOT NULL CHECK (sponsorship_type IN
                            ('principal_author','co_author','introducer','co_introducer')),
    order_of_priority   INTEGER     NOT NULL DEFAULT 1,
    -- display_name: denormalized per D4 Relationship Note 15 for stable rendering
    -- when the employee record changes.
    display_name        TEXT        NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID        NULL,
    CONSTRAINT uq_sponsorships UNIQUE (document_id, sponsor_employee_id, sponsorship_type)
);

CREATE INDEX idx_sponsorships_document ON documents.document_sponsorships(document_id);

-- [Decision 3.14] Dedicated table; column set sourced from B4's
-- workflow.instances.context JSONB field names for the panlalawigan step.
-- D4 Relationship Note 10: each Document has its own PanlalawiganReview for
-- independent outcome tracking (multiple documents may share one batch
-- control_no). control_no is NOT UNIQUE for this reason.
-- [Decision 3.1] PublicationRecord has NO dedicated table — publication data
-- (newspaper, publication_date) lives in workflow.instances.context JSONB,
-- written transactionally by B4's publication step. No rework benefit from
-- a dedicated table per H2 Implementation Note 2 and B4's existing pattern.
CREATE TABLE documents.panlalawigan_reviews (
    id                         UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                    UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    document_id                UUID        NOT NULL REFERENCES documents.documents(id),
    -- number_series_id → panlalawigan_review_log series (document_type_id = NULL
    -- on that number_series row; confirmed per ADR-C1-1, not deferred).
    number_series_id           UUID        NULL REFERENCES documents.number_series(id),
    -- control_no: the SP Secretariat's sequential log number (e.g. '2026-01').
    -- Not unique: multiple documents per Panlalawigan batch share one reference.
    control_no                 TEXT        NULL,
    subject                    TEXT        NULL,
    transmitted_at             TIMESTAMPTZ NULL,
    received_at                TIMESTAMPTZ NULL,
    action_deadline            TIMESTAMPTZ NULL,
    response_date              TIMESTAMPTZ NULL,
    -- [Decision 3.14] outcome values from B4 L384-388, L799 (five confirmed values).
    outcome                    TEXT        NULL CHECK (outcome IN (
                                   'valid','valid_in_part','returned',
                                   'operative_in_its_entirety','deemed_approved'
                               )),
    -- resolution_number: original document's column naming used (not V1's
    -- abbreviated 'resolution_no'). Sourced from B4 context field names.
    resolution_number          TEXT        NULL,
    remarks                    TEXT        NULL,
    days_elapsed               INTEGER     NULL,  -- computed by application on outcome receipt
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                 TIMESTAMPTZ NULL,
    deleted_by                 UUID        NULL,
    CONSTRAINT uq_panlalawigan_reviews_document UNIQUE (document_id)
);

CREATE TRIGGER trg_panlalawigan_reviews_set_updated_at
    BEFORE UPDATE ON documents.panlalawigan_reviews
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE INDEX idx_panlalawigan_reviews_document ON documents.panlalawigan_reviews(document_id);

-- [Decision 3.13] Hybrid auto-create: creates the target year's sequence on
-- demand if it does not exist (acceptable per H3's explicit allowance for
-- on-demand creation); returns was_created boolean so the calling application
-- module can emit a structured log warning via normal structured logging.
-- SECURITY DEFINER owned by batac_migrate (the DDL-owning role) so that
-- batac_app (runtime) can CREATE SEQUENCE without DDL privileges.
CREATE OR REPLACE FUNCTION documents.fn_get_next_sequence_value(
    p_series_key TEXT,
    p_year       INTEGER
)
RETURNS TABLE (sequence_value BIGINT, was_created BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
    v_prefix   TEXT;
    v_seq_name TEXT;
    v_next     BIGINT;
    v_created  BOOLEAN := false;
BEGIN
    SELECT sequence_name_prefix INTO v_prefix
    FROM documents.number_series
    WHERE series_key = p_series_key AND deleted_at IS NULL;

    IF v_prefix IS NULL THEN
        RAISE EXCEPTION 'unknown or deleted number series: %', p_series_key;
    END IF;

    v_seq_name := 'documents.' || v_prefix || '_' || p_year::text || '_seq';

    BEGIN
        EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next;
    EXCEPTION WHEN undefined_table THEN
        -- On-demand year creation: acceptable per H3's explicit allowance.
        -- was_created = true signals the application to emit a structured
        -- log warning (not an audit event or domain event — operational only).
        EXECUTE format(
            'CREATE SEQUENCE IF NOT EXISTS %s AS INTEGER INCREMENT 1 START 1',
            v_seq_name
        );
        EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next;
        v_created := true;
    END;

    RETURN QUERY SELECT v_next, v_created;
END;
$fn$;

REVOKE ALL ON FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) TO batac_app;
ALTER FUNCTION documents.fn_get_next_sequence_value(TEXT, INTEGER) OWNER TO batac_migrate;
```

---

## Part 6 — Schema `workflow`

The generic workflow engine (definitions, versions, steps, transitions, running instances and step instances, the append-only event log, and the Certified-Urgent bypass queue) exactly as specified in B4, plus the SP-Session/Committee-Report tables D4 places in this schema as "workflow-adjacent".

```sql
-- ============================================================================
-- PART 6 — SCHEMA: workflow
-- ============================================================================

-- Native ENUMs: B4 gives complete, authoritative value lists for these three
-- types. Unlike all other domain-value columns in this document (§1.6),
-- native ENUM is used here because B4 explicitly names them with an "_enum"
-- suffix and they are referenced in the GENERATED status column below.
CREATE TYPE workflow.workflow_step_type_enum AS ENUM
    ('action','approval','multi_referral','decision','notification','termination',
     'parallel_split','parallel_join');
-- parallel_split and parallel_join are Phase 2 step types. Reserved here.

CREATE TYPE workflow.workflow_instance_status_enum AS ENUM
    ('active','suspended','stuck','completed','cancelled');

CREATE TYPE workflow.workflow_step_status_enum AS ENUM
    ('pending','active','completed','bypassed','cancelled','failed');

-- At most one active definition per document type
-- (B4 DB-Level Constraint #1, partial unique index given verbatim in source).
CREATE TABLE workflow.definitions (
    id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    -- document_type_id: logical FK → documents.document_types.id (cross-schema) NOT NULL
    document_type_id UUID        NOT NULL,
    name             TEXT        NOT NULL,
    description      TEXT        NULL,
    is_active        BOOLEAN     NOT NULL DEFAULT false,
    -- created_by: logical FK → iam.users.id (cross-schema) NOT NULL
    created_by       UUID        NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ NULL,
    deleted_by       UUID        NULL
);

CREATE UNIQUE INDEX uq_definitions_one_active_per_doctype
    ON workflow.definitions(document_type_id)
    WHERE is_active = true AND deleted_at IS NULL;

-- Immutable published snapshot. status is a GENERATED column reconciling
-- D4's DefinitionStatus enum (Draft/Published/Deprecated) with B4's actual
-- schema (two nullable timestamps rather than a stored status column).
CREATE TABLE workflow.definition_versions (
    id             UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id        UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    definition_id  UUID        NOT NULL REFERENCES workflow.definitions(id),
    version_number INTEGER     NOT NULL,
    snapshot       JSONB       NOT NULL,  -- authoritative on conflict with denormalized steps rows
    published_at   TIMESTAMPTZ NULL,
    -- published_by: logical FK → iam.users.id (cross-schema)
    published_by   UUID        NULL,
    deprecated_at  TIMESTAMPTZ NULL,
    is_current     BOOLEAN     NOT NULL DEFAULT false,
    status         TEXT GENERATED ALWAYS AS (
                       CASE
                           WHEN deprecated_at IS NOT NULL THEN 'Deprecated'
                           WHEN published_at  IS NOT NULL THEN 'Published'
                           ELSE 'Draft'
                       END
                   ) STORED,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ NULL,
    deleted_by     UUID        NULL,
    CONSTRAINT uq_definition_versions_def_number UNIQUE (definition_id, version_number)
);

-- At most one current version per definition (B4 DB-Level Constraint #2).
CREATE UNIQUE INDEX uq_definition_versions_one_current
    ON workflow.definition_versions(definition_id)
    WHERE is_current = true;

CREATE INDEX idx_definition_versions_definition ON workflow.definition_versions(definition_id);

-- Denormalized from definition_versions.snapshot for query efficiency.
CREATE TABLE workflow.steps (
    id                    UUID                             NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id               UUID                             NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    definition_version_id UUID                             NOT NULL REFERENCES workflow.definition_versions(id),
    step_key              TEXT                             NOT NULL,
    step_type             workflow.workflow_step_type_enum NOT NULL,
    label                 TEXT                             NOT NULL,
    config                JSONB                            NULL,
    position              INTEGER                          NOT NULL DEFAULT 0,
    is_start              BOOLEAN                          NOT NULL DEFAULT false,
    created_at            TIMESTAMPTZ                      NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ                      NULL,
    deleted_by            UUID                             NULL,
    CONSTRAINT uq_steps_version_key UNIQUE (definition_version_id, step_key)
);

-- Exactly one start step per definition version (B4 Engine Invariant).
CREATE UNIQUE INDEX uq_steps_one_start_per_version
    ON workflow.steps(definition_version_id)
    WHERE is_start = true AND deleted_at IS NULL;

CREATE INDEX idx_steps_definition_version ON workflow.steps(definition_version_id);

-- Composite FK enforces B4 Engine Invariant #12: no transition may point to
-- a step from a different definition version (C2 §workflow annotation).
CREATE TABLE workflow.transition_rules (
    id                    UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id               UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    definition_version_id UUID        NOT NULL REFERENCES workflow.definition_versions(id),
    from_step_id          UUID        NOT NULL REFERENCES workflow.steps(id),
    to_step_id            UUID        NOT NULL REFERENCES workflow.steps(id),
    condition_expression  TEXT        NULL,
    outcome_filter        TEXT        NULL,
    priority              INTEGER     NOT NULL DEFAULT 0,
    label                 TEXT        NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ NULL,
    deleted_by            UUID        NULL
);

CREATE INDEX idx_transition_rules_from_step          ON workflow.transition_rules(from_step_id);
CREATE INDEX idx_transition_rules_definition_version ON workflow.transition_rules(definition_version_id);

-- definition_version_id pinned at creation (B4 Invariant #4). No update path
-- except via engine.migrateInstance with a mandatory comment (B4 DB-Level
-- Constraint #5 — no trigger added here, by design).
-- context JSONB: mutable state store. Schema enforced by application (Zod, per
-- B4); not by a PostgreSQL CHECK constraint. Key set includes: mayor_action,
-- panlalawigan_outcome, certified_urgent, publication fields (newspaper,
-- publication_date — the PublicationRecord data lives here, not in a separate
-- table per Decision 3.1).
CREATE TABLE workflow.instances (
    id                    UUID                                  NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id               UUID                                  NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    definition_version_id UUID                                  NOT NULL REFERENCES workflow.definition_versions(id),
    -- document_id: logical FK → documents.documents.id (cross-schema) NOT NULL
    document_id           UUID                                  NOT NULL,
    status                workflow.workflow_instance_status_enum NOT NULL DEFAULT 'active',
    context               JSONB                                 NOT NULL DEFAULT '{}'::jsonb,
    sla_deadline          TIMESTAMPTZ                           NULL,
    sla_breached_at       TIMESTAMPTZ                           NULL,
    started_at            TIMESTAMPTZ                           NOT NULL DEFAULT now(),
    completed_at          TIMESTAMPTZ                           NULL,
    -- created_by: logical FK → iam.users.id (cross-schema) NOT NULL
    created_by            UUID                                  NOT NULL,
    created_at            TIMESTAMPTZ                           NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ                           NULL,
    deleted_by            UUID                                  NULL
);

CREATE INDEX idx_instances_document           ON workflow.instances(document_id);
CREATE INDEX idx_instances_definition_version ON workflow.instances(definition_version_id);
CREATE INDEX idx_instances_sla_active         ON workflow.instances(sla_deadline) WHERE status = 'active';

-- Encoder/final-approver distinct-user invariant (#13) is application-layer
-- only per B4 ("not a DB constraint") — no trigger added here, by design.
CREATE TABLE workflow.step_instances (
    id              UUID                             NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID                             NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    instance_id     UUID                             NOT NULL REFERENCES workflow.instances(id),
    step_id         UUID                             NOT NULL REFERENCES workflow.steps(id),
    status          workflow.workflow_step_status_enum NOT NULL DEFAULT 'pending',
    assigned_to     JSONB                            NULL,
    started_at      TIMESTAMPTZ                      NULL,
    completed_at    TIMESTAMPTZ                      NULL,
    outcome         TEXT                             NULL,
    outcome_comment TEXT                             NULL,
    metadata        JSONB                            NULL,  -- multi_referral submissions; see B4 step_instances.metadata shape
    sla_deadline    TIMESTAMPTZ                      NULL,
    sla_breached_at TIMESTAMPTZ                      NULL,
    bypassed_at     TIMESTAMPTZ                      NULL,
    -- bypassed_by: logical FK → iam.users.id (cross-schema); null = system-triggered
    bypassed_by     UUID                             NULL,
    bypass_reason   TEXT                             NULL,
    created_at      TIMESTAMPTZ                      NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ                      NULL,
    deleted_by      UUID                             NULL
);

CREATE INDEX idx_step_instances_instance    ON workflow.step_instances(instance_id);
CREATE INDEX idx_step_instances_step        ON workflow.step_instances(step_id);
CREATE INDEX idx_step_instances_metadata_gin ON workflow.step_instances USING GIN (metadata);

-- Append-only event log. No deleted_at/deleted_by, no updated_at (§1.5).
-- UPDATE and DELETE revoked from batac_app at the grant level below (Invariant #3 / B4).
CREATE TABLE workflow.workflow_events (
    id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    instance_id      UUID        NOT NULL REFERENCES workflow.instances(id),
    step_instance_id UUID        NULL REFERENCES workflow.step_instances(id),
    event_type       TEXT        NOT NULL,
    -- actor_id: logical FK → iam.users.id (cross-schema); null for system events
    actor_id         UUID        NULL,
    actor_type       TEXT        NOT NULL CHECK (actor_type IN ('user','system','scheduler')),
    payload          JSONB       NOT NULL,
    occurred_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_events_instance      ON workflow.workflow_events(instance_id);
CREATE INDEX idx_workflow_events_step_instance ON workflow.workflow_events(step_instance_id);
CREATE INDEX idx_workflow_events_occurred_at   ON workflow.workflow_events(occurred_at);

-- Tracks deferred Certified Urgent bypasses for instances whose
-- multi_referral step has not yet activated when the Certification is logged (B4).
CREATE TABLE workflow.pending_certified_urgent_bypasses (
    id                          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                     UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    instance_id                 UUID        NOT NULL REFERENCES workflow.instances(id),
    step_key                    TEXT        NOT NULL DEFAULT 'committee_referral',
    -- certification_document_id: logical FK → documents.documents.id (cross-schema) NOT NULL
    certification_document_id   UUID        NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_at                  TIMESTAMPTZ NULL,
    applied_to_step_instance_id UUID        NULL REFERENCES workflow.step_instances(id),
    deleted_at                  TIMESTAMPTZ NULL,
    deleted_by                  UUID        NULL
);

CREATE INDEX idx_pending_bypasses_instance ON workflow.pending_certified_urgent_bypasses(instance_id);

-- ── Workflow-adjacent: SP Session and Committee Report ────────────────────────
-- D4 places these in the workflow schema explicitly ("Includes: SP Session and
-- Committee Report — workflow-adjacent"). B4 does not cover them since it scopes
-- only the generic, reusable engine mechanics.

-- 1:1 with a multi_referral step_instance — represents the eventual unified
-- report for that step (individual committee submissions live in
-- step_instances.metadata.submissions per B4).
CREATE TABLE workflow.committee_reports (
    id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    step_instance_id UUID        NOT NULL REFERENCES workflow.step_instances(id),
    submitted_at     TIMESTAMPTZ NULL,
    is_unified       BOOLEAN     NOT NULL DEFAULT false,
    is_accepted      BOOLEAN     NOT NULL DEFAULT false,
    -- accepted_by: logical FK → iam.users.id (cross-schema)
    accepted_by      UUID        NULL,
    accepted_at      TIMESTAMPTZ NULL,
    content          TEXT        NULL,
    -- document_id: logical FK → documents.documents.id (cross-schema)
    document_id      UUID        NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ NULL,
    deleted_by       UUID        NULL,
    CONSTRAINT uq_committee_reports_step_instance UNIQUE (step_instance_id)
);

CREATE TRIGGER trg_committee_reports_set_updated_at
    BEFORE UPDATE ON workflow.committee_reports
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- Junction for CommitteeReport *--* Committee : signedBy (D4).
CREATE TABLE workflow.committee_report_signatures (
    id                    UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id               UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    committee_report_id   UUID        NOT NULL REFERENCES workflow.committee_reports(id),
    -- committee_id: logical FK → organization.committees.id (cross-schema) NOT NULL
    committee_id          UUID        NOT NULL,
    -- signed_by_employee_id: logical FK → organization.employees.id (cross-schema)
    signed_by_employee_id UUID        NULL,
    signed_at             TIMESTAMPTZ NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ NULL,
    deleted_by            UUID        NULL,
    CONSTRAINT uq_committee_report_signatures UNIQUE (committee_report_id, committee_id)
);

CREATE TABLE workflow.sp_sessions (
    id                      UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                 UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    session_number          INTEGER     NOT NULL,
    session_date            DATE        NOT NULL,
    session_type            TEXT        NOT NULL CHECK (session_type IN ('regular','special')),
    -- presided_by_employee_id: logical FK → organization.employees.id (cross-schema) NOT NULL
    presided_by_employee_id UUID        NOT NULL,
    present_count           INTEGER     NULL,
    quorum_achieved         BOOLEAN     NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ NULL,
    deleted_by              UUID        NULL,
    CONSTRAINT uq_sp_sessions_city_number UNIQUE (city_id, session_number)
);

CREATE TRIGGER trg_sp_sessions_set_updated_at
    BEFORE UPDATE ON workflow.sp_sessions
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TABLE workflow.session_attendances (
    id              UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    sp_session_id   UUID        NOT NULL REFERENCES workflow.sp_sessions(id),
    -- employee_id: logical FK → organization.employees.id (cross-schema) NOT NULL
    employee_id     UUID        NOT NULL,
    is_present      BOOLEAN     NOT NULL,
    absence_reason  TEXT        NULL CHECK (absence_reason IN ('ob','sick_leave','vacation_leave','absent')),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ NULL,
    deleted_by      UUID        NULL,
    CONSTRAINT uq_session_attendance UNIQUE (sp_session_id, employee_id),
    CONSTRAINT ck_attendance_reason CHECK (is_present = true OR absence_reason IS NOT NULL)
);

CREATE TABLE workflow.order_of_business (
    id            UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id       UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    sp_session_id UUID        NOT NULL REFERENCES workflow.sp_sessions(id),
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    cutoff_date   DATE        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ NULL,
    deleted_by    UUID        NULL,
    CONSTRAINT uq_order_of_business_session UNIQUE (sp_session_id)
);

-- item_type values: [Inference] from First/Second/Third Reading + Committee
-- Report vocabulary used throughout source documents.
CREATE TABLE workflow.order_of_business_items (
    id                   UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id              UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    order_of_business_id UUID        NOT NULL REFERENCES workflow.order_of_business(id),
    -- document_id: logical FK → documents.documents.id (cross-schema) NOT NULL
    document_id          UUID        NOT NULL,
    item_order           INTEGER     NOT NULL,
    item_type            TEXT        NOT NULL CHECK (item_type IN
                             ('first_reading','second_reading','third_reading','committee_report','other')),
    is_red_flagged       BOOLEAN     NOT NULL DEFAULT false,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at           TIMESTAMPTZ NULL,
    deleted_by           UUID        NULL,
    CONSTRAINT uq_oob_items_order UNIQUE (order_of_business_id, item_order)
);
```

---

## Part 7 — Schema `tracking`

QR code identity, the physical/custody tracking record per document, and the append-style routing history. Deliberately kept separate from `documents.documents.lifecycle_state`: "Physical custody tracked separately from digital workflow status."

```sql
-- ============================================================================
-- PART 7 — SCHEMA: tracking
-- ============================================================================

-- tracking_id holds the same UUID value as documents.documents.qr_tracking_number
-- (D4 Relationship Note 9). Assigned at secretariat logging, before the
-- preliminary number (D4 Relationship Note 1 assignment sequence).
CREATE TABLE tracking.qr_codes (
    id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    -- document_id: logical FK → documents.documents.id (cross-schema) NOT NULL
    document_id      UUID        NOT NULL,
    tracking_id      UUID        NOT NULL,  -- UUID encoded in the physical QR image
    qr_image_file_key UUID       NULL,
    assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- generated_by: logical FK → iam.users.id (cross-schema)
    generated_by     UUID        NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ NULL,
    deleted_by       UUID        NULL,
    CONSTRAINT uq_qr_codes_tracking_id UNIQUE (tracking_id),
    CONSTRAINT uq_qr_codes_document    UNIQUE (document_id)
);

-- current_status is intentionally free TEXT, not CHECK-constrained against
-- documents.lifecycle_state — the two are explicitly separate state machines
-- (physical custody vs. digital workflow status).
CREATE TABLE tracking.tracking_records (
    id                       UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                  UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    -- document_id: logical FK → documents.documents.id (cross-schema) NOT NULL
    document_id              UUID        NOT NULL,
    qr_code_id               UUID        NOT NULL REFERENCES tracking.qr_codes(id),
    current_status           TEXT        NULL,
    -- current_custodian_office_id: logical FK → organization.offices.id (cross-schema)
    -- NULL if document is with an external party.
    current_custodian_office_id UUID     NULL,
    physical_location        TEXT        NULL,
    last_moved_at            TIMESTAMPTZ NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at               TIMESTAMPTZ NULL,
    deleted_by               UUID        NULL,
    CONSTRAINT uq_tracking_records_document UNIQUE (document_id)
);

CREATE INDEX idx_tracking_records_qr_code ON tracking.tracking_records(qr_code_id);

-- Append-only: no updated_at (§1.4). Field shape follows B2's RoutingEntry
-- TypeScript interface (fromOfficeId/toOfficeId/actorId/actionDescription/
-- timestamp) rather than D4's looser fromLocation/toLocation strings, since
-- B2 is explicitly the "Shared Types — Inform Column Definitions" source.
CREATE TABLE tracking.routing_entries (
    id                  UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id             UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    tracking_record_id  UUID        NOT NULL REFERENCES tracking.tracking_records(id),
    -- from_office_id: logical FK → organization.offices.id (cross-schema); NULL at first entry
    from_office_id      UUID        NULL,
    -- to_office_id: logical FK → organization.offices.id (cross-schema); NULL when external
    to_office_id        UUID        NULL,
    -- actor_id: logical FK → iam.users.id (cross-schema); null = system action
    actor_id            UUID        NULL,
    action_description  TEXT        NOT NULL,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ NULL,
    deleted_by          UUID        NULL
);

CREATE INDEX idx_routing_entries_tracking_record ON tracking.routing_entries(tracking_record_id);
CREATE INDEX idx_routing_entries_occurred_at     ON tracking.routing_entries(occurred_at);
```

---

## Part 8 — Schema `records`

Retention schedules, classification rules, the post-workflow record catalog, archive entries, and dispositions. `retention_schedules` is a Phase 1 dependency (both `documents.document_types.retention_schedule_id` and `documents.documents.retention_schedule_id` require a schedule before activation — Architectural Invariant #11).

```sql
-- ============================================================================
-- PART 8 — SCHEMA: records
-- ============================================================================

-- document_type_id is intentionally NOT a column here: the governing direction
-- is documents.document_types.retention_schedule_id → records.retention_schedules.id,
-- so this table stays a standalone catalog rather than holding a redundant inverse.
CREATE TABLE records.retention_schedules (
    id                     UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    name                   TEXT        NOT NULL,
    code                   TEXT        NOT NULL,
    retention_period_years INTEGER     NULL,
    is_permanent           BOOLEAN     NOT NULL DEFAULT false,
    disposition_rule       TEXT        NULL,
    legal_basis            TEXT        NULL,
    -- configured_by: logical FK → iam.users.id (cross-schema); Platform Admin, Tier 2
    configured_by          UUID        NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at             TIMESTAMPTZ NULL,
    deleted_by             UUID        NULL,
    CONSTRAINT chk_retention_period CHECK (is_permanent = true OR retention_period_years IS NOT NULL)
);

CREATE TRIGGER trg_retention_schedules_set_updated_at
    BEFORE UPDATE ON records.retention_schedules
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TABLE records.classification_rules (
    id                          UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                     UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    retention_schedule_id       UUID        NOT NULL REFERENCES records.retention_schedules(id),
    condition_expression        TEXT        NOT NULL,
    target_classification_level TEXT        NOT NULL CHECK (target_classification_level IN
                                    ('public','internal','confidential','restricted')),
    priority                    INTEGER     NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                  TIMESTAMPTZ NULL,
    deleted_by                  UUID        NULL
);

CREATE INDEX idx_classification_rules_schedule ON records.classification_rules(retention_schedule_id);

-- record_type constrained per ADR-D4-1. Six values ratified from Consolidated Reference Part 11.7.
CREATE TABLE records.records (
    id                UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id           UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    -- document_id: logical FK → documents.documents.id (cross-schema) NOT NULL
    document_id       UUID        NOT NULL,
    retention_schedule_id UUID   NOT NULL REFERENCES records.retention_schedules(id),
    record_number     TEXT        NOT NULL,
    record_type       TEXT        NOT NULL CHECK (record_type IN
                          ('LEGISLATIVE_PERMANENT','FINANCIAL','PERSONNEL',
                           'CORRESPONDENCE','INTERNAL_MEMO','DRAFT')),
    classification_level TEXT     NOT NULL CHECK (classification_level IN
                              ('public','internal','confidential','restricted')),
    physical_location TEXT        NULL,
    legal_hold        BOOLEAN     NOT NULL DEFAULT false,
    legal_hold_reason TEXT        NULL,
    accession_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
    retention_expires_at TIMESTAMPTZ NULL,
    -- created_by: logical FK → iam.users.id (cross-schema) NOT NULL
    created_by        UUID        NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ NULL,
    deleted_by        UUID        NULL,
    CONSTRAINT uq_records_city_number UNIQUE (city_id, record_number),
    CONSTRAINT uq_records_document    UNIQUE (document_id)
);

CREATE TABLE records.archive_entries (
    id                       UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                  UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    -- document_id: logical FK → documents.documents.id (cross-schema) NOT NULL
    document_id              UUID        NOT NULL,
    archived_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    archive_location         TEXT        NULL,
    -- archived_by_employee_id: logical FK → organization.employees.id (cross-schema) NOT NULL
    archived_by_employee_id  UUID        NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at               TIMESTAMPTZ NULL,
    deleted_by               UUID        NULL,
    CONSTRAINT uq_archive_entries_document UNIQUE (document_id)
);

-- disposition_type distinguishes standard disposal from RA 10173 PII erasure.
-- RA 10173 erasure requires formal City Legal / DPO review; CHECK enforces the
-- review fields are set as a second line of defense.
CREATE TABLE records.dispositions (
    id                        UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id                   UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    -- document_id: logical FK → documents.documents.id (cross-schema) NOT NULL
    document_id               UUID        NOT NULL,
    disposed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason                    TEXT        NOT NULL,
    legal_basis               TEXT        NULL,
    disposition_type          TEXT        NOT NULL DEFAULT 'standard'
                                  CHECK (disposition_type IN ('standard','ra10173_erasure')),
    -- legal_review_by: logical FK → iam.users.id (cross-schema)
    legal_review_by           UUID        NULL,
    legal_review_at           TIMESTAMPTZ NULL,
    -- authorized_by_employee_id: logical FK → organization.employees.id (cross-schema) NOT NULL
    authorized_by_employee_id UUID        NOT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at                TIMESTAMPTZ NULL,
    deleted_by                UUID        NULL,
    CONSTRAINT uq_dispositions_document UNIQUE (document_id),
    CONSTRAINT ck_disposition_erasure_review
        CHECK (disposition_type <> 'ra10173_erasure' OR legal_review_by IS NOT NULL)
);
```

---

## Part 9 — Schema `notifications`

Templates, dispatched notification events, and per-attempt delivery logs. Phase 1 recipients are internal employees only (D4 Relationship Note 14). `recipient_email`/`recipient_phone` exist to support external recipients such as complaint respondents. Per ADR-B2-4, all respondent notices route through this module.

```sql
-- ============================================================================
-- PART 9 — SCHEMA: notifications
-- ============================================================================

CREATE TABLE notifications.templates (
    id               UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id          UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    name             TEXT        NOT NULL,
    channel          TEXT        NOT NULL CHECK (channel IN ('in_app','email','sms')),
    subject_template TEXT        NULL,
    body_template    TEXT        NOT NULL,
    is_active        BOOLEAN     NOT NULL DEFAULT true,
    -- created_by: logical FK → iam.users.id (cross-schema); Platform Admin, Tier 2
    created_by       UUID        NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ NULL,
    deleted_by       UUID        NULL,
    CONSTRAINT uq_templates_city_name_channel UNIQUE (city_id, name, channel)
);

CREATE TRIGGER trg_templates_set_updated_at
    BEFORE UPDATE ON notifications.templates
    FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TABLE notifications.notification_events (
    id                    UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id               UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    template_id           UUID        NOT NULL REFERENCES notifications.templates(id),
    channel               TEXT        NOT NULL CHECK (channel IN ('in_app','email','sms')),
    -- recipient_employee_id: logical FK → organization.employees.id (cross-schema)
    recipient_employee_id UUID        NULL,
    recipient_email       TEXT        NULL,
    recipient_phone       TEXT        NULL,
    template_data         JSONB       NULL,
    status                TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','sent','failed','cancelled')),
    triggered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    source_event_type     TEXT        NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ NULL,
    deleted_by            UUID        NULL
);

CREATE INDEX idx_notification_events_template  ON notifications.notification_events(template_id);
CREATE INDEX idx_notification_events_recipient ON notifications.notification_events(recipient_employee_id);

-- Append-only: no updated_at (§1.4).
CREATE TABLE notifications.delivery_log (
    id                    UUID        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id               UUID        NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    notification_event_id UUID        NOT NULL REFERENCES notifications.notification_events(id),
    attempt_count         INTEGER     NOT NULL DEFAULT 1,
    status                TEXT        NOT NULL CHECK (status IN ('delivered','bounced','failed')),
    delivered_at          TIMESTAMPTZ NULL,
    error_message         TEXT        NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at            TIMESTAMPTZ NULL,
    deleted_by            UUID        NULL
);

CREATE INDEX idx_delivery_log_event ON notifications.delivery_log(notification_event_id);
```

---

## Part 10 — Schema `audit`

Append-only, hash-chained, HMAC-signed activity log. The application — never the database — computes `chain_hash` and `hmac` using Node's built-in `crypto` module. No `deleted_at`/`deleted_by`, no `updated_at` (§1.5). UPDATE and DELETE revoked from all roles at the grant level (Invariant #3).

```sql
-- ============================================================================
-- PART 10 — SCHEMA: audit
-- ============================================================================

-- Gives the hash chain an unambiguous, monotonic "previous record" pointer
-- independent of wall-clock timestamp ordering.
CREATE SEQUENCE audit.events_sequence_seq AS BIGINT INCREMENT 1 START 1;

CREATE TABLE audit.events (
    id              UUID    NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    city_id         UUID    NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001'::uuid,
    sequence_number BIGINT  NOT NULL DEFAULT nextval('audit.events_sequence_seq'),
    event_type      TEXT    NOT NULL,
    -- actor_id: logical FK → iam.users.id (cross-schema); null for system events
    actor_id        UUID    NULL,
    target_id       UUID    NULL,
    target_type     TEXT    NULL,
    payload         JSONB   NOT NULL,
    chain_hash      TEXT    NOT NULL CHECK (chain_hash ~ '^[a-f0-9]{64}$'),
    hmac            TEXT    NOT NULL CHECK (hmac ~ '^[a-f0-9]{64}$'),
    hmac_key_version INTEGER NOT NULL DEFAULT 1,
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_audit_events_sequence    ON audit.events(sequence_number);
CREATE INDEX idx_audit_events_city_occurred     ON audit.events(city_id, occurred_at);
CREATE INDEX idx_audit_events_actor             ON audit.events(actor_id);
CREATE INDEX idx_audit_events_target            ON audit.events(target_id);
```

---

## Part 11 — 2026 Numbering Sequences

One PostgreSQL sequence per series per year (PostgreSQL Non-Negotiables: "Sequences for gapless document numbering"; H3 Table 2). Only the current year's eleven sequences are created here. Subsequent years are created by an annual migration following the `ns_{prefix}_{YEAR}_seq` naming pattern — an operations/migration-scheduling concern that H3 explicitly excludes from DDL scope. `documents.fn_get_next_sequence_value()` auto-creates missing year sequences on demand as a safety net, but pre-creation via migration is the expected path.

```sql
-- ============================================================================
-- PART 11 — 2026 NUMBERING SEQUENCES
-- ============================================================================

CREATE SEQUENCE documents.ns_sp_resolution_2026_seq                AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_sp_ordinance_2026_seq                  AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_sp_appropriation_ordinance_2026_seq    AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_nch_2026_seq                           AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_nosp_2026_seq                          AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_designation_2026_seq                   AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_letters_received_2026_seq              AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_letters_sent_2026_seq                  AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_memo_outgoing_2026_seq                 AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_memo_incoming_2026_seq                 AS INTEGER INCREMENT 1 START 1;
CREATE SEQUENCE documents.ns_panlalawigan_review_log_2026_seq       AS INTEGER INCREMENT 1 START 1;
```

---

## Part 12 — Roles, Grants, and Row-Level Security

Implements the two explicit PostgreSQL non-negotiables that cut across schemas: office-level data isolation via RLS, and IT admin having no access to document content. Credentials and login provisioning are via secrets manager / Terraform (Invariant #15) and are out of scope for DDL.

> **Note on B4's `workflow_app_user` reference (B4 L939):** This role name does not appear in I3's confirmed role set or in L2's actual grant script. It is treated as a stale reference superseded by I3's `[CONFIRMED]`-labeled role consolidation. All workflow grants below go to `batac_app`. B4 should be corrected accordingly.

```sql
-- ============================================================================
-- PART 12 — ROLES, GRANTS, AND ROW-LEVEL SECURITY
-- ============================================================================
-- Roles declared in Part 2; grants and RLS policies follow.

-- ── batac_app: runtime application service account ───────────────────────────

GRANT USAGE ON SCHEMA iam, organization, documents, workflow, tracking, records, notifications
    TO batac_app;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA iam            TO batac_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA organization   TO batac_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA documents      TO batac_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA workflow       TO batac_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA tracking       TO batac_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA records        TO batac_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA notifications  TO batac_app;

-- Invariant #2: no hard deletes. DELETE revoked at the grant level.
-- (No explicit REVOKE needed since DELETE was never granted above, but
-- stated here for documentation clarity.)

-- workflow.workflow_events is append-only (B4): explicitly revoke UPDATE/DELETE.
REVOKE UPDATE, DELETE ON workflow.workflow_events FROM batac_app;

-- Sequences: batac_app needs USAGE on numbering sequences.
GRANT USAGE ON ALL SEQUENCES IN SCHEMA documents TO batac_app;
GRANT USAGE ON SEQUENCE audit.events_sequence_seq TO batac_audit;

-- ── batac_audit: audit log writes only ───────────────────────────────────────

GRANT USAGE ON SCHEMA audit TO batac_audit;
GRANT INSERT ON audit.events TO batac_audit;
-- Explicitly confirm: no SELECT, UPDATE, or DELETE on audit.events for batac_audit.
REVOKE SELECT, UPDATE, DELETE ON audit.events FROM batac_audit;

-- ── batac_it_admin: IT Admin ops, no document content ────────────────────────

GRANT USAGE ON SCHEMA documents TO batac_it_admin;
GRANT SELECT, UPDATE ON documents.documents TO batac_it_admin;
-- Invariant #10: IT admin has no document file content access, full stop —
-- not even for public documents.
REVOKE ALL ON documents.versions    FROM batac_it_admin;
REVOKE ALL ON documents.attachments FROM batac_it_admin;

-- ── batac_readonly: monitoring/reporting ─────────────────────────────────────

GRANT USAGE ON SCHEMA iam, organization, documents, workflow, tracking, records, notifications
    TO batac_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA iam            TO batac_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA organization   TO batac_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA documents      TO batac_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA workflow       TO batac_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA tracking       TO batac_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA records        TO batac_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA notifications  TO batac_readonly;

-- ── Row-Level Security ────────────────────────────────────────────────────────

-- documents.documents: office-level isolation + IT admin content block.
ALTER TABLE documents.documents ENABLE ROW LEVEL SECURITY;

-- Office isolation: a user's owned_by_office_id must match, or
-- app.bypass_office_isolation must be set (for SP Secretary, Records Officer, etc).
CREATE POLICY documents_office_isolation ON documents.documents
    FOR SELECT
    TO batac_app
    USING (
        owned_by_office_id = current_setting('app.current_office_id', true)::uuid
        OR current_setting('app.bypass_office_isolation', true) = 'true'
    );

-- IT admin: may see metadata rows for non-confidential/restricted documents
-- (e.g., to diagnose a stuck workflow) but never confidential or restricted.
CREATE POLICY documents_it_admin_no_confidential ON documents.documents
    FOR SELECT
    TO batac_it_admin
    USING (classification_level NOT IN ('confidential','restricted'));

-- IT admin UPDATE: closed-default policy — no UPDATE can commit until a
-- specific, narrower policy is added for the exact fields IT admin may touch.
CREATE POLICY documents_it_admin_metadata_only_update ON documents.documents
    FOR UPDATE
    TO batac_it_admin
    USING (true)
    WITH CHECK (false);

-- iam.sessions: own-session visibility + IT/Security Admin force-terminate.
ALTER TABLE iam.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_own_or_admin ON iam.sessions
    FOR SELECT
    TO batac_app
    USING (
        user_id = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_role_tier', true) IN ('IT_ADMIN','SECURITY_ADMIN')
    );
```

---

## Part 13 — Reserved Phase 2/3 Schemas

The `search_meta`, `portal`, and `reporting` schemas were created in Part 2. No tables are created in any of the three in Phase 1 DDL.

| Schema | Phase | Planned tables |
|---|---|---|
| `search_meta` | 2 | `index_metadata`, `index_jobs` |
| `portal` | 3 | `public_documents`, `citizen_requests`, `complaints`, `announcements` |
| `reporting` | 2 | `report_definitions`, `schedules`, `outputs` |

---

## Part 14 — Invariant and Non-Negotiable Compliance Checklist

| # | Invariant / Non-Negotiable | Mechanism in this DDL |
|---|---|---|
| 1 | No cross-schema FK constraints | All cross-schema references are plain UUID columns with inline comments; no `REFERENCES` clause crosses schema boundary |
| 2 | No hard deletes | `DELETE` not granted to any application role (`batac_app`, `batac_audit`, `batac_it_admin`, `batac_readonly`) |
| 3 | Audit log INSERT-only | `batac_audit` granted only `INSERT` on `audit.events`; `REVOKE UPDATE, DELETE` on `audit.events` from all roles |
| 4 | Document lifecycle transitions enforced at DB | `documents.check_lifecycle_transition()` `BEFORE UPDATE` trigger |
| 5 | S3 file keys are UUIDs, never original filenames | `versions.file_key UUID`, `attachments.file_key UUID`; no `original_filename` as a key column |
| 6 | One active session per user | Partial unique index `idx_sessions_one_active_per_user` on `iam.sessions(user_id) WHERE active = true` |
| 7 | Final numbers immutable | `documents.check_number_immutability()` trigger on `documents.numbers` |
| 8 | Retention schedule required before document type activation | `ck_document_types_retention_before_activation` CHECK constraint |
| 9 | One active delegation per user | Partial unique index `uq_delegation_one_active_per_delegatee` |
| 10 | IT admin has no document file content access | `REVOKE ALL ON documents.versions, documents.attachments FROM batac_it_admin`; RLS policy blocks metadata for confidential/restricted |
| 11 | Gapless document numbering | PostgreSQL sequences per series per year; `fn_get_next_sequence_value()` for safe consumption |
| 12 | Append-only logs | `workflow.workflow_events`: no `deleted_at`, `REVOKE UPDATE, DELETE`; `audit.events`: no `deleted_at`/`updated_at`, INSERT-only grant |
| 13 | `city_id` on every table | All 52 tables include `city_id UUID NOT NULL DEFAULT '...'::uuid` |
| 14 | Required workflow step types stored | `documents.document_types.required_step_types TEXT[]` |

---

## Part 15 — Open Items Requiring Confirmation

### Resolved

| Item | Resolution | Reference |
|---|---|---|
| `panlalawigan_review_log` entity classification | **Formalized as an internal tracking/log entity, not a public document type.** `documents.number_series.document_type_id = NULL` for this series is confirmed permanent, not provisional. `documents.panlalawigan_reviews` remains the authoritative table in the `documents` schema. Control numbers from this series do not appear in the standard document catalog, search, or listings — only as a field on the parent document. No DDL change required. | `ADR-C1-1` (`c1-full-database-schema-ddl-v3-adrs/ADR-C1-1-panlalawigan-review-log-classification.md`) |
| Migration-owning role name (`batac_migrate`) | **Confirmed as-is.** Already defined and used consistently in this document (§3.16, DB roles list, `fn_get_next_sequence_value` `OWNER TO`). C5 did not previously name it; an addendum cross-referencing this document's §3.16 has been prepared for C5 rather than introducing a second definition. No DDL change required. | C5 addendum — "Migration-Owning Role Name (`batac_migrate`)" |
| `RecordType` enum values | **Six-value enum defined**, ratifying the categories already present in Part 11.7 of the Consolidated Reference (Permanent-Legislative, Financial, Personnel, Correspondence, Internal Memo, Draft), plus a `document_type` → `RecordType` mapping. `records.records.record_type` should be updated from unconstrained `TEXT` to a `CHECK` constraint or native enum over the six values (see DDL change below). **Retention-period figures behind each category remain `[Unverified]` pending NAP/COA/DILG confirmation — this ADR resolves the enum only, not the legal retention durations.** | `ADR-D4-1` (`c1-full-database-schema-ddl-v3-adrs/ADR-D4-1-recordtype-enum-values.md`) |

### Still Open

| Item | Gap | Recommended Next Step |
|---|---|---|
| `organization.employees.employee_number NOT NULL` for barangay phase | `employee_number NOT NULL` was set under the assumption that `barangay`-office employee rows would eventually need it relaxed, since barangay officials may lack a formal employee number. `email NULL` was already chosen and needs no change. **In Phase 1, no `barangay`-office employee row can exist** (`office_type = 'barangay'` is reserved, not seeded), so this constraint is never exercised by real data yet. **`[Inference]`** Per the Consolidated Reference Part 4.4/4.5, barangay officials have no system access even once Barangay Resolution/Budget workflows activate — the SP Secretariat logs barangay submissions on the officials' behalf. This raises the possibility that barangay officials may never get their own `organization.employees` row at all (the Secretariat's own employee row would be the one attached to the workflow instance, with the barangay/official's identity stored as document/workflow metadata instead). If so, this open item resolves to "no schema change needed" rather than requiring a future migration — but that depends on how Barangay Resolution/Budget intake is actually modeled when designed in detail. | Confirm during Barangay Resolution/Budget detailed design (Phase 1B/2) whether a barangay official ever receives an `organization.employees` row. If yes, create a migration ADR relaxing `employee_number NOT NULL` for `office_type = 'barangay'`. If no, close this item with no DDL change required. |