# C3. PostgreSQL Row-Level Security Policy Specifications

**Document:** C3
**Platform:** Batac City LGU Platform
**Status:** Pre-Development Baseline — Blocking Document
**Last Updated:** June 2026
**Audience:** Backend development team; LGU IT Office (DBA reviewers)
**Prerequisites:** C1 (Full Database Schema DDL), I1 (ABAC Policy Specification), B5 (Authentication & Authorization Architecture)
**Downstream:** C4 (Index Strategy), E1/E2/E3 (API and Schema Catalogs)

## Table of Contents

- [L42–L51] 1. Introduction — Role of RLS as a secondary enforcement layer complementing application-level ABAC.
- [L52–L81] 2. Purpose and Scope — Scope of RLS enforcement and mappings to core architectural invariants like tenant isolation.
- [L82–L303] 3. Row-Level Security Architecture Overview — Structural architecture of the database security layers, session context, and RLS helpers.
  - [L84–L103] 3.1 Enforcement Layers — Interactive relationship between application ABAC, PostgreSQL RLS, and role grant layers.
  - [L104–L119] 3.2 Database Roles — Five database roles (batac_app, batac_audit, batac_it_admin, batac_readonly, batac_migrate) and DELETE revocation policy.
  - [L120–L139] 3.3 Session Context Variables — Transaction-scoped context variables used by the application to pass user security context to PostgreSQL.
  - [L140–L258] 3.4 RLS Helper Functions — Stable SQL helper functions encapsulating session variable retrieval and role/office checking.
  - [L259–L269] 3.5 Policy Naming Convention — Naming format standard for prefixing, qualifying, and identifying RLS policy targets.
  - [L270–L294] 3.6 Global Policy Patterns — Reusable SQL snippets for tenant isolation and soft-delete visibility check.
  - [L295–L303] 3.7 Initial Setup — BYPASSRLS — Command granting bypass privilege to batac_migrate for DDL applications.
- [L304–L358] 4. Tables Requiring RLS — Master List — Matrix of all Phase 1 database tables mapped to their RLS complexity tier.
- [L359–L382] 5. Application Role Reference — Reference mapping application-level security roles to their logical database access permissions.
- [L383–L2004] 6. RLS Policy Specifications — Detailed CREATE POLICY definitions for all tables across the eight Phase 1 schemas.
  - [L385–L720] 6.1 Schema: `iam` — Security policies restricting credentials/sessions to owners and gating user provisioning to IT admins.
  - [L721–L925] 6.2 Schema: `organization` — Read-access policies for LGU structures and specific delegation grant management rules.
  - [L926–L1392] 6.3 Schema: `documents` — Classification gate implementation and restrictive policies isolating confidential content from IT admins.
  - [L1393–L1635] 6.4 Schema: `workflow` — Platform Admin workflow configuration limits and office/assignee visibility rules for runtimes.
  - [L1636–L1726] 6.5 Schema: `tracking` — Document-office access for tracking metadata and SP Secretariat restricted insert privileges.
  - [L1727–L1824] 6.6 Schema: `records` — Management permissions restricted to Records Officers and retention schedule access configuration.
  - [L1825–L1921] 6.7 Schema: `notifications` — Recipient-only visibility for notification events and delivery log append-only rules.
  - [L1922–L2004] 6.8 Schema: `audit` — Tamper-resistant, insert-only RLS and role rules restricting direct audit reading.
- [L2005–L2148] 7. Grant Statements — Privilege baseline grants for five roles, DELETE revocation, and SECURITY DEFINER audit reading function.
- [L2149–L2201] 8. Security Considerations — In-depth analysis of risks, policy ordering, performance, and session variable injection mitigations.
- [L2202–L2236] 9. Conclusion — Five-role security posture summary, DELETE revocation verification, and pre-migration implementation checklist.

---

---

## 1. Introduction

This document is **C3** in the Batac City LGU Platform specification chain. It defines the complete set of PostgreSQL Row-Level Security (RLS) policies for every table across the eight Phase 1 schemas: `iam`, `organization`, `documents`, `workflow`, `tracking`, `records`, `notifications`, and `audit`.

C1 deliberately excludes all RLS DDL (`ALTER TABLE … ENABLE ROW LEVEL SECURITY` and `CREATE POLICY`), explicitly assigning that entire concern to this document. C1 Convention §1.3 notes: *"a uniform `city_id` column means every RLS policy has the same shape with no special-cased joins."* This document fulfils that promise.

RLS is the **second** enforcement layer in a two-layer security architecture. The first layer is the application-level ABAC `PolicyEvaluator` service specified in I1. RLS does not replace the ABAC layer — it enforces the same rules at the database engine level so that a bug, a bypassed route, or a direct database connection cannot expose data outside its permitted scope.

---

## 2. Purpose and Scope

### 2.1 What This Document Covers

- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` statements for all 49+ Phase 1 tables.
- Named `CREATE POLICY` statements for every table, scoped to the correct database roles.
- The session-variable mechanism the application must use to supply RLS evaluation context.
- Helper functions called from within policy expressions.
- Grant statements that complement the role model defined in C1 Part 0.2.

### 2.2 What This Document Does Not Cover

- The application-layer ABAC policy logic — that is I1's scope.
- Performance indexes on columns used in RLS predicates — that is C4's scope.
- Seed data — that is the responsibility of scripts under `/tools/scripts`.
- The `portal`, `search_meta`, and `reporting` schemas — these are Phase 2/3 and inherit this document's patterns when they are specified.

### 2.3 Relationship to Architectural Invariants

The following architectural invariants from the Consolidated Reference (Part 12) are directly enforced or supported by this document:

| Invariant | Mechanism in this Document |
|---|---|
| #2 — No hard deletes | No `DELETE` policy is created for `batac_app` on any table; `DELETE` is revoked from all application-facing roles (`batac_app`, `batac_it_admin`, `batac_readonly`); hard deletes are structurally impossible via any runtime role |
| #3 — Audit log INSERT-only | `audit.events` has `FORCE ROW LEVEL SECURITY`; `batac_app` has no SELECT/UPDATE/DELETE policy on it |
| #8 — Tenant isolation | `city_id = current_setting('app.current_city_id', true)::uuid` is the base condition in every single policy `USING` and `WITH CHECK` clause |
| #10 — IT Admin content isolation | Dedicated RESTRICTIVE policies on `documents.versions` and `documents.attachments` block IT Admin reads on Confidential/Restricted content |

---

## 3. Row-Level Security Architecture Overview

### 3.1 Enforcement Layers

The platform enforces data access at three layers, in order from outermost to innermost:

```
Layer 1 — Application (PolicyGuard / PolicyEvaluator)
  ↳ ABAC cascade from I1 (Gates 1–5, resource-type policies)
  ↳ Evaluated before any SQL is issued

Layer 2 — PostgreSQL RLS (this document)
  ↳ Evaluated inside the database engine on every row touched by a query
  ↳ Operates independently of Layer 1; cannot be bypassed by application code

Layer 3 — PostgreSQL Role Grants (C1 Part 9; §8 of this document)
  ↳ Schema- and table-level GRANT/REVOKE statements
  ↳ batac_app has no access to the audit schema at all (enforced by REVOKE, not RLS)
```

A row that passes Layer 1 must also pass Layer 2. A query that passes Layer 2 must also satisfy Layer 3 grants. The three layers are additive, never substitutes for one another.

### 3.2 Database Roles

Five database roles are defined in C1 Part 0.2. Their relationship to RLS is:

| DB Role | RLS Status | Notes |
|---|---|---|
| `batac_migrate` | `BYPASSRLS` | DDL-only; never used at application runtime. Granted BYPASSRLS so schema migrations work unconditionally. |
| `batac_app` | Subject to RLS | The primary runtime role for all application queries. Policies in this document target `batac_app`. `DELETE` is revoked from this role on all tables. |
| `batac_audit` | Subject to RLS | INSERT + SELECT on `audit` schema only. Policies for `audit.events` target this role for its permitted operations. `DELETE` is revoked. |
| `batac_it_admin` | Subject to RLS | IT Admin runtime role. Connects with the same session variables as `batac_app`. IT Admin users are assigned this DB role instead of `batac_app`. Has **no access** to `documents.versions` or `documents.attachments` (grant-level revocation enforcing Invariant #10). `DELETE` is revoked. |
| `batac_readonly` | Subject to RLS | Read-only role for reporting and monitoring dashboards. SELECT only on all schemas except `audit`. `DELETE` is revoked. |

> **Note on DELETE revocation:** Per C1 v3, `DELETE` is revoked from all application-facing roles (`batac_app`, `batac_audit`, `batac_it_admin`, `batac_readonly`). Hard deletes are structurally impossible via any runtime role. Only `batac_migrate` retains `DELETE` for DDL migration purposes.

The IT Admin content isolation invariant (I1 Invariant #10) is enforced at **two layers**: (1) grant-level revocation on `documents.versions` and `documents.attachments` for `batac_it_admin`, and (2) RESTRICTIVE RLS policies on those same tables using the `app.is_ita` session variable. Both layers are defined in this document.

### 3.3 Session Context Variables

Because application queries run under `batac_app` or `batac_it_admin` database roles, the application must supply the current user's security context as PostgreSQL session-local variables before executing any business query. These are set using `SET LOCAL` within each transaction:

```sql
-- Must be set at the start of every transaction that touches RLS-protected tables.
-- Use SET LOCAL (not SET SESSION) so variables are transaction-scoped.

SET LOCAL app.current_user_id     = '<iam.users.id as text>';
SET LOCAL app.current_city_id     = '<city UUID as text>';
SET LOCAL app.current_office_id   = '<primary organization.offices.id as text>';
SET LOCAL app.effective_office_ids = '<comma-separated UUIDs, includes delegation-extended offices>';
SET LOCAL app.user_roles           = '<comma-separated role codes, e.g. sp_secretary,sp_member>';
SET LOCAL app.is_ita               = '<true|false>';
SET LOCAL app.is_pa                = '<true|false>';
SET LOCAL app.delegation_grant_id  = '<organization.delegation_grants.id as text, or empty string>';
```

**Security note:** These variables are set by the application's authentication middleware after the JWT has been verified and the `loadDelegationContext` hook has run (per I1 Section 1 and B5 §10.1). They must never be accepted from untrusted client input. The `current_setting(name, true)` form (the `true` argument suppresses errors when a variable is unset) is used throughout policy expressions; an unset variable returns `NULL`, which causes row predicates to evaluate to `NULL` (falsy), producing a **secure-by-default deny** when the context has not been established.

### 3.4 RLS Helper Functions

The following helper functions are used inside policy expressions. They are created in the `public` schema, matching the precedent set by `public.fn_set_updated_at()` in C1 Part 0.4.

```sql
-- ──────────────────────────────────────────────────────────────────────────
-- Helper: current authenticated user's city UUID from session variable
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rls_current_city_id()
RETURNS UUID STABLE LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT current_setting('app.current_city_id', true)::uuid;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Helper: current authenticated user's user UUID
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rls_current_user_id()
RETURNS UUID STABLE LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT current_setting('app.current_user_id', true)::uuid;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Helper: check if current user holds ALL of the given role codes
-- (use for single-role checks; '&&' overlap variant below for any-of checks)
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rls_has_role(p_role_code TEXT)
RETURNS BOOLEAN STABLE LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT p_role_code = ANY(
    string_to_array(current_setting('app.user_roles', true), ',')
  );
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Helper: check if current user holds ANY of the given role codes
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rls_has_any_role(VARIADIC p_role_codes TEXT[])
RETURNS BOOLEAN STABLE LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT string_to_array(current_setting('app.user_roles', true), ',')
      && p_role_codes;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Helper: check if a given office UUID is within the current user's
-- effective office scope (primary + delegation-extended offices)
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rls_office_in_scope(p_office_id UUID)
RETURNS BOOLEAN STABLE LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT p_office_id::text = ANY(
    string_to_array(current_setting('app.effective_office_ids', true), ',')
  );
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Helper: true when current user is an IT System Administrator
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rls_is_ita()
RETURNS BOOLEAN STABLE LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(current_setting('app.is_ita', true)::boolean, false);
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- Helper: true when current user is a Platform Administrator
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.rls_is_pa()
RETURNS BOOLEAN STABLE LANGUAGE sql
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(current_setting('app.is_pa', true)::boolean, false);
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- has_cross_office_read_grant — defined in I1 §3.2 (D-ABAC-03)
-- Checks organization.cross_office_grants (introduced by B5 D-AUTH-09).
-- The table is in the organization schema; this function crosses schema
-- boundaries by explicit design to support RLS policy expressions.
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_cross_office_read_grant(
    p_user_id      UUID,
    p_target_office_id UUID
) RETURNS BOOLEAN STABLE LANGUAGE sql
SET search_path = public, organization, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization.cross_office_grants g
    WHERE g.user_id       = p_user_id
      AND (g.office_id    = p_target_office_id OR g.office_id IS NULL)
      AND g.revoked_at   IS NULL
      AND (g.expires_at  IS NULL OR g.expires_at > now())
  );
$$;
```

All helper functions are granted EXECUTE to `batac_app`, `batac_audit`, `batac_it_admin`, and `batac_readonly`:

```sql
GRANT EXECUTE ON FUNCTION
    public.rls_current_city_id(),
    public.rls_current_user_id(),
    public.rls_has_role(TEXT),
    public.rls_has_any_role(TEXT[]),
    public.rls_office_in_scope(UUID),
    public.rls_is_ita(),
    public.rls_is_pa(),
    public.has_cross_office_read_grant(UUID, UUID)
TO batac_app, batac_audit, batac_it_admin, batac_readonly;
```

### 3.5 Policy Naming Convention

All policy names follow: `pol_{table}_{operation}[_{qualifier}]`

| Component | Example | Meaning |
|---|---|---|
| `pol_` | `pol_` | Prefix — distinguishes policies from constraints/indexes |
| `{table}` | `documents` | Short table name (no schema prefix) |
| `{operation}` | `select` | `select`, `insert`, `update`, `all` |
| `_{qualifier}` | `_ita_restrict` | Optional suffix for RESTRICTIVE policies or special cases |

### 3.6 Global Policy Patterns

Two patterns apply universally across every table in every schema.

**Pattern A — Tenant Isolation Base (every USING and WITH CHECK clause)**

```sql
-- Base predicate — appears in every policy expression.
-- If app.current_city_id is not set, returns NULL → row is denied (secure default).
city_id = public.rls_current_city_id()
```

**Pattern B — Soft-Delete Visibility (every SELECT USING clause on mutable tables)**

```sql
-- Exclude soft-deleted rows from normal SELECT access.
-- Auditors and Records Officers may read soft-deleted rows for investigation.
(
    deleted_at IS NULL
    OR public.rls_has_any_role('auditor', 'records_officer', 'sys_admin')
)
```

Append-only tables (`workflow.workflow_events`, `audit.events`, `tracking.routing_entries`, `notifications.delivery_log`) carry no `deleted_at` column and omit Pattern B.

### 3.7 Initial Setup — BYPASSRLS

```sql
-- Grant batac_migrate the ability to bypass RLS for all DDL and migration work.
ALTER ROLE batac_migrate BYPASSRLS;
```

---

## 4. Tables Requiring RLS — Master List

All 49 Phase 1 tables plus the two I1-introduced tables require RLS. The complexity tier indicates how sophisticated the USING clause is:

| Schema | Table | Complexity Tier | Key Special Condition |
|---|---|---|---|
| iam | users | B | IT Admin reads all; others read own city |
| iam | credentials | C | Self-only or IT Admin |
| iam | sessions | C | Self-only; IT Admin reads all; forced-terminate role |
| iam | refresh_tokens | C | Self-only; no cross-user read |
| iam | roles | A | City isolation; all authenticated users may read |
| iam | permissions | A | City isolation; all authenticated users may read |
| iam | role_permissions | A | City isolation; IT Admin / Platform Admin write |
| iam | role_assignments | C | Self-read; IT Admin / sp_secretary read all |
| iam | mfa_records | C | Self-only; IT Admin reads all |
| organization | offices | A | City isolation; all authenticated read |
| organization | positions | A | City isolation; all authenticated read |
| organization | employees | B | City isolation; own-office and cross-office |
| organization | assignments | B | City isolation; own-office and cross-office |
| organization | delegation_grants | C | Complex read/write access; Invariant #16 |
| organization | committees | A | City isolation; all authenticated read |
| organization | committee_memberships | A | City isolation; all authenticated read |
| organization | cross_office_grants | C | IT Admin / sp_secretary manage; user reads own |
| documents | document_types | A | City isolation; all authenticated read; plat_admin write |
| documents | number_series | B | City isolation; sp_secretary / plat_admin write |
| documents | documents | D | Full ABAC: office scope + classification gate |
| documents | versions | D | IT Admin content isolation (Invariant #10) |
| documents | attachments | D | IT Admin content isolation (Invariant #10) |
| documents | numbers | B | Same scope as parent document |
| documents | signatures | B | Same scope as parent document |
| documents | panlalawigan_reviews | B | sp_secretary write; broader read |
| documents | classification_allowlists | C | plat_admin manage; used by Gate 4 |
| workflow | definitions | B | plat_admin write; authenticated read |
| workflow | definition_versions | B | plat_admin write; authenticated read |
| workflow | steps | B | plat_admin write; authenticated read |
| workflow | transition_rules | B | plat_admin write; authenticated read |
| workflow | instances | C | Office-scoped; sp_secretary / senior roles broader |
| workflow | step_instances | C | Assignee-scoped; sp_secretary broader |
| workflow | workflow_events | A | Append-only; city isolation; authenticated read |
| tracking | tracking_records | B | Document-office scope |
| tracking | routing_entries | B | Append-only; sp_secretary write |
| records | records | C | Office-scoped; records_officer manage |
| records | retention_schedules | B | plat_admin write; authenticated read |
| records | archive_entries | C | records_officer manage |
| records | classification_rules | B | plat_admin write; authenticated read |
| records | dispositions | C | records_officer manage |
| notifications | templates | B | plat_admin write; authenticated read |
| notifications | notification_events | C | Self-read; system INSERT |
| notifications | delivery_log | A | Append-only; system INSERT; self-read |
| audit | events | E | FORCE RLS; batac_audit INSERT; auditor SELECT via procedure |

**Tier key:** A = city + soft-delete only | B = city + role gate | C = city + role + office/user scope | D = city + role + office + classification | E = append-only isolation

---

## 5. Application Role Reference

The following logical role codes are stored in `iam.roles.code` and appear in the `app.user_roles` session variable. They drive policy decisions throughout this document.

| Role Code | Description | DB Access Level | Notes |
|---|---|---|---|
| `dept_encoder` | Department Encoder | Standard operational | Document creation and submission |
| `dept_approver` | Department Approver | Standard operational | Approval and cancellation |
| `sp_secretary` | SP Secretary | Elevated operational | Broadest cross-office operational access |
| `sp_member` | SP Member (Councilor) | Committee-scoped | Access gated to committee membership |
| `sp_presiding_officer` | Vice Mayor | Senior operational | Cross-office metadata read |
| `mayor` | Mayor | Senior operational | Cross-office metadata read; signature authority |
| `brgy_encoder` | Barangay Encoder | Limited operational | Own office only |
| `brgy_captain` | Barangay Captain | Limited operational | Own office only |
| `records_officer` | Records Officer | Records management | Bulk operations; archive; retention |
| `auditor` | Auditor | Audit read-only | Full audit log; soft-deleted row visibility |
| `sys_admin` | IT System Administrator | Infra monitoring | No document content for confidential/restricted |
| `plat_admin` | Platform Administrator | Configuration only | Cannot process documents (Invariant #12) |
| `citizen` | Citizen | Portal only | No access to internal schemas |

`sys_admin` sets `app.is_ita = true`. `plat_admin` sets `app.is_pa = true`.

---

## 6. RLS Policy Specifications

### 6.1 Schema: `iam`

The `iam` schema holds identity and access management records. It is self-referential — most other schemas reference `iam.users` outward, not inward.

#### 6.1.1 `iam.users`

| Operation | Permitted Roles | Condition Summary |
|---|---|---|
| SELECT | All authenticated | Same city; own row always visible; IT Admin sees all; soft-deleted visible to auditor/sys_admin |
| INSERT | `sys_admin`, application (user provisioning) | City match |
| UPDATE | `sys_admin`; own row (status/profile fields) | City match |
| DELETE | None (soft-delete only) | — |

```sql
ALTER TABLE iam.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_users_select ON iam.users
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            deleted_at IS NULL
            OR public.rls_has_any_role('auditor', 'sys_admin', 'records_officer')
        )
    );

CREATE POLICY pol_users_insert ON iam.users
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_any_role('sys_admin', 'plat_admin')
    );

CREATE POLICY pol_users_update ON iam.users
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND deleted_at IS NULL
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (
            -- IT Admin may update any user in city
            public.rls_is_ita()
            -- Users may update their own non-sensitive fields
            OR id = public.rls_current_user_id()
        )
    );
```

#### 6.1.2 `iam.credentials`

Credentials are extremely sensitive — only readable by the authentication service itself (acting as `batac_app` during login), and only the row belonging to the authenticating user.

```sql
ALTER TABLE iam.credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_credentials_select ON iam.credentials
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
        )
        AND deleted_at IS NULL
    );

CREATE POLICY pol_credentials_insert ON iam.credentials
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
        )
    );

CREATE POLICY pol_credentials_update ON iam.credentials
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
        )
        AND deleted_at IS NULL
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
        )
    );
```

#### 6.1.3 `iam.sessions`

Sessions are readable by the session owner and by IT Admins (who may force-terminate). Per I1 §12: IT Admins may read all sessions in the city; all other users see only their own.

```sql
ALTER TABLE iam.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_sessions_select ON iam.sessions
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()  -- own sessions
            OR public.rls_is_ita()                  -- IT Admin sees all (I1 §12.2)
        )
        AND (deleted_at IS NULL OR public.rls_is_ita())
    );

CREATE POLICY pol_sessions_insert ON iam.sessions
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        -- Only the auth service creates sessions; user_id is validated by app layer
    );

-- Sessions are updated to record termination (terminated_at, termination_reason).
CREATE POLICY pol_sessions_update ON iam.sessions
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()
            OR public.rls_is_ita()  -- IT Admin may force-terminate (I1 §12.3)
        )
        AND deleted_at IS NULL
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
    );
```

#### 6.1.4 `iam.refresh_tokens`

Refresh tokens are managed by the auth service on behalf of the authenticated user. No cross-user read is permitted.

```sql
ALTER TABLE iam.refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_refresh_tokens_select ON iam.refresh_tokens
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND user_id = public.rls_current_user_id()
    );

CREATE POLICY pol_refresh_tokens_insert ON iam.refresh_tokens
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND user_id = public.rls_current_user_id()
    );

-- Refresh tokens are updated only to set is_revoked = true.
CREATE POLICY pol_refresh_tokens_update ON iam.refresh_tokens
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND user_id = public.rls_current_user_id()
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND user_id = public.rls_current_user_id()
    );
```

#### 6.1.5 `iam.roles`, `iam.permissions`, `iam.role_permissions`

These are reference/configuration tables. All authenticated users may read them (needed for the permission-resolution logic at token issue time). Only Platform Admins may write.

```sql
-- iam.roles
ALTER TABLE iam.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_roles_select ON iam.roles
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
    );

CREATE POLICY pol_roles_insert ON iam.roles
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_is_pa()
    );

CREATE POLICY pol_roles_update ON iam.roles
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND deleted_at IS NULL
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_is_pa()
    );

-- iam.permissions
ALTER TABLE iam.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_permissions_select ON iam.permissions
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
    );

CREATE POLICY pol_permissions_insert ON iam.permissions
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_is_pa()
    );

CREATE POLICY pol_permissions_update ON iam.permissions
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());

-- iam.role_permissions
ALTER TABLE iam.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_role_permissions_select ON iam.role_permissions
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
    );

CREATE POLICY pol_role_permissions_insert ON iam.role_permissions
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_is_pa()
    );

CREATE POLICY pol_role_permissions_update ON iam.role_permissions
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
```

#### 6.1.6 `iam.role_assignments`

Role assignments are readable by the assigned user (own assignments), by IT Admins, and by the SP Secretary for operational visibility. Only IT Admins and Platform Admins may create or revoke assignments.

```sql
ALTER TABLE iam.role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_role_assignments_select ON iam.role_assignments
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
            OR public.rls_is_pa()
            OR public.rls_has_role('sp_secretary')
        )
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
    );

CREATE POLICY pol_role_assignments_insert ON iam.role_assignments
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (public.rls_is_ita() OR public.rls_is_pa())
    );

-- Assignments are "updated" when is_active is set to false on revocation.
CREATE POLICY pol_role_assignments_update ON iam.role_assignments
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (public.rls_is_ita() OR public.rls_is_pa())
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (public.rls_is_ita() OR public.rls_is_pa())
    );
```

#### 6.1.7 `iam.mfa_records`

MFA records are own-user-only for read and write. IT Admins may read for support purposes.

```sql
ALTER TABLE iam.mfa_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_mfa_records_select ON iam.mfa_records
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
        )
        AND (deleted_at IS NULL OR public.rls_is_ita())
    );

CREATE POLICY pol_mfa_records_insert ON iam.mfa_records
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND user_id = public.rls_current_user_id()
    );

CREATE POLICY pol_mfa_records_update ON iam.mfa_records
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
        )
        AND deleted_at IS NULL
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (
            user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
        )
    );
```

---

### 6.2 Schema: `organization`

The `organization` schema holds the office hierarchy, personnel, and delegation records. Most tables here are organizational reference data — broadly readable to all authenticated users, since the ABAC layer controls which specific records they can act on.

#### 6.2.1 `organization.offices`, `organization.positions`, `organization.committees`

These are structural reference tables. All authenticated users in the city may read them (needed by the ABAC layer for office hierarchy resolution). Only Platform Admins may write.

```sql
-- Apply to: organization.offices, organization.positions, organization.committees
-- Pattern shown for offices; positions and committees are identical.

ALTER TABLE organization.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.committees ENABLE ROW LEVEL SECURITY;

-- offices
CREATE POLICY pol_offices_select ON organization.offices
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
    );
CREATE POLICY pol_offices_insert ON organization.offices
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_offices_update ON organization.offices
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());

-- positions (same pattern)
CREATE POLICY pol_positions_select ON organization.positions
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin')));
CREATE POLICY pol_positions_insert ON organization.positions
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_positions_update ON organization.positions
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());

-- committees (same pattern)
CREATE POLICY pol_committees_select ON organization.committees
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin')));
CREATE POLICY pol_committees_insert ON organization.committees
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_committees_update ON organization.committees
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
```

#### 6.2.2 `organization.employees`, `organization.assignments`, `organization.committee_memberships`

Employee and assignment data is readable to all authenticated operational users (the ABAC layer restricts what they do with it). IT Admins manage employee records.

```sql
ALTER TABLE organization.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.committee_memberships ENABLE ROW LEVEL SECURITY;

-- employees
CREATE POLICY pol_employees_select ON organization.employees
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
    );
CREATE POLICY pol_employees_insert ON organization.employees
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (public.rls_is_ita() OR public.rls_is_pa())
    );
CREATE POLICY pol_employees_update ON organization.employees
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (public.rls_is_ita() OR public.rls_is_pa())
    );

-- assignments (same insert/update restriction; select is broad)
CREATE POLICY pol_assignments_select ON organization.assignments
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin')));
CREATE POLICY pol_assignments_insert ON organization.assignments
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND (public.rls_is_ita() OR public.rls_is_pa()));
CREATE POLICY pol_assignments_update ON organization.assignments
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND (public.rls_is_ita() OR public.rls_is_pa()));

-- committee_memberships
CREATE POLICY pol_committee_memberships_select ON organization.committee_memberships
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin')));
CREATE POLICY pol_committee_memberships_insert ON organization.committee_memberships
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND (public.rls_is_ita() OR public.rls_is_pa()));
CREATE POLICY pol_committee_memberships_update ON organization.committee_memberships
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND (public.rls_is_ita() OR public.rls_is_pa()));
```

#### 6.2.3 `organization.delegation_grants`

Delegation grants are security-sensitive. Per I1 §11: readable by the delegating and delegated parties, and by senior oversight roles. Written by the SP Secretary (who logs the Designation document). Architectural Invariant #16 (one active per delegatee) is enforced by a partial unique index in C1 §3.6, not by RLS, but this policy prevents unauthorized creation.

```sql
ALTER TABLE organization.delegation_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_delegation_grants_select ON organization.delegation_grants
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            -- Parties to the grant see their own grants
            delegating_employee_id IN (
                SELECT e.id FROM organization.employees e
                WHERE e.user_id = public.rls_current_user_id()
            )
            OR delegated_to_employee_id IN (
                SELECT e.id FROM organization.employees e
                WHERE e.user_id = public.rls_current_user_id()
            )
            -- Oversight roles read all
            OR public.rls_has_any_role(
                'sys_admin', 'plat_admin', 'sp_secretary',
                'sp_presiding_officer', 'mayor', 'auditor'
            )
        )
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
    );

CREATE POLICY pol_delegation_grants_insert ON organization.delegation_grants
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        -- SP Secretary logs delegation grants (I1 §11.1)
        AND public.rls_has_role('sp_secretary')
    );

CREATE POLICY pol_delegation_grants_update ON organization.delegation_grants
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND deleted_at IS NULL
        AND (
            -- Delegating party may revoke their own grant (I1 §11.2)
            delegating_employee_id IN (
                SELECT e.id FROM organization.employees e
                WHERE e.user_id = public.rls_current_user_id()
            )
            OR public.rls_has_role('sp_secretary')
        )
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (
            delegating_employee_id IN (
                SELECT e.id FROM organization.employees e
                WHERE e.user_id = public.rls_current_user_id()
            )
            OR public.rls_has_role('sp_secretary')
        )
    );
```

#### 6.2.4 `organization.cross_office_grants`

This table was introduced by B5 decision D-AUTH-09 (referenced in I1 §3.2). It is managed by Platform Admins and readable by the `has_cross_office_read_grant` function.

```sql
-- NOTE: This table is not in C1's original table list (it was introduced via B5 D-AUTH-09).
-- Its DDL must be added as part of the organization schema migration.

ALTER TABLE organization.cross_office_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_cross_office_grants_select ON organization.cross_office_grants
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        -- All authenticated users can read (needed by has_cross_office_read_grant function)
        -- Row-level filtering within the function's WHERE clause handles user scoping
        TRUE
    );

CREATE POLICY pol_cross_office_grants_insert ON organization.cross_office_grants
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (public.rls_is_pa());

CREATE POLICY pol_cross_office_grants_update ON organization.cross_office_grants
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (deleted_at IS NULL)
    WITH CHECK (public.rls_is_pa());
```

---

### 6.3 Schema: `documents`

The `documents` schema contains the most complex RLS policies in the platform. The classification gate (I1 Gate 4), the IT Admin content isolation invariant (I1 Invariant #10), and the office-scoped access rules (I1 §3) all converge here.

#### 6.3.1 `documents.document_types`, `documents.number_series`

Configuration tables. Readable by all authenticated users; writable only by Platform Admins (for type and series configuration) and SP Secretary (for numbering operations).

```sql
ALTER TABLE documents.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents.number_series ENABLE ROW LEVEL SECURITY;

-- document_types
CREATE POLICY pol_document_types_select ON documents.document_types
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
    );
CREATE POLICY pol_document_types_insert ON documents.document_types
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_document_types_update ON documents.document_types
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());

-- number_series
CREATE POLICY pol_number_series_select ON documents.number_series
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin', 'records_officer', 'sp_secretary'))
    );
CREATE POLICY pol_number_series_insert ON documents.number_series
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_number_series_update ON documents.number_series
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
```

#### 6.3.2 `documents.documents` (Full ABAC — Tier D)

This is the most policy-rich table in the platform. The SELECT policy implements I1 §3.2 (document read), including own-office access, cross-office access via grant, SP Member committee scope, and public classification. The classification gate from I1 Gate 4 is embedded in the USING clause.

```sql
ALTER TABLE documents.documents ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- SELECT — implements I1 §3.2 document:read (metadata)
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY pol_documents_select ON documents.documents
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        -- Base: tenant isolation
        city_id = public.rls_current_city_id()

        -- Soft-delete: standard visibility
        AND (
            deleted_at IS NULL
            OR public.rls_has_any_role('auditor', 'records_officer', 'sys_admin')
        )

        -- Classification Gate (I1 Gate 4 — D-ABAC-02):
        -- Confidential/Restricted rows only visible to roles on the explicit allowlist.
        -- Public and Internal rows are not gated here (further scoped by role/office below).
        AND (
            classification_level NOT IN ('confidential', 'restricted')
            OR EXISTS (
                SELECT 1 FROM documents.classification_allowlists cal
                WHERE cal.document_type_id = documents.documents.document_type_id
                  AND cal.role_code = ANY(
                    string_to_array(current_setting('app.user_roles', true), ',')
                  )
            )
        )

        -- Access scope: at least one of these conditions must be true
        AND (
            -- Own-office: document owned by user's office scope
            public.rls_office_in_scope(owned_by_office_id)

            -- Cross-office: explicit grant exists (I1 §3.2 D-ABAC-03)
            OR (
                classification_level IN ('public', 'internal')
                AND public.has_cross_office_read_grant(
                    public.rls_current_user_id(),
                    owned_by_office_id
                )
                AND public.rls_has_any_role(
                    'records_officer', 'sp_secretary', 'sp_presiding_officer',
                    'mayor', 'auditor'
                )
            )

            -- SP Secretary sees all SP Secretariat documents (I1 §5.1)
            OR public.rls_has_role('sp_secretary')

            -- Senior cross-office roles for public/internal documents
            OR (
                classification_level IN ('public', 'internal')
                AND public.rls_has_any_role(
                    'sp_presiding_officer', 'mayor', 'auditor', 'records_officer'
                )
            )

            -- Public classification: visible to all authenticated users
            OR classification_level = 'public'

            -- Platform Admin reads metadata (not content) for configuration
            OR public.rls_is_pa()

            -- IT Admin reads metadata for operational monitoring (not content — gated in versions/attachments)
            OR public.rls_is_ita()
        )
    );

-- ──────────────────────────────────────────────────────────────────────────
-- INSERT — implements I1 §3.1 document:create
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY pol_documents_insert ON documents.documents
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_any_role(
            'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
            'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
        )
        -- Originating office must be in scope (app layer validates document_type origination rules)
        AND public.rls_office_in_scope(owned_by_office_id)
    );

-- ──────────────────────────────────────────────────────────────────────────
-- UPDATE — implements I1 §3.3 document:update (content), §3.5 document:submit,
--          §3.6 document:cancel, §3.7/3.8 numbering, §3.10 archive
-- The application layer enforces the finer lifecycle-state conditions;
-- RLS enforces only the role + office scope base conditions.
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY pol_documents_update ON documents.documents
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND deleted_at IS NULL
        -- Row must be visible to the user (same as SELECT)
        AND (
            public.rls_office_in_scope(owned_by_office_id)
            OR public.rls_has_role('sp_secretary')
            OR public.rls_has_any_role('sp_presiding_officer', 'mayor', 'records_officer', 'auditor')
        )
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        -- Only operational roles may update documents; PA and ITA are read-only here
        AND public.rls_has_any_role(
            'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
            'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
            'records_officer'
        )
        AND (
            public.rls_office_in_scope(owned_by_office_id)
            OR public.rls_has_role('sp_secretary')
            OR public.rls_has_any_role('sp_presiding_officer', 'mayor', 'records_officer')
        )
    );
```

#### 6.3.3 `documents.versions` — IT Admin Content Isolation (Tier D, Invariant #10)

This table holds S3 keys and OCR text. Per I1 Invariant #10 and Gate 2, IT Admins must never read file content (`s3_key`, `ocr_text`) for Confidential or Restricted documents. This is enforced with a RESTRICTIVE policy that blocks their access to those rows entirely.

```sql
ALTER TABLE documents.versions ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- RESTRICTIVE SELECT — IT Admin content isolation (I1 Gate 2; Invariant #10)
-- This RESTRICTIVE policy is evaluated in addition to (AND with) the
-- PERMISSIVE policy below. If this blocks the row, the PERMISSIVE policy
-- cannot override it.
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY pol_versions_select_ita_restrict ON documents.versions
    AS RESTRICTIVE FOR SELECT TO batac_app
    USING (
        -- IT Admins are BLOCKED from version rows where the parent document
        -- is classified Confidential or Restricted (I1 Invariant #10, layer 2).
        NOT (
            public.rls_is_ita()
            AND EXISTS (
                SELECT 1 FROM documents.documents d
                WHERE d.id = documents.versions.document_id
                  AND d.classification_level IN ('confidential', 'restricted')
            )
        )
    );

-- ──────────────────────────────────────────────────────────────────────────
-- PERMISSIVE SELECT — normal role-based and office-scoped access
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY pol_versions_select ON documents.versions
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'records_officer'))
        -- Must be able to see the parent document
        AND EXISTS (
            SELECT 1 FROM documents.documents d
            WHERE d.id = documents.versions.document_id
              AND d.city_id = public.rls_current_city_id()
              AND (
                  public.rls_office_in_scope(d.owned_by_office_id)
                  OR public.rls_has_role('sp_secretary')
                  OR (
                      d.classification_level IN ('public', 'internal')
                      AND public.rls_has_any_role(
                          'sp_presiding_officer', 'mayor', 'auditor',
                          'records_officer'
                      )
                  )
              )
              AND (
                  d.classification_level NOT IN ('confidential', 'restricted')
                  OR EXISTS (
                      SELECT 1 FROM documents.classification_allowlists cal
                      WHERE cal.document_type_id = d.document_type_id
                        AND cal.role_code = ANY(
                          string_to_array(current_setting('app.user_roles', true), ',')
                        )
                  )
              )
        )
    );

CREATE POLICY pol_versions_insert ON documents.versions
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_any_role(
            'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
            'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
        )
        AND EXISTS (
            SELECT 1 FROM documents.documents d
            WHERE d.id = documents.versions.document_id
              AND (
                  public.rls_office_in_scope(d.owned_by_office_id)
                  OR public.rls_has_role('sp_secretary')
              )
        )
    );

CREATE POLICY pol_versions_update ON documents.versions
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND deleted_at IS NULL
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_any_role('sp_secretary', 'records_officer')
    );
```

#### 6.3.4 `documents.attachments` — IT Admin Content Isolation (Tier D, Invariant #10)

Identical isolation pattern to `documents.versions`. OCR text is not present in this table, but `s3_key` (the file byte reference) is gated by the same invariant.

```sql
ALTER TABLE documents.attachments ENABLE ROW LEVEL SECURITY;

-- RESTRICTIVE: IT Admin blocked from Confidential/Restricted parent documents
CREATE POLICY pol_attachments_select_ita_restrict ON documents.attachments
    AS RESTRICTIVE FOR SELECT TO batac_app
    USING (
        NOT (
            public.rls_is_ita()
            AND EXISTS (
                SELECT 1 FROM documents.documents d
                WHERE d.id = documents.attachments.document_id
                  AND d.classification_level IN ('confidential', 'restricted')
            )
        )
    );

-- PERMISSIVE: office-scoped access with classification gate
CREATE POLICY pol_attachments_select ON documents.attachments
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'records_officer'))
        AND EXISTS (
            SELECT 1 FROM documents.documents d
            WHERE d.id = documents.attachments.document_id
              AND d.city_id = public.rls_current_city_id()
              AND (
                  public.rls_office_in_scope(d.owned_by_office_id)
                  OR public.rls_has_role('sp_secretary')
                  OR (
                      d.classification_level IN ('public', 'internal')
                      AND public.rls_has_any_role(
                          'sp_presiding_officer', 'mayor', 'auditor', 'records_officer'
                      )
                  )
              )
              AND (
                  d.classification_level NOT IN ('confidential', 'restricted')
                  OR EXISTS (
                      SELECT 1 FROM documents.classification_allowlists cal
                      WHERE cal.document_type_id = d.document_type_id
                        AND cal.role_code = ANY(
                          string_to_array(current_setting('app.user_roles', true), ',')
                        )
                  )
              )
        )
    );

CREATE POLICY pol_attachments_insert ON documents.attachments
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_any_role(
            'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
            'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
        )
        AND EXISTS (
            SELECT 1 FROM documents.documents d
            WHERE d.id = documents.attachments.document_id
              AND (
                  public.rls_office_in_scope(d.owned_by_office_id)
                  OR public.rls_has_role('sp_secretary')
              )
        )
    );

CREATE POLICY pol_attachments_update ON documents.attachments
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_any_role('sp_secretary', 'records_officer')
    );
```

#### 6.3.5 `documents.numbers`, `documents.signatures`, `documents.panlalawigan_reviews`

These tables inherit the access scope of their parent document. Access is gated through an `EXISTS` check against the parent `documents.documents` row.

```sql
ALTER TABLE documents.numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents.signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents.panlalawigan_reviews ENABLE ROW LEVEL SECURITY;

-- Reusable parent document scope check (used in policies below):
-- EXISTS (SELECT 1 FROM documents.documents d WHERE d.id = <table>.document_id
--         AND d.city_id = rls_current_city_id()
--         AND (rls_office_in_scope(d.owned_by_office_id) OR rls_has_role('sp_secretary')
--              OR rls_has_any_role('sp_presiding_officer','mayor','auditor','records_officer')))

-- documents.numbers
CREATE POLICY pol_numbers_select ON documents.numbers
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'records_officer'))
        AND EXISTS (
            SELECT 1 FROM documents.documents d
            WHERE d.id = documents.numbers.document_id
              AND d.city_id = public.rls_current_city_id()
              AND (
                  public.rls_office_in_scope(d.owned_by_office_id)
                  OR public.rls_has_any_role('sp_secretary','sp_presiding_officer','mayor','auditor','records_officer')
              )
        )
    );
CREATE POLICY pol_numbers_insert ON documents.numbers
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        -- Number assignment is an sp_secretary action (I1 §3.7, §3.8, §14.3)
        AND public.rls_has_role('sp_secretary')
    );
-- numbers are append-only (no UPDATE needed in normal flow; is_current flipped via app logic)
CREATE POLICY pol_numbers_update ON documents.numbers
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_has_role('sp_secretary'));

-- documents.signatures
CREATE POLICY pol_signatures_select ON documents.signatures
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'records_officer'))
        AND EXISTS (
            SELECT 1 FROM documents.documents d
            WHERE d.id = documents.signatures.document_id
              AND d.city_id = public.rls_current_city_id()
              AND (
                  public.rls_office_in_scope(d.owned_by_office_id)
                  OR public.rls_has_any_role('sp_secretary','sp_presiding_officer','mayor','auditor','records_officer')
              )
        )
    );
CREATE POLICY pol_signatures_insert ON documents.signatures
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_any_role('sp_secretary', 'sp_presiding_officer', 'mayor')
    );
CREATE POLICY pol_signatures_update ON documents.signatures
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_has_role('sp_secretary'));

-- documents.panlalawigan_reviews (SP Secretary manages; broader read; I1 §6.9)
CREATE POLICY pol_panlalawigan_reviews_select ON documents.panlalawigan_reviews
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'records_officer'))
        AND public.rls_has_any_role(
            'sp_secretary', 'sp_presiding_officer', 'mayor',
            'records_officer', 'auditor', 'plat_admin', 'sys_admin'
        )
    );
CREATE POLICY pol_panlalawigan_reviews_insert ON documents.panlalawigan_reviews
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_role('sp_secretary')
    );
CREATE POLICY pol_panlalawigan_reviews_update ON documents.panlalawigan_reviews
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_role('sp_secretary')
    );
```

#### 6.3.6 `documents.classification_allowlists`

Introduced by I1 D-ABAC-02. Managed exclusively by Platform Admins. Readable to the policy engine via RLS expressions in §6.3.2–6.3.4.

```sql
-- NOTE: DDL for this table is specified in I1 §2 Gate 4 (D-ABAC-02).
-- It is added to the documents schema as part of the documents module migration.
ALTER TABLE documents.classification_allowlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_classification_allowlists_select ON documents.classification_allowlists
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (TRUE); -- Intentionally open: this table is read by RLS expressions on other tables;
                  -- restricting SELECT here would break the classification gate.

CREATE POLICY pol_classification_allowlists_insert ON documents.classification_allowlists
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (public.rls_is_pa());

CREATE POLICY pol_classification_allowlists_update ON documents.classification_allowlists
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (TRUE)
    WITH CHECK (public.rls_is_pa());
```

---

### 6.4 Schema: `workflow`

The `workflow` schema holds workflow definition data and runtime execution data. Definition tables are configuration (Platform Admin write). Runtime tables (instances, step_instances) follow office-scoped access rules from I1 §5 and §6.

#### 6.4.1 `workflow.definitions`, `workflow.definition_versions`, `workflow.steps`, `workflow.transition_rules`

Workflow configuration tables. All authenticated users may read (the engine needs them at runtime). Platform Admins may write.

```sql
ALTER TABLE workflow.definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.definition_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow.transition_rules ENABLE ROW LEVEL SECURITY;

-- Pattern applied to all four: read = any authenticated; write = plat_admin
-- Shown fully for definitions; definitions_versions, steps, transition_rules are identical.

CREATE POLICY pol_definitions_select ON workflow.definitions
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
    );
CREATE POLICY pol_definitions_insert ON workflow.definitions
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_definitions_update ON workflow.definitions
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());

-- definition_versions, steps, transition_rules: identical pattern (omitted for brevity;
-- substitute table name in each statement above).
CREATE POLICY pol_definition_versions_select ON workflow.definition_versions
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor','sys_admin')));
CREATE POLICY pol_definition_versions_insert ON workflow.definition_versions
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_definition_versions_update ON workflow.definition_versions
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());

CREATE POLICY pol_steps_select ON workflow.steps
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor','sys_admin')));
CREATE POLICY pol_steps_insert ON workflow.steps
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_steps_update ON workflow.steps
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());

CREATE POLICY pol_transition_rules_select ON workflow.transition_rules
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor','sys_admin')));
CREATE POLICY pol_transition_rules_insert ON workflow.transition_rules
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_transition_rules_update ON workflow.transition_rules
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
```

#### 6.4.2 `workflow.instances`

Workflow instances are runtime execution records tied to documents. Access follows I1 §5.1: own-office instances, SP Secretary sees all SP Secretariat scope, senior roles see public/internal instances broadly.

```sql
ALTER TABLE workflow.instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_instances_select ON workflow.instances
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'records_officer'))
        AND (
            -- Own-office: instance belongs to document in user's office scope
            EXISTS (
                SELECT 1 FROM documents.documents d
                WHERE d.id = workflow.instances.document_id
                  AND public.rls_office_in_scope(d.owned_by_office_id)
            )
            -- SP Secretary: all instances (I1 §5.1)
            OR public.rls_has_role('sp_secretary')
            -- Senior roles: public/internal documents broadly
            OR (
                public.rls_has_any_role(
                    'records_officer', 'sp_presiding_officer', 'mayor', 'auditor'
                )
                AND EXISTS (
                    SELECT 1 FROM documents.documents d
                    WHERE d.id = workflow.instances.document_id
                      AND d.classification_level IN ('public', 'internal')
                )
            )
            -- Platform Admin / IT Admin: operational monitoring
            OR public.rls_is_pa()
            OR public.rls_is_ita()
        )
    );

-- Instances are created by the workflow engine (acting as sp_secretary or dept role)
CREATE POLICY pol_instances_insert ON workflow.instances
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_any_role(
            'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
            'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
        )
    );

CREATE POLICY pol_instances_update ON workflow.instances
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND deleted_at IS NULL
        AND (
            EXISTS (
                SELECT 1 FROM documents.documents d
                WHERE d.id = workflow.instances.document_id
                  AND (
                      public.rls_office_in_scope(d.owned_by_office_id)
                      OR public.rls_has_role('sp_secretary')
                  )
            )
            OR public.rls_is_pa()  -- Option B migration (I1 §5.2)
        )
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (
            public.rls_has_any_role(
                'dept_approver', 'sp_secretary', 'sp_presiding_officer',
                'mayor', 'records_officer'
            )
            OR public.rls_is_pa()
        )
    );
```

#### 6.4.3 `workflow.step_instances`

Step instances are individual step executions. Access follows I1 §6.1: assignee-office and assignee-user scope. SP Secretary has full step visibility.

```sql
ALTER TABLE workflow.step_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_step_instances_select ON workflow.step_instances
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'records_officer'))
        AND (
            -- Assignee-office scope
            public.rls_office_in_scope(assignee_office_id)
            -- Specific user assignment
            OR assignee_user_id = public.rls_current_user_id()
            -- SP Secretary: full visibility (I1 §6.1)
            OR public.rls_has_role('sp_secretary')
            -- Senior oversight roles (I1 §6.1)
            OR public.rls_has_any_role('sp_presiding_officer', 'mayor', 'auditor')
        )
    );

CREATE POLICY pol_step_instances_insert ON workflow.step_instances
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        -- Step instances are created by the workflow engine; broad role check here;
        -- finer invariant checks (e.g. Invariant #13 encoder≠approver) are app-layer.
        AND public.rls_has_any_role(
            'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
            'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain'
        )
    );

CREATE POLICY pol_step_instances_update ON workflow.step_instances
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND deleted_at IS NULL
        AND (
            public.rls_office_in_scope(assignee_office_id)
            OR assignee_user_id = public.rls_current_user_id()
            OR public.rls_has_role('sp_secretary')
            OR public.rls_has_any_role('sp_presiding_officer', 'mayor')
        )
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (
            public.rls_office_in_scope(assignee_office_id)
            OR assignee_user_id = public.rls_current_user_id()
            OR public.rls_has_role('sp_secretary')
            OR public.rls_has_any_role('sp_presiding_officer', 'mayor')
        )
    );
```

#### 6.4.4 `workflow.workflow_events`

Append-only event log for the workflow engine. All operational users may read events for instances they can see. No UPDATE (append-only by design per C1 §1.4).

```sql
ALTER TABLE workflow.workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_workflow_events_select ON workflow.workflow_events
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        -- Readable if the user can see the associated workflow instance
        AND EXISTS (
            SELECT 1 FROM workflow.instances wi
            WHERE wi.id = workflow.workflow_events.instance_id
              AND wi.city_id = public.rls_current_city_id()
              AND (
                  EXISTS (
                      SELECT 1 FROM documents.documents d
                      WHERE d.id = wi.document_id
                        AND (
                            public.rls_office_in_scope(d.owned_by_office_id)
                            OR public.rls_has_role('sp_secretary')
                            OR public.rls_has_any_role('sp_presiding_officer','mayor','auditor','records_officer')
                        )
                  )
              )
        )
    );

-- Workflow events are inserted by the workflow engine
CREATE POLICY pol_workflow_events_insert ON workflow.workflow_events
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id());
-- No UPDATE policy — append-only
```

---

### 6.5 Schema: `tracking`

The `tracking` schema records physical custody and QR routing history. Per I1 §7, routing history is readable to own-office roles and cross-office by senior roles for public/internal documents.

#### 6.5.1 `tracking.tracking_records`

```sql
ALTER TABLE tracking.tracking_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_tracking_records_select ON tracking.tracking_records
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'records_officer'))
        AND (
            -- Own-office access (I1 §7.1)
            EXISTS (
                SELECT 1 FROM documents.documents d
                WHERE d.id = tracking.tracking_records.document_id
                  AND public.rls_office_in_scope(d.owned_by_office_id)
            )
            -- Cross-office read by senior roles for non-confidential documents
            OR (
                public.rls_has_any_role(
                    'sp_secretary', 'sp_presiding_officer', 'mayor',
                    'records_officer', 'auditor'
                )
                AND EXISTS (
                    SELECT 1 FROM documents.documents d
                    WHERE d.id = tracking.tracking_records.document_id
                      AND d.classification_level IN ('public', 'internal')
                )
            )
            -- IT Admin operational monitoring
            OR public.rls_is_ita()
        )
    );

CREATE POLICY pol_tracking_records_insert ON tracking.tracking_records
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        -- QR assignment is initiated at secretariat logging (I1 §7.5)
        AND public.rls_has_role('sp_secretary')
    );

CREATE POLICY pol_tracking_records_update ON tracking.tracking_records
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_role('sp_secretary')
    );
```

#### 6.5.2 `tracking.routing_entries`

Append-only routing log. Per I1 §7.2, physical routing is logged exclusively by SP Secretariat in Phase 1. No UPDATE (append-only per C1 §1.4).

```sql
ALTER TABLE tracking.routing_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_routing_entries_select ON tracking.routing_entries
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            -- Own-office routing entries
            public.rls_office_in_scope(from_office_id)
            OR public.rls_office_in_scope(to_office_id)
            -- Cross-office for senior roles (I1 §7.1)
            OR public.rls_has_any_role(
                'sp_secretary', 'sp_presiding_officer', 'mayor',
                'records_officer', 'auditor'
            )
            OR public.rls_is_ita()
        )
    );

-- Routing entries are created (inserted) only by sp_secretary (I1 §7.2)
CREATE POLICY pol_routing_entries_insert ON tracking.routing_entries
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_role('sp_secretary')
    );
-- No UPDATE policy — append-only
```

---

### 6.6 Schema: `records`

The `records` schema is a Phase 2 activation; tables are created in Phase 1 per C1 scope but records management features go live in Phase 2. RLS policies are specified here in full so they are in place before data enters the schema.

#### 6.6.1 `records.retention_schedules`, `records.classification_rules`

Configuration tables managed by Platform Admins. All authenticated users may read.

```sql
ALTER TABLE records.retention_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE records.classification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_retention_schedules_select ON records.retention_schedules
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor','sys_admin')));
CREATE POLICY pol_retention_schedules_insert ON records.retention_schedules
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_retention_schedules_update ON records.retention_schedules
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());

CREATE POLICY pol_classification_rules_select ON records.classification_rules
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor','sys_admin')));
CREATE POLICY pol_classification_rules_insert ON records.classification_rules
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_classification_rules_update ON records.classification_rules
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
```

#### 6.6.2 `records.records`, `records.archive_entries`, `records.dispositions`

These are managed exclusively by Records Officers (and SP Secretary for records in their office scope per I1 §9). Auditors may read.

```sql
ALTER TABLE records.records ENABLE ROW LEVEL SECURITY;
ALTER TABLE records.archive_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE records.dispositions ENABLE ROW LEVEL SECURITY;

-- records.records
CREATE POLICY pol_records_select ON records.records
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
        AND (
            public.rls_has_any_role('records_officer', 'auditor', 'sp_secretary')
            OR public.rls_is_ita()
        )
    );
CREATE POLICY pol_records_insert ON records.records
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_any_role('records_officer', 'sp_secretary')
    );
CREATE POLICY pol_records_update ON records.records
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND public.rls_has_role('records_officer')
    );

-- records.archive_entries (records_officer only manages; auditor reads)
CREATE POLICY pol_archive_entries_select ON records.archive_entries
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor','sys_admin'))
           AND public.rls_has_any_role('records_officer', 'auditor', 'sp_secretary', 'sys_admin'));
CREATE POLICY pol_archive_entries_insert ON records.archive_entries
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_has_role('records_officer'));
CREATE POLICY pol_archive_entries_update ON records.archive_entries
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_has_role('records_officer'));

-- records.dispositions (records_officer only)
CREATE POLICY pol_dispositions_select ON records.dispositions
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor','sys_admin'))
           AND public.rls_has_any_role('records_officer', 'auditor', 'sys_admin'));
CREATE POLICY pol_dispositions_insert ON records.dispositions
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_has_role('records_officer'));
CREATE POLICY pol_dispositions_update ON records.dispositions
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_has_role('records_officer'));
```

---

### 6.7 Schema: `notifications`

Notifications are system-generated. Users see their own notifications. The delivery log is system-written.

#### 6.7.1 `notifications.templates`

Platform Admin configuration. All authenticated users may read (the notification service needs to resolve templates at runtime).

```sql
ALTER TABLE notifications.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_notif_templates_select ON notifications.templates
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (city_id = public.rls_current_city_id() AND (deleted_at IS NULL OR public.rls_has_any_role('auditor','sys_admin')));
CREATE POLICY pol_notif_templates_insert ON notifications.templates
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
CREATE POLICY pol_notif_templates_update ON notifications.templates
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (city_id = public.rls_current_city_id() AND deleted_at IS NULL)
    WITH CHECK (city_id = public.rls_current_city_id() AND public.rls_is_pa());
```

#### 6.7.2 `notifications.notification_events`

Users see their own notifications. IT Admin and SP Secretary may see all for operational support.

```sql
ALTER TABLE notifications.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_notification_events_select ON notifications.notification_events
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (deleted_at IS NULL OR public.rls_has_any_role('auditor', 'sys_admin'))
        AND (
            recipient_user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
            OR public.rls_has_role('sp_secretary')
        )
    );

-- Notification events are inserted by the notification service (batac_app)
CREATE POLICY pol_notification_events_insert ON notifications.notification_events
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id());

-- Users may update their own notifications (e.g., marking as read)
CREATE POLICY pol_notification_events_update ON notifications.notification_events
    AS PERMISSIVE FOR UPDATE TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            recipient_user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
        )
        AND deleted_at IS NULL
    )
    WITH CHECK (
        city_id = public.rls_current_city_id()
        AND (
            recipient_user_id = public.rls_current_user_id()
            OR public.rls_is_ita()
        )
    );
```

#### 6.7.3 `notifications.delivery_log`

Append-only delivery log. No UPDATE (per C1 §1.4).

```sql
ALTER TABLE notifications.delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY pol_delivery_log_select ON notifications.delivery_log
    AS PERMISSIVE FOR SELECT TO batac_app
    USING (
        city_id = public.rls_current_city_id()
        AND (
            -- Users see delivery records for their own notifications
            EXISTS (
                SELECT 1 FROM notifications.notification_events ne
                WHERE ne.id = notifications.delivery_log.notification_event_id
                  AND ne.recipient_user_id = public.rls_current_user_id()
            )
            OR public.rls_is_ita()
        )
    );

CREATE POLICY pol_delivery_log_insert ON notifications.delivery_log
    AS PERMISSIVE FOR INSERT TO batac_app
    WITH CHECK (city_id = public.rls_current_city_id());
-- No UPDATE policy — append-only
```

---

### 6.8 Schema: `audit`

The `audit` schema is the most tightly controlled in the platform. It implements Architectural Invariant #3 (audit log INSERT-only at DB role level) and the read-access rules from I1 §8.

#### 6.8.1 `audit.events` — Tier E (Append-Only Isolation)

Key design decisions reflected in these policies:
- `FORCE ROW LEVEL SECURITY` prevents even the `batac_migrate` BYPASSRLS grant from overriding the audit isolation during normal operation. **Exception:** `batac_migrate` may still bypass for DDL migrations during scheduled maintenance windows.
- `batac_app` has **no SELECT policy** on `audit.events`. The absence of a SELECT policy means `batac_app` can never read the audit log directly. Full log reads go through the `batac_audit` role via a stored procedure.
- `batac_audit` has INSERT and SELECT policies only (UPDATE/DELETE revoked at the grant level per C1 Part 0.2).
- The `resource_office_id` column (introduced by I1 D-ABAC-04) enables office-scoped filtering in the SELECT policy.

```sql
ALTER TABLE audit.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.events FORCE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────────────────
-- batac_app: INSERT only — no SELECT, no UPDATE, no DELETE
-- This INSERT policy is used by the audit service when it writes events on
-- behalf of the batac_audit (via the audit service DB connection).
-- ──────────────────────────────────────────────────────────────────────────
-- NOTE: If the audit service connects via batac_audit (not batac_app), this
-- policy may be omitted. Define based on which DB role the audit service uses.
-- The canonical model from C1 Part 0.2 is batac_audit for the audit service.
-- This INSERT policy targets batac_app only as a fallback/bridge if needed.

-- No SELECT policy for batac_app on audit.events — SELECT is intentionally absent.
-- batac_app CANNOT read audit.events via any path.

-- ──────────────────────────────────────────────────────────────────────────
-- batac_audit: INSERT (the audit service writes events)
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY pol_audit_events_insert ON audit.events
    AS PERMISSIVE FOR INSERT TO batac_audit
    WITH CHECK (
        city_id = public.rls_current_city_id()
        -- The audit service must set app.current_city_id before writing
    );

-- ──────────────────────────────────────────────────────────────────────────
-- batac_audit: SELECT — role-gated read access (I1 §8.2–8.6)
-- The audit service acts on behalf of authorized application users.
-- It resolves the requesting user's roles and applies them here.
-- ──────────────────────────────────────────────────────────────────────────
CREATE POLICY pol_audit_events_select ON audit.events
    AS PERMISSIVE FOR SELECT TO batac_audit
    USING (
        city_id = public.rls_current_city_id()
        AND (
            -- Full log access: Auditors only (I1 §8.4)
            public.rls_has_role('auditor')

            -- Own-action read: any operational role seeing their own events (I1 §8.2)
            OR (
                actor_id = public.rls_current_user_id()
                AND public.rls_has_any_role(
                    'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
                    'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
                    'records_officer'
                )
            )

            -- Own-office document events: approver-and-above roles (I1 §8.3)
            OR (
                resource_office_id IS NOT NULL
                AND public.rls_office_in_scope(resource_office_id)
                AND public.rls_has_any_role(
                    'records_officer', 'dept_approver', 'sp_secretary',
                    'sp_presiding_officer', 'mayor', 'brgy_captain'
                )
            )

            -- IT Admin: hash chain validation only (I1 §8.5)
            OR public.rls_is_ita()
        )
    );

-- No UPDATE policy for batac_audit — UPDATE revoked at grant level (C1 Part 9).
-- No DELETE policy for batac_audit — DELETE revoked at grant level.
```

---

## 7. Grant Statements

The following grant statements complement C1's role definitions and the policies above. They establish the minimum necessary privileges for each database role.

```sql
-- ──────────────────────────────────────────────────────────────────────────
-- batac_migrate: full DDL on all schemas (BYPASSRLS set above)
-- ──────────────────────────────────────────────────────────────────────────
GRANT ALL PRIVILEGES ON SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications, audit, public
TO batac_migrate;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications, audit
TO batac_migrate;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA
    documents, iam, organization, workflow, tracking, records, notifications, audit
TO batac_migrate;

-- ──────────────────────────────────────────────────────────────────────────
-- batac_app: SELECT/INSERT/UPDATE on all schemas EXCEPT audit.
-- DELETE is revoked from all app roles per C1 v3 (Invariant #2).
-- ──────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications, public
TO batac_app;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications
TO batac_app;

REVOKE DELETE ON ALL TABLES IN SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications
FROM batac_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA
    documents, organization, iam, workflow, tracking, records, notifications
TO batac_app;

-- Explicitly NO access to audit schema for batac_app
REVOKE ALL ON SCHEMA audit FROM batac_app;

-- ──────────────────────────────────────────────────────────────────────────
-- batac_it_admin: Same as batac_app, but with NO access to
-- documents.versions and documents.attachments (Invariant #10).
-- DELETE is revoked.
-- ──────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications, public
TO batac_it_admin;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications
TO batac_it_admin;

REVOKE DELETE ON ALL TABLES IN SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications
FROM batac_it_admin;

-- Invariant #10: IT Admin has NO access to document content tables
REVOKE ALL ON documents.versions FROM batac_it_admin;
REVOKE ALL ON documents.attachments FROM batac_it_admin;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA
    documents, organization, iam, workflow, tracking, records, notifications
TO batac_it_admin;

-- Explicitly NO access to audit schema for batac_it_admin
REVOKE ALL ON SCHEMA audit FROM batac_it_admin;

-- ──────────────────────────────────────────────────────────────────────────
-- batac_readonly: SELECT-only on all schemas except audit.
-- For reporting and monitoring dashboards.
-- ──────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications, public
TO batac_readonly;

GRANT SELECT ON ALL TABLES IN SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications
TO batac_readonly;

-- Explicitly NO write access and NO access to audit schema for batac_readonly
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA
    iam, organization, documents, workflow, tracking, records, notifications
FROM batac_readonly;
REVOKE ALL ON SCHEMA audit FROM batac_readonly;

-- ──────────────────────────────────────────────────────────────────────────
-- batac_audit: INSERT and SELECT only on audit schema.
-- UPDATE and DELETE explicitly revoked (C1 Part 0.2; Invariant #3).
-- ──────────────────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA audit TO batac_audit;
GRANT INSERT, SELECT ON audit.events TO batac_audit;
REVOKE UPDATE, DELETE ON audit.events FROM batac_audit;

-- batac_audit also needs to call the helper functions (for session var reads)
GRANT USAGE ON SCHEMA public TO batac_audit;

-- ──────────────────────────────────────────────────────────────────────────
-- Audit reader stored procedure (I1 §8.4)
-- Full log read access for Auditors goes through this procedure,
-- which runs as batac_audit (SECURITY DEFINER).
-- ──────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit.fn_read_audit_log(
    p_from_time     TIMESTAMPTZ DEFAULT NULL,
    p_to_time       TIMESTAMPTZ DEFAULT NULL,
    p_resource_type TEXT        DEFAULT NULL,
    p_actor_id      UUID        DEFAULT NULL
)
RETURNS SETOF audit.events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit, public, pg_temp
AS $$
BEGIN
    -- Caller must be an Auditor (enforced via session variable checked here)
    IF NOT public.rls_has_role('auditor') THEN
        RAISE EXCEPTION 'audit_read_access_denied: auditor role required';
    END IF;

    RETURN QUERY
    SELECT *
    FROM audit.events
    WHERE city_id = public.rls_current_city_id()
      AND (p_from_time   IS NULL OR occurred_at >= p_from_time)
      AND (p_to_time     IS NULL OR occurred_at <= p_to_time)
      AND (p_resource_type IS NULL OR resource_type = p_resource_type)
      AND (p_actor_id    IS NULL OR actor_id = p_actor_id)
    ORDER BY occurred_at DESC;
END;
$$;

ALTER FUNCTION audit.fn_read_audit_log(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID)
    OWNER TO batac_migrate;
REVOKE ALL ON FUNCTION audit.fn_read_audit_log(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION audit.fn_read_audit_log(TIMESTAMPTZ, TIMESTAMPTZ, TEXT, UUID)
    TO batac_app;
```

---

## 8. Security Considerations

### 8.1 Session Variable Injection Risk

The session variable mechanism (`SET LOCAL app.xxx`) is the single most security-sensitive element of this RLS design. If an attacker can execute arbitrary SQL that includes `SET LOCAL app.current_user_id = '<victim_uuid>'` before a query, they can impersonate any user.

**Mitigations:**
- Session variables must be set exclusively by authenticated application middleware, immediately after JWT verification. User-supplied data must never flow directly into a `SET LOCAL` call.
- The application's database connection pool must **never** leak a session with pre-set variables to a different request. Use transaction-scoped `SET LOCAL` (not `SET SESSION`) so variables reset at transaction end.
- The Fastify plugin responsible for setting session variables should be the only code path that does so, and should be covered by integration tests that verify variables are set correctly for each role combination.

### 8.2 RESTRICTIVE vs. PERMISSIVE Policy Ordering

The IT Admin content isolation policies on `documents.versions` and `documents.attachments` use `AS RESTRICTIVE`. A RESTRICTIVE policy is evaluated with `AND` against PERMISSIVE policies — a row is only returned if it passes ALL RESTRICTIVE policies AND at least one PERMISSIVE policy.

This means that even if a future PERMISSIVE policy is added that would otherwise grant IT Admin access to a confidential version row, the RESTRICTIVE policy continues to block it. This is the intended behavior for a security invariant that is described in the architecture as non-overridable.

**Warning:** Never add a PERMISSIVE policy that attempts to grant IT Admin access to Confidential/Restricted `documents.versions` or `documents.attachments` rows — the RESTRICTIVE policy will block it silently.

### 8.3 `FORCE ROW LEVEL SECURITY` on `audit.events`

`FORCE ROW LEVEL SECURITY` on `audit.events` means the RLS policies apply even to roles that would normally bypass RLS (e.g., if `batac_migrate` were temporarily used in a production context). The only escape is a superuser with `BYPASSRLS` explicitly set at the server level. This provides a strong additional guarantee for the tamper-evidence property of the audit log.

### 8.4 Cross-Schema RLS Function Dependency

The `has_cross_office_read_grant` function and the SELECT policies on `documents.documents`, `documents.versions`, and `documents.attachments` execute subqueries against other schemas (`organization.cross_office_grants`, `documents.classification_allowlists`, `documents.documents`). These cross-schema reads happen inside policy expressions, which run in the security context of the calling query — not the table owner. Ensure that:
- `batac_app` has SELECT on `organization.cross_office_grants`.
- `batac_app` has SELECT on `documents.classification_allowlists`.
- The helper functions that encapsulate these reads are marked `STABLE` (already done in §3.4) so the query planner can cache results within a single query.

### 8.5 Performance: RLS and the Query Planner

Every query against an RLS-protected table incurs the cost of evaluating the policy expression. The most expensive expressions are the EXISTS subqueries in the `documents.documents`, `documents.versions`, and `documents.attachments` SELECT policies.

The following indexes (to be specified in full in C4) are critical for RLS policy performance:
- `documents.documents (city_id, owned_by_office_id)` — the primary filter in all document SELECT policies.
- `documents.documents (city_id, classification_level)` — the classification gate subquery.
- `documents.classification_allowlists (document_type_id, role_code)` — the EXISTS check in Gate 4.
- `organization.cross_office_grants (user_id, office_id)` — the cross-office grant function.
- `audit.events (city_id, actor_id, occurred_at)` — audit log filtering.

Until C4 specifies and creates these indexes, RLS policy evaluation on large tables will perform sequential scans in the worst case.

### 8.6 NULL-Safe Session Variable Handling

All policy expressions use `current_setting('app.xxx', true)` with the `true` (missing-ok) parameter. An unset variable returns `NULL`. PostgreSQL's three-valued logic means `NULL = anything` evaluates to `NULL`, which is treated as `FALSE` in a WHERE/USING clause. This produces a **secure-default denial** — an unauthenticated or misconfigured session cannot accidentally read any rows. This property must be preserved in any future changes to policy expressions.

### 8.7 Soft-Delete and Audit Visibility

Soft-deleted rows (`deleted_at IS NOT NULL`) remain visible to `auditor`, `records_officer`, and `sys_admin` roles. This aligns with I1 Gate 5 ("Soft-deleted resources remain readable by any role that could read them before deletion, to support audit and records investigation") and Consolidated Reference Part 11.4. If a row is recovered from soft-delete (i.e., `deleted_at` is set back to `NULL`), it immediately becomes visible to all roles that would normally see it — no special recovery policy is needed.

---

## 9. Conclusion

This document specifies the complete PostgreSQL RLS policy set for the eight Phase 1 schemas of the Batac City LGU Platform. The policies are implemented against five database roles (`batac_app`, `batac_audit`, `batac_it_admin`, `batac_readonly`, `batac_migrate`) and enforce a layered security posture:

1. **Tenant isolation** (`city_id`) is present in every single policy as the non-negotiable outer gate.
2. **Role and office scope** policies implement the bulk of I1's ABAC rules at the database layer.
3. **RESTRICTIVE policies** enforce the IT Admin content isolation invariant for Confidential and Restricted document content in a non-overridable way.
4. **`FORCE ROW LEVEL SECURITY`** on `audit.events` protects the tamper-evident audit log.
5. **Grant-level exclusion** (no SELECT grant to `batac_app` on the audit schema) provides the first, non-RLS layer of audit isolation.
6. **DELETE revocation** from all application-facing roles (`batac_app`, `batac_audit`, `batac_it_admin`, `batac_readonly`) makes hard deletes structurally impossible at the database layer.

### Implementation Checklist

Before the first Phase 1 database migration is applied:

- [ ] `ALTER ROLE batac_migrate BYPASSRLS;` executed.
- [ ] All five DB roles created: `batac_app`, `batac_audit`, `batac_it_admin`, `batac_readonly`, `batac_migrate`.
- [ ] All helper functions in §3.4 created and granted.
- [ ] `has_cross_office_read_grant` function verified against `organization.cross_office_grants` schema.
- [ ] `documents.classification_allowlists` DDL added to the documents schema migration (I1 D-ABAC-02).
- [ ] `organization.cross_office_grants` DDL added to the organization schema migration (B5 D-AUTH-09).
- [ ] `resource_office_id UUID NULL` column added to `audit.events` DDL (I1 D-ABAC-04).
- [ ] All `ENABLE ROW LEVEL SECURITY` statements applied before any data is inserted.
- [ ] `FORCE ROW LEVEL SECURITY` applied to `audit.events` before audit service goes live.
- [ ] Grant statements in §7 applied; `REVOKE ALL ON SCHEMA audit FROM batac_app` confirmed.
- [ ] `REVOKE ALL ON documents.versions FROM batac_it_admin` and `REVOKE ALL ON documents.attachments FROM batac_it_admin` confirmed.
- [ ] `DELETE` revoked from `batac_app`, `batac_audit`, `batac_it_admin`, and `batac_readonly` on all tables.
- [ ] Integration tests verify that an unauthenticated session (no `SET LOCAL app.*`) cannot read any row from any schema.
- [ ] Integration tests verify IT Admin (`is_ita = true`) cannot SELECT rows from `documents.versions` or `documents.attachments` where the parent document `classification_level IN ('confidential', 'restricted')`.
- [ ] Integration tests verify `batac_readonly` can only SELECT (no INSERT/UPDATE/DELETE).
- [ ] C4 index strategy reviewed alongside these policies to ensure all correlated subqueries in USING clauses have supporting indexes.

---

*This document is the authoritative C3 specification. It must be updated whenever a new table is added to any Phase 1 schema, whenever a new role is introduced to `iam.roles`, or whenever I1's ABAC policy adds a new resource type or action that has database-layer enforcement implications. This document supersedes any implicit RLS assumptions in prior architecture documents.*
