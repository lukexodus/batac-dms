# ADR-API-002: Audit Log Design

**Status:** Accepted
**Date:** June 2026
**Decided by:** Development team (ratifying detail already specified in B1 and B2; formalized here per B2's Required ADRs table)
**Related documents:** B2 — Module Boundary and Internal API Contracts, Module 8 (Audit); B1 — System Architecture, Module 8 Component Diagram and Appendix B Invariant #12; Consolidated Architecture and Requirements Reference (Iteration 3), Part 11.11

---

## Context

The Audit module is the single permitted writer to the `audit` schema (B2, Module 8; B2 Prohibited Pattern P3). It must provide a tamper-evident record of all system activity sufficient to support compliance obligations under RA 11032 (ARTA) and to satisfy COA review expectations (Consolidated Reference, Part 11.19). The hash-chaining and HMAC mechanism, the database permission model, and the external timestamping approach were already specified at a high level across the Stack Context ("Audit Log Integrity"), the Consolidated Reference (Part 11.11), B1 (Module 8 Component Diagram, Appendix B Invariant #12), and B2 (Module 8 section). This ADR consolidates those specifications into a single decision record, as required by B2's Required ADRs table (ADR-API-002), and is the canonical reference going forward.

## Decision

### Hash chain algorithm

- Each audit event record stores a `chain_hash` column computed as `SHA-256(previous_chain_hash + current_event_payload)`, where `current_event_payload` is the canonical JSON serialization of the `AuditEventInput` fields (`eventType`, `actorId`, `targetId`, `targetType`, `payload`, `cityId`) plus the assigned `occurredAt` timestamp.
- The first record in the chain uses a fixed, documented genesis hash (a constant defined in the Audit module's source, not derived from any secret) rather than a null or empty previous-hash value, so that chain validation logic has no special-cased first record.
- The chain hash is computed using Node's built-in `crypto` module (`crypto.createHash('sha256')`) exclusively. No external hashing library is introduced, consistent with the Stack Context's explicit instruction ("No external library; runs server-side only").
- Chain hash computation and the `INSERT` into `audit.events` occur within the same database transaction, so a record can never exist without its chain hash, and a chain hash can never be computed without the record being persisted.

### HMAC key storage and rotation

- Each event payload is additionally signed with `HMAC-SHA-256`, using a secret key read from an environment variable (`AUDIT_HMAC_SECRET`) at process startup. The key is never stored in the database, never logged, and never included in any audit event payload itself.
- **Key rotation procedure:** Because the HMAC key is part of the chain's tamper-evidence guarantee, rotating it requires care — re-signing historical records with a new key would itself need to be an auditable, deliberate operation, not a casual config change.
  - Rotation is a manually triggered, documented runbook procedure (per Consolidated Reference Part 11.14's requirement for written, versioned, tested DR runbooks), not an automated background job.
  - On rotation: the new key is deployed via environment variable; the Audit module's HMAC Signer is updated to record which key version signed each new event going forward (an integer `hmacKeyVersion` column is added to `audit.events`); historical records remain signed with their original key version and are validated against that version's key, which must be retained (encrypted, access-restricted to LGU IT Office per the same separation-of-duties principle as backup encryption keys in Part 11.14) for as long as audit retrieval and validation must remain possible — i.e., indefinitely, given the permanent retention policy on SP Resolutions and Ordinances.
  - Rotation is itself written as an audit event (`audit.key_rotated`, recorded by the new key, referencing the prior key version) so the rotation event is part of the same tamper-evident chain.
  - Routine rotation cadence: annually, or immediately upon suspected key compromise.

### Tamper-evident vs. tamper-proof boundary statement

Per B2's explicit instruction that this distinction "must be stated verbatim in the ADR," and matching the wording already used identically in the Stack Context, B1 Appendix B, and B2 Module 8:

> **The audit log is tamper-evident, not tamper-proof.** A sufficiently privileged attacker holding both DB write access and the HMAC secret key could insert records that pass validation. This distinction is documented in the ADR for the audit log design.

This boundary is not a future improvement to be closed later by this team; it is an accepted, permanent characteristic of the design. Closing it fully would require infrastructure (e.g., a hardware security module or a separate, independently-administered signing service) outside the scope and budget of this platform. The mitigations in place — separate DB credentials for application vs. IT admin, HMAC secret held only in environment variable rather than the database, monthly external timestamping (below), and the explicit written acknowledgment requirement for digital signatures (Consolidated Reference, Part 11.1: "Both IT Director and Mayor must sign written acceptance before Phase 1 start") — reduce but do not eliminate this boundary, and that limitation must be communicated to LGU stakeholders rather than implied away.

### TSA provider selection and export schedule

- **Export schedule:** Monthly, triggered by a scheduled pgboss job (B1, Module 8: "Monthly job: compiles and exports a signed audit snapshot to RFC 3161 TSA"). The export itself is recorded as an audit event, so the act of exporting becomes part of the chain it is meant to protect.
- **TSA provider:** Not yet selected — B1 and the Stack Context both mark this "Provider to be confirmed." This ADR does not resolve the provider choice (that requires a vendor evaluation outside this document's scope), but fixes the **selection criteria** so the eventual choice is constrained:
  1. Must issue RFC 3161-compliant timestamp tokens.
  2. Must not require sending raw document content or citizen PII — only the hash/digest of the monthly export snapshot is transmitted externally, preserving the RA 10173 data-sovereignty posture already established for OCR (Stack Context, "OCR Strategy": "Cloud OCR services that send data off-premise are excluded").
  3. Must support a verifiable, independent token-validation path (i.e., the LGU is not solely dependent on the TSA provider's own verification API remaining available — the RFC 3161 standard itself guarantees this, but a provider whose tokens require a proprietary verifier is disqualified).
- **Provider confirmation is tracked as an open follow-up item**, not blocking Phase 1 development of the Audit module itself (the hash chain and HMAC layers function independently of TSA export; TSA export only extends the tamper-evidence guarantee to cover bulk deletion of *recent* un-exported records). The Audit module's `tsaExportSvc` (B1, Module 8) is built against the RFC 3161 protocol interface so any compliant provider can be substituted without code changes once selected.

## Consequences

- **Positive:** Every aspect of the audit design required to be documented in an ADR (hash chain, HMAC, boundary statement, TSA schedule) now exists in one canonical place, with the exact verbatim boundary language B2 required.
- **Positive:** Key rotation has a defined, auditable procedure rather than being an unaddressed gap — a system with permanent-retention legal documents cannot treat "what happens when we need to change the signing key" as out of scope.
- **Neutral:** TSA provider selection remains genuinely open. This ADR fixes the criteria, not the vendor, and that gap is called out explicitly rather than left implicit.
- **Negative (accepted):** The tamper-evident/tamper-proof boundary is a real, permanent limitation that must be disclosed to LGU stakeholders (Mayor, IT Director, COA reviewers) in plain terms — this ADR is the source document for that disclosure, and any stakeholder-facing summary of audit log guarantees should trace back to the verbatim statement above rather than a paraphrase that risks overclaiming "tamper-proof."
