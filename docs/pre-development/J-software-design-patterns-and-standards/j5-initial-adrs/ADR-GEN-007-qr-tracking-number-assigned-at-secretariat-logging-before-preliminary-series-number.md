# ADR-GEN-007: QR Tracking Number Assigned at Secretariat Logging, Before Preliminary Series Number


**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (confirmed by Interview 2, resolving Q-02)

---

### Context

QR codes are the physical tracking mechanism for SP Secretariat documents. When a document enters the Secretariat, a QR code label is generated and affixed to the physical document so its routing through offices can be recorded by scanning at each transfer. Tracking must begin the moment a document is logged — not when it receives a series number.

The preliminary "Draft" series number is also assigned at logging, but it is a separate event that happens after QR assignment. The preliminary number can change before finalization (see ADR-GEN-009). The final series number is assigned much later (after the last reading vote). If the QR code were tied to or dependent on the series number, it would either need to be regenerated when the series number changes, or would not exist during the early stages of the document's life — both are unacceptable.

Interview 2 confirmed the sequence explicitly, resolving Q-02: "QR code: assigned at secretariat logging, before preliminary number."

### Decision

The QR tracking number is a system-generated UUID (v4) assigned at the moment of secretariat logging, as the first operation in the logging transaction, before the preliminary series number is assigned. It is completely independent of the preliminary number, the final series number, and any control number. It is immutable for the document's entire lifecycle.

Assignment sequence: Councilor submits draft → Secretariat logs → **QR tracking UUID assigned** → Preliminary "Draft" series number assigned.

The QR code encodes only the tracking UUID — not a URL, not the series number, not document metadata. The scan result page displays document type, routing history, current status, and the first page; the series number is displayed as metadata alongside the UUID.

### Alternatives Considered

**Assign the QR code simultaneously with the preliminary series number** — Operationally close to the chosen approach but creates conceptual coupling: if the preliminary series number changes (which it can before finalization), the system must either regenerate the QR code (invalidating printed labels) or keep the QR code while the number has changed (confusing). Decoupling them entirely is cleaner. Rejected.

**Assign the QR code only at final series number assignment** — A document in the committee referral stage would have no QR code and could not be tracked physically during its longest and most complex workflow phase. This directly contradicts the purpose of QR tracking. Rejected.

**Use the series number as the QR code content** — Series numbers change (preliminary to final, and preliminary numbers can also change between readings); using them as QR content would require reprinting labels whenever the number changes. The UUID's immutability is the point. Rejected.

### Consequences

**Positive**

- Tracking begins the moment a document enters the system; physical routing is recorded from the first scan
- QR UUID is immutable; it survives preliminary-to-final number changes, VP signing, Mayor signing, Panlalawigan review, and archival without any label reprinting
- The QR scan result can display any associated number (preliminary or final) as current metadata without the UUID itself needing to change

**Negative / Trade-offs**

- Three distinct identifiers exist for a document during its active lifecycle: QR UUID, preliminary number, and eventually final number; staff must understand that these are separate identifiers serving different purposes
- UI must clearly explain the relationship between the QR UUID and the series numbers, particularly to new clerks

**Required Follow-On Actions**

- QR UUID generation must be the first database write in the secretariat logging transaction; no prior numbering or metadata assignment should precede it
- Physical QR label printing must be available immediately after logging, before any series number field is required to be present
- The QR scan result page must display the current series number (preliminary "Draft" or final) as labeled metadata alongside the UUID; the UUID itself is never the primary display identifier shown to citizens

### Related Decisions

- ADR-GEN-009 — Two-Stage Preliminary/Final Numbering (explains why the QR UUID and series number are separate and why QR precedes the series number)

---
