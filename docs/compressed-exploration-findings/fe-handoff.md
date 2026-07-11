## Handoff: Workflow module frontend — state after TASK-WF-FE-001

### Module status
All eight backend/component modules (`iam`, `org`, `docs`, `track`, `audit`, `infra`, `ui`, `wf`) are finished on the backend side. On the frontend, the DOCS module pages are built (TASK-DOCS-020/021/022/023 — tRPC client+List, Intake, Detail). `rec`, `notif`, and `portal` have no backend yet — any frontend pieces for those should be built with disabled states, but they are not otherwise relevant to workflow-module work.

TASK-WF-FE-001 (`MyAssignedStepsPage`, route `/workflow/steps`) is built. It is a task-inbox page: one row per workflow step assigned to the logged-in user, using `workflow.listMyAssignedSteps`, linking each row to `/workflow/steps/:instanceId`.

**Task B (DONE):** `/workflow/steps/:instanceId` (`WorkflowStepActionPage`), the richer role-conditional action panel. It depends on rows carrying both `instanceId` and `stepInstanceId` (Task A's rows already carry both). Task B's full panel spec — Generic Action/Approval, VP Certification, Mayor Decision, Mayor Lapse Confirmation, Veto Override, Multi-Referral, Secretariat Decision, Docketing, Panlalawigan Outcome, Publication Date — is documented at `docs/pre-development/F-frontend-architecture/f1-application-route-map-v2.md`, lines 341–365 (§8.2).



### Data contract (`workflow.listMyAssignedSteps`)
`apps/server/src/modules/workflow/workflow.router.ts`:

- **Input** (shared `paginationInput`, lines 35–38): `{ cursor?: string | null, limit: number (1–100, default 50) }`
- **Output** (lines 513–541): 
  ```
  {
    items: Array<{
      stepInstanceId: string;
      instanceId: string;
      documentId: string;
      documentTitle: string;
      stepType: 'action' | 'approval' | 'multi_referral' | 'decision' | 'notification' | 'termination';
      assignedAt: Date;
      dueAt: Date | null;
    }>;
    nextCursor: string | null;
  }
  ```
- All ABAC/visibility filtering (own-user, own-office, SP-office, senior-role unconditional visibility) is server-side (lines 461–506). The frontend must not re-implement any of it.
- `stepType` is defensively coerced to `'action'` server-side if it doesn't match the known set (lines 522–524) — no frontend fallback needed.
- Pagination `cursor` is a numeric-string **offset** into an in-memory-filtered array (lines 508–511), not a stable DB cursor — new rows inserted between requests can shift indices. This is a backend characteristic, not something to fix from the frontend. Same shape as `documents.list`.

### Routing key — settled (ADR-UI-010)
`/workflow/steps/:instanceId` is keyed on **`instanceId`**, not `stepInstanceId`, because `workflow.getInstance` (Task B's loader) takes `instanceId` and returns `currentStepInstanceId`/`currentStepType` from it. `stepInstanceId` is carried in Task A's row data for Task B to consume later — Task A itself ignores it for routing.

Reference: `docs/pre-development/F-frontend-architecture/f1-application-route-map-adrs/ADR-UI-010-workflow-step-route-key.md`.

### Frontend conventions in this codebase (for Task B and beyond)
- tRPC client, auth, query client: `apps/web/src/lib/trpc.ts`, `apps/web/src/lib/auth-context.tsx`, `apps/web/src/lib/query-client.ts`.
- Closest analogs for page structure: `apps/web/src/pages/documents/DocumentListPage.tsx` (paginated, role-scoped list) and `DocumentDetailPage.tsx` (per-action role gating via a local `hasRole(roles, ...allowed)` helper — relevant to Task B, which will likely need several fine-grained per-action gates the way DocumentDetailPage does, unlike Task A's single page-level gate).
- `StatusBadge`, `WorkflowStepIndicator` — `packages/ui/src/components/domain/`. Note: `WorkflowStepIndicator` renders a full document's step sequence (props: `steps`, `currentStepId`) for a detail view — not a per-row label. It was not reusable for Task A's inbox rows; may or may not be relevant for Task B's detail view, worth checking against its actual shape before assuming either way.
- Route registration: `apps/web/src/main.tsx`. No role-guarding wrapper exists at the router level for any route — gating is each page's own internal responsibility.
- Type derivation: use router-inferred types via `RouterOutputs`, not hand-typed shapes (pattern already used in `apps/web/src/pages/documents/columns.tsx`).
- `@batac/ui` barrel exports `DocumentState`/`STATUS_META` — import from there if ever needed rather than redeclaring locally (a real bug elsewhere, `apps/web/src/lib/status-mapping.ts`, exists because of exactly that mistake — being fixed separately, not in scope here).

### Open items worth checking before/during Task B
- Whether a `useWorkflow`-style hook file exists yet (did not exist as of Task A).
- Whether Task B needs a shared `hasRole` helper (currently only exists as a local copy in `DocumentDetailPage.tsx`) — a second real consumer (Task B) is a natural point to extract it to something like `apps/web/src/lib/auth-helpers.ts`, if that seems warranted once you're in the code.
- Two other not-yet-built dashboard pages (`SecretaryDashboardPage`'s "Queue" widget, `MayorDashboardPage`) are documented (F4, lines 356–364 and 397–402) as potential future consumers of `listMyAssignedSteps` with a mayor-action-specific filter. That filter parameter does not exist server-side today (input schema is cursor/limit only). Not required for Task B, but keep in mind if it affects how reusable any shared query hook should be.

# Handoff Addendum — Session 2 (TASK-WF-FE-002 exploration and spec)

## Status correction — Task A

TASK-WF-FE-001 has since been genuinely implemented and verified line-by-line: `apps/web/src/pages/workflow/MyAssignedStepsPage.tsx` and `columns.tsx` exist, the route is registered in `main.tsx` (line 42, named import matching `DocumentListPage`'s style), role gate uses the confirmed 10-role list, row-linking uses `instanceId` per ADR-UI-010. No outstanding issues from Task A remain unaddressed. Do not re-verify this from scratch; the above is a direct read, not an inference.

## Role list — now fully resolved, not just "use the code"

The original handoff's "Role list — confirmed conflict" section is now stale in a good way. LOG-0069 (`docs/development-findings-log.md`, lines 1633–1652) is `status: confirmed` — a human decided `auditor` should have task-inbox visibility, and the three previously-conflicting documents have been edited to match: F1 line 337, E1 line 912, I2 lines 68/336. I verified all three edits landed exactly as the log entry claims. **Nothing further to do here** — this is fully closed, not merely "known and being tracked."

## New findings — enforcement asymmetry across panels

Worth carrying forward because it affects how much weight the frontend's own panel-routing correctness carries, and a future task touching any of these procedures should know this going in:

- **Server-enforced against wrong-step calls:** VP Certification (`certifyAsPresidingOfficer`, line 1233, checks `stepKey !== 'vp_certification'`), Mayor Decision (`mayorSign`/`mayorVeto`, lines 1308/1388, check `stepKey` against `{'mayor_review','mayor_signature'}`), Panlalawigan Outcome (`canLogPanlalawiganAction` in `workflow.policy.ts`, line 621, checks `stepKey !== 'panlalawigan_review'`).
- **Not server-enforced at all — role check only, no stepKey comparison:** Docketing (`logDocketingCompletion`, lines 1631–1689) and Veto Override Recording (`recordVetoOverrideVote`, lines 1547–1629). For these two, correct frontend panel-routing is a genuine safety property, not just UX — a routing bug could let an SP Secretary fire the wrong mutation against the wrong step with nothing backend-side stopping it.
- `documents.logSecretariatDecision` (`documents.router.ts`, lines 1508–1545) accepts `stepInstanceId` in its input schema but never references it in the handler body — confirmed, not a red herring. Send it anyway per schema; don't treat the apparent non-use as license to omit it.
- `mayor_signature` as a `stepKey` value exists only in code-side allow-lists (`workflow.router.ts` lines 1308/1388, `workflow.policy.ts` line 147) — never in seed data. Support it in any panel-routing logic anyway; just don't expect to see it in current fixtures.


## Documentation correction applied

The F1 §8.2 panel table and its intro sentence have been corrected to replace `step.name` with `step.stepKey` throughout (the real schema field, per `workflow.schema.ts` line 209), and the `'docketing'` row's `[Inference]` tag has been upgraded to `[Confirmed]` against `phase1-legislative.ts` line 145. This work is fully complete.

## For whoever explores next

If the next task touches `workflow.getInstance`, `organization.listCommittees`, or `WorkflowStepActionPage` again, treat this addendum plus TASK-WF-FE-002's implementation prompt as your starting context — re-verify against the live repo state rather than trusting either document's claims at face value, the same discipline applied throughout this session (e.g., the original handoff's "Task A is built" claim was wrong when checked; LOG-0069's "docs already updated" claim was right when checked — both needed the actual check, not an assumption either way).

Let me check the other two handoff docs first — you uploaded three files but only one showed up in the documents block.All three are on disk, but only `wf-fe-003-handoff.md` landed in my context window as text. Let me pull the other two directly.Let me get the truncated lines and the third doc.Good, got it all. Now the third doc.Now I have all three docs in full. Let me think through the filtering before writing anything, since you asked for the reasoning laid out rather than folded away.

**What "TASK-WF-FE-003-only" actually means here.** The task is a single, narrow fix: swap `documents.logSecretariatDecision` for a Workflow-Router mutation, and swap `computePanelHint`'s role proxy for the office-scoped policy check. Anything whose only reason for existing is to justify, scope, or execute *that specific fix* is task-only. Anything that's a standing fact about the codebase — a convention, a load-bearing gotcha, a tool/gap that will bite the next task too — survives regardless of which document it came from.

**The harder calls, and how I resolved them:**

- `submitStepAction`'s three hardcoded `'DONE'` sites, and the fact that `approveStep` calls a *different* sibling (`submitStepApproval`) rather than sharing `submitStepAction` with `completeActionStep` — I'm keeping this. It reads like WF-FE-003 trivia, but it's actually a durable fact about the workflow engine's outcome-handling architecture: the engine has two non-interchangeable step-completion primitives, one hardcoded-outcome and one outcome-validated-against-per-step-config, and this distinction will matter to *any* future task touching step completion, not just this one.
- `fetchStepContext`, the `workflowPolicy` accessor name (not `guard`), the `getXService(ctx)` factory convention, `SP_SECRETARIAT_OFFICE_CODE`'s local-redeclaration pattern — all kept. These are how-things-are-wired-in-this-codebase facts, reusable well past this one panel.
- The `AMENDED` outcome gap, the sync/async tension in `computePanelHint`, the dual event-emission mechanism (`createWorkflowEvent` vs `eventBus.emit`) — kept, but reframed as standing architectural gotchas rather than "decisions you must make for this task," since the task-specific decision-making framing is now moot (it's implemented).
- The `AGENTS.md` three-tier hierarchy, the append-only findings-log rule, the "match the target file's prose convention" rule, the `.bak` file rule — all kept. These are project-wide governance/authoring rules that will apply to every future task, not just this one.
- Everything about *why FE-003 was chosen as the next task over test coverage*, the LOG-0078/LOG-0079 narrative, the "prior document claimed X but was wrong" reconciliation trail, the exact line numbers of the bug being replaced, the acceptance criteria, the validation checklist — all cut. That's the deliberation and paper trail for a task that's done; none of it is reusable frontend knowledge.
- Test infrastructure state (Vitest installed but no `test` script, no Playwright, one existing unit test) — I went back and forth on this one. It's phrased in the docs as "context for the next task," but it's really a standing fact about frontend tooling readiness that's true independent of WF-FE-003 and will matter whenever anyone next reaches for tests. Keeping it, generalized.
- The specific 12-step secretariat_decision panel mechanics, `SecretariatDecisionPanel.tsx`'s specific stale comment and toast bug — cut, because that panel's fix is done and the file-specific state has moved on. But the *pattern* it exposed (mutation succeeds silently / unconditional success toast masking real failures) is worth keeping as a general frontend gotcha, since it's exactly the kind of bug that recurs across panels.

Here's the consolidated doc:

---

# Batac City LGU Platform — Frontend & Cross-Cutting Reference (Consolidated from WF-FE-003 Exploration)

## Repo & Governance

- Repo `batac-dms`: TypeScript monorepo, Fastify + tRPC + Drizzle ORM + PostgreSQL, Batac City LGU (Philippines).
- `AGENTS.md` lives at repo root (not `docs/AGENTS.md`).
- **Three-tier source-of-truth hierarchy:** (1) consolidated reference — highest authority; (2) `tech-stack.md`; (3) pre-development docs, Group B–L (ADRs, E1, F1, etc.) — explicitly "downstream interpretations... can be wrong," and same-tier peers with no ranking among themselves.
- **`AGENTS.md` §4.5:** a downstream discovery never silently overrules an upstream document, and no same-tier doc automatically outranks another same-tier doc or shipped code — that's a human call. Agents append findings; they don't resolve conflicts unilaterally.
- **Agents never edit Group B–L documents directly**, even for "obvious" fixes — hard rule. The findings-log (`development-findings-log.md`) is append-only; humans promote/resolve entries, not agents.
- `.bak` files should never be read except for diffing.
- `AGENTS.md` §5: check for a Table of Contents on large docs before reading in full.
- **Task-prompt authoring convention is file-specific, not global:** `fe.md` (frontend tasks) uses prose-block style — "CONTEXT — READ THIS FIRST" fenced sections, "GOOD NEWS"/"VERIFIED GAP" framing, `[Inference]` labels. `wf.md` (backend tasks) uses structured `Deliverables:` / `Acceptance Criteria:` (checkbox) / `AI Prompt:` format. Rule: match the convention of the specific file being appended to, not a different module's convention, even if the other one is well-established elsewhere.

## Workflow Engine — Outcome Handling (durable architecture fact)

- Two non-interchangeable step-completion primitives exist:
  - **`submitStepAction`** (`action.handler.ts`) — hardcodes outcome `'DONE'` in three internal sites (`updateStepInstance`, the `createWorkflowEvent` payload, and `resolveNextStep`'s outcome arg). No `outcome` parameter on its signature at all. Suited only to single-outcome "step is done" semantics (e.g. generic action completion). Called by `completeActionStep`.
  - **`submitStepApproval`** (`approval.handler.ts`) — takes `outcome: string` explicitly, validates it against a **per-step configurable allow-list** (`config['allowed_outcomes']`), and threads the real outcome through all three equivalent internal sites. Called by `approveStep`, not by `completeActionStep` — the two working callers do **not** share one primitive.
- `resolveNextStep` itself is fully outcome-aware (`outcome: string | null` param feeding `evaluateTransitionRules`) — outcome-based branching genuinely exists at the engine layer; it's the two step-completion wrappers above that differ in whether they expose it.
- **Two separate, independent event-recording mechanisms exist per mutation call**, and both need the real outcome or the event misreports it even after an internal fix:
  1. `workflowRepository.createWorkflowEvent` — DB-persisted, written inside the transaction, inside the step-completion handler itself.
  2. `server.eventBus.emit('workflow.step.completed', ...)` — in-process, emitted separately at the **router/caller level**, *after* the transaction commits. Confirmed dotted event name (`workflow.step.completed`, not `workflow.step_completed` — an earlier doc inconsistency, now corrected repo-wide).
- Any new step-completion mutation should model itself on `submitStepApproval` (outcome-aware) rather than `submitStepAction` (hardcoded) if it needs more than a single fixed outcome — and must independently pass the real outcome into its own router-level `eventBus.emit` payload, not just fix the internal handler.
- **Standing gotcha:** if a step type's frontend decision options don't have a 1:1 match in that step's seed-data `allowed_outcomes` array, outcome-validated mutations will hard-fail on submission for that option. Worth checking seed data whenever wiring a new decision/outcome value into a panel, not just assuming the option is representable.

## Office-Scoping Pattern (reusable for any office-gated action)

- **`fetchStepContext(stepInstanceId, ctx)`** is the standard entry pattern for step-scoped mutations — returns `{ stepInstance, step, instance, stepAttrs }` in one call. `stepAttrs.assigneeOfficeId` is already extracted here, pulled from `stepInstances.assignedTo`'s JSONB `office_id` field. Use this on the **mutation/write side** — no extra query needed for the step's own assignee office.
- **Display-side queries** (e.g. anything computing a panel hint before a mutation is attempted) may already select the raw `assignedTo` JSONB without extracting `office_id` from it yet — check before assuming a new column/join is needed. The JSONB shape is `Array<{ user_id?: string; office_id?: string }>`.
- **Resolving a *named* office's own ID** (e.g. "the SP Secretariat office"): `getOrgService(ctx).getOfficeByCode(OFFICE_CODE, subject.cityId)`. **Distinguish two different comparisons that are easy to conflate:**
  - Checking the **acting subject's own office membership** — resolve the office, then check if its ID is in `subject.effectiveOfficeIds`.
  - Checking a **step's assignee office** — resolve the office, then compare its ID directly against `stepAttrs.assigneeOfficeId` (or the display-side JSONB-extracted equivalent). These are not the same check; a precedent using one is not a template for the other.
- Office code constants (e.g. `'SPS'` for SP Secretariat) are currently **locally redeclared per-file**, not imported from a shared module — matches an established (if not ideal) repo convention. Introducing a shared constant is an optional improvement, not something to assume is wanted.
- The `getOrgService`/similar service-accessor pattern across the codebase is a small local `getXService(ctx)` factory reading `ctx.req.server.<serviceName>`, repeated per-file rather than centralized — follow this convention in files that don't have it yet rather than introducing a new pattern.
- Policy-guard call pattern: guards are invoked via an accessor instance (e.g. `workflowPolicy`, not always predictably named — confirm the actual variable name in-file rather than assuming a generic name like `guard`). Guards of this kind are typically `void`-returning with throw-on-deny semantics, meant to be called directly for the throwing side effect rather than wrapped in `if (!guard(...))`.
- **Sync/async tension to watch for generally:** a pure/sync function that needs to incorporate office-scoping logic will hit this exact fork if the office-ID resolution requires a DB call — either the function becomes async (all callers must `await`), or the resolved ID gets passed in as a parameter by each caller. This is a real signature-changing design decision affecting a shared function and all its callers, worth making deliberately and documenting rather than resolving as an incidental side effect of "making it compile." `getOfficeByCode`-style lookups have no caching (plain DB query every call) — not necessarily a blocker, but worth weighing against call frequency (e.g. a page-load query vs. an occasional action mutation).

## Frontend Test Infrastructure (state as of this exploration)

- **Vitest** is the unit-testing tool in use (not Jest), present as a devDependency (`v2.0.0` at time of writing).
- Exactly one existing frontend unit test file (`status-mapping.test.ts`) — it imports real project code/schema and confirms a working test config exists.
- **Gap:** no `"test"` script wired into `apps/web/package.json`'s `scripts` block — the runner and a working example exist, but there's no package-level command to invoke it.
- **No Playwright dependency anywhere in the repo** — E2E has nothing set up at all, a different-sized gap than "no test runner."
- Net picture: unit testing is one wired-example away from usable; E2E testing doesn't exist yet at any level.

## Frontend Gotcha Pattern: Unconditional Success Feedback Masking Silent Mutation Failures

- Observed concretely in one panel: an `onSuccess` handler fired a success toast unconditionally, regardless of whether the underlying mutation actually did anything meaningful (it was a structural no-op under most real conditions). Users saw "success" while nothing advanced.
- **General lesson for any panel wired to a mutation:** success feedback (toasts, etc.) should reflect whether the mutation's response indicates a real state change occurred, not just that the network call didn't throw. Worth checking for this pattern whenever building or auditing a panel that reports success/failure to the user, especially for mutations gated by conditions that can silently fail to match (lifecycle state checks, permission checks, outcome-validation checks) rather than throwing.
- Related: stale comments describing an old rationale/proxy approach as if it were deliberate final design are a recurring loose end worth cleaning up whenever the underlying logic changes — a misleading comment is exactly the kind of thing that causes a future agent (human or AI) to reintroduce old reasoning by accident.