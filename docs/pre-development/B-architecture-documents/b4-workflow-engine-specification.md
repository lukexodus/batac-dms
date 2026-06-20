# Workflow Engine Specification

**Document:** B4  
**Platform:** Batac City LGU Platform  
**Status:** BLOCKING — development of the `workflow` module must not begin before this document is reviewed and accepted  
**Last Updated:** June 2026  
**Audience:** Backend development team  
**Source Documents:** `consolidated-architecture-and-requirements-reference-iteration-3.md` (Post-Interview 2, developer decisions incorporated); `tech-stack.md`

---

## Table of Contents

- [L47–L69] About This Document — Scope of the specification (included and excluded modules) and authority of the design decisions.
- [L70–L83] 1. Design Principles — Core architectural tenets: custom engine justification, determinism, event-driven state, fail-closed rules, and audit-first logging.
- [L84–L243] 2. Data Model — PostgreSQL schema rules and metadata for definitions, versions, steps, transitions, instances, events, and lifecycle enums.
  - [L90–L106] 2.1 `workflow.definitions` — Schema for admin-authored templates, mapping to document types with multi-tenant anchors.
  - [L107–L123] 2.2 `workflow.definition_versions` — Schema for immutable definition snapshots, tracking versioning, publishing metadata, and active status.
  - [L124–L141] 2.3 `workflow.steps` — Schema for denormalized step configurations and display ordering, including the valid step type enum values.
  - [L142–L157] 2.4 `workflow.transition_rules` — Schema for transition rules between steps, containing JSONLogic condition expressions, outcome filters, and execution priority.
  - [L158–L178] 2.5 `workflow.instances` — Schema for running workflows, capturing pinned version references, SLA deadlines, and mutable context state.
  - [L179–L202] 2.6 `workflow.step_instances` — Schema for active step execution, tracking resolved assignees, outcomes, comments, step-level SLAs, and bypass details.
  - [L203–L218] 2.7 `workflow.workflow_events` — Schema for the append-only event log capturing all instance state changes transactionally.
  - [L219–L243] 2.8 Lifecycle State Enums — Database enum definitions mapping instance and step execution states to their descriptions.
- [L244–L327] 3. Execution Model — Engine entry points, instance initialization, step resolution sequence, JSONLogic transition checks, assignee resolution, and event emission.
- [L328–L555] 4. Phase 1 Step Type Behavior Contracts — Execution specifications, configuration schemas, metadata structures, outcome codes, and completion rules for Phase 1 step types.
  - [L330–L358] 4.1 `action` — Rules for non-branching user tasks or automated system steps yielding a single `DONE` outcome.
  - [L359–L398] 4.2 `approval` — Configuration and outcomes for manual review decisions, with strict system guards on scheduling automatic lapse outcomes.
  - [L399–L477] 4.3 `multi_referral` — Concurrent multi-committee document referrals, specifying metadata structures, Secretary manual overrides, and Order of Business scheduling integration.
  - [L478–L506] 4.4 `decision` — Automated branching step executing JSONLogic expressions on instance context without user interaction.
  - [L507–L523] 4.5 `notification` — Asynchronous template-based notification dispatching to resolved recipients across in-app, email, and SMS channels.
  - [L524–L555] 4.6 `termination` — Final execution step resolving workflows, specifying document status updates, cancellation cleanup, and the special `REPASSED` loop.
- [L556–L571] 5. Phase 2 Reserved Step Types — Definitions and strict Phase 1 execution blocks for upcoming multi-branch split and join steps.
- [L572–L828] 6. Special Control Flows — Business logic and automated scheduler actions for legislative exceptions, deadlines, vetoes, and deemed approvals.
  - [L574–L623] 6.1 Certified Urgent Bypass Path — Automatic bypass of committee referrals upon receipt of a Mayor's logged Certification of Urgency.
  - [L624–L687] 6.2 Thursday Cutoff Enforcement and Second Reading Delay — Idempotent scheduler job computing next-week Second Reading eligibility dates based on Thursday cutoff times.
  - [L688–L751] 6.3 10-Day Mayor Lapse Timer — Hourly scheduler job handling the 10-day Mayor review deadline, veto overrides, and race condition prevention.
  - [L752–L828] 6.4 30-Day Panlalawigan Timer — Daily scheduler job implementing deemed-approval lapses and Secretariat manual response routing for Sangguniang Panlalawigan reviews.
- [L829–L875] 7. Version Management — Definition pinning rules at creation, default execution (Option A), and administrative migration controls (Option B).
- [L876–L920] 8. SLA Clock and Escalation — Wall-clock SLA definitions, ARTA-compliant system outage behaviors, and automated multi-stage warning and breach escalations.
- [L921–L942] 9. Engine Invariants — Thirteen runtime engine and database constraints governing definition state, actor conflicts, and step completions.
- [L943–L980] Appendix A: Domain Events Catalog — Canonical list of all Workflow module domain events, execution triggers, and core payload structures.
- [L981–L1043] Appendix B: Workflow Instance Context Schema — JSONB payload keys and type definitions schema for storing mutable workflow instance context state variables.

---

## About This Document

This document specifies the complete behavior of the custom workflow engine. It covers:

- The data model for the `workflow` PostgreSQL schema
- The execution model: step resolution, transition evaluation, and domain event emission
- Full behavior contracts for all Phase 1 step types (`action`, `approval`, `multi_referral`, `decision`, `notification`, `termination`) and the schema reservations for Phase 2 types (`parallel_split`, `parallel_join`)
- All special control flows: Certified Urgent bypass, Thursday cutoff enforcement and Second Reading delay, 10-day Mayor lapse timer, and 30-day Panlalawigan timer with RA 7160 Section 56(d) deemed-approval transition
- Version pinning at instance creation, and Option A/B in-flight instance migration
- SLA clock semantics, escalation, and behavior during system outages
- Engine invariants enforced at runtime

**What this document does not cover:**

- The workflow definition admin UI
- The audit module (the workflow engine emits events to it; it does not own it)
- Document-specific workflow templates for SP Resolution, Ordinance, etc. (covered in separate document type specs)
- The notification delivery pipeline (the engine enqueues notifications; the notifications module delivers them)

**On design decisions:** Requirements sourced from interview findings and developer decisions are noted as confirmed facts. Data model specifics (column names, JSON schemas, enum values) that are not present verbatim in the source documents are spec decisions made here; they are authoritative for implementation unless revised through the normal spec review process.

---

## 1. Design Principles

**Custom engine, not a framework.** This engine is domain-specific. It must be fully configurable by the Platform Administrator without developer involvement. It must not be replaced with Camunda, Temporal, Flowable, or any external workflow framework. The on-premise deployment constraint, LGU data sovereignty requirements, and the domain-specific legislative process rules (Certified Urgent bypass, Thursday cutoff, mandatory step sequencing under RA 7160) justify a custom implementation.

**Deterministic execution.** Given the same instance state and the same inputs, the engine always produces the same outputs. All elapsed-time computations are based on `TIMESTAMPTZ` values stored in the database at the moment events occur. The scheduler triggers timer evaluation; it does not determine outcomes. No ambient state outside the `workflow` schema affects step resolution.

**Event-driven, RDBMS-stored.** Every state transition emits a domain event. `step_instances` and `instances` store current state for efficient querying. `workflow_events` is the immutable event log. On any inconsistency, events are the record of truth.

**Fail-closed on ambiguity.** If transition evaluation produces no matching rule and no default is configured, the instance enters `stuck` status and notifies the Platform Administrator. The engine never silently drops an instance into a terminal state without an explicit termination step reaching it.

**Audit-first.** Every actor interaction — including SP Secretary manual advances of `multi_referral` steps and all Option B migration operations — is audit-logged with actor, timestamp, and a mandatory non-empty reason. The workflow engine never writes directly to the `audit` schema; it emits structured events and the audit service writes the entries.

---

## 2. Data Model

The workflow engine owns the `workflow` PostgreSQL schema exclusively. No other module reads this schema directly. Cross-schema foreign key constraints are prohibited per architectural invariants.

All tables follow platform-wide conventions: `UUID` primary keys (`gen_random_uuid()`), `TIMESTAMPTZ` on all timestamp columns, `city_id UUID NOT NULL` on all core entity tables, and soft-delete via `deleted_at TIMESTAMPTZ / deleted_by UUID` on tables that support deletion semantics. Columns are `NOT NULL` unless explicitly marked nullable.

### 2.1 `workflow.definitions`

The admin-authored workflow template. A definition belongs to one document type. At most one definition per document type may be active at any time (enforced by a DB partial unique index on `document_type_id WHERE is_active = true`).

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|Multi-tenant anchor|
|`document_type_id`|`UUID`|Logical FK → `documents.document_types.id`|
|`name`|`TEXT`|Human label (e.g., "SP Resolution — 7th SP")|
|`description`|`TEXT`|Nullable|
|`is_active`|`BOOLEAN`|Partial unique index: at most one active per `document_type_id`|
|`created_by`|`UUID`|Logical FK → `iam.users.id`|
|`created_at`|`TIMESTAMPTZ`|—|
|`deleted_at`|`TIMESTAMPTZ`|Nullable; soft delete|
|`deleted_by`|`UUID`|Nullable|

### 2.2 `workflow.definition_versions`

An immutable published snapshot of a definition. Once published, a version cannot be modified; editing a definition creates a new version. Drafts (`published_at IS NULL`) are mutable. At most one version per definition may have `is_current = true` (DB partial unique index).

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`definition_id`|`UUID`|FK → `workflow.definitions.id`|
|`version_number`|`INTEGER`|Monotonically increasing per definition|
|`snapshot`|`JSONB`|Complete definition snapshot at publish time: all steps and transition rules. Authoritative on conflict with denormalized rows.|
|`published_at`|`TIMESTAMPTZ`|Nullable; non-null = published and immutable|
|`published_by`|`UUID`|Nullable; logical FK → `iam.users.id`|
|`deprecated_at`|`TIMESTAMPTZ`|Nullable; set when a newer version is published|
|`is_current`|`BOOLEAN`|Partial unique index: one current per `definition_id WHERE is_current = true`|
|`created_at`|`TIMESTAMPTZ`|—|

### 2.3 `workflow.steps`

Step definitions belonging to a specific definition version. These rows are denormalized from `snapshot` for efficient querying. The `snapshot` column on `definition_versions` is authoritative; these rows are derived and must be regenerated if they diverge.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`definition_version_id`|`UUID`|FK → `workflow.definition_versions.id`|
|`step_key`|`TEXT`|Stable domain identifier within the definition (e.g., `first_reading`, `committee_referral`, `second_reading`). Used for step mapping in Option B migration.|
|`step_type`|`workflow_step_type_enum`|See Section 3|
|`label`|`TEXT`|Human-readable display name|
|`config`|`JSONB`|Step-type-specific configuration; see Section 3 per type|
|`position`|`INTEGER`|Display ordering only; does not control execution sequence|
|`is_start`|`BOOLEAN`|Exactly one step per definition version must have `is_start = true`. Validated at publish time.|

**`workflow_step_type_enum` values:** `action`, `approval`, `multi_referral`, `decision`, `notification`, `termination`, `parallel_split` (reserved), `parallel_join` (reserved).

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

### 2.5 `workflow.instances`

A running workflow for a specific document.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`definition_version_id`|`UUID`|FK → `workflow.definition_versions.id`. **Pinned at creation. Never updated except by Option B migration.**|
|`document_id`|`UUID`|Logical FK → `documents.documents.id`|
|`status`|`workflow_instance_status_enum`|See Section 2.7|
|`context`|`JSONB`|Mutable key-value state store; see Appendix B|
|`sla_deadline`|`TIMESTAMPTZ`|Nullable; computed at creation from document type SLA configuration|
|`sla_breached_at`|`TIMESTAMPTZ`|Nullable; set by the SLA monitor when breach is detected. Set to `sla_deadline`, not to detection time.|
|`started_at`|`TIMESTAMPTZ`|Timestamp when the instance was created and the start step activated|
|`completed_at`|`TIMESTAMPTZ`|Nullable; set when a termination step is reached|
|`created_by`|`UUID`|Logical FK → `iam.users.id`|
|`created_at`|`TIMESTAMPTZ`|—|
|`deleted_at`|`TIMESTAMPTZ`|Nullable|
|`deleted_by`|`UUID`|Nullable|

### 2.6 `workflow.step_instances`

A running step within a workflow instance.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`instance_id`|`UUID`|FK → `workflow.instances.id`|
|`step_id`|`UUID`|FK → `workflow.steps.id`. Always from the pinned definition version.|
|`status`|`workflow_step_status_enum`|See Section 2.7|
|`assigned_to`|`JSONB`|Nullable; resolved assignee(s) at activation time. Format varies by step type; see Section 3.|
|`started_at`|`TIMESTAMPTZ`|Nullable; when the step became `active`|
|`completed_at`|`TIMESTAMPTZ`|Nullable; when the step reached a terminal status|
|`outcome`|`TEXT`|Nullable; step-type-specific outcome code|
|`outcome_comment`|`TEXT`|Nullable; actor-supplied reason or comment|
|`metadata`|`JSONB`|Nullable; step-type-specific mutable data. See Section 3 per type.|
|`sla_deadline`|`TIMESTAMPTZ`|Nullable; step-level SLA deadline if configured in step `config`|
|`sla_breached_at`|`TIMESTAMPTZ`|Nullable|
|`bypassed_at`|`TIMESTAMPTZ`|Nullable; set if step was bypassed (e.g., Certified Urgent)|
|`bypassed_by`|`UUID`|Nullable; actor UUID or null for system-triggered bypasses|
|`bypass_reason`|`TEXT`|Nullable; reason code|
|`created_at`|`TIMESTAMPTZ`|—|

### 2.7 `workflow.workflow_events`

Immutable event log for each workflow instance. Append-only within the workflow schema. Rows are written as part of the database transaction that causes each state change; no event is emitted without a committed row here.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`instance_id`|`UUID`|FK → `workflow.instances.id`|
|`step_instance_id`|`UUID`|Nullable; FK → `workflow.step_instances.id`|
|`event_type`|`TEXT`|See Appendix A|
|`actor_id`|`UUID`|Nullable; null for system-generated events|
|`actor_type`|`TEXT`|`user` \| `system` \| `scheduler`|
|`payload`|`JSONB`|Event-specific data|
|`occurred_at`|`TIMESTAMPTZ`|Wall-clock time at emission, within the committing transaction|

### 2.8 Lifecycle State Enums

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
|`pending`|Created but not yet activated (step is queued for future activation)|
|`active`|Assigned to an actor and awaiting completion|
|`completed`|Finished normally; `outcome` and `completed_at` are set|
|`bypassed`|Skipped; `bypassed_at`, `bypassed_by`, and `bypass_reason` are set|
|`cancelled`|Cancelled as part of instance cancellation|
|`failed`|Internal engine error during step execution; triggers immediate alerting|

---

## 3. Execution Model

### 3.1 Engine Entry Points

The engine is a service inside `/apps/server`. It exposes no public API surface. Interaction is via tRPC procedures (for `/apps/web`) and internal module interfaces (for event bus consumers). The following are the authoritative engine entry points:

|Method|Description|
|---|---|
|`engine.createInstance(documentId, definitionId)`|Creates and starts a new workflow instance|
|`engine.submitStepAction(stepInstanceId, actorId, outcome, comment, payload)`|Completes a step as an actor|
|`engine.bypassStep(stepInstanceId, actorId, bypassReason, comment)`|Bypasses a step via admin action; always audit-logged|
|`engine.cancelInstance(instanceId, actorId, reason)`|Cancels a running instance; reason is mandatory|
|`engine.migrateInstance(instanceId, targetVersionId, actorId, reason)`|Option B in-flight migration; see Section 8.3|
|`engine.evaluateTimers()`|Called by the scheduler; processes all time-based transitions|
|`engine.evaluateSlaBreaches()`|Called by the scheduler and on startup; detects SLA warnings and breaches|

All entry points execute within a PostgreSQL transaction. If any write fails, the entire operation is rolled back. Events are persisted within the same transaction; downstream consumers receive them after commit.

### 3.2 Instance Creation

When `engine.createInstance` is called:

1. Resolve the current active, published definition version for the given `definitionId`. Fail with `NO_ACTIVE_VERSION` if none exists.
2. Create a `workflow.instances` row. Set `definition_version_id` to the resolved version. This pin is permanent except via Option B migration.
3. Compute `sla_deadline` from the document type's SLA configuration and the current timestamp.
4. Initialize the `context` JSONB with required keys (see Appendix B). Set `context.document_id` and `context.document_type`.
5. Identify the start step (`is_start = true`). There must be exactly one.
6. Create a `step_instances` row for the start step with `status = active` and `started_at = NOW()`.
7. Resolve assignee(s) using the assignee resolution logic defined in the step's `config.assignee` (see Section 3.5).
8. Emit `workflow.instance.created` and `workflow.step.started`.
9. Enqueue in-app notifications to the resolved assignees.

### 3.3 Step Resolution Algorithm

The engine activates the next step immediately after the current step reaches a terminal status. The sequence:

1. Current step instance is set to `status = completed` (or `bypassed`).
2. Run transition evaluation (Section 3.4).
3. For the winning transition's `to_step_id`: create a new `step_instances` row with `status = active`.
4. Resolve assignees; emit `workflow.step.started`; enqueue notifications.
5. If the activated step type is `decision` or `notification`, execute it immediately within the same call chain (these steps do not wait for actor input).
6. If the activated step type is `termination`, execute termination logic (Section 5.6).

Steps are processed one at a time in Phase 1. There is no concurrent step execution except where the `multi_referral` step type receives parallel committee submissions (which are sequential writes to the same step instance, not concurrent step activations).

### 3.4 Transition Evaluation

Called after a step instance reaches a terminal status:

1. Load all `transition_rules` where `from_step_id = currentStep.id` and `definition_version_id = instance.definition_version_id`.
2. Filter out rules where `outcome_filter IS NOT NULL AND outcome_filter ≠ step_instance.outcome`.
3. Sort remaining candidates by `priority` ascending (lower value = higher priority).
4. For each candidate: evaluate `condition_expression` (JSONLogic) against the instance `context`. A rule with `condition_expression IS NULL` always matches.
5. The first matching rule fires. Its `to_step_id` is the next step.
6. **If no rule matches:**
    - Set `instance.status = stuck`.
    - Emit `workflow.instance.stuck` with the current step instance ID and the list of evaluated rules.
    - Notify the Platform Administrator and the assigned Records Officer.
    - Stop. Do not create a new step instance.

The transition evaluation is pure and sandboxed: the JSONLogic evaluator has read-only access to `instance.context`. It has no access to the database, no I/O, and no side effects. Expressions referencing undefined context keys evaluate to `null`, which is falsy in JSONLogic.

### 3.5 Assignee Resolution

Each step's `config.assignee` is a string expression that resolves to one or more users at the moment the step is activated. Resolution happens at activation time, not at definition authoring time, so delegation and role reassignments are reflected immediately.

|Expression Format|Resolution Behavior|
|---|---|
|`role:<role_key>`|All users currently holding this role|
|`office_role:<office_key>:<role_key>`|The user holding this role in this specific office|
|`delegation_aware:<role_key>`|Resolves `role:<role_key>`, then for each resolved user checks if there is a currently active delegation grant for that user. If yes, routes to the designated person instead of the original.|
|`actor_from_context:<context_key>`|The user whose ID is stored in `instance.context[context_key]`. Used for steps that must return to a specific earlier actor.|
|`static:<user_id>`|A specific user UUID. Use sparingly; prefer role-based resolution.|

Resolved assignees are written to `step_instances.assigned_to` as a JSONB array of `{ "user_id": "...", "resolved_via": "..." }` objects. This snapshot is the authoritative list for permission checks during the step's lifetime; subsequent delegation changes do not affect an already-active step.

### 3.6 Domain Event Emission

All events are emitted to the in-process event bus synchronously within the database transaction that causes the state change. The `workflow.workflow_events` row is written in the same transaction. After commit, the event bus notifies downstream subscribers (audit service, notification service). Downstream handlers are asynchronous and may fail without rolling back the state change; they must implement their own retry logic.

Events are never emitted speculatively. An event is always evidence of something that has already been committed to the database. The complete event catalog is in Appendix A.

---

## 4. Phase 1 Step Type Behavior Contracts

### 4.1 `action`

**Purpose:** An actor performs a task with no branching outcome. The step records that the action occurred and by whom. Examples: SP Secretary logs receipt of a document, Secretariat staff enters committee hearing date, Records Officer archives a document.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`assignee`|`string`|Yes|Assignee resolution expression|
|`form_key`|`string`|No|Identifies the UI form presented to the actor|
|`require_comment`|`boolean`|No|Default `false`. If `true`, submission without a non-empty `outcome_comment` is rejected.|
|`allow_comment`|`boolean`|No|Default `true`|
|`auto_complete`|`boolean`|No|Default `false`. If `true`, the step completes immediately on activation with `actor_type = system` and no user input required. Used for system-driven logging steps.|
|`deadline_hours`|`integer`|No|If set, `step_instances.sla_deadline = started_at + deadline_hours`|

**`step_instances.assigned_to`:** Array of resolved user objects.

**`step_instances.metadata`:** `null` for `action` steps (no structured metadata beyond the base columns).

**Outcome codes:** Always `DONE`.

**Completion:** Actor submits the action. Engine validates that `actor_id` is in `assigned_to`. Sets `status = completed`, `outcome = DONE`, `completed_at = NOW()`. Runs transition evaluation. `auto_complete` steps are completed by the engine itself immediately on activation.

**Rejection cases:** Actor not in `assigned_to` → `FORBIDDEN`. Step not in `active` status → `CONFLICT`. `require_comment = true` and no comment provided → `VALIDATION_FAILED`.

**Transition pattern:** Typically one unconditional outgoing transition (no `condition_expression`, no `outcome_filter`). Multiple conditional transitions are valid.

---

### 4.2 `approval`

**Purpose:** An actor reviews a document or action and makes a binary or ternary decision. Examples: SP Secretary accepts a committee report, Vice Mayor signs a certified copy, Mayor reviews a legislative measure. The branching outcome determines the next workflow step.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`assignee`|`string`|Yes|Assignee resolution expression|
|`allowed_outcomes`|`string[]`|Yes|Subset of valid outcome codes listed below|
|`require_comment_on`|`string[]`|No|Default `['REJECTED', 'RETURNED_FOR_REVISION']`. Outcomes in this list require a non-empty `outcome_comment`.|
|`deadline_hours`|`integer`|No|Step-level SLA deadline|

**Valid outcome codes (the config `allowed_outcomes` must be a subset of these):**

| Code                        | Meaning                                                                                     | Who Sets It                      |
| --------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------- |
| `APPROVED`                  | Actor approves                                                                              | Actor                            |
| `REJECTED`                  | Actor rejects; requires comment                                                             | Actor                            |
| `RETURNED_FOR_REVISION`     | Sent back for amendment; requires comment                                                   | Actor                            |
| `SIGNED`                    | Document signed (used for VP and Mayor signature steps)                                     | Actor                            |
| `VETOED`                    | Mayor vetoes                                                                                | Actor                            |
| `LAPSED`                    | Mayor took no action within 10 calendar days                                                | Scheduler only (see Section 7.3) |
| `OVERRIDE_SUCCEEDED`        | SP voted to override veto (2/3 majority = 8 of 12)                                          | Secretariat actor                |
| `OVERRIDE_FAILED`           | SP veto override failed                                                                     | Secretariat actor                |
| `VALID`                     | Panlalawigan approved                                                                       | Secretariat actor                |
| `VALID_IN_PART`             | Panlalawigan partially approved                                                             | Secretariat actor                |
| `RETURNED`                  | Panlalawigan returned with objections                                                       | Secretariat actor                |
| `OPERATIVE_IN_ITS_ENTIRETY` | Panlalawigan outcome for Appropriation Ordinances; treated identically to `VALID`           | Secretariat actor                |
| `DEEMED_APPROVED`           | Panlalawigan 30-day lapse; see Section 7.4                                                  | Scheduler only                   |
| `REPORT_ACCEPTED`           | SP Secretary accepts unified committee report; used in `multi_referral` acceptance sub-step | Actor                            |

**Guard on scheduler-only outcomes:** `engine.submitStepAction` must validate that `outcome` values of `LAPSED` and `DEEMED_APPROVED` are only accepted when `actor_type = system`. A human actor submitting either of these outcomes must receive `FORBIDDEN`.

**Completion:** Actor submits their decision. Engine validates actor authorization and comment requirements. Sets `status = completed`, `outcome`, `outcome_comment`, `completed_at = NOW()`. Transition evaluation fires using the submitted `outcome` matched against `outcome_filter` on transition rules.

**Requirement for transition coverage:** Every outcome code in `config.allowed_outcomes` must have at least one outgoing transition rule with a matching `outcome_filter`, or a default unconditional transition must exist. Definitions lacking this coverage are rejected at publish time with `MISSING_OUTCOME_TRANSITION`.

---

### 4.3 `multi_referral`

**Purpose:** Assigns a document to multiple committees simultaneously for joint review and a single unified committee report. This is the standard referral mechanism for SP Resolutions and Ordinances. Most measures are referred to two committees concurrently: the relevant subject-matter committee and the Committee on Laws. All assigned committees must contribute to the unified report before the step can complete normally. Source: confirmed, Interview 2; `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 8.3.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`default_committee_roles`|`string[]`|Yes|Default list of role keys for assigned committees. May be overridden per instance before any submission is received.|
|`report_acceptor_role`|`string`|Yes|Role key for the actor who accepts the unified report (SP Secretary)|
|`thursday_cutoff_enabled`|`boolean`|Yes|Must be `true` for all SP Resolution and Ordinance referral steps|
|`cutoff_time_pht`|`string`|Yes|Time in PHT (UTC+08:00) at which Thursday cutoff fires. Recommended value: `"23:59:59"`|
|`require_all_committee_signatures`|`boolean`|Yes|Must be `true`; all committees must contribute|
|`allow_secretary_advance`|`boolean`|Yes|Permits SP Secretary to manually advance the step; always requires a non-empty comment and is always audit-logged|

**Step instance metadata schema (`step_instances.metadata`):**

```json
{
  "assigned_committees": [
    {
      "committee_id": "<UUID>",
      "role_key": "string",
      "label": "string"
    }
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

**Runtime committee override:** The assigned committees default from `config.default_committee_roles` but may be modified by the SP Secretary before any submission is received. Modifications are audit-logged. After the first submission is received, the committee list is locked; further changes require `bypassStep` with mandatory comment.

**Completion sequence (normal path):**

1. Each committee submits its contribution document via a tRPC call that resolves to `engine.submitStepAction` with `outcome = COMMITTEE_SUBMITTED`. The engine appends to `metadata.submissions` and emits `workflow.multi_referral.committee_submitted`. If this was the last unsubmitted committee, sets `metadata.all_submitted_at = NOW()` and emits `workflow.multi_referral.all_submitted`.
2. SP Secretary uploads the unified committee report (attaches the report document). Engine sets `metadata.unified_report_document_id`.
3. SP Secretary accepts the report via a dedicated action. Engine sets `metadata.secretary_accepted_at`, `metadata.secretary_accepted_by`, `status = completed`, `outcome = REPORT_ACCEPTED`, `completed_at = NOW()`. Writes `instance.context.second_reading_eligible_date` from `metadata.second_reading_eligible_date` (computed by the Thursday cutoff job; see Section 7.2).
4. Transition evaluation fires on `outcome = REPORT_ACCEPTED`.

**Manual advance (SP Secretary override):**

When `allow_secretary_advance = true` and the SP Secretary invokes manual advance:

- `outcome_comment` must be non-empty (engine rejects with `COMMENT_REQUIRED` otherwise).
- Engine sets `metadata.manual_advance = true`, `metadata.manual_advance_comment`, `metadata.manual_advance_by`.
- For each committee in `metadata.assigned_committees` that has no entry in `metadata.submissions`, the engine creates a submission entry with `missed = true`.
- Step is set to `completed` with `outcome = SECRETARY_ADVANCED`.
- `workflow.multi_referral.secretary_advanced` event is emitted with the full metadata snapshot. The audit service writes a dedicated audit entry for this event.

**Order of Business integration:** The SP Secretary dashboard Order of Business view reads `metadata.submissions` and `metadata.assigned_committees` to determine which committees have not yet submitted. Committees without a submission entry (or with `missed = true`) are displayed in red. The `metadata.second_reading_eligible_date` is used to determine which Tuesday a given measure is eligible to be scheduled for Second Reading. The workflow engine surfaces this date; the Order of Business view is responsible for applying it to session scheduling. The engine does not enforce session dates.

**Outcome codes:**

|Code|Meaning|
|---|---|
|`COMMITTEE_SUBMITTED`|Intermediate outcome for each committee's individual submission (not the step's final outcome)|
|`REPORT_ACCEPTED`|SP Secretary accepted the unified report; step completes normally|
|`SECRETARY_ADVANCED`|SP Secretary manually advanced; some committees may not have submitted|

---

### 4.4 `decision`

**Purpose:** A system-evaluated branch. No user action required. The engine evaluates a condition against the instance context immediately on activation and routes to the appropriate next step. Examples: checking whether a measure is certified urgent, whether the Mayor vetoed, or routing based on whether a document has a penalty clause.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`condition_expression`|`string`|Yes|JSONLogic expression evaluated against `instance.context`. Must return a truthy or falsy value.|
|`true_outcome`|`string`|No|Default `"TRUE"`. `outcome` value when expression is truthy.|
|`false_outcome`|`string`|No|Default `"FALSE"`. `outcome` value when expression is falsy.|

**`auto_complete`** is always `true` for `decision` steps; this is enforced by the engine and cannot be disabled by configuration.

**Completion:** On activation, the engine evaluates `condition_expression` against `instance.context`. Sets `outcome` to `true_outcome` or `false_outcome` accordingly. Sets `status = completed`, `actor_type = system`, `completed_at = NOW()`. Transition evaluation fires immediately.

**Time-based conditions:** Decision steps evaluate context state, not elapsed time. Time-based transitions (10-day Mayor lapse, 30-day Panlalawigan) are not implemented via decision step expressions. They are implemented by the scheduler setting context keys (`mayor_action = 'LAPSED'`, `panlalawigan_outcome = 'DEEMED_APPROVED'`) on the relevant `approval` steps. Decision steps that follow these approval steps can then branch on the context values.

**Example context expressions:**

```json
{ "==": [{ "var": "certified_urgent" }, true] }
{ "==": [{ "var": "mayor_action" }, "VETOED"] }
{ "==": [{ "var": "document_type" }, "sp_ordinance"] }
{ "!=": [{ "var": "panlalawigan_outcome" }, null] }
```

---

### 4.5 `notification`

**Purpose:** The engine sends a notification to one or more recipients. No user action required. The step completes immediately after the notification is enqueued. Delivery failure does not affect the workflow.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`template_key`|`string`|Yes|Key of the notification template (`notifications.templates`)|
|`recipients`|`string[]`|Yes|List of recipient expressions using the same format as assignee resolution, plus `context:<context_key>` to include a user ID stored in context|
|`channels`|`string[]`|No|Default `["in_app"]`. Valid values: `"in_app"`, `"email"`, `"sms"` (SMS Phase 2+)|
|`payload_context_keys`|`string[]`|No|Context keys whose values are passed as template variables to the notification template|

**Completion:** Engine enqueues the notification in the `notifications` module's queue. Sets `status = completed`, `outcome = DISPATCHED`, `actor_type = system`, `completed_at = NOW()`. Transition evaluation fires immediately.

---

### 4.6 `termination`

**Purpose:** Ends a workflow instance. Sets `instances.status = completed` and `instances.completed_at = NOW()`. Applies a final status to the associated document via the documents module event bus.

**Config fields:**

|Field|Type|Required|Notes|
|---|---|---|---|
|`outcome_code`|`string`|Yes|Semantic outcome of the workflow (see valid codes below)|
|`final_document_status`|`string`|Yes|Document lifecycle status to apply: `RELEASED`, `ARCHIVED`, `CANCELLED`|
|`emit_event`|`string`|No|Additional domain event key to emit on the event bus for other modules to consume|

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
|`REPASSED`|Document returned to draft for amendment and repass (see special handling below)|

**On `outcome_code = REPASSED`:** The instance is NOT set to `completed`. It is set to `active` and a new step is NOT created. The engine emits `workflow.instance.repassed` containing the original `instance_id` and `document_id`. The documents module subscribes to this event and handles creation of the amended document version and a new workflow instance linked to it. This keeps the original instance's history intact and links the new instance back to the original.

**On `outcome_code = CANCELLED`:** Before setting the instance to `cancelled`, the engine sets all step instances with `status = active` to `status = cancelled` in the same transaction. The cancelling actor and a mandatory non-empty `cancellation_reason` are recorded on the instance row and in the emitted event.

---

## 5. Phase 2 Reserved Step Types

The `workflow_step_type_enum` must include `parallel_split` and `parallel_join` in its definition migration. These types are not executable in Phase 1.

### 5.1 `parallel_split`

Splits the workflow into N independent concurrent branches. Required for the Barangay Budget workflow (four-office simultaneous preliminary review: Local Finance Committee, Budget Office, Treasury Office, CPDO). Reserved for Phase 2 implementation.

**Phase 1 guard:** If a definition version containing a `parallel_split` step is submitted for publishing, the engine rejects publication with `STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1`. If a `parallel_split` step instance activation is attempted at runtime despite the guard (e.g., from a migrated definition), the engine immediately emits `workflow.step.failed` and sets the instance to `stuck`.

### 5.2 `parallel_join`

Merges N concurrent branches. Completes when a configurable threshold of branches (default: all) have reached their terminal states. Must be paired with `parallel_split`. Same Phase 1 guard applies.

---

## 6. Special Control Flows

### 6.1 Certified Urgent Bypass Path

**Source:** Confirmed — Interview 2; Part 4.17 and Part 11.3 of the consolidated reference.

**Background:** The Mayor issues a formal written Certification of Urgency document. A single Certification may cover multiple legislative measures in the same session. When Secretariat logs the Certification, the committee referral step is bypassed for each associated measure: First Reading and Second Reading occur in the same session. Frequency is high; this path must be fully supported in Phase 1.

**Event trigger:** When the documents module logs a Certification of Urgency, it emits `documents.certification_urgency.logged` on the internal event bus containing:

```json
{
  "certification_document_id": "<UUID>",
  "associated_instance_ids": ["<UUID>", ...],
  "logged_by": "<UUID>",
  "logged_at": "<TIMESTAMPTZ>"
}
```

The workflow engine subscribes to this event and executes the bypass sequence for each listed `instance_id`.

**Bypass sequence per instance:**

1. Load the instance. Verify `instance.status = active`. If the instance is not active (completed, cancelled, stuck), emit `workflow.certification_urgency.already_inactive` and skip.
    
2. Set `instance.context.certified_urgent = true` and `instance.context.certified_urgent_document_id = certification_document_id` within a database transaction.
    
3. Find the `multi_referral` step instance for this workflow instance.
    
    **Case A — `multi_referral` step is `active`:** Execute bypass immediately. Within the same transaction:
    
    - Set `step_instances.status = bypassed`.
    - Set `step_instances.bypassed_at = NOW()`.
    - Set `step_instances.bypassed_by = null` (system-triggered, no human actor for this specific action).
    - Set `step_instances.bypass_reason = 'CERTIFIED_URGENT'`.
    - Set `step_instances.outcome = 'BYPASSED_CERTIFIED_URGENT'`.
    - Emit `workflow.step.bypassed` with `bypass_reason = 'CERTIFIED_URGENT'` and `certification_document_id`.
    - Run transition evaluation from the bypassed step. The workflow definition **must** have a transition rule with `outcome_filter = 'BYPASSED_CERTIFIED_URGENT'` pointing to the Second Reading step; the admin UI enforces this at definition publish time.
    
    **Case B — `multi_referral` step is `pending` (not yet activated):** Set a deferred bypass flag: write a record to a `pending_certified_urgent_bypasses` table (or an equivalent mechanism) keyed on `(instance_id, step_key = 'committee_referral')`. When the `multi_referral` step would normally be activated, the engine checks for a pending bypass flag and executes Case A logic instead of activating the step.
    
    **Case C — `multi_referral` step is already `completed` or `bypassed`:** The workflow has already passed the committee referral stage. Emit `workflow.certification_urgency.already_past_referral` with `instance_id` and `certification_document_id`. No workflow change. Log at warning level.
    
4. Emit `workflow.certification_urgency.bypass_applied` (for Case A and Case B completions) with `instance_id`, `step_instance_id`, and `certification_document_id`.
    

**Audit:** The `workflow.step.bypassed` event is consumed by the audit service, which writes a dedicated audit entry noting the bypass reason and the certification document reference.

**Constraint:** The `multi_referral` bypass via Certified Urgent is the only mechanism for same-session First and Second Reading. No other bypass path exists for the `multi_referral` step type except SP Secretary manual advance (Section 4.3), which still requires committee submission and requires a mandatory comment.

---

### 6.2 Thursday Cutoff Enforcement and Second Reading Delay

**Source:** Confirmed — Interview 2 and developer decisions; Part 8.3 and Part 7.2 of the consolidated reference.

**Background:** After a measure is referred to committees at First Reading, committees must submit their contributions and the unified report must be accepted by the SP Secretary before Second Reading can be scheduled. The scheduling constraint is enforced by a Thursday cutoff. If all committees submit their contributions before Thursday 23:59:59 PHT, the measure is eligible for Second Reading on the following Tuesday. If not, Second Reading is delayed.

**Cutoff definition:** Thursday 23:59:59 PHT (UTC+08:00 → Thursday 15:59:59 UTC). The cutoff timestamp for a given week is a concrete `TIMESTAMPTZ` value.

**Scheduler job:** `evaluateThursdayCutoffs` runs via `pgboss` every Thursday at 23:59:59 PHT. The job must be idempotent: re-running it for the same cutoff window produces no additional effects if `metadata.last_cutoff_evaluated_at` equals or exceeds the current cutoff timestamp.

**Job algorithm (per active `multi_referral` step instance with `thursday_cutoff_enabled = true`):**

```
FOR each active multi_referral step_instance WHERE thursday_cutoff_enabled = true:

  cutoff_ts = current_cutoff_timestamp  // Thursday 23:59:59 PHT

  IF metadata.all_submitted_at IS NULL:
    // Not all committees have submitted
    metadata.thursday_cutoffs_missed += 1
    metadata.last_cutoff_evaluated_at = cutoff_ts
    EMIT workflow.multi_referral.cutoff_missed {
      step_instance_id,
      cutoff_timestamp: cutoff_ts,
      missing_committee_ids: [committees without a submission entry],
      cutoff_number: metadata.thursday_cutoffs_missed
    }
    // No second_reading_eligible_date is set; Order of Business excludes this measure

  ELSE IF metadata.all_submitted_at <= cutoff_ts AND metadata.second_reading_eligible_date IS NULL:
    // All committees submitted before or on this Thursday's cutoff
    // Eligible Tuesday = 5 days after Thursday (Thu → Tue of the following week)
    eligible_date = DATE(cutoff_ts AT TIME ZONE 'Asia/Manila') + INTERVAL '5 days'
    metadata.second_reading_eligible_date = eligible_date
    metadata.last_cutoff_evaluated_at = cutoff_ts
    instance.context.second_reading_eligible_date = eligible_date
    EMIT workflow.multi_referral.second_reading_eligible {
      step_instance_id,
      eligible_date
    }

  ELSE:
    // second_reading_eligible_date already set; nothing to update
    PASS
```

**`computeSecondReadingEligibleDate` — worked examples:**

|Last Submission|Cutoff Evaluation|Eligible Tuesday|
|---|---|---|
|Monday 08:00 Week N|Thursday Week N 23:59:59|Tuesday Week N+1|
|Thursday 15:00 Week N|Thursday Week N 23:59:59|Tuesday Week N+1|
|Thursday 23:59:58 Week N|Thursday Week N 23:59:59|Tuesday Week N+1|
|Thursday 23:59:59 Week N (exact cutoff)|Not before cutoff|Evaluated Thursday Week N+1; Tuesday Week N+2|
|Friday 09:00 Week N|Thursday Week N already passed; evaluated Thursday Week N+1|Tuesday Week N+2|

**Effect on workflow:** The `multi_referral` step remains `active` until all committees have submitted AND the SP Secretary accepts the unified report. `second_reading_eligible_date` is set by the job and written to `instance.context`. The next step (Second Reading, an `approval` step) is only activated when the `multi_referral` step completes.

The Order of Business view reads `instance.context.second_reading_eligible_date` and filters measures for display on the correct Tuesday. This is a query-layer concern; the workflow engine does not enforce session dates or prevent activation of the Second Reading step if the eligible date has not yet arrived.

**Missing committee display:** The Order of Business view reads `metadata.submissions` to determine which committees have not yet submitted. Committees absent from the submissions array (or with `missed = true`) are displayed in red. This is a read query on the `metadata` column; the engine has no additional responsibility here beyond maintaining the metadata correctly.

---

### 6.3 10-Day Mayor Lapse Timer

**Source:** Confirmed — Interview 2; Part 4.1, Part 4.2, Part 11.3 of the consolidated reference. Legal basis: RA 7160 Section 47. Applies to both SP Resolutions and SP Ordinances.

**Timer start:** When the Secretariat completes the Transmittal Letter step (the formal cover letter "For appropriate action" sent to the Mayor's Office), the engine:

- Sets `instance.context.mayor_transmittal_date = NOW()`.
- Sets `instance.context.mayor_action_deadline = NOW() + INTERVAL '10 days'`.
- Activates the Mayor review `approval` step.

**Calendar days:** 10 calendar days; no adjustment for weekends or public holidays. The deadline is `mayor_transmittal_date + INTERVAL '10 days'` precisely.

**Scheduler job:** `evaluateMayorLapseTimers` runs every hour via `node-cron`. It is idempotent.

**Job algorithm:**

```
FOR each active approval step_instance WHERE:
    'LAPSED' IN step.config.allowed_outcomes
    AND instance.context.mayor_action_deadline IS NOT NULL
    AND step_instance.outcome IS NULL
    AND NOW() > instance.context.mayor_action_deadline:

  Acquire a pessimistic row lock on the step_instance row (SELECT FOR UPDATE)
  
  IF step_instance.outcome IS NOT NULL:
    // Actor submitted between job check and lock acquisition; skip this instance
    RELEASE lock; CONTINUE
  
  SET step_instance.status = completed
  SET step_instance.outcome = 'LAPSED'
  SET step_instance.outcome_comment = 'Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47.'
  SET step_instance.completed_at = instance.context.mayor_action_deadline
  SET step_instance.actor_type = system
  SET instance.context.mayor_action = 'LAPSED'
  SET instance.context.mayor_action_date = instance.context.mayor_action_deadline
  
  EMIT workflow.approval.lapsed {
    step_instance_id,
    legal_basis: 'RA 7160 Section 47',
    deadline_was: instance.context.mayor_action_deadline
  }
  
  RUN transition evaluation
  // Rule with outcome_filter = 'LAPSED' routes to Docketing step
```

**Notification on lapse:** The `workflow.approval.lapsed` event triggers an in-app notification to the SP Secretary and a dashboard alert. The notification text includes the legal basis.

**Race condition prevention:** The `SELECT FOR UPDATE` row lock prevents the Mayor from submitting a concurrent action at the exact moment the lapse fires. The first transaction to commit wins. The lapse job checks `step_instance.outcome IS NOT NULL` after acquiring the lock and skips if the outcome was already set.

**Completed_at value:** `step_instance.completed_at` is set to `instance.context.mayor_action_deadline`, not to `NOW()`. This records the actual lapse time (when the deadline passed) rather than the scheduler detection time, which may be up to one hour later.

**Veto path (parallel configuration):** If the Mayor submits `outcome = VETOED` before the deadline, the workflow transitions to a veto override `approval` step. This step's configuration:

- `allowed_outcomes = ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED']`
- Vote count recorded in `instance.context.veto_override_vote_count`
- Override threshold: 2/3 majority = 8 of 12 SP members (confirmed)
- The Secretariat submits the outcome based on the session vote count
- `OVERRIDE_SUCCEEDED` transitions to the Docketing step (same path as signed/lapsed)
- `OVERRIDE_FAILED` transitions to a termination step with `outcome_code = VETOED_OVERRIDE_FAILED`

---

### 6.4 30-Day Panlalawigan Timer

**Source:** Confirmed — Interview 2 and developer decisions; Part 4.3 of the consolidated reference. Legal basis: RA 7160 Section 56(d).

**Timer start:** When the Secretariat logs transmission of the document to the Sangguniang Panlalawigan (after the Docketing step), the engine:

- Sets `instance.context.panlalawigan_transmission_date = NOW()`.
- Sets `instance.context.panlalawigan_action_deadline = NOW() + INTERVAL '30 days'`.
- Activates the Panlalawigan review `approval` step.

**Calendar days:** 30 calendar days; no adjustment for weekends or holidays.

**Scheduler job:** `evaluatePanlalawiganTimers` runs daily at 06:00 PHT via `node-cron`. It is idempotent.

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
  SET step_instance.completed_at = instance.context.panlalawigan_action_deadline
  SET step_instance.actor_type = system
  SET instance.context.panlalawigan_outcome = 'DEEMED_APPROVED'
  SET instance.context.panlalawigan_response_date = instance.context.panlalawigan_action_deadline
  
  EMIT workflow.panlalawigan.deemed_approved {
    step_instance_id,
    legal_basis: 'RA 7160 Section 56(d)',
    transmission_date: instance.context.panlalawigan_transmission_date,
    deadline_was: instance.context.panlalawigan_action_deadline
  }
  
  RUN transition evaluation
  // Rule with outcome_filter = 'DEEMED_APPROVED' routes to Publication check or Archive
```

**Manual Panlalawigan response (before 30 days):** When Secretariat receives a formal Panlalawigan resolution (formal written notification confirmed), Secretariat staff submits the Panlalawigan review step manually with the appropriate outcome. The `allowed_outcomes` for this step include: `VALID`, `VALID_IN_PART`, `RETURNED`, `OPERATIVE_IN_ITS_ENTIRETY`, and `DEEMED_APPROVED` (the last only settable by the scheduler, per the system-only guard in Section 4.2).

**Outcome handling:**

|Outcome|Transition Target|
|---|---|
|`VALID`|Publication decision step (routes to newspaper publication if penalty ordinance, else archive)|
|`OPERATIVE_IN_ITS_ENTIRETY`|Same as `VALID` (Appropriation Ordinance specific)|
|`DEEMED_APPROVED`|Same as `VALID`|
|`VALID_IN_PART`|`action` step: SP Secretary chooses resolution path (see below)|
|`RETURNED`|High-priority `action` step: Secretariat decides whether to modify/repass or implement directly|

**`VALID_IN_PART` resolution path:** The transition from `VALID_IN_PART` routes to an `action` step assigned to the SP Secretary with a form presenting four options (enforced as `allowed_outcomes` on the follow-on `approval` step):

|Option|Outcome Code|Behavior|
|---|---|---|
|Resolve as-is with comment|`RESOLVED_IN_PLACE`|Mandatory comment; document marked with annotation|
|Route to Legal Office|`ROUTED_TO_LEGAL`|Routes to Legal Office `action` step|
|Route to concerned Committee|`ROUTED_TO_COMMITTEE`|Routes to committee `action` step|
|Implement revisions directly|`REVISED_DIRECTLY`|Mandatory comment; Secretariat implements changes; workflow terminates with `VALID_IN_PART_RESOLVED`|

All choices produce a mandatory comment and are audit-logged. None of these choices is a default; the SP Secretary must explicitly select one.

**`RETURNED` path:** A `RETURNED` outcome typically leads to the document being repassed (returned to drafting). The SP Secretariat action step for `RETURNED` offers:

- **Repass:** Selects `outcome = REPASS`, triggering a termination step with `outcome_code = REPASSED`.
- **Implement recommendations directly:** If the Secretariat determines the return can be resolved without repassing (confirmed possible per Part 4.3), selects `outcome = RESOLVED_DIRECTLY` with a mandatory comment, terminating with `VALID_IN_PART_RESOLVED`.

---

## 7. Version Management

### 7.1 Version Pinning at Instance Creation

When `engine.createInstance` is called, the engine resolves the current published definition version (`is_current = true`) for the target workflow definition and writes its ID to `instances.definition_version_id`. This value is written once at creation and is treated as immutable for the lifetime of the instance except via Option B migration (Section 7.3).

All step resolution, transition evaluation, condition expressions, step-type behavior, and assignee resolution use exclusively the snapshot stored in `definition_versions.snapshot` for the pinned version. If a Platform Administrator publishes a new version while instances are active, those active instances are unaffected.

**Rationale:** In-flight SP Resolutions and Ordinances must not be disrupted by workflow definition changes made during the legislative process. A new version may introduce new steps, change transition logic, or add notifications. Retroactively applying these changes to in-flight documents would be legally incorrect and auditorially unsound.

### 7.2 Option A: Continue Under Existing Version

Default behavior. Active instances continue executing under the version pinned at creation indefinitely. No action required from the Platform Administrator. New instances created after a new version is published use the new version; existing instances use their pinned version.

### 7.3 Option B: In-Flight Instance Migration

Migrating an active instance to a newer definition version is a high-risk operation intended for exceptional circumstances only (e.g., a legally mandated workflow step change that must apply to all in-flight measures). It requires a second-level approval and carries a 24-hour reversal window.

**Preconditions (all must be satisfied; engine validates in order):**

1. A published definition version newer than the instance's pinned version exists for the same definition.
2. A valid, unexpired City Administrator approval record exists for this specific migration (approval created within the last 24 hours). The approval record includes: approver user ID, target version ID, instance ID, reason, and expiry timestamp.
3. The caller is a Platform Administrator.
4. The migration reason provided to `engine.migrateInstance` is non-empty.
5. The instance status is `active` (not `suspended`, `stuck`, `completed`, or `cancelled`).

If any precondition fails, the engine rejects the call with a typed error (`NO_ADMIN_APPROVAL`, `APPROVAL_EXPIRED`, `INSTANCE_NOT_ACTIVE`, etc.).

**Migration algorithm:**

1. Open a database transaction.
2. Load the instance, all active step instances, the pinned version snapshot, and the target version snapshot.
3. **Step mapping:** For each active step instance, find the step with the same `step_key` in the target version. If a `step_key` exists in both, it maps directly. If an active step's `step_key` does not exist in the target version, reject the migration with `STEP_KEY_NOT_FOUND_IN_TARGET_VERSION` listing the missing keys. The caller must resolve the conflict (either by adjusting the target version or by manually mapping keys via an extended API not covered in this spec).
4. **Context compatibility:** Validate that any new required context keys introduced in the target version definition are satisfiable given the current context. (In practice, new required keys should have defaults; definitions without sensible defaults for new keys must not be published.)
5. Emit `workflow.instance.migration.started` with: `actor_id`, `reason`, `source_version_id`, `target_version_id`, `step_mapping`.
6. Update `instances.definition_version_id` to the target version ID.
7. Update each active `step_instances.step_id` to the mapped step ID in the target version.
8. Emit `workflow.instance.migration.completed` with the same payload plus a success flag.
9. Commit the transaction.
10. Notify the SP Secretary and all users with active step assignments for this instance.

**Reversal window:** For 24 hours after `migration.completed`, the Platform Administrator may execute a reversal. A reversal runs the same algorithm in reverse (source and target swapped), requires the original migration's event ID as input, and requires a non-empty reversal reason. A reversal after 24 hours requires a new City Administrator approval.

**Audit requirement:** The `workflow.instance.migration.started`, `workflow.instance.migration.completed`, and `workflow.instance.migration.reversed` events are consumed by the audit service, which writes them as dedicated high-priority audit entries. These entries must be retained permanently and are never subject to retention schedule expiry.

---

## 8. SLA Clock and Escalation

### 8.1 Clock Semantics

The SLA clock is wall-clock time recorded as `TIMESTAMPTZ`. It is not measured in system uptime or active processing time. The clock for an instance starts at `instances.started_at` and for a step starts at `step_instances.started_at`. These timestamps are recorded at the moment the respective row is created and committed.

`instances.sla_deadline = instances.started_at + SLA_threshold`. The threshold is configured per document type by the Platform Administrator. Defaults from RA 11032 (ARTA):

|Transaction Category|Threshold|
|---|---|
|Simple|3 working days|
|Complex|7 working days|
|Highly technical|20 working days|

Working days exclude Saturdays, Sundays, and declared national and local public holidays. The holidays calendar is maintained by the Platform Administrator. The calendar must be seeded with at least the current year's holidays before any SLA computation is relied upon in production. SP Resolutions and SP Ordinances are classified as complex transactions by default; this is configurable.

### 8.2 Outage Behavior

**RA 11032 (ARTA) compliance obligations do not pause during system outages.** This is a firm legal constraint confirmed by the architecture reference. The SLA clock runs regardless of system availability. No forgiveness window is applied for downtime.

**On system startup after an outage:**

1. `evaluateSlaBreaches` runs immediately as part of the startup sequence, before the server begins accepting requests.
2. For each instance or step where `sla_deadline < NOW()` and `sla_breached_at IS NULL`: set `sla_breached_at = sla_deadline` (the time of breach, not the detection time) and emit a `workflow.sla.breached` event.
3. Escalation events are emitted retroactively. Escalation recipients will see when the breach actually occurred, not when the system restarted.
4. Breach events accumulate; they are not deduplicated. If 47 measures breached SLA during a 12-hour outage, 47 breach events are emitted on restart.

**Outage logging:** System downtime intervals must be recorded. The combination of breach timestamps and downtime records gives the Platform Administrator evidence to distinguish system-caused delays from process delays if needed for internal review. However, this distinction does not affect ARTA obligations.

### 8.3 Escalation Schedule

The `evaluateSlaBreaches` job runs every 15 minutes via `node-cron`. It checks all active instances and step instances.

|Threshold|Trigger|Action|
|---|---|---|
|80% of SLA elapsed|`NOW() >= started_at + (sla_deadline - started_at) * 0.8`|Emit `workflow.sla.warning`; in-app notification to step assignee and direct supervisor|
|100% (breach)|`NOW() > sla_deadline`|Emit `workflow.sla.breached`; in-app notification to assignee, supervisor, and Records Officer. If step-level breach, also notify SP Secretary. If instance-level breach, also notify Mayor dashboard.|
|150% of SLA elapsed|`NOW() >= started_at + (sla_deadline - started_at) * 1.5`|Emit `workflow.sla.critical`; add to SP Secretary critical queue; log in ARTA compliance report|

The SLA warning level emits at most once per step instance. If the step is still active at the breach threshold, the breach event replaces the warning (no duplicate warning). The critical threshold event emits only if the step is still active at 150%.

Escalation targets (supervisor role keys, Records Officer role key) are configurable per document type by the Platform Administrator. The defaults listed here are not hardcoded in the engine; the engine reads them from the document type configuration.

---

## 9. Engine Invariants

The following constraints are enforced by the engine at runtime and, where feasible, by database constraints and migration linting. Violations cause the relevant operation to be rejected with a typed error; they are never silently ignored or logged-and-continued.

|#|Invariant|Enforcement Mechanism|
|---|---|---|
|1|`instances.definition_version_id` is written once at creation and never updated except via `engine.migrateInstance`|No SQL update path exists outside `engine.migrateInstance`; application-level guard on all other update paths|
|2|A `multi_referral` step with `require_all_committee_signatures = true` cannot complete with `outcome = REPORT_ACCEPTED` unless all committees have submissions OR `manual_advance = true`|Enforced in the `multi_referral` completion handler before setting `status = completed`|
|3|`outcome = LAPSED` and `outcome = DEEMED_APPROVED` may only be submitted with `actor_type = system`|Enforced in `engine.submitStepAction` before any state change is written|
|4|Every `approval` step whose `allowed_outcomes` includes `LAPSED` must have an outgoing transition rule with `outcome_filter = 'LAPSED'`|Validated at definition version publish time; publication fails with `MISSING_LAPSE_TRANSITION`|
|5|No definition version may include `parallel_split` or `parallel_join` step types in Phase 1|Validated at definition version publish time; validated again on step instance activation at runtime|
|6|An instance with `status = completed` or `status = cancelled` cannot have any step instance activated|Enforced in `engine.createInstance`, `engine.submitStepAction`, and all timer jobs at the start of each operation|
|7|SP Secretary manual advance of a `multi_referral` step requires a non-empty `outcome_comment`|Enforced in `engine.submitStepAction` before the step proceeds to completion|
|8|Option B migration requires a valid, unexpired City Administrator approval record|Checked transactionally in `engine.migrateInstance`; the approval record is consumed (marked used) atomically with the migration|
|9|A `termination` step with `outcome_code = REPASSED` must not set `instances.status = completed`|Enforced in the termination execution handler; `instances.status` remains `active` and `workflow.instance.repassed` is emitted instead|
|10|All engine operations that accept a `reason` or `comment` parameter must reject the call if that value is empty or whitespace-only when the spec marks it as mandatory|Enforced by input validation in each entry point before any database write|
|11|The encoder (document creator) and the final approver of the same document cannot be the same user|Enforced in the `approval` step completion handler for steps marked as `is_final_approval = true` in their config; checked against `instance.context.created_by`|
|12|No outgoing transition rule may reference a `to_step_id` from a different `definition_version_id` than the instance's pinned version|Validated during transition evaluation; invalid transitions trigger `workflow.instance.stuck`|
|13|`workflow.workflow_events` rows may only be inserted; no update or delete path exists|DB-level permission: `REVOKE UPDATE, DELETE ON workflow.workflow_events FROM workflow_app_user` in the schema migration|

---

## Appendix A: Domain Events Catalog

All events are persisted to `workflow.workflow_events` within the committing transaction and published to the in-process event bus after commit. Events consumed by the audit service are marked **(Audit)**.

|Event Type|Trigger|Key Payload Fields|
|---|---|---|
|`workflow.instance.created`|New instance started|`instance_id`, `definition_version_id`, `document_id`, `document_type`, `sla_deadline`|
|`workflow.instance.completed`|Termination step reached|`instance_id`, `outcome_code`, `final_document_status`|
|`workflow.instance.cancelled`|Instance cancelled **(Audit)**|`instance_id`, `cancelled_by`, `cancellation_reason`|
|`workflow.instance.stuck`|No matching transition found|`instance_id`, `step_instance_id`, `evaluated_rules`, `context_snapshot`|
|`workflow.instance.repassed`|Termination with REPASSED outcome|`instance_id`, `document_id`|
|`workflow.instance.suspended`|Admin suspended instance **(Audit)**|`instance_id`, `suspended_by`, `reason`|
|`workflow.instance.resumed`|Admin resumed suspended instance **(Audit)**|`instance_id`, `resumed_by`|
|`workflow.instance.migration.started`|Option B migration initiated **(Audit)**|`instance_id`, `from_version_id`, `to_version_id`, `actor_id`, `reason`, `step_mapping`|
|`workflow.instance.migration.completed`|Option B migration completed **(Audit)**|`instance_id`, `from_version_id`, `to_version_id`|
|`workflow.instance.migration.reversed`|Option B migration reversed **(Audit)**|`instance_id`, `actor_id`, `reversal_reason`, `original_migration_event_id`|
|`workflow.step.started`|Step instance activated|`instance_id`, `step_instance_id`, `step_type`, `step_key`, `assigned_to`|
|`workflow.step.completed`|Step instance completed **(Audit for approval/multi_referral)**|`instance_id`, `step_instance_id`, `outcome`, `actor_id`, `actor_type`|
|`workflow.step.bypassed`|Step bypassed **(Audit)**|`instance_id`, `step_instance_id`, `bypass_reason`, `bypassed_by`|
|`workflow.step.failed`|Engine error during step|`instance_id`, `step_instance_id`, `error_code`, `error_message`|
|`workflow.context.updated`|Context key(s) modified|`instance_id`, `updated_keys`, `previous_values`, `new_values`, `actor_id`|
|`workflow.multi_referral.committee_submitted`|Committee submitted contribution|`step_instance_id`, `committee_id`, `submitted_by`, `contribution_document_id`|
|`workflow.multi_referral.all_submitted`|Last unsubmitted committee submitted|`step_instance_id`, `all_submitted_at`|
|`workflow.multi_referral.cutoff_missed`|Thursday cutoff passed; not all submitted|`step_instance_id`, `cutoff_timestamp`, `missing_committee_ids`, `cutoff_number`|
|`workflow.multi_referral.second_reading_eligible`|Eligible Tuesday computed|`step_instance_id`, `eligible_date`, `cutoff_timestamp_cleared`|
|`workflow.multi_referral.secretary_advanced`|SP Secretary manual advance **(Audit)**|`step_instance_id`, `actor_id`, `comment`, `missing_committee_ids`, `metadata_snapshot`|
|`workflow.approval.lapsed`|10-day Mayor lapse fired|`step_instance_id`, `legal_basis`, `deadline_was`|
|`workflow.panlalawigan.deemed_approved`|30-day Panlalawigan timer fired|`step_instance_id`, `legal_basis`, `transmission_date`, `deadline_was`|
|`workflow.certification_urgency.bypass_applied`|Certified Urgent bypass executed **(Audit)**|`instance_id`, `step_instance_id`, `certification_document_id`|
|`workflow.certification_urgency.bypass_deferred`|Certified Urgent bypass recorded for pending step|`instance_id`, `certification_document_id`|
|`workflow.certification_urgency.already_past_referral`|Certified Urgent received after referral step already passed|`instance_id`, `certification_document_id`|
|`workflow.certification_urgency.already_inactive`|Certified Urgent received for a non-active instance|`instance_id`, `instance_status`, `certification_document_id`|
|`workflow.sla.warning`|80% of SLA time elapsed|`instance_id`, `step_instance_id`, `sla_deadline`, `percent_elapsed: 80`|
|`workflow.sla.breached`|SLA deadline passed|`instance_id`, `step_instance_id`, `sla_deadline`, `breach_detected_at`, `breached_at: sla_deadline`|
|`workflow.sla.critical`|150% of SLA time elapsed|`instance_id`, `step_instance_id`, `sla_deadline`|

---

## Appendix B: Workflow Instance Context Schema

The `instances.context JSONB` column is the mutable state store for a workflow instance. Keys are written by the engine and by step completion handlers as the workflow progresses. Keys are never removed; they transition from `null` to set values. Additional step-type-specific keys may be added to the context by specific step configurations.

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
  "certified_urgent": false,
  "certified_urgent_document_id": "UUID | null",

  // ── Multi-referral scheduling output (written by multi_referral step) ──────
  "second_reading_eligible_date": "ISO date string YYYY-MM-DD | null",

  // ── Mayor review ──────────────────────────────────────────────────────────
  // Set when Transmittal Letter to Mayor is logged
  "mayor_transmittal_date": "TIMESTAMPTZ | null",
  "mayor_action_deadline": "TIMESTAMPTZ | null",
  // Set when Mayor acts or lapse fires
  "mayor_action": "SIGNED | VETOED | LAPSED | null",
  "mayor_action_date": "TIMESTAMPTZ | null",

  // ── Veto override vote (set by override approval step) ────────────────────
  "veto_override_vote_count": "integer | null",
  "veto_override_outcome": "OVERRIDE_SUCCEEDED | OVERRIDE_FAILED | null",

  // ── Panlalawigan review ───────────────────────────────────────────────────
  // Set when Secretariat logs transmission to Panlalawigan
  "panlalawigan_transmission_date": "TIMESTAMPTZ | null",
  "panlalawigan_action_deadline": "TIMESTAMPTZ | null",
  // Set when Secretariat records outcome or 30-day timer fires
  "panlalawigan_outcome":
    "VALID | VALID_IN_PART | RETURNED | DEEMED_APPROVED | OPERATIVE_IN_ITS_ENTIRETY | null",
  "panlalawigan_response_date": "TIMESTAMPTZ | null",
  "panlalawigan_resolution_number": "string | null",

  // ── Publication (set by decision and action steps for newspaper publication)
  "requires_publication": "boolean",   // set by decision step evaluating penalty clause
  "publication_date": "ISO date string YYYY-MM-DD | null",
  "publication_newspaper": "string | null",

  // ── Creator reference (used for invariant 11: encoder ≠ final approver) ───
  "created_by": "UUID",

  // ── SLA control ───────────────────────────────────────────────────────────
  // Always false in Phase 1; reserved for future use
  "sla_paused": false
}
```

The context schema is not enforced by a PostgreSQL check constraint; it is enforced by the engine's context update handlers and validated by Zod schemas in the `workflow` service module. The Zod schema for the context lives in `/packages/shared` and is the single source of truth for context structure.

---

_This document is the authoritative specification for the Batac City LGU Platform workflow engine. All data model decisions, behavior contracts, and invariants defined here govern the implementation. Changes to this document require explicit revision with a dated changelog entry, review by the development lead, and notification to all active implementation work._