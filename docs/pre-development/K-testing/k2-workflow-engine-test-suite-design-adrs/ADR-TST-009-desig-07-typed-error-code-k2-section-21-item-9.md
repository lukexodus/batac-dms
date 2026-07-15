# ADR-TST-009: DESIG-07 Typed Error Code (K2 §21, item 9)

**Decision:** Use `UNAUTHORIZED_DESIGNATION_ISSUER` as the proposed typed error code for a non-original-authority (e.g., Platform Admin) attempting to create a designation.

**Decided by:** Claude, under the discretion Luke granted for naming a typed error consistent with the existing convention, where no source names one.

**Rationale:** Following the established `SCREAMING_SNAKE_CASE`, semantically-descriptive convention (`NO_ACTIVE_VERSION`, `FORBIDDEN`, `COMMENT_REQUIRED`, `MISSING_OUTCOME_TRANSITION`). `FORBIDDEN` alone (already used elsewhere in B4 for actor-authorization failures, e.g. §4.1, §4.2) was considered but rejected as the proposal here, because B4 already uses bare `FORBIDDEN` for a different, narrower class of check (`actor_id` not in `assigned_to`, or non-system actor submitting a scheduler-only outcome) — reusing it for this distinct "wrong category of authority entirely" case would make `FORBIDDEN` ambiguous between two different failure semantics in test assertions and error-handling code. A more specific name avoids that collision.

**Consequence for K2:** DESIG-07's expected result row is updated from "must throw; exact error type `[Unverified]`" to:

> **DESIG-07 (revised):** Platform Admin attempts to create a designation (not the original delegating authority — Mayor or Vice Mayor). **Expected:** Engine rejects with `UNAUTHORIZED_DESIGNATION_ISSUER` (proposed); no `delegation_grant` record created.

This proposed code, like the ones in ADR-TST-002 and ADR-TST-004, is a naming proposal pending confirmation against any future authoritative error-code registry for the `organization` module (which owns designations, per B4 §9) — it is not sourced from any of the four documents and should be confirmed before being treated as final.

---
