# C5. Migration Strategy and Conventions

**Status:** Pre-Development Baseline | Internal Developer Reference **Applies to:** `/packages/database` — Drizzle ORM schema + Drizzle Kit migrations **Last Updated:** June 2026 **Source authority:** `tech-stack.md` (Migration Rules section) and the Consolidated Architecture & Requirements Reference (Iteration 3), Parts 11.9 and 12.

## Table of Contents

- [L37–L45] Label Convention Used in This Document — Definition of document tags distinguishing source-derived rules from logical inferences.
- [L46–L66] 1. Confirmed Rules from Source Documents — A summary table of database rules and constraints mandated by the project's source documents.
- [L67–L122] 2. Drizzle Kit Migration Workflow — Directory structure, generate/apply commands, and psql execution requirements for Drizzle Kit.
- [L123–L175] 3. Migration File Naming Conventions — Format, schema scopes, and rules for naming and scoping individual migration files.
- [L176–L217] 4. Pre-Apply Review Checklist — Mandatory checklists verifying schema correctness, invariant compliance, performance, and executability before deploying migrations.
- [L218–L329] 5. Breaking Migrations and Zero-Downtime Handling — Strategies for implementing database schema changes without causing application errors or service downtime.
  - [L220–L241] 5.1 What Constitutes a Breaking Migration — Classification table of common SQL operations as breaking or non-breaking.
  - [L242–L245] 5.2 The Default: Non-Breaking Additive Changes — Recommendation to prioritize additive schema modifications to simplify application deployment order.
  - [L246–L283] 5.3 The Expand-Contract Pattern for Breaking Changes — Three-phase database and application deployment sequence for safely executing breaking changes.
  - [L284–L298] 5.4 Index Creation on Existing Tables — Requirement to use CONCURRENTLY for indexes on populated tables and manage transaction blocks.
  - [L299–L321] 5.5 Adding NOT NULL to Existing Columns — Safe multi-step process for adding NOT NULL constraints using CHECK constraints and validation.
  - [L322–L329] 5.6 Transition Period Code Policy — Code review rule requiring dual-write code removal in the same PR as the contract migration.
- [L330–L362] 6. The Production Prohibition on Reset-and-Regenerate — Absolute prohibition of database resets in persistent environments, including environment-specific rules and recovery alternatives.
- [L363–L494] 7. Automated Linting Rules — Invariant Enforcement — CI pipeline rules enforcing schema invariants on all database migrations.
  - [L375–L388] 7.1 Implementation — Technical implementation details, script location, parser, and execution commands for the migration linter.
  - [L389–L409] 7.2 Rule: No Cross-Schema Foreign Keys (Invariant #1) — Linter rules and error output format preventing foreign keys across different database schemas.
  - [L410–L443] 7.3 Rule: UUID v4 Primary Keys (Invariant #6) — Linter checks enforcing UUID v4 primary keys and `gen_random_uuid()` defaults, with composite PK exceptions.
  - [L444–L469] 7.4 Rule: TIMESTAMPTZ for All Timestamps (Invariant #7) — Linter rules requiring timezone-aware types for timestamps, warning on DATE, and suppression syntax.
  - [L470–L494] 7.5 Additional Convention Checks — Linter warnings for soft-delete, tenant isolation, destructive actions, and specific suppression syntax requirements.
- [L495–L516] 8. Schema Module Reference — Mapping of PostgreSQL schemas to application modules and their planned implementation phases.
- [L517–L582] 9. Migration Application Procedure — Step-by-step procedures for applying and verifying migrations in local, staging, and production environments.
- [L583–L615] 10. Rollback — Reversal protocols via forward-revert migrations or database backups, and the append-only rule for migration history.
- [L616–L632] Appendix A — Quick Reference: Linting Rules — Quick reference table summarizing all migration linter rules, severities, and trigger conditions.
- [L633–L646] Appendix B — Confirmed Database Conventions Summary — Summary reference of core database structural and security conventions required for all tables.
- [L647–L661] Addendum — Migration-Owning Role Name — Role definition, schema ownership scope, and cross-document consistency requirements for the DDL-owning PostgreSQL role.

---

---

## Label Convention Used in This Document

| Label        | Meaning                                                                   |
| ------------ | ------------------------------------------------------------------------- |
| _(no label)_ | Directly stated in or directly derived from the source documents.         |
| [Inference]  | Logically reasoned from confirmed facts. Not explicitly stated in source. |

---

## 1. Confirmed Rules from Source Documents

The following rules are stated verbatim or unambiguously in `tech-stack.md` and the Consolidated Architecture Reference. They are not subject to interpretation or project decision — they are in effect from the first migration.

|Rule|Source|
|---|---|
|Every schema change produces a migration file committed to version control.|`tech-stack.md` — Migration Rules|
|Drizzle Kit generates SQL migrations from schema diffs. Review the SQL before applying.|`tech-stack.md` — Migration Rules|
|Never use reset-and-regenerate in production.|`tech-stack.md` — Migration Rules|
|Migrations must be readable, reviewable, and executable directly by `psql` if needed.|`tech-stack.md` — Migration Rules|
|No cross-schema foreign key constraints. Enforced by automated migration linting and code review policy.|Invariant #1|
|UUID v4 primary keys everywhere. Enforced by migration linting.|Invariant #6|
|TIMESTAMPTZ on every timestamp column. Enforced by migration linting.|Invariant #7|
|Soft-delete: `deleted_at TIMESTAMPTZ` + `deleted_by UUID` on every table. No hard deletes.|Part 11.9|
|`city_id UUID NOT NULL` in all core entity tables.|Part 11.9|
|`audit` schema: `INSERT`-only at DB role level. `UPDATE` and `DELETE` revoked from the application DB user. Enforced by PostgreSQL role permissions set in migration.|Invariant #3|
|One active designation per person. Enforced by DB partial unique index on active `delegation_grants` per user.|Invariant #16|
|No module reads another module's schema directly. No cross-schema foreign key constraints.|Part 10.2|

---

## 2. Drizzle Kit Migration Workflow

### 2.1 Schema Files Live in `/packages/database`

All Drizzle schema definitions live under `/packages/database/schema/`, organized by module schema. Drizzle Kit configuration lives at `/packages/database/drizzle.config.ts`. Migration output files go to `/packages/database/migrations/`.

Do not hand-edit Drizzle Kit's snapshot files (the `drizzle/` meta directory). Drizzle Kit manages these to track applied state. Manual edits corrupt the diff engine and produce incorrect future migrations.

### 2.2 Generating a Migration

Schema changes always begin with editing the Drizzle schema files. After editing:

```bash
# From monorepo root (via Turborepo):
pnpm --filter @batac/database db:generate

# Or directly from /packages/database:
pnpm drizzle-kit generate
```

Drizzle Kit diffs the current schema files against the last snapshot and produces a new `.sql` file in `/packages/database/migrations/`.

**Never write a migration SQL file by hand** unless correcting a generated file before it has been applied anywhere (see Section 4.3 on `CONCURRENTLY`). Hand-authored migration files that were not produced by Drizzle Kit must be clearly marked with a comment at the top of the file stating they were manually authored and the reason.

### 2.3 Applying a Migration

```bash
# Apply pending migrations to the target database:
pnpm --filter @batac/database db:migrate
```

Drizzle Kit tracks applied migrations in the `drizzle.__drizzle_migrations` table. Before applying to any non-local environment, the pre-apply review checklist in Section 3 must be completed.

To verify which migrations have been applied:

```sql
SELECT id, hash, created_at
FROM drizzle.__drizzle_migrations
ORDER BY created_at DESC
LIMIT 10;
```

### 2.4 The psql Executability Requirement

The confirmed rule is: _"Migrations must be readable, reviewable, and executable directly by `psql` if needed."_

This means:

- No `\copy`, `\i`, or other `psql` meta-commands that only work in interactive `psql` sessions.
- No JavaScript or TypeScript logic embedded in the SQL. SQL migrations are plain SQL only.
- The file must run cleanly when piped as: `psql $DATABASE_URL -f migrations/{file}.sql`

Data migration scripts that require application logic (loops, conditional backfills, etc.) are separate TypeScript scripts in `/tools/scripts/`, reviewed and run independently. They are not Drizzle Kit migration files.

---

## 3. Migration File Naming Conventions

Drizzle Kit assigns a sequential numeric prefix automatically. The project adds a structured naming convention on top of the auto-generated prefix.

### 3.1 Format

```
{NNNN}_{scope}_{description}.sql
```

|Component|Rule|
|---|---|
|`{NNNN}`|Four-digit zero-padded sequence number assigned by Drizzle Kit. Never manually assigned, reassigned, or reordered.|
|`{scope}`|Lowercase name of the PostgreSQL schema primarily affected. Valid values: `core`, `iam`, `organization`, `documents`, `workflow`, `tracking`, `records`, `notifications`, `audit`, `search_meta`, `portal`, `reporting`. Use `core` for migrations that create shared infrastructure: PostgreSQL extensions, DB roles, schema namespaces, or shared types.|
|`{description}`|Snake-case, imperative mood, 40 characters or fewer. Describes what the migration does, not why it was needed.|

### 3.2 Examples

```
0001_core_create_schemas_and_extensions.sql
0002_core_create_db_roles_and_grants.sql
0003_iam_create_users_credentials_sessions.sql
0004_organization_create_offices_and_positions.sql
0005_organization_create_delegations.sql
0018_workflow_add_multi_referral_step_type.sql
0025_documents_add_preliminary_number_column.sql
0031_tracking_add_qr_codes_table.sql
0047_audit_revoke_update_delete_from_app_role.sql
```

### 3.3 Anti-Patterns

```
# Too vague — does not describe the change:
0026_update_documents.sql

# Describes intent, not action:
0027_fix_delegation_concurrency_bug.sql

# Spans multiple unrelated schemas — split into two files:
0028_users_and_offices.sql
```

### 3.4 Migrations That Span Multiple Schemas

[Inference] If a migration genuinely touches two schemas as part of one atomic logical change — for example, creating a new schema namespace and its first table together — use the schema that owns the primary structural change as `{scope}`. Add a comment block at the top of the SQL file listing all affected schemas. In most cases, spanning multiple schemas in one file signals that the change should be split into sequential migrations, applied in order. Prefer splitting unless a transactional dependency requires atomicity.

### 3.5 One Logical Change Per File

[Inference] Each migration file is the unit of review, rollback analysis, and blame history. Bundle only changes that belong to the same logical feature or constraint. Acceptable in one file: creating a table and all its indexes; adding a column and the constraint that governs it; creating a new schema namespace and granting permissions on it. Not acceptable in one file: unrelated structural changes to two different features; application-logic trigger functions bundled with table creation.

---

## 4. Pre-Apply Review Checklist

The confirmed rule is: _"Review the SQL before applying."_ This checklist formalizes what that review covers.

Every migration file must pass this checklist before application to **any** persistent environment — local development against a seeded database, staging, or production. For staging and production, the checklist is completed by the author and confirmed by a second developer before the deployment pipeline is triggered.

### 4.1 Correctness

- [ ] The generated SQL matches the intent of the Drizzle schema change. Manually diff the schema file change against the SQL output.
- [ ] The SQL runs without error against a local environment from a clean migration state (apply all migrations from `0001` in order and confirm the target migration completes).
- [ ] No interactive prompts, variable substitution syntax, or assumptions about prior session state are present in the SQL.

### 4.2 Invariant Compliance

Automated linting catches these (see Section 6), but human review is still required as a second line:

- [ ] **Invariant #1 — No cross-schema foreign keys.** Scan for `REFERENCES {schema}.{table}` where `{schema}` differs from the schema of the table being defined or altered. No such reference is permitted.
- [ ] **Invariant #6 — UUID v4 primary keys.** Every new table has a primary key defined as `UUID NOT NULL DEFAULT gen_random_uuid()`. No `SERIAL`, `BIGSERIAL`, `INT`, or integer-type primary key exists in the file.
- [ ] **Invariant #7 — TIMESTAMPTZ.** Every new timestamp column uses `TIMESTAMPTZ`. No `TIMESTAMP`, `TIMESTAMP WITHOUT TIME ZONE`, or `DATE` column exists in the file for a column that represents a point in time.
- [ ] **Soft-delete.** Every new entity table includes `deleted_at TIMESTAMPTZ` and `deleted_by UUID`. No `ON DELETE CASCADE` or `ON DELETE SET NULL` is applied to an entity table's primary relationship. Cascades on junction tables are acceptable.
- [ ] **Tenant isolation.** Every new core entity table includes `city_id UUID NOT NULL`. If a table is intentionally system-global (e.g., an internal lookup table not scoped to a city), a comment in the migration explains why `city_id` is absent.
- [ ] **Audit schema grants.** If this migration touches the `audit` schema or any DB role grants: confirm no `UPDATE` or `DELETE` privilege is granted on `audit.events` to the application role.

### 4.3 Performance and Blocking

- [ ] Any `CREATE INDEX` on an existing populated table has been manually changed to `CREATE INDEX CONCURRENTLY` before applying to staging or production. (See Section 5.4.)
- [ ] Any `ADD COLUMN ... NOT NULL` on an existing table: confirm the column has a constant `DEFAULT` value so PostgreSQL 11+ uses a catalog default and avoids a full table rewrite, or that the table is genuinely empty at the point this migration runs.
- [ ] Any `ALTER COLUMN ... TYPE` on an existing table: confirm no table rewrite is triggered, or that the migration uses an expand-contract sequence (see Section 5.3).
- [ ] Any new foreign key on an existing large table: confirm a corresponding index exists on the referencing column.

### 4.4 Destructive Operation Classification

- [ ] Identify whether this migration contains any destructive operation: `DROP TABLE`, `DROP COLUMN`, `DROP SCHEMA`, `ALTER COLUMN ... TYPE` on a non-empty column, `RENAME TABLE`, `RENAME COLUMN`, or `ALTER COLUMN ... SET NOT NULL` on a populated column without a prior backfill.
- [ ] If yes: is the expand-contract protocol (Section 5.3) in place? If not, the migration must not proceed until it is.

### 4.5 psql Executability

- [ ] The SQL file runs cleanly when piped as `psql $DATABASE_URL -f {file}.sql` with no interactive prompts and no dependency on session variables.
- [ ] No `\copy`, `\i`, `\set`, or other `psql` meta-commands are present.

---

## 5. Breaking Migrations and Zero-Downtime Handling

### 5.1 What Constitutes a Breaking Migration

A **breaking migration** is one that, when applied to a running database while the application serves traffic, causes the current application code to produce errors or incorrect results.

|Operation|Breaking?|Notes|
|---|---|---|
|`CREATE TABLE`|No|Additive; existing code is unaffected.|
|`CREATE SCHEMA`|No|Additive.|
|`ADD COLUMN` with nullable or constant `DEFAULT`|No|PostgreSQL 11+ uses a catalog default for constant expressions; no table rewrite.|
|`ADD COLUMN ... NOT NULL` without default|**Yes**|Every existing row fails the constraint immediately.|
|`CREATE INDEX CONCURRENTLY`|No|Non-blocking; safe during traffic.|
|`CREATE INDEX` (without `CONCURRENTLY`)|**Yes**|Takes `ShareLock`; blocks writes for the entire index build duration.|
|`DROP COLUMN`|**Yes**|Any code referencing the column fails immediately.|
|`DROP TABLE`|**Yes**|Any code referencing the table fails immediately.|
|`RENAME TABLE`|**Yes**|The old name no longer resolves.|
|`RENAME COLUMN`|**Yes**|The old name no longer resolves.|
|`ALTER COLUMN ... TYPE`|**Yes**|May rewrite the table; type cast errors at runtime on incompatible values.|
|`ALTER COLUMN ... SET NOT NULL` on a populated column|**Yes**|Fails immediately if any row has `NULL`; acquires `AccessExclusiveLock` on scan.|
|`ADD FOREIGN KEY` without `NOT VALID`|[Inference] Potentially blocking|Validates all existing rows; takes `ShareRowExclusiveLock`. Prefer `NOT VALID` + deferred `VALIDATE CONSTRAINT`.|
|`DROP CONSTRAINT`|No|Additive in effect; loosens a restriction.|
|`GRANT` / `REVOKE`|No|Takes effect for new connections only.|

### 5.2 The Default: Non-Breaking Additive Changes

Prefer additive schema changes wherever possible. Add new columns, new tables, and new indexes rather than modifying or removing existing structures. The application code for the new structure can deploy before or after the migration with no breakage window.

### 5.3 The Expand-Contract Pattern for Breaking Changes

[Inference — industry-standard PostgreSQL practice, applied to this project's deployment model]

When a breaking structural change is unavoidable (renaming a column, changing a type, dropping a column), use a three-phase sequence across two deployment cycles rather than a single migration. The running application and the database schema are never simultaneously incompatible.

**Phase 1 — Expand (migration deployed before the new application code):**

Add the new structure alongside the old. The current running application continues using the old structure without modification.

**Phase 2 — Transition (application code updated to use the new structure):**

The new application code is deployed. It writes to both old and new structures during this period. If a backfill is required, it runs as a separate data migration script in `/tools/scripts/` — not as a Drizzle Kit migration file, since it may need to run in batches on large tables.

**Phase 3 — Contract (migration deployed after the application is stable on the new structure):**

The old structure is removed. At this point, no running code references it.

**Concrete example — renaming a column in `documents.documents`:**

```sql
-- EXPAND migration (deploy before code change):
ALTER TABLE documents.documents
  ADD COLUMN final_number TEXT;

UPDATE documents.documents
  SET final_number = series_number
  WHERE final_number IS NULL;
```

```sql
-- CONTRACT migration (deploy after code is stable on final_number):
ALTER TABLE documents.documents
  DROP COLUMN series_number;
```

During the transition period, the application writes to both `series_number` and `final_number`. After the contract migration, only `final_number` exists. The transition-period dual-write code is removed as part of the contract deployment — leaving it in the codebase permanently is a code debt violation.

### 5.4 Index Creation on Existing Tables

Never use `CREATE INDEX` (without `CONCURRENTLY`) in a migration that will be applied while the database serves traffic. `CREATE INDEX` acquires a `ShareLock` that blocks all writes for the duration of the index build.

Drizzle Kit may emit `CREATE INDEX` without `CONCURRENTLY`. When a migration file contains `CREATE INDEX` on an existing table, manually edit the SQL file to add `CONCURRENTLY` before applying to staging or production. Add a comment noting the manual edit:

```sql
-- NOTE: CONCURRENTLY added manually before applying to staging/production.
-- Drizzle Kit does not emit CONCURRENTLY; required for non-blocking application.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_series_year
  ON documents.documents (number_series_id, year);
```

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. If the Drizzle Kit migration runner wraps migrations in a `BEGIN` / `COMMIT`, the index creation must be split into its own migration file and applied without transaction wrapping. Confirm the migration runner's transaction behavior before applying any `CONCURRENTLY` migration.

### 5.5 Adding NOT NULL to Existing Columns

[Inference — standard PostgreSQL practice for non-blocking constraint addition]

Do not add `NOT NULL` directly to an existing column on a table that has rows. PostgreSQL performs a full table scan to validate, and in most versions acquires `AccessExclusiveLock` for the duration.

Safe sequence for adding a `NOT NULL` constraint to an existing column:

```sql
-- Step 1: Backfill any NULLs (in a data migration script, not here):
UPDATE schema.table SET column = 'default_value' WHERE column IS NULL;

-- Step 2: Add the constraint as NOT VALID (skips existing row scan):
ALTER TABLE schema.table
  ADD CONSTRAINT chk_column_not_null CHECK (column IS NOT NULL) NOT VALID;

-- Step 3: In a later migration or maintenance window, validate:
-- VALIDATE CONSTRAINT uses ShareUpdateExclusiveLock — non-blocking for reads and writes.
ALTER TABLE schema.table VALIDATE CONSTRAINT chk_column_not_null;
```

Steps 2 and 3 may be in separate migration files if the table is large and validation time is uncertain.

### 5.6 Transition Period Code Policy

[Inference]

Application code written to support a transition period (writing to both old and new columns, reading from either, etc.) must be removed as part of the same PR that contains the contract migration. Transition shims left in the codebase after the contract migration are a code review failure.

---

## 6. The Production Prohibition on Reset-and-Regenerate

**Confirmed rule (from `tech-stack.md`):** _"Never use reset-and-regenerate in production."_

### 6.1 What Reset-and-Regenerate Means

Drizzle Kit provides schema reset and drop operations that destroy all tables and recreate them from the current schema. These are useful for fast local iteration during early development.

In any environment with persistent data, these operations are prohibited.

### 6.2 Why This Is Absolute

- **Data loss is total and immediate.** Every row in every table — audit log, document records, workflow state, user accounts, tracking history — is destroyed.
- **There is no recovery path without a backup restore.** The operation cannot be reversed by re-running migrations. Rows do not exist to restore.
- **It destroys the migration history.** The sequence of migration files from `0001` forward is the authoritative record of how the schema reached its current state. A reset followed by a schema recreate from current state obliterates that chain.
- **It violates the no-hard-delete constraint.** Invariant #2 prohibits hard deletes at the application layer. A schema reset is a mass structural delete executed at the database level, bypassing every application-level and repository-layer safeguard.

### 6.3 Environment Policy

|Environment|Status|
|---|---|
|Production|**Prohibited. No exceptions.**|
|Staging with production-representative data|**Prohibited.**|
|Staging with synthetic/seeded data only|[Inference] Prohibited by policy for consistency. Use a fresh database with all migrations applied from `0001` instead.|
|Developer local environment|Permitted. The developer accepts that their local migration state resets and all migrations must be reapplied from `0001`.|
|CI ephemeral test database|Permitted. The database is discarded after the run.|

### 6.4 The Correct Alternative

If a non-production environment must be rebuilt from a known state, create a new empty database and apply all migrations from `0001` forward in sequence, or restore from a backup taken immediately after a known-good migration applied. Do not use Drizzle Kit's reset command in either case.

---

## 7. Automated Linting Rules — Invariant Enforcement

Three invariants are explicitly designated for automated migration linting in the source documents:

|Invariant|Designated enforcement|
|---|---|
|#1 — No cross-schema foreign keys|"Automated migration linting; code review policy"|
|#6 — UUID v4 primary keys everywhere|"Migration linting"|
|#7 — TIMESTAMPTZ for all timestamps|"Migration linting"|

The linter runs as a Turborepo task (`db:lint`) in CI on every pull request that touches `/packages/database/`. It must pass before the `build` task runs. A failed linter blocks merge.

### 7.1 Implementation

[Inference — the source documents designate these rules for automated linting but do not specify the implementation. The following is a designed approach consistent with the confirmed stack and constraints.]

The migration linter is a TypeScript script at `/tools/scripts/lint-migrations.ts`. It parses each SQL file in `/packages/database/migrations/` using a PostgreSQL-dialect SQL parser and applies the rules below. The specific parser library is chosen at implementation time based on maintenance status and PostgreSQL dialect coverage — `pgsql-ast-parser` is a candidate. The linter must not introduce a dependency on any external service; it runs entirely in the local and CI Node.js process.

The linter is invoked via:

```bash
pnpm --filter @batac/scripts lint:migrations
```

and as a Turborepo task that depends on the database package's schema having no TypeScript errors.

### 7.2 Rule: No Cross-Schema Foreign Keys (Invariant #1)

**Trigger:** Any `REFERENCES {schema}.{table}` in a `CREATE TABLE` or `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` statement where `{schema}` differs from the schema of the table being defined or altered.

**Severity:** FAIL — blocks merge.

**Output:**

```
[INVARIANT-01] Cross-schema foreign key detected.
  File: 0042_documents_add_version_ref.sql
  Line 17: REFERENCES iam.users(id)
  Tables in schema 'documents' may not reference tables in schema 'iam'.
  Cross-schema relationships must be resolved at the application layer:
  store the UUID and resolve in code, or communicate via the event bus.
```

**What is permitted:** `REFERENCES` within the same schema (e.g., `documents.documents` referencing `documents.number_series`).

**Intentional UUID cross-references:** The `audit.events` table stores `actor_id` and `entity_id` as plain `UUID` columns with no foreign key constraint by design. Because there is no `REFERENCES` clause, the linter produces no output for these columns. No special handling is required.

### 7.3 Rule: UUID v4 Primary Keys (Invariant #6)

**Trigger:** Any `CREATE TABLE` statement that defines a primary key column using a type other than `UUID`, or defines a `UUID` primary key without `DEFAULT gen_random_uuid()`.

**Severity:** FAIL — blocks merge.

**Pass conditions:**

```sql
-- Correct:
id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
```

**Fail conditions and output:**

```
[INVARIANT-06] Non-UUID primary key detected.
  File: 0019_records_create_archive_entries.sql
  Line 8: id SERIAL PRIMARY KEY
  All primary keys must be UUID v4: id UUID NOT NULL DEFAULT gen_random_uuid()

[INVARIANT-06] UUID primary key missing gen_random_uuid() default.
  File: 0033_notifications_create_templates.sql
  Line 6: id UUID PRIMARY KEY
  UUID primary keys must carry DEFAULT gen_random_uuid().
```

**Composite primary keys on junction tables:** [Inference] Junction tables (pure many-to-many associations with no independent identity) may use a composite primary key of two or more `UUID` foreign key columns rather than a synthetic UUID primary key. The linter recognizes composite PKs where all component columns are `UUID` type and does not flag them.

**Document series sequences:** PostgreSQL sequences in `/packages/database/schema/` produce the `{NN}` counter used in document number formats (e.g., `SPR 2026-01`). These sequences do not produce primary keys. The linter must not flag sequence-derived columns that are not primary keys.

**`uuid_generate_v4()` vs `gen_random_uuid()`:** The linter flags `DEFAULT uuid_generate_v4()` with a warning, not a hard failure, because the functional output is equivalent. However, `gen_random_uuid()` is the project standard because it is built into PostgreSQL 13+ without requiring the `uuid-ossp` extension. The `uuid-ossp` extension should not be added as a dependency.

### 7.4 Rule: TIMESTAMPTZ for All Timestamps (Invariant #7)

**Trigger:** Any column definition in a `CREATE TABLE` or `ALTER TABLE ... ADD COLUMN` statement where the column name follows a common timestamp naming pattern and the type is not `TIMESTAMPTZ` or `TIMESTAMP WITH TIME ZONE`.

**Common timestamp column name patterns checked:** column name ends with `_at`, `_on`, `_timestamp`; or column name starts with or contains `created`, `updated`, `deleted`, `expires`, `sent`, `received`, `approved`, `signed`, `submitted`, `logged`, `transmitted`, `published`.

**Severity:** FAIL for `TIMESTAMP` or `TIMESTAMP WITHOUT TIME ZONE`. WARN for `DATE` (see below).

**Output:**

```
[INVARIANT-07] Non-timezone-aware timestamp column detected.
  File: 0031_notifications_create_delivery_log.sql
  Line 22: sent_at TIMESTAMP NOT NULL
  All timestamp columns must use TIMESTAMPTZ (TIMESTAMP WITH TIME ZONE).
```

**DATE columns:** [Inference] `DATE` (year/month/day only) may be legitimate for fields where the time component is meaningless — for example, `publication_date` on an ordinance that records only the date a penalty ordinance was published in a newspaper. The linter emits a WARN rather than a FAIL for `DATE` columns, and requires a suppression comment to pass cleanly:

```sql
-- linter: allow-date reason="Publication date is calendar-day only; no time component."
publication_date DATE,
```

Every `allow-date` suppression requires a reason in the comment and a second developer's approval in code review.

### 7.5 Additional Convention Checks

[Inference — derived from confirmed conventions in Part 11.9 of the Consolidated Architecture Reference]

The linter also checks the following conventions. These supplement the three invariant rules above.

|Check|Severity|Trigger|
|---|---|---|
|Missing soft-delete columns|WARN|`CREATE TABLE` without both `deleted_at TIMESTAMPTZ` and `deleted_by UUID`.|
|Missing `city_id`|WARN|`CREATE TABLE` in a core entity schema (`iam`, `organization`, `documents`, `workflow`, `tracking`, `records`) without `city_id UUID NOT NULL`.|
|`DELETE` DML in migration SQL|FAIL|Any `DELETE FROM` statement in a migration file. Migrations must not contain row-deleting DML.|
|`DROP` without expand-contract comment|WARN|Any `DROP COLUMN`, `DROP TABLE`, or `DROP SCHEMA` without a `-- expand-contract: contract phase` comment confirming the expand phase was completed.|
|`CREATE INDEX` without `CONCURRENTLY` on named table|WARN|`CREATE INDEX` (without `CONCURRENTLY`) where the table name does not match a table that appears in `CREATE TABLE` earlier in the same file, indicating it targets an existing table.|

**Suppressing warnings:** Add a comment immediately before the flagged statement:

```sql
-- linter: skip-soft-delete reason="Append-only junction table; rows are never logically deleted."
-- linter: skip-city-id reason="System-global lookup table; not scoped to a city."
```

Every suppression must include a reason and must be approved by a second developer in code review. Suppressions without a stated reason cause the linter to fail as if the warning were a hard failure.

---

## 8. Schema Module Reference

Each PostgreSQL schema is the exclusive domain of its corresponding module. No migration in one schema may reference another schema via foreign key constraint (Invariant #1). Cross-schema relationships are handled at the application layer or through the internal event bus.

|Schema|Module|First Phase|
|---|---|---|
|`iam`|Identity and Access Management|Phase 1|
|`organization`|Offices, positions, assignments, delegations|Phase 1|
|`documents`|Document types, documents, versions, attachments, numbering, signatures|Phase 1|
|`workflow`|Workflow definitions, versions, steps, instances, events|Phase 1|
|`tracking`|Tracking records, routing entries, QR codes|Phase 1|
|`notifications`|Templates, notification events, delivery log|Phase 1|
|`audit`|Events — append-only; INSERT-only DB permissions|Phase 1|
|`records`|Records, retention schedules, archive entries, dispositions|Phase 2|
|`search_meta`|Search index metadata, index jobs|Phase 2|
|`reporting`|Report definitions, schedules, outputs|Phase 2|
|`portal`|Public documents, citizen requests, complaints, announcements|Phase 3|

**The `core` scope in migration file names** (used in `{scope}` when naming files) refers to migrations that create these schema namespaces, install PostgreSQL extensions, or set up DB roles and grant permissions. `core` is a file naming convention, not a PostgreSQL schema name.

---

## 9. Migration Application Procedure

### 9.1 Local Development

```bash
# 1. Generate the migration from your schema change:
pnpm --filter @batac/database db:generate

# 2. Review the generated SQL file (see Section 3 checklist).

# 3. Run the linter:
pnpm --filter @batac/scripts lint:migrations

# 4. Apply to local database:
pnpm --filter @batac/database db:migrate
```

### 9.2 Staging

Staging migrations run through the deployment pipeline, not manually. If a manual apply is unavoidable (recovery situation), use `psql` directly and log the action:

```bash
psql $STAGING_DATABASE_URL \
  -f packages/database/migrations/{NNNN}_{scope}_{description}.sql
```

After manual apply, record the action in the incident log with the migration filename, timestamp, and the reason the pipeline was bypassed.

### 9.3 Production

Production migrations are applied by the deployment pipeline before the new application code is activated. The sequence is:

1. CI passes (lint + unit + integration tests).
2. Migration reviewed and signed off by a second developer.
3. Staging deployment is confirmed stable with the migration applied.
4. The deployment pipeline applies the migration to the production database.
5. The new application containers start after the migration completes successfully.
6. For expand-contract breaking changes: the expand migration and the contract migration are deployed in separate pipeline runs, with a stable period between them.

Manual production applies are prohibited except in declared incidents. An emergency manual apply requires documented approval and must be logged in the incident record with the migration filename, the timestamp of application, and the name of the person who applied it.

### 9.4 Verifying Application

```sql
-- Confirm the migration is recorded:
SELECT id, hash, created_at
FROM drizzle.__drizzle_migrations
ORDER BY created_at DESC
LIMIT 5;

-- Spot-check the structural change:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = '{schema}'
  AND table_name = '{table}'
ORDER BY ordinal_position;

-- Confirm indexes:
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = '{schema}'
  AND tablename = '{table}';
```

---

## 10. Rollback

### 10.1 Drizzle Kit Has No Automatic Rollback

Drizzle Kit does not generate down migrations. There is no `drizzle-kit rollback` command.

### 10.2 Option A — Write a Forward Revert Migration

[Inference]

Write a new migration file that undoes the schema change. For example, if migration `0045` added a column, migration `0046` drops it. This is the preferred approach for most cases because the migration history remains linear and auditable.

```
0045_documents_add_legacy_ref_column.sql   ← applied; found to be incorrect
0046_documents_drop_legacy_ref_column.sql  ← revert, applied forward
```

The migration history is never edited. `0045` remains in the history as applied. `0046` documents the correction.

### 10.3 Option B — Restore from Backup

If a migration caused severe data integrity corruption and a forward revert migration is not viable, restore the database from the backup taken before the migration was applied.

The confirmed backup strategy provides WAL-based PITR archiving with a 1-hour maximum RPO. A PITR restore to the point immediately before the migration application is technically possible within this window.

A restore triggered by a migration failure must be logged as an incident. The migration file that caused the failure is retained in the repository with a clear comment at the top documenting what went wrong and that it was reverted via restore, not via a forward migration.

### 10.4 The Migration History Is Append-Only

Never delete, rename, or modify a migration file after it has been applied to any persistent environment. The sequence of files from `0001` forward is a historical record. Altering it after the fact produces a state where the recorded migration history no longer matches what was actually applied to the database — a corruption that is difficult to detect and repair.

---

## Appendix A — Quick Reference: Linting Rules

|Rule|Invariant|Severity|Condition|
|---|---|---|---|
|Cross-schema `REFERENCES`|#1|FAIL|`REFERENCES {other_schema}.{table}`|
|Non-UUID primary key|#6|FAIL|PK column typed as `INT`, `BIGINT`, `SERIAL`, `BIGSERIAL`|
|UUID PK without `DEFAULT gen_random_uuid()`|#6|FAIL|`UUID PRIMARY KEY` with no default or non-standard default|
|Non-TIMESTAMPTZ timestamp column|#7|FAIL|Timestamp-named column typed as `TIMESTAMP` / `TIMESTAMP WITHOUT TIME ZONE`|
|`DATE` column (context-dependent)|#7|WARN|Timestamp-named column typed as `DATE`; requires `-- linter: allow-date reason="..."`|
|Missing soft-delete columns|—|WARN|`CREATE TABLE` without `deleted_at TIMESTAMPTZ` + `deleted_by UUID`|
|Missing `city_id`|—|WARN|`CREATE TABLE` in core schema without `city_id UUID NOT NULL`|
|`DELETE` DML in migration SQL|—|FAIL|Any `DELETE FROM` statement in a `.sql` migration file|
|`DROP` without expand-contract comment|—|WARN|`DROP COLUMN` / `DROP TABLE` without `-- expand-contract: contract phase` comment|
|`CREATE INDEX` without `CONCURRENTLY` on existing table|—|WARN|`CREATE INDEX` targeting a table not created in the same file|

---

## Appendix B — Confirmed Database Conventions Summary

These are the conventions every migration must satisfy, drawn directly from Part 11.9 of the Consolidated Architecture Reference.

|Convention|Value|
|---|---|
|Primary keys|`UUID NOT NULL DEFAULT gen_random_uuid()` everywhere|
|Timestamps|`TIMESTAMPTZ` on every timestamp column|
|Soft-delete|`deleted_at TIMESTAMPTZ` + `deleted_by UUID` on every entity table; no hard deletes|
|Tenant isolation|`city_id UUID NOT NULL` in all core entity tables|
|Cross-schema foreign keys|Prohibited. Enforced by automated migration linting.|
|Sequences for document numbering|One PostgreSQL sequence per document series per year; not used for primary keys|
|Audit schema permissions|`INSERT` only; `UPDATE` and `DELETE` revoked from the application DB role, set in migration|

## Addendum — Migration-Owning Role Name

**Role name:** `batac_migrate`

**Definition:** `LOGIN` PostgreSQL role. Owns all DDL operations, owns all Phase 1 schemas, and is the `SECURITY DEFINER` owner of `documents.fn_get_next_sequence_value()`. Runs all migration scripts.

**Source of truth:** First named in C1 §3.16 (`CREATE ROLE batac_migrate LOGIN;`). This document (C5) and L2 did not previously name a migration-owning role; this addendum closes that gap by cross-referencing C1 rather than introducing a second definition.

**Decided by:** Development team (ratifying detail already specified in C1; no alternate name was under consideration).

If this role is ever renamed, the change must be made consistently across:
- C1 §3.16 (`CREATE ROLE` statement and DB roles list)
- C1's `fn_get_next_sequence_value` `OWNER TO` statement
- This document (C5) — migration runner configuration / connection role
- L2 (Docker/Compose environment, if the role name is referenced in any init script or environment variable)
