# Batac City LGU Platform

## B2 — Module Boundary and Internal API Contracts

### [Filtered Extract for B3 Context — Domain Events Only]

**Source Document ID:** B2 **Type:** Module Contract Specification — Architectural Law Enforcement **Status:** Pre-Development Baseline **Version:** 1.0 **Date:** June 2026 **Based on:** B1 (System Architecture, C4 Model); Consolidated Architecture and Requirements Reference (Iteration 3)

**Note on this extract:** [Inference] This file was produced by filtering the full B2 document down to content needed to author **B3 — Internal Domain Event Catalog**. Removed sections include all Published API method signatures/interfaces, the Published API Call Matrix, the "Calls:" lines of the Module Dependency Map, and ADRs concerned only with synchronous call design. This is an editorial scoping decision, not a sourced fact — verify against the full B2 document if completeness is in question.

---

## Purpose (of original B2 document)

This document defines the legal communication paths between all 11 domain modules of the Batac City LGU Platform. It is the enforcement specification for **Architectural Law #2**:

> _Modules communicate only through the event bus or published module APIs. No module may read another module's schema directly._

The portion retained here covers: the Domain Events each module **Emits** (payloads published to the in-process event bus) and the Domain Events each module **Consumes** (subscriptions and the action taken on receipt).

---

## Notation

|Label|Meaning|
|---|---|
|_(unlabelled)_|Confirmed in B1 or Consolidated Reference (Iteration 3)|
|`[Inference]`|Architectural design logically required by Law #2 or module responsibilities; not explicitly stated in source documents. Not guaranteed behaviour.|
|Phase N|Available starting in that phase; schema may be reserved earlier|

---

## Enforcement Model (event-relevant portions only)

### Synchronous vs. Asynchronous — Decision Rule `[Inference]`

|Use the Published API (sync) when…|Use the Event Bus (async) when…|
|---|---|
|The caller needs a return value to proceed|The interaction is a side effect|
|Consistency is required within the same logical operation|Eventual consistency is acceptable|
|The action must complete or fail atomically with the caller's transaction|The consuming module's failure must not fail the emitting module's operation|
|Example: ABAC check before a write; delegation resolution before step routing; document state transition driven by workflow|Example: audit logging; search indexing; notification delivery; routing history append; public portal visibility update|

### Common Event Envelope `[Inference]`

All events published to the in-process event bus carry this envelope. Individual payload shapes are defined per event in the module sections below.

```typescript
interface DomainEvent<TPayload = unknown> {
  eventId: string;        // UUID v4 — unique per event instance
  eventType: string;      // namespaced string, e.g. 'document.created'
  occurredAt: string;     // ISO 8601 — TIMESTAMPTZ precision
  cityId: string;         // UUID — tenant isolation; Batac City UUID in Phase 1
  schemaVersion: number;  // starts at 1; increment on breaking payload change
  payload: TPayload;
}
```

Breaking payload changes require incrementing `schemaVersion`. Subscribers must handle unknown future fields gracefully (ignore, do not throw). `[Inference]`

---

## Module 1 — IAM

**Schema:** `iam` **Phase:** 1 **Responsibility:** Authentication, session control, JWT issuance, role resolution, and ABAC policy evaluation. Identity foundation for every other module.

### Events Emitted

|Event|Trigger|Key Payload Fields|
|---|---|---|
|`user.login`|Successful authentication|`userId`, `sessionId`, `ipAddress`, `userAgent`|
|`user.logout`|User-initiated sign-out|`userId`, `sessionId`, `reason: 'user_action'`|
|`session.terminated`|IT Admin forced logout or inactivity timeout|`sessionId`, `userId`, `terminatedBy`, `reason: 'forced' \| 'timeout'`|
|`role.assigned`|Role granted to a user|`userId`, `roleId`, `roleName`, `assignedBy`, `officeScope?`|
|`role.revoked`|Role removed from a user|`userId`, `roleId`, `roleName`, `revokedBy`|

All five events consumed by: **Audit**.

### Events Consumed

None. IAM is the identity foundation. It does not react to other modules' domain events.

---

## Module 2 — Organization

**Schema:** `organization` **Phase:** 1 **Responsibility:** Office hierarchy, employee records, position assignments, and delegation management. Delegation is a high-frequency first-class operation (confirmed: 10+ Acting Mayor designations per year). One active delegation per person enforced at both the DB level (partial unique index on active `delegation_grants` per user) and application level. No Platform Admin confirmation required — Secretariat logs the Designation document and delegation takes immediate effect.

### Events Emitted

|Event|Trigger|Key Payload Fields|
|---|---|---|
|`delegation.granted`|Secretariat logs a Designation document; `delegation_grant` record created with immediate effect|`delegationId`, `designationDocumentId`, `delegatingUserId`, `delegatedToUserId`, `scope: { officeId, positionId }`, `validFrom`, `validUntil`|
|`delegation.expired`|pgboss job fires at `validUntil`; authority auto-returns to original holder|`delegationId`, `delegatingUserId`, `delegatedToUserId`, `expiredAt`|
|`delegation.revoked`|Delegating authority manually revokes before end date|`delegationId`, `delegatingUserId`, `delegatedToUserId`, `revokedBy`, `revokedAt`|

Consumed by: **Workflow** (all three — triggers immediate step re-routing); **Audit** (all three).

### Events Consumed

None. The Organization module is updated only through its own Router (admin actions for office, employee, and designation management). It does not react to other modules' domain events.

---

## Module 3 — Documents

**Schema:** `documents` **Phase:** 1 **Responsibility:** Document lifecycle state machine, immutable versioning, two-stage series numbering, OCR on upload with quality indicator, file streaming to S3-compatible storage, QR cover sheet generation, Secretariat decision logging (Approve / Reject / Amended).

**Numbering rule (confirmed):** QR tracking number assigned first at secretariat logging → Preliminary `Draft` number assigned second → Final number assigned after last reading vote, before VP signs. Final numbers are immutable once the `Draft` prefix is removed. Separate PostgreSQL sequence per document type per year.

**Originating office rule (confirmed):** For SP workflow documents (Resolutions, Ordinances, Appropriation Ordinances), `originating_office_id` is always the SP Secretariat regardless of authoring Councilor. For incoming letters (SPR documents), it records the external sender.

**Relevant type referenced by event payloads below:**

```typescript
type DocumentLifecycleState =
  | 'Draft'
  | 'Submitted'
  | 'In-Workflow'
  | 'Pending-Approval'
  | 'Completed'
  | 'Released'
  | 'Archived'
  | 'Disposed'
  | 'Cancelled'; // terminal; reachable from any active state by authorized actor
```

**Note on Secretariat Decision Flow:** The Secretariat's Approve / Reject / Amended action enters through the **Document Router** (confirmed in B1: `docRouter` handles "Secretariat decision logging: Approve, Reject, Amended"). The Document Router calls `documentService.recordDecision()` internally, which records the decision and emits `document.secretariat_decision`. The Workflow module's event consumer then picks this up and advances the corresponding workflow step. This means the Approve / Reject / Amended trigger flows Documents → Workflow via the event bus, not the reverse. `[Inference — exact internal implementation of recordDecision()]`

### Events Emitted

|Event|Trigger|Key Payload Fields|
|---|---|---|
|`document.created`|Secretariat logs a new document; system record created|`documentId`, `documentTypeId`, `documentTypeName`, `originatingOfficeId`, `createdBy`, `cityId`|
|`document.state_changed`|Document lifecycle state machine advances|`documentId`, `fromState`, `toState`, `actorId`, `reason?`|
|`document.number_assigned`|Preliminary or final series number assigned|`documentId`, `numberType: 'preliminary' \| 'final'`, `numberValue`, `series`, `assignedBy`|
|`document.secretariat_decision`|Secretariat logs Approve / Reject / Amended via Document Router|`documentId`, `decision: 'APPROVED' \| 'REJECTED' \| 'AMENDED'`, `actorId`, `remarks?`|

Consumers by event:

- `document.created` → **Tracking** (QR generation; tracking record creation), **Workflow** (workflow instance creation), **Audit**
- `document.state_changed` → **Tracking** (routing history entry), **Notifications**, **Search Meta** [Phase 2], **Portal** [Phase 3], **Audit**
- `document.number_assigned` → **Audit**
- `document.secretariat_decision` → **Workflow** (advances corresponding step), **Audit**

### Events Consumed

None. Documents is an upstream source module. Its state is driven by user actions through its own Router and by synchronous calls from the Workflow module via the Published API (not reproduced in this extract). It does not subscribe to other modules' events.

---

## Module 4 — Workflow

**Schema:** `workflow` **Phase:** 1 (core engine, Phase 1 step types, Certified Urgent path, multi-committee referral); Phase 2 (`parallel_split`, `parallel_join` — schema reserved in Phase 1) **Responsibility:** Custom domain-specific workflow engine, admin-configurable without developer involvement. Orchestrates all legislative lifecycle steps. Enforces legally mandated minimum steps per document type. Routes steps with full delegation awareness. Manages Mayor 10-day lapse, Panlalawigan 30-day review, and ARTA SLA timers via pgboss.

**Phase 1 step types:** `action`, `approval`, `multi_referral`, `decision`, `notification`, `termination` **Phase 2 reserved:** `parallel_split`, `parallel_join`

**`multi_referral` step behaviour (confirmed):** All assigned committees must sign and contribute to the unified report before the step completes. Committees missing the Thursday cutoff are red-flagged in the Order of Business; Second Reading is delayed until the following Tuesday after submission. SP Secretary manual override requires a mandatory audit-logged comment.

**Certified Urgent path (confirmed Phase 1):** Mayor issues a formal written Certification of Urgency. Secretariat logs it. No standalone number. Attached to each associated measure. Bypasses `multi_referral` step entirely. First and Second Reading in the same session. One Certification can cover multiple measures in the same session.

**Workflow instance version pinning (confirmed):** Every instance pins to the `definition_version_id` active at creation time. In-flight migration requires Option A (continue under old version) or Option B (admin migrates with mandatory reason, second-level approval, 24-hour reversible window, dedicated audit event).

**Relevant types referenced by event payloads below:**

```typescript
type WorkflowStepType =
  | 'action'
  | 'approval'
  | 'multi_referral'
  | 'decision'
  | 'notification'
  | 'termination'
  | 'parallel_split'   // Phase 2; reserved in schema Phase 1
  | 'parallel_join';   // Phase 2; reserved in schema Phase 1

type LapseStatus =
  | 'mayor_10_day_lapsed'           // RA 7160 Section 47
  | 'panlalawigan_30_day_deemed';   // RA 7160 Section 56(d)
```

### Events Emitted

|Event|Trigger|Key Payload Fields|
|---|---|---|
|`workflow.step_assigned`|Step routed to an assignee; delegation resolution applied|`instanceId`, `stepInstanceId`, `stepType`, `assigneeUserId`, `documentId`, `dueAt?`|
|`workflow.step_completed`|User or system action completes a step|`instanceId`, `stepInstanceId`, `stepType`, `completedBy`, `outcome`, `documentId`|
|`workflow.lapsed`|Mayor 10-day or Panlalawigan 30-day timer fires with no action|`instanceId`, `lapseType`, `documentId`, `lapsedAt`, `legalBasis: 'RA7160_S47' \| 'RA7160_S56D'`|
|`workflow.escalated`|ARTA SLA breach; supervisor and Records Officer to be notified|`instanceId`, `stepInstanceId`, `documentId`, `slaType`, `escalatedToUserIds: string[]`, `breachedAt`|
|`workflow.certified_urgent_applied`|Secretariat logs a Certification of Urgency; `multi_referral` step bypassed on each associated measure|`certificationDocumentId`, `affectedDocumentIds: string[]`, `bypassedStepType: 'multi_referral'`, `actorId`|
|`workflow.manually_advanced`|SP Secretary overrides a blocked `multi_referral` step|`instanceId`, `stepInstanceId`, `documentId`, `advancedBy`, `mandatoryComment`, `fromStep`, `toStep`|
|`workflow.completed`|Workflow reaches terminal step|`instanceId`, `documentId`, `documentTypeId`, `finalOutcome`, `completedAt`|

Consumers by event:

- `workflow.step_assigned` → **Notifications** (notifies assignee), **Audit**
- `workflow.step_completed` → **Tracking** (appends routing entry), **Audit**
- `workflow.lapsed` → **Notifications** (notifies SP Secretary), **Audit**
- `workflow.escalated` → **Notifications** (notifies supervisor and Records Officer), **Audit**
- `workflow.certified_urgent_applied` → **Audit**
- `workflow.manually_advanced` → **Audit**
- `workflow.completed` → **Records** [Phase 2] (triggers record creation), **Portal** [Phase 3] (updates public document visibility), **Audit**

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`document.created`|Documents|Creates a workflow instance for the document using the document type's `workflowTemplateId`. Pins the instance to the current active `definition_version_id`. Registers the instance with the ARTA SLA monitor.|
|`document.secretariat_decision`|Documents|Advances the current workflow step for the corresponding instance based on the decision outcome: `APPROVED` or `AMENDED` (with accepted copy) moves to next step; `REJECTED` routes to rejection path. The Workflow engine then calls `Documents.transitionState()` to update document lifecycle state accordingly.|
|`delegation.granted`|Organization|Immediately re-routes any active step instances currently assigned to the original authority to the newly designated person. Takes effect without delay or additional confirmation.|
|`delegation.expired`|Organization|Re-routes any active step instances assigned to the designated person back to the original authority.|
|`delegation.revoked`|Organization|Same effect as `delegation.expired`; triggered by explicit early revocation rather than scheduled end date.|

---

## Module 5 — Tracking

**Schema:** `tracking` **Phase:** 1 **Responsibility:** QR code generation at secretariat logging (before preliminary number is assigned). Append-only routing history for every document movement. Physical custody tracking separate from digital workflow status. Public QR scan-result view (type, remarks, routing history from draft, first page only visible, all other pages blurred).

**Confirmed QR assignment sequence:** Secretariat logs document → **QR tracking number assigned (first)** → Preliminary Draft number assigned → Workflow instance created. QR tracking number is immutable for the document's full lifetime, independent of both preliminary and final document numbers.

### Events Emitted

None. Tracking is a consumer module. It writes to its own schema in response to events but does not publish to the bus.

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`document.created`|Documents|Generates a UUID tracking number and QR code image; creates `tracking_record` and `qr_code` entries. This occurs before the preliminary document number is assigned.|
|`workflow.step_completed`|Workflow|Appends a `routing_entry` recording the step completion: from/to office, actor, timestamp, and action type derived from the step type and outcome.|

---

## Module 6 — Records

**Schema:** `records` **Phase:** 2 (module delivered Phase 2; schema reserved in Phase 1 migration) **Responsibility:** Post-workflow document records lifecycle. Retention schedule enforcement. Classification level rules. Bulk operations restricted to Records Officers with dry-run and per-item audit logging. Disposition with mandatory comment and legal hold validation. No hard deletes by any user or role at any level.

**Confirmed retention:** SP Resolutions and Ordinances are permanently retained. No documents have been disposed of at Batac SP Secretariat to date.

### Events Emitted

None. Records does not publish domain events. It writes to its own schema in response to `workflow.completed` and exposes read APIs for external callers. `[Inference]`

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`workflow.completed`|Workflow|Creates a `record` entry and initial `archive_entry` for the completed document. Calls `Documents.getDocumentById()` to retrieve document metadata for the record. Calls `Documents.getDocumentType()` to retrieve the retention schedule linkage for the archive entry.|

---

## Module 7 — Notifications

**Schema:** `notifications` **Phase:** 1 **Responsibility:** Multi-channel notification delivery. In-app via SSE endpoint. Email via Nodemailer and LGU SMTP. SMS via gateway (Phase 3 only). Admin-configurable templates requiring no developer involvement. Formal respondent notices: email delivery when address is on file; phone notification with in-person written notice pickup when only contact number is available (Phase 1 and 2); SMS delivery (Phase 3).

### Events Emitted

None. Notifications is a sink module for notification triggers.

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`workflow.step_assigned`|Workflow|Selects the step-assignment template; delivers in-app and email notification to the step assignee.|
|`workflow.lapsed`|Workflow|Delivers lapse notification to the SP Secretary; includes legal basis and document reference.|
|`workflow.escalated`|Workflow|Delivers ARTA SLA breach notification to the designated supervisor and Records Officer.|
|`document.state_changed`|Documents|Delivers status-change notification to relevant parties as configured in the template for the new state. `[Inference]`|

---

## Module 8 — Audit

**Schema:** `audit` **Phase:** 1 **Responsibility:** Tamper-evident, append-only log of all system activity. SHA-256 hash chaining and HMAC-SHA-256 using Node built-in `crypto` only — no external library. Monthly RFC 3161 TSA export. The Audit module is the **only** module permitted to write to the `audit` schema.

**Tamper-evidence boundary (must be stated in ADR):** The audit log is tamper-evident, not tamper-proof. A sufficiently privileged attacker holding both DB write access and the HMAC secret key could insert records that pass validation. This distinction is not negotiable wording — it must be documented in the ADR for the audit log design.

### Events Emitted

None. Audit is a terminal sink module.

### Events Consumed

The Audit module subscribes to **all** domain events from all other modules via its `auditEventConsumer`. The following are all confirmed subscriptions from B1 Appendix A plus inferences for completeness.

|Event|Source|Notes|
|---|---|---|
|`user.login`|IAM||
|`user.logout`|IAM||
|`session.terminated`|IAM|Includes forced logout by IT Admin|
|`role.assigned`|IAM||
|`role.revoked`|IAM||
|`delegation.granted`|Organization||
|`delegation.expired`|Organization||
|`delegation.revoked`|Organization||
|`document.created`|Documents||
|`document.state_changed`|Documents||
|`document.number_assigned`|Documents|Both preliminary and final assignment events|
|`document.secretariat_decision`|Documents|Approve / Reject / Amended actions|
|`workflow.step_assigned`|Workflow||
|`workflow.step_completed`|Workflow||
|`workflow.lapsed`|Workflow||
|`workflow.escalated`|Workflow||
|`workflow.certified_urgent_applied`|Workflow||
|`workflow.manually_advanced`|Workflow||
|`workflow.completed`|Workflow||

**Rule:** Any new domain event added to the bus **must** be registered with the Audit Event Consumer in the same PR that introduces the event. No event may ship without an Audit subscription. `[Inference — required by Law #2 spirit; not stated verbatim in source]`

---

## Module 9 — Search Meta

**Schema:** `search_meta` **Phase:** 2 (module delivered Phase 2; Phase 1 uses PostgreSQL FTS directly without this abstraction layer) **Responsibility:** Provider-agnostic search abstraction. Phase 1: PostgreSQL `tsvector`/`tsquery`. Phase 2: Meilisearch (self-hosted Docker). All call sites reference the abstraction only — provider swap is a configuration and deployment change, not a code change. Typo tolerance required for Filipino proper names.

**Phase 1 note:** In Phase 1, full-text search is executed directly by the Documents Router against PostgreSQL FTS. The Search Meta module abstraction layer is not active. The `tsvector` columns are in the `documents` schema, maintained by DB triggers. No cross-module call to Search Meta is needed in Phase 1. `[Inference]`

### Events Emitted

None.

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`document.created`|Documents|Phase 2: enqueues initial Meilisearch indexing job via pgboss. Phase 1: no action. `[Inference]`|
|`document.state_changed`|Documents|Phase 2: enqueues a Meilisearch sync job via pgboss to update the document's index entry with the new state. Phase 1: no action (PostgreSQL FTS reflects current state via DB triggers on the `documents` schema). `[Inference]`|

---

## Module 10 — Portal

**Schema:** `portal` **Phase:** 3 **Responsibility:** Public-facing REST API consumed by the Next.js citizen portal. Citizen OTP-based authentication (phone + email). Public document lookup (first page visible; body of all other pages blurred). Citizen complaint submission for any LGU-related subject — not limited to transportation. Document Request Form (three access modes; physical wet-ink signature still required). Phase 3.

### Events Emitted

None.

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`workflow.completed`|Workflow|Updates `public_documents` visibility: when an approved legislative document reaches the publication step, the document becomes publicly listed with title and first-page reference.|
|`document.state_changed`|Documents|Synchronizes relevant state changes to the `public_documents` table (e.g. a released document becoming listed; a cancelled document being delisted). `[Inference]`|

---

## Module 11 — Reporting

**Schema:** `reporting` **Phase:** 2 **Responsibility:** Admin-configurable report generation requiring no developer involvement for new report types. RA 11032 ARTA compliance reports from live workflow SLA data. Scheduled (pgboss) and on-demand. PDF via `@react-pdf/renderer`; spreadsheet via SheetJS.

### Events Emitted

None.

### Events Consumed

None. Reporting generates reports on-demand or on schedule by calling other modules' Published APIs (not reproduced in this extract). It does not subscribe to domain events. `[Inference]`

---

## Cross-Module Reference

### Master Event Bus Registry

All domain events that travel the internal in-process event bus. Every row is confirmed from B1 Appendix A or is a necessary `[Inference]` from module responsibilities.

Every new event must be added to this table before implementation. Audit subscription is mandatory for every event.

|Event|Emitter|Consumers|Source|
|---|---|---|---|
|`user.login`|IAM|Audit|B1 Appendix A|
|`user.logout`|IAM|Audit|B1 Appendix A|
|`session.terminated`|IAM|Audit|B1 Appendix A|
|`role.assigned`|IAM|Audit|B1 Appendix A|
|`role.revoked`|IAM|Audit|B1 Appendix A|
|`delegation.granted`|Organization|Workflow, Audit|B1 Appendix A|
|`delegation.expired`|Organization|Workflow, Audit|B1 Appendix A|
|`delegation.revoked`|Organization|Workflow, Audit|B1 Appendix A|
|`document.created`|Documents|Tracking, Workflow, Audit|B1 Appendix A|
|`document.state_changed`|Documents|Tracking, Notifications, Search Meta [Ph2], Portal [Ph3], Audit|B1 Appendix A|
|`document.number_assigned`|Documents|Audit|B1 Appendix A|
|`document.secretariat_decision`|Documents|Workflow, Audit|B1 Appendix A|
|`workflow.step_assigned`|Workflow|Notifications, Audit|B1 Appendix A|
|`workflow.step_completed`|Workflow|Tracking, Audit|B1 Appendix A|
|`workflow.lapsed`|Workflow|Notifications, Audit|B1 Appendix A|
|`workflow.escalated`|Workflow|Notifications, Audit|B1 Appendix A|
|`workflow.certified_urgent_applied`|Workflow|Audit|B1 Appendix A|
|`workflow.manually_advanced`|Workflow|Audit|B1 Appendix A|
|`workflow.completed`|Workflow|Records [Ph2], Portal [Ph3], Audit|B1 Appendix A|

---

## Prohibited Patterns (event-relevant only)

The following are violations of Law #2, restricted here to the ones bearing directly on domain events. The full B2 document also lists patterns governing synchronous calls and schema access, omitted from this extract as not needed for B3.

**P4 — Event without Audit subscription** A domain event shipped to production whose `eventType` is not registered in the Audit Event Consumer's subscription list. Every event must be audited.

---

## Required ADRs (event-relevant only)

The following architectural decision point from B2 is the one directly required for B3's stated foundation ("this catalog is the foundation of the in-process event bus implementation"). Other ADRs in the full B2 document concern synchronous API design, audit log internals unrelated to the event catalog itself, and module-specific implementation questions, and are omitted here as not needed for B3.

|#|Topic|Decision Required|
|---|---|---|
|ADR-B2-1|Event Bus Implementation|In-process synchronous pub/sub mechanism: typed EventEmitter wrapper, or a minimal typed bus library. Define typed event registration, subscriber isolation, error handling (subscriber throws must not fail the emitter), and dead-letter strategy.|

---

_This extract was filtered from the full B2 document (B2 — Module Boundary and Internal API Contracts, v1.0, June 2026) to retain only the content needed to author **B3 — Internal Domain Event Catalog**. [Inference] Filtering decisions (what counts as "needed") were made editorially based on B3's stated deliverable — event name, producing module, consuming modules, payload schema as Zod, and business reason — and are not themselves sourced claims. Refer to the original B2 document for the complete module contract specification, including all Published API interfaces, the Published API Call Matrix, and the full set of ADRs and prohibited patterns._