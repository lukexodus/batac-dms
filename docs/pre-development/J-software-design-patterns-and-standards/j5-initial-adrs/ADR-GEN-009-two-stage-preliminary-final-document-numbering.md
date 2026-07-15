# ADR-GEN-009: Two-Stage Preliminary/Final Document Numbering

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (confirmed by Interview 2, superseding Interview 1's understanding, resolving Q-01)

---

### Context

The SP Secretariat assigns legislative document series numbers in two distinct stages at two distinct lifecycle events:

**Stage 1 — Preliminary number** (at secretariat logging): A "Draft" series number is assigned when the document first enters the system (e.g., `Draft 7SP 2026-02`). This number appears in the Order of Business and on early workflow steps. It is not the final number.

**Stage 2 — Final number** (after last reading vote, before VP signs): The final series number is assigned by the Secretariat after the last reading vote — Second Reading for resolutions, Third Reading for ordinances — and before the Vice Mayor signs. The "Draft" prefix is removed. The final number reflects the order in which documents complete their last reading vote, not the order in which they were introduced. If Document A was introduced before Document B but Document B's last reading vote passes first, Document B receives the lower final number. Preliminary numbers can therefore change between the first and last readings.

Interview 1 had incorrectly understood the final number to be assigned after the Mayor signs; Interview 2 explicitly superseded this. Interview 2 also confirmed the "Draft" prefix at the preliminary stage, resolving Q-01.

The QR tracking UUID is completely independent of both numbering stages (see ADR-GEN-007).

### Decision

The document numbering data model stores a nullable `preliminary_number` field and a separately nullable-until-assignment `final_number` field. These are distinct fields, not a single "current number" field.

- **Preliminary number format**: `Draft {SP_NUMBER}SP {YEAR}-{NN}` — e.g., `Draft 7SP 2026-02`. Assigned at secretariat logging. Nullable. Can be updated before finalization.
- **Final number format**: `{SP_NUMBER}SP {YEAR}-{NN}` — e.g., `7SP 2026-01`. Assigned by the Secretariat after the last reading vote (Second Reading for resolutions; Third Reading for ordinances), before VP signs. Immutable once set. The removal of the "Draft" prefix constitutes promotion to final status.
- Number assignment events are named, distinct, audit-logged workflow actions.
- `{SP_NUMBER}` (currently `7` for the 7th Sangguniang Panlungsod) is a configurable system parameter, not a hardcoded string.
- All document number formats use a space as the delimiter between prefix, year, and sequence number: `Draft 7SP 2026-02`, `SPR 2026-01`, `MO 2025-01`.
- A separate PostgreSQL sequence per document type per year; sequences do not reset mid-year and cannot be decremented.

### Alternatives Considered

**Assign the final number at secretariat logging** — Simpler (single number from intake) but operationally incorrect: the Secretariat cannot determine the final approval order at intake. If Document A is logged first but Document B is approved first, Document A's number would need to change after it appeared in the Order of Business and on physical printouts, creating confusion and invalid references. Rejected.

**Assign the final number after the Mayor signs** — This was the Interview 1 understanding. Interview 2 explicitly corrected it: the Secretariat assigns the final number after the last reading vote, before VP and Mayor sign. Using post-Mayor assignment would delay final number availability and would mean VP-signed copies carry no series number — which does not reflect actual practice. Rejected (superseded by Interview 2).

**Single "current number" field that changes from preliminary to final** — Simpler schema but loses the history of what the preliminary number was. Queries that need to look up a document by its preliminary number (as it appeared in an earlier Order of Business) would fail. The audit log would retain the history, but separate fields are more practical for operational queries. Rejected.

### Consequences

**Positive**

- Accurately models SP Secretariat operational practice
- Final number sequence reflects the true legal order of approval, not the order of introduction
- Documents are trackable by QR UUID and preliminary number well before their final number is known
- Configurable `{SP_NUMBER}` parameter supports new SP administrations (8th SP, 9th SP) without code changes

**Negative / Trade-offs**

- Two distinct number fields in the data model; lookup queries ("find document by number") must search both preliminary and final number fields
- UI must clearly communicate the "Draft" vs. final status distinction and explain that a document's number can change before finalization — this requires clear UX design and clerk training
- When the preliminary number changes, any physical printouts (cover sheets, Order of Business pages) that showed the old preliminary number are outdated; the system should prompt for a new cover sheet print after a preliminary number update

**Required Follow-On Actions**

- The `number_series` configuration must include `{SP_NUMBER}` as a Platform Administrator-configurable parameter, updated at each new SP administration without a code change or migration
- The workflow engine must enforce that final number assignment is only permitted after the last reading vote step has completed; premature assignment must be rejected with a clear error
- Both the preliminary number assignment and the final number assignment (promotion) must produce dedicated named audit events with the assigning user, timestamp, and assigned value

### Related Decisions

- ADR-GEN-007 — QR Tracking Number Assigned Before Preliminary Number (QR UUID is independent of both numbering stages)

---
