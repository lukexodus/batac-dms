# C4. Index Strategy Document — Pre-Development Baseline

**Document:** C4
**Platform:** Batac City LGU Platform
**Status:** Pre-Development Baseline
**Version:** 1.0
**Date:** June 2026
**Prerequisites:** C1 (Full Database Schema DDL) — must be accepted before any index migration is written
**Audience:** Backend development team; LGU IT Office (DBA reviewers)
**Source Documents reviewed for this document:**

- `c1-full-database-schema-ddl.md` — the authoritative column inventory for all 49 tables across the eight Phase 1 schemas; the primary source for every column reference below
- `e1-trpc-router-and-procedure-catalog.md` — the confirmed query patterns, filter shapes, and sort orders for every `/web` procedure; the primary driver of index selection
- `consolidated-architecture-and-requirements-reference-iteration-3.md` — Parts 10–12 (module boundaries, architectural invariants, RLS strategy) and Part 9 (search strategy by phase)
- `2-stack-context.md` — PostgreSQL non-negotiables (JSONB GIN requirement, FTS strategy, search phase transition), stack decisions

---

## About This Document

### Purpose

C1 explicitly excludes performance indexes from its scope: "Beyond the indexes required to enforce uniqueness or a structural invariant, no indexes are added for query-performance reasons alone. C4 owns GIN indexes on JSONB, `owning_office_id`/`status`/`deleted_at` indexes, etc." This document is the fulfillment of that stated scope boundary — it catalogs every non-structural index that must exist before Phase 1 development begins, and defers those that are only needed when Phase 2 (Meilisearch) is live or when new query patterns are confirmed.

### What Is and Is Not Covered

**In scope:** All B-tree, partial, composite, and GIN indexes on the eight Phase 1 schemas (`iam`, `organization`, `documents`, `workflow`, `tracking`, `records`, `notifications`, `audit`) that serve confirmed Phase 1 query patterns from E1's procedure catalog. Every index in this document is assigned a phase tag: `[Phase 1]` (must exist before the first Phase 1 feature ships) or `[Phase 2]` (can be deferred until Meilisearch sync jobs and RMS are live).

**Not in scope:** Structural indexes that enforce uniqueness constraints — those are already defined in C1 as `CONSTRAINT uq_*` clauses and `CREATE UNIQUE INDEX` statements on the relevant tables. This document does not repeat them; it only adds indexes that serve query performance without imposing a uniqueness or structural invariant. The two categories are cross-referenced where a constraint index already partially covers a needed query pattern.

**Not in scope:** The `portal`, `search_meta`, and `reporting` schemas (Phase 3, Phase 2, and Phase 2 respectively). These schemas have their own query patterns that will be addressed in a future C4 addendum once their DDL is baselined.

### Notation

| Tag | Meaning |
|---|---|
| `[Phase 1]` | Index must be in the initial migration set, before any Phase 1 feature is deployed |
| `[Phase 2]` | Index can be deferred; the query load it serves is either Phase 2+ only or is substantially absorbed by Meilisearch once that is live |
| `[Confirmed — source]` | The index's necessity is directly traceable to a named query pattern in E1 or to a stated architectural invariant |
| `[Inference]` | The index is implied by a confirmed column's role (e.g., a `WHERE deleted_at IS NULL` filter applied uniformly across the platform), not named verbatim in any source |

### Global Patterns Applied Uniformly

Three index patterns recur on virtually every table and are stated once here rather than explained at each occurrence:

1. **`city_id` leading column.** Because C3's RLS policies will filter every query by `city_id` (C1 §1.3: "every RLS policy has the same shape"), any composite index on a frequently-queried column should have `city_id` as its leading column so PostgreSQL can use the index for the RLS-filtered scan without a separate filter step. For tables with very low row counts (e.g., `iam.roles`, `organization.committees`), a standalone `city_id` index is skipped in favor of the composite already present.

2. **`deleted_at IS NULL` partial indexes.** The no-hard-delete invariant (C1 §1.5, Architectural Invariant #2) means live queries nearly always filter `WHERE deleted_at IS NULL`. Partial indexes on frequently-filtered columns are therefore scoped with `WHERE deleted_at IS NULL` to keep the index small and the scan efficient. Tables that are append-only by design (`audit.events`, `tracking.routing_entries`, `workflow.workflow_events`, `notifications.delivery_log`) never have `deleted_at` set and do not need partial soft-delete indexes.

3. **`updated_at` descending.** Dashboards and list endpoints in E1 frequently order by recency. Where a table is both frequently listed and mutable, a descending index on `updated_at` is included. Append-only tables that lack `updated_at` use `created_at DESC` instead.

---

## Part 1 — Schema `iam`

The IAM schema is read on nearly every authenticated request (session validation, role resolution, delegation context expansion). Its indexes must be tight; the tables are written infrequently but read at high frequency relative to all others.

### 1.1 `iam.users`

```sql
-- Primary lookup: resolve a user by username within a city (login flow).
-- city_id leading because RLS filters every query; username drives the lookup.
CREATE INDEX idx_users_city_username
    ON iam.users (city_id, username)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — iam.getCurrentUser; login auth flow]

-- Secondary lookup: resolve by email (password-reset, duplicate-check on invite).
CREATE INDEX idx_users_city_email
    ON iam.users (city_id, email)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — iam.createUserAccount duplicate-email guard; login flow]

-- Status filter: listUserDirectory filters by status='active' in the hot path.
CREATE INDEX idx_users_city_status
    ON iam.users (city_id, status)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — iam.listUserDirectory; session validation guards]
```

Note: `uq_users_city_username` and `uq_users_city_email` defined in C1 already enforce uniqueness on these same columns. The indexes above are *non-unique* partial variants (scoped to `deleted_at IS NULL`) that the query planner will prefer over the unique constraint indexes for live-row-only lookups, because the constraint indexes include soft-deleted rows.

### 1.2 `iam.sessions`

```sql
-- Token hash lookup: every authenticated request resolves the session by token hash.
-- This is the highest-read index in the entire schema; it must be on a dedicated index
-- even though uq_sessions_token_hash already exists as a unique constraint — the
-- unique constraint index is sufficient and no additional index is needed here.
-- [No additional index required — uq_sessions_token_hash covers this]

-- Active sessions for a user: listActiveSessions and single-active-session enforcement.
CREATE INDEX idx_sessions_user_id_active
    ON iam.sessions (user_id)
    WHERE terminated_at IS NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — iam.listActiveSessions; single-session enforcement at login]

-- Admin view: listAllActiveSessions lists all non-terminated sessions, ordered by recency.
CREATE INDEX idx_sessions_city_created_desc
    ON iam.sessions (city_id, created_at DESC)
    WHERE terminated_at IS NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — iam.listAllActiveSessions]
```

### 1.3 `iam.refresh_tokens`

```sql
-- Token rotation: every refresh resolves the token by hash (highest-write hot path in IAM).
-- uq_refresh_tokens_token_hash already exists as a unique constraint index in C1.
-- [No additional index required — the unique constraint index covers the lookup]

-- Revocation check: the auth middleware checks is_revoked before issuing a new token.
CREATE INDEX idx_refresh_tokens_user_active
    ON iam.refresh_tokens (user_id)
    WHERE is_revoked = false AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — token refresh and revocation-check flows]
```

### 1.4 `iam.role_assignments`

```sql
-- Role resolution: the JWT middleware expands a user's effective roles at every request.
-- This is called on every protectedProcedure invocation (E1 Global Conventions §3).
-- The partial unique index uq_role_assignments_active (city_id-excluded) already
-- exists in C1. An additional covering index with city_id leading is added here
-- because RLS filters inject city_id into the scan predicate.
CREATE INDEX idx_role_assignments_user_active
    ON iam.role_assignments (city_id, user_id)
    WHERE is_active = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — iam middleware role-expansion; iam.getCurrentUser]

-- Office-scoped role lookup: ABAC delegation context expansion filters by office_scope_id.
CREATE INDEX idx_role_assignments_office_scope
    ON iam.role_assignments (city_id, office_scope_id, role_id)
    WHERE is_active = true AND deleted_at IS NULL AND office_scope_id IS NOT NULL;
-- [Phase 1] [Confirmed — I1 §16 delegation context; organization.getActiveDesignations]
```

### 1.5 `iam.role_permissions`

```sql
-- Permission matrix resolution: evaluatePolicy() joins role_permissions to permissions
-- to resolve the Allow/Deny/Conditional decision for a given (role, resource, action).
CREATE INDEX idx_role_permissions_role_id
    ON iam.role_permissions (city_id, role_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — I1 §B5 cascade; iam.evaluatePolicy() in every protectedProcedure]
```

### 1.6 `iam.mfa_records`

```sql
-- MFA check: auth flow checks the user's active MFA record at every login.
-- uq_mfa_records_user already enforces one-per-user. A partial index for the
-- is_active=true subset is added for the hot "does this user have active MFA?" query.
CREATE INDEX idx_mfa_records_user_active
    ON iam.mfa_records (user_id)
    WHERE is_active = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — consolidated reference Part 11.1 MFA auth flow]
```

---

## Part 2 — Schema `organization`

The organization schema is read frequently by the ABAC engine (office hierarchy traversal, delegation lookup, committee membership resolution) but written only by Platform Admin configuration actions.

### 2.1 `organization.offices`

```sql
-- Office hierarchy traversal: getOfficeHierarchy() walks parent_office_id recursively.
-- A covering index on (city_id, parent_office_id) lets the recursive CTE avoid a seq scan.
CREATE INDEX idx_offices_city_parent
    ON organization.offices (city_id, parent_office_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Organization.getOfficeHierarchy(); I1 ABAC evaluation]

-- Code lookup: offices are looked up by code in several admin-facing procedures.
CREATE INDEX idx_offices_city_code
    ON organization.offices (city_id, code)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Inference — office code is the human-facing stable identifier used in seed data and admin screens]
```

Note: `uq_offices_city_code` in C1 already enforces uniqueness; the partial index above is the live-rows-only variant the planner prefers for non-uniqueness lookups.

### 2.2 `organization.employees`

```sql
-- User-to-employee resolution: getEmployeeByUserId() is called from ABAC delegation
-- expansion and from several E1 procedures (organization.createDesignationGrant, etc.).
CREATE INDEX idx_employees_user_id
    ON organization.employees (user_id)
    WHERE user_id IS NOT NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Organization.getEmployeeByUserId(); E1 organizationRouter]

-- Employee number lookup: used in admin directory searches.
CREATE INDEX idx_employees_city_employee_number
    ON organization.employees (city_id, employee_number)
    WHERE employee_number IS NOT NULL AND deleted_at IS NULL;
-- [Phase 1] [Inference — employee_number is the official civil-service identifier; admin lookups use it]
-- Note: uq_employees_city_employee_number already exists as a partial unique index in C1;
-- this entry is a documentation note only — no additional DDL needed.
```

### 2.3 `organization.assignments`

```sql
-- Current assignment resolution: resolveCurrentHolder() joins assignments to positions
-- to find who currently holds a given position.
CREATE INDEX idx_assignments_position_active
    ON organization.assignments (city_id, position_id, office_id)
    WHERE is_active = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Organization.resolveCurrentHolder()]

-- Employee assignment history: viewed from employee detail screens.
CREATE INDEX idx_assignments_employee_id
    ON organization.assignments (city_id, employee_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Inference — employee detail view in admin screens lists assignment history]
```

### 2.4 `organization.delegation_grants`

```sql
-- Active delegation lookup per delegatee: the ABAC delegation context expansion
-- calls getActiveDelegationForUser() on every authenticated request where the subject
-- holds a delegation. This is the single most latency-sensitive query in the organization
-- schema — it fires inside the middleware chain on every procedure call.
-- Note: uq_delegation_grants_one_active_per_delegatee already exists as a partial unique
-- index (C1 §3.6) covering (delegated_to_employee_id) WHERE is_active=true AND deleted_at IS NULL.
-- An additional index on the user-side join path is added here.
CREATE INDEX idx_delegation_grants_delegatee_active
    ON organization.delegation_grants (city_id, delegated_to_employee_id)
    WHERE is_active = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Organization.getActiveDelegationForUser(); I1 §16; E1 middleware]

-- Delegating-authority view: sp_presiding_officer and mayor revoke only their own grants.
CREATE INDEX idx_delegation_grants_delegating_active
    ON organization.delegation_grants (city_id, delegating_employee_id)
    WHERE is_active = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 organization.revokeDesignationGrantEarly ABAC check]

-- Designation document back-reference: lookup by the issuing document UUID.
CREATE INDEX idx_delegation_grants_designation_doc
    ON organization.delegation_grants (designation_document_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Inference — documents detail screen links to the associated delegation grant]

-- Date-range validity filter: getDesignationHistory() filters by valid_from/valid_until.
CREATE INDEX idx_delegation_grants_validity_range
    ON organization.delegation_grants (city_id, valid_from, valid_until)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 organization.getDesignationHistory input date range]
```

### 2.5 `organization.committee_memberships`

```sql
-- Committee membership lookup per employee: committee_ids JWT claim is populated from this.
-- Called at token issuance and on every I1 §6.6 committee-scope ABAC check.
CREATE INDEX idx_committee_memberships_employee_active
    ON organization.committee_memberships (city_id, employee_id)
    WHERE is_active = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — I1 §1 D-ABAC-06; E1 workflow.submitCommitteeReport ABAC condition]

-- Committee roster view: list all active members of a given committee.
CREATE INDEX idx_committee_memberships_committee_active
    ON organization.committee_memberships (city_id, committee_id)
    WHERE is_active = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 organizationRouter committee management screens]
```

---

## Part 3 — Schema `documents`

The documents schema carries the highest query volume of any schema. Its tables are read on virtually every screen in `/web` and written on every document lifecycle event. Index selection here has the largest impact on application responsiveness.

### 3.1 `documents.document_types`

```sql
-- Type lookup by code: the most frequent lookup; used in every document-creation validation.
-- uq_document_types_city_code already exists in C1 as a unique constraint.
-- A partial live-rows-only index is added for non-uniqueness lookups.
CREATE INDEX idx_document_types_city_code
    ON documents.document_types (city_id, code)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — documents.create metadata_schema validation; workflow definition lookups]

-- Active types filter: the document-type picker in the create-document screen lists only
-- is_active=true types.
CREATE INDEX idx_document_types_city_active
    ON documents.document_types (city_id, is_active)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Inference — document-type picker in every document-creation screen]
```

### 3.2 `documents.number_series`

```sql
-- Series key lookup: fn_get_next_sequence_value() looks up the series by series_key
-- on every numbering event. Must be fast; it runs inside a transaction that holds a
-- FOR UPDATE lock on documents.documents.
CREATE INDEX idx_number_series_city_key
    ON documents.number_series (city_id, series_key)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — C1 §4.11 fn_get_next_sequence_value(); E1 documents.assignPreliminaryNumber / assignFinalNumber]
-- Note: uq_number_series_city_key already enforces uniqueness; this partial index is
-- the live-rows-only variant.

-- Document type code join: number_series rows are joined to document_types via
-- (city_id, document_type_code) for the composite FK relationship.
CREATE INDEX idx_number_series_city_doctype
    ON documents.number_series (city_id, document_type_code)
    WHERE document_type_code IS NOT NULL AND deleted_at IS NULL;
-- [Phase 1] [Inference — FK join pattern used in numbering service resolution]
```

### 3.3 `documents.documents`

This is the most heavily indexed table in the system. The query patterns in E1 (`documents.list`, `documents.search`, `session.getOrderOfBusiness`, `workflow.listMyAssignedSteps`) all filter against multiple columns on this table simultaneously.

```sql
-- ── Core multi-column filter indexes ─────────────────────────────────────────

-- Office + lifecycle filter: the SP Secretary queue and department dashboards filter
-- by owned_by_office_id and lifecycle_state simultaneously. This composite is the
-- single highest-value index on this table for queue-rendering.
CREATE INDEX idx_documents_office_state
    ON documents.documents (city_id, owned_by_office_id, lifecycle_state)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 documents.list officeId + lifecycleState filter; SP Secretary dashboard queue]

-- Originating office filter: separate from owning office; used in "what did this office
-- originate" reports and in letter tracking (originating_office_id = external sender for SPR docs).
CREATE INDEX idx_documents_originating_office
    ON documents.documents (city_id, originating_office_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 documents.list; consolidated reference Part 11.4 originating-office rules]

-- Document type filter: list procedures frequently filter by document_type_id.
CREATE INDEX idx_documents_type_id
    ON documents.documents (city_id, document_type_id, lifecycle_state)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 documents.list documentTypeId filter; workflow engine type-gating]

-- Lifecycle state only: some procedures filter by state across all office contexts
-- (e.g., Records Officer bulk archive, Auditor full log view).
CREATE INDEX idx_documents_city_state
    ON documents.documents (city_id, lifecycle_state)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 documents.list; records.bulkArchive (Phase 2 RMS but the index is needed by Phase 1 records.archive too)]

-- Created-by filter: documents.update and documents.delete enforce created_by =
-- subject.user_id for sp_member / dept_encoder. The ABAC check queries this column.
CREATE INDEX idx_documents_created_by
    ON documents.documents (city_id, created_by)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — I1 §3.3 Additional Rule; I1 §3.4; E1 documents.update / documents.delete ABAC]

-- Workflow instance back-reference: getActiveInstanceForDocument() joins documents to
-- workflow_instances via workflow_instance_id.
CREATE INDEX idx_documents_workflow_instance
    ON documents.documents (workflow_instance_id)
    WHERE workflow_instance_id IS NOT NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Workflow.getActiveInstanceForDocument(); E1 workflow.getActiveInstanceForDocument]

-- QR tracking number lookup: scanQrCodeAuthenticated resolves by qr_tracking_number.
-- uq_documents_qr_tracking_number already exists as a unique constraint in C1;
-- the partial live-rows-only variant is added for scan lookups.
CREATE INDEX idx_documents_qr_tracking_number
    ON documents.documents (qr_tracking_number)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 tracking.scanQrCodeAuthenticated]

-- Preliminary / final number lookups: number searches in the SP Secretary dashboard
-- and in the Order of Business view.
CREATE INDEX idx_documents_preliminary_number
    ON documents.documents (city_id, preliminary_number)
    WHERE preliminary_number IS NOT NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 documents.search; Order of Business number display]

CREATE INDEX idx_documents_final_number
    ON documents.documents (city_id, final_number)
    WHERE final_number IS NOT NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 documents.search; Panlalawigan review log joins by final number]

-- Recency ordering: all list procedures support default ordering by updated_at DESC.
CREATE INDEX idx_documents_city_updated_desc
    ON documents.documents (city_id, updated_at DESC)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Inference — universal list ordering pattern per E1 Global Conventions §5]

-- ── JSONB GIN indexes ─────────────────────────────────────────────────────────

-- metadata GIN: admin-configurable metadata fields (sponsors, publication date,
-- certification references, etc.) are queried with the @> containment operator and
-- ->> accessor per the PostgreSQL non-negotiables in 2-stack-context.md.
-- A single path-ops GIN index covers all JSONB containment and accessor queries
-- on this column.
CREATE INDEX idx_documents_metadata_gin
    ON documents.documents USING GIN (metadata jsonb_path_ops);
-- [Phase 1] [Confirmed — 2-stack-context.md "JSONB — Use GIN indexes. Query with @> operator and ->> accessors"]
-- Rationale for jsonb_path_ops over the default jsonb_ops: jsonb_path_ops produces a
-- smaller index and is faster for @> containment queries; the trade-off (no support for
-- the ? key-existence operator) is acceptable here because all confirmed metadata queries
-- in E1 and I1 use @> containment, not standalone key-existence checks.

-- ── Full-text search (Phase 1: PostgreSQL FTS; Phase 2: Meilisearch supplements) ──

-- tsvector index on title: Phase 1 FTS for documents.search procedure.
-- This index is Phase 1 scope; Phase 2 adds Meilisearch, which absorbs the typo-tolerance
-- and faceted-filtering load, but the tsvector index remains for authenticated internal
-- searches that bypass Meilisearch (e.g., audit-trail queries that need DB-level FTS).
CREATE INDEX idx_documents_title_fts
    ON documents.documents USING GIN (to_tsvector('english', title))
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — 2-stack-context Search Strategy "Phase 1: PostgreSQL FTS (tsvector/tsquery)"; E1 documents.search]
-- Note: A separate Filipino/Ilocano FTS configuration is not available as a built-in
-- PostgreSQL text-search dictionary. Phase 1 uses the 'english' configuration as an
-- approximation for title-word tokenization; this is acceptable for the confirmed Phase 1
-- volume and is superseded by Meilisearch's multilingual support in Phase 2.
```

### 3.4 `documents.versions`

```sql
-- Document-to-versions join: getVersionHistory() reads all versions for a document,
-- ordered by version_number ASC.
CREATE INDEX idx_versions_document_id
    ON documents.versions (document_id, version_number ASC)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 documents.getVersionHistory]

-- OCR processing queue: the OCR worker polls for rows where ocr_processed=false.
CREATE INDEX idx_versions_ocr_unprocessed
    ON documents.versions (city_id, created_at ASC)
    WHERE ocr_processed = false AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — consolidated reference Q-C01 "OCR runs automatically on upload"; E1 documents.confirmUpload]

-- OCR text full-text search: Phase 1 FTS searches ocr_text in addition to title.
-- The column is TEXT (not a tsvector column) so a functional GIN index is used.
CREATE INDEX idx_versions_ocr_text_fts
    ON documents.versions USING GIN (to_tsvector('english', coalesce(ocr_text, '')))
    WHERE ocr_processed = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 documents.search "backed directly by PostgreSQL FTS"; OCR text included in search scope]
-- [Phase 2 note] When Meilisearch is live, it will index ocr_text via the sync job and
-- handle multilingual/typo-tolerant search. This GIN index remains for internal DB-level
-- queries but its usage from documents.search may shift to a Meilisearch query call.

-- Scan quality filter: Records Officers and Secretariat staff filter by quality category.
CREATE INDEX idx_versions_scan_quality
    ON documents.versions (document_id, scan_quality_category)
    WHERE scan_quality_category IS NOT NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 documents.getScanQualityIndicator; consolidated reference Q-C01 scan quality indicator]
```

### 3.5 `documents.attachments`

```sql
-- Document-to-attachments join: getAttachmentRefs() lists all attachments for a document.
CREATE INDEX idx_attachments_document_id
    ON documents.attachments (document_id, attachment_type)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Documents.getAttachmentRefs() Published API; E1 documents.downloadVersion pattern]
```

### 3.6 `documents.numbers`

```sql
-- Current number per document: the denormalized columns on documents.documents are the
-- fast path, but Documents.assignFinalNumber() also queries numbers directly to verify
-- the current preliminary number before retiring it.
CREATE INDEX idx_numbers_document_current
    ON documents.numbers (document_id, number_type)
    WHERE is_current = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — C1 §4.12 fn_assign_preliminary_number / fn_assign_final_number]
-- Note: uq_numbers_document_type_current already exists as a partial unique index in C1;
-- this is a documentation note only.

-- Series + year lookup: the sequence management function joins by series_id + sequence_year
-- to verify gapless continuity; auditors query this for gap-in-sequence reports.
CREATE INDEX idx_numbers_series_year
    ON documents.numbers (series_id, sequence_year, sequence_number ASC)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — C1 §4.4 numbering note "DB unique constraint on (series_id, year, sequence_number)"; gap logging]
-- Note: uq_numbers_series_year_sequence already covers uniqueness on this triple;
-- this partial (deleted_at IS NULL) variant is for live-number-only sequence gap queries.
```

### 3.7 `documents.signatures`

```sql
-- Signatures for a document: displayed on the document detail screen.
CREATE INDEX idx_signatures_document_id
    ON documents.signatures (document_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Inference — document detail view displays all signature records]

-- Signer lookup: audit queries find all documents signed by a specific employee.
CREATE INDEX idx_signatures_signed_by
    ON documents.signatures (signed_by_employee_id, signed_at DESC)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Inference — auditor "documents signed by employee X" query pattern]
```

### 3.8 `documents.panlalawigan_reviews`

```sql
-- Document back-reference: outcome recording and the Panlalawigan log view join by document_id.
-- uq_panlalawigan_reviews_document already enforces one-per-document in C1.
-- A partial live-rows-only index is added for outcome-filter queries.
CREATE INDEX idx_panlalawigan_reviews_outcome
    ON documents.panlalawigan_reviews (city_id, outcome)
    WHERE outcome IS NOT NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 workflow.recordPanlalawiganOutcome; consolidated reference Part 4.3 outcome types]

-- 30-day timer query: the pgboss scheduled job polls for pending reviews where
-- transmitted_at is not null and no outcome has been recorded within 30 days.
CREATE INDEX idx_panlalawigan_reviews_timer
    ON documents.panlalawigan_reviews (city_id, transmitted_at ASC)
    WHERE outcome IS NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — consolidated reference Part 4.3 "30-day timer: Automatically tracked from transmission date"]

-- Control number lookup: the Secretariat looks up review records by the Panlalawigan's
-- own control number when recording outcomes from the formal written notification.
CREATE INDEX idx_panlalawigan_reviews_control_number
    ON documents.panlalawigan_reviews (city_id, control_number)
    WHERE control_number IS NOT NULL AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 workflow.recordPanlalawiganOutcome; consolidated reference Part 4.3 log fields]
```

---

## Part 4 — Schema `workflow`

The workflow schema is read on every procedure call that involves a step queue or assignment check, and written on every workflow engine event. Its indexes must support both the hot real-time read paths (step assignment lookup) and the analytical read paths (SLA reporting, Order of Business generation).

> **Note on workflow schema table names:** C1's scope covers the workflow schema structure but defers the full DDL to the workflow engine specification document (B4). The column names referenced below are drawn from C1's confirmed cross-references and E1's confirmed query patterns. The index names follow the C1 `idx_{table}_{columns}` convention throughout.

### 4.1 `workflow.instances`

```sql
-- Document-to-instance lookup: getActiveInstanceForDocument() is called on every document
-- detail screen and from the documents.submit procedure.
CREATE INDEX idx_workflow_instances_document_id
    ON workflow.instances (document_id)
    WHERE status = 'Active' AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Workflow.getActiveInstanceForDocument(); E1 workflow.getActiveInstanceForDocument]

-- Status filter for dashboard queries: the SP Secretary queue lists Active instances;
-- SLA reports query both Active and Completed.
CREATE INDEX idx_workflow_instances_city_status
    ON workflow.instances (city_id, status, created_at DESC)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 workflow.getSlaComplianceData; SP Secretary dashboard]

-- Definition version filter: migrateInstanceToNewDefinitionVersion queries instances
-- by their current pinned version.
CREATE INDEX idx_workflow_instances_definition_version
    ON workflow.instances (definition_version_id, status)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 workflow.migrateInstanceToNewDefinitionVersion; C1 Invariant #4]

-- SLA deadline query: the pgboss escalation job polls for instances where sla_deadline
-- is within the warning threshold or already breached.
CREATE INDEX idx_workflow_instances_sla_deadline
    ON workflow.instances (city_id, sla_deadline ASC)
    WHERE status = 'Active' AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — consolidated reference Part 11.3 "Warning at 80% of SLA time; automatic escalation at breach"]
```

### 4.2 `workflow.step_instances`

```sql
-- Assignee inbox: listMyAssignedSteps() is the backing query for every task inbox
-- in the system. This index is called on every dashboard page load.
CREATE INDEX idx_step_instances_assignee_pending
    ON workflow.step_instances (assignee_user_id, assigned_at DESC)
    WHERE status = 'pending' AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 workflow.listMyAssignedSteps; I1 §6.1]

-- Office queue: step instances are also assigned to an office queue, not only a specific
-- user (the office-queue model for multi-user offices like the SP Secretariat).
CREATE INDEX idx_step_instances_assignee_office_pending
    ON workflow.step_instances (assignee_office_id, assigned_at DESC)
    WHERE status = 'pending' AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 workflow.listMyAssignedSteps office-scope variant; I1 §6.1]

-- Instance-to-steps join: the workflow engine traverses all steps for a given instance.
CREATE INDEX idx_step_instances_instance_id
    ON workflow.step_instances (instance_id, created_at ASC)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — workflow engine state traversal; E1 workflow.getInstance]

-- Step type filter: multi_referral step management queries by step_type.
CREATE INDEX idx_step_instances_type_pending
    ON workflow.step_instances (city_id, step_type, status)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 workflow.submitCommitteeReport; workflow.manuallyAdvanceMultiReferralStep]

-- Mayor review pending: the Mayor dashboard specifically queries for steps of name
-- 'mayor_review' and 'mayor_signature' that are pending.
CREATE INDEX idx_step_instances_mayor_steps
    ON workflow.step_instances (city_id, step_name, status)
    WHERE step_name IN ('mayor_review', 'mayor_signature', 'vp_certification') AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 workflow.mayorSign / certifyAsPresidingOfficer; Mayor dashboard]

-- Panlalawigan review pending: the 30-day timer job polls step_instances by step name.
CREATE INDEX idx_step_instances_panlalawigan_pending
    ON workflow.step_instances (city_id, assigned_at ASC)
    WHERE step_name = 'panlalawigan_review' AND status = 'pending' AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 workflow.confirmPanlalawiganDeemedApproved; consolidated reference Part 4.3]
```

### 4.3 `workflow.workflow_events`

This table is append-only (no `updated_at`, no soft-delete in practice per C1 §1.4).

```sql
-- Instance event history: the audit and workflow detail screens read all events for an instance.
CREATE INDEX idx_workflow_events_instance_id
    ON workflow.workflow_events (instance_id, occurred_at ASC);
-- [Phase 1] [Confirmed — workflow engine event replay; E1 workflow.getInstance event list]

-- Event type filter: Audit module queries by event_type for specific event categories.
CREATE INDEX idx_workflow_events_city_type
    ON workflow.workflow_events (city_id, event_type, occurred_at DESC);
-- [Phase 1] [Confirmed — E1 audit.listOwnOfficeDocumentActions event-type filtering]

-- Actor filter: the actor's own-action audit view filters by actor_id.
CREATE INDEX idx_workflow_events_actor_id
    ON workflow.workflow_events (actor_id, occurred_at DESC);
-- [Phase 1] [Confirmed — E1 audit.listOwnActions filtered to workflow events]
```

### 4.4 `workflow.definitions` and `workflow.definition_versions`

```sql
-- Active definition lookup: the workflow engine resolves the active definition for a
-- document type at workflow instance creation (documents.submit).
CREATE INDEX idx_workflow_definitions_city_doctype
    ON workflow.definitions (city_id, document_type_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — workflow engine; documents.submit creates an instance pinned to the active version]

CREATE INDEX idx_workflow_definition_versions_definition
    ON workflow.definition_versions (definition_id, is_active DESC)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Inference — version resolution: get the currently active version for a definition]
```

---

## Part 5 — Schema `tracking`

The tracking schema is read frequently from authenticated QR scans and routing history views, and written by every workflow step-completion event via the event bus.

### 5.1 `tracking.tracking_records`

```sql
-- Document lookup: getTrackingRecordForDocument() joins by document_id.
CREATE INDEX idx_tracking_records_document_id
    ON tracking.tracking_records (document_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Tracking.getTrackingRecordForDocument(); E1 tracking.getTrackingRecord]

-- QR tracking number lookup: authenticated scan path resolves by qr_tracking_number.
CREATE INDEX idx_tracking_records_qr_number
    ON tracking.tracking_records (city_id, qr_tracking_number)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 tracking.scanQrCodeAuthenticated]
```

### 5.2 `tracking.routing_entries`

This table is append-only (no `updated_at` per C1 §1.4).

```sql
-- Document routing history: getRoutingHistory() reads all entries for a document,
-- ordered chronologically. The most-called method in the Tracking module.
CREATE INDEX idx_routing_entries_document_id
    ON tracking.routing_entries (document_id, created_at ASC);
-- [Phase 1] [Confirmed — B2 Tracking.getRoutingHistory(); E1 tracking.getRoutingHistory; QR scan result]

-- Office-to-office routing query: Tracking module analytics filter by from/to office pairs.
CREATE INDEX idx_routing_entries_office_pair
    ON tracking.routing_entries (city_id, from_office_id, to_office_id, created_at DESC);
-- [Phase 2] [Inference — routing analytics are a Phase 2 Reporting module feature; not needed for Phase 1 procedure set]

-- Actor filter: Audit queries routing entries by actor.
CREATE INDEX idx_routing_entries_actor_id
    ON tracking.routing_entries (actor_id, created_at DESC);
-- [Phase 1] [Confirmed — E1 audit.listOwnActions routing-entry event category]
```

---

## Part 6 — Schema `records`

The records schema is a Phase 2 module delivery per B2 Module 6. Its tables are structurally reserved in Phase 1 (they are in C1's eight-schema list) but are not yet populated by ordinary document flow in Phase 1. The Phase 1 index set is therefore minimal — only the columns that the four Phase 1 `recordsRouter` procedures query directly.

### 6.1 `records.retention_schedules`

```sql
-- Document type lookup: getRetentionSchedule() resolves by document_type_id.
CREATE INDEX idx_retention_schedules_doctype
    ON records.retention_schedules (city_id, document_type_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Records.getRetentionSchedule() Published API; E1 records.getRetentionSchedule]
```

### 6.2 `records.records`

```sql
-- Document back-reference: isUnderLegalHold() and applyRetentionSchedule() join by document_id.
CREATE INDEX idx_records_document_id
    ON records.records (document_id)
    WHERE deleted_at IS NULL;
-- [Phase 1] [Confirmed — B2 Records.isUnderLegalHold() Published API; E1 records.placeLegalHold]

-- Legal hold filter: disposition checks poll for records with legal_hold = true.
CREATE INDEX idx_records_legal_hold
    ON records.records (city_id, legal_hold)
    WHERE legal_hold = true AND deleted_at IS NULL;
-- [Phase 1] [Confirmed — E1 records.placeLegalHold / isUnderLegalHold; consolidated reference Part 11.7]

-- Retention schedule join: archive batch operations filter by retention_schedule_id.
CREATE INDEX idx_records_retention_schedule
    ON records.records (city_id, retention_schedule_id, review_due_date ASC)
    WHERE deleted_at IS NULL;
-- [Phase 2] [Confirmed — RMS bulk archive and disposition procedures (Phase 2); not needed for Phase 1 subset]
```

---

## Part 7 — Schema `notifications`

The notifications schema has a moderate read load (inbox polling, preference checks) and a high write load (every workflow event emits at least one notification). Delivery log reads are infrequent admin-only actions.

### 7.1 `notifications.notification_events`

```sql
-- User inbox: listMine() reads unread notifications for a user, ordered by recency.
CREATE INDEX idx_notification_events_recipient_unread
    ON notifications.notification_events (recipient_user_id, created_at DESC)
    WHERE is_read = false;
-- [Phase 1] [Confirmed — E1 notifications.listMine unreadOnly=true path]

-- Full inbox (read + unread): listMine() also lists all notifications when unreadOnly=false.
CREATE INDEX idx_notification_events_recipient_all
    ON notifications.notification_events (recipient_user_id, created_at DESC);
-- [Phase 1] [Confirmed — E1 notifications.listMine default path]

-- Related document filter: notifications linked to a specific document are surfaced on
-- the document detail screen.
CREATE INDEX idx_notification_events_related_document
    ON notifications.notification_events (related_document_id, created_at DESC)
    WHERE related_document_id IS NOT NULL;
-- [Phase 1] [Confirmed — E1 notifications.listMine relatedDocumentId output field]
```

### 7.2 `notifications.delivery_log`

This table is append-only (no `updated_at` per C1 §1.4).

```sql
-- Admin delivery log view: listDeliveryLogs() reads across all recipients, filtered by date range.
CREATE INDEX idx_delivery_log_city_sent_desc
    ON notifications.delivery_log (city_id, sent_at DESC);
-- [Phase 1] [Confirmed — E1 notifications.listDeliveryLogs; admin delivery diagnostics]

-- Recipient filter: per-user delivery history for troubleshooting.
CREATE INDEX idx_delivery_log_recipient
    ON notifications.delivery_log (recipient_user_id, sent_at DESC)
    WHERE recipient_user_id IS NOT NULL;
-- [Phase 1] [Inference — admin troubleshooting: "why didn't user X receive notification Y"]

-- Status filter: failed delivery retries are polled by status='failed'.
CREATE INDEX idx_delivery_log_status_failed
    ON notifications.delivery_log (city_id, sent_at ASC)
    WHERE status = 'failed';
-- [Phase 1] [Inference — notification retry worker polls for failed deliveries]
```

---

## Part 8 — Schema `audit`

The audit schema is append-only at the DB permission level (INSERT-only for `audit_user`; C1 §0.2, §9). Its single table `audit.events` has no `updated_at` and no practical soft-delete (the `deleted_at`/`deleted_by` columns exist for schema-wide tooling consistency but are structurally inert — C1 §1.5 explicit exception). All indexes are therefore on write-once data and must optimize for read patterns only.

The audit schema is accessed through a separate `audit_user` DB connection; these indexes will be used primarily by `SELECT` queries from the Audit module's read service, which is called by `auditRouter` procedures and by the monthly chain-validation job.

### 8.1 `audit.events`

```sql
-- Actor filter: listOwnActions() and listOwnOfficeDocumentActions() both filter by actor_id.
-- This is the most common audit query — every user can view their own action history.
CREATE INDEX idx_audit_events_actor_id
    ON audit.events (actor_id, occurred_at DESC);
-- [Phase 1] [Confirmed — E1 audit.listOwnActions; I1 §8.2]

-- Resource office filter: listOwnOfficeDocumentActions() filters by the denormalized
-- resource_office_id column (I1 D-ABAC-04 — written at event time, never a live join).
CREATE INDEX idx_audit_events_resource_office
    ON audit.events (city_id, resource_office_id, occurred_at DESC)
    WHERE resource_office_id IS NOT NULL;
-- [Phase 1] [Confirmed — E1 audit.listOwnOfficeDocumentActions; I1 §8.3 and D-ABAC-04 rationale]

-- Event type filter: exportEvents() and specific audit queries filter by event_type.
CREATE INDEX idx_audit_events_city_type
    ON audit.events (city_id, event_type, occurred_at DESC);
-- [Phase 1] [Confirmed — E1 audit.exportEvents eventTypes filter; I1 §8.6]

-- Full log (Auditor role): listFullLog() reads across all actors and offices, ordered by
-- occurred_at. A city_id + occurred_at DESC index supports the cursor-paginated full scan.
CREATE INDEX idx_audit_events_city_occurred_desc
    ON audit.events (city_id, occurred_at DESC);
-- [Phase 1] [Confirmed — E1 audit.listFullLog; I1 §8.4]

-- Hash chain validation: validateChainIntegrity() walks the chain in insertion order.
-- The chain walk reads events ordered by their sequential chain position; a dedicated
-- index on (city_id, id ASC) supports the forward walk without a full table scan.
CREATE INDEX idx_audit_events_city_id_asc
    ON audit.events (city_id, id ASC);
-- [Phase 1] [Confirmed — E1 audit.validateChainIntegrity; 2-stack-context Audit Log Integrity hash chain]

-- Target resource filter: audit queries for "all events touching document X" filter
-- by target_id.
CREATE INDEX idx_audit_events_target_id
    ON audit.events (target_id, occurred_at DESC)
    WHERE target_id IS NOT NULL;
-- [Phase 1] [Confirmed — E1 audit.listOwnOfficeDocumentActions; audit trail on document detail screen]
```

---

## Part 9 — Phase 2 Index Additions (Deferred)

The following indexes are confirmed as needed by future query patterns but are explicitly deferred to Phase 2 or later. They must not be included in Phase 1 migrations.

| Index | Table | Reason for Deferral |
|---|---|---|
| `idx_routing_entries_office_pair` | `tracking.routing_entries` | Routing analytics are a Phase 2 Reporting module feature; no Phase 1 procedure queries this column pair |
| `idx_records_retention_schedule` | `records.records` | RMS bulk archive and disposition are Phase 2 (B2 Module 6) |
| GIN on `documents.documents (to_tsvector(..., title \|\| ' ' \|\| coalesce(metadata->>'subject','')))` | `documents.documents` | Extended multi-field FTS (title + subject metadata) is superseded by Meilisearch in Phase 2; a combined GIN in Phase 1 would duplicate maintenance cost for marginal gain |
| Meilisearch sync column indexes (e.g., `last_indexed_at` on documents/versions) | `documents`, `search_meta` | Belong to the `search_meta` schema (Phase 2) and the Meilisearch sync job; not relevant until that infra is provisioned |
| `idx_records_records_classification` | `records.records` | Classification-based records retrieval is a Phase 2 RMS feature |
| Reporting aggregation indexes (e.g., monthly document-type counts) | Multiple | Phase 2 Reporting module (B2 Module 11); materialized views or covering indexes will be designed with the reporting schema DDL |
| Portal schema indexes | `portal.*` | Phase 3; portal schema DDL not yet baselined |

---

## Part 10 — Drizzle ORM Implementation Notes

These are conventions for translating the indexes in this document into Drizzle schema files at `/packages/database`. They are not DDL themselves but are required reading before any migration file is written.

**1. Index naming.** All indexes follow the `idx_{table}_{columns_abbreviated}` convention used throughout this document. Drizzle's `index()` function accepts an explicit name parameter — always supply one matching this convention rather than relying on auto-generation, so that a future `ALTER INDEX ... RENAME` (or a C5-compliant migration that drops and recreates an index) has a stable name to reference.

**2. Partial index syntax.** Drizzle supports partial indexes via `.where(sql\`...\`)`. Every `WHERE deleted_at IS NULL` partial index in this document should be expressed using this mechanism rather than as a full index, to keep the index size proportional to live-row volume. Example:

```typescript
// In /packages/database/src/schema/documents.ts
export const documentsOfficeStateIdx = index('idx_documents_office_state')
  .on(documents.cityId, documents.ownedByOfficeId, documents.lifecycleState)
  .where(sql`deleted_at IS NULL`);
```

**3. GIN indexes.** Drizzle does not yet have a first-class `USING GIN` fluent API for JSONB or tsvector columns. These must be expressed as raw SQL in a custom migration file rather than inferred from the schema file. The convention for Phase 1 is to place raw-SQL index migrations in `/packages/database/migrations/` as separate numbered files immediately following the table-creation migration, named `{NNN}_gin_indexes.sql`, so they are identifiable as a distinct concern from structural DDL.

**4. Migration ordering.** Per C5 conventions (forthcoming), every index in Part 1–8 of this document must appear in the Phase 1 initial migration set. Indexes flagged `[Phase 2]` in Part 9 must not appear in any migration file until the Phase 2 milestone branch is opened.

**5. `CONCURRENTLY` in production.** For tables with existing data (during migration from LMITS historical records, Part 7.5 of the consolidated reference), large indexes should be created with `CREATE INDEX CONCURRENTLY` to avoid full table locks. Drizzle Kit does not emit `CONCURRENTLY` automatically — this must be added as a post-generation edit to the migration SQL before applying to production. The migration linting step in C5 should flag any `CREATE INDEX` (without `CONCURRENTLY`) on a table that is already known to hold data.

---

## Part 11 — Index Maintenance Considerations

**Bloat.** The `documents.documents` and `workflow.step_instances` tables have the highest write rates. GIN indexes on JSONB columns accumulate pending-list bloat under heavy insert load. The pgboss maintenance schedule should include a monthly `REINDEX CONCURRENTLY` on `idx_documents_metadata_gin` and `idx_versions_ocr_text_fts` during off-peak hours (weekend nights), not blocking application traffic.

**Partial index drift.** Partial indexes scoped to `WHERE deleted_at IS NULL` become less selective as the soft-deleted row fraction grows over time. The DBA should monitor `pg_stat_user_indexes` quarterly and consider converting to a full index if the live-row fraction drops below 60% of total rows on any table — this would indicate that the partial condition is no longer providing meaningful index size savings.

**FTS index vs. Meilisearch handoff (Phase 2).** When Meilisearch is provisioned in Phase 2, the `idx_documents_title_fts` and `idx_versions_ocr_text_fts` GIN indexes will continue to exist and will continue to be maintained by PostgreSQL. They are not dropped at Phase 2 — the Meilisearch layer handles citizen-facing public portal search and typo-tolerant internal search; the PostgreSQL FTS indexes remain for audit-trail queries and any authenticated internal search path that requires exact consistency with the source-of-truth data (Meilisearch has eventual consistency by design). This dual-path is explicitly the design per the 2-stack-context search strategy: "Design the search interface as an abstraction layer so the underlying provider is swappable without touching call sites."

---

*This document is the C4 deliverable against the stated prerequisite chain (C1 → C4). Every index defined here must correspond to a named `CREATE INDEX` statement in a Drizzle migration file. Any index added during development that is not listed here must be documented in a C4 addendum and reviewed before merging, consistent with the change-discipline stated in 2-stack-context.md Migration Rules.*
