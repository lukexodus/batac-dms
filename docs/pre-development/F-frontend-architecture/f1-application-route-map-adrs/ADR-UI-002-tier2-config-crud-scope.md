# ADR-UI-002: Tier-2 Platform Admin Config CRUD — Pulled Into Phase 1

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #2 (also referenced in F1 §12.4; E1 §"Required Follow-Up Before Full Sign-Off," item E1-F1)
**Decision owner:** Luke (product/architecture owner)

## Context

I2's permission matrix lists six Tier-2, Platform-Administrator-configurable entity types with no developer involvement required `[Confirmed — F1-Context §1.4, Authorization tiers]`: document types, workflow definitions, notification templates, SLA thresholds, numbering series, and public visibility rules. E1 itself deferred building a procedure catalog for these six entities, stating in its own follow-up section that procedures for `notification_templates`, `sla_thresholds`/escalation targets, and `public_visibility_rules` were not produced because their dedicated schemas are not among the eight Phase 1 DDL schemas as standalone tables, and a procedure catalog for tables that do not yet exist would be speculative. E1 separately notes that document-type, numbering-series, and workflow-definition CRUD were deferred because building the full set would substantially duplicate the documents router's type-management surface, pending a more detailed config-screen spec.

F1 carried this forward as an unresolved gap (`/admin/config` route, §12.4) with no procedure names invented.

## Decision

**All six Tier-2 config entities (document types, workflow definitions, notification templates, SLA thresholds, numbering series, public visibility rules) are pulled into Phase 1 scope.** `/admin/config` becomes a buildable route rather than a placeholder.

## Rationale

This was a scope decision, not a technical one — the underlying gap was that E1 had not yet designed the procedures, not that the procedures were technically infeasible. Pulling them into Phase 1 means this design work must now happen before the IAM/config module's database migrations are finalized, per the project's stated pre-development documentation phase.

## Consequences

- `[Inference]` The following backend work, previously deferred, is now in scope for Phase 1: standalone schemas (where not already present in the eight Phase 1 DDL schemas) for `notification_templates`, `sla_thresholds`/escalation targets, and `public_visibility_rules`; and full CRUD procedure sets for `document_types`, `number_series`/numbering series, and `workflow_definitions`.
- `[Inference]` A config-screen spec sufficiently detailed to design these procedures against — which E1 explicitly said it lacked — must now be produced before this work can proceed. This ADR does not itself supply that spec.
- This significantly expands the Phase 1 backend surface area beyond what E1 originally catalogued in detail. Combined with ADR-UI-001 (public portal hosting app), ADR-UI-003 (retention schedules), ADR-UI-006 (public portal announcements), ADR-UI-007 (Designation document type), and ADR-UI-008 (System Administrator views), six previously-deferred or later-phase scope items are now pulled into Phase 1 across this decision pass. `[Corrected — this previously said "four" items and misattributed ADR-UI-006 to Designation and ADR-UI-007 to System Administrator views; the correct mapping, per the ADR-INDEX and the ADRs' own filenames, is ADR-UI-006 = announcements, ADR-UI-007 = Designation, ADR-UI-008 = System Administrator views, and the full count of scope-expanding ADRs in this pass is six, not four — see ADR-INDEX's "Net effect on Phase 1 scope" section, also corrected in this pass]` `[Unverified]` The cumulative effect on timeline and team capacity cannot be assessed from the documents reviewed and should be evaluated separately by the project owner.
- `/admin/config` (F1 §12.4) is no longer a `[Deferred]`-only placeholder; it should be built out once the procedures above exist, likely as six sub-sections or tabs, one per config entity, mirroring the pattern already used for `/admin/committees` and `/admin/roles`.
- F1 §14 gap #2's `[Deferred]` status is superseded by this ADR.

## Alternatives considered

- **Keep deferred to a follow-up addendum** (E1's own original position). This was the lower-risk, lower-scope option, and would have kept Phase 1 backend work bounded to what E1 had already detailed. Not selected — Luke chose to pull this into Phase 1 now.

## Traceability

- F1-Context §1.4 (Authorization tiers, Tier 2 list)
- E1, "Required Follow-Up Before Full Sign-Off," item E1-F1; E1 §3 Platform Configuration deferral note
- F1 §12.4, §14 gap #2
