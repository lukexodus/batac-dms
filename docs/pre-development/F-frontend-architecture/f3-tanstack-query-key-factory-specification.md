# Batac City LGU Platform

## F3 — TanStack Query Key Factory Specification — Pre-dev

| Field           | Value                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| **Document ID** | F3                                                                                                       |
| **Type**        | Frontend Query Cache Specification — `/web` Cache Key Contract                                           |
| **Status**      | BLOCKING — Pre-Development Baseline                                                                      |
| **Version**     | 1.0                                                                                                      |
| **Date**        | June 2026                                                                                                |
| **Based on**    | E1 (tRPC Router and Procedure Catalog), 2-stack-context (Stack Decisions), C1 (Full Database Schema DDL) |
| **Audience**    | Frontend development team (`/apps/web`)                                                                  |

---

## Purpose

TanStack Query v5 caches responses by query key. When a mutation changes server state, the frontend must invalidate the correct cached queries so UI data stays current. Incorrect or missing invalidations produce stale data bugs that are among the hardest to reproduce: the data looks right on first load, appears correct in the network tab, and only reveals itself as wrong when a user acts on information that changed moments before they saw it.

This document defines the complete, authoritative query key factory for every tRPC query procedure in the application. It must be treated as a contract: the factory entries defined here are the only keys that should appear in `queryClient.invalidateQueries`, `queryClient.setQueryData`, and `queryClient.removeQueries` calls throughout `/apps/web`. No procedure should generate an ad-hoc key string anywhere in the component or mutation layer.

---

## Conventions

### Key Hierarchy

Each factory has three levels of specificity, each a valid target for `invalidateQueries`.

**Router scope** — matches every query from a router, regardless of procedure or input. Use when a mutation affects multiple procedures in the same module (e.g. a designation grant affects both the active designations list and the history list).

```
[['router']]
```

**Procedure scope** — matches all queries from a single procedure regardless of input. Use for list invalidation where any filter permutation may be stale.

```
[['router', 'procedure']]
```

**Instance key** — matches a single cached result for a specific input. Use with `queryClient.setQueryData` for optimistic updates and with `exact: true` invalidation when only one specific record changed.

```
[['router', 'procedure'], { input: { ... }, type: 'query' }]
```

For procedures with no input (void), the procedure scope and instance key collapse into one entry — there is nothing to parameterize. These are written as a single function that produces `[['router', 'procedure'], { type: 'query' }]`.

### tRPC v11 Alignment

tRPC v11 (`@trpc/react-query`) generates query keys using:

```typescript
function getQueryKey(path: string[], input: unknown, type: 'query' | 'infinite' | 'any') {
  return input === undefined
    ? [[...path], { type }]
    : [[...path], { input, type }];
}
```

The keys defined in this factory intentionally mirror that structure. This means the factory keys are compatible with both direct `queryClient` calls and tRPC's own utility methods (`utils.router.procedure.invalidate(input?)`). Prefer the tRPC utils for single-procedure invalidation; use factory scope keys when a mutation invalidates across multiple procedures or routers.

### Naming Convention

For parameterized procedures (those with required input), the factory provides two entries:

- `procedureName_plural()` — procedure scope, no input, e.g. `documentKeys.details()`
- `procedureName_singular(input)` — instance key, e.g. `documentKeys.detail(documentId)`

For void-input procedures (no parameters), a single function: `iamKeys.currentUser()`.

For list procedures with optional filters, the scope key takes no arguments and the instance key takes the full filter object: `documentKeys.lists()` and `documentKeys.list(input)`.

### Implementation Location

One file per module under `/packages/shared/src/query-keys/`, re-exported from `/packages/shared/src/query-keys/index.ts`. The shared package is the single source of truth so that both mutation handlers (in `/apps/web/src/hooks/mutations/`) and component-level `useQuery` calls reference the same key objects.

---

## Key Factories

### 1. `iamKeys` — `iamRouter`

Covers: `iam.getCurrentUser`, `iam.listActiveSessions`, `iam.listAllActiveSessions`, `iam.listUserDirectory`.

```typescript
// /packages/shared/src/query-keys/iam.keys.ts

export const iamKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['iam']] as const,

  // ── iam.getCurrentUser ────────────────────────────────────────────────────
  // Void input. Returns SubjectContext, effective roles, MFA status.
  // Invalidated by: updateOwnProfile, changeOwnPassword, assignRole, revokeRole,
  //                 createDesignationGrant, revokeDesignationGrantEarly.
  currentUser: () =>
    [['iam', 'getCurrentUser'], { type: 'query' as const }] as const,

  // ── iam.listActiveSessions ────────────────────────────────────────────────
  // Void input. Own sessions only. Callable by all 12 authenticated roles.
  ownSessions: () =>
    [['iam', 'listActiveSessions'], { type: 'query' as const }] as const,

  // ── iam.listAllActiveSessions ─────────────────────────────────────────────
  // sys_admin only. Paginated. Procedure scope used for any-pagination invalidation.
  allSessions: () => [['iam', 'listAllActiveSessions']] as const,
  allSessionsList: (input: { cursor?: string | null; pageSize?: number }) =>
    [['iam', 'listAllActiveSessions'], { input, type: 'query' as const }] as const,

  // ── iam.listUserDirectory ─────────────────────────────────────────────────
  // Paginated + filterable. Most roles; encoders/approvers/sp_member see limited fields.
  userDirectory: () => [['iam', 'listUserDirectory']] as const,
  userDirectoryList: (input: {
    cursor?: string | null;
    pageSize?: number;
    officeId?: string;
    search?: string;
  }) =>
    [['iam', 'listUserDirectory'], { input, type: 'query' as const }] as const,
} as const;
```

---

### 2. `orgKeys` — `organizationRouter`

Covers: `organization.getOfficeHierarchy`, `organization.getActiveDesignations`, `organization.getDesignationHistory`.

```typescript
// /packages/shared/src/query-keys/organization.keys.ts

export const orgKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['organization']] as const,

  // ── organization.getOfficeHierarchy ───────────────────────────────────────
  // Void input. Returns the full office tree. Invalidated by any office,
  // position, employee, or assignment mutation.
  officeHierarchy: () =>
    [['organization', 'getOfficeHierarchy'], { type: 'query' as const }] as const,

  // ── organization.getActiveDesignations ────────────────────────────────────
  // Void input. Returns all currently active delegation_grants. Invalidated by
  // createDesignationGrant and revokeDesignationGrantEarly.
  activeDesignations: () =>
    [['organization', 'getActiveDesignations'], { type: 'query' as const }] as const,

  // ── organization.getDesignationHistory ────────────────────────────────────
  // Paginated + optional employeeId filter. Includes inactive / expired / revoked grants.
  designationHistories: () => [['organization', 'getDesignationHistory']] as const,
  designationHistory: (input: {
    cursor?: string | null;
    pageSize?: number;
    employeeId?: string;
  }) =>
    [
      ['organization', 'getDesignationHistory'],
      { input, type: 'query' as const },
    ] as const,
} as const;
```

---

### 3. `documentKeys` — `documentsRouter`

Covers: `documents.get`, `documents.getMetadataForAdmin`, `documents.list`, `documents.search`, `documents.getVersionHistory`, `documents.getOcrText`, `documents.getScanQualityIndicator`.

This is the largest factory. The version-scoped keys (`ocrText`, `scanQuality`) use `versionId` rather than `documentId` because versions are the granularity at which OCR processing occurs per C1 §4.7.

```typescript
// /packages/shared/src/query-keys/document.keys.ts

export const documentKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['documents']] as const,

  // ── documents.get ─────────────────────────────────────────────────────────
  // Full document record including lifecycle state, numbers, metadata.
  // classification gate applies (no content for sys_admin on confidential/restricted).
  details: () => [['documents', 'get']] as const,
  detail: (documentId: string) =>
    [['documents', 'get'], { input: { documentId }, type: 'query' as const }] as const,

  // ── documents.getMetadataForAdmin ─────────────────────────────────────────
  // sys_admin only. Returns title, state, number, classification only — no content.
  adminMetadatas: () => [['documents', 'getMetadataForAdmin']] as const,
  adminMetadata: (documentId: string) =>
    [
      ['documents', 'getMetadataForAdmin'],
      { input: { documentId }, type: 'query' as const },
    ] as const,

  // ── documents.list ────────────────────────────────────────────────────────
  // Paginated list of documents. All filter permutations share the procedure scope key.
  lists: () => [['documents', 'list']] as const,
  list: (input: {
    cursor?: string | null;
    pageSize?: number;
    documentTypeId?: string;
    lifecycleState?: string;
    officeId?: string;
    from?: Date | null;
    to?: Date | null;
  }) =>
    [['documents', 'list'], { input, type: 'query' as const }] as const,

  // ── documents.search ──────────────────────────────────────────────────────
  // PostgreSQL FTS in Phase 1. All search permutations share the procedure scope key.
  searches: () => [['documents', 'search']] as const,
  search: (input: {
    cursor?: string | null;
    pageSize?: number;
    queryText: string;
    documentTypeIds?: string[];
    classificationLevels?: string[];
    from?: Date | null;
    to?: Date | null;
  }) =>
    [['documents', 'search'], { input, type: 'query' as const }] as const,

  // ── documents.getVersionHistory ───────────────────────────────────────────
  // Returns all versions for a document in upload order.
  versionHistories: () => [['documents', 'getVersionHistory']] as const,
  versionHistory: (documentId: string) =>
    [
      ['documents', 'getVersionHistory'],
      { input: { documentId }, type: 'query' as const },
    ] as const,

  // ── documents.getOcrText ──────────────────────────────────────────────────
  // Keyed by versionId, not documentId. OCR text is per-version.
  ocrTexts: () => [['documents', 'getOcrText']] as const,
  ocrText: (versionId: string) =>
    [['documents', 'getOcrText'], { input: { versionId }, type: 'query' as const }] as const,

  // ── documents.getScanQualityIndicator ─────────────────────────────────────
  // Keyed by versionId. Score and category written asynchronously by the OCR job.
  // staleTime: 0 recommended until ocr_processed = true (poll until confirmation).
  scanQualities: () => [['documents', 'getScanQualityIndicator']] as const,
  scanQuality: (versionId: string) =>
    [
      ['documents', 'getScanQualityIndicator'],
      { input: { versionId }, type: 'query' as const },
    ] as const,
} as const;
```

---

### 4. `workflowKeys` — `workflowRouter`

Covers: `workflow.getInstance`, `workflow.getActiveInstanceForDocument`, `workflow.listMyAssignedSteps`, `workflow.getSlaComplianceData`.

The `forDocument` key is the primary way the document detail screen links to its active workflow status without reading the `workflow` schema directly, per B2 Module 4's intent.

```typescript
// /packages/shared/src/query-keys/workflow.keys.ts

export const workflowKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['workflow']] as const,

  // ── workflow.getInstance ──────────────────────────────────────────────────
  // Full instance record including current step, SLA deadline, lapse status.
  details: () => [['workflow', 'getInstance']] as const,
  detail: (instanceId: string) =>
    [['workflow', 'getInstance'], { input: { instanceId }, type: 'query' as const }] as const,

  // ── workflow.getActiveInstanceForDocument ─────────────────────────────────
  // Keyed by documentId. Returns the same shape as getInstance, nullable.
  // Used by the document detail screen to display current workflow status.
  forDocuments: () => [['workflow', 'getActiveInstanceForDocument']] as const,
  forDocument: (documentId: string) =>
    [
      ['workflow', 'getActiveInstanceForDocument'],
      { input: { documentId }, type: 'query' as const },
    ] as const,

  // ── workflow.listMyAssignedSteps ──────────────────────────────────────────
  // Current user's pending step inbox. Paginated.
  // Invalidated by every mutation that advances, completes, or reassigns a step.
  mySteps: () => [['workflow', 'listMyAssignedSteps']] as const,
  myStepsList: (input: { cursor?: string | null; pageSize?: number }) =>
    [
      ['workflow', 'listMyAssignedSteps'],
      { input, type: 'query' as const },
    ] as const,

  // ── workflow.getSlaComplianceData ─────────────────────────────────────────
  // ARTA SLA report data. Filterable by office, document type, breach status, date range.
  slaComplianceData: () => [['workflow', 'getSlaComplianceData']] as const,
  slaCompliance: (input: {
    officeId?: string;
    documentTypeId?: string;
    breachedOnly?: boolean;
    from?: Date | null;
    to?: Date | null;
  }) =>
    [
      ['workflow', 'getSlaComplianceData'],
      { input, type: 'query' as const },
    ] as const,
} as const;
```

---

### 5. `trackingKeys` — `trackingRouter`

Covers: `tracking.getTrackingRecord`, `tracking.printQrCoverSheet`, `tracking.getRoutingHistory`, `tracking.scanQrCodeAuthenticated`.

**Note on `tracking.printQrCoverSheet`:** This procedure is typed as a `query` in E1 but returns a short-lived presigned PDF URL. Configure `staleTime: 0` and `gcTime: 0` on any `useQuery` call that uses `trackingKeys.qrCoverSheet`. Do not use this key for `setQueryData` — the URL expires and caching it is harmful.

```typescript
// /packages/shared/src/query-keys/tracking.keys.ts

export const trackingKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['tracking']] as const,

  // ── tracking.getTrackingRecord ────────────────────────────────────────────
  // Returns the QR tracking record for a document. Assigned at secretariat logging.
  records: () => [['tracking', 'getTrackingRecord']] as const,
  record: (documentId: string) =>
    [
      ['tracking', 'getTrackingRecord'],
      { input: { documentId }, type: 'query' as const },
    ] as const,

  // ── tracking.printQrCoverSheet ────────────────────────────────────────────
  // Returns presigned PDF URL for QR cover sheets. Ephemeral — staleTime: 0, gcTime: 0.
  // Contains only three fields per Q-B02: QR Code, Tracking Number, Series Number.
  qrCoverSheets: () => [['tracking', 'printQrCoverSheet']] as const,
  qrCoverSheet: (input: {
    documentIds: string[];
    layout?: 'single' | 'multi_per_page';
  }) =>
    [
      ['tracking', 'printQrCoverSheet'],
      { input, type: 'query' as const },
    ] as const,

  // ── tracking.getRoutingHistory ────────────────────────────────────────────
  // Append-only routing log for a document. Grows with each step completion
  // and explicit logRoutingEntry call.
  routingHistories: () => [['tracking', 'getRoutingHistory']] as const,
  routingHistory: (documentId: string) =>
    [
      ['tracking', 'getRoutingHistory'],
      { input: { documentId }, type: 'query' as const },
    ] as const,

  // ── tracking.scanQrCodeAuthenticated ─────────────────────────────────────
  // Keyed by qrTrackingNumber (the UUID assigned at secretariat logging, independent
  // of preliminary and final series numbers). Returns document type, remarks,
  // full routing history from draft, and first-page image URL.
  qrScans: () => [['tracking', 'scanQrCodeAuthenticated']] as const,
  qrScan: (qrTrackingNumber: string) =>
    [
      ['tracking', 'scanQrCodeAuthenticated'],
      { input: { qrTrackingNumber }, type: 'query' as const },
    ] as const,
} as const;
```

---

### 6. `sessionKeys` — `sessionRouter`

Covers: `session.getAttendanceRecord`, `session.getAttendanceStatistics`, `session.getOrderOfBusiness`.

The Order of Business is a derived view computed over `documents` in their active workflow steps. It is not stored in its own table. Its cache must be invalidated on any mutation that changes the committee report submission status of an SP legislative measure, which means it is cross-module: workflow mutations trigger `sessionKeys.orderOfBusiness()` invalidation.

```typescript
// /packages/shared/src/query-keys/session.keys.ts

export const sessionKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['session']] as const,

  // ── session.getAttendanceRecord ───────────────────────────────────────────
  // Keyed by sessionDate. Records pre-session absence entries and quorum result.
  attendances: () => [['session', 'getAttendanceRecord']] as const,
  attendance: (sessionDate: Date) =>
    [
      ['session', 'getAttendanceRecord'],
      { input: { sessionDate }, type: 'query' as const },
    ] as const,

  // ── session.getAttendanceStatistics ──────────────────────────────────────
  // Aggregated attendance counts over a date range. Backs the attendance graph.
  attendanceStats: () => [['session', 'getAttendanceStatistics']] as const,
  attendanceStat: (input: { from?: Date | null; to?: Date | null }) =>
    [
      ['session', 'getAttendanceStatistics'],
      { input, type: 'query' as const },
    ] as const,

  // ── session.getOrderOfBusiness ────────────────────────────────────────────
  // Derived view over documents scheduled for a session. Defaults to next Tuesday.
  // Items with missing committee reports are flagged red (Q-A02).
  orderOfBusinesses: () => [['session', 'getOrderOfBusiness']] as const,
  orderOfBusiness: (input?: { sessionDate?: Date }) =>
    input !== undefined
      ? [
          ['session', 'getOrderOfBusiness'],
          { input, type: 'query' as const },
        ] as const
      : [['session', 'getOrderOfBusiness'], { type: 'query' as const }] as const,
} as const;
```

---

### 7. `recordsKeys` — `recordsRouter`

Covers: `records.getRetentionSchedule`, `records.isUnderLegalHold`.

Phase 1 subset of the Records module; full RMS is Phase 2. These two queries are read dependencies for the Documents and Workflow modules' published APIs and are exposed here for `/web` screens.

```typescript
// /packages/shared/src/query-keys/records.keys.ts

export const recordsKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['records']] as const,

  // ── records.getRetentionSchedule ──────────────────────────────────────────
  // Keyed by documentTypeId. Returns the configured retention period and legal basis.
  // SP Resolutions and Ordinances are Permanent (consolidated reference Part 11.7).
  retentionSchedules: () => [['records', 'getRetentionSchedule']] as const,
  retentionSchedule: (documentTypeId: string) =>
    [
      ['records', 'getRetentionSchedule'],
      { input: { documentTypeId }, type: 'query' as const },
    ] as const,

  // ── records.isUnderLegalHold ──────────────────────────────────────────────
  // Keyed by documentId. Boolean. Blocks retention shortening and disposal.
  // In Phase 1, stored as a documents.metadata flag (Phase 2 dedicated column).
  legalHolds: () => [['records', 'isUnderLegalHold']] as const,
  legalHold: (documentId: string) =>
    [
      ['records', 'isUnderLegalHold'],
      { input: { documentId }, type: 'query' as const },
    ] as const,
} as const;
```

---

### 8. `notificationKeys` — `notificationsRouter`

Covers: `notifications.listMine`, `notifications.getOwnPreferences`, `notifications.listDeliveryLogs`.

```typescript
// /packages/shared/src/query-keys/notification.keys.ts

export const notificationKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['notifications']] as const,

  // ── notifications.listMine ────────────────────────────────────────────────
  // Own in-app notifications. Paginated + unreadOnly filter.
  // Invalidated by markAsRead. Receives new items via SSE push (no polling needed).
  mine: () => [['notifications', 'listMine']] as const,
  mineList: (input: {
    cursor?: string | null;
    pageSize?: number;
    unreadOnly?: boolean;
  }) =>
    [['notifications', 'listMine'], { input, type: 'query' as const }] as const,

  // ── notifications.getOwnPreferences ───────────────────────────────────────
  // Void input. Own notification channel preferences. Invalidated by updateOwnPreferences.
  preferences: () =>
    [
      ['notifications', 'getOwnPreferences'],
      { type: 'query' as const },
    ] as const,

  // ── notifications.listDeliveryLogs ────────────────────────────────────────
  // sys_admin and plat_admin only. All delivery records across all recipients.
  deliveryLogs: () => [['notifications', 'listDeliveryLogs']] as const,
  deliveryLog: (input: {
    cursor?: string | null;
    pageSize?: number;
    from?: Date | null;
    to?: Date | null;
  }) =>
    [
      ['notifications', 'listDeliveryLogs'],
      { input, type: 'query' as const },
    ] as const,
} as const;
```

---

### 9. `auditKeys` — `auditRouter`

Covers: `audit.listOwnActions`, `audit.listOwnOfficeDocumentActions`, `audit.listFullLog`, `audit.validateChainIntegrity`.

The audit log is append-only at the database permission level. These queries grow as events are appended; they are never invalidated because data is deleted — they are invalidated to pick up new entries. In most cases, audit queries are read-only reference views that refresh only on explicit user action (e.g., opening the audit log panel). They do not need to be invalidated by every mutation automatically unless an "audit trail" panel is live-updating on the same screen.

```typescript
// /packages/shared/src/query-keys/audit.keys.ts

export const auditKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['audit']] as const,

  // ── audit.listOwnActions ──────────────────────────────────────────────────
  // All audit events where actor_id = current user. Paginated + date range.
  ownActions: () => [['audit', 'listOwnActions']] as const,
  ownAction: (input: {
    cursor?: string | null;
    pageSize?: number;
    from?: Date | null;
    to?: Date | null;
  }) =>
    [['audit', 'listOwnActions'], { input, type: 'query' as const }] as const,

  // ── audit.listOwnOfficeDocumentActions ────────────────────────────────────
  // Audit events scoped to the caller's effective offices. Paginated + date range.
  // Uses denormalized resource_office_id column (D-ABAC-04) — no live join.
  officeActions: () => [['audit', 'listOwnOfficeDocumentActions']] as const,
  officeAction: (input: {
    cursor?: string | null;
    pageSize?: number;
    officeId?: string;
    from?: Date | null;
    to?: Date | null;
  }) =>
    [
      ['audit', 'listOwnOfficeDocumentActions'],
      { input, type: 'query' as const },
    ] as const,

  // ── audit.listFullLog ─────────────────────────────────────────────────────
  // auditor only. Unfiltered event log + inline chain validation status per batch.
  fullLogs: () => [['audit', 'listFullLog']] as const,
  fullLog: (input: {
    cursor?: string | null;
    pageSize?: number;
    actorId?: string;
    eventTypes?: string[];
    from?: Date | null;
    to?: Date | null;
  }) =>
    [['audit', 'listFullLog'], { input, type: 'query' as const }] as const,

  // ── audit.validateChainIntegrity ──────────────────────────────────────────
  // Walks the SHA-256 hash chain; flags the first broken link.
  // sys_admin and auditor only. Optional fromEventId to validate a subset.
  chainIntegrity: (input?: { fromEventId?: string }) =>
    input !== undefined
      ? [
          ['audit', 'validateChainIntegrity'],
          { input, type: 'query' as const },
        ] as const
      : [
          ['audit', 'validateChainIntegrity'],
          { type: 'query' as const },
        ] as const,
} as const;
```

---

### 10. `complaintKeys` — `complaintsRouter`

Covers: `complaints.listAll`.

There is no `complaints.get(complaintId)` procedure in E1 — the SP Secretariat internal view is list-only in Phase 1. Invalidate `complaintKeys.all()` when the complaint list's full content is uncertain after a mutation.

```typescript
// /packages/shared/src/query-keys/complaint.keys.ts

export const complaintKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['complaints']] as const,

  // ── complaints.listAll ────────────────────────────────────────────────────
  // SP Secretariat-wide complaint list. Filterable by outcomeState.
  // sp_member access is committee-scoped.
  lists: () => [['complaints', 'listAll']] as const,
  list: (input: {
    cursor?: string | null;
    pageSize?: number;
    outcomeState?: 'pending_hearing' | 'received_seen' | 'dismissed' | 'resolved';
  }) =>
    [['complaints', 'listAll'], { input, type: 'query' as const }] as const,
} as const;
```

---

### 11. `documentRequestKeys` — `documentRequestsRouter`

Covers: `documentRequests.generatePrintableForm`, `documentRequests.listAll`.

**Note on `documentRequests.generatePrintableForm`:** Like `tracking.printQrCoverSheet`, this procedure is typed as a `query` in E1 but returns a presigned PDF URL. Configure `staleTime: 0` and `gcTime: 0` on any `useQuery` call using this key.

```typescript
// /packages/shared/src/query-keys/documentRequest.keys.ts

export const documentRequestKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['documentRequests']] as const,

  // ── documentRequests.generatePrintableForm ────────────────────────────────
  // Keyed by requestId. Returns presigned URL for the formatted Document Request Form.
  // Ephemeral — staleTime: 0, gcTime: 0. Do not use with setQueryData.
  printableForms: () => [['documentRequests', 'generatePrintableForm']] as const,
  printableForm: (requestId: string) =>
    [
      ['documentRequests', 'generatePrintableForm'],
      { input: { requestId }, type: 'query' as const },
    ] as const,

  // ── documentRequests.listAll ──────────────────────────────────────────────
  // All document requests visible to the caller. Paginated.
  lists: () => [['documentRequests', 'listAll']] as const,
  list: (input: { cursor?: string | null; pageSize?: number }) =>
    [
      ['documentRequests', 'listAll'],
      { input, type: 'query' as const },
    ] as const,
} as const;
```

---

## Mutation Invalidation Matrix

The tables below list every mutation from E1 and the query keys that must be invalidated in its `onSuccess` or `onSettled` callback. The `documentId` / `instanceId` / `versionId` referred to are the IDs returned in the mutation response or passed as mutation input.

**Reading the table:** "Procedure scope" means call `utils.router.procedure.invalidate()` with no input (clears all cached results for that procedure). "Instance key" means call `utils.router.procedure.invalidate({ ...input })` or `queryClient.invalidateQueries({ queryKey: factory.instanceKey(...) })`.

Prefer `utils.*` calls from the tRPC context (`trpc.useUtils()`) in mutation callbacks. Use factory scope keys directly only when invalidating across multiple procedures or routers in one call.

---

### IAM Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`iam.updateOwnProfile`|`iamKeys.currentUser()`, `iamKeys.userDirectory()`|—|
|`iam.changeOwnPassword`|`iamKeys.currentUser()`|—|
|`iam.forceTerminateSession`|`iamKeys.allSessions()`|—|
|`iam.createUserAccount`|`iamKeys.userDirectory()`|—|
|`iam.editUserAccount(userId)`|`iamKeys.userDirectory()`, `iamKeys.currentUser()` if `userId = subject.userId`|—|
|`iam.deactivateUserAccount` / `reactivateUserAccount`|`iamKeys.userDirectory()`|`orgKeys.officeHierarchy()` (active assignments change visually)|
|`iam.assignRole(userId)`|`iamKeys.userDirectory()`, `iamKeys.currentUser()` if target is self|—|
|`iam.revokeRole(userId)`|`iamKeys.userDirectory()`, `iamKeys.currentUser()` if target is self|—|
|`iam.registerCitizenAccountClerkAssisted`|`iamKeys.userDirectory()`|—|

---

### Organization Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`organization.createOffice` / `updateOffice` / `deactivateOffice`|`orgKeys.officeHierarchy()`|—|
|`organization.createPosition` / `updatePosition`|`orgKeys.officeHierarchy()`|—|
|`organization.createEmployee` / `updateEmployee`|`orgKeys.officeHierarchy()`|`iamKeys.userDirectory()`|
|`organization.assignEmployeeToPosition`|`orgKeys.officeHierarchy()`|`iamKeys.userDirectory()`|
|`organization.createDesignationGrant`|`orgKeys.activeDesignations()`, `orgKeys.designationHistories()`|`iamKeys.currentUser()` (delegation context in SubjectContext changes), `workflowKeys.all()` (step routing is reassigned)|
|`organization.revokeDesignationGrantEarly`|`orgKeys.activeDesignations()`, `orgKeys.designationHistories()`|`iamKeys.currentUser()`, `workflowKeys.all()`|
|`organization.createCommittee` / `updateCommittee`|`orgKeys.officeHierarchy()`|—|
|`organization.assignCommitteeMembership`|`orgKeys.officeHierarchy()`|`iamKeys.currentUser()` (committee_ids JWT claim changes at next token refresh)|

---

### Document Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`documents.create`|`documentKeys.lists()`|—|
|`documents.update(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|—|
|`documents.delete(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|—|
|`documents.cancel(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|`workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`|
|`documents.submit(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|`workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`, `trackingKeys.record(documentId)`, `sessionKeys.orderOfBusinesses()`|
|`documents.assignPreliminaryNumber(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|`sessionKeys.orderOfBusinesses()` (preliminary number appears in OOB view)|
|`documents.assignFinalNumber(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|—|
|`documents.logCertificationOfUrgency`|`documentKeys.detail(certifyingDocumentId)`|For each `associatedMeasureId`: `workflowKeys.forDocument(id)`, `workflowKeys.mySteps()`, `sessionKeys.orderOfBusinesses()`|
|`documents.publishToPortal(documentId)`|`documentKeys.detail(documentId)`|—|
|`documents.unpublishFromPortal(documentId)`|`documentKeys.detail(documentId)`|—|
|`documents.archive(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|`recordsKeys.legalHold(documentId)`|
|`documents.requestUploadUrl`|— (presigned URL only; no state mutation)|—|
|`documents.confirmUpload(documentId)`|`documentKeys.versionHistory(documentId)`|`documentKeys.scanQuality(newVersionId)` — start polling until `ocr_processed = true`|
|`documents.triggerManualReOcr(versionId)`|`documentKeys.ocrTexts()`, `documentKeys.scanQualities()`|—|
|`documents.flagScannedBackForVerification(versionId)`|`documentKeys.versionHistory(parentDocumentId)`, `documentKeys.detail(parentDocumentId)`|—|
|`documents.acceptScannedBackAsOfficial(versionId)`|`documentKeys.versionHistory(parentDocumentId)`, `documentKeys.detail(parentDocumentId)`|—|
|`documents.logSecretariatDecision(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|`workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`, `sessionKeys.orderOfBusinesses()`|

---

### Workflow Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`workflow.completeActionStep(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`|`documentKeys.detail(documentId)`, `trackingKeys.routingHistory(documentId)`, `sessionKeys.orderOfBusinesses()`|
|`workflow.approveStep(stepInstanceId)`|Same as `completeActionStep`|Same as `completeActionStep`, additionally `documentKeys.lists()` (lifecycle state may change)|
|`workflow.rejectStep(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`|`documentKeys.detail(documentId)`, `trackingKeys.routingHistory(documentId)`|
|`workflow.returnStepForRevision(stepInstanceId)`|Same as `rejectStep`|Same as `rejectStep`|
|`workflow.submitCommitteeReport(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`|`sessionKeys.orderOfBusinesses()` (red-flag status changes)|
|`workflow.manuallyAdvanceMultiReferralStep(stepInstanceId)`|Same as `submitCommitteeReport`|`sessionKeys.orderOfBusinesses()` (override logged; absent committees stay red-flagged)|
|`workflow.certifyAsPresidingOfficer(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`|`documentKeys.detail(documentId)`|
|`workflow.mayorSign(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|
|`workflow.mayorVeto(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`|`documentKeys.detail(documentId)`|
|`workflow.logMayorLapseConfirmation(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|
|`workflow.recordVetoOverrideVote(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`|`documentKeys.detail(documentId)`|
|`workflow.logDocketingCompletion(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`, `workflowKeys.mySteps()`|`documentKeys.detail(documentId)`|
|`workflow.recordPanlalawiganOutcome(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`|`documentKeys.detail(documentId)`|
|`workflow.resolveValidInPart(documentId)`|`workflowKeys.forDocument(documentId)`|`documentKeys.detail(documentId)`|
|`workflow.confirmPanlalawiganDeemedApproved(stepInstanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`|`documentKeys.detail(documentId)`, `documentKeys.lists()`|
|`workflow.recordNewspaperPublicationDate(documentId)`|— (writes to document metadata)|`documentKeys.detail(documentId)`|
|`workflow.migrateInstanceToNewDefinitionVersion(instanceId)`|`workflowKeys.detail(instanceId)`, `workflowKeys.forDocument(documentId)`|—|

---

### Tracking Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`tracking.logRoutingEntry(documentId)`|`trackingKeys.routingHistory(documentId)`, `trackingKeys.record(documentId)`|—|

---

### Session Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`session.recordAttendance(sessionDate)`|`sessionKeys.attendance(sessionDate)`, `sessionKeys.attendanceStats()`|—|
|`session.scheduleDocumentForFirstReading(documentId)`|`sessionKeys.orderOfBusinesses()`|—|
|`session.enterCommitteeHearingDate(stepInstanceId)`|`sessionKeys.orderOfBusinesses()`|`workflowKeys.detail(instanceId)`|

---

### Records Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`records.applyRetentionSchedule(documentId)`|`recordsKeys.retentionSchedule(documentTypeId)`|—|
|`records.applyClassification(documentId)`|—|`documentKeys.detail(documentId)`, `recordsKeys.legalHold(documentId)`|
|`records.placeLegalHold(documentId)`|`recordsKeys.legalHold(documentId)`|`documentKeys.detail(documentId)`|
|`records.removeLegalHold(documentId)`|`recordsKeys.legalHold(documentId)`|`documentKeys.detail(documentId)`|

---

### Notifications Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`notifications.markAsRead(notificationId)`|`notificationKeys.mine()`|—|
|`notifications.updateOwnPreferences`|`notificationKeys.preferences()`|—|

---

### Audit Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`audit.exportEvents`|— (export presigned URL; audit entries are append-only and not invalidated by export)|—|

---

### Complaints Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`complaints.createClerkAssisted`|`complaintKeys.lists()`|—|
|`complaints.logAndAssign(complaintId)`|`complaintKeys.all()`|—|
|`complaints.enterCommitteeReport(complaintId)`|`complaintKeys.all()`|—|
|`complaints.setOutcome(complaintId)`|`complaintKeys.all()`|—|

---

### Document Request Mutations

|Mutation|Same-module invalidation|Cross-module invalidation|
|---|---|---|
|`documentRequests.createClerkAssisted`|`documentRequestKeys.lists()`|—|
|`documentRequests.approveAsPresidingOfficer(requestId)`|`documentRequestKeys.lists()`|—|
|`documentRequests.approveAsSecretary(requestId)`|`documentRequestKeys.lists()`|—|
|`documentRequests.releaseCopy(requestId)`|`documentRequestKeys.lists()`|—|

---

## Cross-Module Invalidation Chains

Some mutations trigger effects that propagate across multiple modules. These patterns appear frequently enough to warrant a named rule.

**Workflow step completion chain.** Every workflow step advancement — regardless of step type or actor — requires the same three-router invalidation: `workflowKeys.detail`, `workflowKeys.forDocument`, `workflowKeys.mySteps` in the workflow module; `documentKeys.detail` in the documents module (lifecycle state or step assignment display changes); and `trackingKeys.routingHistory` (a routing entry is appended on every step transition per B2 Module 5). If the document is SP legislative in origin, also invalidate `sessionKeys.orderOfBusinesses()` since the Order of Business view is computed from workflow step states.

**Designation grant/revoke chain.** These operations have the widest invalidation surface: `orgKeys.activeDesignations`, `orgKeys.designationHistories`, `iamKeys.currentUser` (the SubjectContext's `delegation_grant_id` and `effective_office_ids` are affected), and `workflowKeys.all()` (step routing is immediately reassigned). The `workflowKeys.all()` broad invalidation is intentional here — it is not possible to enumerate which specific instances are affected without a server roundtrip, and the delegation change takes effect immediately.

**Document lifecycle state change chain.** Any mutation that transitions `lifecycle_state` — which includes `documents.submit`, `documents.cancel`, `documents.archive`, `workflow.approveStep` at terminal steps, and `workflow.confirmPanlalawiganDeemedApproved` — must invalidate both `documentKeys.detail(id)` and `documentKeys.lists()`. Lists are invalidated because lifecycle state is a common list filter and stale state values cause phantom items in queue views (e.g., a "pending approval" document remaining visible after it has moved to "released").

**Committee report status chain.** When a committee report is submitted, manually advanced, or when a document is scheduled for or removed from the Order of Business, the `sessionKeys.orderOfBusinesses()` procedure scope key must be invalidated in addition to the step-level workflow keys. The Order of Business is a derived computed view; its data source spans both the `documents` and `workflow` schemas and TanStack Query has no way to know it is stale without an explicit invalidation signal.

**OCR processing poll pattern.** After `documents.confirmUpload` returns, the OCR job is queued but not yet complete. The `documentKeys.scanQuality(newVersionId)` key should be set up with short polling (`refetchInterval: 2000`, `enabled: !data?.scanQualityCategory`) on the upload confirmation screen until `scan_quality_category` is populated. Once `ocr_processed = true` arrives, stop polling and invalidate `documentKeys.ocrText(versionId)` to load the extracted text.

---

## Index Re-export

```typescript
// /packages/shared/src/query-keys/index.ts

export { iamKeys } from './iam.keys';
export { orgKeys } from './organization.keys';
export { documentKeys } from './document.keys';
export { workflowKeys } from './workflow.keys';
export { trackingKeys } from './tracking.keys';
export { sessionKeys } from './session.keys';
export { recordsKeys } from './records.keys';
export { notificationKeys } from './notification.keys';
export { auditKeys } from './audit.keys';
export { complaintKeys } from './complaint.keys';
export { documentRequestKeys } from './documentRequest.keys';
```

All mutation hooks in `/apps/web/src/hooks/mutations/` must import from `@batac/shared/query-keys` (the package alias) and not construct raw key arrays inline. All `useQuery` call sites must use the factory instance keys for `initialData` and `setQueryData` patterns and may use either the tRPC utils (`trpc.useUtils()`) or factory scope keys for invalidation — whichever is less verbose for the number of routers being invalidated.

---

_This document is a pre-development baseline. It must be updated in the same PR as any new tRPC query procedure added to E1, any change to an existing procedure's input shape, or any factory entry whose key structure is revised. A key factory entry that does not match the procedure's actual tRPC-generated key is a silent correctness bug — there is no compile-time enforcement of this alignment, only this document and the discipline to keep it current._