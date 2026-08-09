# ADR-UI-007: Designation Document Type — Pulled Into Phase 1

**Status:** Accepted
**Date:** 2026-06-19
**Resolves:** F1 §14 gap #7 (also referenced in F1 §9; F1-Context §6, §9)
**Decision owner:** Luke (product/architecture owner)

## Context

F1-Context describes Session Attendance Tracking's "designated substitute" field — used when the Vice Mayor (SP Presiding Officer) is absent and a presiding officer is designated beforehand — as requiring a Designation document `[Confirmed — F1-Context §6]`. Both source files independently place the Designation document type itself in Phase 1B, not Phase 1 `[Confirmed — F1-Context §12; I2 §13]`. This created a direct dependency tension: a confirmed Phase 1 view (Session Attendance) textually depends on a document type that, per both sources' own exclusion lists, does not exist yet in Phase 1.

F1 declined to resolve this on its own, flagging three possible directions (plain read-only field with no linkage, blocked/hidden field, or some other resolution) without picking one.

## Decision

**Implement the Designation document type in Phase 1**, rather than working around its absence.

## Rationale

This resolves the dependency tension directly rather than building a workaround (a plain unlinked text field, or hiding the substitute-officer field) that would need to be revisited once Designation eventually ships. Building the dependency once, now, avoids a planned rework of the Session Attendance Detail view later.

## Consequences

- `[Inference]` The Designation document type — previously Phase 1B in both source files — needs its own document-type schema, intake/lifecycle handling, and at minimum a way to "log Designation document (extract scope, enter in system)," which I2's matrix already lists as an SP-Secretary-only permission `[Confirmed — I2, Section 4, "Log Designation document" row]` (this permission existed in source already; only the document type's overall phase placement changes here).
- `[Inference]` Other Phase-1B items that were grouped with Designation in the source exclusion lists (Barangay Resolution/Budget workflows; Letters/Memos/NCH/NOSP document types) are **not** affected by this decision — this ADR pulls forward Designation specifically, not the entire Phase 1B bucket. If Designation's underlying document-type infrastructure is shared with these other Phase-1B types, that overlap should be assessed separately; it is not addressed here.
- `[Unverified]` Whether "Designation scope confirmation by Platform Admin" — explicitly **not required**, per F1-Context §9's note that Interview 2 superseded the prior design including this step — remains accurate once Designation is built in Phase 1 rather than Phase 1B should be reconfirmed with stakeholders, since that decision was made in the context of Designation being a later-phase item.
- Session Attendance Detail (`/sessions/:sessionDate`, F1 §9) can now show the designated-substitute field with a genuine Designation-document linkage, rather than a placeholder.
- This is one of six scope items pulled into Phase 1 in this decision pass (see ADR-UI-002 consequences, corrected in this same pass, for the combined cumulative-scope note). `[Corrected — previously said "four"]`
- F1 §9 and §14 gap #7's tension/`[Unverified]` status are superseded by this ADR.

## Alternatives considered

- **Plain read-only substitute-officer field, no Designation-document linkage in Phase 1.** Lower scope, ships faster, but means the field displays a name with no underlying document trail — a workaround that would need revisiting once Designation ships in a later phase. Not selected.
- **Hide/block the field until Designation ships.** Avoids displaying unlinked data, but leaves Session Attendance Detail incomplete for the absence-substitution scenario in the interim. Not selected.

## Traceability

- F1-Context §6 (Session Attendance Tracking, "Designated substitute" row), §9 (Designation scope confirmation note), §12 (Phase 1B exclusion list)
- I2 §4 ("Log Designation document" permission row), §13 (exclusion log, Designation rows)
- F1 §9, §14 gap #7
