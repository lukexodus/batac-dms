# ADR-GEN-008: No-Deletion Invariant with Soft-Delete on Every Table

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

SP Resolutions and Ordinances are permanent public records under RA 7160 (Local Government Code). The Commission on Audit (COA) requires physical originals to be retained until COA formally accepts the digital record as the legal equivalent per document category — that confirmation has not yet been obtained for any category. ARTA compliance under RA 11032 requires a complete audit trail of all document processing steps. Accidental deletion of a government record creates legal exposure and violates the trust of the public the system serves.

Interview findings confirmed: all current SP documents are retained; none have been disposed of. The Secretariat has no active disposal process in practice.

RA 10173 (Data Privacy Act) creates a narrow exception: citizens may have a legal right to erasure of their personal identifying information. This is handled as a dedicated Records Management operation requiring formal legal review, not as a routine application-layer delete.

### Decision

No document, record, version, attachment, or audit entry may be permanently deleted by any user or any role — including Platform Administrators, IT Administrators, and Records Officers. Hard deletes (`DELETE` SQL statements) are prohibited in all application code for all tables. Every table carries `deleted_at TIMESTAMPTZ` and `deleted_by UUID` columns. "Deletion" in the UI sets these columns; the row remains in the database. All queries for active records must include `WHERE deleted_at IS NULL`.

Only the Records Management module may initiate disposition of records, and only via an explicit Records Officer action with a mandatory comment, after the applicable retention period has elapsed, with no active legal hold on the record. Disposition creates an audit entry; it does not remove any database row.

### Alternatives Considered

**Allow hard delete for non-legislative documents (memos, letters, complaints) after their retention period** — A graduated policy where impermanent records could be hard-deleted after retention expiry. Simpler for those record types, but creates two tiers of deletion behavior that increases implementation complexity without meaningful benefit at current scale. Retention-period disposition through the Records Management module is sufficient for all types. Rejected.

**Allow Platform Administrator hard delete with multi-step confirmation** — Even with confirmation steps, a permanent hard delete by any user is a single point of failure with no recovery path. The invariant is cleaner, more defensible in a government audit context, and eliminates an entire class of irreversible accidents. Rejected.

**No soft-delete columns — rely on the audit log to reconstruct deleted records** — The audit log records state changes but is not the primary record store; it is the tamper-evidence layer. The document record itself must be retained in the documents schema. Reconstructing a record from audit events for routine access is impractical. Rejected.

### Consequences

**Positive**

- COA compliance: no accidental or unauthorized destruction of public records
- RA 7160 compliance for all legislative records
- The complete history of any document, including "cancelled" or "archived" items, is always retrievable from the primary data store
- No legal exposure from accidental deletion by any role

**Negative / Trade-offs**

- The database grows indefinitely with soft-deleted and expired records; requires a retention-based archival strategy in the Records Management module to manage table sizes
- Every query for active records must include `WHERE deleted_at IS NULL`; a missing filter is a silent data correctness bug that returns logically deleted records
- RA 10173 PII erasure is a special exception that requires a separate legal review workflow; the system must provide this pathway, and it must nullify PII fields in place rather than deleting rows — a more complex operation than a standard application delete
- Soft-deleted records must still be protected by RLS policies; "deleted" does not mean "inaccessible to all"

**Required Follow-On Actions**

- Migration linting must enforce that every table in the application schemas has `deleted_at TIMESTAMPTZ` and `deleted_by UUID` columns; a migration that creates a table without them is a lint error
- A shared repository query helper must automatically append `WHERE deleted_at IS NULL` unless the caller explicitly uses a named bypass (which must be documented and reviewed on every PR)
- The RA 10173 PII erasure workflow must be designed as a named Records Management operation with a dedicated audit event type; it must nullify PII field values in place rather than removing rows
- Legal hold functionality must be implemented before any retention-period disposal can be activated in the Records Management module

### Related Decisions

- ADR-GEN-003 — PostgreSQL (soft-delete is a schema convention; the audit no-delete is a PostgreSQL grant enforcement)
- ADR-GEN-007 — QR Tracking Number (QR codes must survive soft-delete; a cancelled workflow's physical document may still need to be located)

---
