# ADR-TST-002: OPERATIVE_IN_ITS_ENTIRETY` on a Non-Appropriation-Ordinance Instance (K2 §21, item 2)


**Decision:** Submitting `panlalawigan_review` outcome `OPERATIVE_IN_ITS_ENTIRETY` against an instance whose document type is not Appropriation Ordinance (i.e., against an SP Resolution or a regular SP Ordinance) is rejected. The engine throws a validation error; it does not route the outcome anywhere.

**Decided by:** Luke — confirming the speculation K2-context §8 itself offered ("likely: invalid input; throw").

**Rationale:** B4 §4.2's outcome table states `OPERATIVE_IN_ITS_ENTIRETY` is the Panlalawigan outcome "for Appropriation Ordinances"; treating it as universally valid would let a non-Appropriation document follow an outcome code that has no defined meaning for it.

**Error code:** No source document names a specific typed error for this case. Following the `SCREAMING_SNAKE_CASE`, semantically-descriptive convention already used throughout B4 (`NO_ACTIVE_VERSION`, `MISSING_OUTCOME_TRANSITION`, `COMMENT_REQUIRED`), this ADR proposes `OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE`. This is a naming proposal, not a confirmed engine contract — flag for confirmation against any future B4 revision, the same way other Phase 1 extensions in this corpus (e.g., `triggers_mayor_lapse_timer`) were flagged pending upstream confirmation.

**Consequence for K2:** PANLA-15 and APP-I01 (both currently referencing this as a gap) get a defined expected result:

> **New test (PANLA-15 / APP-I01, revised):** `panlalawigan_review` step is `Active` on an instance whose `document_type ≠ 'appropriation_ordinance'`. SP Secretary (or any actor) attempts to submit outcome `OPERATIVE_IN_ITS_ENTIRETY`. **Expected:** Engine rejects the submission with a validation error (proposed code: `OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE`); step remains `Active`; no transition evaluation fires; no context keys are set.

> **Existing test, unaffected:** `OPERATIVE_IN_ITS_ENTIRETY` on an Appropriation Ordinance instance continues to resolve identically to `VALID` (B4 §4.2), per the already-confirmed behavior.

---
