# Batac City LGU Platform — Frontend Workflow Task Exploration: Findings & Reference

## Scope and Context

This document consolidates a repository-exploration and validation pass performed on the Batac City LGU Platform (TypeScript monorepo: Fastify/tRPC/Drizzle/PostgreSQL) covering two frontend tasks defined in `docs/pre-development/A-project-planning/a1-tasks/fe.md`:

- **TASK-WF-FE-001**: `MyAssignedStepsPage` — a workflow inbox page.
- **TASK-WF-FE-002**: Three parts — (1) `organization.listCommittees` procedure, (2) a server-computed `panelHint` field on `workflow.getInstance`, (3) `WorkflowStepActionPage` with 10 panel components.

Both tasks were found to be **implemented**. The exploration verified implementation against specs, live code, seed data, and pre-development architecture docs (D3, E1, F1, ADRs), rather than trusting prior claims/handoffs at face value.

---

## Task A — TASK-WF-FE-001 (`MyAssignedStepsPage`) — Verification Result

**Spec summary**: Page at `/workflow/steps`, consuming `workflow.listMyAssignedSteps`, role-gated to a 10-role list, using `cursorHistory`-stack pagination (copied from `DocumentListPage` pattern), a new `StepTypeBadge` label component (not reusing `WorkflowStepIndicator`), row-links keyed on `instanceId` per **ADR-UI-010**.

**Verification outcome: fully confirmed, no defects.**

- `listMyAssignedSteps`'s real role gate (10 roles: `dept_encoder, dept_approver, sp_secretary, sp_member, sp_presiding_officer, mayor, brgy_encoder, brgy_captain, records_officer, auditor`) matches `MyAssignedStepsPage.tsx`'s `PAGE_ALLOWED_ROLES` array exactly.
- `columns.tsx` correctly row-links via `instanceId` (matches ADR-UI-010), uses `RouterOutputs`-derived typing, implements `StepTypeBadge` matching the `StatusBadge` pattern (typed prop → lookup object → styled span, returns `null` if unmapped), and adds an (not spec-required, low-risk) overdue-highlighting touch on the `dueAt` column.
- Route registration confirmed in `main.tsx` (lines 14–15, 43, 47).
- Corresponding findings-log entry `LOG-0071` correctly cited for the `StepTypeBadge` label decision.
- **Minor issue (cosmetic only)**: `MyAssignedStepsPage.tsx` lines 20–24 retain a stale comment claiming `hasRole` is "not yet extracted to a shared location. Copied locally here" — but the code on the next line actually imports it from the shared `auth-helpers.ts`. The comment is leftover from before the FE-002 Part 3 extraction happened. Not a functional bug; a one-line comment fix.

---

## Task B — TASK-WF-FE-002 — Verification Results by Part

### Part 1: `organization.listCommittees`

**Status**: Implemented, matches spec closely, one minor divergence.

- Location: `apps/server/src/modules/organization/organization.router.ts` lines 567–579.
- Role gate: exactly `['plat_admin', 'sp_secretary']` via `requireAnyRole` — matches **ADR-UI-004**'s minimum exactly; correctly omits an `[Inference]`-flagged `sp_member` option.
- Input: no-arg query (no `.input(...)` at all) — even more minimal than the spec's suggested `z.object({}).optional()`, functionally equivalent.
- Output mapping verified against real schema (`packages/database/schema/organization.schema.ts` lines 272–292): `id→committeeId`, `name`, `code`, `description`, `deletedAt` are all real columns, not invented.
- **Gap**: ADR-UI-004 (line 19) asked for output to include "active status." The implementation returns raw `deletedAt` (timestamp | null) instead of a derived boolean `active`/`isActive` field. Low-impact today because `findAll` defaults to `includeDeleted: false`, so every returned row already has `deletedAt: null`. The only live consumer, `MultiReferralPanel.tsx` (lines 38, 81), only reads `committeeId`/`name` and doesn't need this field. Will matter when a future `/admin/committees` page (F1 §12.2, unbuilt) needs to show inactive committees too — that consumer would need to derive its own boolean rather than reading one directly.

### Part 2: `panelHint` on `workflow.getInstance`

`panelHint` is computed via `computePanelHint` (`apps/server/src/modules/workflow/workflow.router.ts`), called at two call sites (lines 344 and 464 as of final verification — the second call site's context/procedure was not yet identified when exploration ended). All 10 detection rules were checked:

| panelHint value | Detection rule | Verification status |
|---|---|---|
| `multi_referral` | `currentStepType === 'multi_referral'` | ✅ Matches spec exactly |
| `vp_certification` | `stepKey === 'vp_certification'` | ✅ Matches spec exactly |
| `mayor_decision` / `mayor_lapse_confirmation` | `stepKey === 'mayor_review' \|\| stepKey === 'mayor_signature'`, then checks `mayor_action_deadline` present AND `Date.now() > deadline` AND lapse not yet confirmed → `mayor_lapse_confirmation`, else `mayor_decision` | ✅ Correctly implemented — see detail below |
| `veto_override_recording` | `stepKey === 'veto_override_vote'` | ✅ Matches seed data (line 136) |
| `docketing` | `stepKey === 'docketing'` | ✅ Matches seed data (line 145) |
| `panlalawigan_outcome` | `stepKey === 'panlalawigan_review'` | ⚠️ Missing step-status gate — see Finding below |
| `publication_date` | `stepKey === 'newspaper_publication'` | ✅ Matches seed data (line 389) |
| `secretariat_decision` | `stepConfigAssignee === 'role:sp_secretary' \|\| stepConfigAssignee === 'role:secretariat_staff'` | ❌ **Significantly over-broad** — see major finding below |

**Note**: `docketing` and `veto_override_recording` have **zero server-side stepKey enforcement** at the mutation layer — `computePanelHint`'s correctness for these two *is* the safety property. Both verified correct.

#### Mayor decision / lapse confirmation — detailed lifecycle (fully verified, no bug)

- Scheduler job (`evaluate-mayor-lapse-timers.ts`, line 45) fires when `now.getTime() > deadline.getTime()`. On firing, it sets `stepInstance.outcome = 'LAPSED'` (line 65) and calls `resolveNextStep` (line 103) **inside the same DB transaction** (`runInTransaction`) — meaning the step instance advances/transitions to the next step atomically as part of lapse execution.
- `mayor_action_deadline` is written exactly once, at `context-writer.ts` line 40 (when the mayor-review step begins), read three times (scheduler job, `computePanelHint`, `logMayorLapseConfirmation`), and **never deleted or overwritten anywhere** — it persists forever once set for the life of the instance.
- `logMayorLapseConfirmation` (`workflow.router.ts` lines 1514–1603) is a *separate*, human-driven confirmation (SP Secretary manually acknowledges the lapse), setting `lapse_confirmed_at` in step metadata purely for audit-trail/idempotency — not a precondition the scheduler waits on. Its own comment (lines 1536–1539) distinguishes this from "the scheduler-set status."
- **Practical consequence**: the `mayor_lapse_confirmation` panel view is only reachable in the narrow real-world window between the deadline passing and the scheduler's next tick — not a long-lived state. This is expected/correct design, not a bug.
- The theoretical concern that a stale `mayor_action_deadline` (never cleared) could cause a false-positive after the workflow has moved past mayor review is **ruled out**: `computePanelHint`'s branch is already scoped by the outer `stepKey === 'mayor_review' || 'mayor_signature'` check, which stops matching once the workflow advances past that step, regardless of what's in `instance.context`.

#### `panlalawigan_outcome` — missing step-status gate (real, low-severity finding)

- `canLogPanlalawiganAction` (`workflow.policy.ts` lines 613–635) enforces three conditions server-side: role, `stepKey === 'panlalawigan_review'`, AND `stepStatus` in `('pending', 'active')`.
- `computePanelHint` (lines 226–227) only checks `stepKey` — no step-status equivalent — because `getInstance`'s underlying query (lines 283–301) doesn't select `stepInstances.status` at all, only `stepInstanceId, stepType, assignedTo, stepKey, metadata, config`.
- The spec explicitly asked the implementing agent to "make an explicit choice and note it" on this point; no findings-log entry addresses it (confirmed via grep).
- **Exposure window is narrow**: because `getInstance` orders by `desc(stepInstances.createdAt) LIMIT 1`, a step instance whose status has moved past `pending`/`active` would typically only remain "the current step" briefly, right around a mutation firing — not a persistent wrong-panel state.
- Comparison: `canCompleteActionStep`/`canApproveStep` (the generic panels' policy functions) **both** gate on `stepStatus ∈ {'pending','active'}` server-side (lines 272–273, 347–348) — confirming that `panlalawigan_outcome`'s missing gate is an outlier, not the general pattern.
- **Recommended fix**: select `stepInstances.status` alongside the other already-selected columns in `getInstance`'s query, and add the same `('pending','active')` check to the `panlalawigan_review` branch in `computePanelHint`. Straightforward code fix, not a domain decision.


- **ADR-B2-3 (ADR-API-003) exists in the repository** at `docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-003-secretariat-decision-entry-point.md` and contains the resolved routing design.

### Part 3: `WorkflowStepActionPage` and 10 panels

**Status**: Route registered at `/workflow/steps/:instanceId`; all 10 panel components exist under `panels/` subdirectory (`generic_action`, `generic_approval`, `secretariat_decision`, `vp_certification`, `mayor_decision`, `mayor_lapse_confirmation`, `veto_override_recording`, `multi_referral`, `docketing`, `panlalawigan_outcome`, `publication_date`).

#### Shell page structure
`WorkflowStepActionPage.tsx`'s switch statement handles all 10 `panelHint` values plus a null/no-panel/no-access fallthrough — the `break` when `!canAct` correctly falls through to a shared read-only card rather than a blank panel, matching the spec's requirement for "a role with page-read access but no panel-act access" as a real, expected state.

#### Per-panel role gating — verified against server policy

| Panel(s) | Frontend gate | Server policy function | Verified |
|---|---|---|---|
| `generic_action` | `dept_encoder, dept_approver, sp_secretary, sp_presiding_officer, mayor, brgy_encoder, brgy_captain` | `ACTION_STEP_ROLES` via `canCompleteActionStep` | ✅ Exact match |
| `generic_approval` | `dept_approver, sp_secretary, mayor, brgy_captain` | `APPROVAL_STEP_ROLES` via `canApproveStep` | ✅ Exact match |
| `mayor_lapse_confirmation`, `docketing`, `veto_override_recording`, `publication_date` | `sp_secretary`-only (lines 71, 87, 95, 103) | `canLogSpSecretaryAction` (lines 671–678) — docstring explicitly enumerates all four as intended callers | ✅ Exact match |
| `multi_referral` | `sp_secretary, sp_member` | `submitCommitteeReport`'s gate: "committee-scoped `sp_member`, or `sp_secretary`" (line 1026) | ✅ Exact match |

**Important architectural note (not a bug)**: `canCompleteActionStep`/`canApproveStep` layer an *additional* assignment/office-scoped gate on top of the role check (direct assignee, or document-author for encoder roles, or office-match for others) — an "ENCODER RESTRICTION" that blocks `dept_encoder`/`brgy_encoder` from claiming general office-queue steps. The frontend's `canAct` is role-only by design and cannot/should not replicate this finer-grained check — this is the same two-layer ABAC pattern the spec required for the Task A inbox page ("frontend must not re-implement filtering"). Practical effect: a role-eligible user might see a panel that later returns `FORBIDDEN` on submit — a UX gap, not a security gap, since the server still correctly blocks it.

#### Individual panel verification notes

- **`MayorDecisionPanel`**: `mayorSign` input schema = `{ stepInstanceId }`; `mayorVeto` input schema = `{ stepInstanceId, objectionsText: min(1) }` — both match the panel exactly. Server also supports **delegation**: the mayor can act "via active delegation," not just as direct assignee (lines 1384–1395) — a real, non-obvious server-side authorization path invisible to the frontend (neither the panel nor `computePanelHint` account for it), but this is purely a server-side detail that doesn't change what panel renders or what fields are needed — not a defect.
- **`VetoOverrideRecordingPanel`**: comment claiming the 8-of-12 vote threshold is "hardcoded server-side too" — confirmed accurate; `recordVetoOverrideVote` line 1625: `input.votesFor >= 8`. Input schema (`votesFor`/`votesAgainst`: min(0).max(12), `absentCouncilorIds`: array of uuid) matches exactly.
- **`PublicationDatePanel`**: comment claiming "Publication defaults to Ilocos Times unless changed on the server" — confirmed accurate; `recordNewspaperPublicationDate` line 2081: `z.string().default('Ilocos Times')`.
- **`PanlalawiganOutcomePanel`**: correctly implements all three mutations (`recordPanlalawiganOutcome`, `resolveValidInPart`, `confirmPanlalawiganDeemedApproved`). Correctly catches a non-obvious asymmetry: `resolveValidInPart` takes `documentId` (not `stepInstanceId`, unlike siblings) — verified against real input schema (`workflow.router.ts` lines 1841–1853: `{ documentId, resolutionPath (4-value enum), mandatoryComment (min 1) }`); the component's own comment (lines 10–12) documents this distinction, and line 111 correctly passes `instance.documentId`.
- **`SecretariatDecisionPanel`**: no additional narrowing logic beyond `panelHint === 'secretariat_decision'` — fires unconditionally per the over-broad server rule (see major finding above). Comment block (lines 7–11) documents the implementing agent's awareness: "config.assignee, which is the only stable proxy available without an extra office-lookup join," referencing `LOG-0077`.
- **`MultiReferralPanel`**: imports `hasRole` from the shared `@/lib/auth-helpers` (confirms extraction happened). Only reads `committeeId`/`name` from `listCommittees` output. Minor scope note: `reportAttachmentS3Key` (optional field in schema) is never sent by the panel (`submitReportMutation.mutate({ stepInstanceId, committeeId, reportText })`) — not a defect (field is optional), but the panel has no file-attachment UI for committee reports at all; a legitimate candidate for a future task.

#### Shared `hasRole` extraction

- `apps/web/src/lib/auth-helpers.ts` exists (3 lines), exports `hasRole(roles, ...allowed)` matching spec.
- All three real consumers correctly import from the shared file: `DocumentDetailPage.tsx` (line 65), `MyAssignedStepsPage.tsx` (line 17), `MultiReferralPanel.tsx`/`WorkflowStepActionPage.tsx`. Extraction was done cleanly and consistently across all consumers.
- Only loose end: the stale comment in `MyAssignedStepsPage.tsx` noted above.

---

## Test Coverage

**Zero test files exist** for any of this frontend work — no unit tests for pages/panels/columns, no Playwright E2E coverage. The spec's "VALIDATION / TESTING REQUIREMENTS" section (10 panelHint values render correctly, role-gating denies appropriately per-panel, negative test cases, dead-link resolution check) has **not been executed or codified as tests** — only manually described as requirements in fe.md. This is a concrete gap for the next task to address.

---

## Documentation Discrepancies (Pre-Development Docs)

### `AGENTS.md` path is wrong in both task specs
- Both TASK-WF-FE-001 and TASK-WF-FE-002 instruct "Read `docs/AGENTS.md` before doing anything else" — this path does not exist.
- The real file is at the **repository root**: `./AGENTS.md` (221 lines).
- Low severity — any competent agent finds it on a basic file search — but worth fixing in future task-prompt templates.
- **Substantive content of `AGENTS.md`** relevant to process:
  - Section 1 (lines 23–41): pre-development documents (F1, E1, etc.) are explicitly **downstream of and can be wrong relative to** `docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md`. Conflicts should be flagged, not silently resolved.
  - Section 4.5 (lines 141–177): agents may only **append** findings-log entries — never directly edit F1/E1/etc. Every agent-added entry is `status: proposed` by design; a human must promote it to `confirmed`. This explains why `LOG-0078` and similar entries show `status: proposed` — expected process, not a red flag.
  - Routing table confirms: "Build a frontend page or view in `/apps/web`" → F4 → F1 → F5 → J6 → I2 → E1. Secondary row for backend touches: "Write a tRPC procedure or router" → E1 → I1 → I2.
  - **Process implication**: per this file's own rule, documentation corrections arising from A1-execution findings should flow through a findings-log entry → human review → human-authorized doc edit — not be directly edited by an agent as a routine action. Direct-edit prompts should be framed as something a human is explicitly choosing to authorize.

### F1 §8.2 — three genuine, unaddressed documentation gaps
(Distinguished from `LOG-0072`'s actual, narrower, already-completed scope — see below.)

1. **Intro sentence still says `step.name`**: "The page renders one of the following panels conditionally, based on `currentStepType` and `step.name` from the loaded instance" — not corrected to `step.stepKey`.
2. **Secretariat Decision Panel row's "Applies when" column still reads "the assignee office is the SP Secretariat"** — this is the exact wording fe.md's own Part 2 spec flagged as not matching the actual backend (which checks role only, not office). No reference to the real `[Inference]`-flagged detection rule now implemented (`LOG-0078`) or to its breadth problem.
3. **`panelHint` is referenced zero times in either F1 or E1** — despite being the actual, shipped field now driving all panel selection. E1's documented `workflow.getInstance` output schema (`e1-trpc-router-and-procedure-catalog.md` line 889) lists 9 fields; the real, shipped output has 10 (missing `panelHint`). This schema is stale and misleading to anyone treating it as ground truth.

**Important clarification on scope**: `LOG-0072` (`docs/development-findings-log.md` lines 1728–1744) documents a correction that was scoped **only** to 4 table rows (VP Certification, Mayor Decision, Docketing, Panlalawigan Outcome) receiving `step.name`→`step.stepKey` replacement, plus the Docketing row's `[Inference]`→`[Confirmed]` tag update. This scope was **fully and correctly executed** — verified directly against the live document. The three gaps above were **never part of `LOG-0072`'s scope** — they are freshly-identified gaps, not incompletely-executed prior work. (An earlier characterization of these as "partial execution of the correction prompt" was incorrect and should be treated as superseded by this framing.)

### Findings-log housekeeping facts
- The log has a genuine numbering gap: `LOG-0073` through `LOG-0075` do not exist under any heading format (confirmed via grep) — not a defect, just a fact. **Next available number: `LOG-0079`.**
- `LOG-0069`: `status: confirmed` (verified).
- `LOG-0070`: `status: proposed`, **not** `confirmed`. Note: fe.md's own NON-GOALS section describes this as "already resolved... no action needed" — this is fe.md's casual usage meaning "the code changes were made," distinct from the formal `status: proposed` field meaning "awaiting human confirmation." Not a functional bug, but a semantic precision point.
- `LOG-0076` (lines 1746–1759): documents the `publication_date` panel's stepKey-vs-domain-condition mapping — matches independent verification against seed data.
- `LOG-0077`: documents the `panelHint` field addition itself.
- `LOG-0078` (lines 1778–1791): the `secretariat_decision` `[Inference]` detection-rule reasoning (see major finding above).

---

## Domain/Schema Reference Facts

- **`documents.lifecycleState`** is a real column on the `documents` table (not `instances`), an 11-value state machine: `draft`, `submitted`, `in_workflow`, `pending_mayor_action`, `pending_panlalawigan_review`, `completed`, `released`, `archived`, `disposed`, `cancelled`, `superseded`.
- `workflow.getInstance` does **not** currently join/expose `documents.lifecycleState` — it only does a lighter existence-check join on `documents.id`, not a full row select (as of the query at lines ~250–301).
- `fetchStepContext` (a different function, used elsewhere in the same router file) **already joins** `documents` and would give access to `doc.lifecycleState` directly (referenced around lines 130/135) — meaning if `getInstance` needed to expose `lifecycleState`, there's already a proven pattern in the same file to mirror (`getInstance` would need to select `documents.lifecycleState` alongside its existing columns, following `fetchStepContext`'s approach).
- **`stepInstances.status`** enum has 7 values; defaults to `'pending'` (schema line 351).
- **`ROLE.SP_SECRETARY`** = `'role:sp_secretary'`; **`ROLE.SECRETARIAT_STAFF`** = `'role:secretariat_staff'` — matching `computePanelHint`'s literal string comparisons exactly.
- **D3 state machine** (`d3-state-machine-diagrams.md` line 111): `Submitted` documents have "no QR code, no preliminary number, no workflow instance." Transition `Submitted → In-Workflow` (line 129) fires on event `WORKFLOW_INITIATED`, condition: "Secretariat staff completes formal intake action."
- Seed workflow definitions live at `packages/database/src/seeds/workflow/phase1-legislative.ts`; `intake_logging` is the `is_start: true` step (line 36–44), `stepType: 'action'`, assignee `SECRETARIAT_STAFF`.
- `documentRequests` module (the `rec` module) is a separate, Phase-1-stub feature with no backend yet, tracked under its own unassigned future task number `TASK-WF-NNN` — confirmed unrelated to and non-colliding with `WorkflowStepActionPage` or any next workflow-frontend task's scope.

---

## Resolution: `secretariat_decision` panelHint — Architecturally Confirmed, Not an Open Question

**This is no longer an open question requiring domain input — it is resolved by ADR-B2-3, a standalone architecture decision record that exists in the repository at `docs/pre-development/B-architecture-documents/b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-003-secretariat-decision-entry-point.md`, corroborated by I1 §6.8 (ABAC policy) and Part 11.4 of the consolidated architecture reference.**

### The answer: "Secretariat decision" is not one narrow step — it's a category, and the fix is routing + gating, not retirement

- **ADR-B2-3** (Status: Accepted, June 2026, decided by Luke) confirms the Secretariat's Approve/Reject/Amended action applies to **any `action`- or `approval`-type workflow step** meeting an ABAC condition — not a single reserved step. Phase 1's step-type taxonomy (`action`, `approval`, `multi_referral`, `decision`, `notification`, `termination` — confirmed in B2 Module 4) has no dedicated "secretariat_decision" step type; there was never meant to be one narrow step to identify.
- Part 11.4 of the consolidated reference corroborates this in plain language: *"For Ordinances, Resolutions, and Appropriation Ordinances, the Secretariat explicitly logs approval decisions via UI action buttons: 'Approve,' 'Reject,' or 'Amended.'"* — worded generally across document types and steps, not scoped to intake alone.
- **What ADR-B2-3 actually changed is the *entry point/mechanism*, not the *scope*.** Pre-ADR design: Documents Router recorded the decision → emitted `document.secretariat_decision` (now **removed** from B2/B3's event taxonomy, confirmed at B3 §6.4) → Workflow's async event consumer advanced the step. Post-ADR design: the Secretariat submits the decision **directly to the Workflow Router**, which synchronously calls `Documents.transitionState()` as part of one atomic operation, then emits `workflow.step.completed` (`outcome: 'APPROVED'|'REJECTED'|'AMENDED'`). The change was made specifically for **atomicity** — B2's own sync/async decision rule flags "document state transition driven by workflow" as requiring a synchronous path; the old async design created a drift window where a decision could be "recorded" while the corresponding workflow step silently failed to advance.
- **The correct ABAC rule** (I1 §6.8, `[Confirmed — I2 Section 6; Part 11.4]`):
  ```
  step_instance:log_secretariat_decision
    (action codes: 'approve', 'reject', 'amended')

  ALLOW IF:
    subject.roles CONTAINS 'sp_secretary'
    AND step.step_type IN ('action', 'approval')
    AND step.assignee_office_id = SP_SECRETARIAT_OFFICE_ID
  ```
  This is **office-scoped** (`step.assignee_office_id = SP_SECRETARIAT_OFFICE_ID`), not the role-based proxy (`config.assignee === 'role:sp_secretary' || 'role:secretariat_staff'`) that `computePanelHint` currently implements.

### Reframing the two defects previously identified

1. **Wrong entry point/mechanism (confirmed defect)**: `documents.logSecretariatDecision` is the pre-ADR-B2-3 code path (Documents Router, gated on `lifecycleState === 'submitted'`), which ADR-B2-3 explicitly superseded and which E1 correctly flags as `[Routing superseded by ADR-B2-3]`. It should be retired. The Secretariat's decision should route through the Workflow Router's step-completion mechanism — the same internal `submitStepAction` path that `completeActionStep`/`approveStep` already use for `generic_action`/`generic_approval`.
2. **Wrong gating condition (confirmed defect)**: `computePanelHint`'s role-based proxy over-fires (matches 12 steps, including many with no real Secretariat-office-decision character) because it approximates office-scoping with a role check. The already-built-but-unused `canLogSecretariatDecision` function in `workflow.policy.ts` implements the correct, office-scoped check and should be wired in.

### What this means for implementation — no longer conditional on a domain decision

The `secretariat_decision` panel should **not** be retired or folded into `generic_action`. It represents a real, intentional, office-scoped variant of step completion, distinct from the generic role-only gates on `generic_action`/`generic_approval`. The corrected implementation should:

- Replace the `documents.logSecretariatDecision` mutation call with a call through the Workflow Router's step-completion mechanism (mirroring `completeActionStep`/`approveStep`'s internal use of `submitStepAction`), so the action is atomic with the document state transition and emits `workflow.step.completed` rather than the now-removed `document.secretariat_decision`.
- Replace `computePanelHint`'s role-based detection rule with an office-scoped check reflecting `step.assignee_office_id = SP_SECRETARIAT_OFFICE_ID`, using the existing `canLogSecretariatDecision` policy function as the server-side gate instead of the inline role check `documents.logSecretariatDecision` currently uses.
- This will likely still match a broad set of steps (potentially most or all of the 12 originally found) — that breadth is expected and correct once the underlying office-scoping and atomic routing are fixed, not a symptom to eliminate.

No further input from Luke is needed to proceed — ADR-B2-3, B3 §6.4, and I1 §6.8 together fully resolve what was previously flagged as a blocking domain question. The remaining work is a well-defined code-correction task (fix routing mechanism + fix gating condition to match the documented ABAC rule), not a product/architecture judgment call.