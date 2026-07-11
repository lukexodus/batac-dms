# Batac City LGU Platform — Frontend Task Planning: Architecture and Findings

## System Overview

The Batac City LGU Platform is built via a document-governed, multi-pass generation pipeline defined in `docs/pre-development/A1-AGENTS.md`. Module-level task lists (infra, ui, iam, audit, org, docs, wf, track) are produced through a 14-pass generation process where each module pass loads a defined document set plus the already-generated task lists of its prerequisite modules, in dependency-wave order (Wave A → B → C → ... → G). Step 3 (Outline) and Step 4 (Integration) are meant to assemble everything into a final master list after individual module passes complete.

## Why There Is No Standalone FE Module

This is a deliberate architectural decision, not an oversight or gap.

**Source:** `A1-AGENTS.md`, lines 135–139.

> "UI is Wave A because it has no server dependencies... The UI module tasks cover only the component library foundation and the domain component library (the 16 Tier 3 components). Feature-specific UI tasks (Secretary dashboard, document detail view, complaint form) belong to the module that owns that feature, not to UI."

**Supporting rule:** Section 1 / Section 6, Step 1, item 4 — the cross-module dependency rule states: "UI feature pages depend on the backend module tasks that implement the tRPC procedures they call."

### Resulting Ownership Model

- **UI module**: component library foundation + the 16 Tier 3 domain components only. No feature pages.
- **Feature-specific frontend work** is generated and assigned by whichever backend/domain module owns that feature area:
  - `DOCS` owns document-facing pages (e.g., `TASK-DOCS-023` — Document Detail page)
  - `WF` owns workflow-facing pages (e.g., `WF-FE-001/002/003`)
  - `ORG` owns org-facing pages
  - (and so on for other domain modules)

This means there is structurally no single place where "the frontend" as a whole is planned — frontend work is distributed across every domain module's own task list, or (per Mechanism 2) appended as a standalone post-closure document.

**Reframing implication:** because "the frontend" was never architected as one generatable module, the operation of building a complete frontend task list is not "generate one missing module's pass." It is "extract the frontend-shaped tasks that live inside each already-finished module's list, module by module" — a cross-cutting extraction, not a single new generation.

## Naming Convention Inconsistency (Finding)

Workflow module's own frontend sub-tasks are hand-numbered `WF-FE-001`, `WF-FE-002`, `WF-FE-003` rather than following the formal `TASK-WF-NNN` scheme used elsewhere. This is a deviation from the canonical task-numbering convention and should be treated as a known inconsistency when reasoning about task provenance.


## Nature and Origin of `fe.md`

`fe.md` is **not** a peer artifact to `ui.md`, `docs.md`, `wf.md`, or other module task lists within the A1 pipeline. It does not appear in the A1-AGENTS.md Section 2 pass-type table (no `TASK-FE` entry) and was created outside the documented wave sequence — origin commit `1ee32fd`, message `a1-fe`.

### What `fe.md` Actually Is

A running log of ad-hoc, individually-scoped fix/feature prompts for post-module-closure frontend work on the WF module. It contains three tasks: `TASK-WF-FE-001`, `TASK-WF-FE-002`, `TASK-WF-FE-003`.

Each entry is structured as a **forensic investigation report**, not a forward-looking build spec:
- Exact line numbers referencing live source files
- Exact bug reproduction steps
- An explicit "Explicitly Out of Scope" section
- References to a running discovery log (`docs/development-findings-log.md`) that tracks `proposed`/`confirmed` findings across sessions

**Example — `TASK-WF-FE-003`:** Not a "build a new page" task. It is a bug fix for a step-completion regression in the Secretariat Decision panel, discovered via close reading of the workflow router.

### Generalized Precedent

`TASK-DOCS-020/021/022/023` (from `docs.md`) follow the same "standalone document appended after module task-list closure" pattern seen in `fe.md`. This is a recurring mechanism across modules, not a WF-specific special case: once a module's main task list is formally closed, further frontend work for that module is added as ad-hoc, forensically-verified follow-up tasks rather than being pre-planned as part of the original task list.


## Two Distinct Task-Generation Mechanisms

The pipeline contains two structurally different mechanisms for producing frontend tasks, and conflating them is the root cause of confusion about what "generate a frontend task list" can mean.

### Mechanism 1: Step 2 Module Pass (document-based)

This is the primary generation mechanism used for `ui.md`, `iam.md`, `wf.md`, `docs.md`, and all other module task lists, including `rec.md`, `notif.md`, and `portal.md` once run. It is **document-and-prior-task-ID-based**, not "read the live code" based:

- Each module pass loads a specific, ordered document set (pre-dev architecture docs) plus the already-generated task lists of prerequisite modules.
- Example: the `TASK-IAM` pass loads Skeleton → INFRA list → B5 → I2 → I1 → C1 §iam → J1 → J2 → J3 → J4 — eight to nine specific source documents, in order, before a single task gets written.
- This lineage is why a task like "implement the login flow" ends up with the exact ABAC policy rule from I1, the exact schema columns from C1, the exact procedure signature from E1 — these details were sitting in context when the task was written, not reconstructed from general knowledge.
- Per Section 7 of A1-AGENTS.md, the AI Prompt field of a generated task "is the only thing an execution-phase agent will have access to at task time." Filling it with plausible-sounding but unverified content (i.e., not sourced from the actual document lineage) risks the execution agent building the wrong thing with no way to detect the error until after implementation.

A **high-level list** — "these are the screens/components this module needs, roughly in this order, here's who talks to what" — does not require reading implemented code. It requires reading the same kind of documents the module passes already read (route map, domain requirements, which module owns which feature), and is compilable from docs plus the content of already-finished module task lists. This is distinct from a **full execution-ready task spec** (with a complete AI Prompt field containing pasted-in ABAC rules, schema definitions, procedure signatures), which is the expensive, document-heavy artifact that genuinely requires the full document lineage a Step 2 pass uses.

### Mechanism 2: Ad-hoc Post-Closure Forensic Tasks (`fe.md` and equivalents)

This mechanism is **live-code-verified**, not document-based, and genuinely cannot run ahead of implementation:

- Applies to standalone task documents created after a module's main task list has formally closed (e.g., `fe.md` for WF, `TASK-DOCS-020–023` for DOCS).
- Each task is produced by first re-reading the actual current state of specific source files, line-by-line, in the same session, and writing the task prompt as a direct record of that verification.
- Tasks under this mechanism reference a running discovery log (`docs/development-findings-log.md`) tracking `proposed`/`confirmed` findings across sessions, and typically include exact bug reproduction steps and an "Explicitly Out of Scope" section.
- Because generation depends on reading live, already-implemented code, this mechanism structurally cannot produce tasks for work that hasn't been built yet.

**Key implication:** an earlier claim that frontend planning "cannot even produce a high-level, non-technical overview list — must be done task-by-task, live-code-verified" is a true statement about Mechanism 2 only, incorrectly generalized to all frontend planning. A high-level master list of frontend components/screens, roughly sequenced without full technical specificity, is achievable via Mechanism 1's document sources and does not require the unimplemented-code precondition that blocks Mechanism 2.


## Status of the Master Phased Task List

`a1-master-phased-task-list.md` — the file intended to be the true Step 4 Integration output per `A1-AGENTS.md` — is **empty (0 lines) at HEAD**, and has been since the project's very first week. Git history shows it was touched only twice, both at project start, consistent with it being an unused placeholder.

**Conclusion:** The formal Step 4 Integration pass — the mechanism that would actually generate a complete, unified frontend/master task list — has never been executed in this project. All task-list artifacts that currently exist (module task lists, `fe.md`) are Step 1/Step 2 outputs only.

## REC, NOTIF, and PORTAL Module Status

`notif.md`, `portal.md`, and `rec.md` exist as files but are **genuinely empty (0 bytes)** — the same situation as `a1-master-phased-task-list.md`. Every other module's task list is fully populated (ranging from ~1,365 to ~3,430 lines).

**Git history:** created as empty placeholders in the early "skeleton" scaffolding commits (June 16, June 22), never touched since, never populated. This is not lost work or corruption — these three simply have not had their generation pass run yet.

### Critical Distinction from the FE Situation

`REC`, `NOTIF`, and `PORTAL` are **real, defined module passes** in the pipeline — rows 65–67 in the A1-AGENTS.md Section 2 table, with fully specified document-load orders:

| Module | Wave | Prerequisites |
|---|---|---|
| REC | F | `TASK-WF` list + `TASK-TRACK` list |
| NOTIF | F | `TASK-WF` list only, plus H4/B2/B3 docs |
| PORTAL | G | **All** module task lists (structurally cannot run until REC and NOTIF exist) |

This is categorically different from the `FE` situation: `FE` does not exist in the module list at all and was never supposed to. `REC`, `NOTIF`, and `PORTAL` are supposed to exist as standard Step 2 module passes and simply haven't been run.

**Wave sequencing rule** (A1-AGENTS.md, lines 89–90): "Each wave can only begin after all prerequisite wave task lists exist, because later waves reference earlier task IDs in their Prerequisites fields." Practical effect: REC and NOTIF can run in parallel (both Wave F, both only need WF+TRACK), but PORTAL cannot run until REC and NOTIF are *both* complete, since it is Wave G, the terminal wave, requiring "all above."

**Generation mechanism:** REC/NOTIF/PORTAL Step 2 passes use Mechanism 1 (document-and-prior-task-ID-based) — the same mechanism that produced `ui.md`, `iam.md`, `wf.md`, etc. They do **not** carry the "must read exact current file state" constraint that applies to Mechanism 2 (fe.md-style) tasks. This means REC/NOTIF/PORTAL task lists are generatable from documents alone, in the same way the already-completed module task lists were — the blocker for them is purely wave-sequencing (they haven't been run yet), not any code-verification precondition.

## Verified Module-by-Module Frontend Task Audit

Verified via two independent methods: regex search for `/apps/web` deliverable file paths, and direct manual read of every task title in each module's list.

| Module | Backend tasks | Frontend tasks declared inside this module's own list |
|---|---|---|
| INFRA | (not audited — out of scope) | — |
| UI | — | 16 Tier 3 components + Foundation PR + integration page (component *library*, not screens) |
| IAM | 14 | **0** |
| AUDIT | 7 | **0** |
| ORG | 10 | **0** |
| DOCS | many | 4 (`trpc.ts`/`pkce.ts`/`main.tsx` foundation, DocumentListPage, DocumentIntakePage, DocumentDetailPage) |
| WF | 24 | **0** in `wf.md` itself — frontend work exists only in the separate `fe.md` file (see "WF Frontend" section below) |
| TRACK | 9 | **0** |

**Confirmation detail:** `org.md` (10 tasks) and `audit.md` (7 tasks) are entirely backend by direct title read — schema, repository, services, tRPC routers, seed data, plugin wiring. `iam.md` (14 tasks), `wf.md` (24 tasks), and `track.md` (9 tasks) are also entirely backend by title. Not one task title across any of these six modules says "page," "view," "form," "panel," or names a `.tsx` file.

**Why `fe.md` shows zero `/apps/web` regex hits despite containing real frontend work:** `fe.md` does not follow the A1 schema's task header format (headers are `## TASK-WF-FE-NNN`, not `TASK-` at line start). Its file-path references appear as bare filenames (e.g., `SecretariatDecisionPanel.tsx`) without a leading `/apps/web/` path, because — for tasks that are diffs against existing code — the exact path is irrelevant to the diff; only line numbers matter. This is mechanically different from `docs.md`'s `DocumentIntakePage`/`DocumentDetailPage` tasks, which *do* declare new full file paths, because those pages didn't exist yet when the task was written and the path itself was part of the deliverable.

### What This Means

For IAM, AUDIT, ORG, and TRACK, there is no frontend task anywhere — not already done, not logged elsewhere, genuinely absent. Four fully-implemented backend modules have no frontend task built against them yet at all, by this repo's own task-tracking.

This means generating "continuation tasks" is not a uniform operation across modules:
- **IAM / AUDIT / ORG / TRACK**: would require a **first frontend pass** from nothing, materially larger and more document-hungry than a continuation task — closer to a fresh Step 2-style module pass than to writing three quick follow-ups.
- **WF**: requires understanding its actual remaining surface first (see below) rather than assuming a simple continuation.

**Risk in generating these directly without full document lineage:** producing execution-ready task specs (e.g., "TASK-IAM-FE-004: build the login page") without having read the module's actual document set (for IAM: I1, I2, B5, C1 §iam, etc.) means any technical content in the AI Prompt field (ABAC conditions, schema shape, procedure signatures) would be reconstructed from general knowledge of how such pages usually work, not from the project's actual spec — exactly the failure mode the pipeline's document-lineage requirement exists to prevent.

## WF Frontend — Fully Verified State

An initial regex-based pass concluded that `SecretariatDecisionPanel.tsx` was WF's only frontend artifact and that all three `fe.md` tasks were narrow forensic bug-fix diffs. **This was incorrect** and was corrected by directly listing `apps/web/src/pages/workflow/` and reading each `fe.md` task in full.

### What Actually Exists on Disk

A full `apps/web/src/pages/workflow/` directory containing:
- `MyAssignedStepsPage.tsx`
- `WorkflowStepActionPage.tsx`
- `columns.tsx`
- **Eleven** panel components (not one) — see full list below.

### Verified Scope of Each `fe.md` Task

**`TASK-WF-FE-001`** (commit message: `feat(workflow): (TASK-WF-FE-001)` — a `feat` commit, not a diff):
- Full build task. Read in full (347 lines, no sub-headers).
- Entire deliverable checklist: `MyAssignedStepsPage.tsx` + its `columns.tsx` + a route registration. **One page only.**
- Explicitly, by name, refuses to build `WorkflowStepActionPage` (the page hosting all panels), calling it "a separate, larger follow-on task."
- Points to a route-map document (F1 lines 341–392, §8.2) that lists ten panel names as that follow-on's spec.
- States explicitly that it "has no existing entry in wf.md or docs.md" and describes itself as following "that same 'standalone document after its module's task-list file closed' precedent."
- Cites a document — `docs/compressed-knowledge-base/frontend-tasklist-creation-knowledge-base.md` — as the source of that precedent. **This file does not exist anywhere in the repository** (confirmed by direct path check and broad search — not a naming mismatch, no `.bak`, nothing found). Either it existed at the time `001` was written and was later deleted/never committed, or it lived outside this repo and was referenced as if it were a stable path. Cannot be determined from available information.

**`TASK-WF-FE-002`** (read in full):
- Full build task, despite initially appearing (via a shallow read) to be a narrow investigation.
- Built `WorkflowStepActionPage.tsx` and **all ten panels**, plus two small backend prerequisites those panels needed: `organization.listCommittees` and a `panelHint` field added to `getInstance`.
- Its own acceptance criteria state explicitly: "renders all 10 panels conditionally on `panelHint`."
- Its own "NON-GOALS" section names `/admin/committees` (F1 §12.2) as explicitly out of scope.

**`TASK-WF-FE-003`**:
- The only one of the three that is a genuine forensic bug-fix diff, in the originally-assumed style.
- Targeted fix for a step-completion regression in the Secretariat Decision panel, discovered by close reading of the workflow router.
- `SecretariatDecisionPanel.tsx` is referenced by bare filename only (no `/apps/web/...` path) with exact line numbers (7–11, 19, 32–33), because this is a diff against a file that already exists on disk, not a new deliverable.

### Eleven Panels Built by `TASK-WF-FE-002`

`GenericAction`, `GenericApproval`, `VPCertification`, `MayorDecision`, `MayorLapseConfirmation`, `VetoOverride`, `MultiReferral`, `SecretariatDecision`, `Docketing`, `PanlalawiganOutcome`, `PublicationDate`.

### Summary — WF's Verified Frontend Coverage

- **Fully covered, by task and by code:** the task-inbox page (`/workflow/steps`, from `001`) and the step-action detail page (`/workflow/steps/:instanceId`, from `002`) with all ten panels. One of the ten (`SecretariatDecision`) had a confirmed bug, fixed by `003`.
- **Explicitly named as unbuilt inside the tasks themselves** (not merely absent by omission):
  - `/admin/committees` (F1 §12.2) — named in `TASK-WF-FE-002`'s own "NON-GOALS" section.
  - `SecretaryDashboardPage` and `MayorDashboardPage` — named in `TASK-WF-FE-001`'s own "THINGS NOTED BUT DELIBERATELY OUT OF SCOPE" section, documented in F4 (lines 356–364, 397–402) but not yet built, described there as "not-yet-built dashboard pages."

**Open question, not yet resolved:** whether those two dashboards plus `/admin/committees` represent the *entirety* of what remains open for WF, or whether F1/F4 document additional WF-owned screens beyond those three. Neither `001` nor `002` claims to be a complete inventory of WF's full frontend surface — both cite F1/F4 only for their own narrow purpose.

## F1 and F4 Route Map Documents

- **F1** — application route map, 587 lines. The authoritative document for "what pages exist," including route hierarchy, master route table, and module ownership per section. Contains §8 (Workflow — cited by both `001` and `002`), §8.2 (lists the ten panel names as the `WorkflowStepActionPage` follow-on's spec), and §12.2 (the `/admin/committees` route, cited by `002`'s NON-GOALS section). Read in full across the investigation, covering the table of contents, cross-cutting notes, the full route hierarchy, the master route table, and every module-specific section including the complete Workflow section (§8).
- **F4** — 1,108 lines. Contains the dashboard documentation cited by `TASK-WF-FE-001` (lines 356–364 for `SecretaryDashboardPage`, 397–402 for `MayorDashboardPage`). Not yet read in full as of the end of this investigation — planned next step to establish a complete inventory of WF's remaining open frontend surface, but not reached.

---

# Batac City LGU Platform — Frontend Architecture & Task Planning Reference

## System Overview

The Batac City LGU Platform is a government system built from modules: **INFRA, UI, IAM, AUDIT, ORG, DOCS, WF (Workflow), TRACK**. Additional modules — **REC (Records), NOTIF (Notifications), PORTAL, SEARCH, REPORT** — are pending or deferred.

- **REC, NOTIF, PORTAL** module task files (`rec.md`, `notif.md`, `portal.md`) are **0 lines** — not yet generated.
- **SEARCH** and **REPORT** are explicitly deferred to Phase 2+ and do not get their own module task-generation passes; they appear only as title-only entries in later phase documents.
- There is **no standalone "FE" (frontend) module** in the system by design. The **Pass Types table** in the governing document (`A1-AGENTS.md`) has no "FE" row. Frontend work is distributed to whichever domain module owns that feature — UI module owns only the shared component library, not feature pages.

## Task Generation Pipeline (A1 Pipeline)

Governing document: `A1-AGENTS.md` (467 lines). Operator-facing manual: `build-master-tasklist.md` (root-level, ~19.8KB, previously unreferenced/undiscovered file).

### Pipeline structure
- 14-pass dependency-wave process across modules.
- **Step 1 (Skeleton):** Establishes dependency rule — UI feature pages depend on the backend module tasks that implement the tRPC procedures they call.
- **Step 2 (Module pass):** Generates each module's task list document, including a **Module Summary** section.
- **Step 3 (Outline / `a1-outline-phases.md`):** Output is **0 lines** — this step has **not executed**.
- **Step 4 (Integration):** Cannot have run, since it depends on Step 3's output as input. This is the true stall point (earlier than previously assumed — the pipeline stalled at Step 3, not Step 4).

### Step 4 Integration — the "six operations"
Six operations defined in `A1-AGENTS.md` §6, including:
1. Task ID audit (uniqueness across all modules)
2. Prerequisite graph validation (verify every referenced task exists)
3. **"Missing task detection"** — **important clarification**: this is *not* a spec-coverage check against F1 or the route map. It is a **prerequisite-graph completeness check only**. It flags a missing task *only* if another task's `Prerequisites:` field references a task ID that doesn't exist anywhere. It does not perform semantic validation against requirements documents.
   - **Consequence:** Even if the full pipeline had run to completion, this operation would **never** catch gaps like "IAM has zero frontend tasks despite F1 documenting IAM-owned routes," because no task in the repo declares a prerequisite on a nonexistent IAM frontend task. This class of gap is **structurally invisible** to the pipeline's own self-check machinery. A manual cross-reference between F1 (route map) and what's actually built is the only way to surface it.

### Document loading pattern (Step 2, per module)
- F1 (the application route map document) is loaded during Step 2 by only **two** passes: **UI** and **PORTAL** (PORTAL loads only a specific section, "§portal only").
- **IAM, AUDIT, ORG, DOCS, WF, and TRACK's own Step 2 document-load lists do NOT include F1 at all.**
- Consequence: F1 is fully authored with per-module route ownership assigned, but it was **never cross-referenced** against these six modules' task-list generation to verify each module actually builds every page F1 assigns to it.
- WF's later-generated frontend tasks that *do* reference F1 (e.g., citing "F1 §8") did so as an **ad-hoc reference in a separate, later, post-closure session** — not as part of WF's own formal Step 2 document lineage. This distinction reinforces that F1 is available as a pure document independent of live-code verification but simply wasn't part of the original generation input for those six modules.

### Module Summary section format
Exact structure (verified directly): **Total tasks / First executable task / Spec gaps / Deferred capabilities**. Appears at the tail of each module's `.md` task file. Tagged with `[SPEC GAP]` and `[DEFERRED — Phase X]` markers.

- Grep pattern note: files use markdown H2 headers, e.g. `## Module Summary — IAM`, not a bare `Module Summary` line start. A naive regex anchored to line-start will falsely appear to find nothing — check for the H2 pattern instead.
- Both `iam.md` and `org.md` **do** have proper Module Summary sections (confirmed after correcting the search pattern).
- Efficient retrieval method: grep each module's `.md` file for `Module Summary — {MODULE}` and read only that tail section, rather than parsing entire multi-thousand-line files.

### Task-prompt authoring conventions differ by file
- `fe.md` uses prose blocks.
- `wf.md` uses a structured Deliverables/Acceptance Criteria format.
- Any new task appended to a given file should match that file's existing convention.

### Governance rule (from handoff document, confirmed elsewhere)
> "Agents never edit Group B–L documents directly, even for 'obvious' fixes — hard rule."

Also, independently asserted in two places (generation-phase doc and execution-phase `AGENTS.md`):
> "A human resolves document issues between passes, not during them."

Findings/discrepancies are logged in an **append-only system**; only humans can promote or resolve entries.

## Two Distinct Frontend Task-Generation Mechanisms

1. **Document-based mechanism** (built `ui.md`, `iam.md`, `wf.md`, etc. via the A1 pipeline's Step 2 passes). This mechanism *can* run ahead of implementation — it's document/spec-driven.
2. **Live-code-forensic mechanism** (`fe.md`-style). This is a **post-closure forensic log**, not a peer artifact to the module task lists. It is generated by investigating actual code state after a module has already closed, and it **structurally cannot** run ahead of implementation — it requires the current frontend task to already exist in code before the next can be forensically documented.

Example: `fe.md` is WF-module-specific, containing 3 tasks, 2 of which are full build tasks rather than bug fixes. DOCS similarly has 4 frontend tasks appended **after** module closure, following the same forensic pattern.

## Frontend Architecture Source Documents (F-series)

Location: F-frontend-architecture doc group.

| Doc | Content | Status/Notes |
|---|---|---|
| **F1** | Application route map — the authoritative, single most load-bearing document for what pages exist, their required roles, and their backend procedure dependencies | Marked **DRAFT** — a proposal, not finalized/approved architecture. Master route table maps every route → component → required roles → backend procedures it depends on. |
| **F4** | Component hierarchy specification (`f4-component-hierarchy-specification.md`, 1,108 lines) | Complementary to F1, not a source of new pages — derives component names and parent-child relationships directly from F1's route nesting structure. **Documentation defect**: file's internal header declares "Document ID: F2" while the filename and all external references call it "F4" — a copy-paste artifact from an earlier versioning scheme, never cleaned up. Section 4.2 states "eleven workflow action and approval panels" in prose (third independent confirmation of the 11-panel count). Sections 5.1–5.10 mirror F1's sections 5–14 (dashboards, documents, workflow, complaints/document-requests, sessions, audit, admin, secretary widgets, portal, sysadmin). Full read of all 1,108 lines was not necessary once ToC and opening statement confirmed it introduces no new pages. |

### F1 structure
- Sections 1–16 covering SP Secretary dashboard through various administrative views.
- **§8.2**: Panel table lists **11 panels**, not 10.
- **§11**: Titled "Audit log viewer" — a documented page for AUDIT module, which has **zero frontend tasks** anywhere in its task list. This is the clearest single documented-but-unimplemented gap for AUDIT.
- **§12**: Platform Administrator views, including committee assignments and configuration panels.
- **§12.7**: Claims `records.getRetentionSchedule` is "read, unchanged" (implying it already exists). **This claim is factually incorrect** — see Retention Schedule findings below.
- **Resolved Gaps register**: Documents that six ADRs "pulled forward" new items into Phase 1 scope: portal hosting, Tier-2 config CRUD, retention schedule CRUD, announcements, Designation doc type, sysadmin views.
- F1 itself states, verbatim in spirit: whether that expanded Phase-1 scope actually got absorbed into task-generation is `[Unverified] — not assessable from the documents reviewed`.
- Open follow-up items noted within F1 itself: whether Platform Admin's designation-scope confirmation still applies after the Phase 1B→Phase 1 shift; four System Administrator infrastructure capabilities with no documented procedures and no clear module owner; feasibility of retroactively linking anonymous submissions to citizen accounts; whether Phase 1 can realistically absorb all six pulled-forward items.
- Important semantic distinction: within this framework, "built" (in gap-resolution register language) means **specified and documented**, not actually implemented in code.

### Absolute path issue
F1 contains a documentation issue related to absolute file paths (flagged as a minor housekeeping item — exact nature not fully detailed in source, but noted alongside the F4 Document ID mismatch as something requiring correction).

## ADR Ecosystem

A substantial ADR (Architecture Decision Record) set exists, not referenced in prior findings:
- **10 ADRs** in the UI route map ADR folder.
- **6 ADRs** in a separate Zustand store design ADR folder.
- **16 ADRs total**, indexed in `ADR-INDEX.md` (one-line summaries of each).
- Additional frontend architecture documents: Zustand store design spec, TanStack Query key factory spec, accessibility checklist. These are execution-level implementation detail (state management patterns, accessibility rules), not page-inventory detail — relevant to implementers, not to master-list scoping.

Key ADRs relevant to scope/ownership questions:
- **ADR-UI-002** (`tier2-config-crud-scope`): Governs Platform Admin Tier-2 config CRUD procedures being pulled into Phase 1 scope (cited as "Gap 2" resolution in F1's resolved-gaps register).
- **ADR-UI-003**: Defines net-new retention-schedule propose/activate write procedures (read procedure already existed; write procedures are new and unbuilt).
- **ADR-UI-006**: Defines new announcement procedures (blocked — see Announcements finding below).
- **ADR-UI-007**: Pulls the Designation document type and its "Log Designation document" action into **Phase 1** scope (see Designation/Delegation tension below).
- **ADR-UI-008** (`system-administrator-views`): Bears on System Administrator view scope — relevant to whether IAM has documented-but-unbuilt admin UI.
- **ADR-B2-3**: Supersedes prior Secretariat Decision Panel routing — replaces `documents.logSecretariatDecision` with a Workflow-Router mutation. F1 §8.2 has been updated to reflect this as a living-document correction, consistent with TASK-WF-FE-003's actual fix.

## Backend Router Ownership (Verified Against Server Source Code)

Server module directories confirmed to exist under `apps/server/src/modules/`: **audit, documents, iam, organization, tracking, workflow** (six directories total). INFRA is not a runtime module — it handles environment config and CI/CD setup only, so it has no server module directory.

| Router | Actual Owning Module | Note |
|---|---|---|
| `complaints.router.ts` | **documents (DOCS)** | Previously assumed WF or unowned. Confirmed by file location, not inference. |
| `document-requests.router.ts` | **documents (DOCS)** | Same as above. |
| `session.router.ts` | **workflow (WF)** | Nested under workflow module, not standalone. Governs `/order-of-business` and `/sessions`. |
| `getSlaComplianceData` | **workflow (WF)** | Confirmed implemented — defined in the workflow router at line 613, backed by an ABAC policy in `workflow.policy.ts`. Real backend support exists for secretary/mayor dashboard SLA reporting. |
| `getRetentionSchedule` / retention/records router | **Does not exist anywhere in server codebase** | No `records.router.ts` or retention router found by filename search; confirmed further by content search (not just filename) — zero matches anywhere. This directly contradicts F1 §12.7's claim that this procedure is "read, unchanged." |

### DOCS ownership correction (significant finding)
Because `complaints.router.ts` and `document-requests.router.ts` are DOCS-owned, **DOCS has undelivered frontend surface**: 6 routes for staff-side management (list/new/detail × 2 entities) with no corresponding frontend tasks anywhere. The earlier conclusion that "DOCS is fully covered with precedent established" was **premature** — it was based on scanning task *titles* in `docs.md` rather than cross-referencing against F1's actual route table. This gap only surfaces via direct route-to-task cross-reference.

### WF ownership expansion
Because `session.router.ts` is WF-owned, **Order of Business and Session Attendance** are WF-owned pages with **zero frontend built**. This adds 3 more undelivered routes to WF's surface beyond the 2 dashboards (Secretary and Mayor) and the `/admin/committees` route already known — a significant expansion beyond what the prior audit had caught (which only found explicitly-named unbuilt items).

## Currently Built Frontend Surface (Ground Truth, Verified via Repo)

The complete `apps/web/src/pages/` directory listing confirms, exhaustively:

- **11 panel component files exist**, matching F1's 11-row §8.2 table exactly (Generic Action, Generic Approval, VP Certification, Mayor Decision, Mayor Lapse Confirmation, Veto Override, Multi-Referral, Secretariat Decision, Docketing, Panlalawigan Outcome, plus one more — 11 total). This is confirmed via three independent sources: F1's table (11 rows), the actual directory listing (11 files), and F4's own prose ("eleven workflow action and approval panels").
- **There is no `/admin`, `/sysadmin`, `/audit`, `/organization`, `/secretary`, `/mayor`, `/order-of-business`, `/sessions`, `/complaints`, `/document-requests`, or `/retention-schedules` directory anywhere** in the built frontend.

**The entire currently-built frontend consists of exactly:**
1. UI module's component showcase (component library only)
2. DOCS module's 3 document pages (DocumentListPage, DocumentDetailPage, and one more — core pages only, no complaints/document-requests pages)
3. WF module's 2 pages (main assigned-steps page + workflow action page) + 11 panel components

**Everything else that F1 documents is unbuilt.**

## Module-by-Module Frontend Task Status

| Module | Frontend Tasks | Notes |
|---|---|---|
| **UI** | 16 Tier 3 components + Foundation task + Integration task | Most frontend work of any module. All three implementation plans (Foundation PR, per-Tier-3-component, integration page) are component-library-only scope — no feature pages. |
| **IAM** | **Zero** frontend tasks | Deferred-capabilities section lists 4 items for later phases (MFA TOTP, SSO, citizen portal auth, PhilSys verification) — **none mention admin/sysadmin frontend pages**. IAM never flagged frontend gaps as deferred; its own document lineage never included F1, so this is an **undetected gap**, not a deliberate deferral. IAM backend (roles) IS built — `/admin/roles` is a pure frontend gap. Even so, the documented scope for `/admin/roles` covers only role *assignment*; role *definition* procedures don't exist anywhere in the system. |
| **AUDIT** | **Zero** frontend tasks | Deferred items are backend-focused only (HMAC key rotation, DPA compliance) — not frontend-related. F1's §11 "Audit log viewer" is a documented but entirely unimplemented page. Same root cause as IAM: F1 was never part of AUDIT's Step 2 document lineage, so this is a silent/undetected gap. |
| **ORG** | Deferred delegation-management UI | ORG's Module Summary explicitly states: `[DEFERRED — Phase 1B: Delegation management UI — the tRPC procedures... exist... but the frontend pages for delegation management (designation logging form, active designation list view) are Phase 1B features owned by this module.]` This is a **deliberate scope decision**, not an oversight — the only module of the four (IAM/AUDIT/ORG/TRACK) where the gap was actually flagged on purpose. `/admin/committees` is ORG-owned with a built backend, already flagged as a non-goal in existing task workflow (consistent, no new gap). |
| **DOCS** | 3 core pages built; 4 frontend tasks appended post-closure (forensic-style, see fe.md pattern) | **Undelivered**: 6 routes for complaints/document-requests staff management (see Backend Router Ownership above) — missed by prior title-only audit of `docs.md`. |
| **WF** | 2 pages + 11 panels built; `fe.md` has 3 tasks (2 full builds, 1 fix) | **Undelivered**: Secretary dashboard, Mayor dashboard (both frontend-only gaps — backend `getSlaComplianceData` exists), Order of Business, Session Attendance (both newly-discovered via session.router.ts ownership), `/admin/committees` route. TASK-WF-FE-001 built the main assigned-steps page + routing but explicitly deferred the action page as a follow-on task; it references a knowledge-base document that does **not** exist in the repo. TASK-WF-FE-002 built the workflow action page (11 panels). |
| **TRACK** | 9 total tasks per its Module Summary | Has a "Spec gaps — resolved" section. |
| **INFRA** | **No F1-documented pages at all** | The only infrastructure-related mention is in F1's System Administrator section (§13), covering unimplemented capabilities with no corresponding tRPC procedures anywhere (see below). Not a runtime server module (no server directory) — handles env config/CI-CD only. |

## Retention Schedule — Findings

- **Read procedure** (`records.getRetentionSchedule`) does **not** exist anywhere in the server codebase — confirmed by both filename search and content search. This directly **contradicts** F1 §12.7, which claims it is "read, unchanged" (implying pre-existing). **F1 §12.7's claim does not hold up against actual code and requires correction.**
- **Write procedures** (propose/activate, per ADR-UI-003) are net-new and also unbuilt.
- The entire `/retention-schedules` route is **backend-blocked**, not partially blocked — nothing exists yet.
- Module ownership for retention-schedule functionality still needs to be resolved codewise (not fully determined in this investigation — flagged as needing verification).

## Designation vs. Delegation — Unresolved Tension (Flagged, Not Resolved)

Two documents make claims that appear to conflict:
- **F1 §9 (via ADR-UI-007):** The Designation document type and its "Log Designation document" action are explicitly "pulled into Phase 1 scope."
- **`org.md`'s Module Summary:** States delegation management UI (designation logging form, active designation list view) is `[DEFERRED — Phase 1B]`, owned by ORG.

**Plausible reconciliation** (not confirmed by either document explicitly): these may be two genuinely different things —
1. A **narrow document-logging action** embedded in WF's Session Attendance page (the Session Attendance substitute-officer field, which lives in `session.router.ts` under the workflow module) — this needs the Designation document type to exist in Phase 1 to reference it.
2. ORG's **broader delegation-management admin screen** (the standalone form + list view) — deferred to Phase 1B.

This is a genuine, document-native, unresolved tension. It should be carried forward as a flagged item for human resolution rather than resolved unilaterally, per the governance rule that "a human resolves document issues between passes, not during them."

## Announcements — Backend-Blocked

`/admin/announcements` requires new announcement procedures (defined in ADR-UI-006), but the announcements entity lives under the **portal module**, which has not been built yet (`portal.md` is 0 lines). This is backend-blocked at the module level — distinct from a missing frontend for an already-built backend module.

## `/admin/config` — Cross-Cutting, Spec-Blocked

- Blocked at the **spec level**: a detailed config-screen specification must be written before backend procedures can even be developed.
- Genuinely cross-cutting across multiple modules — six Tier-2 config CRUD surfaces span:
  - Document types and numbering series (DOCS-related)
  - Workflow definitions and SLA thresholds (WF-related)
  - Notification templates (NOTIF-related — module unbuilt)
  - Public visibility rules (PORTAL-related)
- No single clear module owner has been determined for this route as a whole.

## `/admin/delivery-logs` — Backend-Blocked

Depends on `notifications.listDeliveryLogs`, which requires the NOTIF module. NOTIF backend does not exist (`notif.md` is 0 lines). Route cannot be built until NOTIF is built.

## System Administrator (INFRA-Adjacent) — Unresolved Scope

F1's System Administrator section (§13) discusses four unimplemented capabilities with **no corresponding tRPC procedures anywhere**:
1. System health metrics
2. Encryption key management
3. Schema migrations
4. Backup/restore procedures

F1 itself explicitly flags these as **speculative and unresolved** — they might belong to "an operations console outside the web app's scope entirely." This is left as an **open, unassigned gap** — not resolved by any ADR (specifically, not resolved by ADR-UI-008, despite that ADR's relevance to system-administrator views generally).

## Safety-Relevant Finding: Workflow Panel Enforcement Asymmetry

Some workflow panels have **server-side enforcement** against incorrect step calls; others do not. Specifically flagged: **Docketing** and **Veto Override** panels are **not server-enforced** against being invoked on the wrong step. This means **frontend panel routing correctness is a genuine security/safety property** for these two panels, not merely a UX concern. Any future frontend work touching panel routing logic must treat this as a hard correctness requirement, not a cosmetic one.

## Other Verified Technical Facts

- **Documentation correction**: `step.name` vs. `step.stepKey` — a naming/field correction was identified and documentation updated accordingly across multiple files.
- **Role-visibility issue (LOG-0069)**: Auditor visibility was restored; documentation updated across multiple files. Fully closed/resolved.
- **Workflow engine mechanisms**: `submitStepAction` and `submitStepApproval` are distinct submission mechanisms; office-scoping patterns apply.
- **Test infrastructure**: Vitest is installed in the frontend, but no test script is wired up (i.e., not yet integrated into a runnable test command).
- **Known gotcha**: Unconditional success toasts can mask actual failures — a UX/reliability issue to be aware of when building or reviewing frontend action flows.
- **TASK-WF-FE-003**: Fixed the Secretariat Decision Panel by swapping `documents.logSecretariatDecision` for a Workflow-Router mutation, consistent with ADR-B2-3 and reflected in F1 §8.2's updated routing note.

## Answer to the Core Master-List Feasibility Question

A complete, itemized master frontend task list **cannot** be generated purely from the document-based pipeline mechanism for modules whose Step 2 pass never loaded F1 (IAM, AUDIT, ORG, DOCS, WF, TRACK) — the automated pipeline machinery (specifically Step 4's "missing task detection") is structurally incapable of catching F1-vs-built gaps, regardless of whether Step 4 ever runs to completion.

However, a **high-level master component/page inventory with build status** IS achievable directly from documents plus direct repository observation, without needing the expensive live-code forensic investigation the original per-task methodology assumed was required. This works because:
1. F1 is a complete, authored, per-module route ownership map that exists independently of live code.
2. Checking whether a given file/directory exists at a specific path, or counting components in a page directory, is a cheap, purely observational check — not the expensive forensic investigation that produces individual next-task implementation plans.
3. Cross-referencing F1's route table against the actual repository state (verified router ownership, verified `apps/web/src/pages/` listing) produces exactly the component/screen inventory needed for a master list — every route's status as: **already built**, **frontend-only gap** (backend exists, frontend doesn't), or **backend-blocked** (backend module doesn't exist yet or spec doesn't exist yet).

This produces a refined three-tier framework (extending the original built/unbuilt binary):
- **Tier 1 — Built**: Page/component exists in the repo, verified directly.
- **Tier 2 — Frontend-only gap**: Backend procedure(s) exist and are verified working; only the frontend page is missing. Examples: WF Secretary/Mayor dashboards (`getSlaComplianceData` exists), `/admin/roles` (IAM backend exists).
- **Tier 3 — Backend-blocked**: Backend procedure(s), module, or even the specification itself does not yet exist. Examples: retention schedules (no router at all), `/admin/delivery-logs` (NOTIF module unbuilt), `/admin/announcements` (PORTAL module unbuilt), `/admin/config` (spec not yet written).

A master list built this way accurately identifies **what** needs to be built and **why it's currently blocked or unblocked**, even though it cannot substitute for the individual, sequential, per-task implementation plans that the forensic mechanism produces once each task is actually reached.

---

## First: the answer to the actual question

Yes — a high-level master list is achievable, and I now have essentially all the evidence needed to construct one. A full, execution-ready tasklist (with pasted-in ABAC rules, schema definitions, procedure signatures per every task's AI Prompt field) is not achievable in one pass, for the reason the earlier session identified. But that earlier conclusion — captured in the uploaded findings doc as "Mechanism 1 (document-based, can run ahead) vs. Mechanism 2 (live-code-forensic, genuinely can't)" — undersells what's possible, and my exploration this session sharpens it into three tiers rather than two:

- **Tier A — document cross-reference.** Read F1 (the route map) against what each module's task list actually built. Pure document work, zero live-code reading required.
- **Tier B — existence verification.** Does `apps/web/src/pages/iam/` exist? Does a given procedure exist in the router? This is cheap, mechanical, and — critically — *not* what the earlier session's "exhaustive forensic investigation of the entire live codebase" concern was about. That concern was about re-deriving *behavioral* correctness (bugs, regressions) app-wide, which genuinely is expensive and genuinely can't be front-loaded. Checking whether a file exists at a path is a different, much cheaper kind of check.
- **Tier C — behavioral forensics.** Is this specific implementation actually correct, line-by-line, right now? This is what `fe.md`'s three tasks did, and it's the one tier that structurally can't run ahead of implementation.

The high-level master list you're asking for lives entirely in Tiers A and B. I did both this session, directly, because — unlike the session that produced the uploaded findings doc — I have the actual repo. That's the single biggest methodological shift from what's on the page in `frontend-task-planning-architecture-and-findings.md`: that document is full of precise file:line citations because a *separate* agent with repo access fed them back to a planning-only Claude. I don't need that relay. Everything below, I checked myself, directly, this session.

One structural point worth stating plainly, because it undercuts something I initially assumed and want to correct rather than quietly fix: I expected Step 4 Integration's "missing task detection" operation might catch a gap like "IAM has zero frontend tasks despite F1 documenting IAM-owned routes." Having now read `A1-AGENTS.md` §6 Step 4 directly, it doesn't — that operation only walks `Prerequisites:` fields for broken references to non-existent task IDs. Since nothing in this repo has ever declared a prerequisite on an unwritten IAM-frontend task, this class of gap is invisible to the pipeline's own self-check, even in the counterfactual where Step 4 had actually run (it hasn't — confirmed directly, `a1-master-phased-task-list.md` is 0 lines, and so is `a1-outline-phases.md`, meaning Step 3 never ran either, one step earlier than the uploaded doc had identified). Nobody and nothing has been watching for this. The F1-vs-built cross-reference is the only thing that surfaces it, and it had never been run to completion before this session.

## Key Findings — this session's continuation

**KF-1. Repo access changed the operating model for this entire investigation.**
Synthesis: The uploaded findings doc's every file:line citation was relayed from a separate local agent — the doc's own methodology assumes planning-only Claude has no repo access. That assumption held for the prior sessions but not this one: `batac-dms_tar.gz` gave direct read access to the actual repo. Every finding below was checked directly, not relayed.
Relevance: Removes the need for local-agent handoff prompts for anything checkable by reading files — which turned out to be everything in this session.
File: n/a (methodological)
Status: Confirmed

**KF-2. `build-master-tasklist.md` (repo root, 435 lines) — previously unreferenced, now read in full.**
Synthesis: This is the human-facing operator playbook for the entire 14-pass pipeline — exact document-load lists for every module pass, Step 3, and Step 4, plus operational notes. Two things from it matter beyond confirming what the uploaded doc already knew: (a) it names the "Module Summary" convention at the bottom of every module task list, with `[SPEC GAP]` and `[DEFERRED — Phase X]` tags, as the efficient way to check a module for known gaps without reading the full file; (b) it independently confirms F1 is loaded for UI's pass and PORTAL's pass (§portal only) but is absent from IAM/AUDIT/ORG/DOCS/WF/TRACK's own load lists.
Relevance: (a) let me efficiently check IAM/AUDIT/ORG/TRACK for self-reported frontend gaps (see KF-9 through KF-11) instead of reading ~1,300–3,400 lines per module; (b) independently corroborates, from a second source, the structural reason F1's route ownership was never cross-checked against six of the eight built modules.
File: `build-master-tasklist.md`
Lines: 1–435 (full file); Module Summary discipline at lines 412–420; document-load lists throughout
Status: Confirmed

**KF-3. `A1-AGENTS.md` (467 lines) read in full — several corrections to my own working assumptions, not just confirmations of the prior doc.**
Synthesis: Three things worth separating from what was already known:
1. Step 4's six operations are precisely: (1) task ID audit, (2) prerequisite graph validation, (3) **missing task detection — narrowly defined as walking `Prerequisites:` fields for broken references, not spec-coverage checking**, (4) critical path identification, (5) first executable set, (6) assembly. I initially guessed operation 3 might be a spec-coverage check; it isn't. See the framing note above — this matters because it means the gap this whole investigation surfaces was never going to be caught automatically, even by a fully-run pipeline.
2. Section 8 ("What Generation Agents Do Not Do") states, independently of anything in the handoff doc: "**Do not edit any pre-dev document**... A human resolves document issues between passes, not during them." This is the generation-phase version of the same rule the handoff doc cited for the execution phase (root `AGENTS.md` §4.5). Two independently-asserted, phase-specific versions of the identical principle is a strong signal this is deliberate project philosophy, not an incidental rule. Bears directly on the override instruction in your original prompt — see KF-15.
3. Module Summary format is exactly four fields: `Total tasks` / `First executable task` / `Spec gaps` / `Deferred capabilities` — precise enough that I could grep for the heading rather than read full files (with one grep-pattern miss on my first attempt, corrected — see KF-9).
File: `docs/pre-development/A1-AGENTS.md`
Lines: 52–70 (Section 2, Pass Types table); 325–378 (Section 6, Step 4); 420–439 (Section 8); 285–299 (Module Summary format)
Status: Confirmed

**KF-4. Master phased task list, outline, REC, NOTIF, PORTAL — line counts verified directly, one detail extends the prior finding.**
Synthesis: `wc -l` on every file in `a1-tasks/` plus the two Step 3/4 output files, run directly rather than trusted secondhand. `notif.md`, `portal.md`, `rec.md`: 0 lines each, matching the prior finding exactly. `a1-master-phased-task-list.md`: 0 lines, also matching. **New:** `a1-outline-phases.md` (Step 3 Outline output) is *also* 0 lines — this file wasn't mentioned in the uploaded findings doc at all. Since Step 4 loads the outline as its final input document, Step 4 couldn't have run without Step 3 first — meaning the master-list assembly process stalled one step earlier in the pipeline than previously identified.
Relevance: Extends "Step 4 Integration has never run" (already known) to "Step 3 Outline has never run either" (new) — a small but real correction to how far the pipeline actually got.
File: `docs/pre-development/A-project-planning/a1-outline-phases.md` (0 lines); `docs/pre-development/A-project-planning/a1-master-phased-task-list.md` (0 lines); `docs/pre-development/A-project-planning/a1-tasks/{notif,portal,rec}.md` (0 lines each)
Status: Confirmed (extends prior finding, does not contradict it)

**KF-5. F1 (`f1-application-route-map-v2.md`, 587 lines) read in full — the single most load-bearing document for this whole question.**
Synthesis: Authoritative, DRAFT-status (not yet reviewed/approved — an important caveat to carry forward) route map covering all of `/apps/web` and the Phase 1 public portal. §4 is a complete master route table: every path, component name, required role(s), and primary tRPC/REST data dependency. §5–§14 give per-area prose detail (widget-level for dashboards, panel-level for workflow, procedure-group detail for the document detail page). §15 is a "resolved gaps register" documenting ten ADR resolutions, four of which (`ADR-UI-002`, `003`, `006`, `008`) explicitly **pull new scope into Phase 1** and where F1 itself states, verbatim, that whether this expanded scope was actually absorbed into task generation is "`[Unverified]` — not assessable from the documents reviewed." §16 lists what's deliberately *not* a page (account settings, a standalone notifications inbox, Phase 1B document types, Phase 2 reporting) — useful so I don't mistakenly flag intentional exclusions as gaps.
Relevance: This document, cross-referenced against the actual `apps/web/src/pages/` tree (KF-8), is the master-list evidence base itself.
File: `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md`
Lines: 1–588 (full file); master route table 207–252; resolved gaps register 546–569; excluded items 572–580
Status: Confirmed

**KF-6. Router ownership resolved by content, not by inference — corrects a real gap in the prior module-by-module audit.**
Synthesis: Direct filesystem search of `apps/server/src/modules/`:
- `complaints.router.ts` and `document-requests.router.ts` both live under `apps/server/src/modules/documents/`. **Complaints and document-requests are DOCS-owned, not WF-owned and not a separate module.**
- `session.router.ts` lives under `apps/server/src/modules/workflow/`. **Order of Business and Session Attendance are WF-owned.**
- No file anywhere in `apps/server/src/modules/` matches `records`/`retention` by name, and a content-level grep for `getRetentionSchedule`/`RetentionSchedule` across all of `apps/server/src` returns zero matches. **These procedures do not exist anywhere in the codebase**, contradicting F1 §12.7's own claim that `records.getRetentionSchedule` is "read, unchanged" (implying pre-existence). See KF-12.
- Server module directory contains exactly six subdirectories: `audit`, `documents`, `iam`, `organization`, `tracking`, `workflow` — consistent with `ui` (frontend-only) and `infra` (infrastructure-as-code, no runtime module) correctly having none.
Relevance: This is a direct correction, not just an addition, to the uploaded findings doc's own audit table. That table's "DOCS: true continuation — precedent already established" conclusion (implying DOCS's frontend need was basically satisfied) is incomplete: DOCS backs 6 more undelivered routes (complaints list/new/detail, document-requests list/new/detail) that its own task list's *titles* never surfaced, because the audit method (regex + title read) can't catch a router that was built without a page-specific task title. Only the F1 cross-reference catches it.
File: `apps/server/src/modules/documents/complaints.router.ts`; `apps/server/src/modules/documents/document-requests.router.ts`; `apps/server/src/modules/workflow/session.router.ts`
Status: Confirmed — **Supersedes** the uploaded doc's implicit treatment of DOCS as fully accounted for (section "Verified Module-by-Module Frontend Task Audit," DOCS row)

**KF-7. `getSlaComplianceData` verified to exist; used to close an open question about whether the two WF dashboards are backend-ready.**
Synthesis: `apps/server/src/modules/workflow/workflow.router.ts:613` defines the procedure; `workflow.policy.ts` (lines 729–738) has a matching ABAC policy block explicitly citing "I2 §16 `getSlaComplianceData` — ARTA SLA compliance reporting." Both `/secretary` (F1 §5) and `/mayor` (F1 §10) propose this procedure as a dashboard data dependency.
Relevance: Confirms the two WF dashboards are genuinely frontend-only gaps — not blocked on any missing backend procedure. Also confirms `workflow.listMyAssignedSteps` and `documents.list`, both already consumed by built pages, back these dashboards too — so nothing about them requires new backend work, only new frontend work reusing existing procedures.
File: `apps/server/src/modules/workflow/workflow.router.ts:613`; `apps/server/src/modules/workflow/workflow.policy.ts:729–738`
Status: Confirmed

**KF-8. Complete `apps/web/src/pages/` inventory — the ground truth against which everything above is cross-referenced.**
Synthesis: Full directory listing, not sampled. The entire built frontend, right now, is: 17 `/dev/*` component-showcase pages (UI module's Tier 3 library + foundation), 3 `/documents/*` pages + `columns.tsx` (DOCS), and `/workflow/*` — 2 pages (`MyAssignedStepsPage`, `WorkflowStepActionPage`) + `columns.tsx` + an 11-file `panels/` subdirectory. **There is no `/admin`, `/sysadmin`, `/audit`, `/organization`, `/secretary`, `/mayor`, `/order-of-business`, `/sessions`, `/complaints`, or `/document-requests` directory anywhere in the tree.**
Relevance: This is the master finding. Every route F1 documents that isn't in this list is unbuilt, full stop — confirmed by exhaustive listing, not inference.
File: `apps/web/src/pages/` (full tree)
Status: Confirmed

**KF-9. Panel count resolved definitively: eleven, not ten — corrects a labeling artifact in the uploaded findings doc, not a content error.**
Synthesis: Three independent sources now confirm 11: (1) F1 §8.2's table, which I counted directly — 11 rows (Generic Action, Generic Approval, Secretariat Decision, VP Certification, Mayor Decision, Mayor Lapse Confirmation, Veto Override Recording, Multi-Referral, Docketing, Panlalawigan Outcome, Publication Date); (2) the actual `panels/` directory — 11 files, matching those 11 names exactly; (3) F4's own prose, independently, says "eleven workflow action and approval panels" (§4.2) and "the eleven step-action panels" (§5.3 ToC entry). The uploaded findings doc's own "Eleven panel components (not one)" observation (from listing the directory) is consistent with this — but its section header two paragraphs later, "### Ten Panels Built by TASK-WF-FE-002," undercounts by one despite listing all 11 names correctly beneath it. This reads as a header/count-label slip, not a wrong list.
Relevance: Removes any residual ambiguity before this count gets used in a master list.
File: `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md:349–361`; `docs/pre-development/F-frontend-architecture/f4-component-hierarchy-specification.md` (§4.2, §5.3 per ToC); `apps/web/src/pages/workflow/panels/` (11 files)
Status: Confirmed — **Supersedes** uploaded doc's "### Ten Panels Built by TASK-WF-FE-002" header (content beneath it was already correct)

**KF-10. IAM and AUDIT Module Summaries: neither flags any frontend gap, for the same structural reason.**
Synthesis: `iam.md`'s Module Summary (heading at line 2019, confirmed via corrected case-insensitive grep after an initial pattern miss — see note below) lists four Deferred Capabilities, none frontend-related: MFA TOTP (Phase 2), SSO/external IdP (Phase 2), citizen portal auth (Phase 3), PhilSys verification (Phase 5). `audit.md`'s Module Summary lists two: HMAC key rotation runbook (Phase 2), DPA/PII erasure compliance (Phase 3) — also neither frontend-related.
Relevance: This is useful negative evidence, not a null result. Neither module *knowingly deferred* its frontend pages — F1 was never part of either module's document lineage (confirmed directly in `A1-AGENTS.md` §2: IAM's load list is Skeleton→INFRA→B5→I2→I1→C1§iam→J1-4; AUDIT's is Skeleton→INFRA→C1§audit→tech-stack→I3 — no F1 in either). The gap these two modules have (`/admin/roles` for IAM; `/audit`, `/audit/full` for AUDIT) is silent-by-construction, not deferred-on-purpose.
File: `docs/pre-development/A-project-planning/a1-tasks/iam.md:2019` (Module Summary heading), Deferred Capabilities section in the final ~30 lines of the file; `docs/pre-development/A-project-planning/a1-tasks/audit.md:1295–1307`
Status: Confirmed — Note: my first grep for `^Module Summary` (anchored to line-start) missed both files because both use markdown H2 headers (`## Module Summary — IAM` / `## Module Summary — ORG`), not a bare line start. Flagging my own correction rather than silently fixing it, per your preference to see the actual process.

**KF-11. ORG's Module Summary contains a genuine, document-native tension against F1 — flagged, not resolved.**
Synthesis: `org.md`'s Module Summary states: "**[DEFERRED — Phase 1B: Delegation management UI** — the tRPC procedures for reading delegation history and active grants exist in TASK-ORG-008, but the frontend pages for delegation management (designation logging form, active designation list view) are Phase 1B features owned by this module. The backend data and Published API are fully available in Phase 1.]" This is a genuine, deliberate, Phase-1B deferral — not a silent gap like IAM/AUDIT.
It sits against F1 §9 (via `ADR-UI-007`), which states the Designation document type and its "Log Designation document" action are explicitly "**pulled into Phase 1 scope**," required for `/sessions/:sessionDate`'s substitute-officer field.
My own plausible reconciliation — not confirmed by either document, offered as a hypothesis only — is that these describe different things: F1/ADR-UI-007 concerns a narrow, DOCS-owned document-type entry plus a single logging action embedded within WF's Session Attendance detail page; ORG's deferred item concerns ORG's own broader, dedicated delegation-management admin screen (list + form) as a standalone feature. If that reconciliation is right, there's no real contradiction. But neither document cross-references the other, and I have no way to confirm this from the documents alone.
Relevance: This is exactly the kind of cross-document tension your original instructions ask me to surface rather than resolve. A future WF task building `/sessions/:sessionDate`'s substitute-officer field needs to know whether "Log Designation document" (Phase 1, per F1) is fully self-contained or implicitly depends on ORG's deferred delegation UI to be legible to the person using it.
File: `docs/pre-development/A-project-planning/a1-tasks/org.md` (Deferred Capabilities, near end of file, ~50 lines before EOF); `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md:400–402`
Status: Confirmed as a real cross-document tension; reconciliation offered above is **[Speculation]**, not settled

**KF-12. F1 §12.7 contains a factual inaccuracy against the live codebase — precise correction drafted, not applied (see KF-15 for why).**
Synthesis: F1 §12.7 (`/retention-schedules`) states: "**Data:** `records.getRetentionSchedule` **(read, unchanged)**; new propose/activate procedures, pulled into Phase 1 scope..." The phrase "(read, unchanged)" asserts this procedure already exists and ADR-UI-003 only adds the write side on top of it. KF-6's content-level grep found zero matches for `getRetentionSchedule` anywhere in `apps/server/src`. The procedure does not exist. The route is 100% backend-blocked, not partially — F1 understates this.
Relevance: A task-writer trusting F1's text at face value would believe less backend work remains for this route than actually does.
File: `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md:464`
Status: Confirmed (verified by direct content-level search, not filename inference)
**Proposed correction (drafted, not applied):** Replace `records.getRetentionSchedule (read, unchanged);` with `records.getRetentionSchedule (proposed read procedure — not found anywhere in apps/server/src at time of verification; despite this document's "unchanged" framing, no version of this procedure currently exists in the codebase);`

**KF-13. Two minor documentation-hygiene findings, low-stakes, noted for completeness.**
Synthesis: (a) F4's own embedded header states "**Document ID: F2**," while its filename (`f4-component-hierarchy-specification.md`) and every external reference to it (including the uploaded findings doc, the handoff doc, and F1 itself) call it "F4" — a metadata/filename mismatch, likely a copy-paste artifact from an earlier numbering scheme. (b) F1 §8.2's Secretariat Decision Panel row contains a citation using a hardcoded local absolute path (`file:///home/lukexodus/projects/batac-dms/docs/...`) rather than a repo-relative link — a broken/non-portable reference baked into committed markdown, revealing whoever last edited that row was working from a local checkout at that specific path.
Relevance: Neither affects the master-list analysis. Noted because precisely this kind of small inconsistency is what the "detect... any ambiguous behavior" instruction asks me to catch, and because (b) is genuinely interesting as corroboration that F1 *has* been kept current post-TASK-WF-FE-003 (the row also correctly reflects "[Routing superseded by ADR-B2-3]," matching the handoff doc's claim that a Documents-Router→Workflow-Router routing fix landed) — it's a real, recent edit, just with a leftover local path.
File: `docs/pre-development/F-frontend-architecture/f4-component-hierarchy-specification.md:4` (Document ID line); `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md:353` (hardcoded path)
Status: Confirmed

**KF-14. INFRA has no F1-documented frontend surface — with one explicitly-unresolved wrinkle worth carrying forward.**
Synthesis: A case-insensitive search for "infra" across all of F1 returns exactly one substantive hit, in §13 (System Administrator views): F1 states four Tier-1 sysadmin capabilities — system health/infrastructure metrics, encryption key management, schema migrations, backup/restore — have no corresponding tRPC procedure anywhere in E1's catalog, are explicitly not built into any route in F1's current pass, and are tagged `[Speculation]` as possibly belonging to "an operations console outside this web app's scope entirely" — explicitly called out as "a distinct, separately-trackable gap, not closed by ADR-UI-008."
Relevance: INFRA genuinely has no page-level frontend gap in the sense IAM/AUDIT/ORG do (consistent with being pure infrastructure-as-code, correctly absent from `apps/server/src/modules/`). But these four capabilities are real, named, currently homeless — not assigned to INFRA, not assigned to any other module, not given a route, not given a procedure. Worth surfacing precisely as "unowned," not silently dropped.
File: `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md:504`
Status: Confirmed

**KF-15. AGENTS.md-override instruction — reasoning for why I'm not exercising it directly, despite having a verified, ready-to-apply correction (KF-12).**
Synthesis: Your original prompt authorizes me to override AGENTS.md's restriction on editing predev docs, conditioned on thorough verification. I have that (KF-12 is a direct, content-level grep against the live codebase, not an inference). But I read `A1-AGENTS.md` §8 directly this session (KF-3): "Do not edit any pre-dev document... A human resolves document issues between passes, not during them." This is asserted independently of, and in addition to, the execution-phase version the handoff doc already cited from root `AGENTS.md` §4.5. Two independent, phase-specific statements of the same principle reads as deliberate project philosophy, not a rule I should route around even with explicit permission — and it sits directly on top of my own role definition in this task, which is explicitly read-only with no repository changes.
My resolution: I'm not editing the doc myself. I've drafted the exact correction (KF-12) precisely enough that whoever does have write authority — a human, or an agent operating under this repo's actual execution-phase rules — doesn't need to redo my verification. This uses the override you granted in the way I think best honors its intent (get the discrepancy fixed, don't get blocked by process) without unilaterally overriding a rule the repo asserts twice, independently, in two different governing documents.
File: n/a (methodological); citing `docs/pre-development/A1-AGENTS.md:426–429`
Status: Confirmed (reasoning); not an action taken

## The master list, as it actually stands

This is proof by construction — every row below traces to a Key Finding above.

**Genuinely frontend-only gaps — backend exists, ready to build now (21 routes across 4 modules):**

| Module | Routes | Backend status |
|---|---|---|
| IAM | `/admin/roles`, `/sysadmin/sessions`, `/sysadmin/users` | Built (14 tasks) |
| AUDIT | `/audit`, `/audit/full`, `/sysadmin/audit-integrity` | Built (7 tasks) |
| ORG | `/admin/committees`, `/organization` | Built (10 tasks) |
| WF | `/secretary`, `/mayor`, `/order-of-business`, `/sessions`, `/sessions/:sessionDate` | Built (24 tasks) |
| DOCS | `/complaints`, `/complaints/new`, `/complaints/:complaintId`, `/document-requests`, `/document-requests/new`, `/document-requests/:requestId` | Built (as part of DOCS's backend scope) |
| — | `/sysadmin` (landing shell) | n/a |

**Backend- or spec-blocked — not a frontend planning problem, a different problem (13 routes):**

| Route(s) | Blocker |
|---|---|
| `/admin/announcements` | PORTAL module, 0 lines, unbuilt |
| `/admin/delivery-logs` | NOTIF module, 0 lines, unbuilt |
| `/admin/config` | Needs a net-new spec before backend work can even start (F1's own admission) |
| `/retention-schedules` | Confirmed zero backend procedures exist anywhere (KF-12) |
| All 9 `/portal/*` routes | Entire PORTAL module + `/apps/portal` app, unbuilt |

**TRACK:** based on my full read of F1, its procedures (`tracking.getTrackingRecord`, `printQrCoverSheet`, `getRoutingHistory`, `logRoutingEntry`) are consumed entirely within `/documents/:documentId` (already built), not as their own dedicated route. TRACK may be the one already-built module with **no** page-level frontend gap at all — I didn't find a counter-example, but I'll flag this as based on a complete document read rather than a second independent grep pass, unlike the harder claims above.

**Explicitly out of scope right now, not silently missing:** REC, NOTIF, PORTAL backends (0 lines each, real pipeline passes, just not run yet); SEARCH, REPORT (Phase 2/4, deliberately deferred, not part of this round at all).

That's the shape of the thing. Twenty-one routes with ready backends across five modules, cleanly attributable, sequenceable by module and by whether a dashboard needs its dependent list pages built first. Say the word and I'll turn this into the fully-dressed version — per-route high-level build instructions, suggested ordering, and the open items (KF-11, KF-14) flagged inline rather than silently resolved.