# Workflow Engine Specification — Filtered for Phase 1 Seed Record Authoring

**Source document:** B4 — Workflow Engine Specification  
**Platform:** Batac City LGU Platform  
**Filter purpose:** Retains only the content needed to author the Phase 1 workflow definition seed records (`workflow.definitions`, `workflow.definition_versions`, `workflow.steps`, `workflow.transition_rules`). Runtime engine internals, instance lifecycle management, version migration, SLA scheduler logic, event catalog, and audit internals have been removed.

---

## What the Seed Records Must Include

Each workflow definition seed must fully specify:

- All steps with their `step_type`, `step_key`, `label`, `config` (including `assignee`, `allowed_outcomes`, `require_all_committee_signatures`, `thursday_cutoff_enabled`, etc.)
- All transition rules with `from_step_id`, `to_step_id`, `outcome_filter`, `condition_expression`, and `priority`
- The `multi_referral` step with `require_all_committee_signatures = true` and `thursday_cutoff_enabled = true`
- Transition rules for: `LAPSED` (Mayor 10-day), `DEEMED_APPROVED` (Panlalawigan 30-day), and `BYPASSED_CERTIFIED_URGENT` (committee bypass)
- Legally mandated minimum step guards (enforced at workflow editor validation per Architectural Invariant #14)

---

## 1. Design Principles Relevant to Seed Data

**Deterministic execution.** Given the same instance state and the same inputs, the engine always produces the same outputs. All transition rules must be unambiguous: every step's outcome codes must be covered by at least one outgoing transition rule, or the instance enters `stuck` status. There must be no gaps in transition coverage.

**Fail-closed on ambiguity.** If transition evaluation produces no matching rule and no default is configured, the instance enters `stuck` status. Seed record authors must ensure every outcome code in `config.allowed_outcomes` has a corresponding outgoing transition rule (with matching `outcome_filter`), or a default unconditional rule (`condition_expression IS NULL`, `outcome_filter IS NULL`) must exist as a catch-all. Definitions lacking this coverage are rejected at publish time with `MISSING_OUTCOME_TRANSITION`.

---

## 2. Data Model — Tables Being Seeded

### 2.1 `workflow.definitions`

The admin-authored workflow template. One definition per document type. At most one definition per document type may be active at any time (enforced by a DB partial unique index on `document_type_id WHERE is_active = true`).

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|Multi-tenant anchor|
|`document_type_id`|`UUID`|Logical FK → `documents.document_types.id`|
|`name`|`TEXT`|Human label (e.g., `"SP Resolution — 7th SP"`)|
|`description`|`TEXT`|Nullable|
|`is_active`|`BOOLEAN`|Partial unique index: at most one active per `document_type_id`|
|`created_by`|`UUID`|Logical FK → `iam.users.id`|
|`created_at`|`TIMESTAMPTZ`|—|
|`deleted_at`|`TIMESTAMPTZ`|Nullable; soft delete|
|`deleted_by`|`UUID`|Nullable|

### 2.2 `workflow.definition_versions`

An immutable published snapshot of a definition. Drafts (`published_at IS NULL`) are mutable. At most one version per definition may have `is_current = true`.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`definition_id`|`UUID`|FK → `workflow.definitions.id`|
|`version_number`|`INTEGER`|Monotonically increasing per definition|
|`snapshot`|`JSONB`|Complete definition snapshot at publish time: all steps and transition rules. **Authoritative on conflict with denormalized rows.**|
|`published_at`|`TIMESTAMPTZ`|Nullable; non-null = published and immutable|
|`published_by`|`UUID`|Nullable; logical FK → `iam.users.id`|
|`deprecated_at`|`TIMESTAMPTZ`|Nullable; set when a newer version is published|
|`is_current`|`BOOLEAN`|Partial unique index: one current per `definition_id WHERE is_current = true`|
|`created_at`|`TIMESTAMPTZ`|—|

### 2.3 `workflow.steps`

Step definitions belonging to a specific definition version. Denormalized from `snapshot` for efficient querying. The `snapshot` column on `definition_versions` is authoritative; these rows are derived.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`definition_version_id`|`UUID`|FK → `workflow.definition_versions.id`|
|`step_key`|`TEXT`|Stable domain identifier within the definition (e.g., `first_reading`, `committee_referral`, `second_reading`). Used for step mapping in Option B migration.|
|`step_type`|`workflow_step_type_enum`|See enum values below|
|`label`|`TEXT`|Human-readable display name|
|`config`|`JSONB`|Step-type-specific configuration; see Section 4 per type|
|`position`|`INTEGER`|Display ordering only; does not control execution sequence|
|`is_start`|`BOOLEAN`|Exactly one step per definition version must have `is_start = true`. Validated at publish time.|

**`workflow_step_type_enum` values:**

|Value|Phase|Notes|
|---|---|---|
|`action`|Phase 1|—|
|`approval`|Phase 1|—|
|`multi_referral`|Phase 1|—|
|`decision`|Phase 1|—|
|`notification`|Phase 1|—|
|`termination`|Phase 1|—|
|`parallel_split`|Reserved|Phase 2 — must be in enum; not executable in Phase 1|
|`parallel_join`|Reserved|Phase 2 — must be in enum; not executable in Phase 1|

### 2.4 `workflow.transition_rules`

Directed edges between steps. Evaluated after a step instance reaches a terminal status.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`definition_version_id`|`UUID`|FK → `workflow.definition_versions.id`|
|`from_step_id`|`UUID`|FK → `workflow.steps.id`|
|`to_step_id`|`UUID`|FK → `workflow.steps.id`|
|`condition_expression`|`TEXT`|Nullable; JSONLogic expression evaluated against instance context. `null` = unconditional (fires for any outcome).|
|`outcome_filter`|`TEXT`|Nullable; if set, rule only fires when the completed step instance's `outcome` exactly matches this value|
|`priority`|`INTEGER`|Lower value = evaluated first when multiple rules exit the same step|
|`label`|`TEXT`|Nullable; display label for the transition edge|

---

## 3. Assignee Resolution Reference

Each step's `config.assignee` is an expression resolved at step activation time. Seed record authors must supply the correct expression format.

|Expression Format|Resolution Behavior|
|---|---|
|`role:<role_key>`|All users currently holding this role|
|`office_role:<office_key>:<role_key>`|The user holding this role in this specific office|
|`delegation_aware:<role_key>`|Resolves `role:<role_key>`, then checks for active delegation grants|
|`actor_from_context:<context_key>`|The user whose ID is stored in `instance.context[context_key]` (for return-to-actor steps)|
|`static:<user_id>`|A specific user UUID. Use sparingly; prefer role-based resolution.|

---

## 4. Step Type Behavior Contracts — Config Fields

### 4.1 `action`

**Purpose:** An actor performs a task with no branching outcome. Records that the action occurred and by whom. Used for: SP Secretary logging receipt, Secretariat entering committee hearing date, Records Officer archiving.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`assignee`|`string`|Yes|Assignee resolution expression|
|`form_key`|`string`|No|Identifies the UI form presented to the actor|
|`require_comment`|`boolean`|No|Default `false`. If `true`, submission without a non-empty `outcome_comment` is rejected.|
|`allow_comment`|`boolean`|No|Default `true`|
|`auto_complete`|`boolean`|No|Default `false`. If `true`, step completes immediately on activation with no user input.|
|`deadline_hours`|`integer`|No|If set, `step_instances.sla_deadline = started_at + deadline_hours`|

**Outcome codes:** Always `DONE`.

**Transition pattern:** Typically one unconditional outgoing transition (no `condition_expression`, no `outcome_filter`).

---

### 4.2 `approval`

**Purpose:** An actor makes a decision with a branching outcome. Used for: SP Secretary accepting a committee report, Vice Mayor signing, Mayor reviewing, Panlalawigan review outcome recording.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`assignee`|`string`|Yes|Assignee resolution expression|
|`allowed_outcomes`|`string[]`|Yes|Subset of valid outcome codes listed below|
|`require_comment_on`|`string[]`|No|Default `['REJECTED', 'RETURNED_FOR_REVISION']`. Outcomes in this list require a comment.|
|`deadline_hours`|`integer`|No|Step-level SLA deadline|

**Valid outcome codes** (`config.allowed_outcomes` must be a subset of these):

|Code|Meaning|Who Sets It|
|---|---|---|
|`APPROVED`|Actor approves|Actor|
|`REJECTED`|Actor rejects; requires comment|Actor|
|`RETURNED_FOR_REVISION`|Sent back for amendment; requires comment|Actor|
|`SIGNED`|Document signed (VP and Mayor signature steps)|Actor|
|`VETOED`|Mayor vetoes|Actor|
|`LAPSED`|Mayor took no action within 10 calendar days|**Scheduler only**|
|`OVERRIDE_SUCCEEDED`|SP voted to override veto (2/3 majority = 8 of 12)|Secretariat actor|
|`OVERRIDE_FAILED`|SP veto override failed|Secretariat actor|
|`VALID`|Panlalawigan approved|Secretariat actor|
|`VALID_IN_PART`|Panlalawigan partially approved|Secretariat actor|
|`RETURNED`|Panlalawigan returned with objections|Secretariat actor|
|`OPERATIVE_IN_ITS_ENTIRETY`|Panlalawigan outcome for Appropriation Ordinances; treated identically to `VALID`|Secretariat actor|
|`DEEMED_APPROVED`|Panlalawigan 30-day lapse|**Scheduler only**|
|`REPORT_ACCEPTED`|SP Secretary accepts unified committee report; used in `multi_referral` acceptance|Actor|

**Critical constraint on scheduler-only outcomes:** `LAPSED` and `DEEMED_APPROVED` may only be submitted with `actor_type = system`. The engine enforces this. These outcomes must still appear in `config.allowed_outcomes` on the relevant steps so that outgoing transition rules can reference them via `outcome_filter`.

**Transition coverage requirement:** Every outcome code in `config.allowed_outcomes` must have at least one outgoing transition rule with a matching `outcome_filter`, or a default unconditional transition must exist. Definitions lacking this coverage are rejected at publish time with `MISSING_OUTCOME_TRANSITION`.

**Additional requirement (Engine Invariant #4):** Every `approval` step whose `allowed_outcomes` includes `LAPSED` must have an outgoing transition rule with `outcome_filter = 'LAPSED'`. Publication fails with `MISSING_LAPSE_TRANSITION` if this rule is absent.

---

### 4.3 `multi_referral`

**Purpose:** Assigns a document to multiple committees simultaneously for joint review and a single unified committee report. Standard referral mechanism for SP Resolutions and Ordinances. Most measures are referred to two committees concurrently: the relevant subject-matter committee and the Committee on Laws. All assigned committees must contribute to the unified report before the step can complete normally.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`default_committee_roles`|`string[]`|Yes|Default list of role keys for assigned committees|
|`report_acceptor_role`|`string`|Yes|Role key for the actor who accepts the unified report (SP Secretary)|
|`thursday_cutoff_enabled`|`boolean`|Yes|**Must be `true`** for all SP Resolution and Ordinance referral steps|
|`cutoff_time_pht`|`string`|Yes|Time in PHT at which Thursday cutoff fires. Required value: `"23:59:59"`|
|`require_all_committee_signatures`|`boolean`|Yes|**Must be `true`**; all committees must contribute|
|`allow_secretary_advance`|`boolean`|Yes|Permits SP Secretary to manually advance; always requires a non-empty comment; always audit-logged|

**Step instance metadata schema** (for reference when specifying transition logic — the engine populates this at runtime):

```json
{
  "assigned_committees": [
    { "committee_id": "<UUID>", "role_key": "string", "label": "string" }
  ],
  "submissions": [
    {
      "committee_id": "<UUID>",
      "submitted_by": "<UUID>",
      "submitted_at": "<TIMESTAMPTZ>",
      "contribution_document_id": "<UUID>",
      "missed": false
    }
  ],
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

**Outcome codes for transition rules:**

|Code|Meaning|
|---|---|
|`COMMITTEE_SUBMITTED`|Intermediate; individual committee submission (not the step's final outcome)|
|`REPORT_ACCEPTED`|SP Secretary accepted the unified report; step completes normally|
|`SECRETARY_ADVANCED`|SP Secretary manually advanced; some committees may not have submitted|
|`BYPASSED_CERTIFIED_URGENT`|Step bypassed because the Mayor issued a Certification of Urgency|

**Certified Urgent transition requirement:** The definition **must** include a transition rule with `outcome_filter = 'BYPASSED_CERTIFIED_URGENT'` pointing to the Second Reading step. The admin UI enforces this at definition publish time.

**Engine Invariant #2:** A `multi_referral` step with `require_all_committee_signatures = true` cannot complete with `outcome = REPORT_ACCEPTED` unless all committees have submissions OR `manual_advance = true`. This is enforced by the engine at runtime, but seed definitions must not disable `require_all_committee_signatures`.

**Engine Invariant #7:** SP Secretary manual advance of a `multi_referral` step requires a non-empty `outcome_comment`. Enforced by the engine; the definition must set `allow_secretary_advance = true` for this path to be available.

---

### 4.4 `decision`

**Purpose:** A system-evaluated branch. No user action required. The engine evaluates a condition against the instance context immediately on activation and routes accordingly. Used for: checking whether a measure is certified urgent, checking Mayor action outcome, routing based on whether a document has a penalty clause.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`condition_expression`|`string`|Yes|JSONLogic expression evaluated against `instance.context`. Must return truthy or falsy.|
|`true_outcome`|`string`|No|Default `"TRUE"`. `outcome` value when expression is truthy.|
|`false_outcome`|`string`|No|Default `"FALSE"`. `outcome` value when expression is falsy.|

**`auto_complete` is always `true` for `decision` steps.** This is enforced by the engine; it cannot be configured otherwise.

**Time-based conditions are NOT implemented via `decision` step expressions.** Time-based transitions (10-day Mayor lapse, 30-day Panlalawigan) are implemented by the scheduler setting context keys on the relevant `approval` steps. Decision steps that follow these approval steps may branch on those context values.

**Example context expressions for Phase 1 steps:**

```json
{ "==": [{ "var": "certified_urgent" }, true] }
{ "==": [{ "var": "mayor_action" }, "VETOED"] }
{ "==": [{ "var": "document_type" }, "sp_ordinance"] }
{ "!=": [{ "var": "panlalawigan_outcome" }, null] }
{ "==": [{ "var": "requires_publication" }, true] }
```

**Transition pattern:** Two outgoing transition rules: one with `outcome_filter = <true_outcome>`, one with `outcome_filter = <false_outcome>`. Both must be present.

---

### 4.5 `notification`

**Purpose:** The engine sends a notification to one or more recipients. No user action required. The step completes immediately after the notification is enqueued. Delivery failure does not affect the workflow.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`template_key`|`string`|Yes|Key of the notification template (`notifications.templates`)|
|`recipients`|`string[]`|Yes|Recipient expressions (same format as assignee resolution, plus `context:<context_key>`)|
|`channels`|`string[]`|No|Default `["in_app"]`. Valid values: `"in_app"`, `"email"`. (SMS Phase 2+)|
|`payload_context_keys`|`string[]`|No|Context keys whose values are passed as template variables to the notification template|

**Outcome codes:** Always `DISPATCHED`.

**Transition pattern:** One unconditional outgoing transition.

---

### 4.6 `termination`

**Purpose:** Ends a workflow instance. Applies a final status to the associated document.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`outcome_code`|`string`|Yes|Semantic outcome of the workflow (see valid codes below)|
|`final_document_status`|`string`|Yes|Document lifecycle status to apply: `RELEASED`, `ARCHIVED`, `CANCELLED`|
|`emit_event`|`string`|No|Additional domain event key to emit on the event bus|

**Valid `outcome_code` values:**

|Code|Meaning|
|---|---|
|`APPROVED_AND_RELEASED`|Full legislative lifecycle completed; document released|
|`LAPSED_INTO_LAW`|Mayor took no action within 10 calendar days|
|`DEEMED_APPROVED_PANLALAWIGAN`|Panlalawigan took no action within 30 days|
|`VETOED_OVERRIDE_FAILED`|Mayor vetoed; SP could not muster 2/3 override|
|`REJECTED_AT_VOTE`|Voted down at a reading session|
|`ARCHIVED_NO_ACTION`|Committee deferred; document archived|
|`CANCELLED`|Manually cancelled by authorized actor|
|`VALID_IN_PART_RESOLVED`|Panlalawigan returned VALID-IN-PART; Secretariat resolved without repass|
|`REPASSED`|Document returned to draft for amendment and repass (special handling — instance is NOT set to `completed`; engine emits `workflow.instance.repassed`)|

**`REPASSED` special handling (Engine Invariant #9):** A termination step with `outcome_code = REPASSED` must NOT set `instances.status = completed`. The engine handles this; the seed definition only needs to specify the `outcome_code = REPASSED` correctly. This outcome_code is used when the Panlalawigan returns a document and Secretariat decides to repass.

---

## 5. Phase 2 Reserved Step Types — Enum Requirement

The `workflow_step_type_enum` must include `parallel_split` and `parallel_join` at migration time. These types are not executable in Phase 1. No Phase 1 definition version may contain a step with these types; publication is rejected with `STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1`.

---

## 6. Special Control Flows — Constraints on Seed Definitions

### 6.1 Certified Urgent Bypass Path

**How it triggers:** When the documents module logs a Certification of Urgency, it emits an event containing the associated instance IDs. The workflow engine subscribes and executes the bypass sequence for each instance.

**What the seed definition must include:**

1. The `multi_referral` step must have `step_key = 'committee_referral'` (stable key required for bypass matching).
2. The definition must include a transition rule exiting the `multi_referral` step with `outcome_filter = 'BYPASSED_CERTIFIED_URGENT'` pointing to the Second Reading step. This rule is mandatory; publication is rejected without it.
3. The `decision` step checking `certified_urgent` (if the definition uses a pre-referral decision gate rather than relying solely on the bypass event) must have `condition_expression = { "==": [{ "var": "certified_urgent" }, true] }` and a `true_outcome` transition pointing to Second Reading.

**Bypass behavior:**

- The `multi_referral` step instance is set to `status = bypassed` with `bypass_reason = 'CERTIFIED_URGENT'`.
- Committee review is entirely skipped — no committee referral, no committee report required.
- For SP Resolutions: First and Second Reading occur in the same session.
- For SP Ordinances: First, Second, and Third Reading are still required; only committee referral is bypassed.

**Frequency:** High — this path must be fully supported in Phase 1.

---

### 6.2 Thursday Cutoff — Constraints on `multi_referral` Step Config

**The seed definition must set on the `multi_referral` step:**

- `thursday_cutoff_enabled: true`
- `cutoff_time_pht: "23:59:59"`

**Effect on transition rules:** The `multi_referral` step's completion (`outcome = REPORT_ACCEPTED` or `outcome = SECRETARY_ADVANCED`) must have outgoing transition rules. The `second_reading_eligible_date` is written to `instance.context` by the scheduler job and is available to subsequent decision steps as `{ "var": "second_reading_eligible_date" }`.

**Scheduling constraint:** The `second_reading_eligible_date` context key is used by the Order of Business view for display. The engine does not prevent activation of the Second Reading step if the eligible date has not arrived; scheduling enforcement is a query-layer concern. The seed definition does not need to encode session-date gating logic in transition rules.

**Thursday cutoff timing:**

- Cutoff: Thursday 23:59:59 PHT (UTC+08:00 → Thursday 15:59:59 UTC)
- If all committees submit before Thursday 23:59:59: eligible Tuesday = 5 days after Thursday (following Tuesday)
- If not all submitted before Thursday: Second Reading delayed to Tuesday after the week all committees submit

---

### 6.3 10-Day Mayor Lapse Timer — Constraints on Seed Definitions

**Legal basis:** RA 7160 Section 47. Applies to both SP Resolutions and SP Ordinances.

**Timer start:** Triggered when the Transmittal Letter step completes. The engine sets `instance.context.mayor_transmittal_date` and `instance.context.mayor_action_deadline = transmittal_date + 10 days`. The Mayor review step is activated immediately after.

**What the seed definition must include:**

1. A Transmittal Letter `action` step (mandatory step) immediately before the Mayor review step.
2. A Mayor review `approval` step with `allowed_outcomes` including at minimum: `['SIGNED', 'VETOED', 'LAPSED']`.
3. **Required transition rules exiting the Mayor review step:**

|`outcome_filter`|`to_step_id` target|Notes|
|---|---|---|
|`SIGNED`|Docketing step|Mayor signed within 10 days|
|`LAPSED`|Docketing step|Mandatory; scheduler-set outcome (Engine Invariant #4)|
|`VETOED`|Veto override step|Mayor vetoed within 10 days|

4. A Veto override `approval` step with `allowed_outcomes = ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED']` and transition rules:

|`outcome_filter`|`to_step_id` target|Notes|
|---|---|---|
|`OVERRIDE_SUCCEEDED`|Docketing step|Override 2/3 = 8 of 12 members|
|`OVERRIDE_FAILED`|Termination step|`outcome_code = VETOED_OVERRIDE_FAILED`|

**`completed_at` note:** The engine sets `step_instances.completed_at` to `instance.context.mayor_action_deadline` (the actual lapse time), not to the scheduler detection time. This is internal engine behavior; seed definitions do not configure it.

---

### 6.4 30-Day Panlalawigan Timer — Constraints on Seed Definitions

**Legal basis:** RA 7160 Section 56(d). Applies to both SP Resolutions and SP Ordinances.

**Timer start:** Triggered when the Secretariat logs transmission to the Sangguniang Panlalawigan (after the Docketing step). The engine sets `instance.context.panlalawigan_transmission_date` and `instance.context.panlalawigan_action_deadline = transmission_date + 30 days`.

**What the seed definition must include:**

1. A Docketing `action` step (after Mayor action returns document to Secretariat).
    
2. A Panlalawigan transmission `action` step immediately before the Panlalawigan review step.
    
3. A Panlalawigan review `approval` step with `allowed_outcomes` including: `['VALID', 'VALID_IN_PART', 'RETURNED', 'OPERATIVE_IN_ITS_ENTIRETY', 'DEEMED_APPROVED']`.
    
    - `OPERATIVE_IN_ITS_ENTIRETY` is only applicable for Appropriation Ordinance definitions; it is treated identically to `VALID`.
    - `DEEMED_APPROVED` is scheduler-only; must be in `allowed_outcomes` to enable the outgoing transition rule.
4. **Required transition rules exiting the Panlalawigan review step:**
    

|`outcome_filter`|`to_step_id` target|Notes|
|---|---|---|
|`VALID`|Publication decision step|Routes to newspaper publication check or directly to archive|
|`OPERATIVE_IN_ITS_ENTIRETY`|Publication decision step|Appropriation Ordinance only; same path as `VALID`|
|`DEEMED_APPROVED`|Publication decision step|Same as `VALID`; mandatory (Engine Invariant #4 analog)|
|`VALID_IN_PART`|SP Secretary action step|Secretariat chooses resolution path|
|`RETURNED`|High-priority Secretariat action step|Secretariat decides whether to modify/repass|

5. A `VALID_IN_PART` resolution path: `action` step assigned to SP Secretary presenting four options (enforced as `allowed_outcomes` on a follow-on `approval` step):

|Option|Outcome Code|Behavior|
|---|---|---|
|Resolve as-is with comment|`RESOLVED_IN_PLACE`|Mandatory comment; document marked with annotation|
|Route to Legal Office|`ROUTED_TO_LEGAL`|Routes to Legal Office `action` step|
|Route to concerned Committee|`ROUTED_TO_COMMITTEE`|Routes to committee `action` step|
|Implement revisions directly|`REVISED_DIRECTLY`|Mandatory comment; terminates with `VALID_IN_PART_RESOLVED`|

6. A `RETURNED` path: Secretariat action step offering:

|Option|Outcome Code|Behavior|
|---|---|---|
|Repass|`REPASS`|Termination step with `outcome_code = REPASSED`|
|Resolve recommendations directly|`RESOLVED_DIRECTLY`|Mandatory comment; terminates with `VALID_IN_PART_RESOLVED`|

---

## 7. Engine Invariants That Constrain Seed Definitions

The following invariants are enforced at runtime and/or at publish time. Seed record authors must ensure the definitions comply.

|#|Invariant|Implication for Seed Records|
|---|---|---|
|2|`multi_referral` with `require_all_committee_signatures = true` cannot complete with `REPORT_ACCEPTED` unless all committees submitted OR `manual_advance = true`|Set `require_all_committee_signatures: true` on all `multi_referral` steps. Do not override to `false`.|
|3|`LAPSED` and `DEEMED_APPROVED` outcomes may only be submitted with `actor_type = system`|Include these in `allowed_outcomes` for scheduler-driven steps; include matching `outcome_filter` transition rules; do not include these in `require_comment_on` lists.|
|4|Every `approval` step with `LAPSED` in `allowed_outcomes` must have a transition rule with `outcome_filter = 'LAPSED'`|Mandatory transition rule on Mayor review step.|
|5|No definition version may include `parallel_split` or `parallel_join` step types in Phase 1|Do not use these step types in any Phase 1 definition.|
|7|SP Secretary manual advance of a `multi_referral` step requires a non-empty `outcome_comment`|Set `allow_secretary_advance: true` on the `multi_referral` step; the engine enforces the comment requirement.|
|9|A termination step with `outcome_code = REPASSED` must not set `instances.status = completed`|Engine handles this; seed only needs correct `outcome_code`.|
|11|The encoder (document creator) and the final approver of the same document cannot be the same user|The engine checks `instance.context.created_by` against the actor on steps marked `is_final_approval = true`. Tag the appropriate approval step with `is_final_approval: true` in its config.|
|12|No outgoing transition rule may reference a `to_step_id` from a different `definition_version_id` than the instance's pinned version|All `from_step_id` and `to_step_id` values in transition rules must reference steps within the same `definition_version_id`.|

**Architectural Invariant #14 (from Part 12 of the consolidated reference):** Workflow constraints per document type (legally mandated minimum steps) — enforcement method: Workflow editor validation. The seed definitions must include guards that prevent a Platform Administrator from removing legally required steps through the admin UI.

**Minimum step guards by document type (cannot be removed by admin):**

|Document Type|Minimum Required Steps|
|---|---|
|SP Resolution|Committee referral OR Certified Urgent path; Second Reading vote; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Release|
|SP Ordinance|Committee referral OR Certified Urgent path; Three readings; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Publication (if penalty); Release|
|Appropriation Ordinance|Same as SP Ordinance; `OPERATIVE_IN_ITS_ENTIRETY` Panlalawigan outcome handled as `VALID`|

---

## 8. Workflow Instance Context Schema (Reference for Transition Expressions)

The `instances.context JSONB` column is the mutable state store for a workflow instance. All `condition_expression` values in `transition_rules` are evaluated against this schema. Keys referenced in expressions must match these key names exactly.

```jsonc
{
  // ── Document identity ──────────────────────────────────────────────────────
  "document_id": "UUID",
  "document_type": "sp_resolution | sp_ordinance | appropriation_ordinance",

  // ── Numbering (written by documents module; workflow engine reads only) ────
  "series_number_preliminary": "string | null",
  "series_number_final": "string | null",
  "qr_tracking_id": "UUID",

  // ── Certified Urgent (set by certification urgency bypass handler) ─────────
  "certified_urgent": false,                        // Usable in decision step expressions
  "certified_urgent_document_id": "UUID | null",

  // ── Multi-referral scheduling output ──────────────────────────────────────
  "second_reading_eligible_date": "ISO date string YYYY-MM-DD | null",

  // ── Mayor review ──────────────────────────────────────────────────────────
  "mayor_transmittal_date": "TIMESTAMPTZ | null",
  "mayor_action_deadline": "TIMESTAMPTZ | null",
  "mayor_action": "SIGNED | VETOED | LAPSED | null",  // Usable in decision step expressions
  "mayor_action_date": "TIMESTAMPTZ | null",

  // ── Veto override vote ────────────────────────────────────────────────────
  "veto_override_vote_count": "integer | null",
  "veto_override_outcome": "OVERRIDE_SUCCEEDED | OVERRIDE_FAILED | null",

  // ── Panlalawigan review ───────────────────────────────────────────────────
  "panlalawigan_transmission_date": "TIMESTAMPTZ | null",
  "panlalawigan_action_deadline": "TIMESTAMPTZ | null",
  "panlalawigan_outcome": "VALID | VALID_IN_PART | RETURNED | DEEMED_APPROVED | OPERATIVE_IN_ITS_ENTIRETY | null",
  "panlalawigan_response_date": "TIMESTAMPTZ | null",
  "panlalawigan_resolution_number": "string | null",

  // ── Publication ───────────────────────────────────────────────────────────
  "requires_publication": "boolean",   // Set by decision step evaluating penalty clause
  "publication_date": "ISO date string YYYY-MM-DD | null",
  "publication_newspaper": "string | null",

  // ── Creator reference (Invariant #11) ─────────────────────────────────────
  "created_by": "UUID",

  // ── SLA ───────────────────────────────────────────────────────────────────
  "sla_paused": false   // Always false in Phase 1; reserved
}
```

**Note:** The context schema is enforced by Zod schemas in `/packages/shared`, not by PostgreSQL constraints. Expressions referencing undefined context keys evaluate to `null` (falsy in JSONLogic).

---

## 9. SLA Configuration in Step Config

Step-level SLA is configured via the `deadline_hours` field on `action` and `approval` steps. Instance-level SLA is computed from the document type configuration, not from the workflow definition itself.

ARTA defaults (configurable per document type by Platform Administrator):

|Transaction Category|Default Threshold|
|---|---|
|Simple|3 working days|
|Complex|7 working days|
|Highly technical|20 working days|

SP Resolutions and SP Ordinances are classified as **complex** by default.

**RA 11032 (ARTA) compliance obligations do not pause during system outages.** The SLA clock continues regardless of system availability. This is a firm legal constraint; it does not affect seed definition authoring but must be noted for SLA deadline configuration.

---

_This filtered document retains only the content from B4 needed to author Phase 1 workflow definition seed records. Runtime engine internals, instance lifecycle management, version migration, SLA scheduler algorithms, the event catalog, and audit internals have been removed._