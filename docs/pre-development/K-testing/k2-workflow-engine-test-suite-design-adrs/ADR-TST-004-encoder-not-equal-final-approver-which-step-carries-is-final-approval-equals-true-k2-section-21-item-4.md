# ADR-TST-004: Encoder ≠ Final Approver: Which Step Carries `is_final_approval = true` (K2 §21, item 4)

**Decision:** `vp_certification` is the step marked `is_final_approval = true`, across all three Phase 1 definitions (SP Resolution step 9; SP Ordinance and Appropriation Ordinance step 14 in their respective numbering — same `step_key`, unmodified by the Ordinance/Appropriation delta per H1's delta tables). If the actor attempting to submit `vp_certification`'s `SIGNED` outcome has a user ID matching `instance.context.created_by`, the engine rejects the action.

**Decided by:** Claude, under the discretion Luke granted for items where the source documents already establish the mechanism and only a concrete parameter (which step, what error code) is missing.

**Rationale:**

- B4 invariant 11 already fully specifies the _mechanism_: "Enforced in `approval` step completion handler for steps marked `is_final_approval = true`; checked against `instance.context.created_by`." The only gap is which step gets that flag.
- `vp_certification` is the step where the Vice Mayor (or Acting VM) signs the certified copy — the last point at which a single human signature finalizes the document's content and form before it leaves the SP's own internal process and proceeds into Mayor review, transmittal, and the Panlalawigan/portal pipeline (H1 §5.3 rules 13–15). Every step after it is either a different actor's review (Mayor, Panlalawigan) or a clerical/system action (docketing, transmission logging, publication, archiving) — none of which re-examines or re-approves the document's substance the way `vp_certification` does.
- `intake_logging` (the step where the document first enters the system, performed by `secretariat_staff`) is the natural encoder-adjacent step, but it is an `action` step, not an `approval` step — and B4 invariant 11's enforcement mechanism is explicitly scoped to `approval` step completion handlers. This rules out treating any earlier `action` step as the "final approver" side of the constraint; the constraint is inherently about the approval step, not about who logs intake.
- This single rule applies cleanly to all three workflow types without exception, since `vp_certification` is identical and unmodified across the SP Resolution, SP Ordinance, and Appropriation Ordinance deltas (H1's delta tables list step 14 as unchanged from Resolution step 9 in both the Ordinance and Appropriation variants).

**Error code:** No source names one. Proposed, following the existing convention: `ENCODER_CANNOT_BE_FINAL_APPROVER`.

**Consequence for K2:** §21 item 4 is closed; §20 (Engine Invariants — Consolidated Test Map), invariant 11's row changes from `[Unverified]` to a real test reference:

> **New test needed (proposed ID: RES-I12 or a new dedicated prefix, e.g. `INV11-01`):** `vp_certification` step is `Active`; the resolved Vice Mayor/Acting-VM actor's user ID equals `instance.context.created_by` for this instance. Actor attempts to submit outcome `SIGNED`. **Expected:** Engine rejects with `ENCODER_CANNOT_BE_FINAL_APPROVER` (proposed); step remains `Active`; `instance.context.created_by` and `mayor_transmittal_date` (etc.) are unaffected; no transition evaluation fires.

> **Companion test:** Same setup, but actor's user ID does not equal `instance.context.created_by`. **Expected:** submission succeeds normally per RES-V14.

---
