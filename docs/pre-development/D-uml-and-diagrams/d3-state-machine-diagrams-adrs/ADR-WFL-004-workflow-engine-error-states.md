# ADR-016: Workflow Engine Error States and Instance-Creation Modeling

**Status:** Accepted **Date:** 2026-06-17 **Resolves:** O-4, O-5, O-6 (D3 Appendix C) **Decision owner:** Claude (acting on delegated team discretion — explicitly confirmed by the stakeholder before this ADR was written; see note below) **Affects:** `workflow.instances.status` enum (D3 §2); `workflow.step_instances.status` enum (D3 §3); D3 Appendix B, D

---

## Context

Three items in D3 Appendix C were flagged as pure team-discretion questions with no stakeholder-facing or legally-determined answer:

- **O-4:** B4 defines a `stuck` instance status (transition evaluation finds no matching rule) that is absent from D3's instance state set. Add it to D3, or remove it from B4?
- **O-5:** B4 defines a `failed` step status (internal engine error during step execution) that is absent from D3's step state set. Add it to D3, or remove it from B4?
- **O-6:** Should `Created` be a discrete instance status requiring an explicit `INSTANCE_STARTED` event to reach `Running`, or should instance creation collapse directly into `Running`?

None of these touch stakeholder-confirmed legislative process facts. They are internal engine-architecture decisions, and the stakeholder explicitly delegated them: "For the items that you can decide what is the best according to your discretion do them," followed by an explicit confirmation to proceed after the reasoning below was presented in conversation.

## Decision

### O-4 and O-5, decided together: keep both `Stuck` and `Failed`

`Stuck` is added to the workflow instance status enum. `Failed` is added to the workflow step instance status enum. Neither is removed from B4; B4's existing values for these are retained and D3 is updated to match, rather than the reverse.

**Reasoning:** These two states are a coupled pair, not independent choices — a step that internally fails (`Failed`) is precisely the kind of event that leaves its parent instance with no matching transition rule to evaluate (`Stuck`). Modeling one without the other would leave a gap: a `Failed` step with no corresponding instance-level signal, or a `Stuck` instance with no record of which step caused it.

The decisive consideration is what an SLA/ARTA compliance dashboard sees if these states are removed instead. Without `Stuck`, an instance that has genuinely wedged due to an engine error continues reporting status `Running`. A dashboard or report counting "instances currently within SLA" would count it as a normal in-progress item, when it is actually broken and silently accumulating SLA-clock time toward a breach nobody is aware of. For a system whose explicit legal obligation (RA 11032/ARTA, consolidated reference Part 11.19) is to track and report on processing-time compliance, an error state that disguises itself as healthy is a worse outcome than a marginally larger enum. The same logic applies at the step level for `Failed`.

`[Inference — this is the development team's own engineering judgment about failure-mode visibility, not a stakeholder requirement or a confirmed fact from any interview. Stakeholders never discussed engine internal error handling at any point in Interview 1, Interview 2, or the developer-decision rounds.]`

### O-6: `Created` is removed; instance creation collapses directly into `Running`

The workflow instance status enum drops `Created` as a discrete value. An instance is `Running` from the moment its row is committed to the database; there is no separate pre-`Running` state and no `INSTANCE_STARTED` event required to leave it.

**Reasoning:** D3's own draft already documented, in its description of the `Created` state, that B4's actual implementation creates the instance row and activates its first step instance within the same database transaction (B4 Section 3.2, cited in D3 §2.2's `[Inference]` note: "`Created` is a very brief transient state... the start step is activated in the same transaction as instance creation"). A state that the engine's own transactional design makes unobservable in practice — nothing can ever query an instance and find it sitting in `Created` for any meaningful duration — does not earn a place in the persisted enum. Collapsing it removes a state that exists only on paper, not in any reachable database row.

`[Inference — same caveat as above: engineering judgment, not stakeholder-confirmed.]`

## Revised Enums

### Workflow Instance Status (supersedes D3 Appendix D stub)

```sql
CREATE TYPE workflow_instance_status AS ENUM (
    'Running',
    'Paused',
    'Stuck',
    'Completed',
    'Cancelled'
);
```

`Running` is the initial state — there is no `[*] --> Created` transition; the diagram's entry point becomes `[*] --> Running` directly, with the same guard conditions D3 previously attached to `INSTANCE_STARTED` now attached to instance creation itself (definition version published/active, document in `In-Workflow`, start step's assignee resolvable).

`Stuck` is reached from `Running` when transition evaluation finds no matching rule for a step's outcome — this is a new edge not present in D3's original diagram. `Stuck → Running` is permitted once a Platform Administrator resolves the missing-rule condition (e.g., publishes a corrected workflow definition or manually routes the step); this requires a mandatory audit-logged comment, consistent with the audit rigor already established elsewhere in the consolidated reference (Part 11.11) for manual interventions.

### Workflow Step Instance Status (supersedes the relevant row in D3 Appendix D stub)

```sql
CREATE TYPE workflow_step_status AS ENUM (
    'Pending',
    'Active',
    'Completed',
    'Skipped',
    'Returned',
    'Failed',
    'Cancelled'
);
```

`Failed` is reached from `Active` on an internal engine error during step execution (B4 Section 2.8's original definition is retained). A `Failed` step is terminal at the step level; it does not auto-retry. The parent instance transitions to `Stuck` as a consequence (instance-level), since a failed step produces no valid outcome code for transition evaluation to act on.

## Consequences

**Positive:**

- B4 and D3 are now fully reconciled on these three points with no remaining "team decision required" markers in Appendix B.
- Error conditions are visible at both the step and instance layer, supporting accurate SLA/ARTA reporting and giving the Platform Administrator a concrete, queryable signal to act on (consistent with the Tier 2 administrator-configurable role described in consolidated reference Part 11.8).
- `Created`'s removal simplifies the instance lifecycle diagram and removes a state with no corresponding reachable database row, reducing migration and engine code surface area.

**Negative / costs:**

- `Stuck` and `Failed` both need real alerting/notification wiring (who gets notified, how urgently) that is not specified by this ADR and was not asked about by the original D3 document either — this ADR resolves _that the states exist_, not the full operational runbook around them. That remains a follow-up item for the workflow-engine implementation sprint.
- Removing `Created` means any future code that assumed a two-step "create, then start" sequence (as B4's prose description implied before this ADR) must be written as a single atomic creation step instead. Since no migration has been written yet, this has zero retrofit cost today, but should be communicated clearly to whoever writes `engine.createInstance`.

## Process Note

This ADR is unusual among the four issued from this triage session in that it was decided by Claude under explicit, conversation-recorded delegation from the project stakeholder ("for the items that you can decide what is the best according to your discretion do them"), with the specific reasoning presented back to the stakeholder and an explicit "yes, proceed" confirmation obtained before this document was finalized. It is not a stakeholder-interview finding and is not legally or contractually binding the way Parts 3, 4, and 6 of the consolidated reference are; it is recorded as a team architecture decision and should be reviewed by a human engineering lead before the first workflow module migration, consistent with the document's own "Resolution Needed Before: first workflow module migration" deadline.

## Alternatives considered

- **Remove `stuck`/`failed` from B4 instead, per D3's originally-proposed alternative** ("error event that keeps the instance in `Running` and notifies the Platform Administrator"). Rejected for the SLA-masking reason given above.
- **Keep `Created` as a discrete state for symmetry with other lifecycle/status patterns elsewhere in the schema** (e.g., the document lifecycle's own `Draft → Submitted` pattern, which does have meaningfully distinct phases). Rejected because the symmetry argument does not hold once the underlying mechanism is checked — the document lifecycle's phases are genuinely separated by real-world waiting periods (someone has to physically receive and log the document), whereas instance `Created → Running` is separated by nothing but a single transaction boundary.
