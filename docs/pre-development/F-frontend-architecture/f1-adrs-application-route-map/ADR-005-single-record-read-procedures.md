# ADR-005: `complaints` and `documentRequests` Single-Record Read Procedures

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #5 (also referenced in F1 §8.3, §8.4)
**Decision owner:** Claude, within delegated discretion (engineering convention, not a product/business decision)

## Context

E1's `complaints` router catalogues `complaints.createClerkAssisted`, `complaints.logAndAssign`, `complaints.enterCommitteeReport`, `complaints.setOutcome`, and `complaints.listAll`, but no single-record read procedure (no `complaints.get`) `[Confirmed — E1, §"complaints.createClerkAssisted" through §"complaints.listAll"]`. The `documentRequests` router has the same shape of gap: `documentRequests.generatePrintableForm`, `createClerkAssisted`, `approveAsPresidingOfficer`, `approveAsSecretary`, `releaseCopy`, and `listAll` exist, but no `documentRequests.get`.

F1's detail-view routes for both staff-side resources — `/complaints/:complaintId` (§8.3) and `/document-requests/:requestId` (§8.4) — depend on a single-record read that does not exist. F1 noted that, absent a fix, a detail page would need to filter the already-loaded `listAll` result client-side, or the backend team would need to add a missing procedure, and left the choice open.

## Decision

**Add `complaints.get` and `documentRequests.get`** to their respective routers, rather than relying on client-side filtering of `listAll`.

- **`complaints.get`** — **Input:** `{ complaintId: string (uuid) }`. **Output:** single complaint record, matching the shape implied by `complaints.listAll`'s items plus any detail-only fields needed for `/complaints/:complaintId` (assignment, committee report text, outcome state). **Callable by:** same role set as `complaints.listAll` — `sp_secretary`, `sp_presiding_officer`, `auditor` unconditionally; `sp_member` committee-scoped, matching the existing ABAC condition pattern (`complaint.assigned_office_id ∈ subject.committee_ids`).
- **`documentRequests.get`** — **Input:** `{ requestId: string (uuid) }`. **Output:** single document-request record, matching the shape implied by `documentRequests.listAll`'s items. **Callable by:** same role set as `documentRequests.listAll` — `sp_secretary`, `sp_presiding_officer`, `auditor`.

## Rationale

A dedicated read-by-ID procedure is the standard pattern already used elsewhere in E1 (e.g., `workflow.getInstance`, `records.getRetentionSchedule`), so this keeps the catalog internally consistent. Client-side filtering of `listAll` was rejected as the alternative because it would require fetching every complaint/document-request a role can see just to render one detail page — wasteful at scale, and inconsistent with how every other detail route in this codebase is built. This does not require a product decision: there is no business-logic ambiguity here, only a missing CRUD primitive of a kind the backend team would add as a matter of course once a frontend route needs it.

## Consequences

- `/complaints/:complaintId` (F1 §8.3) gains `complaints.get` as a data dependency, in addition to its existing write procedures (`logAndAssign`, `enterCommitteeReport`, `setOutcome`).
- `/document-requests/:requestId` (F1 §8.4) gains `documentRequests.get` as a data dependency, in addition to its existing write procedures (`approveAsPresidingOfficer`, `approveAsSecretary`, `releaseCopy`, `generatePrintableForm`).
- F1 §14 gap #5's `[Unverified]` status is superseded by this ADR.

## Alternatives considered

- **Client-side filtering of `listAll`.** Rejected — does not scale, and breaks the moment a role's list is large enough that fetching it all just to find one record becomes wasteful or slow.

## Traceability

- E1, `complaints.createClerkAssisted` through `complaints.listAll`; `documentRequests.generatePrintableForm` through `documentRequests.listAll`
- F1 §8.3, §8.4, §14 gap #5
