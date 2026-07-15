# ADR-TST-006: MISSING_LAPSE_TRANSITION` Publish-Time Validation Test (K2 §21, item 6)

**Decision:** Add a dedicated publish-time validation test asserting that a definition version containing an `approval` step with `LAPSED` in `config.allowed_outcomes` but no outgoing `transition_rules` row with `outcome_filter = 'LAPSED'` from that step is rejected at publish time with `MISSING_LAPSE_TRANSITION`.

**Decided by:** Claude — same reasoning as ADR-TST-005: B4 invariant 4 fully specifies the behavior and error code; the gap was purely test coverage.

**Consequence for K2:** New test, proposed ID `PUBVAL-01`, added to §20 in place of the current `[Inference]` placeholder for invariant 4:

> **PUBVAL-01:** A draft definition version's `mayor_review` step config includes `LAPSED` in `allowed_outcomes`, but no transition rule exists with `from_step_key = 'mayor_review'`, `outcome_filter = 'LAPSED'`. Platform Administrator attempts to publish this version. **Expected:** Publish operation rejected with `MISSING_LAPSE_TRANSITION`; version remains in draft/unpublished state; no `definition_versions.status` change to published.

> **Companion case (negative control):** Same definition, but the `LAPSED` transition rule is present and correctly targets `docketing`. **Expected:** Publish succeeds.

---
