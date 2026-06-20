# ADR-B3-1: Document Request Form Approval Modeling

**[Unverified — no ADR template document (J5) was available at drafting time. This ADR follows the structure and conventions observed in the existing ADR-B2-1 through ADR-B2-7 series as documented in B2 §"Resolved ADRs," but has not been validated against J5's actual template. Revise structure if it conflicts with J5 once available.]**

|Field|Value|
|---|---|
|**ADR ID**|ADR-B3-1|
|**Title**|Document Request Form Approval Modeling|
|**Status**|Resolved|
|**Date**|June 2026|
|**Decided by**|Luke (stakeholder/architect decision)|
|**Authoritative record**|`b3-internal-domain-event-catalog-adrs/ADR-B3-1-document-request-form-approval-modeling.md`|

## Context

H2 (Document Type Catalog with JSONB Metadata Schemas) §6 (`DOCUMENT_REQUEST_FORM`) identifies that the Document Request Form's dual-approval requirement — both Vice Mayor and SP Secretary must approve before a requested document copy is released — was modeled provisionally as two boolean JSONB flags (`approved_by_vm`, `approved_by_sp_secretary`) plus an aggregate `approval_status` enum field. H2 itself flagged this as an open modeling question: confirm whether dual approval should instead be modeled as two sequential `approval` steps in the Workflow Engine (B4 §4.2), consistent with how every other multi-party signoff in the platform is implemented.

This question was load-bearing for three open items in B3 (Internal Domain Event Catalog):

- OI-13 — the `documentType` field on `workflow.instance.created` needed a closed enum of which document types independently trigger a workflow instance. Resolving Document Request Form's modeling choice was a precondition for finalizing this enum.
- OI-14 — the `outcomeCode` field on `workflow.instance.completed` needed exact termination outcome values, which depend on whether Document Request Form terminates via a `termination` step at all.
- OI-15 — the `outcome` field on `workflow.step.completed` needed exact per-step-type outcome values, which depend on whether Document Request Form's approvals are modeled as `approval` steps.

## Decision

**Document Request Form approval is modeled as two sequential `approval` steps in the Workflow Engine**, not as JSONB flags on the document record.

- A `workflow.definitions` row is authored for `DOCUMENT_REQUEST_FORM`, consistent with the pattern used for `SP_RESOLUTION`, `SP_ORDINANCE`, and `SP_APPROPRIATION_ORDINANCE`.
- Two `approval` steps are chained by `workflow.transition_rules`: a Vice Mayor approval step, followed conditionally by an SP Secretary approval step.
- Each step uses `allowed_outcomes: ['APPROVED', 'REJECTED']` — both already-defined outcome codes from B4 §4.2's existing 13-value list. No new per-step outcome codes are introduced.
- Rejection at the Vice Mayor step routes directly to termination (does not proceed to the SP Secretary step). This is expressed entirely via the transition rule's `outcome_filter`, not via a distinct outcome code — `step_instances.actor_id` and the step's own `step_id` already distinguish *who* rejected without needing actor-specific outcome codes.
- The workflow terminates via a `termination` step using two new outcome codes specific to this document type (see Consequences).
- `document.created` for `DOCUMENT_REQUEST_FORM` now triggers `workflow.instance.created`, adding a fourth value to OI-13's `documentType` enum.

## Consequences

**New `termination` outcome codes (extends B4 §4.6's table, additive only — no existing codes renamed or removed):**

|Code|Meaning|
|---|---|
|`RELEASED_TO_REQUESTER`|Both VM and SP Secretary approved; requested document copy released to citizen|
|`REQUEST_DENIED`|Either approver rejected; request does not proceed|

Existing legislative-specific codes (`APPROVED_AND_RELEASED`, `REJECTED_AT_VOTE`, etc.) are not reused for this document type — they encode legislative-voting semantics ("at vote") that do not apply to a two-signature citizen request and would be misleading to any consumer branching on `outcomeCode` string values (`records`, `portal`, per B3 §7.2).

**H2 schema change required:** The `approved_by_vm`, `approved_by_sp_secretary`, and `approval_status` fields are removed from the `DOCUMENT_REQUEST_FORM` JSONB metadata schema (H2 §6) as redundant with workflow-engine step-completion records. `approval_status` is also removed from that schema's `required` array. Dual-approval state is now queried via `workflow.step_instances` and `workflow.instances`, not via document JSONB.

**B3 schema changes required (resolves OI-13, OI-14, OI-15):**

- `WorkflowInstanceCreatedPayloadSchema.documentType` (§7.1) becomes a closed `z.enum(['SP_RESOLUTION', 'SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE', 'DOCUMENT_REQUEST_FORM'])`.
- `WorkflowInstanceCompletedPayloadSchema.outcomeCode` (§7.2) becomes a closed `z.enum([...])` of B4 §4.6's nine existing codes plus `RELEASED_TO_REQUESTER` and `REQUEST_DENIED`.
- `WorkflowStepCompletedPayloadSchema.outcome` (§7.12) becomes a discriminated/closed type reflecting the full set of per-step-type outcome codes enumerated in B4 §4, unchanged in shape by this ADR (Document Request Form reuses `APPROVED`/`REJECTED`, already present).

**Audit and SLA inheritance:** Document Request Form approvals now flow through `workflow.step.completed`, which B3 §7.12 (resolving OI-10) confirms is audited unconditionally regardless of step type. This was the primary driver for this decision over the JSONB-flag alternative — it avoids a second, bespoke audit code path for this one document type, consistent with B2's "no exceptions" architectural law on audit coverage (B3 §9 Rule 1).

## Alternatives Considered

**JSONB flags on the document record (H2's original provisional design).** Lower implementation cost — no `workflow.definitions` row, no transition rules, no publish-time `MISSING_OUTCOME_TRANSITION` validation to satisfy. Would have kept Document Request Form's approval trail outside the Workflow Engine's audit-guaranteed event bus, requiring a separate, bespoke audit write to achieve equivalent compliance coverage. Also would have kept Document Request Form architecturally consistent with its citizen-facing sibling, Citizen Complaint, which does not use the Workflow Engine (`portal`-schema `outcome_state` tracking instead). Rejected in favor of consistency with the platform's general multi-party-signoff pattern and the audit-coverage guarantee that comes with it.

## Open Follow-Ups

Not addressed by this ADR, and not blocking:

- Whether an SLA deadline (`deadline_hours`) should be configured on either approval step. Part 11.19 of the consolidated reference notes ARTA turnaround-time compliance generally; whether it applies to Document Request Form specifically in Phase 1 is undetermined.
- The exact `assignee` resolution expressions for the VM and SP Secretary approval steps are not specified here; they follow the same resolution mechanism as other `approval` steps (B4 §4.2) and are an implementation detail of the `workflow.definitions` authoring, not a schema-catalog concern.