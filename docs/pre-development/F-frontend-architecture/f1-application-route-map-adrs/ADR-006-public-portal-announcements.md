# ADR-006: Public Portal Announcements — Built in Phase 1

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #6 (also referenced in F1 §13.2)
**Decision owner:** Luke (product/architecture owner)

## Context

I2's permission matrix includes a "Post announcement on public portal" row, granted to Platform Administrator and SP Secretary `[Confirmed — I2, Section 14, announcement-posting row]`. No tRPC procedure exists anywhere in E1 backing this action, and no citizen-facing announcements page was named among F1's nine in-scope views. F1 flagged this as a gap rather than inventing a route or procedure for it (§13.2, §14 gap #6).

## Decision

**Build this now.** Add the missing procedure(s) for announcement management, and add an `/admin/announcements` route for staff-side posting.

## Rationale

This was a scope decision: the permission already existed in I2's matrix with no backing implementation, so building it closes a real gap between confirmed role/permission intent and what the system can actually do, rather than leaving a permission row with no corresponding capability anywhere in the product.

## Consequences

- `[Inference]` A new module or sub-domain is needed for announcements. F1-Context's module-boundary list `[Confirmed — F1-Context §1.3]` places "announcements" under the `portal` module (`portal → public documents, citizen requests, complaints, announcements`), which was previously marked Phase 3. Since ADR-001 already pulls `/apps/portal` into Phase 1, this is consistent with that decision rather than introducing a second, separate Phase-3-pulled-forward item — but the `announcements` table/schema itself still needs to be designed, as it was not among the eight Phase 1 DDL schemas F1-Context references.
- `[Inference]` Minimum procedure set needed: a write procedure (e.g., `portal.createAnnouncement` or similar, callable by `plat_admin` and `sp_secretary` per the confirmed permission row) and a read procedure for the public-facing listing (citizen-facing, REST per the tRPC/REST boundary rule, not tRPC, since this is portal-consumed).
- New route: `/admin/announcements` (staff-side, Platform Administrator + SP Secretary, nested under `/admin` alongside `/admin/committees`, `/admin/config`, `/admin/delivery-logs`, `/admin/roles`).
- New citizen-facing page on the public portal (`/apps/portal` per ADR-001) to display posted announcements — no specific path was named in any source document; this ADR does not invent one, leaving that to the F1 update pass.
- This is one of four scope items pulled into Phase 1 in this decision pass (see ADR-002 consequences for the combined cumulative-scope note).
- F1 §14 gap #6's `[Unverified]` status is superseded by this ADR.

## Alternatives considered

- **Defer to Phase 1B/2**, dropping the permission row for now. Lower scope, but leaves a confirmed I2 permission with no corresponding capability anywhere in the product for an indefinite period. Not selected.
- **Keep the permission row, flag as a known gap, build no page.** Matches F1's original position; defers the inconsistency rather than resolving it. Not selected.

## Traceability

- I2, Section 14, "Post announcement on public portal" row
- F1-Context §1.3 (module boundaries — `portal` module, announcements)
- F1 §13.2, §14 gap #6
