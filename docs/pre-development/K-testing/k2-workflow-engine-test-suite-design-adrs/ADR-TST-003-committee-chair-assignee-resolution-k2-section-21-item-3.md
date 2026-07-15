# ADR-TST-003: COMMITTEE_CHAIR` Assignee Resolution (K2 §21, item 3)

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
