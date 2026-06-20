# ADR-010: Workflow Step Detail Route Keys on `instanceId`

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #10 (also referenced in F1 §3, §8.2)
**Decision owner:** Claude, within delegated discretion (routing convention matched against confirmed backend signatures, not a product/business decision)

## Context

F1 proposed `/workflow/steps/:instanceId` as the dynamic workflow-step-detail route, while flagging that the alternative key `stepInstanceId` was also plausible and that the choice between them was this document's own proposed resolution, open to revision (§14 gap #10).

E1's procedure catalog resolves this directly: `workflow.getInstance` — the procedure that loads the page, per F1 §8.2's own description ("Every panel also reads from the same `workflow.getInstance` call that loaded the page") — takes `{ instanceId: z.string().uuid() }` as its input and returns a payload keyed primarily by `instanceId`, with `currentStepInstanceId` included as a field *within* that payload, not as the top-level lookup key `[Confirmed — E1, `workflow.getInstance`]`. Separately, E1's task-inbox-style listing procedures (the ones backing `workflow.listMyAssignedSteps` and similar) return items containing both `stepInstanceId` and `instanceId` as sibling fields per row `[Confirmed — E1, task-inbox output shape]` — confirming both identifiers exist and are distinct, but that the single-instance detail fetch is keyed on `instanceId`.

## Decision

**The workflow step detail route keys on `instanceId`: `/workflow/steps/:instanceId`.** This was F1's original proposal and is retained.

## Rationale

This is a direct match to a confirmed procedure signature, not an inference. `workflow.getInstance` — the actual procedure the route's own page-load call depends on — accepts `instanceId`, not `stepInstanceId`, as its input parameter. Routing on the same identifier the backing procedure actually expects avoids an unnecessary client-side lookup or mapping step between the URL parameter and the procedure call.

## Consequences

- No change to F1's existing route table or Mermaid diagram — `/workflow/steps/:instanceId` is confirmed as correct, closing the gap rather than reversing the original proposal.
- `[Inference]` Where a task-inbox listing links into this detail route, the link should use the row's `instanceId` field, not its `stepInstanceId` field, even though both are present on each list-row object per the task-inbox output shape.
- F1 §14 gap #10's `[Inference]` status (previously "this document's own proposed resolution, open to revision") is superseded by this ADR's `[Confirmed]` backing.

## Alternatives considered

- **`/workflow/steps/:stepInstanceId`.** Would require the detail page to either look up the parent `instanceId` from the `stepInstanceId` before calling `workflow.getInstance`, or require a second procedure (not present in E1) that accepts `stepInstanceId` directly. Rejected once `workflow.getInstance`'s actual signature was checked against source — the procedure does not accept `stepInstanceId` as its lookup key.

## Traceability

- E1, `workflow.getInstance` (input/output schema); task-inbox listing output shape (`stepInstanceId`/`instanceId` sibling fields)
- F1 §3 (route hierarchy), §8.2 (step action views), §14 gap #10
