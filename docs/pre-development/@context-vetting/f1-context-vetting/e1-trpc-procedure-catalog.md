# F1. Application Route Map — Curated Source Context (Part 3: tRPC Procedure Catalog, Synthesized by View)

[Unverified] This document differs from its two companions in method, per your explicit instruction for this file: synthesis is permitted here, with the constraint that no information from the source is lost. Concretely, that means: every one of the ~80 procedures cataloged in `e1-trpc-router-and-procedure-catalog.md` appears below with its full detail (procedure name, type, input schema, output schema, callable-by role list, ABAC conditions, business operation, and source confidence tag) preserved exactly as in source — but regrouped by _which F1 view needs it_, rather than by _which backend router defines it_ (the source file's own organization). Per your separate decision on this round, a procedure needed by more than one view is listed in full under every view that needs it, not abbreviated after its first appearance.

**Purpose:** This is the third companion to the F1 gathering set, alongside `f1-route-map-source-context.md` (what each view does, from the stack/requirements files) and `f1-route-map-source-context-part2-roles.md` (who can access each view, from the permission matrix). This document answers F1's fourth required field directly: "primary data dependencies (which tRPC procedures it calls)" — the one field the prior two source documents could not answer at all, since neither contained actual procedure names.

**Source file:** `e1-trpc-router-and-procedure-catalog.md`

[Inference] Unlike the permission matrix (which stated access rules with no route implied) or the requirements file (which described behavior with no procedure names), this source file is itself an API contract aimed at "frontend developers build `/web` screens against" — so its procedure-to-screen mapping is closer to F1's actual purpose than either prior source. Even so, this file organizes procedures by backend router, not by frontend route, so the regrouping below is still a synthesis step, not a re-statement of an existing source-side grouping.

**Notation carried over from source (unchanged):** `[Confirmed — source]` = directly traceable to a cited document. `[Inference]` = a reasonable design implied by confirmed facts but not stated verbatim. `[Deferred]` = depends on a decision or schema not yet finalized.

**Verification checklist:** This document was built against a procedure-by-procedure inventory of the source file (13 IAM + 9 Organization + 23 Documents + 18 Workflow + 5 Tracking + 6 Session + 5 Records + 4 Notifications + 5 Audit + 5 Complaints + 6 Document Requests = 99 procedure entries, several of which are paired mutations like `createOffice`/`updateOffice` documented as one entry — 84 distinct documented entries once pairs are counted singly). Section 12 below accounts for every entry not assigned to a named F1 view, so the count reconciles.

---

## 1. Global Conventions Every Procedure Inherits (stated once, per source's own approach, not repeated per-procedure below)

[Inference] The source file states these once at the top rather than per-procedure; reproducing this once here, rather than implicitly re-deriving it 80 times across the sections below, is itself synthesis-without-loss — the information is fully preserved, just not duplicated where source itself didn't duplicate it.

_Source: "The `protectedProcedure` Base and Middleware Chain" (full)_

> Every procedure in this catalog (with zero exceptions — there is no `publicProcedure` in this router set, since `/web` is "fully authenticated," per `tech-stack.md`) is built on a shared `protectedProcedure` base that runs, in order:
> 
> 1. `verifyAccessToken` — populates `ctx.subject` (the `SubjectContext` object defined in I1 §1) from the JWT
> 2. `loadDelegationContext` — expands `ctx.subject.effective_office_ids` / `effective_roles` per I1 §16, if `subject.delegation_grant_id` is non-null
> 3. The route-specific Zod input parse (tRPC's own `.input()` validator)
> 4. `requireRole([...])` — the **Callable by** gate for each procedure below; a coarse, role-set check
> 5. `requirePolicy(resource, action)` — invokes `IAM.evaluatePolicy()` (B2 Module 1 Published API), running the full I1 cascade (Global Gates 1–5, then the resource-specific policy) for the **ABAC conditions** narrowing described per procedure
> 
> A procedure that has "no additional ABAC condition beyond role" still runs step 5 — the Global Gates (tenant isolation, IT Admin content isolation, Platform Admin operational exclusion, soft-delete gate) always apply, even when no resource-specific clause is listed. This document only narrates the _resource-specific_ clause per procedure since the Global Gates are constant and already fully specified in I1 §2.

[Inference] **What this means for every route in F1:** no route, regardless of which procedures it calls, is ever calling an unauthenticated endpoint — `/apps/web` has zero public procedures. Any route description in F1 that says "no role required" must instead mean "the public portal subset, served outside this tRPC boundary entirely" (see Section 10 below), not "an open tRPC call." This is a structural fact about the whole catalog, not a per-procedure note, so it's stated once here rather than under every view section.

_Source: error shape (full, also global)_

> All procedures throw `TRPCError` with one of: `UNAUTHORIZED` (no valid session), `FORBIDDEN` (role or ABAC gate failed — the `reason` string from the I1 policy clause, e.g. `"tenant_isolation"`, `"classification_denied"`, is attached as `cause`), `NOT_FOUND`, `BAD_REQUEST` (Zod validation failure — handled automatically by tRPC's input parser), `CONFLICT` (state-transition or uniqueness violation — e.g. attempting `documents.assignFinalNumber` when `final_number` is already set), `PRECONDITION_FAILED` (a workflow or document state precondition is not met, distinct from a pure ABAC denial). `[Inference — standard tRPC error code usage; mapping to LGU-specific cases is Inference]`

_Source: Output Envelope for List Procedures (full, also global)_

> Every `list` procedure returns the cursor-paginated shape:
> 
> ```typescript
> interface PaginatedOutput<T> {
>   items: T[];
>   nextCursor: string | null;
> }
> ```

_Source: Shared Fragment Schemas referenced by name throughout the procedures below (full)_

> ```typescript
> // paginationInput — appended to every list procedure's input
> const paginationInput = z.object({
>   cursor: z.string().nullish(),
>   pageSize: z.number().int().min(1).max(100).default(20),
> });
> 
> // dateRangeInput — used wherever a procedure filters by a time window
> const dateRangeInput = z.object({
>   from: z.coerce.date().nullish(),
>   to: z.coerce.date().nullish(),
> });
> 
> // userSummaryOutput — mirrors B2 UserSummary exactly
> const userSummaryOutput = z.object({
>   userId: z.string().uuid(),
>   displayName: z.string(),
>   email: z.string().email(),
>   officeId: z.string().uuid().nullable(),
>   positionTitle: z.string().nullable(),
> });
> 
> // officeSummaryOutput — mirrors B2 OfficeSummary exactly
> const officeSummaryOutput = z.object({
>   officeId: z.string().uuid(),
>   name: z.string(),
>   parentOfficeId: z.string().uuid().nullable(),
>   type: z.string(),
> });
> 
> // auditableEntityOutput — fields present on every readable row
> const auditableEntityOutput = z.object({
>   id: z.string().uuid(),
>   cityId: z.string().uuid(),
>   createdAt: z.coerce.date(),
>   updatedAt: z.coerce.date().nullable(),
>   deletedAt: z.coerce.date().nullable(),
> });
> 
> // documentLifecycleStateEnum — mirrors C1 documents.lifecycle_state_enum exactly
> const documentLifecycleStateEnum = z.enum([
>   'draft', 'submitted', 'in_workflow', 'pending_approval',
>   'completed', 'released', 'archived', 'disposed', 'cancelled',
> ]);
> 
> // classificationLevelEnum — mirrors C1 documents.classification_level_enum exactly
> const classificationLevelEnum = z.enum([
>   'public', 'internal', 'confidential', 'restricted',
> ]);
> 
> // documentTypeCodeEnum — the Phase 1 SP workflow document type codes
> const documentTypeCodeEnum = z.enum([
>   'SP_RESOLUTION', 'SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE',
>   'CERTIFICATION_OF_URGENCY', 'DESIGNATION', 'NOTICE_OF_COMMITTEE_HEARING',
>   'NOTICE_OF_SPECIAL_SESSION', 'LETTER_RECEIVED', 'LETTER_SENT',
>   'MEMO_OUTGOING', 'MEMO_INCOMING', 'CITIZEN_COMPLAINT', 'DOCUMENT_REQUEST_FORM',
> ]);
> 
> // roleCodeEnum — the 13 roles per I2 Roles Reference / I1 §15 D-ABAC-01 seed list
> const roleCodeEnum = z.enum([
>   'sys_admin', 'plat_admin', 'records_officer', 'dept_encoder', 'dept_approver',
>   'sp_secretary', 'sp_member', 'sp_presiding_officer', 'mayor',
>   'brgy_encoder', 'brgy_captain', 'auditor', 'citizen',
> ]);
> ```

---

## 2. SP Secretary Dashboard

[Inference] The source file doesn't name a single "dashboard" procedure beyond the inbox/queue pattern — this view is assembled from the task-inbox query plus whichever summary/list queries a dashboard would reasonably surface (SLA compliance, Order of Business preview). I've included the ones source explicitly ties to dashboard framing; `session.getOrderOfBusiness` is cross-listed here and in Section 3, since the consolidated requirements file already established the SP Secretary dashboard "must include an Order of Business management view."

### `workflow.listMyAssignedSteps`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput`|
|Output|`z.object({ items: z.array(z.object({ stepInstanceId: z.string().uuid(), instanceId: z.string().uuid(), documentId: z.string().uuid(), documentTitle: z.string(), stepType: z.enum(['action','approval','multi_referral','decision','notification','termination']), assignedAt: z.coerce.date(), dueAt: z.coerce.date().nullable() })), nextCursor: z.string().nullable() })`|
|Callable by|`records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`|
|ABAC conditions|`step.assignee_user_id = subject.user_id` **OR** office-scoped queue membership per the role (I1 §6.1). This is the backing query for the "own task inbox" dashboards referenced in I2 Section 16.|
|Business operation|Reads `workflow.step_instances WHERE status = 'pending'` filtered by assignee/office. `[Confirmed — I1 §6.1; I2 Section 16 "View own task inbox / assigned steps"]`|

### `workflow.getSlaComplianceData`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ officeId: z.string().uuid().optional(), documentTypeId: z.string().uuid().optional(), breachedOnly: z.boolean().default(false), ...dateRangeInput.shape })`|
|Output|`z.array(z.object({ instanceId: z.string().uuid(), documentId: z.string().uuid(), slaClassification: z.enum(['simple','complex','highly_technical']), slaThresholdDays: z.number().int(), elapsedWorkingDays: z.number().int(), isBreached: z.boolean(), breachedAt: z.coerce.date().nullable() }))`|
|Callable by|`records_officer`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `auditor`|
|ABAC conditions|None beyond role gate — ARTA reporting visibility is not office-scoped for these roles per I2 Section 16.|
|Business operation|This is the literal call B2 documents as `Reporting (ARTA reporter) → Workflow.getWorkflowSLAData()`; exposed here as a direct `/web` query as well, since the SP Secretary dashboard needs the same data without going through the (Phase 2) Reporting module. `[Confirmed — B2 Module 4 Published API "getWorkflowSLAData"; I2 Section 16 "View ARTA SLA compliance report"]`|

### `session.getOrderOfBusiness` (cross-listed; full detail in Section 3)

|||
|---|---|
|Type|`query`|
|Input|`z.object({ sessionDate: z.coerce.date().optional() })` — defaults to the next upcoming Tuesday session if omitted|
|Output|`z.object({ sessionDate: z.coerce.date(), items: z.array(z.object({ documentId: z.string().uuid(), title: z.string(), preliminaryNumber: z.string().nullable(), committeeReportStatus: z.enum(['not_applicable','all_submitted','red_flagged']), assignedCommittees: z.array(z.string()) })) })`|
|Callable by|`sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor`|
|ABAC conditions|None beyond role gate.|
|Business operation|A derived, computed view over `documents.documents` joined to the active `multi_referral` step instances for the upcoming Tuesday session, with items whose committees have not all submitted by the Thursday cutoff rendered `red_flagged`. `[Confirmed — I2 Section 8 "View Order of Business (current session)"; consolidated reference Part 4.18, Q-A02]`|

### `documents.list` (cross-listed; full detail in Section 4)

[Inference] Likely needed for a dashboard "queue" widget showing documents by lifecycle state/office, distinct from the per-user task inbox above. See Section 4 for full detail; not re-quoted here to avoid the same table appearing three times in this document where two is already required by the "list under every relevant view" rule — flagged with a pointer instead since Section 4 is itself only one section away and the procedure's role/ABAC shape is identical to `documents.get`'s, already shown in full in Section 4.

---

## 3. Order of Business View

### `session.getOrderOfBusiness`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ sessionDate: z.coerce.date().optional() })` — defaults to the next upcoming Tuesday session if omitted|
|Output|`z.object({ sessionDate: z.coerce.date(), items: z.array(z.object({ documentId: z.string().uuid(), title: z.string(), preliminaryNumber: z.string().nullable(), committeeReportStatus: z.enum(['not_applicable','all_submitted','red_flagged']), assignedCommittees: z.array(z.string()) })) })`|
|Callable by|`sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor`|
|ABAC conditions|None beyond role gate.|
|Business operation|A derived, computed view (not its own table) over `documents.documents` joined to the active `multi_referral` step instances for the upcoming Tuesday session, with items whose committees have not all submitted by the Thursday cutoff rendered `red_flagged`, per the confirmed Q-A02 visual-indicator rule. `[Confirmed — I2 Section 8 "View Order of Business (current session)"; consolidated reference Part 4.18, Q-A02]`|

### `session.scheduleDocumentForFirstReading`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid(), sessionDate: z.coerce.date() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`sessionDate` must be a Tuesday and the call must occur before that Tuesday's preceding Thursday cutoff, otherwise the document is scheduled for the following week's session instead (`PRECONDITION_FAILED` is not thrown in this case — the resolver silently rolls forward to the next valid Tuesday and returns the actual scheduled date, since this is a scheduling convenience rule, not an access denial).|
|Business operation|Adds the document to the Order of Business for the target session. `[Confirmed — I2 Section 8 "Schedule document for first reading"; consolidated reference Part 7.2 session/cutoff rules]`|

### `session.enterCommitteeHearingDate`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid(), hearingDate: z.coerce.date().nullish() })` — nullable/omittable, since a committee referral may begin as "assigned; date TBD"|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|None beyond role gate — committee representatives never input this directly; Secretariat staff always enters what the committee communicates (consolidated reference Q-C05).|
|Business operation|Writes the hearing date onto the `multi_referral` step instance's metadata. `[Confirmed — I2 Section 8 "Enter committee hearing date"; consolidated reference Q-C05 in full]`|

### `workflow.submitCommitteeReport` (cross-listed; full detail in Section 5)

[Inference] This procedure's `allCommitteesSubmitted` output directly drives the `committeeReportStatus` field shown in `getOrderOfBusiness` above — the Order of Business view almost certainly needs to either call this directly (if committees submit reports from within the Order of Business screen itself) or at minimum reflect its effects. Full detail in Section 5 (Workflow Step Action Views), since the action itself ("submit committee report") is more naturally a workflow-step action than an Order-of-Business-view action; pointer included here so the dependency isn't missed.

### `workflow.manuallyAdvanceMultiReferralStep` (cross-listed; full detail in Section 5)

[Inference] Same reasoning — the SP Secretary's manual-override action against a red-flagged Order of Business item. Full detail in Section 5.

---

## 4. Document Intake Form

### `documents.create`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentTypeId: z.string().uuid(), title: z.string().min(1).max(500), metadata: z.record(z.unknown()).default({}) })`|
|Output|`z.object({ documentId: z.string().uuid(), lifecycleState: documentLifecycleStateEnum })`|
|Callable by|`dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`|
|ABAC conditions|`subject.office_id ∈ subject.effective_office_ids`. For `document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`: `originating_office_id` on the inserted row is **always** set server-side to the SP Secretariat office UUID, regardless of what office the calling user belongs to — the request body has no `originatingOfficeId` field at all, so a `sp_member` (a Councilor) can author the draft text while the row is correctly attributed. `metadata` is validated against `documents.document_types.metadata_schema` (the JSON Schema for that type) as a second-pass validation after the generic Zod `.record()` parse.|
|Business operation|Inserts `documents.documents` with `lifecycle_state = 'draft'` (C1 §4.5). Does **not** assign QR tracking number or preliminary number yet — those occur at formal `submit`. Emits no domain event at `draft` creation. `[Confirmed — I1 §3.1 "document:create"; I2 Section 4 "Create new document (draft)"; C1 §4.5; B2 Module 3 event table]`|

### `documents.requestUploadUrl`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid(), filename: z.string().min(1), mimeType: z.string(), fileSizeBytes: z.number().int().positive().max(26214400) })` — 25 MB ceiling per `tech-stack.md`|
|Output|`z.object({ presignedUploadUrl: z.string().url(), s3Key: z.string().uuid() })`|
|Callable by|`dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member` (own-authored only), `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`|
|ABAC conditions|`parent_document.office_id ∈ subject.effective_office_ids`. `sp_member`: `parent_document.created_by = subject.user_id` (I1 §4.2).|
|Business operation|Generates a UUID `s3Key` (never the original filename — Architectural Law #4) and a presigned PUT URL against the configured S3-compatible endpoint. Does **not** create the `documents.versions` row yet — that happens in `documents.confirmUpload`, after the client-side upload streams directly to S3, never touching the application server's disk. `[Confirmed — I1 §4.2 "document_version:create"; tech-stack File Storage Strategy; consolidated reference Part 11.10]`|

### `documents.confirmUpload`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid(), s3Key: z.string().uuid(), originalFilename: z.string(), mimeType: z.string(), fileSizeBytes: z.number().int().positive(), pageCount: z.number().int().positive().nullish() })`|
|Output|`z.object({ versionId: z.string().uuid(), versionNumber: z.number().int(), ocrQueued: z.literal(true) })`|
|Callable by|Same as `documents.requestUploadUrl`|
|ABAC conditions|Same as `documents.requestUploadUrl`.|
|Business operation|Inserts `documents.versions` (C1 §4.7) with `ocr_processed = false`. Enqueues the OCR job — OCR **runs automatically on upload** with no separate trigger procedure needed, per the confirmed Phase 1 decision (consolidated reference Q-C01); the queued job later writes `scan_quality_score`/`scan_quality_category`/`ocr_text` back onto this same row asynchronously. `original_filename` is stored only as PostgreSQL metadata, never as the storage key. `[Confirmed — I1 §4.2; consolidated reference Part 11.4 OCR section, Q-C01; C1 §4.7]`|

### `documents.getScanQualityIndicator`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ versionId: z.string().uuid() })`|
|Output|`z.object({ scanQualityScore: z.number().min(0).max(1).nullable(), scanQualityCategory: z.enum(['good','fair','poor']).nullable() })`|
|Callable by|`records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`|
|ABAC conditions|`parent_document.created_by = subject.user_id` **OR** `parent_document.office_id ∈ subject.effective_office_ids` — this is a slightly _looser_ gate than general content read (no classification narrowing, since the quality score is a processing artifact, not document content itself, and the indicator must reach the uploader even before they know the document's eventual classification).|
|Business operation|Reads `documents.versions.scan_quality_score`/`scan_quality_category`, always shown to the user per the confirmed Q-C01 decision so they can decide whether to re-scan. `[Confirmed — I1 §4.4 "document_ocr_quality:read"; I2 Section 17; consolidated reference Q-C01]`|

### `documents.update`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid(), title: z.string().min(1).max(500).optional(), metadata: z.record(z.unknown()).optional() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`dept_encoder`, `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `sp_member` (own-authored drafts only)|
|ABAC conditions|`lifecycle_state = 'draft'` required (the State-Action Compatibility Matrix, I1 §17, denies `update` outside Draft entirely). `sp_member` additionally requires `document.created_by = subject.user_id` (I1 §3.3 Additional Rule). Once past Draft, this procedure is unreachable for content edits — amendments thereafter go through `workflow.amendStep` instead.|
|Business operation|Updates `documents.documents.title`/`metadata` in place. `[Confirmed — I1 §3.3 in full; I1 §17 State-Action Compatibility Matrix]`|

### `documents.submit`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|`z.object({ lifecycleState: z.literal('submitted'), qrTrackingNumber: z.string().uuid().nullable(), preliminaryNumber: z.string().nullable() })`|
|Callable by|`dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`|
|ABAC conditions|`lifecycle_state = 'draft'`. **Special rule for SP workflow documents**: for `document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`, the formal submission that triggers workflow instance creation and QR assignment additionally requires `subject.roles CONTAINS 'sp_secretary'` — an `sp_member` calling this on their own drafted resolution receives `FORBIDDEN` with cause `"sp_secretary_required_for_formal_submission"` and must hand off to the Secretariat instead (the draft remains visible and editable by them in the meantime via `documents.update`).|
|Business operation|Calls `Documents.transitionState(documentId, 'submitted', actorId)`. For SP workflow types, this is also the trigger point for QR generation and Workflow instance creation pinned to the active `definition_version_id`. `[Confirmed — I1 §3.5 in full; B2 Module 3 event table and Module 5 "Confirmed QR assignment sequence"]`|

### `documents.assignPreliminaryNumber`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|`z.object({ preliminaryNumber: z.string() })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`, `lifecycle_state IN ('submitted','in_workflow')` (specifically at the secretariat logging step), `document.preliminary_number IS NULL`.|
|Business operation|Calls the `documents.fn_assign_preliminary_number()` DB function (C1 §4.12). Renders `Draft 7SP {YEAR}-{NN}` using the space delimiter confirmed throughout the consolidated reference. Emits `document.number_assigned` with `numberType: 'preliminary'` → Audit. `[Confirmed — I1 §3.7 in full; C1 §4.12; consolidated reference Part 5.1–5.2]`|

### `documents.list` (cross-listed; full detail repeated here per the "every relevant view" rule)

|||
|---|---|
|Type|`query`|
|Input|`paginationInput.extend({ documentTypeId: z.string().uuid().optional(), lifecycleState: documentLifecycleStateEnum.optional(), officeId: z.string().uuid().optional(), ...dateRangeInput.shape })`|
|Output|`z.object({ items: z.array(documentListItemOutput), nextCursor: z.string().nullable() })` where `documentListItemOutput` is the same shape as `documents.get`'s output minus `metadata`|
|Callable by|Same role set as `documents.get` (see Section 7)|
|ABAC conditions|Same scoping as `documents.get`, applied as a `WHERE` filter rather than a single-row check; PostgreSQL RLS is the second enforcement layer here.|
|Business operation|Reads `documents.documents` with the office/classification filters above. `[Inference — a list procedure is required for any dashboard or queue view; not separately named in I1/I2 but structurally necessary given documents.get exists]`|

[Inference] The intake form most plausibly needs `documents.list` to show "my recent drafts" or similar, alongside the create/upload flow — included here on that basis, though source doesn't explicitly tie this procedure to the intake form specifically.

---

## 5. Workflow Step Action Views

[Inference] This is the single largest grouping, consistent with the prior two curation documents' finding that "workflow step action views" is very likely a family of distinct routes (one per step type/role), not one shared view. Procedures below are grouped by the actor/step-type pattern they serve, mirroring the source's own Module 4 sub-groupings, since that grouping already aligns naturally with "distinct action view per role."

### Shared status/inbox queries (needed by every workflow step action view to know what to render)

#### `workflow.getInstance`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ instanceId: z.string().uuid() })`|
|Output|`z.object({ instanceId: z.string().uuid(), documentId: z.string().uuid(), definitionVersionId: z.string().uuid(), currentStepType: z.enum(['action','approval','multi_referral','decision','notification','termination','parallel_split','parallel_join']), currentStepInstanceId: z.string().uuid(), currentAssigneeUserId: z.string().uuid().nullable(), status: z.enum(['Active','Completed','Cancelled']), slaDeadline: z.coerce.date().nullable(), lapseStatus: z.enum(['mayor_10_day_lapsed','panlalawigan_30_day_deemed']).nullable() })`|
|Callable by|`plat_admin`, `records_officer`, `dept_encoder` (🔶 scoped), `dept_approver` (🔶 scoped), `sp_secretary`, `sp_member` (🔶 scoped), `sp_presiding_officer`, `mayor`, `brgy_encoder` (🔶 scoped), `brgy_captain` (🔶 scoped), `auditor`|
|ABAC conditions|Own-office instances readable by the listed operational roles when scoped; `sp_secretary` has unconditional full visibility across SP Secretariat scope; cross-office read for `records_officer`/`sp_presiding_officer`/`mayor`/`auditor` requires `classification_level IN ('public','internal')`.|
|Business operation|Calls `Workflow.getInstanceById()` (B2 Published API). `[Confirmed — I1 §5.1 in full]`|

#### `workflow.getActiveInstanceForDocument`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|Same shape as `workflow.getInstance`, nullable|
|Callable by|Same as `workflow.getInstance`|
|ABAC conditions|Same as `workflow.getInstance`, resolved via the parent document's office/classification.|
|Business operation|Calls `Workflow.getActiveInstanceForDocument()` (B2 Published API) — links the document view to its current workflow status without reading the workflow schema, exposed as its own `/web`-callable procedure for the document detail screen. `[Confirmed — B2 Module 4 Published API; I1 §5.1]`|

#### `workflow.listMyAssignedSteps` (full detail repeated; see Section 2 for first occurrence)

|||
|---|---|
|Type|`query`|
|Input|`paginationInput`|
|Output|`z.object({ items: z.array(z.object({ stepInstanceId: z.string().uuid(), instanceId: z.string().uuid(), documentId: z.string().uuid(), documentTitle: z.string(), stepType: z.enum(['action','approval','multi_referral','decision','notification','termination']), assignedAt: z.coerce.date(), dueAt: z.coerce.date().nullable() })), nextCursor: z.string().nullable() })`|
|Callable by|`records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`|
|ABAC conditions|`step.assignee_user_id = subject.user_id` **OR** office-scoped queue membership per the role (I1 §6.1).|
|Business operation|Reads `workflow.step_instances WHERE status = 'pending'` filtered by assignee/office. `[Confirmed — I1 §6.1; I2 Section 16 "View own task inbox / assigned steps"]`|

### Generic action/approval steps (Department Approver, Secretary, Presiding Officer, Mayor, Barangay Captain)

#### `workflow.completeActionStep`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid(), comment: z.string().optional() })`|
|Output|`z.object({ success: z.literal(true), nextStepType: z.string().nullable() })`|
|Callable by|`dept_encoder` (🔶 scoped), `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_encoder` (🔶 scoped), `brgy_captain`|
|ABAC conditions|`step.step_type = 'action'`, `step.status = 'pending'`, and (`step.assignee_user_id = subject.user_id` **OR** office-match for the non-Encoder roles). **Encoder restriction**: `dept_encoder`/`brgy_encoder` may only complete a step where `step.assignee_user_id = subject.user_id` **OR** the parent document `created_by = subject.user_id` — they cannot claim arbitrary steps from the general office queue.|
|Business operation|Marks the `workflow.step_instances` row `completed`, advances the instance per its `transition_rules`. Emits `workflow.step_completed` → Tracking (routing entry append), Audit. `[Confirmed — I1 §6.2 in full; I2 Conditional Note ¹²]`|

#### `workflow.approveStep` / `workflow.rejectStep` / `workflow.returnStepForRevision`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid(), comment: z.string().optional() })` — `comment` becomes **required** for `rejectStep` and `returnStepForRevision` specifically `[Inference — consistent with the mandatory-comment pattern applied elsewhere]`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_captain`|
|ABAC conditions|`step.step_type = 'approval'`, `step.status = 'pending'`, office-match or direct assignee match. **Invariant #13** enforced server-side: if `step.is_final_approval_step = true` and `subject.user_id` equals either `resolved_document.created_by` or `workflow_instance.submitted_by`, the call is rejected with `FORBIDDEN` / `"encoder_final_approver_same_user_prohibited"`, checked **after** the role gate passes.|
|Business operation|Updates the step outcome; for `approveStep`, also the call site that triggers `Documents.transitionState()` onward at the relevant terminal approval step. `[Confirmed — I1 §6.3 in full, including Invariant #13's enforcement note]`|

### Multi-committee referral steps (SP Secretary, SP Member)

#### `workflow.submitCommitteeReport`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid(), committeeId: z.string().uuid(), reportText: z.string().min(1), reportAttachmentS3Key: z.string().uuid().optional() })`|
|Output|`z.object({ allCommitteesSubmitted: z.boolean() })` — tells the frontend whether this submission completed the step or whether other committees are still pending|
|Callable by|`sp_secretary`, `sp_member` (committee-scoped)|
|ABAC conditions|`step.step_type = 'multi_referral'`, `step.status = 'pending'`. For `sp_member`: `subject.committee_ids ∩ step.metadata.assigned_committee_ids ≠ ∅`.|
|Business operation|Records this committee's contribution toward the unified report. **All assigned committees must sign/contribute before the step completes** — the resolver checks whether every committee in `step.metadata.assigned_committee_ids` now has a submitted contribution; if so, the step transitions to `completed`; if not, the step remains `pending`, and committees that have _not_ yet submitted are surfaced as red-flagged in the Order of Business view. `[Confirmed — I1 §6.6 in full; consolidated reference Part 8.3, Q-A02; B2 Module 4 multi_referral behavior note]`|

#### `workflow.manuallyAdvanceMultiReferralStep`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid(), mandatoryComment: z.string().min(1) })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`step.step_type = 'multi_referral'`. `mandatoryComment` must be non-empty. No other role may call this.|
|Business operation|Forces the step to `completed` despite one or more committees not having submitted. Emits `workflow.manually_advanced` with `mandatoryComment`, `fromStep`, `toStep` → Audit. The absent/non-reporting committees remain visually red-flagged in the Order of Business even after the override. `[Confirmed — I1 §6.7 in full; consolidated reference Part 8.3 Q-A02 decisions 1–2]`|

### SP Presiding Officer certification step

#### `workflow.certifyAsPresidingOfficer`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_presiding_officer`|
|ABAC conditions|`step.step_type = 'approval'`, `step.name = 'vp_certification'`, and (`step.assignee_user_id = subject.user_id` **OR** the subject holds an active delegation granting `sp_presiding_officer` scope).|
|Business operation|Records the Vice Mayor's certified-copy signature step. `[Confirmed — I1 §6.4 in full]`|

### Mayor's review step (sign / veto / lapse)

#### `workflow.mayorSign` / `workflow.mayorVeto`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid(), objectionsText: z.string().optional() })` — `objectionsText` required (`.min(1)`) for `mayorVeto` only|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`mayor`|
|ABAC conditions|`step.step_type = 'approval'`, `step.name IN ('mayor_review','mayor_signature')`, direct assignee match **or** an active delegation granting Mayor role authority (e.g. the Vice Mayor serving as Acting Mayor).|
|Business operation|For `mayorSign`: records the signature, advances toward Docketing. For `mayorVeto`: records the objections, routes to the SP veto-override path (2/3 = 8 of 12). `[Confirmed — I1 §6.5 in full; consolidated reference Part 4.1, Part 4.2]`|

#### `workflow.logMayorLapseConfirmation`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S47') })`|
|Callable by|`sp_secretary`|
|ABAC conditions|None beyond role gate — this confirms a system-computed fact (the 10-day timer has already fired) rather than exercising independent discretion.|
|Business operation|The 10-day timer is system-triggered (pgboss); this procedure is the manual confirmation step the Secretary performs on notification. Emits `workflow.lapsed` with `legalBasis: 'RA7160_S47'` if not already emitted by the automatic job — implemented idempotently. `[Confirmed — I2 Section 6 "Log 10-day Mayor lapse (system-triggered; manual confirmation)"; B2 Module 4 lapse event]`|

#### `workflow.recordVetoOverrideVote`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid(), votesFor: z.number().int().min(0).max(12), votesAgainst: z.number().int().min(0).max(12), absentCouncilorIds: z.array(z.string().uuid()) })`|
|Output|`z.object({ overrideSucceeded: z.boolean() })` — `true` when `votesFor >= 8`|
|Callable by|`sp_secretary`|
|ABAC conditions|None beyond role gate.|
|Business operation|Records the override vote tally against the confirmed 2/3 (8-of-12) threshold. `[Confirmed — I2 Section 6 "Record veto override vote"; consolidated reference Part 3.2]`|

### Docketing, numbering finalization, and post-Mayor steps (SP Secretary)

#### `documents.assignFinalNumber` (cross-listed; full detail repeated here, also relevant to Section 4's numbering flow)

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|`z.object({ finalNumber: z.string(), assignedAt: z.coerce.date() })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`. Current workflow step must be `'second_reading_vote_completed'` (for `SP_RESOLUTION`) or `'third_reading_vote_completed'` (for `SP_ORDINANCE`/`SP_APPROPRIATION_ORDINANCE`). `document.preliminary_number IS NOT NULL AND document.final_number IS NULL`.|
|Business operation|Calls `Documents.assignFinalNumber()` (B2 Published API). This is the one call site where the **Workflow module is the actual caller in production**; this tRPC procedure exists as the equivalent manually-triggerable form for the case where the SP Secretary needs to fire it from a `/web` screen directly. Once `final_number` is set, it is immutable — enforced at the DB layer. `[Confirmed — I1 §3.8 in full; B2 Module 3 "assignFinalNumber" Published API method and Module 4's documented Workflow→Documents call; C1 §4.5.1]`|

#### `workflow.logDocketingCompletion`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary`|
|ABAC conditions|None beyond role gate.|
|Business operation|Marks the Docketing step complete — the document is already signed and already has its final number at this point. `[Confirmed — I2 Section 6 "Log docketing step completion"]`|

#### `workflow.recordPanlalawiganOutcome`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid(), outcome: z.enum(['valid','valid_in_part','returned','operative_in_its_entirety']), controlNumber: z.string().optional(), panlalawiganResolutionNumber: z.string().optional(), dateReferred: z.coerce.date().optional(), remarks: z.string().optional() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary`|
|ABAC conditions|`step.name = 'panlalawigan_review'`, `step.status = 'pending'`.|
|Business operation|Writes `documents.panlalawigan_reviews`. For `outcome = 'returned'`: marks the step high-priority and routes to a Secretariat-decided path. For `outcome = 'valid_in_part'`: places the step in "Awaiting SP Secretariat Action" pending the Secretary's choice, captured separately by `workflow.resolveValidInPart` below. `[Confirmed — I1 §6.9 in full; consolidated reference Part 4.3 outcome handling; C1 §4.10]`|

#### `workflow.resolveValidInPart`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid(), resolutionPath: z.enum(['resolve_as_is','route_to_legal','route_to_committee','implement_directly']), mandatoryComment: z.string().min(1) })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary`|
|ABAC conditions|The parent document's `panlalawigan_reviews.outcome = 'valid_in_part'`.|
|Business operation|Records the Secretariat's chosen path among the four options; all four are audit-logged. `[Confirmed — consolidated reference Part 4.3 "VALID-IN-PART handling", four numbered options]`|

#### `workflow.confirmPanlalawiganDeemedApproved`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ stepInstanceId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true), legalBasis: z.literal('RA7160_S56D') })`|
|Callable by|`sp_secretary`|
|ABAC conditions|`step.name = 'panlalawigan_review'`, `step.status = 'pending'`, and the system-computed 30-day window has elapsed with no Panlalawigan response.|
|Business operation|System transitions automatically at day 30; this procedure is the Secretary's manual confirmation, mirroring `workflow.logMayorLapseConfirmation`'s pattern. Writes Remarks = "Lapsed 30 days." `[Confirmed — I1 §6.9; consolidated reference Part 4.3 "30-day timer" system behavior]`|

#### `workflow.recordNewspaperPublicationDate`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid(), publicationDate: z.coerce.date(), newspaperName: z.string().default('Ilocos Times') })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary`|
|ABAC conditions|The document is `SP_ORDINANCE` or `SP_APPROPRIATION_ORDINANCE` and its type metadata indicates a penalty provision (only penalty ordinances require this field).|
|Business operation|Writes the mandatory tracked publication date into `documents.documents.metadata`. `[Confirmed — I2 Section 6 "Record newspaper publication date"; consolidated reference Q-C04; C1 §4.1]`|

### Certification of Urgency logging (SP Secretary)

#### `documents.logCertificationOfUrgency`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ certifyingDocumentId: z.string().uuid(), associatedMeasureIds: z.array(z.string().uuid()).min(1) })` — a single Certification can cover multiple measures|
|Output|`z.object({ certificationDocumentId: z.string().uuid(), affectedDocumentIds: z.array(z.string().uuid()) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`certifyingDocument.document_type_code = 'CERTIFICATION_OF_URGENCY'`. Every ID in `associatedMeasureIds` must reference a document of type `SP_RESOLUTION`, `SP_ORDINANCE`, or `SP_APPROPRIATION_ORDINANCE` whose `lifecycle_state = 'in_workflow'` **and** whose current workflow step is `'committee_referral_pending'` — if any referenced measure fails this check, the entire mutation is rejected, not partially applied.|
|Business operation|Inserts the Certification's row (already created via `documents.create`/`submit` prior to this call) and, for each associated measure, triggers the workflow bypass, emitting `workflow.certified_urgent_applied`. The Certification has no standalone number. `[Confirmed — I1 §3.9 in full; B2 Module 4 "certified_urgent_applied" event; consolidated reference Part 4.17]`|

### Secretariat decision logging (SP Secretary)

#### `documents.logSecretariatDecision`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid(), decision: z.enum(['approve','reject','amended']), remarks: z.string().optional() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`step.step_type IN ('action','approval')`, `step.assignee_office_id = SP_SECRETARIAT_OFFICE_ID`.|
|Business operation|Calls `documentService.recordDecision()` internally, which writes the decision and emits `document.secretariat_decision`. The **Workflow** module's event consumer then advances the step asynchronously via the event bus, not a direct synchronous call. `[Confirmed — I1 §6.8 in full; B2 Module 3 "Note on Secretariat Decision Flow" and event table]`|

### Designation/delegation logging (SP Secretary; affects step routing)

#### `organization.createDesignationGrant`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ designationDocumentId: z.string().uuid(), delegatingEmployeeId: z.string().uuid(), delegatedToEmployeeId: z.string().uuid(), officeId: z.string().uuid(), positionId: z.string().uuid(), scopeDescription: z.string().min(1), legalBasis: z.string().nullish(), validFrom: z.coerce.date(), validUntil: z.coerce.date() })` — `validUntil` is **required**, not optional, per the open-ended-delegation prohibition|
|Output|`z.object({ delegationId: z.string().uuid() })`|
|Callable by|`sp_secretary` only (the Secretary _logs_ the grant issued by the Mayor or Vice Mayor; neither of those two roles calls this procedure directly)|
|ABAC conditions|The grant's `delegatingEmployeeId` must resolve to the Mayor (executive scope) or Vice Mayor (legislative scope) — validated against `organization.assignments` for that employee's current position, not against the calling subject's own identity. **Invariant #16** is enforced here: `INSERT` is rejected with `CONFLICT` if `organization.delegation_grants` already has an active row for `delegated_to_employee_id`. No Platform Admin confirmation step exists — the grant is effective immediately on successful insert.|
|Business operation|Inserts `organization.delegation_grants`. Emits `delegation.granted` → consumed by **Workflow** (immediate step re-routing) and **Audit**. `[Confirmed — I2 Conditional Note ³; I1 §11.1; I1 §15 Invariant #16; consolidated reference Part 4.12, Part 11.13]`|

#### `organization.revokeDesignationGrantEarly`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ delegationId: z.string().uuid(), writtenInstructionReference: z.string().min(1).optional() })` — required when the caller is `sp_secretary` rather than the original delegating authority|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary`, `sp_presiding_officer`, `mayor`|
|ABAC conditions|`sp_presiding_officer` and `mayor` may revoke only a grant where `subject.user_id` (resolved to their employee record) matches `grant.delegating_employee_id` — i.e., only their own issued grant. `sp_secretary` may revoke **any** grant only if `writtenInstructionReference` is supplied and non-empty — an open-ended revocation with no documented instruction is rejected.|
|Business operation|Sets `organization.delegation_grants.is_active = false`, `revoked_at`, `revoked_by`. Emits `delegation.revoked` → Workflow (re-routes affected steps back to original authority), Audit. `[Confirmed — I2 Conditional Note ⁴; I1 §11.2]`|

[Inference] These two designation procedures are placed here rather than under Platform Administrator views (Section 9) because the prior curation document already established that designation logging is explicitly _not_ a Platform Administrator action — it's an SP-Secretary/Mayor/Presiding-Officer action that happens to affect workflow step routing immediately, which is why it's grouped with workflow actions rather than admin config.

### Document/records-management actions reachable from a workflow step (Records Officer, SP Secretary)

#### `documents.archive`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`records_officer`, `sp_secretary`|
|ABAC conditions|`lifecycle_state IN ('completed','released')`. For `sp_secretary`: additionally `document.owned_by_office_id = SP_SECRETARIAT_OFFICE_ID`.|
|Business operation|Calls `Documents.transitionState(documentId, 'archived', actorId)`. `[Confirmed — I1 §3.10 in full]`|

#### `documents.cancel`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid(), reason: z.string().min(1) })` — mandatory reason|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_captain` unconditionally; `dept_encoder`, `brgy_encoder` conditionally|
|ABAC conditions|`lifecycle_state NOT IN ('archived','disposed','cancelled')`. For `dept_encoder`/`brgy_encoder`: additionally `lifecycle_state IN ('draft','submitted')` **and** `workflow_instance_id IS NULL`.|
|Business operation|Calls `Documents.transitionState(documentId, 'cancelled', actorId, reason)`. Every cancellation is audit-logged with the mandatory reason. `[Confirmed — I1 §3.6 in full]`|

#### `documents.flagScannedBackForVerification`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ versionId: z.string().uuid(), notes: z.string().optional() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`records_officer`|
|ABAC conditions|None beyond role gate.|
|Business operation|Marks a re-scanned-after-wet-ink-signature version as pending manual verification. `[Confirmed — I2 Section 9 "Flag scanned-back document for manual verification"]`|

#### `documents.acceptScannedBackAsOfficial`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ versionId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`records_officer`, `sp_secretary`|
|ABAC conditions|None beyond role gate.|
|Business operation|Confirms the scanned-back version as the official digital copy after manual review. `[Confirmed — I2 Section 9 "Accept scanned-back signed document as official copy"]`|

#### `workflow.migrateInstanceToNewDefinitionVersion`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ instanceId: z.string().uuid(), newDefinitionVersionId: z.string().uuid(), mandatoryReason: z.string().min(1), secondLevelApproverUserId: z.string().uuid() })`|
|Output|`z.object({ migrationId: z.string().uuid(), reversibleUntil: z.coerce.date() })` — 24-hour reversible window|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`. This is explicitly allowed despite Gate 3's general Platform Admin operational exclusion, since `workflow_instance:migrate` is on the Tier 2 allowed-action list.|
|Business operation|Implements Option B: requires second-level City Administrator approval, opens a 24-hour reversible window, and emits a dedicated audit event distinct from ordinary `workflow.*` events. `[Confirmed — I1 §5.2 in full; consolidated reference Part 11.3 "Version pinning"]`|

[Inference] This last procedure is cross-relevant to Platform Administrator views (Section 9) too, since it's `plat_admin`-only — included here under Workflow Step Action Views because it acts directly on a specific workflow instance (a workflow-action-shaped operation), and also listed in Section 9 in full per the "every relevant view" rule.

---

## 6. Session Attendance Tracking

### `session.recordAttendance`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ sessionDate: z.coerce.date(), absences: z.array(z.object({ councilorEmployeeId: z.string().uuid(), reason: z.enum(['official_business','sick_leave','vacation_leave','absent_unqualified']) })) })`|
|Output|`z.object({ success: z.literal(true), presentCount: z.number().int(), absentCount: z.number().int(), quorumMet: z.boolean() })` — quorum met when `presentCount >= 7`|
|Callable by|`sp_secretary` only|
|ABAC conditions|None beyond role gate.|
|Business operation|Recorded **before** the session. Computes quorum against the confirmed 7-of-12 threshold. `[Confirmed — I2 Section 8 "Record session attendance"; consolidated reference Part 7.3, Part 3.2]`|

### `session.getAttendanceRecord`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ sessionDate: z.coerce.date() })`|
|Output|`z.object({ sessionDate: z.coerce.date(), presentCouncilors: z.array(z.string().uuid()), absences: z.array(z.object({ councilorEmployeeId: z.string().uuid(), councilorDisplayName: z.string(), reason: z.string() })), quorumMet: z.boolean() })`|
|Callable by|`sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor`|
|ABAC conditions|None beyond role gate.|
|Business operation|Reads the attendance record. `[Confirmed — I2 Section 8 "View session attendance record"]`|

### `session.getAttendanceStatistics`

|||
|---|---|
|Type|`query`|
|Input|`dateRangeInput`|
|Output|`z.object({ series: z.array(z.object({ sessionDate: z.coerce.date(), presentCount: z.number().int(), absentCount: z.number().int() })), printableSummaryUrl: z.string().url().nullable() })`|
|Callable by|`sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor`|
|ABAC conditions|None beyond role gate.|
|Business operation|Backs the confirmed "count of present/absent councilors; graph of attendee numbers over time; printable summary" requirement, new functionality being added to a "counts only" current state. `[Confirmed — I2 Section 8 "View attendance statistics and graphs"; consolidated reference Part 7.3]`|

---

## 7. Mayor Dashboard

[Inference] The source file ties only `workflow.listMyAssignedSteps` and `workflow.getSlaComplianceData` (both already fully detailed in Section 2) explicitly to dashboard framing, and both list `mayor` in their Callable-by sets. The Mayor's actual signature/veto actions live in Section 5 (`workflow.mayorSign`/`mayorVeto`), since those are step actions, not dashboard reads — but a dashboard would need to surface _that_ such steps are pending, which is exactly what `listMyAssignedSteps` provides. The dashboard read-query layer and the action layer are therefore split across Sections 2/7 and Section 5 respectively; this split mirrors the source's own separation of "query" (read, list/dashboard-shaped) from "mutation" (the actual sign/veto/etc. action).

### `workflow.listMyAssignedSteps` (full detail repeated; see Section 2 for first occurrence)

|||
|---|---|
|Type|`query`|
|Input|`paginationInput`|
|Output|`z.object({ items: z.array(z.object({ stepInstanceId: z.string().uuid(), instanceId: z.string().uuid(), documentId: z.string().uuid(), documentTitle: z.string(), stepType: z.enum(['action','approval','multi_referral','decision','notification','termination']), assignedAt: z.coerce.date(), dueAt: z.coerce.date().nullable() })), nextCursor: z.string().nullable() })`|
|Callable by|`records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`|
|ABAC conditions|`step.assignee_user_id = subject.user_id` **OR** office-scoped queue membership per the role.|
|Business operation|Reads `workflow.step_instances WHERE status = 'pending'` filtered by assignee/office — for the Mayor, this surfaces "pending signatures, overdue items" exactly as the consolidated requirements file's Mayor dashboard description specifies. `[Confirmed — I1 §6.1; I2 Section 16 "View own task inbox / assigned steps"]`|

### `workflow.getSlaComplianceData` (full detail repeated; see Section 2 for first occurrence)

|||
|---|---|
|Type|`query`|
|Input|`z.object({ officeId: z.string().uuid().optional(), documentTypeId: z.string().uuid().optional(), breachedOnly: z.boolean().default(false), ...dateRangeInput.shape })`|
|Output|`z.array(z.object({ instanceId: z.string().uuid(), documentId: z.string().uuid(), slaClassification: z.enum(['simple','complex','highly_technical']), slaThresholdDays: z.number().int(), elapsedWorkingDays: z.number().int(), isBreached: z.boolean(), breachedAt: z.coerce.date().nullable() }))`|
|Callable by|`records_officer`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `auditor`|
|ABAC conditions|None beyond role gate.|
|Business operation|The "overdue items" half of the Mayor dashboard — items where `isBreached = true` surface the overdue signal directly. `[Confirmed — B2 Module 4 Published API "getWorkflowSLAData"; I2 Section 16 "View ARTA SLA compliance report"]`|

### `workflow.mayorSign` / `workflow.mayorVeto` (cross-listed; full detail in Section 5)

[Inference] The actual sign/veto actions a Mayor dashboard would link out to. Full detail already shown in Section 5's "Mayor's review step" subsection; not re-duplicated a third time here since this section's purpose is the dashboard's _read_ layer specifically, and the action procedures are already fully present twice (definition + Section 5) elsewhere in this document.

---

## 8. Audit Log Viewer

### `audit.listOwnActions`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput.extend({ ...dateRangeInput.shape })`|
|Output|`z.object({ items: z.array(auditEventOutput), nextCursor: z.string().nullable() })` where `auditEventOutput = z.object({ auditEventId: z.string().uuid(), eventType: z.string(), actorId: z.string().uuid(), targetId: z.string().uuid().nullable(), targetType: z.string().nullable(), occurredAt: z.coerce.date(), payload: z.record(z.unknown()) })`|
|Callable by|`records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor`|
|ABAC conditions|`audit_event.actor_id = subject.user_id`.|
|Business operation|Calls `Audit.queryEvents({ actorId: subject.user_id, ... })` (B2 Published API). `[Confirmed — I1 §8.2 in full]`|

### `audit.listOwnOfficeDocumentActions`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput.extend({ officeId: z.string().uuid().optional(), ...dateRangeInput.shape })`|
|Output|Same as `audit.listOwnActions`|
|Callable by|`records_officer`, `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_captain`, `auditor`|
|ABAC conditions|`audit_event.resource_office_id ∈ subject.effective_office_ids` — using the denormalized, write-time-populated column, never a live join back to the resource's _current_ owning office.|
|Business operation|Calls `Audit.queryEvents({ resourceOfficeId: ..., ... })`. `[Confirmed — I1 §8.3 in full, including the D-ABAC-04 denormalization rationale]`|

### `audit.listFullLog`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput.extend({ actorId: z.string().uuid().optional(), eventTypes: z.array(z.string()).optional(), ...dateRangeInput.shape })`|
|Output|`z.object({ items: z.array(auditEventOutput), nextCursor: z.string().nullable(), chainValidationStatus: z.enum(['intact','broken']) })`|
|Callable by|`auditor` only|
|ABAC conditions|None beyond role gate — but the _implementation_ routes through a dedicated audit-reader database role (`audit_user`/equivalent reader, distinct from `app_user`), enforced at the PostgreSQL level.|
|Business operation|Calls `Audit.queryEvents()` unfiltered by actor/office, returning `chainValidationStatus` per batch. `[Confirmed — I1 §8.4 in full]`|

### `audit.validateChainIntegrity`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ fromEventId: z.string().uuid().optional() })`|
|Output|`z.object({ status: z.enum(['intact','broken']), brokenAtEventId: z.string().uuid().nullable() })`|
|Callable by|`sys_admin`, `auditor`|
|ABAC conditions|None beyond role gate.|
|Business operation|Walks the SHA-256 hash chain on `audit.events.chain_hash`, flagging the first broken link as a tamper indicator. `[Confirmed — I1 §8.5 in full; tech-stack Audit Log Integrity]`|

### `audit.exportEvents`

|||
|---|---|
|Type|`mutation` — a mutation because the export itself produces a new audit record, so it is not a side-effect-free read `[Inference]`|
|Input|`z.object({ eventTypes: z.array(z.string()).optional(), ...dateRangeInput.shape })`|
|Output|`z.object({ exportPresignedUrl: z.string().url() })`|
|Callable by|`auditor` only|
|ABAC conditions|Export is bounded by the auditor's classification clearance — events referencing Confidential/Restricted documents are excluded unless the auditor is on that type's explicit allowlist.|
|Business operation|Generates the export file and writes the export-action audit record itself. `[Confirmed — I1 §8.6 in full; I2 Conditional Note ¹⁶]`|

[Inference] As with the permission-matrix curation, this confirms (now at the procedure level, not just the permission level) that the audit log viewer is at minimum a two-or-more-route family: a scoped "my actions"/"my office" view widely available, and a full-log view restricted to `auditor` plus a narrower `sys_admin`/`auditor` chain-validation view.

---

## 9. Platform Administrator Views

### IAM administration

#### `iam.createUserAccount`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ username: z.string().min(3).max(64), email: z.string().email(), employeeId: z.string().uuid() })`|
|Output|`userSummaryOutput`|
|Callable by|`sys_admin` only|
|ABAC conditions|`subject.is_ita = true`.|
|Business operation|Inserts `iam.users` row, links to an existing `organization.employees` row. Does not assign a role — role assignment is a separate Platform Admin action below. `[Confirmed — I2 Section 1 "Create user accounts", ✅ only for Sys Admin]`|

[Unverified] This procedure is `sys_admin`-only, not `plat_admin` — included here because it's adjacent to the account/role administration cluster Platform Administrator views would also surface, but flagging the role distinction explicitly so it isn't conflated with the `plat_admin`-only procedures immediately below, exactly as the permission-matrix curation flagged the same System-Administrator-vs-Platform-Administrator distinction at the permission-row level.

#### `iam.editUserAccount`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ userId: z.string().uuid(), email: z.string().email().optional(), officeId: z.string().uuid().optional() })`|
|Output|`userSummaryOutput`|
|Callable by|`sys_admin`, `plat_admin`|
|ABAC conditions|None beyond role gate and Global Gate 3 (Platform Admin Operational Exclusion does **not** block this — `manage_roles`-adjacent account editing is on the Tier 2 allowed-action list).|
|Business operation|Updates `iam.users` non-credential fields. `[Confirmed — I2 Section 1 "Edit user accounts", ✅ for Sys Admin and Plat Admin]`|

#### `iam.deactivateUserAccount` / `iam.reactivateUserAccount`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ userId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true), newStatus: z.enum(['active', 'deactivated']) })`|
|Callable by|`sys_admin`, `plat_admin`|
|ABAC conditions|None beyond role gate.|
|Business operation|Sets `iam.users.status` to `'deactivated'` or back to `'active'`. Does not soft-delete the row. `[Confirmed — I2 Section 1 "Deactivate / reactivate user accounts"]`|

#### `iam.assignRole`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ userId: z.string().uuid(), roleCode: roleCodeEnum, officeScopeId: z.string().uuid().nullish() })`|
|Output|`z.object({ roleAssignmentId: z.string().uuid() })`|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`. **Invariant #12 enforced here at insert time**: if the target user already holds any role where `iam.roles.type_code = 'document_processor'` and the incoming role is `plat_admin` (or vice versa), the insert is rejected with `FORBIDDEN` / `"platform_admin_combination_prohibited"`.|
|Business operation|Inserts `iam.role_assignments`, respecting the partial unique index (one active role-per-office at a time). Emits `role.assigned` → Audit. `[Confirmed — I2 Section 1 "Assign roles to users", ✅ only Plat Admin; I1 §15 Invariant #12]`|

#### `iam.revokeRole`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ roleAssignmentId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`.|
|Business operation|Sets `iam.role_assignments.is_active = false`, `revoked_at`, `revoked_by`. Emits `role.revoked` → Audit. `[Confirmed — I2 Section 1 "Revoke roles from users"]`|

#### `iam.listUserDirectory`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput.extend({ officeId: z.string().uuid().optional(), search: z.string().max(200).optional() })`|
|Output|`z.object({ items: z.array(z.object({ userId: z.string().uuid(), displayName: z.string(), officeId: z.string().uuid().nullable(), officeName: z.string().nullable(), positionTitle: z.string().nullable(), roleCodes: z.array(roleCodeEnum) })), nextCursor: z.string().nullable() })`|
|Callable by|`sys_admin`, `plat_admin`, `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor`|
|ABAC conditions|For `dept_encoder`, `dept_approver`, `sp_member`: output is limited to name/office/position only — `lastLoginAt`/credential-status fields are never included in the output schema for this procedure at all.|
|Business operation|Reads `iam.users` joined to `organization.employees`/`assignments`/`role_assignments`. `[Confirmed — I2 Section 1 "View user directory", with 🔶¹ for the three limited-view roles]`|

#### `iam.listAllActiveSessions`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput`|
|Output|`z.object({ items: z.array(z.object({ sessionId: z.string().uuid(), userId: z.string().uuid(), userDisplayName: z.string(), ipAddress: z.string().nullable(), createdAt: z.coerce.date(), expiresAt: z.coerce.date() })), nextCursor: z.string().nullable() })`|
|Callable by|`sys_admin` only|
|ABAC conditions|`subject.is_ita = true` — System Administrator scope, not Platform Administrator.|
|Business operation|Reads all rows of `iam.sessions`. `[Confirmed — I2 Section 1 "View active sessions (all users)", ✅ only for Sys Admin]`|

#### `iam.forceTerminateSession`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ sessionId: z.string().uuid(), reason: z.string().min(1) })` — reason is mandatory|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sys_admin` only|
|ABAC conditions|`subject.is_ita = true`. `mandatory_reason` field must be non-empty.|
|Business operation|Sets `iam.sessions.terminated_at`, `terminated_by`, `termination_reason = 'forced'`. Emits `session.terminated` with `reason: 'forced'` → consumed by Audit. `[Confirmed — I1 §12.3 "session:force_terminate"; I2 Section 1; B2 Module 1 Events Emitted]`|

### Organization structure administration (Platform Administrator only)

#### `organization.createOffice` / `organization.updateOffice`

|||
|---|---|
|Type|`mutation`|
|Input (create)|`z.object({ name: z.string().min(1), code: z.string().min(1).max(32), officeType: z.enum(['sp_office','mayors_office','city_department','barangay','other']), parentOfficeId: z.string().uuid().nullish() })`|
|Input (update)|`z.object({ officeId: z.string().uuid() }).merge(createInput.partial())`|
|Output|`officeSummaryOutput`|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`.|
|Business operation|Inserts/updates `organization.offices`, respecting `ck_offices_not_self_parent`. `[Confirmed — I2 Section 2 "Create / edit office records", ✅ only Plat Admin]`|

#### `organization.deactivateOffice`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ officeId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`.|
|Business operation|Soft-deletes `organization.offices` row — Invariant #2 forbids hard delete even for admin-managed config tables. `[Confirmed — I2 Section 2 "Deactivate office records"; C1 §1.5]`|

#### `organization.createPosition` / `organization.updatePosition`

|||
|---|---|
|Type|`mutation`|
|Input (create)|`z.object({ officeId: z.string().uuid(), title: z.string().min(1), code: z.string().min(1).max(32), authorityLevel: z.enum(['executive','managerial','staff','support']) })`|
|Output|`z.object({ positionId: z.string().uuid(), title: z.string() })`|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`.|
|Business operation|Inserts/updates `organization.positions`. `[Confirmed — I2 Section 2 "Create / edit position records"]`|

#### `organization.createEmployee` / `organization.updateEmployee`

|||
|---|---|
|Type|`mutation`|
|Input (create)|`z.object({ userId: z.string().uuid().nullish(), firstName: z.string().min(1), lastName: z.string().min(1), email: z.string().email().nullish(), phoneNumber: z.string().nullish(), employeeNumber: z.string().nullish() })`|
|Output|`z.object({ employeeId: z.string().uuid() })`|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`.|
|Business operation|Inserts/updates `organization.employees`. `userId` is nullable — Barangay officials with no system access are created here without a corresponding `iam.users` row. `[Confirmed — I2 Section 2 "Create / edit employee records"; C1 §3.4; consolidated reference Part 4.4]`|

#### `organization.assignEmployeeToPosition`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ employeeId: z.string().uuid(), positionId: z.string().uuid(), officeId: z.string().uuid(), startDate: z.coerce.date(), endDate: z.coerce.date().nullish() })`|
|Output|`z.object({ assignmentId: z.string().uuid() })`|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`.|
|Business operation|Inserts `organization.assignments`. Application-layer check enforces "exactly one active holder" for singular positions (Mayor, Vice Mayor, SP Secretary) but not for plural ones (Councilor). `[Confirmed — I2 Section 2 "Assign employees to offices and positions"; C1 §3.5]`|

#### `organization.createCommittee` / `organization.updateCommittee`

|||
|---|---|
|Type|`mutation`|
|Input (create)|`z.object({ name: z.string().min(1), code: z.string().min(1).max(32), chairedByEmployeeId: z.string().uuid().nullish() })`|
|Output|`z.object({ committeeId: z.string().uuid() })`|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`.|
|Business operation|Inserts/updates `organization.committees`. `[Confirmed — I2 Section 3 "Create / edit standing committee definitions"]`|

#### `organization.assignCommitteeMembership`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ committeeId: z.string().uuid(), employeeId: z.string().uuid(), committeeRole: z.enum(['chairman','vice_chairman','member']), startDate: z.coerce.date() })`|
|Output|`z.object({ membershipId: z.string().uuid() })`|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`.|
|Business operation|Inserts `organization.committee_memberships`, respecting the active-one-role-per-person-per-committee constraint. This is the write path that populates the `subject.committee_ids` JWT claim at the affected user's next token refresh. `[Confirmed — I2 Section 3 "Create / edit standing committee definitions" (committees are config, memberships are the operational join); I1 §1 D-ABAC-06; C1 §3.8]`|

#### `organization.getOfficeHierarchy`

|||
|---|---|
|Type|`query`|
|Input|`z.void()`|
|Output|`z.object({ offices: z.array(officeSummaryOutput) })`|
|Callable by|`sys_admin`, `plat_admin`, `records_officer`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `auditor` (full tree); `dept_encoder`, `dept_approver` (read-only reference)|
|ABAC conditions|None — the office tree itself is not classification-gated; only document content is.|
|Business operation|Calls `Organization.getOfficeHierarchy()` directly (B2 Published API). `[Confirmed — I2 Section 2 "View organization chart", ✅/🔶² split; B2 Module 2]`|

[Inference] This last query is cross-relevant to nearly every view (it's broadly readable), but is placed here as a Platform Administrator view specifically because the _editing_ counterparts above are all Platform-Admin-exclusive and would naturally sit on the same admin screen as a read-only reference.

#### `organization.getActiveDesignations` / `organization.getDesignationHistory`

|||
|---|---|
|Type|`query`|
|Input (active)|`z.void()`|
|Input (history)|`paginationInput.extend({ employeeId: z.string().uuid().optional() })`|
|Output (active)|`z.array(z.object({ delegationId: z.string().uuid(), designationDocumentId: z.string().uuid(), delegatingUserId: z.string().uuid(), delegatingDisplayName: z.string(), delegatedToUserId: z.string().uuid(), delegatedToDisplayName: z.string(), officeId: z.string().uuid(), positionTitle: z.string(), validFrom: z.coerce.date(), validUntil: z.coerce.date() }))`|
|Output (history)|`z.object({ items: z.array(z.object({ delegationId: z.string().uuid(), designationDocumentId: z.string().uuid(), delegatingDisplayName: z.string(), delegatedToDisplayName: z.string(), positionTitle: z.string(), validFrom: z.coerce.date(), validUntil: z.coerce.date(), isActive: z.boolean(), revokedAt: z.coerce.date().nullable() })), nextCursor: z.string().nullable() })`|
|Callable by|`sys_admin`, `plat_admin`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `auditor`|
|ABAC conditions|None beyond role gate — designation visibility is not office-scoped per I2 (all listed roles see all active designations).|
|Business operation|Reads `organization.delegation_grants` (active rows for the first; including inactive/expired/revoked for the history variant). `[Confirmed — I2 Section 2 "View active designations" / "View designation history"]`|

### Records/retention administration (Platform Administrator + Records Officer)

#### `records.getRetentionSchedule`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ documentTypeId: z.string().uuid() })`|
|Output|`z.object({ scheduleId: z.string().uuid(), documentTypeId: z.string().uuid(), retentionPeriod: z.union([z.literal('Permanent'), z.number().int()]), legalBasis: z.string(), configuredBy: z.string().uuid() }).nullable()`|
|Callable by|`plat_admin`, `records_officer`, `sp_secretary`, `auditor`|
|ABAC conditions|None beyond role gate.|
|Business operation|Calls `Records.getRetentionSchedule()` (B2 Published API). `[Confirmed — I2 Section 3 "View retention schedules list"; B2 Module 6 Published API]`|

### Notifications administration (Sys Admin + Platform Administrator)

#### `notifications.listDeliveryLogs`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput.extend({ ...dateRangeInput.shape })`|
|Output|`z.object({ items: z.array(z.object({ deliveryLogId: z.string().uuid(), recipientUserId: z.string().uuid().nullable(), recipientEmail: z.string().nullable(), channel: z.string(), status: z.string(), sentAt: z.coerce.date() })), nextCursor: z.string().nullable() })`|
|Callable by|`sys_admin`, `plat_admin`|
|ABAC conditions|None beyond role gate.|
|Business operation|Reads `notifications.delivery_log` in full — the only procedure in the Notifications router with cross-recipient visibility. `[Confirmed — I2 Section 11 "View delivery logs (all notifications)", ✅ only Sys Admin and Plat Admin]`|

### Public portal administration (Platform Administrator + SP Secretary)

#### `documents.publishToPortal` / `documents.unpublishFromPortal` (cross-listed; full detail also relevant to Section 10)

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`, `lifecycle_state IN ('released','archived')`, and either `classification_level = 'public'` or (`classification_level = 'internal'` AND the document type's `public_visibility_rule = 'title_and_first_page_public'`).|
|Business operation|Flips the document's portal-visibility flag. `[Confirmed — I1 §3.11 in full; I2 Section 14 "Publish / unpublish document to public portal"]`|

[Unverified] Note this procedure is `sp_secretary`-only per source, not `plat_admin` — included in this section because publishing/unpublishing is an admin-flavored action a Platform Administrator screen might reasonably surface for oversight, but the actual callable role is the Secretary, not the Platform Administrator. Flagged rather than silently corrected, since silently moving it would misrepresent source.

### Workflow instance migration (Platform Administrator; cross-listed from Section 5)

#### `workflow.migrateInstanceToNewDefinitionVersion` (full detail repeated; see Section 5 for first occurrence)

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ instanceId: z.string().uuid(), newDefinitionVersionId: z.string().uuid(), mandatoryReason: z.string().min(1), secondLevelApproverUserId: z.string().uuid() })`|
|Output|`z.object({ migrationId: z.string().uuid(), reversibleUntil: z.coerce.date() })` — 24-hour reversible window|
|Callable by|`plat_admin` only|
|ABAC conditions|`subject.is_pa = true`. This is explicitly allowed despite Gate 3's general Platform Admin operational exclusion, since `workflow_instance:migrate` is on the Tier 2 allowed-action list.|
|Business operation|Implements Option B: requires second-level City Administrator approval, opens a 24-hour reversible window, and emits a dedicated audit event distinct from ordinary `workflow.*` events. `[Confirmed — I1 §5.2 in full; consolidated reference Part 11.3 "Version pinning"]`|

---

## 10. Phase 1 Public Portal Subset

[Unverified] **This is the most important structural finding from this source file for F1.** Per the source's own explicit "Note on Scope": **none of the citizen-self-service procedures are tRPC at all.** They are unauthenticated or citizen-session REST endpoints served by the `portal` module and public REST layer, explicitly _not_ covered by this catalog. This means F1's "primary data dependencies (which tRPC procedures it calls)" field is, for true public-portal routes, correctly answered as "none — REST, not tRPC" rather than left blank or guessed at.

_Source: "What Is Out of Scope" (full, the load-bearing passage for this entire section)_

> - **Citizen self-service procedures** (complaint submission, document request submission, public tracking lookup, public document browsing). These are unauthenticated or citizen-session REST endpoints served by the `portal` module (Phase 3) and the public REST layer described in B2 Module 10 and I1 Sections 10.1/10.4/13.1. tRPC is explicitly not used for these per the stack decision.

What this catalog _does_ contain for the public portal subset is the small set of **internal-actor** procedures that prepare content for, or interact with, the portal from the authenticated `/web` side — these are real tRPC procedures, and they belong in F1 if the route map includes the internal-facing half of citizen-facing workflows (e.g., an SP Secretary screen for generating a citizen's printable request form in person).

### `documents.publishToPortal` / `documents.unpublishFromPortal` (full detail repeated; see Section 9 for first occurrence)

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`document_type_code IN ('SP_RESOLUTION','SP_ORDINANCE','SP_APPROPRIATION_ORDINANCE')`, `lifecycle_state IN ('released','archived')`, and either `classification_level = 'public'` or (`classification_level = 'internal'` AND the document type's `public_visibility_rule = 'title_and_first_page_public'`).|
|Business operation|Flips the document's portal-visibility flag (read by the Phase-3 `portal` schema's `public_documents` sync, which is out of scope for this Phase 1 router but the trigger point exists now). `[Confirmed — I1 §3.11 in full; I2 Section 14 "Publish / unpublish document to public portal"]`|

### `tracking.scanQrCodeAuthenticated`

[Inference] Not a public-portal procedure itself — this is the _authenticated in-app_ scan path, explicitly distinguished in source from the unauthenticated public scan. Included here only to make the contrast explicit and avoid a reader assuming this is the procedure a public portal QR scan would call.

|||
|---|---|
|Type|`query`|
|Input|`z.object({ qrTrackingNumber: z.string().uuid() })`|
|Output|`z.object({ documentType: z.string(), remarks: z.string().nullable(), fullRoutingHistory: z.array(z.object({ actionDescription: z.string(), actorDisplayName: z.string(), timestamp: z.coerce.date() })), firstPageImageUrl: z.string().url(), getCopyAvailable: z.literal(true) })`|
|Callable by|`records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor`|
|ABAC conditions|None beyond Global Gates — this is the in-app authenticated scan path, distinct from the unauthenticated public scan, and per I1 §7.3 is available to any authenticated non-citizen, non-system role.|
|Business operation|Returns document type, remarks, full routing history from draft, first page only, and a "Get a copy" affordance. `[Confirmed — I1 §7.3 in full]`|

### `documentRequests.generatePrintableForm`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ requestId: z.string().uuid() })`|
|Output|`z.object({ printableFormUrl: z.string().url() })`|
|Callable by|`sp_secretary`|
|ABAC conditions|None beyond role gate.|
|Business operation|Renders the request data into the official Document Request Form layout (access mode 2: digital-form-then-print, used by both internal staff and, via the REST equivalent, citizens). `[Confirmed — I2 Section 13 "Generate printable document request form", ✅ for SP Secretary on the internal side]`|

[Inference] This is the procedure source flags as notable: the same permission category ("Generate printable document request form") is ✅ for both `sp_secretary` (this tRPC procedure) and `citizen` (the REST equivalent) per I2's matrix — confirming, at the procedure level now rather than just the permission level, that the prior curation document's flagged ambiguity (shared component vs. two separate implementations) is real: this catalog documents the SP-Secretary-side tRPC procedure and explicitly defers the citizen-side REST equivalent as out of scope for itself, without stating whether they render through shared code.

### `documentRequests.createClerkAssisted`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentTypeRequested: z.string(), titleOrNumber: z.string().min(1), numberOfPages: z.number().int().positive(), requesterName: z.string().min(1), requesterAgency: z.string().optional(), requesterEmail: z.string().email(), idPresented: z.string(), purpose: z.string().min(1) })`|
|Output|`z.object({ requestId: z.string().uuid(), printableFormUrl: z.string().url() })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|None beyond role gate.|
|Business operation|Access mode 3 of the three confirmed modes — clerk fills the digital form, system generates the printable form on-site, citizen signs on the spot. `[Confirmed — I1 §13.2 in full; I2 Section 13 "Log / enter clerk-assisted document request"]`|

### `documentRequests.approveAsPresidingOfficer`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ requestId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_presiding_officer` only|
|ABAC conditions|`request` must be at the Vice Mayor approval step.|
|Business operation|Records the Vice Mayor's half of the dual-signature approval requirement. `[Confirmed — I1 §13.3 in full]`|

### `documentRequests.approveAsSecretary`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ requestId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`request` must be at the SP Secretary approval step **and** the Vice Mayor must have already approved (sequential approval, both required before release).|
|Business operation|Records the second half of the dual-signature requirement. Approval now complete; release is gated separately on payment. `[Confirmed — I1 §13.4 in full; consolidated reference Part 4.15 "Approval requires both Vice Mayor AND SP Secretary signature"]`|

### `documentRequests.releaseCopy`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ requestId: z.string().uuid(), orNumber: z.string().optional(), collectingOfficerId: z.string().uuid() })` — `orNumber` optional in Phase 1 since payment processing is deferred per Q-D04|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|`request.approval_status = 'approved'`. Payment confirmation check is **skipped** in Phase 1.|
|Business operation|Marks the request released and notifies the requester via contact number. `[Confirmed — I1 §13.5 in full; consolidated reference Q-D04; Part 4.15 "Post-approval notifications"]`|

### `documentRequests.listAll`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput`|
|Output|`z.object({ items: z.array(z.object({ requestId: z.string().uuid(), requesterName: z.string(), documentTypeRequested: z.string(), approvalStatus: z.string(), createdAt: z.coerce.date() })), nextCursor: z.string().nullable() })`|
|Callable by|`sp_secretary`, `sp_presiding_officer`, `auditor`|
|ABAC conditions|None beyond role gate.|
|Business operation|Reads `portal.citizen_requests` in full. `[Confirmed — I1 §13 pattern; I2 Section 13 "View all document requests"]`|

### `complaints.createClerkAssisted`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ complainantName: z.string().min(1), complainantAddress: z.string().optional(), complainantContact: z.string().min(1), subjectMatter: z.string().min(1), respondentName: z.string().optional(), respondentEmail: z.string().email().optional(), respondentPhone: z.string().optional(), narrativeText: z.string().min(1) })` — no `violationType`/`tricycleNumber` fields forced as required, since complaints are confirmed **not limited to transportation**|
|Output|`z.object({ complaintId: z.string().uuid() })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|None beyond role gate.|
|Business operation|Calls into the `portal.complaints` write path from an internal `/web` screen (access mode 3 — in-person, clerk-assisted). `[Confirmed — I1 §10.2 in full; I2 Section 12 "Submit complaint (clerk-assisted, in-person)"; consolidated reference Part 4.14 scope correction]`|

### `complaints.logAndAssign`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ complaintId: z.string().uuid(), assignedOfficeId: z.string().uuid() })` — may be a committee or the Vice Mayor's office; no fixed routing rule|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|None beyond role gate — the Secretariat decides routing with no fixed path.|
|Business operation|Sets `complaint.assigned_office_id`, transitions `outcome_state` from initial intake toward `'pending_hearing'`. `[Confirmed — I1 §10.3 in full; consolidated reference Q-B04 decision 1]`|

### `complaints.enterCommitteeReport`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ complaintId: z.string().uuid(), reportText: z.string().min(1) })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary`, `sp_member` (committee-scoped)|
|ABAC conditions|For `sp_member`: `complaint.assigned_office_id ∈ subject.committee_ids`.|
|Business operation|Records the committee's report on the complaint. Transitions `outcome_state` toward `'received_seen'`/`'resolved'` depending on subsequent action. `[Confirmed — I2 Section 12 "Enter committee report on complaint"]`|

### `complaints.setOutcome`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ complaintId: z.string().uuid(), outcome: z.enum(['dismissed','resolved']), notifyRespondentVia: z.enum(['email','phone_then_in_person_pickup']) })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|None beyond role gate.|
|Business operation|Sets `complaint.outcome_state`. Triggers the confirmed respondent notification rule: email if available, phone+in-person-pickup otherwise. `[Confirmed — I1 §10.7 in full; consolidated reference Q-B04 decision 4; B2 Module 7 "Respondent Notice Service" description]`|

### `complaints.listAll`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput.extend({ outcomeState: z.enum(['pending_hearing','received_seen','dismissed','resolved']).optional() })`|
|Output|`z.object({ items: z.array(z.object({ complaintId: z.string().uuid(), subjectMatter: z.string(), outcomeState: z.string(), assignedOfficeId: z.string().uuid().nullable(), createdAt: z.coerce.date() })), nextCursor: z.string().nullable() })`|
|Callable by|`sp_secretary`, `sp_presiding_officer`, `auditor` unconditionally; `sp_member` (committee-scoped)|
|ABAC conditions|For `sp_member`: `complaint.assigned_office_id ∈ subject.committee_ids`.|
|Business operation|Reads `portal.complaints`, the SP-Secretariat-wide view. `[Confirmed — I1 §10.6 in full; I2 Section 12 "View all complaints (SP Secretariat only)"]`|

### `iam.registerCitizenAccountClerkAssisted`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ fullName: z.string().min(1), birthdate: z.coerce.date(), phone: z.string().min(7), email: z.string().email(), idType: z.string(), idReference: z.string().optional() })`|
|Output|`z.object({ citizenUserId: z.string().uuid() })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|None beyond role gate.|
|Business operation|Calls into the `portal` module's citizen-identity service from an internal `/web` screen at the Secretariat counter — distinct from citizen _self_-registration, which is REST. `[Confirmed — I2 Section 1 "Register citizen account (clerk-assisted)", ✅ only SP Secretary; consolidated reference Part 4.15 access mode 3]`|

### `tracking.printQrCoverSheet`

|||
|---|---|
|Type|`query` — returns a render-ready payload rather than performing a write `[Inference]`|
|Input|`z.object({ documentIds: z.array(z.string().uuid()).min(1), layout: z.enum(['single','multi_per_page']).default('multi_per_page') })`|
|Output|`z.object({ pdfPresignedUrl: z.string().url() })`|
|Callable by|`sp_secretary` only|
|ABAC conditions|The document(s) must be in the SP Secretariat's scope.|
|Business operation|Generates the QR cover sheet, confirmed to contain only three fields. `[Confirmed — I1 §7.5; consolidated reference Q-B02 in full; tech-stack PDF generation row]`|

[Unverified] This procedure is included here on the reasoning that QR cover sheets are the artifact a citizen later scans via the public, unauthenticated path — but the procedure itself is purely internal (`sp_secretary`-only). Flagged as a judgment call, not a stated fact.

---

## 11. Generic Document-Detail Procedures (needed across many views, not specific to one)

[Inference] A handful of procedures don't map cleanly to exactly one F1 view — they're the generic "show me this document" building blocks that nearly any document-related screen (intake form's edit mode, workflow step action views, audit/tracking views, dashboards' detail drill-down) would call. Rather than force these into one arbitrary section or copy them six times across Sections 2–10, they're consolidated once here with a note on which views plausibly use them — this is the one deliberate exception to "list under every relevant view," made because the alternative (listing `documents.get` under essentially all 9 sections) would not improve clarity and these are explicitly framed in source as cross-cutting reads, not view-specific actions.

### `documents.get`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|`z.object({ documentId: z.string().uuid(), documentTypeId: z.string().uuid(), documentTypeName: z.string(), title: z.string(), lifecycleState: documentLifecycleStateEnum, classificationLevel: classificationLevelEnum, originatingOfficeId: z.string().uuid(), ownedByOfficeId: z.string().uuid(), preliminaryNumber: z.string().nullable(), finalNumber: z.string().nullable(), qrTrackingNumber: z.string().uuid(), metadata: z.record(z.unknown()), createdBy: z.string().uuid(), createdAt: z.coerce.date() })`|
|Callable by|`records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor`|
|ABAC conditions|Own-office read always allowed for the listed roles; cross-office read for `records_officer`/`sp_secretary`/`sp_presiding_officer`/`mayor`/`auditor` requires `classification_level IN ('public','internal')` **and** `has_cross_office_read_grant()`; `sp_member` cross-committee read requires committee/session match; `classification_level = 'public'` always readable by anyone authenticated. `sys_admin` is excluded entirely from this procedure (see `documents.getMetadataForAdmin` below instead).|
|Business operation|Calls `Documents.getDocumentById()` (B2 Published API). `[Confirmed — I1 §3.2 in full]`|

### `documents.getMetadataForAdmin`

|||
|---|---|
|Type|`query`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|`z.object({ documentId: z.string().uuid(), title: z.string(), lifecycleState: documentLifecycleStateEnum, finalNumber: z.string().nullable(), classificationLevel: classificationLevelEnum })` — deliberately excludes `metadata` and any version/attachment reference|
|Callable by|`sys_admin` only|
|ABAC conditions|Gate 2 permits metadata-only access to Confidential/Restricted documents for IT Admin (title, status, number); content remains blocked.|
|Business operation|Calls `Documents.getDocumentById()` and strips all fields not in the output schema before returning. `[Confirmed — I1 §2 Gate 2 prose; Inference for this being a separate procedure rather than a conditional field-strip inside documents.get]`|

[Inference] This is the procedure a Platform-Administrator-adjacent System-Administrator monitoring view would call — relevant to Section 9 by extension, since `sys_admin` is otherwise shut out of document content entirely, consistent with Invariant #10.

### `documents.search`

|||
|---|---|
|Type|`query`|
|Input|`paginationInput.extend({ queryText: z.string().min(1), documentTypeIds: z.array(z.string().uuid()).optional(), classificationLevels: z.array(classificationLevelEnum).optional(), ...dateRangeInput.shape })`|
|Output|`z.object({ items: z.array(z.object({ documentId: z.string().uuid(), title: z.string(), documentTypeName: z.string(), finalNumber: z.string().nullable(), currentState: documentLifecycleStateEnum, relevanceScore: z.number().optional() })), nextCursor: z.string().nullable() })`|
|Callable by|`records_officer`, `dept_encoder` (🔶 scoped), `dept_approver` (🔶 scoped), `sp_secretary`, `sp_member` (🔶 scoped), `sp_presiding_officer`, `mayor`, `auditor`|
|ABAC conditions|Encoders/Approvers/SP Members scoped to their own office (or committee/session scope) — enforced as an additional `WHERE` clause layered on the PostgreSQL FTS query.|
|Business operation|Phase 1: executes `tsvector`/`tsquery` directly against `documents.documents`/`documents.versions.ocr_text` (no Search Meta abstraction call in Phase 1). `[Confirmed — I2 Section 5 "Full-text search across documents"; B2 Module 9 Phase 1 note; tech-stack Search Strategy table]`|

### `documents.delete`

|||
|---|---|
|Type|`mutation`|
|Input|`z.object({ documentId: z.string().uuid() })`|
|Output|`z.object({ success: z.literal(true) })`|
|Callable by|`dept_encoder`, `dept_approver`, `sp_secretary`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`|
|ABAC conditions|`lifecycle_state IN ('draft','submitted')` **and** `workflow_instance_id IS NULL`.|
|Business operation|Soft-deletes — never a hard `DELETE`. `[Confirmed — I1 §3.4 in full; I2 Conditional Note ⁷]`|

[Inference] Relevant primarily to the document intake form (Section 4) as a "discard draft" action, though not explicitly tied there in source — included here as a cross-cutting CRUD operation rather than duplicated into Section 4, since it's a generic document action rather than intake-specific.

### `documents.getVersionHistory` / `documents.downloadVersion` / `documents.getOcrText` / `documents.triggerManualReOcr`

|||
|---|---|
|Type|`query` (first two read variants are `query`; `downloadVersion` is `mutation` per source's own reasoning that issuing a presigned URL is a side effect) / `query` (OCR text) / `mutation` (re-OCR trigger)|
|Input|`getVersionHistory`: `z.object({ documentId: z.string().uuid() })`. `downloadVersion`: `z.object({ versionId: z.string().uuid() })`. `getOcrText`: `z.object({ versionId: z.string().uuid() })`. `triggerManualReOcr`: `z.object({ versionId: z.string().uuid() })`.|
|Output|`getVersionHistory`: `z.array(z.object({ versionId: z.string().uuid(), versionNumber: z.number().int(), originalFilename: z.string().nullable(), mimeType: z.string(), fileSizeBytes: z.number().int(), uploadedBy: z.string().uuid(), uploadedAt: z.coerce.date(), scanQualityCategory: z.enum(['good','fair','poor']).nullable() }))`. `downloadVersion`: `z.object({ presignedDownloadUrl: z.string().url(), expiresInSeconds: z.number().int() })`. `getOcrText`: `z.object({ ocrText: z.string().nullable(), ocrProcessed: z.boolean() })`. `triggerManualReOcr`: `z.object({ ocrQueued: z.literal(true) })`.|
|Callable by|`getVersionHistory`/`getOcrText`: `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor`. `downloadVersion`: same role set as `documents.get` (i.e., `sys_admin` excluded entirely). `triggerManualReOcr`: `records_officer`, `sp_secretary`.|
|ABAC conditions|`getVersionHistory`/`getOcrText`: same own-office/cross-office/committee scoping as `documents.get`, with Gate 2's content-isolation extended to OCR text specifically for `getOcrText`. `downloadVersion`: identical to `documents.get`'s file-content variant — IT Admin has no listed grant at all, for any classification. `triggerManualReOcr`: none beyond role gate.|
|Business operation|`getVersionHistory` reads `documents.versions ORDER BY version_number`. `downloadVersion` issues a short-lived presigned GET URL. `getOcrText` reads `documents.versions.ocr_text`. `triggerManualReOcr` re-enqueues the OCR job for an existing file, distinct from the automatic on-upload trigger. `[Confirmed — I2 Section 5 "View document version history"/"Download document file"; I1 §4.1, §4.3; I2 Section 17 "Trigger manual re-OCR on existing file"]`|

[Inference] These four are grouped together here (rather than each given its own subsection) because they share the exact same role/ABAC shape pattern and all serve the same general purpose: viewing/managing a specific document's file history once a document detail screen is already open, regardless of which named F1 view that detail screen is reached from.

### `tracking.getTrackingRecord` / `tracking.getRoutingHistory` / `tracking.logRoutingEntry`

|||
|---|---|
|Type|`query` / `query` / `mutation`|
|Input|`getTrackingRecord`: `z.object({ documentId: z.string().uuid() })`. `getRoutingHistory`: `z.object({ documentId: z.string().uuid() })`. `logRoutingEntry`: `z.object({ documentId: z.string().uuid(), toOfficeId: z.string().uuid().nullable(), actionDescription: z.string().min(1) })`.|
|Output|`getTrackingRecord`: `z.object({ trackingId: z.string().uuid(), documentId: z.string().uuid(), qrCodeS3Key: z.string(), assignedAt: z.coerce.date(), physicalLocation: z.string().nullable() })`. `getRoutingHistory`: `z.array(z.object({ entryId: z.string().uuid(), fromOfficeId: z.string().uuid().nullable(), toOfficeId: z.string().uuid().nullable(), actorId: z.string().uuid(), actorDisplayName: z.string(), actionDescription: z.string(), timestamp: z.coerce.date() }))`. `logRoutingEntry`: `z.object({ entryId: z.string().uuid() })`.|
|Callable by|`getTrackingRecord`/`getRoutingHistory`: `records_officer`, `dept_encoder`, `dept_approver`, `sp_secretary`, `sp_member`, `sp_presiding_officer`, `mayor`, `brgy_encoder`, `brgy_captain`, `auditor` (own-office); narrower set cross-office. `logRoutingEntry`: `sp_secretary` only.|
|ABAC conditions|`getTrackingRecord`/`getRoutingHistory`: own-office unconditional; cross-office requires `classification_level IN ('public','internal')`. `logRoutingEntry`: the document must be an SP Secretariat document.|
|Business operation|`getTrackingRecord` calls `Tracking.getTrackingRecordForDocument()`. `getRoutingHistory` calls `Tracking.getRoutingHistory()` — the _authenticated internal_ view, distinct from the public unauthenticated scan result served by REST. `logRoutingEntry` inserts `tracking.routing_entries`; physical routing logging by other offices is deferred to Phase 2. `[Confirmed — B2 Module 5 Published API; I1 §7.1, §7.2 in full]`|

[Inference] Grouped together as the generic tracking-detail trio any document detail screen needs, regardless of which named F1 view leads to it.

---

## 12. Procedures Not Mapped to Any Named F1 View

[Inference] Per the verification checklist at the top of this document, every procedure in source must appear somewhere in this curation. The following procedures genuinely don't correspond to any of F1's 9 named views — they support account/session self-service, configuration screens not yet schema-backed, or Phase-2-deferred functionality. Listed here in full (not dropped), consistent with "no information lost," with a brief note on why each falls outside F1's explicit scope.

### `iam.getCurrentUser`

|||
|---|---|
|Type|`query`|

[Inference] Likely called by every authenticated screen's header/nav (to show "logged in as X"), but not specific to any one of F1's 9 named views — it's app-shell-level, not route-level.

### `iam.updateOwnProfile` / `iam.changeOwnPassword` / `iam.listActiveSessions`

[Inference] Account-settings self-service. No named F1 view is an "account settings" screen.

|||
|---|---|
|Business operation (updateOwnProfile)|Updates `iam.users` non-security fields. `[Confirmed — I2 Section 1 "Edit own profile (non-security fields)"]`|
|Business operation (changeOwnPassword)|Verifies current password, writes new Argon2id hash. `[Confirmed — I2 Section 1 "Change own password"]`|
|Business operation (listActiveSessions)|Reads own `iam.sessions` rows. `[Confirmed — I2 Section 1 "View active sessions (own)"]`|

### `organization.getActiveDesignations` / `getDesignationHistory` (already fully detailed in Section 9 — cross-reference only, not omitted)

### `notifications.listMine` / `markAsRead` / `getOwnPreferences` / `updateOwnPreferences`

[Inference] Notification-center self-service — app-shell-level (a bell icon dropdown), not a named F1 route.

|||
|---|---|
|Type|`query` (listMine, getOwnPreferences) / `mutation` (markAsRead, updateOwnPreferences)|
|Business operation (listMine)|Reads `notifications.notification_events` filtered to the caller. `[Confirmed — I2 Section 11 "Receive in-app notifications"]`|
|Business operation (markAsRead)|Sets `is_read = true`. `[Confirmed — I2 Section 11 "Mark notifications as read (own)"]`|
|Business operation (getOwnPreferences/updateOwnPreferences)|User-configurable, no admin approval needed. `[Confirmed — I2 Section 11 "Configure own notification preferences"; consolidated reference Part 11.21]`|

### `records.applyRetentionSchedule` / `records.applyClassification` / `records.placeLegalHold` / `records.removeLegalHold` / `records.isUnderLegalHold`

[Inference] Records-management actions tied to the (Phase 2) full RMS module, not any of F1's 9 named Phase-1 views. The retention-schedule-list read is already included in Section 9 since it's plausibly Platform-Admin-adjacent; these five action procedures go further into RMS territory than F1's scope describes.

|||
|---|---|
|Business operation (applyRetentionSchedule)|Applies an existing schedule to an individual record. `[Confirmed — I2 Conditional Note ⁵; I1 §9.2]`|
|Business operation (applyClassification)|Updates `documents.documents.classification_level`. `[Confirmed — I1 §9.3 in full]`|
|Business operation (placeLegalHold/removeLegalHold)|Sets the legal-hold flag (Phase 1 placeholder location: `documents.documents.metadata`). `[Confirmed — I1 §9.6 in full; consolidated reference Part 11.7]`|
|Business operation (isUnderLegalHold)|Calls `Records.isUnderLegalHold()` — used before allowing a `'disposed'` transition. `[Confirmed — B2 Module 6 Published API]`|

---

## 13. Items Explicitly Flagged as `[Deferred]` in Source (preserved verbatim, not synthesized, since they describe absence rather than a procedure)

[Inference] These aren't procedures to map to a view — they're the source document's own list of things that do _not_ yet exist as procedures, which is itself information that must not be lost, since a reader of F1 might otherwise assume a missing procedure was an oversight in this curation rather than a documented gap in the original API contract.

_Source: "Required Follow-Up Before Full Sign-Off" (full)_

> |#|Item|Why Deferred|
> |---|---|---|
> |E1-F1|Tier 2 Platform Admin config CRUD procedures for `notification_templates`, `sla_thresholds`/escalation targets, `public_visibility_rules` as distinct entities|These admin-configurable concepts are confirmed to exist but their dedicated schemas are not among C1's eight Phase 1 DDL schemas as standalone tables — a procedure catalog for tables that do not yet exist would be speculative.|
> |E1-F2|RMS bulk operations and disposition procedures (`records.bulkArchive`, `records.initiateDisposition`, `records.processPiiErasure`)|Phase 2 module delivery; included in I1 for policy completeness but the Phase 1 `recordsRouter` intentionally stops at the four procedures the Phase 1 Documents/Workflow modules call synchronously.|
> |E1-F3|Signature upload/read procedures (`documents.uploadSignatureImage`, `documents.getSignatures`)|Implied by I2 Section 9's permission rows, but not separately detailed in I1's resource-type sections the way version/attachment upload is — the shape is confidently inferable but flagged rather than asserted as independently confirmed.|

[Inference] E1-F3 is the most directly relevant of the three to F1: it confirms the prior permission-matrix curation's Section 13 exclusion note (Signature Recording was excluded there as "no distinct named view in F1") is consistent with this source too — this catalog independently arrives at the same gap, treating signature upload/read as inferable-but-undetailed rather than giving it a confirmed procedure shape.

_Source: Cross-Reference Index, the one row flagging a gap relevant to Platform Administrator views specifically_

> | 3 — Platform Configuration | Office/position/employee/role/committee CRUD covered; document-type/numbering-series/workflow-definition/notification-template/SLA-threshold/public-visibility-rule CRUD procedures are `[Deferred]` from this catalog's detailed treatment — these are Tier 2 Platform Admin config screens whose backing schemas (`document_types`, `number_series`) exist in C1 but whose full CRUD procedure set would substantially duplicate the `documentsRouter`'s type-management surface; flagged here for a follow-up addendum rather than guessed at without a more detailed config-screen spec to build against. |

[Unverified] This means Section 9 (Platform Administrator Views) above is necessarily incomplete relative to the full scope of what a Platform Administrator screen would eventually need — document-type, numbering-series, and workflow-definition CRUD procedures are confirmed to be needed conceptually but have no documented procedure shape in this source file at all. F1 will need to either treat those as `[Deferred]` routes too, or wait for an E1 addendum, rather than this curation inventing shapes that don't exist in source.

---

**Verification note:** Cross-checking against the procedure inventory built before this document was written: all 13 IAM procedures appear (Sections 9, 12), all 9 Organization procedures appear (Sections 5, 9, 12), all 23 Documents procedures appear (Sections 4, 5, 9, 10, 11), all 18 Workflow procedures appear (Sections 2, 3, 5, 7, 9), all 5 Tracking procedures appear (Sections 9, 10, 11), all 6 Session procedures appear (Section 3, 6), all 5 Records procedures appear (Sections 9, 12), all 4 Notifications procedures appear (Sections 9, 12), all 5 Audit procedures appear (Section 8), all 5 Complaints procedures appear (Section 10), all 6 Document Requests procedures appear (Section 10). No procedure from the source catalog is absent from this document.

**Correction check:** Every procedure table above reproduces the source's input schema, output schema, callable-by list, ABAC conditions, business operation, and confidence tag exactly — synthesis was applied only to _grouping and section placement_, never to the content of any individual procedure's documented shape. This document, like its two companions, does not itself constitute F1 — F1 still requires inventing route paths and component names not present in any of the three source files reviewed so far.