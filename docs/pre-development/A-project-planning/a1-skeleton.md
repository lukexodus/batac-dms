# A1 Skeleton — Structural Contract

Generated per `A1-AGENTS.md` §6 "Step 1 — Skeleton." This document is the
structural contract for all later A1 generation passes. It contains no tasks.

**Documents loaded for this pass, in order:** `docs/pre-development/document-list.md`
→ `docs/pre-development/tech-stack.md` → consolidated reference §10.2 and §13 only.
(`A1-AGENTS.md` itself was read first, per the routing instructions, to obtain the
Pass Types table and the Step 1 rules this document follows.)

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
- Where something cannot be determined from the loaded sources at all, this
  document says so directly instead of presenting a guess as settled.

---

## 1. Task ID Convention

**Format:** `TASK-{MODULE}-{NNN}`

**Module codes (11, exhaustive — `A1-AGENTS.md` §3):**
`INFRA | UI | IAM | AUDIT | ORG | DOCS | WF | TRACK | REC | NOTIF | PORTAL`

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

| Wave | Module | Full Name | Pre-Dev Source Documents | Depends On |
|---|---|---|---|---|
| A | `INFRA` | Infrastructure [†1] | `tech-stack.md`; L1; L2; L3; L4; D5; C5; J3 | None |
| A | `UI` | UI Component Library Foundation [†1] | F5; J6; F6; F4; F1; `DESIGN.md`; `globals.css`; F7 | None |
| B | `IAM` | Identity and Access Management | B5; I2; I1; C1 §iam; J1; J2; J3; J4 | INFRA |
| B | `AUDIT` | Audit | C1 §audit; `tech-stack.md` §"Audit Log Integrity"; I3 | INFRA |
| C | `ORG` | Organization | C1 §organization; B2; I1; I2 | IAM, AUDIT |
| D | `DOCS` | Documents | C1 §documents; H2; H3; E1 §documents; E3; B2; I1; I2 | ORG |
| E | `WF` | Workflow | B4; C1 §workflow; H1; D3; K2; E1 §workflow; B2 | DOCS |
| E | `TRACK` | Tracking | C1 §tracking; consolidated ref §11.6; E1 §tracking; B2 | DOCS |
| F | `REC` | Records | C1 §records; E1 §records; B2; I1; I2 | WF, TRACK |
| F | `NOTIF` | Notifications | H4; C1 §notifications; E1 §notifications; B2; B3 | WF [†2] |
| G | `PORTAL` | Portal | E2; F1 §portal; consolidated ref §13 Phase 3 | INFRA, UI, IAM, AUDIT, ORG, DOCS, WF, TRACK, REC, NOTIF |

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

**[SPEC GAP]** Consolidated ref §10.2 names two further schema-owning modules —
`search_meta` (Phase 2) and `reporting` (Phase 2) — with no corresponding code in
`A1-AGENTS.md` §3's Module enum and no row in the Pass Types table. Phase 2
capabilities belonging to these domains (Meilisearch sync work; ARTA/configurable
reporting) currently have no module task list to land in. Out of scope for this
Phase 1 skeleton, but should be resolved — new module codes added, or these
capabilities reassigned to an existing module — before any Phase 2 module pass
runs.

---

## 3. Phase Scope Table

Cell values: **Full spec** / **Title only** / **N/A**, per the rule in
`A1-AGENTS.md` §6 Step 3 (Phase 1 and 1B always use the full task schema; Phases
2–5 are title + module only).

| Module | Phase 1 | Phase 1B | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|---|---|---|---|---|---|---|
| INFRA | Full spec | N/A | N/A | N/A | N/A | Title only |
| UI | Full spec | N/A | N/A | N/A | N/A | N/A |
| IAM | Full spec | N/A | Title only | N/A | N/A | Title only [†] |
| AUDIT | Full spec | N/A | Title only | N/A | N/A | N/A |
| ORG | Full spec [*] | Full spec [†] | Title only | Title only [†] | N/A | Title only [†] |
| DOCS | Full spec | Full spec | Title only [†] | Title only [†] | Title only | Title only |
| WF | Full spec | Full spec | Title only | N/A | Title only | N/A |
| TRACK | Full spec | Full spec [†] | N/A | N/A | N/A | N/A |
| REC | Full spec [CONFLICT — see below] | N/A | Title only | N/A | N/A | N/A |
| NOTIF | Full spec | Full spec [†] | Title only | Title only | N/A | N/A |
| PORTAL | Full spec | N/A | N/A | Title only | N/A | N/A |

`[†]` = module assignment is an `[Inference]` — the roadmap text (§13) names a
capability, not an A1 module code; the cell reflects matching that capability to
the closest module owner per §10.2's schema-ownership text. `[*]` = see
conflict note immediately below.

**Phase 1 basis:** marked "Full spec" for all 11 modules because `A1-AGENTS.md`
§2 defines an explicit Step 2 module-generation pass for each of the 11 codes,
and §6's Step 2 instructions open with "read the capability list for this module
in consolidated ref §13 Phase 1" for every pass without exception.

**[CONFLICT] REC / Phase 1:** Consolidated ref §13's Phase 1 "Included" capability
list does not name Records or a records module, and §13's Phase 2 list explicitly
states "Records Management module" is a Phase 2 addition. This appears to
disagree with `A1-AGENTS.md` §2, which defines a Phase 1 `REC` module pass with
real source documents (C1 §records, E1 §records, B2, I1, I2). Per `A1-AGENTS.md`
§1, this is flagged rather than resolved by guessing which document is more
recent. One plausible reading — `[Speculation]`, not confirmed — is that Phase 1
`REC` work is limited to schema/scaffolding (e.g., the `retention_schedule_id`
field H2 already references) while the full Records Management feature set ships
in Phase 2; this is not stated anywhere in the loaded sources and should be
confirmed by a human before the `REC` Step 2 pass runs.

**Capabilities named in §13 that this skeleton could not confidently assign to a
single module (not entered in the table above):**
- Meilisearch (Phase 2) and ARTA compliance reports / configurable report builder
  (Phase 2, Phase 4) — `[SPEC GAP]`, see §10.2's `search_meta`/`reporting` gap
  noted in Section 2 above.
- DPA compliance features (Phase 3) — `[Unverified]`, no single-module fit
  determinable from §10.2/§13 alone (candidates: AUDIT, IAM, or a cross-cutting
  legal/compliance concern not yet modeled).
- Advanced executive dashboards (Phase 3) / Advanced KPI dashboards (Phase 4) —
  `[Unverified]`; `A1-AGENTS.md` §2's Wave-order note explicitly excludes
  feature-specific dashboards from the `UI` module's scope, and no other module
  is named as dashboard owner in the loaded sources.
- Public REST API gateway (Phase 5) — `[Unverified]`, ambiguous between PORTAL
  (citizen/public-facing precedent) and INFRA (platform/gateway plumbing).
- Multi-LGU assessment (Phase 5) — `[Unverified]`, no module fit identifiable.
- Notice of Committee Hearing auto-generation "from committee referral step"
  (Phase 2) — assigned to `WF` in the table above; `TRACK` was considered and
  rejected as primary owner. `[Inference]`, low confidence either way.

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
not start before that prerequisite module's wave completes.

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

**No cross-schema reference, even informally.** Consolidated ref §10.3
Architectural Laws (read as part of §10.2's surrounding text): each module owns
its own PostgreSQL schema, with no cross-schema foreign key constraints, and
modules communicate only through the event bus or published module APIs — never
direct schema access. This is a design constraint on what a dependency may
legitimately represent, not only a bookkeeping rule for the Prerequisites field:
a task should not be written to read or join across another module's tables even
if no TASK ID prerequisite is technically broken by doing so.

---

## 5. Special Tags

| Tag | Definition | Apply when |
|---|---|---|
| `[MIGRATION]` | Task produces a database migration file | Any task that changes a Drizzle schema and generates a corresponding SQL migration — `[Inference]` typically concentrated in `INFRA` (initial setup/conventions), and in whichever module owns the schema being changed (`IAM`, `ORG`, `DOCS`, `WF`, `TRACK`, `REC`, `NOTIF`, `AUDIT`) |
| `[ABAC]` | Task implements or modifies an ABAC policy check | Any task that adds or changes a permission condition from I1 — `[Inference]` concentrated in `IAM` (the policy engine itself) and in any other module's procedure that enforces a non-trivial condition beyond a basic role check |
| `[AUDIT]` | Task writes to the audit schema or emits an audit event | Any task whose procedure mutates state that consolidated ref Architectural Law #3 (audit writes go through the audit service only) requires to be logged — `[Inference]` concentrated in `AUDIT` (the emitter/service itself) plus call-sites in any state-mutating procedure across other modules |

Tags are added to the Title field; a task may carry more than one, e.g.:
`Title: [MIGRATION][AUDIT] Create append-only audit events table`
(`A1-AGENTS.md` §4 — definitions and example are verbatim from that section;
the "which task types must carry them" elaboration above is `[Inference]`,
since §4 states the trigger condition but does not enumerate task types itself.)

---

## 6. Phase 1 Task Count Estimates

**All ranges below are `[Inference]`.** No Step 2 module pass has run yet, so no
actual task exists to count. Ranges are derived by counting named
capabilities/sub-deliverables for that module in the three loaded sources,
calibrated against the one-task-one-PR rule (`A1-AGENTS.md` §5) and, for `UI`
only, against the explicit per-Tier-3-component task rule (`A1-AGENTS.md` §6).
Treat as rough planning order-of-magnitude, not a commitment.

| Module | Estimated Range | Rationale                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| INFRA  | 12–18 tasks     | Spans env-var validation, Docker Compose for Postgres/MinIO/pgboss, the CI/CD pipeline stages, and the full backup/DR runbook set (daily dump, WAL PITR, replication, monthly restore test, quarterly drill, break-glass) — each separately reviewable per the one-task-one-PR rule.                                                                                                       |
| UI     | 17–19 tasks     | Structurally fixed by F7's instantiation rule: one Foundation task (Plan 0), one task per Tier 3 component (16 per F5), one integration task (Plan 2); range allows for the F5/F7 component-count discrepancy `A1-AGENTS.md` §6 flags as a possible `[SPEC GAP]`.                                                                                                                          |
| IAM    | 10–16 tasks     | Covers the full auth flow (JWT issuance, refresh rotation, cookie handling, PKCE), the ABAC policy engine, and seeding the 13-role permission matrix named in I2's description — each a distinct reviewable unit.                                                                                                                                                                          |
| AUDIT  | 6–10 tasks      | Narrowly bounded by tech-stack.md's Audit Log Integrity section to the append-only schema, SHA-256 hash chaining, HMAC signing, and chain-validation-at-retrieval.                                                                                                                                                                                                                         |
| ORG    | 8–12 tasks      | Bounded to offices, positions, employees, and assignment CRUD; delegation's active workflow is named as a Phase 2 addition in §13, so Phase 1 ORG scope is comparatively contained.                                                                                                                                                                                                        |
| DOCS   | 14–22 tasks     | The largest Phase 1 module by named capability count: the document core schema, the document-type catalog and numbering-series seed data, the OCR service wrapper, and procedure/schema catalogs for every Phase 1 document type §13 names (SP Resolution, SP Ordinance, Appropriation Ordinance, Certification of Urgency, Transmittal Letter, Citizen Complaint, Document Request Form). |
| WF     | 16–24 tasks     | The most logic-dense module per §13's Phase 1 list: the engine itself, three full workflow definitions each with standard + Certified Urgent paths, the multi-committee all-signatures rule, Thursday-cutoff/Second-Reading delay logic, and the 10-day Mayor lapse timer.                                                                                                                 |
| TRACK  | 6–10 tasks      | Bounded to QR assignment at logging, routing-history recording, and scan-to-lookup — the three sub-capabilities §13 names under "DTS."                                                                                                                                                                                                                                                     |
| REC    | 2–8 tasks       | Wide range directly reflects the `[CONFLICT]` noted in Section 3 — cannot be tightened until the Phase 1 vs. Phase 2 scope question for Records is resolved by a human.                                                                                                                                                                                                                    |
| NOTIF  | 10–14 tasks     | In-app/SSE channel only (email is named as a Phase 2 addition in §13) across the eight named Phase 1 priority events, each needing trilingual template content.                                                                                                                                                                                                                            |
| PORTAL | 8–12 tasks      | Deliberately the smallest scope: only the four no-auth public capabilities §13 frames as the "Phase 1 subset" (status lookup, published-documents listing, citizen complaint submission, document request submission).                                                                                                                                                                     |

**Aggregate, heavily caveated:** summing the ranges above gives a rough span of
**109–165 Phase 1 tasks**. This is a `[Inference]` built on eleven independent
`[Inference]` estimates — an explicitly chained, compounding figure, not a
sourced number. It is included only as an order-of-magnitude pointer for
planning purposes and should not be treated as more reliable than its weakest
input (`REC`'s 2–8 range, itself gated on an unresolved conflict).