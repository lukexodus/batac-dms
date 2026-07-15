# ADR-GEN-004: Pessimistic Locking for Document Editing


**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

The SP Secretariat has multiple clerks who work simultaneously. Documents in active workflow carry legal weight: a partially overwritten resolution or an ordinance where two clerks' edits conflict creates ambiguity in the official record. All document versions are retained permanently (see ADR-GEN-008); merge conflicts cannot be silently discarded.

The realistic concurrency pattern is low: at most two or three clerks would simultaneously access the same document in exceptional circumstances. The goal is to prevent the collision entirely rather than detect and resolve it after the fact.

### Decision

Pessimistic locking is used for document editing. When a user opens a document for editing, an exclusive lock is acquired. Other users see an informational notice identifying the lock-holder. The lock has a 15-minute timeout (configurable per document type). The lock is released on save, on explicit user release, or on timeout. Admin force-release is available and is audit-logged with a mandatory reason.

### Alternatives Considered

**Optimistic locking** — Allows concurrent edits and detects conflicts at write time via a version counter. Appropriate for collaborative editing scenarios where merge is acceptable. For official government documents where every state change is audited and the document's integrity is a legal matter, a conflict error requiring a clerk to manually reconcile two versions of a legislative measure introduces procedural risk. Rejected.

**No locking (last write wins)** — Unacceptable; concurrent edits would silently overwrite each other, producing a document whose final state reflects only one of the concurrent edits with no indication that the other was lost. Rejected immediately.

**Real-time collaborative editing (CRDT or OT)** — Operational transforms or CRDTs allow multiple users to edit simultaneously with automatic merge. The technical complexity is high, and no scenario in the SP Secretariat requires two clerks to simultaneously type into the same document in real time. The complexity is not justified by the use case. Rejected.

### Consequences

**Positive**

- Prevents conflicting concurrent edits on official documents; no manual conflict resolution required
- Lock timeout (15 minutes) prevents indefinite blocking if a user abandons a session without saving
- The lock-holder notification enables clerks to coordinate: "Mia has this document open; try again in a few minutes"

**Negative / Trade-offs**

- If a user's session dies without releasing the lock, other users wait up to the timeout duration
- Requires a lock management UI: show who holds the lock, when it expires, and an admin force-release action
- Admin force-release must be audit-logged with a mandatory reason; force-releasing a lock on an unsaved document discards that user's changes
- Timeout value requires calibration; 15 minutes is the default but some complex ordinances may require longer edit sessions

**Required Follow-On Actions**

- Implement lock TTL cleanup as a scheduled job that sweeps and releases expired locks at regular intervals (every minute)
- Admin interface must show all currently held locks with lock-holder identity and expiry time
- Lock acquisition and release events must each produce a dedicated audit log entry
- Document the force-release procedure in the Records Officer training guide

### Related Decisions

- ADR-GEN-008 — No-Deletion Invariant (all versions are retained; conflicts cannot be discarded, which is part of why pessimistic locking is preferred)

---
