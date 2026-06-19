# ADR-011: Propagation of F1 ADRs (001–010) Into F2 Store Design

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** Cross-document consistency check between F1 v2 (post-ADR-001–010) and F2 (`f2-zustand-store-design.md.bak`)
**Decision owner:** Mixed — see per-item attribution below. Item B (hearing-date field shape) decided by Luke (product/architecture owner) with confirmed E1 schema detail. All other items decided by Claude, within delegated discretion (these are cross-document consistency checks against already-accepted ADRs, not new product decisions).

## Context

F1 v2 resolved ten previously-open gaps via ADR-001 through ADR-010. F2 (`f2-zustand-store-design.md`) is declared as based on F1, E3, Stack Context, and the Consolidated Reference, but predates ADR-001–010 and was not re-checked against them. This ADR records that check: for each of the ten ADRs, whether it has any bearing on F2's store inventory, state shapes, or actions, and what — if anything — changes as a result.

`[Confirmed — F2 §1]` F2's own boundary rule scopes it strictly to `/apps/web` client UI state. Several of the ten ADRs concern routes, procedures, or apps outside that boundary (e.g. `/apps/portal`, backend procedure catalogs with no multi-step form or transient-panel consumer). Those ADRs are correctly out of scope for F2 and require no store changes — this is a boundary fact, not an oversight being corrected.

## Decision

**Two of the ten ADRs require changes to F2. The other eight do not.**

| ADR | F2 touchpoint checked | Disposition |
|---|---|---|
| ADR-001 (portal hosting app → `/apps/portal`) | F2 has no portal-facing stores; citizen-facing portal pages are entirely outside `/apps/web` | No F2 change |
| ADR-002 (Tier-2 config CRUD pulled into Phase 1) | `/admin/config` is a TanStack-Query-backed CRUD surface with no multi-step buffer or transient panel state | No F2 change |
| ADR-003 (retention schedule CRUD pulled into Phase 1) | `/retention-schedules` propose/activate actions are direct mutations against server state; no UI-state buffer implied | No F2 change |
| ADR-004 (`organization.listCommittees` added) | F2 §9 (`expandedCommitteeId`) and §10 (`routedToCommitteeId`) already treat the committee list as TanStack-Query-sourced under F2's own boundary rule — these fields only ever held a *selected* committee ID, never the list itself | No F2 change (see Consequences for a traceability note added regardless) |
| ADR-005 (`complaints.get`, `documentRequests.get` added) | Detail-view reads for staff-side complaint/document-request pages; F2 has no detail-view stores anywhere — all detail pages are TanStack Query per the boundary rule | No F2 change |
| ADR-006 (public portal announcements built) | New `/admin/announcements` (staff) and citizen-facing listing; neither is a multi-step form or transient panel | No F2 change |
| ADR-007 (Designation document type pulled into Phase 1) | F2 §14 `useAttendanceStore` explicitly deferred the "designated substitute" presiding-officer field, citing the Phase 1B Designation dependency as the reason | **F2 change required** |
| ADR-008 (System Administrator views built in Phase 1) | New `/sys-admin/*` section is session-list, user-CRUD, and audit-validation — all TanStack-Query table/action surfaces, no multi-step intake or transient panel | No F2 change |
| ADR-009 (no-login portal request/complaint forms) | Affects `/portal/requests/new` and `/portal/complaints/new`, both in `/apps/portal` per ADR-001. F2's `useComplaintIntakeStore` (§10) and `useDocumentRequestIntakeStore` (§11) are the **clerk-assisted, in-person, SP-Secretary-only** intake stores — a structurally distinct flow from the citizen self-service portal forms ADR-009 addresses | No F2 change (clarifying note added to prevent future conflation) |
| ADR-010 (workflow step route keys on `instanceId`) | F2 §9 `useWorkflowActionStore` already correctly references `/workflow/steps/:instanceId`. F2 §13 `useOrderOfBusinessStore`'s `ENTER_HEARING_DATE` pending-change variant uses a *different*, sibling identifier (`stepInstanceId`) for a *different* target procedure (`session.enterCommitteeHearingDate`), which ADR-010 itself confirms is a real, distinct field from `instanceId` — not an error to fix, but the shape needed a precision pass once checked against the actual procedure input schema | **F2 change required** (precision patch, not a correction of an ADR-010 conflict) |

### F2 Change 1 — `useAttendanceStore` (§14), resolving via ADR-007

**Before:** F2 §14's closing paragraph stated the store "does not model a `presidingOfficerSubstituteId` field," citing the then-unresolved Phase 1B Designation dependency (F1 §9, §14 item 7).

**After:** ADR-007 pulls the Designation document type into Phase 1. The dependency that justified deferring this field no longer exists. `useAttendanceStore` now models `presidingOfficerSubstituteId` directly, sourced from an active `delegation_grant` record (Designation-backed) when one exists for the session date.

`[Inference]` This field is read-only display data fetched via TanStack Query (the active delegation for the relevant office, scoped to the session date) — it is not user-editable buffer state, consistent with F2's boundary rule that delegation/designation records themselves are server state, not Zustand state. What changes in `useAttendanceStore` is narrow: the store now has a field to *hold the resolved value for display* during the attendance-recording session, rather than omitting the concept entirely.

### F2 Change 2 — `useOrderOfBusinessStore` (§13), `ENTER_HEARING_DATE` variant precision patch

Per the resolution provided directly by the product/architecture owner with confirmed E1 schema detail for `session.enterCommitteeHearingDate`:

1. **`stepInstanceId` is confirmed correct as the targeting identifier** for this variant — `[Confirmed — E1, session.enterCommitteeHearingDate input schema]` the procedure's actual input is `z.object({ stepInstanceId, hearingDate })`. This is consistent with, and now directly evidenced alongside, ADR-010's separate confirmation that `instanceId` and `stepInstanceId` are distinct sibling identifiers in E1's task-inbox output shape — `session.enterCommitteeHearingDate` is simply one of the procedures that keys on the step-level identifier rather than the parent-instance identifier, which ADR-010 already anticipated as possible without asserting which procedures would do so.
2. **`committeeId` is reclassified as UI-display-only.** `[Confirmed — E1, session.enterCommitteeHearingDate input schema]` The procedure's input schema does not accept a `committeeId` parameter at all. The field stays in the pending-change shape so the Order of Business UI can render a human-readable label (e.g. "Committee on Laws — 2026-07-15") instead of a bare UUID, but it must be **stripped before the mutation fires** — it is never sent to the server.
3. **`hearingDate` becomes nullable** (`string | null`, was `string`). `[Confirmed — E1, session.enterCommitteeHearingDate input schema: hearingDate z.coerce.date().nullish()]` `[Confirmed — Consolidated Reference Q-C05: "A committee referral step can begin without a scheduled date (assigned; date TBD)"]` The Consolidated Reference's "date TBD" allowance was already a confirmed business rule; F2's original `string`-only type was the gap, not the rule — this patch closes that gap by aligning the type with both the confirmed procedure signature and the confirmed business rule.

`[Confirmed]` The `SCHEDULE_FIRST_READING` variant and `viewingSessionDate` are explicitly unaffected and require no change — `sessionDate` is always a concrete Tuesday date with no "TBD" equivalent in the source material, and `viewingSessionDate`'s nullability addresses a different concern (no session currently selected in the UI), not date-TBD semantics.

## Rationale

This ADR exists to make the F1→F2 dependency explicit and auditable, rather than letting F2 silently drift out of sync with decisions already made in F1's ADR set. Eight of the ten ADRs turn out to have no F2 footprint at all — this is expected and correctly reflects F2's narrow `/apps/web`-client-UI-state boundary (§1), not an indication that those ADRs were checked carelessly. The two that do have a footprint (ADR-007, ADR-010) are exactly the two that touch state F2 was already tracking as deferred or incompletely specified (§14 gap-adjacent note; §13's pending-change shape) — confirming the boundary rule is doing its job of keeping server-resolvable concerns out of Zustand, while still correctly flagging the two places where a *client-side buffer's shape* depended on a fact F1's ADRs have now settled.

## Consequences

- `useAttendanceStore` (F2 §14) gains a `presidingOfficerSubstituteId` field, sourced from TanStack Query (active Designation-backed delegation grant), closing the tension F2 previously left open.
- `useOrderOfBusinessStore` (F2 §13) `ENTER_HEARING_DATE` variant and `addEnterHearingDate` action signature are patched: `hearingDate` becomes `string | null`; `committeeId` is annotated as UI-display-only and stripped pre-mutation. A new usage-note paragraph documents the strip-before-send rule so a future implementer does not send `committeeId` to a procedure that does not accept it.
- `[Inference]` F2 §9 (`useWorkflowActionStore`, citing `/workflow/steps/:instanceId`) and §10/§11 (`useComplaintIntakeStore`/`useDocumentRequestIntakeStore`, the clerk-assisted intake stores) receive traceability annotations only — citing ADR-010 and ADR-009/ADR-004 respectively — confirming by inspection that no shape change is needed, rather than leaving the cross-reference implicit.
- F2's "Based on" header should be updated to additionally cite ADR-001 through ADR-010 (and this ADR) as inputs, since F2 is now a standalone document re-issued after this review rather than a delta.
- A full, standalone, updated F2 document is issued alongside this ADR (not a delta) per the working agreement that documents requiring updates from ADR resolutions are reissued whole.

## Alternatives considered

- **Leave F2 unchanged and treat the F1↔F2 cross-reference as implicit.** Rejected — F2 §14 already contained a now-stale forward reference to "F1 §9, §14 item 7" as a Phase 1B blocker; leaving it as-is after ADR-007 resolved that exact dependency would make F2 actively incorrect, not merely silent.
- **Patch only ADR-007's effect and leave the `ENTER_HEARING_DATE` shape as originally written.** Rejected once the product/architecture owner supplied the confirmed `session.enterCommitteeHearingDate` input schema — the original `hearingDate: string` (non-nullable) type would have silently violated the confirmed Q-C05 "date TBD" business rule the first time a Secretariat staff member tried to log a committee referral without a hearing date yet.

## Traceability

- F1 ADR-001 through ADR-010 (full set)
- F2 §1 (Zustand/TanStack Query boundary rule), §9 (`useWorkflowActionStore`), §10 (`useComplaintIntakeStore`), §11 (`useDocumentRequestIntakeStore`), §13 (`useOrderOfBusinessStore`), §14 (`useAttendanceStore`)
- Consolidated Architecture & Requirements Reference, Iteration 3 — Part 4.10/4.12/7.2 (Designation, hearing-date TBD / Q-C05), Part 11.13 (Designation/delegation system behavior)
- E1, `session.enterCommitteeHearingDate` input schema (per product/architecture owner confirmation, this thread)
