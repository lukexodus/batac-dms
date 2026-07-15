# ADR-UI-016: Presiding-Officer Substitute Lookup Confirmed as `organization.getActiveDesignations`; Mandatory Vitest Coverage for `committeeId` Strip-Before-Send

**Status:** Accepted
**Date:** 2026-06-19
**Deciders:** Development team
**Affected documents:** F2 (`f2-zustand-store-design.md`) §14 `useAttendanceStore`, §13 `useOrderOfBusinessStore`, §17 Testing Guidance

---

## Context

F2 §14's usage notes flagged the exact tRPC procedure for resolving an active Designation-backed presiding-officer substitute as `[Unverified]`, proposing a placeholder name (`organization.getActiveDelegationForRole` or similar) pending confirmation against E1. F2 §18 item 6 also raised, separately, that the §13 patch's `committeeId`-strip-before-send convention (the `ENTER_HEARING_DATE` pending-change variant carries a UI-display-only `committeeId` that must never reach the `session.enterCommitteeHearingDate` mutation payload) needed explicit Vitest coverage, since it is a manual discipline rather than something the type system enforces on its own.

E1 (`e1-trpc-router-and-procedure-catalog.md`), now available, resolves the first half directly.

## Decision

### Part A — Confirmed procedure: `organization.getActiveDesignations`

The procedure is **`organization.getActiveDesignations`** (E1, Organization Router, Module 2), not the placeholder previously floated. Its actual signature differs from the placeholder's assumed shape in two ways that matter for `useAttendanceStore`'s implementation:

```ts
// organization.getActiveDesignations — confirmed shape (E1)
Type: query
Input: z.void()                          // NOT role/date-scoped — returns ALL active designations
Output: z.array(z.object({
  delegationId: z.string().uuid(),
  designationDocumentId: z.string().uuid(),
  delegatingUserId: z.string().uuid(),
  delegatingDisplayName: z.string(),
  delegatedToUserId: z.string().uuid(),
  delegatedToDisplayName: z.string(),
  officeId: z.string().uuid(),
  positionTitle: z.string(),             // free-text position title, not a role-code enum
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
}))
Callable by: sys_admin, plat_admin, sp_secretary, sp_presiding_officer, mayor, auditor
```

Two corrections to F2 §14's prior assumptions, both confirmed by E1:

1. **The procedure takes no input and returns every active designation system-wide** — it is not scoped by role, office, or date on the server side. The "is there an active substitute for the presiding officer covering this session date" filter must therefore be done **client-side** (in the component/hook calling this query, per F2's existing boundary that server-state reads live in TanStack Query and the _interpretation_ of that data for store population is a component concern — F2 §15 Rule 1).
2. **Matching is by `positionTitle` string, not a role-code enum.** There is no `roleCode` or `positionId` filter parameter on the output. The component must match `positionTitle` against whatever literal string represents the SP Presiding Officer position (e.g. `"Vice Mayor"` / `"Presiding Officer"` — the exact literal must be confirmed against `organization.positions` seed data, since `positionTitle` is a display string sourced from the position record, not a fixed code) — and additionally check `sessionDate` falls within `[validFrom, validUntil]` — before treating a returned row's `delegatedToUserId` as the value for `setPresidingOfficerSubstitute`.
3. Because `sys_admin` and `plat_admin` are also in `Callable by` but `useAttendanceStore`'s consuming page (`SessionAttendanceDetailPage`, SP Secretary-only per F1 §9) is only reached by `sp_secretary`, the caller-role list is wider than this store's one consumer needs — no action required, just noted so it isn't mistaken for a missing role-gate bug during review.

`useAttendanceStore`'s state shape and `setPresidingOfficerSubstitute` action (F2 §14) require **no change** — they already model only the resolved `employeeId`, which is exactly what `delegatedToUserId` from this query supplies after the client-side filter above.

### Part B — Mandatory Vitest coverage for `committeeId` strip-before-send

A test is added to the Order of Business save-orchestration test suite (the component/hook level, per F2 §13's note that this logic lives outside the store) asserting:

> Given a `pendingChanges` buffer containing an `ENTER_HEARING_DATE` item with a non-null `committeeId`, the assembled payload passed to the `session.enterCommitteeHearingDate` mutation call contains exactly `{ stepInstanceId, hearingDate }` and does **not** contain a `committeeId` key at all (not even `undefined`).

This test is added as **required**, not optional, test coverage for Phase 1 sign-off of the Order of Business save flow — it is listed explicitly in F2 §17 Testing Guidance rather than left implicit in "each action's effect on state in isolation," since the thing being protected against (a UI-only field accidentally leaking onto the wire) is a payload-assembly bug at the component/hook boundary, not a store-action bug, and would not be caught by any of the store-level tests F2 §17 already describes.

## Rationale

1. **Confirming against the real contract, not a placeholder, is the entire point of this exercise.** E1 is now available; using its actual procedure name and signature instead of carrying a guessed name forward avoids a guaranteed rework cycle once a developer eventually opens E1 themselves.
2. **The "all active designations, unfiltered" shape is a real implementation constraint, not a cosmetic naming difference.** If `useAttendanceStore`'s implementer assumed (per the placeholder's name) that the query was already role/date-scoped server-side, they would write `setPresidingOfficerSubstitute(data[0]?.delegatedToUserId ?? null)` and silently break the moment a second, unrelated active designation exists (e.g. an Acting Mayor designation logged the same week) — `getActiveDesignations` returns _all_ of them, and the wrong one would be picked. Documenting the required client-side filter here prevents that specific bug before it's written.
3. **The `committeeId` strip is exactly the kind of thing unit tests should pin down.** F2 §13's usage notes already call this "a manual discipline" — i.e., the type system does not prevent a future refactor from accidentally including `committeeId` in the mutation call (e.g. via an incautious object-spread `{ ...pendingChange }`). A test that fails the moment that regression is introduced is cheap insurance for a documented footgun, consistent with F2 §17's existing principle that cross-action sequences mirroring real flows should be tested.

## Alternatives Considered

**Leave the procedure name unverified in F2 indefinitely, confirm only at implementation time.** Rejected — E1 was available before implementation start; resolving it now, with the team's own reference documents, is strictly better than deferring a five-minute lookup to a developer mid-sprint, especially given the non-obvious "unfiltered, all-designations" shape that an implementer would otherwise have to discover the hard way.

**Treat the `committeeId` strip test as "nice to have" rather than required.** Rejected — the bug this guards against is silent (no type error, no runtime error until the backend rejects or ignores the extra field, possibly not even then if the backend's Zod parsing simply strips unknown keys) and would likely surface only in manual QA or, worse, production. A few-line test is disproportionately cheap relative to the cost of that failure mode reaching users.

## Consequences

- F2 §14's `[Unverified]` tag on the procedure name is resolved; the usage note should be updated to cite `organization.getActiveDesignations` (E1, Module 2) directly, replacing the placeholder.
- F2 §14 gains an explicit note that the query is unscoped and the date/position-title filter is a client-side responsibility of the component, not encoded in the query call itself.
- The exact literal string for `positionTitle` matching the SP Presiding Officer position must still be confirmed against actual `organization.positions` seed data before this filter can be implemented — this is a narrower, smaller follow-up than the original gap and is noted as a new, much smaller open item rather than left silently assumed.
- F2 §17 Testing Guidance gains one explicit required test case (the `committeeId` strip assertion), called out by name rather than left to be inferred from the general "cross-action sequences" guidance.
- F2 §18 item 6 is fully resolved by this ADR (both halves) and should move to a "Resolved" table in the next F2 revision, mirroring how ADR-UI-007's resolution of the original item 2 was recorded.
