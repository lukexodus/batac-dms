# `batac-dms` — Frontend Task Generation: Governance & Architecture Reference

## Project Overview

`batac-dms` is a monorepo document management system. Task generation for the system follows a formal, module-by-module, wave-ordered pipeline governed by a set of pre-development documents. This reference captures the governance rules, module state, and architectural constraints needed to generate frontend task lists correctly.

## Module Status (as of this reference)

**Finished** (task list generated _and_ development complete): INFRA, UI, IAM, AUDIT, ORG, DOCS, WF, TRACK.

**Not started** (neither task list nor development begun): REC, NOTIF, PORTAL.

SEARCH and REPORT are Phase 2/4-deferred entirely — they receive only title-only entries in this round, no full task generation.

## Wave / Dependency Order

| Wave | Modules    | Prerequisite      |
| ---- | ---------- | ----------------- |
| A    | INFRA, UI  | None (parallel)   |
| B    | IAM, AUDIT | INFRA             |
| C    | ORG        | IAM + AUDIT       |
| D    | DOCS       | ORG               |
| E    | WF, TRACK  | DOCS              |
| F    | REC, NOTIF | WF + TRACK        |
| G    | PORTAL     | All prior modules |

Given the finished/not-started split above, waves A–E form one unbroken completed prefix, and waves F–G form the remaining unstarted suffix (REC, NOTIF, PORTAL) — a clean, non-overlapping boundary.

## Governing Documents and Their Scope

- **`AGENTS.md`** (root, 221 lines): the **execution-phase** routing file. Governs how code gets _built_ from an already-generated task list. Not the file that governs A1 (task-list) generation itself — read for orientation/context only during generation work, not as a compliance document.
- **`docs/pre-development/A1-AGENTS.md`** (468 lines): the actual governing file for A1 generation (task-list creation). This is the authoritative document for anyone generating or updating task lists.
- **`docs/pre-development/A-project-planning/a1-skeleton.md`** (417 lines): the structural contract — module list, dependency chain, phase scope, and cross-module dependency rules that every generated task must satisfy.
- **`docs/design/DESIGN.md`** — lives at `docs/design/DESIGN.md`, **not** under `docs/pre-development/`. It is a separate design-system reference doc, distinct from the lettered pre-dev corpus (F1–F7, etc.). Currently at v1.2.
- **`packages/ui/src/styles/globals.css`** — real, already-written CSS code file (not a planning doc).

### Source-of-truth hierarchy (from `AGENTS.md`, lines 23–40)

1. `consolidated-architecture-and-requirements-reference-iteration-3.md` — outranks everything; stakeholder-confirmed ground truth.
2. `tech-stack.md` — confirmed stack/conventions (note: OCR library choice is explicitly still open/undecided — do not treat as decided).
3. Everything under `docs/pre-development/` — downstream of the above two, and can be wrong relative to them.

Conflicts between these levels must be stated explicitly — never silently averaged or resolved by guessing recency.

## Document Reading Discipline

- Every document has a Table of Contents (ToC) after its header. Read the ToC first, then request only the specific line ranges needed — do not read full documents by default.
- Exception: workflow-engine (B4) tasks require consolidated-reference Parts 4.1–4.3, 4.10, 4.17, 7.2, 8, 11.3 in full, not excerpted.
- **Never read `.bak` files.** Seven are explicitly listed as superseded-kept-for-history-only. If needed content exists only in a `.bak` and the live file hasn't absorbed it, that is a documentation bug to flag — not a reason to read the `.bak`.
- C1 and E1 (large, module-organized documents) should be queried by requesting only the relevant `§module` range.

## Task → Document Routing Table (from `AGENTS.md`, lines 53–80)

| Kind of code                      | Documents to read, in order       |
| --------------------------------- | --------------------------------- |
| Tier 1+2 UI foundation            | F5 → DESIGN.md → globals.css → F7 |
| Tier 3 domain component           | F5 → J6 → F6 → DESIGN.md → F7     |
| Frontend page/view                | F4 → F1 → F5 → J6 → I2 → E1       |
| Zustand store                     | F2 → F1 → E3                      |
| TanStack Query hook               | F3 → E1                           |
| tRPC procedure (backend-adjacent) | E1 → I1 → I2                      |

If a task type is not covered by this table, check `document-list.md`'s full prerequisite table (IDs A1–L5) directly. If found there, follow it and flag that the routing table above is missing a row. If not found anywhere, say so explicitly and ask the human rather than inferring scope from adjacent documents.

## Core Architectural Rule: Where Frontend Tasks Live

**The single most load-bearing rule for frontend task generation** (from `A1-AGENTS.md` lines 135–139 and `a1-skeleton.md` lines 288–299):

> UI is Wave A because it has no server dependencies — it is entirely `packages/ui` and `/apps/web` static composition. The UI module tasks cover only the component library foundation and the domain component library (the 16 Tier 3 components). Feature-specific UI tasks (e.g. Secretary dashboard, document detail view, complaint form) belong to the module that owns that feature, not to UI.

Consequences:

- "Creating the frontend" is **not** a single UI-module task list. It is: (a) the UI module's component-library tasks, **plus** (b) a frontend-page/feature slice embedded inside _each_ feature-owning domain module's own task list.
- IAM's login page lives in IAM's task list. ORG's org-management pages live in ORG's list. DOCS' document views live in DOCS' list. And so on.
- Every frontend page task therefore lives inside IAM, AUDIT, ORG, DOCS, WF, or TRACK's own task list — never in a separate "frontend" module.
- Each such page task requires a genuine **two-part prerequisite lookup**, not a placeholder:
  1. The specific Tier-3 component task ID(s) it composes from UI's list.
  2. The specific backend module task ID(s) implementing the tRPC procedure(s) it calls — found by looking up the procedure in E1's catalog, then finding the task that implements it in that procedure's owning module.
- INFRA and UI are **not** among the 11 schema-owning domain modules (per consolidated-ref §10.2). They are cross-cutting build modules defined only by A1-AGENTS.md's Pass Types table, not modules that own a Postgres schema. UI therefore has no domain data of its own — it cannot "own" any feature page, only components.

### No cross-schema reference law

Each module owns its own Postgres schema; modules communicate only via event bus/published APIs. Implication for frontend tasks: a page task must never be written as though it can join across modules' data directly. If a page needs data from two modules, it composes two separate procedure calls (one per owning module's task list) — never one merged query.

### Dashboard ownership rule

Not relevant to Phase 1 (dashboards are Phase 3/4 scope). Pattern to remember if a Phase 1 page is dashboard-like: ownership follows the underlying data, split per-widget if the dashboard spans multiple modules.

## UI Module Pass — Internal Structure

Sourced from F7 ("Frontend Foundation Plans"):

- **Plan 0**: one Foundation PR task — Tier 1 install + Tier 2 replacement + design-token system + `/dev/components` route.
- **Plan 1**: one task per Tier 3 component, instantiated from F7's per-component fill-in table. **F5 is authoritative on the component count/list if F5 and F7 disagree** (a discrepancy is flagged as `[SPEC GAP]`).
- **Plan 2**: one cross-component integration page task, run only after all Tier 3 tasks are complete. This task must list **all 16+** Tier 3 component task IDs as prerequisites.

### Tier 3 component ordering groups

| Group | Components                                                 | Dependency notes                                                                                              |
| ----- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A     | PageHeader, Sidebar, Topbar, AppShell                      | AppShell depends on Sidebar + Topbar                                                                          |
| B     | Standalone display components                              | No Tier 3 deps; can run parallel with Group A                                                                 |
| C     | CommitteeReferralBlock, StatusBadge, WorkflowStepIndicator | Require J6-generated types; must list the J6-generation task as a prerequisite                                |
| D     | DocumentPreviewCard, OrderOfBusinessRow                    | Depend on _specific_ Group B/C components — must be encoded individually per-component, not as "Group B done" |

### Confirmed component counts

- F5 and F7 agree: **16 Tier-3 components**.
- Final UI task count: **19** = Foundation(1) + J6-generation(1) + 16 Tier-3 components + integration(1).
- A `TASK-UI-*` list already exists at `docs/pre-development/A-project-planning/a1-tasks/ui.md`.

### Mandatory dev-route requirement (`AGENTS.md` lines 82–86)

For every Tier 3 component task, a `/dev/{component-name}` dev route is **not optional or separate** — it is part of the same PR/task, must render all component states, and functions as the **visual acceptance gate**. This must appear as an explicit subtask or acceptance-criterion line on every Tier 3 task written, not as an afterthought.

## Task Schema (Hard Contract)

- **ID format**: `TASK-{MODULE}-{NNN}` — NNN is zero-padded 3-digit, starting at 001 per module, globally unique across the whole system.
- **Fields**:
  - **Phase**
  - **Module** (enum includes SEARCH/REPORT but no full-spec tasks generated for those this round)
  - **Title** (≤12 words + special tags)
  - **Prerequisites**: **task IDs only, never document names.** If the prerequisite module's task list hasn't been generated yet, write `[CROSS-MODULE REF: module name — task list not yet supplied]`; the integration pass resolves this later.
  - **Deliverables**: exact file paths + one-sentence content description — not vague.
  - **Acceptance Criteria**: verifiable in under 2 minutes; must include both automated command(s) and at least one manual spot-check.
  - **AI Prompt**: must be **fully self-contained** — the executing agent has no access to pre-dev docs, no `AGENTS.md`, nothing but this prompt plus the codebase.
- **Special tags**: `[MIGRATION]`, `[ABAC]`, `[AUDIT]` — unlikely on pure frontend tasks, but watch for a page task that also touches an ABAC-gated view.

### What must be pasted inline into every AI Prompt (`A1-AGENTS.md` §7, lines 381–417)

Per layer:

- **DB** → exact table definition(s) from C1 (only relevant tables/columns).
- **tRPC** → exact procedure definition from E1 (input/output schema + name).
- **ABAC** → exact policy rule from I1/I2 (not the whole spec).
- **Business rules** → the specific consolidated-reference Part(s), copied, not summarized.
- **State machine** → specific D3 transitions relevant to the task.

**What NOT to paste**: full C1 DDL, other modules' task lists, `AGENTS.md`, wave order/module boundaries/generation metadata.

Every AI Prompt ends with a checklist block re-stating each acceptance criterion verbatim, for the reviewer.

## Module Summary Requirement

A Module Summary is mandatory after each module pass (`A1-AGENTS.md` lines 285–299, mirrored at lines 2019–2235 of `iam.md` as a working example). Required fields:

- Total tasks
- First executable task (no prerequisites from this or later modules)
- Spec gaps (`[SPEC GAP: ...]` or "None")
- Deferred capabilities (`[DEFERRED — Phase X: ...]` or "None")

One such summary must be produced per module generated in a given pass.

## Generation-Phase Agent Boundaries (`A1-AGENTS.md` §8, lines 420–439)

A generation-phase agent must **NOT**:

- Append to `docs/development-findings-log.md` — that log is execution-phase only. Generation-phase findings go in the Module Summary `[SPEC GAP]` list and in the response/PR notes for that generation pass.
- Edit any pre-dev document, even to fix an apparent error. Note the conflict, continue, and let a human resolve it between passes.
- Treat `AGENTS.md` as a governing document for A1-generation work (it may be read for context/orientation only).
- Generate Phase 2+ tasks, even if a pre-dev doc describes them in detail — flag disagreement as a spec gap only.
- Invent content to resolve a `[SPEC GAP]`.

Findings-log distinction: some questions are genuinely undocumented by design (resolved only once code runs); `document-list.md` names these under "What Can Only Be Determined During Development." During A1 _execution_ (not generation), when such a question is hit: don't over-search, don't present a guess as settled, implement the most conservative default, and log it to the findings log. **This logging only applies during A1 execution, not A1 generation.**

The findings log itself is append-only. Agents may append but only with `status: proposed` — never edit `AGENTS.md`/`A1-AGENTS.md`/`document-list.md`/any Group B–L doc based on findings. Must check for `confirmed` entries tagged to the relevant module before starting execution work.

### Precedent pattern: how spec gaps get resolved after a module pass runs

Observed in `iam.md`'s Module Summary section: a project owner grants explicit, one-time authority to edit pre-dev docs/`A1-AGENTS.md` for a _specific_ named resolution. Changes then ripple across B5/I3/B2/E3/C1/C2/ADR files, ToCs get corrected, and cross-document consistency is re-verified. This is a documented one-time exception for that specific resolution — it is **not** a standing permission inherited by other agents or other resolutions.

## Phase Scope

Phase 1 = full spec for all 11 Phase-1-eligible modules, including REC/NOTIF/PORTAL:

- **REC**: schema-reservation-only in Phase 1 (`[‡]` marker) — no CRUD, no retention logic. **Phase 1 REC has no frontend surface at all.** Even once REC's module pass eventually runs, there is likely nothing for a frontend task list to attach to in Phase 1.
- **NOTIF**: has real Phase 1 frontend surface — in-app/SSE notifications need some UI.
- **PORTAL**: has real Phase 1 frontend surface — the entire public-facing citizen portal.

## IAM Module — Confirmed Frontend-Relevant Facts

- IAM's 14 tasks (`TASK-IAM-001` through `014`) are **all backend**: schema migration, repository layer, PolicyGuard/Evaluator, `preHandler` middleware, auth endpoints, role assignment service, tRPC router, seeding, module wiring.
- There is **no login page, no session-management UI, no profile page task** anywhere in IAM's existing list. This is consistent with (not a violation of) the UI feature-page rule — IAM's Step 2 pass produced only backend tasks by design, so any IAM-owned frontend page is still unwritten.
- **Root cause, confirmed directly (not inferred)**: IAM's Wave-B-era pass never loaded F2 or its ADRs, because `A1-AGENTS.md`'s Pass Types table does not list any F-series document in IAM's Read column. Backend module passes structurally do not see frontend documents. This is the system working as designed, not an oversight — the frontend slice for each domain module is structurally deferred to whenever that module's frontend-page tasks get generated (which is exactly the deferred/second-half generation task).
- **`ADR-UI-012`** (accepted 2026-06-19) defines a `useSessionStore` Zustand store contract:
  - Fields: `user`, `roleCodes`, `officeScopeId` (nullable UUID — confirmed as `string | null`), `officeCode`.
  - Hydrated synchronously from the login response's `AuthResponseSchema`.
  - This confirms F2 (Zustand store spec) and its ADRs already contain real, decided frontend design for session state, independent of whether IAM's task list itself contains a page task.
  - `officeScopeId` being nullable matters for any frontend page task rendering office-scoped views — such a task needs to handle a "no primary office" state.
  - ADRs (located under `docs/pre-development/.../ADR-*` or similar — exact path not yet located) carry real accepted decisions and should not be treated as absent just because they are not in the main lettered-doc set.
- IAM's Deferred Capabilities confirm no citizen-facing login is Phase 1 IAM scope (it is Phase 3, portal-owned).

## DESIGN.md — Known Implementation Gaps as of v1.2 (Section 10, lines 1364–1386)

Four pre-existing, unresolved gaps, all still open as of the document's last edit:

1. **`date-fns-tz` install gap**: referenced by `date-locale.ts` (a real file) but missing from `INSTALL.sh`'s `pnpm add` command for both `@batac/web` and `@batac/ui`. Install-script bug, not a task-generation concern per se — but any frontend page task depending on date-formatting utilities should note the install step may not actually provide the package yet.
2. **`kitchen-sink.jsx` STATUS_META vs. DESIGN.md §7 divergence**: explicitly deferred to J6; "until J6 is complete, §7 is authoritative and `kitchen-sink.jsx` STATUS_META is prototype-only." Since UI's task list is finished (`TASK-UI-002` produces the canonical J6 types + the 26-member STATUS_META record), J6 should already be complete — meaning this gap is likely already resolved by `TASK-UI-002`'s actual deliverable. STATUS_META's real, canonical location is `packages/ui/src/types/status-meta.ts` — verify against this file, not against `kitchen-sink.jsx`.
3. **`info-700` token gap**: open question of whether `info-700` needs to be added to the token dictionary. Content-completeness question, unlikely to block frontend task generation, but relevant if a page task needs an info-level badge/alert color.
4. **Lora font-loading strategy unspecified**: for whichever component first renders "formal document content." Real open question — plausibly relevant to a DOCS-owned document-detail/preview page task, since that is plausibly the first component to render formal document text. This should be flagged as a `[SPEC GAP]`-style note on any document-rendering page task, not resolved unilaterally (per the "do not invent content" rule).

## Directory State (Confirmed via Listing)

`docs/pre-development/A-project-planning/a1-tasks/` file sizes at time of check:

| File                            | Size    | Status                                |
| ------------------------------- | ------- | ------------------------------------- |
| `infra.md`                      | 164K    | Non-empty (finished)                  |
| `ui.md`                         | 156K    | Non-empty (finished)                  |
| `iam.md`                        | 120K    | Non-empty (finished)                  |
| `audit.md`                      | 68K     | Non-empty (finished)                  |
| `org.md`                        | 92K     | Non-empty (finished)                  |
| `docs.md`                       | 200K    | Non-empty (finished)                  |
| `wf.md`                         | 208K    | Non-empty (finished)                  |
| `track.md`                      | 96K     | Non-empty (finished)                  |
| `rec.md`                        | 0 bytes | Empty (not started)                   |
| `notif.md`                      | 0 bytes | Empty (not started)                   |
| `portal.md`                     | 0 bytes | Empty (not started)                   |
| `a1-master-phased-task-list.md` | empty   | Assembly/integration pass has not run |
| `a1-outline-phases.md`          | empty   | Step-3 outline has not run            |

## Summary: What "Create the Frontend Task List" Actually Means

Given the above, "creating the frontend" for the finished modules (INFRA, UI, IAM, AUDIT, ORG, DOCS, WF, TRACK) is **not** a matter of filling an oversight. It means running the deferred, structurally-second half of each already-finished module's scope:

1. UI's remaining component-library work (if any) follows its own Plan 0/1/2 structure.
2. For each domain module (IAM, AUDIT, ORG, DOCS, WF, TRACK), generate frontend page/feature tasks that:
   - Live inside that module's own task list (not a separate frontend module).
   - Compose specific Tier-3 UI component task IDs as prerequisites.
   - Compose specific backend task IDs (looked up via E1's procedure catalog) as prerequisites for the tRPC calls they make.
   - Never merge cross-module data into a single query.
   - Follow the full task schema (ID format, self-contained AI Prompt, inline-pasted layer-specific spec excerpts, verifiable acceptance criteria).
3. REC, NOTIF, and PORTAL are excluded from this round: REC has no Phase 1 frontend surface at all; NOTIF and PORTAL do have Phase 1 frontend surface but their backend/task-list work has not started, so their frontend cannot yet be scoped against real backend task IDs.

I have already read the full content of this file in my prior turn (both the initial view and the truncated-section follow-up view together cover all 124 lines). Let me verify there's nothing beyond line 124 before extracting.Confirmed — full file content accounted for (123/124 lines, same trailing-newline counting behavior as the first file). This is a continuation session that builds directly on the first document's findings. I'll extract the new durable knowledge, discarding narrated reasoning, in-progress deliberation that got superseded, and conversational framing — while preserving everything that changes or extends the reference document from the prior extraction.

---

# `batac-dms` — Frontend Task Generation: Governance & Architecture Reference (Update 2)

_This update extends and corrects the prior reference document. Corrections to earlier findings are marked as such; new findings are additive._

## Corrections to Prior Reference

- **`status-meta.ts` real path**: `packages/ui/src/lib/status-meta.ts` — not `types/status-meta.ts` as previously guessed. Domain types (`domain.ts`) and STATUS_META (`status-meta.ts`) are siblings in different subfolders: `packages/ui/src/types/domain.ts` vs. `packages/ui/src/lib/status-meta.ts`. Do not conflate the two paths.
- **`kitchen-sink.jsx` does not exist in the repo** — zero matches under any name variant. The prototype-only STATUS_META table that DESIGN.md Section 10 Gap 2 warned about is therefore moot; whether it was deleted during `TASK-UI-002`'s real work, never made it into this snapshot, or the DESIGN.md note is simply stale doesn't change the practical conclusion.
- **`date-fns-tz` gap (DESIGN.md Gap 1) is already resolved** — present in `INSTALL.sh` at line 18. The install-script bug DESIGN.md flagged does not exist in this repo.
- **DESIGN.md's Section 10 gap list is partially stale relative to this repo snapshot.** Any other "Known Gap" reference from that section should be treated as needs-reverification, not trusted as current, and not treated as a fresh unknown each time it's re-encountered.
- **`OrderOfBusinessRow` does not compose `CommitteeReferralBlock`** — confirmed twice (inline title-tag resolution note + UI Module Summary), settled, not merely a hint. This corrects the earlier flagged concern about Group D needing individually-encoded composition dependencies for this specific pair.
- **`PageHeader` has no `Button` import** — F5's original spec was correct; F7's "correction" was the actual error.

## Verified File Locations

| Artifact                                        | Confirmed path                                                                                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| STATUS_META constant                            | `packages/ui/src/lib/status-meta.ts`                                                                                                             |
| Domain types                                    | `packages/ui/src/types/domain.ts`                                                                                                                |
| Barrel export                                   | `packages/ui/src/index.ts` (or equivalent — one real consumer confirmed downstream)                                                              |
| Real consumer of STATUS_META                    | `StatusBadge.tsx` (Group C Tier-3 component, requires J6-generated types)                                                                        |
| `date-fns-tz` install line                      | `INSTALL.sh`, line 18                                                                                                                            |
| App-wide tRPC client                            | `/apps/web/src/lib/trpc.ts`                                                                                                                      |
| Auth/session layer                              | `pkce.ts`, `auth-context.tsx` (`AuthProvider` / `useAuth()`)                                                                                     |
| Query client + 401 refresh-retry-redirect logic | `query-client.ts`                                                                                                                                |
| Provider tree root                              | `main.tsx`                                                                                                                                       |
| Lifecycle-state mapping function                | `status-mapping.ts` → `mapLifecycleStateToDocumentState()`                                                                                       |
| F1's route-map ADR directory                    | `f1-application-route-map-adrs/` (separate from the main route-map file)                                                                         |
| F1 route map source file                        | `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md` (v2 is live; `.bak` is superseded, per the never-read-`.bak` rule) |
| E1 trpc router/procedure catalog                | `docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md`                                                                      |

## UI Module — Confirmed Task IDs (`docs/pre-development/A-project-planning/a1-tasks/ui.md`)

Matches the previously predicted count exactly: **19 tasks**, structured Foundation(001) + J6-gen(002) + Groups A/B/C/D(003–018) + integration(019).

| Task ID     | Component / Content                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------- |
| TASK-UI-001 | Foundation PR (Tier 1 install, Tier 2 overrides, token system, `/dev/components` route)                         |
| TASK-UI-002 | Generate J6 shared domain types and STATUS_META constant (this is the task that produced `status-meta.ts`)      |
| TASK-UI-003 | PageHeader (Group A)                                                                                            |
| TASK-UI-004 | Sidebar (Group A) — implements F6 §3.5's accessible-name required action                                        |
| TASK-UI-005 | Topbar (Group A)                                                                                                |
| TASK-UI-006 | AppShell (Group A)                                                                                              |
| TASK-UI-007 | DocumentNumberBadge (Group B)                                                                                   |
| TASK-UI-008 | StatCard (Group B)                                                                                              |
| TASK-UI-009 | EmptyState (Group B)                                                                                            |
| TASK-UI-010 | ScanQualityIndicator (Group B)                                                                                  |
| TASK-UI-011 | SLATimer (Group B)                                                                                              |
| TASK-UI-012 | RoutingHistoryTimeline (Group B)                                                                                |
| TASK-UI-013 | QRCodeDisplay (Group B) — F7's open item resolved 2026-06-23; F7/J6 now agree                                   |
| TASK-UI-014 | CommitteeReferralBlock (Group C)                                                                                |
| TASK-UI-015 | StatusBadge (Group C)                                                                                           |
| TASK-UI-016 | WorkflowStepIndicator (Group C)                                                                                 |
| TASK-UI-017 | DocumentPreviewCard (Group D)                                                                                   |
| TASK-UI-018 | OrderOfBusinessRow (Group D) — F7 corrected 2026-06-23 to match J6; does **not** compose CommitteeReferralBlock |
| TASK-UI-019 | Plan 2 integration, `/dev/all-components`                                                                       |

This table is the complete Tier-3-component-task half of the two-part prerequisite lookup rule (component task ID + backend procedure-implementing task ID) for all 16 components plus Foundation/J6-gen/integration.

## UI Module Summary — Additional Confirmed Facts

(`docs/pre-development/A-project-planning/a1-tasks/ui.md`, Module Summary)

- **`DocumentState` is a canonical 26-member union**, not 23. The four extra members — `CERTIFIED_URGENT`, `SLA_AT_RISK`, `SLA_BREACHED`, `MISSING_REPORT` — are explicitly non-state "overlay" pseudo-members, not regular lifecycle states. Any task involving document-state rendering (likely for DOCS/WF/TRACK frontend pages) must use the 26-member version and account for these four needing special handling.
- **Consolidated ref §13 does not name UI as owning any Phase 1 capability** — reconfirms UI has zero feature-page ownership.
- **Precedent reconfirmed**: there is documented precedent in this repo for a human granting explicit authority to override the "do not edit pre-dev docs" rule — but this authority is granted per-instance, for a specific pass, and documented. It is not a standing permission; spec gaps should continue to be flagged rather than resolved unilaterally unless explicit authorization is given for that specific gap.

## Frontend-Task Existence Scan Across Modules (Result)

Direct confirmation, scanning IAM/AUDIT/ORG/DOCS/WF/TRACK's task lists for existing frontend-page tasks:

**There are no frontend tasks in any domain module except:**

- The UI module (component-library tasks only, as catalogued above).
- **DOCS**, tasks 020–022 (the only domain module with any frontend slice started so far).

This resolves the single highest-leverage open question from the prior session: the job is "write all frontend-page tasks from scratch across the domain modules," not "fill small gaps in already-started frontend work" — except for DOCS, which has a partial start that must be completed/extended rather than begun from zero.

## DOCS Module — Backend Task Count and Frontend Slice

- DOCS has **19 backend tasks** (001–019), following the same pure-backend pattern as IAM.
- **Frontend slice**: tasks 020–022 (with 023 identified as a real, necessary, not-yet-written gap — see below).
- **DOCS's own Module Summary (at the bottom of `docs.md`) is stale**: it states "Task count: 19 (TASK-DOCS-001 through TASK-DOCS-019)" and does not mention 020, 021, or 022 at all. This is the original backend-only summary, not updated when the frontend slice was added. Do not treat this Module Summary as authoritative for the frontend tasks. Any Module Summary update produced for DOCS should be understood as adding the missing 020–023 coverage, not duplicating existing content.

## TASK-DOCS-020 — App-Wide Frontend Foundation (Critical Finding)

**Location**: `docs/pre-development/A-project-planning/a1-tasks/docs.md`, TASK-DOCS-020.

This task is **not DOCS-specific** — it is the app-wide frontend foundation, sitting in DOCS's file only because DOCS was chronologically the first module (per Wave order) to need a frontend page, and so was the one that surfaced these prerequisites. Its title reflects double duty: "Frontend Foundation... and two upstream backend fixes this task depends on (root.ts router merge, CORS registration)."

**What it establishes, app-wide, permanently:**

1. **The tRPC client itself** (`/apps/web/src/lib/trpc.ts`) — required by every frontend task in every module that calls any procedure.
2. **The whole auth/session layer** (`pkce.ts`, `auth-context.tsx`, `AuthProvider`/`useAuth()`) — the concrete implementation of the `useSessionStore`-shaped session from `ADR-UI-012` (see prior reference doc). Confirmed fields: `user`, `sessionId`, `expiresAt`, `roleCodes`, `officeScopeId` (confirmed nullable), `officeCode`. **Any IAM-owned login/session page task must depend on this task, not duplicate it** — DOCS-020 already built the auth machinery; an IAM frontend task should be a thin page that _uses_ `useAuth()`, not a second implementation of session handling.
3. **Query client + 401 refresh-retry-redirect logic** (`query-client.ts`) — global, not DOCS-specific.
4. **`main.tsx` provider tree wiring** — the app root; can only be done once.
5. **`status-mapping.ts`'s `mapLifecycleStateToDocumentState()`** — this piece _is_ DOCS-scoped (projects DOCS's backend `LifecycleState` enum into the shared 26-member `DocumentState` union). Other modules with their own lifecycle-ish states (WF's workflow steps, TRACK's tracking states) may need equivalent mapping functions of their own — not this same function, but the same pattern.
6. **Two real backend bugs fixed as declared prerequisites**:
   - `root.ts` was missing `organization` and `audit` routers in the tRPC merge — the ORG and AUDIT routers exist and are Fastify-registered, but were not merged into the app-wide tRPC root. **Caution**: "finished" (per the project's own definition) did not guarantee every router was merged into the app-wide root — this is a real gap between "module development finished" and "fully wired."
   - CORS was never registered at all, despite `CORS_ALLOWED_ORIGINS` existing unused in the env schema.
7. **Acknowledged unresolved mapping**: `superseded → ARCHIVED` is marked `[Inference]` in the code itself — a real, acknowledged gap in the lifecycle-to-`DocumentState` mapping that DOCS-020 did not hide or silently resolve. Carry forward as a live spec-gap-style item.
8. **Explicit "do NOT implement" boundary** (now closed — see DOCS-022 below): the `documentTypes.list` procedure was deliberately deferred out of DOCS-020, not worked around.

**Practical consequence**: DOCS-020 is a hard, singular, app-wide prerequisite. Do **not** write separate "Frontend Foundation" tasks for IAM/AUDIT/ORG/WF/TRACK — that would duplicate work reinventing something that already exists. **Every frontend page task for any module must list `TASK-DOCS-020` as a prerequisite** (alongside the two-part Tier-3-component + backend-procedure lookup), and can assume `useAuth()`, `trpc`, and the query client are simply available to import, not things to build.

## TASK-DOCS-021 — Document List Page

**Location**: `docs/pre-development/A-project-planning/a1-tasks/docs.md`, TASK-DOCS-021.
**Prerequisite**: `[TASK-DOCS-020]` only.

Conventions established here, reusable across other modules' list-style pages:

- TanStack Table, with **no reusable `DataTable` primitive in `@batac/ui` yet** — build from shadcn table primitives each time. (A future shared `DataTable` primitive could reduce duplication if several similar list pages are being written in the same pass — worth considering as an option, not yet built.)
- **Cursor-based pagination only, never page-number** — the backend has no page-number concept (confirmed at the repository level).
- **Filter state lives in URL search params** via `useSearchParams`.
- **Empty-state copy must stay generic**: ABAC scope resolution can produce an empty result for reasons the frontend cannot distinguish (`{kind: 'none'}` vs. `{kind: 'own', officeIds: []}` both yield `[]` with no signal why). This is a real, well-reasoned UX constraint relevant to any other module's list page, not just DOCS's.
- Renders a link to `/documents/:id` styled as "disabled-looking" (not a route that 404s) — a deliberate design choice made because, at the time this task was written, the Detail page did not yet exist.

## TASK-DOCS-022 — Document Intake Form

**Location**: `docs/pre-development/A-project-planning/a1-tasks/docs.md`, TASK-DOCS-022.
**Prerequisites**: `[TASK-DOCS-020, TASK-DOCS-021]`.

- **Closes the `documentTypes.list` gap from DOCS-020**: adds `listActiveDocumentTypes()` at the repository layer and exposes it as `documents.documentTypes` (flat namespace — confirmed pattern). This is a small in-boundary backend addition, explicitly distinguished from DOCS-020's two cross-module backend fixes. As of DOCS-022, `documents.documentTypes` is available for any downstream task; there is no longer an open gap here.
- **File-upload pattern (established, reusable)**: direct-to-S3 upload flow — `create` → `requestUploadUrl` → client `PUT` → `confirmUpload`. Relevant if any other module's frontend task (WF, TRACK) needs file attachment.
- **Success path** redirects to `/documents/{documentId}` after successful upload — at the time DOCS-022 was written, this route did not yet correspond to an existing page.

## Document Detail Page — Confirmed Gap and Resolution

- **DOCS-021's AI Prompt explicitly speculates about a future `TASK-DOCS-023` (Document Detail page)**, self-flagging this as its own forward-looking assumption, not a confirmed fact.
- **Confirmed**: DOCS's file ends at TASK-DOCS-022. Document Detail does not exist as a task anywhere in the codebase.
- **Both already-written tasks structurally depend on Detail existing**: List (021) links to `/documents/:id` "once a Detail page exists"; Intake (022) redirects to `/documents/{documentId}` on success.
- **Conclusion**: this is a genuine gap in DOCS's own frontend slice — not a cross-module one. DOCS-021 and DOCS-022 are **structurally incomplete without Detail**, not merely adjacent to it: List renders a dead link by design, and Intake's entire success path terminates in a page that doesn't exist. This is the third leg of a three-page flow where the first two legs were already written assuming the third follows.
- **Sequencing decision**: read F1/F4/F5/F7/J6 ToCs, E1's ToC, and consolidated-ref §13 first (Detail's own scope — fields, sections, actions — needs the same page-inventory grounding as any other page task), specifically checking F1's route map for whether `/documents/:id` already has a documented spec. Then draft DOCS-023 (Document Detail), correctly numbered to slot in after 022, with real prerequisites (including resolving whether it needs a WF/TRACK task ID or an honest `[CROSS-MODULE REF]`). Only after DOCS's 020–023 slice is complete should the other five modules (IAM, AUDIT, ORG, WF, TRACK) be drafted, using DOCS's complete slice as the template pattern.

## F1 Route Map — Epistemic Status and Notation System

**Location**: `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md` (v2 is the live file; a `.bak` exists and is superseded — do not read it, per the standing never-read-`.bak` rule).

**Critical epistemic distinction**: F1 is explicitly self-marked as **DRAFT, unreviewed** — a blockquote at the top states directly that every route/component/composition choice in the document is the document's own proposed synthesis, and that content "not defined anywhere in the original source material... [is] not a confirmed fact — even in rows that are not individually re-tagged." This is a materially different epistemic status than DESIGN.md or the finished module task lists (which describe things that got built). **F1 describes things that are proposed to be built.**

F1 uses a real, load-bearing notation system that must be preserved precisely when drafting any task derived from it — never flatten a `[Speculation]` into something reading as settled, and never treat a `[Resolved — ADR]` claim as equally soft as an adjacent `[Speculation]`:

- `[Confirmed]`
- `[Resolved — ADR]`
- `[Inference]`
- `[Speculation]`
- `[Unverified]`

There is a separate, dedicated ADR directory for this document: `f1-application-route-map-adrs/` — a route-specific decision (e.g., about `/documents/:id`) may live there rather than in the main route-map file itself.

## F1 Section 7 (lines 291–329) — Document Detail Page Spec

**Title**: "Document intake form (and the document list / document detail routes it depends on)" — confirms Detail's route is already specified here, not something to invent from scratch off List/Intake's forward-references.

### Confirmed content

- **Route, component name, and role list are `[Confirmed]`**: route `/documents/:documentId`, component `DocumentDetailPage`, **10 named roles**, each additionally scoped by office/classification ABAC. This is directly cited to E1 §3.1's `documents.get` callable-by list — not invented by F1.
- **System Administrator is explicitly excluded** from this page's role set, per `[Resolved — ADR-UI-008]`. They instead get a separate `documents.getMetadataForAdmin` procedure, reachable from §13's dedicated admin section. **Caution**: do not fold `sys_admin` into Detail's role gate when drafting this task.

### Seven procedure groups (presented as confirmed groupings, not individually re-tagged `[Inference]`)

| Group             | Procedures / Scope                                                                                                         | Owning module        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Read              | (base document read)                                                                                                       | DOCS                 |
| Lifecycle         | Nine lifecycle actions                                                                                                     | DOCS                 |
| Portal visibility | (visibility controls)                                                                                                      | DOCS                 |
| File & OCR        | Six file/OCR actions                                                                                                       | DOCS                 |
| Tracking          | Four procedures: `getTrackingRecord`, `printQrCoverSheet`, `getRoutingHistory`, `logRoutingEntry` (`tracking.*` namespace) | **TRACK**            |
| Workflow link-out | `workflow.getActiveInstanceForDocument`, linking to `/workflow/steps/:instanceId` (itself specified in F1 §8.2)            | **WF**               |
| Records           | Five `records.*` procedures — see resolution below                                                                         | See resolution below |

This confirms Detail genuinely requires cross-module data — not merely suspected, but confirmed via the Tracking, Workflow link-out, and Records groups above.

### Two genuine `[Inference]` items (F1's own proposals, correctly self-labeled, not settled fact)

1. A QR-scan search shortcut on the **List** page using `tracking.scanQrCodeAuthenticated` — not part of Detail itself, but an adjacent proposed feature on `/documents`.
2. The entire create→redirect-to-Detail flow (already known from DOCS-021/022) is itself flagged by F1 as "a proposed flow, not a source-stated one — the team could equally choose a single-page flow." **Useful confirmation**: DOCS-021/022's authors already made this same design choice and built toward it, meaning the proposed flow is the one actually being followed in practice — describe it as originally-proposed-then-adopted, not as something F1 asserted as fixed.

## Records Procedure Group — Resolution (Not a Real Cross-Module Blocker)

**Initial concern (superseded)**: Detail's confirmed spec includes a Records procedure group, and per the Wave structure, RECORDS is Wave F — one of the three explicitly-excluded modules for this round (REC, NOTIF, PORTAL). This initially appeared to be a genuine structural blocker: Detail's own confirmed spec depends on a module whose backend doesn't exist yet.

**Resolution, confirmed via `docs/pre-development/E-api-design/e1-trpc-router-and-procedure-catalog.md`, lines 91–95, 1220–1280, 1552:**

- The five `records.*` procedures F1 §7.3 lists **are specified and Phase 1 in scope** — they are not deferred to a REC module task list that doesn't exist.
- **Critical mechanism**: in Phase 1, `records.placeLegalHold`/`removeLegalHold` write to `documents.documents.metadata` (a JSONB flag on the DOCS schema), **not** to the reserved-but-unpopulated `records.records` table. This means these procedures are Phase-1-implementable without RECORDS' actual schema/tables existing — they are deliberately designed as forward-compatible placeholders living inside DOCS' own schema.
- **Phase split, confirmed at line 1552**: the _real_ RMS bulk/disposition procedures (`bulkArchive`, `initiateDisposition`, `processPiiErasure`) are genuinely Phase 2 and excluded. The Phase 1 subset — described as procedures "the Documents/Workflow modules call synchronously" — comprises: `getRetentionSchedule`, `applyRetentionSchedule`, `applyClassification`, `placeLegalHold`/`removeLegalHold` (treated as one paired unit), `isUnderLegalHold`. (Five procedure names; E1's own ToC groups hold/unhold together, referring to this set as "four procedures.")

**Conclusion**: this is **not** a genuine RECORDS-module cross-reference in the blocking sense initially assumed. These are `records`-namespaced procedures that are functionally part of Phase 1 DOCS/WF scope. The real open question is narrower: **which task actually implements the `recordsRouter`'s Phase 1 procedures at the backend, and does a task ID for it already exist?**

- `rec.md` is confirmed zero bytes (no REC module task list exists).
- The router is referred to as "the Phase 1 `recordsRouter`" — implying a real, named, implemented router, not a hypothetical.
- **Working hypothesis** (not yet fully verified at time of writing): this was very likely implemented as part of DOCS' own backend pass, not a separate REC pass — following the same precedent as `documents.documentTypes` being implemented inside DOCS-022 rather than requiring a whole new module. Next step: check DOCS's own task list (001–019, backend range) for the task that implements `recordsRouter`.

## Open Items Carried Forward

- Confirm which DOCS backend task (within 001–019) implements the Phase 1 `recordsRouter` procedures, to resolve Detail's Records-group prerequisite as a real task ID rather than a placeholder.
- Draft `TASK-DOCS-023` (Document Detail page) once the above is resolved, using F1 §7's confirmed spec (route, component name, 10 roles, seven procedure groups) and correctly excluding System Administrator per `ADR-UI-008`.
- After DOCS's 020–023 slice is complete, use it as the template pattern for drafting frontend tasks in IAM, AUDIT, ORG, WF, and TRACK — each requiring `TASK-DOCS-020` as a foundation prerequisite plus the two-part Tier-3-component + backend-procedure lookup per module.

---

I need to see the truncated middle section (lines 80-164) which contains the actual DOCS-023 task draft content — this is likely the most important part of the file.I now have the complete content of both files. Let me confirm the exact line counts to ensure nothing was missed.Confirmed — full content of both files accounted for. Both are continuation sessions building on the two prior documents I've already extracted. I'll now extract the new durable knowledge: corrections (especially the four-vs-five procedure count), the actual drafted TASK-DOCS-023, and the verification/citation methodology established. Per the user preference to show full reasoning, I'm noting my approach here: the "Continuing ongoing work" file is a compressed summary written by a prior instance and largely restates what I already have, with one net-new correction (the E1 line 1262 qualifier detail and Tracking/Workflow task ID assignments); the "Continuing work without redundant verification" file is the substantive one — it contains independent re-verification of every prior claim against primary sources, catches a real four-vs-five procedure undercount, and contains the actual drafted TASK-DOCS-023 task in full. I'm treating the second file as authoritative wherever the two overlap, since it explicitly supersedes and corrects the first.

---

# `batac-dms` — Frontend Task Generation: Governance & Architecture Reference (Update 3)

_This update extends and corrects the prior two reference documents. A material correction is noted below and should override all earlier "four procedures" references._

## Critical Correction: Records Group Has Five Procedures, Not Four

**This corrects every prior reference to "four Phase-1 `records.*` procedures."** Direct verification against F1 §7.3 (line 323) shows the Records group actually lists **five** procedures:

- `records.applyClassification`
- `records.isUnderLegalHold`
- `records.placeLegalHold`
- `records.removeLegalHold`
- **`records.applyRetentionSchedule`** — the previously-missed fifth procedure

`applyRetentionSchedule` is confirmed as a real, documented, `[Confirmed]` E1 procedure at line 1231 — distinct from the other four, which are documented at E1 lines 1247–1267. It was independently verified to have **no implementing task or code anywhere**, exactly the same as the other four (confirmed via two separate, non-short-circuited searches: one grep across all `a1-tasks/*.md` files, one recursive codebase search — both returned clean/no-match exit codes).

**`applyRetentionSchedule`'s own spec detail**: takes `scheduleId: z.string().uuid()`, referencing an _already-existing_ schedule — it does not create one. Its own `[Confirmed]` note states that schedule _creation/activation_ is Phase-2 Platform Admin configuration, out of scope for this procedure.

### Distinguishing this gap from `SPEC-GAP-DOCS-03`

`SPEC-GAP-DOCS-03` (found in DOCS's own Module Summary) is a **different, pre-existing gap** and must not be conflated with the Records-procedure gap above:

- **`SPEC-GAP-DOCS-03`**: about _seeding_ `document_types.retention_schedule_id` with placeholder UUIDs at the type-catalog level, in `TASK-DOCS-007`. This is a seed-data dependency on the `records.retention_schedules` table, at the type-catalog level.
- **The Records-group gap (this document)**: about the complete absence of _any_ `records.*` router or procedure implementation — a document-level runtime action, not a catalog seed.

Both ultimately depend on a REC module that doesn't exist yet in Phase 1, but they are not the same gap and should be flagged as two distinct spec-gap notes, never merged into one.

### E1's own qualifier on `placeLegalHold` — narrow scope, does not extend to the other four

E1 line 1262 carries an `[Inference]` qualifier specifically on `placeLegalHold`, worded precisely as: _"since records.records rows are not yet created by ordinary Phase 1 document flow per B2 Module 6's Phase 2 delivery note."_

This qualifier suggests the absence of `records.records` rows may be **intentional/expected at the spec level** for `placeLegalHold` specifically — not merely an oversight. **This inference does not extend to the other four procedures** (`applyClassification`, `removeLegalHold`, `isUnderLegalHold`, `applyRetentionSchedule`), which carry no comparable qualifier in E1 and are stated as `[Confirmed]` outright. Do not read this note as covering the whole Records group.

## DOCS Module Summary — Additional Confirmed State

- **DOCS's Module Summary states "Task count: 19 (TASK-DOCS-001 through TASK-DOCS-019)"** — written before 020, 021, or 022 existed. This summary is stale relative to the file's actual current task list (confirmed to run through 022, with 023 being drafted). **Do not treat this summary as a live, authoritative index** of what's confirmed for the file — it is a snapshot from an earlier point. When DOCS-023 is added, the Module Summary needs to be updated to reflect it, not just have 023 appended below an unrevised summary.
- **`TASK-DOCS-022` (line 2673) is confirmed as the last task heading** in `docs.md`, followed only by the Module Summary section (starting line 2855, ending line 2968). No `TASK-DOCS-023` heading exists anywhere in the file prior to this document's drafting of it.
- **`TASK-DOCS-022` line 2614 only references "TASK-DOCS-023" as its own forward-looking guess** at what number the next task would receive — explicitly self-flagged as "this task's own forward-looking assumption, not a confirmed prerequisite/citation."

## Backend Task Assignments for Detail's Cross-Module Procedure Groups (Confirmed)

| Procedure group   | Procedures                                                                       | Implementing task                                         | Verification detail                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tracking          | `getTrackingRecord`, `printQrCoverSheet`, `getRoutingHistory`, `logRoutingEntry` | **TASK-TRACK-007** (line 936)                             | Implements `trackingRouter` with full implementations of all five E1 Module 5 procedures, using real Zod input/output schemas and ABAC enforcement. |
| Workflow link-out | `workflow.getActiveInstanceForDocument`                                          | **TASK-WF-018** (line 1759, referenced at line 40 in ToC) | One of four read-side query procedures implemented on `workflow.router.ts`.                                                                         |
| Records           | Five `records.*` procedures (see above)                                          | **None — confirmed gap**                                  | No implementing task exists in any finished module's task list; no code exists in the codebase.                                                     |

## `wf.md` — Standing Citation Instruction

**`wf.md`'s Module Summary (around line 2624) contains a standing developer instruction**: _"I'll do the ToC line numbers myself, so don't do them"_ — and a note that `[L#–L#]` ranges throughout that file are now stale.

**Practical consequence**: any citation to `wf.md` must reference the task ID and its content, never a line-range that would be invented or that is already known-stale in that specific file.

## `documents.get` — Exact Confirmed Role/ABAC Detail (E1 line 625–626)

The 10 callable-by roles for `documents.get`, confirmed verbatim from E1 directly:

`records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor`

- `sys_admin` is confirmed excluded exactly as stated in `[Resolved — ADR-UI-008]` — reachable only via the separate `documents.getMetadataForAdmin` procedure, from its own System Administrator area (F1 §13).
- **Naming note**: F1 §7.3 (line 311) calls this role "System Administrator" (a label); E1 uses the enum/procedure-gate value `sys_admin`. This is a label-vs-enum-value difference, not a real conflict — use `sys_admin` consistently, since that is the actual gate value.
- **ABAC conditions in E1 are substantially more detailed than a paraphrase would suggest** — cite the governing text precisely rather than paraphrasing loosely when referencing this in a task.
- **F1 line 325 — governing instruction for per-action gating**: F1 itself does not re-derive every individual action's ABAC gate at the page level. It states the page-level 10-role group is the _broadest_ set, and explicitly defers to E1 directly for each individual procedure's specific callable-by list. This must be followed literally in any executing task: check each action button's own E1 entry (e.g., `documents.archive` is Records Officer/SP Secretary only) rather than gating every button by the same blanket 10-role list.

## `getScanQualityIndicator` — Exact Confirmed Spec (E1 line 826)

- Takes `versionId`, **not** `documentId`, as its input parameter.
- Output: `{ scanQualityScore: number|null, scanQualityCategory: 'good'|'fair'|'poor'|null }` — both fields nullable specifically because the OCR job may not have finished yet.
- **Practical implication**: Detail must resolve the current version's `versionId` (via `documents.getVersionHistory` or the initial `documents.get` call) before this procedure can be called — it is not something Detail fetches independently by document ID.

## Scan-Quality Polling Requirement — Confirmed Functional Requirement

**Source**: `TASK-DOCS-022`, lines 2790–2793, direct file read (not paraphrase).

**Exact text**: _"Detail is the page designed to poll/refresh for [scan quality feedback] once it exists; Intake's job ends at a successful redirect."_

- OCR runs asynchronously via a background job enqueued inside `confirmUpload` — the `confirmUpload` response itself carries no scan-quality data.
- **Consequence**: Detail cannot render `getScanQualityIndicator`'s result as a one-time static fetch. It must poll until the async job completes.
- **Polling mechanism**: use a `refetchInterval` on the TanStack Query hook, active while `scanQualityCategory` is `null`; stop once it resolves to a non-null value.
- **Edge case**: a document whose OCR already completed before Detail is opened must not poll indefinitely — the hook must recognize an already-resolved value on first fetch and not start an interval at all in that case.

## Remaining File & OCR Group Procedures (E1 detail)

Two procedures beyond the ones already covered:

- Both operate on `versionId`.
- Both are Records Officer-gated, with `acceptScannedBackAsOfficial` additionally allowing SP Secretary.
- Both are straightforward mutations with no ABAC conditions beyond role.
- **Adjacent but out-of-scope note**: E1 (around line 1535) flags an adjacent `[Inference]` about two related-but-undetailed procedures (`uploadSignatureImage`/`getSignatures`) — these are **not** part of F1 §7.3's actual File & OCR group (as listed at F1 line 320), so they are correctly excluded from DOCS-023's scope.

## UI Component Task Verification (Confirmed)

All four Tier-3 component tasks Detail composes were verified directly by reading their title lines:

| Task ID     | Component              |
| ----------- | ---------------------- |
| TASK-UI-012 | RoutingHistoryTimeline |
| TASK-UI-013 | QRCodeDisplay          |
| TASK-UI-015 | StatusBadge            |
| TASK-UI-016 | WorkflowStepIndicator  |

**Note**: UI-013 and UI-016 have their own prior open-item resolution notes (see Update 2's finding on TASK-UI-013/018) — these are already settled at the component level, so DOCS-023 simply consumes them as-is without repeating their resolution history.

## House Documentation Convention (Confirmed, to Be Followed for New Tasks)

Observed directly in the existing AI Prompt text of prior DOCS tasks — a distinct tagging convention used on section headers and inline claims throughout the AI Prompt:

- `[Confirmed by direct file read]`
- `[Inference]`
- `[Unverified — TASK-ID]`

Each AI Prompt ends with a **checklist that exactly mirrors the Acceptance Criteria** section. New tasks should follow this exact convention rather than inventing a separate tagging scheme, since it is the established house style for this codebase's task documents.

## TASK-DOCS-023 (Document Detail Page) — Final Drafted Task

```
Phase:          1 (Frontend)
Module:         DOCS
Title:          Document Detail page
Prerequisites:  [TASK-DOCS-020, TASK-DOCS-021, TASK-DOCS-022, TASK-UI-012, TASK-UI-013, TASK-UI-015, TASK-UI-016, TASK-TRACK-007, TASK-WF-018]
Deliverables:
  - `/apps/web/src/pages/documents/DocumentDetailPage.tsx` — route component for `/documents/:documentId`. Composes `StatusBadge` (TASK-UI-015), `WorkflowStepIndicator` (TASK-UI-016), `RoutingHistoryTimeline` (TASK-UI-012), and `QRCodeDisplay` (TASK-UI-013) — [Confirmed by direct file read]: all four exist as `/packages/ui/src/components/domain/*.tsx` Tier-3 deliverables already. Do not rebuild any of their internal rendering logic here; this task wires data into them.
  - `/apps/web/src/main.tsx` — add the `/documents/:documentId` route pointing at `DocumentDetailPage`, after the existing `/documents/new` route added in TASK-DOCS-022.
  - `/apps/web/src/hooks/useScanQualityPolling.ts` — a small hook wrapping `trpc.documents.getScanQualityIndicator.useQuery({ versionId })` with a `refetchInterval` that polls while `scanQualityCategory` is `null` and stops once it resolves to a non-null value. [Confirmed by direct file read, E1 line 826]: the procedure takes `versionId`, not `documentId` — Detail must resolve the current version's `versionId` (via `documents.getVersionHistory` or the initial `documents.get` load) before this hook can be called.
Acceptance Criteria:
  - [ ] `pnpm typecheck` passes
  - [ ] Page loads via `trpc.documents.get.useQuery({ documentId })` and renders for exactly the 10 roles confirmed callable in E1 line 625 (`records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor`) — `sys_admin` is excluded from this page entirely per `[Resolved — ADR-UI-008]`; it reaches only `documents.getMetadataForAdmin` from its own §13 area, not this route.
  - [ ] `officeScopeId` handling: since this is an office-scoped view, [Inference — not directly stated as a UI rule in F1, reasoned from E1 line 626's ABAC conditions]: the page must not assume a document belongs to the viewer's own office — cross-office reads are permitted only for the specific roles and classification conditions in E1 line 626, and the UI must handle a document whose `originatingOfficeId`/`ownedByOfficeId` differ from the viewer's own office without treating that as an error state.
  - [ ] Each Lifecycle, Portal visibility, and File & OCR action button (per F1 §7.3's grouped table) is shown/hidden or disabled per its own narrower callable-by set — this task cross-references E1 directly for each individual procedure's gate rather than reusing the page-level 10-role list as a blanket permission for every action button. [Confirmed by direct file read, F1 line 325]: F1 itself states it does not re-derive every gate and defers this to E1 per-procedure.
  - [ ] The scan-quality indicator polls via `useScanQualityPolling` and stops polling once `scanQualityCategory` resolves to non-null; a document with no pending OCR (already resolved) does not poll indefinitely.
  - [ ] `records.*` action buttons (Classification, Legal Hold, Retention Schedule) are NOT implemented in this task — see the Records group gap note below. The page must not render broken/dead buttons for these; omit them entirely from this task's UI rather than stubbing disabled buttons that reference non-existent procedures.
  - [ ] `pnpm test` passes

AI Prompt: |
  You are building Document Detail, the richest page in the DOCS frontend — nearly every
  document lifecycle action funnels through it (F1 §7.3). Foundation (TASK-DOCS-020) built the
  tRPC client and auth; List (TASK-DOCS-021) and Intake (TASK-DOCS-022) established page/route
  conventions this task follows.

  ## Scope, by procedure group [Confirmed by direct file read, F1 §7.3 line 315-323]
  F1 groups this page's procedures into seven categories. Six of the seven have real,
  implemented, or in-scope-for-this-task backends. One does not — see the gap note below before
  building anything in that group.

  - **Read**: `documents.get`, `documents.getVersionHistory`, `documents.downloadVersion`,
    `documents.getOcrText`
  - **Lifecycle**: `documents.update`, `documents.submit`, `documents.assignPreliminaryNumber`,
    `documents.assignFinalNumber`, `documents.cancel`, `documents.delete`, `documents.archive`,
    `documents.logCertificationOfUrgency`, `documents.logSecretariatDecision`
  - **Portal visibility**: `documents.publishToPortal`, `documents.unpublishFromPortal`
  - **File & OCR**: `documents.requestUploadUrl`, `documents.confirmUpload`,
    `documents.getScanQualityIndicator`, `documents.triggerManualReOcr`,
    `documents.flagScannedBackForVerification`, `documents.acceptScannedBackAsOfficial`
  - **Tracking**: `tracking.getTrackingRecord`, `tracking.printQrCoverSheet`,
    `tracking.getRoutingHistory`, `tracking.logRoutingEntry` — [Confirmed by direct file read]:
    all four implemented in TASK-TRACK-007 (`trackingRouter` with full implementations of all
    five E1 Module 5 procedures, real Zod schemas, ABAC enforcement).
  - **Workflow link-out**: `workflow.getActiveInstanceForDocument` — links to
    `/workflow/steps/:instanceId`. [Confirmed by direct file read]: implemented in TASK-WF-018
    as one of four read-side query procedures on `workflow.router.ts`.
  - **Records**: `records.applyClassification`, `records.isUnderLegalHold`,
    `records.placeLegalHold`, `records.removeLegalHold`, `records.applyRetentionSchedule` — see
    gap note immediately below. **Do not build this group.**

  ## [SPEC GAP — DOCS-023-01] Records group has no implementing task or code anywhere
  [Confirmed by direct file read — codebase search and full task-list search, both clean]

  F1 §7.3 line 323 names five `records.*` procedures for this page's Records group, all five
  `[Confirmed]` with full specs in E1 (lines 1231-1267: `applyRetentionSchedule`,
  `applyClassification`, `placeLegalHold`/`removeLegalHold`, `isUnderLegalHold`). None of the
  five exist anywhere:
  - No `recordsRouter` file, or any file matching `*record*`, exists anywhere under `apps/` or
    `packages/` — confirmed by direct recursive search of the extracted codebase.
  - No task in any finished module's task list (`docs.md`, `track.md`, `wf.md`, or any other
    `a1-tasks/*.md` file) implements any of the five procedure names — confirmed by direct
    recursive grep of the task-list directory for each of the five names individually.

  This is distinct from `[SPEC-GAP-DOCS-03]` in this file's own Module Summary (below), which is
  about seeding `document_types.retention_schedule_id` placeholder UUIDs at the type-catalog
  level in TASK-DOCS-007. That gap is about seed data for a *different* table
  (`records.retention_schedules`, referenced at the type level). This gap is about the absence
  of *any* `records.*` router or procedure implementation at all — a document-level runtime
  action, not a catalog seed. The two are related (both ultimately depend on a REC module that
  doesn't exist yet in Phase 1) but are not the same gap and should not be merged into one note.

  [Inference, single-hop]: E1 line 1262's own `[Inference]` qualifier on `placeLegalHold` — "since
  records.records rows are not yet created by ordinary Phase 1 document flow per B2 Module 6's
  Phase 2 delivery note" — suggests this absence may be intentional/expected at the spec level,
  not merely an oversight. This inference does not extend to the other four procedures, which
  carry no comparable qualifier in E1 and are stated as `[Confirmed]` outright; do not read this
  note as covering the whole group.

  **Action required, per AGENTS.md §8**: do not build UI for this group, do not stub disabled
  buttons referencing these procedure names, and do not invent a storage location or fallback
  behavior for them the way `placeLegalHold`'s own spec provisionally does (documents.metadata
  flag) — that provisional behavior is E1's call to make for the backend procedure itself, not
  this frontend task's call to make in its absence. When a task exists to implement the
  `records.*` router (Wave F, REC module, or a dedicated backend task — not determined by this
  note), a follow-up frontend task should add the Records group's five buttons to this page.
  This task's Deliverables and Acceptance Criteria above already reflect this: the Records group
  is absent by design, not by omission.

  ## Scan-quality polling — a real functional requirement, not optional [Confirmed by direct
  file read, TASK-DOCS-022 line 2790-2793]
  Intake's own task explicitly states: "Detail is the page designed to poll/refresh for [scan
  quality feedback] once it exists; Intake's job ends at a successful redirect." OCR runs async
  via a background job enqueued in `confirmUpload` — that response tells you nothing about scan
  quality. This means Detail cannot render `getScanQualityIndicator`'s result as a one-time
  static fetch; it must poll until the async job completes.

  `documents.getScanQualityIndicator`'s output (E1 line 826) is
  `{ scanQualityScore: number|null, scanQualityCategory: 'good'|'fair'|'poor'|null }` — both
  fields nullable specifically because the OCR job may not have finished yet. Poll (e.g. a
  `refetchInterval` on the TanStack Query hook) while `scanQualityCategory` is `null`; stop once
  it resolves. A document whose OCR already completed before Detail is opened should not poll
  indefinitely — the hook must recognize an already-resolved value on first fetch and not start
  an interval at all in that case.

  ## Role list and ABAC — apply these exactly [Confirmed by direct file read, E1 line 625-626]
  The 10 callable-by roles for `documents.get` are listed verbatim in the Acceptance Criteria
  above. `sys_admin` is deliberately excluded from this router entirely
  `[Resolved — ADR-UI-008]` — it reaches only a separate, narrower `documents.getMetadataForAdmin`
  procedure from its own System Administrator area (§13), not this page. Do not add a
  conditional branch for `sys_admin` on this page; per ADR-UI-008 that branch does not belong
  here at all.

  Per F1 line 325, F1 itself does not re-derive every individual action's gate — it states the
  page-level 10-role group is the broadest set, and defers to E1 directly for each procedure's
  specific callable-by list. Follow that instruction literally: check each action button's own
  E1 entry (e.g. `documents.archive` is Records Officer/SP Secretary only) rather than gating
  every button by the same 10-role list.

  Before submitting this PR, confirm each item:
  - [ ] `pnpm typecheck` passes
  - [ ] Page renders correctly for all 10 confirmed roles, and `sys_admin` cannot reach this
    route's content (only its own separate metadata-only view)
  - [ ] Each action button's visibility/disabled state matches its own E1 callable-by list, not
    a blanket page-level permission
  - [ ] Scan-quality polling starts only when `scanQualityCategory` is null on first fetch, and
    stops once it resolves
  - [ ] No Records-group (`records.*`) button, stub, or disabled control exists anywhere on this
    page
  - [ ] `pnpm test` passes
```

## Task Schema Application — Confirmed Reference Points for DOCS-023

- **Schema fields** (Phase/Module/Title/Prerequisites/Deliverables/Acceptance Criteria/AI Prompt, ending with a verbatim checklist) are locked by `A1-AGENTS.md` lines 143–219 — not improvised, only filled per the established contract.
- **Prerequisites must be task IDs only** (confirmed at two separate points in governance: `A1-AGENTS.md`'s schema section and `a1-skeleton.md` Section 4). DOCS-023's prerequisite list reflects this: `TASK-DOCS-020` (infra/auth), `TASK-DOCS-021` (List — for the link it currently disables), `TASK-DOCS-022` (Intake — for the redirect it currently points at), `TASK-UI-015`/`016`/`012`/`013` (the four Tier-3 components Detail composes, per F1 §7.3's confirmed role/procedure list), `TASK-TRACK-007`, `TASK-WF-018`.
- **The Records group receives `[SPEC GAP]` treatment**, per `AGENTS.md` §8's "do not invent content to resolve a spec gap" rule, following the same established precedent as DOCS-020's `superseded → ARCHIVED [Inference]` mapping and DOCS-022's now-closed `documentTypes.list` gap — i.e., "note it precisely, don't let it block the task." **This particular gap is stronger** than those precedents (no implementing task exists anywhere, versus a naming ambiguity that was later resolved) — the note states this plainly rather than softening it into a resolved-precedent-style reference.
- **`officeScopeId` nullability** requires an explicit acceptance-criterion line, since Detail is an office-scoped view.

## Verification Methodology Note (Process Learning, Not Repo Fact)

When continuing work from a prior transcript/summary, every load-bearing claim in that summary should be independently re-verified against primary source files before being relied upon for drafting — rather than propagated as already-settled. In this case, doing so surfaced a real correction (four vs. five Records procedures) that the summary's own paraphrase had silently carried forward as fact. Claims that were re-verified and found accurate (DOCS-023's non-existence, the 020/021/022 template pattern, the TRACK-007/WF-018 task assignments, the four UI component tasks, the `wf.md` stale-line-number instruction, and the scan-quality polling requirement) should still be treated as confirmed going forward — the correction applies specifically and only to the Records-procedure count, not to the rest of the prior reference material.
