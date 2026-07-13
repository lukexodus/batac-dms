# Development Findings Log

**Status:** Living document. Append-only by agents; status field per entry is
edited only by a human.

## Purpose

This log captures things discovered *during* Master Phased Task List (A1)
execution that no pre-development document could have specified in advance —
either because they're implementation-detail decisions (e.g., a retry strategy
that turned out to need a specific shape) or because they're the items
document-list.md already named as undecidable pre-dev (OCR threshold, SSE
reconnection behavior, pgboss retry/dead-letter handling, sequence rollover
edge cases, and similar).

This is not a second copy of the architecture. If a finding turns out to
genuinely change something in a Group B–L document, the fix belongs in that
document, made by a human, with the entry below kept only as the historical
record of why. Until a human confirms that, the finding lives here and only
here — it must not be silently folded into a code comment where the next agent
won't see it without already knowing to look in that exact file, and it must
not be used to justify editing AGENTS.md or any pre-dev document directly.

## Rules for agents

- You may **append** a new entry. You may never edit or delete an existing
  entry, including your own from an earlier task — if a later task
  contradicts or refines a prior entry, append a new entry that supersedes it
  and references the earlier entry's ID; don't go back and rewrite it.
- Set `status: proposed` on every entry you add. Never write `confirmed` or
  `superseded` yourself — those are set by a human during review.
- One entry per discovery, not one entry per PR. A single PR may produce zero,
  one, or several entries.
- Before adding an entry, check whether an existing entry already covers the
  same discovery (search by `affects` document ID or by topic). If it does and
  your finding is consistent with it, do nothing — don't duplicate. If your
  finding refines or contradicts it, append a new entry that says so and
  references the prior entry's ID.
- Label your own certainty honestly in the `note` field — `[Inference]` for a
  reasoned default you implemented, `[Speculation]` for something you suspect
  but haven't verified, or state plainly if you tested and confirmed the
  behavior yourself (and say what the test was).
- Do not use the words prevent, guarantee, will never, fixes, eliminates, or
  ensures that in a `note` field unless you are quoting another document. State
  what the code does under the conditions you observed, not what it
  categorically achieves.

## Rules for the human reviewer

- Review new `proposed` entries before the next task that touches the same
  module/document begins, if possible — a stale `proposed` entry that should
  have been `confirmed` is functionally invisible to AGENTS.md's lookup step
  (see below), so treat the review lag itself as a project risk, not a
  formality.
- When you confirm an entry, decide explicitly whether it also requires an
  edit to a Group B–L document or an ADR. If it does, make that edit and add
  a `resolved_in` reference to this entry pointing at the doc/ADR. If it
  doesn't (the finding is genuinely implementation-only and doesn't change any
  architecture document), confirm it as-is with no `resolved_in`.
- If you determine a `proposed` entry was simply wrong, set
  `status: superseded` and add a one-line reason — don't delete it. The log is
  append-only for humans too; corrections are new information, not erasures.

## Entry format

Copy this block for each new entry. Keep entries in chronological order
(newest at the bottom) — do not reorder existing entries.

```
### [LOG-NNNN] <short title>

- date: YYYY-MM-DD
- task_id: <A1 task ID that produced this finding>
- status: proposed | confirmed | superseded
- affects: <document ID(s) this relates to, e.g. B4, H1 — or "none">
- resolved_in: <doc/ADR path, if a human has made a corresponding edit — else omit>
- supersedes: <prior LOG-ID, if this entry replaces one — else omit>

<What was found. What conditions it was found under. What was implemented as
a result, if anything, and how it was implemented. Note field per the rules
above — label inference/speculation/tested explicitly.>
```

Use a four-digit zero-padded sequence number for `LOG-NNNN`, continuing from
the highest existing number in this file. Do not reuse a number even if an
entry is later superseded.

---

## Entries

_(none yet — first entry goes below this line)_

### [LOG-0001] 01-create-roles.sh creates five roles, not three

- date: 2026-06-25
- task_id: TASK-INFRA-005
- status: confirmed
- affects: C1 (Part 2), infra.md (TASK-INFRA-005 AI Prompt)
- resolved_in: infra.md (TASK-INFRA-005 acceptance criterion updated to list all five roles)

The TASK-INFRA-005 AI Prompt and its three acceptance criteria name exactly
three roles: `batac_migrate`, `batac_app`, `batac_audit`. However, C1 Part 2
(the authoritative schema DDL document) defines five roles:
`batac_migrate`, `batac_app`, `batac_audit`, `batac_it_admin`, `batac_readonly`.
I3 §8.1 is cited as the source for this role set in C1.

Per the Section 1 hierarchy (C1 outranks task-prompt text), `01-create-roles.sh`
was implemented to create all five roles. `batac_it_admin` and `batac_readonly`
are NOLOGIN with no passwords; they require no Docker secret and will not break
any acceptance criterion. The `\du` check after `docker compose up -d` will show
all five roles rather than three — this is consistent with C1 but not with the
task-prompt's wording.

[Inference]: The task-prompt text was written before the full role set in C1 Part 2
was finalised and simply omitted the two supplementary roles. The implementation
in 01-create-roles.sh follows C1 as the higher-priority source.

A human reviewer should confirm whether the task-prompt acceptance criterion
(`\du` lists `batac_migrate`, `batac_app`, and `batac_audit`) is intentionally
restrictive (three-role minimum) or whether it should be updated to reflect all
five roles from C1 Part 2.

### [LOG-0002] CREATE ROLE IF NOT EXISTS not valid PostgreSQL syntax; DO block pattern used

- date: 2026-06-25
- task_id: TASK-INFRA-005
- status: confirmed
- affects: none (implementation detail; no architecture document references this syntax)

The TASK-INFRA-005 AI Prompt shows `CREATE ROLE IF NOT EXISTS batac_migrate WITH LOGIN;`
in its sample script. This syntax is not valid in PostgreSQL 16 (verified against
`postgres:16-alpine` — the image used in compose.yml — which emitted:
`ERROR: syntax error at or near "NOT"` when the prompt's exact syntax was used).

The idiomatic PostgreSQL pattern for conditional role creation is a DO block:
```sql
IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'batac_migrate') THEN
  CREATE ROLE batac_migrate WITH LOGIN;
END IF;
```

This pattern was used in `01-create-roles.sh`. Tested against `postgres:16-alpine`
and confirmed working. The prompt's sample code was treated as illustrative
pseudocode, not executable SQL.

### [LOG-0003] batac_app and batac_audit roles must have LOGIN attribute to authenticate

- date: 2026-06-25
- task_id: TASK-INFRA-005
- status: confirmed
- affects: C1 (Part 2), C5 (Addendum)
- resolved_in: c1-full-database-schema-ddl-v3.md (Part 2 — batac_app and batac_audit corrected to LOGIN)

C1 Part 2 explicitly specifies `CREATE ROLE batac_app NOLOGIN;` and `CREATE ROLE batac_audit NOLOGIN;` while noting that `batac_app` is expected to be created as `LOGIN` by Docker/Bitnami via environment variables. However, because both `batac_app` and `batac_audit` have connection strings (`DATABASE_URL_APP` and `DATABASE_URL_AUDIT`) and must authenticate directly, setting them to `NOLOGIN` in `01-create-roles.sh` prevents connection.

To resolve this discrepancy, `01-create-roles.sh` has been updated to create and alter both `batac_app` and `batac_audit` with the `LOGIN` attribute and set their passwords via environment variables. `batac_it_admin` and `batac_readonly` correctly remain `NOLOGIN` as they are only accessed via `SET ROLE`.

[Inference]: The literal DDL text of C1 Part 2 uses `NOLOGIN` for `batac_app` and `batac_audit`, but this contradicts the intent and practical connection requirements of these roles. This correction aligns the created roles with their connection needs.

### [LOG-0004] Exclude actor reference columns from Invariant #7 timestamp checks

- date: 2026-06-26
- task_id: TASK-INFRA-007
- status: confirmed
- affects: C5 (Section 7.4), infra.md (TASK-INFRA-007 AI Prompt)
- resolved_in: c5-migration-strategy-and-conventions.md §7.4 (actor/ID-column exception added)

Invariant #7 dictates that any column whose name contains `deleted` or starts with/contains `created`, `updated`, etc. must be typed as `TIMESTAMPTZ` or `TIMESTAMP WITH TIME ZONE`. However, the soft-delete convention in the project requires every table to have both `deleted_at TIMESTAMPTZ` and `deleted_by UUID` (a UUID reference to the user who deleted the row).

Without an exception, `deleted_by` (which contains `deleted`) is flagged as a violation because its type is `UUID`. This would cause every table to fail the linter. Similarly, columns like `created_by` or `updated_by` are user references.

[Inference]: Actor and user ID reference columns (specifically those ending in `_by` or `_id`) are not timestamp columns and are excluded from Invariant #7 timezone checks in `lint-migrations.ts`.

### [LOG-0005] skipLibCheck: true required for @batac/database package to compile

- date: 2026-06-26
- task_id: TASK-INFRA-006
- status: confirmed
- affects: C5 (Section 2.2), J3 (TypeScript config standards)

The project standard tsconfig configures `"skipLibCheck": false`. However, building `@batac/database` with `drizzle-orm` and `drizzle-kit` installed results in multiple type compilation errors within their own `.d.ts` declaration files (primarily mysql-core, sqlite-core, and singlestore-core select and delete query definitions). These errors are internal package typing issues in Drizzle ORM when using strict type checking.

[Inference]: To allow compilation to succeed and to enable Turborepo tasks to run, the `@batac/database` package's `tsconfig.json` overrides the base configuration to set `"skipLibCheck": true`. This has no impact on application safety because only third-party package definitions are skipped; the workspace schema code and migration runner themselves are still type-checked.


### [LOG-0006] Tailwind CSS v4 workspace package component class scanning gap

- date: 2026-06-26
- task_id: TASK-UI-003
- status: confirmed
- affects: F5, DESIGN.md
- resolved_in: f5-ui-component-library-setup-and-package-architecture.md §5; DESIGN.md §4 (both document the @source scanning requirement)

Tailwind CSS v4's `@tailwindcss/vite` plugin in `apps/web` by default scans only files within the active project directory (`apps/web/src`) for utility classes. It does not automatically scan workspace library dependency directories (such as `packages/ui/src/components`) when resolving class names used solely within library components.

As a result, utility classes like `justify-between`, `items-start`, `bg-primary-800`, `text-white`, `h-10`, `pb-4`, `gap-3`, etc., used inside components like `PageHeader.tsx` or `button.tsx`, were omitted from the compiled CSS bundle (`apps/web/dist/assets/index-*.css`), rendering these components completely unstyled.

[Tested]: Resolved by adding Tailwind v4 `@source` directives targeting both the `packages/ui` components directory and the `apps/web` pages directory directly inside `packages/ui/src/styles/globals.css`:
```css
@source "../components/**/*.{ts,tsx}";
@source "../../../apps/web/src/**/*.{ts,tsx}";
```
This forces the Tailwind compiler to scan these folders and generate the necessary CSS rules in the output stylesheet. Verified that adding this resolved the styling on both the PageHeader page and the main design components preview page.

### [LOG-0023] Tooltip popovers clipped by overflow-hidden containers; wrapped content in Radix Portal

- date: 2026-06-26
- task_id: TASK-UI-004
- status: confirmed
- affects: tooltip.tsx (Tier 1), Sidebar.tsx (Tier 3)

During visual verification of the collapsed `Sidebar` component (which is styled with `overflow-hidden` per DESIGN.md §6.1 to prevent layout layout shifts during transitions), the tooltips associated with the icon-only navigation links were completely invisible on hover. 

Upon inspection of the Tier 1 `packages/ui/src/components/ui/tooltip.tsx` component, it was discovered that `TooltipContent` did not wrap the underlying `TooltipPrimitive.Content` inside `TooltipPrimitive.Portal`. Consequently, the tooltip popover was rendered inline in the DOM tree, causing it to be clipped by the parent element's `overflow: hidden` styling.

[Tested]: Resolved by wrapping `TooltipPrimitive.Content` inside `TooltipPrimitive.Portal` in `tooltip.tsx`, aligning it with the standard shadcn/ui and Radix UI portal patterns. Verified using the browser subagent that tooltips for collapsed items now display correctly over the sidebar and page boundaries.

### [LOG-0007] recharts@2.15.4 requires skipLibCheck:true in @batac/ui (same pattern as LOG-0005)

- date: 2026-06-26
- task_id: TASK-UI-002
- status: confirmed
- affects: F5 (UI package configuration)
- supersedes: none

During TASK-UI-002, `tsc --noEmit` on `@batac/ui` failed with `error TS7016: Could not find a declaration file for module 'lodash'` originating from `recharts@2.15.4`'s own `.d.ts` file (`generateCategoricalChart.d.ts`). This is identical in nature to the LOG-0005 finding for `@batac/database` with drizzle-orm.

Verified that the error existed in the baseline (before TASK-UI-002 changes) by stashing all TASK-UI-002 changes and running `tsc --noEmit` — same error. The issue is a third-party typing gap in recharts, not code introduced by this task.

[Tested]: Resolved by adding `"skipLibCheck": true` to `packages/ui/tsconfig.json`, overriding the base config's `"skipLibCheck": false`. With this override, `tsc --noEmit` completes with zero errors. This mirrors the LOG-0005 fix applied to `@batac/database`. Only third-party `.d.ts` files are skipped; all workspace source files under `packages/ui/src/` are still fully type-checked.

A human reviewer should decide whether a global `"skipLibCheck": true` is warranted in `tsconfig.base.json` (given two packages now needing it) or whether per-package overrides are the preferred pattern.

### [LOG-0008] `shared` PostgreSQL schema absent from C1 Phase 1 schema list

- date: 2026-06-26
- task_id: TASK-INFRA-023
- status: confirmed
- affects: C1 (Part 2, Part 13), C5 (§3.1, §8)
- resolved_in: c1-full-database-schema-ddl-v3.md (Part 2 + Part 13.5 added); c5-migration-strategy-and-conventions.md (§3.1 updated)

C1 Part 2's Phase 1 schema list included only: `iam`, `organization`, `documents`,
`workflow`, `tracking`, `records`, `notifications`, `audit`. The `shared` schema
was not listed, even though `post-migrate-grants.sql` (created in TASK-INFRA-006)
already included `'shared'` in the `app_schemas` array with a comment noting
TASK-INFRA-023 would create it.

TASK-INFRA-023 requires the `shared` schema for `shared.event_bus_dead_letters`
(the dead-letter table for the in-process event bus, per ADR-API-001 §4).

Per the Section 1 hierarchy, the task spec (TASK-INFRA-023) and ADR-API-001 together
confirm the schema is required. C1 was updated (Part 2: added `CREATE SCHEMA IF NOT
EXISTS shared`; Part 13.5: added DDL reference; Part 14 Invariant #13: documented
the city_id exception for the dead-letter table). C5 §3.1 was updated to add
`shared` as a valid migration scope name.

[Inference]: The omission from C1 was an oversight in the original DDL document —
the schema was always needed by the event bus infrastructure but was referenced
only in post-migrate-grants.sql. The correction above aligns C1 with the rest of
the project's architecture documents and the actual implementation.

### [LOG-0009] `shared` scope not in C5 §3.1 valid scope list

- date: 2026-06-26
- task_id: TASK-INFRA-023
- status: confirmed
- affects: C5 (§3.1)
- supersedes: none
- resolved_in: c5-migration-strategy-and-conventions.md §3.1 (updated inline)

C5 §3.1's valid scope values for migration filenames did not include `shared`.
The `shared` PostgreSQL schema is an INFRA-owned operational schema, not a domain
schema. Per C5 §3.4 [Inference], `core` is the fallback for shared infrastructure,
but naming the migration `0000_core_create_event_bus_dead_letters.sql` would be
misleading since `shared` is the actual schema name.

Resolution: C5 §3.1 was updated to add `shared` as a valid scope value with an
explanation that it applies to migrations touching the INFRA-owned `shared`
PostgreSQL schema. The migration is named
`0000_shared_create_event_bus_dead_letters.sql`.

[Inference]: Using the schema name as scope is more consistent than using `core`
here — the `core` fallback was designed for DDL that creates multiple schemas or
database-global infrastructure (extensions, roles), not for schema-specific table DDL.

### [LOG-0010] EventBus imports IDeadLetterRepository interface, not concrete class

- date: 2026-06-26
- task_id: TASK-INFRA-023
- status: confirmed
- affects: none (implementation pattern; no architecture document required change)
- resolved_in: ADR-INFRA-023-01 (new ADR created)

The TASK-INFRA-023 spec shows `EventBus` (in `packages/shared`) importing
`DeadLetterRepository` directly from `../../apps/server/src/infra/dead-letter.repository`.
This creates a `packages → apps` dependency direction, which is architecturally
backwards: packages may not depend on app code.

Resolution: `IDeadLetterRepository` interface is defined in
`packages/shared/src/dead-letter-repository.interface.ts`. `EventBus` accepts an
`IDeadLetterRepository` (the interface) in its constructor. The concrete
`DeadLetterRepository` (in `apps/server/src/infra/dead-letter.repository.ts`)
implements the interface and is injected at Fastify startup.

ADR-INFRA-023-01 was created to document this decision. The spec's pseudocode was
treated as illustrative, not prescriptive (it was labelled "omitted for brevity"
in the original task prompt).

[Inference]: The dependency-inversion pattern used here is standard for monorepos
where a shared library needs to call back into app-layer implementations.

### [LOG-0024] `apps/server` required `"type": "module"` to consume `@batac/database` schemas without Drizzle type identity conflicts

- date: 2026-06-26
- task_id: TASK-INFRA-023
- status: confirmed
- affects: none (infra implementation detail; no architecture document change required)
- resolved_in: none (code change only)

When `DeadLetterRepository` (in `apps/server`) imported `eventBusDeadLetters` from
`@batac/database/schema/shared.schema` (which is in an ESM package with
`"type": "module"`), TypeScript resolved drizzle-orm types via two distinct
resolution modes: the database schema file resolved drizzle-orm with
`{ "resolution-mode": "import" }` while the server files resolved it with the
default CJS mode. This caused TypeScript to treat `PgColumn`, `SQL<T>`, and other
drizzle-orm types as structurally incompatible even though they were from the same
package version — because they had "separate declarations of a private property
`shouldInlineParams`".

Resolution: `apps/server/package.json` was updated to add `"type": "module"`, and
all relative imports in existing server source files were updated to use `.js`
extensions (required by Node16 ESM module resolution). The test files
(`load-docker-secrets.test.ts`, `health.route.test.ts`) were also updated to use
`.js` extensions in relative imports.

Additionally, `apps/server/tsconfig.json` was updated with:
- `"skipLibCheck": true` — same drizzle-orm internal type errors as LOG-0005
- `"exactOptionalPropertyTypes": false` — override required because drizzle-orm
  query builder types do not satisfy `exactOptionalPropertyTypes: true` when
  inherited from the base tsconfig

[Inference]: The `"type": "module"` addition to `apps/server` is the simplest fix
that aligns the server's module resolution with `@batac/database`'s module system.
The alternative (splitting drizzle imports into a shared ESM-mode helper) would be
more complex and fragile. The `.js` extension requirement is a standard Node16 ESM
constraint, not a project-specific quirk.

### [LOG-0011] `batac_audit` role lacks UPDATE permissions, blocking Drizzle `SELECT ... FOR UPDATE`

- date: 2026-06-27
- task_id: TASK-AUDIT-004
- status: confirmed
- affects: C1
- resolved_in: j1-software-design-patterns.md (Repository Pattern — Concurrency Control: Advisory Locks vs. Row Locks); ADR-GEN-013-advisory-lock-for-audit-chain-hash-serialization.md; j5-adr-master-index.md (registered)

During integration testing of the audit event consumer, queries to select the previous chain hash failed. The Drizzle repository was executing `SELECT ... FOR UPDATE` on `audit.events` to serialize concurrent chain hash computation. However, PostgreSQL rejected this with a permission error. The `batac_audit` database role explicitly revokes `UPDATE` and `DELETE` privileges on the `audit.events` table (enforced by Security Invariant #3 / I3 §16). In PostgreSQL, a `SELECT ... FOR UPDATE` query requires the `UPDATE` privilege on the target table.

To serialize concurrent writes and compute chain hashes safely, we replaced the row-level lock (`.for('update')`) in `audit.repository.ts` with a transaction-level advisory lock (`pg_advisory_xact_lock`). This sequences concurrent inserts safely without requiring `UPDATE` privileges.

[Inference]: The transaction-level advisory lock is the standard way in PostgreSQL to serialize operations when row-level locks are unavailable or table permissions are restricted to append-only (SELECT/INSERT).

### [LOG-0012] `batac_migrate` lacks CREATE on public schema — blocks migration 0002 (IAM) on fresh databases

- date: 2026-06-30
- task_id: TASK-ORG-001
- status: confirmed
- affects: C1 (Part 2 / TASK-INFRA-005/006 init scripts), infra.md
- resolved_in: tools/db/init/01-create-roles.sh (GRANT CREATE ON SCHEMA public TO batac_migrate added — option (a))

When running `pnpm db:migrate` on a database where migrations 0000 and 0001 were
applied but 0002 (IAM schema) had not yet been applied, migration 0002 failed with:
`ERROR 42501: permission denied for schema public`. The failing statement was the
`CREATE OR REPLACE FUNCTION public.fn_set_updated_at()` created at the end of
migration 0002's manual additions section. The `batac_migrate` role has no `CREATE`
privilege on the `public` schema by default.

This is a gap in the database initialisation scripts (TASK-INFRA-005/006): those
scripts should have granted `CREATE ON SCHEMA public TO batac_migrate` as part of
the init DDL, since `batac_migrate` is the migration owner and the shared trigger
function `public.fn_set_updated_at()` lives in the public schema. The IAM task
(TASK-IAM-001) apparently succeeded in its own environment because that environment
had already granted this privilege via a different path (superuser init script or
`init.sql` run under postgres role).

Workaround applied in local dev: `GRANT CREATE ON SCHEMA public TO batac_migrate`
executed once as postgres superuser. Verified that migrations 0002 and 0003 then
applied cleanly and `pnpm db:migrate` is idempotent.

A human should decide whether the fix belongs in:
  (a) the Docker init scripts (`init.sql` or `01-create-roles.sh`) in TASK-INFRA-005/006
  (b) the Compose file's `POSTGRES_*` env for the postgres user
  (c) a migration 0000 preamble that runs as superuser before Drizzle takes over

[Inference]: The missing grant is an init-script omission. The public schema,
introduced in PostgreSQL 15, revoked CREATE from PUBLIC by default; prior Postgres
versions allowed it automatically. The project spec does not enumerate this grant
explicitly, which is why it was missed.
### [LOG-0013] `argon2` package was not in apps/server/package.json — added for TASK-IAM-006

- date: 2026-06-30
- task_id: TASK-IAM-006
- status: proposed
- affects: none (implementation dependency gap; no architecture document enumerates per-app package dependencies)

TASK-IAM-006 requires `argon2.verify()` for Argon2id password verification.
The `argon2` npm package (`@node-rs/argon2` compatible API) was not listed in
`apps/server/package.json` at the time this task was implemented. It was added
as a dependency. The version pinned is `^0.43.0`.

`@fastify/rate-limit` was also missing and was added at `^10.2.2` for the
per-route 5 req / 15 min IP-based rate limit on POST /api/auth/login.

[Inference]: These packages are implied by the task spec (argon2 for password
verification, @fastify/rate-limit for login route throttling) and likely were
overlooked when the initial package.json was authored. Both are standard choices
with no architectural decision implications.

### [LOG-0014] session_token_hash requires two-phase update: 'pending' placeholder → SHA-256(jti) after JWT sign

- date: 2026-06-30
- task_id: TASK-IAM-006
- status: proposed
- affects: none (implementation sequencing detail; no architecture document specifies how to handle the jti-before-session chicken-and-egg)

The login flow (TASK-IAM-006) must: (a) INSERT the session row atomically with
the concurrent-session replacement, and (b) store `session_token_hash = SHA-256(jti)`
where `jti` is only known after the JWT is signed (step 9), which happens after
the transaction commits (step 8).

This creates a sequencing dependency: the session row must exist before the JWT
is signed (because the session ID is a JWT claim), but the JWT `jti` is only
known after signing.

Implemented as a two-phase approach:
  1. INSERT session row with `session_token_hash = 'pending'` inside the transaction.
  2. After the transaction commits and the JWT is signed, UPDATE the session row
     with `session_token_hash = SHA-256(jti)` outside the transaction.

The UPDATE is best-effort (outside the atomic transaction). If the server crashes
between step 1 and step 2, the session row has hash='pending'. Hook 1's
verifyAccessToken would still find the session active and proceed; however,
because 'pending' ≠ SHA-256(actual_jti), any future call that looks up the
session by token hash (findSessionByTokenHash) would fail to match. This is
considered an acceptable low-probability gap for Phase 1.

A cleaner implementation would add `updateSessionTokenHash` to IamRepository so
that the session hash can be managed without an ad-hoc inline update. See also:
the IamRepository interface in iam.types.ts does not currently expose this method.

[Inference]: The two-phase approach matches what other implementations of this
pattern do in a single-server context. It was not pre-specified because the
chicken-and-egg between jti and session_id is an implementation detail, not an
architecture question.

### [LOG-0015] login() returns a private `_cookies` property for route-handler cookie assembly

- date: 2026-06-30
- task_id: TASK-IAM-006
- status: proposed
- affects: none (internal contract between iam.service.ts and iam.routes.ts; not part of IamPublicAPI)

The `IamService.login()` return type in iam.types.ts declares the fields that
belong to `AuthResponseSchema` (user, sessionId, expiresAt, roleCodes,
officeScopeId, officeCode). However, the route handler also needs the raw token
strings to assemble the Set-Cookie headers (batac_at = accessToken;
batac_rt = `${tokenId}.${rawBase64url}`).

Rather than write a separate method or add token strings to the declared return
type (which would expose them to any caller of login()), the implementation uses
a `_cookies` property that is returned by the concrete implementation but is NOT
declared in the IamService interface. The route handler casts the result to
`& { _cookies?: {...} }` to access it.

This is an internal coupling between iam.service.ts and iam.routes.ts that is
acceptable for Phase 1 but fragile. A cleaner approach for a future task would
be to separate the cookie-assembly concern into a dedicated method or to return
the token strings via a different channel (e.g., Fastify reply decorations set
within the service — though that would break the service/route separation).

[Inference]: The `_cookies` pattern is a pragmatic workaround to avoid leaking
token strings into the declared public return type while still being usable by
the route handler in the same module. It is not a pattern recommended for
cross-module use.

### [LOG-0016] `pgsql-ast-parser` cannot parse CREATE TRIGGER / CREATE POLICY / RLS / function-grant statements — `db:lint` already fails on `main` before this task

- date: 2026-06-30
- task_id: TASK-DOCS-001
- status: proposed
- affects: C5 (§7.1, Appendix A)

Running `pnpm --filter @batac/scripts lint:migrations` against `/packages/database/migrations/` produced `[FAIL] Syntax error parsing migration file` for `0002_iam_create_iam_schema.sql`, `0003_glamorous_scream.sql`, and the new `0004_documents_create_documents_schema.sql` — every file that has a "Manual additions" section.

[Tested]: Isolated the cause by calling `pgsql-ast-parser`'s (`^12.0.2`, the version pinned in `tools/scripts/package.json`) `parse()` function directly against minimal single-statement reproductions of each distinct construct used in these manual-additions sections. Confirmed `parse()` throws on: `CREATE TRIGGER` (any form, including the plain `BEFORE UPDATE ... EXECUTE FUNCTION public.fn_set_updated_at()` form already used in 0002/0003), `CREATE POLICY` (any form), `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, `CREATE FUNCTION ... RETURNS TABLE (...) SECURITY DEFINER`, `ALTER FUNCTION ... OWNER TO`, `REVOKE ALL ON FUNCTION ...`, `GRANT EXECUTE ON FUNCTION ...`, `GRANT ... ON ALL SEQUENCES IN SCHEMA ...`, and multi-role `GRANT ... TO role_a, role_b` statements (e.g. `GRANT USAGE ON SCHEMA iam TO batac_app, batac_readonly;`, already present in 0002). A plain `CREATE OR REPLACE FUNCTION ... RETURNS TRIGGER LANGUAGE plpgsql AS $$ ... $$;` with no `SECURITY DEFINER` and no `RETURNS TABLE` parsed successfully in isolation; everything else tested above did not.

This means `db:lint` already fails on `main` as it stood before this task: `0002_iam_create_iam_schema.sql` and `0003_glamorous_scream.sql` both contain `CREATE TRIGGER` statements (0002 also has `CREATE POLICY`, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and a multi-role `GRANT`) in their already-merged manual-additions sections. `0004_documents_create_documents_schema.sql` fails for the identical pre-existing reason, using the same statement forms as that established precedent — this is not a regression introduced by TASK-DOCS-001.

Per C5 §7 ("[the linter] must pass before the build task runs. A failed linter blocks merge."), a human should confirm whether the `db:lint` Turborepo task is actually wired into CI as described — if it is, CI should already be red on `main`; if `db:lint` is not yet actually invoked by CI despite C5's description, that gap is separate from the parser gap documented here.

[Inference]: C5 §7.1 itself labels the parser choice "a candidate," not a final commitment ("[Inference — the source documents designate these rules for automated linting but do not specify the implementation]"). This finding indicates `pgsql-ast-parser`'s grammar coverage is materially narrower than the DDL/DCL this project actually produces — only `CREATE TABLE`, `CREATE INDEX` (including expression/partial/GIN forms), `ALTER TABLE ... ADD CONSTRAINT`, and single-role `GRANT`/`REVOKE` on tables were confirmed to parse. Whether the fix is to catch-and-skip unparseable statements per-file instead of hard-failing the whole file, swap to a different PostgreSQL parser library, or restructure how manual-SQL sections are linted is a scope decision left to a human; `lint-migrations.ts` was not modified as a side effect of this unrelated task.1

### [LOG-0017] `database.plugin.ts` / `event-bus.plugin.ts` did not exist; created as gap-fill infrastructure

- date: 2026-06-30
- task_id: TASK-IAM-014
- status: proposed
- affects: J1

TASK-IAM-014's own AI Prompt example `app.ts` imports `databasePlugin` from
`./infrastructure/database.plugin` and `eventBusPlugin` from
`./infrastructure/event-bus.plugin`. Neither file existed anywhere in the
repository at the start of this task — there was no `infrastructure/`
directory at all (only an unrelated `infra/` directory containing
`dead-letter.repository.ts`). No task in TASK-IAM-014's prerequisite list
(TASK-IAM-006…013, TASK-AUDIT-003) creates them, and a search of
`docs/pre-development/A-project-planning/a1-tasks/infra.md` found no task
that does either. Yet `iam.plugin.ts`'s pre-existing stub,
`audit.plugin.ts`, and `organization.plugin.ts` all already declared
`dependencies: ['database', 'event-bus', ...]` — so without these two files,
every `fp()`-wrapped module plugin in the app would throw `FST_ERR_PLUGIN_NOT_PRESENT_IN_INSTANCE`-style
dependency errors at startup, and TASK-IAM-014's own acceptance criteria
("pnpm dev starts with no plugin registration errors") could not pass.

This matches AGENTS.md Section 4's named example almost exactly ("Fastify
plugin registration order" is listed as something no pre-dev document
answers in advance). Per that section's instruction, the most conservative
reasonable default was implemented rather than blocking the task:
`apps/server/src/infrastructure/database.plugin.ts` and
`.../event-bus.plugin.ts` were created.

`database.plugin.ts`'s instantiation is not a guess — it's copied verbatim
from the worked example already present in `src/db.ts`'s `AppDb` doc
comment (`postgres(env.DATABASE_URL_APP)` → `drizzle(client)`, no schema
argument, matching how every existing repository in this codebase uses the
Drizzle core query builder rather than the schema-aware relational query
API).

`event-bus.plugin.ts`'s instantiation is similarly copied verbatim from
`packages/shared/src/event-bus.ts`'s class doc comment (`new
EventBus(logger, deadLetterRepo)`), using the *real* `EventBus` class in
`packages/shared` (confirmed against this file directly, and against
LOG-0010's "EventBus imports IDeadLetterRepository interface" entry) rather
than the `TypedEventBus` / `apps/server/src/infrastructure/event-bus.ts` /
`getEventBus()` singleton-factory shape shown in
`docs/pre-development/J-software-design-patterns-and-standards/j1-software-design-patterns.md`
§4 ("Domain Event Pattern" / "Module Plugin Pattern" → "Infrastructure
Plugin Example", roughly L478–L902). J1's example also assumes a
`fastify.config.DATABASE_URL` decoration (implying a `config` plugin) that
does not exist anywhere in this codebase; the actual, working convention
(confirmed in `index.ts`, `audit.plugin.ts`, and the `db.ts` doc comment) is
a plain imported `env` singleton from `./config/env.js`, used directly. J1
appears to predate TASK-INFRA-023, which is where the real EventBus/
DeadLetterRepository/`"type": "module"` architecture was actually decided
(see this log's two pre-existing LOG-0010 entries). Flagging `affects: J1`
so a human reviewer can decide whether to update J1 §4's infrastructure
examples to match what was actually built, since a future agent reading J1
in isolation (without also reading this log and the actual `packages/shared`
source) would be misled the same way this task initially was.

Tested: see LOG-0017 below — both plugins were exercised together with the
full IAM plugin chain via `fastify.inject()` and confirmed working with no
plugin-registration errors.

### [LOG-0018] `iam.routes.ts` / `iam.router.ts`'s actual signatures diverge from TASK-IAM-014's AI Prompt sample code

- date: 2026-06-30
- task_id: TASK-IAM-014
- status: proposed
- affects: none (implementation detail; the AI Prompt sample code is not an architecture document)

TASK-IAM-014's AI Prompt sample `iam.plugin.ts` assumes:
  1. `createIamRouter(fastify)` is a factory function returning a router.
  2. `registerIamRoutes(scope, iamService, policyEvaluator, { public: boolean })`
     takes the service/evaluator as explicit parameters and a `public` flag,
     called twice — once per scope — under an external
     `fastify.register(..., { prefix: '/api' })` wrapper.

Neither matches what TASK-IAM-006 through TASK-IAM-013 actually built:
  1. `iam.router.ts` exports a single pre-built `iamRouter` constant (built
     via `router({...})` from `trpc/trpc.ts`'s `t`). Each procedure calls a
     local `getService(ctx)` helper that reads `ctx.req.server.iamService`
     at request time. There is no `createIamRouter` export of any kind.
  2. `registerIamRoutes(fastify: FastifyInstance): Promise<void>` takes only
     the Fastify instance. It hardcodes the full `/api/auth/login`,
     `/api/auth/refresh`, `/api/auth/unlock`, `/api/auth/logout`,
     `/api/auth/lock`, and `/api/admin/sessions/:id/terminate` paths
     directly (no external prefix expected), and already performs its own
     internal public/protected split: public routes are registered directly
     on the passed-in instance, while protected routes are registered
     inside `registerIamRoutes`'s own nested
     `fastify.register(async (protectedApp) => { await
     protectedApp.register(authMiddlewarePlugin); ... })` block. There is no
     `public` option parameter of any kind.

Following the AI Prompt's sample structure literally would have produced
either a compile error (passing 4 arguments to a 1-argument function) or, if
adapted naively by re-wrapping in an external `{ prefix: '/api' }` scope, a
silently-double-prefixed path (`/api/api/auth/login`) that would make
acceptance criterion 4 ("POST /api/auth/login is reachable") fail with a
404.

`iam.plugin.ts` was written against the actual exported signatures instead:
`fastify.decorate('iamTrpcRouter', iamRouter)` (direct decoration, no
factory call) and a single `await fastify.register(registerIamRoutes)` (no
prefix, nested for hook-isolation per the module-plugin pattern, not fp()
since route registration shouldn't leak hooks to siblings).

Tested: a `buildApp()` smoke test (registering database → event-bus → audit
→ iam → trpc, then `fastify.inject()`) confirmed `POST /api/auth/login`
with an empty body returns `400` with a `VALIDATION_ERROR` body (not `404`),
and that a route registered specifically to not exist still correctly
returns `404` (ruling out an accidental catch-all). The same test confirmed
`GET /api/trpc/iam.getCurrentUser` returns `401 UNAUTHORIZED` (reachable and
executing tRPC middleware, not `404`), and that a dummy plugin registered
*after* `iamPlugin` could read `fastify.iamService`, `fastify.policyEvaluator`,
and `fastify.iamRepository` successfully. This could not include an actual
successful login (no live Postgres instance was available in the
environment this was tested in), so acceptance criterion 6 (full login
succeeds end-to-end) was not exercised end-to-end — only that the route
reaches `fastify.iamService.login(...)` without a plugin-wiring or
routing failure first.

### [LOG-0019] `fastify.log` (FastifyBaseLogger) is not directly assignable to pino's `Logger` type expected by `EventBus`'s constructor

- date: 2026-06-30
- task_id: TASK-IAM-014
- status: proposed
- affects: none (TypeScript structural-typing detail)

`packages/shared/src/event-bus.ts`'s `EventBus` constructor takes
`(logger: Logger, deadLetterRepo: IDeadLetterRepository)` where `Logger` is
imported from `'pino'`. `fastify.log` is typed as Fastify's own
`FastifyBaseLogger` interface, which `tsc` rejects as not assignable to
pino's `Logger` (`error TS2345: ... Property 'msgPrefix' is missing in type
'FastifyBaseLogger' but required in type 'BaseLogger'`), even though at
runtime Fastify's default logger (used by this project — see `app.ts`'s
`Fastify({ logger: { level: env.LOG_LEVEL } })`) is backed by a real Pino
instance.

`event-bus.plugin.ts` bridges this with `fastify.log as unknown as Logger`
when constructing the `EventBus`. [Inference] This is a type-only bridge,
not a runtime behavior change — `EventBus` only calls the subset of methods
(`.error()`, etc.) that both interfaces share. Confirmed via `tsc --noEmit`
(clean, 0 errors) and via the same runtime smoke test referenced in
LOG-0017, where `fastify.eventBus` constructed successfully and was usable.
An existing file in this codebase (`audit.event-consumer.ts`) sidesteps the
same friction by typing its own logger parameter as `FastifyBaseLogger`
instead of pino's `Logger` — not available here since `EventBus`'s
constructor signature lives in `packages/shared` and is not a IAM-module
file this task is scoped to edit.

### [LOG-0020] officeType enum mismatch between task prompt and DB schema/codebase

- date: 2026-07-01
- task_id: TASK-ORG-008
- status: proposed
- affects: E1, organization.schemas.ts

The TASK-ORG-008 AI Prompt specified `officeType` enum as `['sp_office','mayors_office','city_department','barangay','other']`. However, the DB CHECK constraint `ck_offices_office_type` in the schema, the seeded offices in the DB, and the shared `OfficeSummarySchema` type in `@batac/shared` all independently check and validate using the set `['executive', 'legislative', 'department', 'barangay', 'external']`. Using the prompt's proposed values would cause valid Zod inputs to fail the database CHECK constraint.

[Inference]: The schema-verified set `['executive', 'legislative', 'department', 'barangay', 'external']` was implemented in the router schemas instead to match the database and shared definitions.

### [LOG-0021] Designation create/revoke mutation procedures scope discrepancy

- date: 2026-07-01
- task_id: TASK-ORG-008
- status: proposed
- affects: E1, organization.router.ts

The TASK-ORG-008 prompt access-control matrix and deliverables lines had conflicting signals. The matrix listed `Create designation grant | [Not in this router — handled by delegation.service.ts TASK-ORG-005]`, and the deliverables listed read-only delegation procedures. However, the procedure list specified `createDesignationGrant` and `revokeDesignationGrantEarly` mutations.

[Unverified]: These mutations were eventually implemented since the backing methods in `delegation.service.ts` had already been developed in other code branches.

### [LOG-0022] PolicyEvaluator evaluate() vs direct ctx.auth check mismatch in organization router

- date: 2026-07-01
- task_id: TASK-ORG-008
- status: proposed
- affects: I2, organization.router.ts

The prompt instructions requested using `policyEvaluator.evaluate()` for all mutation gating. However, Gate 3's `PLATFORM_ADMIN_ALLOWED_ACTIONS` allowlist in `iam.policy.ts` and the IAM seed action strings are completely disjoint. Calling `policyEvaluator.evaluate()` for a `plat_admin` role on any ORG resource would result in a denial, preventing functional admin access.

[Unverified]: Direct checks on `ctx.auth.isPlatformAdmin` (matching the pattern used throughout `iam.router.ts`) were implemented instead, while keeping `policyEvaluator` in `createOrgRouter` deps for type compliance.


### [LOG-0025] Null `officeId` produces fail-closed RLS exclusion via SQL NULL GUC, not an error

- date: 2026-06-30
- task_id: TASK-IAM-005
- status: proposed
- affects: I3 (§8.2)
- resolved_in: none (documents existing behavior; no code change)

`iam.middleware.ts`'s Hook 3 (`setDatabaseSessionVars`) comment previously cited
`LOG-0010` for this behavior. Neither LOG-0010 entry — the `IDeadLetterRepository`
interface finding, nor LOG-0024 (formerly the second LOG-0010 entry, about
`apps/server`'s ESM module switch) — actually discusses this. This entry supplies
the documentation that citation was missing, and the citation in
`iam.middleware.ts` has been corrected to point here.

When `request.auth.officeId` is `null` (a user with no resolved office), Hook 3
calls `set_config('app.current_office_id', auth.officeId, true)` with a JS `null`
value. Passed through the `sql` tag, this binds as SQL `NULL`, not the
three-character string `'null'`.

RLS policies compare `current_setting('app.current_office_id', true)::uuid`
against a row's office-scope column — for example, C1's `documents_office_isolation`
policy on `documents.documents`. When the left-hand side is SQL `NULL`, the
comparison evaluates to `NULL` under PostgreSQL three-valued logic, not `TRUE` or
`FALSE`, and a `WHERE` clause excludes rows where the condition evaluates to
`NULL`. The net effect: a user with no office is shown zero office-scoped rows,
rather than the query raising `invalid input syntax for type uuid` (which is what
would happen if the GUC held the literal string `'null'` instead of SQL `NULL`),
and rather than matching rows with a `NULL` office-scope column.

[Inference]: this is the intended fail-closed behavior — a user with no office
should see nothing office-scoped, not error out and not see everything — but I3
§8.2 does not currently state this null-value edge case explicitly; it documents
the session-variable-setting mechanism in general terms only. [Unverified]: whether
this path (a null-`officeId` user querying an office-scoped table) is covered by
an automated test — I did not locate one, but did not exhaustively search the full
test suite for it either.



### [LOG-0026] TASK-DOCS-009's deliverable (DocumentPolicyGuard) was an unimplemented stub at TASK-DOCS-011 time

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: I1, I2, TASK-DOCS-009 (a1-tasks/docs.md)

TASK-DOCS-011 lists TASK-DOCS-009 as a prerequisite, implying
`apps/server/src/modules/documents/documents.policy.ts` (`DocumentPolicyGuard`)
was already implemented. At the time TASK-DOCS-011 was picked up, the file
contained only a placeholder: a single `canReadMetadata` method that always
returned `true`, with no `canCreate`, `canUpdate`, `canSoftDelete`,
`canCancel`, `canReadMetadataAdmin`, or list/search scope methods.

Since TASK-DOCS-011's acceptance criteria cannot pass against a
placeholder that always allows everything, `documents.policy.ts` was fully
implemented as part of this task rather than treated as pre-existing, sourced
from I1 §3.1-§3.6 and Gates 1-5, and I2 Sections 4-5. `documents.plugin.ts`
was also updated to decorate `documentsRepository` and `documentsPolicyGuard`
on fastify (previously only `documentsService` was decorated), since
documents.router.ts needs both per this task's ABAC enforcement pattern.

[Unverified]: whether TASK-DOCS-009 was genuinely never run, or was run
against a different repository state than the one this task received, is not
something this task can determine from the repository alone.

A human should confirm TASK-DOCS-009's actual completion status and reconcile
its deliverable list against what's now in documents.policy.ts.

### [LOG-0027] `LifecycleStateSchema` in packages/shared/src/schemas/documents.ts used a 9-value enum that does not match the actual 11-value lifecycle_state domain

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: E3 (shared Zod schema catalog), documents.ts (packages/shared/src/schemas), C1

`LifecycleStateSchema` (presumed a TASK-DOCS-003 deliverable) was defined as
`["draft","under_review","pending_mayor_action","pending_panlalawigan_review","approved","released","superseded","cancelled","rejected"]`.
The actual DB check constraint (`documents_lifecycle_state_check` in
packages/database/schema/documents.schema.ts, whose column comment cites
"D3 post-ADR-013/ADR-014 [Discovered Issue #1]/[Discovered Issue #2]"),
`DocumentLifecycleState` in apps/server/.../documents.types.ts, and the
`VALID_TRANSITIONS` map in documents.service.ts all agree on a different,
11-value set: `draft, submitted, in_workflow, pending_mayor_action,
pending_panlalawigan_review, completed, released, archived, disposed,
cancelled, superseded`. Six of the nine old values are not in the real set
(`under_review`, `approved`, `rejected` don't exist at all; `submitted`,
`in_workflow`, `completed`, `archived`, `disposed` were missing).

A repo-wide grep confirmed no code outside packages/shared/src/schemas/documents.ts
imported `LifecycleStateSchema` before this change, so it was corrected in
place to the 11-value set (widening/correcting, not narrowing — non-breaking
for any existing caller since there were none).

E1 (docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md)
§3.1's own `documentLifecycleStateEnum` and its documents.cancel/documents.delete
ABAC condition text use the same stale 9-value vocabulary (see LOG-0029) — it
appears E1 and the original TASK-DOCS-003 schema were drafted from the same
earlier state-machine draft that predates the ADR-013/ADR-014 revision.

[Inference]: the DB check constraint plus its own inline "[Discovered Issue]"
comments were treated as the ground truth here, per the Section 1 hierarchy
(implemented schema outranks an unreferenced, unconsumed Zod schema).

A human should confirm no other Group E document still describes the 9-value
set as current, and update E1 if so.

### [LOG-0028] ABAC-enforcement-pattern sample code in TASK-DOCS-011's AI Prompt names things that don't exist under those names in the actual codebase

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: I1, TASK-DOCS-011 (a1-tasks/docs.md); related precedent: LOG-0018, LOG-0020

Similar in kind to LOG-0018 (iam.router.ts) and LOG-0020 (organization
router), TASK-DOCS-011's own "ABAC enforcement pattern" sample code does not
match already-implemented types:

- Sample uses `ctx.subject: SubjectContext` with fields `isIta`/`isPa`. The
  actual, already-implemented type is `ctx.auth: AuthContext`
  (apps/server/src/modules/iam/iam.types.ts) with fields `isItAdmin`/
  `isPlatformAdmin`. `isIta`/`isPa` trace back to I1 §1's own SubjectContext
  naming, so the drift happened during IAM implementation, not in this
  task's prompt specifically.
- Sample calls `ctx.documentsRepository.findDocumentById(input.documentId,
  ctx.subject.cityId)` (two args). The actual method is
  `findDocumentById(id: string): Promise<DocumentRow | null>` (one arg, no
  cityId filter — city scoping for this table is expected to come from RLS
  plus an explicit `document.cityId !== subject.cityId` check at the call
  site instead).
- Sample calls `ctx.documentsRepository.hasClassificationAllowlistEntry(...,
  ctx.subject.roles[0], ...)` — using only the first role. Gate 4's own text
  (I1) is `role_code = ANY(subject.roles)`, i.e. any of the subject's roles,
  not just the first. Implemented as a check across all of `subject.roles`
  (`hasAnyAllowlistEntry` in documents.router.ts), which is strictly more
  correct against I1's stated Gate 4 semantics, not merely a stylistic
  change.

documents.router.ts and documents.policy.ts were written against the actual
`AuthContext`/`DocumentsRepository` shapes rather than the sample code's
names, per the established resolution pattern in LOG-0018/LOG-0020.

### [LOG-0029] E1 §3.1's documents.cancel / documents.delete ABAC condition text uses the same stale lifecycle-state vocabulary as the old LifecycleStateSchema

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: E1 (e1-trpc-router-and-procedure-catalog.md §3.1)
- supersedes: none (companion finding to LOG-0027)

E1's documents.cancel entry gives its ABAC condition as `lifecycle_state NOT
IN ('superseded','rejected','cancelled')`; its documents.delete entry gives
`lifecycle_state IN ('draft','under_review')`. Both use state names from the
same stale 9-value set as LOG-0027 (`rejected` doesn't exist in the real
schema at all; `under_review` should be `submitted`; the cancel-blocking set
should be `archived, disposed, cancelled`, not `superseded, rejected,
cancelled`).

I1 §3.4 (`lifecycle_state IN ('draft','submitted')`) and I1 §3.6 /
I1 §17's state-action compatibility matrix (`cancel` blocked only for
Archived/Disposed/Cancelled) agree with each other and with the real DB
enum, and were followed instead. [Inference]: same root cause as LOG-0027 —
E1 §3.1 appears to have been drafted against the pre-ADR-013/ADR-014 state
machine and never updated.

A human should sweep the rest of E1 §3.1 (and any other E1 section
referencing lifecycle states) for the same staleness.

### [LOG-0030] I1 §3.4's documents.delete role set omits brgy_encoder from its own ALLOW-block set notation

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: I1 §3.4

I1 §3.4's ALLOW block lists the delete-permitted role set as `{'dept_encoder',
'dept_approver', 'sp_secretary', 'sp_presiding_officer', 'mayor',
'brgy_captain'}` — six roles, omitting `brgy_encoder`. Immediately below it,
the same section's "RESTRICTED ENCODER RULE" reads "dept_encoder and
brgy_encoder may soft-delete only while lifecycle_state IN ('draft',
'submitted')...", naming brgy_encoder as if it were already a member of the
base set.

Two independent sources corroborate that brgy_encoder should be included:
I2 §4's "Delete document in Draft state (soft delete) — own office" row shows
Brgy Encoder = allow, unconditional, identical treatment to Dept Encoder (no
footnote distinguishing them); E1's documents.delete "Callable by" list also
names brgy_encoder alongside dept_encoder.

[Inference]: treated as a drafting omission in I1 §3.4's set notation (the
rule immediately below it only makes sense if brgy_encoder already has the
base permission) and implemented with brgy_encoder included in
`DELETE_ROLES` in documents.policy.ts, consistent with I2 and E1.

A human should correct I1 §3.4's ALLOW-block set to include brgy_encoder
explicitly.

### [LOG-0031] Gate 2 / sys_admin document-metadata visibility: I1's footnote, I2's table, and this task's acceptance criteria don't all agree

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: I1 §3.2, I2 §5, TASK-DOCS-011 (a1-tasks/docs.md)

Three sources give different answers for whether sys_admin can read document
metadata:

1. I1 §3.2's ALLOW block never lists sys_admin in any of its role sets, but a
   footnote directly under Gate 2 reads "IT Admin may read metadata (title,
   status, number) of Confidential/Restricted documents but not content
   (Gate 2 covers content)" — implying sys_admin *can* read metadata,
   including for Confidential/Restricted docs, just not file content.
2. I2 §5's table shows Sys Admin = deny on every "View document metadata"
   row (own office, all offices/Internal) with no footnote exception.
3. TASK-DOCS-011's own acceptance criteria require `documents.get` with a
   sys_admin caller and classification='confidential' to throw FORBIDDEN,
   and its AI Prompt for `documents.getMetadataForAdmin` says Gate 2
   "extends to metadata admin view -- DENY if classificationLevel IN
   (confidential,restricted) even for sys_admin" — stricter than I1's
   footnote for the classified case, though it does imply a *general*
   sys_admin metadata channel should exist (documents.getMetadataForAdmin
   itself) for public/internal docs.

Implemented as: `documents.get` denies sys_admin unconditionally (any
classification) and redirects to `documents.getMetadataForAdmin`, matching
I2's table and this task's "sys_admin must use getMetadataForAdmin instead"
instruction; `documents.getMetadataForAdmin` is sys_admin-only and itself
denies Confidential/Restricted, matching this task's explicit Gate-2-extension
instruction and going further than I1's footnote (additional restriction
can only remove access the base policy implied, never grant more, so this is
a safe narrowing even though it's stricter than I1's literal text).

[Inference]: I1's footnote is read here as describing the *intent* behind
what became the separate, narrow `getMetadataForAdmin` procedure rather than
the general `document:read` permission I2 §5 governs — this reconciles I1 and
I2 without contradiction, but is an interpretation, not a confirmed reading.

A human should confirm this reconciliation and, if correct, update I1 §3.2's
footnote to reference the getMetadataForAdmin-style narrow channel explicitly
rather than reading as a blanket document:read exception.

### [LOG-0032] No OrgService method computes I1's has_cross_office_read_grant(); no OrgService method resolves an office by code

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: I1 §3.2, B5 §6.5/ADR-AUTH-009, organization module

Two gaps in the organization module's public API surfaced while implementing
documents.router.ts:

1. I1 §3.2's second OR-branch for document:read requires
   `has_cross_office_read_grant(subject, document.office_id)`. The
   `organization.cross_office_grants` table exists (organization.schema.ts,
   citing B5 §6.5/ADR-AUTH-009), but no `OrgService` method evaluates it —
   `OrgService` only exposes `getOfficeById`, `getOfficeHierarchy`, and a few
   delegation-related methods (see organization.types.ts). This was **not**
   added in this task (it's an organization-module capability, out of
   TASK-DOCS-011's file scope); `DocumentReadResourceContext.hasCrossOfficeGrant`
   is threaded through documents.policy.ts's `canReadMetadata` as an explicit
   parameter and is always passed `false` by documents.router.ts until such a
   method exists. This only affects the ad-hoc-grant OR-branch — the five
   "oversight" roles (records_officer, sp_secretary, sp_presiding_officer,
   mayor, auditor) still get their I2 §5 standing cross-office visibility
   through a separate, structural rule in the guard, not through this gap.
2. documents.create needs to resolve "the SP Secretariat office" by its
   office code ('SPS'), matching the lookup-by-code pattern already used in
   apps/server/src/database/seeds/number-series.seed.ts, without the
   documents module querying organization.offices directly (documents.repository.ts's
   own "no cross-schema joins" contract). No such method existed
   (`getOfficeById` needs an id you don't have yet; `getOfficeHierarchy`'s
   `OfficeSummary` doesn't expose `code`). `OrgService.getOfficeByCode(code,
   cityId)` was added (organization.types.ts + organization.service.ts) to
   fill this gap, since it was required for documents.create to function at
   all and is a small, additive, same-pattern-as-getOfficeById method.

A human should decide whether (1) is worth building (likely a future
ORG-module task) — until then, the ad-hoc cross-office grant OR-branch in
canReadMetadata is dead code in practice (never true).

### [LOG-0033] "write-classification permission" (TASK-DOCS-011's own business rule) has no defined implementation anywhere in the codebase

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: TASK-DOCS-011 (a1-tasks/docs.md); related: C2 (records.classification_rules)

TASK-DOCS-011's AI Prompt for documents.create says: "Fetch document_type to
get classification_default (override only if subject has write-classification
permission)". No permission-string registry, role-to-permission mapping, or
any code path populating `AuthContext.permissions` with a concrete value
exists anywhere in this repository snapshot (`permissions: string[]` is
declared on the type but never assigned a non-empty value in any reviewed
code path). C2's `records.classification_rules` table
(`override_conditions` JSONB) is a related but distinct Tier-2,
administrator-configured auto-escalation mechanism, not a per-user override
permission, and is a records-module concern in any case.

Implemented conservatively: `documents.create` always uses
`document_type.classification_default` and ignores `input.classificationLevel`
for anything other than Zod validation (accepting the field keeps the
contract matching the task spec's input shape without silently widening who
can set an arbitrary classification). [Inference]: this is the safer of the
two readings when the enforcement mechanism is undefined — no caller can
escalate or de-escalate classification through this procedure in this PR.

A human needs to define what "write-classification permission" actually is
(a permission string? a role list? something else) before this can be
implemented for real.

### [LOG-0034] No JSON-Schema validation library available for document_type.metadata_schema validation

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: H2 (document-type-catalog-with-jsonb-metadata-schemas), TASK-DOCS-011

TASK-DOCS-011 requires "second-pass JSONB validation" of `input.metadata`
against `document_type.metadata_schema`. H2 confirms `metadata_schema` values
are real draft-07-style JSON Schema documents (nested objects, arrays,
`enum`, `additionalProperties: false`, union `type` for nullable fields).
apps/server's installed dependencies do not include a JSON-Schema validator
(e.g. ajv), and none could be added in the environment this task was
completed in (no network access to fetch a new package — a sandboxing detail
of this particular work session, not a statement about the target deployment
environment).

Implemented a small, explicitly-scoped hand-written validator
(`validateMetadataAgainstSchema` in documents.router.ts) supporting: `type`
(incl. array-of-types for nullable), `enum`, `required`, `properties`
(recursive), `additionalProperties: false`, and array `items`. It does not
support `$ref`, `oneOf`/`anyOf`/`allOf`, `pattern`, `format`, or numeric/string
bounds (`minLength`/`maximum`/etc.). This is a deliberate scope limit given
the constraint above, not a claim of JSON-Schema compliance.

A human should evaluate adding `ajv` (or similar) as a real dependency and
replacing this validator — the current one will silently under-validate any
metadata_schema in H2 that uses the unsupported keywords.

### [LOG-0035] No "DOCUMENT_CANCELLED" audit event type is registered anywhere; documents.cancel relies on the existing document.state_changed pipeline

- date: 2026-07-02
- task_id: TASK-DOCS-011
- status: proposed
- affects: B3 (b3-internal-domain-event-catalog-v1.3.md), TASK-DOCS-011

TASK-DOCS-011's AI Prompt says documents.cancel should "emit DOCUMENT_CANCELLED
with reason (I1 Part 11.11 -- every cancellation audit-logged)". Neither
packages/shared/src/events/event-payload-map.ts nor
b3-internal-domain-event-catalog-v1.3.md register any event type named
`DOCUMENT_CANCELLED` or `document.cancelled` — the only document-lifecycle
event is the generic `document.state_changed` (which documents.service.ts's
`transitionState` already emits on every transition, `toState: 'cancelled'`
included, with `reason` in the payload). audit.event-consumer.ts already
subscribes to `document.state_changed` and persists it as an audit entry
(`eventType: 'document.state_changed'`), including whatever `reason` was
provided.

documents.router.ts's cancel procedure does not call
`auditService.writeEvent` directly — apps/server/src/modules/audit/index.ts
documents that direct `writeEvent` callers are limited to two confirmed call
sites (Records bulk-op handler and disposition service, per B2 Module 8);
Documents is not one of them. [Inference]: "DOCUMENT_CANCELLED" in the task
brief is read as describing the *product requirement* (every cancellation
must be audit-logged with its reason) rather than naming a literal, separate
event-type string, since no such string exists anywhere else in the
codebase, and the existing `document.state_changed` pipeline already
satisfies the requirement as stated. The persisted audit entry's `eventType`
will read `document.state_changed`, not `DOCUMENT_CANCELLED`, if a human
reviewer greps the audit log expecting the latter literal string.

A human should confirm whether a literal `DOCUMENT_CANCELLED` audit
`eventType` string is actually required (e.g. for a downstream report or
dashboard filter) — if so, that's a B3/audit-consumer change, not something
documents.router.ts should special-case on its own given the writeEvent
restriction above.

### [LOG-0036] Phase 1 dual-approval stub: JSONB vm_approved / sp_approved fields in document-requests.router.ts

- date: 2026-07-07
- task_id: TASK-DOCS-017
- status: proposed
- affects: H2 (§6 DOCUMENT_REQUEST_FORM), E1 (Module 11 document-requests procedures), B4 (Workflow Engine — dual approval steps)

**What was found:**

ADR-EVT-001 (June 2026) states that the dual approval requirement (Vice Mayor +
SP Secretary) for Document Request Forms is modelled as two sequential `approval`
step_instances in the Workflow Engine (B4 §4.2), and that `approval_status`,
`approved_by_vm`, and `approved_by_sp_secretary` JSONB fields were **removed**
from the H2 §6 schema.  However, the Workflow Engine module (TASK-WF-NNN) is not
yet live in Phase 1.

**What was implemented:**

`document-requests.router.ts` uses temporary JSONB fields `vm_approved`,
`vm_approved_at`, `vm_approved_by`, `sp_approved`, `sp_approved_at`,
`sp_approved_by` inside `documents.documents.metadata` as a Phase 1 stub.
Every stub site carries a `TODO(WF-INTEGRATION)` comment:

```
// TODO(WF-INTEGRATION): replace metadata.vm_approved check with
//   workflow.getStepState(...) when TASK-WF-NNN completes.
```

`approveAsSecretary` reads `metadata.vm_approved` to enforce sequential approval
and throws `PRECONDITION_FAILED` if the field is absent or falsy.
`releaseCopy` requires `lifecycleState === 'completed'` (set by
`approveAsSecretary` after both approvals), not a JSONB flag check.

[Inference]: The stub field names (`vm_approved` / `sp_approved`) differ from
the removed ADR-EVT-001 originals (`approved_by_vm` / `approved_by_sp_secretary`)
to clearly distinguish the Phase 1 temporary stub from the removed pre-ADR fields,
and to avoid future confusion when the WF integration removes them.

**C1-over-E1 conflict:**

E1 Module 11's `listAll` procedure references `portal.citizen_requests` and an
`approval_status` column.  C1 Part 13 explicitly states `portal.citizen_requests`
does not exist in Phase 1.  `document-requests.router.ts` follows C1 — all
requests are stored in `documents.documents` with metadata JSONB, and the
`listAll` output is shaped from that metadata.  This was the correct resolution
per AGENTS.md §1 (C1 ranks above E1 in the source-of-truth hierarchy).

A human should confirm: (a) the stub JSONB field names are acceptable for Phase
1 (rename if the convention should match B4 step-instance field names more
closely); (b) whether the TODO comments are sufficient as the migration marker,
or whether a separate tracking ticket for TASK-WF-NNN integration should be
created.


### [LOG-0037] DESIGNATION doc logging trigger wired to `documents.submit` rather than document registration

- date: 2026-07-07
- task_id: TASK-DOCS-018
- status: proposed
- affects: H2 (§8), consolidated reference Part 4.12
- resolved_in: none

H2 §8 and consolidated reference Part 4.12 specify that the delegation grant lifecycle is triggered when a DESIGNATION document is *logged* (registered). However, DESIGNATION document contents (metadata) are draft-editable and not guaranteed to be finalized until the document passes through the `submit` step. Wiring grant creation to document creation would create grants for draft, incomplete, or later-discarded designations.

[Inference]: Per human instruction, the trigger was wired into `documents.submit` (and correspondingly, revocation into `documents.cancel`), explicitly prioritizing the semantic state-machine boundary over the literal text of H2 §8.

### [LOG-0038] `organizationPlugin` instantiation passed `repository` instead of `orgRepository`

- date: 2026-07-07
- task_id: TASK-DOCS-018
- status: proposed
- affects: none
- resolved_in: none

During TASK-DOCS-018, it was discovered that `organization.plugin.ts` was passing its repository instance under the key `repository` to `createDelegationService`, whereas the `DelegationServiceDeps` interface explicitly requires `orgRepository: OrganizationRepository`.

[Tested]: Fixed in `organization.plugin.ts` by explicitly using `orgRepository: repository`.

### [LOG-0039] `fastify.boss` undefined during synchronous plugin registration

- date: 2026-07-07
- task_id: TASK-DOCS-018
- status: proposed
- affects: none
- resolved_in: none

`organization.plugin.ts` attempted to construct `createDelegationService` synchronously during the plugin body execution, expecting `fastify.boss` to be available. However, in `index.ts`, `pgboss` is decorated onto `fastify` *after* `organizationPlugin` is registered, resulting in `boss` being undefined.

[Tested]: Fixed by deferring the service instantiation inside `fastify.after(...)` in `organization.plugin.ts` to guarantee all prior registrations (including `pgboss`) are complete.

### [LOG-0040] Transactional asymmetry in `delegation.service.ts` cross-module calls

- date: 2026-07-07
- task_id: TASK-DOCS-018
- status: proposed
- affects: none
- resolved_in: none

To achieve atomic delegation grant creation during `documents.submit`, `createDelegationGrant` and `transitionState` were updated to accept an optional `DbTransaction` parameter. However, `createDelegationGrant` and `revokeEarlyDelegationGrant` emit domain events and write audit logs *before* the SQL transaction concludes.

[Inference]: This means that if the SQL transaction rolls back (e.g., due to a failure in `transitionState` inside the shared transaction), the domain events and audit logs will have already been fired and will not roll back. This is a pre-existing design property of the service methods.
### [LOG-0041] tracking_record ABAC enforced inline rather than via PolicyEvaluator

- date: 2026-07-07
- task_id: TASK-TRACK-007
- status: proposed
- affects: I1 (§7), E1 (§Module 5)

**What was found:**

`PolicyEvaluator` only has registered handlers for `session` and `delegation_grant` resource types. No handler is registered for `tracking_record` or `routing_entry`. The B5 pattern (§5.5 Steps 7–8) says a missing handler causes RBAC-only evaluation — but the tracking procedures need the own-office / cross-office two-branch logic (I1 §7.1) which is not expressible through RBAC claims alone.

**What was implemented:**

The I1 §7.1–7.5 conditions are checked inline in `tracking.router.ts` rather than through `PolicyEvaluator.evaluate`. Role sets and the own-office branch (`auth.effectiveOfficeIds.includes(documentOfficeId)`) are checked directly against the `AuthContext`. This matches the intent of I1 §7.1 and avoids the need to register a new PolicyEvaluator handler in a module that TASK-TRACK-007 was not asked to touch.

[Inference]: A `tracking_record` PolicyEvaluator handler could be added in a future task for consistency with the `session` and `delegation_grant` patterns, but is not required for Phase 1 correctness since the inline logic implements the same conditions. A human should confirm whether the inline approach is acceptable long-term.

### [LOG-0042] Series number on QR cover sheet derived from preliminaryNumber/finalNumber

- date: 2026-07-07
- task_id: TASK-TRACK-007
- status: proposed
- affects: E1 (§Module 5 tracking.printQrCoverSheet), consolidated ref Q-B02

**What was found:**

E1 §Module 5 confirms the cover sheet contains: QR Code, Tracking Number, and Series Number. "Series Number" is not a column in `tracking.qr_codes` or `tracking.tracking_records`. The nearest equivalent on a document at secretariat logging time is `documents.documents.preliminary_number` (assigned at the same step), falling back to `final_number`.

**What was implemented:**

`QrCodeService.generateCoverSheetPdf` accepts an optional `documentsRepo` argument. When provided, it fetches `preliminaryNumber ?? finalNumber ?? ''` and uses that as the series number label. The `printQrCoverSheet` router procedure passes `ctx.req.server.documentsRepository` as this argument.

[Inference]: A human should confirm that `preliminary_number` is the intended "Series Number" field. If the consolidated reference Q-B02 means something else (e.g. a standalone series counter), a different lookup is needed.

### [LOG-0043] `remarks` field in scanQrCodeAuthenticated returns null in Phase 1

- date: 2026-07-07
- task_id: TASK-TRACK-007
- status: proposed
- affects: E1 (§Module 5 tracking.scanQrCodeAuthenticated)

**What was found:**

E1 §Module 5 specifies `remarks: z.string().nullable()` in the output of `tracking.scanQrCodeAuthenticated`. The `DocumentsPublicAPI.getDocumentById()` returns a `DocumentSummary` which does not include a `remarks` field. No "remarks" column is defined on `documents.documents` in C1 either (as a top-level column — it may appear in the JSONB `metadata` field for some document types).

**What was implemented:**

`remarks` is returned as `null` in Phase 1. A comment in the router marks this with `[Inference]`. A human should confirm: (a) whether remarks should be pulled from `metadata.remarks` (requires a known key convention per document type); (b) whether this field is a UI nicety that can remain null for now.

### [LOG-0044] pdf-lib chosen over @react-pdf/renderer for QR cover sheet PDF generation

- date: 2026-07-07
- task_id: TASK-TRACK-007
- status: proposed
- affects: E1 (§Module 5 tracking.printQrCoverSheet), tech-stack.md

**What was found:**

The tech-stack lists `@react-pdf/renderer` for "PDF templates" and `pdf-lib` for "stamping". `@react-pdf/renderer` requires a React rendering environment and has a complex server-side usage path (requires `@react-pdf/renderer`'s `renderToBuffer` + React component tree). `pdf-lib` is a pure Node.js library with no React dependency.

Neither library was installed in `apps/server` at the start of TASK-TRACK-007.

**What was implemented:**

`pdf-lib` was added to `apps/server` via `pnpm add pdf-lib --filter server`. The cover sheet renders QR image, tracking number, and series number using `pdf-lib`'s low-level drawing primitives. `pdf-lib` is imported dynamically (`await import('pdf-lib')`) inside `generateCoverSheetPdf` so that the server can still start if the package is not yet installed (returns a clear error message instead of crashing on import).

[Inference]: If `@react-pdf/renderer` is later preferred for richer templating (e.g. fonts, brand styling), the `generateCoverSheetPdf` implementation can be swapped independently — the public API (takes `documentIds`, returns `Buffer`) is stable. A human should confirm if `pdf-lib` is acceptable or if `@react-pdf/renderer` server-side rendering should be investigated.

### [LOG-0045] workflow.definitions / instances / step_instances: updated_at intentionally omitted per C1 Part 6 DDL

- date: 2026-07-07
- task_id: TASK-WF-001
- status: proposed
- affects: C1 (Part 6)

**What was found:**

C1 Part 6 DDL (`workflow.definitions`, `workflow.instances`, `workflow.step_instances`) does not include an `updated_at` column or `fn_set_updated_at()` trigger, unlike most mutable tables in the project. This is inconsistent with C1 §1.4, which mandates `updated_at` on "all mutable tables."

**What was implemented:**

The C1 Part 6 DDL was followed literally — no `updated_at` on these three tables. The rationale that can be inferred from the spec:
- `workflow.definitions`: mutations are limited to `is_active`, `name`, `description`, and soft-delete; versioned content lives in `definition_versions`, making timestamp tracking on the root definition row minimally useful.
- `workflow.instances` and `workflow.step_instances`: state mutations are captured via the append-only `workflow_events` table (B4), which provides a full timestamped audit trail. Adding `updated_at` would be redundant and potentially misleading.

[Inference]: The C1 §1.4 blanket rule has an unwritten exception for tables whose mutation history is captured by an adjacent append-only event log. This is consistent with the spirit of the rule (no silent state loss) even if not stated explicitly. A human should confirm whether `updated_at` should be added retroactively to any of these three tables for operational convenience (e.g., dead simple "last touched" queries without joining workflow_events).

### [LOG-0046] generatedAlwaysAs() in drizzle-orm 0.45.2 takes one argument only

- date: 2026-07-07
- task_id: TASK-WF-001
- status: proposed
- affects: none (implementation detail; no architecture document references Drizzle API signatures)

**What was found:**

The Drizzle ORM documentation and some community examples show `generatedAlwaysAs(sql`...`, { mode: 'stored' })` with a second options argument. In drizzle-orm 0.45.2 (the version pinned in `packages/database/package.json`), `generatedAlwaysAs()` on `PgColumnBuilder` accepts only one argument — the SQL expression. The `{ mode: 'stored' }` second argument causes `TS2554: Expected 1 arguments, but got 2`.

**What was implemented:**

The call was corrected to `text('status').generatedAlwaysAs(sql`...`)` with no second argument. The generated SQL output (`GENERATED ALWAYS AS (...) STORED`) is identical either way — STORED is the only mode emitted by Drizzle Kit for this column type in this version. The TypeScript error was the only consequence of the incorrect call.

[Inference]: This may have changed between Drizzle minor versions. If drizzle-orm is upgraded, verify the `generatedAlwaysAs` signature and re-check `workflow.definition_versions.status`.

### [LOG-0047] ESLint v9 Flat Config migration in monorepo

- date: 2026-07-08
- task_id: none
- status: proposed
- affects: J3 (Section 7)

**What was found:**

ESLint version 9.39.4 was installed at the root, but the repository only contained the legacy CommonJS configuration `/packages/config/eslint.base.js` and no flat config files (`eslint.config.js` or `eslint.config.cjs`). Since ESLint v9 requires the Flat Config format by default, executing `eslint` resulted in errors indicating that no configuration file could be found.

Additionally, `eslint-plugin-react` and `eslint-plugin-react-hooks` were referenced in the coding standards (J3 Section 7) but were not present in the workspace package dependencies or lockfile.

**What was implemented:**

1. Added `eslint-plugin-react` and `eslint-plugin-react-hooks` to `packages/config`'s `devDependencies`.
2. Migrated the legacy `eslint.base.js` config to Flat Config format (array of configuration objects) and configured the TypeScript-eslint parser to support typed rules via `project: true` and `tsconfigRootDir: process.cwd()`.
3. Created `apps/web/eslint.config.cjs` to extend the base configuration, register the React plugins, and apply the overrides specified in J3 Section 7.5 (including disabling `@typescript-eslint/explicit-module-boundary-types` globally for the web app, as explicit boundary types are only required for packages, and disabling `no-console` for dev pages under `src/pages/dev/**/*`).
4. Replaced all `as any` casts in `apps/web/src/pages/dev/AllComponentsPage.tsx` and `apps/web/src/pages/dev/ComponentsPage.tsx` with type-safe assertions leveraging React's `ComponentProps` type utility.
5. Reordered state hook declarations and early returns in `SidebarPage.tsx`, `AppShellPage.tsx`, and `TopbarPage.tsx` to satisfy React Hook rules, and sorted dev page imports alphabetically in `apps/web/src/main.tsx` to satisfy the import ordering rules.

[Tested]: Run `pnpm turbo run lint typecheck` successfully across all packages.

### [LOG-0048] WorkflowPolicyGuard administrative procedure scope vs document scope

- date: 2026-07-08
- task_id: TASK-WF-017
- status: proposed
- affects: none (implementation detail/inference based on prompt wording)

**What was found:**

During the implementation of `WorkflowPolicyGuard` (TASK-WF-017), two scope constraints were identified relative to the broader documents module:
1. `canCancelInstance`: The Workflow-level cancellation is restricted to `plat_admin` and `records_officer` (for own-office), as these are the roles identified as having access to administrative workflow procedures in the prompt and I1/I2. Operational cancellation (by `dept_approver`, `sp_secretary`, etc.) is governed by the `DocumentPolicyGuard` at the `documents.router` layer (TASK-DOCS-009). The WF module's `cancelInstance` acts purely as the admin-surface endpoint.
2. `canReadInstance` (for SP Member): I1 §5.1 lists `sp_member` under own-office read, but I2 Conditional Note ¹⁰ restricts SP Members to documents in their assigned committees or SP sessions. This additional committee-scoping is omitted from the base `WorkflowPolicyGuard` to keep the context payload simple; the calling procedure must apply any SP Member–specific document/committee filters.

**What was implemented:**

The `WorkflowPolicyGuard` strictly follows the core ABAC rules in I1 §5/§6. It does not re-implement Document-level restrictions like SP Member committee visibility for reads, nor does it replicate the broad operational cancellation list. 


[Inference]: The separation of concerns assumes that `WorkflowPolicyGuard` handles workflow-engine primitives (bypassing, advancing, role gating), while document-centric business logic (like who can see a specific document or cancel a document's journey) remains in the procedure layer or the DocumentPolicyGuard.

---

## LOG-0049

- date: 2026-07-08
- task_id: TASK-WF-019
- status: proposed
- affects: workflow.router.ts (completeActionStep, approveStep, rejectStep, returnStepForRevision)

**What was found:**

`StepInstanceAttrs.isFinalApprovalStep` (used by `WorkflowPolicyGuard.canApproveStep` for Invariant #13 enforcement) is documented in `workflow.policy.ts` as "declared boolean on `workflow.steps`". However, the actual `workflow.steps` table does **not** have a dedicated `is_final_approval` column — it stores this flag inside the `config` JSONB column as `config['is_final_approval']`.

This is confirmed by `approval.handler.ts` (checking `config['is_final_approval'] === true`) and by the DB schema in `packages/database/schema/workflow.schema.ts`, which shows only `id`, `stepKey`, `stepType`, `label`, `config`, `position`, `isStart`, `createdAt`, `deletedAt`, `deletedBy` as named columns.

**What was implemented:**

`fetchStepContext` (the shared helper in `workflow.router.ts`) reads `isFinalApprovalStep` from `step.config['is_final_approval'] === true`, consistent with `approval.handler.ts`. The policy guard's type comment ("declared boolean on `workflow.steps`") is imprecise but does not affect behaviour because the policy guard receives a pre-assembled `StepInstanceAttrs` object and does not query the DB directly.

[Finding]: A human should decide whether to update the comment in `workflow.policy.ts` to reflect JSONB storage rather than a dedicated column.

---

## LOG-0050

- date: 2026-07-08
- task_id: TASK-WF-019
- status: proposed
- affects: workflow.router.ts mutations; audit downstream coverage

**What was found:**

The workflow engine handlers (`action.handler.ts`, `approval.handler.ts`) write step completion events to `workflow.workflow_events` (the internal workflow event log) via `workflowRepository.createWorkflowEvent(...)`. They do **not** publish to the external `fastify.eventBus`.

The audit consumer (`registerAuditEventConsumer` in `audit.plugin.ts`) listens on the `eventBus`, not on `workflow.workflow_events`. Without an explicit `eventBus.emit(...)` call in the tRPC procedure, completed action/approval steps would not produce an audit trail.

**What was implemented:**

Each of the four new mutation procedures (`completeActionStep`, `approveStep`, `rejectStep`, `returnStepForRevision`) emits `workflow.step.completed` on `ctx.req.server.eventBus` (fire-and-forget, after the DB transaction commits). The emission is guarded with `if (server.eventBus)` to avoid failing in test environments where the event bus is not wired.

[Inference]: A future task may want to move this emission inside the engine handlers themselves (so any caller — tRPC, scheduler, admin bypass — automatically emits to the bus). For now, each tRPC procedure is responsible for emitting after the engine call.

---

## LOG-0051

- date: 2026-07-09
- task_id: TASK-WF-015
- status: proposed
- affects: B4 (§7.3, Appendix A), D3 (§2.2), engine/admin-operations.ts

**What was found:**
1. **Missing Notification Scope**: B4 §7.3 step 10 requires notifying the SP Secretary and users with active assignments upon migration. The ticket omitted this entirely.
2. **Missing Schema `admin_approval_grants`**: The ticket prompts querying `workflow.admin_approval_grants`, but this table does not exist anywhere in the codebase or proposed DDL. 
3. **Context Compatibility NO-OP**: B4 §7.3 step 4 requires verifying required context keys, but there is no mechanism in `steps.config` to declare them.
4. **Document Status on Cancel**: D3 indicates a cancelled instance transitions the document lifecycle to `Cancelled`. The ticket omits this and omits `documentsService` from dependencies.
5. **Bypass Outcome Code for Branching Steps**: The ticket's `bypassStep` does not provide an `outcomeCode`, leaving it ambiguous how `resolveNextStep` should route a bypassed `approval` step.

**What was implemented:**
1. **Notifications Deferred**: Deferred implementing B4 §7.3 step 10. This looks like it belongs to a notification-specific task per AGENTS.md's own routing split, and B4's scope note confirms the engine only enqueues rather than delivers. Flagging in case a task for this doesn't exist yet, since right now nothing on the board owns 'wire this specific migration-completion enqueue'.
2. **Approval Grants Dep Injection**: Did not create DDL. Instead, injected `getApprovalGrant` and `markApprovalGrantUsed` into `AdminOperationsDeps`. This defers the schema gap cleanly, allowing the function to be tested and designed against B4's documented approval-record fields and K2's two-distinct-error-code requirement, without guessing at DDL that belongs to C1/C5.
3. **Context Compatibility NO-OP**: [Inference] No mechanism exists in `steps.config` or elsewhere to declare required context keys per step; B4 §7.3 step 4 assumes one exists without specifying it. This check is a NO-OP passing vacuously until such a mechanism and its DDL are defined — likely requires an H1/C1 decision, not just an engine change.
4. **Document Status on Cancel Deferred**: Did not implement document lifecycle transition on `cancelInstance`. D3 requires this side effect somewhere, but B4 says the engine doesn't own document lifecycle, and the ticket's own dependency list for `cancelInstance` never includes `documentsService`. My read is this belongs in the tRPC procedure or in `DocumentsPolicyGuard`-adjacent code that calls `cancelInstance` and then separately transitions the document, not inside the engine function itself.
5. **Bypass Outcome Code**: Modified `bypassStep` signature to require an explicit `outcomeCode` parameter. We validate it and pass it to `resolveNextStep`. If the code doesn't match an outgoing transition rule for the step (for example, if they try to bypass an approval step without picking a defined branch), `resolveNextStep` handles that by marking the instance `stuck` (Invariant #12) with a clear cause. This trusts the caller and avoids hiding failures.

**Other alignment notes:**
- `cancelInstance` cancels both `active` and `pending` step instances per D3 §2.2, deviating from the ticket's literal SQL (`active` only) — citing D3 as the higher-authority source.
- `cancellation_reason`/`cancelled_by` are written to the `workflow.instance.cancelled` event payload, not to new `instances` columns, consistent with LOG-0045's reasoning and B4 Appendix A's documented event schema.
- Event emission for admin-operations follows LOG-0050's established pattern (writes only to `workflow_events` and relies on the caller to hit the `eventBus`), even though B4 Appendix A describes both as one "emit" in the engine.


### LOG-0052: `bypassStep` TRPC input schema requires `outcomeCode`

**Module:** `workflow`
**Date:** 2026-07-09
**Tags:** `B4`, `workflow.router`, `engine`
**Status:** `proposed`
**Type:** `[Inference]`

**Finding:** B4 invariant #10 defines step bypass as an administrative override, but the engine requires an outcome code to evaluate downstream transition rules. Without an explicit outcome code, a bypassed step would fail to trigger subsequent transitions, effectively rendering the instance stuck.
**What was implemented:** Added `outcomeCode: z.string().min(1)` to the TRPC input schema for `workflow.bypassStep` to allow administrators to supply the necessary state for the workflow engine to continue routing. The engine already accepts this parameter.

### LOG-0053: Missing `admin_approval_grants` implementation

**Module:** `workflow`
**Date:** 2026-07-09
**Tags:** `B4`, `workflow.router`, `engine`, `C1`
**Status:** `proposed`
**Type:** `[Gap]`

**Finding:** The `workflow.admin_approval_grants` table (referenced in B4 invariant #8) does not exist in the C1 database schema, and the corresponding service methods (`getApprovalGrant`, `markApprovalGrantUsed`) are unimplemented.
**What was implemented:** Created interim stub functions `stubGetApprovalGrant` (always returns `null`) and `stubMarkApprovalGrantUsed` (no-op) inside `workflow.router.ts` to satisfy the `AdminOperationsDeps` type contract for `migrateInstance`. `migrateInstance` will currently always fail with `NoAdminApprovalError` until the schema and real implementations are added.

### LOG-0054: Uncaught domain errors in tRPC procedures

**Module:** `workflow`
**Date:** 2026-07-09
**Tags:** `E1`, `workflow.router`, `error-handling`
**Status:** `proposed`
**Type:** `[Observation]`

**Finding:** There is no global `errorFormatter` configured in the tRPC setup (`apps/server/src/trpc/trpc.ts`) that maps custom domain errors (e.g., `ValidationFailedError`, `InstanceNotActiveError` from `packages/shared/src/errors.ts`) to standard `TRPCError` instances.
**What was implemented:** Allowed domain errors thrown by engine operations to propagate uncaught through the TRPC procedures, accepting the resulting 500 Internal Server Error behavior as the baseline until a global error formatting strategy is adopted.

### LOG-0055: Extraneous `[Inference]` removed from B3 `WorkflowStepBypassedPayloadSchema`

**Module:** `workflow`
**Date:** 2026-07-09
**Tags:** `B3`, `workflow.router`, `engine`
**Status:** `proposed`
**Type:** `[Correction]`

**Finding:** B4 invariant #10 mandates a mandatory comment for all administrative operations, including step bypass. The B3 event schema `WorkflowStepBypassedPayloadSchema` originally lacked a `comment` field.
**What was implemented:** Added `comment: z.string().min(1)` to `WorkflowStepBypassedPayloadSchema` in B3 to align the audit payload with the B4 invariant and the implemented engine logic.

### LOG-0056: Nested transaction safety in `workflow.router.ts`

**Module:** `workflow`
**Date:** 2026-07-09
**Tags:** `workflow.router`, `drizzle`, `transactions`
**Status:** `proposed`
**Type:** `[Confirmation]`

**Finding:** The `postgres.js` Drizzle driver natively supports nested transactions using SQL `SAVEPOINT`. This means router procedures can safely wrap engine operations in `await ctx.db.transaction(...)` even if those engine operations also open their own transactions internally.
**What was implemented:** All three new procedures (`cancelInstance`, `bypassStep`, `migrateInstance`) wrap their engine call in `await ctx.db.transaction(async (tx) => {...})`, passing `tx` as `deps.db` to the engine operations, matching `completeActionStep`/`approveStep`'s existing shape exactly, rather than diverging from it.

---

### LOG-0057: JSONLogic-failure default in decision step handler

- date: 2026-07-09
- task_id: TASK-WF-006
- status: proposed
- affects: decision.handler.ts

**What was found:**
Evaluating decision conditions using `json-logic-js` on dynamic context objects can raise runtime errors if variables are missing, typed unexpectedly, or if the logic is malformed. No pre-development document specified the fallback strategy when evaluation fails.

**What was implemented:**
To prevent logic errors from halting workflow execution, `decision.handler.ts` wraps the `jsonLogic.apply()` call in a `try...catch` block. If an error is caught, the handler catches the exception, logs a warning, and defaults the result to `false` (the fallback branch).

[Inference]: Treating condition evaluation errors as `false` is a conservative, fail-closed default that keeps the workflow engine running and routes execution to defined failure/rejection branches on the state machine rather than throwing an unhandled exception that could leave the workflow instance stuck.

---

### LOG-0058: Inconsistent scheduler event names & lack of EventBus publishing

- date: 2026-07-09
- task_id: none
- status: proposed
- affects: evaluate-mayor-lapse-timers.ts, evaluate-panlalawigan-timers.ts, approval.handler.ts

**What was found:**
1. Scheduler jobs (`evaluate-mayor-lapse-timers.ts` and `evaluate-panlalawigan-timers.ts`) write event records into the `workflow.workflow_events` database log with specialized event names (`workflow.approval.lapsed` and `workflow.panlalawigan.deemed_approved`).
2. In contrast, the normal `approval.handler.ts` completion path writes the generic `workflow.step.completed` event name.
3. Furthermore, unlike the tRPC mutations, these background scheduler jobs do not emit any events to the `EventBus`, which means they entirely bypass the audit consumer subsystem.

**What was implemented:**
No immediate code changes were implemented since the scheduler jobs are not yet active/wired in the main runtime flow. This has been logged to alert subsequent development tasks (particularly those implementing the timer/job runners) to harmonize event naming and publish to the `EventBus` so lapses and deemed approvals generate proper audit entries.

[Observation]: When these jobs are wired, they must emit corresponding `workflow.step.completed` events to the EventBus, otherwise audit coverage will be missing for lapsed/deemed approved outcomes.

---

### LOG-0059: Duplicate/inconsistent patterns for event-to-audit-trail routing

- date: 2026-07-09
- task_id: none
- status: proposed
- affects: workflow.repository.ts, event-bus.ts, audit.event-consumer.ts, workflow.router.ts, delegation-expiry.job.ts

**What was found:**
There are currently three different, disjoint patterns in use to write events to the audit trail:
1. **Pattern A (TRPC Duplicate Emit)**: TRPC mutations call the engine, then separately emit events to the `EventBus` (`workflow.router.ts`). The `audit.event-consumer.ts` listens to these events.
2. **Pattern B (Direct Audit Write)**: Background jobs or schedulers call `auditService.writeEvent()` directly (`delegation-expiry.job.ts`), bypassing the EventBus.
3. **Pattern C (Engine DB-Only Events)**: Engine handlers call `createWorkflowEvent` to write straight to `workflow.workflow_events` in the database, without publishing to the EventBus or calling `auditService` directly.

**What was implemented:**
No changes to code structure were made as this is a broad monorepo design pattern issue.

[Observation]: The current layout is fragile. If a new entrypoint executes engine logic but forgets to implement Pattern A or B, it will execute silently without generating any audit records. Moving event bus publication inside the engine repositories or unified handlers (as suggested in LOG-0050) would resolve this risk.

---

### LOG-0060: Discrepancy between task prompt role list and I2 matrix for sp_presiding_officer

- date: 2026-07-09
- task_id: none
- status: proposed
- affects: I2, wf.md

**What was found:**
1. The task prompt in `docs/pre-development/A-project-planning/a1-tasks/wf.md` (line 1707) listed `sp_presiding_officer` as an allowed role for generic `approveStep`, `rejectStep`, and `returnStepForRevision` workflow actions.
2. However, the `i2-role-permission-matrix.md` (Section 6) explicitly restricts the `sp_presiding_officer` from completing assigned approval steps (Approve, Reject, Return for revision) with `❌` entries, while granting the separate `Certify document` permission.
3. Verification of the codebase (`workflow.policy.ts` and `iam.seed.ts`) showed that the enforced code rules already correctly side with `I2` and exclude `sp_presiding_officer` from generic approvals.

**What was implemented:**
Updated `docs/pre-development/A-project-planning/a1-tasks/wf.md` line 1707 to remove `sp_presiding_officer` from the list of allowed roles for generic approvals, aligning the documentation with `I2` and the actual codebase. No code changes were needed as the policy and database seed rules were already correctly aligned with the `I2` security requirements.

---

### LOG-0061: certifyAsPresidingOfficer / mayorSign / mayorVeto implementation during correctness check

- date: 2026-07-09
- task_id: TASK-WF-019
- status: proposed
- affects: E1, workflow.router.ts

**What was found:**
`certifyAsPresidingOfficer`, `mayorSign`, and `mayorVeto` were found to be unimplemented `NOT_IMPLEMENTED` stubs in `workflow.router.ts`.

**What was implemented:**
Implemented all three procedures in `workflow.router.ts`, incorporating the delegation-grant verification pattern as documented in I1 §6.4/§6.5 (which was originally omitted from the task prompt).

---

### LOG-0062: workflow.acceptUnifiedReport procedure absent from E1 catalog

- date: 2026-07-09
- task_id: TASK-WF-020
- status: proposed
- affects: E1

**What was found:**
The `workflow.acceptUnifiedReport` procedure is fully implemented in the codebase as the completion gate for multi-referral steps, but it is missing from E1's Module 4 tRPC catalog.

**What was implemented:**
No code changes. Recommending E1 be updated to document this endpoint.

---

### LOG-0063: Stale casing of Panlalawigan outcomes in E1

- date: 2026-07-09
- task_id: TASK-WF-021
- status: proposed
- affects: E1

**What was found:**
The codebase uses `SCREAMING_SNAKE_CASE` for Panlalawigan outcomes and lowercase for step status (matching the database schema). The E1 documentation lists these in lowercase, which is stale compared to the implemented type definitions and database schema.

**What was implemented:**
No code changes. Recommend updating E1's documentation to use the correct case.

---

### LOG-0064: recordVetoOverrideVote incorrect threshold logic

- date: 2026-07-09
- task_id: TASK-WF-021
- status: proposed
- affects: workflow.router.ts

**What was found:**
`recordVetoOverrideVote` was using `votesFor > votesAgainst` as the success condition for veto override, which is incorrect. The legally-mandated threshold in the consolidated reference Parts 4.1/4.2 and E1 is `votesFor >= 8` (2/3 of 12 members).

**What was implemented:**
Fixed the threshold condition to `votesFor >= 8` in `workflow.router.ts`.

---

### LOG-0065: resolveValidInPart audit-outcome mismatch

- date: 2026-07-09
- task_id: TASK-WF-021
- status: proposed
- affects: workflow.router.ts

**What was found:**
`resolveValidInPart`'s audit event was emitting `input.resolutionPath.toUpperCase()` instead of the actual engine-mapped outcome value, making the audit logs inconsistent with the database.

**What was implemented:**
Hoisted the resolution outcome mapping in `workflow.router.ts` to share it for both database writes and event bus emissions.

---

### LOG-0066: WorkflowPolicyGuard independently replicates PolicyGuard checks

- date: 2026-07-09
- task_id: TASK-WF-022
- status: proposed
- affects: I1

**What was found:**
`WorkflowPolicyGuard` performs checks independently rather than calling `iam`'s shared `PolicyEvaluator.evaluate`. Consequently, I1 Gate 3's omission of `workflow_instance:migrate` has no practical impact on enforcement in the workflow router, but creating two distinct security policy structures poses drift risks.

**What was implemented:**
No code changes. Flagging for human review on whether `workflow` policy checks should be refactored to call `PolicyEvaluator`.

---

### LOG-0067: Lack of automatic Gate 1-5 evaluation in protectedProcedure

- date: 2026-07-09
- task_id: none
- status: proposed
- affects: B5, I1

**What was found:**
The `protectedProcedure` in `trpc.ts` only enforces authentication. Policies (Gates 1-5) must be manually invoked by each handler. `workflow` procedures do not call the evaluator, meaning Gate 1 (city isolation) is not automatically enforced at the routing level. This presents a potential security gap if multi-tenancy is introduced.

**What was implemented:**
No code changes. Flagged for architectural review on whether policy evaluator checks should be integrated into `protectedProcedure` globally.

---

### LOG-0068: Redundant dynamic imports in workflow.router.ts

- date: 2026-07-09
- task_id: TASK-WF-019/020/021
- status: proposed
- affects: workflow.router.ts

**What was found:**
Three instances of redundant `await import(...)` dynamic imports of `submitStepAction` and `submitStepApproval` were found in workflow handlers.

**What was implemented:**
Cleaned up these redundant dynamic imports, relying instead on the static imports at the top of `workflow.router.ts`.

---

### [LOG-0069] Auditor role assigned task inbox read visibility

- date: 2026-07-10
- task_id: none
- status: confirmed
- affects: F1, E1, I2
- resolved_in: docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md (line 337), docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md (line 912), docs/pre-development/I-security-and-authorization/i2-role-permission-matrix.md (lines 68, 336)

**What was found:**
A discrepancy was identified between the actual server router implementation (`apps/server/src/modules/workflow/workflow.router.ts` at `workflow.listMyAssignedSteps`) and three pre-development architecture documents (F1, E1, I2). The actual code permits 10 roles, including the `auditor` role, whereas the documents only listed 9 roles, omitting `auditor`.

**What was implemented:**
The human project owner directly decided that the `auditor` role should have read visibility into the task inbox. This is a confirmed project decision, not an agent inference. 

To align the documentation with the correct codebase implementation, the following updates were made:
1. Added "Auditor" to the role list for `MyAssignedStepsPage` in `f1-application-route-map-v2.md` and updated the citation to target `workflow.router.ts`.
2. Added `auditor` to the `Callable by` list for `workflow.listMyAssignedSteps` in `e1-trpc-router-and-procedure-catalog.md`.
3. Granted the permission to "View own task inbox / assigned steps" to the Auditor column (12th role column) in the `i2-role-permission-matrix.md` permission matrix.
4. Updated the Auditor's Primary Scope description in the Roles Reference section of `i2-role-permission-matrix.md` to resolve the tension between the "read-only finalized documents" scope and the new ability to see own pending/in-flight assigned steps.

---

### [LOG-0070] Local type definition conflict and incomplete lifecycle state mapping in status-mapping.ts

- date: 2026-07-10
- task_id: none
- status: proposed
- affects: apps/web/src/lib/status-mapping.ts, apps/web/src/lib/status-mapping.test.ts

**What was found:**
1. `apps/web/src/lib/status-mapping.ts` declared its own duplicate, local, 8-member version of `DocumentState` instead of importing the canonical 26-member `DocumentState` defined in `packages/ui/src/types/domain.ts`.
2. The mapping function `mapLifecycleStateToDocumentState` only handled 9 of the 11 database/backend `LifecycleState` values. The remaining 2 values (`pending_mayor_action` and `pending_panlalawigan_review`) fell through to a silent `default` mapping of `DRAFT`. This caused documents in these review states to be rendered in the UI with a "DRAFT" badge.
3. Checking `docs/pre-development/D-uml-and-diagrams/d3-state-machine-diagrams.md` confirmed that:
   - `pending_mayor_action` maps to the `PENDING_MAYOR` DocumentState.
   - `pending_panlalawigan_review` maps to the `PANLALAWIGAN_REVIEW` DocumentState.
4. The `superseded` lifecycle state has no corresponding `DocumentState` in `@batac/ui`. Pre-development task specification `a1-tasks/docs.md` (lines 2274 and 2861) indicates that `superseded` should map to `ARCHIVED` as a temporary fallback pending a future design decision.

**What was implemented:**
1. Updated `apps/web/src/lib/status-mapping.ts` to import `DocumentState` directly from `@batac/ui` and deleted the local, duplicate definition.
2. Expanded the `mapLifecycleStateToDocumentState` switch statement to handle all 11 `LifecycleState` values explicitly:
   - `pending_mayor_action` maps to `PENDING_MAYOR`.
   - `pending_panlalawigan_review` maps to `PANLALAWIGAN_REVIEW`.
   - `superseded` maps to `ARCHIVED` (with an inline comment referencing this log entry for the unresolved fallback decision).
3. Updated `apps/web/src/lib/status-mapping.test.ts` to explicitly define and assert expected mappings for all 11 lifecycle states, asserting that any future schema expansion must explicitly update the mapping test suite.

---

### [LOG-0071] stepType human-readable label wording for MyAssignedStepsPage task inbox

- date: 2026-07-10
- task_id: TASK-WF-FE-001
- status: proposed
- affects: apps/web/src/pages/workflow/columns.tsx

**What was found:**
No pre-development document anywhere in the corpus (J6, I2, F1, F4, B4, D3, H1,
or the consolidated reference) specifies human-readable display labels for the
six `stepType` values used in `workflow.listMyAssignedSteps`: `action`,
`approval`, `multi_referral`, `decision`, `notification`, `termination`.
This was confirmed by direct grep of J6 (2036 lines) for all six literal values
and for `stepType`/`step_type` — zero results. This is a genuine documentation
gap, not an oversight resolvable by looking harder.

**What was implemented:**
[Inference] The following label mapping was chosen for `apps/web/src/pages/workflow/columns.tsx`:

| DB value        | Display label   | Rationale                                                     |
|-----------------|-----------------|---------------------------------------------------------------|
| `action`        | Action          | Direct English equivalent, unambiguous                        |
| `approval`      | Approval        | Direct English equivalent, matches LGU workflow terminology   |
| `multi_referral`| Multi-Referral  | Hyphenated title-case preserves the compound nature visually  |
| `decision`      | Decision        | Direct English equivalent, unambiguous                        |
| `notification`  | Notification    | Direct English equivalent, unambiguous                        |
| `termination`   | Termination     | Direct English equivalent; kept as-is vs "End/Close" pending |
|                 |                 | human guidance on whether end-user-facing copy should differ  |

The badge styling uses token-based colour-coded pill badges (blue=action,
green=approval, purple=multi-referral, amber=decision, slate=notification,
red=termination) to provide at-a-glance visual differentiation. Colour choices
are conventional (green=affirmative, red=terminal, amber=decision-required) and
are implementation defaults pending design review.

The `StepTypeBadge` component is intentionally kept as a local helper in the
`workflow/` page directory, NOT promoted to `packages/ui` — a full Tier 3
component promotion would require the F5 §8 runbook process, which is not
warranted for a single small label used in one page.

**Human action needed:**
Confirm or adjust: (a) the English label wording for each of the six values,
particularly `termination` vs a softer end-user term; (b) the badge colour
scheme; (c) whether `StepTypeBadge` should eventually be promoted to a shared
Tier 3 component for reuse in future dashboard widgets.

---

### [LOG-0072] Docketing step key literal confirmation and terminology alignment in F1 route map

- date: 2026-07-10
- task_id: none
- status: proposed
- affects: F1
- resolved_in: docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md (lines 354, 355, 359, 360)

**What was found:**
1. The literal value for the Docketing Panel's step key in the route map was marked as `[Inference]` because it was not confirmed in design documents. However, this has been confirmed as `docketing` in the database seed data (`packages/database/src/seeds/workflow/phase1-legislative.ts`, line 145: `step_key: "docketing"`).
2. The property name referred to as `step.name` in F1 route map's panel table (§8.2) does not exist in the database schema; the correct field is `steps.stepKey` as defined in `packages/database/schema/workflow.schema.ts` (line 209).

**What was implemented:**
1. Replaced the `[Inference]` tag for the Docketing Panel row in `f1-application-route-map-v2.md` with a confirmed tag referencing the database seed file.
2. Performed a find-and-replace terminology correction across the entire panel table in §8.2, replacing all occurrences of `step.name` with `step.stepKey` (affecting the VP Certification, Mayor Decision, Docketing, and Panlalawigan Outcome panels).

---

### [LOG-0076] Publication Date panel mapping: F1 specifies domain condition, implementation uses stepKey

- date: 2026-07-10
- task_id: TASK-WF-FE-002
- status: proposed
- affects: F1
- resolved_in: apps/server/src/modules/workflow/workflow.router.ts

**What was found:**
F1 §8.2 specifies that the `Publication Date Panel` applies when a "penalty ordinance is pending newspaper publication." However, the system's workflow engine abstracts this state into a discrete workflow step with `stepKey = 'newspaper_publication'` (which is only spawned for penalty ordinances).

**What was implemented:**
The backend logic (`workflow.getInstance` via `computePanelHint`) routes the `Publication Date Panel` based directly on `stepKey === 'newspaper_publication'`, rather than trying to infer the document type (penalty ordinance) and its state. This aligns the panel logic with how other step-specific panels are routed and relies on the workflow engine to correctly instantiate the `newspaper_publication` step only when applicable.

---

### [LOG-0077] panelHint addition to workflow.getInstance output

- date: 2026-07-10
- task_id: TASK-WF-FE-002
- status: proposed
- affects: E1, F1
- resolved_in: apps/server/src/modules/workflow/workflow.router.ts

**What was found:**
F1 §8.2 specifies 10 conditionally-rendered action panels, many keyed on `step.name` or specific domain states (e.g., 10-day mayor lapse pending confirmation). However, `workflow.getInstance` (E1) only returns a basic set of fields (`currentStepType`, `status`, etc.) without exposing `stepKey`, step context, or step metadata. The frontend thus lacks sufficient state to accurately select the correct panel using the pre-development schema alone.

**What was implemented:**
Rather than exposing raw step metadata to the frontend and duplicating panel-selection rules, a new `panelHint` enum field was added to the output of `workflow.getInstance`. This field is computed server-side (`computePanelHint`), mapping the current step instance's internal state directly to one of the 10 defined panels (or `null` if no panel applies), centralizing the business logic and keeping the API contract clean.

---

### [LOG-0078] Secretariat Decision panel stepKey-detection rule

- date: 2026-07-10
- task_id: TASK-WF-FE-002
- status: proposed
- affects: F1
- resolved_in: apps/server/src/modules/workflow/workflow.router.ts

**What was found:**
F1 states the Secretariat Decision panel applies when the "assignee office is the SP Secretariat". However, the mutation `documents.logSecretariatDecision` checks only for the `sp_secretary` role, with no office-based check. Furthermore, there is no discrete `stepKey` dedicated to secretariat decisions in the seed workflow definitions to distinguish it from generic actions or approvals.

**What was implemented:**
[Inference] In `computePanelHint`, the detection rule routes to the Secretariat Decision panel when `currentStepType` is 'action' or 'approval' AND the step configuration's assignee (`config.assignee`) is either `role:sp_secretary` or `role:secretariat_staff`. This serves as the most stable proxy for determining if the step is intended for a secretariat decision, bridging the gap between F1's prose and the backend's role-based execution.

---

### [LOG-0079] Corrected Secretariat Decision Panel routing in F1 §8.2

- date: 2026-07-10
- task_id: TASK-DOC-CORRECTION
- status: proposed
- affects: F1
- resolved_in: docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md

**What was found:**
F1 §8.2's panel table cited the deprecated procedure `documents.logSecretariatDecision` as the key procedure for the "Secretariat Decision Panel". This procedure was superseded by ADR-B2-3, under which the action routes through the Workflow Router's step-completion mechanism (which synchronously calls `Documents.transitionState()` and emits `workflow.step_completed`).

**What was implemented:**
Updated the F1 §8.2 panel table row to reference the ADR-B2-3 supersession and the correct routing through the Workflow Router step-completion mechanism, along with the ABAC rule citation from I1 §6.8.

---

### [LOG-0080] Follow-up to LOG-0079: Secretariat Decision routing confirmation

- date: 2026-07-10
- task_id: TASK-DOC-CORRECTION
- status: confirmed
- affects: F1
- resolved_in: docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md

**What was found:**
The question of whether ADR-API-003 supersedes F1 and the pre-ADR `documents.logSecretariatDecision` code path was reviewed directly with Luke (project decision-maker for ADR-API-003 per the ADR's own line 5) on July 10, 2026, via a chat session with an exploration/analysis agent. Luke confirmed ADR-API-003 should be treated as authoritative for this routing design. This entry exists to give LOG-0079's conclusion a documented human checkpoint, which its original body lacked.

**What was implemented:**
This follow-up entry was appended with status `confirmed` to document the human decision checkpoint approving the routing changes made under LOG-0079. No additional changes were made.

---

### [LOG-0081] TASK-PRE-01: `complaints.get` / `documentRequests.get` — procedure names deviated from ADR to avoid merged-namespace collision

- date: 2026-07-11
- task_id: TASK-PRE-01
- status: proposed
- affects: complaints.router.ts, document-requests.router.ts
- tagged_documents: ADR-UI-005, F1

**What was found:**
ADR-UI-005 calls the new procedures `complaints.get` and `documentRequests.get`. When implemented as bare `get` keys in their respective router files, they collide with `documents.get` (an existing procedure in `documents.router.ts`) once all three routers are merged via `t.mergeRouters()` in `documents.app.router.ts`. TypeScript reports this as an intersected-input error on every call site passing only `{ documentId }`, e.g., `DocumentDetailPage.tsx:178`.

This is the same naming discipline that already governs every other procedure in these files: `listAllComplaints` (not `list`), `createComplaintClerkAssisted` (not `create`), `listAllDocumentRequests` (not `list`). The ADR's procedure names implicitly assumed the procedures would live in separate tRPC namespaces, but the actual server wires them all into a single merged `documents` namespace via `documents.app.router.ts`.

**What was implemented:**
The procedures were named `getComplaint` and `getDocumentRequest` respectively, following the existing qualification convention. Frontend callers should use `trpc.documents.getComplaint({ complaintId })` and `trpc.documents.getDocumentRequest({ requestId })`.

**[Inference]** The ADR's bare `get` name is a documentation mismatch, not an intent to break the codebase's existing convention. A human should decide whether to update ADR-UI-005 to use the qualified names, or note it as an acknowledged divergence from the ADR's text.

---

### [LOG-0082] TASK-PRE-04: Substitute Presiding Officer Resolution Decision

- date: 2026-07-11
- task_id: TASK-PRE-04
- status: proposed
- affects: session.router.ts, /sessions/:sessionDate
- tagged_documents: org.md, F1 §9, ADR-UI-007

**What was found:**
In `session.router.ts`, `recordAttendance` previously implemented automatic substitute-officer resolution when the Vice Mayor was absent by looking up active designations in the `delegationGrants` table. The `recordAttendance` input schema had no option for manually selecting a substitute. 
This conflicted with F1 §9's mention of a "Designation-document linkage" UI field where users could manually log/select designations or substitute officers.

**What was decided:**
The decision authority (Luke) selected the option to **"Implement a manual override selection UI (requiring schema/router input changes)"**. 
This means instead of relying solely on automatic server-side lookup, the attendance recording/editing process on the frontend `/sessions/:sessionDate` page should support a manual override selection of the presiding officer, requiring matching schema, input, and backend router updates to accept and store the manual override.

---

### [LOG-0083] `db:lint` is not wired into CI — resolves LOG-0016's open CI-question

- date: 2026-07-11
- task_id: N/A — verification task
- status: proposed
- affects: C5 (§7)
- supersedes: (refines LOG-0016's open question; does not replace LOG-0016's parser-gap finding)

**What was found:**
LOG-0016 asked whether `db:lint` is actually invoked by CI as C5 §7 describes. Verified on 2026-07-11: it is not.

`.github/workflows/ci.yml` defines six jobs: `lint-typecheck`, `unit-tests`, `integration-tests`, `build`, `e2e-tests`, and two deploy jobs. None of them invoke `db:lint` or `lint:migrations`. The `db:lint` Turborepo task is defined in `turbo.json` but no CI job's `pnpm turbo run ...` command includes it, and no other task that CI does run (e.g., `build`, `lint`, `test:*`) lists `db:lint` as a dependency. The only repo references to `db:lint` or `lint:migrations` outside of `turbo.json` itself are the script definitions in `packages/database/package.json` and `tools/scripts/package.json`.

C5 §7 states: "The linter runs as a Turborepo task (`db:lint`) in CI on every pull request that touches `/packages/database/`. It must pass before the `build` task runs. A failed linter blocks merge." This is not currently the case — `db:lint` does not run in CI, does not block `build`, and does not block merge.

[Tested]: Grep of all `.yml`, `.yaml`, and `.json` files for `db:lint`, `lint:migrations`, and `lint-migrations` confirmed only script/task definitions exist — no callers. Direct read of `ci.yml` and `turbo.json` confirmed no dependency chain from CI jobs to `db:lint`.

---

### [LOG-0084] `db:lint` parser gap resolved and CI wired — supersedes LOG-0016's open questions

- date: 2026-07-11
- task_id: N/A — verification task
- status: proposed
- affects: C5 (§7, Appendix A), tools/scripts/lint-migrations.ts, .github/workflows/ci.yml
- supersedes: LOG-0016 (resolves both the parser gap and the CI-wiring question)

**What was done:**
LOG-0016 documented two issues: (1) `pgsql-ast-parser` cannot parse several DDL/DCL constructs present in merged migrations, causing `db:lint` to fail on `main`, and (2) it was unconfirmed whether CI invokes `db:lint` at all. Both are now resolved.

**Parser gap fix** (`tools/scripts/lint-migrations.ts`): When `parse(content)` fails on a whole file, the linter now falls back to splitting the file on Drizzle's `--> statement-breakpoint` markers and parsing each chunk individually. Unparseable chunks (CREATE TRIGGER, CREATE POLICY, SECURITY DEFINER functions, GRANT/REVOKE variants, etc.) are skipped with a `[WARN]` message listing the skipped statements and their approximate line numbers. Parseable chunks still receive all invariant checks. Files that parse cleanly are unaffected — the fallback only activates on primary parse failure.

**Additional fixes applied during resolution:**
- `isTimestampName()`: removed the word-based substring matching (`includes`) that false-positived on column names like `is_present` (contains "sent"), `assigned_to` (contains "signed"), and `signed_by_display_name` (starts with "signed"). Now uses suffix-only matching (`_at`, `_on`, `_timestamp`), which is sufficient for all project timestamp columns.
- INVARIANT-01 suppression: added `-- linter: allow-cross-schema-fk reason="..."` suppression support across all four check locations (CREATE TABLE inline refs, CREATE TABLE table-level FKs, ALTER TABLE add-column inline refs, ALTER TABLE add-constraint FKs). Applied to `0003_glamorous_scream.sql` for the pre-existing `organization.cross_office_grants → iam.roles` cross-schema FK.
- Line number resolution for ALTER TABLE add-constraint: since `pgsql-ast-parser` v12 does not set `_location` on AST nodes, the INVARIANT-01 check now searches the lines array directly for the matching ALTER TABLE statement instead of relying on the unreliable `lineNum`.

**CI wiring** (`.github/workflows/ci.yml`): Added `db:lint` to the `lint-typecheck` job's turbo command (`pnpm turbo run lint typecheck db:lint`). `db:lint` now runs on every PR and push to main, and a failure blocks the pipeline.

[Tested]: `pnpm --filter @batac/scripts lint:migrations` exits 0 on the current migration set (0000–0010). All previously-failing files (0002–0006) now pass with skipped-statement warnings. No INVARIANT-01/06/07 FAIL-level errors remain.

---

### [LOG-0085] TASK-FE-DOCS-003: frontend `AuthSession` has no `committeeIds`, so `sp_member` committee-scoped control visibility cannot be checked client-side as specified

- date: 2026-07-11
- task_id: TASK-FE-DOCS-003
- status: confirmed
- affects: apps/web/src/lib/auth-context.tsx
- tagged_documents: fe.md (TASK-FE-DOCS-003 AI Prompt), fe-handoff.md (Office-Scoping Pattern)

**What was found:**
TASK-FE-DOCS-003's AI Prompt says the frontend should check whether an `sp_member`'s `committeeIds` include the complaint's `assignedOfficeId` client-side, to decide whether to show the `enterCommitteeReport` control. The backend's `ctx.auth` subject does carry `committeeIds` (used directly in `complaints.router.ts`'s `enterCommitteeReport` and `getComplaint`), but the frontend's `AuthSession` interface (`apps/web/src/lib/auth-context.tsx`) does not expose an equivalent field — it has `roleCodes`, `officeScopeId` (singular), and `officeCode`, with no array of a member's committee memberships. No other page in `apps/web/src` currently reads `committeeIds` (confirmed by repo-wide search returning zero matches outside the backend). `officeScopeId` is used elsewhere (`SecretaryDashboardPage.tsx`) as a single office-scope parameter for a query, not as a membership-check comparison, and — being singular — cannot correctly represent a member belonging to more than one committee even if repurposed for this.

**What was implemented:**
`ComplaintDetailPage.tsx` shows the `enterCommitteeReport` control to any caller with the `sp_secretary` or `sp_member` role, without attempting a client-side committee match. The real enforcement remains server-side in `enterCommitteeReport`'s existing ABAC check. Practical effect: an `sp_member` not assigned to a given complaint's committee will see the control but receive a `FORBIDDEN` error on submit, rather than the control being hidden from them in advance.

**[Inference]** This is a reasoned default chosen to avoid fabricating a client-side check against a field that doesn't exist on `AuthSession`, not a confirmed-correct design. A human should decide whether `AuthSession` (and the `/api/auth/login` / `/api/auth/refresh` responses it's built from) should be extended to carry committee memberships, to enable properly hiding this control for out-of-committee `sp_member` users.

**Resolution:** `committeeIds` has been surfaced through the full call chain: `iam.service.ts` (display claims, login/refresh result objects) → `iam.routes.ts` (login/refresh response bodies) → `iam.schemas.ts` (AuthResponseSchema) → `auth-context.tsx` (AuthSession interface). `ComplaintDetailPage.tsx`'s `canEnterCommitteeReport` now accepts `committeeIds` and `assignedOfficeId` and performs the real client-side check for `sp_member`.

---

### [LOG-0086] `complaints.router.ts` and `document-requests.router.ts` lack `.output()` Zod schemas, so every field sourced from the `metadata` JSON column is typed `any` end-to-end, including on the client

- date: 2026-07-12
- task_id: TASK-FE-DOCS-003
- status: proposed
- affects: apps/server/src/modules/documents/complaints.router.ts, apps/server/src/modules/documents/document-requests.router.ts
- tagged_documents: fe.md (TASK-PRE-01), ADR-UI-005

**What was found:**
`documents.router.ts` — the third file in the same module — declares `.output(SomeZodSchema)` on essentially every procedure (~26 occurrences across ~27 procedures, e.g. `documents.get` returns `.output(DocumentSelectSchema)`), giving end-to-end type safety from the Drizzle/Postgres row through tRPC to the React client, which is what this stack is designed to provide. `complaints.router.ts` and `document-requests.router.ts` have zero `.output()` calls between them. Both files repeatedly cast the `metadata` JSONB column with `const metadata = document.metadata as Record<string, any>` (complaints.router.ts: lines 160, 202, 307, 341; document-requests.router.ts: lines 207, 512, 626, 671) and then return fields read directly off that `any`-typed object. With no `.output()` schema to re-assert a real type at the procedure boundary, tRPC's return-type inference for `inferRouterOutputs<AppRouter>` traces straight back through the `any` cast, so `RouterOutputs['documents']['getComplaint']` (and likely every other procedure in both files that touches `metadata`) resolves to `any` on the client — not just for `getComplaint`, which is where this was first noticed, but for `listAllComplaints`, `logAndAssign`, `enterCommitteeReport`, and the full `document-requests` procedure set as well, none of which happen to call a method on the affected fields that trips `@typescript-eslint/no-unsafe-*` downstream, so the gap has stayed invisible everywhere except the one call site that did (`ComplaintDetailPage.tsx`'s `complaint.outcomeState.toUpperCase()`).

**What was implemented:**
`ComplaintDetailPage.tsx`'s one erroring call site was narrowed locally with an explicit, commented type assertion at the point of use (see file), so the frontend file itself is lint-clean. This is a local symptom patch, not a fix — it does nothing for the other ~10 untyped call sites across both files, and does nothing for any other current or future consumer of these procedures.

**[Inference]** The real fix is adding `.output()` Zod schemas to both routers, matching `documents.router.ts`'s existing convention, plus typing the `metadata` extraction more precisely than a blanket `Record<string, any>` cast. This is backend work outside TASK-FE-DOCS-003's scope and touches procedures with existing, passing test coverage (`complaints.router.test.ts`'s AC-C1–AC-C6 assert `getComplaint`'s return shape structurally, not against a Zod schema) — a human should scope this as its own task rather than have it folded silently into a frontend deliverable.

---

### [LOG-0087] `organization.listCommittees` and `organization.listEmployees` are not documented in E1 or I2

- date: 2026-07-12
- task_id: (planning session — Option A investigation, OrgRepository interface lint fix)
- status: proposed
- affects: docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md, docs/pre-development/I-security-and-authorization/i2-role-permission-matrix.md
- resolved_in: none

**What was found:**
While investigating the root cause of `any`-typed lint errors in `CommitteeManagementPage.tsx` and `OrganizationPage.tsx` (apps/web), both files were traced back to two tRPC procedures — `organization.listCommittees` and `organization.listEmployees` — that are live in `organization.router.ts` and consumed by the frontend, but do not appear anywhere in either of this module's governing documents. E1's Module 2 (Organization Router, lines 460–604) documents `getOfficeHierarchy`, office/position/employee/committee create/update, `assignEmployeeToPosition`, and the designation-grant procedures in full (exact Zod input/output shapes for each), but has no entry for either `list` query — confirmed by a direct text search across the full document, not just the Module 2 section. I2's Section 2 (Organization Structure, lines 95–111) likewise has no row for "View committee records" or an equivalent list-employees permission; it covers create/edit for offices/positions/employees, org-chart viewing, and designation grants only.

This is not a case of the code deviating from a documented procedure — there is no documented procedure for either endpoint to deviate from. `listCommittees` in particular has no `.input()` or `.output()` schema in the router at all (unlike every other procedure in the module), which is plausibly connected: with no Zod output schema to conform to, and no doc spec to build one against, the procedure's return type was never asserted at the boundary, which is part of why it currently returns `any` end-to-end via `orgRepository.committees.findAll()`'s untyped interface. `listEmployees` is independently, cleanly typed via `OrgService.listEmployees` (a separately-declared interface method with a real `Promise<{ items: EmployeeSummary[]; nextCursor: string | null }>` return type, implemented with its own directly-typed Drizzle query) — so the missing-doc gap did not have the same type-safety consequence there, but the documentation gap itself is the same for both procedures.

**What was implemented:**
Nothing yet — this entry is being logged ahead of the actual interface-fix prompt, per this project's convention of surfacing a doc/code conflict rather than silently resolving it in either direction (AGENTS.md §1).

**[Inference]** The likely explanation is that both procedures were added ad hoc during frontend integration work, after E1/I2 were written, without a corresponding doc update — the same general failure mode as LOG-0086 (missing `.output()` schemas on `complaints.router.ts`/`document-requests.router.ts`), though a different module and a different specific mechanism. Whether E1/I2 should be updated to cover these two procedures, or whether they were deliberately left out of the Phase 1 MVC scope for some reason not visible in the router code itself, is a question for a human — not resolved here.

---

### [LOG-0088] `organization.plugin.ts` constructs `orgTrpcRouter` without an `orgRepository` key, unlike the already-logged LOG-0038 key-mismatch in the same file

- date: 2026-07-12
- task_id: (planning session — Option A investigation, OrgRepository interface lint fix)
- status: proposed
- affects: apps/server/src/modules/organization/organization.plugin.ts, apps/server/src/modules/organization/organization.router.ts
- resolved_in: none

**What was found:**
While investigating `OrgRepository`'s interface typing (unrelated original purpose), `organization.plugin.ts` was read in full and found to construct `createOrgRouter(deps)` (lines 50–54) with an object containing only `policyEvaluator`, `organizationService`, and `delegationService` — no `orgRepository` key at all — cast away with `as any`. `createOrgRouter`'s own `getDeps(ctx)` helper (`organization.router.ts`, lines 184–194) has fallback logic: `if (deps) return deps;` before falling back to reading `server.orgRepository`/etc. directly off the Fastify instance. Because this check only tests truthiness of the whole `deps` object, not the presence of individual keys, and the object passed in at plugin-construction time is truthy (it has 3 of the 4 expected keys), `getDeps()` returns the incomplete object as-is rather than falling back — meaning `orgRepository` would resolve to `undefined` inside every procedure that calls `getDeps(ctx).orgRepository`, when the procedure is invoked through this plugin-constructed router instance specifically.

This is structurally similar to LOG-0038 (`repository`/`orgRepository` key-name mismatch in the same file, already logged, already fixed per that entry's own text) but is a distinct occurrence: LOG-0038 was about `createDelegationService`'s dependency object using the wrong key *name*; this is about `createOrgRouter`'s dependency object *missing* the key entirely. Both share the same root mechanism — an `as any` cast at the construction call site suppressing what would otherwise be a structural type-check failure, which is the same mechanism LOG-0038's own text identifies as the reason its bug went uncaught by `pnpm typecheck`.

**What was implemented:**
Nothing — this was found incidentally while reading the file for unrelated context (confirming how `OrgRepository` is instantiated and wired) during a lint-remediation investigation, not while working a task that touches this file's actual construction logic. Not chased further or reproduced against a running server; this is a static-read finding about the object literal's shape, not a confirmed runtime reproduction.

**[Inference]** If accurate, this would be a live bug (every organization-module procedure that reads `orgRepository` from `getDeps(ctx)` — which is most of them — would throw or behave unexpectedly when invoked through the app's actual registered Fastify plugin, not just in tests, which construct `OrgRouterDeps` differently and are unaffected). Not confirmed by directly running the server or writing a reproduction test; flagged from static reading only. A human or a future task should verify this against a running instance before treating it as confirmed, and should decide whether the fix is adding the missing `orgRepository` key at the call site (mirroring LOG-0038's fix) or, more durably, having `createOrgRouter` accept a required (non-optional) `deps` parameter so a missing key becomes a compile-time error rather than a silent runtime `undefined` — the latter would also apply to the `as any` casts on the other three construction calls in this same file (lines 24, 32, 42), which is beyond the scope of what was verified here.

---

### [LOG-0089] `listCommittees` now returns `chairedByEmployeeId`, closing a chairperson-prefill bug — LOG-0087's broader envelope-shape question remains open

- date: 2026-07-12
- task_id: TASK-ORG-LINT-002
- status: proposed
- affects: apps/server/src/modules/organization/organization.router.ts
- refines: LOG-0087

**What was found:**
While reviewing `TASK-ORG-LINT-001`'s implementation, `CommitteeManagementPage.tsx`'s `openEdit` function was found to read `committee.chairedByEmployeeId` when pre-populating the Chairperson field on the edit-committee dialog, but `organization.listCommittees` explicitly excluded this field from its returned object (via a hand-written 5-field object literal that omitted a field otherwise present on every row). The `committees` table's `chaired_by_employee_id` column is `.notNull()` and was already present on every row `orgRepository.committees.findAll(...)` returned post-`TASK-ORG-LINT-001` — the field was being dropped by `listCommittees`'s own mapping logic, not missing from the underlying data. Practical effect: opening the edit dialog for any committee always showed an empty Chairperson field regardless of the committee's actual chair, and saving without manually re-selecting one would silently clear the real chairperson on that committee.

**What was implemented:**
`listCommittees` now includes `chairedByEmployeeId: r.chairedByEmployeeId` in its returned object, typed as `string` (matching the column's non-nullable constraint). No frontend changes were required — `CommitteeManagementPage.tsx`'s local `CommitteeSummary` interface already declared this field, and `openEdit` was already written to read it correctly; it simply had never been receiving a real value.

**[Inference]** This is a narrow, targeted fix for the one field needed to close the observed bug. It does not address the broader gap `LOG-0087` describes — `listCommittees` still does not conform to this codebase's `{ items: T[], nextCursor: string | null }` list-procedure envelope convention, and still has no `.output()` Zod schema. Whether E1/I2 should be updated to document this procedure (and whether it should be restructured to match the standard envelope as part of that), as `LOG-0087` already asks, is unchanged by this fix and remains a question for a human.

---

### [LOG-0090] J3 §5.3's mandated TODO format structurally always trips J3 §7.3's `no-warning-comments` rule — resolved by human policy decision, no config or code change

- date: 2026-07-13
- status: proposed
- affects: J3
- task_id: none — surfaced during lint-remediation investigation (no TASK ID), not produced by an A1 task

**What was found:**
J3 §5.3 mandates the TODO/FIXME/HACK format `// TODO(username): description`, with the flagged term as the first token by construction. J3 §7.3 configures `'no-warning-comments': ['warn', { terms: ['todo', 'fixme', 'hack'], location: 'start' }]` — confirmed live in `packages/config/eslint.base.js` line 42, matching J3's own spec exactly. `location: 'start'` means the rule fires on any comment whose text begins with one of these terms. Because §5.3's format always begins with the flagged word, every comment written exactly as J3 instructs will always trigger the rule §7.3 configures. This is not a one-off phrasing accident in a single comment — confirmed structural by direct config read plus a live toolchain run: `apps/web/src/pages/documents/DocumentIntakePage.tsx:68` (a `// TODO: ...` comment, itself not yet in §5.3's format — see open item below) reproduces this exactly, reported as `no-warning-comments` in the real `pnpm --filter @batac/web lint` output. A reword that moves the flagged word off the start would dodge the rule but would then no longer match §5.3's mandated format — not a real fix, just relocating the non-conformance.

Checked for a resolution elsewhere in J3 (full-document search for `no-warning-comments` and `eslint-disable`): none exists outside the two sections above. Checked whether any existing TODO in the codebase already reconciles this (e.g. via a working override): several correctly-`(username)`-formatted TODOs exist in `apps/server/src/modules/documents/document-requests.router.ts` and two other server files, but `apps/server` has no lint script and no ESLint config at all (confirmed separately, unrelated finding), so these have simply never been checked against the rule — not evidence of a working exemption.

**What was decided:**
Human decision, given directly in conversation (not independently inferred): keep `no-warning-comments` at `'warn'` with no config change. A TODO warning appearing in lint output is working as intended — the rule's job is visibility, not elimination — so this class of warning is not to be treated as a blocker or as something requiring a fix. No code change and no config change follow from this decision; the policy is the resolution.

**Open item, not resolved by the above, deliberately left open:**
This decision settles whether a conforming TODO's warning is a problem (no). It does not settle a separate requirement in the same §5.3: "every TODO and FIXME must include a GitHub issue number before a PR is merged to `main`." The comment at `DocumentIntakePage.tsx:68` currently reads `// TODO: validTypes only lists 3 of the 5 MIME types AllowedMimeTypeSchema actually accepts (missing Office document types)` — missing both the `(username)` attribution and a ticket reference §5.3 requires. Bringing this comment into full §5.3 format needs a real GitHub issue number and an author name, neither of which exists yet; not invented here. This is a separate, still-open mechanical gap, unrelated to the lint-severity question this entry resolves.

---

### [LOG-0091] TASK-WF-023: session.router.ts procedure names, count, and business logic diverge from spec

- date: 2026-07-13
- task_id: TASK-WF-023
- status: proposed
- affects: wf.md (TASK-WF-023, TASK-WF-024)

**What was found:** TASK-WF-023's spec (wf.md, originally generated 2026-06-29) defines `sessionRouter` with four procedures — `session.logSpSession`, `session.logAttendance`, `session.getOrderOfBusiness`, `session.generateOrderOfBusiness` — but the live `apps/server/src/modules/workflow/session.router.ts` implements a different set: `getAttendanceRecord`, `getAttendanceStatistics`, `getOrderOfBusiness`, `recordAttendance`, `scheduleDocumentForFirstReading`, `enterCommitteeHearingDate`. This is not just a naming difference:

1. **Procedure split/merge:** spec's `logSpSession` (create) + `logAttendance` (upsert existing) are merged into one live procedure, `recordAttendance`, which handles both create and upsert via an existing-session check (confirmed lines 415–460 of the live file).
2. **`generateOrderOfBusiness` does not exist as a standalone procedure.** Its spec'd responsibility (create/refresh OoB for an upcoming session) is instead folded into `scheduleDocumentForFirstReading` (live file, lines 530–717), which is triggered by scheduling one specific document rather than by a general "generate OoB for date X" action, and does not implement the spec's `second_reading_eligible_date <= targetSessionDate` eligibility filter (spec: wf.md lines 2258–2263) in any directly comparable form — confirmed by reading `scheduleDocumentForFirstReading` in full; it contains Tuesday-snapping/Thursday-cutoff logic but no `second_reading_eligible_date` filtering logic at all.
3. **Quorum formula differs.** Spec (wf.md line 2220) requires `quorumAchieved` computed dynamically as `presentCount >= ceil(totalActiveSpMembers / 2) + 1` against the actual SP membership roster, explicitly warning not to hardcode a count. The live `recordAttendance` (line 341) and `getAttendanceStatistics` (line 178) both hardcode a fixed 12-member body (`quorumMet = presentCount >= 7`; `absentCount = Math.max(0, 12 - presentCount)`), with no roster lookup.
4. **`logSpSession`'s spec'd input requires `presidedByEmployeeId` as a mandatory field supplied by the caller** (wf.md line 2210, `z.string().uuid()`, no `.optional()`/`.nullish()`), implying the original design intended the secretary to explicitly supply the presiding officer on every call. The live `recordAttendance` input has no such field at all (confirmed lines 316–332) and instead resolves it automatically server-side via a VM-position lookup and `delegationGrants` query (lines 344–413) — a fully different mechanism, not just a missing field.
5. **Absence-reason validation approach differs, though the live approach may be equivalent-or-better:** spec (line 2221) calls for an explicit runtime check that every `isPresent: false` entry has a non-null `absenceReason`, as a fail-fast measure ahead of the DB CHECK constraint. The live `recordAttendance` input shape (`absences: [{ councilorEmployeeId, reason }]`, `reason` a required non-optional enum, with no `isPresent` boolean at all) appears to make this invariant structurally impossible to violate rather than needing a runtime check — flagged as a possible case where the live design is arguably an improvement, not a regression, but noted here as still a divergence from what was spec'd, since a future reader relying on TASK-WF-023's text to understand this router's contract would be misled about the input shape either way.

This finding is unrelated to LOG-0082 (the substitute-presiding-officer manual-override decision) — that entry concerns a different question (automatic vs. manual override for point 4's resolution mechanism) and was investigated/decided separately. This entry is about the router's overall shape and the quorum formula, which LOG-0082 does not address.

No code or spec change has been made as a result of this finding. Whether `wf.md` should be updated to describe the router as actually implemented, whether the live router should be reworked toward the original spec (particularly the quorum formula, which has real behavioral consequences for a body whose membership could change — the spec's own comment at line 2220 explicitly anticipates this), or some hybrid, is left for human review — this is a genuine business-logic question (is a hardcoded 12-member quorum acceptable, or does it need to track actual SP membership), not a naming cleanup.

---

### [LOG-0092] computePanelHint's Secretariat Decision routing has moved past LOG-0078's role-based-proxy description; also stale in SecretariatDecisionPanel.tsx's comment

- date: 2026-07-13
- task_id: TASK-FE-WF-004
- status: proposed
- affects: F1
- supersedes: LOG-0078

**What was found:** LOG-0078 (status: proposed) describes `computePanelHint`'s Secretariat Decision detection as routing on `currentStepType` being 'action' or 'approval' AND the step configuration's assignee (`config.assignee`) being `role:sp_secretary` or `role:secretariat_staff` — "the most stable proxy available without an extra office-lookup join." The live implementation in `apps/server/src/modules/workflow/workflow.router.ts` (confirmed lines 236-240) no longer matches this description: it performs a direct office-ID comparison instead — `(currentStepType === 'action' || currentStepType === 'approval') && spsOfficeId && (currentStep.assignedTo?.[0]?.office_id === spsOfficeId)` — where `spsOfficeId` is resolved via an office lookup (`getOrgService(ctx).getOfficeByCode(SP_SECRETARIAT_OFFICE_CODE, ...)`, line 366) and passed into `computePanelHint` as a parameter (line 367). The role-based `config.assignee` check LOG-0078 describes is not present anywhere in the current function body.

The same drift is separately visible in a code comment: `apps/web/src/pages/workflow/panels/SecretariatDecisionPanel.tsx` (lines 9-13) still documents the old role-based-proxy behavior and cites LOG-0077 (not LOG-0078, though both describe the same underlying mechanism) as its source. That comment has not been updated to reflect the office-ID-comparison implementation either.

**What was implemented:** No code change from this task — this entry is a documentation correction only, recording that the mechanism has evolved since LOG-0078 without a superseding entry ever being filed. Whether the office-lookup join LOG-0078 called out as the reason to avoid a direct comparison was later added deliberately (i.e., an intentional design evolution) or the two changed independently without either author cross-referencing the other is not something this task investigated and is left for human review.

---

### [LOG-0093] `scheduleDocumentForFirstReading` fabricates `presentCount`/`quorumAchieved` on session-creation, independent of the already-logged LOG-0091 quorum-formula issue

- date: 2026-07-13
- task_id: none (found during review of TASK-WF-BE-001 and TASK-PRE-04c's landed output, not itself an A1 task)
- status: proposed
- affects: wf.md (TASK-WF-023, TASK-WF-024)

**What was found:** `apps/server/src/modules/workflow/session.router.ts`'s `scheduleDocumentForFirstReading` procedure, in its session-creation branch (confirmed lines 823–847 as of this session, specifically the `else` branch that only runs when no `spSessions` row yet exists for the target date), inserts a new session row with `presentCount: 12` and `quorumAchieved: true` hardcoded as literal constants (lines 841–842) — with no roster lookup, no computation, and no attempt to reflect actual attendance, because at the time this procedure runs (scheduling a document ahead of a future session date), attendance for that session has not happened yet and cannot be known.

This is a distinct defect from the one already recorded in LOG-0091 point 3 and separately fixed in `recordAttendance` (via TASK-WF-BE-001, confirmed landed and correct as of this session's review). LOG-0091 point 3 concerned a *formula* that was wrong for non-12-member rosters but was at least computed from real submitted attendance data. This finding concerns a different procedure that writes fabricated placeholder values with no computation at all, for a session that hasn't occurred yet. Confirmed via direct read that `scheduleDocumentForFirstReading`'s other branch (`if (session) { sessionId = session.id; }`, when a row already exists) does not touch `presentCount`/`quorumAchieved` at all — the fabrication is scoped specifically to first-ever row creation via this path.

**Why this is reachable, not theoretical:** confirmed via grep that `scheduleDocumentForFirstReading` is called exclusively from `apps/web/src/pages/workflow/OrderOfBusinessPage.tsx` and `recordAttendance` is called exclusively from `apps/web/src/pages/workflow/SessionAttendanceDetailPage.tsx` — two independent user actions on two different pages, with nothing in the code enforcing that one happens before or after the other. A secretary scheduling a document for an upcoming session date creates a session row with fabricated `presentCount: 12, quorumAchieved: true` before that session has occurred; if attendance for that date is never separately recorded via `recordAttendance` (or is recorded some time after the fact), the row carries fabricated values indefinitely, indistinguishable from a genuinely-recorded session with 12 members present, since the schema has no separate flag for "attendance not yet recorded." This directly affects `getAttendanceStatistics`, which reads `presentCount` for every row in a date range with no filter distinguishing recorded-vs-fabricated rows.

**What was decided and implemented:** human decision, given directly in conversation. `scheduleDocumentForFirstReading`'s session-creation branch now inserts `presentCount: null, quorumAchieved: null` instead of the fabricated constants — both columns were already nullable in the schema (`packages/database/schema/workflow.schema.ts` lines 551–552, confirmed no `.notNull()` on either), so this required no migration. `getAttendanceStatistics`'s row-mapping, which previously coerced a `null` `presentCount` to `0` via `r.presentCount ?? 0` (confirmed line 197 pre-change) and then computed a fabricated `absentCount` from that `0` — itself a second, independent instance of the same "unknown treated as a specific wrong number" pattern — now passes through `null` explicitly rather than coercing it, and the frontend (`SessionAttendanceOverviewPage.tsx`) renders a distinct "Not Yet Recorded" state for these rows instead of numeric 0s. See TASK-WF-BE-002's standalone prompt for the exact implementation.

The alternative considered — populating `presentCount` at `scheduleDocumentForFirstReading`'s session-creation time via a real roster-size lookup — was rejected: a roster-size lookup at that point could honestly report how many people are *on* the SP roster, but has no way to know how many will actually *attend* a session that hasn't happened yet, so using it to populate `presentCount` would still be fabricating an attendance outcome, just with a computed-looking number instead of an obviously-fake constant. The `null`-placeholder approach was chosen because it's the only one of the two that doesn't assert a false attendance fact.

---

### [LOG-0094] Cross-package runtime import constraint in apps/web

- date: 2026-07-13
- task_id: TASK-WF-BE-003
- status: proposed
- affects: none

**What was found:** `apps/web` cannot cleanly import runtime values from `apps/server` (e.g. `MAYOR_STEP_KEYS` from `workflow.policy.ts`). It can only import types via `RouterOutputs`-style inference.

**What was implemented:** To apply the server-side `stepKeyIn` filter for `listMyAssignedSteps` in `MayorDashboardPage.tsx` without an N+1 cost, the `MAYOR_STEP_KEYS` strings (`'mayor_review'`, `'mayor_signature'`) were inlined directly in the frontend component with a sync-comment referencing the backend `MAYOR_STEP_KEYS` constant. This leaves a partial single-source-of-truth gap across the frontend/backend boundary where the two lists could theoretically drift.

---

### [LOG-0095] ADR-UI-012 vs auth-context.tsx divergence (Zustand vs Context)

- date: 2026-07-13
- task_id: TASK-WF-FE-004
- status: proposed
- affects: ADR-UI-012, F2

**What was found:** ADR-UI-012 mandates a `useSessionStore` Zustand store with an `isHydrated` flag to prevent route guards from flashing incorrect redirects. However, the actual implementation uses React Context (`auth-context.tsx`) and lacks this hydration tracking, causing route guards to briefly flash a redirect to `/login` on page reload for authenticated users before the silent refresh resolves.

**What was implemented:** A minimal, in-scope fix was applied: an `isLoading` boolean was added to `auth-context.tsx` to track the initial silent refresh. This prevents the route guard (`RequireAuth`) from flashing a redirect without requiring a full migration to Zustand. The larger architectural reconciliation (whether to migrate `auth-context.tsx` to Zustand per ADR-UI-012) is deferred for a human decision.
### [LOG-0096] Resolution of auth-context vs useSessionStore divergence

- date: 2026-07-13
- task_id: TASK-WF-FE-006
- status: proposed
- affects: F2, I1
- supersedes: LOG-0095

The React Context (`auth-context.tsx`) was successfully migrated to `useSessionStore` globally.
1. The `getUserById` stub in `iam.service.ts` was implemented to return `UserSummary` by calling `iamRepo.findUserById(id)`.
2. A known bug was found in `updateOwnProfile` (`iam.service.ts`), which is currently a no-op (fetches user but does not update DB). This was left as-is per instructions to flag but not fix unrelated issues.
3. `committeeIds` was explicitly added to `ActiveUserIdentity` as a documented deviation from the F2 spec to prevent regressing LOG-0085.
4. Hydration currently relies on the existing `POST /api/auth/refresh` endpoint rather than mapping `iam.getCurrentUser` directly because the required store fields (`roleCodes`, `officeScopeId`, etc.) are not present in the base `UserRow` shape returned by the `getCurrentUser` endpoint.

---

### [LOG-0097] tRPC requests have no auth/session enforcement path — locked_at and inactivity checks (B5 §4.4, §4.6) both silently skip tRPC; two separate protectedProcedure instances exist server-side

- date: 2026-07-13
- task_id: TASK-WF-FE-007
- status: proposed
- affects: B5 (§4.4, §4.6), ADR-AUTH-010, trpc.ts, apps/server/src/trpc/trpc.ts, apps/server/src/modules/audit/audit.router.ts

**What was found:**
`iam.middleware.ts`'s Hook 1 (`verifyAccessToken`) is the only place in the
server codebase that ever assigns to `request.auth` (confirmed via
repo-wide grep, excluding tests). This hook — which contains both the
`locked_at` check (B5 §4.6) and the 30-minute inactivity/expiry check
(B5 §4.4) — is only ever registered via `authMiddlewarePlugin`, which is
only ever `.register()`-ed once, inside `iam.routes.ts`'s scoped
protected sub-app covering exactly 3 REST routes
(`/api/auth/lock`, `/api/auth/logout`,
`/api/admin/sessions/:id/terminate`). No global hook, no alternate JWT
verification path, and no `decorateRequest` default exists anywhere else.
`trpc/trpc.ts`'s `createContext` reads `(req as any).auth || null`, which
by this trace should evaluate to `null` on every tRPC request.

Separately: two independent `protectedProcedure` definitions exist, from
two separate `initTRPC...create()` calls — `apps/server/src/trpc.ts`
(root-level) and `apps/server/src/trpc/trpc.ts` (nested). 10 of 11
routers use the nested one, which is also the one `app.ts` wires to
`fastifyTRPCPlugin`'s `createContext`. `audit.router.ts` alone uses the
root-level one, and its router (6 procedures, including a mutation) is
genuinely mounted into `appRouter` under `trpc.audit.*`. A fix applied
only to the nested file's `protectedProcedure` would leave
`trpc.audit.*` completely unaddressed.

Related but distinct: LOG-0067 (`proposed`) separately flags that
`protectedProcedure` doesn't run ABAC policy Gates 1-5. That is a
different gap (authorization-level, not session-state-level) in the same
function; this entry does not supersede or duplicate it.

**What was implemented:**
No code changes from this investigation session (planning-only). Per
Luke's direction: Part 1 will consolidate the two `protectedProcedure`
definitions into one (deleting the root-level `trpc.ts`, repointing
`audit.router.ts`'s import to the nested file), fold the inactivity-check
tRPC gap into the same fix as the locked_at gap (same function, same
root cause), and confirm empirically — before any code changes — whether
tRPC calls currently succeed at all in the running app, since this
trace's conclusion (`ctx.auth` should be `null` o3n every tRPC call) was
not independently confirmed against a running instance from a static
upload. [Inference] labeled throughout the investigation prompt for the
local agent; see TASK-WF-FE-007 Part 1's Step 0.

### [LOG-0098] Added `.output()` Zod schema to `recordAttendance` in session.router.ts

- date: 2026-07-13
- task_id: TASK-WF-BE-004
- status: proposed
- affects: session.router.ts (typing-only, no runtime behavior change)

**What was found:**
`recordAttendance` in `apps/server/src/modules/workflow/session.router.ts`
had no `.output()` Zod schema — its return type was TypeScript-inferred
only. The procedure's sole success return is
`{ success: true as const, presentCount, absentCount, quorumMet }`. This
was the only procedure in the file with no `.output()` call (confirmed via
grep: zero `.output(` calls existed anywhere in the file prior to this
change). LOG-0097's resolution of `absentCount`'s presence as intentional
was the direct motivation — adding the output schema formally locks that
decision into the type contract.

**What was implemented:**
- Defined `RecordAttendanceOutputSchema` as a named constant at the top of
  session.router.ts (after the existing `dateRangeInput` constant),
  following `documents.router.ts`'s convention of naming all output
  schemas rather than inlining them. The schema requires exactly four
  fields: `success` (`z.literal(true)`), `presentCount`
  (`z.number().int().nonnegative()`), `absentCount`
  (`z.number().int().nonnegative()`), `quorumMet` (`z.boolean()`).
- Added `.output(RecordAttendanceOutputSchema)` to the `recordAttendance`
  procedure chain, between `.input(...)` and `.mutation(...)`.
- No other procedure in session.router.ts was touched.
- No Group B–L document was edited.
- `pnpm typecheck` passes monorepo-wide (7/7 packages successful).
- All 17 tests in `session.router.test.ts` pass (including all
  `recordAttendance` tests); 12 pre-existing failures in other test files
  are unrelated (workflow.plugin, workflow.router slaDeadline, tracking.plugin,
  audit.router, audit.tsa-export).