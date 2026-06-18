# B2 — Module Boundary and Internal API Contracts — C1-Relevant Excerpt

**Source Document:** B2 — Module Boundary and Internal API Contracts  
**Platform:** Batac City LGU Platform  
**Purpose of this excerpt:** Context gathering for **C1 — Full Database Schema DDL**. Contains only the information needed to write accurate DDL for all Phase 1 schemas: table lists per module/schema, shared interface types (which directly inform column definitions and stored shapes), event payload fields (which confirm what UUID references each table must carry), and the confirmed schema ownership per module. All enforcement policy, routing logic, JSDoc comments on API methods, event consumer action descriptions, and cross-reference matrices have been removed.  
**Last Updated:** June 2026

---

## Schema Ownership Map

Each module owns exactly one PostgreSQL schema. No cross-schema foreign key constraints are permitted.

|Module|Schema|Phase|Tables (canonical list)|
|---|---|---|---|
|IAM|`iam`|1|`users`, `credentials`, `sessions`, `refresh_tokens`, `roles`, `permissions`, `role_assignments`, `mfa_records`|
|Organization|`organization`|1|`offices`, `positions`, `employees`, `assignments`, `delegations`|
|Documents|`documents`|1|`document_types`, `documents`, `versions`, `attachments`, `numbers`, `number_series`, `signatures`|
|Workflow|`workflow`|1|`definitions`, `definition_versions`, `steps`, `transition_rules`, `instances`, `step_instances`, `workflow_events`|
|Tracking|`tracking`|1|`tracking_records`, `routing_entries`, `qr_codes`|
|Records|`records`|2 (schema reserved Phase 1)|`records`, `retention_schedules`, `archive_entries`, `classification_rules`, `dispositions`|
|Notifications|`notifications`|1|`templates`, `notification_events`, `delivery_log`|
|Audit|`audit`|1|`events` (append-only; `UPDATE` and `DELETE` revoked from application DB user at PostgreSQL role level)|
|Search Meta|`search_meta`|2 (schema reserved Phase 1)|`index_metadata`, `index_jobs`|
|Portal|`portal`|3 (schema reserved Phase 1)|`public_documents`, `citizen_requests`, `complaints`, `announcements`|
|Reporting|`reporting`|2 (schema reserved Phase 1)|`report_definitions`, `schedules`, `outputs`|

---

## Module 1 — IAM (`iam` schema)

**Responsibility:** Authentication, session control, JWT issuance, role resolution, and ABAC policy evaluation.

### Shared Types — Inform Column Definitions

```typescript
interface UserSummary {
  userId: string;
  displayName: string;
  email: string;
  officeId: string | null;
  positionTitle: string | null;
}
```

### Events Emitted — Key Payload Fields

These payloads confirm what UUID references and fields `iam` tables must store (and what downstream tables reference as logical FKs).

|Event|Key Payload Fields|
|---|---|
|`user.login`|`userId`, `sessionId`, `ipAddress`, `userAgent`|
|`user.logout`|`userId`, `sessionId`, `reason: 'user_action'`|
|`session.terminated`|`sessionId`, `userId`, `terminatedBy`, `reason: 'forced' \| 'timeout'`|
|`role.assigned`|`userId`, `roleId`, `roleName`, `assignedBy`, `officeScope?`|
|`role.revoked`|`userId`, `roleId`, `roleName`, `revokedBy`|

---

## Module 2 — Organization (`organization` schema)

**Responsibility:** Office hierarchy, employee records, position assignments, and delegation management.

**Confirmed constraints:**

- One active delegation per person enforced at both DB level (partial unique index on active `delegation_grants` per user) and application level.
- No Platform Admin confirmation required for delegations — Secretariat logs the Designation document and delegation takes immediate effect.
- High-frequency operation: 10+ Acting Mayor designations per year confirmed.

### Shared Types — Inform Column Definitions

```typescript
interface DelegationSummary {
  delegationId: string;
  designationDocumentId: string;  // D YEAR-NN control number reference
  delegatingUserId: string;
  delegatedToUserId: string;
  scope: {
    officeId: string;
    positionId: string;
  };
  validFrom: Date;
  validUntil: Date;
}

interface OfficeSummary {
  officeId: string;
  name: string;
  parentOfficeId: string | null;
  type: string;
}

interface EmployeeSummary {
  employeeId: string;
  userId: string;
  displayName: string;
  positionId: string | null;
  positionTitle: string | null;
  officeId: string | null;
}

interface OfficeTree {
  offices: OfficeSummary[];
  // Shape to be determined during implementation [Inference]
}
```

### Events Emitted — Key Payload Fields

|Event|Key Payload Fields|
|---|---|
|`delegation.granted`|`delegationId`, `designationDocumentId`, `delegatingUserId`, `delegatedToUserId`, `scope: { officeId, positionId }`, `validFrom`, `validUntil`|
|`delegation.expired`|`delegationId`, `delegatingUserId`, `delegatedToUserId`, `expiredAt`|
|`delegation.revoked`|`delegationId`, `delegatingUserId`, `delegatedToUserId`, `revokedBy`, `revokedAt`|

---

## Module 3 — Documents (`documents` schema)

**Responsibility:** Document lifecycle state machine, immutable versioning, two-stage series numbering, OCR on upload with quality indicator, file streaming to S3-compatible storage, QR cover sheet generation, Secretariat decision logging (Approve / Reject / Amended).

**Confirmed numbering rule:** QR tracking number assigned first at secretariat logging → Preliminary `Draft` number assigned second → Final number assigned after last reading vote, before VP signs. Final numbers are immutable once the `Draft` prefix is removed. Separate PostgreSQL sequence per document type per year.

**Confirmed originating office rule:** For SP workflow documents (Resolutions, Ordinances, Appropriation Ordinances), `originating_office_id` is always the SP Secretariat regardless of authoring Councilor. For incoming letters (SPR documents), it records the external sender.

### Shared Types — Inform Column Definitions

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

interface DocumentSummary {
  documentId: string;
  documentTypeId: string;
  documentTypeName: string;
  title: string;
  currentState: DocumentLifecycleState;
  originatingOfficeId: string;
  cityId: string;
  preliminaryNumber: string | null;  // e.g. 'Draft 7SP 2026-02'; null before assignment
  finalNumber: string | null;        // e.g. '7SP 2026-02'; null before final assignment
  classificationLevel: 'Public' | 'Internal' | 'Confidential' | 'Restricted';
  createdAt: Date;
}

interface DocumentTypeSummary {
  documentTypeId: string;
  name: string;
  workflowTemplateId: string;          // reference to Workflow definition
  retentionScheduleId: string | null;  // must exist before type can be activated
  publicVisibilityRule: string;
  requiredStepTypes: string[];         // legally mandated minimum steps; checked by Workflow engine
}

interface DocumentNumberResult {
  finalNumber: string;  // e.g. '7SP 2026-01'
  assignedAt: Date;
}

interface AttachmentRef {
  attachmentId: string;
  s3Key: string;          // UUID key only — never original filename
  presignedUrl: string;
  mediaType: string;
  ocrText: string | null;
  scanQualityScore: number | null;
  pageCount: number;
}
```

### Events Emitted — Key Payload Fields

|Event|Key Payload Fields|
|---|---|
|`document.created`|`documentId`, `documentTypeId`, `documentTypeName`, `originatingOfficeId`, `createdBy`, `cityId`|
|`document.state_changed`|`documentId`, `fromState`, `toState`, `actorId`, `reason?`|
|`document.number_assigned`|`documentId`, `numberType: 'preliminary' \| 'final'`, `numberValue`, `series`, `assignedBy`|
|`document.secretariat_decision`|`documentId`, `decision: 'APPROVED' \| 'REJECTED' \| 'AMENDED'`, `actorId`, `remarks?`|

---

## Module 4 — Workflow (`workflow` schema)

**Responsibility:** Custom domain-specific workflow engine. Orchestrates all legislative lifecycle steps. Enforces legally mandated minimum steps per document type. Routes steps with full delegation awareness. Manages Mayor 10-day lapse, Panlalawigan 30-day review, and ARTA SLA timers.

**Phase 1 step types:** `action`, `approval`, `multi_referral`, `decision`, `notification`, `termination`  
**Phase 2 reserved in schema:** `parallel_split`, `parallel_join`

**Tables:** `definitions`, `definition_versions`, `steps`, `transition_rules`, `instances`, `step_instances`, `workflow_events`  
_(Full column-level detail is in the B4 — Workflow Engine Specification C1-relevant excerpt.)_

### Shared Types — Inform Column Definitions

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

interface WorkflowInstanceSummary {
  instanceId: string;
  documentId: string;
  definitionId: string;
  definitionVersionId: string;        // pinned at creation; never changes
  currentStepType: WorkflowStepType;
  currentStepInstanceId: string;
  currentAssigneeUserId: string | null;
  status: 'Active' | 'Completed' | 'Cancelled';
  slaDeadline: Date | null;
  lapseStatus: LapseStatus | null;
  createdAt: Date;
}

interface WorkflowSLAData {
  instanceId: string;
  documentId: string;
  documentTypeId: string;
  slaClassification: 'simple' | 'complex' | 'highly_technical';  // per RA 11032 ARTA
  slaThresholdDays: number;
  elapsedWorkingDays: number;
  isBreached: boolean;
  breachedAt: Date | null;
  currentAssigneeOfficeId: string | null;
}
```

### Events Emitted — Key Payload Fields

|Event|Key Payload Fields|
|---|---|
|`workflow.step_assigned`|`instanceId`, `stepInstanceId`, `stepType`, `assigneeUserId`, `documentId`, `dueAt?`|
|`workflow.step_completed`|`instanceId`, `stepInstanceId`, `stepType`, `completedBy`, `outcome`, `documentId`|
|`workflow.lapsed`|`instanceId`, `lapseType`, `documentId`, `lapsedAt`, `legalBasis: 'RA7160_S47' \| 'RA7160_S56D'`|
|`workflow.escalated`|`instanceId`, `stepInstanceId`, `documentId`, `slaType`, `escalatedToUserIds: string[]`, `breachedAt`|
|`workflow.certified_urgent_applied`|`certificationDocumentId`, `affectedDocumentIds: string[]`, `bypassedStepType: 'multi_referral'`, `actorId`|
|`workflow.manually_advanced`|`instanceId`, `stepInstanceId`, `documentId`, `advancedBy`, `mandatoryComment`, `fromStep`, `toStep`|
|`workflow.completed`|`instanceId`, `documentId`, `documentTypeId`, `finalOutcome`, `completedAt`|

---

## Module 5 — Tracking (`tracking` schema)

**Responsibility:** QR code generation at secretariat logging (before preliminary number is assigned). Append-only routing history for every document movement. Physical custody tracking separate from digital workflow status.

**Confirmed QR assignment sequence:** Secretariat logs document → QR tracking number assigned (first) → Preliminary Draft number assigned → Workflow instance created. QR tracking number is immutable for the document's full lifetime, independent of both preliminary and final document numbers.

### Shared Types — Inform Column Definitions

```typescript
interface TrackingRecordSummary {
  trackingId: string;           // System UUID — immutable for document lifetime
  documentId: string;
  qrCodeS3Key: string;          // UUID key for QR code image in object storage
  assignedAt: Date;
  physicalLocation: string | null;
}

interface RoutingEntry {
  entryId: string;
  trackingId: string;
  fromOfficeId: string | null;
  toOfficeId: string | null;
  actorId: string;
  actionDescription: string;
  timestamp: Date;
}
```

### Events Consumed — What Gets Written to `tracking` Tables

|Event|Source|What is Written|
|---|---|---|
|`document.created`|Documents|Generates UUID tracking number and QR code image; creates `tracking_record` and `qr_code` entries. Occurs before preliminary number is assigned.|
|`workflow.step_completed`|Workflow|Appends a `routing_entry`: from/to office, actor, timestamp, action type derived from step type and outcome.|

---

## Module 6 — Records (`records` schema)

**Phase:** 2 — module delivered Phase 2; schema reserved in Phase 1 migration.

**Responsibility:** Post-workflow document records lifecycle. Retention schedule enforcement. Classification level rules. Bulk operations (Records Officers only) with dry-run and per-item audit logging. Disposition with mandatory comment and legal hold validation. No hard deletes by any user or role.

**Confirmed retention:** SP Resolutions and Ordinances are permanently retained. No documents disposed of at Batac SP Secretariat to date.

### Shared Types — Inform Column Definitions

```typescript
interface RetentionSchedule {
  scheduleId: string;
  documentTypeId: string;
  retentionPeriod: 'Permanent' | number;  // number = years; SP Resolutions/Ordinances = 'Permanent'
  legalBasis: string;
  configuredBy: string;
}
```

### Events Consumed — What Gets Written to `records` Tables

|Event|Source|What is Written|
|---|---|---|
|`workflow.completed`|Workflow|Creates a `record` entry and initial `archive_entry` for the completed document. Calls `Documents.getDocumentById()` for metadata and `Documents.getDocumentType()` for retention schedule linkage.|

---

## Module 7 — Notifications (`notifications` schema)

**Responsibility:** Multi-channel notification delivery. In-app via SSE endpoint. Email via Nodemailer and LGU SMTP. SMS via gateway (Phase 3 only). Admin-configurable templates. Formal respondent notices: email delivery when address is on file; phone notification with in-person written notice pickup when only contact number is available (Phase 1 and 2); SMS delivery (Phase 3).

**Tables:** `templates`, `notification_events`, `delivery_log`

### Shared Types — Inform Column Definitions

```typescript
interface NotificationInput {
  recipientUserId?: string;       // for authenticated internal system users
  recipientEmail?: string;        // for external recipients (e.g. complaint respondents)
  recipientPhone?: string;        // Phase 3 — SMS gateway
  templateId: string;
  templateData: Record<string, string>;  // variable substitutions for the template
  channel: 'in_app' | 'email' | 'sms';
}
```

### Events Consumed — What Gets Written to `notifications` Tables

|Event|Source|What is Written / Triggered|
|---|---|---|
|`workflow.step_assigned`|Workflow|Step-assignment template selected; in-app and email notification to step assignee.|
|`workflow.lapsed`|Workflow|Lapse notification to SP Secretary; includes legal basis and document reference.|
|`workflow.escalated`|Workflow|ARTA SLA breach notification to designated supervisor and Records Officer.|
|`document.state_changed`|Documents|Status-change notification to relevant parties as configured in template for the new state.|

---

## Module 8 — Audit (`audit` schema)

**Responsibility:** Tamper-evident, append-only log of all system activity. SHA-256 hash chaining and HMAC-SHA-256 using Node built-in `crypto` only. Monthly RFC 3161 TSA export.

**Critical DB constraint:** `UPDATE` and `DELETE` are revoked from the application DB user at the PostgreSQL role level. The Audit module is the **only** module permitted to write to the `audit` schema. Application DB user for the audit schema: `INSERT` only.

**Tamper-evidence boundary:** The audit log is tamper-evident, not tamper-proof. A sufficiently privileged attacker holding both DB write access and the HMAC secret key could insert records that pass validation.

### Shared Types — Inform Column Definitions

These types directly define what `audit.events` must store.

```typescript
interface AuditEventInput {
  eventType: string;
  actorId: string;
  targetId?: string;
  targetType?: string;  // e.g. 'document', 'user', 'delegation', 'disposition'
  payload: Record<string, unknown>;
  cityId: string;
}

// AuditEvent = what is stored in audit.events (extends AuditEventInput)
interface AuditEvent extends AuditEventInput {
  auditEventId: string;
  occurredAt: Date;
  chainHash: string;   // SHA-256(previous_event_hash + current_event_payload)
  hmac: string;        // HMAC-SHA-256 of the event payload
}

interface AuditQueryFilter {
  actorId?: string;
  targetId?: string;
  eventTypes?: string[];
  from?: Date;
  to?: Date;
  pageSize?: number;
  cursor?: string;
}

interface AuditQueryResult {
  events: AuditEvent[];
  chainValidationStatus: 'intact' | 'broken';
  nextCursor?: string;
}
```

### Events Consumed — All domain events are subscribed by Audit

Audit subscribes to every domain event from every module. The complete list of events that land in `audit.events`:

|Event|Source|
|---|---|
|`user.login`|IAM|
|`user.logout`|IAM|
|`session.terminated`|IAM|
|`role.assigned`|IAM|
|`role.revoked`|IAM|
|`delegation.granted`|Organization|
|`delegation.expired`|Organization|
|`delegation.revoked`|Organization|
|`document.created`|Documents|
|`document.state_changed`|Documents|
|`document.number_assigned`|Documents|
|`document.secretariat_decision`|Documents|
|`workflow.step_assigned`|Workflow|
|`workflow.step_completed`|Workflow|
|`workflow.lapsed`|Workflow|
|`workflow.escalated`|Workflow|
|`workflow.certified_urgent_applied`|Workflow|
|`workflow.manually_advanced`|Workflow|
|`workflow.completed`|Workflow|

Additionally, `Records.bulkOpHandler` and `Records.dispositionSvc` call `Audit.writeEvent()` synchronously (one call per individual item in bulk operations; one call per disposition action).

---

## Module 9 — Search Meta (`search_meta` schema)

**Phase:** 2 — schema reserved in Phase 1 migration.

**Phase 1 note:** In Phase 1, full-text search is executed directly by the Documents Router against PostgreSQL FTS. The `tsvector` columns are in the `documents` schema, maintained by DB triggers. The Search Meta module abstraction layer is not active in Phase 1.

**Tables:** `index_metadata`, `index_jobs`

No shared types needed for Phase 1 DDL beyond the table list above.

---

## Module 10 — Portal (`portal` schema)

**Phase:** 3 — schema reserved in Phase 1 migration.

**Tables:** `public_documents`, `citizen_requests`, `complaints`, `announcements`

**Confirmed three access modes for both Document Requests and Complaints:**

1. Citizen downloads form template; submits physical document with wet-ink signature
2. Citizen fills digital form; system generates printable document; citizen prints, signs, submits
3. Citizen visits Secretariat; clerk fills digital form; prints on-site; citizen signs on the spot

No shared types needed for Phase 1 DDL beyond the table list and access mode notes above.

---

## Module 11 — Reporting (`reporting` schema)

**Phase:** 2 — schema reserved in Phase 1 migration.

**Tables:** `report_definitions`, `schedules`, `outputs`

No shared types needed for Phase 1 DDL beyond the table list above.

---

## Master Event Bus Registry — All Domain Events

Complete list of all events that cross module boundaries. Relevant to DDL because each event's payload fields confirm what UUID references must be stored in the emitting module's tables.

|Event|Emitter|Consumers|
|---|---|---|
|`user.login`|IAM|Audit|
|`user.logout`|IAM|Audit|
|`session.terminated`|IAM|Audit|
|`role.assigned`|IAM|Audit|
|`role.revoked`|IAM|Audit|
|`delegation.granted`|Organization|Workflow, Audit|
|`delegation.expired`|Organization|Workflow, Audit|
|`delegation.revoked`|Organization|Workflow, Audit|
|`document.created`|Documents|Tracking, Workflow, Audit|
|`document.state_changed`|Documents|Tracking, Notifications, Search Meta [Ph2], Portal [Ph3], Audit|
|`document.number_assigned`|Documents|Audit|
|`document.secretariat_decision`|Documents|Workflow, Audit|
|`workflow.step_assigned`|Workflow|Notifications, Audit|
|`workflow.step_completed`|Workflow|Tracking, Audit|
|`workflow.lapsed`|Workflow|Notifications, Audit|
|`workflow.escalated`|Workflow|Notifications, Audit|
|`workflow.certified_urgent_applied`|Workflow|Audit|
|`workflow.manually_advanced`|Workflow|Audit|
|`workflow.completed`|Workflow|Records [Ph2], Portal [Ph3], Audit|

---

_This excerpt is derived from B2 — Module Boundary and Internal API Contracts and is scoped to information required for writing C1 — Full Database Schema DDL. For enforcement rules, coupling test specifications, prohibited patterns, ADR requirements, and the full module dependency map, refer to the full B2 document._