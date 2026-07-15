# Master Phased Task List Generation

This file governs the **A1 generation phase** — building the Master Phased Task
List itself, not executing tasks from it. If you are an agent that has received a
task from a finished A1 to implement in code, stop here and read `AGENTS.md`
instead. These two files govern different phases and must not be conflated.

A1 cannot be generated in a single pass. It depends on every pre-dev document
simultaneously, and its output (150–300 pages of tasks across 5 phases) is too
large to generate coherently in one context window. The solution: generate module
by module in wave order, then assemble. This file is the routing guide for that
process.

---

## How to use this file

1. Identify which pass you are executing from the **Pass Types** table in Section 2.
2. Load only the documents listed for that pass, in the order listed.
3. Follow the schema in Section 3 for every task you produce.
4. Follow the pass-specific rules in Section 6 for your pass type.
5. After finishing a module pass, produce a Module Summary (Section 6, Step 2 rules).
6. If you find a spec gap (something the consolidated reference requires in Phase 1
   but no pre-dev document specifies clearly enough to write a self-contained
   prompt for), record it as `[SPEC GAP: description]` in the Module Summary — do
   not invent the missing spec content. A human resolves it before the integration
   pass runs.

---

## Section 1: Source-of-truth hierarchy

Same hierarchy as `AGENTS.md`, applied to the generation context:

1. `docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md`
   — what the system must do. Phase assignments in this document are authoritative.
   If a pre-dev document and the consolidated reference disagree on which phase a
   capability belongs in, follow the consolidated reference and flag the conflict in
   the Module Summary.
2. `docs/pre-development/tech-stack.md` — how it is built. Open items in this
   file (currently: OCR library choice) are not yet decided — do not generate tasks
   that assume a specific decision.
3. Any document under `docs/pre-development/` — downstream interpretations of #1
   and #2. If one contradicts the consolidated reference, the consolidated reference
   wins.

Never resolve a conflict by guessing which document is more recent. State the
conflict and which document you followed in the Module Summary.

---

## Section 2: Pass Types

| Pass | What you produce | Load (in order) |
|---|---|---|
| **Step 1 — Skeleton** | Structural contract: task ID convention, module list with wave order, phase scope table, cross-module dependency rules, special tags, Phase 1 task count estimates | `docs/document-list.md` → `tech-stack.md` → consolidated ref §10.2, §13 |
| **Step 2 — Module: INFRA** | TASK-INFRA-001…NNN | Skeleton → `tech-stack.md` → L1 → L2 → L3 → L4 → D5 → C5 → J3 |
| **Step 2 — Module: UI** | TASK-UI-001…NNN | Skeleton → F5 → J6 → F6 → F4 → F1 → DESIGN.md → globals.css → F7 (Frontend Foundation Plans 0, 1, 2) |
| **Step 2 — Module: IAM** | TASK-IAM-001…NNN | Skeleton → TASK-INFRA list → B5 → I2 → I1 → C1 §iam → J1 → J2 → J3 → J4 |
| **Step 2 — Module: AUDIT** | TASK-AUDIT-001…NNN | Skeleton → TASK-INFRA list → C1 §audit → `tech-stack.md` §"Audit Log Integrity" → I3 |
| **Step 2 — Module: ORG** | TASK-ORG-001…NNN | Skeleton → TASK-IAM list → TASK-AUDIT list → C1 §organization → B2 → I1 → I2 |
| **Step 2 — Module: DOCS** | TASK-DOCS-001…NNN | Skeleton → TASK-ORG list → C1 §documents → H2 → H3 → E1 §documents → E3 → B2 → I1 → I2 |
| **Step 2 — Module: WF** | TASK-WF-001…NNN | Skeleton → TASK-DOCS list → B4 → C1 §workflow → H1 → D3 → K2 → E1 §workflow → B2 |
| **Step 2 — Module: TRACK** | TASK-TRACK-001…NNN | Skeleton → TASK-DOCS list → C1 §tracking → consolidated ref §11.6 → E1 §tracking → B2 |
| **Step 2 — Module: REC** | TASK-REC-001…NNN | Skeleton → TASK-WF list → TASK-TRACK list → C1 §records → E1 §records → B2 → I1 → I2 |
| **Step 2 — Module: NOTIF** | TASK-NOTIF-001…NNN | Skeleton → TASK-WF list → H4 → C1 §notifications → E1 §notifications → B2 → B3 |
| **Step 2 — Module: PORTAL** | TASK-PORTAL-001…NNN | Skeleton → all module task lists → E2 → F1 §portal → consolidated ref §13 Phase 3 |
| **Step 3 — Outline** | Phase 1B full spec; Phases 2–5 titles + module assignments only | Skeleton → all Phase 1 module task lists → consolidated ref §13 |
| **Step 4 — Integration** | Final assembled A1 document | Skeleton → all module task lists → Step 3 outline |

### Deferred Phase 2 module passes (not part of this A1 Phase 1 round)

Added 2026-06-22, resolving the `search_meta` / `reporting` module-code gap
flagged in the Step 1 Skeleton output (`a1-skeleton.md` v1, Section 2). Both
modules carry zero Phase 1 capability per consolidated ref §13 — Meilisearch
sync is a Phase 2 addition; ARTA compliance reports is Phase 2 and the
configurable report builder is Phase 4. Neither pass below runs during this
Phase 1 A1 generation effort. These rows exist solely so the Module field
enum (Section 3) is complete for the Phase 2/4 title-only entries the Step 3
Outline pass will write against them.

| Pass | What you produce | Load (in order, once this pass actually runs) |
|---|---|---|
| **Step 2 — Module: SEARCH** `[Phase 2 — deferred]` | TASK-SEARCH-001…NNN (Phase 2 only) | Skeleton → TASK-DOCS list → `[Phase 2 search/Meilisearch source documents — not yet authored]` |
| **Step 2 — Module: REPORT** `[Phase 2/4 — deferred]` | TASK-REPORT-001…NNN (Phase 2/4 only) | Skeleton → TASK-WF list → TASK-DOCS list → TASK-TRACK list → TASK-ORG list → `[Phase 2/4 reporting source documents — not yet authored]` |

### Wave order for Step 2

Each wave can only begin after all prerequisite wave task lists exist, because
later waves reference earlier task IDs in their Prerequisites fields.

```
Wave A — no prerequisites (run in parallel):
  INFRA, UI

Wave B — needs INFRA task IDs (run in parallel):
  IAM, AUDIT

Wave C — needs IAM + AUDIT task IDs:
  ORG

Wave D — needs ORG task IDs:
  DOCS

Wave E — needs DOCS task IDs (run in parallel):
  WF, TRACK

Wave F — needs WF + TRACK task IDs (run in parallel):
  REC, NOTIF

Wave G — needs all above:
  PORTAL
```

### Deferred wave placement — SEARCH, REPORT (Phase 2; not part of Wave A–G)

Recorded 2026-06-22 so the dependency reasoning is locked in before either
module's Step 2 pass is actually scheduled — neither runs in this Phase 1
round:

```
SEARCH depends on TASK-DOCS list only (it indexes document content).
  Earliest readiness: after Wave D (DOCS).

REPORT depends on TASK-WF list + TASK-DOCS list + TASK-TRACK list +
TASK-ORG list (it reports on data those four modules produce).
  Earliest readiness: after Wave E (WF, TRACK) — ORG (Wave C) and DOCS
  (Wave D) are already satisfied by that point.
```

This fixes dependency order only. It does not schedule either module into
the current round; that happens whenever a future Phase 2 (and, for REPORT,
Phase 4) A1 update is generated.

UI is Wave A because it has no server dependencies — it is entirely
`packages/ui` and `/apps/web` static composition. The UI module tasks cover only
the component library foundation and the domain component library (the 16 Tier 3
components). Feature-specific UI tasks (Secretary dashboard, document detail view,
complaint form) belong to the module that owns that feature, not to UI.

---

## Section 3: The A1 Task Schema

Every task must use this exact format. The schema is the contract between the
generation phase and the execution phase. Field names, indentation, and structure
must be reproduced exactly — agents executing tasks parse this format.

```
TASK-{MODULE}-{NNN}

Phase:          1 | 1B | 2 | 3 | 4 | 5
Module:         INFRA | UI | IAM | AUDIT | ORG | DOCS | WF | TRACK |
                REC | NOTIF | PORTAL | SEARCH | REPORT
Title:          Human-readable, max 12 words. Add tags if applicable (see Section 4).
Prerequisites:  [TASK-XXX-NNN, TASK-XXX-NNN] or [NONE]
Deliverables:
  - /exact/path/to/file.ts — what this file contains, one sentence
  - one line per deliverable
Acceptance Criteria:
  - [ ] Testable statement a reviewer can verify in under 2 minutes
  - [ ] pnpm commands count; "code is correct" does not
AI Prompt:
  > Complete, self-contained prompt. The agent executing this task has
  > access only to this prompt text and the codebase — no pre-dev
  > documents. All relevant context must be pasted inline here.
  > Schema excerpts, procedure definitions, permission conditions,
  > business rules, and the acceptance criteria repeated as a
  > checklist at the end.
```

**Task ID format:** `TASK-{MODULE}-{NNN}` where NNN is a zero-padded three-digit
integer starting at 001 within each module. IDs are unique across the entire
document; the integration pass (Step 4) verifies this.

**`SEARCH` and `REPORT`** are valid Module values but carry no Phase 1 tasks —
see "Deferred Phase 2 module passes" in Section 2. They appear in this enum only
so Phase 2/4 title-only entries (Step 3 Outline pass) have a valid Module value
to reference. Do not generate a `TASK-SEARCH-NNN` or `TASK-REPORT-NNN` full-spec
task during this round.

---

## Section 4: Special Tags

Add these to the Title field when applicable. A task may carry more than one.

| Tag | Apply when |
|---|---|
| `[MIGRATION]` | Task produces a database migration file |
| `[ABAC]` | Task implements or modifies an ABAC policy check |
| `[AUDIT]` | Task writes to the audit schema or emits an audit event |

Example: `Title: [MIGRATION][AUDIT] Create append-only audit events table`

---

## Section 5: Rules for Every Task

**One task = one PR.** If a task produces more than one logical reviewable unit
of work, split it.

**Prerequisites list only TASK IDs — never document names.** If a task depends
on a DB migration being applied, it depends on the specific `TASK-INFRA-NNN` (or
whichever module) that applies that migration, not on "C1." If the prerequisite
module's task list has not been supplied yet, write `[CROSS-MODULE REF: module
name — task list not yet supplied]` as a placeholder. The integration pass
resolves these.

**Deliverables are specific file paths.** "Implement the workflow engine" is not
a deliverable. `/apps/server/src/modules/workflow/engine.ts` — step transition
evaluation logic; throws `InvalidTransitionError` on disallowed state moves" is
a deliverable.

**Acceptance criteria are verifiable in under 2 minutes.** Include both automated
checks (`pnpm typecheck`, `pnpm test`, specific Vitest test file names) and at
least one manual spot-check where the automated check alone would be insufficient
to confirm correctness (e.g., "scanning the QR code with a mobile browser loads
the document status page with routing history visible").

**Phase 1B, 2, 3, 4, 5 capabilities are not generated in a Phase 1 module pass.**
List deferred capabilities as `[DEFERRED — Phase X: capability name]` in the
Module Summary. The Step 3 outline pass handles them.

---

## Section 6: Pass-Specific Rules

### Step 1 — Skeleton

Produce exactly six sections:

1. Task ID convention (format, module codes, zero-padding, uniqueness rule)
2. Module list in wave order — module code, full name, pre-dev source documents,
   modules it depends on
3. Phase scope table — rows: modules; columns: phases 1, 1B, 2, 3, 4, 5; cells:
   "Full spec" / "Title only" / "N/A"
4. Cross-module dependency rules — how tasks in one module reference tasks in
   another; the rule that UI feature pages depend on the backend module tasks that
   implement the tRPC procedures they call
5. Special tags — the three mandatory tags, their definitions, which task types
   must carry them
6. Phase 1 task count estimates — module, estimated range (e.g. "8–12 tasks"),
   one-sentence rationale based on the consolidated ref §13 Phase 1 capabilities

The skeleton is a structural contract. It contains no tasks. Output nothing else.

---

### Step 2 — Module passes

**Before writing any task:** read the capability list for this module in
consolidated ref §13 Phase 1, then read the module-specific documents in the
order listed in the Pass Types table. Identify the complete set of Phase 1
capabilities this module must deliver before generating a single task.

**While writing tasks:** reference task IDs from prerequisite modules wherever a
dependency exists. Do not write `[TBD]` for a cross-module reference when the
prerequisite module's list was supplied — look up the actual ID.

**UI module pass — additional rules.** The UI module pass receives F7 (Frontend
Foundation Plans). F7 contains three plan templates that must be instantiated as
tasks, not described or summarized:

- Plan 0 → one Foundation PR task (Tier 1 install + Tier 2 replacement + token
  system + `/dev/components` route)
- Plan 1 → one task per Tier 3 component, instantiated from the per-component
  fill-in table in F7. The authoritative component count is in F5 — if F7's table
  and F5 disagree on the component list, F5 wins and the discrepancy is a
  `[SPEC GAP]` in the Module Summary.
- Plan 2 → one cross-component integration page task, run after all Tier 3
  component tasks

The tasks must encode the Group A/B/C/D ordering from F7 as explicit prerequisites:
Group A components (PageHeader, Sidebar, Topbar, AppShell) have no Tier 3
prerequisites. AppShell depends on Sidebar and Topbar. Group B components
(standalone display) have no Tier 3 dependencies and can run in parallel with Group
A. Group C components (CommitteeReferralBlock, StatusBadge, WorkflowStepIndicator)
require J6 types — their tasks must list the J6-generation task as a prerequisite.
Group D components (DocumentPreviewCard, OrderOfBusinessRow) depend on specific
Group B and C components — encode those as prerequisites, not just "Group B done."
The integration page task (Plan 2) must list all 16+ Tier 3 component tasks as
prerequisites.

**After the last task,** produce a **Module Summary** with these four items:

```
Module Summary — {MODULE}
Total tasks: N
First executable task: TASK-{MODULE}-NNN (no prerequisites from this or later modules)
Spec gaps:
  [SPEC GAP: description of capability the consolidated reference requires in
   Phase 1 but no pre-dev document specifies clearly enough to write a
   self-contained AI Prompt for]
  (or "None" if no gaps found)
Deferred capabilities:
  [DEFERRED — Phase X: capability name]
  (or "None" if nothing deferred)
```

Do not invent content to fill a spec gap. Leave it as `[SPEC GAP]` for human
resolution. A task written against an invented spec will fail at execution.

---

### Step 3 — Phase 1B and Phases 2–5 outline

Phase 1B tasks: use the full schema (all fields, same as Phase 1). These tasks
must be executable.

Phases 2–5 tasks: title and module only. No deliverables, no acceptance criteria,
no AI Prompt. Format:

```
TASK-{MODULE}-{NNN}
Phase: {2|3|4|5}
Module: {MODULE}
Title: {description}
```

The A1 definition requires full specification only for Phase 1.

---

### Step 4 — Integration pass

Perform these operations in order. Report each operation's result explicitly
before moving to the next — do not silently skip one because it found nothing.

**1. Task ID audit.** Verify every task ID is unique across all modules. List
any duplicates. Assign corrected IDs by appending `b`, `c` etc. temporarily;
flag them for human renumbering.

**2. Prerequisite graph validation.** For every task's Prerequisites field:
verify each referenced task ID exists in the combined task list. Flag broken
references as `[BROKEN REFERENCE — TASK-XXX-NNN not found]`. Do not drop them
silently. Count total broken references.

**3. Missing task detection.** Walk the prerequisite chains. If task B requires
task A and task A does not exist in any module list, generate a stub:

```
TASK-{MODULE}-000
Phase: 1
Module: {MODULE}
Title: [STUB — generated by integration pass; requires human completion]
Prerequisites: [NONE]
Deliverables:
  - [TO BE DETERMINED]
Acceptance Criteria:
  - [ ] [TO BE DETERMINED]
AI Prompt:
  > [This task was identified as missing during the integration pass.
  >  Human must complete all fields before this task can be executed.]
```

**4. Critical path identification.** Identify the longest sequential prerequisite
chain in Phase 1. State: the terminal task, the number of sequential tasks
preceding it, and the modules involved. This is the minimum execution time
regardless of how many agents run in parallel.

**5. First executable set.** List every Phase 1 task with `Prerequisites: [NONE]`
or whose prerequisites are all outside A1. These are the tasks an agent can start
immediately after the monorepo is initialized.

**6. Assembly.** Produce the final A1 document in this order:
- Table of contents (with task ID ranges per module, e.g. TASK-INFRA-001–024)
- Skeleton (Step 1 output, verbatim)
- Module sections in wave order: INFRA → UI → IAM → AUDIT → ORG → DOCS → WF →
  TRACK → REC → NOTIF → PORTAL
- Phase 1B full spec
- Phases 2–5 outline

`SEARCH` and `REPORT` have no module section in this list — they carry no
Phase 1 tasks this round (see Section 2). Their Phase 2/4 capabilities appear
only as title-only entries inside the Phases 2–5 outline, tagged
`Module: SEARCH` / `Module: REPORT`.

---

## Section 7: Rules for the AI Prompt Field

This is the most expensive field to generate and the most important to get right.
It is the only thing an execution-phase agent will have access to at task time —
it has no pre-dev documents and no AGENTS.md context when it receives a task.

**The prompt must be self-contained.** If it says "see B4 for the step transition
rules," the executing agent will not have B4 and the task will fail or produce an
incorrect implementation.

**Paste inline for every task that touches the relevant layer:**

| Layer | What to paste |
|---|---|
| Database | The exact table definition(s) from C1 that this task reads or writes — not the whole schema, only the relevant tables and columns |
| tRPC | The specific procedure definition from E1 — input schema, output schema, the procedure name |
| ABAC | The exact policy rule from I1/I2 that governs this operation — not the whole policy spec |
| Business rules | The specific Part(s) from the consolidated reference that govern this capability — copy the relevant paragraphs, do not summarize |
| State machine | The specific state transitions from D3 that this task implements or depends on |

**End every AI Prompt with this block:**

```
Before submitting this PR, confirm each item:
- [ ] {acceptance criterion 1, copied verbatim from the task's Acceptance Criteria field}
- [ ] {acceptance criterion 2}
- [ ] {acceptance criterion N}
A reviewer will verify each one independently.
```

**What not to paste:**
- The entire C1 DDL (only the tables this task touches)
- Other module task lists (the executing agent doesn't need them)
- AGENTS.md (the executing agent reads it independently before starting)
- Wave order, module boundaries, or A1 generation metadata — these are
  generation-phase concerns, invisible and irrelevant at execution time

---

## Section 8: What Generation Agents Do Not Do

- **Do not append to `docs/development-findings-log.md`.** That log is for
  execution-phase agents only. Findings from the generation phase (spec gaps,
  document conflicts) go in the Module Summary's `[SPEC GAP]` list and in the PR
  notes for the generation pass.
- **Do not edit any pre-dev document** — Group B–L, the consolidated reference,
  document-list.md, AGENTS.md, or this file. If you find a conflict or error,
  note it in the Module Summary and continue. A human resolves document issues
  between passes, not during them.
- **Do not read AGENTS.md during generation.** It governs execution-phase agents.
  Its task-type routing table, findings log rules, and development conventions are
  irrelevant in the generation context.
- **Do not generate tasks for capabilities the consolidated reference assigns to
  Phase 2 or later**, even if a pre-dev document describes them in detail. Follow
  the consolidated reference's phase assignments. Flag any disagreement as a spec
  gap, not as a reason to include a capability in Phase 1.
- **Do not resolve `[SPEC GAP]` items yourself** by inventing plausible content.
  An executing agent that runs against an invented spec will produce wrong output
  that may not fail visibly at typecheck. Leave the gap labeled; a human fills it.

---

## Section 9: Reading Documents Efficiently

Same discipline as `AGENTS.md` Section 5, applied to the generation context:

1. **Read each document's ToC first.** Every pre-dev document has a ToC after its
   header. Request the ToC range, identify the sections you need, then request
   only those line ranges.
2. **C1 is large — request only your module's schema section.** C1 is organized
   by module boundary. The ToC will show you the line range for `§iam`, `§audit`,
   `§documents`, etc. Do not load the full DDL for a module-pass context.
3. **E1 is large — request only your module's router section.** Same principle.
   The ToC for E1 maps router names to line ranges.
4. **For the WF module pass only:** read consolidated ref Parts 4.1–4.3, 4.10,
   4.17, 7.2, 8, and 11.3 in full. The workflow logic is interdependent across
   those parts; partial reads produce incorrect task specs for this module.
   For all other module passes, excerpting is correct.
5. **Never read a `.bak` file.** These are superseded versions. Files in this
   state: `b2-module-boundary-and-internal-api-contracts.md.bak`,
   `b3-internal-domain-event-catalog.md.bak`,
   `b5-authentication-and-authorization-architecture.md.bak`,
   `d3-state-machine-diagrams.md.bak`,
   `h1-workflow-definitions-structured-data.md.bak`,
   `l2-docker-compose-specification.md.bak`,
   `i1-abac-policy-specification.md.bak`.
   If the content was needed, the live file should have absorbed it — if it
   hasn't, flag it as a documentation bug in the Module Summary.