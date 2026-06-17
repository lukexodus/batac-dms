# Workflow Engine Specification — Excerpt for B3 Authoring

**Source document:** `b4-workflow-engine-specification.md` (B4, Workflow Engine Specification, Batac City LGU Platform)

**Purpose of this excerpt:** [Unverified] This file is a manually filtered subset of B4, intended to contain only the sections judged relevant to authoring **B3 — Internal Domain Event Catalog** (event name, producing module, consuming modules, Zod payload schema, business reason). I cannot verify that this selection is complete or that no relevant content was missed — the filtering was performed by reading the full B4 document and selecting sections that define or describe domain events and their payloads. [Inference] Sections covering the `workflow` schema's table-by-table data model, engine entry-point method signatures, step-type configuration/UI contracts, scheduler job pseudocode narrative, and engine invariants were excluded as out of scope for an event catalog, since B3 is scoped to events, not to full module internals — this exclusion judgment is mine, not stated explicitly in either source document.

If any content needed for B3 is missing from this excerpt, that gap is not confirmed to be absent — I do not have access to information beyond what these two documents contain.

---

## 1. Domain Event Emission Mechanics (from B4 §3.6)

[Unverified — directly reproduced from B4 §3.6, included verbatim as sourced content, not generated]

All events are emitted to the in-process event bus synchronously within the database transaction that causes the state change. The `workflow.workflow_events` row is written in the same transaction. After commit, the event bus notifies downstream subscribers (audit service, notification service). Downstream handlers are asynchronous and may fail without rolling back the state change; they must implement their own retry logic.

Events are never emitted speculatively. An event is always evidence of something that has already been committed to the database. The complete event catalog is in Appendix A (reproduced in Section 2 below).

---

## 2. Appendix A: Domain Events Catalog (from B4)

[Unverified — directly reproduced from B4 Appendix A]

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

## 3. Cross-Module Event Referenced by the Workflow Engine (from B4 §6.1)

[Unverified — directly reproduced from B4 §6.1]

This event is **not** listed in Appendix A because it is produced by the `documents` module, not by `workflow` — but the workflow engine consumes it, so it is in scope for a catalog that records producing and consuming modules.

> When the documents module logs a Certification of Urgency, it emits `documents.certification_urgency.logged` on the internal event bus containing:

```json
{
  "certification_document_id": "<UUID>",
  "associated_instance_ids": ["<UUID>", ...],
  "logged_by": "<UUID>",
  "logged_at": "<TIMESTAMPTZ>"
}
```

> The workflow engine subscribes to this event and executes the bypass sequence for each listed `instance_id`.

**Producing module:** `documents` [Unverified — stated directly in B4 §6.1] **Consuming module:** `workflow` [Unverified — stated directly in B4 §6.1]

---

## 4. Inline Payload Detail for Events Summarized in Appendix A

[Inference] Appendix A gives only "Key Payload Fields" in summary form. The following blocks, found elsewhere in B4, give fuller payload shapes for several of the same events and are included here because an accurate Zod schema for B3 needs the actual field-by-field shape, not just the field-name list.

### 4.1 `workflow.multi_referral.cutoff_missed` and `workflow.multi_referral.second_reading_eligible` (from B4 §6.2)

[Unverified — directly reproduced from B4 §6.2 job algorithm pseudocode]

```
EMIT workflow.multi_referral.cutoff_missed {
  step_instance_id,
  cutoff_timestamp: cutoff_ts,
  missing_committee_ids: [committees without a submission entry],
  cutoff_number: metadata.thursday_cutoffs_missed
}
```

```
EMIT workflow.multi_referral.second_reading_eligible {
  step_instance_id,
  eligible_date
}
```

### 4.2 `workflow.approval.lapsed` (from B4 §6.3)

[Unverified — directly reproduced from B4 §6.3 job algorithm pseudocode]

```
EMIT workflow.approval.lapsed {
  step_instance_id,
  legal_basis: 'RA 7160 Section 47',
  deadline_was: instance.context.mayor_action_deadline
}
```

Business reason context stated alongside this event in B4: [Unverified] the 10-day Mayor lapse timer is tied to RA 7160 Section 47, and the event's `outcome_comment` text on the underlying step instance is recorded as "Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47."

### 4.3 `workflow.panlalawigan.deemed_approved` (from B4 §6.4)

[Unverified — directly reproduced from B4 §6.4 job algorithm pseudocode]

```
EMIT workflow.panlalawigan.deemed_approved {
  step_instance_id,
  legal_basis: 'RA 7160 Section 56(d)',
  transmission_date: instance.context.panlalawigan_transmission_date,
  deadline_was: instance.context.panlalawigan_action_deadline
}
```

Business reason context stated alongside this event in B4: [Unverified] the 30-day Panlalawigan review timer is tied to RA 7160 Section 56(d), and the underlying step instance's `outcome_comment` is recorded as "Deemed approved per RA 7160 Section 56(d) — 30 calendar days elapsed with no action from the Sangguniang Panlalawigan."

### 4.4 Certified Urgent bypass events — fuller trigger conditions (from B4 §6.1)

[Unverified — directly reproduced from B4 §6.1]

- `workflow.certification_urgency.already_inactive` — emitted when the instance is loaded and found not `active` (i.e., already `completed`, `cancelled`, or `stuck`).
- `workflow.step.bypassed` (with `bypass_reason = 'CERTIFIED_URGENT'`) — emitted within the same transaction as the bypass when the `multi_referral` step instance is found `active`. [Unverified] This is consumed by the audit service, which writes a dedicated audit entry noting the bypass reason and the certification document reference.
- `workflow.certification_urgency.already_past_referral` — emitted when the `multi_referral` step is already `completed` or `bypassed` at the time the Certified Urgent event is processed.
- `workflow.certification_urgency.bypass_applied` — emitted for both the immediately-active case and the deferred/pending case once the bypass actually completes, with `instance_id`, `step_instance_id`, and `certification_document_id`.

---

## 5. Supporting Context: Workflow Instance Context Schema (from B4 Appendix B)

[Inference] Several event payloads above reference values that live in the `instances.context` JSONB column (e.g., `deadline_was: instance.context.mayor_action_deadline`). This schema is reproduced as supporting reference only — it is not itself a domain event, and I have not independently confirmed it is exhaustive or current beyond what B4 states.

[Unverified — directly reproduced from B4 Appendix B]

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

[Unverified — directly reproduced from B4 Appendix B] The context schema is not enforced by a PostgreSQL check constraint; it is enforced by the engine's context update handlers and validated by Zod schemas in the `workflow` service module. The Zod schema for the context lives in `/packages/shared` and is the single source of truth for context structure.

---

## 6. Excluded From This Excerpt — Noted for Traceability

[Inference] The following B4 sections were read in full but excluded as not needed to author B3, on the reasoning that B3's scope is event name / producing module / consuming modules / Zod payload schema / business reason, not full module internals:

- §2 (Data Model): table-by-table column definitions for `workflow.definitions`, `definition_versions`, `steps`, `transition_rules`, `instances`, `step_instances`, `workflow_events`, and lifecycle state enums.
- §3.1–3.5: engine entry-point method signatures, instance creation steps, step resolution algorithm, transition evaluation algorithm, assignee resolution logic.
- §4 (all subsections): full behavior contracts, config field tables, and outcome code tables for `action`, `approval`, `multi_referral`, `decision`, `notification`, `termination` step types.
- §5: Phase 2 reserved step types (`parallel_split`, `parallel_join`).
- §6.1–6.4: narrative background, scheduler job names/schedules, full job pseudocode beyond the EMIT blocks, race-condition handling, and outcome-routing tables (only the EMIT payload blocks and the cross-module event were extracted into Sections 3–4 above).
- §7.1–7.3: version pinning rationale, Option A/B narrative, migration preconditions and algorithm steps (the three migration EMIT events were already captured via Appendix A in Section 2 above).
- §8.1–8.3: SLA clock semantics, outage behavior, escalation schedule narrative (the three SLA EMIT events were already captured via Appendix A in Section 2 above).
- §9: Engine Invariants table.

[Unverified] I cannot confirm whether any additional B3-relevant material exists outside of `b4-workflow-engine-specification.md` and `context-reference-internal-domain-event-catalog.md` — those are the only two documents available to me.

---

_End of excerpt. This is a derived/filtered file, not an authoritative spec in itself — the source of truth remains `b4-workflow-engine-specification.md`._