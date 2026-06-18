# Workflow Engine Specification — K2 Source Extract

**Source Document:** B4 — Workflow Engine Specification  
**Platform:** Batac City LGU Platform  
**Purpose of This Extract:** Context needed to write K2: Workflow Engine Test Suite Design (Pre-dev). Sections not needed to specify tests have been removed.  
**Last Updated:** June 2026

---

## 1. Design Principles (Relevant Excerpts)

**Deterministic execution.** Given the same instance state and the same inputs, the engine always produces the same outputs. All elapsed-time computations are based on `TIMESTAMPTZ` values stored in the database at the moment events occur. The scheduler triggers timer evaluation; it does not determine outcomes.

**Fail-closed on ambiguity.** If transition evaluation produces no matching rule and no default is configured, the instance enters `stuck` status. The engine never silently drops an instance into a terminal state without an explicit termination step reaching it.

**Audit-first.** Every actor interaction — including SP Secretary manual advances of `multi_referral` steps and all Option B migration operations — is audit-logged with actor, timestamp, and a mandatory non-empty reason.

---

## 2. Data Model (Test-Relevant Subset)

### 2.1 Lifecycle State Enums

**`workflow_instance_status_enum`:**

|Value|Description|
|---|---|
|`active`|One or more step instances are currently in progress|
|`suspended`|All active steps are paused by authorized admin action|
|`stuck`|Transition evaluation found no matching rule and no default is configured|
|`completed`|A termination step was reached|
|`cancelled`|Cancelled by an authorized actor before completion|

**`workflow_step_status_enum`:**

|Value|Description|
|---|---|
|`pending`|Created but not yet activated|
|`active`|Assigned to an actor and awaiting completion|
|`completed`|Finished normally; `outcome` and `completed_at` are set|
|`bypassed`|Skipped; `bypassed_at`, `bypassed_by`, and `bypass_reason` are set|
|`cancelled`|Cancelled as part of instance cancellation|
|`failed`|Internal engine error during step execution|

### 2.2 Key Schema Facts for Test Setup

- `instances.definition_version_id` — pinned at creation; only updatable via `engine.migrateInstance`
- `step_instances.assigned_to` — resolved at activation time; snapshot is authoritative for permission checks during the step's lifetime
- `step_instances.outcome` — nullable; set at completion
- `step_instances.bypassed_at / bypassed_by / bypass_reason` — set on bypass
- `workflow.workflow_events` — INSERT-only; `REVOKE UPDATE, DELETE` at DB level
- `instances.context` — mutable JSONB; key source for transition condition evaluation and timer logic

---

## 3. Execution Model (Test-Relevant Excerpts)

### 3.1 Engine Entry Points

|Method|Description|
|---|---|
|`engine.createInstance(documentId, definitionId)`|Creates and starts a new workflow instance|
|`engine.submitStepAction(stepInstanceId, actorId, outcome, comment, payload)`|Completes a step as an actor|
|`engine.bypassStep(stepInstanceId, actorId, bypassReason, comment)`|Bypasses a step via admin action; always audit-logged|
|`engine.cancelInstance(instanceId, actorId, reason)`|Cancels a running instance; reason is mandatory|
|`engine.migrateInstance(instanceId, targetVersionId, actorId, reason)`|Option B in-flight migration|
|`engine.evaluateTimers()`|Called by the scheduler; processes all time-based transitions|
|`engine.evaluateSlaBreaches()`|Called by the scheduler and on startup|

All entry points execute within a PostgreSQL transaction. If any write fails, the entire operation is rolled back.

### 3.2 Instance Creation

On `engine.createInstance`:

1. Resolve the current active, published definition version. Fail with `NO_ACTIVE_VERSION` if none exists.
2. Create `workflow.instances` row. Set `definition_version_id` to the resolved version. **Pin is permanent except via Option B migration.**
3. Identify the start step (`is_start = true`). There must be exactly one.
4. Create a `step_instances` row for the start step with `status = active` and `started_at = NOW()`.

### 3.3 Transition Evaluation

Called after a step instance reaches a terminal status:

1. Load all `transition_rules` where `from_step_id = currentStep.id` and `definition_version_id = instance.definition_version_id`.
2. Filter out rules where `outcome_filter IS NOT NULL AND outcome_filter ≠ step_instance.outcome`.
3. Sort remaining candidates by `priority` ascending (lower value = higher priority).
4. For each candidate: evaluate `condition_expression` (JSONLogic) against `instance.context`. A rule with `condition_expression IS NULL` always matches.
5. First matching rule fires.
6. **If no rule matches:** Set `instance.status = stuck`. Emit `workflow.instance.stuck`. Notify Platform Administrator. Stop.

---

## 4. Step Type Behavior Contracts

### 4.1 `action`

**Outcome codes:** Always `DONE`.

**Completion:** Actor submits the action. Engine validates that `actor_id` is in `assigned_to`. Sets `status = completed`, `outcome = DONE`, `completed_at = NOW()`.

**Rejection cases:**

- Actor not in `assigned_to` → `FORBIDDEN`
- Step not in `active` status → `CONFLICT`
- `require_comment = true` and no comment provided → `VALIDATION_FAILED`

---

### 4.2 `approval`

**Valid outcome codes:**

|Code|Meaning|Who Sets It|
|---|---|---|
|`APPROVED`|Actor approves|Actor|
|`REJECTED`|Actor rejects; requires comment|Actor|
|`RETURNED_FOR_REVISION`|Sent back for amendment; requires comment|Actor|
|`SIGNED`|Document signed|Actor|
|`VETOED`|Mayor vetoes|Actor|
|`LAPSED`|Mayor took no action within 10 calendar days|**Scheduler only**|
|`OVERRIDE_SUCCEEDED`|SP voted to override veto (2/3 majority = 8 of 12)|Secretariat actor|
|`OVERRIDE_FAILED`|SP veto override failed|Secretariat actor|
|`VALID`|Panlalawigan approved|Secretariat actor|
|`VALID_IN_PART`|Panlalawigan partially approved|Secretariat actor|
|`RETURNED`|Panlalawigan returned with objections|Secretariat actor|
|`OPERATIVE_IN_ITS_ENTIRETY`|Panlalawigan outcome for Appropriation Ordinances; treated identically to `VALID`|Secretariat actor|
|`DEEMED_APPROVED`|Panlalawigan 30-day lapse|**Scheduler only**|
|`REPORT_ACCEPTED`|SP Secretary accepts unified committee report|Actor|

**Guard on scheduler-only outcomes:** `engine.submitStepAction` must validate that `LAPSED` and `DEEMED_APPROVED` are only accepted when `actor_type = system`. A human actor submitting either → `FORBIDDEN`.

**Completion:** Actor submits decision. Engine validates actor authorization and comment requirements. Sets `status = completed`, `outcome`, `outcome_comment`, `completed_at = NOW()`. Transition evaluation fires.

**Requirement for transition coverage:** Every outcome code in `config.allowed_outcomes` must have at least one outgoing transition rule with a matching `outcome_filter`, or a default unconditional transition must exist. Definitions lacking this coverage are rejected at publish time with `MISSING_OUTCOME_TRANSITION`.

---

### 4.3 `multi_referral`

**Source:** Confirmed — Interview 2; consolidated reference Part 8.3.

**Config fields (test-relevant):**

|Field|Required|Notes|
|---|---|---|
|`require_all_committee_signatures`|Yes|Must be `true`; all committees must contribute|
|`allow_secretary_advance`|Yes|Permits SP Secretary manual advance; always requires non-empty comment; always audit-logged|
|`thursday_cutoff_enabled`|Yes|Must be `true` for all SP Resolution and Ordinance referral steps|
|`cutoff_time_pht`|Yes|Recommended: `"23:59:59"`|

**Step instance metadata — fields relevant to test assertions:**

```json
{
  "assigned_committees": [...],
  "submissions": [...],
  "thursday_cutoffs_missed": 0,
  "last_cutoff_evaluated_at": null,
  "all_submitted_at": null,
  "second_reading_eligible_date": null,
  "unified_report_document_id": null,
  "secretary_accepted_at": null,
  "secretary_accepted_by": null,
  "manual_advance": false,
  "manual_advance_comment": null,
  "manual_advance_by": null
}
```

**Completion sequence (normal path):**

1. Each committee submits with `outcome = COMMITTEE_SUBMITTED`. Engine appends to `metadata.submissions`. When last committee submits, sets `metadata.all_submitted_at = NOW()`.
2. SP Secretary uploads unified report; engine sets `metadata.unified_report_document_id`.
3. SP Secretary accepts report. Engine sets `metadata.secretary_accepted_at`, `status = completed`, `outcome = REPORT_ACCEPTED`.
4. Transition evaluation fires on `outcome = REPORT_ACCEPTED`.

**Manual advance (SP Secretary override):**

- `outcome_comment` must be non-empty — engine rejects with `COMMENT_REQUIRED` otherwise.
- Engine sets `metadata.manual_advance = true`.
- For each committee without a submission, creates a submission entry with `missed = true`.
- Step set to `completed` with `outcome = SECRETARY_ADVANCED`.
- `workflow.multi_referral.secretary_advanced` event emitted. Audit service writes dedicated entry.

**Outcome codes:**

|Code|Meaning|
|---|---|
|`COMMITTEE_SUBMITTED`|Intermediate outcome for each committee's individual submission|
|`REPORT_ACCEPTED`|SP Secretary accepted the unified report; step completes normally|
|`SECRETARY_ADVANCED`|SP Secretary manually advanced; some committees may not have submitted|

---

### 4.4 `decision`

**Completion:** On activation, engine evaluates `condition_expression` against `instance.context`. Sets `outcome` to `true_outcome` or `false_outcome`. Sets `status = completed`, `actor_type = system`, `completed_at = NOW()`. Transition evaluation fires immediately.

**Auto-complete:** Always `true` for `decision` steps; cannot be disabled.

**Time-based conditions:** Decision steps evaluate context state, not elapsed time. Time-based transitions (10-day Mayor lapse, 30-day Panlalawigan) are implemented by the scheduler setting context keys, not by decision step expressions.

---

### 4.5 `notification`

**Completion:** Engine enqueues notification. Sets `status = completed`, `outcome = DISPATCHED`, `actor_type = system`, `completed_at = NOW()`. Transition evaluation fires immediately. Delivery failure does not affect the workflow.

---

### 4.6 `termination`

**Valid `outcome_code` values:**

|Code|Meaning|
|---|---|
|`APPROVED_AND_RELEASED`|Full legislative lifecycle completed|
|`LAPSED_INTO_LAW`|Mayor took no action within 10 calendar days|
|`DEEMED_APPROVED_PANLALAWIGAN`|Panlalawigan took no action within 30 days|
|`VETOED_OVERRIDE_FAILED`|Mayor vetoed; SP could not muster 2/3 override|
|`REJECTED_AT_VOTE`|Voted down at a reading session|
|`ARCHIVED_NO_ACTION`|Committee deferred; document archived|
|`CANCELLED`|Manually cancelled|
|`VALID_IN_PART_RESOLVED`|Panlalawigan VALID-IN-PART; Secretariat resolved without repass|
|`REPASSED`|Document returned to draft for amendment and repass|

**On `outcome_code = REPASSED`:** The instance is NOT set to `completed`. It remains `active`. Engine emits `workflow.instance.repassed`. No new step is created.

**On `outcome_code = CANCELLED`:** All active step instances are set to `status = cancelled` in the same transaction. Mandatory non-empty `cancellation_reason` required.

---

## 5. Phase 2 Reserved Step Types (Phase 1 Guards)

**`parallel_split` and `parallel_join`:** Must exist in the `workflow_step_type_enum` DB enum but are not executable in Phase 1.

**Phase 1 guard:** If a definition version containing `parallel_split` or `parallel_join` is submitted for publishing → engine rejects with `STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1`. If somehow activated at runtime → engine immediately emits `workflow.step.failed` and sets instance to `stuck`.

---

## 6. Special Control Flows

### 6.1 Certified Urgent Bypass Path

**Source:** Confirmed — Interview 2; consolidated reference Part 4.17 and Part 11.3.

**Background:** Mayor issues a formal written Certification of Urgency. A single Certification may cover multiple measures. When Secretariat logs it, the `multi_referral` (committee referral) step is bypassed for each associated measure; First and Second Reading occur in the same session.

**Trigger:** `documents.certification_urgency.logged` event, containing:

```json
{
  "certification_document_id": "<UUID>",
  "associated_instance_ids": ["<UUID>", "..."],
  "logged_by": "<UUID>",
  "logged_at": "<TIMESTAMPTZ>"
}
```

**Bypass sequence per instance — three cases:**

**Case A — `multi_referral` step is `active`:** Execute bypass immediately:

- Set `step_instances.status = bypassed`
- Set `step_instances.bypassed_at = NOW()`
- Set `step_instances.bypassed_by = null` (system-triggered)
- Set `step_instances.bypass_reason = 'CERTIFIED_URGENT'`
- Set `step_instances.outcome = 'BYPASSED_CERTIFIED_URGENT'`
- Emit `workflow.step.bypassed`
- Run transition evaluation — definition must have a transition rule with `outcome_filter = 'BYPASSED_CERTIFIED_URGENT'` pointing to Second Reading; admin UI enforces this at publish time

**Case B — `multi_referral` step is `pending` (not yet activated):** Set a deferred bypass flag. When the step would normally be activated, engine checks for the flag and executes Case A logic instead.

**Case C — `multi_referral` step is already `completed` or `bypassed`:** Emit `workflow.certification_urgency.already_past_referral`. No workflow change.

**Instance not active (completed, cancelled, stuck):** Emit `workflow.certification_urgency.already_inactive` and skip.

**Constraint:** `multi_referral` bypass via Certified Urgent is the only mechanism for same-session First and Second Reading. The `multi_referral` step may also be advanced by SP Secretary manual override, but that still requires committee submission and a mandatory comment.

---

### 6.2 Thursday Cutoff Enforcement and Second Reading Delay

**Source:** Confirmed — Interview 2 and developer decisions; consolidated reference Part 8.3 and Part 7.2.

**Background:** After committee referral at First Reading, committees must submit contributions and the SP Secretary must accept the unified report before Second Reading can be scheduled. If all committees submit before Thursday 23:59:59 PHT, the measure is eligible for Second Reading the following Tuesday. If not, Second Reading is delayed.

**Cutoff definition:** Thursday 23:59:59 PHT (UTC+08:00 → Thursday 15:59:59 UTC).

**Scheduler job:** `evaluateThursdayCutoffs` runs every Thursday at 23:59:59 PHT. Idempotent: re-running for the same cutoff window produces no additional effects if `metadata.last_cutoff_evaluated_at` equals or exceeds the current cutoff timestamp.

**Job algorithm (per active `multi_referral` step instance with `thursday_cutoff_enabled = true`):**

```
FOR each active multi_referral step_instance WHERE thursday_cutoff_enabled = true:

  cutoff_ts = current_cutoff_timestamp  // Thursday 23:59:59 PHT

  IF metadata.all_submitted_at IS NULL:
    // Not all committees have submitted
    metadata.thursday_cutoffs_missed += 1
    metadata.last_cutoff_evaluated_at = cutoff_ts
    EMIT workflow.multi_referral.cutoff_missed { missing_committee_ids, cutoff_number }
    // No second_reading_eligible_date set; Order of Business excludes this measure

  ELSE IF metadata.all_submitted_at <= cutoff_ts AND metadata.second_reading_eligible_date IS NULL:
    // All committees submitted before or on this Thursday's cutoff
    eligible_date = DATE(cutoff_ts AT TIME ZONE 'Asia/Manila') + INTERVAL '5 days'
    metadata.second_reading_eligible_date = eligible_date
    metadata.last_cutoff_evaluated_at = cutoff_ts
    instance.context.second_reading_eligible_date = eligible_date
    EMIT workflow.multi_referral.second_reading_eligible { step_instance_id, eligible_date }

  ELSE:
    // second_reading_eligible_date already set; nothing to update
    PASS
```

**`computeSecondReadingEligibleDate` — worked examples for test case derivation:**

|Last Submission|Cutoff Evaluation|Eligible Tuesday|
|---|---|---|
|Monday 08:00 Week N|Thursday Week N 23:59:59|Tuesday Week N+1|
|Thursday 15:00 Week N|Thursday Week N 23:59:59|Tuesday Week N+1|
|Thursday 23:59:58 Week N|Thursday Week N 23:59:59|Tuesday Week N+1|
|Thursday 23:59:59 Week N (exact cutoff)|Not before cutoff|Evaluated Thursday Week N+1; Tuesday Week N+2|
|Friday 09:00 Week N|Thursday Week N already passed; evaluated Thursday Week N+1|Tuesday Week N+2|

**The `multi_referral` step remains `active` until all committees have submitted AND the SP Secretary accepts the unified report.** `second_reading_eligible_date` is set by the job. The engine does not enforce session dates or prevent activation of the Second Reading step if the eligible date has not yet arrived.

---

### 6.3 10-Day Mayor Lapse Timer

**Source:** Confirmed — Interview 2; consolidated reference Part 4.1, Part 4.2, Part 11.3. Legal basis: RA 7160 Section 47. Applies to both SP Resolutions and SP Ordinances.

**Timer start:** When the Secretariat completes the Transmittal Letter step:

- Sets `instance.context.mayor_transmittal_date = NOW()`
- Sets `instance.context.mayor_action_deadline = NOW() + INTERVAL '10 days'`
- Activates the Mayor review `approval` step

**Calendar days:** 10 calendar days. No adjustment for weekends or public holidays.

**Scheduler job:** `evaluateMayorLapseTimers` runs every hour via `node-cron`. Idempotent.

**Job algorithm:**

```
FOR each active approval step_instance WHERE:
    'LAPSED' IN step.config.allowed_outcomes
    AND instance.context.mayor_action_deadline IS NOT NULL
    AND step_instance.outcome IS NULL
    AND NOW() > instance.context.mayor_action_deadline:

  Acquire pessimistic row lock (SELECT FOR UPDATE)
  
  IF step_instance.outcome IS NOT NULL:
    // Actor submitted between job check and lock acquisition; skip
    RELEASE lock; CONTINUE
  
  SET step_instance.status = completed
  SET step_instance.outcome = 'LAPSED'
  SET step_instance.outcome_comment = 'Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47.'
  SET step_instance.completed_at = instance.context.mayor_action_deadline  // NOT NOW()
  SET step_instance.actor_type = system
  SET instance.context.mayor_action = 'LAPSED'
  SET instance.context.mayor_action_date = instance.context.mayor_action_deadline
  
  EMIT workflow.approval.lapsed { legal_basis: 'RA 7160 Section 47', deadline_was }
  
  RUN transition evaluation
  // Rule with outcome_filter = 'LAPSED' routes to Docketing step
```

**Critical detail:** `step_instance.completed_at` is set to `instance.context.mayor_action_deadline`, not to `NOW()`.

**Race condition prevention:** `SELECT FOR UPDATE` prevents Mayor from submitting concurrent action at the exact moment lapse fires. First transaction to commit wins. Lapse job checks `step_instance.outcome IS NOT NULL` after acquiring lock and skips if outcome was already set.

**Veto override path:**

- `allowed_outcomes = ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED']`
- Override threshold: 2/3 majority = 8 of 12 SP members (confirmed)
- `OVERRIDE_SUCCEEDED` → Docketing step (same path as signed/lapsed)
- `OVERRIDE_FAILED` → termination step with `outcome_code = VETOED_OVERRIDE_FAILED`

---

### 6.4 30-Day Panlalawigan Timer

**Source:** Confirmed — Interview 2 and developer decisions; consolidated reference Part 4.3. Legal basis: RA 7160 Section 56(d).

**Timer start:** When Secretariat logs transmission to Sangguniang Panlalawigan (after Docketing step):

- Sets `instance.context.panlalawigan_transmission_date = NOW()`
- Sets `instance.context.panlalawigan_action_deadline = NOW() + INTERVAL '30 days'`
- Activates the Panlalawigan review `approval` step

**Calendar days:** 30 calendar days. No adjustment for weekends or holidays.

**Scheduler job:** `evaluatePanlalawiganTimers` runs daily at 06:00 PHT. Idempotent.

**Job algorithm:**

```
FOR each active approval step_instance WHERE:
    'DEEMED_APPROVED' IN step.config.allowed_outcomes
    AND instance.context.panlalawigan_action_deadline IS NOT NULL
    AND instance.context.panlalawigan_outcome IS NULL
    AND NOW() > instance.context.panlalawigan_action_deadline:

  Acquire pessimistic row lock (SELECT FOR UPDATE)
  
  IF instance.context.panlalawigan_outcome IS NOT NULL:
    RELEASE lock; CONTINUE
  
  SET step_instance.status = completed
  SET step_instance.outcome = 'DEEMED_APPROVED'
  SET step_instance.outcome_comment = 'Deemed approved per RA 7160 Section 56(d) — 30 calendar days elapsed with no action from the Sangguniang Panlalawigan.'
  SET step_instance.completed_at = instance.context.panlalawigan_action_deadline  // NOT NOW()
  SET step_instance.actor_type = system
  SET instance.context.panlalawigan_outcome = 'DEEMED_APPROVED'
  SET instance.context.panlalawigan_response_date = instance.context.panlalawigan_action_deadline
  
  EMIT workflow.panlalawigan.deemed_approved { legal_basis: 'RA 7160 Section 56(d)', transmission_date, deadline_was }
  
  RUN transition evaluation
  // Rule with outcome_filter = 'DEEMED_APPROVED' routes to Publication check or Archive
```

**Critical detail:** `step_instance.completed_at` is set to `instance.context.panlalawigan_action_deadline`, not to `NOW()`.

**Manual Panlalawigan response (before 30 days):** Secretariat submits the review step manually. `allowed_outcomes` for this step: `VALID`, `VALID_IN_PART`, `RETURNED`, `OPERATIVE_IN_ITS_ENTIRETY`, and `DEEMED_APPROVED` (last only settable by scheduler per system-only guard in Section 4.2).

**Outcome routing:**

|Outcome|Transition Target|
|---|---|
|`VALID`|Publication decision step|
|`OPERATIVE_IN_ITS_ENTIRETY`|Same as `VALID`|
|`DEEMED_APPROVED`|Same as `VALID`|
|`VALID_IN_PART`|`action` step: SP Secretary chooses resolution path|
|`RETURNED`|High-priority `action` step: Secretariat decides whether to modify/repass or implement directly|

---

## 7. Version Management

### 7.1 Version Pinning at Instance Creation

When `engine.createInstance` is called, the engine resolves the current published definition version (`is_current = true`) and writes its ID to `instances.definition_version_id`. **This value is written once at creation and is treated as immutable for the lifetime of the instance except via Option B migration.**

All step resolution, transition evaluation, condition expressions, step-type behavior, and assignee resolution use exclusively the snapshot stored in `definition_versions.snapshot` for the pinned version. If a Platform Administrator publishes a new version while instances are active, those active instances are unaffected.

**Rationale:** In-flight SP Resolutions and Ordinances must not be disrupted by workflow definition changes made during the legislative process.

### 7.2 Option A: Continue Under Existing Version

Default. Active instances continue under the version pinned at creation. New instances use the new version; existing instances use their pinned version. No action required.

### 7.3 Option B: In-Flight Instance Migration

**Preconditions (all must be satisfied; engine validates in order):**

1. A published definition version newer than the instance's pinned version exists for the same definition.
2. A valid, unexpired City Administrator approval record exists for this specific migration (created within the last 24 hours).
3. The caller is a Platform Administrator.
4. The migration reason is non-empty.
5. The instance status is `active`.

**If any precondition fails:** Typed error: `NO_ADMIN_APPROVAL`, `APPROVAL_EXPIRED`, `INSTANCE_NOT_ACTIVE`, etc.

**Step mapping:** For each active step instance, find the step with the same `step_key` in the target version. If an active step's `step_key` does not exist in the target version → reject with `STEP_KEY_NOT_FOUND_IN_TARGET_VERSION`.

**Reversal window:** 24 hours after `migration.completed`. After 24 hours, a new City Administrator approval is required.

**Events emitted:** `workflow.instance.migration.started`, `workflow.instance.migration.completed`, `workflow.instance.migration.reversed` — all consumed by audit service as permanent, high-priority entries.

---

## 8. Engine Invariants

These are the testable contracts the engine enforces. Violations cause the relevant operation to be rejected with a typed error; they are never silently ignored.

|#|Invariant|Enforcement Mechanism|
|---|---|---|
|1|`instances.definition_version_id` is written once at creation and never updated except via `engine.migrateInstance`|Application-level guard on all other update paths|
|2|A `multi_referral` step with `require_all_committee_signatures = true` cannot complete with `outcome = REPORT_ACCEPTED` unless all committees have submissions OR `manual_advance = true`|Enforced in `multi_referral` completion handler|
|3|`outcome = LAPSED` and `outcome = DEEMED_APPROVED` may only be submitted with `actor_type = system`|Enforced in `engine.submitStepAction`|
|4|Every `approval` step whose `allowed_outcomes` includes `LAPSED` must have an outgoing transition rule with `outcome_filter = 'LAPSED'`|Validated at definition version publish time; fails with `MISSING_LAPSE_TRANSITION`|
|5|No definition version may include `parallel_split` or `parallel_join` in Phase 1|Validated at publish time; validated again on step instance activation at runtime|
|6|An instance with `status = completed` or `status = cancelled` cannot have any step instance activated|Enforced in all engine entry points and timer jobs|
|7|SP Secretary manual advance of a `multi_referral` step requires a non-empty `outcome_comment`|Enforced in `engine.submitStepAction`|
|8|Option B migration requires a valid, unexpired City Administrator approval record|Checked transactionally; approval record consumed atomically with migration|
|9|A `termination` step with `outcome_code = REPASSED` must not set `instances.status = completed`|Enforced in termination execution handler|
|10|All engine operations that accept a `reason` or `comment` parameter must reject the call if that value is empty or whitespace-only when marked as mandatory|Enforced by input validation in each entry point|
|11|The encoder (document creator) and the final approver of the same document cannot be the same user|Enforced in `approval` step completion handler for steps marked `is_final_approval = true`; checked against `instance.context.created_by`|
|12|No outgoing transition rule may reference a `to_step_id` from a different `definition_version_id` than the instance's pinned version|Validated during transition evaluation; invalid transitions trigger `workflow.instance.stuck`|
|13|`workflow.workflow_events` rows may only be inserted; no update or delete path exists|DB-level: `REVOKE UPDATE, DELETE ON workflow.workflow_events FROM workflow_app_user`|

---

## 9. One-Active-Designation-Per-Person Constraint

**Source:** Confirmed — Interview 2; consolidated reference Part 4.12, Part 11.13, and Architectural Invariant #16.

This constraint lives in the `organization` module (not the `workflow` module), but the workflow engine's assignee resolution is directly affected by it. The K2 test suite must cover the interaction.

**Confirmed rules:**

- A person cannot hold more than one active designation at a time. **NOT ALLOWED** per Interview 2.
- Enforced by: application-level validation + **DB partial unique index on active `delegation_grants` per user**.
- Expiry: automatic at end date — authority returns to original authority automatically.
- Open-ended delegations prohibited — duration must always be explicit.

**Workflow engine interaction:**

- Assignee resolution expression `delegation_aware:<role_key>` resolves the role, then checks for an active delegation grant for each resolved user; if one exists, routes to the designated person instead.
- The `delegation_grants` active-designation constraint means: if a user already has an active designation and a second one is attempted, the system must reject the second designation at the application-validation layer before writing any `delegation_grant` record.
- The test suite must verify that attempting to create a second active designation for the same person throws the correct typed error rather than producing a state where two active designations exist.

---

## Appendix A: Domain Events — Test-Relevant Subset

Events the test suite must assert are emitted (or not emitted) as part of correct engine behavior:

|Event Type|Trigger|Key for K2 Test Assertions|
|---|---|---|
|`workflow.instance.created`|New instance started|Emitted on successful `createInstance`|
|`workflow.instance.completed`|Termination step reached|Emitted with correct `outcome_code`|
|`workflow.instance.cancelled`|Instance cancelled|Emitted with `cancellation_reason`|
|`workflow.instance.stuck`|No matching transition|Emitted on ambiguous transition; instance enters `stuck`|
|`workflow.instance.repassed`|Termination with REPASSED outcome|Emitted; instance NOT set to `completed`|
|`workflow.instance.migration.started`|Option B migration initiated|Emitted with step_mapping|
|`workflow.instance.migration.completed`|Option B migration completed|Emitted on success|
|`workflow.instance.migration.reversed`|Option B migration reversed|Emitted with `original_migration_event_id`|
|`workflow.step.started`|Step instance activated|Emitted on each step activation|
|`workflow.step.completed`|Step instance completed|Emitted with `outcome` and `actor_type`|
|`workflow.step.bypassed`|Step bypassed|Emitted with `bypass_reason`|
|`workflow.step.failed`|Engine error during step|Emitted if `parallel_split`/`parallel_join` activated in Phase 1|
|`workflow.multi_referral.committee_submitted`|Committee submitted contribution|Intermediate; not step completion|
|`workflow.multi_referral.all_submitted`|Last committee submitted|Triggers `all_submitted_at`|
|`workflow.multi_referral.cutoff_missed`|Thursday cutoff passed; not all submitted|Asserts `missing_committee_ids`|
|`workflow.multi_referral.second_reading_eligible`|Eligible Tuesday computed|Asserts `eligible_date`|
|`workflow.multi_referral.secretary_advanced`|SP Secretary manual advance|Must contain full `metadata_snapshot`|
|`workflow.approval.lapsed`|10-day Mayor lapse fired|Asserts `legal_basis = 'RA 7160 Section 47'`; asserts `completed_at = mayor_action_deadline` (not NOW())|
|`workflow.panlalawigan.deemed_approved`|30-day Panlalawigan timer fired|Asserts `legal_basis = 'RA 7160 Section 56(d)'`; asserts `completed_at = panlalawigan_action_deadline` (not NOW())|
|`workflow.certification_urgency.bypass_applied`|Certified Urgent bypass executed|Emitted for Cases A and B|
|`workflow.certification_urgency.bypass_deferred`|Certified Urgent bypass recorded for pending step|Case B|
|`workflow.certification_urgency.already_past_referral`|Certified Urgent received after referral step already passed|Case C|
|`workflow.certification_urgency.already_inactive`|Certified Urgent received for non-active instance|Skip case|

---

## Appendix B: Workflow Instance Context — Test-Relevant Keys

Keys the test suite must assert are correctly set (or remain `null`) at specific lifecycle points:

```jsonc
{
  // Set at instance creation
  "document_id": "UUID",
  "document_type": "sp_resolution | sp_ordinance | appropriation_ordinance",
  "created_by": "UUID",              // invariant 11: encoder ≠ final approver

  // Set by Certified Urgent bypass handler
  "certified_urgent": false,         // must be true after bypass applied
  "certified_urgent_document_id": "UUID | null",

  // Set by multi_referral Thursday cutoff job
  "second_reading_eligible_date": "YYYY-MM-DD | null",

  // Set when Transmittal Letter step completes
  "mayor_transmittal_date": "TIMESTAMPTZ | null",
  "mayor_action_deadline": "TIMESTAMPTZ | null",   // = transmittal_date + 10 days

  // Set when Mayor acts or lapse fires
  "mayor_action": "SIGNED | VETOED | LAPSED | null",
  "mayor_action_date": "TIMESTAMPTZ | null",        // = mayor_action_deadline when lapsed

  // Set when SP votes on veto override
  "veto_override_vote_count": "integer | null",
  "veto_override_outcome": "OVERRIDE_SUCCEEDED | OVERRIDE_FAILED | null",

  // Set when Secretariat logs transmission to Panlalawigan
  "panlalawigan_transmission_date": "TIMESTAMPTZ | null",
  "panlalawigan_action_deadline": "TIMESTAMPTZ | null",  // = transmission_date + 30 days

  // Set when Secretariat records outcome or 30-day timer fires
  "panlalawigan_outcome": "VALID | VALID_IN_PART | RETURNED | DEEMED_APPROVED | OPERATIVE_IN_ITS_ENTIRETY | null",
  "panlalawigan_response_date": "TIMESTAMPTZ | null"     // = panlalawigan_action_deadline when deemed approved
}
```