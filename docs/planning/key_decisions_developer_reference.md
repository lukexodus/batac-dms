# Batac City LGU Platform — Key Decisions Reference
**For Developer Use Only | Pre-Requirements Gathering Baseline**

> All items in this document represent decisions already made prior to formal requirements
> gathering. They reflect the developer's informed architectural choices, not yet validated
> by LGU stakeholders. Decisions may be revised after requirements gathering, but the
> architectural invariants (Section 16) are protected by design and are expensive to change.
>
> Remaining gaps and unresolved questions are covered in `02_gap_analysis_and_architecture_review.md`.

---

## 1. Project Identity and Scope

| Decision | Detail |
|---|---|
| Platform name | Batac City LGU Platform |
| Platform type | LGU-wide government operations platform — not a narrow DMS |
| Target LGU | Batac City, Ilocos Norte, Philippines |
| LGU scope | SP Office, Mayor's Office, City Hall departments, Barangays, Citizens |
| Multi-LGU | Batac-specific for now; configuration documented for potential adaptation |
| Legal source of truth | Physical documents remain the legal source of truth |
| Operational source of truth | Digital system is the operational source of truth for tracking, workflow, reporting |

### Module Priority Order

| Priority | Module | Phase |
|---|---|---|
| 1 | Document Management System (DMS) | Phase 1 |
| 2 | Document Tracking System (DTS) | Phase 1 |
| 3 | Workflow Management System (WMS) | Phase 1 (engine only; SP workflow) |
| 4 | Records Management System (RMS) | Phase 2 |
| 5 | Government Portal | Phase 3 |

### Phase 1 Minimum Viable Scope

The smallest scope that proves architecture and delivers SP Secretary value:

1. IAM (users, roles, RBAC + office scoping, sessions)
2. Organization module (offices, positions, assignments — admin-managed)
3. Document Core (upload, version, classify, SP Resolution numbering series)
4. Workflow Engine (linear + simple branching; SP Resolution workflow only)
5. Document Tracking (QR generation, basic cover sheet, routing history)
6. In-app notifications (step assignment, overdue alerts)
7. SP Secretary dashboard (queue, pending actions)
8. Mayor dashboard (pending signatures)
9. Audit log (append-only, hash-chained, INSERT-only DB permissions)
10. Infrastructure (PostgreSQL, S3-compatible storage, Docker, Terraform, backup)

SP Ordinance workflow is Phase 1B — build after Resolution workflow is validated.

---

## 2. Technology Stack

### Frontend

| Technology | Role | Decision |
|---|---|---|
| React (TypeScript) | Core UI framework | Selected |
| Vite | Build tool | Selected |
| TanStack Query | Server state (API data, caching, sync) | Selected |
| Zustand | Minimal client UI state | Selected |
| shadcn/ui + Radix UI | Component library | Selected |

- Internal authenticated app: React SPA (no SSR needed).
- Public portal: Next.js acceptable for SEO where needed (Phase 3).
- No Vue, Angular, or Svelte — Philippine developer talent pool is significantly smaller.

### Backend

| Technology | Role | Decision |
|---|---|---|
| Node.js | Server-side runtime | Selected |
| TypeScript | Type safety across frontend and backend | Mandatory — non-negotiable for a 10-year codebase |
| Fastify | REST API framework | Selected over Express (faster, better schema validation, plugin architecture) |

### Database and Storage

| Technology | Role | Decision |
|---|---|---|
| PostgreSQL 16+ | Primary relational database | Selected — no competing alternative for this use case |
| Cloudflare R2 (Phase 1) → MinIO (on-premise) | Object storage for files | S3-compatible API only — no provider-specific SDKs |
| pgboss | Job queue (PostgreSQL-backed) | Phase 1 — no Redis or RabbitMQ overhead |
| Meilisearch | Full-text search | Phase 2 — PostgreSQL tsvector for Phase 1 |

### Authentication Libraries

| Technology | Role |
|---|---|
| bcrypt | Password hashing |
| OAuth 2.0 with PKCE | Authorization framework architecture |
| JWT | Access tokens (short-lived) |

### Deployment

| Technology | Role |
|---|---|
| Docker | Container runtime |
| Terraform (or Pulumi) | Infrastructure as code — mandatory from day one |
| Nginx or Caddy | Reverse proxy + TLS termination |

---

## 3. Architecture Pattern

**Selected pattern: Modular Monolith with Internal Event Bus**

Rationale: Microservices at 100–250 users with a 4-person team is an operational
anti-pattern. The modular monolith gives clean domain separation with an extraction
path to services if needed. The internal in-process event bus decouples modules without
distributed systems overhead.

### Module Boundaries

Each module owns its own PostgreSQL schema. Modules communicate only through:
- The internal in-process event bus
- Published module API interfaces

No module reads another module's schema directly. No cross-schema foreign key constraints.

```
Modules:
  iam           → users, credentials, sessions, roles, permissions
  organization  → offices, positions, employees, assignments, delegations
  documents     → document types, documents, versions, attachments, numbers, signatures
  workflow      → definitions, versions, steps, instances, step instances, events
  tracking      → tracking records, routing entries, QR codes
  records       → records, retention schedules, archive entries, classification
  notifications → templates, events, delivery logs
  audit         → events (append-only, hash-chained)
  search_meta   → search index metadata (Phase 2)
  portal        → public documents, citizen requests, complaints, announcements (Phase 3)
  reporting     → report definitions, schedules, outputs (Phase 2)
```

### Architectural Laws (Non-Negotiable)

1. Each module owns its own PostgreSQL schema. No cross-schema foreign key constraints.
2. Modules communicate through the event bus or published module APIs only. Never by direct schema access.
3. Audit writes go through the audit service only. No module writes directly to the audit schema.
4. All file references are UUID storage keys. Never original filenames.
5. All infrastructure is defined in code. No manual cloud resource creation.

---

## 4. Authentication and Session Management

### Token Architecture

| Decision | Value |
|---|---|
| Access token type | JWT |
| Access token expiry | 15–60 minutes |
| Refresh token storage | Server-side database table (hashed value) — never in the token itself |
| Cookie attributes | HTTP-only, Secure, SameSite=Strict |
| Client-side storage | Never localStorage or sessionStorage — cookies only |

### MFA

| Decision | Value |
|---|---|
| Architecture | MFA flow designed from day one; second-factor challenge response supported |
| Phase 1 | TOTP not enabled but auth flow accommodates it |
| Phase 2 | TOTP (Time-based One-Time Password) enabled |
| Required immediately | For Mayor, SP Secretary, Department Heads, Platform Administrator, IT Admin |

### Session Policy

| Decision | Value |
|---|---|
| Standard user timeout | 30 minutes of inactivity |
| Timeout warning | At 25 minutes |
| Concurrent sessions | One active session per user |
| New login from different device | Logs out previous session; notification sent to user |
| Forced logout | IT/security admin can force-terminate any session (audit-logged with reason) |
| Mobile app | Session refreshed on app open, not during active use |
| Service accounts | Exempt from timeout with approval + monitoring |

### Password Policy

| Decision | Value |
|---|---|
| Minimum length | 12 characters |
| Complexity | Required |
| Reuse | Last 5 passwords blocked |
| Forced rotation | On first login and for all privileged accounts |

### Shared Workstations

City Hall employees likely share workstations. Implement a "Switch User / Lock Screen"
action that suspends the current session without terminating it, allowing the next user
to log in on the same device.

---

## 5. Authorization Model

**Selected model: ABAC (Attribute-Based Access Control) with RBAC as the simplified entry point**

Pure RBAC cannot express office-scoped rules (e.g., a Department Head may approve only
documents from their own department) without creating exponential role combinations.
ABAC policies express this naturally.

Start with RBAC-style role assignments. Evaluate ABAC policies at request time. Enforce
PostgreSQL Row-Level Security as a second data-isolation layer.

### Authorization Tiers

**Tier 1 — System-level (hardcoded, developer-only change)**
- Audit log read access
- Backup and restore operations
- Schema migrations
- Encryption key management

**Tier 2 — Platform Administrator (no developer required)**
- Role definitions and permission assignments
- Workflow definitions (create, version, publish, deprecate)
- Document type definitions and metadata schemas
- Office hierarchy management
- Notification template management
- Retention schedule management
- SLA threshold configuration
- Escalation target configuration
- Document numbering series configuration
- Report definition configuration
- Which document types and fields are publicly visible

**Tier 3 — Instance-level (resolved at runtime)**
- Current workflow step assignee (only the current step actor may act)
- Document owning office (office members may view their office's documents)
- Document classification (confidential documents: restricted to explicit allowlist)
- Explicit document share grants (future)

### Critical Separation

**IT admin must NOT have read access to confidential or restricted documents.**
This is enforced at the database permission level, not only in application logic.
Separate DB credentials for app runtime vs. IT admin.

### Platform Administrator Restrictions

The Platform Administrator role must not be combined with any document-processing role
(Encoder, Approver, SP Secretary, etc.). An operational user with Platform Administrator
access can modify the workflow that processes their own documents — a conflict of interest.

---

## 6. Database Architecture

### Core Conventions (Invariants)

| Convention | Decision |
|---|---|
| Primary keys | UUID v4 (`gen_random_uuid()`) everywhere — no integer IDs on any entity exposed externally |
| Timestamps | `TIMESTAMPTZ` on every timestamp column — no `TIMESTAMP WITHOUT TIME ZONE` |
| Soft-delete | `deleted_at TIMESTAMPTZ` + `deleted_by UUID` on every table — no hard deletes anywhere |
| Tenant isolation | `city_id UUID NOT NULL` in all core entity tables (default: Batac City UUID) |
| Cross-schema FKs | Prohibited — enforced by automated migration linting |

### Schema Map

```
schema: iam           → users, credentials, sessions, refresh_tokens, roles, permissions, mfa_records
schema: organization  → offices, positions, employees, assignments, delegations
schema: documents     → document_types, documents, versions, attachments, numbers, number_series, signatures
schema: workflow      → definitions, definition_versions, steps, transition_rules, instances, step_instances, workflow_events
schema: tracking      → tracking_records, routing_entries, qr_codes
schema: records       → records, retention_schedules, archive_entries, classification_rules, dispositions
schema: notifications → templates, notification_events, delivery_log
schema: audit         → events (append-only; INSERT-only DB permissions)
schema: search_meta   → index_metadata, index_jobs (Phase 2)
schema: portal        → public_documents, citizen_requests, complaints, announcements (Phase 3)
schema: reporting     → report_definitions, schedules, outputs (Phase 2)
```

---

## 7. Object Storage

| Decision | Value |
|---|---|
| API | S3-compatible API exclusively — no provider-specific SDKs in any codebase |
| Phase 1 provider | Cloudflare R2 (no egress fees) |
| On-premise / future | MinIO (self-hosted, fully S3-compatible — migration = endpoint URL change) |
| File key format | UUID (never original filename) |
| Original filename | Stored as metadata in PostgreSQL only |
| Supported formats | PDF, DOCX, XLSX, images (PNG, JPG) |
| Max file size per upload | 25MB per file (configurable) |
| S3 versioning | Enabled |

---

## 8. Document Management (DMS)

### Document Lifecycle States

```
Draft → Submitted → In-Workflow → Pending Approval → Completed → Released → Archived → Disposed
```

Cancelled is a terminal state reachable from any active state by an authorized actor.

### Classification Levels

| Level | Description | Access |
|---|---|---|
| Public | Approved resolutions, published ordinances, public announcements | All users + public portal |
| Internal | Inter-department memos, drafts, working documents | Authenticated LGU employees |
| Confidential | Citizen complaints with PII, performance reviews | Restricted to explicit role allowlist |
| Restricted | Fiscal records, legal opinions | Restricted to explicit role allowlist |

- Default classification per document type: configurable.
- Classification gate is hardcoded: portal never exposes non-Public documents regardless of portal configuration.

### Document Versioning

- Previous versions are always retained — no overwrite.
- Version history is accessible to authorized users.
- The official copy of a document is the version explicitly marked as released.

### Cover Sheet and QR Code

- QR code content: unique document tracking ID only (never document content or full URL).
- Cover sheet: separate page (not overlaid), auto-generated on print.
- Cover sheet metadata: author, date, approvers, retention schedule.
- Metadata fields on cover sheet: customizable per document type (Phase 1: standard fields; Phase 2: full customization).

### Physical-to-Digital Correspondence

When a physical document is printed, wet-ink signed, and scanned back:
- System flags the scanned image for manual verification.
- Records Officer verifies: visual integrity, signature authenticity, no alterations.
- Verified → accepted as official scanned copy.
- Anomaly detected → returned for clarification.
- Unverified physical copies cannot be accepted as official.

### Bulk Operations (Records Officers Only)

- Approved: bulk archive, bulk search, bulk export.
- Required safety guards: confirmation dialog + dry-run preview before execution.
- Undo: Phase 2.
- Each item in a bulk action is individually logged in the audit trail (not at batch level).
- No bulk-delete operations permitted.
- Bulk exports limited by classification level.

### Data Export

- Formats: CSV, JSON, XML (priority); SQL dump, PDF (secondary).
- Document format: original (PDF) or converted (user choice).
- Audit trail inclusion: optional export field.
- Admin defines exportable vs. non-exportable by classification level.
- Export event logged in audit trail: who exported, when, what.

---

## 9. Document Numbering

| Decision | Value |
|---|---|
| Assignment event | At approval/certification step only — never at draft creation |
| Uniqueness | DB unique constraint: series + year + number |
| Gaps | Permitted only for cancelled documents; each gap logged with cancellation reason |
| Year prefix | Both options available per series: yearly (2026-001) or continuous (001, 002, ...) |
| Series ownership | Office-owned (configurable "Series Authority" per series) |
| Number immutability | Assigned numbers are immutable — no editing by any user or role |
| Reuse | Numbers are never reused, even if the document is cancelled |

---

## 10. Workflow Engine (WMS)

### Core Design

| Decision | Value |
|---|---|
| Implementation | Custom domain-specific engine (not Camunda, Temporal, or Flowable) |
| Admin-configurable | Yes — no developer involvement for workflow changes |
| Version pinning | Instance pins to definition version active at creation — DB-enforced |
| In-flight migration | Option A (continue under old version) or Option B (admin migrates) |
| Option B constraints | Requires 2nd-level approval from City Administrator; mandatory reason; 24-hour reversible window; dedicated audit event recording pre/post state |
| Parallel steps | Not in Phase 1; step type reserved in data model for Phase 2 |
| Branching | Supported (conditional next step) |
| Loop-back | Supported (rejection returns to earlier step) |
| Merging | Simple merge supported in Phase 2 |
| Cancellation | Requires mandatory reason; logged; cancelled status is terminal |

### Step Types

| Type | Description | Phase |
|---|---|---|
| action | User performs an action (review, comment) | Phase 1 |
| approval | User approves, rejects, or returns for revision | Phase 1 |
| decision | System evaluates a condition and routes accordingly | Phase 1 |
| notification | System sends a notification; no user action required | Phase 1 |
| termination | Ends the workflow | Phase 1 |
| parallel_split | Splits into parallel branches | Phase 2 (reserved in data model) |
| parallel_join | Merges parallel branches | Phase 2 (reserved in data model) |

### SLA and Escalation

- SLA clock starts at workflow initiation.
- Escalation warning at 80% of SLA time.
- Automatic escalation at SLA breach: notify supervisor + Records Officer.
- SLA thresholds configurable per document type per step.
- ARTA defaults: simple ≤ 3 working days, complex ≤ 7 working days, highly technical ≤ 20 working days.

### Workflow Validation Constraints (Hardcoded, Not Configurable)

Certain document types have legally mandated minimum steps. The workflow editor validates
these constraints before allowing a definition to be published. Violation = rejected.

| Document Type | Minimum Required Steps |
|---|---|
| SP Ordinance | Committee referral, 3 readings, vote, VP certification, release |
| SP Resolution | Committee referral (if applicable), vote or approval, VP certification, release |
| Executive Order | Legal review, Mayor signature, release |

### Workflow Definition States

```
Draft → Published (Active) → Deprecated
```

- Definitions are never modified. A new version is created and published.
- Old versions are deprecated, not deleted.
- In-flight instances under deprecated versions complete under their pinned version.

### Assignee Resolution

Step assignees are resolved at runtime from:
- Role rule (anyone with role X in office Y)
- Specific user assignment
- Office queue (any member of a specific office)
- Dynamic expression (based on document attributes)

A step can never be assigned to a user who does not exist in the organization module.

### Mayor's 10-Day Lapse-into-Law Rule

For SP Ordinances: if Mayor does not act within 10 calendar days, the system
automatically transitions the document to "Lapsed into Law" status and notifies the
SP Secretary. Timer is configurable per document type.

---

## 11. Document Tracking (DTS)

| Decision | Value |
|---|---|
| QR content | Unique tracking ID only (not a URL, not document content) |
| Tracking number format | Configurable; default: `DTS-{YEAR}-{SEQUENCE}` |
| Routing history | Every movement recorded: from, to, actor, timestamp, action |
| Physical custody | Tracked separately from digital workflow status |
| Scan-to-lookup | Scanning the QR code opens the document's status/routing history |

---

## 12. Records Management (RMS)

### No-Deletion Policy

**No document may be permanently deleted by any user or role.** Only authorized
disposition via the Records Management module is permitted. Disposition creates an
audit record — not a data deletion. The metadata row for a disposed record is never
deleted; it is marked as disposed with actor and timestamp.

### Retention Defaults (Configurable; to be confirmed with COA/DILG)

| Category | Retention |
|---|---|
| SP Resolutions, Ordinances | Permanent |
| Signed contracts, financial records | Permanent |
| Personnel records | 10–15 years |
| Correspondence with citizens | 10–15 years |
| Permit/license files | 10–15 years |
| Internal memos | 5 years |
| Non-critical meeting minutes | 5 years |
| Routine workflow logs (not audit logs) | 1 year |
| Draft versions (final approved version kept) | 1 year |

### Disposition Rules

- Retention cannot be shortened for a document under a legal hold.
- Every document type must have a retention schedule assigned before activation.
- Disposition requires Records Officer action with mandatory comment.
- No automated disposal without explicit human authorization.
- Archival review triggered at 80% of retention period.

### RA 10173 Erasure Exception

For citizen PII under Data Privacy Act erasure requests:
- Requires formal legal review (City Legal / DPO) before erasure.
- Erasure scope: PII in metadata fields AND PII in document files (file-level redaction, not just metadata deletion).
- Administrative and workflow records: archived, not erased.
- Each erasure creates a dedicated audit record with legal basis, approver, and scope.

---

## 13. Audit Log Architecture

| Decision | Value |
|---|---|
| Schema | Separate `audit` schema; append-only |
| DB permissions | Application audit user has INSERT-only on audit schema. No UPDATE, no DELETE. |
| Hash chaining | SHA-256; each entry includes hash of previous entry |
| HMAC | Applied to each payload with a secret key |
| External timestamp | Monthly export; RFC 3161 TSA (provider to be confirmed) |
| Tamper detection | Hash chain validated at retrieval time; broken chain = tampering flagged |
| Claim | Tamper-evident (not tamper-proof) — this distinction is documented |

### Events Always Audited (Cannot Be Disabled)

- All authentication events (success and failure)
- All document state changes
- All approval actions
- All delegation grants and revocations
- All role assignments and revocations
- All bulk operations
- All exports
- All session terminations (including forced)
- All workflow definition publishes and deprecations
- All Option B workflow migration executions
- All erasure actions under RA 10173

---

## 14. Concurrency and Locking

| Decision | Value |
|---|---|
| Model | Pessimistic locking |
| Lock timeout | 15 minutes (configurable per document type) |
| Lock release on timeout | Automatic; creates audit event |
| Lock notification | User sees informational notice when document is locked by another user |
| Offline + locking conflict | If mobile user loses connectivity and lock expires, offline action checked on reconnect; conflict flagged for manual review if document state has changed |

---

## 15. Delegation and Acting Authority

| Decision | Value |
|---|---|
| Who | Specific delegating user → specific receiving user(s) |
| What | Specific document types only (not all approvals) |
| When | Time period: start date + end date with auto-expiration |
| Authority level | Configurable: basic approve / with modifications / full authority |
| Expiration | Automatic at end date — no manual cleanup required |
| Early revocation | Permitted by delegating person |
| Audit trail | Records: original authority, acting person, time period, scope, legal basis |
| Open-ended delegations | Prohibited — duration must always be explicit |

---

## 16. Disaster Recovery and Backup

| Decision | Value |
|---|---|
| RTO (Recovery Time Objective) | 4 hours maximum |
| RPO (Recovery Point Objective) | 1 hour maximum |
| Hot standby | Streaming replication with lag < 60 seconds |
| Failover trigger | Primary heartbeat loss for 60 seconds |
| DNS failover | Automated (health-check-based routing) |
| Backup: daily | Encrypted `pg_dump` to S3-compatible storage |
| Backup: continuous | WAL-based PITR archiving |
| Backup: hot retention | 30 days |
| Backup: cold retention | 1 year |
| Backup encryption | Keys held exclusively by LGU IT Office — not the development team |
| Backup credentials | Separate from production credentials — production has no write access to backup storage |
| Immutable backup | At least one cold backup copy in write-once (object lock) storage |
| Restoration test | Monthly (results logged) |
| DR drill | Quarterly |
| DR runbooks | Written, versioned in repository, tested by minimum two team members |

---

## 17. Offline and Connectivity

| Decision | Value |
|---|---|
| City Hall | Always-on internet with backup generator; 30+ minute outage tolerance |
| Barangays | Some reliable, some intermittent; personal phones as primary device |
| Offline behavior | Hybrid mode: local queue for submissions; SLA clock continues; critical approvals cached locally |
| Reconnection | Local queue auto-submits; conflicts flagged for manual review; audit trail marks offline period |
| Lock + offline conflict | See Section 14 |

---

## 18. Mobile and Device Support

| Decision | Value |
|---|---|
| Approach | Mobile-first responsive design |
| OS | iOS and Android |
| Device (City Hall) | Windows 11 workstations |
| Device (Barangays) | Personal phones (primarily) + some shared Windows 11 computers |
| Native app | Deferred — web-responsive first |
| Session behavior | Refresh on app open; not during active use |

---

## 19. Citizen Portal and Identity

| Decision | Value |
|---|---|
| Citizen registration | Name, birthdate, phone, email + optional cross-reference with City Hall DB |
| Verification | OTP to phone + OTP to email (both required) |
| Ongoing login | Password + phone OTP |
| Re-verification | Annual |
| PhilSys | Feature-flagged; assume unavailable; enable if integration becomes available |
| Accepted IDs | Government-issued ID, birth certificate, barangay residency certificate |
| Privacy notice | Displayed at registration; citizen must acknowledge consent |
| Account lockout | After failed verification attempts (specific threshold: architect to determine) |

---

## 20. Compliance Decisions

| Regulation | Decision |
|---|---|
| RA 11032 (ARTA) | SLA tracking mandatory from Phase 1; configurable thresholds; legal requirement, not optional |
| RA 10173 (DPA) | Privacy-by-design in Phase 1; formal PIA and DPO designation before Production Rollout |
| RA 9184 (Procurement) | Procurement as configurable workflow in Phase 2; COA compliance through configurable approval chains |
| COA | Engage before Production Rollout; retain physical originals until COA acceptance of digital confirmed |
| Physical records | Retain all physical originals post-digitization until confirmed otherwise per document category |

---

## 21. Post-Delivery and Governance

| Decision | Value |
|---|---|
| Post-delivery owner | Internal LGU IT Office |
| Development team role | Consultation and support; not primary maintainers |
| Source code escrow | LGU receives source code, schemas, IaC, ADRs, runbooks from Phase 1 — not only at contract end |
| Code transferability | Strict ADRs; module boundary documentation; runbooks for all operational procedures |
| ADRs | Mandatory for every non-obvious architectural decision |
| Automated coupling tests | Required — automated enforcement of module boundary isolation on every PR |
| Privileged access review | Ad hoc initially; formal process to be established |
| Vendor/contractor access | Disabled by default; approved time-limited accounts with full audit logging |
| Emergency break-glass | Physical sealed envelope in LGU IT Office safe; logged on opening |
| Development team production access | Zero access to production data — production credentials held exclusively by LGU IT Office |

---

## 22. Architectural Invariants

These decisions are protected by design and are extremely expensive or impossible to change
after production data exists. They must be enforced from the first migration.

| # | Invariant | Enforcement Method |
|---|---|---|
| 1 | Schema-per-module; no cross-schema foreign keys | Automated migration linting; code review policy |
| 2 | Soft-delete everywhere; no hard deletes | Repository layer; code review policy |
| 3 | Audit log INSERT-only at DB role level | PostgreSQL role permissions set in migration |
| 4 | Workflow instance pins to definition version at creation | DB column `definition_version_id`; all resolution uses pinned version, never current |
| 5 | S3-compatible API only; UUID file keys | No provider SDK imports allowed; code review policy |
| 6 | UUID v4 primary keys everywhere | Migration linting |
| 7 | TIMESTAMPTZ for all timestamps | Migration linting |
| 8 | `city_id UUID NOT NULL` in all core entity tables | Migration schema |
| 9 | Numbering assigned at defined lifecycle event only | Workflow engine constraint |
| 10 | IT admin has no document content access | PostgreSQL RLS + application ABAC policy |
| 11 | Document type must have retention schedule before activation | Application validation constraint |
| 12 | Platform Administrator role cannot be combined with operational roles | Role assignment validation |
| 13 | Encoder and final approver of same document cannot be the same user | Workflow engine constraint |
| 14 | Workflow constraints per document type (legally mandated minimum steps) | Workflow editor validation |
| 15 | Backup credentials separate from production credentials | Infrastructure policy; Terraform |

---

## 23. Roadmap Summary

### Phase 1 — Foundation (Months 1–6)
SP Secretariat and Mayor's Office as primary users. Prove architectural viability and
deliver immediate value for SP document processing.

**Included:** IAM, Organization, Document Core (SP series), Workflow Engine (linear +
branching), SP Resolution workflow, DTS (QR + routing history), in-app notifications,
SP Secretary dashboard, Mayor dashboard, Audit log, Infrastructure.

**Not included:** SP Ordinance (Phase 1B), Records Management, Email notifications,
Meilisearch, ARTA reports, Citizen portal, Barangay access, Full ABAC, MFA (implemented
in Phase 2 but architecture supports it from Phase 1).

### Phase 2 — Executive Branch Expansion (Months 7–12)
All executive branch departments operational. Compliance enforcement.

**Additions:** SP Ordinance workflow (veto + lapse-into-law), MFA (TOTP), Delegation
management, Meilisearch, Records Management, Email notifications, ARTA compliance reports,
Department workflows (Travel Order, Leave Application, Memorandum), Election-cycle bulk
reassignment, Audit log hardening (separate audit DB server).

### Phase 3 — Citizen Portal (Months 13–18)
Public access. Citizen service digitization. Barangay access.

**Additions:** Citizen portal, Barangay official access (offline-capable), SMS gateway,
DPA compliance features (consent tracking, erasure workflow, breach notification),
Executive Order, Memorandum Circular workflows, Procurement workflows (Phase 3 or 4).

### Phase 4 — Intelligence and Optimization (Months 19–30)
Analytical capability. OCR. Advanced configuration.

**Additions:** Advanced KPI dashboards, Workflow bottleneck analytics, Document template
engine, OCR integration for scanned content search, Configurable report builder, Electronic
signature infrastructure.

### Phase 5 — Platform and Integration (Months 31+)
Integration hub. Long-term sustainability.

**Additions:** Public REST API gateway, HRIS/Payroll integration, Procurement system
integration, Electronic signature PKI implementation (if approved), PhilSys integration
(if available), Multi-LGU capability assessment, On-premise migration tooling.

---

*Last updated: Pre-requirements gathering baseline. Review and revise after SP Secretary
and Records Officer walkthrough.*
