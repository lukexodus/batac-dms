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
- status: proposed
- affects: C1 (Part 2), infra.md (TASK-INFRA-005 AI Prompt)

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
- status: proposed
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
- status: proposed
- affects: C1 (Part 2), C5 (Addendum)

C1 Part 2 explicitly specifies `CREATE ROLE batac_app NOLOGIN;` and `CREATE ROLE batac_audit NOLOGIN;` while noting that `batac_app` is expected to be created as `LOGIN` by Docker/Bitnami via environment variables. However, because both `batac_app` and `batac_audit` have connection strings (`DATABASE_URL_APP` and `DATABASE_URL_AUDIT`) and must authenticate directly, setting them to `NOLOGIN` in `01-create-roles.sh` prevents connection.

To resolve this discrepancy, `01-create-roles.sh` has been updated to create and alter both `batac_app` and `batac_audit` with the `LOGIN` attribute and set their passwords via environment variables. `batac_it_admin` and `batac_readonly` correctly remain `NOLOGIN` as they are only accessed via `SET ROLE`.

[Inference]: The literal DDL text of C1 Part 2 uses `NOLOGIN` for `batac_app` and `batac_audit`, but this contradicts the intent and practical connection requirements of these roles. This correction aligns the created roles with their connection needs.

### [LOG-0004] Exclude actor reference columns from Invariant #7 timestamp checks

- date: 2026-06-26
- task_id: TASK-INFRA-007
- status: proposed
- affects: C5 (Section 7.4), infra.md (TASK-INFRA-007 AI Prompt)

Invariant #7 dictates that any column whose name contains `deleted` or starts with/contains `created`, `updated`, etc. must be typed as `TIMESTAMPTZ` or `TIMESTAMP WITH TIME ZONE`. However, the soft-delete convention in the project requires every table to have both `deleted_at TIMESTAMPTZ` and `deleted_by UUID` (a UUID reference to the user who deleted the row).

Without an exception, `deleted_by` (which contains `deleted`) is flagged as a violation because its type is `UUID`. This would cause every table to fail the linter. Similarly, columns like `created_by` or `updated_by` are user references.

[Inference]: Actor and user ID reference columns (specifically those ending in `_by` or `_id`) are not timestamp columns and are excluded from Invariant #7 timezone checks in `lint-migrations.ts`.

### [LOG-0005] skipLibCheck: true required for @batac/database package to compile

- date: 2026-06-26
- task_id: TASK-INFRA-006
- status: proposed
- affects: C5 (Section 2.2), J3 (TypeScript config standards)

The project standard tsconfig configures `"skipLibCheck": false`. However, building `@batac/database` with `drizzle-orm` and `drizzle-kit` installed results in multiple type compilation errors within their own `.d.ts` declaration files (primarily mysql-core, sqlite-core, and singlestore-core select and delete query definitions). These errors are internal package typing issues in Drizzle ORM when using strict type checking.

[Inference]: To allow compilation to succeed and to enable Turborepo tasks to run, the `@batac/database` package's `tsconfig.json` overrides the base configuration to set `"skipLibCheck": true`. This has no impact on application safety because only third-party package definitions are skipped; the workspace schema code and migration runner themselves are still type-checked.





