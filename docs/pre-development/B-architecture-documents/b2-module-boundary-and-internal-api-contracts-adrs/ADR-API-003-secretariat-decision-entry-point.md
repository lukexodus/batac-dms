# ADR-API-003: Secretariat Decision Entry Point

**Status:** Accepted
**Date:** June 2026
**Decided by:** Luke (stakeholder/architect decision — affects which module's router and validation logic becomes authoritative)
**Related documents:** B2 — Module Boundary and Internal API Contracts, Module 3 (Documents), Module 4 (Workflow); B1 — System Architecture, Module 3 and Module 4 Component Diagrams

---

## Context

B1's Component Diagrams show the Secretariat's "Approve / Reject / Amended" action in two places without resolving which one is authoritative:

- **Documents Module 3, Document Router** (B1 line 249): *"Document CRUD, version history, attachment upload and download, number assignment actions, **Secretariat decision logging: Approve, Reject, Amended**."*
- **Workflow Module 4, Workflow Router** (B1 line 296): *"**Step actions: Approve, Reject, Amended**, Advance with mandatory audit-logged comment. Workflow instance queries. Order of Business view with red-flag indicators for missing committee reports."*

B2's working design (prior to this ADR) resolved the ambiguity by routing the action through Documents: the Document Router records the decision, emits `document.secretariat_decision` on the event bus, and Workflow's event consumer picks it up to advance the corresponding step (B2, "Note on Secretariat Decision Flow," explicitly flagged `[Inference — exact internal implementation of recordDecision()]`).

This created a consistency gap. B2's own stated decision rule for choosing sync vs. async (B2, "Synchronous vs. Asynchronous — Decision Rule") lists as a sync-API criterion: *"The action must complete or fail atomically with the caller's transaction"* — and gives as an explicit example of this exact category: *"document state transition driven by workflow."* The Secretariat decision is precisely this: an action whose entire purpose is to drive a document state transition, where the workflow step and the document state should never be allowed to drift out of sync (e.g. a decision "recorded" in Documents while the corresponding Workflow step silently fails to advance because of an event delivery problem).

Separately, B2's existing Published API Call Matrix already lists a confirmed sync call in the *other* direction for the same underlying capability: `Workflow (engine) | Documents | transitionState() | Advancing document lifecycle state on step completion or lapse`. The async-via-Documents design effectively built a second, redundant path to reach the same outcome (`Workflow → event bus → Workflow consumer → Documents.transitionState()`, vs. the already-confirmed `Workflow → Documents.transitionState()` direct call).

## Decision

**The Workflow Router is the entry point for the Secretariat's "Approve / Reject / Amended" action.** The Documents Router is not involved in recording this decision.

### Mechanics

1. The Secretariat submits the decision (Approve, Reject, or Amended, with optional remarks/amended copy reference) to the **Workflow Router**, not the Document Router.
2. The Workflow Router validates the action against the current workflow step's type and allowed outcomes (an `approval`-type step, per B2's Phase 1 step types, accepts exactly this action shape).
3. The **Workflow Engine** processes the decision: it determines the next step per the workflow definition's transition rules (Approve/Amended-accepted → next step; Reject → rejection path), and **synchronously calls `Documents.transitionState(documentId, toState, actorId, reason?)`** as part of the same logical operation, per the already-existing entry in the Published API Call Matrix.
4. If `Documents.transitionState()` throws (e.g. the requested transition is invalid against the document's internal state machine), the entire Secretariat decision action fails atomically — no workflow step advancement is recorded, and no partial document state change occurs. This satisfies B2's own atomicity criterion for choosing the sync path.
5. On success, the **Workflow module emits `workflow.step.completed`** (already an existing event in B2's Master Event Bus Registry, with `outcome` carrying the Approve/Reject/Amended result) rather than a new or renamed event. **`document.secretariat_decision` is removed from B2's event taxonomy** — it is no longer needed, since the decision no longer originates in Documents and is no longer the trigger for Workflow's action; the causality is now the reverse (Workflow Router → Workflow Engine → `Documents.transitionState()` → Workflow emits `workflow.step.completed`).
6. The **Documents Router's** responsibility for "Secretariat decision logging" (as listed in B1, Module 3) is corrected: Documents Router retains "Document CRUD, version history, attachment upload and download, number assignment actions" but **does not** log the Approve/Reject/Amended decision itself — that responsibility moves entirely to the Workflow Router, consistent with B1's own Module 4 listing.

### Resulting event and API matrix changes (carried into the updated B2 document)

- **Removed event:** `document.secretariat_decision` (was emitted by Documents, consumed by Workflow and Audit).
- **No change to `workflow.step.completed`:** this event already existed and already carries an `outcome` field; it now additionally covers the Approve/Reject/Amended outcome explicitly, and its existing consumers (Tracking, Audit) require no change.
- **No new Published API method needed:** `Documents.transitionState()` already existed in the matrix as a Workflow→Documents call. This ADR does not add a new method; it removes a redundant event-driven path that duplicated this existing call.

## Consequences

- **Positive:** No drift window between "decision recorded" and "workflow step advanced" — both happen as one atomic operation, or neither happens. This was the central problem with the prior async design.
- **Positive:** Removes a redundant path. The system previously had two ways to reach the same document-state outcome (a direct sync call, and an indirect async-event-triggered call to the same sync method); this ADR collapses them to the one already-confirmed path.
- **Positive:** Resolves B1's internal inconsistency (the action listed in both the Document Router and Workflow Router) in favor of the interpretation that is also more consistent with B2's own stated sync/async decision rule.
- **Negative (accepted):** This is a breaking change to B2's prior design, which must be reflected in the updated document: the "Note on Secretariat Decision Flow" section in Module 3, the Documents module's Events Emitted table, the Workflow module's Events Consumed table, the Audit module's Events Consumed table, the Master Event Bus Registry, and the Published API Call Matrix all require corresponding edits (carried out in the updated B2 document accompanying this ADR set).
- **Negative (accepted):** The Workflow Router's validation logic becomes the authoritative gatekeeper for what constitutes a valid Approve/Reject/Amended action (e.g. is "Amended" only valid coming out of a Second Reading step; is "Reject" valid from every step type). This concentrates more responsibility in Workflow's Router/Engine than the original design, which is the deliberate trade-off being made here in exchange for atomicity.
