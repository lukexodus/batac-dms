# Workflow Engine Specification — C1-Relevant Excerpt

**Source Document:** B4 — Workflow Engine Specification  
**Platform:** Batac City LGU Platform  
**Purpose of this excerpt:** Context gathering for **C1 — Full Database Schema DDL**. Contains only the data model (tables, columns, types, enums, constraints) and the auxiliary schema items needed to write accurate DDL for the `workflow` PostgreSQL schema. All execution logic, runtime behavior, scheduler algorithms, and application-layer contracts have been removed.  
**Last Updated:** June 2026

---

## Data Model

The workflow engine owns the `workflow` PostgreSQL schema exclusively. No other module reads this schema directly. Cross-schema foreign key constraints are prohibited per architectural invariants.

All tables follow platform-wide conventions: `UUID` primary keys (`gen_random_uuid()`), `TIMESTAMPTZ` on all timestamp columns, `city_id UUID NOT NULL` on all core entity tables, and soft-delete via `deleted_at TIMESTAMPTZ / deleted_by UUID` on tables that support deletion semantics. Columns are `NOT NULL` unless explicitly marked nullable.

---

### `workflow.definitions`

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

---

### `workflow.definition_versions`

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

---

### `workflow.steps`

Step definitions belonging to a specific definition version. These rows are denormalized from `snapshot` for efficient querying. The `snapshot` column on `definition_versions` is authoritative; these rows are derived and must be regenerated if they diverge.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`definition_version_id`|`UUID`|FK → `workflow.definition_versions.id`|
|`step_key`|`TEXT`|Stable domain identifier within the definition (e.g., `first_reading`, `committee_referral`, `second_reading`). Used for step mapping in Option B migration.|
|`step_type`|`workflow_step_type_enum`|See enum definition below|
|`label`|`TEXT`|Human-readable display name|
|`config`|`JSONB`|Step-type-specific configuration|
|`position`|`INTEGER`|Display ordering only; does not control execution sequence|
|`is_start`|`BOOLEAN`|Exactly one step per definition version must have `is_start = true`. Validated at publish time.|

**`workflow_step_type_enum` values:**

|Value|Phase|Notes|
|---|---|---|
|`action`|Phase 1|Actor performs a task; no branching|
|`approval`|Phase 1|Actor makes a decision; branching on outcome|
|`multi_referral`|Phase 1|Multi-committee joint review with unified report|
|`decision`|Phase 1|System-evaluated branch; no user input|
|`notification`|Phase 1|System sends notification; no user input|
|`termination`|Phase 1|Ends the workflow instance|
|`parallel_split`|Phase 2 reserved|Schema must include; not executable in Phase 1|
|`parallel_join`|Phase 2 reserved|Schema must include; not executable in Phase 1|

---

### `workflow.transition_rules`

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

### `workflow.instances`

A running workflow for a specific document.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`definition_version_id`|`UUID`|FK → `workflow.definition_versions.id`. **Pinned at creation. Never updated except by Option B migration.**|
|`document_id`|`UUID`|Logical FK → `documents.documents.id`|
|`status`|`workflow_instance_status_enum`|See enum definition below|
|`context`|`JSONB`|Mutable key-value state store; see Context Schema section below|
|`sla_deadline`|`TIMESTAMPTZ`|Nullable; computed at creation from document type SLA configuration|
|`sla_breached_at`|`TIMESTAMPTZ`|Nullable; set to `sla_deadline` (not detection time) when breach is detected|
|`started_at`|`TIMESTAMPTZ`|Timestamp when the instance was created and the start step activated|
|`completed_at`|`TIMESTAMPTZ`|Nullable; set when a termination step is reached|
|`created_by`|`UUID`|Logical FK → `iam.users.id`|
|`created_at`|`TIMESTAMPTZ`|—|
|`deleted_at`|`TIMESTAMPTZ`|Nullable|
|`deleted_by`|`UUID`|Nullable|

---

### `workflow.step_instances`

A running step within a workflow instance.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`instance_id`|`UUID`|FK → `workflow.instances.id`|
|`step_id`|`UUID`|FK → `workflow.steps.id`. Always from the pinned definition version.|
|`status`|`workflow_step_status_enum`|See enum definition below|
|`assigned_to`|`JSONB`|Nullable; resolved assignee(s) at activation time. Array of `{ "user_id": "...", "resolved_via": "..." }` objects.|
|`started_at`|`TIMESTAMPTZ`|Nullable; when the step became `active`|
|`completed_at`|`TIMESTAMPTZ`|Nullable; when the step reached a terminal status|
|`outcome`|`TEXT`|Nullable; step-type-specific outcome code|
|`outcome_comment`|`TEXT`|Nullable; actor-supplied reason or comment|
|`metadata`|`JSONB`|Nullable; step-type-specific mutable data (used heavily by `multi_referral`; `null` for `action`)|
|`sla_deadline`|`TIMESTAMPTZ`|Nullable; step-level SLA deadline if configured in step `config`|
|`sla_breached_at`|`TIMESTAMPTZ`|Nullable|
|`bypassed_at`|`TIMESTAMPTZ`|Nullable; set if step was bypassed (e.g., Certified Urgent)|
|`bypassed_by`|`UUID`|Nullable; actor UUID or null for system-triggered bypasses|
|`bypass_reason`|`TEXT`|Nullable; reason code (e.g., `CERTIFIED_URGENT`)|
|`created_at`|`TIMESTAMPTZ`|—|

---

### `workflow.workflow_events`

Immutable event log for each workflow instance. Append-only within the workflow schema. Rows are written as part of the database transaction that causes each state change.

**DB-level constraint:** `REVOKE UPDATE, DELETE ON workflow.workflow_events FROM workflow_app_user` must be applied in the schema migration. No update or delete path may exist for this table.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`instance_id`|`UUID`|FK → `workflow.instances.id`|
|`step_instance_id`|`UUID`|Nullable; FK → `workflow.step_instances.id`|
|`event_type`|`TEXT`|Domain event type string (e.g., `workflow.instance.created`)|
|`actor_id`|`UUID`|Nullable; null for system-generated events|
|`actor_type`|`TEXT`|`user` \| `system` \| `scheduler`|
|`payload`|`JSONB`|Event-specific data|
|`occurred_at`|`TIMESTAMPTZ`|Wall-clock time at emission, within the committing transaction|

---

### `workflow.pending_certified_urgent_bypasses`

Tracks deferred Certified Urgent bypasses for instances where the `multi_referral` step has not yet been activated at the time the Certification of Urgency is logged. When the `multi_referral` step would normally be activated, the engine checks this table first and executes the bypass instead.

|Column|Type|Notes|
|---|---|---|
|`id`|`UUID`|PK|
|`city_id`|`UUID`|—|
|`instance_id`|`UUID`|FK → `workflow.instances.id`|
|`step_key`|`TEXT`|Always `'committee_referral'` for Phase 1 use cases|
|`certification_document_id`|`UUID`|Logical FK → `documents.documents.id`|
|`created_at`|`TIMESTAMPTZ`|—|
|`applied_at`|`TIMESTAMPTZ`|Nullable; set when the bypass is executed|
|`applied_to_step_instance_id`|`UUID`|Nullable; FK → `workflow.step_instances.id`; set when executed|

---

## Lifecycle State Enums

### `workflow_instance_status_enum`

|Value|Description|
|---|---|
|`active`|One or more step instances are currently in progress|
|`suspended`|All active steps are paused by authorized admin action|
|`stuck`|Transition evaluation found no matching rule and no default is configured|
|`completed`|A termination step was reached|
|`cancelled`|Cancelled by an authorized actor before completion|

### `workflow_step_status_enum`

|Value|Description|
|---|---|
|`pending`|Created but not yet activated (step is queued for future activation)|
|`active`|Assigned to an actor and awaiting completion|
|`completed`|Finished normally; `outcome` and `completed_at` are set|
|`bypassed`|Skipped; `bypassed_at`, `bypassed_by`, and `bypass_reason` are set|
|`cancelled`|Cancelled as part of instance cancellation|
|`failed`|Internal engine error during step execution; triggers immediate alerting|

---

## DB-Level Constraints and Indexes

The following constraints must be expressed in DDL migrations, not only in application logic:

|#|Constraint|DDL Implementation|
|---|---|---|
|1|At most one active definition per `document_type_id`|Partial unique index: `CREATE UNIQUE INDEX ON workflow.definitions (document_type_id) WHERE is_active = true AND deleted_at IS NULL`|
|2|At most one current version per `definition_id`|Partial unique index: `CREATE UNIQUE INDEX ON workflow.definition_versions (definition_id) WHERE is_current = true`|
|3|One active designation per person — see `organization` schema (referenced here for completeness; enforced there)|DB partial unique index on active delegation_grants per user|
|4|`workflow_events` rows may only be inserted|`REVOKE UPDATE, DELETE ON workflow.workflow_events FROM workflow_app_user` in migration|
|5|`instances.definition_version_id` has no application-layer update path|No UPDATE path exists in the application except via `engine.migrateInstance`; note in migration comments|
|6|`step_instances.assigned_to` snapshot is fixed at activation; not updated by later delegation changes|Application-layer enforcement; no additional DB constraint|
|7|Encoder and final approver of same document cannot be the same user|Enforced in the `approval` step completion handler for steps marked `is_final_approval = true` in their config, checked against `instance.context.created_by`; not a DB constraint|

---

## Context Schema (JSONB Reference for `workflow.instances.context`)

The `context` JSONB column on `workflow.instances` is the mutable state store for a workflow instance. This schema is enforced by the application (Zod, in `/packages/shared`) — not by a PostgreSQL check constraint. It is documented here so the DDL author understands what the column stores when writing comments and any partial index definitions over context keys.

Keys are never removed; they transition from `null` to set values.

```jsonc
{
  // Document identity
  "document_id": "UUID",
  "document_type": "sp_resolution | sp_ordinance | appropriation_ordinance",

  // Numbering (written by documents module; workflow engine reads only)
  "series_number_preliminary": "string | null",
  "series_number_final": "string | null",
  "qr_tracking_id": "UUID",

  // Certified Urgent (set by certification urgency bypass handler)
  "certified_urgent": false,
  "certified_urgent_document_id": "UUID | null",

  // Multi-referral scheduling output (written by multi_referral step)
  "second_reading_eligible_date": "ISO date string YYYY-MM-DD | null",

  // Mayor review
  "mayor_transmittal_date": "TIMESTAMPTZ | null",
  "mayor_action_deadline": "TIMESTAMPTZ | null",
  "mayor_action": "SIGNED | VETOED | LAPSED | null",
  "mayor_action_date": "TIMESTAMPTZ | null",

  // Veto override vote
  "veto_override_vote_count": "integer | null",
  "veto_override_outcome": "OVERRIDE_SUCCEEDED | OVERRIDE_FAILED | null",

  // Panlalawigan review
  "panlalawigan_transmission_date": "TIMESTAMPTZ | null",
  "panlalawigan_action_deadline": "TIMESTAMPTZ | null",
  "panlalawigan_outcome":
    "VALID | VALID_IN_PART | RETURNED | DEEMED_APPROVED | OPERATIVE_IN_ITS_ENTIRETY | null",
  "panlalawigan_response_date": "TIMESTAMPTZ | null",
  "panlalawigan_resolution_number": "string | null",

  // Publication
  "requires_publication": "boolean",
  "publication_date": "ISO date string YYYY-MM-DD | null",
  "publication_newspaper": "string | null",

  // Creator reference (used for invariant: encoder ≠ final approver)
  "created_by": "UUID",

  // SLA control (always false in Phase 1; reserved)
  "sla_paused": false
}
```

---

## Termination Outcome Codes (Reference for `step_instances.outcome` on termination steps)

These are the valid `outcome_code` values configured on `termination` steps. Stored in the step's `config` JSONB and echoed as `step_instances.outcome` when a termination step completes.

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
|`REPASSED`|Document returned to draft for amendment and repass (instance is NOT set to `completed`; `workflow.instance.repassed` event is emitted instead)|

---

## `step_instances.metadata` Shape — `multi_referral` Steps

The `metadata` JSONB column is `null` for `action` steps. For `multi_referral` steps, it holds the following structure. The DDL author needs this to write accurate column comments and to understand any partial indexes over `metadata`.

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

---

_This excerpt is derived from B4 — Workflow Engine Specification and is scoped to information required for writing C1 — Full Database Schema DDL for the `workflow` schema. For execution model, runtime behavior, scheduler logic, and step type behavior contracts, refer to the full B4 document._