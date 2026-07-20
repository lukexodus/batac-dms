# Batac City LGU Platform

## E1 — tRPC Router and Procedure Catalog

**Document ID:** E1
**Type:** API Contract Specification — `/web` ↔ `/server` Boundary
**Status:** BLOCKING — Pre-Development Baseline
**Version:** 1.0
**Date:** June 2026
**Based on:** I1 (ABAC Policy Specification), I2 (Role-Permission Matrix), B2 (Module Boundary and Internal API Contracts), C1 (Full Database Schema DDL), Consolidated Architecture and Requirements Reference (Iteration 3), tech-stack (Stack Decisions)
**Audience:** Backend and frontend development team — parallel-work contract

---

## Table of Contents

- [L3–L120] E1 — tRPC Router and Procedure Catalog — E1 — tRPC Router and Procedure Catalog
- [L121–L141] Purpose — Purpose, team workflow rules, parallel-work contracts, and the 7 required metadata fields defined per procedure.
- [L142–L156] Note on Scope — Phase 1 in-scope tRPC routers and excluded citizen self-service REST endpoints, reporting modules, and search meta.
- [L157–L166] Notation — Definitions of traceability and status tags mapping requirements to confirmed, inferred, or deferred procedures.
- [L167–L226] Global Conventions — Directory layouts, camelCase naming verbs, the 5-step middleware security chain, list envelopes, and standard error shapes.
- [L227–L604] Shared Fragment Schemas — Reusable Zod validators for pagination, date ranges, summary shapes, and document/role/classification enums.
  - [L315–L325] `iam.getCurrentUser`
  - [L326–L336] `iam.updateOwnProfile`
  - [L337–L347] `iam.changeOwnPassword`
  - [L348–L358] `iam.listActiveSessions`
  - [L359–L369] `iam.listAllActiveSessions`
  - [L370–L380] `iam.forceTerminateSession`
  - [L381–L391] `iam.listUserDirectory`
  - [L392–L402] `iam.createUserAccount`
  - [L403–L413] `iam.editUserAccount`
  - [L414–L424] `iam.deactivateUserAccount` / `iam.reactivateUserAccount`
  - [L425–L435] `iam.assignRole`
  - [L436–L446] `iam.revokeRole`
  - [L447–L463] `iam.registerCitizenAccountClerkAssisted`
  - [L464–L474] `organization.getOfficeHierarchy`
  - [L475–L486] `organization.createOffice` / `organization.updateOffice`
  - [L487–L497] `organization.deactivateOffice`
  - [L498–L508] `organization.createPosition` / `organization.updatePosition`
  - [L509–L519] `organization.createEmployee` / `organization.updateEmployee`
  - [L520–L530] `organization.assignEmployeeToPosition`
  - [L531–L541] `organization.getActiveDesignations`
  - [L542–L552] `organization.getDesignationHistory`
  - [L553–L563] `organization.createDesignationGrant`
  - [L564–L574] `organization.revokeDesignationGrantEarly`
  - [L575–L585] `organization.createCommittee` / `organization.updateCommittee`
  - [L586–L604] `organization.assignCommitteeMembership`
- [L605–L694] 3.1 General Document CRUD — Draft creation, classification-gated reads, IT Admin metadata bypass, search FTS, and soft deletion rules.
- [L695–L762] 3.2 SP Workflow Document Specifics — Document submission sequencing, QR code attachment, and legislative preliminary or final series number assignments.
- [L763–L863] 3.3 File, Version, and Attachment Handling — Presigned S3 upload URLs, OCR text extraction, scan quality checks, and scanned-back signed copy acceptance.
  - [L765–L775] `documents.requestUploadUrl`
  - [L776–L786] `documents.confirmUpload`
  - [L787–L797] `documents.getVersionHistory`
  - [L798–L808] `documents.downloadVersion`
  - [L809–L819] `documents.getOcrText`
  - [L820–L830] `documents.getScanQualityIndicator`
  - [L831–L841] `documents.triggerManualReOcr`
  - [L842–L852] `documents.flagScannedBackForVerification`
  - [L853–L863] `documents.acceptScannedBackAsOfficial`
- [L864–L1524] 3.4 Secretariat Decision Logging `[Routing superseded by ADR-B2-3]` — superseded by workflow step completion — delegates directly to Workflow router per ADR-B2-3.
  - [L866–L882] `documents.logSecretariatDecision`
  - [L883–L895] `workflow.getInstance`
  - [L896–L906] `workflow.getActiveInstanceForDocument`
  - [L907–L917] `workflow.listMyAssignedSteps`
  - [L918–L928] `workflow.completeActionStep`
  - [L929–L939] `workflow.approveStep` / `workflow.rejectStep` / `workflow.returnStepForRevision`
  - [L940–L950] `workflow.submitCommitteeReport`
  - [L951–L961] `workflow.manuallyAdvanceMultiReferralStep`
  - [L962–L972] `workflow.certifyAsPresidingOfficer`
  - [L973–L983] `workflow.mayorSign` / `workflow.mayorVeto`
  - [L984–L994] `workflow.logMayorLapseConfirmation`
  - [L995–L1005] `workflow.recordVetoOverrideVote`
  - [L1006–L1016] `workflow.logDocketingCompletion`
  - [L1017–L1027] `workflow.recordPanlalawiganOutcome`
  - [L1028–L1038] `workflow.resolveValidInPart`
  - [L1039–L1049] `workflow.confirmPanlalawiganDeemedApproved`
  - [L1050–L1060] `workflow.recordNewspaperPublicationDate`
  - [L1061–L1071] `workflow.migrateInstanceToNewDefinitionVersion`
  - [L1072–L1088] `workflow.getSlaComplianceData`
  - [L1089–L1099] `tracking.getTrackingRecord`
  - [L1100–L1110] `tracking.printQrCoverSheet`
  - [L1111–L1121] `tracking.getRoutingHistory`
  - [L1122–L1132] `tracking.logRoutingEntry`
  - [L1133–L1149] `tracking.scanQrCodeAuthenticated`
  - [L1150–L1160] `session.recordAttendance`
  - [L1161–L1171] `session.getAttendanceRecord`
  - [L1172–L1182] `session.getAttendanceStatistics`
  - [L1183–L1193] `session.getOrderOfBusiness`
  - [L1194–L1204] `session.scheduleDocumentForFirstReading`
  - [L1205–L1221] `session.enterCommitteeHearingDate`
  - [L1222–L1232] `records.getRetentionSchedule`
  - [L1233–L1243] `records.applyRetentionSchedule`
  - [L1244–L1254] `records.applyClassification`
  - [L1255–L1265] `records.placeLegalHold` / `records.removeLegalHold`
  - [L1266–L1284] `records.isUnderLegalHold`
  - [L1285–L1295] `notifications.listMine`
  - [L1296–L1306] `notifications.markAsRead`
  - [L1307–L1317] `notifications.getOwnPreferences` / `notifications.updateOwnPreferences`
  - [L1318–L1334] `notifications.listDeliveryLogs`
  - [L1335–L1345] `audit.listOwnActions`
  - [L1346–L1356] `audit.listOwnOfficeDocumentActions`
  - [L1357–L1367] `audit.listFullLog`
  - [L1368–L1378] `audit.validateChainIntegrity`
  - [L1379–L1395] `audit.exportEvents`
  - [L1396–L1406] `complaints.createClerkAssisted`
  - [L1407–L1417] `complaints.logAndAssign`
  - [L1418–L1428] `complaints.enterCommitteeReport`
  - [L1429–L1439] `complaints.setOutcome`
  - [L1440–L1456] `complaints.listAll`
  - [L1457–L1467] `documentRequests.createClerkAssisted`
  - [L1468–L1478] `documentRequests.generatePrintableForm`
  - [L1479–L1489] `documentRequests.approveAsPresidingOfficer`
  - [L1490–L1500] `documentRequests.approveAsSecretary`
  - [L1501–L1511] `documentRequests.releaseCopy`
  - [L1512–L1524] `documentRequests.listAll`
- [L1525–L1550] Cross-Reference: Procedure-to-Policy Traceability Index — Inverted trace index mapping permission matrix sections to in-scope, deferred, or inferred router procedures.
- [L1551–L1561] Required Follow-Up Before Full Sign-Off — Deferred action items for platform admin CRUD, records bulk operations, and signature uploads.

---

## Purpose

This document catalogs every tRPC router and every procedure within each router required for Phase 1 of the Batac City LGU Platform. Per the stack decision recorded in `tech-stack.md`, tRPC is used **exclusively** for `/web` (the internal authenticated Vite + React SPA) communicating with `/server` (Fastify). The public portal, mobile clients, and third parties are REST-only and are **not** covered by this document — see Note on Scope below.

This is the contract both teams build against in parallel:

- **Backend developers** implement each procedure's resolver against the module's internal service layer (defined in B2's Published API) and the database schema (defined in C1).
- **Frontend developers** build `/web` screens against the input/output Zod schemas and the role-gating rules below, without waiting for the backend implementation to exist, because the shapes are fixed here first.

For every procedure this document specifies:

1. **Procedure name** — the literal tRPC procedure identifier as it will appear in the router (e.g. `documents.create`)
2. **Type** — `query` (read, cacheable by TanStack Query) or `mutation` (write)
3. **Input schema** — a reference to the Zod schema in `/packages/shared` that validates the input
4. **Output schema** — a reference to the Zod schema in `/packages/shared` that types the return value
5. **Callable by** — which of the 13 roles (per I2 Roles Reference) may invoke this procedure at all, before any ABAC narrowing
6. **ABAC conditions** — any additional per-request narrowing beyond the role gate, with a direct citation back to the I1 policy clause that supplies it
7. **Business operation** — what the resolver actually does: which internal module method(s) it calls (per B2's Published API), what state it mutates, and what domain events it triggers

---

## Note on Scope

### What Is In This Document

All tRPC routers consumed by `/web`, covering the Phase 1 Minimum Viable Core (consolidated reference Part 2): IAM, Organization, Documents (including the three SP workflow document types and Certification of Urgency), Workflow execution, Tracking/DTS, Session Attendance and Order of Business, Records (the Phase-1-relevant subset: classification and archive-adjacent reads only — full RMS is Phase 2 per B2 Module 6), Notifications (in-app), Audit (read-only), and the internal-staff side of Citizen Complaints and Document Requests (Secretariat logging, routing, and approval — not citizen self-service, which is REST/Portal).

### What Is Out of Scope

- **Citizen self-service procedures** (complaint submission, document request submission, public tracking lookup, public document browsing). These are unauthenticated or citizen-session REST endpoints served by the `portal` module (Phase 3) and the public REST layer described in B2 Module 10 and I1 Sections 10.1/10.4/13.1. tRPC is explicitly not used for these per the stack decision.
- **Reporting module procedures** (Phase 2 — B2 Module 11).
- **Search Meta module procedures** (Phase 2 — B2 Module 9). In Phase 1, full-text search is exposed as ordinary query procedures on the relevant resource routers (e.g. `documents.search`), backed directly by PostgreSQL FTS, not by a separate `search_meta` router — consistent with B2 Module 9's Phase 1 note that the abstraction layer is not active yet.
- **Platform Administrator configuration procedures for entities not yet defined in C1** (e.g. notification template CRUD, SLA threshold CRUD). Where the underlying schema is confirmed in C1, the router is included; where it is Tier 2 configuration whose schema is not part of C1's eight Phase 1 schemas (e.g. `iam.permissions`/`iam.roles` editing UI is in scope since those tables exist in C1; a generic "SLA threshold" table does not yet exist in C1 and is `[Deferred]` accordingly — flagged at the relevant section).

---

## Notation

| Tag | Meaning |
|---|---|
| `[Confirmed — source]` | The procedure's existence, shape, or constraint is directly traceable to a cited document |
| `[Inference]` | A reasonable procedure design implied by confirmed facts (e.g. a `list` query implied by a confirmed `create` mutation), not stated verbatim anywhere |
| `[Deferred]` | Procedure or field depends on a decision or schema not yet finalized (cross-referenced to the consolidated reference's Part 14 resolution or to a noted C1 gap) |

---

## Global Conventions

### 1. Router File Layout

One router per module, matching B2's eleven-module list exactly (minus the three out-of-scope-for-tRPC modules noted above). Each router lives at `/apps/server/src/modules/{module}/router.ts` and is composed into the root router at `/apps/server/src/trpc/root.ts`.

```
appRouter
  ├─ iam            (iamRouter)
  ├─ organization    (organizationRouter)
  ├─ documents       (documentsRouter)
  ├─ workflow        (workflowRouter)
  ├─ tracking        (trackingRouter)
  ├─ session         (sessionRouter)        -- session attendance / Order of Business; thin wrapper, workflow-adjacent
  ├─ records         (recordsRouter)        -- Phase 1 subset only
  ├─ notifications    (notificationsRouter)
  ├─ audit            (auditRouter)
  ├─ complaints       (complaintsRouter)    -- internal-staff side only
  └─ documentRequests (documentRequestsRouter) -- internal-staff side only
```

### 2. Procedure Naming

`{resource}.{verb}` or `{resource}.{verb}_{qualifier}`, all `camelCase` after the dot, matching the tRPC convention of nested router namespacing (`documents.create` resolves to `appRouter.documents.create`). Verbs are restricted to a fixed vocabulary for consistency: `create`, `get`, `list`, `update`, `delete` (always soft), and named business actions (`submit`, `approve`, `reject`, `cancel`, `assignPreliminaryNumber`, etc.) where a generic CRUD verb would not capture a legally distinct action. `[Inference — naming convention; not stated verbatim in any source]`

### 3. The `protectedProcedure` Base and Middleware Chain

Every procedure in this catalog (with zero exceptions — there is no `publicProcedure` in this router set, since `/web` is "fully authenticated," per `tech-stack.md`) is built on a shared `protectedProcedure` base that runs, in order:

1. `verifyAccessToken` — populates `ctx.subject` (the `SubjectContext` object defined in I1 §1) from the JWT
2. `loadDelegationContext` — expands `ctx.subject.effective_office_ids` / `effective_roles` per I1 §16, if `subject.delegation_grant_id` is non-null
3. The route-specific Zod input parse (tRPC's own `.input()` validator)
4. `requireRole([...])` — the **Callable by** gate for each procedure below; a coarse, role-set check
5. `requirePolicy(resource, action)` — invokes `IAM.evaluatePolicy()` (B2 Module 1 Published API), running the full I1 cascade (Global Gates 1–5, then the resource-specific policy) for the **ABAC conditions** narrowing described per procedure

A procedure that has "no additional ABAC condition beyond role" still runs step 5 — the Global Gates (tenant isolation, IT Admin content isolation, Platform Admin operational exclusion, soft-delete gate) always apply, even when no resource-specific clause is listed. This document only narrates the *resource-specific* clause per procedure since the Global Gates are constant and already fully specified in I1 §2. `[Confirmed — I1 §2, §B5 cascade reference; Inference for the literal middleware names, which are not given verbatim in I1/B5 but are required by the cascade structure I1 describes]`

### 4. Input/Output Schema Reference Convention

Schemas are referenced by their export name from `/packages/shared/src/schemas/{module}.ts`. This document does not reproduce full Zod source (that is an implementation task) but specifies every field, its type, and its optionality precisely enough that the actual schema file is a direct transcription. Shared fragment schemas (`paginationInput`, `dateRangeInput`, `auditableEntityOutput`) are defined once in §"Shared Fragment Schemas" below and referenced by name thereafter to avoid repetition.

### 5. Output Envelope for List Procedures

Every `list` procedure returns the cursor-paginated shape:

```typescript
interface PaginatedOutput<T> {
  items: T[];
  nextCursor: string | null;
}
```

matching the cursor convention already established in B2's `SearchQuery`/`SearchResult` and `AuditQueryFilter`/`AuditQueryResult` types (B2 Modules 8 and 9). `[Confirmed — B2 Modules 8, 9 cursor pattern, generalized to all list procedures — Inference for the generalization itself]`

### 6. Error Shape

All procedures throw `TRPCError` with one of: `UNAUTHORIZED` (no valid session), `FORBIDDEN` (role or ABAC gate failed — the `reason` string from the I1 policy clause, e.g. `"tenant_isolation"`, `"classification_denied"`, is attached as `cause`), `NOT_FOUND`, `BAD_REQUEST` (Zod validation failure — handled automatically by tRPC's input parser), `CONFLICT` (state-transition or uniqueness violation — e.g. attempting `documents.assignFinalNumber` when `final_number` is already set), `PRECONDITION_FAILED` (a workflow or document state precondition is not met, distinct from a pure ABAC denial). `[Inference — standard tRPC error code usage; mapping to LGU-specific cases is Inference]`

---

## Shared Fragment Schemas

Referenced throughout this document by name.

```typescript
// paginationInput — appended to every list procedure's input
const paginationInput = z.object({
  cursor: z.string().nullish(),
  pageSize: z.number().int().min(1).max(100).default(20),
});

// dateRangeInput — used wherever a procedure filters by a time window
const dateRangeInput = z.object({
  from: z.coerce.date().nullish(),
  to: z.coerce.date().nullish(),
});

// userSummaryOutput — mirrors B2 UserSummary exactly
const userSummaryOutput = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  email: z.string().email(),
  officeId: z.string().uuid().nullable(),
  positionTitle: z.string().nullable(),
});

// officeSummaryOutput — mirrors B2 OfficeSummary exactly
const officeSummaryOutput = z.object({
  officeId: z.string().uuid(),
  name: z.string(),
  parentOfficeId: z.string().uuid().nullable(),
  type: z.string(),
});

// auditableEntityOutput — fields present on every readable row, mirroring
// C1's universal city_id / timestamps / soft-delete convention (Part 1.3–1.5)
const auditableEntityOutput = z.object({
  id: z.string().uuid(),
  cityId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
  deletedAt: z.coerce.date().nullable(),
});

// documentLifecycleStateEnum — mirrors C1 documents.lifecycle_state_enum exactly
const documentLifecycleStateEnum = z.enum([
  'draft', 'under_review', 'pending_mayor_action', 'pending_panlalawigan_review',
  'approved', 'released', 'superseded', 'cancelled', 'rejected',
]);

// classificationLevelEnum — mirrors C1 documents.classification_level_enum exactly
const classificationLevelEnum = z.enum([
  'public', 'internal', 'confidential', 'restricted',
]);

// documentTypeCodeEnum — the Phase 1 SP workflow document type codes
// referenced throughout I1 (§3.1, §3.5, §3.7–3.9) plus the administrative
// document types confirmed in the consolidated reference Part 5.1
const documentTypeCodeEnum = z.enum([
  'SP_RESOLUTION',
  'SP_ORDINANCE',
  'SP_APPROPRIATION_ORDINANCE',
  'CERTIFICATION_OF_URGENCY',
  'DESIGNATION',
  'NOTICE_OF_COMMITTEE_HEARING',
  'NOTICE_OF_SPECIAL_SESSION',
  'LETTER_RECEIVED',
  'LETTER_SENT',
  'MEMO_OUTGOING',
  'MEMO_INCOMING',
  'CITIZEN_COMPLAINT',
  'DOCUMENT_REQUEST_FORM',
]);

// roleCodeEnum — the 13 roles per I2 Roles Reference / I1 §15 D-ABAC-01 seed list
const roleCodeEnum = z.enum([
  'sys_admin', 'plat_admin', 'records_officer', 'dept_encoder', 'dept_approver',
  'sp_secretary', 'sp_member', 'sp_presiding_officer', 'mayor',
  'brgy_encoder', 'brgy_captain', 'auditor', 'citizen',
]);
```

---

# Module 1 — IAM Router (`iamRouter`)

**Schema:** `iam`. **Backing service:** B2 Module 1 Published API (`evaluatePolicy`, `getUserById`) plus the IAM module's own internal user/session/role services (not separately published, since they are called only from this router, not cross-module).

### `iam.getCurrentUser`

| | |
|---|---|
| Type | `query` |
| Input | `z.void()` |
| Output | `userSummaryOutput.extend({ roles: z.array(roleCodeEnum), permissions: z.array(z.string()), isIta: z.boolean(), isPa: z.boolean(), mfaEnabled: z.boolean() })` |
| Callable by | All 12 authenticated roles (every role except `citizen`, who uses the Portal REST layer, not `/web`) |
| ABAC conditions | None beyond the Global Gates. The subject may always read their own resolved identity. |
| Business operation | Returns the decoded `SubjectContext` fields already on `ctx.subject` (I1 §1) plus a live `mfa_enabled` flag read from `iam.users` (C1 §2.2). No write. `[Confirmed — I2 Section 1 "View own profile" row, ✅ for all 12 internal roles]` |

### `iam.updateOwnProfile`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ displayName: z.string().min(1).max(200).optional(), phoneNumber: z.string().max(32).optional() })` — non-security fields only |
| Output | `userSummaryOutput` |
| Callable by | All 12 authenticated roles |
| ABAC conditions | Subject may only update their own `iam.users` row (`WHERE id = subject.user_id`); enforced structurally by not accepting a target user ID as input, not by a separate policy check. |
| Business operation | Updates `iam.users` non-security fields. Emits no domain event (display-only metadata change is below the audit-worthy threshold; contrast with `role.assigned`/`revoked`, which are audited). `[Confirmed — I2 Section 1 "Edit own profile (non-security fields)", ✅ for all roles]` |

### `iam.changeOwnPassword`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(12) })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | All 12 authenticated roles |
| ABAC conditions | None beyond Global Gates; current-password re-verification is a business rule, not an ABAC clause. |
| Business operation | Verifies `currentPassword` against `iam.credentials.password_hash` (Argon2id), writes new hash, updates `last_changed_at` (C1 §2.3). Does **not** terminate other sessions (single-session policy is enforced at login, not at password change). `[Confirmed — I2 Section 1 "Change own password", ✅ for all roles]` |

### `iam.listActiveSessions`

|                    |                                                                                                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type               | `query`                                                                                                                                                                           |
| Input              | `z.void()`                                                                                                                                                                        |
| Output             | `z.array(z.object({ sessionId: z.string().uuid(), ipAddress: z.string().nullable(), userAgent: z.string().nullable(), createdAt: z.coerce.date(), expiresAt: z.coerce.date() }))` |
| Callable by        | All 12 authenticated roles                                                                                                                                                        |
| ABAC conditions    | `WHERE user_id = subject.user_id` only — own sessions.                                                                                                                            |
| Business operation | Reads `iam.sessions` filtered to the caller. `[Confirmed — I2 Section 1 "View active sessions (own)"]`                                                                            |

### `iam.listAllActiveSessions`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput` |
| Output | `z.object({ items: z.array(z.object({ sessionId: z.string().uuid(), userId: z.string().uuid(), userDisplayName: z.string(), ipAddress: z.string().nullable(), createdAt: z.coerce.date(), expiresAt: z.coerce.date() })), nextCursor: z.string().nullable() })` |
| Callable by | `sys_admin` only |
| ABAC conditions | `subject.is_ita = true` required — System Administrator scope, not Platform Administrator. |
| Business operation | Reads all rows of `iam.sessions`. `[Confirmed — I2 Section 1 "View active sessions (all users)", ✅ only for Sys Admin]` |

### `iam.forceTerminateSession`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ sessionId: z.string().uuid(), reason: z.string().min(1) })` — reason is mandatory, not optional |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sys_admin` only |
| ABAC conditions | `subject.is_ita = true`. `mandatory_reason` field must be non-empty (I1 §12.3) — enforced by the Zod `.min(1)`, not only by application logic. |
| Business operation | Sets `iam.sessions.terminated_at`, `terminated_by`, `termination_reason = 'forced'` (C1 §2.4). Emits `session.terminated` with `reason: 'forced'` (B2 Module 1) → consumed by Audit. `[Confirmed — I1 §12.3 "session:force_terminate"; I2 Section 1; B2 Module 1 Events Emitted]` |

### `iam.listUserDirectory`

|                    |                                                                                                                                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type               | `query`                                                                                                                                                                                                                                                                                |
| Input              | `paginationInput.extend({ officeId: z.string().uuid().optional(), search: z.string().max(200).optional() })`                                                                                                                                                                           |
| Output             | `z.object({ items: z.array(z.object({ userId: z.string().uuid(), displayName: z.string(), officeId: z.string().uuid().nullable(), officeName: z.string().nullable(), positionTitle: z.string().nullable(), roleCodes: z.array(roleCodeEnum) })), nextCursor: z.string().nullable() })` |
| Callable by        | `sys_admin`, `plat_admin`, `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor`                                                                                                                                 |
| ABAC conditions    | For `dept_encoder`, `dept_approver`, `sp_member`: output is limited to name/office/position only — `lastLoginAt`/credential-status fields are never included in the output schema for this procedure at all (not filtered post-hoc), satisfying I2 Conditional Note ¹ by construction. |
| Business operation | Reads `iam.users` joined to `organization.employees`/`assignments`/`role_assignments`. `[Confirmed — I2 Section 1 "View user directory", with 🔶¹ for the three limited-view roles]`                                                                                                   |

### `iam.createUserAccount`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ username: z.string().min(3).max(64), email: z.string().email(), employeeId: z.string().uuid() })` |
| Output | `userSummaryOutput` |
| Callable by | `sys_admin` only |
| ABAC conditions | `subject.is_ita = true`. |
| Business operation | Inserts `iam.users` row, links to an existing `organization.employees` row via `employees.user_id` (C1 §3.4). Does not assign a role — role assignment is a separate Platform Admin action below. `[Confirmed — I2 Section 1 "Create user accounts", ✅ only for Sys Admin]` |

### `iam.editUserAccount`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ userId: z.string().uuid(), email: z.string().email().optional(), officeId: z.string().uuid().optional() })` |
| Output | `userSummaryOutput` |
| Callable by | `sys_admin`, `plat_admin` |
| ABAC conditions | None beyond role gate and Global Gate 3 (Platform Admin Operational Exclusion does **not** block this — `manage_roles`-adjacent account editing is on the Tier 2 allowed-action list per I1 Gate 3). |
| Business operation | Updates `iam.users` non-credential fields. `[Confirmed — I2 Section 1 "Edit user accounts", ✅ for Sys Admin and Plat Admin]` |

### `iam.deactivateUserAccount` / `iam.reactivateUserAccount`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ userId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true), newStatus: z.enum(['active', 'deactivated']) })` |
| Callable by | `sys_admin`, `plat_admin` |
| ABAC conditions | None beyond role gate. |
| Business operation | Sets `iam.users.status` to `'deactivated'` or back to `'active'` (C1 §2.2 `user_status_enum`). Does not soft-delete the row. `[Confirmed — I2 Section 1 "Deactivate / reactivate user accounts"]` |

### `iam.assignRole`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ userId: z.string().uuid(), roleCode: roleCodeEnum, officeScopeId: z.string().uuid().nullish() })` |
| Output | `z.object({ roleAssignmentId: z.string().uuid() }) `|
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true`. **Invariant #12 enforced here at insert time**: if the target user already holds any role where `iam.roles.type_code = 'document_processor'` and the incoming role is `plat_admin` (or vice versa), the insert is rejected with `FORBIDDEN` / `"platform_admin_combination_prohibited"`, per the `trg_enforce_platform_admin_exclusion` trigger (C1-adjacent; I1 §15 Invariant #12). |
| Business operation | Inserts `iam.role_assignments` (C1 §2.9), respecting the partial unique index `uq_role_assignments_active` (one active role-per-office at a time). Emits `role.assigned` (B2 Module 1) → Audit. `[Confirmed — I2 Section 1 "Assign roles to users", ✅ only Plat Admin; I1 §15 Invariant #12; C1 §2.9]` |

### `iam.revokeRole`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ roleAssignmentId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true`. |
| Business operation | Sets `iam.role_assignments.is_active = false`, `revoked_at`, `revoked_by` (C1 §2.9). Emits `role.revoked` → Audit. `[Confirmed — I2 Section 1 "Revoke roles from users"]` |

### `iam.registerCitizenAccountClerkAssisted`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ fullName: z.string().min(1), birthdate: z.coerce.date(), phone: z.string().min(7), email: z.string().email(), idType: z.string(), idReference: z.string().optional() })` |
| Output | `z.object({ citizenUserId: z.string().uuid() })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | None beyond role gate. |
| Business operation | Calls into the `portal` module's citizen-identity service (out of the eight C1 Phase 1 schemas, but the action itself is triggered from an internal `/web` screen at the Secretariat counter, hence tRPC rather than REST, distinct from citizen *self*-registration which is REST). `[Confirmed — I2 Section 1 "Register citizen account (clerk-assisted)", ✅ only SP Secretary; consolidated reference Part 4.15 access mode 3]` |

---

# Module 2 — Organization Router (`organizationRouter`)

**Schema:** `organization`. **Backing service:** B2 Module 2 Published API (`resolveCurrentHolder`, `getActiveDelegationForUser`, `getOfficeById`, `getOfficeHierarchy`, `getEmployeeByUserId`).

### `organization.getOfficeHierarchy`

| | |
|---|---|
| Type | `query` |
| Input | `z.void()` |
| Output | `z.object({ offices: z.array(officeSummaryOutput) })` |
| Callable by | `sys_admin`, `plat_admin`, `records_officer`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor` (full tree); `dept_encoder`, `dept_approver` (read-only reference per I2 Conditional Note ²) |
| ABAC conditions | None — the office tree itself is not classification-gated; only document content is. |
| Business operation | Calls `Organization.getOfficeHierarchy()` directly (B2 Published API — this router method *is* the thin tRPC wrapper around that API for `/web` consumption). `[Confirmed — I2 Section 2 "View organization chart", ✅/🔶² split; B2 Module 2]` |

### `organization.createOffice` / `organization.updateOffice`

| | |
|---|---|
| Type | `mutation` |
| Input (create) | `z.object({ name: z.string().min(1), code: z.string().min(1).max(32), officeType: z.enum(['sp_office','mayors_office','city_department','barangay','other']), parentOfficeId: z.string().uuid().nullish() })` |
| Input (update) | `z.object({ officeId: z.string().uuid() }).merge(createInput.partial())` |
| Output | `officeSummaryOutput` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true`. |
| Business operation | Inserts/updates `organization.offices` (C1 §3.2), respecting `ck_offices_not_self_parent`. `[Confirmed — I2 Section 2 "Create / edit office records", ✅ only Plat Admin]` |

### `organization.deactivateOffice`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ officeId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true`. |
| Business operation | Soft-deletes `organization.offices` row (`deleted_at`/`deleted_by`) — Invariant #2 forbids hard delete even for admin-managed config tables. `[Confirmed — I2 Section 2 "Deactivate office records"; C1 §1.5]` |

### `organization.createPosition` / `organization.updatePosition`

| | |
|---|---|
| Type | `mutation` |
| Input (create) | `z.object({ officeId: z.string().uuid(), title: z.string().min(1), code: z.string().min(1).max(32), authorityLevel: z.enum(['executive','managerial','staff','support']) })` |
| Output | `z.object({ positionId: z.string().uuid(), title: z.string() })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true`. |
| Business operation | Inserts/updates `organization.positions` (C1 §3.3). `[Confirmed — I2 Section 2 "Create / edit position records"]` |

### `organization.createEmployee` / `organization.updateEmployee`

| | |
|---|---|
| Type | `mutation` |
| Input (create) | `z.object({ userId: z.string().uuid().nullish(), firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email().nullish(), phoneNumber: z.string().nullish(), employeeNumber: z.string().nullish() })` |
| Output | `z.object({ employeeId: z.string().uuid() })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true`. |
| Business operation | Inserts/updates `organization.employees` (C1 §3.4). `userId` is nullable — Barangay officials with no system access are created here without a corresponding `iam.users` row, per the schema note in C1 §3.4. `[Confirmed — I2 Section 2 "Create / edit employee records"; C1 §3.4; consolidated reference Part 4.4]` |

### `organization.assignEmployeeToPosition`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ employeeId: z.string().uuid(), positionId: z.string().uuid(), officeId: z.string().uuid(), startDate: z.coerce.date(), endDate: z.coerce.date().nullish() })` |
| Output | `z.object({ assignmentId: z.string().uuid() })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true`. |
| Business operation | Inserts `organization.assignments` (C1 §3.5). Application-layer check (not a DB constraint, per C1 §3.5's explicit reasoning) enforces "exactly one active holder" for singular positions (Mayor, Vice Mayor, SP Secretary) but not for plural ones (Councilor). `[Confirmed — I2 Section 2 "Assign employees to offices and positions"; C1 §3.5]` |

### `organization.getActiveDesignations`

| | |
|---|---|
| Type | `query` |
| Input | `z.void()` |
| Output | `z.array(z.object({ delegationId: z.string().uuid(), designationDocumentId: z.string().uuid(), delegatingUserId: z.string().uuid(), delegatingDisplayName: z.string(), delegatedToUserId: z.string().uuid(), delegatedToDisplayName: z.string(), officeId: z.string().uuid(), positionTitle: z.string(), validFrom: z.coerce.date(), validUntil: z.coerce.date() }))` |
| Callable by | `sys_admin`, `plat_admin`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `auditor` |
| ABAC conditions | None beyond role gate — designation visibility is not office-scoped per I2 (all listed roles see all active designations). |
| Business operation | Reads `organization.delegation_grants WHERE is_active = true` (C1 §3.6), joined to `organization.employees` for display names. `[Confirmed — I2 Section 2 "View active designations"]` |

### `organization.getDesignationHistory`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ employeeId: z.string().uuid().optional() })` |
| Output | `z.object({ items: z.array(z.object({ delegationId: z.string().uuid(), designationDocumentId: z.string().uuid(), delegatingDisplayName: z.string(), delegatedToDisplayName: z.string(), positionTitle: z.string(), validFrom: z.coerce.date(), validUntil: z.coerce.date(), isActive: z.boolean(), revokedAt: z.coerce.date().nullable() })), nextCursor: z.string().nullable() })` |
| Callable by | `sys_admin`, `plat_admin`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `auditor` |
| ABAC conditions | None beyond role gate. |
| Business operation | Reads `organization.delegation_grants` including inactive/expired/revoked rows. `[Confirmed — I2 Section 2 "View designation history"]` |

### `organization.createDesignationGrant`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ designationDocumentId: z.string().uuid(), delegatingEmployeeId: z.string().uuid(), delegatedToEmployeeId: z.string().uuid(), officeId: z.string().uuid(), positionId: z.string().uuid(), scopeDescription: z.string().min(1), legalBasis: z.string().nullish(), validFrom: z.coerce.date(), validUntil: z.coerce.date() })` — `validUntil` is **required**, not optional, per the open-ended-delegation prohibition |
| Output | `z.object({ delegationId: z.string().uuid() })` |
| Callable by | `sp_secretary` only (the Secretary *logs* the grant issued by the Mayor or Vice Mayor; neither of those two roles calls this procedure directly — see Business operation) |
| ABAC conditions | The grant's `delegatingEmployeeId` must resolve to the Mayor (executive scope) or Vice Mayor (legislative scope) per I1 §11.1 — validated against `organization.assignments` for that employee's current position, not against the calling subject's own identity (the Secretary is the caller, not the delegating authority). **Invariant #16** is enforced here: `INSERT` is rejected with `CONFLICT` if `organization.delegation_grants` already has an active row for `delegated_to_employee_id` (the partial unique index `uq_delegation_grants_one_active_per_delegatee`, C1 §3.6). No Platform Admin confirmation step exists — the grant is effective immediately on successful insert. |
| Business operation | Inserts `organization.delegation_grants` (C1 §3.6). Emits `delegation.granted` (B2 Module 2) → consumed by **Workflow** (immediate step re-routing) and **Audit**. `[Confirmed — I2 Conditional Note ³; I1 §11.1; I1 §15 Invariant #16; consolidated reference Part 4.12, Part 11.13]` |

### `organization.revokeDesignationGrantEarly`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ delegationId: z.string().uuid(), writtenInstructionReference: z.string().min(1).optional() })` — required when the caller is `sp_secretary` rather than the original delegating authority |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary`, `sp_presiding_officer`, `mayor` |
| ABAC conditions | `sp_presiding_officer` and `mayor` may revoke only a grant where `subject.user_id` (resolved to their employee record) matches `grant.delegating_employee_id` — i.e., only their own issued grant. `sp_secretary` may revoke **any** grant only if `writtenInstructionReference` is supplied and non-empty (I1 §11.2) — an open-ended revocation with no documented instruction is rejected with `BAD_REQUEST`. |
| Business operation | Sets `organization.delegation_grants.is_active = false`, `revoked_at`, `revoked_by` (C1 §3.6). Emits `delegation.revoked` (B2 Module 2) → Workflow (re-routes affected steps back to original authority), Audit. `[Confirmed — I2 Conditional Note ⁴; I1 §11.2]` |

### `organization.createCommittee` / `organization.updateCommittee`

| | |
|---|---|
| Type | `mutation` |
| Input (create) | `z.object({ name: z.string().min(1), code: z.string().min(1).max(32), chairedByEmployeeId: z.string().uuid().nullish() })` |
| Output | `z.object({ committeeId: z.string().uuid() })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true`. |
| Business operation | Inserts/updates `organization.committees` (C1 §3.7). `[Confirmed — I2 Section 3 "Create / edit standing committee definitions"]` |

### `organization.assignCommitteeMembership`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ committeeId: z.string().uuid(), employeeId: z.string().uuid(), committeeRole: z.enum(['chairman','vice_chairman','member']), startDate: z.coerce.date() })` |
| Output | `z.object({ membershipId: z.string().uuid() })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true`. |
| Business operation | Inserts `organization.committee_memberships`, respecting `uq_committee_memberships_active` (one active role per person per committee — C1 §3.8). This is the write path that populates the `subject.committee_ids` JWT claim at the affected user's next token refresh (I1 §1, D-ABAC-06). `[Confirmed — I2 Section 3 "Create / edit standing committee definitions" (committees are config, memberships are the operational join); I1 §1 D-ABAC-06; C1 §3.8]` |

---

# Module 3 — Documents Router (`documentsRouter`)

**Schema:** `documents`. **Backing service:** B2 Module 3 Published API (`getDocumentById`, `getDocumentType`, `transitionState`, `assignFinalNumber`, `getAttachmentRefs`) plus this router's own create/upload/numbering handlers that are the *callers* of those internal services, not re-exports of them.

This is the largest router. It is organized into five sub-sections: general document CRUD, SP workflow document specifics, numbering, file/version/attachment handling, and Secretariat decision logging.

## 3.1 General Document CRUD

### `documents.create`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentTypeId: z.string().uuid(), title: z.string().min(1).max(500), metadata: z.record(z.unknown()).default({}) })` |
| Output | `z.object({ documentId: z.string().uuid(), lifecycleState: documentLifecycleStateEnum })` |
| Callable by | `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain` |
| ABAC conditions | `subject.office_id ∈ subject.effective_office_ids`. For `document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`: `originating_office_id` on the inserted row is **always** set server-side to the SP Secretariat office UUID, regardless of what office the calling user belongs to — the request body has no `originatingOfficeId` field at all, so a `sp_member` (a Councilor) can author the draft text while the row is correctly attributed. `metadata` is validated against `documents.document_types.metadata_schema` (the JSON Schema for that type) as a second-pass validation after the generic Zod `.record()` parse. |
| Business operation | Inserts `documents.documents` with `lifecycle_state = 'draft'` (C1 §4.5). Does **not** assign QR tracking number or preliminary number yet — those occur at formal `submit`, per the confirmed sequencing (Secretariat logs → QR assigned → Preliminary number assigned). Emits no domain event at `draft` creation (the event-worthy moment is `submit`, which is when `document.created` fires per B2 Module 3's event table — see `documents.submit` below). `[Confirmed — I1 §3.1 "document:create"; I2 Section 4 "Create new document (draft)"; C1 §4.5; B2 Module 3 event table shows document.created tied to "Secretariat logs a new document," i.e. submit-time, not draft-time]` |

### `documents.get`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ documentId: z.string().uuid(), documentTypeId: z.string().uuid(), documentTypeName: z.string(), title: z.string(), lifecycleState: documentLifecycleStateEnum, classificationLevel: classificationLevelEnum, originatingOfficeId: z.string().uuid(), ownedByOfficeId: z.string().uuid(), preliminaryNumber: z.string().nullable(), finalNumber: z.string().nullable(), qrTrackingNumber: z.string().uuid(), metadata: z.record(z.unknown()), createdBy: z.string().uuid(), createdAt: z.coerce.date(), supersededBy: z.string().uuid().nullable(), supersededAt: z.coerce.date().nullable(), closureReason: z.string().nullable() })` |
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor` |
| ABAC conditions | Implements I1 §3.2 in full: own-office read always allowed for the listed roles; cross-office read for `records_officer`/`sp_secretary`/`sp_presiding_officer`/`mayor`/`auditor` requires `classification_level IN ('public','internal')` **and** `has_cross_office_read_grant()`; `sp_member` cross-committee read requires `subject.committee_ids` intersecting the document's assigned committee, **or** the document having been read into an SP session; `classification_level = 'public'` is always readable by anyone authenticated. Gate 4 (Classification Gate) blocks Confidential/Restricted unless the subject is on the type's allowlist — IT Admin is excluded from this router entirely (not in the Callable-by list) per Gate 2/Invariant #10, but `sys_admin` may still reach document *metadata* via a separate, narrower procedure (`documents.getMetadataForAdmin`, defined below) since metadata (not content) remains visible to IT Admin. |
| Business operation | Calls `Documents.getDocumentById()` (B2 Published API). `[Confirmed — I1 §3.2 in full]` |

### `documents.getMetadataForAdmin`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ documentId: z.string().uuid(), title: z.string(), lifecycleState: documentLifecycleStateEnum, finalNumber: z.string().nullable(), classificationLevel: classificationLevelEnum })` — deliberately excludes `metadata` (which may embed OCR-adjacent or content-derived fields) and any version/attachment reference |
| Callable by | `sys_admin` only |
| ABAC conditions | Gate 2 permits metadata-only access to Confidential/Restricted documents for IT Admin (title, status, number); content remains blocked. This procedure exists specifically so IT Admin's operational-monitoring need (I1 Gate 2 prose: "Document metadata... remains readable to IT Admin to support operational monitoring") has a narrow, separately-typed surface rather than reusing `documents.get`'s broader output shape. |
| Business operation | Calls `Documents.getDocumentById()` and strips all fields not in the output schema before returning. `[Confirmed — I1 §2 Gate 2 prose; Inference for this being a separate procedure rather than a conditional field-strip inside documents.get]` |

### `documents.list`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ documentTypeId: z.string().uuid().optional(), lifecycleState: documentLifecycleStateEnum.optional(), officeId: z.string().uuid().optional(), ...dateRangeInput.shape })` |
| Output | `z.object({ items: z.array(documentListItemOutput), nextCursor: z.string().nullable() })` where `documentListItemOutput` is the same shape as `documents.get`'s output minus `metadata` |
| Callable by | Same role set as `documents.get` |
| ABAC conditions | Same scoping as `documents.get`, applied as a `WHERE` filter rather than a single-row check; PostgreSQL RLS is the second enforcement layer here (I1 throughout; consolidated reference Part 11.8). |
| Business operation | Reads `documents.documents` with the office/classification filters above. `[Inference — a list procedure is required for any dashboard or queue view; not separately named in I1/I2 but structurally necessary given documents.get exists]` |

### `documents.search`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ queryText: z.string().min(1), documentTypeIds: z.array(z.string().uuid()).optional(), classificationLevels: z.array(classificationLevelEnum).optional(), ...dateRangeInput.shape })` |
| Output | `z.object({ items: z.array(z.object({ documentId: z.string().uuid(), title: z.string(), documentTypeName: z.string(), finalNumber: z.string().nullable(), currentState: documentLifecycleStateEnum, relevanceScore: z.number().optional() })), nextCursor: z.string().nullable() })` |
| Callable by | `records_officer`, `dept_encoder` (🔶 scoped), `dept_approver` (🔶 scoped), `sp_secretary`, `sp_member` (🔶 scoped), `sp_presiding_officer`, `mayor`, `auditor` |
| ABAC conditions | Per I2 Conditional Note ¹⁰: Encoders/Approvers/SP Members are scoped to documents in their own office (or, for SP Members, their committee/session scope) — enforced as an additional `WHERE` clause layered on top of the PostgreSQL FTS query itself, not a separate code path. |
| Business operation | Phase 1: calls `SearchMeta.search(queryText, filters, callerContext)` — the thin pass-through layer introduced by ADR-B2-5. Under the hood, `SearchMeta.search()` executes a `tsvector`/`tsquery` query against `documents.documents`/`documents.versions.ocr_text` in Phase 1 (same SQL, different call site). In Phase 2, `SearchMeta.search()` will delegate to Elasticsearch without callers changing. This is the **one explicit cross-schema exception** to B2 Law #2/P1: the Documents schema's `ocr_text` column is a dedicated FTS surface — SearchMeta's read of it is the single allowed direct cross-schema query, documented in ADR-B2-5. `[Confirmed — I2 Section 5 "Full-text search across documents"; ADR-B2-5 — FTS Abstraction Layer (June 2026); B2 Module 9 Phase 1 note superseded by ADR-B2-5]` |

### `documents.update`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), title: z.string().min(1).max(500).optional(), metadata: z.record(z.unknown()).optional() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `sp_member` (own-authored drafts only) |
| ABAC conditions | `lifecycle_state = 'draft'` required (the State-Action Compatibility Matrix, I1 §17, denies `update` outside Draft entirely). `sp_member` additionally requires `document.created_by = subject.user_id` (I1 §3.3 Additional Rule). Once past Draft, this procedure is unreachable for content edits — amendments thereafter go through `workflow.amendStep` (defined in Module 4 below), not this procedure. |
| Business operation | Updates `documents.documents.title`/`metadata` in place. `[Confirmed — I1 §3.3 in full; I1 §17 State-Action Compatibility Matrix]` |

### `documents.delete`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain` |
| ABAC conditions | `lifecycle_state IN ('draft','under_review')` **and** `workflow_instance_id IS NULL`. `dept_encoder`/`brgy_encoder` are restricted to exactly this same condition (no further narrowing needed for them specifically, since the base condition already excludes the case I2 Conditional Note ⁷ calls out — once a workflow instance exists, only Approver/Secretary/Captain may proceed, and Encoders are structurally blocked because the encoder branch of this rule doesn't add a *looser* condition, it's the same gate). |
| Business operation | Soft-deletes (`deleted_at`/`deleted_by`) — never a hard `DELETE`. `[Confirmed — I1 §3.4 in full; I2 Conditional Note ⁷]` |

### `documents.cancel`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), reason: z.string().min(1) })` — mandatory reason |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_captain` unconditionally; `dept_encoder`, `brgy_encoder` conditionally |
| ABAC conditions | `lifecycle_state NOT IN ('superseded','rejected','cancelled')`. For `dept_encoder`/`brgy_encoder`: additionally `lifecycle_state IN ('draft','under_review')` **and** `workflow_instance_id IS NULL`. |
| Business operation | Calls `Documents.transitionState(documentId, 'cancelled', actorId, reason)` (B2 Published API). Every cancellation is audit-logged with the mandatory reason (consolidated reference Part 11.11). `[Confirmed — I1 §3.6 in full]` |

## 3.2 SP Workflow Document Specifics

### `documents.submit`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ lifecycleState: z.literal('under_review'), qrTrackingNumber: z.string().uuid().nullable(), preliminaryNumber: z.string().nullable() })` |
| Callable by | `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain` |
| ABAC conditions | `lifecycle_state = 'draft'`. **Special rule for SP workflow documents**: for `document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`, the formal submission that triggers workflow instance creation and QR assignment additionally requires `subject.roles CONTAINS 'sp_secretary'` — an `sp_member` calling this on their own drafted resolution receives `FORBIDDEN` with cause `"sp_secretary_required_for_formal_submission"` and must hand off to the Secretariat instead (the draft remains visible and editable by them in the meantime via `documents.update`). |
| Business operation | Calls `Documents.transitionState(documentId, 'under_review', actorId)`. For SP workflow types, this is also the trigger point for: (a) Tracking's QR generation (`document.created` event → Tracking module, per B2 Module 3/5), (b) Workflow instance creation pinned to the active `definition_version_id` (`document.created` → Workflow module). Note the naming subtlety carried over from B2 verbatim: the event is literally named `document.created` even though it fires at *submit*, not at the initial `draft` row insert — this document does not rename the event, since B2 already defines it and this catalog must stay consistent with the published event registry. `[Confirmed — I1 §3.5 in full; B2 Module 3 event table and Module 5 "Confirmed QR assignment sequence"]` |

### `documents.assignPreliminaryNumber`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ preliminaryNumber: z.string() })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | `document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`, `lifecycle_state IN ('under_review','pending_mayor_action','pending_panlalawigan_review')` (specifically at the secretariat logging step), `document.preliminary_number IS NULL`. |
| Business operation | Calls the `documents.fn_assign_preliminary_number()` DB function (C1 §4.12) via the Documents module's internal numbering service. Renders `Draft 7SP {YEAR}-{NN}` using the space delimiter confirmed throughout the consolidated reference (Part 5.1, Q-A01). Emits `document.number_assigned` with `numberType: 'preliminary'` (B2 Module 3) → Audit. `[Confirmed — I1 §3.7 in full; C1 §4.12; consolidated reference Part 5.1–5.2]` |

### `documents.assignFinalNumber`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ finalNumber: z.string(), assignedAt: z.coerce.date() })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | `document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`. Current workflow step must be `'second_reading_vote_completed'` (for `SP_RESOLUTION`) or `'third_reading_vote_completed'` (for `SP_ORDINANCE`/`SP_APPROPRIATION_ORDINANCE`) — checked by joining to the active `workflow.step_instances` row via `Workflow.getActiveInstanceForDocument()`. `document.preliminary_number IS NOT NULL AND document.final_number IS NULL`. |
| Business operation | Calls `Documents.assignFinalNumber()` (B2 Published API, which itself wraps `documents.fn_assign_final_number()` from C1 §4.12). This is the one call site in the entire router where the **Workflow module is the actual caller in production** per B2's published flow (`Workflow (engine) → Documents.assignFinalNumber()` at the correct lifecycle event) — this tRPC procedure exists as the equivalent manually-triggerable form for the case where the SP Secretary needs to fire it from a `/web` screen directly (e.g. a "Finalize Number" button shown only when the precondition is met), rather than only as an automatic workflow side-effect. Both paths converge on the same `Documents.assignFinalNumber()` call, so there is exactly one number-assignment code path regardless of trigger source. Once `final_number` is set, it is immutable — enforced by the `trg_documents_lifecycle_transition` trigger (C1 §4.5.1) at the DB layer, in addition to this procedure's own precondition check. `[Confirmed — I1 §3.8 in full; B2 Module 3 "assignFinalNumber" Published API method and Module 4's documented Workflow→Documents call; C1 §4.5.1]` |

### `documents.logCertificationOfUrgency`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ certifyingDocumentId: z.string().uuid(), associatedMeasureIds: z.array(z.string().uuid()).min(1) })` — a single Certification can cover multiple measures |
| Output | `z.object({ certificationDocumentId: z.string().uuid(), affectedDocumentIds: z.array(z.string().uuid()) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | `certifyingDocument.document_type_code = 'CERTIFICATION_OF_URGENCY'`. Every ID in `associatedMeasureIds` must reference a document of type `SP_RESOLUTION`, `SP_ORDINANCE`, or `SP_APPROPRIATION_ORDINANCE` whose `lifecycle_state = 'pending_mayor_action'` (or equivalent active state) **and** whose current workflow step is `'committee_referral_pending'` — if any referenced measure fails this check, the entire mutation is rejected (`PRECONDITION_FAILED`), not partially applied. |
| Business operation | Inserts the Certification's `documents.documents` row (already created via `documents.create`/`submit` prior to this call — this procedure is specifically the *logging/attachment* action, not creation) and, for each associated measure, triggers the workflow bypass. Calls into Workflow's bypass logic, which emits `workflow.certified_urgent_applied` with `bypassedStepType: 'multi_referral'` (B2 Module 4) → Audit. The Certification has no standalone number (consolidated reference Part 4.17, Q-B01) — `number_series_id` is `NULL` on its `document_types` row (C1 §4.3). `[Confirmed — I1 §3.9 in full; B2 Module 4 "certified_urgent_applied" event; consolidated reference Part 4.17]` |

### `documents.publishToPortal` / `documents.unpublishFromPortal`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | `document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`, `lifecycle_state IN ('released','superseded')`, and either `classification_level = 'public'` or (`classification_level = 'internal'` AND the document type's `public_visibility_rule = 'title_and_first_page_public'`). |
| Business operation | Flips the document's portal-visibility flag (read by the Phase-3 `portal` schema's `public_documents` sync, which is out of scope for this Phase 1 router but the trigger point exists now). `[Confirmed — I1 §3.11 in full; I2 Section 14 "Publish / unpublish document to public portal"]` |

### `documents.archive`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `records_officer`, `sp_secretary` |
| ABAC conditions | `lifecycle_state IN ('completed','released')`. For `sp_secretary`: additionally `document.owned_by_office_id = SP_SECRETARIAT_OFFICE_ID` (I2 Conditional Note ¹⁵ — SP Secretary may only classify/archive SP-originated documents; other offices' documents require a Records Officer). |
| Business operation | Calls `Documents.transitionState(documentId, 'superseded', actorId)`. `[Confirmed — I1 §3.10 in full]` |

## 3.3 File, Version, and Attachment Handling

### `documents.requestUploadUrl`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), filename: z.string().min(1), mimeType: z.string(), fileSizeBytes: z.number().int().positive().max(26214400) })` — 25 MB ceiling per `tech-stack.md` |
| Output | `z.object({ presignedUploadUrl: z.string().url(), s3Key: z.string().uuid() })` |
| Callable by | `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member` (own-authored only), `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain` |
| ABAC conditions | `parent_document.office_id ∈ subject.effective_office_ids`. `sp_member`: `parent_document.created_by = subject.user_id` (I1 §4.2). |
| Business operation | Generates a UUID `s3Key` (never the original filename — Architectural Law #4, C1 §1.6) and a presigned PUT URL against the configured S3-compatible endpoint. Does **not** create the `documents.versions` row yet — that happens in `documents.confirmUpload` below, after the client-side upload completes and streams directly to S3, never touching the application server's disk (`tech-stack.md` File Storage Strategy). `[Confirmed — I1 §4.2 "document_version:create"; tech-stack File Storage Strategy; consolidated reference Part 11.10]` |

### `documents.confirmUpload`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), s3Key: z.string().uuid(), originalFilename: z.string(), mimeType: z.string(), fileSizeBytes: z.number().int().positive(), pageCount: z.number().int().positive().nullish() })` |
| Output | `z.object({ versionId: z.string().uuid(), versionNumber: z.number().int(), ocrQueued: z.literal(true) })` |
| Callable by | Same as `documents.requestUploadUrl` |
| ABAC conditions | Same as `documents.requestUploadUrl`. |
| Business operation | Inserts `documents.versions` (C1 §4.7) with `ocr_processed = false`. Enqueues the OCR job — OCR **runs automatically on upload** with no separate trigger procedure needed, per the confirmed Phase 1 decision (consolidated reference Q-C01); the queued job later writes `scan_quality_score`/`scan_quality_category`/`ocr_text` back onto this same row asynchronously. `original_filename` is stored only as PostgreSQL metadata (`versions.original_filename`), never as the storage key. `[Confirmed — I1 §4.2; consolidated reference Part 11.4 OCR section, Q-C01; C1 §4.7]` |

### `documents.getVersionHistory`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.array(z.object({ versionId: z.string().uuid(), versionNumber: z.number().int(), originalFilename: z.string().nullable(), mimeType: z.string(), fileSizeBytes: z.number().int(), uploadedBy: z.string().uuid(), uploadedAt: z.coerce.date(), scanQualityCategory: z.enum(['good','fair','poor']).nullable() }))` |
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor` |
| ABAC conditions | Same own-office/cross-office/committee scoping as `documents.get`. |
| Business operation | Reads `documents.versions WHERE document_id = ... ORDER BY version_number`. `[Confirmed — I2 Section 5 "View document version history", ✅ for all 10 listed roles]` |

### `documents.downloadVersion`

| | |
|---|---|
| Type | `mutation` — a mutation rather than a query because it logs a routing-adjacent access fact and issues a time-limited URL, which is a side effect, not a pure cacheable read `[Inference]` |
| Input | `z.object({ versionId: z.string().uuid() })` |
| Output | `z.object({ presignedDownloadUrl: z.string().url(), expiresInSeconds: z.number().int() })` |
| Callable by | Same role set as `documents.get`, narrowed further by Gate 2 |
| ABAC conditions | Identical to `documents.get`'s file-content variant (I1 §4.1) rather than the metadata variant — **`sys_admin` is excluded entirely from this procedure's Callable-by list**, since Gate 2 blocks IT Admin from `document_version`/`document_attachment` read/download whenever `parent_document.classification_level IN ('confidential','restricted')`, and for `public`/`internal` documents IT Admin still has no listed grant in I1 §4.1's ALLOW clause at all — content access for Sys Admin is a non-feature, not merely a gated one. |
| Business operation | Issues a short-lived presigned GET URL for the `documents.versions.s3_key`. `[Confirmed — I1 §4.1 in full, including the repeated IT Admin negative; I2 Section 5 "Download document file"]` |

### `documents.getOcrText`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ versionId: z.string().uuid() })` |
| Output | `z.object({ ocrText: z.string().nullable(), ocrProcessed: z.boolean() })` |
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor` |
| ABAC conditions | Same own-office/cross-office scoping as version read, **plus** Gate 2's content-isolation extension to OCR text (I1 §2 Gate 2 "Extended to OCR text") — `sys_admin` is excluded from this procedure for Confidential/Restricted documents, consistent with treating OCR text as document content. |
| Business operation | Reads `documents.versions.ocr_text`. `[Confirmed — I1 §4.3 "document_ocr_text:read"; I2 Section 17 "View OCR extracted text"]` |

### `documents.getScanQualityIndicator`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ versionId: z.string().uuid() })` |
| Output | `z.object({ scanQualityScore: z.number().min(0).max(1).nullable(), scanQualityCategory: z.enum(['good','fair','poor']).nullable() })` |
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain` |
| ABAC conditions | `parent_document.created_by = subject.user_id` **OR** `parent_document.office_id ∈ subject.effective_office_ids` — this is a slightly *looser* gate than general content read (no classification narrowing, since the quality score is a processing artifact, not document content itself, and the indicator must reach the uploader even before they know the document's eventual classification). |
| Business operation | Reads `documents.versions.scan_quality_score`/`scan_quality_category`, always shown to the user per the confirmed Q-C01 decision so they can decide whether to re-scan. `[Confirmed — I1 §4.4 "document_ocr_quality:read"; I2 Section 17; consolidated reference Q-C01]` |

### `documents.triggerManualReOcr`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ versionId: z.string().uuid() })` |
| Output | `z.object({ ocrQueued: z.literal(true) })` |
| Callable by | `records_officer`, `sp_secretary` |
| ABAC conditions | None beyond role gate. |
| Business operation | Re-enqueues the OCR job for an existing file (distinct from the automatic on-upload trigger inside `documents.confirmUpload`). `[Confirmed — I2 Section 17 "Trigger manual re-OCR on existing file"]` |

### `documents.flagScannedBackForVerification`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ versionId: z.string().uuid(), notes: z.string().optional() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `records_officer` |
| ABAC conditions | None beyond role gate. |
| Business operation | Marks a re-scanned-after-wet-ink-signature version as pending manual verification (consolidated reference Part 11.4 "Physical-to-digital correspondence"). `[Confirmed — I2 Section 9 "Flag scanned-back document for manual verification"]` |

### `documents.acceptScannedBackAsOfficial`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ versionId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `records_officer`, `sp_secretary` |
| ABAC conditions | None beyond role gate. |
| Business operation | Confirms the scanned-back version as the official digital copy after manual review. `[Confirmed — I2 Section 9 "Accept scanned-back signed document as official copy"]` |

## 3.4 Secretariat Decision Logging `[Routing superseded by ADR-B2-3]`

### `documents.logSecretariatDecision`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), decision: z.enum(['approve','reject','amended']), remarks: z.string().optional() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | `step.step_type IN ('action','approval')`, `step.assignee_office_id = SP_SECRETARIAT_OFFICE_ID` (I1 §6.8). |
| Business operation | **[ADR-B2-3 — Secretariat Decision Entry Point, June 2026]** The Secretariat's "Approve / Reject / Amended" action now enters through the **Workflow Router**, not the Document Router. This procedure **delegates immediately** to `Workflow.submitStepAction(stepInstanceId, outcome)`, which atomically: (1) advances the workflow step, (2) synchronously calls `Documents.transitionState()` to update the document lifecycle state, and (3) emits `workflow.step.completed` with `outcome: 'APPROVED' | 'REJECTED' | 'AMENDED'` (B3 §7.12). `document.secretariat_decision` is no longer emitted. See B3 §6.4 superseded notice. The pre-ADR flow (Document Router → `documentService.recordDecision()` → async event bus → Workflow) is superseded; the direct Workflow → Documents sync path (which already existed in the B2 Published API Call Matrix) is now the sole code path. `[Confirmed — I1 §6.8 in full; ADR-B2-3; B3 §6.4; B3 §7.12]` |

---

# Module 4 — Workflow Router (`workflowRouter`)

**Schema:** `workflow`. **Backing service:** B2 Module 4 Published API (`getInstanceById`, `getActiveInstanceForDocument`, `getWorkflowSLAData`).

### `workflow.getInstance`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ instanceId: z.string().uuid() })` |
| Output | `z.object({ instanceId: z.string().uuid(), documentId: z.string().uuid(), definitionVersionId: z.string().uuid(), currentStepType: z.enum(['action','approval','multi_referral','decision','notification','termination','parallel_split','parallel_join']), currentStepInstanceId: z.string().uuid(), currentAssigneeUserId: z.string().uuid().nullable(), status: z.enum(['Active','Completed','Cancelled']), slaDeadline: z.coerce.date().nullable(), lapseStatus: z.enum(['mayor_10_day_lapsed','panlalawigan_30_day_deemed']).nullable(), panelHint: z.enum(['multi_referral', 'vp_certification', 'mayor_decision', 'mayor_lapse_confirmation', 'veto_override_recording', 'docketing', 'panlalawigan_outcome', 'publication_date', 'secretariat_decision', 'generic_action', 'generic_approval']).nullable() })`[^panelHint-note] |
| Callable by | `plat_admin`, `records_officer`, `dept_encoder` (🔶 scoped), `dept_approver` (🔶 scoped), `sp_secretary`, `sp_member` (🔶 scoped), `sp_presiding_officer`, `mayor`, `brgy_encoder` (🔶 scoped), `brgy_captain` (🔶 scoped), `auditor` |
| ABAC conditions | Per I1 §5.1: own-office instances readable by the listed operational roles when scoped; `sp_secretary` has unconditional full visibility across SP Secretariat scope; cross-office read for `records_officer`/`sp_presiding_officer`/`mayor`/`auditor` requires `classification_level IN ('public','internal')`. |
| Business operation | Calls `Workflow.getInstanceById()` (B2 Published API). `[Confirmed — I1 §5.1 in full]` |

[^panelHint-note]: Note that the live backend implementation (`computePanelHint` inside `workflow.router.ts`) returns this dynamically computed value as `string | null` rather than validating it through a strict Zod enum schema at runtime. The enum type cataloged here specifies the exact string literals returned for each panel state.

### `workflow.getActiveInstanceForDocument`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | Same shape as `workflow.getInstance`, nullable |
| Callable by | Same as `workflow.getInstance` |
| ABAC conditions | Same as `workflow.getInstance`, resolved via the parent document's office/classification. |
| Business operation | Calls `Workflow.getActiveInstanceForDocument()` (B2 Published API) — this is the exact call B2 documents the Documents Router making to "link the document view to its current workflow status without reading the workflow schema," now exposed as its own `/web`-callable procedure for the document detail screen. `[Confirmed — B2 Module 4 Published API; I1 §5.1]` |

### `workflow.listMyAssignedSteps`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput` |
| Output | `z.object({ items: z.array(z.object({ stepInstanceId: z.string().uuid(), instanceId: z.string().uuid(), documentId: z.string().uuid(), documentTitle: z.string(), stepType: z.enum(['action','approval','multi_referral','decision','notification','termination']), assignedAt: z.coerce.date(), dueAt: z.coerce.date().nullable() })), nextCursor: z.string().nullable() })` |
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor` |
| ABAC conditions | `step.assignee_user_id = subject.user_id` **OR** office-scoped queue membership per the role (I1 §6.1). This is the backing query for the "own task inbox" dashboards referenced in I2 Section 16. |
| Business operation | Reads `workflow.step_instances WHERE status = 'pending'` filtered by assignee/office. `[Confirmed — I1 §6.1; I2 Section 16 "View own task inbox / assigned steps"]` |

### `workflow.completeActionStep`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid(), comment: z.string().optional() })` |
| Output | `z.object({ success: z.literal(true), nextStepType: z.string().nullable() })` |
| Callable by | `dept_encoder` (🔶 scoped), `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_encoder` (🔶 scoped), `brgy_captain` |
| ABAC conditions | `step.step_type = 'action'`, `step.status = 'pending'`, and (`step.assignee_user_id = subject.user_id` **OR** office-match for the non-Encoder roles). **Encoder restriction** (I1 §6.2): `dept_encoder`/`brgy_encoder` may only complete a step where `step.assignee_user_id = subject.user_id` **OR** the parent document `created_by = subject.user_id` — they cannot claim arbitrary steps from the general office queue. |
| Business operation | Marks the `workflow.step_instances` row `completed`, advances the instance per its `transition_rules`. Emits `workflow.step.completed` (B2 Module 4) → Tracking (routing entry append), Audit. `[Confirmed — I1 §6.2 in full; I2 Conditional Note ¹²]` |

### `workflow.approveStep` / `workflow.rejectStep` / `workflow.returnStepForRevision`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid(), comment: z.string().optional() })` — `comment` becomes **required** (`z.string().min(1)`) specifically for `rejectStep` and `returnStepForRevision`, since a rejection or return without a reason is not a meaningful business record `[Inference — not separately stated in I1, but consistent with the mandatory-comment pattern applied elsewhere in this same document for multi_referral overrides and cancellations]` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_captain` |
| ABAC conditions | `step.step_type = 'approval'`, `step.status = 'pending'`, office-match or direct assignee match (I1 §6.3). **Invariant #13** enforced server-side at this exact call site: if `step.is_final_approval_step = true` (the declared boolean column on `workflow.steps`, per I1's D-ABAC-05 resolution) and `subject.user_id` equals either `resolved_document.created_by` or `workflow_instance.submitted_by`, the call is rejected with `FORBIDDEN` / `"encoder_final_approver_same_user_prohibited"` — checked **after** the role gate passes, exactly as I1 specifies the ordering. |
| Business operation | Updates the step outcome; for `approveStep` this is also the call site that, for an SP Resolution/Ordinance at the relevant terminal approval step, triggers `Documents.transitionState()` onward. `[Confirmed — I1 §6.3 in full, including Invariant #13's enforcement note and the `is_final_approval_step` resolution]` |

### `workflow.submitCommitteeReport`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid(), committeeId: z.string().uuid(), reportText: z.string().min(1), reportAttachmentS3Key: z.string().uuid().optional() })` |
| Output | `z.object({ allCommitteesSubmitted: z.boolean() })` — tells the frontend whether this submission completed the step or whether other committees are still pending |
| Callable by | `sp_secretary`, `sp_member` (committee-scoped) |
| ABAC conditions | `step.step_type = 'multi_referral'`, `step.status = 'pending'`. For `sp_member`: `subject.committee_ids ∩ step.metadata.assigned_committee_ids ≠ ∅` (I1 §6.6, resolved via the JWT-cached `committee_ids` claim per D-ABAC-06). |
| Business operation | Records this committee's contribution toward the unified report. **All assigned committees must sign/contribute before the step completes** — the resolver checks whether every committee in `step.metadata.assigned_committee_ids` now has a submitted contribution; if so, the step transitions to `completed` and emits `workflow.step.completed`; if not, the step remains `pending` with this committee marked submitted, and committees that have *not* yet submitted are surfaced as red-flagged in the Order of Business view (`session.getOrderOfBusiness`, Module 6 below) rather than blocking this individual committee's own action. `[Confirmed — I1 §6.6 in full; consolidated reference Part 8.3, Q-A02; B2 Module 4 multi_referral behavior note]` |

### `workflow.manuallyAdvanceMultiReferralStep`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid(), mandatoryComment: z.string().min(1) })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | `step.step_type = 'multi_referral'`. `mandatoryComment` must be non-empty (Zod-enforced, not merely application-checked). No other role may call this — it is the sole override authority (I1 §6.7 explicit negative). |
| Business operation | Forces the step to `completed` despite one or more committees not having submitted. Emits `workflow.manually_advanced` with `mandatoryComment`, `fromStep`, `toStep` (B2 Module 4) → Audit. The absent/non-reporting committees remain visually red-flagged in the Order of Business even after the override, per the confirmed Q-A02 decision that the override does not retroactively clear the red-flag fact. `[Confirmed — I1 §6.7 in full; consolidated reference Part 8.3 Q-A02 decisions 1–2]` |

### `workflow.certifyAsPresidingOfficer`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_presiding_officer` |
| ABAC conditions | `step.step_type = 'approval'`, `step.name = 'vp_certification'`, and (`step.assignee_user_id = subject.user_id` **OR** the subject holds an active delegation granting `sp_presiding_officer` scope — resolved via `Organization.getActiveDelegationForUser()`). |
| Business operation | Records the Vice Mayor's certified-copy signature step. `[Confirmed — I1 §6.4 in full]` |

### `workflow.mayorSign` / `workflow.mayorVeto`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid(), objectionsText: z.string().optional() })` — `objectionsText` required (`.min(1)`) for `mayorVeto` only |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `mayor` |
| ABAC conditions | `step.step_type = 'approval'`, `step.name IN ('mayor_review','mayor_signature')`, direct assignee match **or** an active delegation granting Mayor role authority (e.g. the Vice Mayor serving as Acting Mayor). |
| Business operation | For `mayorSign`: records the signature, advances toward Docketing. For `mayorVeto`: records the objections, routes to the SP veto-override path (2/3 = 8 of 12). `[Confirmed — I1 §6.5 in full; consolidated reference Part 4.1, Part 4.2]` |

### `workflow.logMayorLapseConfirmation`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S47') })` |
| Callable by | `sp_secretary` |
| ABAC conditions | None beyond role gate — this confirms a system-computed fact (the 10-day timer has already fired) rather than exercising independent discretion. |
| Business operation | The 10-day timer is system-triggered (pgboss); this procedure is the manual confirmation step the Secretary performs on notification. Emits `workflow.lapsed` with `legalBasis: 'RA7160_S47'` (B2 Module 4) if not already emitted by the automatic job — implemented idempotently so a duplicate confirmation call is a no-op rather than a double-audit-entry. `[Confirmed — I2 Section 6 "Log 10-day Mayor lapse (system-triggered; manual confirmation)"; B2 Module 4 lapse event]` |

### `workflow.recordVetoOverrideVote`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid(), votesFor: z.number().int().min(0).max(12), votesAgainst: z.number().int().min(0).max(12), absentCouncilorIds: z.array(z.string().uuid()) })` |
| Output | `z.object({ overrideSucceeded: z.boolean() })` — `true` when `votesFor >= 8` |
| Callable by | `sp_secretary` |
| ABAC conditions | None beyond role gate. |
| Business operation | Records the override vote tally against the confirmed 2/3 (8-of-12) threshold (consolidated reference Part 3.2). `[Confirmed — I2 Section 6 "Record veto override vote"; consolidated reference Part 3.2]` |

### `workflow.logDocketingCompletion`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` |
| ABAC conditions | None beyond role gate. |
| Business operation | Marks the Docketing step complete — the document is already signed and already has its final number at this point (consolidated reference Part 4.1/4.2 flowcharts). `[Confirmed — I2 Section 6 "Log docketing step completion"]` |

### `workflow.recordPanlalawiganOutcome`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid(), outcome: z.enum(['valid','valid_in_part','returned','operative_in_its_entirety']), controlNumber: z.string().optional(), panlalawiganResolutionNumber: z.string().optional(), dateReferred: z.coerce.date().optional(), remarks: z.string().optional() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` |
| ABAC conditions | `step.name = 'panlalawigan_review'`, `step.status = 'pending'` (I1 §6.9). |
| Business operation | Writes `documents.panlalawigan_reviews` (C1 §4.10). For `outcome = 'returned'`: marks the step high-priority and routes to one of the Secretariat-decided paths (modify-and-repass is the default; no formal legal challenge mechanism exists, per consolidated reference Q-C06). For `outcome = 'valid_in_part'`: places the step in "Awaiting SP Secretariat Action" pending the Secretary's choice among the four options enumerated in the consolidated reference Part 4.3 (resolve as-is with comment / route to Legal / route to Committee / implement directly) — that choice is captured by the separate `workflow.resolveValidInPart` procedure below, not by this one, since recording the Panlalawigan's outcome and the Secretariat's subsequent response are two distinct, separately audit-logged actions. `[Confirmed — I1 §6.9 in full; consolidated reference Part 4.3 outcome handling; C1 §4.10]` |

### `workflow.resolveValidInPart`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), resolutionPath: z.enum(['resolve_as_is','route_to_legal','route_to_committee','implement_directly']), mandatoryComment: z.string().min(1) })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` |
| ABAC conditions | The parent document's `panlalawigan_reviews.outcome = 'valid_in_part'`. |
| Business operation | Records the Secretariat's chosen path among the four options; all four are audit-logged per the confirmed decision. `[Confirmed — consolidated reference Part 4.3 "VALID-IN-PART handling", four numbered options, "All choices are audit-logged"]` |

### `workflow.confirmPanlalawiganDeemedApproved`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S56D') })` |
| Callable by | `sp_secretary` |
| ABAC conditions | `step.name = 'panlalawigan_review'`, `step.status = 'pending'`, and the system-computed 30-day window has elapsed with no Panlalawigan response. |
| Business operation | System transitions automatically at day 30; this procedure is the Secretary's manual confirmation, mirroring `workflow.logMayorLapseConfirmation`'s pattern. Writes Remarks = "Lapsed 30 days" into `documents.panlalawigan_reviews.remarks` (C1 §4.10). `[Confirmed — I1 §6.9; consolidated reference Part 4.3 "30-day timer" system behavior]` |

### `workflow.recordNewspaperPublicationDate`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), publicationDate: z.coerce.date(), newspaperName: z.string().default('Ilocos Times') })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` |
| ABAC conditions | The document is `SP_ORDINANCE` or `SP_APPROPRIATION_ORDINANCE` and its type metadata indicates a penalty provision (only penalty ordinances require this field). |
| Business operation | Writes the mandatory tracked publication date into `workflow.instances.context` (the `publication` object, per C1 §4.1 item 1's resolution that `publication` lives in JSONB, not a dedicated column). `[Confirmed — I2 Section 6 "Record newspaper publication date"; consolidated reference Q-C04; C1 §4.1]` |

### `workflow.migrateInstanceToNewDefinitionVersion`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ instanceId: z.string().uuid(), newDefinitionVersionId: z.string().uuid(), mandatoryReason: z.string().min(1), secondLevelApproverUserId: z.string().uuid() })` |
| Output | `z.object({ migrationId: z.string().uuid(), reversibleUntil: z.coerce.date() })` — 24-hour reversible window |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true` (I1 §5.2). This is explicitly allowed despite Gate 3's general Platform Admin operational exclusion, since `workflow_instance:migrate` is on the Tier 2 allowed-action list. |
| Business operation | Implements consolidated reference Part 11.3's Option B: requires second-level City Administrator approval (captured via `secondLevelApproverUserId`, validated against that user's role/position separately), opens a 24-hour reversible window, and emits a dedicated audit event distinct from ordinary `workflow.*` events. `[Confirmed — I1 §5.2 in full; consolidated reference Part 11.3 "Version pinning"]` |

### `workflow.getSlaComplianceData`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ officeId: z.string().uuid().optional(), documentTypeId: z.string().uuid().optional(), breachedOnly: z.boolean().default(false), ...dateRangeInput.shape })` |
| Output | `z.array(z.object({ instanceId: z.string().uuid(), documentId: z.string().uuid(), slaClassification: z.enum(['simple','complex','highly_technical']), slaThresholdDays: z.number().int(), elapsedWorkingDays: z.number().int(), isBreached: z.boolean(), breachedAt: z.coerce.date().nullable() }))` |
| Callable by | `records_officer`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `auditor` |
| ABAC conditions | None beyond role gate — ARTA reporting visibility is not office-scoped for these roles per I2 Section 16. |
| Business operation | This is the literal call B2 documents as `Reporting (ARTA reporter) → Workflow.getWorkflowSLAData()`; exposed here as a direct `/web` query as well, since the SP Secretary dashboard needs the same data without going through the (Phase 2) Reporting module. `[Confirmed — B2 Module 4 Published API "getWorkflowSLAData"; I2 Section 16 "View ARTA SLA compliance report"]` |

---

# Module 5 — Tracking Router (`trackingRouter`)

**Schema:** `tracking`. **Backing service:** B2 Module 5 Published API (`getTrackingRecordForDocument`, `getRoutingHistory`).

### `tracking.getTrackingRecord`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ trackingId: z.string().uuid(), documentId: z.string().uuid(), trackingNumber: z.string(), qrCodeS3Key: z.string(), assignedAt: z.coerce.date(), physicalLocation: z.string().nullable() })` — `trackingNumber` (e.g. `'DTS-2026-0001'`) added `[RESOLVED — SPEC-GAP-TRACK-01, 2026-06-30]`; mirrors the `trackingNumber` field added to B2's `TrackingRecordSummary` interface, so this procedure's return shape stays consistent with the Published API type it wraps.
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor` |
| ABAC conditions | Own-office or cross-office-with-grant, per the same pattern as `documents.get` (the tracking record is governed by its parent document's office/classification, not an independent classification of its own). |
| Business operation | Calls `Tracking.getTrackingRecordForDocument()` (B2 Published API). `[Confirmed — B2 Module 5 Published API; I1 §7.1 pattern applied to the record itself rather than only routing entries]` |

### `tracking.printQrCoverSheet`

| | |
|---|---|
| Type | `query` — returns a render-ready payload rather than performing a write `[Inference]` |
| Input | `z.object({ documentIds: z.array(z.string().uuid()).min(1), layout: z.enum(['single','multi_per_page']).default('multi_per_page') })` — supports the confirmed multiple-cover-sheets-per-page layout |
| Output | `z.object({ pdfPresignedUrl: z.string().url() })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | The document(s) must be in the SP Secretariat's scope (I1 §7.5). |
| Business operation | Generates the QR cover sheet, confirmed to contain **only three fields** — QR Code, Tracking Number, Series Number (consolidated reference Q-B02) — sized to take only the space it needs, with the `multi_per_page` layout option arranging multiple horizontal-rectangle cover sheets on one physical sheet of paper to save paper, exactly as decided in Q-B02. Uses `@react-pdf/renderer` per the stack decision. `[Confirmed — I1 §7.5; consolidated reference Q-B02 in full; tech-stack PDF generation row]` |

### `tracking.getRoutingHistory`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.array(z.object({ entryId: z.string().uuid(), fromOfficeId: z.string().uuid().nullable(), toOfficeId: z.string().uuid().nullable(), actorId: z.string().uuid(), actorDisplayName: z.string(), actionDescription: z.string(), timestamp: z.coerce.date() }))` |
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor` (own-office); `sp_secretary`, `sp_presiding_officer`, `mayor`, `records_officer`, `auditor` (cross-office, classification-gated) |
| ABAC conditions | Implements I1 §7.1 exactly: own-office unconditional for the operational roles; cross-office requires `classification_level IN ('public','internal')`. |
| Business operation | Calls `Tracking.getRoutingHistory()` (B2 Published API) — explicitly the *authenticated internal* view; the public unauthenticated scan result is served by Tracking's own REST endpoint, not this tRPC procedure, per B2 Module 5's explicit statement that the public view bypasses this method entirely. `[Confirmed — I1 §7.1 in full; B2 Module 5 Published API note]` |

### `tracking.logRoutingEntry`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), toOfficeId: z.string().uuid().nullable(), actionDescription: z.string().min(1) })` |
| Output | `z.object({ entryId: z.string().uuid() })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | The document must be an SP Secretariat document — ownership check (I1 §7.2). |
| Business operation | Inserts `tracking.routing_entries`. Physical routing logging by other offices is deferred to Phase 2 per B2 Module 5/I1 §7.2's explicit Phase 1 scoping. `[Confirmed — I1 §7.2 in full]` |

### `tracking.scanQrCodeAuthenticated`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ qrTrackingNumber: z.string().uuid() })` |
| Output | `z.object({ documentType: z.string(), remarks: z.string().nullable(), fullRoutingHistory: z.array(z.object({ actionDescription: z.string(), actorDisplayName: z.string(), timestamp: z.coerce.date() })), firstPageImageUrl: z.string().url(), getCopyAvailable: z.literal(true) })` |
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor` |
| ABAC conditions | None beyond Global Gates — this is the in-app authenticated scan path, distinct from the unauthenticated public scan, and per I1 §7.3 is available to any authenticated non-citizen, non-system role. |
| Business operation | Returns document type, remarks, full routing history from draft, first page only (other pages blurred — enforced by returning only a pre-rendered first-page image URL, never the full document URL), and a "Get a copy" affordance pointing to the Document Request flow. `[Confirmed — I1 §7.3 in full]` |

---

# Module 6 — Session Router (`sessionRouter`)

**Schema:** Spans `workflow`/`documents` (no dedicated `session` schema exists in C1 — session attendance and Order of Business are workflow-adjacent views, not a separate module per B2's eleven-module list; this router is a thin composition layer, matching the consolidated reference's framing of Order of Business as "a derived view generated from all documents scheduled for the upcoming session," Part 4.18). `[Inference — router grouping; the underlying tables are not separately specified as their own schema anywhere in C1, so this document groups the procedures by user-facing feature rather than inventing a schema C1 does not define]`

### `session.recordAttendance`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ sessionDate: z.coerce.date(), absences: z.array(z.object({ councilorEmployeeId: z.string().uuid(), reason: z.enum(['official_business','sick_leave','vacation_leave','absent_unqualified']) })) })` |
| Output | `z.object({ success: z.literal(true), presentCount: z.number().int(), absentCount: z.number().int(), quorumMet: z.boolean() })` — quorum met when `presentCount >= 7` |
| Callable by | `sp_secretary` only |
| ABAC conditions | None beyond role gate. |
| Business operation | Recorded **before** the session (consolidated reference Part 7.3). Computes quorum against the confirmed 7-of-12 threshold. `[Confirmed — I2 Section 8 "Record session attendance"; consolidated reference Part 7.3, Part 3.2]` |

### `session.getAttendanceRecord`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ sessionDate: z.coerce.date() })` |
| Output | `z.object({ sessionDate: z.coerce.date(), presentCouncilors: z.array(z.string().uuid()), absences: z.array(z.object({ councilorEmployeeId: z.string().uuid(), councilorDisplayName: z.string(), reason: z.string() })), quorumMet: z.boolean() })` |
| Callable by | `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor` |
| ABAC conditions | None beyond role gate. |
| Business operation | Reads the attendance record. `[Confirmed — I2 Section 8 "View session attendance record"]` |

### `session.getAttendanceStatistics`

| | |
|---|---|
| Type | `query` |
| Input | `dateRangeInput` |
| Output | `z.object({ series: z.array(z.object({ sessionDate: z.coerce.date(), presentCount: z.number().int(), absentCount: z.number().int() })), printableSummaryUrl: z.string().url().nullable() })` |
| Callable by | `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor` |
| ABAC conditions | None beyond role gate. |
| Business operation | Backs the confirmed "count of present/absent councilors; graph of attendee numbers over time; printable summary" requirement, which is new system functionality being added to a "counts only" current state (consolidated reference Part 7.3). `[Confirmed — I2 Section 8 "View attendance statistics and graphs"; consolidated reference Part 7.3]` |

### `session.getOrderOfBusiness`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ sessionDate: z.coerce.date().optional() })` — defaults to the next upcoming Tuesday session if omitted |
| Output | `z.object({ sessionDate: z.coerce.date(), items: z.array(z.object({ documentId: z.string().uuid(), title: z.string(), preliminaryNumber: z.string().nullable(), committeeReportStatus: z.enum(['not_applicable','all_submitted','red_flagged']), assignedCommittees: z.array(z.string()) })) })` |
| Callable by | `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor` |
| ABAC conditions | None beyond role gate. |
| Business operation | A derived, computed view (not its own table) over `documents.documents` joined to the active `multi_referral` step instances for the upcoming Tuesday session, with items whose committees have not all submitted by the Thursday cutoff rendered `red_flagged`, per the confirmed Q-A02 visual-indicator rule. `[Confirmed — I2 Section 8 "View Order of Business (current session)"; consolidated reference Part 4.18, Q-A02]` |

### `session.scheduleDocumentForFirstReading`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), sessionDate: z.coerce.date() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | `sessionDate` must be a Tuesday and the call must occur before that Tuesday's preceding Thursday cutoff, otherwise the document is scheduled for the following week's session instead (`PRECONDITION_FAILED` is not thrown in this case — the resolver silently rolls forward to the next valid Tuesday and returns the actual scheduled date, since this is a scheduling convenience rule, not an access denial). |
| Business operation | Adds the document to the Order of Business for the target session. `[Confirmed — I2 Section 8 "Schedule document for first reading"; consolidated reference Part 7.2 session/cutoff rules]` |

### `session.enterCommitteeHearingDate`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ stepInstanceId: z.string().uuid(), hearingDate: z.coerce.date().nullish() })` — nullable/omittable, since a committee referral may begin as "assigned; date TBD" |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | None beyond role gate — committee representatives never input this directly; Secretariat staff always enters what the committee communicates (consolidated reference Q-C05). |
| Business operation | Writes the hearing date onto the `multi_referral` step instance's metadata. `[Confirmed — I2 Section 8 "Enter committee hearing date"; consolidated reference Q-C05 in full]` |

---

# Module 7 — Records Router (`recordsRouter`) — Phase 1 Subset

**Schema:** `records` (Phase 2 module delivery per B2 Module 6; schema reserved in Phase 1 migration per C1's task brief — the eight Phase 1 schemas explicitly include `records`). The procedures below cover only the Phase-1-relevant reads that the Documents/Workflow modules' published APIs already depend on (`getClassificationForDocument`, `isUnderLegalHold`, `getRetentionSchedule`), exposed here for `/web` screens that need the same data directly (e.g. a Records Officer reviewing classification before the full RMS UI exists in Phase 2).

### `records.getRetentionSchedule`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ documentTypeId: z.string().uuid() })` |
| Output | `z.object({ scheduleId: z.string().uuid(), documentTypeId: z.string().uuid(), retentionPeriod: z.union([z.literal('Permanent'), z.number().int()]), legalBasis: z.string(), configuredBy: z.string().uuid() }).nullable()` |
| Callable by | `plat_admin`, `records_officer`, `sp_secretary`, `auditor` |
| ABAC conditions | None beyond role gate. |
| Business operation | Calls `Records.getRetentionSchedule()` (B2 Published API). `[Confirmed — I2 Section 3 "View retention schedules list"; B2 Module 6 Published API]` |

### `records.applyRetentionSchedule`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), scheduleId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `records_officer` only |
| ABAC conditions | None beyond role gate. |
| Business operation | Applies an existing schedule to an individual record — final activation of a *new* schedule itself requires Platform Admin (a separate, Phase-2-surfaced procedure not detailed here since the `retention_schedules` CRUD UI is Tier 2 admin config out of this catalog's Phase 1 emphasis). `[Confirmed — I2 Conditional Note ⁵; I1 §9.2]` |

### `records.applyClassification`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), classificationLevel: classificationLevelEnum })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `records_officer`, `sp_secretary` |
| ABAC conditions | For `sp_secretary`: `resolved_document.office_id = SP_SECRETARIAT_OFFICE_ID` only (I1 §9.3, I2 Conditional Note ¹⁵). |
| Business operation | Updates `documents.documents.classification_level`. `[Confirmed — I1 §9.3 in full]` |

### `records.placeLegalHold` / `records.removeLegalHold`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentId: z.string().uuid(), reason: z.string().min(1) })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `records_officer` only |
| ABAC conditions | None beyond role gate. |
| Business operation | Sets the legal-hold flag (Phase 2 `records.records.legal_hold` once that table is populated; in Phase 1 this writes a `documents.documents.metadata` flag as a forward-compatible placeholder, since the dedicated `records` schema tables are reserved but not yet populated by routine document flow in Phase 1). A record under legal hold cannot have its retention shortened (consolidated reference Part 11.7). `[Confirmed — I1 §9.6 in full; consolidated reference Part 11.7; Inference for the Phase 1 storage location, since records.records rows are not yet created by ordinary Phase 1 document flow per B2 Module 6's Phase 2 delivery note]` |

### `records.isUnderLegalHold`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ documentId: z.string().uuid() })` |
| Output | `z.object({ underLegalHold: z.boolean() })` |
| Callable by | `records_officer`, `sp_secretary` |
| ABAC conditions | None beyond role gate. |
| Business operation | Calls `Records.isUnderLegalHold()` (B2 Published API) — used before allowing a records disposition transition. `[Confirmed — B2 Module 6 Published API]` |

---

# Module 8 — Notifications Router (`notificationsRouter`)

**Schema:** `notifications`. **Backing service:** B2 Module 7 Published API (`sendNotification`). Phase 1 channel: in-app only (SSE delivery); email/SMS exist in the schema but are Phase 2/3 per the consolidated reference roadmap.

**Note on `recipient_user_id`:** every ABAC condition and output field in this module referencing the recipient uses `recipient_user_id`/`recipientUserId`, consistent with B2's `NotificationInput.recipientUserId` and `getUserById(userId)`. C1 Part 9 originally specified this column as `recipient_employee_id`; C1 has been corrected to `recipient_user_id` to match this document and B2 — see C1 Part 15 "Resolved" table. No change was needed in this document.

### `notifications.listMine`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ unreadOnly: z.boolean().default(false) })` |
| Output | `z.object({ items: z.array(z.object({ notificationId: z.string().uuid(), templateId: z.string(), renderedTitle: z.string(), renderedBody: z.string(), isRead: z.boolean(), createdAt: z.coerce.date(), relatedDocumentId: z.string().uuid().nullable() })), nextCursor: z.string().nullable() })` |
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain` |
| ABAC conditions | `WHERE recipient_user_id = subject.user_id` only — own notifications. |
| Business operation | Reads `notifications.notification_events` filtered to the caller. `[Confirmed — I2 Section 11 "Receive in-app notifications", ✅ for all 9 operational roles; auditor/sys_admin/plat_admin/citizen are — per I2 — not recipients of this notification class]` |

### `notifications.markAsRead`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ notificationId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | Same as `notifications.listMine`, plus `citizen` (own portal notifications, when reached via `/web` in an admin-impersonation-free sense — included for output-schema completeness per I2's row, though the citizen's actual channel is the Portal REST layer in practice) |
| ABAC conditions | `notification.recipient_user_id = subject.user_id`. |
| Business operation | Sets `notifications.notification_events.is_read = true`. `[Confirmed — I2 Section 11 "Mark notifications as read (own)"]` |

### `notifications.getOwnPreferences` / `notifications.updateOwnPreferences`

| | |
|---|---|
| Type | `query` / `mutation` |
| Input (update) | `z.object({ channel: z.enum(['in_app']), templateCategory: z.string(), enabled: z.boolean() })` — `email`/`sms` channels are schema-valid but functionally inert in Phase 1 |
| Output | `z.object({ preferences: z.array(z.object({ templateCategory: z.string(), channel: z.string(), enabled: z.boolean() })) })` |
| Callable by | All 12 authenticated internal roles |
| ABAC conditions | Own preferences only. |
| Business operation | User-configurable, no admin approval needed (consolidated reference Part 11.21 Tier "User-configurable"). `[Confirmed — I2 Section 11 "Configure own notification preferences", ✅ for all roles; consolidated reference Part 11.21]` |

### `notifications.listDeliveryLogs`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ ...dateRangeInput.shape })` |
| Output | `z.object({ items: z.array(z.object({ deliveryLogId: z.string().uuid(), recipientUserId: z.string().uuid().nullable(), recipientEmail: z.string().nullable(), channel: z.string(), status: z.string(), sentAt: z.coerce.date() })), nextCursor: z.string().nullable() })` |
| Callable by | `sys_admin`, `plat_admin` |
| ABAC conditions | None beyond role gate. |
| Business operation | Reads `notifications.delivery_log` in full — this is the only procedure in the Notifications router with cross-recipient visibility. `[Confirmed — I2 Section 11 "View delivery logs (all notifications)", ✅ only Sys Admin and Plat Admin]` |

### `notifications.createTemplate`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ name: z.string().min(1), channel: z.enum(['in_app','email','sms']), locale: z.string().min(1), subjectTemplate: z.string().min(1).nullish(), bodyTemplate: z.string().min(1) })` |
| Output | `z.object({ templateId: z.string().uuid() })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true` |
| Business operation | Inserts `notifications.templates`. `cityId` is not caller-supplied — defaults per the DDL's own default value, matching how no other admin-CRUD procedure in this router accepts `cityId` as input. `isActive` is not caller-supplied either — every template is created live (`is_active = true`, the DDL default); there is no draft-creation path. Rejects with `CONFLICT` on the `uq_templates_city_name_channel_locale` unique constraint (C1 Part 9) if a row with the same `city_id`/`name`/`channel`/`locale` already exists and is not soft-deleted. |

### `notifications.updateTemplate`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ templateId: z.string().uuid() }).merge(createTemplateInput.partial())` — same merge-partial shape as `organization.updateOffice` |
| Output | `z.object({ templateId: z.string().uuid(), name: z.string(), channel: z.enum(['in_app','email','sms']), locale: z.string() })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true` |
| Business operation | Updates any subset of `name`, `channel`, `locale`, `subjectTemplate`, `bodyTemplate` on the target row. All fields are mutable — no field is restricted from post-creation editing, consistent with every comparable procedure in Modules 1–2, none of which walls off a subset of create-time fields from later editing. |

### `notifications.deactivateTemplate` / `notifications.reactivateTemplate`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ templateId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true), isActive: z.boolean() })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true` |
| Business operation | Sets `is_active` to `false`/`true`. Reversible; does not touch `deleted_at`/`deleted_by`. Directly mirrors `iam.deactivateUserAccount`/`reactivateUserAccount`'s exact shape — same input, same paired-procedure structure, same "toggle a status field, don't touch the soft-delete columns" behavior. This is a distinct lifecycle action from `deleteTemplate` below — the table has two separate columns for two separate concepts (temporarily hidden from use vs. permanently removed), and both actions exist because both columns exist. |

### `notifications.deleteTemplate`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ templateId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true` |
| Business operation | Sets `deleted_at`/`deleted_by`, per Invariant #2 (I1 §15) — no hard delete permitted, system-wide, no exceptions. **In the same operation, `name` is rewritten** to append a suffix (timestamp or UUID — implementer's choice of exact format, not specified here) so that the original `(city_id, name, channel, locale)` combination is immediately free for reuse by a new `createTemplate` call, rather than remaining permanently blocked by the deleted row's continued presence in the unique index. This is a deliberate design choice, not a side effect to avoid — the rename exists specifically to free the constraint slot. |

### `notifications.listTemplates`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ channel: z.enum(['in_app','email','sms']).optional(), locale: z.string().optional(), includeInactive: z.boolean().default(false) })` |
| Output | `z.object({ items: z.array(z.object({ templateId: z.string().uuid(), name: z.string(), channel: z.enum(['in_app','email','sms']), locale: z.string(), isActive: z.boolean(), updatedAt: z.coerce.date() })), nextCursor: z.string().nullable() })` |
| Callable by | `plat_admin` only |
| ABAC conditions | `subject.is_pa = true` |
| Business operation | Reads `notifications.templates WHERE deleted_at IS NULL`, filtered by `channel` and/or `locale` if supplied, excluding `is_active = false` rows unless `includeInactive` is set. Cursor-paginated per `paginationInput`, consistent with every other `list*` procedure in this router, even though the actual row count for this table is expected to be small (roughly one row per H4-catalogued event × channel × locale). |

---

# Module 9 — Audit Router (`auditRouter`)

**Schema:** `audit`. **Backing service:** B2 Module 8 Published API (`queryEvents`) — `writeEvent()` is **not** exposed through this router at all; it has no tRPC procedure, since I1 §15 Invariant #3 and I1 §8.1 state unconditionally that no application code may write to `audit.events` except through the Audit module's own internal service interface. This router is read-only by design — there is no `audit.write*` procedure anywhere in this catalog, which is itself the contract enforcing Invariant #3 at the API surface (a missing mutation, not a guarded one).

### `audit.listOwnActions`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ ...dateRangeInput.shape })` |
| Output | `z.object({ items: z.array(auditEventOutput), nextCursor: z.string().nullable() })` where `auditEventOutput = z.object({ auditEventId: z.string().uuid(), eventType: z.string(), actorId: z.string().uuid(), targetId: z.string().uuid().nullable(), targetType: z.string().nullable(), occurredAt: z.coerce.date(), payload: z.record(z.unknown()) })` |
| Callable by | `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor` |
| ABAC conditions | `audit_event.actor_id = subject.user_id` (I1 §8.2). |
| Business operation | Calls `Audit.queryEvents({ actorId: subject.user_id, ... })` (B2 Published API). `[Confirmed — I1 §8.2 in full]` |

### `audit.listOwnOfficeDocumentActions`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ officeId: z.string().uuid().optional(), ...dateRangeInput.shape })` |
| Output | Same as `audit.listOwnActions` |
| Callable by | `records_officer`, `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_captain`, `auditor` |
| ABAC conditions | `audit_event.resource_office_id ∈ subject.effective_office_ids` (I1 §8.3) — using the denormalized, write-time-populated column per I1's D-ABAC-04 resolution, never a live join back to the resource's *current* owning office. |
| Business operation | Calls `Audit.queryEvents({ resourceOfficeId: ..., ... })`. `[Confirmed — I1 §8.3 in full, including the D-ABAC-04 denormalization rationale]` |

### `audit.listFullLog`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ actorId: z.string().uuid().optional(), eventTypes: z.array(z.string()).optional(), ...dateRangeInput.shape })` |
| Output | `z.object({ items: z.array(auditEventOutput), nextCursor: z.string().nullable(), chainValidationStatus: z.enum(['intact','broken']) })` |
| Callable by | `auditor` only |
| ABAC conditions | None beyond role gate — but the *implementation* routes through a dedicated audit-reader database role (`audit_user`/equivalent reader, distinct from `app_user`), enforced at the PostgreSQL level, not only by this procedure's role check (I1 §8.4). |
| Business operation | Calls `Audit.queryEvents()` unfiltered by actor/office, returning `chainValidationStatus` per batch. `[Confirmed — I1 §8.4 in full]` |

### `audit.validateChainIntegrity`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ fromEventId: z.string().uuid().optional() })` |
| Output | `z.object({ status: z.enum(['intact','broken']), brokenAtEventId: z.string().uuid().nullable() })` |
| Callable by | `sys_admin`, `auditor` |
| ABAC conditions | None beyond role gate. |
| Business operation | Walks the SHA-256 hash chain on `audit.events.chain_hash`, flagging the first broken link as a tamper indicator. `[Confirmed — I1 §8.5 in full; tech-stack Audit Log Integrity]` |

### `audit.exportEvents`

| | |
|---|---|
| Type | `mutation` — a mutation because the export itself produces a new audit record (I1 §8.6's "the export action itself produces an audit record"), so it is not a side-effect-free read `[Inference]` |
| Input | `z.object({ eventTypes: z.array(z.string()).optional(), ...dateRangeInput.shape })` |
| Output | `z.object({ exportPresignedUrl: z.string().url() })` |
| Callable by | `auditor` only |
| ABAC conditions | Export is bounded by the auditor's classification clearance — events referencing Confidential/Restricted documents are excluded unless the auditor is on that type's explicit allowlist (I1 §8.6). |
| Business operation | Generates the export file and writes the export-action audit record itself (via the Audit module's internal `writeEvent()`, not via any path this router exposes). `[Confirmed — I1 §8.6 in full; I2 Conditional Note ¹⁶]` |

---

# Module 10 — Complaints Router (`complaintsRouter`) — Internal Staff Side Only

**Schema:** `portal.complaints` (the citizen-facing creation/read side is REST per Note on Scope above; this router covers only the SP Secretariat-side logging, routing, and resolution actions, which run inside `/web`, the authenticated internal app).

### `complaints.createClerkAssisted`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ complainantName: z.string().min(1), complainantAddress: z.string().optional(), complainantContact: z.string().min(1), subjectMatter: z.string().min(1), respondentName: z.string().optional(), respondentEmail: z.string().email().optional(), respondentPhone: z.string().optional(), narrativeText: z.string().min(1) })` — no `violationType`/`tricycleNumber` fields forced as required, since complaints are confirmed **not limited to transportation** |
| Output | `z.object({ complaintId: z.string().uuid() })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | None beyond role gate. |
| Business operation | Calls into the `portal.complaints` write path from an internal `/web` screen (access mode 3 of the three confirmed access modes — in-person, clerk-assisted). `[Confirmed — I1 §10.2 in full; I2 Section 12 "Submit complaint (clerk-assisted, in-person)"; consolidated reference Part 4.14 scope correction — not limited to transportation]` |

### `complaints.logAndAssign`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ complaintId: z.string().uuid(), assignedOfficeId: z.string().uuid() })` — may be a committee or the Vice Mayor's office; no fixed routing rule |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | None beyond role gate — the Secretariat decides routing with no fixed path, per the confirmed Q-B04 decision. |
| Business operation | Sets `complaint.assigned_office_id`, transitions `outcome_state` from initial intake toward `'pending_hearing'`. `[Confirmed — I1 §10.3 in full; consolidated reference Q-B04 decision 1]` |

### `complaints.enterCommitteeReport`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ complaintId: z.string().uuid(), reportText: z.string().min(1) })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary`, `sp_member` (committee-scoped) |
| ABAC conditions | For `sp_member`: `complaint.assigned_office_id ∈ subject.committee_ids` (I1 §10.6 pattern reused for the write side; I2 Conditional Note ¹⁴). |
| Business operation | Records the committee's report on the complaint. Transitions `outcome_state` toward `'received_seen'`/`'resolved'` depending on subsequent action. `[Confirmed — I2 Section 12 "Enter committee report on complaint"]` |

### `complaints.setOutcome`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ complaintId: z.string().uuid(), outcome: z.enum(['dismissed','resolved']), notifyRespondentVia: z.enum(['email','phone_then_in_person_pickup']) })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | None beyond role gate (I1 §10.7). |
| Business operation | Sets `complaint.outcome_state`. Triggers the confirmed respondent notification rule via `Notifications.sendNotification()` (B2 Module 7): if the respondent has an email on file, the notification **and** the formal written notice are both sent by email; if only a contact number exists, a notification is sent and the respondent must claim the formal written notice in person from the LGU. `[Confirmed — I1 §10.7 in full; consolidated reference Q-B04 decision 4; B2 Module 7 "Respondent Notice Service" description]` |

### `complaints.listAll`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput.extend({ outcomeState: z.enum(['pending_hearing','received_seen','dismissed','resolved']).optional() })` |
| Output | `z.object({ items: z.array(z.object({ complaintId: z.string().uuid(), subjectMatter: z.string(), outcomeState: z.string(), assignedOfficeId: z.string().uuid().nullable(), createdAt: z.coerce.date() })), nextCursor: z.string().nullable() })` |
| Callable by | `sp_secretary`, `sp_presiding_officer`, `auditor` unconditionally; `sp_member` (committee-scoped) |
| ABAC conditions | For `sp_member`: `complaint.assigned_office_id ∈ subject.committee_ids` (I1 §10.6). |
| Business operation | Reads `portal.complaints`, the SP-Secretariat-wide view. `[Confirmed — I1 §10.6 in full; I2 Section 12 "View all complaints (SP Secretariat only)"]` |

---

# Module 11 — Document Requests Router (`documentRequestsRouter`) — Internal Staff Side Only

**Schema:** `portal.citizen_requests` (citizen self-service submission is REST/Portal; this router covers the internal Secretariat/Vice Mayor approval chain and the clerk-assisted creation mode).

### `documentRequests.createClerkAssisted`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ documentTypeRequested: z.string(), titleOrNumber: z.string().min(1), numberOfPages: z.number().int().positive(), requesterName: z.string().min(1), requesterAgency: z.string().optional(), requesterEmail: z.string().email(), idPresented: z.string(), purpose: z.string().min(1) })` |
| Output | `z.object({ requestId: z.string().uuid(), printableFormUrl: z.string().url() })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | None beyond role gate. |
| Business operation | Access mode 3 of the three confirmed modes — clerk fills the digital form, system generates the printable form on-site, citizen signs on the spot (consolidated reference Part 4.15). `[Confirmed — I1 §13.2 in full; I2 Section 13 "Log / enter clerk-assisted document request"]` |

### `documentRequests.generatePrintableForm`

| | |
|---|---|
| Type | `query` |
| Input | `z.object({ requestId: z.string().uuid() })` |
| Output | `z.object({ printableFormUrl: z.string().url() })` |
| Callable by | `sp_secretary` |
| ABAC conditions | None beyond role gate. |
| Business operation | Renders the request data into the official Document Request Form layout (access mode 2: digital-form-then-print, used by both internal staff and, via the REST equivalent, citizens). `[Confirmed — I2 Section 13 "Generate printable document request form", ✅ for SP Secretary on the internal side]` |

### `documentRequests.approveAsPresidingOfficer`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ requestId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_presiding_officer` only |
| ABAC conditions | `request` must be at the Vice Mayor approval step (I1 §13.3). |
| Business operation | Records the Vice Mayor's half of the dual-signature approval requirement. `[Confirmed — I1 §13.3 in full]` |

### `documentRequests.approveAsSecretary`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ requestId: z.string().uuid() })` |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | `request` must be at the SP Secretary approval step **and** the Vice Mayor must have already approved (I1 §13.4 — sequential approval, both required before release). |
| Business operation | Records the second half of the dual-signature requirement. Approval now complete; release is gated separately on payment. `[Confirmed — I1 §13.4 in full; consolidated reference Part 4.15 "Approval requires both Vice Mayor AND SP Secretary signature"]` |

### `documentRequests.releaseCopy`

| | |
|---|---|
| Type | `mutation` |
| Input | `z.object({ requestId: z.string().uuid(), orNumber: z.string().optional(), collectingOfficerId: z.string().uuid() })` — `orNumber` (Official Receipt number) is optional in Phase 1 since payment processing itself is deferred per Q-D04 |
| Output | `z.object({ success: z.literal(true) })` |
| Callable by | `sp_secretary` only |
| ABAC conditions | `request.approval_status = 'approved'`. Payment confirmation check is **skipped** in Phase 1 — the procedure does not block on a payment-system call, since none exists yet, per the confirmed Q-D04 deferral; `orNumber` is recorded if the office collects payment through an existing manual process, but its presence is not enforced as a precondition by this procedure. |
| Business operation | Marks the request released and notifies the requester via contact number, the confirmed primary post-approval channel. `[Confirmed — I1 §13.5 in full; consolidated reference Q-D04; Part 4.15 "Post-approval notifications"]` |

### `documentRequests.listAll`

| | |
|---|---|
| Type | `query` |
| Input | `paginationInput` |
| Output | `z.object({ items: z.array(z.object({ requestId: z.string().uuid(), requesterName: z.string(), documentTypeRequested: z.string(), approvalStatus: z.string(), createdAt: z.coerce.date() })), nextCursor: z.string().nullable() })` |
| Callable by | `sp_secretary`, `sp_presiding_officer`, `auditor` |
| ABAC conditions | None beyond role gate. |
| Business operation | Reads `portal.citizen_requests` in full (no office-scoping narrower than "all SP Secretariat requests," since document requests are inherently SP-Secretariat-wide, not per-department). `[Confirmed — I1 §13 pattern; I2 Section 13 "View all document requests"]` |

---

## Cross-Reference: Procedure-to-Policy Traceability Index

Every procedure above cites at least one I1 policy clause or I2 permission row. This index inverts that mapping for reviewers auditing the reverse direction — confirming no I2 "✅" cell for an internal (non-citizen-self-service) action was left without a corresponding procedure.

| I2 Section | Coverage in This Document |
|---|---|
| 1 — IAM | Fully covered by `iamRouter` (13 procedures) |
| 2 — Organization Structure | Fully covered by `organizationRouter`'s office/position/employee/designation/committee procedures |
| 3 — Platform Configuration | Office/position/employee/role/committee CRUD covered; document-type/numbering-series/workflow-definition/notification-template/SLA-threshold/public-visibility-rule CRUD procedures are `[Deferred]` from this catalog's detailed treatment — these are Tier 2 Platform Admin config screens whose backing schemas (`document_types`, `number_series`) exist in C1 but whose full CRUD procedure set would substantially duplicate the `documentsRouter`'s type-management surface; flagged here for a follow-up addendum rather than guessed at without a more detailed config-screen spec to build against. |
| 4 — Document Creation/Submission | Fully covered by `documentsRouter` §3.1–3.2 |
| 5 — Document Viewing/Search | Fully covered by `documentsRouter` `get`/`list`/`search`/`getVersionHistory`/`downloadVersion` |
| 6 — Workflow Execution | Fully covered by `workflowRouter` |
| 7 — Document Tracking (DTS) | Fully covered by `trackingRouter` |
| 8 — Session Attendance/Order of Business | Fully covered by `sessionRouter` |
| 9 — Signature Recording | Covered by `documents.flagScannedBackForVerification`/`acceptScannedBackAsOfficial`; `uploadScannedSignature` and `viewSignatureRecords` are `[Inference — implied by I2's existing rows but not separately detailed above; would attach to documentsRouter as documents.uploadSignatureImage / documents.getSignatures, following the same pattern as the version-upload pair]` |
| 10 — Records Management (RMS) | Phase 1 subset covered by `recordsRouter`; bulk operations (`bulk_archive`, `bulk_search`, `bulk_export`) and disposition/PII-erasure procedures are `[Deferred]` — they are explicitly Phase 2 module delivery per B2 Module 6, and this catalog's Phase 1 emphasis intentionally stops at the four read/write procedures the Documents/Workflow modules already depend on synchronously. |
| 11 — Notifications | Fully covered by `notificationsRouter` |
| 12 — Citizen Complaints | Internal-staff side fully covered by `complaintsRouter`; citizen-submission/own-status-view rows are REST/Portal, out of scope per Note on Scope |
| 13 — Document and Records Request | Internal-staff side fully covered by `documentRequestsRouter`; citizen-submission/own-status-view rows are REST/Portal |
| 14 — Public Portal Access | `documents.publishToPortal`/`unpublishFromPortal` cover the two internal-actor rows; the three citizen-facing rows are REST/Portal |
| 15 — Audit Log | Fully covered by `auditRouter` (read-only by design; no write procedure exists, which is itself the Invariant #3 enforcement) |
| 16 — Reporting and Dashboards | `workflow.getSlaComplianceData`, `tracking`/`documents` list procedures, `session.getOrderOfBusiness` cover the live-data half; `report_definitions` CRUD and "Run saved report"/"Export report output" are Phase 2 (Reporting module, B2 Module 11) and out of scope |
| 17 — OCR and File Processing | Fully covered by `documentsRouter` §3.3 |

---

## Required Follow-Up Before Full Sign-Off

| #     | Item                                                                                                                                                           | Why Deferred                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1-F1 | Tier 2 Platform Admin config CRUD procedures for `notification_templates`, `sla_thresholds`/escalation targets, `public_visibility_rules` as distinct entities | These admin-configurable concepts are confirmed to exist (consolidated reference Part 11.21) but their dedicated schemas are not among C1's eight Phase 1 DDL schemas as standalone tables (SLA/visibility-rule values currently live as enum columns or JSONB fields inline on `document_types`, not separate config tables) — a procedure catalog for tables that do not yet exist would be speculative. Revisit once a C1 addendum (or C1 itself) adds these as first-class tables, if the Tier 2 admin UI requires them to be editable independent of a document type. |
| E1-F2 | RMS bulk operations and disposition procedures (`records.bulkArchive`, `records.initiateDisposition`, `records.processPiiErasure`)                             | Phase 2 module delivery per B2 Module 6; included in I1 (§9.5, §9.7, §9.8) for policy completeness but the Phase 1 `recordsRouter` in this document intentionally stops at the four procedures the Phase 1 Documents/Workflow modules call synchronously.                                                                                                                                                                                                                                                                                                                  |
| E1-F3 | Signature upload/read procedures (`documents.uploadSignatureImage`, `documents.getSignatures`)                                                                 | Implied by I2 Section 9's permission rows and by C1 §4.9's `documents.signatures` table, but not separately detailed in I1's resource-type sections the way version/attachment upload is — the shape is confidently inferable (mirrors `documents.confirmUpload`) but is flagged here rather than asserted as independently confirmed.                                                                                                                                                                                                                                     |

---

*This document is the contract between `/server` and `/web` for Phase 1. Every procedure listed must have a corresponding Zod schema committed to `/packages/shared` before either side's implementation merges. This document must be updated in the same PR as any new procedure, any change to an existing procedure's input/output shape, or any change to its role/ABAC gating — consistent with the change-discipline B2 establishes for the Published API Call Matrix and this document's own role as E1 in the document dependency chain.*
