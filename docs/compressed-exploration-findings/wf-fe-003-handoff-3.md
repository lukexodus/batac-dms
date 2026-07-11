# `secretariat_decision` Routing Fix — Consolidated Technical Reference

## Task Scope

**In scope (Task A):** Replace `documents.logSecretariatDecision` with a Workflow-Router-driven mutation path per ADR-API-003, and replace `computePanelHint`'s current role-based proxy check with the office-scoped `canLogSecretariatDecision` check (currently defined but unwired/uncalled anywhere).

**Out of scope:**
- Test coverage for this path is a separate task (sequenced after this one), specifically so tests aren't written against a mutation about to be replaced.
- Any correction to Group B–L governance documents (e.g. reconciling F1 with ADR-API-003, fixing LOG-0079's framing) must be routed through a human directly and presented separately — not folded into this implementation as a same-agent afterthought. This is a process rule under `AGENTS.md` §4.5: ADR-API-003 is a same-tier pre-dev doc, not the consolidated reference, so no agent has authority to unilaterally declare it dispositive over shipped code or over F1. (Requesting Task A directly is treated as an effective human greenlight on the underlying architecture question, but the process point is still surfaced here rather than silently dropped.)

---

## Current (To-Be-Replaced) Behavior

### `documents.logSecretariatDecision`
**File:** `documents.router.ts`, lines 1508–1545.

Input schema (`LogSecretariatDecisionInputSchema`, in the shared schemas package) includes `documentId`, `decision` (`'approve' | 'reject' | 'amended'`), `remarks`, and **`stepInstanceId`** — but the handler body never reads `input.stepInstanceId`; only `input.documentId`, `input.decision`, and `input.remarks` are used. This "accepted in schema, never used in handler" pattern was independently confirmed from three sources (an earlier handoff doc's addendum, and direct reading of both schema and handler).

Per-branch behavior:
- **`approve`** branch: only fires a real state transition when `lifecycleState === 'submitted'` (line 1525–1528). This condition is **structurally unreachable** for the 12 in-progress-workflow steps assigned to `SP_SECRETARY`/`SECRETARIAT_STAFF`, because those steps only exist after the workflow has already left `'submitted'`.
- **`reject`** branch: gates on `lifecycleState === 'submitted'` OR `'in_workflow'` (line 1530).
- **`amended`** branch: **no gate at all** — pure log-only no-op (lines 1533–1535), doesn't even call `transitionState`. This has silently absorbed the fact that `'AMENDED'` has no corresponding seed-data outcome (see Gaps section below) — the old handler did nothing meaningful for it anyway, so the gap was never surfaced.

There is **no `workflow.step.completed` emission and no `stepInstanceId`-driven step advancement anywhere in this function's body** — confirmed by direct reading of the full function.

**Consequence (confirmed, not inferred):** `SecretariatDecisionPanel.tsx` line 19 fires `toast.success('Decision logged successfully.')` unconditionally in `onSuccess`. Since the mutation is a structural no-op for `amended` (always) and for `approve` (whenever lifecycle state isn't `'submitted'`), the user sees "success" while nothing advances the workflow step. This is a confirmed, load-bearing "false-success toast" bug, not a hypothesis.

### `SecretariatDecisionPanel.tsx`
- Already sends `stepInstanceId: instance.currentStepInstanceId` (line 33) and `documentId: instance.documentId` (line 32) at the call site — both IDs are already available from `instance` in the panel's scope, so the frontend request shape likely needs minimal change when new routing lands.
- Comment block at lines 7–11 documents the current rationale ("`config.assignee`, which is the only stable proxy available without an extra office-lookup join," referencing LOG-0077) — this is the exact comment described in a prior handoff doc, confirmed verbatim. **Once the fix lands, this comment becomes actively misleading** (it will describe the old approach as if it were deliberate final design) and should be updated as a loose-end cleanup item, similar in kind to a stale `hasRole` comment previously flagged in `MyAssignedStepsPage.tsx`.

### `computePanelHint`
**Signature:** `computePanelHint(status: string, currentStepType: string, currentStep: any, instance: any): string | null` — synchronous, pure function, no `ctx`, no async, no DB access.

Current `secretariat_decision` branch condition:
```
(currentStepType === 'action' || currentStepType === 'approval') 
  && (stepConfigAssignee === 'role:sp_secretary' || stepConfigAssignee === 'role:secretariat_staff')
```
This is the role-based proxy being replaced.

**Two call sites**, both must be patched identically:
1. `getInstance` procedure — `currentSteps` select at lines 284–291 selects exactly: `stepInstanceId, stepType, assignedTo, stepKey, metadata, config`. Return object has 10 fields: `instanceId, documentId, definitionVersionId, currentStepType, currentStepInstanceId, currentAssigneeUserId, status, slaDeadline, lapseStatus, panelHint`.
2. `getActiveInstanceForDocument` procedure (call site at line 464; procedure body visible from line 361) — a near-identical sibling with the **identical** `currentSteps` select shape and identical `computePanelHint` call, but the query is **duplicated per-procedure, not shared**. Consumed directly by `DocumentDetailPage.tsx` on the frontend (confirmed live, not dead code).

**Critical implementation risk:** because the query that gathers `currentStep` is duplicated (not shared) across these two procedures, patching only `getInstance`'s query and leaving `getActiveInstanceForDocument`'s query unpatched would cause `computePanelHint` to receive a `currentStep` object missing the new office field from the second call site only. This would produce an inconsistent/broken `secretariat_decision` hint depending on which procedure a given page happens to call — e.g. `DocumentDetailPage` showing a stale/wrong `panelHint` while `WorkflowStepActionPage` (which uses `getInstance`) shows the correct one. **Both procedures' queries must be updated identically.**

**Key gap confirmed:** `assignee_office_id` is not selected in either query today. This is the office-scoping column the new gate needs.

**Key fact already available:** `assignedTo` (the raw JSONB) **is already selected** in both queries' `currentSteps` select — this is the same field that `fetchStepContext` (see below) already extracts `office_id` from, using the shape `Array<{ user_id?: string; office_id?: string }>`. **This means neither query needs a new column/join added** — the office ID is already present in the data reaching `computePanelHint`; it just isn't being extracted from the JSONB or compared against the SP Secretariat office ID yet.

---

## `canLogSecretariatDecision` (Currently Unwired)

**Location:** policy file (exact file not restated here since it's directly locatable — see "policy file" in exploration notes).

Confirmed properties:
- **`void`-returning** (throw-on-deny), not a boolean-returning predicate. This matters for wiring: the coding agent should call it directly for its throwing side effect inside the mutation handler, not wrap it in an `if (!canLog...) throw` pattern.
- Docstring states the caller must supply `isSpSecretariatOffice: boolean`, computed conceptually as `step.assignee_office_id = SP_SECRETARIAT_OFFICE_ID` — i.e. a **pre-resolved boolean supplied by the caller**, not a self-resolving office lookup performed inside the guard function itself.
- Docstring explicitly states the office UUID is **seeded at runtime with office code `'SPS'`** — confirms there is a runtime-seeded office row with `code: 'SPS'`, and confirms this layer is deliberately DB-query-free; the caller must resolve the comparison before calling.
- Docstring explicitly states this function "Does NOT map to `recordVetoOverrideVote`."
- Docstring states the function is "Retained in case a future procedure needs step-and-office-scoped secretariat decision logging" — meaning it was written anticipating exactly this kind of fix. It should be treated as a **settled, authoritative signature**, not something to redesign.
- **Currently has zero call sites** anywhere in the codebase.

---

## Office Resolution: Existing Patterns and the Correct One to Use

### Precedent pattern (partially reusable, but not the correct comparison)
In `documents.router.ts`, immediately before `logSecretariatDecision` (around lines 1490–1491), an existing `isSp` computation does:
```
getOrgService(ctx).getOfficeByCode(SP_SECRETARIAT_OFFICE_CODE, subject.cityId)
```
This returns an office row (or null); `isSp` is then computed by checking whether that office's ID is in `subject.effectiveOfficeIds`.

**Important nuance:** this checks the **acting subject's own office membership**, not the **step's assignee office**. The new `secretariat_decision` gate needs a *different* comparison — it needs `step.assignee_office_id === SP_SECRETARIAT_OFFICE_ID`, i.e. compared against the step's assigned office, not the acting user's office memberships. This precedent is useful only for showing *how to resolve the SP Secretariat office's own ID*, not as a template for the actual comparison logic.

### `SP_SECRETARIAT_OFFICE_CODE` constant
- Value: `'SPS'` (matches the policy docstring exactly).
- **Locally redeclared per-file**, not imported from a shared constants location — separately defined in `tracking.router.ts` (line 82) and `documents.router.ts` (line 117), same literal value.
- `workflow.router.ts` currently has **none** of this machinery: no local constant, no `getOfficeByCode` call, no `getOrgService` import at all. This scaffolding must be introduced fresh into that file.
- Convention: the fix should follow the same local-redeclaration convention already established (or improving it into a shared constant is an optional, out-of-scope-unless-explicitly-asked judgment call — not something to assume).

### `getOrgService` accessor pattern
Established convention across the codebase: `ctx.req.server.<serviceName>` accessed via a small local `getXService(ctx)` factory function, repeated per-file (not shared). `workflow.router.ts` does not currently use this `ctx.req.server.xxx` accessor pattern at all.

### Policy guard accessor in `workflow.router.ts`
- There is **no instantiation of `WorkflowPolicyGuard`** anywhere in `workflow.router.ts`, and no real `guard.xxx()` calls — only a single stray comment (line 741) mentions `guard.`.
- The **actual accessor variable name is `workflowPolicy`**, not `guard`. (A grep for `guard\.` will miss this.)
- `canCompleteActionStep` / `canApproveStep` (the functions backing `submitStepAction`'s two working callers) are invoked via this `workflowPolicy` accessor — this is the real, confirmed call pattern to mirror for wiring in `canLogSecretariatDecision`.

### The correct mechanism: `fetchStepContext`
**`fetchStepContext(stepInstanceId, ctx)`** is the real, confirmed entry pattern used by both working sibling mutations (`completeActionStep`, `approveStep`). It returns `{ stepInstance, step, instance, stepAttrs }` in a single call (confirmed at the `completeActionStep` call site, lines 734/739).

Inside `fetchStepContext` (confirmed at lines 151–153 and 169–170): **`stepAttrs.assigneeOfficeId` is already extracted and present** on every call — pulled directly from `stepInstances.assignedTo`'s JSONB `office_id` field.

**This is the correct resolution mechanism for the mutation side.** The recommended pattern is:
```
isSpSecretariatOffice = (stepAttrs.assigneeOfficeId === <resolved SPS office ID>)
```
— resolve the SP Secretariat office's own ID once (via `getOfficeByCode('SPS', cityId)`, mirroring the `archive`-mutation pattern), then compare it against `stepAttrs.assigneeOfficeId` (already available from `fetchStepContext`, no extra join needed for this side of the comparison).

This distinguishes two separate needs that are frequently conflated:
- **Mutation side** (the gating check when a decision is actually submitted): office data is already available via `fetchStepContext` → `stepAttrs.assigneeOfficeId`. No new query machinery needed here beyond resolving the SPS office's own ID once.
- **Display side** (`computePanelHint` via `getInstance` / `getActiveInstanceForDocument`, which must decide what panel to show *before* any mutation attempt): the raw `assignedTo` JSONB is already selected in both queries, but the office ID is not yet being extracted from it or compared. The only genuinely new machinery needed here is: (a) extracting `office_id` from `currentStep.assignedTo[0]` the same way `fetchStepContext` does, and (b) resolving/knowing the SP Secretariat's office ID to compare against.

**Architectural tension to flag for the implementer (not resolved here — requires a design choice):** `computePanelHint` is synchronous and pure. Extracting `office_id` from JSONB is pure/sync and fine. But resolving the SP Secretariat's office *ID* requires an **async** DB call (`getOrgService(ctx).getOfficeByCode(...)`). This means either:
  - (a) `computePanelHint` becomes async, and both call sites (`getInstance` and `getActiveInstanceForDocument`) must `await` it, or
  - (b) the SP Secretariat office ID is resolved once by each caller procedure and passed in as an additional parameter to `computePanelHint`, changing its signature.

This affects a shared pure function's signature and both its callers — it is a design decision to be made explicitly, not something to decide unilaterally during implementation.

**Performance note (non-blocking):** `getOfficeByCode` has no caching — confirmed to be a plain DB query on every call. Not a blocker (existing `archive`/`publishPortal` mutations already pay this same per-request cost), but worth noting since `getInstance` is presumably a page-load-driving query called far more frequently than an occasional action like `archive`. Not worth over-engineering into a hard requirement; a judgment call for the implementer.

---

## `submitStepAction` — Hardcoded Outcome Sites

**File:** `action.handler.ts`.

Confirmed exactly: `submitStepAction` hardcodes the literal outcome `'DONE'` in **three internal sites**:
1. Line 50 — `updateStepInstance(..., { outcome: 'DONE' })`.
2. Line 68 — inside the `payload` object passed to `deps.workflowRepository.createWorkflowEvent(...)` (this call itself spans lines 57–73). This is a DB-persisted workflow event, written *inside the transaction*, inside `submitStepAction` itself.
3. Line 79 — `resolveNextStep(instance, updatedStepInstance, 'DONE', deps, trx)`.

**No `outcome` parameter exists on `submitStepAction`** — it cannot currently accept an arbitrary outcome value.

**Additional hardcoded site at the caller level (not inside `submitStepAction`):** `completeActionStep` (in `workflow.router.ts`, lines 769–784) runs `submitStepAction` inside `ctx.db.transaction(...)` (lines 756–765), and *after* the transaction commits, separately emits `server.eventBus.emit('workflow.step.completed', { ..., payload: { ..., outcome: 'DONE', ... } })` (line 780) — an **in-process event bus emission**, distinct from and in addition to the DB-persisted `createWorkflowEvent` call inside `submitStepAction`.

**Net conclusion:** there are two entirely separate event-recording mechanisms per call — (1) `workflowRepository.createWorkflowEvent` (DB-persisted, inside the transaction, inside `submitStepAction`), and (2) `server.eventBus.emit(...)` (in-process, outside the transaction, at the router/caller level). **Both currently hardcode `outcome: 'DONE'`.** This means fixing `submitStepAction`'s three internal sites is necessary but **not sufficient** — every calling mutation (`completeActionStep`, `approveStep`, and the new `secretariat_decision` mutation) must **also** independently pass the real outcome into its own router-level `eventBus.emit(...)` payload construction, or the emitted event will still misreport the outcome even after the internal fix.

Also noted: `nextStepType: null` appears in `completeActionStep`'s return (line 786) — part of the response contract shape a new mutation may need to mirror, though it's not yet confirmed whether the frontend actually consumes this field.

---

## `approveStep` / `submitStepApproval` — The Existing Outcome-Aware Pattern

**Correction to an earlier working assumption:** `approveStep` does **not** call `submitStepAction`. It calls a **different, sibling function**, `submitStepApproval` (in `approval.handler.ts`, definition starting at line 15).

`approveStep`'s own router-level event payload **already correctly sets `outcome: 'APPROVED'`** (line 859) — i.e. it is **already outcome-aware** at the router level, unlike `completeActionStep`.

**`submitStepApproval` is already the exact outcome-aware sibling primitive needed for a three-way Approve/Reject/Amended decision:**
- Takes `outcome: string` as an explicit parameter (line 15).
- Validates it against `config['allowed_outcomes']` (lines 37–40) — a **per-step configurable allow-list**, not a hardcoded enum.
- Threads the real outcome through all three of the equivalent places `submitStepAction` hardcodes: `updateStepInstance` (line 111), `createWorkflowEvent`'s payload (line 127), and `resolveNextStep` (line 137).

**Design implication:** the coding agent does not necessarily need to choose between "add an outcome parameter to `submitStepAction`" and "build a brand-new sibling handler" — a working, outcome-aware sibling (`submitStepApproval`) **already exists**. The real design question is whether `secretariat_decision`'s three-way decision should:
- **(a)** route through `submitStepApproval` directly, since it already handles arbitrary string outcomes gated by per-step `config['allowed_outcomes']`, or
- **(b)** use a new sibling function modeled on `submitStepApproval`'s pattern.

Both remain valid options; the choice depends on whether `secretariat_decision` steps are conceptually `approval`-type or `action`-type in the schema (see Gaps section — `computePanelHint`'s branch checks `currentStepType === 'action' || currentStepType === 'approval'`, meaning secretariat-decision-tagged steps could currently be either type, while `submitStepApproval` is presumably intended specifically for `approval`-type steps given its name and its relationship to `approveStep`).

---

## Confirmed Gap: `AMENDED` Outcome Has No Seed-Data Representation

Steps assigned to `ROLE.SP_SECRETARY` or `ROLE.SECRETARIAT_STAFF` (the exact set matching `computePanelHint`'s current detection rule) were checked directly against seed data. Several already have `allowed_outcomes` set to exactly `["APPROVED", "REJECTED"]` or `["APPROVED", "RETURNED_FOR_REVISION", "REJECTED"]` (e.g. at lines 79, 97, 368, 433 of the seed file), paired with `require_comment_on: ["REJECTED"]` — precisely the Approve/Reject(/Amended-shaped) config pattern `submitStepApproval` is built to consume.

**Confirmed absent:** the literal value `"AMENDED"` does **not appear anywhere** in the seed workflow file — not in any step's `allowed_outcomes`, and not anywhere else. This was directly verified (not inferred from a subset).

**This is a genuine, previously-undocumented, concrete gap:** the frontend `SecretariatDecisionPanel`'s "Amended" button, and the `decision: 'amended'` value in the current input schema, has **no corresponding `allowed_outcomes` value** in any seed-data step that `computePanelHint` currently routes to this panel.

**Why this matters concretely:** under the current handler, `'amended'` is simply a no-op (confirmed above), so this gap has been silently absorbed — nothing meaningful happens for it either way today. But if the new mutation routes through `submitStepApproval`-style outcome validation (`allowedOutcomes.includes(outcome)`, line 38 of `approval.handler.ts`), a submission mapping `'amended'` → `'AMENDED'` would **fail validation outright** for every one of these steps, since `'AMENDED'` isn't in any `allowed_outcomes` array.

**Resolution options (not decided here — this is a product/data-modeling decision, not a code decision):**
1. Map `'amended'` to a different, already-existing outcome string — `RETURNED_FOR_REVISION` (which does appear in seed data, e.g. line 79) is the most plausible existing candidate.
2. Add a genuinely new `AMENDED` outcome value to the relevant steps' seed data `allowed_outcomes` arrays.

This must be flagged prominently and resolved by a human/product decision before or during implementation — it is exactly the kind of "looks done, silently broken" risk this exploration was meant to catch, and failing to resolve it explicitly would reproduce the same class of bug the fix is meant to eliminate.

---

## Test Infrastructure (Context for Validation Section)

- Zero test files exist for the workflow module specifically.
- One Vitest unit test exists elsewhere in `apps/web`.
- Vitest is present as a devDependency but has **no wired `test` script**.
- No Playwright setup exists anywhere in the repository.
- Test coverage for this fix is explicitly a separate, later task, sequenced specifically so tests aren't written against a mutation path that's about to be replaced.

---

## Document Precedence Notes

Where multiple prior exploration documents existed on this topic, the most recent explicitly **supersedes** an earlier one on the following points, all confirmed by direct code verification during this pass:
1. An earlier document's claim that the `secretariat_decision` architecture question is "confirmed, not an open question" and needs no further human input was itself flagged (in the corrective document) as a process violation — an agent does not have authority to declare a same-tier pre-dev ADR dispositive over shipped code or governing docs; that is a human call.
2. An earlier framing that the fix is basically "mirror `completeActionStep`/`approveStep`'s internal use of `submitStepAction`" was corrected: `submitStepAction` hardcodes `'DONE'` and has no `outcome` parameter, so a three-way decision cannot drop into it unmodified. (This was subsequently refined further, per the `submitStepApproval` discovery above — the mirroring should likely target `submitStepApproval`, not `submitStepAction`.)
3. A claim that `submitStepAction` is "the shared engine primitive called by both `completeActionStep` and `approveStep`" is **not accurate** — `approveStep` calls the separate sibling `submitStepApproval`, not `submitStepAction`.
4. An earlier blanket claim of "zero test files exist" was refined to the precise picture given in the Test Infrastructure section above.
5. A separate, unrelated prior finding (about `panlalawigan_outcome` gating and a missing `stepInstances.status` select) is out of scope for this task but shares the same `computePanelHint`/`getInstance` code path — relevant only as background confirming the query-shape claims above, not as something this task needs to fix.

Earliest-generation background documents on this codebase (predating confirmation of related earlier tasks) are superseded on every point of overlap and should be treated as background-only where they conflict with more recent, directly-verified findings.