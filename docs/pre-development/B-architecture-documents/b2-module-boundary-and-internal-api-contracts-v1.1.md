# Batac City LGU Platform

## B2 — Module Boundary and Internal API Contracts

**Document ID:** B2 **Type:** Module Contract Specification — Architectural Law Enforcement **Status:** Pre-Development Baseline — ADRs Resolved **Version:** 1.1 **Date:** June 2026 **Based on:** B1 (System Architecture, C4 Model); Consolidated Architecture and Requirements Reference (Iteration 3); ADR-B2-1 through ADR-B2-7 **Audience:** Development team — internal reference

---

## Table of Contents

- [L3–L73] B2 — Module Boundary and Internal API Contracts — Authoritative module communication boundaries and architectural contracts specification.
- [L74–L91] Purpose — Scope of Architectural Law #2, cross-module communication rules, and the single allowed Phase 1 FTS read exception.
- [L92–L101] Notation — Definitions of source fidelity labels, including inferred behaviors and phase boundaries used throughout the contracts.
- [L102–L154] Enforcement Model — Implementation of Law #2, static analysis enforcement, sync vs. async decision rules, event envelope structure, and API versioning policy.
- [L155–L229] Module 1 — IAM — ABAC engine authorization policy evaluation, display user summary retrieval, and authentication/role assignment audit events.
- [L230–L386] Module 2 — Organization — Office hierarchy tree, designation logging, active delegation resolution for step routing and ABAC policy evaluation, and (added 2026-06-25) primary office, committee membership, and delegation-by-id resolution for IAM.
  - [L234–L370] Published API — Synchronous interface exposed for cross-module calls.
  - [L371–L380] Events Emitted — Domain events published to the event bus.
  - [L381–L386] Events Consumed — Subscriptions to domain events emitted by other modules.
- [L387–L563] Module 3 — Documents — Document state machine, draft and final numbering sequences, attachment upload presigning, and Secretariat decision integration.
  - [L395–L540] Published API — Synchronous interface exposed for cross-module calls.
  - [L541–L556] Events Emitted — Domain events published to the event bus.
  - [L557–L563] Events Consumed — Subscriptions to domain events emitted by other modules.
- [L564–L707] Module 4 — Workflow — Engine step types, multi-committee referral cutoffs, certified urgent bypass, version pinning, and SLA escalation monitors.
  - [L578–L672] Published API — Synchronous interface exposed for cross-module calls.
  - [L673–L694] Events Emitted — Domain events published to the event bus.
  - [L695–L707] Events Consumed — Subscriptions to domain events emitted by other modules.
- [L708–L778] Module 5 — Tracking — Immutable QR tracking number assignment, physical custody logging, append-only routing history, and public document blurring rules.
- [L779–L849] Module 6 — Records — Permanent retention schedules, four-tier classification rules, legal holds, and audited Records Officer bulk operations.
- [L850–L909] Module 7 — Notifications — SSE in-app, SMTP email, and Phase 3 SMS delivery channels, template engines, and respondent notice routing rules.
- [L910–L1019] Module 8 — Audit — Append-only hash chain and HMAC cryptographics, monthly TSA export, and the global domain event auditing consumer.
  - [L916–L986] Published API — Synchronous interface exposed for cross-module calls.
  - [L987–L990] Events Emitted — Domain events published to the event bus.
  - [L991–L1019] Events Consumed — Subscriptions to domain events emitted by other modules.
- [L1020–L1089] Module 9 — Search Meta — Search provider abstraction, Phase 1 PostgreSQL FTS trigger, Phase 2 Meilisearch sync, and the temporary FTS query exception.
- [L1090–L1124] Module 10 — Portal — OTP citizen authentication, public document lookup, citizen complaint channels, and three access modes for document requests.
- [L1125–L1152] Module 11 — Reporting — On-demand and scheduled PDF/spreadsheet generation, and ARTA compliance reporting via the Workflow Published API.
- [L1153–L1307] Cross-Module Reference — Master matrices for the internal event registry, synchronous call pathways, and direct module dependencies.
  - [L1155–L1183] Master Event Bus Registry — Comprehensive catalog of all in-process event names, emitting modules, registered subscribers, and source references.
  - [L1184–L1216] Published API Call Matrix — Traceability matrix of all authorized synchronous cross-module calls, method names, and trigger contexts.
  - [L1217–L1307] Module Dependency Map — ASCII reference map showing dependency directions for synchronous calls, event emissions, and event consumption.
- [L1308–L1329] Prohibited Patterns — Seven prohibited development patterns that violate modular boundaries, caught by compiler rules or static analysis.
- [L1330–L1348] Resolved ADRs `[All seven resolved — see Version 1.1 Change Log at top of document]` — Historical log preserving the original requirements and final resolutions for ADR-B2-1 through ADR-B2-7.

---

### Version 1.1 Change Log

All seven Required ADRs identified in Version 1.0 of this document have been resolved and are recorded as standalone decision records (ADR-B2-1 through ADR-B2-7). Four of those decisions change this document's content directly; this revision incorporates them. The remaining three (ADR-B2-1, ADR-B2-2, ADR-B2-7) formalize detail that was already correctly stated here and required no content change — they are noted in the table below for traceability only.

|ADR|Change to this document|
|---|---|
|ADR-B2-1 (Event Bus Implementation)|No content change. Confirms the event bus described throughout this document is a typed `EventEmitter` wrapper. Subscriber-isolation and dead-letter behavior (a throwing subscriber must not fail the emitter) are now formally specified in the ADR rather than left as an unstated assumption.|
|ADR-B2-2 (Audit Log Design)|No content change. Formalizes the hash chain, HMAC, key rotation, and TSA detail already present in Module 8 below.|
|ADR-B2-3 (Secretariat Decision Entry Point)|**Content change.** The Secretariat's Approve / Reject / Amended action now enters through the **Workflow Router**, calling `Documents.transitionState()` synchronously. The `document.secretariat_decision` event is **removed**. Module 3, Module 4, the Master Event Bus Registry, the Module Dependency Map, and the Audit Events Consumed table are all updated accordingly.|
|ADR-B2-4 (Respondent Notice Channel)|**Confirms existing content.** This document's proposal — routing Portal's Respondent Notice Service through `Notifications.sendNotification()` rather than calling SMTP directly — is now the confirmed design. B1's direct-SMTP diagram is superseded. The `[Inference]` flag on this row of the API Call Matrix is removed.|
|ADR-B2-5 (Phase 1 FTS Column Ownership)|**Content change.** Search Meta now ships a thin Phase 1 pass-through implementation rather than zero Phase 1 footprint. Module 9 is updated to Phase 1 + Phase 2, with an explicitly scoped Law #2 exception for its Phase 1 cross-schema read of `documents.tsvector`.|
|ADR-B2-6 (Published API Versioning)|**Content addition.** A new "Published API Versioning Policy" subsection is added to the Enforcement Model. No existing Published API method signature changes as a result — this ADR governs *future* breaking changes, not a present one.|
|ADR-B2-7 (Phase 1 Classification Source)|No content change. Formalizes the Phase 1→2 classification migration plan; the Phase 1 behavior already stated in Module 6 is unchanged.|

**Not an ADR — supplementary addition, 2026-06-25:** three Organization Published API methods
(`getPrimaryOfficeForUser`, `getCommitteeIdsForUser`, `getDelegationGrantById`) added, and IAM
added as a caller of all three in the Published API Call Matrix and Module Dependency Map. This
closes a gap the original seven ADRs did not cover: IAM's JWT `oid`/`cid` claims and its
delegation-context preHandler hook all depend on `organization` schema data with no published,
non-violating access path specified anywhere in B5, I1, or this document. Made at the project
owner's direction, with explicit authority to edit this document for that purpose; full
rationale is in `docs/pre-development/A-project-planning/a1-tasks/iam.md`'s Module Summary.
This addition does not resolve everything it touches — see that Module Summary's "Open
questions for the developer" for what is intentionally left open.

---

## Purpose

This document defines the legal communication paths between all 11 domain modules of the Batac City LGU Platform. It is the enforcement specification for **Architectural Law #2**:

> _Modules communicate only through the event bus or published module APIs. No module may read another module's schema directly._

**One narrow, explicitly named exception to this Law exists as of ADR-B2-5:** Search Meta's Phase 1 `search()` implementation reads the `documents` schema's `tsvector` column directly. This is documented in Module 9, Prohibited Pattern P1, and the Module Dependency Map below, and is scoped to be retired at the Phase 2 cutover. It is not a general relaxation of Law #2 — every other module boundary in this document remains as strict as the Law states.

For each module, this document defines:

1. The **Published API** — the typed interface it exposes for synchronous calls from other modules
2. The **Domain Events it Emits** — payloads published to the in-process event bus
3. The **Domain Events it Consumes** — subscriptions and the action taken on receipt

Any cross-module interaction not listed here is a violation. This document must be updated alongside any change to a module's published interface, emitted events, or event subscriptions.

---

## Notation

|Label|Meaning|
|---|---|
|_(unlabelled)_|Confirmed in B1 or Consolidated Reference (Iteration 3)|
|`[Inference]`|Architectural design logically required by Law #2 or module responsibilities; not explicitly stated in source documents. Not guaranteed behaviour.|
|Phase N|Available starting in that phase; schema may be reserved earlier|

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
- Code review policy: any PR containing a direct cross-module schema query is blocked regardless of test status, **with exactly one named exception** — Search Meta's Phase 1 read of `documents.tsvector` — allowlisted explicitly per ADR-B2-5 and Prohibited Pattern P1's exception note. No other cross-schema query is permitted under any circumstance.
- Every new domain event must be registered with the Audit module's consumer before the feature is merged (see Section 8).

### Synchronous vs. Asynchronous — Decision Rule `[Inference]`

|Use the Published API (sync) when…|Use the Event Bus (async) when…|
|---|---|
|The caller needs a return value to proceed|The interaction is a side effect|
|Consistency is required within the same logical operation|Eventual consistency is acceptable|
|The action must complete or fail atomically with the caller's transaction|The consuming module's failure must not fail the emitting module's operation|
|Example: ABAC check before a write; delegation resolution before step routing; document state transition driven by workflow|Example: audit logging; search indexing; notification delivery; routing history append; public portal visibility update|

### Common Event Envelope `[Inference]`

All events published to the in-process event bus carry this envelope. Individual payload shapes are defined per event in Sections 1–11.

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

### Published API Versioning Policy `[RESOLVED — ADR-B2-6]`

Breaking changes to a Published API method (parameter added/removed/retyped, return type changed) are made **directly, in the same PR, with no versioned coexistence period.** There is no `getDocumentByIdV2` pattern and no deprecation window for Published API methods.

This is distinct from `schemaVersion` above, which governs **event payloads** on the async bus — a publisher and a not-yet-redeployed subscriber could genuinely run different code momentarily during a rolling restart, so event payloads need additive-only evolution with a version marker. Published API methods are synchronous, in-process, same-deployment calls within a single Fastify process (Consolidated Reference, Part 9: "single process"); there is no "old version still running somewhere" scenario for them, because the TypeScript compiler refuses to build until every caller across the monorepo is updated to match the new signature in the same PR. See ADR-B2-6 for full rationale.

This policy applies uniformly to every module's Published API. It would need to be revisited only if a module were ever extracted to an independently deployable service (the stated long-term extraction path for the modular monolith, Consolidated Reference Part 10.1) — that circumstance does not currently exist.

---

## Module 1 — IAM

**Schema:** `iam` **Phase:** 1 **Tables:** `users`, `credentials`, `sessions`, `refresh_tokens`, `roles`, `permissions`, `role_assignments`, `mfa_records` **Responsibility:** Authentication, session control, JWT issuance, role resolution, and ABAC policy evaluation. Identity foundation for every other module.

### Published API

```typescript
// /modules/iam/index.ts — [Inference] method signatures proposed

interface IAMPublicAPI {

  /**
   * Evaluate an ABAC policy for a user attempting a specific action on a
   * resource. Called by every module's service layer before any
   * access-controlled write or read operation.
   *
   * Context fields are optional; callers supply what is available.
   * Office scope is used for office-scoped permissions. Document
   * classification is used for classification-gated access rules.
   * Internally, the ABAC engine calls Organization.getOfficeHierarchy()
   * and Records.getClassificationForDocument() as needed — callers do
   * not need to supply these themselves.
   *
   * Returns false (not an exception) when access is denied.
   * [Inference]
   */
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

  /**
   * Get a non-sensitive user summary for display or addressing purposes.
   * Called by Workflow (assignee display), Notifications (recipient
   * addressing), and Documents (actor display in history).
   * Returns null if user not found.
   * [Inference]
   */
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

**Schema:** `organization` **Phase:** 1 **Tables:** `offices`, `positions`, `employees`, `assignments`, `delegations` **Responsibility:** Office hierarchy, employee records, position assignments, and delegation management. Delegation is a high-frequency first-class operation (confirmed: 10+ Acting Mayor designations per year). One active delegation per person enforced at both the DB level (partial unique index on active `delegation_grants` per user) and application level. No Platform Admin confirmation required — Secretariat logs the Designation document and delegation takes immediate effect.

### Published API

```typescript
// /modules/organization/index.ts — [Inference] method signatures proposed

interface OrganizationPublicAPI {

  /**
   * Resolve who currently holds a given position, accounting for any
   * active delegation at the given point in time.
   *
   * This is the primary call from the Workflow module when routing a step:
   * "Who is currently the SP Secretary?" accounts for the case where an
   * Administrative Officer II is designated as OIC. "Who is currently the
   * Mayor?" accounts for the Vice Mayor serving as Acting Mayor.
   *
   * Returns null if no active assignment and no active delegation.
   * [Inference]
   */
  resolveCurrentHolder(
    positionId: string,
    asOf?: Date
  ): Promise<UserSummary | null>;

  /**
   * Get the active delegation for a specific user, if any.
   * Used by Workflow to determine whether a user currently holds
   * authority through delegation (vs. direct assignment).
   * Returns null if no active delegation.
   * [Inference]
   */
  getActiveDelegationForUser(
    userId: string
  ): Promise<DelegationSummary | null>;

  /**
   * Get office details by ID.
   * Used by IAM ABAC engine for office-scoped policy evaluation;
   * by Documents for originating office display.
   * Returns null if not found.
   * [Inference]
   */
  getOfficeById(officeId: string): Promise<OfficeSummary | null>;

  /**
   * Return the full office hierarchy tree.
   * Used by IAM ABAC engine to evaluate office-scoped permission policies.
   * [Inference]
   */
  getOfficeHierarchy(): Promise<OfficeTree>;

  /**
   * Get an employee record by their IAM user ID.
   * Used by Workflow and Notifications for display, routing, and
   * notification addressing when a user summary is insufficient.
   * Returns null if no employee record found for that user ID.
   * [Inference]
   */
  getEmployeeByUserId(userId: string): Promise<EmployeeSummary | null>;

  /**
   * [Added — IAM/ORG cross-module wiring resolution, 2026-06-25. See
   * docs/pre-development/A-project-planning/a1-tasks/iam.md Module Summary,
   * "Spec Gaps Identified — RESOLVED 2026-06-25."]
   * Resolve a user's primary office (id + display code), via
   * organization.employees.user_id → organization.assignments (active row).
   * Returns null if the user has no employee record, or that employee has
   * no active assignment. This is the real-implementation counterpart to
   * the `getPrimaryOffice` resolver IAM's login/refresh flows call through
   * an injected, Phase-1-defaulted function — see iam.md TASK-IAM-006.
   * [Inference] Which row counts as "primary" when more than one active
   * assignment exists for the same employee is an open question — see this
   * file's Module Dependency Map note on IAM, and iam.md's "Open questions
   * for the developer" item 1. Not resolved by this addition.
   */
  getPrimaryOfficeForUser(userId: string): Promise<{ officeId: string; officeCode: string } | null>;

  /**
   * [Added — IAM/ORG cross-module wiring resolution, 2026-06-25.]
   * Active organization.committee_memberships rows for this user, as
   * committee UUIDs. Empty array if none. Real-implementation counterpart
   * to IAM's `getCommitteeIds` resolver — see iam.md TASK-IAM-006.
   */
  getCommitteeIdsForUser(userId: string): Promise<string[]>;

  /**
   * [Added — IAM/ORG cross-module wiring resolution, 2026-06-25.]
   * Load a single organization.delegation_grants row by id, applying the
   * same active/not-expired/not-revoked filter the row's consumers already
   * require. Returns null if not found, expired, or revoked. Distinct from
   * getActiveDelegationForUser() (declared earlier in this interface; looks up by user, for
   * Workflow's routing use case) — this looks up by grant id, for IAM's
   * preHandler chain, which already has the JWT-cached `dg` claim and only
   * needs to re-validate and read that specific grant's `scope`. Real-
   * implementation counterpart to IAM's `resolveActiveDelegationGrant`
   * resolver — see iam.md TASK-IAM-005 Hook 2 and TASK-IAM-006.
   */
  getDelegationGrantById(delegationGrantId: string): Promise<{
    scope: { roles: string[]; officeIds: string[]; actions: string[] };
  } | null>;
}

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

**Numbering rule (confirmed):** QR tracking number assigned first at secretariat logging → Preliminary `Draft` number assigned second → Final number assigned after last reading vote, before VP signs. Final numbers are immutable once the `Draft` prefix is removed. Separate PostgreSQL sequence per document type per year.

**Originating office rule (confirmed):** For SP workflow documents (Resolutions, Ordinances, Appropriation Ordinances), `originating_office_id` is always the SP Secretariat regardless of authoring Councilor. For incoming letters (SPR documents), it records the external sender.

### Published API

```typescript
// /modules/documents/index.ts — [Inference] method signatures proposed

interface DocumentsPublicAPI {

  /**
   * Get a document summary by ID.
   * Called by Workflow for routing context and step precondition checks;
   * by Records when creating an archive entry; by Tracking for
   * cover sheet generation.
   *
   * Note: Search Meta does NOT call this method. Phase 1: Search Meta's
   * tsvector read is a directly scoped Law #2 exception against the
   * documents schema (see Module 9, ADR-B2-5) — it does not go through
   * this method. Phase 2: Search Meta's Meilisearch index is kept in
   * sync via document.created / document.state_changed events, also
   * not via this method.
   * Returns null if not found.
   * [Inference]
   */
  getDocumentById(documentId: string): Promise<DocumentSummary | null>;

  /**
   * Get a document type definition by ID.
   * Called by Workflow to retrieve the workflow template reference
   * and legally mandated minimum step constraints;
   * by Records for retention schedule linkage.
   * Returns null if not found.
   * [Inference]
   */
  getDocumentType(documentTypeId: string): Promise<DocumentTypeSummary | null>;

  /**
   * Transition a document's lifecycle state.
   *
   * Called by Workflow as part of step completion processing to advance
   * document state (e.g. 'In-Workflow' → 'Completed' after the last reading
   * vote; 'Completed' → 'Released' after Mayor signature or lapse; etc.).
   * Also called by Records when a disposition transitions a document to
   * 'Disposed'.
   *
   * The Documents module validates the requested transition against its
   * internal state machine before applying it. Invalid transitions throw
   * and must not leave the document in a partial state.
   *
   * Emits `document.state_changed` on success.
   * [Inference]
   */
  transitionState(
    documentId: string,
    toState: DocumentLifecycleState,
    actorId: string,
    reason?: string
  ): Promise<void>;

  /**
   * Assign the final series number to a document, removing the 'Draft' prefix.
   *
   * Called by Workflow at the correct lifecycle event:
   *   - Resolution: after Second Reading vote, before VP signs
   *   - Ordinance / Appropriation Ordinance: after Third Reading vote,
   *     before VP signs
   *
   * Final numbers are immutable after this call. Enforced at both the
   * application level (this method) and the DB level (unique constraint).
   *
   * Emits `document.number_assigned` with numberType 'final' on success.
   * [Inference]
   */
  assignFinalNumber(
    documentId: string,
    actorId: string
  ): Promise<DocumentNumberResult>;

  /**
   * Get attachment references for a document, including presigned S3 URLs
   * and any available OCR text.
   *
   * Used by Search Meta (Phase 2) for OCR text extraction during indexing;
   * by Records for archiving. Portal public first-page display is handled
   * via Tracking's public lookup handler, not this method.
   *
   * Callers are responsible for confirming authorization via IAM.evaluatePolicy()
   * before calling this method.
   * [Inference]
   */
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
  scanQualityScore: number | null;  // used for quality indicator display [Inference]
  pageCount: number;
}
```

**Note on Secretariat Decision Flow `[RESOLVED — ADR-B2-3]`:** The Secretariat's Approve / Reject / Amended action enters through the **Workflow Router**, not the Document Router. The Workflow Router validates the action against the current workflow step type, and the Workflow Engine **synchronously calls `Documents.transitionState()`** as part of the same logical operation (this call already existed in the Published API Call Matrix below). If `transitionState()` throws, the entire decision fails atomically — no partial state where the decision is "recorded" but the workflow step hasn't moved. On success, Workflow emits `workflow.step_completed` (an existing event; see Module 4) with the Approve/Reject/Amended outcome carried in its `outcome` field. **There is no `document.secretariat_decision` event.** The Document Router's "Secretariat decision logging" responsibility as listed in B1 Module 3 is superseded by this ADR — see ADR-B2-3 for full rationale, including why this corrects an inconsistency between B1's Document Router and Workflow Router component listings.

### Events Emitted

|Event|Trigger|Key Payload Fields|
|---|---|---|
|`document.created`|Secretariat logs a new document; system record created|`documentId`, `documentTypeId`, `documentTypeName`, `originatingOfficeId`, `createdBy`, `cityId`|
|`document.state_changed`|Document lifecycle state machine advances|`documentId`, `fromState`, `toState`, `actorId`, `reason?`|
|`document.number_assigned`|Preliminary or final series number assigned|`documentId`, `numberType: 'preliminary' \| 'final'`, `numberValue`, `series`, `assignedBy`|

`document.secretariat_decision` is **removed** as of ADR-B2-3. The Approve / Reject / Amended decision is now recorded by the Workflow module via a synchronous call to `Documents.transitionState()`, which still emits `document.state_changed` as listed above — no new event type was needed.

Consumers by event:

- `document.created` → **Tracking** (QR generation; tracking record creation), **Workflow** (workflow instance creation), **Search Meta** [Phase 1 no-op; Phase 2 indexing — see Module 9], **Audit**
- `document.state_changed` → **Tracking** (routing history entry), **Notifications**, **Search Meta** [Phase 1 no-op; Phase 2 sync — see Module 9], **Portal** [Phase 3], **Audit**
- `document.number_assigned` → **Audit**

### Events Consumed

None. Documents is an upstream source module. Its state is driven by user actions through its own Router and by synchronous calls from the Workflow module via the Published API above (including `transitionState()` calls originating from Secretariat decisions per ADR-B2-3). It does not subscribe to other modules' events.


---

## Module 4 — Workflow

**Schema:** `workflow` **Phase:** 1 (core engine, Phase 1 step types, Certified Urgent path, multi-committee referral); Phase 2 (`parallel_split`, `parallel_join` — schema reserved in Phase 1) **Tables:** `definitions`, `definition_versions`, `steps`, `transition_rules`, `instances`, `step_instances`, `workflow_events` **Responsibility:** Custom domain-specific workflow engine, admin-configurable without developer involvement. Orchestrates all legislative lifecycle steps. Enforces legally mandated minimum steps per document type. Routes steps with full delegation awareness. Manages Mayor 10-day lapse, Panlalawigan 30-day review, and ARTA SLA timers via pgboss.

**Phase 1 step types:** `action`, `approval`, `multi_referral`, `decision`, `notification`, `termination` **Phase 2 reserved:** `parallel_split`, `parallel_join`

**`multi_referral` step behaviour (confirmed):** All assigned committees must sign and contribute to the unified report before the step completes. Committees missing the Thursday cutoff are red-flagged in the Order of Business; Second Reading is delayed until the following Tuesday after submission. SP Secretary manual override requires a mandatory audit-logged comment.

**Certified Urgent path (confirmed Phase 1):** Mayor issues a formal written Certification of Urgency. Secretariat logs it. No standalone number. Attached to each associated measure. Bypasses `multi_referral` step entirely. First and Second Reading in the same session. One Certification can cover multiple measures in the same session.

**Workflow instance version pinning (confirmed):** Every instance pins to the `definition_version_id` active at creation time. In-flight migration requires Option A (continue under old version) or Option B (admin migrates with mandatory reason, second-level approval, 24-hour reversible window, dedicated audit event).

**Secretariat Decision Entry Point `[RESOLVED — ADR-B2-3]`:** The Secretariat's Approve / Reject / Amended action (for Ordinances, Resolutions, and Appropriation Ordinances) enters through the **Workflow Router**, not the Document Router. The Workflow Engine synchronously calls `Documents.transitionState()` as part of processing the decision. See Module 3's "Note on Secretariat Decision Flow" and ADR-B2-3 for full detail.

### Published API

```typescript
// /modules/workflow/index.ts — [Inference] method signatures proposed

interface WorkflowPublicAPI {

  /**
   * Get the current state of a workflow instance.
   * Used by Portal (Phase 3) to display legislative measure progress;
   * by Reporting for ARTA SLA compliance queries.
   * Returns null if not found.
   * [Inference]
   */
  getInstanceById(
    instanceId: string
  ): Promise<WorkflowInstanceSummary | null>;

  /**
   * Get the active workflow instance for a document.
   * Used by the Documents Router to link the document view to its
   * current workflow status without reading the workflow schema.
   * Returns null if no active instance exists for this document.
   * [Inference]
   */
  getActiveInstanceForDocument(
    documentId: string
  ): Promise<WorkflowInstanceSummary | null>;

  /**
   * Get SLA tracking data for ARTA compliance report generation.
   * Called by the Reporting module's ARTA Compliance Reporter.
   *
   * This is the only permitted path for Reporting to access workflow
   * SLA data. Direct reads of the workflow schema by Reporting are
   * prohibited under Law #2.
   *
   * B1 confirms: "artaReporter → wfMod: Reads SLA tracking and
   * escalation data"
   * [Inference — method signature proposed]
   */
  getWorkflowSLAData(
    filter: WorkflowSLAFilter
  ): Promise<WorkflowSLAData[]>;
}

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
  slaClassification: 'simple' | 'complex' | 'highly_technical';  // per RA 11032 ARTA
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
|`delegation.granted`|Organization|Immediately re-routes any active step instances currently assigned to the original authority to the newly designated person. Takes effect without delay or additional confirmation.|
|`delegation.expired`|Organization|Re-routes any active step instances assigned to the designated person back to the original authority.|
|`delegation.revoked`|Organization|Same effect as `delegation.expired`; triggered by explicit early revocation rather than scheduled end date.|

**Note `[RESOLVED — ADR-B2-3]`:** The Secretariat's Approve / Reject / Amended decision is **not** received as a consumed event. It is submitted directly to the **Workflow Router** (see Module 4's Published API context above and ADR-B2-3), which synchronously calls `Documents.transitionState()`. This row previously listed `document.secretariat_decision` as a consumed event; that event no longer exists.

---

## Module 5 — Tracking

**Schema:** `tracking` **Phase:** 1 **Tables:** `tracking_records`, `routing_entries`, `qr_codes` **Responsibility:** QR code generation at secretariat logging (before preliminary number is assigned). Append-only routing history for every document movement. Physical custody tracking separate from digital workflow status. Public QR scan-result view (type, remarks, routing history from draft, first page only visible, all other pages blurred).

**Confirmed QR assignment sequence:** Secretariat logs document → **QR tracking number assigned (first)** → Preliminary Draft number assigned → Workflow instance created. QR tracking number is immutable for the document's full lifetime, independent of both preliminary and final document numbers.

### Published API

```typescript
// /modules/tracking/index.ts — [Inference] method signatures proposed

interface TrackingPublicAPI {

  /**
   * Get the QR tracking record for a document.
   * Used by the Documents module's Cover Sheet Generator to include
   * the tracking number and QR code image reference on the cover sheet.
   * Returns null if no tracking record exists yet.
   * [Inference]
   */
  getTrackingRecordForDocument(
    documentId: string
  ): Promise<TrackingRecordSummary | null>;

  /**
   * Get the full routing history for a document.
   * Used by the Documents Router for the authenticated internal
   * routing history view.
   * The public scan-result view is served directly by Tracking's own
   * REST endpoint (publicLookupHandler) — not via this method.
   * Caller must be authorized before calling.
   * [Inference]
   */
  getRoutingHistory(
    documentId: string,
    actorId: string
  ): Promise<RoutingEntry[]>;
}

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

### Events Emitted

None. Tracking is a consumer module. It writes to its own schema in response to events but does not publish to the bus.

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`document.created`|Documents|Generates a UUID tracking number and QR code image; creates `tracking_record` and `qr_code` entries. This occurs before the preliminary document number is assigned.|
|`workflow.step_completed`|Workflow|Appends a `routing_entry` recording the step completion: from/to office, actor, timestamp, and action type derived from the step type and outcome.|

---

## Module 6 — Records

**Schema:** `records` **Phase:** 2 (module delivered Phase 2; schema reserved in Phase 1 migration) **Tables:** `records`, `retention_schedules`, `archive_entries`, `classification_rules`, `dispositions` **Responsibility:** Post-workflow document records lifecycle. Retention schedule enforcement. Classification level rules. Bulk operations restricted to Records Officers with dry-run and per-item audit logging. Disposition with mandatory comment and legal hold validation. No hard deletes by any user or role at any level.

**Confirmed retention:** SP Resolutions and Ordinances are permanently retained. No documents have been disposed of at Batac SP Secretariat to date.

### Published API

```typescript
// /modules/records/index.ts — [Inference] method signatures proposed

interface RecordsPublicAPI {

  /**
   * Get the classification level for a specific document.
   * Used by the IAM ABAC engine to evaluate classification-gated
   * access control policies without reading the documents schema.
   *
   * Phase 1 note: Records module is delivered in Phase 2. In Phase 1,
   * the ABAC engine uses the classificationLevel field from
   * Documents.getDocumentById() instead. This method becomes the
   * canonical classification source in Phase 2.
   * [Inference]
   */
  getClassificationForDocument(
    documentId: string
  ): Promise<'Public' | 'Internal' | 'Confidential' | 'Restricted' | null>;

  /**
   * Check whether a document is under an active legal hold.
   * Used by the Documents module before state transitions that affect
   * records integrity (e.g. before Documents.transitionState() to 'Disposed').
   * Returns false if the document has no records entry yet (Phase 1,
   * before Records module is active).
   * [Inference]
   */
  isUnderLegalHold(documentId: string): Promise<boolean>;

  /**
   * Get the retention schedule for a document type.
   * Used by the Documents module's Document Type Registry to validate
   * that a retention schedule exists before a document type can be activated.
   * Returns null if no schedule is configured.
   * [Inference]
   */
  getRetentionSchedule(
    documentTypeId: string
  ): Promise<RetentionSchedule | null>;
}

interface RetentionSchedule {
  scheduleId: string;
  documentTypeId: string;
  retentionPeriod: 'Permanent' | number;  // number = years; SP Resolutions/Ordinances = 'Permanent'
  legalBasis: string;
  configuredBy: string;
}
```

### Events Emitted

None. Records does not publish domain events. It writes to its own schema in response to `workflow.completed` and exposes read APIs for external callers. `[Inference]`

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`workflow.completed`|Workflow|Creates a `record` entry and initial `archive_entry` for the completed document. Calls `Documents.getDocumentById()` to retrieve document metadata for the record. Calls `Documents.getDocumentType()` to retrieve the retention schedule linkage for the archive entry.|

---

## Module 7 — Notifications

**Schema:** `notifications` **Phase:** 1 **Tables:** `templates`, `notification_events`, `delivery_log` **Responsibility:** Multi-channel notification delivery. In-app via SSE endpoint. Email via Nodemailer and LGU SMTP. SMS via gateway (Phase 3 only). Admin-configurable templates requiring no developer involvement. Formal respondent notices: email delivery when address is on file; phone notification with in-person written notice pickup when only contact number is available (Phase 1 and 2); SMS delivery (Phase 3).

### Published API

```typescript
// /modules/notifications/index.ts — [Inference] method signatures proposed

interface NotificationsPublicAPI {

  /**
   * Send a notification programmatically from outside the event bus flow.
   *
   * Most notifications are triggered by event bus subscriptions (see
   * Events Consumed below). This method is the synchronous path for
   * cases where the caller needs delivery confirmation before proceeding,
   * or where there is no associated domain event.
   *
   * Primary caller: Portal module's Respondent Notice Service, for
   * formal written notices to complaint respondents.
   *
   * [RESOLVED — ADR-B2-4]: Portal's Respondent Notice Service routes
   * through this method exclusively. It does not call the SMTP server
   * directly. B1's component diagram showed a direct SMTP relationship
   * (respondentNoticeSvc -> smtpServer); that diagram is superseded by
   * ADR-B2-4. Routing through this method ensures every respondent
   * notice attempt — including the Phase 1/2 phone-call-required
   * fallback when only a contact number is on file — lands in the
   * single notifications.delivery_log alongside every other
   * notification in the system.
   */
  sendNotification(input: NotificationInput): Promise<void>;
}

interface NotificationInput {
  recipientUserId?: string;       // for authenticated internal system users
  recipientEmail?: string;        // for external recipients (e.g. complaint respondents)
  recipientPhone?: string;        // Phase 3 — SMS gateway
  templateId: string;
  templateData: Record<string, string>;  // variable substitutions for the template
  channel: 'in_app' | 'email' | 'sms';
}
```

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

**Tamper-evidence boundary (must be stated in ADR):** The audit log is tamper-evident, not tamper-proof. A sufficiently privileged attacker holding both DB write access and the HMAC secret key could insert records that pass validation. This distinction is not negotiable wording — it must be documented in the ADR for the audit log design.

### Published API

```typescript
// /modules/audit/index.ts — [Inference] method signatures proposed

interface AuditPublicAPI {

  /**
   * Write an audit event synchronously.
   *
   * Use this form ONLY when the audit entry must be written atomically
   * as part of the same logical operation and a domain event on the
   * bus would not provide that guarantee. The two confirmed callers are:
   *
   *   - Records.bulkOpHandler: one writeEvent() call per item in a bulk
   *     operation, so each item is individually logged before the next
   *     item is processed. (Confirmed in B1.)
   *
   *   - Records.dispositionSvc: one writeEvent() call per disposition
   *     action. (Confirmed in B1.)
   *
   * All other modules reach the audit log exclusively through domain
   * events on the event bus (consumed by the Audit Event Consumer).
   * Any additional caller of writeEvent() must be documented here.
   * [Inference — method signature proposed; callers confirmed from B1]
   */
  writeEvent(event: AuditEventInput): Promise<void>;

  /**
   * Query audit events for authorized roles.
   * Returns events alongside hash chain validation status per batch.
   * A status of 'broken' is a tamper indicator and must be surfaced
   * to the requester.
   * [Inference]
   */
  queryEvents(filter: AuditQueryFilter): Promise<AuditQueryResult>;
}

interface AuditEventInput {
  eventType: string;
  actorId: string;
  targetId?: string;
  targetType?: string;  // e.g. 'document', 'user', 'delegation', 'disposition'
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
|`workflow.step_assigned`|Workflow||
|`workflow.step_completed`|Workflow|`[UPDATED — ADR-B2-3]` Now also carries Approve / Reject / Amended outcomes for Secretariat decisions, in its `outcome` field. `document.secretariat_decision` no longer exists as a separate event — see ADR-B2-3.|
|`workflow.lapsed`|Workflow||
|`workflow.escalated`|Workflow||
|`workflow.certified_urgent_applied`|Workflow||
|`workflow.manually_advanced`|Workflow||
|`workflow.completed`|Workflow||

**Rule:** Any new domain event added to the bus **must** be registered with the Audit Event Consumer in the same PR that introduces the event. No event may ship without an Audit subscription. `[Inference — required by Law #2 spirit; not stated verbatim in source]`

---

## Module 9 — Search Meta

**Schema:** `search_meta` **Phase:** 1 (thin pass-through implementation) + 2 (Meilisearch) `[RESOLVED — ADR-B2-5]` **Tables:** `index_metadata`, `index_jobs` (Phase 2 — see note below) **Responsibility:** Provider-agnostic search abstraction. Phase 1: thin pass-through to PostgreSQL `tsvector`/`tsquery`. Phase 2: Meilisearch (self-hosted Docker). All call sites reference the abstraction only — provider swap is a configuration and deployment change, not a code change, **including the Phase 1→2 transition**. Typo tolerance required for Filipino proper names.

**Phase 1 implementation `[RESOLVED — ADR-B2-5]`:** Search Meta ships in Phase 1 with a thin pass-through `search()` implementation. The `tsvector` column itself still lives in the `documents` schema, maintained by a DB trigger — schema ownership of the column and trigger remains with Documents, unchanged from the prior design. What changes is the *call path*: internal callers (the Documents Router, and later the Portal REST Router in Phase 3) call `SearchMeta.search()` from Phase 1 onward, never querying `tsvector` directly themselves. Search Meta's Phase 1 `search()` internally executes the `tsvector`/`tsquery` SQL and returns results in the same shape Phase 2's Meilisearch-backed implementation will return.

**Explicitly scoped Law #2 exception `[RESOLVED — ADR-B2-5]`:** Search Meta's Phase 1 `search()` implementation reads the `documents` schema's `tsvector` column directly — a cross-schema read that would otherwise be Prohibited Pattern P1. This is accepted as a narrow, named, and temporary exception specific to this one read path, not a general precedent. It is expected to be retired in Phase 2: once Meilisearch is introduced and the `search_meta` schema's own synced index becomes the read target, this cross-schema read is removed. The Phase 2 rollout checklist must include removing this exception as a named task. See ADR-B2-5 for full rationale, including why the alternative (relocating the same coupling into a Documents-owned search method) does not solve the underlying problem.

**Phase 1 module footprint:** Search Router (exposes the endpoint to the Internal Web App) and the Search Abstraction Interface (delegates to the FTS execution logic described above) are built in Phase 1. The Meilisearch Sync Worker, Index Job Manager, and the `index_metadata`/`index_jobs` tables remain genuinely Phase 2-only — there is no second index to sync to or job to track until Meilisearch exists.

### Published API

```typescript
// /modules/search_meta/index.ts — [Inference] method signatures proposed

interface SearchMetaPublicAPI {

  /**
   * Execute a full-text search query via the provider abstraction.
   *
   * [RESOLVED — ADR-B2-5]
   * Phase 1: thin pass-through — delegates to PostgreSQL FTS
   * (tsvector/tsquery against the documents schema; see the explicitly
   * scoped Law #2 exception noted above this interface).
   * Phase 2+: delegates to Meilisearch.
   *
   * Called by the Documents Router (internal authenticated search)
   * and by the Portal REST Router (public document search, Phase 3).
   * Callers do not need to know which provider is active — this is
   * true from Phase 1 onward, not only from Phase 2 onward, which is
   * the entire point of shipping this thin layer in Phase 1 rather
   * than deferring the module wholesale.
   * [Inference]
   */
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
  relevanceScore?: number;       // available when Meilisearch is active (Phase 2)
  highlightedExcerpt?: string;   // available when Meilisearch is active (Phase 2)
}
```

### Events Emitted

None.

### Events Consumed

|Event|Source|Action Taken|
|---|---|---|
|`document.created`|Documents|Phase 1: no action — the FTS trigger in the `documents` schema maintains the `tsvector` column independently of the event bus. Phase 2: additionally enqueues initial Meilisearch indexing job via pgboss. `[Inference]`|
|`document.state_changed`|Documents|Phase 1: no action (PostgreSQL FTS reflects current state via DB triggers on the `documents` schema). Phase 2: additionally enqueues a Meilisearch sync job via pgboss to update the document's index entry with the new state. `[Inference]`|

---

## Module 10 — Portal

**Schema:** `portal` **Phase:** 3 **Tables:** `public_documents`, `citizen_requests`, `complaints`, `announcements` **Responsibility:** Public-facing REST API consumed by the Next.js citizen portal. Citizen OTP-based authentication (phone + email). Public document lookup (first page visible; body of all other pages blurred). Citizen complaint submission for any LGU-related subject — not limited to transportation. Document Request Form (three access modes; physical wet-ink signature still required). Phase 3.

**Three confirmed access modes for both Document Requests and Complaints:**

1. Citizen downloads form template from sp.batac.gov.ph; submits physical document with wet-ink signature
2. Citizen fills digital form; system generates printable formatted document; citizen prints, signs, submits
3. Citizen visits Secretariat in person; clerk fills digital form; prints on-site; citizen signs on the spot

### Published API

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
|`document.state_changed`|Documents|Synchronizes relevant state changes to the `public_documents` table (e.g. a released document becoming listed; a cancelled document being delisted). `[Inference]`|

---

## Module 11 — Reporting

**Schema:** `reporting` **Phase:** 2 **Tables:** `report_definitions`, `schedules`, `outputs` **Responsibility:** Admin-configurable report generation requiring no developer involvement for new report types. RA 11032 ARTA compliance reports from live workflow SLA data. Scheduled (pgboss) and on-demand. PDF via `@react-pdf/renderer`; spreadsheet via SheetJS.

### Published API

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

**Note:** B1 shows `Rel(artaReporter, wfMod, "Reads SLA tracking and escalation data")` and the B1 DB annotation for Reporting reads "reporting schema and read access to workflow schema." The phrase "read access to workflow schema" in the B1 DB annotation does **not** mean a direct cross-schema SQL query is permitted. Under Law #2, Reporting accesses workflow SLA data exclusively through `Workflow.getWorkflowSLAData()` from the Workflow Published API. That is the only permitted path.

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
|`document.created`|Documents|Tracking, Workflow, Search Meta [Ph1 no-op; Ph2 indexing], Audit|B1 Appendix A; Search Meta row updated `[ADR-B2-5]`|
|`document.state_changed`|Documents|Tracking, Notifications, Search Meta [Ph1 no-op; Ph2 sync], Portal [Ph3], Audit|B1 Appendix A; Search Meta row updated `[ADR-B2-5]`|
|`document.number_assigned`|Documents|Audit|B1 Appendix A|
|`workflow.step_assigned`|Workflow|Notifications, Audit|B1 Appendix A|
|`workflow.step_completed`|Workflow|Tracking, Audit|B1 Appendix A — also now carries Secretariat Approve/Reject/Amended outcomes; `document.secretariat_decision` removed `[ADR-B2-3]`|
|`workflow.lapsed`|Workflow|Notifications, Audit|B1 Appendix A|
|`workflow.escalated`|Workflow|Notifications, Audit|B1 Appendix A|
|`workflow.certified_urgent_applied`|Workflow|Audit|B1 Appendix A|
|`workflow.manually_advanced`|Workflow|Audit|B1 Appendix A|
|`workflow.completed`|Workflow|Records [Ph2], Portal [Ph3], Audit|B1 Appendix A|

---

### Published API Call Matrix

All legal synchronous cross-module calls. Any call not in this table is a violation of Law #2.

|Caller|Callee Module|Method|Trigger Context|Source|
|---|---|---|---|---|
|Every module (service layer)|IAM|`evaluatePolicy()`|Before any access-controlled operation|`[Inference]`|
|Every module (service layer)|IAM|`getUserById()`|Display name resolution for routing and addressing|`[Inference]`|
|IAM (ABAC engine)|Organization|`getOfficeHierarchy()`|Office-scoped permission policy evaluation|B1: "Hierarchy consumed by ABAC engine"|
|IAM (ABAC engine)|Organization|`getOfficeById()`|Office context for a specific ABAC check|`[Inference]`|
|IAM (ABAC engine)|Records|`getClassificationForDocument()`|Classification-gated access control [Phase 2]|`[Inference]`|
|IAM (login/refresh service)|Organization|`getPrimaryOfficeForUser()`|Resolving the `oid` JWT claim and the login response's `officeScopeId`/`officeCode`|`[RESOLVED — IAM/ORG cross-module wiring resolution, 2026-06-25; see iam.md Module Summary]`|
|IAM (login/refresh service)|Organization|`getCommitteeIdsForUser()`|Resolving the `cid` JWT claim|`[RESOLVED — IAM/ORG cross-module wiring resolution, 2026-06-25]`|
|IAM (auth preHandler chain)|Organization|`getDelegationGrantById()`|Loading the active delegation grant referenced by the JWT's cached `dg` claim, at request time|`[RESOLVED — IAM/ORG cross-module wiring resolution, 2026-06-25; previously direct cross-schema SQL, a Law #2 violation]`|
|Workflow (engine)|Organization|`resolveCurrentHolder()`|Routing a step to the current holder of a position|B1: "Resolves current assignee accounting for active delegations"|
|Workflow (engine)|Organization|`getActiveDelegationForUser()`|Checking whether a user's authority is delegated|`[Inference]`|
|Workflow (engine)|Documents|`getDocumentById()`|Retrieving document context for routing decisions|`[Inference]`|
|Workflow (engine)|Documents|`getDocumentType()`|Retrieving workflow template reference on instance creation|`[Inference]`|
|Workflow (engine)|Documents|`transitionState()`|Advancing document lifecycle state on step completion or lapse|`[Inference]`|
|Workflow (engine)|Documents|`assignFinalNumber()`|Triggering final number assignment at the correct step|`[Inference]`|
|Records (event consumer)|Documents|`getDocumentById()`|Retrieving document metadata for archive entry creation|`[Inference]`|
|Records (event consumer)|Documents|`getDocumentType()`|Retrieving retention schedule linkage for archive entry|`[Inference]`|
|Records (disposition service)|Audit|`writeEvent()`|Synchronous audit entry per disposition action|B1: "dispositionSvc → auditMod: Disposition audit records"|
|Records (bulk op handler)|Audit|`writeEvent()`|Synchronous audit entry per individual item in a bulk operation|B1: "bulkOpHandler → auditMod: Individual audit log entry per bulk item"|
|Documents (type registry)|Records|`getRetentionSchedule()`|Validating retention schedule exists before type activation|`[Inference]`|
|Documents (state service)|Records|`isUnderLegalHold()`|Validating no legal hold before state transition to 'Disposed'|`[Inference]`|
|Documents (cover sheet generator)|Tracking|`getTrackingRecordForDocument()`|Including QR code and tracking number on the printed cover sheet|`[Inference]`|
|Documents Router|Tracking|`getRoutingHistory()`|Authenticated internal routing history view|`[Inference]`|
|Reporting (ARTA reporter)|Workflow|`getWorkflowSLAData()`|ARTA compliance report generation|B1: "artaReporter → wfMod: Reads SLA tracking and escalation data"|
|Portal (respondent notice service)|Notifications|`sendNotification()`|Formal written notice to complaint respondent|`[RESOLVED — ADR-B2-4]`; supersedes B1's direct-SMTP component diagram|

---

### Module Dependency Map

A module listed in the **Calls** column makes synchronous API calls to the listed target. A module listed in **Emits to** publishes events consumed by those modules. Read as "this module depends on."

```
IAM
  Calls:          Organization (getOfficeHierarchy, getOfficeById,
                                getPrimaryOfficeForUser, getCommitteeIdsForUser,
                                getDelegationGrantById)
                                [RESOLVED — last three added 2026-06-25, IAM/ORG
                                cross-module wiring resolution; see iam.md Module
                                Summary. Implemented via an injected, Phase-1-
                                defaulted resolver — these calls do not exist as
                                literal imports until the ORG module's Step 2
                                pass wires them in TASK-IAM-014's plugin.]
                  Records      (getClassificationForDocument) [Ph2]
  Emits to:       Audit

Organization
  Calls:          (none)
  Emits to:       Workflow, Audit

Documents
  Calls:          IAM      (evaluatePolicy, getUserById)
                  Records  (getRetentionSchedule, isUnderLegalHold) [Ph2]
                  Tracking (getTrackingRecordForDocument — for cover sheet)
  Emits to:       Tracking, Workflow, Notifications,
                  Search Meta [Ph1 thin pass-through; Ph2 full sync],
                  Portal [Ph3], Audit

Workflow
  Calls:          IAM          (evaluatePolicy, getUserById)
                  Organization (resolveCurrentHolder, getActiveDelegationForUser)
                  Documents    (getDocumentById, getDocumentType,
                                transitionState, assignFinalNumber)
  Emits to:       Notifications, Tracking, Records [Ph2], Portal [Ph3], Audit
  Consumes from:  Documents (created)
                  Organization (delegation.*)
  Note:           Secretariat Approve/Reject/Amended enters via the Workflow
                  Router directly (sync call to Documents.transitionState),
                  not via a consumed event. See ADR-B2-3.

Tracking
  Calls:          IAM (evaluatePolicy — for authenticated routing history queries)
  Emits to:       (none)
  Consumes from:  Documents (created), Workflow (step_completed)

Records
  Calls:          IAM       (evaluatePolicy)
                  Documents (getDocumentById, getDocumentType)
                  Audit     (writeEvent — synchronous; bulk ops and dispositions)
  Emits to:       (none)
  Consumes from:  Workflow (completed)

Notifications
  Calls:          IAM (getUserById — recipient addressing)
  Emits to:       (none)
  Consumes from:  Workflow (step_assigned, lapsed, escalated)
                  Documents (state_changed)

Audit
  Calls:          (none — terminal sink)
  Emits to:       (none)
  Consumes from:  ALL modules via event bus
  API exposed to: Records (writeEvent)

Search Meta
  Calls:          IAM       (evaluatePolicy)
                  Documents (getAttachmentRefs — for OCR text extraction) [Ph2]
  Reads:          documents schema tsvector column directly [Ph1 — explicitly
                  scoped Law #2 exception; see ADR-B2-5; retired at Ph2 cutover]
  Emits to:       (none)
  Consumes from:  Documents (created, state_changed) [Ph1: no-op; Ph2: indexing/sync]

Portal
  Calls:          IAM           (citizen auth is separate; internal ABAC for staff)
                  Notifications (sendNotification — respondent notices)
                  Tracking      (getTrackingRecordForDocument — public scan)
  Emits to:       (none)
  Consumes from:  Workflow  (completed)
                  Documents (state_changed)

Reporting
  Calls:          IAM      (evaluatePolicy)
                  Workflow (getWorkflowSLAData)
  Emits to:       (none)
  Consumes from:  (none)
```

---

## Prohibited Patterns

The following are violations of Law #2. The automated coupling test suite and migration linting detect all of them.

**P1 — Direct cross-schema SQL query** Any Drizzle query in module A that references a table in module B's PostgreSQL schema. Example violation: the `workflow` module querying `documents.document_types` directly. Permitted form: call `Documents.getDocumentType()` from the Published API.

**Explicit, named exception to P1 `[RESOLVED — ADR-B2-5]`:** Search Meta's Phase 1 `search()` implementation reads the `documents` schema's `tsvector` column directly. This is the **only** sanctioned exception to P1 in this document. It does not extend to any other module or any other column. It is scoped to be retired at the Phase 2 cutover, when Search Meta's own `search_meta` schema (synced from Documents via the event bus) becomes the read target instead. The automated coupling test suite must be configured with a single, named allowlist entry for this one read path — not a general carve-out for the Search Meta module — so that any *other* cross-schema read Search Meta might attempt is still caught as a P1 violation.

**P2 — Cross-module internal import** Any import of `modules/B/src/...` in `modules/A/src/...` (where B ≠ A), where the import path goes below the barrel file. Only imports from `modules/B/index.ts` are permitted. Example violation: `import { DocumentRepository } from '../documents/src/repository'`.

**P3 — Direct write to the audit schema** Any module other than Audit writing a row to `audit.events`, whether via Drizzle or raw SQL. All paths must go through `Audit.writeEvent()` or the event bus consumer. The application DB user has `UPDATE` and `DELETE` revoked on the `audit` schema; it should also lack direct `INSERT` from the application role outside the Audit module's repository.

**P4 — Event without Audit subscription** A domain event shipped to production whose `eventType` is not registered in the Audit Event Consumer's subscription list. Every event must be audited.

**P5 — Published API extension without table update** A new method added to a module's Published API interface without updating the API Call Matrix in this document and without documenting the new caller.

**P6 — Caller not in API Call Matrix** A module calling another module's Published API method where that caller is not listed in the matrix. Any new caller must be added to the matrix in the same PR.

**P7 — Event bus bypass for cross-module notification** A module directly calling Notifications' internal services (template engine, delivery services) rather than going through `Notifications.sendNotification()` or emitting a domain event.

---

## Resolved ADRs `[All seven resolved — see Version 1.1 Change Log at top of document]`

The following architectural decision points were identified in Version 1.0 of this document as requiring a dedicated ADR before the affected feature could be implemented. All seven have now been resolved. The original "Decision Required" text is preserved below for historical traceability — per this team's practice of flagging gaps explicitly rather than silently removing them once resolved. Each row's "Resolution" column summarizes the outcome; the standalone ADR file is the authoritative record.

| #        | Topic                                    | Decision Required (original, Version 1.0)                                                                                                                                                                                                                                                                                | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ADR File                                                                                          |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ADR-B2-1 | Event Bus Implementation                 | In-process synchronous pub/sub mechanism: typed EventEmitter wrapper, or a minimal typed bus library. Define typed event registration, subscriber isolation, error handling (subscriber throws must not fail the emitter), and dead-letter strategy.                                                                     | **Typed wrapper around Node's built-in `EventEmitter`.** No third-party bus library. Subscriber failures are caught individually, logged, and routed to a dead-letter table with retry; the emitting module's call always resolves regardless of subscriber outcome. Decided by development team (delegated technical decision).                                                                                                                                                                                 | `[ADR-API-001-event-bus-implementation.md](b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-001-event-bus-implementation.md)`         |
| ADR-B2-2 | Audit Log Design                         | Hash chain algorithm details, HMAC key storage and rotation, tamper-evident vs. tamper-proof boundary statement, TSA provider selection and export schedule. The "tamper-evident, not tamper-proof" claim must be stated verbatim in the ADR.                                                                            | SHA-256 chain via Node `crypto` only; HMAC-SHA-256 with key in environment variable, annual rotation via documented runbook with `hmacKeyVersion` tracking; verbatim tamper-evident/tamper-proof boundary stated; TSA provider selection criteria fixed (RFC 3161-compliant, no raw data transmitted, independently verifiable), vendor selection itself remains an open follow-up not blocking Phase 1. Decided by development team (ratifying detail already specified in source documents).                   | `[ADR-API-002-audit-log-design.md](b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-002-audit-log-design.md)`                 |
| ADR-B2-3 | Secretariat Decision Entry Point         | Confirm whether "Approve / Reject / Amended" enters through the Document Router (emitting `document.secretariat_decision` consumed by Workflow — this document's current design) or through the Workflow Router (calling Documents API directly). Must be resolved before either module's router is implemented.         | **Workflow Router.** The decision enters through Workflow, which synchronously calls `Documents.transitionState()` as part of the same operation — matching this document's own stated sync/async decision rule for atomicity-sensitive actions. `document.secretariat_decision` is removed; `workflow.step_completed` now carries the outcome. Decided by Luke (stakeholder/architect decision).                                                                                                                | `[ADR-API-003-secretariat-decision-entry-point.md](b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-003-secretariat-decision-entry-point.md)` |
| ADR-B2-4 | Respondent Notice Channel                | Confirm whether Portal's Respondent Notice Service calls SMTP directly (as shown in B1's component diagram) or routes through `Notifications.sendNotification()` (as proposed in this document for unified delivery logging). B1 shows a direct SMTP call; this document proposes routing through Notifications.         | **Routes through `Notifications.sendNotification()`.** This document's original proposal is confirmed; B1's direct-SMTP component diagram is superseded. Every notification delivery attempt in the system, including respondent notices, now lands in one `delivery_log`. Decided by Luke (stakeholder/architect decision).                                                                                                                                                                                     | `[ADR-API-004-respondent-notice-channel.md](b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-004-respondent-notice-channel.md)`        |
| ADR-B2-5 | Phase 1 FTS Column Ownership             | Confirm whether the `tsvector` FTS column lives in the `documents` schema (maintained by DB trigger, no Search Meta involvement in Phase 1) or requires a Phase 1 Search Meta coordination layer. Affects whether Search Meta module needs any Phase 1 implementation at all.                                            | **Thin Phase 1 Search Meta pass-through layer.** The `tsvector` column remains in the `documents` schema as originally stated, but Search Meta ships a thin Phase 1 `search()` implementation so call sites never change across the Phase 1→2 boundary. One explicitly named, scoped exception to Law #2 (Prohibited Pattern P1) is introduced for this read path and is retired at Phase 2 cutover. Decided by Luke (stakeholder/architect decision — chose migration cleanliness over minimal Phase 1 effort). | `[ADR-API-005-phase1-fts-column-ownership.md](b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-005-phase1-fts-column-ownership.md)`      |
| ADR-B2-6 | Published API Versioning and Deprecation | Define how breaking changes to a Published API method are handled before the first inter-module API is deployed to production. Specifically: how is an old method signature deprecated, and how long must it coexist with the new signature.                                                                             | **Break in the same PR; no versioned coexistence.** No `V2`-suffixed methods, no deprecation window. The compiler and coupling test suite catch every affected caller atomically in the same PR that introduces the breaking change, reflecting this team's single-process, single-deployment reality. Revisit only if a module is ever extracted to an independently deployable service. Decided by Luke (stakeholder/architect decision).                                                                      | `[ADR-API-006-published-api-versioning.md](b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-006-published-api-versioning.md)`         |
| ADR-B2-7 | Phase 1 Classification Source            | Confirm that in Phase 1 (before the Records module is active), the IAM ABAC engine reads `classificationLevel` from `Documents.getDocumentById()`. Confirm this field transitions to `Records.getClassificationForDocument()` as the canonical source in Phase 2. Requires a deliberate migration plan at Phase 2 start. | **Confirmed as stated**, plus a deliberate Phase 2 migration plan: one-time scripted copy of `classificationLevel` into Records' schema at Phase 2 deployment, a 100%-match reconciliation gate before cutover is considered complete, and the Documents-schema copy frozen (not removed) as a historical snapshot rather than kept live post-cutover. Decided by development team (ratifying detail already specified in source documents; formalizing the migration plan).                                     | `[ADR-API-007-phase1-classification-source.md](b2-module-boundary-and-internal-api-contracts-adrs/ADR-API-007-phase1-classification-source.md)`     |

---

_This document is the enforcement specification for Architectural Law #2. It supersedes any informal cross-module dependency assumptions present in B1. All inter-module interactions must be traceable to an entry in the Event Bus Registry or the API Call Matrix above. This document must be updated in the same PR as any change to a module's published interface, emitted events, or event subscriptions._

_Version 1.1 incorporates the resolution of all seven ADRs required by Version 1.0. Four resolutions (ADR-B2-3, ADR-B2-4, ADR-B2-5, ADR-B2-6) changed this document's content directly, as detailed in the Version 1.1 Change Log at the top of this document and propagated through the relevant module sections, the Master Event Bus Registry, the Module Dependency Map, and the Prohibited Patterns list above. The standalone ADR files are the authoritative decision record; this document is kept consistent with them but is not a substitute for reading the ADRs directly when the full rationale, trade-off discussion, or consequences are needed._
