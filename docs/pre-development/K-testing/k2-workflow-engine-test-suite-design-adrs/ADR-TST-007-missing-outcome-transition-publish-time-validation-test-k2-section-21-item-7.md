# ADR-TST-007: MISSING_OUTCOME_TRANSITION` Publish-Time Validation Test (K2 §21, item 7)

**Decision:** Add a dedicated publish-time validation test asserting that a definition version containing an `approval` step where some outcome code in `config.allowed_outcomes` has neither a matching outgoing transition rule (`outcome_filter` equal to that code) nor a default unconditional transition rule is rejected at publish time with `MISSING_OUTCOME_TRANSITION`.

**Decided by:** Claude — same reasoning as ADR-TST-005/06: B4 §4.2 fully specifies the behavior ("Every outcome code in `config.allowed_outcomes` must have at least one outgoing transition rule with a matching `outcome_filter`, or a default unconditional transition must exist... rejected at publish time with `MISSING_OUTCOME_TRANSITION`"). This is broader than the `LAPSED`-specific case in ADR-TST-006 — it is the general coverage rule, of which `MISSING_LAPSE_TRANSITION` is a special case for one particular outcome code.

**Consequence for K2:** New test, proposed ID `PUBVAL-02`, added to §20 in place of the current placeholder for invariant tied to B4 §4.2:

> **PUBVAL-02:** A draft definition version's `second_reading_vote` step config includes `REJECTED` in `allowed_outcomes`, but no transition rule exists with `outcome_filter = 'REJECTED'` from that step, and no unconditional default rule exists either. Platform Administrator attempts to publish. **Expected:** rejected with `MISSING_OUTCOME_TRANSITION`.

> **Companion case (negative control):** Same definition, but the `REJECTED` → `end_rejected_at_vote` rule (RES-V09) is present. **Expected:** publish succeeds.

> **Relationship to PUBVAL-01:** `MISSING_LAPSE_TRANSITION` (ADR-TST-006) is a stricter, named special case of this general rule, specifically for the `LAPSED` outcome code given its scheduler-only / lapse-timer significance; both validations should run independently at publish time, and a test should confirm a definition violating only the `LAPSED` rule produces `MISSING_LAPSE_TRANSITION` rather than the generic `MISSING_OUTCOME_TRANSITION`, to confirm the engine picks the more specific error.

---
