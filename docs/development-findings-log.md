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


### [LOG-0026] Missing `migrations/meta/0004_snapshot.json` broke Drizzle Kit's diff chain; reconstructed

- date: 2026-07-01
- task_id: TASK-TRACK-001
- status: proposed
- affects: none (repository/tooling-state gap, not a pre-development document gap)

While generating the migration for this task, `packages/database/migrations/meta/0004_snapshot.json` was found to be absent, even though `0000_snapshot.json` through `0003_snapshot.json`, the `0004_documents_create_documents_schema.sql` migration file itself, and its `_journal.json` entry (`idx: 4`, tag `0004_documents_create_documents_schema`) were all present. Drizzle Kit's diff engine determines the "current" schema state from the highest-numbered snapshot file actually present in `meta/`, not from `_journal.json` alone, so with `0004_snapshot.json` missing, `drizzle-kit generate` silently diffed the new `tracking.schema.ts` against `0003_snapshot.json` (the pre-`documents`-schema state) instead of against the true post-0004 state.

Concretely, this meant the first `drizzle-kit generate` run for this task produced a migration that re-emitted `CREATE SCHEMA "documents"` and all eleven `documents.*` tables a second time, in addition to the three new `tracking.*` tables — which would fail with "already exists" errors against exactly the database state this task's own acceptance criteria require testing against ("a database that already has iam, organization, and documents schemas applied").

What was implemented: reconstructed the missing snapshot rather than hand-editing it. Temporarily removed `tracking.schema.ts` from `packages/database/schema/` (and its `index.ts` export) so the working tree matched the true post-0004 state exactly, ran `drizzle-kit generate`, and confirmed the resulting `CREATE TABLE`/`CREATE SCHEMA`/`CREATE INDEX` statement set was structurally identical (diffed as sorted statement lists, ignoring `statement-breakpoint` markers) to the already-existing `0004_documents_create_documents_schema.sql`'s auto-generated portion. Discarded the throwaway `.sql` file this produced (0004's real migration file already exists and is presumably already applied in any real environment) and kept only the generated snapshot JSON, renamed to `0004_snapshot.json` — its `prevId` already correctly chained to `0003_snapshot.json`'s `id`. Restored `tracking.schema.ts`, re-ran `drizzle-kit generate`, and this time got a clean, tracking-only migration. Confirmed the full chain is now internally consistent: a subsequent `drizzle-kit generate` with no schema changes reports "No schema changes, nothing to migrate."

[Unverified]: why the file was missing from the archive this task was executed against — whether it was never committed after `0004` was originally authored, or dropped by whatever process produced the archive for this task. I have no visibility into that from inside this sandbox. Any agent who sees `drizzle-kit generate` unexpectedly regenerate schema that should already exist (or, conversely, fail to detect real changes) should check for this specific failure mode: a `meta/NNNN_snapshot.json` missing despite the corresponding `.sql` file and `_journal.json` entry both being present.

### [LOG-0027] C1 Part 12 has no grant-level REVOKE for `tracking.routing_entries` despite §1.4 classifying it as append-only; added to migration and `post-migrate-grants.sql`

- date: 2026-07-01
- task_id: TASK-TRACK-001
- status: proposed
- affects: C1 (Part 12, Part 14)

C1 §1.4 lists `tracking.routing_entries` alongside `workflow.workflow_events`, `notifications.delivery_log`, `audit.events`, and `documents.numbers` as tables that omit `updated_at` because they are "append-only / write-once." C1 Part 7's own DDL comment on `routing_entries` repeats "Append-only: no updated_at." However, C1 Part 12's grant script and Part 14's compliance-checklist item #12 ("Append-only logs") name only `workflow.workflow_events` and `audit.events` as having `UPDATE`/`DELETE` explicitly revoked at the grant level — `tracking.routing_entries` (and `notifications.delivery_log`) are absent from that enforcement list despite sharing the same §1.4 classification.

TASK-TRACK-001's own AI Prompt and acceptance criteria explicitly require `REVOKE UPDATE, DELETE ON tracking.routing_entries FROM batac_app` and test for it, so the task ticket treats this as required, consistent with §1.4's classification, even where C1 Part 12 doesn't literally spell it out. Implemented per the ticket.

What was implemented: (a) added the `REVOKE UPDATE, DELETE ON tracking.routing_entries FROM batac_app` statement to migration `0005_tracking_create_tracking_schema.sql`'s manual-additions section, matching the C1 Part 12 / `workflow.workflow_events` pattern; (b) also added an equivalent `DO $$ ... $$` block to `packages/database/scripts/post-migrate-grants.sql`, mirroring its existing `workflow.workflow_events` block. Step (b) is not redundant belt-and-suspenders — it's required. `post-migrate-grants.sql` runs immediately after Drizzle migrations on every `db:migrate` invocation, and its generic per-schema loop already grants `SELECT, INSERT, UPDATE` on every table in every schema listed in its `app_schemas` array, which already included `'tracking'` before this task (added by whichever infra task first populated that array). Without step (b), that generic grant would silently re-grant `UPDATE` back to `batac_app` on `routing_entries` immediately after migration 0005's own `REVOKE`, within the same `db:migrate` invocation.

Verified by installing PostgreSQL 16 locally, creating the five application roles via the project's own `tools/db/init/01-create-roles.sh`, and running the real `packages/database/scripts/migrate.ts` end to end (all six migrations, then `post-migrate-grants.sql`). Confirmed directly against the live database: `UPDATE tracking.routing_entries ... ` as `batac_app` fails with `permission denied for table routing_entries`, both immediately after the first `db:migrate` run and after a second, idempotent run (ruling out the exact "immediately re-granted" failure mode described above). `information_schema.role_table_grants` confirms `batac_app` retains `INSERT` and `SELECT` on `routing_entries` (append-only means no `UPDATE`/`DELETE`, not no access at all), and `has_schema_privilege('batac_it_admin', 'tracking', 'USAGE')` returns `false`, matching the ticket's requirement that IT admin gets no access to this schema.

[Inference]: this is an oversight in C1 Part 12 / Part 14 rather than an intentional decision to enforce `routing_entries` less strictly than `workflow_events` — no note in C1 explains the asymmetry given both share the §1.4 "append-only" classification. A human should confirm, and should also confirm whether `notifications.delivery_log` needs the identical grant-level treatment when its owning task is implemented — it shares the same §1.4 classification and is equally absent from Part 12/14's enforcement list, but that table is out of scope for TASK-TRACK-001 and was not touched here.

### [LOG-0026] TASK-DOCS-009 prompt's SubjectContext shorthand (isIta/isPa) diverges from the shipped IAM AuthContext (isItAdmin/isPlatformAdmin)

- date: 2026-07-02
- task_id: TASK-DOCS-009
- status: proposed
- affects: I1 (§1 Subject Attributes Reference)

The TASK-DOCS-009 AI Prompt's `SubjectContext` interface uses `isIta: boolean;
isPa: boolean;`, mirroring I1 §1's raw JWT-claim names (`subject.is_ita`,
`subject.is_pa`). The `AuthContext` type TASK-IAM-004 actually shipped
(`apps/server/src/modules/iam/iam.types.ts`) instead names these fields
`isItAdmin`/`isPlatformAdmin`, and additionally carries `sessionId`,
`permissions`, `delegationGrantId`, and `effectiveRoles`, none of which the
prompt's shorthand mentions.

Implemented `documents.policy.ts`'s `SubjectContext` as a direct alias of the
real `AuthContext` (`export type SubjectContext = AuthContext;`), matching the
same alias `iam.policy.ts` itself already exports, and used the real field
names (`isItAdmin`/`isPlatformAdmin`) throughout. This is what let
`pnpm typecheck` pass and what will let real tRPC procedures pass `ctx.auth`
into the guard without a mapping layer. [Unverified] whether the prompt's
`isIta`/`isPa` naming was a deliberate, considered spec choice made
independently of TASK-IAM-004, or simply written before TASK-IAM-004 shipped
and never reconciled — I did not find anything to confirm either way, and the
acceptance-criteria code snippet in the prompt uses the short names too, so
the mismatch is baked into the ticket text itself, not just its prose.

### [LOG-0027] I1 §17's state-action matrix (and the TASK-DOCS-009 prompt's copy of it) omits `pending_panlalawigan_review`

- date: 2026-07-02
- task_id: TASK-DOCS-009
- status: proposed
- affects: I1 (§17)

`documents.documents_lifecycle_state_check` (schema), and this module's own
`DocumentLifecycleState` union (`documents.types.ts`, shipped by
TASK-DOCS-002), both list eleven lifecycle states, including
`pending_panlalawigan_review`. I1 §17's State-Action Compatibility Matrix, and
the TASK-DOCS-009 prompt's verbatim copy of it, both have only ten rows and
never mention this state. I1 itself never mentions
`pending_panlalawigan_review` anywhere in the document (confirmed by a
full-text search), which is consistent with D3's note that ADR-013 split a
single earlier "Pending Approval" state into `pending_mayor_action` and
`pending_panlalawigan_review` — I1 appears to predate or not have been
reconciled with that split for this specific matrix.

Implemented `checkStateActionCompatibility` with `STATE_ACTION_MATRIX` typed
as `Record<DocumentLifecycleState, readonly string[]>` (rather than the
prompt's looser `Record<string, string[]>`), so TypeScript itself requires
every state to have an entry — the gap cannot be silently reintroduced by
omitting a key. [Inference] Filled `pending_panlalawigan_review` with
`['read', 'cancel']` only:
  - `read` follows I1 §17's own pattern of allowing it in literally every
    other row, including terminal states.
  - `cancel` is corroborated by the DB trigger
    `documents.check_lifecycle_transition()`, which explicitly permits
    `pending_panlalawigan_review -> cancelled`.
D3 also documents transitions from this state to `completed`
(`FINAL_APPROVAL_GRANTED`) and to `superseded` (`DOCUMENT_SUPERSEDED`), but I
did not find a clear mapping from either event to one of this matrix's
existing action names (`approve`/`reject`/`number_promote`), so I left them
out rather than guess. A human should confirm the complete action set for
this state.

### [LOG-0028] I1 §3.4's ALLOW-clause role list omits brgy_encoder from document soft-delete

- date: 2026-07-02
- task_id: TASK-DOCS-009
- status: proposed
- affects: I1 (§3.4)

I1 §3.4 (`document:delete`, soft-delete)'s ALLOW clause role set is `{
dept_encoder, dept_approver, sp_secretary, sp_presiding_officer, mayor,
brgy_captain }` — `brgy_encoder` is absent. The "RESTRICTED ENCODER RULE" note
immediately following that same clause, in the same section, states
"dept_encoder and brgy_encoder may soft-delete only while lifecycle_state IN
('draft', 'submitted')...", treating `brgy_encoder` as included. I2's "Delete
document in Draft state (soft delete) — own office" row independently shows
Barangay Encoder = ✅. Both of I1's own text and I2 agree `brgy_encoder` should
be included; only I1 §3.4's ALLOW-clause role list itself omits it.

Implemented `SOFT_DELETE_ROLES` including `brgy_encoder`, tested explicitly in
`documents.policy.test.ts`.

### [LOG-0029] I1 §4.1 content cross-office read does not require has_cross_office_read_grant, unlike I1 §3.2 metadata read

- date: 2026-07-02
- task_id: TASK-DOCS-009
- status: proposed
- affects: I1 (§4.1, §3.2)

The TASK-DOCS-009 prompt describes `document_version:read` /
`document_attachment:read` (I1 §4.1) as using "the same
own-office/cross-office/committee rules as document:read metadata" (I1 §3.2).
Read literally, the two sections differ: I1 §3.2's cross-office branch
requires `has_cross_office_read_grant(subject, document.office_id) = true` in
addition to the role and classification checks; I1 §4.1's cross-office branch
has no such grant condition — only the role set intersection and
`classification_level IN ('public','internal')`. This makes §4.1's
cross-office branch broader than §3.2's, i.e. a subject can read the *content*
of another office's internal document via the cross-office role list without
an explicit grant, while reading that same document's *metadata* cross-office
would require one.

Implemented per I1 §4.1's literal text (no grant check in `canReadContent`'s
cross-office branch), not per the prompt's "same rules" paraphrase. [Unverified]
whether this asymmetry (content readable cross-office more easily than
metadata) is intentional or itself a gap in I1 — it reads as unusual given
metadata is normally the less sensitive of the two, but I found nothing in I1,
I2, or B5 that discusses the two sections' cross-office branches together or
explains a reason for the difference.

### [LOG-0030] I1 §3.4's closing "deletion requires dept_approver or sp_secretary" sentence misattributes I2 Conditional Note 7, which is about the cancel action

- date: 2026-07-02
- task_id: TASK-DOCS-009
- status: proposed
- affects: I1 (§3.4), supersedes nothing (refines LOG-0028, same section, different sub-finding)

I1 §3.4's base ALLOW clause has an unconditional, top-level
`AND document.workflow_instance_id IS NULL` that applies to the whole rule —
not scoped to any particular role subset. The "RESTRICTED ENCODER RULE" note
directly below it closes with "Once a workflow instance exists, deletion
requires dept_approver or sp_secretary," citing "[Confirmed — I2 Conditional
Note 7]." I checked I2 Conditional Note 7 directly
(`i2-role-permission-matrix.md`, footnote 7): it is attached to I2's "Cancel
document (from any active state) — own office" row and its text is
specifically about the *cancel* action's Department/Barangay Encoder
restriction ("A Department Encoder may cancel a document only while it is in
Draft or Submitted state and has not yet entered an active workflow
instance... Once a workflow instance is live, cancellation requires the
Approver or SP Secretary"), not about soft-delete. I1 §3.6 (`document:cancel`)
already correctly implements this same rule independently, with
`dept_approver`/`sp_secretary` unconditionally able to cancel regardless of
workflow-instance state.

Read this way, §3.4's closing sentence appears to be a misattributed/copied
reference to §3.6's rule rather than a real exception to §3.4's own
`workflow_instance_id IS NULL` condition — "deletion" there most likely should
have read "cancellation." Implemented `canSoftDelete` per the base ALLOW
clause literally: `workflow_instance_id IS NULL` is required for every role in
the set, `dept_approver`/`sp_secretary` included; those two roles' unconditional
access to remove a document from an active workflow is available through
`canCancel`, not `canSoftDelete`. This was caught by a test that initially
assumed the exception existed and failed against the implementation as first
written; the implementation (not the test) reflects this entry's conclusion.

### [LOG-0031] I1 §3.1's own-office condition for document:create is definitionally always-true as literally written

- date: 2026-07-02
- task_id: TASK-DOCS-009
- status: proposed
- affects: I1 (§3.1, §1)

I1 §3.1's ALLOW clause for `document:create` includes
`subject.office_id ∈ subject.effective_office_ids`. I1 §1's own Subject
Attributes Reference states `effective_office_ids` "always includes
`office_id`" — so for any authenticated subject with a non-null office, this
condition evaluates to true unconditionally, regardless of which document is
being created. As literally written it cannot function as an access-scoping
condition. The same line's parenthetical clarification — "i.e. the user is
creating a document for their own office or a delegation-extended office" —
describes something else: a check that the *document's* intended
`owned_by_office_id` falls within the subject's effective offices, not a
comparison of the subject's own two attributes to each other.

Implemented `canCreate` checking `attrs.ownedByOfficeId` (the office the new
document will be owned by, supplied by the caller) against
`subject.effectiveOfficeIds`, matching the parenthetical's evident intent and
the TASK-DOCS-009 acceptance criterion
(`canCreate({ officeId: 'A', effectiveOfficeIds: ['A'] }, { ownedByOfficeId: 'A' })`
→ `true`), rather than the literal (vacuous) subject-only comparison.



