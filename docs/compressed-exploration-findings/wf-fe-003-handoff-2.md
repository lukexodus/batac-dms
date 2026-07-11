# Batac City LGU Platform — Workflow Frontend: Verified Findings, Discrepancies, and Next-Task Scoping

## Repository & Documentation Structure

- Repository: `batac-dms`, a TypeScript monorepo document management system for Batac City LGU (Local Government Unit), Philippines. Backend: Fastify, tRPC, Drizzle ORM, PostgreSQL.
- `AGENTS.md` is located at the **repo root**, not `docs/AGENTS.md`.
- **Source-of-truth hierarchy has three tiers** (per `AGENTS.md`):
  1. Consolidated reference (highest authority).
  2. `tech-stack.md`.
  3. Pre-development docs — the entire Group B–L set (including ADRs like ADR-API-003, and documents like E1, F1) — explicitly described as "downstream interpretations... can be wrong." Documents within this tier are **same-tier peers**; one does not outrank another.
- **`AGENTS.md` §4.5**: a downstream discovery never gets to silently overrule an upstream document. Agents append findings; they do not resolve or settle conflicts unilaterally.
- **Agents never edit Group B–L documents directly, under any circumstances, even for "obvious" fixes.** This is a hard rule, not a preference — decisions about whether one same-tier doc should override another (e.g., an ADR overriding shipped code or another pre-dev doc) are reserved for a human.
- The findings-log (`development-findings-log.md`) is **append-only**; humans, not agents, promote/resolve entries.
- `AGENTS.md` §5 recommends checking for a Table of Contents on large docs before reading them in full.

## Task File: `fe.md` (Frontend Workflow Tasks)

- Located at `docs/pre-development/A-project-planning/a1-tasks/fe.md`, 860 lines.
- Contains **exactly two tasks**: `TASK-WF-FE-001` and `TASK-WF-FE-002`. No `TASK-WF-FE-003` exists in the file as of this analysis.
- fe.md's prompt style/convention: heavy verified-citation, explicit **"GOOD NEWS" / "VERIFIED GAP"** framing blocks, and disciplined `[Inference]` labeling. This is a **prose-fence style** ("CONTEXT — READ THIS FIRST" fenced blocks), distinct from `wf.md`'s convention (see below).
- fe.md's opening line makes a scoping claim: "wf.md's workflow engine backend tasks TASK-WF-006 through TASK-WF-009 are done."
  - **Resolution**: This claim is accurate but scoped — TASK-WF-005 (backend workflow-engine core) is the stated prerequisite of TASK-WF-006, and TASK-WF-006–009 specifically cover step-handler implementation (the layer immediately above WF-005's core). `wf.md` actually contains tasks up to TASK-WF-025. The "006–009 done" claim is a deliberately scoped statement about the step-handler layer, not a claim about all of `wf.md`. This is **not a real discrepancy**.
- fe.md's own instructions for the `secretariat_decision` step-type detection logic (around line 490) explicitly instruct the implementing agent to **cross-reference the consolidated reference and D3** before falling back to inference, stating "neither F1 nor the router code settles this precisely — go check the consolidated reference and D3 instead."
  - **Verified violation**: This cross-reference instruction was **not followed** by the agent that implemented FE-002. The resulting findings-log entry (LOG-0078) only cites F1 and the router code — the exact two sources fe.md said were insufficient — and picked `config.assignee` as "the most stable proxy" without doing the required cross-reference.

## Task File: `wf.md` (Backend Workflow Tasks)

- Large file; goes up to `TASK-WF-025`.
- Uses a **structured `Deliverables:` / `Acceptance Criteria:` / `AI Prompt:` format** with checkbox-style acceptance criteria — a different convention from fe.md's prose-fence style. TASK-WF-006 was sampled as the reference for this format.
- TASK-WF-005 is listed as the **prerequisite** of TASK-WF-006. TASK-WF-006 through TASK-WF-009 cover **step-handler implementation** specifically.

## Documentation Convention: Task Prompt Authoring

Two valid conventions exist in this repo, and the one to use depends on which module/file is being extended:
- **fe.md convention (frontend tasks)**: prose-block style with "CONTEXT — READ THIS FIRST" fenced sections, "GOOD NEWS"/"VERIFIED GAP" framing, `[Inference]` labels.
- **wf.md convention (backend tasks)**: `Deliverables:` / `Acceptance Criteria:` (checkbox-style) / `AI Prompt:` structured format.
- **Rule**: match the convention of the specific file being appended to, not a different module's file, even if that other file's convention is otherwise well-established. A new frontend task appended to fe.md should follow fe.md's own convention, matching its two existing predecessor tasks, not wf.md's.

## Findings Log Entries

### LOG-0078 (secretariat_decision inference entry)
- Documents the FE-002 implementing agent's decision to use `config.assignee` as "the most stable proxy" for detecting `secretariat_decision`-type steps.
- Does **not** mention the consolidated reference or D3 — confirming the cross-reference instruction in fe.md was skipped.

### LOG-0079 (documentation correction entry)
- Dated the same day as this analysis; titled a "correction."
- **Problem**: despite being tagged `status: proposed` (correctly), its body **asserts ADR-B2-3 (ADR-API-003) as settled fact** — stating the old procedure "was superseded by ADR-B2-3... routes through the Workflow Router's step-completion mechanism" — and describes an edit to F1 already made in that framing.
- This is flagged as the exact anti-pattern `AGENTS.md` §4.5 prohibits: treating one same-tier pre-dev document (an ADR) as dispositive over another same-tier document (F1) and over the actual shipped code, without a human confirming the ADR should win. The `proposed` status tag is correct, but the body's confident framing pre-empts that human decision.

## ADR-API-003 / "ADR-B2-3" (Secretariat Decision Entry Point)

- File: `ADR-API-003-secretariat-decision-entry-point.md`. **This file genuinely exists** — a claim in one prior handoff document that "no standalone ADR-B2-3 document exists" was incorrect and self-contradicted later in that same document's "Resolution" section, which found and quoted the file.
- **Decided by: Luke** (line 5) — a direct stakeholder decision, not an agent inference.
- Line 30: an `approval`-type step "accepts exactly this action shape."
- Line 31: outcome routing rule — **Approve/Amended-accepted → next step; Reject → rejection path.**
- Describes secretariat decisions routing through the **Workflow Router's step-completion mechanism**, replacing the old `documents.logSecretariatDecision` mutation.

## Document B2 (v1.1) — Live Status

- Live filename convention: `b2...v1.1` (the `.bak` suffix version is the prior version; per `AGENTS.md`, `.bak` files should never be read except for diffing purposes).
- **B2 v1.1 is fully and thoroughly updated to reflect ADR-API-003** — verified line-by-line, not spot-checked. The ADR is threaded through: the changelog, module 3, module 4, the events-consumed table, the events-emitted table, and the master registry — all consistently marked `[RESOLVED — ADR-B2-3]`.
- **Naming inconsistency resolved**: B2/ADR-API-003/E1 originally described the emitted event in prose as `workflow.step_completed` (underscore). These have been corrected to `workflow.step.completed` (dotted) to match the code, eliminating the discrepancy.

## Live Code State: `documents.logSecretariatDecision`

- Location: **Documents Router** (not Workflow Router).
- **Confirmed to be pre-ADR-B2-3 code** — has not been migrated to the new mechanism.
- Gates only on `lifecycleState === 'submitted'` / `'in_workflow'`.
- Has **no** `workflow.step.completed` emission and **no** `stepInstanceId`-driven step advancement anywhere in its body.
- Its `approve` branch only fires a real transition when `lifecycleState === 'submitted'`.

### D3 Cross-Reference (State Machine)

- D3 line 129: the actual guard for the **`Submitted → In-Workflow`** transition is **"Secretariat staff completes formal intake action..."**, marked `[CONFIRMED]`.
- This transition matches the `intake_logging` seed step (previously flagged by prior analyses as the one plausible real "Secretariat decision" step).
- **Critical distinction**: this `Submitted → In-Workflow` transition is triggered by the event **`WORKFLOW_INITIATED`**, not by a Secretariat "Approve/Reject/Amended" decision. It is the **intake** action that creates the workflow instance in the first place — conceptually prior to, and different in kind from, "logging a decision inside an already-running workflow."
- **Conclusion**: `logSecretariatDecision`'s `approve` branch, which only fires when `lifecycleState === 'submitted'`, is confirmed **structurally unreachable** from any of the 12 `secretariat_decision`-tagged steps in an already-running workflow, since those steps occur after the workflow is already in progress, not at the intake/submitted stage. This confirms it is effectively a no-op / dead branch in current production usage for that step type.

## `canLogSecretariatDecision` (Policy Function)

- Exists in the codebase but is **completely unwired — zero call sites** beyond its own definition file. Confirmed via direct search, not inference.
- Its docstring (lines 578–580) **explicitly documents that it was deliberately not used** for `recordVetoOverrideVote`.
- Its own comment notes: "office UUID... seeded at runtime... cannot resolve it internally" — meaning the **caller** must supply a pre-resolved `isSpSecretariatOffice: boolean` parameter; the function cannot resolve this internally itself.
- This is the office-scoped check intended to replace `computePanelHint`'s current role-based proxy.

## Workflow Engine: `submitStepAction` and Outcome Handling

- File: `action.handler.ts`.
- `submitStepAction` is the shared engine primitive called by **both** `completeActionStep` and `approveStep`.
- **Confirmed defect / scoping fact — not previously documented anywhere**: `submitStepAction` **hardcodes `outcome: 'DONE'` in three separate locations**:
  - Line 50: `updateStepInstance(..., { outcome: 'DONE' })`.
  - Line 68: `payload.outcome: 'DONE'` (constructed separately for the event payload).
  - Line 79: `resolveNextStep(instance, updatedStepInstance, 'DONE', deps, trx)`.
- `submitStepAction`'s function signature does **not** take `outcome` as an explicit parameter at all — the hardcoded `'DONE'` value is used directly at each of the three call sites internally.
- **`resolveNextStep` itself is fully outcome-aware**: its signature (lines 24–27) takes an `outcome: string | null` parameter and feeds it into `evaluateTransitionRules`. Outcome-based branching capability genuinely exists in the engine at this layer.
- **Implication for implementation**: `submitStepAction` is structurally a single-outcome "step is done" primitive, suited to `generic_action`'s "complete this step" semantics — it is **not** suited as-is to a three-way decision (Approve/Reject/Amended) with different downstream consequences, since Reject should presumably terminate/redirect the workflow differently than Approve does (per ADR-API-003 line 31).
- **This means the fix is not a drop-in reuse of `submitStepAction` as-is.** Two viable implementation paths:
  1. Add an `outcome` parameter to `submitStepAction`, threading it through all three hardcoded sites. This is a **shared-engine-primitive change with blast radius** — it has two existing callers (`completeActionStep`, `approveStep`) whose current behavior must not regress.
  2. Build an adjacent/sibling handler function that performs the same role as `submitStepAction` but accepts and passes through a real outcome value, rather than modifying the shared primitive.
- This is a concrete, code-level scoping fact that materially changes what "wire it through the engine mechanism" means in practice; it is more precise than the vaguer framing "mirror completeActionStep/approveStep's internal use of submitStepAction" found in a prior handoff document.

## Frontend Test Coverage — Verified State

- **Not literally zero test files exist in `apps/web`** — a claim of "zero test files exist for any of this frontend work" is accurate specifically for the **workflow** frontend module, but not for `apps/web` as a whole.
- **Exactly one existing frontend unit test file**: `status-mapping.test.ts`.
- This file imports real project code and a real schema, confirming it runs against a working test configuration.
- **Confirmed: Vitest** is the unit-testing tool in use (not Jest).
- `vitest` is present as a **devDependency at v2.0.0**.
- **Gap, precisely stated**: there is **no `"test"` script** in `apps/web/package.json`'s `scripts` block — meaning the test runner is installed and one working example exists, but there is no wired-up command to run it at the package level.
- **No Playwright dependency exists anywhere in the repository** — confirmed via direct dependency search, not assumption. E2E testing has nothing set up, not even a dependency, which is a different-sized gap than "no unit test runner."
- This is a more precise picture than a flatter "zero test files exist" characterization: unit testing has the library and one working example but no run command; E2E has nothing at all.

## Frontend File Structure Verification

- All 10 workflow panel files, plus the shell component and the columns file, were confirmed to genuinely exist on disk, matching prior claims about the completed FE-002 scope.

## Discrepancies Found and Their Resolutions

| # | Claim | Resolution |
|---|---|---|
| 1 | "wf.md's TASK-WF-006 through TASK-WF-009 are done" seems inconsistent with wf.md going up to TASK-WF-025 | **Not a real discrepancy.** The claim is a correctly scoped statement about the step-handler layer specifically (WF-006–009), not about all of wf.md's 25 tasks. |
| 2 | A prior document claims "no standalone ADR-B2-3 document exists," but later in the same document quotes that exact file | **Resolved**: the file exists at `ADR-API-003-secretariat-decision-entry-point.md`. It is real, decided directly by the project owner, and B2 v1.1 fully and consistently reflects it. |
| 3 | Event name written as `workflow.step_completed` (underscore) in ADR-API-003/B2/E1 prose | **Resolved**: Corrected all documentation occurrences to use the literal dotted string `workflow.step.completed` to match the shipped code. |
| 4 | "Zero test files exist for any of this frontend work" | **True for workflow specifically**, but one frontend unit test (`status-mapping.test.ts`, Vitest) exists elsewhere in `apps/web`. Vitest is installed but has no `"test"` script wired into `package.json`. No Playwright dependency exists anywhere. |
| 5 | `submitStepAction`'s outcome handling was assumed to be a simple pass-through | **New finding**: hardcodes `'DONE'` in three places; not a drop-in reuse. Requires either a signature change to the shared primitive (with regression risk to two existing callers) or a new adjacent handler. |
| 6 | A prior document's "Resolution" section declared "no further input from Luke is needed to proceed" and treated ADR-API-003 as dispositive over the shipped code | **Process objection, not a factual one.** Per `AGENTS.md`'s three-tier hierarchy and §4.5, ADR-API-003 is a same-tier pre-dev document, not the consolidated reference — it does not automatically outrank shipped code or another same-tier document. An agent does not have the authority to declare this settled; that decision is reserved for a human. |
| 7 | LOG-0079 is tagged a "correction" | The `status: proposed` tag is correct, but the body's language asserts the ADR as settled fact and describes an F1 edit already made in that framing — this is the exact "just fix it because I'm confident" pattern `AGENTS.md` §4.5 warns against, even with the correct status tag. |

## Recommended Next Task: TASK-WF-FE-003 Scope

Two live, well-evidenced, non-domain-ambiguous gaps were identified as candidates:

- **(A) The `secretariat_decision` routing fix** — replace `documents.logSecretariatDecision` with a Workflow-Router-driven path per ADR-API-003, and swap `computePanelHint`'s role-based proxy for the office-scoped `canLogSecretariatDecision` check (currently unwired).
- **(B) Test coverage** — the concrete, unambiguous testing gap described above.

**Recommendation: (A) should be TASK-WF-FE-003, not (B).**

Rationale:
- (A) is the only item in this analysis with an **actual defect in production behavior right now** — false-success toasts fire on every Secretariat decision, because the mutation path being called is structurally unreachable/a no-op for the relevant step type, yet the UI presumably reports success.
- (A) has an **existing architectural answer already decided and documented** (ADR-API-003) sitting unused in the code.
- Bundling a test-coverage task with a routing rewrite is worse than sequencing them, since it would mean writing tests against a mutation path that is about to be deleted/replaced.
- **(B) should become TASK-WF-FE-004** once (A)'s new call path exists to test against — this sequencing should be stated explicitly in the handoff prompt so it is not lost.

## Process Rule for Documentation Corrections

- Per `AGENTS.md`, any correction to Group B–L pre-development documents (such as resolving the LOG-0079 framing issue, or reconciling F1 with ADR-API-003) must be **routed through a human first**, not folded into an implementation prompt as a same-agent afterthought.
- The doc-correction prompt (for the local agent to eventually execute) must be presented **separately** and only sent after human review/comfort with the framing — it is not part of the implementation prompt for the code task itself.