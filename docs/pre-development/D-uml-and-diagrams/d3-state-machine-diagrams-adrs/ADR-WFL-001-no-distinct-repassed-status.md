# ADR-WFL-001 (formerly ADR-015): No Distinct `Repassed` Workflow Instance Status — Superseded Instance Remains `Running`

`[Corrected — see ADR-WFL-003's title note for the full explanation of this project-wide
renumbering. "ADR-015" is preserved as a parenthetical alias.]`

**Status:** Accepted **Date:** 2026-06-17 **Resolves:** O-7 (D3 Appendix C) **Decision owner:** Project stakeholder (team decision) **Depends on:** ADR-014 (supersession model for repass) **Affects:** `workflow.instances.status` enum (D3 §2); D3 §2.4 note on `REPASSED`; B4 Section 4.6

---

## Context

D3 §2.4 noted that B4 Section 4.6 defines a termination outcome code `REPASSED` for which the workflow instance status is explicitly **not** set to `Completed`, but B4 left the resulting status unspecified — "remains `Running` (or a dedicated `Repassed` status — pending team decision)." This was the second half of the original O-2/O-7 pairing: O-2 settled what happens to the _document_; O-7 settles what happens to the _workflow instance_ that was driving that document.

With ADR-014 now adopted, the document-level question is resolved via supersession (`superseded_by`, `closure_reason`, a new `Superseded` document lifecycle state). The instance-level question — does the old, now-orphaned workflow instance get its own terminal `Repassed` status, or does it simply stay `Running` — was still open.

## Decision

**No `Repassed` status is added to the workflow instance enum.** When a Panlalawigan RETURNED outcome leads to supersession (ADR-014):

- The **original** workflow instance's status is left unchanged. It remains `Running` indefinitely. No event is fired against it, and no status transition occurs at the instance level as a consequence of the repass.
- A **new** workflow instance is created for the new (repassed) document, starting fresh at whatever instance-creation status is in effect per ADR-016.
- The fact that the original instance's document has been superseded is recorded **only** at the document level (`documents.superseded_by IS NOT NULL`), not at the instance level. Anyone needing to know "is this instance's document still live" must join `workflow.instances` to `documents` and check `superseded_by`.

The instance enum remains: `Created`/`Running` (pending ADR-016), `Paused`, `Completed`, `Cancelled` — unchanged from D3's original four-or-five-state draft, with no sixth value added for this case.

## Reasoning

The decision rests on one load-bearing fact, which **is** independently supported by the documents already on file: D3 itself already establishes that the document-lifecycle layer (not the instance layer) is the authoritative place to ask "is this document still active," because D3 §1.4 already states the lifecycle states are themselves milestone markers and the lifecycle status, not the instance status, is what the public portal and dashboards key off of (D3 §1, table at top: "Document Lifecycle ... DB Location: `documents.documents.lifecycle_status`"). Given that, ADR-014 already made `documents.superseded_by` the source of truth for "this document's current attempt is dead." A second, parallel "is it dead" signal at the instance layer would be redundant with that, not complementary to it.

This reasoning was part of a longer argument supplied alongside the decision, which also included claims about query simplicity, enum growth risk over a multi-year horizon, and a specific projected query pattern for "all active resolutions." Those surrounding claims are **not independently verified against any source document** — no part of the consolidated reference or D3 discusses dashboard query patterns, and the "in 5 years someone will ask whether a cancelled ordinance can also be repassed" framing is speculative scenario-building, not a documented requirement. `[Speculation]` Those parts are recorded here as the stated rationale behind the decision, not as confirmed facts about the system's future query needs.

## Consequences

**Positive:**

- One fewer enum value; the instance status enum stays exactly as small as D3 originally drafted it (modulo ADR-013's `Stuck`/`Failed` additions, which are unrelated).
- Single source of truth for "is this legislative attempt dead": the document's `superseded_by` field, not a second instance-level flag that could in principle drift out of sync with it.

**Negative / costs:**

- An instance left permanently `Running` after its document has been superseded is, on its face, a misleading signal if read in isolation — anyone querying "all `Running` instances" without also checking the joined document's `superseded_by` will see stale, dead instances counted as active. This is the direct tradeoff of the decision and is **not eliminated** by this ADR, only accepted as the cost of avoiding instance-enum growth. `[Inference — this is a genuine downside, not fully resolved by "developers will remember to join," which was asserted but not demonstrated]`
- Any future dashboard, report, or SLA query touching `workflow.instances.status = 'Running'` as a proxy for "in-progress work" must, from this point forward, also filter or join on `documents.superseded_by IS NULL` to avoid counting dead attempts. This is a new cross-cutting requirement introduced by this ADR and should be added to development guidelines, not left as tribal knowledge.

## Alternatives considered

- **Add a distinct `Repassed` terminal instance status.** This was the alternative directly weighed against the adopted decision. It would make "this instance is dead because of a repass, specifically" visible without a join, and would distinguish "repassed" from other reasons an instance might be stuck or abandoned. Rejected by the team in favor of keeping the enum lean and treating document-level supersession as the single source of truth.