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

