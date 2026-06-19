# ADR Set — Resolutions for K2 §21 Open Items and Unverified Gaps

**Document ID:** K2-ADR-01 through K2-ADR-09
**Status:** Decided
**Applies to:** K2 (`k2-workflow-engine-test-suite-design.md`), §21
**Source Documents Consulted:** K2-context, H1, B4 (D3 was not consulted — none of the nine items reference D3)
**Date:** June 2026
**Audience:** Backend development team

---

## How to read this document

Each ADR below resolves exactly one row from K2 §21. Each ADR states:

- **Decision** — what was decided
- **Decided by** — Luke (stakeholder) or Claude (engineering discretion), and why that split was used
- **Rationale**
- **Consequence for K2** — what changes in the test suite as a result
- **Confidence labeling** — per Luke's stated preference, decisions are not hedged with `[Inference]`/`[Speculation]`/`[Unverified]` tags, since each is a genuine decision (not a claim about existing fact). Where a decision rests on an assumption that is itself unconfirmed, that assumption is called out explicitly in its own line rather than folded into the decision silently.

This document does not itself modify K2. A separate update pass is needed to merge these decisions into K2 §13 (CU), §14 (PANLA), §8 (Engine Invariants), and §21 — see the "Next Step" note at the end.

---

## ADR-01 — Certified Urgent Revocation (K2 §21, item 1)

**Decision:** A Certified Urgent bypass, once applied (B4 §6.1 Case A or Case B has executed), cannot be revoked or rolled back. There is no "un-bypass" operation. `committee_referral` does not return to an active state once skipped via Certified Urgent.

**Decided by:** Luke.

**Rationale:** This matches the irreversibility already designed into every other bypass/skip outcome in B4 — once `committee_referral` transitions to `Skipped` (B4: `bypassed`) under any path, B4 §6.1 Case C explicitly treats any further Certified Urgent signal against that step as a no-op (`workflow.certification_urgency.already_past_referral`), not as a state change. Revocation would have introduced a new reversal mechanic that does not exist elsewhere in the engine's bypass model.

**Assumption surfaced, not hidden:** This decision concerns the *workflow engine's* behavior only. It says nothing about whatever real-world legal or procedural recourse exists if a Mayor's Certification of Urgency was issued in error (e.g., correcting the underlying document outside the system, or cancelling the instance entirely via `engine.cancelInstance` and starting over). That question is outside the engine's scope and is not addressed here.

**Consequence for K2:** CU-10 (currently a placeholder, K2 §13) gets a defined expected result:

> **CU-10 (revised):** Certified Urgent bypass has already fired (Case A or B executed). Caller attempts to submit a revocation/reversal action against the same instance. **Expected:** Engine has no entry point for this operation — `engine.bypassStep` is not designed for reversal, and no other engine method exists for it. The test should assert that no API surface accepts a revocation of an already-applied CU bypass, and that the `committee_referral` step instance remains in `Skipped`/`bypassed` status with its original `bypass_reason = 'CERTIFIED_URGENT'` unchanged.

This also resolves the open question implicitly attached to invariant coverage: no new invariant is needed, since "no reversal path exists" is the absence of a feature, not a guarded invariant.

---

## ADR-02 — `OPERATIVE_IN_ITS_ENTIRETY` on a Non-Appropriation-Ordinance Instance (K2 §21, item 2)

**Decision:** Submitting `panlalawigan_review` outcome `OPERATIVE_IN_ITS_ENTIRETY` against an instance whose document type is not Appropriation Ordinance (i.e., against an SP Resolution or a regular SP Ordinance) is rejected. The engine throws a validation error; it does not route the outcome anywhere.

**Decided by:** Luke — confirming the speculation K2-context §8 itself offered ("likely: invalid input; throw").

**Rationale:** B4 §4.2's outcome table states `OPERATIVE_IN_ITS_ENTIRETY` is the Panlalawigan outcome "for Appropriation Ordinances"; treating it as universally valid would let a non-Appropriation document follow an outcome code that has no defined meaning for it.

**Error code:** No source document names a specific typed error for this case. Following the `SCREAMING_SNAKE_CASE`, semantically-descriptive convention already used throughout B4 (`NO_ACTIVE_VERSION`, `MISSING_OUTCOME_TRANSITION`, `COMMENT_REQUIRED`), this ADR proposes `OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE`. This is a naming proposal, not a confirmed engine contract — flag for confirmation against any future B4 revision, the same way other Phase 1 extensions in this corpus (e.g., `triggers_mayor_lapse_timer`) were flagged pending upstream confirmation.

**Consequence for K2:** PANLA-15 and APP-I01 (both currently referencing this as a gap) get a defined expected result:

> **New test (PANLA-15 / APP-I01, revised):** `panlalawigan_review` step is `Active` on an instance whose `document_type ≠ 'appropriation_ordinance'`. SP Secretary (or any actor) attempts to submit outcome `OPERATIVE_IN_ITS_ENTIRETY`. **Expected:** Engine rejects the submission with a validation error (proposed code: `OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE`); step remains `Active`; no transition evaluation fires; no context keys are set.

> **Existing test, unaffected:** `OPERATIVE_IN_ITS_ENTIRETY` on an Appropriation Ordinance instance continues to resolve identically to `VALID` (B4 §4.2), per the already-confirmed behavior.

---

## ADR-03 — `COMMITTEE_CHAIR` Assignee Resolution (K2 §21, item 3)

**Decision:** `COMMITTEE_CHAIR` resolves via the existing `actor_from_context:<context_key>` grammar (B4 §3.5) — **not** a new prefix. The engine reads the committee chair's user ID from a new instance context key, `referred_committee_id` (or the resolved chair user ID directly — see open sub-point below), which is populated by the SP Secretary's selection at the `valid_in_part_decision` → `ROUTED_TO_COMMITTEE` step, not at original `committee_referral` time.

- **Single-committee original referral:** the SP Secretary's selection at routing time is a single choice with no real alternative — that one committee.
- **Multi-committee original referral:** the SP Secretary selects exactly one "lead" committee from the originally-referred set at the `ROUTED_TO_COMMITTEE` decision point. A mandatory comment is required for this selection (consistent with B4 invariant 10's general rule that mandatory `reason`/`comment` fields must not be empty/whitespace-only).
- **True parallel multi-committee re-review** (i.e., more than one committee chair needing to independently approve `committee_revisions_review`) is out of scope for Phase 1, for the same reason `parallel_split`/`parallel_join` are out of scope (B4 §5) — `committee_revisions_review` is defined in H1 §5.2 row 19 as a single-assignee `approval` step, and supporting true parallel committee approval would require either a new step type or restructuring that step, which is a schema change beyond what this ADR is scoped to resolve.

**Decided by:** Luke, across two rounds — first confirming the missing B4 §3.5 content (which closed the larger "phantom cross-reference" question), then confirming the routing model for the multi-committee case.

**Rationale:** B4 §3.5's grammar is a closed set of five prefixes (`role:`, `office_role:`, `delegation_aware:`, `actor_from_context:`, `static:`). None of the other four naturally express "resolve dynamically from this instance's own referral history" — `actor_from_context:<context_key>` is the only one built for instance-scoped, runtime-determined values, which is exactly what's needed here once the SP Secretary's committee selection is written into context at the routing decision point.

This also resolves why H1's placeholder string (`"instance_aware:committee_chair_of_referred_committee"`) doesn't appear in B4 §3.5 at all: it isn't a real prefix in the existing grammar, and shouldn't become a sixth one when an existing prefix already covers the need.

**Open sub-point flagged for implementation, not for this ADR:** whether `referred_committee_id` should store the committee's ID (requiring a further role-style lookup of "chair of committee X") or the already-resolved chair's user ID directly. The former is more consistent with how `committee_referral`'s `assigned_committees` metadata already stores committee IDs (B4 §4.3); the latter is simpler at resolution time but couples context-population logic to chair-lookup logic. This implementation choice does not change the ADR's resolution model (still `actor_from_context:`, still populated at the `ROUTED_TO_COMMITTEE` decision point) and can be decided at implementation time without revisiting this ADR.

**Consequence for K2:**

> `COMMITTEE_CHAIR` in H1 §4 should be corrected from `"instance_aware:committee_chair_of_referred_committee"` to `"actor_from_context:referred_committee_chair_id"` (or equivalent key name, pending the open sub-point above), with the `[Extension]`/`[Unverified]` comment block in H1 §4 replaced by a reference to this ADR.

> **RES-V30 (revised):** `valid_in_part_decision` completes with `ROUTED_TO_COMMITTEE`; SP Secretary has selected a lead committee from the originally-referred set (single choice if only one committee was originally referred) with mandatory comment. **Expected:** `instance.context.referred_committee_chair_id` (or equivalent) is set to the resolved chair; `committee_revisions_review` activates with that chair as sole assignee.

> **New test needed (not yet numbered):** `valid_in_part_decision` completes with `ROUTED_TO_COMMITTEE` but the SP Secretary's mandatory comment for committee selection is empty/whitespace-only. **Expected:** rejected per invariant 10 (`COMMENT_REQUIRED` or equivalent), consistent with the pattern already used for `SECRETARY_ADVANCED` (B4 §4.3) and `RESOLVED_IN_PLACE`/`REVISED_DIRECTLY` (H1 §5.3 rules 28, 31).

> **New test needed (not yet numbered):** Original referral was to a single committee. `valid_in_part_decision` completes with `ROUTED_TO_COMMITTEE`. **Expected:** that committee's chair is resolved with no selection ambiguity; same context-population mechanism as the multi-committee case, just with one candidate.

> Note: the Phase 2 deferral of true parallel committee re-review should be added to K2 §1's "Out of scope for this document" list, alongside the existing `parallel_split`/`parallel_join` Phase 2 boundary, since it is the same category of deferral.

---

## ADR-04 — Encoder ≠ Final Approver: Which Step Carries `is_final_approval = true` (K2 §21, item 4)

**Decision:** `vp_certification` is the step marked `is_final_approval = true`, across all three Phase 1 definitions (SP Resolution step 9; SP Ordinance and Appropriation Ordinance step 14 in their respective numbering — same `step_key`, unmodified by the Ordinance/Appropriation delta per H1's delta tables). If the actor attempting to submit `vp_certification`'s `SIGNED` outcome has a user ID matching `instance.context.created_by`, the engine rejects the action.

**Decided by:** Claude, under the discretion Luke granted for items where the source documents already establish the mechanism and only a concrete parameter (which step, what error code) is missing.

**Rationale:**

- B4 invariant 11 already fully specifies the *mechanism*: "Enforced in `approval` step completion handler for steps marked `is_final_approval = true`; checked against `instance.context.created_by`." The only gap is which step gets that flag.
- `vp_certification` is the step where the Vice Mayor (or Acting VM) signs the certified copy — the last point at which a single human signature finalizes the document's content and form before it leaves the SP's own internal process and proceeds into Mayor review, transmittal, and the Panlalawigan/portal pipeline (H1 §5.3 rules 13–15). Every step after it is either a different actor's review (Mayor, Panlalawigan) or a clerical/system action (docketing, transmission logging, publication, archiving) — none of which re-examines or re-approves the document's substance the way `vp_certification` does.
- `intake_logging` (the step where the document first enters the system, performed by `secretariat_staff`) is the natural encoder-adjacent step, but it is an `action` step, not an `approval` step — and B4 invariant 11's enforcement mechanism is explicitly scoped to `approval` step completion handlers. This rules out treating any earlier `action` step as the "final approver" side of the constraint; the constraint is inherently about the approval step, not about who logs intake.
- This single rule applies cleanly to all three workflow types without exception, since `vp_certification` is identical and unmodified across the SP Resolution, SP Ordinance, and Appropriation Ordinance deltas (H1's delta tables list step 14 as unchanged from Resolution step 9 in both the Ordinance and Appropriation variants).

**Error code:** No source names one. Proposed, following the existing convention: `ENCODER_CANNOT_BE_FINAL_APPROVER`.

**Consequence for K2:** §21 item 4 is closed; §20 (Engine Invariants — Consolidated Test Map), invariant 11's row changes from `[Unverified]` to a real test reference:

> **New test needed (proposed ID: RES-I12 or a new dedicated prefix, e.g. `INV11-01`):** `vp_certification` step is `Active`; the resolved Vice Mayor/Acting-VM actor's user ID equals `instance.context.created_by` for this instance. Actor attempts to submit outcome `SIGNED`. **Expected:** Engine rejects with `ENCODER_CANNOT_BE_FINAL_APPROVER` (proposed); step remains `Active`; `instance.context.created_by` and `mayor_transmittal_date` (etc.) are unaffected; no transition evaluation fires.

> **Companion test:** Same setup, but actor's user ID does not equal `instance.context.created_by`. **Expected:** submission succeeds normally per RES-V14.

---

## ADR-05 — `workflow_events` Immutability Test (K2 §21, item 5)

**Decision:** Add a dedicated test that attempts a direct SQL `UPDATE` and a direct SQL `DELETE` against a `workflow.workflow_events` row (inserted via normal engine operation in the test's Given step) and asserts both are rejected by the database itself — not merely by the application layer.

**Decided by:** Claude — this item has no remaining design ambiguity; B4 invariant 13 fully specifies the behavior (`REVOKE UPDATE, DELETE ON workflow.workflow_events FROM workflow_app_user`) and §21 itself only flagged "no test case verifies this is actually enforced," which is a test-coverage gap, not a behavior question.

**Rationale:** Application-level guards can be bypassed by a bug or a future code path that talks to the DB directly; the DB-level `REVOKE` is the actual safety net B4 specifies, so the test needs to exercise the DB connection's privileges directly (using the `workflow_app_user` role, not a superuser/migration role) rather than only testing through `engine.*` methods, which would never attempt an UPDATE/DELETE on this table anyway and so would not actually exercise the constraint being tested.

**Consequence for K2:** New test, proposed ID `INV13-01`, added to §20's invariant map in place of the current `[Inference]` placeholder:

> **INV13-01:** A `workflow_events` row exists (created via normal `engine.submitStepAction` or similar). Test connects as `workflow_app_user` (the same role the application uses) and attempts `UPDATE workflow.workflow_events SET ... WHERE id = ...`. **Expected:** Database rejects with a permissions error (e.g., Postgres `42501 insufficient_privilege`), not an application-level error. **Companion case:** same setup, `DELETE FROM workflow.workflow_events WHERE id = ...` attempted. **Expected:** same rejection.

---

## ADR-06 — `MISSING_LAPSE_TRANSITION` Publish-Time Validation Test (K2 §21, item 6)

**Decision:** Add a dedicated publish-time validation test asserting that a definition version containing an `approval` step with `LAPSED` in `config.allowed_outcomes` but no outgoing `transition_rules` row with `outcome_filter = 'LAPSED'` from that step is rejected at publish time with `MISSING_LAPSE_TRANSITION`.

**Decided by:** Claude — same reasoning as ADR-05: B4 invariant 4 fully specifies the behavior and error code; the gap was purely test coverage.

**Consequence for K2:** New test, proposed ID `PUBVAL-01`, added to §20 in place of the current `[Inference]` placeholder for invariant 4:

> **PUBVAL-01:** A draft definition version's `mayor_review` step config includes `LAPSED` in `allowed_outcomes`, but no transition rule exists with `from_step_key = 'mayor_review'`, `outcome_filter = 'LAPSED'`. Platform Administrator attempts to publish this version. **Expected:** Publish operation rejected with `MISSING_LAPSE_TRANSITION`; version remains in draft/unpublished state; no `definition_versions.status` change to published.

> **Companion case (negative control):** Same definition, but the `LAPSED` transition rule is present and correctly targets `docketing`. **Expected:** Publish succeeds.

---

## ADR-07 — `MISSING_OUTCOME_TRANSITION` Publish-Time Validation Test (K2 §21, item 7)

**Decision:** Add a dedicated publish-time validation test asserting that a definition version containing an `approval` step where some outcome code in `config.allowed_outcomes` has neither a matching outgoing transition rule (`outcome_filter` equal to that code) nor a default unconditional transition rule is rejected at publish time with `MISSING_OUTCOME_TRANSITION`.

**Decided by:** Claude — same reasoning as ADR-05/06: B4 §4.2 fully specifies the behavior ("Every outcome code in `config.allowed_outcomes` must have at least one outgoing transition rule with a matching `outcome_filter`, or a default unconditional transition must exist... rejected at publish time with `MISSING_OUTCOME_TRANSITION`"). This is broader than the `LAPSED`-specific case in ADR-06 — it is the general coverage rule, of which `MISSING_LAPSE_TRANSITION` is a special case for one particular outcome code.

**Consequence for K2:** New test, proposed ID `PUBVAL-02`, added to §20 in place of the current placeholder for invariant tied to B4 §4.2:

> **PUBVAL-02:** A draft definition version's `second_reading_vote` step config includes `REJECTED` in `allowed_outcomes`, but no transition rule exists with `outcome_filter = 'REJECTED'` from that step, and no unconditional default rule exists either. Platform Administrator attempts to publish. **Expected:** rejected with `MISSING_OUTCOME_TRANSITION`.

> **Companion case (negative control):** Same definition, but the `REJECTED` → `end_rejected_at_vote` rule (RES-V09) is present. **Expected:** publish succeeds.

> **Relationship to PUBVAL-01:** `MISSING_LAPSE_TRANSITION` (ADR-06) is a stricter, named special case of this general rule, specifically for the `LAPSED` outcome code given its scheduler-only / lapse-timer significance; both validations should run independently at publish time, and a test should confirm a definition violating only the `LAPSED` rule produces `MISSING_LAPSE_TRANSITION` rather than the generic `MISSING_OUTCOME_TRANSITION`, to confirm the engine picks the more specific error.

---

## ADR-08 — ARTA SLA Warning/Escalation Test Scope (K2 §21, item 8)

**Decision:** No test cases are added to K2 for ARTA SLA 80% warning/escalation behavior. This remains out of scope for this document, consistent with K2-context §1's stated testing priority order. A follow-on test suite should be planned and explicitly named once SLA monitoring's engine-side ownership is confirmed.

**Decided by:** Claude — this item is not actually an unresolved design gap; it is a scoping statement K2 §21 itself already makes ("If SLA enforcement is engine-side, it belongs in a follow-on"). There is nothing to decide here other than confirming the scoping holds, which requires no judgment call beyond restating what K2-context §1 already establishes.

**Consequence for K2:** §21 item 8 is closed by removing it from the "open items requiring resolution" framing and instead listing it under §1 ("Out of scope for this document") as a named, deliberate exclusion rather than an unresolved gap — distinguishing "we haven't decided" from "we decided this belongs elsewhere."

---

## ADR-09 — DESIG-07 Typed Error Code (K2 §21, item 9)

**Decision:** Use `UNAUTHORIZED_DESIGNATION_ISSUER` as the proposed typed error code for a non-original-authority (e.g., Platform Admin) attempting to create a designation.

**Decided by:** Claude, under the discretion Luke granted for naming a typed error consistent with the existing convention, where no source names one.

**Rationale:** Following the established `SCREAMING_SNAKE_CASE`, semantically-descriptive convention (`NO_ACTIVE_VERSION`, `FORBIDDEN`, `COMMENT_REQUIRED`, `MISSING_OUTCOME_TRANSITION`). `FORBIDDEN` alone (already used elsewhere in B4 for actor-authorization failures, e.g. §4.1, §4.2) was considered but rejected as the proposal here, because B4 already uses bare `FORBIDDEN` for a different, narrower class of check (`actor_id` not in `assigned_to`, or non-system actor submitting a scheduler-only outcome) — reusing it for this distinct "wrong category of authority entirely" case would make `FORBIDDEN` ambiguous between two different failure semantics in test assertions and error-handling code. A more specific name avoids that collision.

**Consequence for K2:** DESIG-07's expected result row is updated from "must throw; exact error type `[Unverified]`" to:

> **DESIG-07 (revised):** Platform Admin attempts to create a designation (not the original delegating authority — Mayor or Vice Mayor). **Expected:** Engine rejects with `UNAUTHORIZED_DESIGNATION_ISSUER` (proposed); no `delegation_grant` record created.

This proposed code, like the ones in ADR-02 and ADR-04, is a naming proposal pending confirmation against any future authoritative error-code registry for the `organization` module (which owns designations, per B4 §9) — it is not sourced from any of the four documents and should be confirmed before being treated as final.

---

## Summary Table

| # | Topic | Decided By | Outcome |
|---|---|---|---|
| 1 | CU revocation | Luke | Irreversible by design — no reversal path; CU-10 gets a defined expected result |
| 2 | `OPERATIVE_IN_ITS_ENTIRETY` on non-Approp. Ordinance | Luke | Throws `OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE` (proposed) |
| 3 | `COMMITTEE_CHAIR` resolution | Luke | `actor_from_context:` + Secretariat-selected lead committee at `ROUTED_TO_COMMITTEE`; parallel multi-committee deferred to Phase 2 |
| 4 | Encoder ≠ final approver — which step | Claude (discretion) | `vp_certification` carries `is_final_approval = true`; error `ENCODER_CANNOT_BE_FINAL_APPROVER` (proposed) |
| 5 | `workflow_events` immutability test | Claude (discretion) | New test `INV13-01` — DB-level UPDATE/DELETE rejection |
| 6 | `MISSING_LAPSE_TRANSITION` test | Claude (discretion) | New test `PUBVAL-01` |
| 7 | `MISSING_OUTCOME_TRANSITION` test | Claude (discretion) | New test `PUBVAL-02` |
| 8 | ARTA SLA test scope | Claude (discretion) | Reclassified from "gap" to "deliberate exclusion" — no new tests |
| 9 | DESIG-07 error code | Claude (discretion) | `UNAUTHORIZED_DESIGNATION_ISSUER` (proposed) |

---

## Items Explicitly Not Resolved Here

None. All nine §21 items have a decision recorded above. Three (`OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE`, `ENCODER_CANNOT_BE_FINAL_APPROVER`, `UNAUTHORIZED_DESIGNATION_ISSUER`) and one resolution mechanism (ADR-03's `referred_committee_id` vs. resolved-chair-ID storage choice) are flagged within their own ADRs as proposals pending confirmation against an authoritative engine error registry, rather than settled engine contracts — that distinction is preserved rather than smoothed over.