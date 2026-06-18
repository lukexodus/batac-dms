# Phase 1 Workflow Definitions — Structured Data — Blocking

**Document:** H1 **Platform:** Batac City LGU Platform **Status:** BLOCKING — These seed records must be reviewed and confirmed before the `workflow` module migration is written. No step, transition rule, or termination outcome defined here may be omitted from the first seed file. **Last Updated:** June 2026 **Audience:** Backend development team **Source Documents:** `consolidated-architecture-and-requirements-reference-iteration-3.md` (Post-Interview 2, developer decisions incorporated); `b4-workflow-engine-specification.md` (B4); `d3-state-machine-diagrams.md` (D3)

---

## About This Document

This document defines the actual seed data — TypeScript constants — for the three Phase 1 legislative workflows:

- SP Resolution (handles both the standard path and the Certified Urgent bypass within one definition)
- SP Ordinance (same dual-path handling)
- Appropriation Ordinance (same flow as Ordinance; distinct document type, distinct Panlalawigan outcome, no newspaper publication)

Each definition includes every step (with its `step_type`, `config`, and `legally_mandated` flag), every transition rule (with `outcome_filter` and `condition_expression`), the `multi_referral` Thursday cutoff configuration, the 10-day Mayor timer trigger, the 30-day Panlalawigan timer trigger, and the minimum step guards required by RA 7160.

**What this document does not cover:**

- The workflow engine execution model (covered in B4)
- State machine enum values (covered in D3; see D3 Appendix B for the B4 vs D3 reconciliation required before the first migration)
- Form definitions (referenced by `form_key` but not defined here)
- Notification templates (referenced by `template_key` but not defined here)
- Phase 1B document types (Letters, Memos, Notices, Designations)

**On inferences:** Requirements sourced from the consolidated reference and confirmed by interviews are stated as facts. Data model fields and config patterns derived from B4 but not explicitly defined there are labeled `[Inference]`. Fields extended beyond B4 to make these definitions implementable are labeled `[Extension]` and flagged for team confirmation.

---

## 1. Source Document Cross-References

|Topic|Source|Section|
|---|---|---|
|SP Resolution workflow|Consolidated ref|Part 4.1|
|SP Ordinance workflow|Consolidated ref|Part 4.2|
|Panlalawigan review outcomes|Consolidated ref|Part 4.3|
|Two-stage numbering|Consolidated ref|Parts 5.1, 5.2|
|Multi-committee referral rules|Consolidated ref|Part 8.3|
|Minimum step guards|Consolidated ref|Part 11.3|
|Certified Urgent bypass|B4|Section 6.1|
|Thursday cutoff enforcement|B4|Section 6.2|
|10-day Mayor lapse timer|B4|Section 6.3|
|30-day Panlalawigan timer|B4|Section 6.4|
|`action` step contract|B4|Section 4.1|
|`approval` step contract|B4|Section 4.2|
|`multi_referral` step contract|B4|Section 4.3|
|`decision` step contract|B4|Section 4.4|
|`notification` step contract|B4|Section 4.5|
|`termination` step contract|B4|Section 4.6|
|`termination` outcome codes|B4|Section 4.6|
|Context schema|B4|Appendix B|
|Engine invariants|B4|Section 9|
|D3 / B4 enum reconciliation|D3|Appendix B|
|VALID_IN_PART resolution paths|B4|Section 6.4|
|RETURNED path|B4|Section 6.4|

---

## 2. Conventions

### 2.1 Step Key Naming

Step keys use `snake_case` and must be stable across definition versions. Option B in-flight migration (B4 Section 7.3) maps active steps between versions by `step_key`. Rename a step key only when the step's semantic meaning has changed substantially. The keys defined here are the authoritative names for the Phase 1 legislative workflows.

### 2.2 UUID Handling

These constants use `step_key` strings as cross-references between steps and transition rules. The seed script resolves step keys to UUIDs before inserting into `workflow.steps` and `workflow.transition_rules`. UUIDs are generated via `uuidv5(WORKFLOW_SEED_NAMESPACE,` ${definitionCode}.${step_key}`)` so they are deterministic and reproducible across environments. `WORKFLOW_SEED_NAMESPACE` is a project-level constant defined in `/packages/database/src/seeds/constants.ts`.

### 2.3 Outcome Codes Used

The following outcome codes from B4 Section 4.2 and 4.6 are used in these definitions:

|Code|Step Type|Who Sets It|
|---|---|---|
|`DONE`|action|Engine on completion|
|`APPROVED`|approval|Actor|
|`RETURNED_FOR_REVISION`|approval|Actor|
|`REJECTED`|approval|Actor|
|`SIGNED`|approval|Actor|
|`VETOED`|approval|Actor|
|`LAPSED`|approval|Scheduler (`evaluateMayorLapseTimers`)|
|`OVERRIDE_SUCCEEDED`|approval|Actor|
|`OVERRIDE_FAILED`|approval|Actor|
|`VALID`|approval|Actor|
|`VALID_IN_PART`|approval|Actor|
|`RETURNED`|approval|Actor|
|`OPERATIVE_IN_ITS_ENTIRETY`|approval|Actor (Appropriation Ordinance only)|
|`DEEMED_APPROVED`|approval|Scheduler (`evaluatePanlalawiganTimers`)|
|`REPORT_ACCEPTED`|multi_referral|SP Secretary|
|`SECRETARY_ADVANCED`|multi_referral|SP Secretary (manual override)|
|`BYPASSED_CERTIFIED_URGENT`|multi_referral|Engine (Certified Urgent bypass)|
|`RESOLVED_IN_PLACE`|approval|Actor|
|`ROUTED_TO_LEGAL`|approval|Actor|
|`ROUTED_TO_COMMITTEE`|approval|Actor|
|`REVISED_DIRECTLY`|approval|Actor|
|`REPASS`|approval|Actor|
|`RESOLVED_DIRECTLY`|approval|Actor|
|`TRUE` / `FALSE`|decision|Engine (JSONLogic evaluator)|
|`DISPATCHED`|notification|Engine|
|`APPROVED_AND_RELEASED`|termination|Engine|
|`VALID_IN_PART_RESOLVED`|termination|Engine|
|`REJECTED_AT_VOTE`|termination|Engine|
|`VETOED_OVERRIDE_FAILED`|termination|Engine|
|`REPASSED`|termination|Engine|

### 2.4 Certified Urgent Path

Both the standard path and the Certified Urgent path are handled within a single workflow definition. The Certified Urgent bypass is event-driven: when `document.certification_urgency.logged` fires on the event bus, the engine bypasses the `committee_referral` step on each associated instance (B4 Section 6.1). The workflow definition only needs a transition rule with `outcome_filter = 'BYPASSED_CERTIFIED_URGENT'` on the `committee_referral` step. No `decision` step or second definition is required.

### 2.5 D3 / B4 Enum Reconciliation Status

> D3 Appendix B identifies several enum conflicts between B4 and D3 that must be resolved before the first migration. These definitions use D3-authoritative terminology where conflicts exist. If B4 is updated to conform to D3 before implementation, these definitions need no change.

|This document uses|B4 current value|D3 resolution|
|---|---|---|
|`Skipped` (step status)|`bypassed`|Rename B4 → `Skipped`|
|`Returned` (step status)|not defined|Add to B4|
|`Running` (instance status)|`active`|Rename B4 → `Running`|
|`Paused` (instance status)|`suspended`|Rename B4 → `Paused`|
|`final_document_status: 'ARCHIVED'`|`ARCHIVED`|Confirmed in B4 Section 4.6|
|`final_document_status: 'CANCELLED'`|`CANCELLED`|Confirmed in B4 Section 4.6|
|`Stuck` (instance status)|not defined|[RESOLVED D3-O-4, ADR-016] Add to B4. Retained as a visible error state — an invisible one would let broken instances masquerade as healthy in SLA/ARTA reporting.|
|`Failed` (step status)|not defined|[RESOLVED D3-O-5, ADR-016] Add to B4. Decided jointly with `Stuck` as a coupled error-state pair; same rationale.|
|`Running` (instance status, at creation)|`Created` exists as a separate B4 value|[RESOLVED D3-O-6, ADR-016] `Created` collapsed into `Running`. B4's actual same-transaction implementation makes `Created` unobservable in practice — no reachable database row ever has that status — so the unreachable state was removed rather than retained alongside `Running`.|

**Decision provenance note:** the `Stuck`/`Failed`/`Created` rows above were decided by Claude under explicit stakeholder delegation in a separate conversation (the same delegation pattern as this one: "for the items that you can decide what is the best according to your discretion, do them"), with reasoning presented back to the stakeholder and explicit confirmation obtained before being finalized. They are propagated into H1 here, not freshly decided in this conversation.

### 2.6 VALID_IN_PART and RETURNED Paths — Phase 1 Scope

B4 Section 6.4 defines four selectable paths after a `VALID_IN_PART` Panlalawigan outcome: `RESOLVED_IN_PLACE`, `ROUTED_TO_LEGAL`, `ROUTED_TO_COMMITTEE`, `REVISED_DIRECTLY`. In Phase 1, all four paths are modeled. [UPDATED — H1-X-3 resolution, this conversation] The Legal and Committee review paths are routed approval steps, not single action steps: the Legal Officer and Committee Chair each log their own decision directly, rather than the SP Secretary recording it on their behalf after the fact. This is still simplified relative to a full sub-workflow — there is no SLA timer in Phase 1 by stakeholder decision (no confirmed City Legal Office response-time data exists), and the outcome vocabulary is a single `RESOLVED_IN_PLACE` rather than a richer set of Legal/Committee-specific outcomes. Phase 1B can extend this further once real cycle-time data exists from Phase 1 operation.

---

## 3. TypeScript Type Definitions

```typescript
// ─── Step Types ───────────────────────────────────────────────────────────────
// Source: B4 Section 2.3
type WorkflowStepType =
  | "action"
  | "approval"
  | "multi_referral"
  | "decision"
  | "notification"
  | "termination"
  | "parallel_split"   // Phase 2 reserved — cannot be used in Phase 1 definitions
  | "parallel_join";   // Phase 2 reserved — cannot be used in Phase 1 definitions

// ─── Action Step Config ───────────────────────────────────────────────────────
// Source: B4 Section 4.1
interface ActionStepConfig {
  assignee: string;
  form_key?: string;
  require_comment?: boolean;       // default false
  allow_comment?: boolean;         // default true
  auto_complete?: boolean;         // default false
  deadline_hours?: number;
  // [Extension] Fields below are not defined in B4 Section 4.1 config.
  // They are proposed here to satisfy timer trigger and document lifecycle
  // update requirements. Team must confirm the implementation mechanism.
  triggers_mayor_lapse_timer?: boolean;
    // If true: on step completion, engine sets:
    //   instance.context.mayor_transmittal_date = NOW()
    //   instance.context.mayor_action_deadline = NOW() + 10 days
    // per B4 Section 6.3. Only one step in the definition may set this.
  triggers_panlalawigan_timer?: boolean;
    // If true: on step completion, engine sets:
    //   instance.context.panlalawigan_transmission_date = NOW()
    //   instance.context.panlalawigan_action_deadline = NOW() + 30 days
    // per B4 Section 6.4. Only one step in the definition may set this.
}

// ─── Approval Step Config ─────────────────────────────────────────────────────
// Source: B4 Section 4.2
// Outcome codes that are scheduler-only (LAPSED, DEEMED_APPROVED) may be
// listed in allowed_outcomes but are guarded by the engine against human
// submission. Source: B4 Section 4.2.
interface ApprovalStepConfig {
  assignee: string;
  allowed_outcomes: string[];
  require_comment_on?: string[];   // default: ["REJECTED", "RETURNED_FOR_REVISION"]
  deadline_hours?: number;
}

// ─── Multi-Referral Step Config ───────────────────────────────────────────────
// Source: B4 Section 4.3
interface MultiReferralStepConfig {
  default_committee_roles: string[];
    // Baseline list. SP Secretary can add/change at runtime (before any
    // submission is received). Source: B4 Section 4.3 "overridden per instance."
  report_acceptor_role: string;
  thursday_cutoff_enabled: boolean;
  cutoff_time_pht: string;         // "HH:MM:SS" in PHT (Asia/Manila, UTC+08:00)
  require_all_committee_signatures: boolean;
    // Must be true per Part 8.3 [CONFIRMED — developer decisions].
    // Enforcement: B4 Section 9, invariant 2.
  allow_secretary_advance: boolean;
    // SP Secretary can manually advance with a mandatory comment.
    // Always audit-logged. Source: B4 Section 4.3.
}

// ─── Decision Step Config ─────────────────────────────────────────────────────
// Source: B4 Section 4.4
interface DecisionStepConfig {
  condition_expression: string;    // JSONLogic expression; read-only context access
  true_outcome?: string;           // default "TRUE"
  false_outcome?: string;          // default "FALSE"
}

// ─── Notification Step Config ─────────────────────────────────────────────────
// Source: B4 Section 4.5
interface NotificationStepConfig {
  template_key: string;
  recipients: string[];
  channels?: string[];             // default ["in_app"]
  payload_context_keys?: string[];
}

// ─── Termination Step Config ──────────────────────────────────────────────────
// Source: B4 Section 4.6
// Valid outcome_code values: APPROVED_AND_RELEASED, LAPSED_INTO_LAW,
// DEEMED_APPROVED_PANLALAWIGAN, VETOED_OVERRIDE_FAILED, REJECTED_AT_VOTE,
// ARCHIVED_NO_ACTION, CANCELLED, VALID_IN_PART_RESOLVED, REPASSED
// Valid final_document_status values: RELEASED, ARCHIVED, CANCELLED
//
// REPASSED special case (B4 Section 4.6; lifecycle modeling RESOLVED —
// D3-O-2/O-7, ADR-014/015, propagated into H1 in this conversation):
//   The instance is NOT set to status=Completed. It remains Running
//   indefinitely (O-7) — no distinct Repassed instance status exists.
//   The engine emits workflow.instance.repassed.
//   The documents module sets documents.superseded_by + closure_reason on
//   the original document, creates a new document inheriting its content,
//   and that new document reuses the original's final series number upon
//   its own eventual approval (O-2) — a scoped, explicit exception to the
//   "final numbers never reused" invariant, applying only to this case.
//   Accepted tradeoff (O-7, not fully eliminated): a Running instance whose
//   document was superseded reads as misleading without a join to
//   documents.superseded_by. This is a deliberate decision, not a gap.
interface TerminationStepConfig {
  outcome_code: string;
  final_document_status: "RELEASED" | "ARCHIVED" | "CANCELLED" | null;
    // null for REPASSED: this is the resolved value, not a placeholder.
    // Document lifecycle status for this path is tracked on
    // documents.superseded_by (set by the documents module on
    // workflow.instance.repassed), not on this field — see above.
  emit_event?: string;
}

// ─── Step Definition (in snapshot) ───────────────────────────────────────────
interface WorkflowStepDef {
  step_key: string;
  step_type: WorkflowStepType;
  label: string;
  is_start: boolean;
  position: number;
    // Display ordering only; does not control execution sequence.
  legally_mandated: boolean;
    // [Extension] Not a B4 field. Used by the workflow editor validation
    // to prevent Platform Administrators from removing legally required steps.
    // Source: consolidated ref Part 11.3. Enforcement is application-level.
  config:
    | ActionStepConfig
    | ApprovalStepConfig
    | MultiReferralStepConfig
    | DecisionStepConfig
    | NotificationStepConfig
    | TerminationStepConfig;
}

// ─── Transition Rule (in snapshot) ───────────────────────────────────────────
// Source: B4 Section 2.4
// In these seed constants, from_step_key and to_step_key are used instead of
// from_step_id and to_step_id. The seed script resolves keys to UUIDs.
interface WorkflowTransitionRuleDef {
  from_step_key: string;
  to_step_key: string;
  outcome_filter: string | null;
    // null = unconditional (fires for any outcome from the from_step).
  condition_expression: string | null;
    // null = no additional condition. JSONLogic against instance.context.
  priority: number;
    // Lower = evaluated first. Source: B4 Section 3.4.
  label: string | null;
}

// ─── Top-Level Seed Structure ─────────────────────────────────────────────────
interface WorkflowDefinitionSeed {
  definition: {
    name: string;
    description: string;
    document_type_code: string;
      // Seed script looks up document_type_id from documents.document_types
      // WHERE code = document_type_code.
    is_active: boolean;
  };
  version: {
    version_number: number;
    steps: WorkflowStepDef[];
    transition_rules: WorkflowTransitionRuleDef[];
  };
}
```

---

## 4. Shared Role Key Constants

```typescript
// Assignee resolution expressions. Format: B4 Section 3.5.
// These are string constants, not UUIDs; the engine resolves them at
// step activation time against the current organization state.
const ROLE = {
  SP_SECRETARY:          "office_role:sp_secretariat:sp_secretary",
  SECRETARIAT_STAFF:     "office_role:sp_secretariat:secretariat_staff",
  RECORDS_OFFICER:       "role:records_officer",
  VICE_MAYOR:            "delegation_aware:vice_mayor",
    // Resolves to Acting VM if the VM holds an active delegation grant.
  MAYOR:                 "delegation_aware:mayor",
    // Resolves to Acting Mayor if the Mayor holds an active delegation grant.
  LEGAL_OFFICER:         "office_role:city_legal:legal_officer",
  COMMITTEE_LAWS:        "committee:laws_rules_ethics_privileges",
  // [Extension — introduced by H1-X-3 resolution, this conversation]
  // COMMITTEE_CHAIR is needed for committee_revisions_review, which must
  // route to whichever committee the VALID_IN_PART measure was originally
  // referred to — not a fixed committee like COMMITTEE_LAWS above.
  // [Unverified] No existing resolution-string syntax in this file covers
  // "resolve dynamically from the instance's own referral history." The
  // string below is a placeholder shape, not a confirmed engine contract —
  // it has not been checked against B4's actual assignee-resolution grammar
  // (B4 §3.5, cross-referenced in the comment above but not itself sourced
  // in this document). Needs engine-side confirmation before implementation,
  // the same way VICE_MAYOR/MAYOR's delegation_aware: prefix presumably
  // needed confirming when it was first introduced.
  COMMITTEE_CHAIR:       "instance_aware:committee_chair_of_referred_committee",
} as const;
```

---

## 5. SP Resolution — Workflow Definition

### 5.1 Process Notes

- Two readings (confirmed: Interview 2 supersedes Interview 1 flowchart). Source: consolidated ref Part 4.1.
- Amendments may occur at Second Reading. If so, the Secretariat logs them and prepares the amended copy; a second vote on the amended version follows in the same Second Reading session.
- Final series number assigned **after** Second Reading vote, **before** VP signs. Source: consolidated ref Part 5.2.
- Mayor 10-day review applies. Legal basis: RA 7160 Section 47. Source: consolidated ref Part 4.1.
- Panlalawigan 30-day review applies. Legal basis: RA 7160 Section 56(d). Source: consolidated ref Part 4.3.
- **No newspaper publication** for SP Resolutions. Portal publication only. Source: consolidated ref Part 4.2.
- Certified Urgent path handled via engine bypass; no separate steps required. See Section 2.4.

### 5.2 Steps

|#|step_key|type|is_start|legally_mandated|assignee (short)|Key Config Notes|
|---|---|---|---|---|---|---|
|1|`intake_logging`|action|✓|✓|secretariat_staff|QR + preliminary number assigned by docs module on `workflow.step.completed` for this step_key|
|2|`order_of_business_scheduling`|action|||sp_secretary|SP Secretary places document on upcoming Tuesday OB|
|3|`first_reading`|action||✓|sp_secretary|Records First Reading; VP refers to committee(s)|
|4|`committee_referral`|multi_referral||✓|committee:laws (default)|`require_all_committee_signatures: true`; `thursday_cutoff_enabled: true`; BYPASSED_CERTIFIED_URGENT transition required|
|5|`second_reading_vote`|approval||✓|sp_secretary|APPROVED / RETURNED_FOR_REVISION / REJECTED|
|6|`amendments_logging`|action|||secretariat_staff|Conditional path only; Secretariat logs amendments, prepares amended copy|
|7|`second_reading_amended_vote`|approval|||sp_secretary|Final vote on amended version; APPROVED / REJECTED|
|8|`final_number_assignment`|action||✓|sp_secretary|Removes "Draft" prefix; promotes to final number|
|9|`vp_certification`|approval||✓|VICE_MAYOR (delegation_aware)|SIGNED|
|10|`transmittal_letter_to_mayor`|action||✓|secretariat_staff|`triggers_mayor_lapse_timer: true`; generates SPS letter|
|11|`mayor_review`|approval||✓|MAYOR (delegation_aware)|SIGNED / VETOED / LAPSED; LAPSED is scheduler-only|
|12|`veto_override_vote`|approval|||sp_secretary|OVERRIDE_SUCCEEDED / OVERRIDE_FAILED; 2/3 = 8 of 12|
|13|`docketing`|action||✓|secretariat_staff|Secretariat readies for distribution|
|14|`panlalawigan_transmission_logging`|action|||secretariat_staff|`triggers_panlalawigan_timer: true`; logs transmission|
|15|`panlalawigan_review`|approval||✓|sp_secretary|VALID / VALID_IN_PART / RETURNED / DEEMED_APPROVED; DEEMED_APPROVED scheduler-only|
|16|`valid_in_part_action`|action|||sp_secretary|Conditional; mandatory comment; Secretary documents context|
|17|`valid_in_part_decision`|approval|||sp_secretary|RESOLVED_IN_PLACE / ROUTED_TO_LEGAL / ROUTED_TO_COMMITTEE / REVISED_DIRECTLY|
|18|`legal_office_review`|approval|||legal_officer|RESOLVED_IN_PLACE; routed approval per H1-X-3 resolution, no Phase 1 SLA timer|
|19|`committee_revisions_review`|approval|||COMMITTEE_CHAIR|RESOLVED_IN_PLACE; routed approval per H1-X-3 resolution, no Phase 1 SLA timer; assignee resolution mechanism [Unverified] — see §4|
|20|`returned_review`|approval|||sp_secretary|Conditional; REPASS / RESOLVED_DIRECTLY|
|21|`portal_publication`|action||✓|secretariat_staff|Title and first page published; docs module sets `Released`|
|22|`archive`|action|||records_officer|Records Officer archives; docs module sets `Archived`|
|23|`final_outcome_check`|decision|||—|JSONLogic checks `panlalawigan_outcome`; routes to correct terminal|
|24|`end_approved_and_released`|termination|||—|APPROVED_AND_RELEASED; ARCHIVED|
|25|`end_valid_in_part_resolved`|termination|||—|VALID_IN_PART_RESOLVED; ARCHIVED|
|26|`end_rejected_at_vote`|termination|||—|REJECTED_AT_VOTE; CANCELLED|
|27|`end_vetoed_override_failed`|termination|||—|VETOED_OVERRIDE_FAILED; CANCELLED|
|28|`end_repassed`|termination|||—|REPASSED; `final_document_status: null` (resolved — see D3-O-2/O-7, ADR-014/015: status tracked via `documents.superseded_by`, not this field)|

### 5.3 Transition Rules

|#|from|outcome_filter|condition|to|priority|Notes|
|---|---|---|---|---|---|---|
|1|intake_logging|—|—|order_of_business_scheduling|1|Unconditional|
|2|order_of_business_scheduling|—|—|first_reading|1|Unconditional|
|3|first_reading|—|—|committee_referral|1|Unconditional|
|4|committee_referral|REPORT_ACCEPTED|—|second_reading_vote|1|All committees submitted; SP Secretary accepted unified report|
|5|committee_referral|SECRETARY_ADVANCED|—|second_reading_vote|2|SP Secretary manual override; mandatory comment; audit-logged|
|6|committee_referral|BYPASSED_CERTIFIED_URGENT|—|second_reading_vote|3|**Required by B4 §6.1 and §8.1 invariant 3.** Engine sets this outcome when bypass fires.|
|7|second_reading_vote|APPROVED|—|final_number_assignment|1|Passed with no amendments|
|8|second_reading_vote|RETURNED_FOR_REVISION|—|amendments_logging|2|Passed with amendments; Secretariat logs|
|9|second_reading_vote|REJECTED|—|end_rejected_at_vote|3|Voted down|
|10|amendments_logging|—|—|second_reading_amended_vote|1|Unconditional|
|11|second_reading_amended_vote|APPROVED|—|final_number_assignment|1|Amended version approved|
|12|second_reading_amended_vote|REJECTED|—|end_rejected_at_vote|2|Amended version voted down|
|13|final_number_assignment|—|—|vp_certification|1|Unconditional; "Draft" prefix now removed|
|14|vp_certification|SIGNED|—|transmittal_letter_to_mayor|1||
|15|transmittal_letter_to_mayor|—|—|mayor_review|1|Unconditional; timer set on prior step completion|
|16|mayor_review|SIGNED|—|docketing|1|Mayor signed|
|17|mayor_review|LAPSED|—|docketing|2|Lapsed into law; RA 7160 §47; same docketing path as signed|
|18|mayor_review|VETOED|—|veto_override_vote|3|Mayor vetoed|
|19|veto_override_vote|OVERRIDE_SUCCEEDED|—|docketing|1|8 of 12 voted to override|
|20|veto_override_vote|OVERRIDE_FAILED|—|end_vetoed_override_failed|2|Override failed|
|21|docketing|—|—|panlalawigan_transmission_logging|1|Unconditional|
|22|panlalawigan_transmission_logging|—|—|panlalawigan_review|1|Unconditional; timer set on prior step completion|
|23|panlalawigan_review|VALID|—|portal_publication|1||
|24|panlalawigan_review|DEEMED_APPROVED|—|portal_publication|2|RA 7160 §56(d); 30 days elapsed|
|25|panlalawigan_review|VALID_IN_PART|—|valid_in_part_action|3||
|26|panlalawigan_review|RETURNED|—|returned_review|4||
|27|valid_in_part_action|—|—|valid_in_part_decision|1|Unconditional|
|28|valid_in_part_decision|RESOLVED_IN_PLACE|—|portal_publication|1|Mandatory comment; document annotated|
|29|valid_in_part_decision|ROUTED_TO_LEGAL|—|legal_office_review|2||
|30|valid_in_part_decision|ROUTED_TO_COMMITTEE|—|committee_revisions_review|3||
|31|valid_in_part_decision|REVISED_DIRECTLY|—|portal_publication|4|Mandatory comment; Secretariat implements|
|32|legal_office_review|RESOLVED_IN_PLACE|—|portal_publication|1|Per H1-X-3 resolution; was unconditional, now outcome-filtered|
|33|committee_revisions_review|RESOLVED_IN_PLACE|—|portal_publication|1|Per H1-X-3 resolution; was unconditional, now outcome-filtered|
|34|returned_review|RESOLVED_DIRECTLY|—|portal_publication|1|Mandatory comment; B4 §6.4|
|35|returned_review|REPASS|—|end_repassed|2|Document goes back to drafting|
|36|portal_publication|—|—|archive|1|Unconditional|
|37|archive|—|—|final_outcome_check|1|Unconditional|
|38|final_outcome_check|TRUE|—|end_approved_and_released|1|panlalawigan_outcome ∈ {VALID, DEEMED_APPROVED}|
|39|final_outcome_check|FALSE|—|end_valid_in_part_resolved|2|All other resolved outcomes|

### 5.4 Step Flow Diagram

```mermaid
flowchart TD
    classDef action fill:#dbeafe,stroke:#1d4ed8,color:#1e3a5f
    classDef approval fill:#d1fae5,stroke:#065f46,color:#064e3b
    classDef multi_ref fill:#fef3c7,stroke:#b45309,color:#451a03
    classDef decision fill:#f3e8ff,stroke:#6b21a8,color:#3b0764
    classDef term fill:#fee2e2,stroke:#991b1b,color:#7f1d1d

    IL["⚖ intake_logging"]:::action --> OB["order_of_business_scheduling"]:::action
    OB --> FR["⚖ first_reading"]:::action
    FR --> CR{{"⚖ committee_referral\nmulti_referral"}}:::multi_ref

    CR -->|"REPORT_ACCEPTED\nSECRETARY_ADVANCED"| SR2
    CR -->|"BYPASSED_CERTIFIED_URGENT"| SR2

    SR2{["⚖ second_reading_vote\napproval"]}:::approval
    SR2 -->|"APPROVED"| FN
    SR2 -->|"RETURNED_FOR_REVISION"| AL["amendments_logging"]:::action
    SR2 -->|"REJECTED"| ERV

    AL --> SR2A{["second_reading_amended_vote\napproval"]}:::approval
    SR2A -->|"APPROVED"| FN
    SR2A -->|"REJECTED"| ERV

    FN["⚖ final_number_assignment"]:::action --> VPC
    VPC{["⚖ vp_certification\napproval"]}:::approval -->|"SIGNED"| TLM
    TLM["⚖ ⏱ transmittal_letter_to_mayor"]:::action --> MR
    MR{["⚖ mayor_review\napproval ⏱10d"]}:::approval
    MR -->|"SIGNED"| DOCK
    MR -->|"LAPSED"| DOCK
    MR -->|"VETOED"| VOV
    VOV{["veto_override_vote\napproval"]}:::approval
    VOV -->|"OVERRIDE_SUCCEEDED"| DOCK
    VOV -->|"OVERRIDE_FAILED"| EVOF

    DOCK["⚖ docketing"]:::action --> PTL
    PTL["⚖ ⏱ panlalawigan_transmission_logging"]:::action --> PR
    PR{["⚖ panlalawigan_review\napproval ⏱30d"]}:::approval

    PR -->|"VALID"| PP
    PR -->|"DEEMED_APPROVED"| PP
    PR -->|"VALID_IN_PART"| VIA
    PR -->|"RETURNED"| RR

    VIA["valid_in_part_action"]:::action --> VID
    VID{["valid_in_part_decision\napproval"]}:::approval
    VID -->|"RESOLVED_IN_PLACE\nREVISED_DIRECTLY"| PP
    VID -->|"ROUTED_TO_LEGAL"| LOR{["legal_office_review\napproval"]}:::approval
    VID -->|"ROUTED_TO_COMMITTEE"| CRR{["committee_revisions_review\napproval"]}:::approval
    LOR -->|"RESOLVED_IN_PLACE"| PP
    CRR -->|"RESOLVED_IN_PLACE"| PP

    RR{["returned_review\napproval"]}:::approval
    RR -->|"RESOLVED_DIRECTLY"| PP
    RR -->|"REPASS"| EREP

    PP["⚖ portal_publication"]:::action --> ARC["archive"]:::action
    ARC --> FOC{"final_outcome_check\ndecision"}:::decision
    FOC -->|"TRUE"| EAAR
    FOC -->|"FALSE"| EVIP

    EAAR(["✓ end_approved_and_released\nAPPROVED_AND_RELEASED"]):::term
    EVIP(["✓ end_valid_in_part_resolved\nVALID_IN_PART_RESOLVED"]):::term
    ERV(["✗ end_rejected_at_vote\nREJECTED_AT_VOTE"]):::term
    EVOF(["✗ end_vetoed_override_failed\nVETOED_OVERRIDE_FAILED"]):::term
    EREP(["↺ end_repassed\nREPASSED"]):::term
```

**Legend:** Blue = action · Green = approval · Yellow = multi_referral · Purple = decision · Red = termination · ⚖ = legally mandated step · ⏱ = triggers or contains a timer

### 5.5 TypeScript Constant

```typescript
export const SP_RESOLUTION_WORKFLOW: WorkflowDefinitionSeed = {
  definition: {
    name: "SP Resolution — 7th Sangguniang Panlungsod",
    description:
      "Full legislative lifecycle for SP Resolutions (RA 7160 Chapter 2, Section 53). " +
      "Two readings. Mayor 10-day review with automatic lapse-into-law (RA 7160 §47). " +
      "Panlalawigan 30-day review with automatic deemed-approval (RA 7160 §56(d)). " +
      "Certified Urgent bypass handled via engine event handler (B4 §6.1); no separate definition required. " +
      "No newspaper publication requirement for resolutions. " +
      "VALID_IN_PART: four resolution paths per B4 §6.4. RETURNED: repass or resolve directly.",
    document_type_code: "sp_resolution",
    is_active: true,
  },

  version: {
    version_number: 1,

    // =========================================================================
    // STEPS
    // =========================================================================
    steps: [

      // ── 1. Intake and Logging ─────────────────────────────────────────────
      // QR code assignment and preliminary "Draft 7SP YYYY-NN" number assignment
      // are performed by the documents module when this step completes.
      // Trigger: workflow.step.completed event with step_key = "intake_logging".
      // Source: consolidated ref Parts 4.1, 5.1, 11.6.
      {
        step_key: "intake_logging",
        step_type: "action",
        label: "Secretariat Intake and Logging",
        is_start: true,
        position: 1,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.sp_resolution.intake",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 2. Order of Business Scheduling ──────────────────────────────────
      // SP Secretary places the document on the next eligible Tuesday Order of
      // Business. Cutoff: Thursday 23:59:59 PHT for the following Tuesday.
      // Source: consolidated ref Parts 4.18, 7.2.
      {
        step_key: "order_of_business_scheduling",
        step_type: "action",
        label: "Order of Business Scheduling",
        is_start: false,
        position: 2,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: "form.sp_resolution.order_of_business",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 3. First Reading ──────────────────────────────────────────────────
      // Secretariat records that First Reading occurred. VP refers to
      // committee(s). The committee assignment is set in the next step.
      // Source: consolidated ref Part 4.1.
      {
        step_key: "first_reading",
        step_type: "action",
        label: "First Reading — SP Session",
        is_start: false,
        position: 3,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: "form.sp_resolution.first_reading",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 4. Committee Referral and Hearing ─────────────────────────────────
      // Committee on Laws is the default co-referral committee. SP Secretary
      // adds the subject-matter committee at or after First Reading (before any
      // submission is received). Source: consolidated ref Part 6, Part 8.1.
      //
      // CERTIFIED URGENT bypass: If the Mayor's Certification of Urgency is
      // logged while this step is active or pending, the engine sets
      // step_instances.bypass_reason = 'CERTIFIED_URGENT' and
      // step_instances.outcome = 'BYPASSED_CERTIFIED_URGENT', then runs
      // transition evaluation. The transition rule #6 below handles this.
      // Source: B4 §6.1.
      //
      // Thursday cutoff: If not all committees have submitted by Thursday
      // 23:59:59 PHT, the second_reading_eligible_date is not set and the
      // measure does not appear on the next Tuesday Order of Business.
      // Source: B4 §6.2; consolidated ref Part 8.3.
      {
        step_key: "committee_referral",
        step_type: "multi_referral",
        label: "Committee Referral and Hearing",
        is_start: false,
        position: 4,
        legally_mandated: true,
        config: {
          default_committee_roles: [ROLE.COMMITTEE_LAWS],
          report_acceptor_role: ROLE.SP_SECRETARY,
          thursday_cutoff_enabled: true,
          cutoff_time_pht: "23:59:59",
          require_all_committee_signatures: true,
          allow_secretary_advance: true,
        } satisfies MultiReferralStepConfig,
      },

      // ── 5. Second Reading Vote ────────────────────────────────────────────
      // SP Secretary records the session vote outcome.
      //   APPROVED             → final_number_assignment (no amendments needed)
      //   RETURNED_FOR_REVISION → amendments_logging (amendments to be logged)
      //   REJECTED             → end_rejected_at_vote
      // Source: consolidated ref Part 4.1 [CONFIRMED — Interview 2].
      {
        step_key: "second_reading_vote",
        step_type: "approval",
        label: "Second Reading — Vote",
        is_start: false,
        position: 5,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["APPROVED", "RETURNED_FOR_REVISION", "REJECTED"],
          require_comment_on: ["REJECTED"],
        } satisfies ApprovalStepConfig,
      },

      // ── 6. Amendments Logging ─────────────────────────────────────────────
      // Reached only via RETURNED_FOR_REVISION from second_reading_vote.
      // Secretariat logs the amendments and prepares the amended final copy.
      // A second vote on the amended version follows.
      // Source: consolidated ref Part 4.1 [CONFIRMED — Interview 2].
      {
        step_key: "amendments_logging",
        step_type: "action",
        label: "Amendments Logging — Second Reading",
        is_start: false,
        position: 6,
        legally_mandated: false,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.sp_resolution.amendments_logging",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 7. Second Reading Amended Vote ────────────────────────────────────
      // Final vote on the amended version of the resolution.
      // SP Resolutions have no separate Third Reading; this vote is the
      // conclusive reading vote if amendments were made.
      // Source: consolidated ref Part 4.1 [CONFIRMED — Interview 2].
      {
        step_key: "second_reading_amended_vote",
        step_type: "approval",
        label: "Second Reading — Final Vote on Amended Version",
        is_start: false,
        position: 7,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["APPROVED", "REJECTED"],
          require_comment_on: ["REJECTED"],
        } satisfies ApprovalStepConfig,
      },

      // ── 8. Final Series Number Assignment ────────────────────────────────
      // Secretariat removes "Draft" prefix and assigns the final series number.
      // Assignment event: AFTER Second Reading vote, BEFORE VP signs.
      // Source: consolidated ref Parts 5.1, 5.2 [CONFIRMED — Interview 2;
      // SUPERSEDES Interview 1 which placed assignment after Mayor signature].
      // The documents module promotes the preliminary number to final on the
      // workflow.step.completed event for this step_key.
      {
        step_key: "final_number_assignment",
        step_type: "action",
        label: "Final Series Number Assignment",
        is_start: false,
        position: 8,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: "form.document.final_number_assignment",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 9. Vice Mayor Certification ───────────────────────────────────────
      // VP signs the certified copy. delegation_aware resolves to the Acting
      // VM if the VM is designated as Acting Mayor or holds an active
      // designation grant for a different role.
      // Source: consolidated ref Part 4.1.
      {
        step_key: "vp_certification",
        step_type: "approval",
        label: "Vice Mayor Signs Certified Copy",
        is_start: false,
        position: 9,
        legally_mandated: true,
        config: {
          assignee: ROLE.VICE_MAYOR,
          allowed_outcomes: ["SIGNED"],
          require_comment_on: [],
        } satisfies ApprovalStepConfig,
      },

      // ── 10. Transmittal Letter to Mayor ──────────────────────────────────
      // Secretariat generates and sends the formal Transmittal Letter (SPS
      // format; "For appropriate action"). This step's completion starts the
      // 10-day Mayor lapse timer.
      // [RESOLVED H1-X-1 — decided by Claude under stakeholder delegation,
      // this conversation; [Unverified] against B4 itself.] Mechanism is
      // option (a): the config flag below is itself the mechanism the engine
      // reads. The engine recognizes triggers_mayor_lapse_timer as a config
      // field and executes the context-update (mayor_transmittal_date,
      // mayor_action_deadline) on step completion — it is not inferred from
      // step_key pattern-matching (rejected: breaks silently on a permitted
      // rename per §2.1) and not delegated to a documents-module subscriber
      // (rejected: splits the logic away from the step it documents). See
      // §11 H1-X-1 for full reasoning.
      // Source: B4 §6.3; consolidated ref Parts 4.1, 4.9, 11.3.
      {
        step_key: "transmittal_letter_to_mayor",
        step_type: "action",
        label: "Transmittal Letter to Mayor",
        is_start: false,
        position: 10,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.document.transmittal_letter_to_mayor",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
          triggers_mayor_lapse_timer: true,  // [RESOLVED H1-X-1 — option (a)]
        } satisfies ActionStepConfig,
      },

      // ── 11. Mayor Review — 10-Day Window ─────────────────────────────────
      // Mayor reviews within 10 calendar days. No adjustment for weekends or
      // public holidays. Source: RA 7160 §47; consolidated ref Part 4.1.
      //
      // LAPSED is scheduler-only: evaluateMayorLapseTimers sets the outcome
      // when NOW() > instance.context.mayor_action_deadline.
      // B4 §4.2 prevents human submission with outcome = LAPSED.
      // Source: B4 §6.3.
      //
      // delegation_aware:mayor resolves to the Acting Mayor if applicable.
      {
        step_key: "mayor_review",
        step_type: "approval",
        label: "Mayor Review — 10-Day Window",
        is_start: false,
        position: 11,
        legally_mandated: true,
        config: {
          assignee: ROLE.MAYOR,
          allowed_outcomes: ["SIGNED", "VETOED", "LAPSED"],
          require_comment_on: ["VETOED"],
        } satisfies ApprovalStepConfig,
      },

      // ── 12. Veto Override Vote ────────────────────────────────────────────
      // Reached only when mayor_review outcome = VETOED.
      // Override threshold: 2/3 majority = 8 of 12 SP members.
      // Source: consolidated ref Parts 3.2, 4.1 [CONFIRMED].
      // SP Secretary records the session vote count and outcome.
      // Vote count stored in instance.context.veto_override_vote_count
      // per B4 §6.3.
      {
        step_key: "veto_override_vote",
        step_type: "approval",
        label: "Veto Override Vote",
        is_start: false,
        position: 12,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["OVERRIDE_SUCCEEDED", "OVERRIDE_FAILED"],
          require_comment_on: [],
        } satisfies ApprovalStepConfig,
      },

      // ── 13. Docketing ─────────────────────────────────────────────────────
      // Secretariat readies the document for distribution. At this point the
      // document already has its final series number (assigned at step 8).
      // Source: consolidated ref Part 4.1 [CONFIRMED — Interview 2].
      {
        step_key: "docketing",
        step_type: "action",
        label: "Docketing",
        is_start: false,
        position: 13,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.document.docketing",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 14. Panlalawigan Transmission Logging ────────────────────────────
      // Secretariat logs the formal transmission to the Sangguniang
      // Panlalawigan. This step's completion starts the 30-day timer.
      // [RESOLVED H1-X-1 — same resolution and mechanism as
      // transmittal_letter_to_mayor above: option (a), config flag is the
      // mechanism. Full reasoning in that step's comment and §11 H1-X-1.]
      // Source: B4 §6.4; consolidated ref Part 4.3.
      {
        step_key: "panlalawigan_transmission_logging",
        step_type: "action",
        label: "Panlalawigan Transmission Logging",
        is_start: false,
        position: 14,
        legally_mandated: false,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.panlalawigan.transmission_logging",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
          triggers_panlalawigan_timer: true,  // [RESOLVED H1-X-1 — option (a)]
        } satisfies ActionStepConfig,
      },

      // ── 15. Panlalawigan Review — 30-Day Window ───────────────────────────
      // SP Secretary records the Panlalawigan's formal written notification
      // (Panlalawigan resolution) when received.
      //
      // DEEMED_APPROVED fires at day 30 via evaluatePanlalawiganTimers.
      // B4 §4.2 prevents human submission with outcome = DEEMED_APPROVED.
      // Legal basis: RA 7160 §56(d).
      //
      // SP Resolutions: OPERATIVE_IN_ITS_ENTIRETY is NOT an allowed outcome.
      // That outcome is specific to Appropriation Ordinances.
      // Source: consolidated ref Part 4.3.
      {
        step_key: "panlalawigan_review",
        step_type: "approval",
        label: "Sangguniang Panlalawigan Review — 30-Day Window",
        is_start: false,
        position: 15,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["VALID", "VALID_IN_PART", "RETURNED", "DEEMED_APPROVED"],
          require_comment_on: ["VALID_IN_PART", "RETURNED"],
        } satisfies ApprovalStepConfig,
      },

      // ── 16. VALID_IN_PART Action ──────────────────────────────────────────
      // Reached when panlalawigan_review outcome = VALID_IN_PART.
      // SP Secretary documents the context and any initial notes before
      // selecting the resolution path in the next step.
      // Mandatory comment required. Source: B4 §6.4; consolidated ref Part 4.3.
      {
        step_key: "valid_in_part_action",
        step_type: "action",
        label: "VALID-IN-PART — Secretary Documentation",
        is_start: false,
        position: 16,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: "form.panlalawigan.valid_in_part_action",
          require_comment: true,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 17. VALID_IN_PART Decision ────────────────────────────────────────
      // SP Secretary selects the resolution path. Four options per B4 §6.4:
      //   RESOLVED_IN_PLACE  → document annotated; routes to portal_publication
      //   ROUTED_TO_LEGAL    → routes to legal_office_review (Phase 1 simplified)
      //   ROUTED_TO_COMMITTEE → routes to committee_revisions_review (Phase 1 simplified)
      //   REVISED_DIRECTLY   → mandatory comment; routes to portal_publication
      // Source: B4 §6.4; consolidated ref Part 4.3.
      {
        step_key: "valid_in_part_decision",
        step_type: "approval",
        label: "VALID-IN-PART — Secretary Selects Resolution Path",
        is_start: false,
        position: 17,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: [
            "RESOLVED_IN_PLACE",
            "ROUTED_TO_LEGAL",
            "ROUTED_TO_COMMITTEE",
            "REVISED_DIRECTLY",
          ],
          require_comment_on: ["RESOLVED_IN_PLACE", "REVISED_DIRECTLY"],
        } satisfies ApprovalStepConfig,
      },

      // ── 18. Legal Office Review ───────────────────────────────────────────
      // [RESOLVED H1-X-3 — team decision, this conversation] Routed approval
      // step, not a single recorded note. The Legal Officer logs their own
      // decision and the step itself emits an outcome — it does not just
      // re-emit the ROUTED_TO_LEGAL outcome that sent the step here (that
      // outcome belongs to valid_in_part_decision and cannot be reused as
      // this step's own outcome without an outcome-code collision against
      // the shared global outcome table in §2.3).
      // Outcome reused: RESOLVED_IN_PLACE — by stakeholder decision, the
      // Legal Officer's logged recommendation closes the routed branch the
      // same way the Secretary's own "resolve as-is" choice does; both mean
      // "Secretariat is satisfied, proceed."
      // No SLA timer in Phase 1 — by explicit stakeholder decision: no
      // confirmed City Legal Office response-time data exists yet, so no
      // SLA value is invented. [Unverified: whether a City Legal Office SLA
      // exists at all — not sourced in the consolidated reference, B4, or
      // D3.] The step sits open until the Legal Officer acts; the Secretariat
      // sees it as a pending item with no deadline rather than a phantom one.
      // Phase 1B: revisit once real cycle-time data exists from Phase 1
      // operation, with SP Secretary + Legal Officer sign-off per stakeholder
      // guidance — same evidence-based-SLA approach already used for the
      // Mayor/Panlalawigan timers, just deferred here for lack of a source.
      // Source: B4 §6.4 (routing existence only — single-step vs. multi-step
      // shape decided here, in this conversation, by stakeholder direction).
      {
        step_key: "legal_office_review",
        step_type: "approval",
        label: "Legal Office Review — VALID_IN_PART",
        is_start: false,
        position: 18,
        legally_mandated: false,
        config: {
          assignee: ROLE.LEGAL_OFFICER,
          allowed_outcomes: ["RESOLVED_IN_PLACE"],
          require_comment_on: ["RESOLVED_IN_PLACE"],
          // No deadline_hours: Phase 1 has no SLA timer on this step by
          // stakeholder decision. Phase 1B may add one once real cycle-time
          // data exists. This is an intentional omission, not an oversight.
        } satisfies ApprovalStepConfig,
      },

      // ── 19. Committee Revisions Review ────────────────────────────────────
      // [RESOLVED H1-X-3 — team decision, this conversation] Routed approval
      // step assigned to the actual Committee Chair, not the SP Secretary.
      // The prior simplified version had the SP Secretary recording the
      // committee's recommendation on the committee's behalf; the stakeholder
      // decision requires the Committee Chair to log their own decision
      // directly. This requires a new role-key resolver — ROLE.COMMITTEE_CHAIR
      // — which did not previously exist in §4; see the new entry added there.
      // [Extension] COMMITTEE_CHAIR is introduced in this conversation by
      // necessity of the stakeholder's routed-approval design; it is not
      // defined anywhere in B4, D3, or the consolidated reference, and its
      // resolution mechanism (which specific committee — likely whichever
      // committee the VALID_IN_PART measure was originally referred to)
      // needs engine-side confirmation before implementation, the same way
      // VICE_MAYOR/MAYOR delegation-aware resolution needed confirming.
      // Outcome and no-SLA rationale: same as legal_office_review above.
      // Source: B4 §6.4 (routing existence only — shape decided here).
      {
        step_key: "committee_revisions_review",
        step_type: "approval",
        label: "Committee Revisions Review — VALID_IN_PART",
        is_start: false,
        position: 19,
        legally_mandated: false,
        config: {
          assignee: ROLE.COMMITTEE_CHAIR,
          allowed_outcomes: ["RESOLVED_IN_PLACE"],
          require_comment_on: ["RESOLVED_IN_PLACE"],
          // No deadline_hours: same Phase 1 no-SLA decision as
          // legal_office_review above.
        } satisfies ApprovalStepConfig,
      },

      // ── 20. RETURNED Review ───────────────────────────────────────────────
      // Reached when panlalawigan_review outcome = RETURNED.
      // Secretariat implementation typically stops. Two options:
      //   REPASS            → document goes back to drafting (end_repassed)
      //   RESOLVED_DIRECTLY → Secretariat implements recommendations directly;
      //                       mandatory comment; workflow continues to publication
      // Source: B4 §6.4; consolidated ref Part 4.3.
      {
        step_key: "returned_review",
        step_type: "approval",
        label: "RETURNED — Secretariat Decision",
        is_start: false,
        position: 20,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["REPASS", "RESOLVED_DIRECTLY"],
          require_comment_on: ["REPASS", "RESOLVED_DIRECTLY"],
        } satisfies ApprovalStepConfig,
      },

      // ── 21. Public Portal Publication ────────────────────────────────────
      // Document title and first page made visible on the public portal.
      // Full copy requires Document Request Form + VM + SP Secretary approval
      // + payment. Source: consolidated ref Parts 4.1, 4.15 [CONFIRMED].
      // The documents module sets document.lifecycle_status = 'Released' on
      // the workflow.step.completed event for this step_key. [Inference]
      {
        step_key: "portal_publication",
        step_type: "action",
        label: "Public Portal Publication",
        is_start: false,
        position: 21,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.document.portal_publication",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 22. Permanent Archive ─────────────────────────────────────────────
      // Records Officer permanently archives the document.
      // SP Resolutions: permanent retention; disposition never authorized.
      // Source: consolidated ref Part 11.7 [CONFIRMED].
      // The documents module sets document.lifecycle_status = 'Archived'. [Inference]
      {
        step_key: "archive",
        step_type: "action",
        label: "Permanent Archive",
        is_start: false,
        position: 22,
        legally_mandated: false,
        config: {
          assignee: ROLE.RECORDS_OFFICER,
          form_key: "form.document.archive",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 23. Final Outcome Check ───────────────────────────────────────────
      // Routes to the correct terminal step based on whether the Panlalawigan
      // outcome was a full approval (VALID, DEEMED_APPROVED) or a resolution
      // of a partial/returned outcome (VALID_IN_PART → resolved, RETURNED →
      // RESOLVED_DIRECTLY). The panlalawigan_outcome context key is written by
      // the engine when panlalawigan_review completes. Source: B4 Appendix B.
      //
      // Condition: panlalawigan_outcome is VALID or DEEMED_APPROVED → TRUE
      //            all other values (VALID_IN_PART, RETURNED) → FALSE
      {
        step_key: "final_outcome_check",
        step_type: "decision",
        label: "Final Outcome Check",
        is_start: false,
        position: 23,
        legally_mandated: false,
        config: {
          condition_expression: JSON.stringify({
            in: [
              { var: "panlalawigan_outcome" },
              ["VALID", "DEEMED_APPROVED"],
            ],
          }),
          true_outcome: "TRUE",
          false_outcome: "FALSE",
        } satisfies DecisionStepConfig,
      },

      // ── TERMINATION STEPS ─────────────────────────────────────────────────

      // T1. Full lifecycle completed; document approved and archived.
      {
        step_key: "end_approved_and_released",
        step_type: "termination",
        label: "Document Approved and Released",
        is_start: false,
        position: 24,
        legally_mandated: false,
        config: {
          outcome_code: "APPROVED_AND_RELEASED",
          final_document_status: "ARCHIVED",
        } satisfies TerminationStepConfig,
      },

      // T2. Panlalawigan returned VALID_IN_PART or RETURNED; Secretariat resolved.
      {
        step_key: "end_valid_in_part_resolved",
        step_type: "termination",
        label: "VALID-IN-PART / RETURNED — Resolved by Secretariat",
        is_start: false,
        position: 25,
        legally_mandated: false,
        config: {
          outcome_code: "VALID_IN_PART_RESOLVED",
          final_document_status: "ARCHIVED",
        } satisfies TerminationStepConfig,
      },

      // T3. Voted down at Second Reading (standard or amended vote).
      {
        step_key: "end_rejected_at_vote",
        step_type: "termination",
        label: "Document Voted Down",
        is_start: false,
        position: 26,
        legally_mandated: false,
        config: {
          outcome_code: "REJECTED_AT_VOTE",
          final_document_status: "CANCELLED",
        } satisfies TerminationStepConfig,
      },

      // T4. Mayor vetoed; SP override vote failed.
      {
        step_key: "end_vetoed_override_failed",
        step_type: "termination",
        label: "Veto Override Failed",
        is_start: false,
        position: 27,
        legally_mandated: false,
        config: {
          outcome_code: "VETOED_OVERRIDE_FAILED",
          final_document_status: "CANCELLED",
        } satisfies TerminationStepConfig,
      },

      // T5. Panlalawigan RETURNED; Secretariat decided to repass.
      // [RESOLVED D3-O-2, D3-O-7 — already decided in the D3 resolution
      // record (ADR-014, ADR-015), propagated into H1 in this conversation.
      // Not a new decision made here.]
      //
      // O-2 (ADR-014): Option C adopted. The original document is superseded
      // (documents.superseded_by + closure_reason set on the original); a new
      // document is created that inherits the original's content. The new
      // document reuses the original's final series number upon its own
      // eventual approval — this required an explicit, scoped amendment to
      // the "final numbers never reused" invariant (consolidated ref Parts
      // 5.2, 11.5, 12), and applies only to this repass case, not generally.
      //
      // O-7 (ADR-015): No distinct Repassed instance status was added. This
      // instance remains Running indefinitely; documents.superseded_by (from
      // O-2) is the sole source of truth for "this instance's document is
      // dead." Accepted tradeoff, not fully eliminated: a Running instance
      // whose document has been superseded reads as misleading if queried
      // without joining to the document's superseded_by field. This is a
      // deliberate decision the team made, not an oversight.
      //
      // final_document_status is therefore still null below — not because
      // the question is unresolved (it now is resolved), but because the
      // resolution explicitly routes lifecycle status through the documents
      // module's superseded_by field rather than through this termination
      // config's final_document_status enum, which only supports RELEASED /
      // ARCHIVED / CANCELLED — none of which correctly describes "superseded
      // by a new document." Setting one of those three here would misstate
      // the resolution rather than honor it.
      {
        step_key: "end_repassed",
        step_type: "termination",
        label: "Document Repassed to Drafting",
        is_start: false,
        position: 28,
        legally_mandated: false,
        config: {
          outcome_code: "REPASSED",
          final_document_status: null,
            // [CONFIRMED — D3-O-2/O-7, not a placeholder] null is now the
            // resolved value, not a TBD. Document lifecycle status for this
            // path lives on documents.superseded_by, set by the documents
            // module on workflow.instance.repassed, not on this field.
          emit_event: "workflow.instance.repassed",
            // Engine emits this; documents module subscribes and sets
            // superseded_by + closure_reason on the original document, then
            // creates the new document per O-2.
        } satisfies TerminationStepConfig,
      },

    ],

    // =========================================================================
    // TRANSITION RULES
    // =========================================================================
    transition_rules: [
      // intake_logging → order_of_business_scheduling
      { from_step_key: "intake_logging", to_step_key: "order_of_business_scheduling",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // order_of_business_scheduling → first_reading
      { from_step_key: "order_of_business_scheduling", to_step_key: "first_reading",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // first_reading → committee_referral
      { from_step_key: "first_reading", to_step_key: "committee_referral",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // committee_referral → second_reading_vote (three exit outcomes; same target)
      { from_step_key: "committee_referral", to_step_key: "second_reading_vote",
        outcome_filter: "REPORT_ACCEPTED", condition_expression: null, priority: 1,
        label: "Committee report accepted by SP Secretary" },
      { from_step_key: "committee_referral", to_step_key: "second_reading_vote",
        outcome_filter: "SECRETARY_ADVANCED", condition_expression: null, priority: 2,
        label: "SP Secretary manually advanced (mandatory comment; audit-logged)" },
      // REQUIRED: B4 §6.1 and Engine Invariant §8.1 item 3.
      // The admin UI must enforce that this transition rule exists when the
      // definition is published.
      { from_step_key: "committee_referral", to_step_key: "second_reading_vote",
        outcome_filter: "BYPASSED_CERTIFIED_URGENT", condition_expression: null, priority: 3,
        label: "Certified Urgent bypass — Mayor issued formal Certification of Urgency" },

      // second_reading_vote branching
      { from_step_key: "second_reading_vote", to_step_key: "final_number_assignment",
        outcome_filter: "APPROVED", condition_expression: null, priority: 1,
        label: "Approved — no amendments" },
      { from_step_key: "second_reading_vote", to_step_key: "amendments_logging",
        outcome_filter: "RETURNED_FOR_REVISION", condition_expression: null, priority: 2,
        label: "Approved with amendments — Secretariat to log" },
      { from_step_key: "second_reading_vote", to_step_key: "end_rejected_at_vote",
        outcome_filter: "REJECTED", condition_expression: null, priority: 3,
        label: "Voted down" },

      // amendments_logging → second_reading_amended_vote
      { from_step_key: "amendments_logging", to_step_key: "second_reading_amended_vote",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // second_reading_amended_vote branching
      { from_step_key: "second_reading_amended_vote", to_step_key: "final_number_assignment",
        outcome_filter: "APPROVED", condition_expression: null, priority: 1,
        label: "Amended version approved" },
      { from_step_key: "second_reading_amended_vote", to_step_key: "end_rejected_at_vote",
        outcome_filter: "REJECTED", condition_expression: null, priority: 2,
        label: "Amended version voted down" },

      // final_number_assignment → vp_certification
      { from_step_key: "final_number_assignment", to_step_key: "vp_certification",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // vp_certification → transmittal_letter_to_mayor
      { from_step_key: "vp_certification", to_step_key: "transmittal_letter_to_mayor",
        outcome_filter: "SIGNED", condition_expression: null, priority: 1,
        label: "Vice Mayor signed certified copy" },

      // transmittal_letter_to_mayor → mayor_review
      { from_step_key: "transmittal_letter_to_mayor", to_step_key: "mayor_review",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // mayor_review branching
      { from_step_key: "mayor_review", to_step_key: "docketing",
        outcome_filter: "SIGNED", condition_expression: null, priority: 1,
        label: "Mayor signed" },
      { from_step_key: "mayor_review", to_step_key: "docketing",
        outcome_filter: "LAPSED", condition_expression: null, priority: 2,
        label: "Lapsed into law — RA 7160 §47 — same path as signed" },
      { from_step_key: "mayor_review", to_step_key: "veto_override_vote",
        outcome_filter: "VETOED", condition_expression: null, priority: 3,
        label: "Mayor vetoed" },

      // veto_override_vote branching
      { from_step_key: "veto_override_vote", to_step_key: "docketing",
        outcome_filter: "OVERRIDE_SUCCEEDED", condition_expression: null, priority: 1,
        label: "Override succeeded — 8 of 12 voted" },
      { from_step_key: "veto_override_vote", to_step_key: "end_vetoed_override_failed",
        outcome_filter: "OVERRIDE_FAILED", condition_expression: null, priority: 2,
        label: "Override failed" },

      // docketing → panlalawigan_transmission_logging
      { from_step_key: "docketing", to_step_key: "panlalawigan_transmission_logging",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // panlalawigan_transmission_logging → panlalawigan_review
      { from_step_key: "panlalawigan_transmission_logging", to_step_key: "panlalawigan_review",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // panlalawigan_review branching
      { from_step_key: "panlalawigan_review", to_step_key: "portal_publication",
        outcome_filter: "VALID", condition_expression: null, priority: 1, label: null },
      { from_step_key: "panlalawigan_review", to_step_key: "portal_publication",
        outcome_filter: "DEEMED_APPROVED", condition_expression: null, priority: 2,
        label: "Deemed approved — RA 7160 §56(d) — 30 days elapsed" },
      { from_step_key: "panlalawigan_review", to_step_key: "valid_in_part_action",
        outcome_filter: "VALID_IN_PART", condition_expression: null, priority: 3, label: null },
      { from_step_key: "panlalawigan_review", to_step_key: "returned_review",
        outcome_filter: "RETURNED", condition_expression: null, priority: 4,
        label: "Returned with objections" },

      // valid_in_part_action → valid_in_part_decision
      { from_step_key: "valid_in_part_action", to_step_key: "valid_in_part_decision",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // valid_in_part_decision branching
      { from_step_key: "valid_in_part_decision", to_step_key: "portal_publication",
        outcome_filter: "RESOLVED_IN_PLACE", condition_expression: null, priority: 1,
        label: "Resolved as-is — mandatory comment" },
      { from_step_key: "valid_in_part_decision", to_step_key: "legal_office_review",
        outcome_filter: "ROUTED_TO_LEGAL", condition_expression: null, priority: 2, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "committee_revisions_review",
        outcome_filter: "ROUTED_TO_COMMITTEE", condition_expression: null, priority: 3, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "portal_publication",
        outcome_filter: "REVISED_DIRECTLY", condition_expression: null, priority: 4,
        label: "Secretariat implements revisions — mandatory comment" },

      // legal_office_review → portal_publication
      // [UPDATED — H1-X-3 resolution] outcome_filter changed from null to
      // "RESOLVED_IN_PLACE": the step is now an approval step with a defined
      // outcome vocabulary (see step 18 above), not an unconditional action.
      { from_step_key: "legal_office_review", to_step_key: "portal_publication",
        outcome_filter: "RESOLVED_IN_PLACE", condition_expression: null, priority: 1,
        label: "Legal Officer's recommendation logged; continue to publication" },

      // committee_revisions_review → portal_publication
      // [UPDATED — H1-X-3 resolution] outcome_filter changed from null to
      // "RESOLVED_IN_PLACE": the step is now an approval step with a defined
      // outcome vocabulary (see step 19 above), not an unconditional action.
      { from_step_key: "committee_revisions_review", to_step_key: "portal_publication",
        outcome_filter: "RESOLVED_IN_PLACE", condition_expression: null, priority: 1,
        label: "Committee Chair's recommendation logged; continue to publication" },

      // returned_review branching
      { from_step_key: "returned_review", to_step_key: "portal_publication",
        outcome_filter: "RESOLVED_DIRECTLY", condition_expression: null, priority: 1,
        label: "Secretariat implements Panlalawigan recommendations — mandatory comment" },
      { from_step_key: "returned_review", to_step_key: "end_repassed",
        outcome_filter: "REPASS", condition_expression: null, priority: 2,
        label: "Document returned to drafting — mandatory comment" },

      // portal_publication → archive
      { from_step_key: "portal_publication", to_step_key: "archive",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // archive → final_outcome_check
      { from_step_key: "archive", to_step_key: "final_outcome_check",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // final_outcome_check → terminal steps
      { from_step_key: "final_outcome_check", to_step_key: "end_approved_and_released",
        outcome_filter: "TRUE", condition_expression: null, priority: 1,
        label: "panlalawigan_outcome ∈ {VALID, DEEMED_APPROVED}" },
      { from_step_key: "final_outcome_check", to_step_key: "end_valid_in_part_resolved",
        outcome_filter: "FALSE", condition_expression: null, priority: 2,
        label: "panlalawigan_outcome ∈ {VALID_IN_PART, RETURNED}" },
    ],
  },
};
```

---

## 6. SP Ordinance — Workflow Definition

### 6.1 Process Notes

Differences from SP Resolution:

- **Three readings** (First, Second, Third). Amendments logged at Second Reading; Third Reading reads the final amended version. Source: consolidated ref Part 4.2.
- Final series number assigned **after Third Reading vote**, before VP signs. Source: consolidated ref Parts 5.1, 5.2.
- **Newspaper publication required if penalty clause.** SP Secretariat arranges with Ilocos Times. Publication date is a mandatory tracked field. Source: consolidated ref Parts 4.2, 5.3.
- `publication_check` decision step reads `instance.context.requires_publication`. [CONFIRMED — gap, this conversation] The engine does not yet write this key from document metadata at instance creation; this must be implemented before SP Ordinance can ship. See H1-X-2. Source: B4 Appendix B lists the key but does not define the write mechanism.
- `panlalawigan_review` allowed outcomes are the same as Resolution. `OPERATIVE_IN_ITS_ENTIRETY` is **not** an allowed outcome for regular SP Ordinances.

### 6.2 Steps (delta from SP Resolution)

Steps identical to SP Resolution are not relisted. Only differences are shown.

|Change|step_key|Notes|
|---|---|---|
|REPLACED|`second_reading_amended_vote`|Renamed to `third_reading_vote` with different label and routing (no longer a fallback vote — it is the mandatory Third Reading for all ordinances)|
|REMOVED|`second_reading_vote` APPROVED → `final_number_assignment`|Now APPROVED → `third_reading_vote`|
|REMOVED|`amendments_logging` → `second_reading_amended_vote`|Now → `third_reading_vote`|
|ADDED|`publication_check` (decision)|After Panlalawigan resolved; checks `requires_publication`|
|ADDED|`newspaper_publication` (action)|Conditional; SP Secretariat arranges; records publication date|
|MODIFIED|All Panlalawigan paths that fed → `portal_publication`|Now feed → `publication_check` instead|

Full step list for SP Ordinance (28 steps, same count as SP Resolution because `second_reading_amended_vote` becomes `third_reading_vote` and `final_outcome_check` gains `publication_check`/`newspaper_publication` at positions 23–24):

|#|step_key|Differs from Resolution?|
|---|---|---|
|1–4|Same as Resolution|—|
|5|`second_reading_vote` (APPROVED → `third_reading_vote`; RETURNED_FOR_REVISION → `amendments_logging`)|**Modified transitions**|
|6|`amendments_logging` (→ `third_reading_vote`)|**Modified transition target**|
|7|**`third_reading_vote`** (replaces `second_reading_amended_vote`)|**New step**|
|8–22|Same as Resolution|—|
|23|**`publication_check`** decision|**New step**|
|24|**`newspaper_publication`** action|**New step**|
|25|`portal_publication`|Same (receives from `publication_check` FALSE or `newspaper_publication`)|
|26–30|Same as Resolution (archive, final_outcome_check, terminations)|—|

### 6.3 TypeScript Constant

```typescript
export const SP_ORDINANCE_WORKFLOW: WorkflowDefinitionSeed = {
  definition: {
    name: "SP Ordinance — 7th Sangguniang Panlungsod",
    description:
      "Full legislative lifecycle for SP Ordinances (RA 7160 Chapter 2, Section 54). " +
      "Three readings. Amendments at Second Reading; Third Reading reads final amended version. " +
      "Mayor 10-day review (RA 7160 §47). Panlalawigan 30-day review (RA 7160 §56(d)). " +
      "Newspaper publication required if penalty clause; SP Secretariat arranges with Ilocos Times. " +
      "Certified Urgent bypass via engine event handler. VALID_IN_PART and RETURNED paths per B4 §6.4.",
    document_type_code: "sp_ordinance",
    is_active: true,
  },

  version: {
    version_number: 1,
    steps: [

      // Steps 1–4 are identical to SP Resolution.
      // Only the config.form_key differs (sp_ordinance prefix).
      {
        step_key: "intake_logging",
        step_type: "action",
        label: "Secretariat Intake and Logging",
        is_start: true,
        position: 1,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.sp_ordinance.intake",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },
      {
        step_key: "order_of_business_scheduling",
        step_type: "action",
        label: "Order of Business Scheduling",
        is_start: false,
        position: 2,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: "form.sp_ordinance.order_of_business",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },
      {
        step_key: "first_reading",
        step_type: "action",
        label: "First Reading — SP Session",
        is_start: false,
        position: 3,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: "form.sp_ordinance.first_reading",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },
      {
        // Same committee referral step. Certified Urgent bypass applies here too.
        step_key: "committee_referral",
        step_type: "multi_referral",
        label: "Committee Referral and Hearing",
        is_start: false,
        position: 4,
        legally_mandated: true,
        config: {
          default_committee_roles: [ROLE.COMMITTEE_LAWS],
          report_acceptor_role: ROLE.SP_SECRETARY,
          thursday_cutoff_enabled: true,
          cutoff_time_pht: "23:59:59",
          require_all_committee_signatures: true,
          allow_secretary_advance: true,
        } satisfies MultiReferralStepConfig,
      },

      // ── 5. Second Reading Vote ─────────────────────────────────────────────
      // Key difference: APPROVED routes to third_reading_vote, not
      // final_number_assignment. Third Reading is mandatory for all ordinances
      // regardless of whether amendments were made at Second Reading.
      // Source: consolidated ref Part 4.2 [CONFIRMED — Interview 2].
      {
        step_key: "second_reading_vote",
        step_type: "approval",
        label: "Second Reading — Debate and Vote",
        is_start: false,
        position: 5,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["APPROVED", "RETURNED_FOR_REVISION", "REJECTED"],
          require_comment_on: ["REJECTED"],
        } satisfies ApprovalStepConfig,
      },

      // ── 6. Amendments Logging ─────────────────────────────────────────────
      // Secretariat logs amendments made at Second Reading and prepares the
      // final copy. Routes to Third Reading (not a separate amended vote as
      // in SP Resolution). Source: consolidated ref Part 4.2.
      {
        step_key: "amendments_logging",
        step_type: "action",
        label: "Amendments Logging — Second Reading",
        is_start: false,
        position: 6,
        legally_mandated: false,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.sp_ordinance.amendments_logging",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },

      // ── 7. Third Reading Vote ─────────────────────────────────────────────
      // Final reading and vote. Third Reading reads the final version (with or
      // without amendments; both paths arrive here).
      // Source: consolidated ref Part 4.2 [CONFIRMED — Interview 2].
      {
        step_key: "third_reading_vote",
        step_type: "approval",
        label: "Third Reading — Final Vote",
        is_start: false,
        position: 7,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["APPROVED", "REJECTED"],
          require_comment_on: ["REJECTED"],
        } satisfies ApprovalStepConfig,
      },

      // Steps 8–22: Identical to SP Resolution (different form_key prefix where applicable)
      {
        step_key: "final_number_assignment",
        step_type: "action",
        label: "Final Series Number Assignment",
        is_start: false,
        position: 8,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: "form.document.final_number_assignment",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },
      {
        step_key: "vp_certification",
        step_type: "approval",
        label: "Vice Mayor Signs Certified Copy",
        is_start: false,
        position: 9,
        legally_mandated: true,
        config: {
          assignee: ROLE.VICE_MAYOR,
          allowed_outcomes: ["SIGNED"],
          require_comment_on: [],
        } satisfies ApprovalStepConfig,
      },
      {
        step_key: "transmittal_letter_to_mayor",
        step_type: "action",
        label: "Transmittal Letter to Mayor",
        is_start: false,
        position: 10,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.document.transmittal_letter_to_mayor",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
          triggers_mayor_lapse_timer: true,  // [Extension]
        } satisfies ActionStepConfig,
      },
      {
        step_key: "mayor_review",
        step_type: "approval",
        label: "Mayor Review — 10-Day Window",
        is_start: false,
        position: 11,
        legally_mandated: true,
        config: {
          assignee: ROLE.MAYOR,
          allowed_outcomes: ["SIGNED", "VETOED", "LAPSED"],
          require_comment_on: ["VETOED"],
        } satisfies ApprovalStepConfig,
      },
      {
        step_key: "veto_override_vote",
        step_type: "approval",
        label: "Veto Override Vote",
        is_start: false,
        position: 12,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["OVERRIDE_SUCCEEDED", "OVERRIDE_FAILED"],
          require_comment_on: [],
        } satisfies ApprovalStepConfig,
      },
      {
        step_key: "docketing",
        step_type: "action",
        label: "Docketing",
        is_start: false,
        position: 13,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.document.docketing",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },
      {
        step_key: "panlalawigan_transmission_logging",
        step_type: "action",
        label: "Panlalawigan Transmission Logging",
        is_start: false,
        position: 14,
        legally_mandated: false,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.panlalawigan.transmission_logging",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
          triggers_panlalawigan_timer: true,  // [Extension]
        } satisfies ActionStepConfig,
      },
      {
        step_key: "panlalawigan_review",
        step_type: "approval",
        label: "Sangguniang Panlalawigan Review — 30-Day Window",
        is_start: false,
        position: 15,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          // OPERATIVE_IN_ITS_ENTIRETY is NOT included here — it applies only
          // to Appropriation Ordinances. Source: consolidated ref Part 4.3.
          allowed_outcomes: ["VALID", "VALID_IN_PART", "RETURNED", "DEEMED_APPROVED"],
          require_comment_on: ["VALID_IN_PART", "RETURNED"],
        } satisfies ApprovalStepConfig,
      },
      {
        step_key: "valid_in_part_action",
        step_type: "action",
        label: "VALID-IN-PART — Secretary Documentation",
        is_start: false,
        position: 16,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: "form.panlalawigan.valid_in_part_action",
          require_comment: true,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },
      {
        step_key: "valid_in_part_decision",
        step_type: "approval",
        label: "VALID-IN-PART — Secretary Selects Resolution Path",
        is_start: false,
        position: 17,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: [
            "RESOLVED_IN_PLACE",
            "ROUTED_TO_LEGAL",
            "ROUTED_TO_COMMITTEE",
            "REVISED_DIRECTLY",
          ],
          require_comment_on: ["RESOLVED_IN_PLACE", "REVISED_DIRECTLY"],
        } satisfies ApprovalStepConfig,
      },
      // [RESOLVED H1-X-3 — same resolution as SP Resolution §5.5 step 18;
      // full rationale there, not repeated here]
      {
        step_key: "legal_office_review",
        step_type: "approval",
        label: "Legal Office Review — VALID_IN_PART",
        is_start: false,
        position: 18,
        legally_mandated: false,
        config: {
          assignee: ROLE.LEGAL_OFFICER,
          allowed_outcomes: ["RESOLVED_IN_PLACE"],
          require_comment_on: ["RESOLVED_IN_PLACE"],
        } satisfies ApprovalStepConfig,
      },
      // [RESOLVED H1-X-3 — same resolution as SP Resolution §5.5 step 19;
      // full rationale there, not repeated here. ROLE.COMMITTEE_CHAIR is the
      // same new [Extension] role key introduced there — see §4.]
      {
        step_key: "committee_revisions_review",
        step_type: "approval",
        label: "Committee Revisions Review — VALID_IN_PART",
        is_start: false,
        position: 19,
        legally_mandated: false,
        config: {
          assignee: ROLE.COMMITTEE_CHAIR,
          allowed_outcomes: ["RESOLVED_IN_PLACE"],
          require_comment_on: ["RESOLVED_IN_PLACE"],
        } satisfies ApprovalStepConfig,
      },
      {
        step_key: "returned_review",
        step_type: "approval",
        label: "RETURNED — Secretariat Decision",
        is_start: false,
        position: 20,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["REPASS", "RESOLVED_DIRECTLY"],
          require_comment_on: ["REPASS", "RESOLVED_DIRECTLY"],
        } satisfies ApprovalStepConfig,
      },

      // ── 21. Publication Check ─────────────────────────────────────────────
      // Evaluates instance.context.requires_publication (boolean: whether the
      // ordinance has a penalty clause). Source: B4 Appendix B; consolidated
      // ref Parts 4.2, 5.3.
      // [RESOLVED H1-X-2 — this conversation] CONFIRMED GAP, not yet built:
      // the engine does not currently write requires_publication from
      // document metadata at instance creation. This decision config has
      // nothing to read until that write path is implemented. Blocking for
      // SP Ordinance specifically — Resolution and Appropriation Ordinance
      // do not use this key (Appropriation Ordinance hardcodes the value to
      // false at the document-type level instead; see §7.1).
      // Ordinances WITH penalty → newspaper_publication (TRUE)
      // Ordinances WITHOUT penalty → portal_publication (FALSE)
      {
        step_key: "publication_check",
        step_type: "decision",
        label: "Publication Check — Penalty Clause?",
        is_start: false,
        position: 21,
        legally_mandated: false,
        config: {
          condition_expression: JSON.stringify({
            "==": [{ var: "requires_publication" }, true],
          }),
          true_outcome: "TRUE",
          false_outcome: "FALSE",
        } satisfies DecisionStepConfig,
      },

      // ── 22. Newspaper Publication ─────────────────────────────────────────
      // Conditional. Only reached when requires_publication = true.
      // SP Secretariat arranges placement with Ilocos Times.
      // Publication date is a mandatory tracked field.
      // Source: consolidated ref Parts 4.2, 5.3 [CONFIRMED; RESOLVES Q-C04].
      {
        step_key: "newspaper_publication",
        step_type: "action",
        label: "Newspaper Publication — Ilocos Times",
        is_start: false,
        position: 22,
        legally_mandated: false,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.sp_ordinance.newspaper_publication",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
          // Form captures: publication_date (mandatory), newspaper name.
          // These are written to context by the documents module.
          // Source: consolidated ref Part 5.3.
        } satisfies ActionStepConfig,
      },

      // Steps 23–30: Identical to SP Resolution
      {
        step_key: "portal_publication",
        step_type: "action",
        label: "Public Portal Publication",
        is_start: false,
        position: 23,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.document.portal_publication",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },
      {
        step_key: "archive",
        step_type: "action",
        label: "Permanent Archive",
        is_start: false,
        position: 24,
        legally_mandated: false,
        config: {
          assignee: ROLE.RECORDS_OFFICER,
          form_key: "form.document.archive",
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        } satisfies ActionStepConfig,
      },
      {
        step_key: "final_outcome_check",
        step_type: "decision",
        label: "Final Outcome Check",
        is_start: false,
        position: 25,
        legally_mandated: false,
        config: {
          condition_expression: JSON.stringify({
            in: [{ var: "panlalawigan_outcome" }, ["VALID", "DEEMED_APPROVED"]],
          }),
          true_outcome: "TRUE",
          false_outcome: "FALSE",
        } satisfies DecisionStepConfig,
      },
      {
        step_key: "end_approved_and_released",
        step_type: "termination",
        label: "Document Approved and Released",
        is_start: false,
        position: 26,
        legally_mandated: false,
        config: { outcome_code: "APPROVED_AND_RELEASED", final_document_status: "ARCHIVED" } satisfies TerminationStepConfig,
      },
      {
        step_key: "end_valid_in_part_resolved",
        step_type: "termination",
        label: "VALID-IN-PART / RETURNED — Resolved by Secretariat",
        is_start: false,
        position: 27,
        legally_mandated: false,
        config: { outcome_code: "VALID_IN_PART_RESOLVED", final_document_status: "ARCHIVED" } satisfies TerminationStepConfig,
      },
      {
        step_key: "end_rejected_at_vote",
        step_type: "termination",
        label: "Document Voted Down",
        is_start: false,
        position: 28,
        legally_mandated: false,
        config: { outcome_code: "REJECTED_AT_VOTE", final_document_status: "CANCELLED" } satisfies TerminationStepConfig,
      },
      {
        step_key: "end_vetoed_override_failed",
        step_type: "termination",
        label: "Veto Override Failed",
        is_start: false,
        position: 29,
        legally_mandated: false,
        config: { outcome_code: "VETOED_OVERRIDE_FAILED", final_document_status: "CANCELLED" } satisfies TerminationStepConfig,
      },
      {
        step_key: "end_repassed",
        step_type: "termination",
        label: "Document Repassed to Drafting",
        is_start: false,
        position: 30,
        legally_mandated: false,
        // [RESOLVED D3-O-2, D3-O-7 — same resolution as SP Resolution §5.5;
        // full rationale there, not repeated here]
        config: { outcome_code: "REPASSED", final_document_status: null,
          emit_event: "workflow.instance.repassed" } satisfies TerminationStepConfig,
      },

    ],

    transition_rules: [
      // Identical to Resolution rules 1–6
      { from_step_key: "intake_logging", to_step_key: "order_of_business_scheduling",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "order_of_business_scheduling", to_step_key: "first_reading",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "first_reading", to_step_key: "committee_referral",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "committee_referral", to_step_key: "second_reading_vote",
        outcome_filter: "REPORT_ACCEPTED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "committee_referral", to_step_key: "second_reading_vote",
        outcome_filter: "SECRETARY_ADVANCED", condition_expression: null, priority: 2, label: null },
      { from_step_key: "committee_referral", to_step_key: "second_reading_vote",
        outcome_filter: "BYPASSED_CERTIFIED_URGENT", condition_expression: null, priority: 3,
        label: "Certified Urgent bypass — required by B4 §6.1" },

      // second_reading_vote — APPROVED now routes to third_reading_vote
      { from_step_key: "second_reading_vote", to_step_key: "third_reading_vote",
        outcome_filter: "APPROVED", condition_expression: null, priority: 1,
        label: "No amendments — proceed to Third Reading" },
      { from_step_key: "second_reading_vote", to_step_key: "amendments_logging",
        outcome_filter: "RETURNED_FOR_REVISION", condition_expression: null, priority: 2,
        label: "Amendments made — Secretariat to log before Third Reading" },
      { from_step_key: "second_reading_vote", to_step_key: "end_rejected_at_vote",
        outcome_filter: "REJECTED", condition_expression: null, priority: 3, label: null },

      // amendments_logging → third_reading_vote (not second_reading_amended_vote)
      { from_step_key: "amendments_logging", to_step_key: "third_reading_vote",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // third_reading_vote
      { from_step_key: "third_reading_vote", to_step_key: "final_number_assignment",
        outcome_filter: "APPROVED", condition_expression: null, priority: 1,
        label: "Third Reading approved" },
      { from_step_key: "third_reading_vote", to_step_key: "end_rejected_at_vote",
        outcome_filter: "REJECTED", condition_expression: null, priority: 2,
        label: "Third Reading voted down" },

      // Identical to Resolution rules 13–26
      { from_step_key: "final_number_assignment", to_step_key: "vp_certification",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "vp_certification", to_step_key: "transmittal_letter_to_mayor",
        outcome_filter: "SIGNED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "transmittal_letter_to_mayor", to_step_key: "mayor_review",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "mayor_review", to_step_key: "docketing",
        outcome_filter: "SIGNED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "mayor_review", to_step_key: "docketing",
        outcome_filter: "LAPSED", condition_expression: null, priority: 2,
        label: "Lapsed into law — RA 7160 §47" },
      { from_step_key: "mayor_review", to_step_key: "veto_override_vote",
        outcome_filter: "VETOED", condition_expression: null, priority: 3, label: null },
      { from_step_key: "veto_override_vote", to_step_key: "docketing",
        outcome_filter: "OVERRIDE_SUCCEEDED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "veto_override_vote", to_step_key: "end_vetoed_override_failed",
        outcome_filter: "OVERRIDE_FAILED", condition_expression: null, priority: 2, label: null },
      { from_step_key: "docketing", to_step_key: "panlalawigan_transmission_logging",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "panlalawigan_transmission_logging", to_step_key: "panlalawigan_review",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // panlalawigan_review — VALID and DEEMED_APPROVED now route to publication_check
      { from_step_key: "panlalawigan_review", to_step_key: "publication_check",
        outcome_filter: "VALID", condition_expression: null, priority: 1, label: null },
      { from_step_key: "panlalawigan_review", to_step_key: "publication_check",
        outcome_filter: "DEEMED_APPROVED", condition_expression: null, priority: 2,
        label: "Deemed approved — RA 7160 §56(d)" },
      { from_step_key: "panlalawigan_review", to_step_key: "valid_in_part_action",
        outcome_filter: "VALID_IN_PART", condition_expression: null, priority: 3, label: null },
      { from_step_key: "panlalawigan_review", to_step_key: "returned_review",
        outcome_filter: "RETURNED", condition_expression: null, priority: 4, label: null },

      // valid_in_part paths — now route to publication_check (not portal_publication)
      { from_step_key: "valid_in_part_action", to_step_key: "valid_in_part_decision",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "publication_check",
        outcome_filter: "RESOLVED_IN_PLACE", condition_expression: null, priority: 1, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "legal_office_review",
        outcome_filter: "ROUTED_TO_LEGAL", condition_expression: null, priority: 2, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "committee_revisions_review",
        outcome_filter: "ROUTED_TO_COMMITTEE", condition_expression: null, priority: 3, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "publication_check",
        outcome_filter: "REVISED_DIRECTLY", condition_expression: null, priority: 4, label: null },
      { from_step_key: "legal_office_review", to_step_key: "publication_check",
        outcome_filter: "RESOLVED_IN_PLACE", condition_expression: null, priority: 1, label: null },
      { from_step_key: "committee_revisions_review", to_step_key: "publication_check",
        outcome_filter: "RESOLVED_IN_PLACE", condition_expression: null, priority: 1, label: null },
      { from_step_key: "returned_review", to_step_key: "publication_check",
        outcome_filter: "RESOLVED_DIRECTLY", condition_expression: null, priority: 1, label: null },
      { from_step_key: "returned_review", to_step_key: "end_repassed",
        outcome_filter: "REPASS", condition_expression: null, priority: 2, label: null },

      // publication_check branching
      { from_step_key: "publication_check", to_step_key: "newspaper_publication",
        outcome_filter: "TRUE", condition_expression: null, priority: 1,
        label: "Penalty clause — newspaper publication required" },
      { from_step_key: "publication_check", to_step_key: "portal_publication",
        outcome_filter: "FALSE", condition_expression: null, priority: 2,
        label: "No penalty clause — portal only" },

      // newspaper_publication → portal_publication
      { from_step_key: "newspaper_publication", to_step_key: "portal_publication",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // Identical to Resolution rules 36–39
      { from_step_key: "portal_publication", to_step_key: "archive",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "archive", to_step_key: "final_outcome_check",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "final_outcome_check", to_step_key: "end_approved_and_released",
        outcome_filter: "TRUE", condition_expression: null, priority: 1,
        label: "panlalawigan_outcome ∈ {VALID, DEEMED_APPROVED}" },
      { from_step_key: "final_outcome_check", to_step_key: "end_valid_in_part_resolved",
        outcome_filter: "FALSE", condition_expression: null, priority: 2,
        label: "panlalawigan_outcome ∈ {VALID_IN_PART, RETURNED}" },
    ],
  },
};
```

### 6.4 Step Flow Diagram

```mermaid
flowchart TD
    classDef action fill:#dbeafe,stroke:#1d4ed8,color:#1e3a5f
    classDef approval fill:#d1fae5,stroke:#065f46,color:#064e3b
    classDef multi_ref fill:#fef3c7,stroke:#b45309,color:#451a03
    classDef decision fill:#f3e8ff,stroke:#6b21a8,color:#3b0764
    classDef term fill:#fee2e2,stroke:#991b1b,color:#7f1d1d

    IL["⚖ intake_logging"]:::action --> OB["order_of_business_scheduling"]:::action
    OB --> FR["⚖ first_reading"]:::action
    FR --> CR{{"⚖ committee_referral\nmulti_referral"}}:::multi_ref
    CR -->|"REPORT_ACCEPTED / SECRETARY_ADVANCED\nBYPASSED_CERTIFIED_URGENT"| SR2

    SR2{["⚖ second_reading_vote"]}:::approval
    SR2 -->|"APPROVED"| TR
    SR2 -->|"RETURNED_FOR_REVISION"| AL["amendments_logging"]:::action
    SR2 -->|"REJECTED"| ERV

    AL --> TR{["⚖ third_reading_vote"]}:::approval
    TR -->|"APPROVED"| FN["⚖ final_number_assignment"]:::action
    TR -->|"REJECTED"| ERV

    FN --> VPC{["⚖ vp_certification"]}:::approval
    VPC -->|"SIGNED"| TLM["⚖ ⏱ transmittal_letter_to_mayor"]:::action
    TLM --> MR{["⚖ mayor_review ⏱10d"]}:::approval
    MR -->|"SIGNED / LAPSED"| DOCK["⚖ docketing"]:::action
    MR -->|"VETOED"| VOV{["veto_override_vote"]}:::approval
    VOV -->|"OVERRIDE_SUCCEEDED"| DOCK
    VOV -->|"OVERRIDE_FAILED"| EVOF

    DOCK --> PTL["⏱ panlalawigan_transmission_logging"]:::action
    PTL --> PR{["⚖ panlalawigan_review ⏱30d"]}:::approval

    PR -->|"VALID / DEEMED_APPROVED"| PUB
    PR -->|"VALID_IN_PART"| VIA["valid_in_part_action"]:::action
    PR -->|"RETURNED"| RR

    VIA --> VID{["valid_in_part_decision"]}:::approval
    VID -->|"RESOLVED_IN_PLACE / REVISED_DIRECTLY"| PUB
    VID -->|"ROUTED_TO_LEGAL"| LOR{["legal_office_review\napproval"]}:::approval
    VID -->|"ROUTED_TO_COMMITTEE"| CRR{["committee_revisions_review\napproval"]}:::approval
    LOR -->|"RESOLVED_IN_PLACE"| PUB
    CRR -->|"RESOLVED_IN_PLACE"| PUB

    RR{["returned_review"]}:::approval
    RR -->|"RESOLVED_DIRECTLY"| PUB
    RR -->|"REPASS"| EREP

    PUB{"publication_check\ndecision"}:::decision
    PUB -->|"TRUE\npenalty clause"| NP["newspaper_publication"]:::action
    PUB -->|"FALSE\nno penalty"| PP["⚖ portal_publication"]:::action
    NP --> PP

    PP --> ARC["archive"]:::action
    ARC --> FOC{"final_outcome_check\ndecision"}:::decision
    FOC -->|"TRUE"| EAAR(["✓ end_approved_and_released"]):::term
    FOC -->|"FALSE"| EVIP(["✓ end_valid_in_part_resolved"]):::term

    ERV(["✗ end_rejected_at_vote"]):::term
    EVOF(["✗ end_vetoed_override_failed"]):::term
    EREP(["↺ end_repassed"]):::term
```

---

## 7. Appropriation Ordinance — Workflow Definition

### 7.1 Process Notes

Differences from SP Ordinance:

- **No newspaper publication.** Appropriation Ordinances have no penalty clause. `requires_publication` is always `false` at instance creation. The `publication_check` and `newspaper_publication` steps are omitted. Source: consolidated ref Part 4.2.
- **`OPERATIVE_IN_ITS_ENTIRETY`** is an additional allowed outcome at `panlalawigan_review`. Specific to Appropriation Ordinances; means "valid and implementable." Treatment is identical to VALID. Source: consolidated ref Parts 4.2, 4.3.
- `final_outcome_check` condition extended to include `OPERATIVE_IN_ITS_ENTIRETY` in the TRUE branch.

All other steps and transitions are identical to SP Ordinance.

### 7.2 TypeScript Constant

```typescript
export const APPROPRIATION_ORDINANCE_WORKFLOW: WorkflowDefinitionSeed = {
  definition: {
    name: "Appropriation Ordinance — 7th Sangguniang Panlungsod",
    description:
      "Full legislative lifecycle for Appropriation Ordinances (RA 7160 Chapter 2). " +
      "Same flow as SP Ordinance. Key differences: " +
      "(1) No newspaper publication — appropriation ordinances carry no penalty clause. " +
      "(2) Panlalawigan may return OPERATIVE_IN_ITS_ENTIRETY instead of VALID — treated identically. " +
      "'Operative in its entirety' = synonymous with VALID; document may be implemented. " +
      "Source: consolidated ref Part 4.2 [CONFIRMED — Interview 2]. " +
      "Supplemental Appropriation Ordinances follow the same flow.",
    document_type_code: "appropriation_ordinance",
    is_active: true,
  },

  version: {
    version_number: 1,

    steps: [
      // Steps 1–14: Identical to SP Ordinance (only form_key prefix differs)
      {
        step_key: "intake_logging", step_type: "action", label: "Secretariat Intake and Logging",
        is_start: true, position: 1, legally_mandated: true,
        config: { assignee: ROLE.SECRETARIAT_STAFF, form_key: "form.appropriation_ordinance.intake",
          require_comment: false, allow_comment: true, auto_complete: false } satisfies ActionStepConfig,
      },
      {
        step_key: "order_of_business_scheduling", step_type: "action", label: "Order of Business Scheduling",
        is_start: false, position: 2, legally_mandated: false,
        config: { assignee: ROLE.SP_SECRETARY, form_key: "form.appropriation_ordinance.order_of_business",
          require_comment: false, allow_comment: true, auto_complete: false } satisfies ActionStepConfig,
      },
      {
        step_key: "first_reading", step_type: "action", label: "First Reading — SP Session",
        is_start: false, position: 3, legally_mandated: true,
        config: { assignee: ROLE.SP_SECRETARY, form_key: "form.appropriation_ordinance.first_reading",
          require_comment: false, allow_comment: true, auto_complete: false } satisfies ActionStepConfig,
      },
      {
        step_key: "committee_referral", step_type: "multi_referral", label: "Committee Referral and Hearing",
        is_start: false, position: 4, legally_mandated: true,
        config: { default_committee_roles: [ROLE.COMMITTEE_LAWS], report_acceptor_role: ROLE.SP_SECRETARY,
          thursday_cutoff_enabled: true, cutoff_time_pht: "23:59:59",
          require_all_committee_signatures: true, allow_secretary_advance: true } satisfies MultiReferralStepConfig,
      },
      {
        step_key: "second_reading_vote", step_type: "approval", label: "Second Reading — Debate and Vote",
        is_start: false, position: 5, legally_mandated: true,
        config: { assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["APPROVED", "RETURNED_FOR_REVISION", "REJECTED"],
          require_comment_on: ["REJECTED"] } satisfies ApprovalStepConfig,
      },
      {
        step_key: "amendments_logging", step_type: "action", label: "Amendments Logging — Second Reading",
        is_start: false, position: 6, legally_mandated: false,
        config: { assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.appropriation_ordinance.amendments_logging",
          require_comment: false, allow_comment: true, auto_complete: false } satisfies ActionStepConfig,
      },
      {
        step_key: "third_reading_vote", step_type: "approval", label: "Third Reading — Final Vote",
        is_start: false, position: 7, legally_mandated: true,
        config: { assignee: ROLE.SP_SECRETARY, allowed_outcomes: ["APPROVED", "REJECTED"],
          require_comment_on: ["REJECTED"] } satisfies ApprovalStepConfig,
      },
      {
        step_key: "final_number_assignment", step_type: "action", label: "Final Series Number Assignment",
        is_start: false, position: 8, legally_mandated: true,
        config: { assignee: ROLE.SP_SECRETARY, form_key: "form.document.final_number_assignment",
          require_comment: false, allow_comment: true, auto_complete: false } satisfies ActionStepConfig,
      },
      {
        step_key: "vp_certification", step_type: "approval", label: "Vice Mayor Signs Certified Copy",
        is_start: false, position: 9, legally_mandated: true,
        config: { assignee: ROLE.VICE_MAYOR, allowed_outcomes: ["SIGNED"],
          require_comment_on: [] } satisfies ApprovalStepConfig,
      },
      {
        step_key: "transmittal_letter_to_mayor", step_type: "action", label: "Transmittal Letter to Mayor",
        is_start: false, position: 10, legally_mandated: true,
        config: { assignee: ROLE.SECRETARIAT_STAFF,
          form_key: "form.document.transmittal_letter_to_mayor",
          require_comment: false, allow_comment: true, auto_complete: false,
          triggers_mayor_lapse_timer: true } satisfies ActionStepConfig,
      },
      {
        step_key: "mayor_review", step_type: "approval", label: "Mayor Review — 10-Day Window",
        is_start: false, position: 11, legally_mandated: true,
        config: { assignee: ROLE.MAYOR, allowed_outcomes: ["SIGNED", "VETOED", "LAPSED"],
          require_comment_on: ["VETOED"] } satisfies ApprovalStepConfig,
      },
      {
        step_key: "veto_override_vote", step_type: "approval", label: "Veto Override Vote",
        is_start: false, position: 12, legally_mandated: false,
        config: { assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["OVERRIDE_SUCCEEDED", "OVERRIDE_FAILED"],
          require_comment_on: [] } satisfies ApprovalStepConfig,
      },
      {
        step_key: "docketing", step_type: "action", label: "Docketing",
        is_start: false, position: 13, legally_mandated: true,
        config: { assignee: ROLE.SECRETARIAT_STAFF, form_key: "form.document.docketing",
          require_comment: false, allow_comment: true, auto_complete: false } satisfies ActionStepConfig,
      },
      {
        step_key: "panlalawigan_transmission_logging", step_type: "action",
        label: "Panlalawigan Transmission Logging",
        is_start: false, position: 14, legally_mandated: false,
        config: { assignee: ROLE.SECRETARIAT_STAFF, form_key: "form.panlalawigan.transmission_logging",
          require_comment: false, allow_comment: true, auto_complete: false,
          triggers_panlalawigan_timer: true } satisfies ActionStepConfig,
      },

      // ── 15. Panlalawigan Review ───────────────────────────────────────────
      // KEY DIFFERENCE: OPERATIVE_IN_ITS_ENTIRETY is added to allowed_outcomes.
      // This outcome is used specifically for Appropriation Ordinances by the
      // Panlalawigan. Treatment is identical to VALID.
      // Source: consolidated ref Parts 4.2, 4.3 [CONFIRMED — Interview 2].
      {
        step_key: "panlalawigan_review",
        step_type: "approval",
        label: "Sangguniang Panlalawigan Review — 30-Day Window",
        is_start: false,
        position: 15,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: [
            "VALID",
            "OPERATIVE_IN_ITS_ENTIRETY",   // Appropriation Ordinance specific
            "VALID_IN_PART",
            "RETURNED",
            "DEEMED_APPROVED",
          ],
          require_comment_on: ["VALID_IN_PART", "RETURNED"],
        } satisfies ApprovalStepConfig,
      },

      // Steps 16–22: Identical to SP Ordinance
      {
        step_key: "valid_in_part_action", step_type: "action",
        label: "VALID-IN-PART — Secretary Documentation",
        is_start: false, position: 16, legally_mandated: false,
        config: { assignee: ROLE.SP_SECRETARY, form_key: "form.panlalawigan.valid_in_part_action",
          require_comment: true, allow_comment: true, auto_complete: false } satisfies ActionStepConfig,
      },
      {
        step_key: "valid_in_part_decision", step_type: "approval",
        label: "VALID-IN-PART — Secretary Selects Resolution Path",
        is_start: false, position: 17, legally_mandated: false,
        config: { assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["RESOLVED_IN_PLACE", "ROUTED_TO_LEGAL", "ROUTED_TO_COMMITTEE", "REVISED_DIRECTLY"],
          require_comment_on: ["RESOLVED_IN_PLACE", "REVISED_DIRECTLY"] } satisfies ApprovalStepConfig,
      },
      // [RESOLVED H1-X-3 — same resolution as SP Resolution §5.5 step 18; full rationale there]
      {
        step_key: "legal_office_review", step_type: "approval",
        label: "Legal Office Review — VALID_IN_PART",
        is_start: false, position: 18, legally_mandated: false,
        config: { assignee: ROLE.LEGAL_OFFICER,
          allowed_outcomes: ["RESOLVED_IN_PLACE"],
          require_comment_on: ["RESOLVED_IN_PLACE"] } satisfies ApprovalStepConfig,
      },
      // [RESOLVED H1-X-3 — same resolution as SP Resolution §5.5 step 19; full rationale there.
      //  ROLE.COMMITTEE_CHAIR is the new [Extension] role key introduced there — see §4.]
      {
        step_key: "committee_revisions_review", step_type: "approval",
        label: "Committee Revisions Review — VALID_IN_PART",
        is_start: false, position: 19, legally_mandated: false,
        config: { assignee: ROLE.COMMITTEE_CHAIR,
          allowed_outcomes: ["RESOLVED_IN_PLACE"],
          require_comment_on: ["RESOLVED_IN_PLACE"] } satisfies ApprovalStepConfig,
      },
      {
        step_key: "returned_review", step_type: "approval",
        label: "RETURNED — Secretariat Decision",
        is_start: false, position: 20, legally_mandated: false,
        config: { assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ["REPASS", "RESOLVED_DIRECTLY"],
          require_comment_on: ["REPASS", "RESOLVED_DIRECTLY"] } satisfies ApprovalStepConfig,
      },

      // portal_publication, archive, final_outcome_check, and terminations
      // NO publication_check or newspaper_publication steps.
      {
        step_key: "portal_publication", step_type: "action", label: "Public Portal Publication",
        is_start: false, position: 21, legally_mandated: true,
        config: { assignee: ROLE.SECRETARIAT_STAFF, form_key: "form.document.portal_publication",
          require_comment: false, allow_comment: true, auto_complete: false } satisfies ActionStepConfig,
      },
      {
        step_key: "archive", step_type: "action", label: "Permanent Archive",
        is_start: false, position: 22, legally_mandated: false,
        config: { assignee: ROLE.RECORDS_OFFICER, form_key: "form.document.archive",
          require_comment: false, allow_comment: true, auto_complete: false } satisfies ActionStepConfig,
      },

      // ── Final Outcome Check ───────────────────────────────────────────────
      // KEY DIFFERENCE: OPERATIVE_IN_ITS_ENTIRETY added to the TRUE branch.
      {
        step_key: "final_outcome_check",
        step_type: "decision",
        label: "Final Outcome Check",
        is_start: false,
        position: 23,
        legally_mandated: false,
        config: {
          condition_expression: JSON.stringify({
            in: [
              { var: "panlalawigan_outcome" },
              ["VALID", "DEEMED_APPROVED", "OPERATIVE_IN_ITS_ENTIRETY"],
            ],
          }),
          true_outcome: "TRUE",
          false_outcome: "FALSE",
        } satisfies DecisionStepConfig,
      },

      {
        step_key: "end_approved_and_released", step_type: "termination",
        label: "Document Approved and Released", is_start: false, position: 24, legally_mandated: false,
        config: { outcome_code: "APPROVED_AND_RELEASED", final_document_status: "ARCHIVED" } satisfies TerminationStepConfig,
      },
      {
        step_key: "end_valid_in_part_resolved", step_type: "termination",
        label: "VALID-IN-PART / RETURNED — Resolved by Secretariat",
        is_start: false, position: 25, legally_mandated: false,
        config: { outcome_code: "VALID_IN_PART_RESOLVED", final_document_status: "ARCHIVED" } satisfies TerminationStepConfig,
      },
      {
        step_key: "end_rejected_at_vote", step_type: "termination",
        label: "Document Voted Down", is_start: false, position: 26, legally_mandated: false,
        config: { outcome_code: "REJECTED_AT_VOTE", final_document_status: "CANCELLED" } satisfies TerminationStepConfig,
      },
      {
        step_key: "end_vetoed_override_failed", step_type: "termination",
        label: "Veto Override Failed", is_start: false, position: 27, legally_mandated: false,
        config: { outcome_code: "VETOED_OVERRIDE_FAILED", final_document_status: "CANCELLED" } satisfies TerminationStepConfig,
      },
      // [RESOLVED D3-O-2, D3-O-7 — same resolution as SP Resolution §5.5; full rationale there]
      {
        step_key: "end_repassed", step_type: "termination",
        label: "Document Repassed to Drafting", is_start: false, position: 28, legally_mandated: false,
        config: { outcome_code: "REPASSED", final_document_status: null,
          emit_event: "workflow.instance.repassed" } satisfies TerminationStepConfig,
      },
    ],

    transition_rules: [
      // Identical to SP Ordinance rules 1–6
      { from_step_key: "intake_logging", to_step_key: "order_of_business_scheduling",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "order_of_business_scheduling", to_step_key: "first_reading",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "first_reading", to_step_key: "committee_referral",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "committee_referral", to_step_key: "second_reading_vote",
        outcome_filter: "REPORT_ACCEPTED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "committee_referral", to_step_key: "second_reading_vote",
        outcome_filter: "SECRETARY_ADVANCED", condition_expression: null, priority: 2, label: null },
      { from_step_key: "committee_referral", to_step_key: "second_reading_vote",
        outcome_filter: "BYPASSED_CERTIFIED_URGENT", condition_expression: null, priority: 3,
        label: "Certified Urgent bypass — required by B4 §6.1" },
      { from_step_key: "second_reading_vote", to_step_key: "third_reading_vote",
        outcome_filter: "APPROVED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "second_reading_vote", to_step_key: "amendments_logging",
        outcome_filter: "RETURNED_FOR_REVISION", condition_expression: null, priority: 2, label: null },
      { from_step_key: "second_reading_vote", to_step_key: "end_rejected_at_vote",
        outcome_filter: "REJECTED", condition_expression: null, priority: 3, label: null },
      { from_step_key: "amendments_logging", to_step_key: "third_reading_vote",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "third_reading_vote", to_step_key: "final_number_assignment",
        outcome_filter: "APPROVED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "third_reading_vote", to_step_key: "end_rejected_at_vote",
        outcome_filter: "REJECTED", condition_expression: null, priority: 2, label: null },
      { from_step_key: "final_number_assignment", to_step_key: "vp_certification",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "vp_certification", to_step_key: "transmittal_letter_to_mayor",
        outcome_filter: "SIGNED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "transmittal_letter_to_mayor", to_step_key: "mayor_review",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "mayor_review", to_step_key: "docketing",
        outcome_filter: "SIGNED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "mayor_review", to_step_key: "docketing",
        outcome_filter: "LAPSED", condition_expression: null, priority: 2,
        label: "Lapsed into law — RA 7160 §47" },
      { from_step_key: "mayor_review", to_step_key: "veto_override_vote",
        outcome_filter: "VETOED", condition_expression: null, priority: 3, label: null },
      { from_step_key: "veto_override_vote", to_step_key: "docketing",
        outcome_filter: "OVERRIDE_SUCCEEDED", condition_expression: null, priority: 1, label: null },
      { from_step_key: "veto_override_vote", to_step_key: "end_vetoed_override_failed",
        outcome_filter: "OVERRIDE_FAILED", condition_expression: null, priority: 2, label: null },
      { from_step_key: "docketing", to_step_key: "panlalawigan_transmission_logging",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "panlalawigan_transmission_logging", to_step_key: "panlalawigan_review",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },

      // panlalawigan_review — OPERATIVE_IN_ITS_ENTIRETY added; routes same as VALID
      { from_step_key: "panlalawigan_review", to_step_key: "portal_publication",
        outcome_filter: "VALID", condition_expression: null, priority: 1, label: null },
      { from_step_key: "panlalawigan_review", to_step_key: "portal_publication",
        outcome_filter: "OPERATIVE_IN_ITS_ENTIRETY", condition_expression: null, priority: 2,
        label: "Operative in its entirety — Appropriation Ordinance specific; treated as VALID" },
      { from_step_key: "panlalawigan_review", to_step_key: "portal_publication",
        outcome_filter: "DEEMED_APPROVED", condition_expression: null, priority: 3,
        label: "Deemed approved — RA 7160 §56(d)" },
      { from_step_key: "panlalawigan_review", to_step_key: "valid_in_part_action",
        outcome_filter: "VALID_IN_PART", condition_expression: null, priority: 4, label: null },
      { from_step_key: "panlalawigan_review", to_step_key: "returned_review",
        outcome_filter: "RETURNED", condition_expression: null, priority: 5, label: null },

      // VALID_IN_PART and RETURNED paths — route directly to portal_publication
      // (no publication_check step for Appropriation Ordinances)
      { from_step_key: "valid_in_part_action", to_step_key: "valid_in_part_decision",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "portal_publication",
        outcome_filter: "RESOLVED_IN_PLACE", condition_expression: null, priority: 1, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "legal_office_review",
        outcome_filter: "ROUTED_TO_LEGAL", condition_expression: null, priority: 2, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "committee_revisions_review",
        outcome_filter: "ROUTED_TO_COMMITTEE", condition_expression: null, priority: 3, label: null },
      { from_step_key: "valid_in_part_decision", to_step_key: "portal_publication",
        outcome_filter: "REVISED_DIRECTLY", condition_expression: null, priority: 4, label: null },
      { from_step_key: "legal_office_review", to_step_key: "portal_publication",
        outcome_filter: "RESOLVED_IN_PLACE", condition_expression: null, priority: 1, label: null },
      { from_step_key: "committee_revisions_review", to_step_key: "portal_publication",
        outcome_filter: "RESOLVED_IN_PLACE", condition_expression: null, priority: 1, label: null },
      { from_step_key: "returned_review", to_step_key: "portal_publication",
        outcome_filter: "RESOLVED_DIRECTLY", condition_expression: null, priority: 1, label: null },
      { from_step_key: "returned_review", to_step_key: "end_repassed",
        outcome_filter: "REPASS", condition_expression: null, priority: 2, label: null },

      { from_step_key: "portal_publication", to_step_key: "archive",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "archive", to_step_key: "final_outcome_check",
        outcome_filter: null, condition_expression: null, priority: 1, label: null },
      { from_step_key: "final_outcome_check", to_step_key: "end_approved_and_released",
        outcome_filter: "TRUE", condition_expression: null, priority: 1,
        label: "panlalawigan_outcome ∈ {VALID, DEEMED_APPROVED, OPERATIVE_IN_ITS_ENTIRETY}" },
      { from_step_key: "final_outcome_check", to_step_key: "end_valid_in_part_resolved",
        outcome_filter: "FALSE", condition_expression: null, priority: 2,
        label: "panlalawigan_outcome ∈ {VALID_IN_PART, RETURNED}" },
    ],
  },
};
```

---

## 8. Minimum Step Guard Contract

The following steps are `legally_mandated: true` in the definitions above. The workflow editor validation must prevent Platform Administrators from removing or bypassing these steps from a published definition. Source: consolidated ref Part 11.3.

|Workflow|Legally Mandated Steps|Legal Basis|
|---|---|---|
|SP Resolution|`intake_logging`, `first_reading`, `committee_referral`¹, `second_reading_vote`, `final_number_assignment`, `vp_certification`, `transmittal_letter_to_mayor`, `mayor_review`, `docketing`, `panlalawigan_review`, `portal_publication`|RA 7160 §§47, 53, 56(d)|
|SP Ordinance|Same as Resolution + `third_reading_vote`|RA 7160 §§47, 54, 56(d)|
|Appropriation Ordinance|Same as SP Ordinance|RA 7160 §§47, 318, 56(d)|

¹ `committee_referral` is legally mandated but is bypassed via Certified Urgent. The bypass is itself a legally sanctioned path (Mayor's formal written Certification of Urgency). The step must exist in the definition; the bypass is not a removal of the step.

**Engine invariant cross-reference:** B4 Section 9, invariant 14: "Workflow constraints per document type (legally mandated minimum steps) — Workflow editor validation." The `legally_mandated: true` field on the step config is the mechanism. The editor validation logic must enforce these on publish.

---

## 9. Context Keys Written by These Definitions

The table below maps which steps write which context keys. Source: B4 Appendix B (authoritative) and B4 Sections 6.3, 6.4.

|Context Key|Type|Set By|Step / Trigger|
|---|---|---|---|
|`document_id`|UUID|Engine|Instance creation|
|`document_type`|string|Engine|Instance creation|
|`series_number_preliminary`|string \| null|Documents module|`intake_logging` completion|
|`series_number_final`|string \| null|Documents module|`final_number_assignment` completion|
|`qr_tracking_id`|UUID|Documents module|`intake_logging` completion|
|`certified_urgent`|boolean|Engine|`document.certification_urgency.logged` event|
|`certified_urgent_document_id`|UUID \| null|Engine|Same event|
|`second_reading_eligible_date`|date \| null|Engine scheduler|Thursday cutoff job (`evaluateThursdayCutoffs`)|
|`mayor_transmittal_date`|TIMESTAMPTZ \| null|Engine|`transmittal_letter_to_mayor` completion [Extension]|
|`mayor_action_deadline`|TIMESTAMPTZ \| null|Engine|`transmittal_letter_to_mayor` completion [Extension]|
|`mayor_action`|enum \| null|Engine|`mayor_review` completion|
|`mayor_action_date`|TIMESTAMPTZ \| null|Engine|`mayor_review` completion|
|`veto_override_vote_count`|integer \| null|Engine|`veto_override_vote` completion|
|`veto_override_outcome`|enum \| null|Engine|`veto_override_vote` completion|
|`panlalawigan_transmission_date`|TIMESTAMPTZ \| null|Engine|`panlalawigan_transmission_logging` completion [Extension]|
|`panlalawigan_action_deadline`|TIMESTAMPTZ \| null|Engine|`panlalawigan_transmission_logging` completion [Extension]|
|`panlalawigan_outcome`|enum \| null|Engine|`panlalawigan_review` completion or scheduler|
|`panlalawigan_response_date`|TIMESTAMPTZ \| null|Engine|`panlalawigan_review` completion or scheduler|
|`panlalawigan_resolution_number`|string \| null|Secretariat via form|`panlalawigan_review` form submission|
|`requires_publication`|boolean|Engine **[NOT YET BUILT — see H1-X-2]**|Should be: Instance creation (from document metadata) — SP Ordinance only. Confirmed gap, this conversation: write path does not exist yet.|
|`publication_date`|date \| null|Documents module|`newspaper_publication` completion — SP Ordinance only|
|`publication_newspaper`|string \| null|Documents module|`newspaper_publication` completion — SP Ordinance only|
|`created_by`|UUID|Engine|Instance creation (B4 invariant 11 guard)|
|`sla_paused`|boolean|—|Always `false` in Phase 1; reserved|

---

## 10. Seed Script Notes

**File location:** `/packages/database/src/seeds/workflow/phase1-legislative.ts`

**Export the three constants** from this file and import them in the main seed entry point at `/packages/database/src/seeds/index.ts`.

**Insertion order:**

```typescript
// 1. Resolve document_type_id from documents.document_types.code
// 2. Insert workflow.definitions row; capture generated id
// 3. Insert workflow.definition_versions row with snapshot = { steps, transition_rules }; capture id
// 4. For each step in version.steps:
//    a. Generate UUID: uuidv5(WORKFLOW_SEED_NAMESPACE, `${definitionCode}.${step.step_key}`)
//    b. Insert workflow.steps row
// 5. Build step_key → step_id map
// 6. For each rule in version.transition_rules:
//    a. Resolve from_step_id and to_step_id from the map
//    b. Generate UUID for the rule
//    c. Insert workflow.transition_rules row
```

**Idempotency:** The seed script must be idempotent (safe to run multiple times). Use `INSERT ... ON CONFLICT DO NOTHING` keyed on the deterministic UUID, or check existence before inserting. Do not use `ON CONFLICT DO UPDATE` for published definition versions — they are immutable once published.

**`city_id`:** All rows require `city_id`. Use the Batac City UUID constant defined in `/packages/database/src/seeds/constants.ts`.

**`created_by`:** Use the Platform Administrator seed user UUID for all seed-inserted definitions.

**B4 / D3 reconciliation dependency:** The seed script cannot be run until the D3 Appendix B enum conflicts (B4 instance status `active` → `Running`, step status `bypassed` → `Skipped`, addition of `Returned` step status) are resolved and the first workflow module migration is committed. These definitions use the D3-authoritative names.

**[RESOLVED H1-X-1] Config fields:** `triggers_mayor_lapse_timer` and `triggers_panlalawigan_timer` on action step configs are extensions not currently defined in B4 Section 4.1. Resolved in conversation (decided by Claude under explicit stakeholder delegation; [Unverified] against B4 itself, which was not available to check this against): the engine recognizes these as config flags and executes the context update on step completion — option (a) below. Options (b) and (c) were considered and rejected; full reasoning at §11 H1-X-1.

- ~~(a) Recognize these as a config flag and execute the context update on step completion~~ — **selected**
- ~~(b) Recognize the step by `step_key` pattern (any step named `transmittal_letter_to_mayor` triggers the Mayor timer)~~ — rejected: breaks silently on a permitted step-key rename (§2.1 explicitly allows renaming when semantics change), with no error and no migration prompt
- ~~(c) Handle the context update via the documents module subscribing to `workflow.step.completed` for specific `step_key` values~~ — rejected: survives a rename but splits the timer logic away from the step definition that documents it, costing more for a four-person team than the module-boundary purity buys

If B4 is later found to already specify a different mechanism, that source should override this decision.

---

## 11. Open Items Affecting These Definitions

The following items from B4 and D3 directly affect the definitions above. **Status as of this conversation: D3-O-2, D3-O-4, D3-O-5, D3-O-6, D3-O-7, H1-X-1, H1-X-2, and H1-X-3 are now resolved.** D3-O-1 is resolved by inference (flagged below, not a sourced fact). No items remain fully open; H1-X-4 is a forward pointer to admin-UI spec work rather than a decision, and is retained as such.

|#|Item|Affects|Resolution Needed Before|Status|
|---|---|---|---|---|
|D3-O-1|Exact mapping of `Pending Approval` document lifecycle state to specific workflow steps|Dashboard document status display|Dashboard implementation|**[Inference, this conversation]** Resolved by inference from H1's own data, not a sourced team decision. H1 only states two lifecycle touchpoints directly: `Released` at `portal_publication` and `Archived` at `archive` (§5.5 comments). Reasoning from those two anchors and the consolidated reference's lifecycle sequence (`Draft → Submitted → In-Workflow → Pending Approval → Completed → Released → Archived → Disposed`, Part 11.4): `Pending Approval` plausibly spans from `vp_certification` (the document is signed/awaiting external action, no longer merely "in workflow" among internal SP steps) through `panlalawigan_review` inclusive (the last step before terminal resolution and publication). This is a single inference chain with one judgment call (where "in-workflow" ends and "pending approval" begins) — labeled as such rather than presented as confirmed. [Unverified] whether this matches what a dashboard implementer or the SP Secretary would actually expect to see. Needs confirmation at dashboard implementation time, per the original "Resolution Needed Before" column — this inference does not substitute for that confirmation, it only gives the dashboard team a documented starting hypothesis instead of an unexamined gap.|
|D3-O-2|How is a Panlalawigan RETURNED → repass case modeled in the document lifecycle? `final_document_status: null` on `end_repassed` is a placeholder.|`end_repassed` termination config; documents module behavior|Panlalawigan integration sprint|**[RESOLVED — ADR-014]** Propagated from the D3 resolution record, this conversation. Option C: original document superseded via `documents.superseded_by` + `closure_reason`; new document created, inherits content, reuses original's final number on its own eventual approval (scoped exception to the numbering-reuse invariant). See §5.5 step 28 comment for full text.|
|D3-O-4|Team decision: add `Stuck` instance state to D3, or remove from B4?|`workflow_instance_status` migration|Before first workflow module migration|**[RESOLVED — ADR-016]** Propagated from the D3 resolution record, this conversation. Retained — added to D3, kept in B4 (casing rename only). See §2.5.|
|D3-O-5|Team decision: add `Failed` step state to D3, or remove from B4?|`workflow_step_status` migration|Before first workflow module migration|**[RESOLVED — ADR-016]** Propagated from the D3 resolution record, this conversation. Retained — same coupled decision as D3-O-4. See §2.5.|
|D3-O-6|Team decision: is `Created` a discrete instance state, or is the instance `Running` from commit?|`engine.createInstance` implementation|Before first workflow module migration|**[RESOLVED — ADR-016]** Propagated from the D3 resolution record, this conversation. Collapsed into `Running` — `Created` was unobservable in B4's actual same-transaction implementation. See §2.5.|
|D3-O-7|What is the instance status after `REPASSED` termination?|`end_repassed` behavior; `workflow_instance_status` migration|Before Panlalawigan integration|**[RESOLVED — ADR-015]** Propagated from the D3 resolution record, this conversation. No distinct `Repassed` status added; instance remains `Running` indefinitely; `documents.superseded_by` is the sole source of truth. Accepted tradeoff, not eliminated — see §5.5 step 28 comment.|
|H1-X-1|`triggers_mayor_lapse_timer` and `triggers_panlalawigan_timer` are [Extension] fields not in B4 §4.1. The engine mechanism for writing timer context keys on action step completion must be confirmed.|`transmittal_letter_to_mayor` and `panlalawigan_transmission_logging` step configs|Before workflow module implementation|**[RESOLVED — this conversation, decided by Claude under explicit stakeholder delegation]** Option (a) selected: the config flag itself is the mechanism — the engine recognizes `triggers_mayor_lapse_timer` / `triggers_panlalawigan_timer` as config fields and executes the context-update on step completion. Rejected (b) because H1 §2.1 explicitly permits renaming a step key when its semantic meaning changes substantially; pattern-matching on `step_key` would silently stop triggering the timer after a permitted rename, with no error and no migration prompt — a silent-failure mode worth avoiding. Rejected (c) because, while it also survives a rename, it splits timer-triggering logic into the documents module away from the step definition that documents it, which costs more for a four-person team reading one file than the module-boundary purity buys. This is a judgment call under delegation, not a sourced B4 confirmation — [Unverified] against B4 itself, which this document does not have access to. If B4 turns out to already specify a different mechanism, this decision should yield to that source.|
|H1-X-2|`requires_publication` context key: confirm that the engine writes this from document metadata at instance creation (B4 Appendix B lists it as a context key but does not specify when/how it is set for the `publication_check` decision step).|`publication_check` decision step in SP Ordinance|Before SP Ordinance workflow implementation|**[RESOLVED as a confirmed gap — stakeholder confirmed in this conversation]** Not yet built. Blocking dependency before SP Ordinance can ship. See §6.1, §9, and the `publication_check` step comment in §6.3.|
|H1-X-3|VALID_IN_PART Phase 1 simplified Legal and Committee paths: `legal_office_review` and `committee_revisions_review` are single action steps. Confirm this is acceptable for Phase 1 before implementation; Phase 1B will replace with routed sub-workflows.|Phase 1B planning|Before Phase 1 sign-off|**[RESOLVED — stakeholder decision, this conversation]** Converted to routed approval steps in Phase 1 (not deferred to Phase 1B): Legal Officer and Committee Chair each log their own `RESOLVED_IN_PLACE` decision; `REVISED_DIRECTLY` kept as a 4th button on `valid_in_part_decision`; no SLA timer in Phase 1 (no confirmed City Legal Office response-time data — [Unverified] whether such an SLA exists at all). New `ROLE.COMMITTEE_CHAIR` role key introduced, itself flagged `[Extension]`/`[Unverified]` pending engine-side confirmation of its resolution mechanism. See §2.6, §4, and step 18/19 in §5.5, §6.3, §7.2.|
|H1-X-4|`legally_mandated: true` is an [Extension] field on steps not defined in B4. The workflow editor validation enforcement mechanism for this field must be designed as part of the admin UI specification.|Admin UI specification; definition publish validation|Before admin UI implementation|**Not a decision item — forward pointer, retained as-is.** This row describes where design work needs to happen (admin UI spec), not a question with a selectable answer. Nothing in this conversation changes that; no resolution forced.|

---

_This document supersedes any prior workflow definition sketches. Changes to step keys, outcome codes, or transition rules require an explicit revision entry with the date and the author. Changes that affect legally mandated step guards require sign-off from the SP Secretary before the new definition version is published to production._