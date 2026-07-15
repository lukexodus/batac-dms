# K2. Workflow Engine Test Suite Design — Pre-dev

**Document ID:** K2 v2
**Status:** Pre-dev. No engine code exists yet. Every "expected result" below describes specified behavior per the four source documents and the resolved ADRs (K2-ADR-01 through K2-ADR-09), not observed or tested behavior — there is nothing running to observe yet.
**Platform:** Batac City LGU Platform
**Purpose:** The complete test case specification for the workflow engine — every valid and invalid step transition, the multi-referral completion conditions, Thursday cutoff enforcement, the Certified Urgent bypass path, the 10-day and 30-day timer transitions, version pinning behavior, and the one-active-designation-per-person constraint — written before any engine code exists.
**Source Documents:** K2-context (`k2-context-workflow-engine-test-suite-design.md`); H1 (`h1-phase-1-workflow-definitions.md`); B4 (`b4-workflow-engine-specification.md`); D3 (`d3-state-machine-diagrams.md`) — D3 Parts 1–3 and Appendix A only, per the source-mapping note that accompanied this document's upload; D3's Appendix B, C, D and closing paragraph were excluded at the source and are not used here.
**ADR Set:** K2-ADR-01 through K2-ADR-09 (`k4-adr-set.md`) — all nine §21 open items resolved; merged into this document. See §22 for the closure record.
**Testing Framework:** Vitest (unit/integration), per K2-context §1. Playwright E2E journeys and ABAC-protected API route tests are separate suites and are out of scope here.
**Last Updated:** June 2026 (v2 — ADR merge)
**Audience:** Backend development team

## Table of Contents

- [L43–L57] 0. Epistemic Conventions for This Document — Defines epistemic labeling conventions ([Inference], [Speculation], [Unverified]) and rules for pre-dev test cases.
- [L58–L86] 1. Scope and Source Mapping — Maps test areas to source documents and defines out-of-scope features (e.g., E2E journeys, Phase 2 step types).
- [L87–L97] 2. Test Environment Assumptions — Specifies test environment assumptions, including Vitest setup, Asia/Manila (PHT) timezone, and mock clocks.
- [L98–L122] 3. Test Identifier Prefixes — Maps test case category prefixes to specific engine and workflow areas for organization.
- [L123–L145] 4. Workflow Instance State Machine — Valid Transitions (INST-V) — Defines valid state transition tests for workflow instances, covering states from Running to Cancelled.
- [L146–L163] 5. Workflow Instance State Machine — Invalid Transitions (INST-I) — Defines test cases verifying that invalid workflow instance state transitions and creation attempts throw errors.
- [L164–L189] 6. Workflow Step Instance State Machine — Valid Transitions (STEP-V) — Defines valid transitions for step instances, including activation, skips, manual overrides, returns, and failures.
- [L190–L215] 7. Workflow Step Instance State Machine — Invalid Transitions (STEP-I) — Defines invalid step transition test cases that must throw, focusing on state and guard violations.
- [L216–L267] 8. SP Resolution Workflow — Valid Transitions (RES-V) — Specifies valid transition test cases for all 39 sequential step rules in the SP Resolution workflow.
- [L268–L291] 9. SP Resolution Workflow — Invalid Transitions (RES-I) — Specifies invalid transition test cases for SP Resolutions, enforcing role guards, sequence rules, and thresholds.
- [L292–L337] 10. SP Ordinance and Appropriation Ordinance — Delta Tests (ORD-V, ORD-I, APP-V, APP-I) — Specifies delta test cases for SP and Appropriation Ordinances, including Third Reading and penalty publication.
- [L338–L355] 11. Multi-Referral Completion Conditions (MREF) — Specifies test cases for committee multi-referrals, including signature rules, SP Secretary overrides, and cutoff flags.
- [L356–L379] 12. Thursday Cutoff Enforcement (THU) — Specifies scheduler tests for Thursday 23:59:59 PHT cutoff enforcement, Tuesday session eligibility, and idempotency.
- [L380–L400] 13. Certified Urgent Bypass Path (CU) — Specifies test cases for Certified Urgent bypasses on active, pending, and past-referral workflow instances.
- [L401–L426] 14. 10-Day Mayor Lapse Timer (MAYOR) — Specifies test cases for the 10-day Mayor review lapse timer, vetoes, and override vote threshold counts.
- [L427–L452] 15. 30-Day Panlalawigan Timer (PANLA) — Specifies test cases for the 30-day Panlalawigan lapse timer, including the four Valid-In-Part resolution paths.
- [L453–L484] 16. Version Pinning Behavior (VER) — Specifies version pinning tests, detailing Option B migration preconditions, admin approval, rollback windows, and invariants.
- [L485–L511] 17. One-Active-Designation-Per-Person Constraint (DESIG) — Specifies tests for the one-active-designation-per-person constraint, including DB index checks, auto-expiry, and routing.
- [L512–L545] 18. Domain Events — Assertions Required — Consolidates required domain event assertions and payload fields for key workflow engine operations.
- [L546–L570] 19. Workflow Instance Context — Key Assertions — Consolidates expected state values and assertion timing for workflow database instance context keys.
- [L571–L594] 20. Engine Invariants — Consolidated Test Map — Maps the 13 core B4 workflow engine invariants to their corresponding test cases in this suite.
- [L595–L612] 21. Open Items and Unverified Gaps — Identifies open design gaps and unverified items requiring upstream specification before tests can be written.
- [L613–L680] 22. ADR Merge Closure Record — Confirms all nine §21 items are resolved; lists three proposed error codes pending confirmation against the engine error registry.

---

---

## 0. Epistemic Conventions for This Document

This document inherits the labeling discipline already in use across K2-context, H1, B4, and D3. Per explicit instruction for this document specifically, three labels are used here:

- **`[Decision]`** — a binding resolution recorded in the K2-ADR set (K2-ADR-01 through K2-ADR-09). Decisions are not hedged with `[Inference]` or `[Unverified]` tags since they are explicit choices, not claims about pre-existing fact. Where a decision rests on an assumption that is itself unconfirmed, that assumption is called out within the relevant ADR rather than folded into the decision silently.
- **`[Inference]`** — logically reasoned from explicit statements in the four source documents, but not itself a verbatim statement in any of them. Most test-case rows below fall in this category in a mild sense: turning a transition-rule table row into a Given/When/Then test case is a restatement, not a leap, but the restatement itself is constructed here, not copied. Rows doing more than restating — combining a transition rule with a typed error from a different section, or noticing a tension between two source documents — are marked `[Inference]` explicitly inline.
- **`[Speculation]`** — offered only where a source document itself ventures a tentative, hedged answer to a question it otherwise leaves open (for example, K2-context's own "likely: invalid input; throw" framing for one Panlalawigan edge case). Speculation is never presented as an expected test result; it is presented as speculation, attributed to the document that speculated it.
- **`[Unverified]`** — no source among the four documents states this, and none even speculates an answer. These are listed again, consolidated, in §18 (Open Items).

Two boundaries on how these labels are applied here. First, a routine restatement of a source table is not marked `[Unverified]` merely because no code exists yet to run it against — pre-dev specification is the entire genre of this document, and K2-context, H1, and B4 are themselves provided as the authoritative inputs for it, not as unverified rumor. Second, this document does not quietly resolve a gap that a source document itself left open. Where K2-context, H1, or B4 already used their own labels (`[CONFIRMED]`, `[Decision — ADR-XXX]`, `[Extension]`, their own `[Unverified]`/`[Inference]`), this document says so by name rather than re-labeling that content as settled.

Per explicit preference for this document, absolute terms — prevent, guarantee, will never, fixes, eliminates, ensures that — are avoided in this document's own voice. Where a source document uses one of those terms, the content is attributed to that document rather than restated as this document's own unqualified claim.

---

## 1. Scope and Source Mapping

| K2 Coverage Area | Primary Source(s) | Section(s) Below |
|---|---|---|
| All valid step transitions | D3 Part 2 (§2.1–2.3), D3 Part 3 (§3.1–3.4); H1 §5.3, §6.2–6.3, §7.2 | §3, §4, §6, §8, §9 |
| All invalid step transitions (must throw) | D3 Appendix A; B4 §3.3, §4.1–4.2, §8; K2-context §3.1–3.2 | §3, §4, §5, §7, §8, §9 |
| Multi-referral completion conditions | K2-context §4; H1 §5.2 (row 4), §5.3 (rows 4–6); B4 §4.3, §8 (invariants 2, 7) | §10 |
| Thursday cutoff enforcement | K2-context §5; B4 §6.2 | §11 |
| Certified Urgent bypass path | K2-context §6; B4 §6.1; H1 §2.4 | §12 |
| 10-day lapse timer transition | K2-context §7; B4 §6.3, §8 (invariant 3) | §13 |
| 30-day Panlalawigan timer transition | K2-context §8; B4 §6.4 | §14 |
| Version pinning behavior | K2-context §9; B4 §7.1–7.3, §8 (invariant 1); D3 §2.4 | §15 |
| One-active-designation-per-person constraint | K2-context §10; B4 §9 | §16 |

**On the designation-constraint gap flagged in the upload note.** The note accompanying this upload correctly states that D3 contains no mention of designations or delegations — confirmed directly: D3 Parts 1–3 and Appendix A never reference `delegation_grants` or designations. The note also suggested this requirement "lives in the consolidated reference's Part 4.12 / 11.13 / Invariant 16" and would need a different source document. That turned out not to require a separate fetch: K2-context §10 already contains the constraint in full, including its own list of required test cases, and B4 §9 independently contains the engine-side mechanism describing how the constraint interacts with assignee resolution. H1 flags the same gap from its own side and names the same likely location, which is consistent with, not contradicted by, K2-context and B4 both already carrying the content.

**Out of scope for this document**, per K2-context §1's testing priority order and explicit boundary statements in H1 and B4:

- ABAC-protected Fastify route integration tests (K2-context §1, priority 2 — a separate suite).
- Playwright E2E user-journey tests (K2-context §1, priority 3 — a separate suite).
- `parallel_split` / `parallel_join` behavior beyond the Phase 1 publish-time and runtime guard rejection — both step types are explicitly Phase 2 reserved (B4 §5; H1's `WorkflowStepType` definition).
- Phase 1B document types — Letters, Memos, Notices, Designations — as workflow types in their own right (H1, "What this document does not cover").
- Form definitions and notification templates, referenced by `form_key` / `template_key` but not defined in H1.
- The D3 Appendix B enum-name reconciliation itself (B4's lowercase enum values versus D3's capitalized authoritative names). This document uses D3's authoritative names throughout — `Running`, `Stuck`, `Skipped`, and so on — consistent with D3's own statement that its names are authoritative over B4 and the Drizzle schema, but the migration work to reconcile B4's literal enum values is a separate tracked item, not a test-suite concern.
- ARTA SLA 80% warning and escalation behavior — [Decision — ADR-08] deliberate exclusion, not an unresolved gap. K2-context §1's stated testing priority order does not include SLA monitoring in the engine test scope; if SLA enforcement is engine-side, it belongs in a named follow-on suite.
- True parallel multi-committee re-review after `VALID_IN_PART` — [Decision — ADR-03] out of scope for Phase 1, for the same reason `parallel_split`/`parallel_join` are out of scope (B4 §5). `committee_revisions_review` (H1 §5.2 row 19) is a single-assignee `approval` step; supporting parallel committee approval in that step would require a schema change deferred to Phase 2.

---

## 2. Test Environment Assumptions

`[Inference]` — no source document specifies a fixture or mocking strategy. The following is a starting point consistent with the stack confirmed in K2-context §1, not an instruction found in any source.

- **Framework:** Vitest, per K2-context §1.
- **Clock control:** the 10-day Mayor lapse timer (§13), the 30-day Panlalawigan timer (§14), and the Thursday-cutoff job (§11) all compare the current time against `TIMESTAMPTZ` values stored at the moment an earlier event occurred (B4 §1, "Deterministic execution"). Exercising "day 10 has elapsed" or "exactly at the Thursday 23:59:59 PHT boundary" deterministically needs either a controllable fake clock or direct manipulation of the stored deadline/cutoff timestamps in test fixtures — real-time waiting is not a workable test strategy for either timer.
- **Timezone:** Thursday-cutoff tests need to either fix the test environment to `Asia/Manila` (UTC+08:00) or compute explicitly against it, since B4 §6.2 defines the cutoff in PHT and gives the UTC-equivalent only as a cross-check, not as the primary definition.
- **Fixture workflow definitions:** H1 §10 describes a seed script (`/packages/database/src/seeds/workflow/phase1-legislative.ts`) that inserts the three Phase 1 definitions via deterministic `uuidv5` step IDs; integration tests can reasonably reuse this seed. Pure unit tests of the transition-evaluation algorithm (B4 §3.3) more plausibly use small in-memory fixture definitions scoped to just the rule under test, but neither H1 nor B4 states which approach the team intends, and that choice is left open here rather than asserted.
- **Idempotency tests** (THU-09, MAYOR-06, and the Option B precondition checks in §15) need to run a scheduler job function twice against the same fixture state and assert no additional side effects on the second run, per B4's explicit "Idempotent" notes on `evaluateThursdayCutoffs`, `evaluateMayorLapseTimers`, and `evaluatePanlalawiganTimers`.

---
## 3. Test Identifier Prefixes

All test case IDs in this document use the following scheme.

| Prefix | Coverage area |
|---|---|
| `INST-V##` / `INST-I##` | Workflow instance state machine — valid / invalid transitions |
| `STEP-V##` / `STEP-I##` | Workflow step instance state machine — valid / invalid transitions |
| `RES-V##` / `RES-I##` | SP Resolution workflow — valid / invalid domain transitions |
| `ORD-V##` / `ORD-I##` | SP Ordinance workflow — valid / invalid transitions (delta tests only) |
| `APP-V##` / `APP-I##` | Appropriation Ordinance — valid / invalid transitions (delta tests only) |
| `MREF-##` | Multi-referral completion conditions |
| `THU-##` | Thursday cutoff enforcement |
| `CU-##` | Certified Urgent bypass path |
| `MAYOR-##` | 10-day Mayor lapse timer |
| `PANLA-##` | 30-day Panlalawigan timer |
| `VER-##` | Version pinning behavior |
| `DESIG-##` | One-active-designation-per-person constraint |
| `PUBVAL-##` | Publish-time definition validation tests (ADR-06, ADR-07) |
| `INV##-##` | Dedicated invariant tests not naturally grouped under domain sections (ADR-04, ADR-05) |

`V` = valid transitions (system should complete the transition); `I` = invalid transitions (system must throw). Source keys (`Source: ...`) cite the specific section in the four source documents directly; inline `[Inference]` on individual rows applies only to that row.

---

## 4. Workflow Instance State Machine — Valid Transitions (INST-V)

Source: D3 §2.1–2.3, §2.4.

**State set:** `Running`, `Paused`, `Stuck`, `Completed`, `Cancelled`.
**Terminal states:** `Completed`, `Cancelled`.
**Initial state:** `Running` — set in the same transaction as instance creation; no separate `Created` state is ever persisted. Source: D3 §2.2, ADR-016.

| ID | Given | When | Then | Source |
|---|---|---|---|---|
| INST-V01 | Instance created; workflow definition version is published and active; document is `In-Workflow`; start step assignee resolvable | Instance creation transaction committed | Instance is in `Running`; first step instance is `Active`; `definition_version_id` set and immutable; SLA deadline stored; `started_at = NOW()` | D3 §2.2, §2.3 |
| INST-V02 | Instance is `Running`; admin or system-level trigger fires with logged pause reason | `INSTANCE_PAUSED` event | Instance transitions to `Paused`; no step instance is `Active`; ARTA SLA clock continues running | D3 §2.2, §2.3 |
| INST-V03 | Instance is `Running`; `termination` step has been activated and executed; all step instances are in terminal states | `ALL_STEPS_COMPLETED` event | Instance transitions to `Completed`; engine emits appropriate terminal document lifecycle event based on termination outcome code | D3 §2.2, §2.3 |
| INST-V04 | Instance is `Running`; authorized actor cancels; mandatory reason provided | `INSTANCE_CANCELLED` event | Instance transitions to `Cancelled`; all `Active` and `Pending` step instances receive `STEP_CANCELLED` in same transaction; associated document lifecycle transitions to `Cancelled` | D3 §2.2, §2.3 |
| INST-V05 | Instance is `Running`; a step completes with an outcome code for which no matching transition rule exists in the pinned definition version | `NO_MATCHING_TRANSITION_RULE` event | Instance transitions to `Stuck`; no step activated; ARTA SLA clock continues running; Platform Administrator intervention required | D3 §2.2, §2.3, ADR-016 |
| INST-V06 | Instance is `Paused`; pause condition resolved; admin authorization to resume present | `INSTANCE_RESUMED` event | Instance transitions back to `Running` | D3 §2.3 |
| INST-V07 | Instance is `Paused`; authorized actor cancels; mandatory reason provided | `INSTANCE_CANCELLED` event | Instance transitions to `Cancelled`; all pending step instances cancelled in same transaction | D3 §2.3 |
| INST-V08 | Instance is `Stuck`; Platform Administrator publishes corrected workflow definition version OR manually routes step with mandatory audit-logged comment | `STUCK_RESOLVED` event | Instance transitions back to `Running`; transition evaluation proceeds | D3 §2.3, ADR-016 |
| INST-V09 | Instance is `Stuck`; authorized actor cancels; mandatory reason provided | `INSTANCE_CANCELLED` event | Instance transitions to `Cancelled` | D3 §2.3, ADR-016 |
| INST-V10 | Instance is `Running`; next step is a Mayor review step; no active Mayor account present | `INSTANCE_PAUSED` auto-trigger | Instance transitions to `Paused`; pause reason logged; ARTA SLA clock continues | D3 §2.2 (Known trigger note), K2-context §2.4 |

---

## 5. Workflow Instance State Machine — Invalid Transitions (INST-I)

Source: D3 §2.2–2.3, Appendix A; B4 §8.

| ID | Given | When | Expected Outcome | Source |
|---|---|---|---|---|
| INST-I01 | Instance is `Completed` (terminal state) | Any transition event fired against the instance | Must throw; no state change; `Completed` has no outgoing transitions | D3 Appendix A |
| INST-I02 | Instance is `Cancelled` (terminal state) | Any transition event fired against the instance | Must throw; no state change; `Cancelled` has no outgoing transitions | D3 Appendix A |
| INST-I03 | Instance is `Running` | `STUCK_RESOLVED` event (only valid from `Stuck`) | Must throw; guard condition not met | D3 §2.3 |
| INST-I04 | Instance is `Running` | `INSTANCE_RESUMED` event (only valid from `Paused`) | Must throw; guard condition not met | D3 §2.3 |
| INST-I05 | Instance is `Stuck` | `INSTANCE_PAUSED` event (only valid from `Running`) | Must throw; guard condition not met | D3 §2.3 |
| INST-I06 | Instance is `Paused` | `NO_MATCHING_TRANSITION_RULE` event (only valid from `Running`) | Must throw; guard condition not met | D3 §2.3 |
| INST-I07 | Instance creation attempted; workflow definition version for this document type does not exist or is not published | Instance creation transaction | Must throw before any row is committed; no partial instance persisted | D3 §2.3, B4 §3.2 |
| INST-I08 | Instance creation attempted; document is not in `In-Workflow` lifecycle state | Instance creation transaction | Must throw | D3 §2.3 |
| INST-I09 | Instance is `Running`; a step completes normally | Attempt to fire `ALL_STEPS_COMPLETED` when at least one step instance is still non-terminal | Must throw; terminal condition not satisfied | D3 §2.3 |

---

## 6. Workflow Step Instance State Machine — Valid Transitions (STEP-V)

Source: D3 §3.1–3.4, Appendix A.

**State set:** `Pending`, `Active`, `Completed`, `Skipped`, `Returned`, `Failed`, `Cancelled`.
**Terminal states:** `Completed`, `Skipped`, `Returned`, `Failed`, `Cancelled`.
**Step instances are never reused.** If a step is returned and the workflow later re-enters that step position, a new step instance is created. Source: D3 §3 (opening).

| ID | Given | When | Then | Source |
|---|---|---|---|---|
| STEP-V01 | Step is `Pending`; all preceding steps in terminal states (`Completed`, `Skipped`, `Returned`, or `Failed`); matching transition rule points to this step; assignee resolvable | `STEP_ACTIVATED` event | Step transitions to `Active`; `assigned_to` set; assignee notified | D3 §3.3, ADR-016 |
| STEP-V02 | Step is `Pending`; a `decision` step upstream evaluated a routing condition that bypasses this step; OR Certified Urgent flag active and this step is a `multi_referral` committee referral step; OR admin invokes `bypassStep` with mandatory non-empty reason | `STEP_SKIPPED` event | Step transitions to `Skipped`; `bypassed_at`, `bypass_reason`, and optionally `bypassed_by` set; step is terminal; next eligible step is activated | D3 §3.2, §3.3 |
| STEP-V03 | Step is `Pending`; parent instance receives `INSTANCE_CANCELLED` | `STEP_CANCELLED` event | Step transitions to `Cancelled`; terminal | D3 §3.3 |
| STEP-V04 | Step is `Active`; step type is `action`; actor in `assigned_to` performs the required action | `STEP_COMPLETED` event | Step transitions to `Completed`; `outcome`, `completed_at`, `actor_id` set; transition evaluation runs | D3 §3.2, §3.3 |
| STEP-V05 | Step is `Active`; step type is `approval`; actor records an explicit outcome from `allowed_outcomes` | `STEP_COMPLETED` event | Step transitions to `Completed`; `outcome`, `completed_at`, `actor_id` set; transition evaluation runs | D3 §3.2, §3.3 |
| STEP-V06 | Step is `Active`; step type is `multi_referral`; all assigned committees have submitted contributions AND SP Secretary has accepted the unified report | `STEP_COMPLETED` event | Step transitions to `Completed`; outcome set; transition evaluation routes to Second Reading | D3 §3.3 (Active→Completed, sub-point c); D3 §3.4 |
| STEP-V07 | Step is `Active`; step type is `multi_referral`; SP Secretary invokes manual override with mandatory non-empty comment; one or more committees have not submitted | `STEP_COMPLETED` event via manual override | Step transitions to `Completed`; mandatory comment recorded; dedicated audit event written; transition evaluation routes to Second Reading | D3 §3.3 (Active→Completed, sub-point c); K2-context §4 |
| STEP-V08 | Step is `Active`; step type is `decision`; system evaluates condition expression | `STEP_COMPLETED` event | Step transitions to `Completed` immediately on activation; system sets outcome code from evaluation result; transition evaluation runs | D3 §3.2, §3.3, §3.4 |
| STEP-V09 | Step is `Active`; step type is `notification`; notification successfully enqueued | `STEP_COMPLETED` event | Step transitions to `Completed` immediately on activation | D3 §3.2, §3.3, §3.4 |
| STEP-V10 | Step is `Active`; step type is `termination` | Step activated | Step auto-completes on activation; `ALL_STEPS_COMPLETED` event emitted on parent instance | D3 §3.2, §3.3, §3.4 |
| STEP-V11 | Step is `Active`; step type is `approval`; actor in `assigned_to` explicitly returns the document; mandatory non-empty `outcome_comment` provided; workflow definition specifies a designated prior step to re-activate | `STEP_RETURNED` event | Step transitions to `Returned` (terminal); new step instance created for the prior step (not the same step instance reused); `outcome_comment` stored | D3 §3.2, §3.3 |
| STEP-V12 | Step is `Active`; an unhandled internal engine error occurs during step processing (assignee resolution, condition evaluation, side-effect writes, etc.) — not an actor-submitted outcome | `STEP_FAILED` event | Step transitions to `Failed` (terminal); `failed_at` and internal error reference recorded; immediate alerting triggered; parent instance transitions to `Stuck` | D3 §3.2, §3.3, ADR-016 |
| STEP-V13 | Step is `Active`; parent instance receives `INSTANCE_CANCELLED`, OR admin explicitly cancels via `bypassStep` with mandatory reason | `STEP_CANCELLED` event | Step transitions to `Cancelled` (terminal) | D3 §3.3 |

---

## 7. Workflow Step Instance State Machine — Invalid Transitions (STEP-I)

Source: D3 §3.1–3.3, Appendix A.

| ID | Given | When | Expected Outcome | Source |
|---|---|---|---|---|
| STEP-I01 | Step is `Completed` (terminal state) | Any transition event | Must throw; no state change | D3 Appendix A |
| STEP-I02 | Step is `Skipped` (terminal state) | Any transition event | Must throw; no state change | D3 Appendix A |
| STEP-I03 | Step is `Returned` (terminal state) | Any transition event | Must throw; no state change | D3 Appendix A |
| STEP-I04 | Step is `Failed` (terminal state) | Any transition event | Must throw; no state change | D3 Appendix A |
| STEP-I05 | Step is `Cancelled` (terminal state) | Any transition event | Must throw; no state change | D3 Appendix A |
| STEP-I06 | Step is `Pending` | `STEP_COMPLETED` event | Must throw; step is not yet `Active` | D3 §3.3 |
| STEP-I07 | Step is `Pending` | `STEP_RETURNED` event | Must throw; `Returned` is only valid from `Active` | D3 §3.3 |
| STEP-I08 | Step is `Pending` | `STEP_FAILED` event | Must throw; `Failed` is only valid from `Active` | D3 §3.3 |
| STEP-I09 | Step is `Active` | `STEP_ACTIVATED` event (re-activation attempt) | Must throw; step is already `Active` | D3 §3.3 |
| STEP-I10 | Step is `Active`; step type is `action` (not `approval`) | `STEP_RETURNED` event | Must throw; `Returned` only valid for `approval` step type | D3 §3.3 |
| STEP-I11 | Step is `Active`; step type is `decision` (not `approval`) | `STEP_RETURNED` event | Must throw; `Returned` only valid for `approval` step type | D3 §3.3 |
| STEP-I12 | Step is `Active`; step type is `notification` (not `approval`) | `STEP_RETURNED` event | Must throw; `Returned` only valid for `approval` step type | D3 §3.3 |
| STEP-I13 | Step is `Active`; step type is `termination` (not `approval`) | `STEP_RETURNED` event | Must throw; `Returned` only valid for `approval` step type | D3 §3.3 |
| STEP-I14 | Step is `Active`; step type is `approval`; actor submits `STEP_RETURNED` but no `outcome_comment` provided | `STEP_RETURNED` event with empty or null comment | Must throw; mandatory non-empty `outcome_comment` is a guard condition | D3 §3.3 |
| STEP-I15 | Step is `Active`; step type is `approval`; actor submits `STEP_RETURNED` but workflow definition does not specify a prior step to re-activate | `STEP_RETURNED` event | Must throw; re-activation target is a guard condition | D3 §3.3 |
| STEP-I16 | Step is `Active`; `parallel_split` or `parallel_join` step type used | Any activation | Must throw; both types are Phase 2 reserved and not executable in Phase 1 | K2-context §2.2; H1 `WorkflowStepType` |
| STEP-I17 | Step is `Pending`; `STEP_ACTIVATED` event fires but preceding step instance is still `Active` (not yet terminal) | `STEP_ACTIVATED` event | Must throw; guard condition (all preceding steps terminal) not satisfied | D3 §3.3 |
| STEP-I18 | Step is `Pending`; `STEP_ACTIVATED` event fires but assignee is not resolvable from current organization state | `STEP_ACTIVATED` event | Must throw (or auto-pause instance); guard condition (assignee resolvable) not satisfied | D3 §3.3 |

---
## 8. SP Resolution Workflow — Valid Transitions (RES-V)

Source: H1 §5.2–5.3; K2-context §3.1; D3 §3.3–3.4.

The SP Resolution workflow has 28 steps and 39 transition rules (H1 §5.2, §5.3). The valid-transition tests below cover every transition rule row in H1 §5.3. The step keys, outcome codes, and rule ordering are taken verbatim from H1 §5.3 and §5.2. `legally_mandated` flags are per H1 §5.2; omitting any `legally_mandated: true` step from a definition is a publish-time error, not a runtime one (K2-context §12; H1 "About This Document"), and is not tested here.

| ID | from step | outcome_filter | to step | Given / Guards | Then | Source |
|---|---|---|---|---|---|---|
| RES-V01 | `intake_logging` | — (unconditional) | `order_of_business_scheduling` | `intake_logging` step completes with outcome `DONE` | `order_of_business_scheduling` step instance activated; `order_of_business_scheduling` is `Active` | H1 §5.3 rule 1 |
| RES-V02 | `order_of_business_scheduling` | — (unconditional) | `first_reading` | `order_of_business_scheduling` completes | `first_reading` activated | H1 §5.3 rule 2 |
| RES-V03 | `first_reading` | — (unconditional) | `committee_referral` | `first_reading` completes | `committee_referral` step activated; all assigned committees notified | H1 §5.3 rule 3 |
| RES-V04 | `committee_referral` | `REPORT_ACCEPTED` | `second_reading_vote` | All assigned committees submitted contributions; SP Secretary accepts the unified report | `committee_referral` step completes with `REPORT_ACCEPTED`; `second_reading_vote` activated | H1 §5.3 rule 4; K2-context §4 |
| RES-V05 | `committee_referral` | `SECRETARY_ADVANCED` | `second_reading_vote` | SP Secretary invokes manual override; mandatory non-empty comment provided; dedicated audit event written; one or more committees have not submitted | `committee_referral` step completes with `SECRETARY_ADVANCED`; `second_reading_vote` activated; missing committees flagged red in Order of Business | H1 §5.3 rule 5; K2-context §4 |
| RES-V06 | `committee_referral` | `BYPASSED_CERTIFIED_URGENT` | `second_reading_vote` | Certified Urgent flag active on the document instance; engine fires bypass event | `committee_referral` step transitions to `Skipped`; `second_reading_vote` activated; no committee report required | H1 §5.3 rule 6; B4 §6.1; H1 §2.4 |
| RES-V07 | `second_reading_vote` | `APPROVED` | `final_number_assignment` | SP Secretary records `APPROVED` outcome; no amendments flagged | `final_number_assignment` activated | H1 §5.3 rule 7 |
| RES-V08 | `second_reading_vote` | `RETURNED_FOR_REVISION` | `amendments_logging` | SP Secretary records `RETURNED_FOR_REVISION`; amendments will be logged | `amendments_logging` activated; Secretariat logs amendments and prepares amended copy | H1 §5.3 rule 8 |
| RES-V09 | `second_reading_vote` | `REJECTED` | `end_rejected_at_vote` | SP Secretary records `REJECTED` | `end_rejected_at_vote` termination step activated and auto-completes; instance status → `Completed`; document lifecycle → `Cancelled` | H1 §5.3 rule 9 |
| RES-V10 | `amendments_logging` | — (unconditional) | `second_reading_amended_vote` | `amendments_logging` completes | `second_reading_amended_vote` activated | H1 §5.3 rule 10 |
| RES-V11 | `second_reading_amended_vote` | `APPROVED` | `final_number_assignment` | SP Secretary records `APPROVED` on amended version | `final_number_assignment` activated | H1 §5.3 rule 11 |
| RES-V12 | `second_reading_amended_vote` | `REJECTED` | `end_rejected_at_vote` | SP Secretary records `REJECTED` on amended version | `end_rejected_at_vote` activated; instance completes; document cancelled | H1 §5.3 rule 12 |
| RES-V13 | `final_number_assignment` | — (unconditional) | `vp_certification` | `final_number_assignment` completes; "Draft" prefix removed; final series number immutable from this point | `vp_certification` activated; Vice Mayor (or Acting VM if delegation active) is assignee | H1 §5.3 rule 13; K2-context §15 |
| RES-V14 | `vp_certification` | `SIGNED` | `transmittal_letter_to_mayor` | VP (or delegate) records `SIGNED` | `transmittal_letter_to_mayor` activated | H1 §5.3 rule 14 |
| RES-V15 | `transmittal_letter_to_mayor` | — (unconditional) | `mayor_review` | `transmittal_letter_to_mayor` completes; `triggers_mayor_lapse_timer: true` fires — engine sets `instance.context.mayor_transmittal_date = NOW()` and `mayor_action_deadline = NOW() + 10 days` | `mayor_review` activated; Mayor (or Acting Mayor if delegation active) is assignee; 10-day countdown begins | H1 §5.3 rule 15; B4 §6.3 |
| RES-V16 | `mayor_review` | `SIGNED` | `docketing` | Mayor records `SIGNED` within the 10-day window | `docketing` activated; Mayor lapse timer cancelled | H1 §5.3 rule 16; K2-context §7 |
| RES-V17 | `mayor_review` | `LAPSED` | `docketing` | 10 calendar days elapsed with no Mayor action; scheduler (`evaluateMayorLapseTimers`) fires | `mayor_review` step completes with `LAPSED`; RA 7160 §47 legal basis logged; SP Secretary notified; `docketing` activated | H1 §5.3 rule 17; B4 §6.3; K2-context §7 |
| RES-V18 | `mayor_review` | `VETOED` | `veto_override_vote` | Mayor records `VETOED` with written objections | `veto_override_vote` activated | H1 §5.3 rule 18 |
| RES-V19 | `veto_override_vote` | `OVERRIDE_SUCCEEDED` | `docketing` | SP Secretary records `OVERRIDE_SUCCEEDED`; vote count ≥ 8 of 12 | `docketing` activated | H1 §5.3 rule 19; K2-context §11 |
| RES-V20 | `veto_override_vote` | `OVERRIDE_FAILED` | `end_vetoed_override_failed` | SP Secretary records `OVERRIDE_FAILED`; vote count < 8 of 12 | `end_vetoed_override_failed` termination step activated and auto-completes; instance → `Completed`; document → `Cancelled` | H1 §5.3 rule 20; K2-context §11 |
| RES-V21 | `docketing` | — (unconditional) | `panlalawigan_transmission_logging` | `docketing` completes | `panlalawigan_transmission_logging` activated | H1 §5.3 rule 21 |
| RES-V22 | `panlalawigan_transmission_logging` | — (unconditional) | `panlalawigan_review` | `panlalawigan_transmission_logging` completes; `triggers_panlalawigan_timer: true` fires — engine sets `panlalawigan_transmission_date = NOW()` and `panlalawigan_action_deadline = NOW() + 30 days` | `panlalawigan_review` activated; 30-day countdown begins | H1 §5.3 rule 22; B4 §6.4 |
| RES-V23 | `panlalawigan_review` | `VALID` | `portal_publication` | SP Secretary records `VALID` outcome from Panlalawigan | `portal_publication` activated; context key `panlalawigan_outcome = 'VALID'` set | H1 §5.3 rule 23 |
| RES-V24 | `panlalawigan_review` | `DEEMED_APPROVED` | `portal_publication` | 30 calendar days elapsed with no Panlalawigan action; scheduler (`evaluatePanlalawiganTimers`) fires | `panlalawigan_review` completes with `DEEMED_APPROVED`; RA 7160 §56(d) legal basis and "Lapsed 30 days" remarks logged; SP Secretary notified; `portal_publication` activated | H1 §5.3 rule 24; B4 §6.4; K2-context §8 |
| RES-V25 | `panlalawigan_review` | `VALID_IN_PART` | `valid_in_part_action` | SP Secretary records `VALID_IN_PART`; Panlalawigan response attached | `valid_in_part_action` activated; step placed in "Awaiting SP Secretariat Action" | H1 §5.3 rule 25 |
| RES-V26 | `panlalawigan_review` | `RETURNED` | `returned_review` | SP Secretary records `RETURNED`; high-priority flag set; implementation stops | `returned_review` activated | H1 §5.3 rule 26 |
| RES-V27 | `valid_in_part_action` | — (unconditional) | `valid_in_part_decision` | `valid_in_part_action` completes; mandatory comment recorded | `valid_in_part_decision` activated | H1 §5.3 rule 27 |
| RES-V28 | `valid_in_part_decision` | `RESOLVED_IN_PLACE` | `portal_publication` | SP Secretary records `RESOLVED_IN_PLACE` with mandatory comment; document annotated | `portal_publication` activated | H1 §5.3 rule 28 |
| RES-V29 | `valid_in_part_decision` | `ROUTED_TO_LEGAL` | `legal_office_review` | SP Secretary records `ROUTED_TO_LEGAL` | `legal_office_review` activated; Legal Officer is assignee | H1 §5.3 rule 29 |
| RES-V30 | `valid_in_part_decision` | `ROUTED_TO_COMMITTEE` | `committee_revisions_review` | [Decision — ADR-03] SP Secretary records `ROUTED_TO_COMMITTEE`; selects one lead committee from the originally-referred set (single choice if only one committee was referred); mandatory non-empty comment required (B4 invariant 10) | `instance.context.referred_committee_chair_id` set to the resolved chair of the selected committee; `committee_revisions_review` activated with that chair as sole assignee | H1 §5.3 rule 30; ADR-03 |
| RES-V30a | `valid_in_part_decision` | `ROUTED_TO_COMMITTEE` | `committee_revisions_review` | [Decision — ADR-03] Original referral was to a **single** committee; SP Secretary records `ROUTED_TO_COMMITTEE` with non-empty comment | No selection ambiguity; that committee's chair is resolved via `actor_from_context:referred_committee_chair_id`; same context-population mechanism as multi-committee case | ADR-03 |
| RES-V30b | `valid_in_part_decision` | `ROUTED_TO_COMMITTEE` | *(rejected)* | [Decision — ADR-03] SP Secretary records `ROUTED_TO_COMMITTEE` but the mandatory comment is empty or whitespace-only | Must throw; rejected per invariant 10 (`COMMENT_REQUIRED` or equivalent); consistent with `SECRETARY_ADVANCED` guard (B4 §4.3) and paths 1 and 4 comment requirements (H1 §5.3 rules 28, 31) | ADR-03; B4 §8 invariant 10 |
| RES-V31 | `valid_in_part_decision` | `REVISED_DIRECTLY` | `portal_publication` | SP Secretary records `REVISED_DIRECTLY` with mandatory comment; Secretariat implements revisions | `portal_publication` activated | H1 §5.3 rule 31 |
| RES-V32 | `legal_office_review` | `RESOLVED_IN_PLACE` | `portal_publication` | Legal Officer records `RESOLVED_IN_PLACE` | `portal_publication` activated | H1 §5.3 rule 32 |
| RES-V33 | `committee_revisions_review` | `RESOLVED_IN_PLACE` | `portal_publication` | Committee Chair records `RESOLVED_IN_PLACE` | `portal_publication` activated | H1 §5.3 rule 33 |
| RES-V34 | `returned_review` | `RESOLVED_DIRECTLY` | `portal_publication` | SP Secretary records `RESOLVED_DIRECTLY` with mandatory comment | `portal_publication` activated | H1 §5.3 rule 34; B4 §6.4 |
| RES-V35 | `returned_review` | `REPASS` | `end_repassed` | SP Secretary records `REPASS`; document goes back to drafting | `end_repassed` termination step activated; instance remains `Running` (not `Completed`); engine emits `workflow.instance.repassed`; documents module sets `superseded_by` on original document | H1 §5.3 rule 35; D3 §2.4; ADR-014/015 |
| RES-V36 | `portal_publication` | — (unconditional) | `archive` | `portal_publication` completes; title and first page published to portal; document lifecycle → `Released` | `archive` activated | H1 §5.3 rule 36 |
| RES-V37 | `archive` | — (unconditional) | `final_outcome_check` | `archive` completes; Records Officer archives; document lifecycle → `Archived` | `final_outcome_check` decision step activated and evaluates immediately | H1 §5.3 rule 37 |
| RES-V38 | `final_outcome_check` | `TRUE` | `end_approved_and_released` | JSONLogic condition evaluates `panlalawigan_outcome ∈ {VALID, DEEMED_APPROVED}` → true | `end_approved_and_released` termination step activates and auto-completes; instance → `Completed`; `APPROVED_AND_RELEASED` outcome | H1 §5.3 rule 38 |
| RES-V39 | `final_outcome_check` | `FALSE` | `end_valid_in_part_resolved` | JSONLogic condition evaluates → false (all other resolved Panlalawigan outcomes) | `end_valid_in_part_resolved` termination step activates and auto-completes; instance → `Completed`; `VALID_IN_PART_RESOLVED` outcome | H1 §5.3 rule 39 |

---

## 9. SP Resolution Workflow — Invalid Transitions (RES-I)

Source: K2-context §3.1 (invalid transitions list); K2-context §12 (hardcoded constraints); H1 §5.2–5.3; D3 Appendix A.

| ID | Attempted Transition | Guard Violated | Expected Outcome | Source |
|---|---|---|---|---|
| RES-I01 | `committee_referral` → `second_reading_vote` with outcome `REPORT_ACCEPTED`, but not all committees have submitted | `require_all_committee_signatures: true`; not all committees terminal | Must throw; step must not complete | H1 §5.2 (step 4 config); B4 §4.3; K2-context §3.1 |
| RES-I02 | `committee_referral` → `second_reading_vote` with outcome `REPORT_ACCEPTED`, but unified report not yet accepted by SP Secretary | SP Secretary acceptance is the completion trigger for `REPORT_ACCEPTED` | Must throw; step must not complete | H1 §5.2 (step 4); K2-context §4 |
| RES-I03 | `committee_referral` → `second_reading_vote` with outcome `SECRETARY_ADVANCED` but no comment provided | Mandatory non-empty comment is a guard on `allow_secretary_advance` | Must throw | H1 §5.2 (step 4 `allow_secretary_advance`); K2-context §4 |
| RES-I04 | Any step submits an outcome code not in its `allowed_outcomes` list (e.g., `VETOED` submitted to `second_reading_vote`) | `allowed_outcomes` is an exhaustive list; unknown outcome code has no transition rule | Must throw at outcome-submission point | B4 §4.2; D3 §3.3 (STEP_FAILED note); K2-context §3.1 |
| RES-I05 | `final_number_assignment` activated before `second_reading_vote` or `second_reading_amended_vote` completes (e.g., transition rules bypass the vote) | `legally_mandated: true` steps cannot be omitted; no valid path from any step directly to `final_number_assignment` exists that skips the vote | Must throw at publish time (definition validation); if somehow reached at runtime, must throw | K2-context §12; H1 §5.2 step 8; B4 §8 |
| RES-I06 | `vp_certification` → `transmittal_letter_to_mayor` attempted before `final_number_assignment` completes | Transition rules are sequential; `vp_certification` is only reachable after `final_number_assignment` | Must throw or have no matching transition rule | H1 §5.3 rule 13; K2-context §3.1 |
| RES-I07 | `mayor_review` step skipped — attempted path from `transmittal_letter_to_mayor` directly to `docketing` | No transition rule with `from = transmittal_letter_to_mayor → docketing` exists; `mayor_review` is `legally_mandated: true` | Must throw at publish time if rule is added; at runtime, no path exists | K2-context §3.1, §12; H1 §5.2 step 11 |
| RES-I08 | `panlalawigan_review` step skipped — attempted path from `docketing` or `panlalawigan_transmission_logging` directly to `portal_publication` | No such transition rule exists; `panlalawigan_review` is `legally_mandated: true` | Must throw at publish time; no runtime path exists | K2-context §3.1, §12; H1 §5.2 step 15 |
| RES-I09 | Any `termination` step receives a subsequent transition event | `termination` step is `Completed` (terminal); no outgoing transition rules exist from any `end_*` step | Must throw; `Completed` step has no outgoing transitions | D3 Appendix A; K2-context §3.1 |
| RES-I10 | `LAPSED` outcome submitted by a human actor (not the scheduler) to `mayor_review` | `LAPSED` is a scheduler-only outcome; human submission of scheduler-reserved outcome codes is blocked | Must throw | B4 §4.2; H1 §2.3 |
| RES-I11 | `DEEMED_APPROVED` outcome submitted by a human actor (not the scheduler) to `panlalawigan_review` | `DEEMED_APPROVED` is a scheduler-only outcome | Must throw | B4 §4.2; H1 §2.3 |
| RES-I12 | `OVERRIDE_SUCCEEDED` submitted with a vote count of 7 (< 8) | 2/3 majority = 8 of 12; vote count validation is required before accepting `OVERRIDE_SUCCEEDED` | Must throw; insufficient votes | K2-context §11; K2-context §7 |
| RES-I13 | `OVERRIDE_FAILED` submitted with a vote count of 8 or more | Vote count ≥ 8 contradicts `OVERRIDE_FAILED` | Must throw; inconsistent input | K2-context §11 (`[Inference]` — K2-context states validation is required for OVERRIDE_SUCCEEDED; consistency implies OVERRIDE_FAILED must also be validated against the threshold) |
| RES-I14 | Final number re-assigned or modified after `final_number_assignment` step completes | "Final number is immutable once assigned. Any attempt must throw." | Must throw | K2-context §15 |
| RES-I15 | `second_reading_vote` proceeds while `committee_referral` step is still `Active` and no manual override or Certified Urgent bypass has been applied | Thursday cutoff passed, no report submitted, no `SECRETARY_ADVANCED` outcome | Must not proceed; item blocked | K2-context §3.1 |

---

## 10. SP Ordinance and Appropriation Ordinance — Delta Tests (ORD-V, ORD-I, APP-V, APP-I)

Source: K2-context §3.2–3.3; H1 §6 (SP Ordinance), §7 (Appropriation Ordinance).

SP Ordinance and Appropriation Ordinance share all steps and transitions with SP Resolution, with the differences described below. RES-V01 through RES-V39 and RES-I01 through RES-I15 are considered implicitly inherited — the delta tests here cover only what is different or added.

### 10.1 SP Ordinance — Additional Valid Transitions (ORD-V)

The SP Ordinance has three readings instead of two. A `third_reading_vote` step is inserted after `second_reading_vote` (or `second_reading_amended_vote`). The `final_number_assignment` step is only activated after `third_reading_vote` completes with `APPROVED`. An `archive` step also conditionally routes to `newspaper_publication` before archiving if the ordinance has a penalty clause.

| ID | from step | outcome_filter | to step | Guards | Then | Source |
|---|---|---|---|---|---|---|
| ORD-V01 | `second_reading_vote` | `APPROVED` | `third_reading_vote` | Second Reading approved; ordinance proceeds to Third Reading (no amendments path diverges here — Third Reading is always required) | `third_reading_vote` activated | H1 §6; K2-context §3.2 |
| ORD-V02 | `second_reading_vote` | `RETURNED_FOR_REVISION` | `amendments_logging` | Amendments at Second Reading | `amendments_logging` activated (same as Resolution) | H1 §6; K2-context §3.2 |
| ORD-V03 | `second_reading_amended_vote` | `APPROVED` | `third_reading_vote` | Amended version approved at Second Reading; Third Reading on amended version | `third_reading_vote` activated | H1 §6 |
| ORD-V04 | `third_reading_vote` | `APPROVED` | `final_number_assignment` | SP Secretary records `APPROVED` at Third Reading | `final_number_assignment` activated; final number assigned here (not after Second Reading) | H1 §6; K2-context §3.2 |
| ORD-V05 | `third_reading_vote` | `REJECTED` | `end_rejected_at_vote` | SP Secretary records `REJECTED` at Third Reading | Termination; instance → `Completed`; document → `Cancelled` | H1 §6; K2-context §3.2 |
| ORD-V06 | `archive` | — (conditional: `requires_publication = true` and no publication date recorded) | `newspaper_publication` | Ordinance has penalty clause; publication date not yet recorded | `newspaper_publication` step activated before archive finalizes | H1 §6; K2-context §3.2 |
| ORD-V07 | `archive` | — (conditional: `requires_publication = false` or publication date already recorded) | direct archive completion | Ordinance has no penalty clause; OR penalty clause but publication already recorded | Archive completes normally without `newspaper_publication` | H1 §6; K2-context §3.2 |
| ORD-V08 | `panlalawigan_review` | `OPERATIVE_IN_ITS_ENTIRETY` | `portal_publication` | Appropriation Ordinance only; SP Secretary records `OPERATIVE_IN_ITS_ENTIRETY` | Treated identically to `VALID`; `portal_publication` activated; context key `panlalawigan_outcome = 'OPERATIVE_IN_ITS_ENTIRETY'` set | H1 §7; K2-context §3.3 |

### 10.2 SP Ordinance — Additional Invalid Transitions (ORD-I)

| ID | Attempted Transition | Guard Violated | Expected Outcome | Source |
|---|---|---|---|---|
| ORD-I01 | `final_number_assignment` activated after `second_reading_vote` (i.e., Third Reading skipped for an Ordinance) | No transition rule from `second_reading_vote → final_number_assignment` exists in the Ordinance definition; `third_reading_vote` is `legally_mandated: true` | Must throw at publish time; no runtime path exists | K2-context §3.2, §12 |
| ORD-I02 | `second_reading_vote` → `final_number_assignment` for an Ordinance (SP Resolution rule erroneously applied) | Ordinance definition has no such rule | Must throw; transition evaluation finds no matching rule → instance goes `Stuck` | K2-context §3.2 |
| ORD-I03 | `newspaper_publication` skipped for a penalty ordinance with no recorded publication date | `legally_mandated: true` for penalty ordinances; no path bypasses it when `requires_publication = true` | Must throw at publish time if bypass rule added; no runtime path exists | K2-context §3.2, §12 |

### 10.3 Appropriation Ordinance — Delta Tests (APP-V, APP-I)

| ID | Scenario | Expected Behavior | Source |
|---|---|---|---|
| APP-V01 | `panlalawigan_review` outcome `OPERATIVE_IN_ITS_ENTIRETY` on an Appropriation Ordinance | Treated identically to `VALID`; routes to `portal_publication`; `final_outcome_check` `TRUE` branch taken; `APPROVED_AND_RELEASED` termination | H1 §7; K2-context §3.3 |
| APP-V02 | `archive` step for an Appropriation Ordinance | `requires_publication` is always `false` on Appropriation Ordinances; `newspaper_publication` step is absent from the definition; archive completes directly | H1 §7.1 |
| APP-I01 | `OPERATIVE_IN_ITS_ENTIRETY` outcome submitted for a regular SP Ordinance (not an Appropriation Ordinance) | Behavior must be defined; K2-context §8 speculates `[Speculation — K2-context §8]`: "likely: invalid input; throw." This is K2-context's own framing, not a confirmed engine contract — the test should assert that the engine does not silently accept and route it as equivalent to `VALID` | K2-context §3.3, §8 |

---

### 10.4 Appropriation Ordinance — Additional Invalid Transitions (APP-I)

| ID | Attempted Transition | Guard Violated | Expected Outcome | Source |
|---|---|---|---|---|
| APP-I01 | [Decision — ADR-02] `panlalawigan_review` step active on an **Appropriation Ordinance** instance; Secretariat submits `OPERATIVE_IN_ITS_ENTIRETY` | *(valid for Appropriation Ordinance — this is not an error)* | Not an invalid transition — see PANLA-11 for the valid case. APP-I01 is superseded by PANLA-15 which covers the invalid case (non-Appropriation document). | ADR-02 |
| APP-I02 | [Decision — ADR-02] `panlalawigan_review` step active on a **non-Appropriation** instance (SP Resolution or SP Ordinance); Secretariat submits `OPERATIVE_IN_ITS_ENTIRETY` | `OPERATIVE_IN_ITS_ENTIRETY` is only valid for `document_type = 'appropriation_ordinance'` (B4 §4.2) | Must throw; proposed error `OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE`; step remains `Active`; no context keys set; no transition fires | K2-context §3.3; B4 §4.2; ADR-02 |

## 11. Multi-Referral Completion Conditions (MREF)

Source: K2-context §4; H1 §5.2 (step 4), §5.3 (rules 4–6); B4 §4.3, §8 (invariants 2, 7); D3 §3.3 (Active→Completed sub-point c), §3.4.

| ID | Scenario | Given | Expected Outcome | Source |
|---|---|---|---|---|
| MREF-01 | Normal completion — all committees sign | `committee_referral` step is `Active`; all assigned committees have submitted contributions; SP Secretary accepts the unified report | `committee_referral` completes with `REPORT_ACCEPTED`; `second_reading_vote` activated | K2-context §4; H1 §5.3 rule 4; D3 §3.3 |
| MREF-02 | Only some committees submitted (no override) | `committee_referral` step is `Active`; committee A submitted; committee B has not; no `SECRETARY_ADVANCED` action taken | Step must not complete; `second_reading_vote` must not activate; step remains `Active` | K2-context §4 |
| MREF-03 | Unified report exists but SP Secretary has not yet accepted it | All committees submitted contributions; unified report assembled; SP Secretary has not clicked Accept | Step must not complete; remains `Active` | K2-context §4 |
| MREF-04 | SP Secretary manual override — all committees present | SP Secretary invokes override with mandatory non-empty comment; all committees have in fact submitted | `committee_referral` completes with `SECRETARY_ADVANCED`; mandatory comment recorded; dedicated audit event written; `second_reading_vote` activated | K2-context §4; H1 §5.3 rule 5 |
| MREF-05 | SP Secretary manual override — one or more committees absent | SP Secretary invokes override with mandatory non-empty comment; committee B has not submitted | `committee_referral` completes with `SECRETARY_ADVANCED`; mandatory comment recorded; dedicated audit event written; committee B flagged red in Order of Business; `second_reading_vote` activated | K2-context §4; H1 §5.3 rule 5; D3 §3.4 |
| MREF-06 | SP Secretary manual override — no comment provided | SP Secretary attempts `SECRETARY_ADVANCED` with empty or null comment | Must throw; mandatory comment is a guard condition | H1 §5.2 (step 4 `allow_secretary_advance`); K2-context §4 |
| MREF-07 | Thursday cutoff passed; no report submitted; Second Reading blocked | Thursday cutoff has elapsed; committee B has not submitted; no override; next Tuesday session arrives | Second Reading slot for this measure is blocked for the upcoming Tuesday; item marked red in Order of Business; step remains `Active` | K2-context §4, §5; D3 §3.4 |
| MREF-08 | Absent committee flag behavior | Committee B was assigned but did not attend the hearing; hearing proceeded with committee A present | Hearing proceeds; committee B is flagged "not yet submitted"; unified report requirement remains; absent committee does NOT block the hearing itself | K2-context §4 |
| MREF-09 | Red-flag is not a step state transition | Any committee is absent or past cutoff | Absent/red-flag status is a display attribute of the Order of Business view, NOT a `Skipped` or `Cancelled` step state on the `committee_referral` step itself | D3 §3.4 ("multi_referral red-flag is not a state transition") |
| MREF-10 | No committees assigned (malformed definition) | `committee_referral` step activates with empty `default_committee_roles` | `[Inference]` — Must throw or auto-complete with error; at minimum, cannot silently complete with `REPORT_ACCEPTED` | B4 §4.3 |

---
## 12. Thursday Cutoff Enforcement (THU)

Source: K2-context §5; B4 §6.2.

The `evaluateThursdayCutoffs` scheduler job runs every Thursday at 23:59:59 PHT. It is idempotent: re-running for the same cutoff window has no additional effect if `metadata.last_cutoff_evaluated_at` equals or exceeds the current cutoff timestamp. Source: B4 §6.2.

The cutoff boundary: Thursday 23:59:59 PHT (UTC+08:00) = Thursday 15:59:59 UTC. Tests fixing the timezone context to `Asia/Manila` are required. Source: B4 §6.2.

| ID | Scenario | Given | Expected Outcome | Source |
|---|---|---|---|---|
| THU-01 | All committees submit before cutoff — eligible for next Tuesday | `committee_referral` step `Active`; all committees submit by Thursday 23:59:58 PHT; scheduler job runs at Thursday 23:59:59 PHT | `metadata.second_reading_eligible_date` set to the following Tuesday (cutoff_date + 5 days); `workflow.multi_referral.second_reading_eligible` event emitted with correct `eligible_date`; `metadata.last_cutoff_evaluated_at` = cutoff timestamp | B4 §6.2 |
| THU-02 | Committee submits exactly at cutoff moment | Last committee submits at Thursday 23:59:59 PHT exactly | Per B4 §6.2 algorithm: `all_submitted_at <= cutoff_ts` is the condition; exact cutoff moment is boundary — `[Inference]` "at or before" means 23:59:59 is the last eligible second; test should cover this boundary explicitly | B4 §6.2 |
| THU-03 | One or more committees miss cutoff | `committee_referral` step `Active`; committee A submitted; committee B has not submitted by Thursday 23:59:59 PHT | `metadata.thursday_cutoffs_missed += 1`; `metadata.last_cutoff_evaluated_at` = cutoff timestamp; `workflow.multi_referral.cutoff_missed` event emitted with `missing_committee_ids = [committee_B_id]`; `second_reading_eligible_date` remains `null`; Order of Business excludes this measure for next Tuesday | B4 §6.2 |
| THU-04 | Document submitted on Wednesday; included in next Tuesday OoB | Document logged to Secretariat on Wednesday of week N before Thursday cutoff | Document is eligible for next Tuesday (week N+1) Order of Business | K2-context §5 |
| THU-05 | Document submitted on Friday; not in next Tuesday OoB | Document logged on Friday of week N (after Thursday cutoff for that week) | Document is NOT eligible for Tuesday week N+1; eligible for Tuesday week N+2 | K2-context §5 |
| THU-06 | Committee report submitted on Wednesday → eligible next Tuesday | Committee submits report Wednesday of week N; cutoff for week N falls Thursday; `evaluateThursdayCutoffs` runs Thursday 23:59:59 | `second_reading_eligible_date` = following Tuesday; event emitted | K2-context §5; B4 §6.2 |
| THU-07 | Committee report submitted Saturday → not eligible next Tuesday | Committee submits on Saturday of week N (after Thursday cutoff); scheduler evaluates next Thursday | `second_reading_eligible_date` NOT set for the immediately following Tuesday; set for Tuesday of the week after committee submits (two weeks out from original cutoff) | K2-context §5 |
| THU-08 | Two-committee `multi_referral`: one submits by cutoff, one does not | Committee A submitted by Thursday; committee B has not | Second Reading blocked for next Tuesday; both committees' status correctly reflected: A submitted, B flagged `missed = false` vs `missed = true`; `cutoff_missed` event contains only committee B in `missing_committee_ids` | K2-context §5; B4 §6.2 |
| THU-09 | Idempotency: scheduler job runs twice for same cutoff window | `evaluateThursdayCutoffs` fires; then fires again in the same cutoff window | Second run detects `metadata.last_cutoff_evaluated_at >= current_cutoff_timestamp`; no additional side effects; `thursday_cutoffs_missed` not incremented a second time; no duplicate events emitted | B4 §6.2 |
| THU-10 | `second_reading_eligible_date` already set; cutoff re-evaluates | `metadata.second_reading_eligible_date` is already populated; scheduler runs again | Algorithm enters `ELSE` branch; no update to `second_reading_eligible_date`; no additional event emitted | B4 §6.2 |
| THU-11 | Cutoff defined in PHT; test in UTC | Test fixture sets timezone context to `Asia/Manila`; Thursday 23:59:59 PHT = Thursday 15:59:59 UTC | Cutoff computation uses PHT as primary; UTC equivalent is a cross-check only, not the primary comparison | B4 §6.2 |

---

## 13. Certified Urgent Bypass Path (CU)

Source: K2-context §6; B4 §6.1; H1 §2.4; H1 §5.3 rule 6.

The Certified Urgent bypass is triggered by the event `documents.certification_urgency.logged`. It fires a bypass on the `committee_referral` step for each associated instance. Three cases exist at the engine level (B4 §6.1): Case A (`Active` step), Case B (`Pending` step), Case C (step already past referral). A fourth case handles inactive instances.

| ID | Scenario | Given | Expected Outcome | Source |
|---|---|---|---|---|
| CU-01 | Standard path — no Certification | Measure workflow active; no Certification of Urgency logged | `committee_referral` step is `Active`; requires committee submissions and SP Secretary acceptance; `second_reading_vote` does not activate until step completes normally | K2-context §6 |
| CU-02 | Case A — bypass when `committee_referral` is `Active` | `documents.certification_urgency.logged` event fires; `committee_referral` step is `Active` on the associated instance | Step transitions to `Skipped` (B4: `bypassed`); `bypassed_at = NOW()`; `bypassed_by = null` (system); `bypass_reason = 'CERTIFIED_URGENT'`; `outcome = 'BYPASSED_CERTIFIED_URGENT'`; `workflow.step.bypassed` event emitted; `workflow.certification_urgency.bypass_applied` event emitted; transition evaluation fires; `second_reading_vote` activated via rule 6 transition rule; `instance.context.certified_urgent = true`; `certified_urgent_document_id` set | B4 §6.1; H1 §5.3 rule 6 |
| CU-03 | Case B — bypass when `committee_referral` is `Pending` | `documents.certification_urgency.logged` fires; `committee_referral` step has not yet been activated (`Pending`) | Deferred bypass flag set; `workflow.certification_urgency.bypass_deferred` event emitted; when the step would normally activate, engine checks flag and executes Case A logic instead; `second_reading_vote` activates directly without referral step ever being `Active` | B4 §6.1 |
| CU-04 | Case C — bypass received after referral step already past | `documents.certification_urgency.logged` fires; `committee_referral` step already `Completed`, `Skipped`, or `Cancelled` | Engine emits `workflow.certification_urgency.already_past_referral`; no workflow state change | B4 §6.1 |
| CU-05 | Bypass on inactive instance | `documents.certification_urgency.logged` fires; associated instance is `Completed`, `Cancelled`, or `Stuck` | Engine emits `workflow.certification_urgency.already_inactive`; no workflow state change | B4 §6.1 |
| CU-06 | Single Certification covering two measures | One `documents.certification_urgency.logged` event with two `associated_instance_ids` | Both instances processed independently; both `committee_referral` steps bypassed; each instance has `certified_urgent_document_id` set to the same certification document; one Certification record attached to each measure individually | K2-context §6; B4 §6.1 |
| CU-07 | Certification has no standalone number | Certification of Urgency document logged | No separate certification number is assigned; certification is attached to each associated measure, not filed independently | K2-context §6 |
| CU-08 | Certification logged after `multi_referral` already started (Case A) | `committee_referral` step is `Active`; one committee has already submitted | Engine executes Case A bypass immediately; committee's prior submission record is irrelevant — step goes to `Skipped` regardless of intermediate state; `BYPASSED_CERTIFIED_URGENT` outcome set | B4 §6.1 |
| CU-09 | Transition rule `BYPASSED_CERTIFIED_URGENT` absent from definition | Definition published without a `committee_referral → BYPASSED_CERTIFIED_URGENT → second_reading_vote` transition rule | Must be rejected at publish time (B4 §6.1: "admin UI enforces this at publish time"); if somehow bypassed at runtime, engine has no matching rule → instance goes `Stuck` | B4 §6.1 |
| CU-10 | [Decision — ADR-01] Revocation attempt after bypass already applied | Certified Urgent bypass has already fired (Case A or B executed); caller attempts to revoke or reverse the certification | Engine has no entry point for this operation — `engine.bypassStep` is not designed for reversal, and no other engine method supports revocation of an already-applied CU bypass. Assert: no API surface accepts a revocation call; the `committee_referral` step instance remains in `Skipped`/`bypassed` status with its original `bypass_reason = 'CERTIFIED_URGENT'` unchanged. Note: this ADR concerns the workflow engine only — any real-world procedural recourse (e.g., cancelling the instance via `engine.cancelInstance` and starting over) is outside the engine's scope | K2-context §6; ADR-01 |

---

## 14. 10-Day Mayor Lapse Timer (MAYOR)

Source: K2-context §7; B4 §6.3, §8 (invariants 3, 7).

The `evaluateMayorLapseTimers` scheduler job runs every hour via `node-cron`. The timer is started when `transmittal_letter_to_mayor` step completes and `triggers_mayor_lapse_timer: true` fires — setting `instance.context.mayor_action_deadline = NOW() + INTERVAL '10 days'`. Source: B4 §6.3.

The critical detail: `step_instance.completed_at` is set to `instance.context.mayor_action_deadline`, NOT to the scheduler run time. Source: B4 §6.3.

| ID | Scenario | Given | Expected Outcome | Source |
|---|---|---|---|---|
| MAYOR-01 | Mayor signs within window (day 5) | `mayor_review` step `Active`; Mayor records `SIGNED` on day 5 (before deadline) | Step completes with `SIGNED`; `mayor_action = 'SIGNED'`; `mayor_action_date = NOW()`; lapse timer cancelled (step already completed; scheduler skips it); `docketing` activated | K2-context §7; B4 §6.3 |
| MAYOR-02 | Mayor vetoes within window (day 3) | Mayor records `VETOED` on day 3 | Step completes with `VETOED`; `mayor_action = 'VETOED'`; `veto_override_vote` step activated | K2-context §7; B4 §6.3 |
| MAYOR-03 | Day 10 lapse — no Mayor action | `mayor_action_deadline` has elapsed; no `outcome` set; scheduler job runs | `step_instance.status = completed`; `outcome = 'LAPSED'`; `step_instance.completed_at = mayor_action_deadline` (NOT scheduler run time); `outcome_comment = 'Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47.'`; `actor_type = system`; `mayor_action = 'LAPSED'`; `mayor_action_date = mayor_action_deadline`; `workflow.approval.lapsed` event emitted with `legal_basis = 'RA 7160 Section 47'`; `docketing` activated | K2-context §7; B4 §6.3 |
| MAYOR-04 | 10-day window is calendar days only — no weekend adjustment | Timer set on Monday; deadline = 10 calendar days later (the following Thursday, including two weekends) | No adjustment for weekends or public holidays; deadline = exact TIMESTAMPTZ + 10 days; lapse fires on that date | B4 §6.3 |
| MAYOR-05 | Lapse timer does not fire if Mayor already acted | Mayor signed on day 7; scheduler runs on day 10 | Scheduler job checks `step_instance.outcome IS NOT NULL`; skips; no double-lapse | B4 §6.3 |
| MAYOR-06 | Idempotency: scheduler runs twice after lapse deadline | Lapse already fired on the first run; scheduler runs again in the same window | Step outcome already set; lock acquired; `outcome IS NOT NULL` check passes; job skips this step; no additional effects | B4 §6.3 |
| MAYOR-07 | Race condition: Mayor submits concurrent with scheduler | Mayor submits `SIGNED` at the exact moment `evaluateMayorLapseTimers` acquires lock | First transaction to commit wins; second transaction detects `outcome IS NOT NULL` after acquiring lock and skips; no double-write; both paths confirm via pessimistic locking | B4 §6.3 |
| MAYOR-08 | Veto override — 7 votes (fails) | Override vote: SP Secretary records `OVERRIDE_FAILED`; vote count = 7 | Must verify vote count < 8 threshold; `OVERRIDE_FAILED` outcome recorded; `end_vetoed_override_failed` termination activated; instance → `Completed`; document → `Cancelled` | K2-context §7, §11; B4 §6.3 |
| MAYOR-09 | Veto override — 8 votes (succeeds) | SP Secretary records `OVERRIDE_SUCCEEDED`; vote count = 8 | Vote count ≥ 8; `OVERRIDE_SUCCEEDED` accepted; `docketing` activated | K2-context §7, §11; B4 §6.3 |
| MAYOR-10 | Veto override — 9 votes (succeeds) | SP Secretary records `OVERRIDE_SUCCEEDED`; vote count = 9 | Vote count ≥ 8; `OVERRIDE_SUCCEEDED` accepted; `docketing` activated | K2-context §7 |
| MAYOR-11 | `LAPSED` submitted by human actor | Human actor (not scheduler) attempts to submit `LAPSED` outcome to `mayor_review` | Must throw `FORBIDDEN`; `LAPSED` is scheduler-only per B4 §8 invariant 3 and B4 §4.2 guard | B4 §4.2, §8 invariant 3 |
| MAYOR-12 | Timer context keys are set correctly at transmittal | `transmittal_letter_to_mayor` step completes with `triggers_mayor_lapse_timer: true` | `instance.context.mayor_transmittal_date` set to NOW(); `instance.context.mayor_action_deadline` set to NOW() + 10 days; both values are `TIMESTAMPTZ`; `mayor_review` step activated | B4 §6.3; H1 §5.2 step 10 |
| MAYOR-13 | Lapse fires and ARTA SLA continues through `Paused` | Instance auto-pauses (no active Mayor account) while `mayor_review` is pending; lapse deadline elapses during `Paused` status | ARTA SLA clock continues running during `Paused`; lapse timer still evaluates; if deadline elapses while `Paused`, scheduler should still fire lapse — `[Inference]`: B4 §6.3 job algorithm does not include an instance-status guard; it iterates on step status `active` and `outcome IS NULL` only | B4 §6.3; D3 §2.2 (Paused: ARTA note); D3 §2.4 |

---

## 15. 30-Day Panlalawigan Timer (PANLA)

Source: K2-context §8; B4 §6.4.

The `evaluatePanlalawiganTimers` scheduler job runs daily at 06:00 PHT. Idempotent. `step_instance.completed_at` is set to `panlalawigan_action_deadline`, NOT to the scheduler run time. Source: B4 §6.4.

| ID | Scenario | Given | Expected Outcome | Source |
|---|---|---|---|---|
| PANLA-01 | Panlalawigan responds VALID on day 15 | `panlalawigan_review` step `Active`; Secretariat records `VALID` on day 15 | Step completes with `VALID`; `panlalawigan_outcome = 'VALID'`; `panlalawigan_response_date = NOW()`; 30-day timer cancelled; `portal_publication` activated | K2-context §8; B4 §6.4 |
| PANLA-02 | 30-day lapse — Deemed Approved | `panlalawigan_action_deadline` elapsed; `panlalawigan_outcome` is null; scheduler runs | `step_instance.status = completed`; `outcome = 'DEEMED_APPROVED'`; `step_instance.completed_at = panlalawigan_action_deadline` (NOT scheduler time); `outcome_comment = 'Deemed approved per RA 7160 Section 56(d) — 30 calendar days elapsed with no action from the Sangguniang Panlalawigan.'`; `actor_type = system`; `panlalawigan_outcome = 'DEEMED_APPROVED'`; `panlalawigan_response_date = panlalawigan_action_deadline`; `workflow.panlalawigan.deemed_approved` event emitted with `legal_basis = 'RA 7160 Section 56(d)'`; SP Secretary notified; `portal_publication` activated | K2-context §8; B4 §6.4 |
| PANLA-03 | VALID-IN-PART: step placed in Awaiting SP Secretariat Action | Secretariat records `VALID_IN_PART`; Panlalawigan response attached | Step completes with `VALID_IN_PART`; `valid_in_part_action` activated; SP Secretary must choose one of four paths | K2-context §8; B4 §6.4 |
| PANLA-04 | VALID-IN-PART path 1: `RESOLVED_IN_PLACE` | SP Secretary records `RESOLVED_IN_PLACE` with mandatory comment | `valid_in_part_decision` routes to `portal_publication`; mandatory comment stored | K2-context §8; B4 §6.4; H1 §5.3 rule 28 |
| PANLA-05 | VALID-IN-PART path 2: `ROUTED_TO_LEGAL` | SP Secretary records `ROUTED_TO_LEGAL` | `legal_office_review` activated; Legal Officer is assignee; upon `RESOLVED_IN_PLACE`, routes to `portal_publication` | K2-context §8; B4 §6.4; H1 §5.3 rules 29, 32 |
| PANLA-06 | VALID-IN-PART path 3: `ROUTED_TO_COMMITTEE` | SP Secretary records `ROUTED_TO_COMMITTEE`; selects lead committee with mandatory comment | [Decision — ADR-03] `committee_revisions_review` activated; `instance.context.referred_committee_chair_id` set (populated at routing decision, not at original referral); resolved chair is sole assignee; upon `RESOLVED_IN_PLACE`, routes to `portal_publication` | K2-context §8; B4 §6.4; H1 §5.3 rules 30, 33; ADR-03 |
| PANLA-07 | VALID-IN-PART path 4: `REVISED_DIRECTLY` | SP Secretary records `REVISED_DIRECTLY` with mandatory comment; Secretariat implements revisions | Routes to `portal_publication` | K2-context §8; B4 §6.4; H1 §5.3 rule 31 |
| PANLA-08 | RETURNED outcome — high-priority flag; implementation stops | Secretariat records `RETURNED` | `returned_review` activated; high-priority flag set; implementation stops | K2-context §8; B4 §6.4; H1 §5.3 rule 26 |
| PANLA-09 | RETURNED → `RESOLVED_DIRECTLY` | SP Secretary records `RESOLVED_DIRECTLY` on `returned_review` with mandatory comment | Routes to `portal_publication` | H1 §5.3 rule 34; B4 §6.4 |
| PANLA-10 | RETURNED → `REPASS` | SP Secretary records `REPASS` | Routes to `end_repassed` termination; instance remains `Running` (not `Completed`); `workflow.instance.repassed` emitted; documents module sets `documents.superseded_by` on original; new document created | H1 §5.3 rule 35; D3 §2.4; ADR-014/015 |
| PANLA-11 | `OPERATIVE_IN_ITS_ENTIRETY` on Appropriation Ordinance — treated as VALID | Secretariat records `OPERATIVE_IN_ITS_ENTIRETY` on an Appropriation Ordinance | Treated identically to `VALID`; routes to `portal_publication`; `panlalawigan_outcome = 'OPERATIVE_IN_ITS_ENTIRETY'` set in context; `final_outcome_check` `TRUE` branch taken | K2-context §8; H1 §7; APP-V01 |
| PANLA-12 | Multiple SP documents in one Panlalawigan resolution batch | Panlalawigan acts on two SP documents in a single resolution; Secretariat logs each | Each document's `panlalawigan_review` step resolved independently; Panlalawigan resolution number and action date associated with each individual SP document's step record | K2-context §8 |
| PANLA-13 | `DEEMED_APPROVED` submitted by human actor | Human actor attempts to submit `DEEMED_APPROVED` to `panlalawigan_review` | Must throw `FORBIDDEN`; `DEEMED_APPROVED` is scheduler-only per B4 §4.2 and §8 invariant 3 | B4 §4.2, §8 invariant 3 |
| PANLA-14 | Timer context keys set correctly at transmission logging | `panlalawigan_transmission_logging` step completes with `triggers_panlalawigan_timer: true` | `instance.context.panlalawigan_transmission_date = NOW()`; `panlalawigan_action_deadline = NOW() + 30 days`; both `TIMESTAMPTZ`; `panlalawigan_review` step activated | B4 §6.4; H1 §5.2 step 14 |
| PANLA-15 | [Decision — ADR-02] `OPERATIVE_IN_ITS_ENTIRETY` on a non-Appropriation-Ordinance instance (SP Resolution or regular SP Ordinance) | Secretariat records `OPERATIVE_IN_ITS_ENTIRETY` against a `panlalawigan_review` step on an instance whose `document_type ≠ 'appropriation_ordinance'` | Engine rejects the submission with a validation error (proposed code: `OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE` — naming proposal pending confirmation against the engine error registry); step remains `Active`; no transition evaluation fires; no context keys set | K2-context §8; ADR-02 |

---

## 16. Version Pinning Behavior (VER)

Source: K2-context §9; B4 §7.1–7.3, §8 (invariant 1); D3 §2.4.

**Core rule:** "Version pinning is immutable. At instance creation, `instances.definition_version_id` is set to the current published version. This pin never changes except via the explicit Option B in-flight migration." Source: D3 §2.4, B4 §7.1.

**Option B preconditions** (all five must be satisfied; B4 §7.3):
1. A newer published definition version exists for the same definition.
2. A valid, unexpired City Administrator approval record exists (created within last 24 hours).
3. The caller is a Platform Administrator.
4. Migration reason is non-empty.
5. Instance status is `active`.

| ID | Scenario | Given | Expected Outcome | Source |
|---|---|---|---|---|
| VER-01 | Instance created under version 1; resolves steps from version 1 | Version 1 published; instance created; version 2 published afterward | Instance continues to resolve all steps, transition rules, conditions, and assignees from version 1 snapshot; version 2 definition is not consulted | B4 §7.1; D3 §2.4; K2-context §9 |
| VER-02 | New instance after version 2 published uses version 2 | Version 2 published; new instance created | New instance `definition_version_id = version_2_id`; resolves from version 2 | K2-context §9; B4 §7.2 |
| VER-03 | `definition_version_id` is immutable except via Option B | Any engine operation other than `engine.migrateInstance` attempts to update `definition_version_id` | Application-level guard rejects the update; B4 §8 invariant 1 | B4 §8 invariant 1 |
| VER-04 | Option B — all preconditions met | All five preconditions satisfied; `engine.migrateInstance(instanceId, targetVersionId, adminActorId, reason)` called | Instance `definition_version_id` updated to target version; `workflow.instance.migration.started` and `workflow.instance.migration.completed` events emitted; dedicated audit entries written; 24-hour reversible window begins | B4 §7.3; K2-context §9 |
| VER-05 | Option B — no 2nd-level City Administrator approval | Preconditions 1, 3, 4, 5 met; precondition 2 absent (no City Administrator approval record) | Must throw typed error `NO_ADMIN_APPROVAL`; no migration executed; no `definition_version_id` change | B4 §7.3; K2-context §9 |
| VER-06 | Option B — City Administrator approval expired | City Administrator approval record exists but was created more than 24 hours ago | Must throw `APPROVAL_EXPIRED`; precondition 2 fails | B4 §7.3 |
| VER-07 | Option B — caller is not Platform Administrator | Preconditions 1, 2, 4, 5 met; caller is Secretariat staff, not Platform Admin | Must throw; precondition 3 fails | B4 §7.3 |
| VER-08 | Option B — empty migration reason | Preconditions 1–3, 5 met; reason is empty or whitespace-only | Must throw; precondition 4 fails; B4 §8 invariant 10 | B4 §7.3, §8 invariant 10 |
| VER-09 | Option B — instance is not `active` | Instance is `Completed` or `Cancelled` | Must throw `INSTANCE_NOT_ACTIVE`; precondition 5 fails | B4 §7.3 |
| VER-10 | Option B — active step key not present in target version | Migration preconditions met; the instance's currently-active step's `step_key` does not exist in the target version | Must throw `STEP_KEY_NOT_FOUND_IN_TARGET_VERSION`; migration rejected | B4 §7.3 |
| VER-11 | Rollback within 24-hour window | Option B migration completed; rollback requested within 24 hours | `definition_version_id` reverted to prior version; `workflow.instance.migration.reversed` event emitted with `original_migration_event_id`; audit entry written | B4 §7.3; K2-context §9 |
| VER-12 | Rollback after 24-hour window | Option B migration completed; rollback requested more than 24 hours later | Must throw or require new City Administrator approval for a new migration; the 24-hour reversal window is closed | B4 §7.3; K2-context §9 |
| VER-13 | City Administrator approval consumed atomically | Valid approval record exists; Option B migration executes | Approval record consumed atomically with migration in same transaction; cannot be reused for a second migration | B4 §7.3, §8 invariant 8 |
| VER-14 | Transition rule references step from wrong version | At runtime, transition evaluation finds a rule that references a `to_step_id` from a different `definition_version_id` than the instance's pin | Must trigger `workflow.instance.stuck` rather than silently routing to the wrong version's step; B4 §8 invariant 12 | B4 §8 invariant 12 |

---

## 17. One-Active-Designation-Per-Person Constraint (DESIG)

Source: K2-context §10; B4 §9.

**Constraint:** A person cannot hold more than one active designation at any time. Enforced by application-level validation and a DB partial unique index on active `delegation_grants` per user. Source: K2-context §10; B4 §9.

**Engine interaction:** The `delegation_aware:<role_key>` assignee resolution expression resolves the role, then checks for an active delegation grant; if one exists, routes to the designated person instead. Source: B4 §9.

**No Platform Admin confirmation step.** Designation takes effect immediately upon Secretariat logging — the pre-Interview 1 design that included a confirmation step is superseded. Source: K2-context §10.

**Lifecycle:** Designation auto-expires at end date; routing returns to original authority automatically. Open-ended designations (no end date) are prohibited. Source: K2-context §10; B4 §9.

| ID | Scenario | Given | Expected Outcome | Source |
|---|---|---|---|---|
| DESIG-01 | New designation — no existing active designation | Person has no active `delegation_grant` | New `delegation_grant` record created immediately on Secretariat logging; takes effect immediately; no confirmation step required | K2-context §10 |
| DESIG-02 | Second active designation — same person | Person already has one active `delegation_grant`; attempt to create second active designation | Must throw typed error; DB partial unique index on active `delegation_grants` per user prevents insertion; no second record created | K2-context §10; B4 §9 |
| DESIG-03 | Expired prior designation — new designation succeeds | Person previously held a designation that has since expired (status = inactive) | New designation created successfully; the expired record does not count as "active" | K2-context §10 |
| DESIG-04 | Designation auto-expiry at end date | `delegation_grant` has a defined end date; end date reached | `delegation_grant` status transitions to inactive automatically; routing for affected steps returns to original authority (`delegation_aware:` resolution falls back to original role) | K2-context §10; B4 §9 |
| DESIG-05 | Early revocation by delegating authority | Delegating authority revokes active designation before end date | `delegation_grant` transitions to inactive immediately; routing returns to original authority for all in-progress steps | K2-context §10 |
| DESIG-06 | Open-ended designation (no end date) | Attempt to create a `delegation_grant` with no end date specified | Must throw; duration must always be explicit; open-ended designations are prohibited | K2-context §10; B4 §9 |
| DESIG-07 | [Decision — ADR-09] Designation created by non-original-authority | Platform Admin attempts to create a designation (not the original delegating authority — Mayor or Vice Mayor) | Must throw `UNAUTHORIZED_DESIGNATION_ISSUER` (proposed — naming proposal pending confirmation against the engine error registry; not sourced from any of the four documents); no `delegation_grant` record created | K2-context §10; ADR-09 |
| DESIG-08 | Workflow step assigned to designated person mid-workflow | Active designation for Acting Mayor exists; `mayor_review` step is activated | `delegation_aware:mayor` resolves to the designated Acting Mayor; step `assigned_to` set to Acting Mayor; Acting Mayor is the actor for that step's duration | B4 §9; K2-context §10 |
| DESIG-09 | Designation expires mid-workflow — routing returns to original authority | `mayor_review` step is `Active`; designation for Acting Mayor expires while the step is in progress | `[Inference]` — B4 §9 states "`step_instances.assigned_to` is a snapshot — authoritative for permission checks during the step's lifetime" (B4 §2.2). The snapshot was captured at activation time and does not change mid-step, even if the designation expires during the step. The test should confirm the snapshot behavior rather than assuming re-evaluation mid-step | B4 §2.2, §9; K2-context §10 |
| DESIG-10 | New step activation after designation expires | Prior step `Completed`; new step being activated after Acting Mayor designation has expired | `delegation_aware:mayor` now resolves to original Mayor (no active delegation); new step `assigned_to = original_mayor` | B4 §9; K2-context §10 |
| DESIG-11 | Step assigned during designation; designation expires; new step activation | Current step assigned to Acting Mayor; designation expires; current step completes; next step activates | Next step resolves assignee fresh at activation time; if designation now expired, routes to original authority; not to same Acting Mayor | B4 §2.2, §9; K2-context §10 |

---
## 18. Domain Events — Assertions Required

Source: B4 Appendix A.

Every test that exercises an engine operation should also assert the correct events were emitted (or were not emitted). The following table consolidates the event assertions required per the full event catalog in B4 Appendix A.

| Event | Assert Emitted When | Assert NOT Emitted When | Key Fields to Assert |
|---|---|---|---|
| `workflow.instance.created` | Successful `engine.createInstance` | Creation fails | — |
| `workflow.instance.completed` | Termination step reached | Instance cancelled without reaching termination | Correct `outcome_code` |
| `workflow.instance.cancelled` | `engine.cancelInstance` succeeds | Any other operation | `cancellation_reason` present and non-empty |
| `workflow.instance.stuck` | Transition evaluation finds no matching rule (INST-V05) | Step completes with a matching rule | — |
| `workflow.instance.repassed` | Termination with `REPASSED` outcome (RES-V35) | Any other termination outcome | Instance status remains `Running` |
| `workflow.instance.migration.started` | Option B migration initiates (VER-04) | Migration rejected due to failed precondition | — |
| `workflow.instance.migration.completed` | Option B migration succeeds | Migration fails | — |
| `workflow.instance.migration.reversed` | Rollback within 24h (VER-11) | Rollback after 24h (VER-12) | `original_migration_event_id` |
| `workflow.step.started` | Each step instance activated | — | `step_key` |
| `workflow.step.completed` | Each step completes normally | Step fails or is bypassed | `outcome`, `actor_type` |
| `workflow.step.bypassed` | Certified Urgent bypass fires (CU-02, CU-03) | Bypass rejected | `bypass_reason = 'CERTIFIED_URGENT'` |
| `workflow.step.failed` | `parallel_split` or `parallel_join` activated in Phase 1 (STEP-I16) | Any Phase 1 step type executes normally | — |
| `workflow.multi_referral.committee_submitted` | Each individual committee submits contribution | — | `committee_id` |
| `workflow.multi_referral.all_submitted` | Last committee submits; `all_submitted_at` set | Step completes via manual override | — |
| `workflow.multi_referral.cutoff_missed` | Thursday cutoff evaluates; not all submitted (THU-03, THU-08) | All submitted before cutoff | `missing_committee_ids` |
| `workflow.multi_referral.second_reading_eligible` | Thursday cutoff evaluates; all submitted before cutoff (THU-01) | Not all submitted | `eligible_date` |
| `workflow.multi_referral.secretary_advanced` | SP Secretary manual advance (MREF-04, MREF-05) | Normal `REPORT_ACCEPTED` completion | Full `metadata_snapshot` present |
| `workflow.approval.lapsed` | Mayor lapse timer fires (MAYOR-03) | Mayor acts before deadline | `legal_basis = 'RA 7160 Section 47'`; `completed_at = mayor_action_deadline` (not `NOW()`) |
| `workflow.panlalawigan.deemed_approved` | Panlalawigan 30-day timer fires (PANLA-02) | Panlalawigan acts before deadline | `legal_basis = 'RA 7160 Section 56(d)'`; `completed_at = panlalawigan_action_deadline` |
| `workflow.certification_urgency.bypass_applied` | Certified Urgent bypass executed on `Active` or deferred `Pending` step (CU-02, CU-03) | Case C or inactive instance case | — |
| `workflow.certification_urgency.bypass_deferred` | Certified Urgent received while `committee_referral` is `Pending` (CU-03) | Received while `Active` | — |
| `workflow.certification_urgency.already_past_referral` | Certified Urgent received after referral step already past (CU-04) | Referral step still pending or active | — |
| `workflow.certification_urgency.already_inactive` | Certified Urgent received for non-active instance (CU-05) | Instance is active | — |

---

## 19. Workflow Instance Context — Key Assertions

Source: B4 Appendix B.

The following context keys must be asserted at the specific lifecycle points listed. See B4 Appendix B for the complete key schema.

| Context Key | Set When | Value | Assert Still `null` When |
|---|---|---|---|
| `certified_urgent` | Certified Urgent bypass applied | `true` | No Certification logged |
| `certified_urgent_document_id` | Certified Urgent bypass applied | UUID of certification doc | No Certification logged |
| `second_reading_eligible_date` | Thursday cutoff evaluates; all submitted on time | Following Tuesday date | Not all committees submitted by cutoff |
| `mayor_transmittal_date` | `transmittal_letter_to_mayor` step completes | `NOW()` at completion | Before step completes |
| `mayor_action_deadline` | `transmittal_letter_to_mayor` step completes | `mayor_transmittal_date + 10 days` | Before step completes |
| `mayor_action` | Mayor acts or lapse fires | `SIGNED`, `VETOED`, or `LAPSED` | Before Mayor review step completes |
| `mayor_action_date` | Mayor acts (human) or lapse fires (scheduler) | `NOW()` for human action; `mayor_action_deadline` for lapse | Before step completes |
| `veto_override_vote_count` | Override vote submitted | Integer vote count | No override vote taken |
| `veto_override_outcome` | Override vote submitted | `OVERRIDE_SUCCEEDED` or `OVERRIDE_FAILED` | No override vote taken |
| `panlalawigan_transmission_date` | `panlalawigan_transmission_logging` step completes | `NOW()` at completion | Before step completes |
| `panlalawigan_action_deadline` | `panlalawigan_transmission_logging` step completes | `panlalawigan_transmission_date + 30 days` | Before step completes |
| `panlalawigan_outcome` | Secretariat records outcome or timer fires | `VALID`, `VALID_IN_PART`, `RETURNED`, `DEEMED_APPROVED`, or `OPERATIVE_IN_ITS_ENTIRETY` | Before Panlalawigan review step completes |
| `referred_committee_chair_id` | [Decision — ADR-03] SP Secretary selects lead committee at `valid_in_part_decision` → `ROUTED_TO_COMMITTEE` | User ID of the resolved chair of the selected lead committee (or the committee ID itself — implementation sub-choice deferred; see ADR-03) | Before `ROUTED_TO_COMMITTEE` path is taken; null for all other `valid_in_part_decision` paths |
| `panlalawigan_response_date` | Secretariat records manually | `NOW()` for human; `panlalawigan_action_deadline` for timer | Before Panlalawigan review step completes |

---

## 20. Engine Invariants — Consolidated Test Map

Source: B4 §8 (invariants 1–13). Each invariant below has a corresponding test or test group in an earlier section.

| B4 Invariant # | Statement | Covered By |
|---|---|---|
| 1 | `instances.definition_version_id` written once; only `engine.migrateInstance` may update it | VER-03 |
| 2 | `multi_referral` with `require_all_committee_signatures = true` cannot complete `REPORT_ACCEPTED` unless all committees have submissions or `manual_advance = true` | MREF-01 through MREF-06; RES-I01 |
| 3 | `LAPSED` and `DEEMED_APPROVED` may only be submitted with `actor_type = system` | MAYOR-11; PANLA-13; RES-I10, RES-I11 |
| 4 | Every `approval` step with `LAPSED` in `allowed_outcomes` must have an outgoing `LAPSED` transition rule | [Decision — ADR-06] PUBVAL-01; VER-10 (implicit). See §22 for PUBVAL-01 test definition. |
| 5 | No definition version may include `parallel_split` or `parallel_join` in Phase 1 | STEP-I16 |
| 6 | An instance with `status = completed` or `status = cancelled` cannot have any step activated | INST-I01, INST-I02; INST-I09 |
| 7 | SP Secretary manual advance of `multi_referral` requires non-empty `outcome_comment` | MREF-06; RES-I03 |
| 8 | Option B migration requires valid, unexpired City Administrator approval; consumed atomically | VER-04 through VER-13 |
| 9 | Termination step with `REPASSED` outcome must NOT set `instances.status = completed` | RES-V35; PANLA-10 |
| 10 | All mandatory `reason`/`comment` parameters rejected if empty or whitespace-only | RES-I03; MREF-06; VER-08; multiple others |
| 11 | Encoder and final approver of same document cannot be the same user | [Decision — ADR-04] INV11-01 (RES-I16). `vp_certification` carries `is_final_approval = true`. See §22 for test definition and rationale. |
| 12 | No outgoing transition rule may reference a `to_step_id` from a different `definition_version_id` than the instance's pin | VER-14 |
| 13 | `workflow_events` rows may only be inserted; no update or delete path | [Decision — ADR-05] INV13-01. DB-level `REVOKE UPDATE, DELETE` tested directly via `workflow_app_user` role connection. See §22 for test definition. |

**Additional publish-time validation coverage — not directly mapped to a numbered invariant row:** PUBVAL-02 ([Decision — ADR-07]) covers B4 §4.2's general rule that any `approval` step `allowed_outcomes` code missing an outgoing transition rule causes publish rejection with `MISSING_OUTCOME_TRANSITION`. This is broader than invariant 4 (which covers only the `LAPSED` outcome specifically) and the two should be tested independently to confirm the engine distinguishes the specific `MISSING_LAPSE_TRANSITION` from the general `MISSING_OUTCOME_TRANSITION`. See §22.

---

## 21. Open Items and Unverified Gaps

All nine items originally listed in this section have been resolved by K2-ADR-01 through K2-ADR-09 ([k2-workflow-engine-test-suite-design-adrs](./k2-workflow-engine-test-suite-design-adrs/)). This section is retained for traceability; the closure record and new test definitions are in §22.

| # | Topic | Original Status | Resolution |
|---|---|---|---|
| 1 | Certified Urgent revocation | `[Unverified]` | [Decision — ADR-01] Irreversible by design; CU-10 updated. |
| 2 | `OPERATIVE_IN_ITS_ENTIRETY` on non-Appropriation Ordinance | `[Speculation]` | [Decision — ADR-02] Throws `OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE` (proposed); PANLA-15 and APP-I02 updated. |
| 3 | Committee Chair assignee resolution | `[Unverified]` | [Decision — ADR-03] `actor_from_context:referred_committee_chair_id`; SP Secretary selects lead committee at routing; Phase 2 for parallel multi-committee. RES-V30/30a/30b updated. |
| 4 | Encoder ≠ final approver: which step | `[Unverified]` | [Decision — ADR-04] `vp_certification` carries `is_final_approval = true`; new test INV11-01 in §22. |
| 5 | `workflow_events` immutability test | Test coverage gap | [Decision — ADR-05] New test INV13-01 in §22. |
| 6 | `MISSING_LAPSE_TRANSITION` publish-time test | Test coverage gap | [Decision — ADR-06] New test PUBVAL-01 in §22. |
| 7 | `MISSING_OUTCOME_TRANSITION` publish-time test | Test coverage gap | [Decision — ADR-07] New test PUBVAL-02 in §22. |
| 8 | ARTA SLA test scope | Scoping question | [Decision — ADR-08] Deliberate exclusion; moved to §1 "Out of scope." |
| 9 | DESIG-07 typed error code | `[Unverified]` | [Decision — ADR-09] `UNAUTHORIZED_DESIGNATION_ISSUER` (proposed); DESIG-07 updated. |

---

## 22. ADR Merge Closure Record

This section defines the new test cases introduced by the ADR merge and records the three proposed error codes that remain naming proposals pending confirmation.

### 22.1 New Test Cases Introduced in v2

**INV11-01** [Decision — ADR-04] Encoder ≠ Final Approver — `vp_certification` step:

| Case | Given | When | Expected |
|---|---|---|---|
| INV11-01a | `vp_certification` step is `Active`; the resolved VP/Acting-VM actor's user ID equals `instance.context.created_by` | Actor attempts to submit outcome `SIGNED` | Engine rejects with `ENCODER_CANNOT_BE_FINAL_APPROVER` (proposed); step remains `Active`; `mayor_transmittal_date` and all downstream context keys unaffected; no transition fires |
| INV11-01b (companion) | `vp_certification` step is `Active`; actor's user ID does **not** equal `instance.context.created_by` | Actor attempts to submit outcome `SIGNED` | Succeeds normally per RES-V14; no rejection |

Source: B4 §8 invariant 11; ADR-04. Note: `instance.context.created_by` is the actor ID of the caller who invoked `engine.createInstance` (set by the engine at instance creation, per B4 §2.2).

---

**INV13-01** [Decision — ADR-05] `workflow_events` immutability — DB-level enforcement:

| Case | Given | When | Expected |
|---|---|---|---|
| INV13-01a | A `workflow_events` row exists (created via normal `engine.submitStepAction` or similar) | Test connects as `workflow_app_user` (the same DB role the application uses, **not** a superuser/migration role) and attempts `UPDATE workflow.workflow_events SET ... WHERE id = ...` | Database rejects with a permissions error (Postgres error code `42501 insufficient_privilege`); no application-level error — the DB itself enforces this |
| INV13-01b (companion) | Same setup | `DELETE FROM workflow.workflow_events WHERE id = ...` attempted as `workflow_app_user` | Same DB-level rejection |

Source: B4 §8 invariant 13; ADR-05.

---

**PUBVAL-01** [Decision — ADR-06] `MISSING_LAPSE_TRANSITION` publish-time validation:

| Case | Given | When | Expected |
|---|---|---|---|
| PUBVAL-01a | Draft definition version; `mayor_review` step config includes `LAPSED` in `allowed_outcomes`; no transition rule exists with `from_step_key = 'mayor_review'`, `outcome_filter = 'LAPSED'` | Platform Administrator attempts to publish this version | Publish rejected with `MISSING_LAPSE_TRANSITION`; version remains unpublished; `definition_versions.status` unchanged |
| PUBVAL-01b (negative control) | Same definition, but the `LAPSED → docketing` transition rule is present and correctly formed | Platform Administrator attempts to publish | Publish succeeds |

Source: B4 §8 invariant 4; ADR-06.

---

**PUBVAL-02** [Decision — ADR-07] `MISSING_OUTCOME_TRANSITION` publish-time validation:

| Case | Given | When | Expected |
|---|---|---|---|
| PUBVAL-02a | Draft definition version; `second_reading_vote` step config includes `REJECTED` in `allowed_outcomes`; no transition rule with `outcome_filter = 'REJECTED'` exists from that step, and no unconditional default rule exists | Platform Administrator attempts to publish | Publish rejected with `MISSING_OUTCOME_TRANSITION` |
| PUBVAL-02b (negative control) | Same definition, but the `REJECTED → end_rejected_at_vote` rule (RES-V09) is present | Platform Administrator attempts to publish | Publish succeeds |
| PUBVAL-02c (PUBVAL-01 vs PUBVAL-02 disambiguation) | Definition violates **only** the `LAPSED` rule (no `LAPSED` transition for a step that lists `LAPSED` in `allowed_outcomes`) | Platform Administrator attempts to publish | Engine returns `MISSING_LAPSE_TRANSITION`, not the generic `MISSING_OUTCOME_TRANSITION`; confirms the engine emits the more-specific error when applicable |

Source: B4 §4.2; ADR-07. Relationship to PUBVAL-01: `MISSING_LAPSE_TRANSITION` is a stricter named special case of this general rule; both validations run independently at publish time.

---

### 22.2 Proposed Error Codes — Pending Confirmation

Three error code names introduced in this ADR merge are **naming proposals**, not confirmed engine contracts. Each follows the existing `SCREAMING_SNAKE_CASE`, semantically-descriptive convention (B4 §8: `NO_ACTIVE_VERSION`, `MISSING_OUTCOME_TRANSITION`, `COMMENT_REQUIRED`, etc.), but none of the four source documents names them. They must be confirmed against any authoritative engine error registry before being treated as final.

| Proposed Code | ADR | Used In | Notes |
|---|---|---|---|
| `OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE` | ADR-02 | PANLA-15, APP-I02 | Confirms K2-context §8's "likely: invalid input; throw" speculation as the real contract |
| `ENCODER_CANNOT_BE_FINAL_APPROVER` | ADR-04 | INV11-01a | Named to distinguish from generic `FORBIDDEN`; specific to invariant 11's encoder/final-approver constraint |
| `UNAUTHORIZED_DESIGNATION_ISSUER` | ADR-09 | DESIG-07 | Named to distinguish from bare `FORBIDDEN` (already used for actor-authorization failures in B4 §4.1–4.2); this is a different failure class: wrong category of authority entirely |

### 22.3 H1 Cross-Reference Note

H1 §4's `COMMITTEE_CHAIR` assignee string (`"instance_aware:committee_chair_of_referred_committee"`) is a placeholder that does not appear in B4 §3.5's actual grammar. [Decision — ADR-03] it should be corrected in H1 to `"actor_from_context:referred_committee_chair_id"` (or equivalent context key name, pending the implementation sub-choice noted in ADR-03). The `[Unverified]` / `[Extension]` comment block in H1 §4 for this entry should be replaced with a reference to ADR-03. This note is informational — it is an H1 edit, not a K2 edit.

---

*End of K2 v2. Workflow Engine Test Suite Design.*
