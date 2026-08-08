# ADR-WFL-003 (formerly ADR-013): Split `Pending Approval` Into `Pending Mayor Action` and `Pending Panlalawigan Review`

`[Corrected — this file's own title previously said only "ADR-013," predating a project-wide
reorganization from flat sequential ADR numbering to the current domain-prefixed scheme. The
filename and the ADR Master Index (J5) both already used the canonical ADR-WFL-003 ID; this
heading is now updated to match. "ADR-013" is preserved as a parenthetical alias since it's
the name used throughout D3, H1, K2, and C1's existing prose — those citations remain valid
and are not being mass-rewritten, since they already link/point to this same file correctly.]`

**Status:** Accepted **Date:** 2026-06-17 **Resolves:** O-1 (D3 Appendix C) **Decision owner:** Project stakeholder (team decision, not a stakeholder-interview finding) **Affects:** `documents.documents.lifecycle_status` enum; D3 §1; D3 Appendix D; dashboard status display; public portal status display

---

## Context

D3's draft Document Lifecycle state machine defined a single `Pending Approval` state covering two legally and operationally distinct waiting periods for SP Resolutions and Ordinances:

1. The Mayor's 10-day review window (RA 7160 §47/§54), during which the Mayor may sign, veto, or allow lapse-into-law.
2. The Sangguniang Panlalawigan's 30-day review window (RA 7160 §56(d)), which only begins **after** the Mayor has acted (sign or lapse) — see consolidated reference Part 4.3, "Sequence: Transmission occurs AFTER Mayor action."

D3 §1.2 flagged this collapsing as `[Inference: exact step mapping per document type]` — it was never stakeholder-confirmed, and the consolidated reference does not state whether these two waits should share one lifecycle bucket or have separate ones.

This had concrete downstream effects: the SP Secretary dashboard, the Mayor dashboard, and the public portal all need to render _some_ status string while a document is waiting, and "Pending Approval" alone does not tell a dashboard viewer or a citizen which of two very different waits — and which external party — the document is currently waiting on.

## Decision

`Pending Approval` is removed from the lifecycle enum and replaced by two sequential, non-terminal states:

- `Pending Mayor Action`
- `Pending Panlalawigan Review`

These are strictly sequential for Resolutions and Ordinances: a document transitions `In-Workflow → Pending Mayor Action → Pending Panlalawigan Review → Completed`. There is no direct `In-Workflow → Pending Panlalawigan Review` edge, and no skipping `Pending Mayor Action`, because Panlalawigan transmission cannot occur before Mayor action per the confirmed sequence in Part 4.3.

For document types that have no Panlalawigan review step (Designations, Memos, Letters, Notices — see Part 4.16, 4.6–4.11), only `Pending Mayor Action` is relevant in practice, or neither state is entered at all if the document type has no external-authority waiting period; the workflow definition for that document type simply does not route through `Pending Panlalawigan Review`. The enum value remains globally defined (lifecycle status is a generic per-document-record column, per D3 §1), but its applicability is workflow-definition-specific.

### Revised state set

`Draft`, `Submitted`, `In-Workflow`, `Pending Mayor Action`, `Pending Panlalawigan Review`, `Completed`, `Released`, `Archived`, `Disposed`, `Cancelled`.

### Revised transition table (delta from D3 §1.3 only)

|From|To|Event|Guard Conditions|Notes|
|---|---|---|---|---|
|`In-Workflow`|`Pending Mayor Action`|`APPROVAL_STEP_REACHED`|All preceding internal workflow steps terminal; VP has signed certified copy; Transmittal Letter generated|Renamed from the prior `In-Workflow → Pending Approval` edge. Final series number already assigned at this point (Part 5.2).|
|`Pending Mayor Action`|`In-Workflow`|`APPROVAL_RETURNED`|Mayor vetoes; override vote step activates|Unchanged in spirit from D3's prior `Pending Approval → In-Workflow`, now scoped explicitly to the Mayor leg.|
|`Pending Mayor Action`|`Pending Panlalawigan Review`|`MAYOR_ACTION_RECORDED`|Mayor has signed, OR 10-day lapse recorded (RA 7160 §47), OR veto override succeeded (8/12 vote)|**New transition**, replacing the implicit "both waits in one bucket" model. Document is transmitted to Panlalawigan in the same step that fires this event (Part 4.3: "Transmission occurs AFTER Mayor action").|
|`Pending Mayor Action`|`Cancelled`|`DOCUMENT_CANCELLED`|Elevated authorization; mandatory reason|Covers terminal veto-override failure and administrative withdrawal during the Mayor wait — same semantics as D3's prior entry, rescoped.|
|`Pending Panlalawigan Review`|`In-Workflow`|`APPROVAL_RETURNED`|Panlalawigan RETURNED outcome triggers repass|See ADR-014 for the full repass/supersession mechanics. This edge specifically governs the _original_ document's transition when it is closed out as superseded.|
|`Pending Panlalawigan Review`|`Completed`|`FINAL_APPROVAL_GRANTED`|Panlalawigan returns VALID, VALID-IN-PART (resolved), OPERATIVE-IN-ITS-ENTIRETY, or DEEMED APPROVED (30-day lapse, RA 7160 §56(d))|Mirrors D3's prior `Pending Approval → Completed` edge, rescoped to the Panlalawigan leg only.|
|`Pending Panlalawigan Review`|`Cancelled`|`DOCUMENT_CANCELLED`|Elevated authorization; mandatory reason|Administrative withdrawal during Panlalawigan wait.|

No other part of D3 §1's transition table changes. The `Draft → Submitted`, `Submitted → In-Workflow`, `Completed → Released`, `Released → Archived`, `Archived → Disposed`, and all `→ Cancelled` edges from D3 are unaffected by this ADR.

## Consequences

**Positive:**

- Dashboards and the public portal can render an accurate, specific status ("Awaiting Mayor's signature" vs. "Under provincial review") without a secondary lookup into the workflow engine's step instances.
- The SLA/ARTA tracking distinction between the two legally distinct clocks (10-day vs. 30-day) is now visible at the lifecycle layer, not only buried in workflow step metadata.
- Removes a `[Inference]`-flagged ambiguity that was blocking workflow definition authoring for Resolutions and Ordinances.

**Negative / costs:**

- Every workflow definition for Resolutions, Ordinances, and Appropriation Ordinances must be authored against the two-state model from the start; this is a one-time authoring cost, not an ongoing one.
- The enum now has 10 values instead of 9; any code or query written against D3's earlier draft enum (none exists yet, since D3 was pre-migration) needs no retrofit, but documentation referencing the old 9-value set (the original D3 upload) is now superseded by this ADR and the revised D3 document issued alongside it.

## Related, separately-decided item: SLA clock behavior during `Paused`

This ADR does not govern the `Paused` _workflow instance_ state (a different state machine — see D3 §2). For completeness: the team has separately decided that the ARTA SLA clock continues running, unmodified, while an instance is `Paused` — the same rule as for system outages (consolidated reference Part 11.15: "ARTA compliance obligations do not pause during system outages"). No `sla_paused_at` field, no elapsed-time-minus-paused-duration computation, and no special-casing is implemented. This closes O-3 from D3 Appendix C without further engineering work beyond what D3 already specified for outage handling.

This is a **policy decision about legal interpretation**, made by the project team, not a result derived from a confirmed stakeholder statement or written legal opinion. It should be reviewed by City Legal or DPO-equivalent counsel before Production Rollout, consistent with the general COA/Legal engagement requirement in consolidated reference Part 11.19. `[Inference — team policy decision, not a verified legal conclusion. Disclaimer: this does not constitute legal advice and is not guaranteed to withstand a legal challenge if the administration-transition pause scenario is ever contested.]`

## Alternatives considered

- **Keep single `Pending Approval` state, disambiguate via a side-channel field** (e.g., `pending_approval_type`). Rejected: this reintroduces exactly the indirection this ADR exists to remove — dashboards would still need a second lookup, just against a different column instead of the workflow engine.
- **Model as three states** (`Pending Mayor Action`, `Pending Override Vote`, `Pending Panlalawigan Review`) to give the veto-override window its own bucket. Rejected for now: the override vote is a workflow-internal step (it loops back through `In-Workflow` per the existing `APPROVAL_RETURNED` edge), not a wait on an external authority in the same sense as the Mayor or Panlalawigan legs. Revisit only if dashboard requirements later demand a distinct "override pending" status.