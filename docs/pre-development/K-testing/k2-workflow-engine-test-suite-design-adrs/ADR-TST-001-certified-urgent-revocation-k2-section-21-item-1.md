# ADR-TST-001: Certified Urgent Revocation (K2 §21, item 1)

**Decision:** A Certified Urgent bypass, once applied (B4 §6.1 Case A or Case B has executed), cannot be revoked or rolled back. There is no "un-bypass" operation. `committee_referral` does not return to an active state once skipped via Certified Urgent.

**Decided by:** Luke.

**Rationale:** This matches the irreversibility already designed into every other bypass/skip outcome in B4 — once `committee_referral` transitions to `Skipped` (B4: `bypassed`) under any path, B4 §6.1 Case C explicitly treats any further Certified Urgent signal against that step as a no-op (`workflow.certification_urgency.already_past_referral`), not as a state change. Revocation would have introduced a new reversal mechanic that does not exist elsewhere in the engine's bypass model.

**Assumption surfaced, not hidden:** This decision concerns the _workflow engine's_ behavior only. It says nothing about whatever real-world legal or procedural recourse exists if a Mayor's Certification of Urgency was issued in error (e.g., correcting the underlying document outside the system, or cancelling the instance entirely via `engine.cancelInstance` and starting over). That question is outside the engine's scope and is not addressed here.

**Consequence for K2:** CU-10 (currently a placeholder, K2 §13) gets a defined expected result:

> **CU-10 (revised):** Certified Urgent bypass has already fired (Case A or B executed). Caller attempts to submit a revocation/reversal action against the same instance. **Expected:** Engine has no entry point for this operation — `engine.bypassStep` is not designed for reversal, and no other engine method exists for it. The test should assert that no API surface accepts a revocation of an already-applied CU bypass, and that the `committee_referral` step instance remains in `Skipped`/`bypassed` status with its original `bypass_reason = 'CERTIFIED_URGENT'` unchanged.

This also resolves the open question implicitly attached to invariant coverage: no new invariant is needed, since "no reversal path exists" is the absence of a feature, not a guarded invariant.

---
