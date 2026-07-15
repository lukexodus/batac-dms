# ADR-UI-012: `AuthResponseSchema` Returns Resolved `roleCodes` Directly

**Status:** Accepted
**Date:** 2026-06-19
**Deciders:** Development team (frontend lead decision; backend-confirming follow-up required), product owner approval
**Affected documents:** E3 (`e3-shared-zod-schema-catalog.md`) — `AuthResponseSchema`; F2 (`f2-zustand-store-design.md`) §5 `useSessionStore`

---

## Context

F2 §5 (`useSessionStore`) requires `roleCodes: string[]` to be available synchronously on session hydration, for client-side ABAC checks and route guards (`hasRole(store.identity, 'sp_secretary')`) used throughout F1's route map.

E3's `AuthResponseSchema` (Part 2), as currently specified, carries only:

```ts
{ user: UserSelectSchema, sessionId: UuidSchema, expiresAt: TimestampSchema }
```

`UserSelectSchema` has no `roleCodes` field. Role data exists in the system as `RoleAssignmentSelectSchema[]` (E3 Part 2) — a richer, normalized shape (role id, office scope, position, etc.), not a flat array of role code strings.

This left open whether:

- **(A)** the login procedure's output schema should be extended to project role assignments down to `roleCodes: string[]` directly, or
- **(B)** the frontend should call a second procedure after login (e.g. `iam.getMyRoles` or similar) to resolve roles, with `useSessionStore` populated in two stages.

This is an API contract decision (it changes a Zod schema and a procedure's resolver), not a pure frontend state-shape decision, so it is recorded as an ADR rather than silently assumed in F2.

## Decision

**Option (A).** `AuthResponseSchema` (E3 Part 2) is extended to include a resolved `roleCodes: string[]` field, computed server-side from the authenticated user's active `RoleAssignmentSelectSchema[]` at the moment the login procedure issues the session. No second round-trip is introduced.

```ts
// AuthResponseSchema (E3 Part 2) — addition
{
  user: UserSelectSchema,
  sessionId: UuidSchema,
  expiresAt: TimestampSchema,
  roleCodes: z.array(z.string()),        // NEW — flat list of active role codes for this session
  officeScopeId: z.string().uuid().nullable(),   // NEW — see note below
  officeCode: z.string().nullable(),             // NEW — see note below
}
```

`officeScopeId` and `officeCode` are included in the same extension because F2 §5's `ActiveUserIdentity` already required them and they have the identical sourcing problem (derived from the same role/assignment resolution the backend must already perform to authenticate). Splitting them across two backend changes would be inconsistent.

## Rationale

1. **`isHydrated` would otherwise be a lie.** `useSessionStore.isHydrated` exists specifically so route guards know identity resolution is complete and don't flash an incorrect redirect. If roles arrive via a second call, `isHydrated` must either fire before roles are known (reintroducing the flash-of-unauthorized bug it was built to prevent) or the store needs a third state (`hydrated-but-roles-pending`) — which every ABAC-gated route guard in F1 would then have to account for. Option A keeps the existing two-state model (`isHydrated: false | true`) correct as designed.
2. **No new data access on the backend.** Authenticating a user already requires loading their role assignments (to know _what_ session to issue and what claims, if any, to encode). Projecting `RoleAssignmentSelectSchema[]` → `string[]` of codes is a server-side `.map()`, not a new query or a new trust boundary.
3. **Avoids a race window.** A second call means there is a real (if short) window where `identity` is set but `roleCodes` is empty/stale, during which any component reading `hasRole()` gets a false negative. This is exactly the class of bug the boundary rule in F2 §1 (Zustand owns UI state; TanStack Query owns server state, but identity is the documented exception) is trying to avoid by treating identity as a single atomic hydration step.
4. **No store shape change required.** F2 §5's `ActiveUserIdentity` interface and `setIdentity` action are unchanged — this ADR only changes what the backend returns into that same shape, which was already designed for it.
5. **Cost is small and one-time.** The work is a backend schema/resolver change at a single procedure (login), not a recurring runtime cost.

## Alternatives Considered

**Option (B) — second resolving call.** Rejected. Would avoid touching `AuthResponseSchema`, but at the cost of a permanent extra round-trip on every login, a new transient state to manage in `useSessionStore` or an adjacent hook, and a real (if narrow) ABAC race window. The schema change in Option A is a one-time, low-risk cost; the round-trip and race-window costs of Option B are recurring and permanent.

## Consequences

- E3's `AuthResponseSchema` (Part 2) must be updated to include `roleCodes`, `officeScopeId`, `officeCode` before `/web`'s login flow can be implemented against it.
- The backend login resolver must compute the active role-code list (and primary office scope, if a user can hold roles in multiple offices — see Open Follow-Up below) at the point of issuing `AuthResponseSchema`.
- F2 §5 requires no change — `useSessionStore`'s state shape, actions, and usage notes already assumed this exact shape.
- This is recorded in E3 as a schema-owning-document change; the actual edit to `AuthResponseSchema` happens in E3, not in F2.

## Open Follow-Up

**[RESOLVED — 2026-06-26, ADR-AUTH-011]** The question of which `officeScopeId`/`officeCode` is "primary" when an employee holds multiple simultaneous active assignments is now closed. An explicit `is_primary BOOLEAN NOT NULL DEFAULT false` column has been added to `organization.assignments`, with a partial unique index (`uq_assignments_one_primary_per_employee`) preventing more than one `is_primary = true` row per employee at the DB level. `getPrimaryOfficeForUser` resolves by querying `WHERE is_primary = true AND is_active = true AND deleted_at IS NULL`; if no such row exists it returns `null` (and `officeScopeId`/`officeCode` in the login response are `null`). The `ActiveUserIdentity` shape in F2 §5 (`officeScopeId: string | null`, `officeCode: string | null`) is consistent with this outcome and requires no change.

~~If a user can hold active role assignments scoped to more than one office simultaneously (not yet ruled out by any source document reviewed), the backend resolver needs a defined rule for which `officeScopeId`/`officeCode` is "primary" for display purposes, since `ActiveUserIdentity` models only one. This is a narrower question than the one this ADR resolves and should be raised against E3/I2 separately if multi-office role holding turns out to be possible in Phase 1.~~
