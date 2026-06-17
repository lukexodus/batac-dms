# Batac City LGU Platform

## B2 — Module Boundary and Internal API Contracts (Extract for J4 drafting)

**Document ID:** B2 **Type:** Module Contract Specification — Architectural Law Enforcement **Status:** Pre-Development Baseline **Version:** 1.0 **Date:** June 2026 **Based on:** B1 (System Architecture, C4 Model); Consolidated Architecture and Requirements Reference (Iteration 3) **Audience:** Development team — internal reference

> **[Unverified] Note on this extract:** This is a trimmed copy of B2, kept only for use as background material when drafting **J4 — Module Structure Template** (the canonical per-module folder/file layout: `index.ts`, `router.ts`, `service.ts`, `repository.ts`, `events.ts`, `types.ts`, `schemas.ts`). I cannot verify this is the complete set of material J4 will end up needing, since J4 has not been written yet — this selection is [Inference] based on J4's stated scope, not a confirmed requirements list. Sections removed: full Published API method docstrings/rationale prose, the Cross-Module Reference matrices (Event Bus Registry, API Call Matrix, Dependency Map), Prohibited Patterns (P1–P7), and Required ADRs — these describe _inter_-module communication and governance, not _intra_-module file layout, so they were judged not needed for J4. If any of that turns out to be needed later, it should be pulled from the original B2 document, not reconstructed from memory.

---

## Why each retained section is here (rationale, not part of B2)

- **Module schema/table lists** → support `repository.ts` (Drizzle queries scoped to exactly one schema per Law #2) and confirm the one-schema-per-module rule J4 will need to state.
- **Published API interface signatures (trimmed of docstring prose)** → support `index.ts` (barrel file — exports _only_ the Published API, per Enforcement Mechanisms below) and the externally-visible vs. internal split between `types.ts` and `schemas.ts`.
- **Events Emitted / Events Consumed tables** → support `events.ts` (domain event definitions and emitters).
- **Named internal services/handlers** mentioned in passing (e.g. `dispositionSvc`, `bulkOpHandler`, `recordDecision()`, `auditEventConsumer`, `respondentNoticeSvc`, `publicLookupHandler`) → hint at what lives in `service.ts` vs. a router-level handler, and may inform naming-convention guidance in J4.
- **Enforcement Mechanisms section** → directly defines the barrel-file rule that governs `index.ts`'s contents.
- **P2 (Cross-module internal import)** → only this one prohibited pattern is kept, since it explicitly describes the file-path shape (`modules/B/src/repository.ts`) that J4's folder layout must prevent. P1, P3–P7 govern cross-module behavior, not file layout, so they were cut.

---

## Enforcement Model

### What Law #2 Requires in Practice

1. Each module owns exactly one PostgreSQL schema. Its Drizzle queries target only that schema.
2. No module imports another module's repository, schema definition files, or internal services.
3. A module may call another module only through that module's **Published API** (synchronous, in-process) or by emitting or consuming **domain events** on the internal event bus (asynchronous).
4. The Audit module is the only module permitted to write to the `audit` schema. All other modules reach the audit log either through the event bus (primary path) or through the narrow synchronous `Audit.writeEvent()` call documented in Section 8 (reserved for bulk operations and dispositions only).

### Enforcement Mechanisms

- Each module's barrel file (`/apps/server/src/modules/{module}/index.ts`) exports **only** the Published API interface. Internal files, services, and repositories are not re-exported.
- An automated coupling test suite statically analyses import paths on every PR. Any import from `modules/A/src/...` appearing in `modules/B/src/...` (where B ≠ A) is a build failure.
- Cross-schema foreign key constraints are prohibited and caught by automated migration linting.
- Code review policy: any PR containing a direct cross-module schema query is blocked regardless of test status.
- Every new domain event must be registered with the Audit module's consumer before the feature is merged (see Section 8).

---

## Module 1 — IAM

**Schema:** `iam` **Phase:** 1 **Tables:** `users`, `credentials`, `sessions`, `refresh_tokens`, `roles`, `permissions`, `role_assignments`, `mfa_records` **Responsibility:** Authentication, session control, JWT issuance, role resolution, and ABAC policy evaluation. Identity foundation for every other module.

### Published API (signatures only)

```typescript
// /modules/iam/index.ts — [Inference] method signatures proposed

interface IAMPublicAPI {
  evaluatePolicy(
    userId: string,
    resource: string,
    action: string,
    context?: {
      officeId?: string;
      documentId?: string;
      workflowStepAssigneeId?: string;
    }
  ): Promise<boolean>;

  getUserById(userId: string): Promise<UserSummary | null>;
}

// Shared types — exported from /packages/shared
interface UserSummary {
  userId: string;
  displayName: string;
  email: string;
  officeId: string | null;
  positionTitle: string | null;
}
```

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

**Schema:** `organization` **Phase:** 1 **Tables:** `offices`, `positions`, `employees`, `assignments`, `delegations` **Responsibility:** Office hierarchy, employee records, position assignments, and delegation management.

### Published API (signatures only)

```typescript
// /modules/organization/index.ts — [Inference] method signatures proposed

interface OrganizationPublicAPI {
  resolveCurrentHolder(
    positionId: string,
    asOf?: Date
  ): Promise<UserSummary | null>;

  getActiveDelegationForUser(
    userId: string
  ): Promise<DelegationSummary | null>;

  getOfficeById(officeId: string): Promise<OfficeSummary | null>;

  getOfficeHierarchy(): Promise<OfficeTree>;

  getEmployeeByUserId(userId: string): Promise<EmployeeSummary | null>;
}

interface DelegationSummary {
  delegationId: string;
  designationDocumentId: string;
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

**Schema:** `documents` **Phase:** 1 **Tables:** `document_types`, `documents`, `versions`, `attachments`, `numbers`, `number_series`, `signatures` **Responsibility:** Document lifecycle state machine, immutable versioning, two-stage series numbering, OCR on upload with quality indicator, file streaming to S3-compatible storage, QR cover sheet generation, Secretariat decision logging (Approve / Reject / Amended).

### Published API (signatures only)

```typescript
// /modules/documents/index.ts — [Inference] method signatures proposed

interface DocumentsPublicAPI {
  getDocumentById(documentId: string): Promise<DocumentSummary | null>;

  getDocumentType(documentTypeId: string): Promise<DocumentTypeSummary | null>;

  transitionState(
    documentId: string,
    toState: DocumentLifecycleState,
    actorId: string,
    reason?: string
  ): Promise<void>;

  assignFinalNumber(
    documentId: string,
    actorId: string
  ): Promise<DocumentNumberResult>;

  getAttachmentRefs(
    documentId: string,
    actorId: string
  ): Promise<AttachmentRef[]>;
}

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
  preliminaryNumber: string | null;
  finalNumber: string | null;
  classificationLevel: 'Public' | 'Internal' | 'Confidential' | 'Restricted';
  createdAt: Date;
}

interface DocumentTypeSummary {
  documentTypeId: string;
  name: string;
  workflowTemplateId: string;
  retentionScheduleId: string | null;
  publicVisibilityRule: string;
  requiredStepTypes: string[];
}

interface DocumentNumberResult {
  finalNumber: string;
  assignedAt: Date;
}

interface AttachmentRef {
  attachmentId: string;
  s3Key: string;
  presignedUrl: string;
  mediaType: string;
  ocrText: string | null;
  scanQualityScore: number | null;
  pageCount: number;
}
```

**Note on Secretariat Decision Flow (kept — names an internal service):** The Secretariat's Approve / Reject / Amended action enters through the **Document Router** (confirmed in B1: `docRouter` handles "Secretariat decision logging: Approve, Reject, Amended"). The Document Router calls `documentService.recordDecision()` internally, which records the decision and emits `document.secretariat_decision`. `[Inference — exact internal implementation of recordDecision()]`

### Events Emitted

|Event|Trigger|Key Payload Fields|
|---|---|---|
|`document.created`|Secretariat logs a new document; system record created|`documentId`, `documentTypeId`, `documentTypeName`, `originatingOfficeId`, `createdBy`, `cityId`|
|`document.state_changed`|Document lifecycle state machine advances|`documentId`, `fromState`, `toState`, `actorId`, `reason?`|
|`document.number_assigned`|Preliminary or final series number assigned|`documentId`, `numberType: 'preliminary' \| 'final'`, `numberValue`, `series`, `assignedBy`|
|`document.secretariat_decision`|Secretariat logs Approve / Reject / Amended via Document Router|`documentId`, `decision: 'APPROVED' \| 'REJECTED' \| 'AMENDED'`, `actorId`, `remarks?`|

### Events Consumed

None. Documents is an upstream source module. Its state is driven by user actions through its own Router and by synchronous calls from the Workflow module via the Published API above. It does not subscribe to other modules' events.

---

## Module 4 — Workflow

**Schema:** `workflow` **Phase:** 1 (core engine, Phase 1 step types, Certified Urgent path, multi-committee referral); Phase 2 (`parallel_split`, `parallel_join` — schema reserved in Phase 1) **Tables:** `definitions`, `definition_versions`, `steps`, `transition_rules`, `instances`, `step_instances`, `workflow_events` **Responsibility:** Custom domain-specific workflow engine, admin-configurable without developer involvement. Orchestrates all legislative lifecycle steps.

### Published API (signatures only)

```typescript
// /modules/workflow/index.ts — [Inference] method signatures proposed

interface WorkflowPublicAPI {
  getInstanceById(
    instanceId: string
  ): Promise<WorkflowInstanceSummary | null>;

  getActiveInstanceForDocument(
    documentId: string
  ): Promise<WorkflowInstanceSummary | null>;

  getWorkflowSLAData(
    filter: WorkflowSLAFilter
  ): Promise<WorkflowSLAData[]>;
}

interface WorkflowInstanceSummary {
  instanceId: string;
  documentId: string;
  definitionId: string;
  definitionVersionId: string;
  currentStepType: WorkflowStepType;
  currentStepInstanceId: string;
  currentAssigneeUserId: string | null;
  status: 'Active' | 'Completed' | 'Cancelled';
  slaDeadline: Date | null;
  lapseStatus: LapseStatus | null;
  createdAt: Date;
}

type WorkflowStepType =
  | 'action'
  | 'approval'
  | 'multi_referral'
  | 'decision'
  | 'notification'
  | 'termination'
  | 'parallel_split'
  | 'parallel_join';

type LapseStatus =
  | 'mayor_10_day_lapsed'
  | 'panlalawigan_30_day_deemed';

interface WorkflowSLAFilter {
  officeId?: string;
  documentTypeId?: string;
  from?: Date;
  to?: Date;
  breachedOnly?: boolean;
}

interface WorkflowSLAData {
  instanceId: string;
  documentId: string;
  documentTypeId: string;
  slaClassification: 'simple' | 'complex' | 'highly_technical';
  slaThresholdDays: number;
  elapsedWorkingDays: number;
  isBreached: boolean;
  breachedAt: Date | null;
  currentAssigneeOfficeId: string | null;
}
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

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`document.created`|Documents|Creates a workflow instance for the document using the document type's `workflowTemplateId`. Pins the instance to the current active `definition_version_id`. Registers the instance with the ARTA SLA monitor.|
|`document.secretariat_decision`|Documents|Advances the current workflow step for the corresponding instance based on the decision outcome. The Workflow engine then calls `Documents.transitionState()` to update document lifecycle state accordingly.|
|`delegation.granted`|Organization|Immediately re-routes any active step instances currently assigned to the original authority to the newly designated person.|
|`delegation.expired`|Organization|Re-routes any active step instances assigned to the designated person back to the original authority.|
|`delegation.revoked`|Organization|Same effect as `delegation.expired`; triggered by explicit early revocation rather than scheduled end date.|

---

## Module 5 — Tracking

**Schema:** `tracking` **Phase:** 1 **Tables:** `tracking_records`, `routing_entries`, `qr_codes` **Responsibility:** QR code generation at secretariat logging. Append-only routing history for every document movement. Physical custody tracking separate from digital workflow status. Public QR scan-result view.

### Published API (signatures only)

```typescript
// /modules/tracking/index.ts — [Inference] method signatures proposed

interface TrackingPublicAPI {
  getTrackingRecordForDocument(
    documentId: string
  ): Promise<TrackingRecordSummary | null>;

  getRoutingHistory(
    documentId: string,
    actorId: string
  ): Promise<RoutingEntry[]>;
}

interface TrackingRecordSummary {
  trackingId: string;
  documentId: string;
  qrCodeS3Key: string;
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

**Note (kept — names an internal handler):** The public scan-result view is served directly by Tracking's own REST endpoint (`publicLookupHandler`) — not via the Published API.

### Events Emitted

None. Tracking is a consumer module. It writes to its own schema in response to events but does not publish to the bus.

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`document.created`|Documents|Generates a UUID tracking number and QR code image; creates `tracking_record` and `qr_code` entries.|
|`workflow.step_completed`|Workflow|Appends a `routing_entry` recording the step completion: from/to office, actor, timestamp, and action type derived from the step type and outcome.|

---

## Module 6 — Records

**Schema:** `records` **Phase:** 2 (module delivered Phase 2; schema reserved in Phase 1 migration) **Tables:** `records`, `retention_schedules`, `archive_entries`, `classification_rules`, `dispositions` **Responsibility:** Post-workflow document records lifecycle. Retention schedule enforcement. Classification level rules. Bulk operations restricted to Records Officers with dry-run and per-item audit logging. Disposition with mandatory comment and legal hold validation. No hard deletes by any user or role at any level.

### Published API (signatures only)

```typescript
// /modules/records/index.ts — [Inference] method signatures proposed

interface RecordsPublicAPI {
  getClassificationForDocument(
    documentId: string
  ): Promise<'Public' | 'Internal' | 'Confidential' | 'Restricted' | null>;

  isUnderLegalHold(documentId: string): Promise<boolean>;

  getRetentionSchedule(
    documentTypeId: string
  ): Promise<RetentionSchedule | null>;
}

interface RetentionSchedule {
  scheduleId: string;
  documentTypeId: string;
  retentionPeriod: 'Permanent' | number;
  legalBasis: string;
  configuredBy: string;
}
```

**Note (kept — names internal services, relevant to `service.ts`):** Two confirmed internal callers of `Audit.writeEvent()` are `Records.bulkOpHandler` (one call per item in a bulk operation) and `Records.dispositionSvc` (one call per disposition action).

### Events Emitted

None. Records does not publish domain events. It writes to its own schema in response to `workflow.completed` and exposes read APIs for external callers. `[Inference]`

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`workflow.completed`|Workflow|Creates a `record` entry and initial `archive_entry` for the completed document. Calls `Documents.getDocumentById()` and `Documents.getDocumentType()` for metadata and retention linkage.|

---

## Module 7 — Notifications

**Schema:** `notifications` **Phase:** 1 **Tables:** `templates`, `notification_events`, `delivery_log` **Responsibility:** Multi-channel notification delivery. In-app via SSE endpoint. Email via Nodemailer and LGU SMTP. SMS via gateway (Phase 3 only). Admin-configurable templates requiring no developer involvement.

### Published API (signatures only)

```typescript
// /modules/notifications/index.ts — [Inference] method signatures proposed

interface NotificationsPublicAPI {
  sendNotification(input: NotificationInput): Promise<void>;
}

interface NotificationInput {
  recipientUserId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  templateId: string;
  templateData: Record<string, string>;
  channel: 'in_app' | 'email' | 'sms';
}
```

**Note (kept — names an internal caller relevant to `service.ts`):** Primary caller of `sendNotification()` is Portal module's `respondentNoticeSvc`, for formal written notices to complaint respondents.

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

**Schema:** `audit` **Phase:** 1 **Tables:** `events` (append-only; `UPDATE` and `DELETE` revoked from the application DB user at the PostgreSQL role level) **Responsibility:** Tamper-evident, append-only log of all system activity. SHA-256 hash chaining and HMAC-SHA-256 using Node built-in `crypto` only — no external library. Monthly RFC 3161 TSA export. The Audit module is the **only** module permitted to write to the `audit` schema.

### Published API (signatures only)

```typescript
// /modules/audit/index.ts — [Inference] method signatures proposed

interface AuditPublicAPI {
  writeEvent(event: AuditEventInput): Promise<void>;

  queryEvents(filter: AuditQueryFilter): Promise<AuditQueryResult>;
}

interface AuditEventInput {
  eventType: string;
  actorId: string;
  targetId?: string;
  targetType?: string;
  payload: Record<string, unknown>;
  cityId: string;
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

interface AuditEvent extends AuditEventInput {
  auditEventId: string;
  occurredAt: Date;
  chainHash: string;
  hmac: string;
}
```

### Events Emitted

None. Audit is a terminal sink module.

### Events Consumed

The Audit module subscribes to **all** domain events from all other modules via its `auditEventConsumer` (named internal handler, relevant to `service.ts`).

**Rule (kept — relevant to `events.ts` registration discipline):** Any new domain event added to the bus **must** be registered with the Audit Event Consumer in the same PR that introduces the event. No event may ship without an Audit subscription. `[Inference — required by Law #2 spirit; not stated verbatim in source]`

---

## Module 9 — Search Meta

**Schema:** `search_meta` **Phase:** 2 (module delivered Phase 2; Phase 1 uses PostgreSQL FTS directly without this abstraction layer) **Tables:** `index_metadata`, `index_jobs` **Responsibility:** Provider-agnostic search abstraction. Phase 1: PostgreSQL `tsvector`/`tsquery`. Phase 2: Meilisearch (self-hosted Docker).

### Published API (signatures only)

```typescript
// /modules/search_meta/index.ts — [Inference] method signatures proposed

interface SearchMetaPublicAPI {
  search(query: SearchQuery): Promise<SearchResult[]>;
}

interface SearchQuery {
  queryText: string;
  documentTypeIds?: string[];
  classificationLevels?: ('Public' | 'Internal' | 'Confidential' | 'Restricted')[];
  dateRange?: { from?: Date; to?: Date };
  pageSize?: number;
  cursor?: string;
}

interface SearchResult {
  documentId: string;
  title: string;
  documentTypeName: string;
  finalNumber: string | null;
  currentState: DocumentLifecycleState;
  relevanceScore?: number;
  highlightedExcerpt?: string;
}
```

### Events Emitted

None.

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`document.created`|Documents|Phase 2: enqueues initial Meilisearch indexing job via pgboss. Phase 1: no action. `[Inference]`|
|`document.state_changed`|Documents|Phase 2: enqueues a Meilisearch sync job via pgboss. Phase 1: no action. `[Inference]`|

---

## Module 10 — Portal

**Schema:** `portal` **Phase:** 3 **Tables:** `public_documents`, `citizen_requests`, `complaints`, `announcements` **Responsibility:** Public-facing REST API consumed by the Next.js citizen portal. Citizen OTP-based authentication (phone + email). Public document lookup. Citizen complaint submission. Document Request Form.

### Published API (signatures only)

```typescript
// /modules/portal/index.ts

interface PortalPublicAPI {
  // Portal exposes no synchronous Published API callable by other modules.
  // It is updated only by consuming domain events from the event bus.
  // Other modules do not call Portal directly.
}
```

### Events Emitted

None.

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`workflow.completed`|Workflow|Updates `public_documents` visibility: when an approved legislative document reaches the publication step, the document becomes publicly listed with title and first-page reference.|
|`document.state_changed`|Documents|Synchronizes relevant state changes to the `public_documents` table. `[Inference]`|

---

## Module 11 — Reporting

**Schema:** `reporting` **Phase:** 2 **Tables:** `report_definitions`, `schedules`, `outputs` **Responsibility:** Admin-configurable report generation requiring no developer involvement for new report types. RA 11032 ARTA compliance reports from live workflow SLA data. Scheduled (pgboss) and on-demand. PDF via `@react-pdf/renderer`; spreadsheet via SheetJS.

### Published API (signatures only)

```typescript
// /modules/reporting/index.ts

interface ReportingPublicAPI {
  // Reporting exposes no Published API callable by other modules.
  // It is a consumer: it calls Workflow.getWorkflowSLAData() for
  // ARTA reports and reads its own schema for report definitions.
}
```

### Events Emitted

None.

### Events Consumed

None. Reporting generates reports on-demand or on schedule by calling other modules' Published APIs. It does not subscribe to domain events. `[Inference]`

---

## Retained Prohibited Pattern (file-layout relevant)

**P2 — Cross-module internal import** Any import of `modules/B/src/...` in `modules/A/src/...` (where B ≠ A), where the import path goes below the barrel file. Only imports from `modules/B/index.ts` are permitted. Example violation: `import { DocumentRepository } from '../documents/src/repository'`.

---

_End of extract. [Unverified] This extract was assembled specifically as background for drafting J4 and has not itself been reviewed or approved as a standalone document. If something needed for J4 is missing from this trim, it should be re-pulled from the full B2 source (`b2-module-boundary-and-internal-api-contracts.md`) rather than guessed at._