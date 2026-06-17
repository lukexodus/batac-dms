# K1 — Test Strategy: Pre-Development Baseline

**Document:** K1  
**Platform:** Batac City LGU Platform  
**Status:** Pre-development reference — must be read before the first test file is written  
**Last Updated:** June 2026  
**Audience:** Development team  
**Source Documents:** `2-stack-context.md`; `consolidated-architecture-and-requirements-reference-iteration-3.md` (Iteration 3); `b4-workflow-engine-specification.md`

---

## 1. Purpose

This document defines the testing strategy for the Batac City LGU Platform. It formalizes the testing priorities stated in `2-stack-context.md`, assigns each test category to the correct tool and layer, and provides concrete guidance on what must be tested, what must not be chased, and how the test environment is structured.

It does not define individual test cases. It defines the scope, layer boundaries, and priorities that govern all test authoring decisions.

---

## 2. Guiding Principles

**Test what is expensive to get wrong, not what is easy to cover.** The workflow engine governs legally mandated legislative processes under RA 7160. A missed state transition or an unenforced invariant is not a bug — it is a legal process failure. The engine's state machine is the highest-value test target in the codebase and is treated as such.

**Priority over coverage.** There are no line-coverage targets for this project. Coverage metrics are not tracked in CI. Pursuing high unit coverage of CRUD modules is an explicit anti-goal and a waste of development time. Coverage tooling may be enabled for informational purposes only; it must never gate a merge or deployment.

**Layer integrity.** Each test category has a defined tool, scope, and responsibility boundary. A test that belongs in integration tests must not be written as a unit test (it would be mocking too much to be meaningful) and must not be written as an E2E test (it would be too slow and fragile to run in CI on every PR). Boundary decisions are explicit in Section 5 through Section 7.

**Determinism is a prerequisite for meaningful tests.** The workflow engine's design principle is deterministic execution: given the same state and inputs, it always produces the same outputs. Tests must verify determinism, not undermine it. Time-dependent logic (timers, deadlines, SLA calculations) must always receive explicit timestamps as parameters — never `NOW()` or `Date.now()` injected from inside the function under test.

**Invariants are not optional.** The thirteen engine invariants defined in B4 Section 9 are not implementation suggestions. Each one must have at least one test that proves the invariant is enforced and at least one test that proves a violation is rejected with the correct typed error. These tests belong in the integration layer.

---

## 3. Testing Stack

|Tool|Role|
|---|---|
|Vitest|Unit tests and integration tests (single runner; test type distinguished by file location and setup)|
|Playwright|E2E tests (see K3)|
|`@fastify/inject` (built-in)|HTTP-layer integration tests for all ABAC-protected Fastify routes without a network|
|`pg` / test container or dedicated test DB|Live PostgreSQL instance for integration tests|
|`pgboss` test mode or time-mocked jobs|Scheduler job unit testing|

**No mocking of the PostgreSQL layer in integration tests.** Integration tests run against a real PostgreSQL instance seeded with known fixture data. Mocking the database in integration tests produces tests that verify the mock, not the system.

**No mocking of the workflow engine in E2E tests.** The engine is not stubbed out during Playwright tests. If the engine is broken, E2E tests must fail.

---

## 4. Priority Order

The following order is not a suggestion. It determines where time is invested and what is written first.

**Priority 1 — Workflow engine state machine.** Every valid state transition and every invalid transition (invariant violation) for every Phase 1 step type. This is the most important test surface in the codebase. The engine governs legally mandated process steps; errors here are process failures.

**Priority 2 — API integration tests for ABAC-protected routes.** All Fastify routes that enforce role-based and attribute-based access control are tested with `fastify.inject()` against a real database with real role fixtures. The authorization model must be verified at the route level, not by reading the permission table in unit tests.

**Priority 3 — E2E tests for critical user journeys.** A small set of Playwright tests covering the five or six most important end-to-end paths. Defined in K3. Written after Priority 1 and Priority 2 are stable.

---

## 5. Layer 1 — Vitest Unit Tests

### 5.1 What Belongs Here

Unit tests cover logic that can be meaningfully verified in isolation: pure functions, state machine transition logic, Zod schema validation rules, and JSONLogic expression evaluation. No database connection. No Fastify server. No network.

**In:** Service-layer pure functions that take inputs and return outputs or throw typed errors. State transition functions. Schema validators. Date/time computation functions. JSONLogic evaluators.

**Not in:** Anything that requires a database write to verify. Anything that requires a Fastify route to exercise. Anything that requires module event bus wiring. Those belong in integration tests.

### 5.2 Workflow Engine — State Machine Transitions

This is the highest-priority test surface. Unit tests cover the transition logic itself (the algorithm in Section 3.4 of B4) as a pure function. Integration tests (Section 6) verify the same paths with real database commits. Both layers are required; neither substitutes for the other.

#### 5.2.1 Transition Evaluation Logic

The `evaluateTransitionRules` function takes `(rules, stepOutcome, instanceContext)` and returns the winning `to_step_id` or throws `NO_MATCHING_TRANSITION`. This function is pure and sandboxed. Tests must cover:

- Rule with no `outcome_filter` and no `condition_expression` always matches (unconditional default).
- Rule with `outcome_filter` set only matches when `stepOutcome === outcomeFilter`.
- Rule with `outcome_filter` set does not match when `stepOutcome !== outcomeFilter`.
- Rules are evaluated in ascending `priority` order; first match wins even if later rules also match.
- `condition_expression` (JSONLogic) with a truthy context result matches.
- `condition_expression` (JSONLogic) with a falsy context result does not match.
- `condition_expression` referencing an undefined context key evaluates to `null` (falsy), not an error.
- When no rule matches: throws or returns a typed error that will cause the engine to set `instance.status = stuck`.
- Multiple rules with the same `priority` value: behaviour must be documented and tested (document the tiebreak — e.g., insertion order); the function must not be non-deterministic.

#### 5.2.2 `action` Step Completion

- Completion sets `status = completed`, `outcome = DONE`, `completed_at = <provided timestamp>`.
- Actor not in `assigned_to` → `FORBIDDEN` error.
- Step not in `active` status → `CONFLICT` error.
- `require_comment = true` with empty or whitespace-only comment → `VALIDATION_FAILED` error.
- `auto_complete = true`: step completes on activation with `actor_type = system`; no actor required.

#### 5.2.3 `approval` Step Completion

- Each outcome in `allowed_outcomes` results in `status = completed`, `outcome = <value>`, and transition evaluation fired.
- Outcomes not in `allowed_outcomes` are rejected before any state change.
- `LAPSED` and `DEEMED_APPROVED` submitted with `actor_type = user` → `FORBIDDEN` (scheduler-only guard from B4 Section 4.2).
- `LAPSED` and `DEEMED_APPROVED` submitted with `actor_type = system` → accepted.
- Outcome in `require_comment_on` with empty comment → `VALIDATION_FAILED`.
- `is_final_approval = true` in config AND `actor_id === instance.context.created_by` → `FORBIDDEN` (encoder ≠ final approver, Invariant 11).
- Every outcome in `allowed_outcomes` must have at least one outgoing transition rule; this is validated at publish time (Invariant 4 / `MISSING_OUTCOME_TRANSITION`).

#### 5.2.4 `multi_referral` Step

This is the most complex step type. Every branch of its behaviour contract (B4 Section 4.3) requires a dedicated unit test.

**Committee submission:**

- First committee submission: appended to `metadata.submissions`; `metadata.all_submitted_at` remains null.
- Last committee submission: appended; `metadata.all_submitted_at` set to the submission timestamp; `workflow.multi_referral.all_submitted` event scheduled.
- Duplicate submission from same committee (already has a submission entry): rejected or idempotent — document the decision and test it.
- Submission after `metadata.all_submitted_at` is set: same as duplicate — document and test.

**Normal completion path:**

- `REPORT_ACCEPTED` outcome: only reachable after all committees have entries in `metadata.submissions` OR `metadata.manual_advance = true`. Attempting `REPORT_ACCEPTED` without these conditions → `VALIDATION_FAILED` or `FORBIDDEN`.
- `REPORT_ACCEPTED` sets `status = completed`, writes `second_reading_eligible_date` to instance context.

**Secretary manual advance:**

- `SECRETARY_ADVANCED` outcome with non-empty comment: succeeds; missing committees receive `missed = true` entries; `metadata.manual_advance = true`; `metadata.manual_advance_by` set.
- `SECRETARY_ADVANCED` outcome with empty or whitespace-only comment → `COMMENT_REQUIRED` error (Invariant 7).
- `allow_secretary_advance = false` in config: `SECRETARY_ADVANCED` outcome is rejected regardless of comment.

**Runtime committee list override:**

- Modification before any submission: succeeds; modifications are audit-logged.
- Modification after the first submission is received: requires `bypassStep` with mandatory comment; direct modification rejected.

#### 5.2.5 `decision` Step

- `condition_expression` evaluates truthy: `outcome = true_outcome`, step completes immediately with `actor_type = system`.
- `condition_expression` evaluates falsy: `outcome = false_outcome`.
- `auto_complete` is always `true` for `decision` steps; the engine must not allow this to be disabled by configuration.
- Undefined context key in expression: evaluates to `null` (falsy), not an error.
- `condition_expression` is pure and sandboxed: it has no access to the database, no I/O, no side effects.

#### 5.2.6 `notification` Step

- Enqueues notification to the `notifications` module; sets `status = completed`, `outcome = DISPATCHED`, `actor_type = system`.
- Delivery failure in the notifications module does not roll back or fault the step.
- Completes immediately on activation; transition evaluation fires.

#### 5.2.7 `termination` Step

- Sets `instances.status = completed` and `instances.completed_at`.
- Applies `final_document_status` to the document via the event bus.
- `outcome_code = REPASSED`: instance status is **not** set to `completed`; stays `active`; `workflow.instance.repassed` is emitted; no new step instance is created. This is Invariant 9 — it must be tested explicitly.
- `outcome_code = CANCELLED`: all active step instances are set to `status = cancelled` in the same transaction before the instance is cancelled. Empty `cancellation_reason` → rejected (Invariant 10).

#### 5.2.8 Phase 2 Guard for `parallel_split` and `parallel_join`

- A definition version containing a `parallel_split` or `parallel_join` step is rejected at publish time with `STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1` (Invariant 5).
- If one of these step types reaches activation at runtime (e.g., from a migrated definition that bypassed the publish guard): engine emits `workflow.step.failed` and sets the instance to `stuck`. This path must be testable — the runtime guard is a failsafe.

### 5.3 Workflow Engine — Special Control Flows

#### 5.3.1 Certified Urgent Bypass (B4 Section 6.1)

All three cases must have unit tests covering the state machine logic (context mutation and step instance status changes). Integration tests (Section 6.4) verify the database commits.

- **Case A — `multi_referral` step is `active`:** Step set to `bypassed`; `bypass_reason = 'CERTIFIED_URGENT'`; `context.certified_urgent = true`; `context.certified_urgent_document_id` set; `workflow.step.bypassed` event emitted; transition evaluation fires on `outcome_filter = 'BYPASSED_CERTIFIED_URGENT'`.
- **Case B — `multi_referral` step is `pending` (not yet activated):** Deferred bypass flag is written. When the step would activate, bypass is applied instead. The pending bypass mechanism must be tested as a two-phase operation: write the flag, then verify the flag is consumed correctly on activation.
- **Case C — `multi_referral` step already `completed` or `bypassed`:** `workflow.certification_urgency.already_past_referral` emitted; no state change; no error.
- **Instance not active:** `workflow.certification_urgency.already_inactive` emitted; bypass skipped; no error.
- A single Certification covering multiple instance IDs: the bypass sequence runs independently and correctly for each instance.

#### 5.3.2 Thursday Cutoff and Second Reading Delay (B4 Section 6.2)

The `evaluateThursdayCutoffs` job and the `computeSecondReadingEligibleDate` function must be unit tested with explicit timestamp inputs. Do not use wall-clock time in these tests.

- All committees submitted before Thursday 23:59:59 PHT → `second_reading_eligible_date` = the following Tuesday (Thursday + 5 days).
- At least one committee not submitted at Thursday 23:59:59 PHT → `thursday_cutoffs_missed` incremented; `second_reading_eligible_date` not set; `workflow.multi_referral.cutoff_missed` emitted.
- `second_reading_eligible_date` already set (subsequent job run) → no-op; idempotency verified.
- `metadata.last_cutoff_evaluated_at` equals the current cutoff timestamp → job skips this step instance; idempotency.
- Worked examples from B4 Section 6.2 are each a required test case:

|Scenario|Expected `second_reading_eligible_date`|
|---|---|
|All submitted Monday Week N 08:00|Tuesday Week N+1|
|All submitted Thursday Week N 15:00|Tuesday Week N+1|
|All submitted Thursday Week N 23:59:58|Tuesday Week N+1|
|All submitted Thursday Week N 23:59:59 (exact cutoff)|Tuesday Week N+2|
|All submitted Friday Week N 09:00|Tuesday Week N+2|

#### 5.3.3 10-Day Mayor Lapse Timer (B4 Section 6.3)

The `evaluateMayorLapseTimers` job function must receive timestamps as inputs.

- `mayor_action_deadline < NOW()` and `step_instance.outcome IS NULL` → lapse fires: `outcome = LAPSED`, `completed_at = mayor_action_deadline` (not the detection time), `actor_type = system`, context updated, `workflow.approval.lapsed` emitted.
- `step_instance.outcome IS NOT NULL` (Mayor acted before lapse fires) → lapse skipped; no state change.
- Race condition simulation: after lock acquisition, check reveals outcome already set → skip (the post-lock re-check guard).
- `completed_at` is set to `mayor_action_deadline`, not the current time of the job run. This distinction must be explicitly asserted.
- Legal basis string on the emitted event: `'RA 7160 Section 47'`.
- `LAPSED` submitted by a user actor → `FORBIDDEN` (scheduler-only guard).

#### 5.3.4 30-Day Panlalawigan Timer (B4 Section 6.4)

Mirrors the Mayor lapse tests. The `evaluatePanlalawiganTimers` job:

- `panlalawigan_action_deadline < NOW()` and `context.panlalawigan_outcome IS NULL` → `DEEMED_APPROVED` fires: `outcome = DEEMED_APPROVED`, `completed_at = panlalawigan_action_deadline`, `actor_type = system`, legal basis `'RA 7160 Section 56(d)'`.
- `context.panlalawigan_outcome IS NOT NULL` → deemed-approval skipped.
- `completed_at` is set to `panlalawigan_action_deadline`, not detection time.
- `DEEMED_APPROVED` submitted by a user actor → `FORBIDDEN`.
- Post-lock re-check guard functions correctly.

### 5.4 Workflow Engine — Invariant Rejection Tests

Each of the thirteen invariants from B4 Section 9 must have a unit or integration test proving the rejection. The following are suitable for unit tests (no database required):

|Invariant|Test|
|---|---|
|2|`multi_referral` with `require_all_committee_signatures = true` cannot produce `REPORT_ACCEPTED` unless all committees have submissions or `manual_advance = true`|
|3|`LAPSED` and `DEEMED_APPROVED` outcomes rejected when `actor_type ≠ system`|
|7|`SECRETARY_ADVANCED` outcome rejected when `outcome_comment` is empty or whitespace|
|9|`outcome_code = REPASSED` on a termination step must not set `instances.status = completed`|
|10|All entry points accepting a `reason` or `comment` reject the call when the value is empty or whitespace|
|11|Final approver cannot be the document's creator; same-user check rejects before any DB write|

The remaining invariants (1, 4, 5, 6, 8, 12, 13) require database state to verify meaningfully and belong in integration tests (Section 6.5).

### 5.5 Pure Service-Layer Functions

The following functions are pure (or made pure by explicit timestamp injection) and belong in unit tests.

**Assignee resolution (`resolveAssignee`):**

- `role:<role_key>` → returns all users holding the role (from a provided role map, not live DB).
- `office_role:<office_key>:<role_key>` → returns the user holding that role in that specific office.
- `delegation_aware:<role_key>` → resolves the role, then substitutes the designated person if an active delegation grant exists for the original user.
- `actor_from_context:<context_key>` → returns the user ID stored at that context key.
- `static:<user_id>` → returns the provided UUID.
- Delegation chain test: user A has an active delegation to user B; `delegation_aware` resolves to user B, not user A.
- No active delegation: `delegation_aware` resolves to the original role holder.

**SLA deadline computation (`computeSlaDeadline`):**

- Simple transaction: `started_at + 3 working days` where working days exclude Saturdays, Sundays, and provided holidays.
- Complex transaction (SP Resolutions, Ordinances default): `started_at + 7 working days`.
- A public holiday on a Wednesday in the calculation window: deadline shifts by one additional working day.
- SLA threshold of zero working days: the deadline equals `started_at` (edge case).

**SLA breach thresholds (`computeSlaElapsedPercent`):**

- At 0%: no threshold crossed.
- At exactly 80%: warning threshold crossed; at 80.001%: same.
- At exactly 100%: breach threshold.
- At exactly 150%: critical threshold.

**Eligible Tuesday computation (extracted from cutoff job):** Already covered in Section 5.3.2 worked examples.

**Mandatory comment validation:** Any function that implements the `require_comment` and `require_comment_on` rules must have tests for empty string, whitespace-only string, and non-empty string against each configuration.

### 5.6 Zod Schema Validations

Zod schemas in `/packages/shared` are the single source of truth for all data contracts. Each schema must have tests for:

- Valid input → parses without error.
- Invalid input (missing required field) → parse fails with the field identified in the error.
- Invalid input (wrong type) → parse fails.
- Edge cases specific to the domain (e.g., `series_number_final` must not have the `Draft` prefix when set as final; `city_id` must be a valid UUID v4; `TIMESTAMPTZ` strings must parse as valid dates).

Priority schemas requiring explicit test coverage:

- `WorkflowInstanceContext` (Appendix B of B4): all keys, nullable keys, enum value constraints.
- `StepConfig` variants per step type (action, approval, multi_referral, decision, notification, termination): required fields, invalid config shapes.
- `TransitionRule`: `condition_expression` is nullable; `outcome_filter` is nullable; valid and invalid `priority` values.
- Document numbering formats: `Draft 7SP 2026-01`, `7SP 2026-01`, `SPR 2026-01`, `NCH 2026-01`, `NOSP 2026-01`, `D 2026-01`, `MO 2026-01`, `MI 2026-01`, `SPS 2026-01`. Each format has a parser test and a rejection test for malformed input.
- `DelegationGrant`: start before end; open-ended duration prohibited.

---

## 6. Layer 2 — Vitest Integration Tests

### 6.1 What Belongs Here

Integration tests exercise code that cannot be meaningfully verified without real infrastructure. They require:

- A live PostgreSQL instance (test-isolated database or schema-isolated namespace).
- The Fastify server running in test mode with `fastify.inject()` for HTTP-layer tests.
- The engine operating against a real database — no mocked repositories.
- Real event bus wiring: events emitted by the engine are consumed by the audit and notification stubs in the test environment.

**Not in:** Full browser sessions. That belongs in Playwright (K3). Nothing in this layer touches a browser.

### 6.2 Test PostgreSQL Setup

All integration tests run against a dedicated PostgreSQL database instance. The test runner:

1. Runs all Drizzle Kit migrations before the test suite starts.
2. Seeds role fixtures, document type fixtures, a test city record (`city_id`), and known user accounts (SP Secretary role, Mayor role, Platform Administrator role, Councilor role, Records Officer role).
3. Wraps each test (or test group) in a transaction that is rolled back after the test completes, or truncates tables between tests. The choice between rollback-per-test and truncate-between-tests must be documented in the test setup file.
4. Never shares state between unrelated tests. Tests that depend on each other (e.g., create instance → submit step) are structured as sequential steps within a single test, not as separate tests with implicit ordering.

**Parallelism:** Vitest may be configured to run integration test files in parallel but not individual tests within a file. Tests within a file run sequentially against the same database transaction scope.

### 6.3 Engine Entry Point Coverage

All seven engine entry points (B4 Section 3.1) require integration tests that verify correct database state after each call.

#### `engine.createInstance`

- Creates `workflow.instances` row with `definition_version_id` pinned to the current published version.
- Creates the start step's `step_instances` row with `status = active`.
- `instances.sla_deadline` computed and stored.
- `context` initialized with required keys.
- Emits `workflow.instance.created` and `workflow.step.started`; events persisted to `workflow.workflow_events` in the same transaction.
- In-app notifications enqueued for resolved assignees.
- `NO_ACTIVE_VERSION` error when no published definition version exists for the target definition.
- Fails entirely (rollback) if any write fails.

#### `engine.submitStepAction`

- Successful submission: step instance transitions to `completed`; next step instance activated; transition evaluation runs; all within one transaction.
- `workflow.workflow_events` row written for each state change within the transaction.
- Actor not in `step_instances.assigned_to` → `FORBIDDEN`; no state change committed.
- Step in non-`active` status → `CONFLICT`; no state change committed.
- System-only outcomes submitted with a user actor → `FORBIDDEN`.
- After submission: the step instance's `outcome`, `outcome_comment`, `completed_at`, and `actor_id` are correct in the database.

#### `engine.bypassStep`

- Step bypassed: `bypassed_at`, `bypassed_by`, `bypass_reason` set; transition evaluation fires; audit event emitted.
- Non-empty `comment` required; empty comment → rejected; no database change.

#### `engine.cancelInstance`

- All active step instances set to `status = cancelled` before instance is cancelled.
- Non-empty `cancellation_reason` required (Invariant 10).
- `workflow.instance.cancelled` event emitted and persisted.
- Completed or already-cancelled instances → rejected (Invariant 6).

#### `engine.evaluateTimers`

- Tests for all three timer jobs: `evaluateMayorLapseTimers`, `evaluatePanlalawiganTimers`, `evaluateThursdayCutoffs`.
- Each job: insert a step instance with a deadline in the past → run the job → verify the step instance is updated and the event is persisted.
- Idempotency: run the same job twice → second run produces no additional state changes.
- Race condition protection: the job must not fire if the step instance's outcome was set between the initial query and the lock acquisition.
- Outage simulation: advance time past the deadline without running the job → run the job after → verify `completed_at` is set to `<deadline>`, not to the job's run time.

#### `engine.evaluateSlaBreaches`

- Step with `sla_deadline < NOW()` and `sla_breached_at IS NULL` → `sla_breached_at` set to `sla_deadline` (not `NOW()`); `workflow.sla.breached` event emitted.
- Step already breached (`sla_breached_at IS NOT NULL`) → no-op; event not emitted again.
- Step at 80% elapsed → `workflow.sla.warning` emitted; not yet breached.
- Step at 150% elapsed → `workflow.sla.critical` emitted; only if still active.
- On startup simulation: multiple instances all breached during the outage window → one breach event per instance; not deduplicated to a single event.

#### `engine.migrateInstance` (Option B)

- All five preconditions verified in order; if any fails, the call is rejected with the appropriate typed error and no state change is committed.
- Successful migration: `instances.definition_version_id` updated; active step instances remapped by `step_key`; events persisted; SP Secretary notified.
- `STEP_KEY_NOT_FOUND_IN_TARGET_VERSION` when an active step's `step_key` does not exist in the target version.
- 24-hour reversal: execute migration → reverse within 24 hours → instance returns to the original version; reversal event persisted.
- Reversal after 24 hours without a new City Administrator approval: rejected.
- City Administrator approval record consumed atomically: a second migration using the same approval record is rejected.

### 6.4 Special Control Flow Integration Tests

The Certified Urgent bypass, Thursday cutoff, Mayor lapse, and Panlalawigan timer are each tested end-to-end within the integration layer — not just the logic, but the resulting database state.

**Certified Urgent — Case A (integration):**

1. Create a workflow instance for an SP Resolution; let it advance to the `multi_referral` step.
2. Emit `documents.certification_urgency.logged` with the instance ID.
3. Verify: `step_instances` row has `status = bypassed`, `bypass_reason = 'CERTIFIED_URGENT'`; `instance.context.certified_urgent = true`; the next step is now `active`; `workflow.step.bypassed` event persisted.

**Certified Urgent — Case B (integration):**

1. Create a workflow instance that has not yet reached the `multi_referral` step.
2. Emit `documents.certification_urgency.logged`.
3. Verify the pending bypass flag is stored.
4. Advance the instance to the point where `multi_referral` would activate.
5. Verify: the step is bypassed immediately without becoming active; context updated; events persisted.

**Thursday Cutoff (integration):**

1. Create a `multi_referral` step instance with `thursday_cutoff_enabled = true`.
2. Submit one committee's contribution; verify only that committee's submission is in `metadata.submissions`.
3. Simulate the Thursday cutoff job running before the second committee submits.
4. Verify: `thursday_cutoffs_missed = 1`; `second_reading_eligible_date` is still null; `workflow.multi_referral.cutoff_missed` event persisted.
5. Submit the second committee's contribution.
6. Simulate the following Thursday's cutoff job.
7. Verify: `second_reading_eligible_date` is set to the correct Tuesday; `workflow.multi_referral.second_reading_eligible` event persisted.

**Mayor Lapse (integration):**

1. Create a workflow instance for an SP Resolution; advance it to the Mayor review `approval` step.
2. Set `context.mayor_action_deadline` to a timestamp in the past.
3. Run `evaluateMayorLapseTimers`.
4. Verify: `step_instance.outcome = 'LAPSED'`; `step_instance.completed_at = mayor_action_deadline` (not `NOW()`); `context.mayor_action = 'LAPSED'`; `workflow.approval.lapsed` event persisted with `legal_basis = 'RA 7160 Section 47'`; the next step (Docketing) is now active.

**30-Day Panlalawigan Deemed Approval (integration):**

Mirrors the Mayor lapse integration test. Verify `legal_basis = 'RA 7160 Section 56(d)'` and that `panlalawigan_outcome = 'DEEMED_APPROVED'` is set in context.

### 6.5 Database Constraint Enforcement

These tests verify that the database itself enforces invariants — not just the application layer.

|Invariant|Database Test|
|---|---|
|1|Attempt a direct SQL UPDATE on `instances.definition_version_id` from the application DB user → fails with a permission or constraint error|
|4|Publish a definition version where an `approval` step has `LAPSED` in `allowed_outcomes` but no outgoing transition with `outcome_filter = 'LAPSED'` → fails with `MISSING_LAPSE_TRANSITION`|
|5|Publish a definition version with a `parallel_split` step → fails with `STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1`|
|6|Attempt to activate a step instance when `instances.status = completed` or `cancelled` → rejected|
|8|Attempt `engine.migrateInstance` without a valid, unexpired City Administrator approval → rejected|
|12|Verify that `workflow.workflow_events` has no `UPDATE` or `DELETE` grants for the application DB user; an attempted direct SQL DELETE from the app user role → permission error|
|13|A transition rule's `to_step_id` from a different `definition_version_id` → rejected during transition evaluation with `INVALID_TRANSITION_TARGET`|

The partial unique index `(document_type_id WHERE is_active = true)` on `workflow.definitions` must have a test: attempt to set two definitions for the same document type to `is_active = true` simultaneously → constraint violation.

### 6.6 tRPC Procedure Integration Tests

All tRPC procedures that gate on ABAC permissions require an integration test that verifies the permission check at the procedure boundary. Use `createCaller` with a context containing a real user session record from the test database.

For each protected procedure:

- Authorized caller with the correct role and correct office scope → procedure executes; expected result returned.
- Authorized role but wrong office scope → `FORBIDDEN`.
- Unauthenticated caller (no session) → `UNAUTHORIZED`.
- Authenticated but wrong role entirely → `FORBIDDEN`.

Do not test permission logic by reading the `permissions` table in a unit test. Test it by calling the procedure and verifying what happens.

### 6.7 ABAC-Protected Route Integration Tests (Fastify `.inject()`)

All REST routes exposed through Fastify that enforce RBAC/ABAC access controls are tested with `fastify.inject()`. This exercises the Fastify plugin scope, middleware, schema validation, and route handler — all without a network.

Minimum required coverage per route family:

- `GET` routes returning documents the requester does not own → `403`.
- `GET` routes for `Confidential` and `Restricted` classification levels → only returned for explicit allowlist roles.
- `POST`/`PATCH` routes that modify workflow state → verified against step assignee resolution; non-assignee → `403`.
- IT Admin role: verify no `Confidential` or `Restricted` document content is returned in any route response, regardless of parameters. This is Invariant 10 from the architecture reference and must be verified at the HTTP layer.
- Platform Administrator route: verify the PA role cannot be used to perform operational actions (document creation, workflow step submission). This is Invariant 12 from the architecture reference.
- Audit log routes: verify `INSERT`-only behaviour by testing that no route permits reading an audit entry and modifying it, and that the audit schema has no writable surface exposed through the API.

### 6.8 Event Bus Wiring

The following event subscriptions must be verified end-to-end in the integration layer (verify that the subscriber function is called and produces the expected side effect):

- `documents.certification_urgency.logged` → workflow engine bypass sequence executed.
- `workflow.instance.repassed` → documents module creates an amended version record linked to the original instance.
- `workflow.step.completed` (for audit-flagged step types: `approval`, `multi_referral` acceptance, manual advance) → audit service writes a dedicated entry.
- `workflow.instance.migration.started`, `.completed`, `.reversed` → audit service writes high-priority, permanent entries.
- `workflow.sla.breached` → Mayor dashboard and SP Secretary receive in-app notifications.

---

## 7. Layer 3 — Playwright E2E Tests

E2E tests are defined in K3. This section records only the boundary decision.

Playwright tests cover the five or six most critical user journeys from the perspective of a real browser session: a real user logs in, performs actions through the UI, and the test asserts the correct end state. They are not written until Priority 1 and Priority 2 tests are stable.

E2E tests must not be used to compensate for gaps in unit or integration tests. If a test can be written as an integration test, it must be. Playwright tests are reserved for journeys that require a real browser (DOM interactions, form flows, QR code scanning UI, file upload and preview, Order of Business view interactions).

---

## 8. What Not to Test (or Not to Chase)

**CRUD coverage.** There is no target for line coverage of create/read/update/delete handlers for entities like offices, positions, or document type configurations. These are tested only as prerequisites of other tests (seeded as fixtures) or when a specific constraint or edge case requires verification.

**Notification delivery.** The notifications module's delivery pipeline (email, in-app) is not tested at the transport level in this project. Tests verify that the engine enqueues a notification (the event is emitted and persisted) but do not verify that the email reaches an inbox or that the SSE push is received by a browser.

**OCR accuracy.** The OCR subsystem's text extraction quality is a configuration and tuning concern, not a test concern. Tests verify that the OCR service interface is called when a document is uploaded and that a scan quality indicator value is returned — not that the extracted text is a perfect transcription of the document.

**UI pixel precision.** Playwright tests verify functional correctness (the right data appears, the right action succeeds) — not visual layout, font sizes, or colour values.

**The `sp.batac.gov.ph` legacy system.** No tests reference or mock the existing website. It is not integrated.

**mocked database in integration tests.** A test that mocks the database in an integration test is a misclassified unit test. Rewrite it as a unit test with an explicit pure function, or use a real test database.

---

## 9. Test Data and Fixtures

### 9.1 Fixture Principles

All test fixtures are deterministic. UUIDs in fixtures are hardcoded constants, not generated per run. Timestamps in fixtures are explicit values, not `new Date()`.

Fixtures live in `/packages/database/src/test-fixtures/`. They are not shared with seed data used for development or staging environments.

### 9.2 Required Fixture Sets

The following fixture sets must be defined before integration tests can be written:

**Identity and roles:**

- One Platform Administrator user.
- One SP Secretary user (SP Secretariat office).
- One Mayor user (Mayor's Office).
- One Vice Mayor user.
- One Councilor user (for the committee workflow; assigned to at least two committees).
- One Records Officer user.
- One IT Admin user (must have no document content read access — verified in ABAC tests).

**Document types:**

- SP Resolution (with published workflow definition, pinned to a known version ID).
- SP Ordinance (with published workflow definition).
- Appropriation Ordinance (with published workflow definition).

**Committees:**

- At least two committee records for multi-referral tests. Recommended: Committee on Laws (default co-committee) and one subject-matter committee.

**Workflow definitions:**

- One published definition version per Phase 1 document type. The version ID is a hardcoded constant so tests can assert `definition_version_id` without querying.
- One unpublished (draft) definition version per document type for version management tests.

**Numbering series:**

- One `number_series` record per document type (per year: 2026). Starting sequence value: 1.

### 9.3 Time in Tests

All tests that involve timers, deadlines, or elapsed-time computations must inject the reference time as a parameter. The engine must not call `Date.now()` or `new Date()` inside business logic. A `clock` parameter (a function returning the current time as a `Date`) is injected at the engine level and is overridden in tests to return a fixed value.

This applies to: SLA deadline computation, Mayor lapse timer, Panlalawigan timer, Thursday cutoff evaluation, and SLA breach detection.

---

## 10. CI Requirements

**Vitest unit tests:** Run on every pull request. Must complete within 60 seconds. Failing tests block merge.

**Vitest integration tests:** Run on every pull request. Require a test PostgreSQL instance (provisioned by the CI environment). Must complete within 5 minutes. Failing tests block merge.

**Playwright E2E tests:** Run on merge to the main branch and on release candidates, not on every pull request. A failed E2E run does not block a PR merge but does block a release deployment.

**Coverage reporting:** Coverage is collected for informational purposes but not gated. Coverage reports are generated and stored as CI artifacts. No threshold. No merge gate.

**Test database lifecycle in CI:** The test database is created fresh for each CI run, migrated from scratch, and seeded with fixtures. It is destroyed after the run. No shared test database persists between runs.

**Scheduler jobs in CI:** `pgboss` is configured in test mode. Time-dependent job evaluation is triggered explicitly by the test, not by the scheduler's cron expression. Cron expressions are never exercised in CI.

---

_This document defines the testing strategy baseline. It is revised when: (1) a new module enters development scope, (2) a new test layer boundary decision is made, or (3) the Priority order is formally changed. Individual test case definitions belong in the test files themselves, not in this document._