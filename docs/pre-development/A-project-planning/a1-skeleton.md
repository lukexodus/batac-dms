# A1 Skeleton — Structural Contract (v2.1)

Generated per `A1-AGENTS.md` §6 "Step 1 — Skeleton." This document is the
structural contract for all later A1 generation passes. It contains no tasks.

**Supersedes:** `a1-skeleton.md` (v1, archived as `a1-skeleton.md.bak`).

**Reason for v2:** v1 flagged seven open items (one `[CONFLICT]`, six
`[SPEC GAP]` / `[Unverified]`). All seven were resolved via direct Q&A with
the project owner on 2026-06-22. One of the seven — the `search_meta` /
`reporting` module-code gap — also required a small structural edit to
`A1-AGENTS.md` itself (two new module codes added directly to its Pass Types
table, Wave-order notes, and Module field enum). The other six are
content-level resolutions that live only in this document. Because the new
module codes alone touch this document's Sections 1, 2, 3, and 6, and the
remaining six resolutions touch Sections 3 and 4, this is a full rewrite
rather than a delta. See the changelog at the end for the complete list of
what changed and why.

**Documents loaded for this pass, in order:** `docs/pre-development/document-list.md`
→ `docs/pre-development/tech-stack.md` → consolidated reference §10.2 and §13 only.
(`A1-AGENTS.md` itself was read first, per the routing instructions, to obtain the
Pass Types table and the Step 1 rules this document follows. `A1-AGENTS.md` was
re-read for this v2 pass after its own §2/§3 were amended to add the `SEARCH`/
`REPORT` module codes.)

**Sourcing & confidence legend** (applied throughout this document):

- Unmarked statements are taken directly from one of the three loaded sources or
  from `A1-AGENTS.md`.
- `[Inference]` — a reasoned synthesis or mapping not stated verbatim in any loaded
  document.
- `[SPEC GAP]` — using `A1-AGENTS.md` §1's own convention: something a source
  requires but no loaded document specifies fully enough to resolve here. Not
  invented; left for human resolution per `A1-AGENTS.md` §8.
- `[CONFLICT]` — an apparent disagreement between two loaded sources, flagged
  rather than resolved by guessing, per `A1-AGENTS.md` §1.
- `[Resolved — 2026-06-22]` — **new in v2.** An item v1 flagged as `[CONFLICT]`,
  `[SPEC GAP]`, or `[Unverified]`, settled by direct decision from the project
  owner rather than derived from a loaded document. The original v1 flag is kept
  visible in parentheses for audit trail; the resolution itself is a decision,
  not a sourced fact.
- Where something cannot be determined from the loaded sources at all, this
  document says so directly instead of presenting a guess as settled.

---

## Table of Contents

- [L60–L89] 1. Task ID Convention — Format, 13 module codes (including SEARCH/REPORT), zero-padding, and global ID uniqueness rules.
- [L90–L147] 2. Module List in Wave Order — Alphabetical and wave-ordered module registry mapping to source documents and dependency lists.
- [L148–L270] 3. Phase Scope Table — Grid mapping modules to phase eligibility, specifying full-spec, title-only, or N/A scope.
- [L271–L336] 4. Cross-Module Dependency Rules — Rules governing task ID references, placeholder values, feature page layout, and schema boundary laws.
- [L337–L355] 5. Special Tags — Standard database migration, ABAC permission check, and audit trail tagging conventions for tasks.
- [L356–L394] 6. Phase 1 Task Count Estimates — Rough planning task-range estimates per module based on Phase 1 capability lists.
- [L395–L416] Changelog — v1 → v2 (2026-06-22) — Reconciliation log detailing the ten resolved architectural changes between v1 and v2 skeleton passes.

---

## 1. Task ID Convention

**Format:** `TASK-{MODULE}-{NNN}`

**Module codes (13, exhaustive — `A1-AGENTS.md` §3):**
`INFRA | UI | IAM | AUDIT | ORG | DOCS | WF | TRACK | REC | NOTIF | PORTAL | SEARCH | REPORT`

`[Resolved — 2026-06-22]` (v1 `[SPEC GAP]`, Section 2): `SEARCH` and `REPORT`
are new codes covering consolidated ref §10.2's `search_meta` and `reporting`
schemas, which had no A1 module code in v1. Both carry **zero Phase 1 tasks**
this round — Meilisearch sync is a Phase 2 capability; ARTA compliance reports
is Phase 2 and the configurable report builder is Phase 4 (§13). They exist in
the enum now only so Phase 2/4 title-only entries (Step 3 Outline pass) have a
valid Module value to reference. Their own full-spec Step 2 module pass does
not run until a future Phase 2 A1 update — see Section 2 below and
`A1-AGENTS.md` §2's "Deferred Phase 2 module passes."

**Zero-padding:** `NNN` is a three-digit, zero-padded integer, starting at `001`
within each module (e.g., `TASK-DOCS-001`, `TASK-DOCS-002`, … `TASK-DOCS-014`).
Numbering restarts at `001` for every module — it is not global.

**Uniqueness rule:** IDs are unique across the entire assembled A1 document, not
only within a module. The Step 4 integration pass audits this explicitly; any
duplicate found is corrected by appending `b`, `c`, etc. as a temporary suffix
and flagged for human renumbering (`A1-AGENTS.md` §6, Step 4, operation 1). A
module pass does not need to coordinate ID ranges with other modules in advance
— the integration pass is where collisions, if any, are caught.

---

## 2. Module List in Wave Order

| Wave                        | Module   | Full Name                            | Pre-Dev Source Documents                                                         | Depends On                                              |
| --------------------------- | -------- | ------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| A                           | `INFRA`  | Infrastructure [†1]                  | `tech-stack.md`; L1; L2; L3; L4; D5; C5; J3                                      | None                                                    |
| A                           | `UI`     | UI Component Library Foundation [†1] | F5; J6; F6; F4; F1; `DESIGN.md`; `globals.css`; F7                               | None                                                    |
| B                           | `IAM`    | Identity and Access Management       | B5; I2; I1; C1 §iam; J1; J2; J3; J4                                              | INFRA                                                   |
| B                           | `AUDIT`  | Audit                                | C1 §audit; `tech-stack.md` §"Audit Log Integrity"; I3                            | INFRA                                                   |
| C                           | `ORG`    | Organization                         | C1 §organization; B2; I1; I2                                                     | IAM, AUDIT                                              |
| D                           | `DOCS`   | Documents                            | C1 §documents; H2; H3; E1 §documents; E3; B2; I1; I2                             | ORG                                                     |
| E                           | `WF`     | Workflow                             | B4; C1 §workflow; H1; D3; K2; E1 §workflow; B2                                   | DOCS                                                    |
| E                           | `TRACK`  | Tracking                             | C1 §tracking; consolidated ref §11.6; E1 §tracking; B2                           | DOCS                                                    |
| F                           | `REC`    | Records [‡, see note below]          | C1 §records; E1 §records; B2; I1; I2                                             | WF, TRACK                                               |
| F                           | `NOTIF`  | Notifications                        | H4; C1 §notifications; E1 §notifications; B2; B3                                 | WF [†2]                                                 |
| G                           | `PORTAL` | Portal                               | E2; F1 §portal; consolidated ref §13 Phase 3                                     | INFRA, UI, IAM, AUDIT, ORG, DOCS, WF, TRACK, REC, NOTIF |
| H1 `[Phase 2 — deferred]`   | `SEARCH` | Search Index Metadata                | `[Phase 2 Meilisearch source documents — not yet authored in this document set]` | DOCS                                                    |
| H2 `[Phase 2/4 — deferred]` | `REPORT` | Reporting                            | `[Phase 2/4 reporting source documents — not yet authored in this document set]` | WF, DOCS, TRACK, ORG                                    |

**[†1]** `INFRA` and `UI` are not among the 11 schema-owning modules named in
consolidated ref §10.2 (`iam, organization, documents, workflow, tracking,
records, notifications, audit, search_meta, portal, reporting`). They are
cross-cutting build modules defined by `A1-AGENTS.md`'s own Pass Types table for
task-generation purposes, not domain modules that own a PostgreSQL schema.

**[†2] [Inference]** `A1-AGENTS.md` §2's Wave-order summary groups `NOTIF` with
`REC` under "Wave F — needs WF + TRACK task IDs," but `NOTIF`'s own Load column
in the Pass Types table lists only `TASK-WF list`, not `TASK-TRACK list`. This
is read here as a shared scheduling checkpoint with `REC`, not a strict
per-module dependency on `TRACK`. Until a Step 2 pass shows otherwise, `NOTIF`
task Prerequisites fields should only reference `TASK-WF-*` IDs, not
`TASK-TRACK-*`.

**[‡] [Resolved — 2026-06-22]** (v1 `[CONFLICT]`, Section 3): `REC`'s Phase 1
scope is real but narrow — **schema reservation only**. See Section 3 below
for the full resolution and Section 6 for the revised task-count estimate.

**`SEARCH` and `REPORT` rows above** carry no current-round Pre-Dev Source
Documents because their own Step 2 module pass is deferred to a future Phase 2
(and, for `REPORT`, Phase 4) A1 update — see `A1-AGENTS.md` §2. Their Wave
labels (`H1`, `H2`) are placeholders recording dependency order only, not a
scheduled position in the current Wave A–G sequence. `[Resolved — 2026-06-22]`
(v1 `[SPEC GAP]`, this section): `SEARCH` depends on `DOCS` task IDs only (it
indexes document content); `REPORT` depends on `WF` + `DOCS` + `TRACK` + `ORG`
task IDs (it reports on data those four modules produce) — both dependency
chains were confirmed directly by the project owner rather than inferred here.

**[SPEC GAP] — partially resolved.** v1 flagged that consolidated ref §10.2's
two Phase-2 schema-owning modules had no A1 module code. That structural gap
is now closed (`SEARCH`, `REPORT` added). What remains open, and is **not**
resolved by this v2 pass: the actual Phase 2 source documents for `SEARCH`
(Meilisearch integration spec) and for `REPORT` (ARTA report spec, configurable
report builder spec) do not yet exist anywhere in `docs/pre-development/`.
Someone will need to author them — likely new lettered-group documents — before
either module's real Step 2 pass can run. Out of scope for this Phase 1
skeleton.

---

## 3. Phase Scope Table

Cell values: **Full spec** / **Title only** / **N/A**, per the rule in
`A1-AGENTS.md` §6 Step 3 (Phase 1 and 1B always use the full task schema; Phases
2–5 are title + module only).

| Module | Phase 1       | Phase 1B      | Phase 2         | Phase 3         | Phase 4         | Phase 5         |
| ------ | ------------- | ------------- | --------------- | --------------- | --------------- | --------------- |
| INFRA  | Full spec     | N/A           | N/A             | N/A             | N/A             | Title only [‡‡] |
| UI     | Full spec     | N/A           | N/A             | N/A             | N/A             | N/A             |
| IAM    | Full spec     | N/A           | Title only      | N/A             | N/A             | Title only [†]  |
| AUDIT  | Full spec     | N/A           | Title only      | Title only [‡‡] | N/A             | N/A             |
| ORG    | Full spec [*] | Full spec [†] | Title only      | Title only [†]  | N/A             | Title only [†]  |
| DOCS   | Full spec     | Full spec     | Title only [†]  | Title only [†]  | Title only      | Title only      |
| WF     | Full spec     | Full spec     | Title only [‡‡] | N/A             | Title only      | N/A             |
| TRACK  | Full spec     | Full spec [†] | N/A             | N/A             | N/A             | N/A             |
| REC    | Full spec [‡] | N/A           | Title only      | N/A             | N/A             | N/A             |
| NOTIF  | Full spec     | Full spec [†] | Title only      | Title only      | N/A             | N/A             |
| PORTAL | Full spec     | N/A           | N/A             | Title only [†]  | N/A             | Title only [‡‡] |
| SEARCH | N/A           | N/A           | Title only [‡‡] | N/A             | N/A             | N/A             |
| REPORT | N/A           | N/A           | Title only [‡‡] | N/A             | Title only [‡‡] | N/A             |

`[†]` = module assignment is an `[Inference]` — the roadmap text (§13) names a
capability, not an A1 module code; the cell reflects matching that capability to
the closest module owner per §10.2's schema-ownership text. `[*]` = see
conflict note immediately below. `[‡]` = REC's Phase 1 scope, resolved — see
below. `[‡‡]` = **new in v2** — cell changed or added by one of the six
content-level resolutions; see the per-item notes below the table.

**Phase 1 basis:** marked "Full spec" for all 11 Phase-1-eligible modules
because `A1-AGENTS.md` §2 defines an explicit Step 2 module-generation pass for
each, and §6's Step 2 instructions open with "read the capability list for this
module in consolidated ref §13 Phase 1" for every pass without exception.
`SEARCH` and `REPORT` are excluded from this basis entirely — neither has a
Phase 1 capability, so neither gets a Phase 1 cell value beyond `N/A`.

**[‡] REC / Phase 1 scope — `[Resolved — 2026-06-22]` (was `[CONFLICT]` in v1):**
v1 flagged a disagreement: consolidated ref §13's Phase 1 "Included" list does
not name Records, and §13's Phase 2 list explicitly states "Records Management
module" is a Phase 2 addition — yet `A1-AGENTS.md` §2 defines a Phase 1 `REC`
module pass with real source documents. The project owner's resolution: **REC
has real Phase 1 scope, but it is schema-reservation only** — the `records` and
`retention_schedules` placeholder tables, and the `retention_schedule_id`
reservation column H2 already references from the `documents` schema. No
records CRUD, no retention-policy enforcement, no archival workflow — those
ship with the full Records Management feature in Phase 2. This is now a
decision, not a guess: the original `[Speculation]` note in v1 proposing this
exact scope split is confirmed correct. See Section 6 for the revised task-
count estimate this produces.

**[‡‡] AUDIT / Phase 3 — `[Resolved — 2026-06-22]` (was `[Unverified]` in v1,
listed under "DPA compliance features"):** DPA (Data Privacy Act) compliance
features, a Phase 3 addition per §13, are assigned to `AUDIT`. Rationale from
the project owner: DPA compliance work (erasure requests, PII handling
controls) ties directly to the tamper-evidence and access-logging work I3
already defines for `AUDIT`. Phase 3 cell changes from v1's `N/A` to `Title
only`.

**[‡‡] WF / Phase 2 — `[Resolved — 2026-06-22]` (was a low-confidence
`[Inference]` in v1, listed under "Notice of Committee Hearing auto-generation
from committee referral step"):** Confirmed as `WF`, not `TRACK` — the
capability is workflow-step-triggered (it fires when a committee-referral step
completes), which matches `WF`'s existing ownership of step-transition logic
more directly than `TRACK`'s routing-history/QR-lookup scope. The table cell
value itself does not change (`WF` Phase 2 was already `Title only` in v1);
what changes is the confidence marker — this is now a confirmed assignment, not
an inference.

**[‡‡] PORTAL / Phase 5 — `[Resolved — 2026-06-22]` (was `[Unverified]` in v1,
listed under "Public REST API gateway"):** Assigned to `PORTAL`. Phase 5 cell
changes from v1's `N/A` to `Title only`.

**[‡‡] INFRA / Phase 5 — `[Resolved — 2026-06-22]` (was `[Unverified]` in v1,
listed under "Multi-LGU assessment"):** Assigned to `INFRA` as a
platform/deployment-scaling concern. The cell value itself does not change
(`INFRA` Phase 5 was already `Title only` in v1, covering other §13 Phase 5
integration items such as HRIS/Payroll, procurement-system integration, and
on-premise migration tooling); Multi-LGU assessment now joins that same
title-only set explicitly rather than sitting unassigned.

**[‡‡] SEARCH and REPORT rows — new in v2:** added per the `A1-AGENTS.md`
module-code resolution (Section 1/2 above). `SEARCH` Phase 2 = Title only
(Meilisearch sync). `REPORT` Phase 2 = Title only (ARTA compliance reports);
`REPORT` Phase 4 = Title only (configurable report builder). Neither has Phase
1, 1B, 3, or 5 capability per §13.

**Dashboards — `[Resolved — 2026-06-22]` (was `[Unverified]` in v1, listed
under "Advanced executive dashboards (Phase 3) / Advanced KPI dashboards
(Phase 4)"):** Not assigned to a single module. The project owner's resolution
is a **rule, not a module**: each dashboard belongs to whichever module owns
the underlying data it displays, determined case-by-case when that specific
dashboard capability is actually planned (at the relevant Step 2 module pass or
the Step 3 Outline pass). This does not get a row of its own in the table above
— it is a dependency rule, stated formally in Section 4. It is removed from the
"could not confidently assign" list below because it is no longer an open gap;
it is an intentionally distributed assignment.

**Capabilities named in §13 that this skeleton could not confidently assign to
a single module — as of v2 (2026-06-22), one item remained: the UI Tier-3
component count discrepancy below. It is now resolved too, leaving this list
empty.**

- **UI Tier-3 component count discrepancy — resolved.** _[Resolved by the UI
  Step 2 module pass, 2026-06-23; see `docs/pre-development/A-project-planning/a1-tasks/ui.md`.]_
  Reading F5 and F7 directly: both agree at **16** Tier 3 components. F7's own
  "Reconciliation Notes" record that an earlier draft input said "17" and that
  F7 had already corrected its own prose to "16" before being written to disk
  — so there was no live discrepancy left to reconcile once the module pass
  actually read both documents, only a stale flag carried forward from before
  that correction. The task count came out to 19, the top of this section's
  17–19 estimate, because of one task neither F5 nor F7 separately
  instantiates: `A1-AGENTS.md` §6's UI-specific rule requires a named
  "J6-generation task" as a prerequisite for Group C components, and that
  task (generating `packages/ui/src/types/domain.ts` and `status-meta.ts`)
  needed its own task entry. Final breakdown: Foundation (1) + J6-generation
  (1) + 16 Tier 3 components + integration (1) = 19.

All items from the v1 "could not confidently assign" list — Meilisearch/
ARTA/reporting, DPA compliance, dashboards, the public REST API gateway,
Multi-LGU assessment, and now UI's component count — are resolved above. As
of 2026-06-23, this list has no remaining open items.

---

## 4. Cross-Module Dependency Rules

**Prerequisites reference TASK IDs only, never document names.** A task that
depends on a migration being applied lists the specific `TASK-{MODULE}-NNN` that
applies it — never "C1" (`A1-AGENTS.md` §5).

**Placeholder convention while a prerequisite module's list does not yet exist:**
write `[CROSS-MODULE REF: module name — task list not yet supplied]`. Once that
module's Step 2 pass has run and its task list exists, look up the real ID —
`[TBD]` is not an acceptable substitute at that point (`A1-AGENTS.md` §5, §6 Step
2). This is also why wave order matters: a module pass cannot resolve real
prerequisite IDs for a module whose list has not been generated yet, so it must
not start before that prerequisite module's wave completes. This applies to
`SEARCH` and `REPORT` exactly as it does to any other module once their Phase 2
passes are eventually scheduled — they reference `TASK-DOCS-*` (and, for
`REPORT`, `TASK-WF-*` / `TASK-TRACK-*` / `TASK-ORG-*`) IDs, not document names.

**UI feature-page rule (stated explicitly in `A1-AGENTS.md` §6 Step 1's own
requirement text):** the `UI` module's task list itself covers only the
component-library foundation (Plan 0, the 16 Tier 3 components, and the Plan 2
integration page) per the Wave-order note in §2. A page that uses those
components belongs to whichever domain module owns the feature — e.g., the SP
Secretary dashboard belongs to whichever module is determined to own it, not to
`UI`. That owning module's page task must list as Prerequisites:

1. the specific Tier 3 component task(s) (from `UI`'s list) the page composes, and
2. the specific backend module task(s) that implement the tRPC procedure(s) the
   page calls — found by looking up the procedure name in E1's router/procedure
   catalog, then finding that procedure's implementing task in the procedure's
   owning module's task list.

**Dashboard ownership rule — `[Resolved — 2026-06-22]`, new in v2.** This is a
direct extension of the UI feature-page rule immediately above, applied
specifically to the executive/KPI dashboard capabilities named in §13 Phase 3
and Phase 4. A dashboard is a feature page, not a `UI`-module deliverable, and
it is also not automatically a `PORTAL` or `REPORT` deliverable just because it
visualizes data: **each dashboard's owning module is whichever module owns the
underlying data it displays**, decided per dashboard, not in bulk, at the time
that specific dashboard capability reaches a Step 2 module pass or the Step 3
Outline pass. A dashboard that displays workflow throughput belongs to `WF`; one
that displays organization-wide staffing belongs to `ORG`; one that aggregates
across multiple modules' data (the more likely case for the Phase 3/4
capabilities named in §13) should be split per-widget by data owner rather than
assigned whole to one module, following the same Tier-3-component-composition
pattern as any other feature page. `REPORT`'s own Phase 2/4 scope (ARTA
compliance reports; the configurable report builder) is a related but distinct
capability — `REPORT` owns report _generation and scheduling infrastructure_,
not the executive dashboards themselves, unless a specific future dashboard
turns out to be built on top of a `REPORT`-generated report rather than live
module data.

**No cross-schema reference, even informally.** Consolidated ref §10.3
Architectural Laws (read as part of §10.2's surrounding text): each module owns
its own PostgreSQL schema, with no cross-schema foreign key constraints, and
modules communicate only through the event bus or published module APIs — never
direct schema access. This is a design constraint on what a dependency may
legitimately represent, not only a bookkeeping rule for the Prerequisites field:
a task should not be written to read or join across another module's tables even
if no TASK ID prerequisite is technically broken by doing so. This law applies
identically to `search_meta` (owned by `SEARCH`) and `reporting` (owned by
`REPORT`) once those schemas exist — `REPORT`, in particular, must consume
`WF`/`DOCS`/`TRACK`/`ORG` data through the event bus or published module APIs,
never by querying those schemas directly, regardless of how convenient a direct
join across four modules' worth of reporting source data might seem.

---

## 5. Special Tags

| Tag           | Definition                                              | Apply when                                                                                                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[MIGRATION]` | Task produces a database migration file                 | Any task that changes a Drizzle schema and generates a corresponding SQL migration — `[Inference]` typically concentrated in `INFRA` (initial setup/conventions), and in whichever module owns the schema being changed (`IAM`, `ORG`, `DOCS`, `WF`, `TRACK`, `REC`, `NOTIF`, `AUDIT`, and eventually `SEARCH`, `REPORT` once their Phase 2 passes run) |
| `[ABAC]`      | Task implements or modifies an ABAC policy check        | Any task that adds or changes a permission condition from I1 — `[Inference]` concentrated in `IAM` (the policy engine itself) and in any other module's procedure that enforces a non-trivial condition beyond a basic role check                                                                                                                       |
| `[AUDIT]`     | Task writes to the audit schema or emits an audit event | Any task whose procedure mutates state that consolidated ref Architectural Law #3 (audit writes go through the audit service only) requires to be logged — `[Inference]` concentrated in `AUDIT` (the emitter/service itself) plus call-sites in any state-mutating procedure across other modules                                                      |

Tags are added to the Title field; a task may carry more than one, e.g.:
`Title: [MIGRATION][AUDIT] Create append-only audit events table`
(`A1-AGENTS.md` §4 — definitions and example are verbatim from that section;
the "which task types must carry them" elaboration above is `[Inference]`,
since §4 states the trigger condition but does not enumerate task types itself.)
No change to this section in v2 — the tag definitions are module-agnostic; only
the `[MIGRATION]` row's illustrative module list is extended to note `SEARCH`/
`REPORT` will eventually need it too.

---

## 6. Phase 1 Task Count Estimates

**All ranges below are `[Inference]`.** No Step 2 module pass has run yet, so no
actual task exists to count. Ranges are derived by counting named
capabilities/sub-deliverables for that module in the three loaded sources,
calibrated against the one-task-one-PR rule (`A1-AGENTS.md` §5) and, for `UI`
only, against the explicit per-Tier-3-component task rule (`A1-AGENTS.md` §6).
Treat as rough planning order-of-magnitude, not a commitment. `SEARCH` and
`REPORT` have no row — both carry zero Phase 1 capability (Section 3), so there
is nothing to estimate here; see `A1-AGENTS.md` §2 for their deferred scope.

| Module | Estimated Range                     | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INFRA  | 12–18 tasks                         | Spans env-var validation, Docker Compose for Postgres/MinIO/pgboss, the CI/CD pipeline stages, and the full backup/DR runbook set (daily dump, WAL PITR, replication, monthly restore test, quarterly drill, break-glass) — each separately reviewable per the one-task-one-PR rule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| UI     | 19 tasks `[Resolved — 2026-06-23]`  | Structurally fixed by F7's instantiation rule: one Foundation task (Plan 0), one J6-generation task (required by `A1-AGENTS.md` §6 but not separately instantiated in F5/F7), one task per Tier 3 component (16, confirmed by direct reading — F5 and F7 agree), one integration task (Plan 2). The estimated F5/F7 component-count discrepancy did not materialize on direct reading; see Section 3's closing note.                                                                                                                                                                                                                                                                                                                                                                                              |
| IAM    | 10–16 tasks                         | Covers the full auth flow (JWT issuance, refresh rotation, cookie handling, PKCE), the ABAC policy engine, and seeding the 13-role permission matrix named in I2's description — each a distinct reviewable unit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| AUDIT  | 6–10 tasks                          | Narrowly bounded by tech-stack.md's Audit Log Integrity section to the append-only schema, SHA-256 hash chaining, HMAC signing, and chain-validation-at-retrieval. Phase 1 estimate unaffected by v2's new AUDIT/Phase 3 DPA assignment — DPA compliance is Phase 3, out of scope for this Phase 1 count.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ORG    | 8–12 tasks                          | Bounded to offices, positions, employees, and assignment CRUD; delegation's active workflow is named as a Phase 2 addition in §13, so Phase 1 ORG scope is comparatively contained.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| DOCS   | 14–22 tasks                         | The largest Phase 1 module by named capability count: the document core schema, the document-type catalog and numbering-series seed data, the OCR service wrapper, and procedure/schema catalogs for every Phase 1 document type §13 names (SP Resolution, SP Ordinance, Appropriation Ordinance, Certification of Urgency, Transmittal Letter, Citizen Complaint, Document Request Form).                                                                                                                                                                                                                                                                                                                                                                                                                        |
| WF     | 16–24 tasks                         | The most logic-dense module per §13's Phase 1 list: the engine itself, three full workflow definitions each with standard + Certified Urgent paths, the multi-committee all-signatures rule, Thursday-cutoff/Second-Reading delay logic, and the 10-day Mayor lapse timer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| TRACK  | 6–10 tasks                          | Bounded to QR assignment at logging, routing-history recording, and scan-to-lookup — the three sub-capabilities §13 names under "DTS."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| REC    | 3–5 tasks `[Resolved — 2026-06-22]` | **Revised down from v1's 2–8 range** now that the Phase 1 scope question is settled (Section 3 above): schema-reservation only. Estimated unit of work: (1) `[MIGRATION]` create the `records` schema with placeholder `records` and `retention_schedules` tables; (2) `[MIGRATION]` add the `retention_schedule_id` reservation column to the relevant `documents`-schema table per H2; (3) baseline RLS policy stub(s) for the two new placeholder tables per the C3 convention that every table gets one even before a feature is wired to it; possibly (4) a verification task confirming the reservation does not interfere with `DOCS` Phase 1 (migration applies cleanly; `documents` Phase 1 writes succeed with the new column left null). No CRUD, no retention-policy enforcement — those are Phase 2. |
| NOTIF  | 10–14 tasks                         | In-app/SSE channel only (email is named as a Phase 2 addition in §13) across the eight named Phase 1 priority events, each needing trilingual template content.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| PORTAL | 8–12 tasks                          | Deliberately the smallest scope: only the four no-auth public capabilities §13 frames as the "Phase 1 subset" (status lookup, published-documents listing, citizen complaint submission, document request submission).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

**Aggregate, heavily caveated:** summing the ranges above (with `UI` now a
confirmed 19 rather than a 17–19 range) gives a rough span of **112–162 Phase
1 tasks** (revised from v1's 109–165, then v2's 110–162; `REC`'s range changed
from 2–8 down to 3–5, and `UI`'s range collapsed to a single resolved number,
raising the floor by 2). This is a `[Inference]` built on ten independent
`[Inference]` estimates plus one resolved count — still a compounding figure
for the ten unresolved modules, not a sourced number for the total. It is
included only as an order-of-magnitude pointer for planning purposes and
should not be treated as more reliable than its weakest remaining input —
which, with `UI` now resolved, is whichever of the other ten ranges turns out
to be least accurate once that module's own Step 2 pass runs.

---

## Changelog — v1 → v2 (2026-06-22)

All seven items v1 flagged are addressed below. Six were resolved by explicit
decision in v2 (2026-06-22); the seventh — `UI`'s component-count range — was
resolved the following day when the `UI` Step 2 module pass actually ran.

| #   | Item (v1 flag)                                                   | Resolution                                                                                                                                 | Where in this document |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| 1   | REC Phase 1 scope `[CONFLICT]`                                   | Real but narrow: schema reservation only; full feature is Phase 2                                                                          | §2 [‡], §3 [‡], §6     |
| 2   | `search_meta`/`reporting` no module code `[SPEC GAP]`            | Added `SEARCH`, `REPORT` module codes (also required a small `A1-AGENTS.md` edit)                                                          | §1, §2, §3, §5, §6     |
| 3   | `SEARCH` wave dependency (new item, surfaced while resolving #2) | Depends on `DOCS` only                                                                                                                     | §2                     |
| 4   | `REPORT` wave dependency (new item, surfaced while resolving #2) | Depends on `WF` + `DOCS` + `TRACK` + `ORG`                                                                                                 | §2                     |
| 5   | DPA compliance features (Phase 3) `[Unverified]`                 | Assigned to `AUDIT`                                                                                                                        | §3 [‡‡]                |
| 6   | Dashboards (Phase 3/4) `[Unverified]`                            | Not a module — a rule: owner = whichever module owns the underlying data, decided per dashboard                                            | §3, §4                 |
| 7   | Public REST API gateway (Phase 5) `[Unverified]`                 | Assigned to `PORTAL`                                                                                                                       | §3 [‡‡]                |
| 8   | Multi-LGU assessment (Phase 5) `[Unverified]`                    | Assigned to `INFRA`                                                                                                                        | §3 [‡‡]                |
| 9   | NCH auto-generation (Phase 2) low-confidence `[Inference]`       | Confirmed `WF` (not `TRACK`)                                                                                                               | §3 [‡‡]                |
| 10  | UI Tier-3 component count range (17–19)                          | **Resolved 2026-06-23** — UI Step 2 module pass read F5/F7 directly; both agree at 16 components; final task count is 19, see §6 row above | §3 (closing note), §6  |

(Items 3 and 4 are sub-decisions of item 2, not separate v1 flags — listed
separately here because they were resolved as distinct questions during the
Q&A.)
