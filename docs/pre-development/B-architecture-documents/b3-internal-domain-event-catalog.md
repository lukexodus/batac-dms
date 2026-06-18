# B3 — Internal Domain Event Catalog

**Document ID:** B3  
**Status:** Pre-Development Baseline  
**Version:** 1.0  
**Date:** June 2026  
**Source Documents:**

- B2 — Module Boundary and Internal API Contracts, v1.0, June 2026
- B4 — Workflow Engine Specification (excerpt for B3 authoring), June 2026
- B3 Context Reference — Internal Domain Event Catalog, June 2026

**Purpose:** Authoritative catalog of every domain event published to the internal in-process event bus. Each entry specifies the event name, producing module, consuming modules, Zod payload schema, and business reason. This catalog is the foundation of the in-process event bus implementation. No event may be implemented without a corresponding entry here, and no entry may be removed without a corresponding implementation change.

---

> **Notation used throughout this document:**
> 
> `[Inference]` — logically required from architecture or module responsibilities; not explicitly stated in a source document. Not guaranteed behaviour.
> 
> `[Unverified]` — sourced from the B4 excerpt, where the excerpt author noted the content was directly reproduced from B4 but could not verify completeness of extraction. Treat as authoritative for B4 content unless contradicted by B2.
> 
> `[Discrepancy]` — a conflict between two or more source documents that must be resolved by team decision before implementation.
> 
> Phase tags such as `[Phase 2]` — the emitter or that specific consumer subscription is available starting in that phase. Schema columns may be reserved in Phase 1 even when the module is Phase 2.

---

## Table of Contents

- [L63–L99] §0 — Naming Discrepancies — Resolve Before Implementation — Conflict resolution tables for cross-document event names and B2/B4 workflow module discrepancies.
- [L100–L119] §1 — Purpose and Scope — Coverage of the in-process event bus across phases and relationship to the B2 and B4 specifications.
- [L120–L153] §2 — How to Read This Catalog — Event entry format, camelCase naming rules, Zod validators, and transaction-bound async emission mechanics.
- [L154–L208] §3 — Common Types and Event Envelope — Shared Zod schemas for document states, step types, and the universal event envelope wrapper.
- [L209–L337] §4 — IAM Module Events — Authentication and role management events for user identity, sessions, and permissions.
  - [L217–L241] 4.1 user.login — Successful user authentication, session creation, and IP/user-agent tracking for audit writes.
  - [L242–L264] 4.2 user.logout — Voluntary session termination to close the active user audit trail.
  - [L265–L288] 4.3 session.terminated — Admin-forced logouts or inactivity timeouts to enforce single-session policies.
  - [L289–L313] 4.4 role.assigned — Role grants to users, including optional office-scoping boundaries.
  - [L314–L337] 4.5 role.revoked — Role removals from users for security and access-control compliance.
- [L338–L431] §5 — Organization Module Events — Events for designation grants, natural expiries, and early revocations that trigger immediate workflow re-routing.
- [L432–L588] §6 — Documents Module Events — Document lifecycle events, series numbering, and Secretariat decision integration.
  - [L446–L474] 6.1 document.created — Secretariat logging event that triggers QR code generation and workflow instantiation.
  - [L475–L499] 6.2 document.state_changed — Document state transition triggers for search index, portal, and notification updates.
  - [L500–L533] 6.3 document.number_assigned — Assignments of preliminary and final series numbers for legislative records.
  - [L534–L559] 6.4 document.secretariat_decision — Superseded by §7.12 — removed event replaced by synchronous transitions on step completion.
  - [L560–L588] 6.5 document.certification_urgency.logged — Attachment of written urgency certifications to bypass committee referral steps.
- [L589–L1367] §7 — Workflow Module Events — Custom domain-specific legislative workflow engine events for steps, context, and SLAs.
  - [L599–L770] §7.A — Instance Lifecycle Events — Events tracking instance creation, completion, cancellations, suspensions, and stuck state snapshots.
  - [L771–L852] §7.B — Instance Migration Events — Migration start, completion, and reversal events within the 24-hour safety window.
  - [L853–L966] §7.C — Step Lifecycle Events — Events for step start, completion, bypass, and engine-level execution failures.
  - [L967–L995] §7.D — Context Events — Event carrying diff-style audit trail of workflow instance context JSONB updates.
  - [L996–L1126] §7.E — Multi-Referral Step Events — Committee submissions, Thursday cutoff misses, reading eligibility, and manual overrides.
  - [L1127–L1182] §7.F — Timer and Lapse Events — pgboss job events for Mayor 10-day review and Panlalawigan 30-day review lapses.
  - [L1183–L1282] §7.G — Certification of Urgency Events — Bypasses applied, deferred, or skipped for inactive or past-referral documents.
  - [L1283–L1367] §7.H — SLA Events — Warning, breach, and critical escalation notifications for legislative step deadlines.
- [L1368–L1420] §8 — Master Event Registry — Flat matrix listing consumer subscriptions, active phases, and sources for all 42 events.
- [L1421–L1438] §9 — Mandatory Rules — Six non-negotiable architectural rules for event audit, packaging, and emission safety.
- [L1439–L1463] §10 — Open Items — Resolution Status — Status registry documenting disposition of open requirements issues OI-1 through OI-15.

---

## §0 — Naming Discrepancies — Resolve Before Implementation

Three source documents use different names for what appear to be the same events. These conflicts cannot be resolved by inference. **All rows in the table below require an explicit team decision before any event bus code is written.**

### §0.1 — Cross-Document Event Name Conflicts

|B3 Context Reference Name|B2 Module Contract Name|B4 Workflow Spec Name|Status|
|---|---|---|---|
|`document.logged`|`document.created`|—|**[RESOLVED — OI-1]** `document.created` ratified as canonical. Rationale: B2 is the module boundary contract for the Documents module, and this catalog's stated purpose (§1, §2.1) is to reconcile B2/B4 into one canonical set — `document.created` is also the name already used consistently throughout this catalog (§6.1, §8 row 9). No further action.|
|`preliminary_number.assigned`|`document.number_assigned` with `numberType: 'preliminary'`|—|**[RESOLVED — OI-2]** Unified event with `numberType` discriminator ratified, per B2. Rationale: this is the form already drafted and used throughout this catalog (§6.3, §8 row 11); splitting would require two new payload schemas not specified anywhere in source material. If a consumer later needs to subscribe to preliminary-only or final-only assignment, that can be done by filtering on `numberType` inside the consumer's own handler — no event-bus-level split is required. No further action.|
|`final_number.assigned`|`document.number_assigned` with `numberType: 'final'`|—|**[RESOLVED — OI-2]** Same resolution as row above.|
|`certification_of_urgency.attached`|— (not listed in B2 emitted events for Documents)|`documents.certification_urgency.logged`|**[RESOLVED — OI-3, OI-12]** Name normalized to `document.certification_urgency.logged` (singular prefix, matching every other Documents-module event). B4's plural `documents.` is treated as an authoring inconsistency, not an intentional naming convention — no other Documents event uses a plural prefix. **Action required outside this document:** B2's Master Event Registry does not list this event at all (per the §6.5 note); it must be added there in the same PR that introduces this event on the bus. This action item cannot be closed from within B3 alone — it requires an edit to the B2 document, which is outside this catalog's authority.|
|`panlalawigan_timer.expired`|`workflow.lapsed` with `lapseType: 'panlalawigan_30_day_deemed'`|`workflow.panlalawigan.deemed_approved`|**[Discrepancy]** B4 splits B2's unified `workflow.lapsed` into two separate events. This catalog adopts B4's two-event model. Team must confirm.|
|—|`workflow.lapsed` with `lapseType: 'mayor_10_day_lapsed'`|`workflow.approval.lapsed`|**[Discrepancy]** Same row as above: the Mayor 10-day half of B2's unified event.|
|`designation.activated`|`delegation.granted`|—|**[Discrepancy]** Different conceptual framing (Designation document vs. delegation grant record). This catalog uses `delegation.granted` per B2 since the underlying DB entity is a `delegation_grant` record. Team must confirm.|
|`designation.expired`|`delegation.expired`|—|**[Discrepancy]** Same framing conflict as above row. This catalog uses `delegation.expired`.|

### §0.2 — B2 vs B4 Workflow Module Naming Conflicts

B2 was authored before B4 finalized the workflow event catalog. B4's Appendix A (the engine's own event catalog) uses different names and in some cases splits events. This catalog uses **B4 names for all Workflow module events** and notes the B2 equivalent inline.

|B2 Name|B4 Name|Relationship|
|---|---|---|
|`workflow.step_assigned`|`workflow.step.started`|Same trigger; different naming convention and field set. See §7.11.|
|`workflow.step_completed`|`workflow.step.completed`|Convention difference only (`_` vs `.`). See §7.12.|
|`workflow.lapsed` (unified)|`workflow.approval.lapsed` + `workflow.panlalawigan.deemed_approved`|B4 splits into two events by lapse type. See §7.21 and §7.22.|
|`workflow.escalated`|`workflow.sla.breached`|Same trigger; B4 also adds `workflow.sla.warning` and `workflow.sla.critical` not present in B2.|
|`workflow.certified_urgent_applied`|`workflow.certification_urgency.bypass_applied`|Same event; different names.|
|`workflow.manually_advanced`|`workflow.multi_referral.secretary_advanced`|Same event; B4 name is more specific.|
|`workflow.completed`|`workflow.instance.completed`|Same event; B4 name clarifies instance scope.|

**Audit subscription discrepancy:** B4 Appendix A marks certain events with `(Audit)` rather than marking all of them. B2 states as an architectural law: _"Any new domain event added to the bus must be registered with the Audit Event Consumer in the same PR that introduces the event. No event may ship without an Audit subscription."_ This catalog applies Audit as a consumer of every event. Where B4 does not mark `(Audit)`, the subscription is added here under `[Inference per B2 mandatory rule]`.

**[RESOLVED — OI-4]** `workflow.step.started` (B4 name, row 1 of the table above) is ratified as canonical, consistent with this section's stated rule that B4 names govern all Workflow module events. The B2 name `workflow.step_assigned` is retained only as a historical cross-reference in source notes; no consumer registration should use it. Field-level reconciliation between the two sources is handled separately at §7.11 (OI-5).

---

## §1 — Purpose and Scope

This catalog covers all domain events published to the **internal in-process event bus** of the Batac City LGU Platform. The event bus provides asynchronous, decoupled communication between the 11 domain modules of the modular monolith. Modules may not read each other's PostgreSQL schemas directly; the event bus and published module APIs are the only permitted communication paths (Architectural Law #2).

**Phase coverage:** All Phase 1 events are fully specified. Events reserved for Phase 2 (Search Meta, Records, Reporting) and Phase 3 (Portal, SMS delivery) are included where they appear as consumers or where their events are referenced in source documents. Emitter modules not yet active (Phase 2/3) are noted as such.

**Relationship to other documents:**

- B2 defines module boundary contracts including which events cross which module boundaries.
- B4 defines the workflow engine's complete internal event set.
- This document (B3) is the unified canonical catalog that reconciles both and is the direct implementation input for the event bus.

**Modules in scope:** `iam` · `organization` · `documents` · `workflow` · `tracking` · `records` · `notifications` · `audit` · `search_meta` · `portal` · `reporting`

**Emitting modules (Phase 1):** `iam` · `organization` · `documents` · `workflow`

**Consumer-only modules:** `tracking` · `notifications` · `audit` (all Phase 1) · `records` (Phase 2) · `search_meta` (Phase 2) · `portal` (Phase 3) · `reporting` (no event subscriptions)

---

## §2 — How to Read This Catalog

### §2.1 — Event Entry Format

Each event is documented with:

- A metadata table: emitter module, active phase, trigger condition, consuming modules, and primary source document.
- A **Business Reason** paragraph explaining why the event must exist (functional or legal justification).
- A **Payload Schema** as a Zod object schema defined in `/packages/shared`. The schema does not include the common envelope fields (`eventId`, `eventType`, `occurredAt`, `cityId`, `schemaVersion`); those are always present via the envelope wrapper.
- A **Notes** block where discrepancies, inferences, or implementation constraints apply.

### §2.2 — Field Naming Convention

All Zod schema field names use **camelCase** per TypeScript convention, regardless of the snake_case used in B4's source pseudocode. Conversion is mechanical: `step_instance_id` → `stepInstanceId`, `legal_basis` → `legalBasis`, etc. This conversion is applied throughout; no additional `[Inference]` label is added for the case conversion alone.

### §2.3 — Zod Validators Used

|Validator|Meaning|
|---|---|
|`z.string().uuid()`|UUID v4 string|
|`z.string().datetime({ offset: true })`|ISO 8601 datetime with timezone offset (TIMESTAMPTZ precision)|
|`z.string().date()`|`YYYY-MM-DD` date-only string (requires Zod ≥ 3.23.0)|
|`z.string()`|Unvalidated string; used where enum values are not confirmed in source|
|`z.record(z.unknown())`|JSONB object of unknown structure|
|`z.array(z.unknown())`|Array of unknown-structure elements|

### §2.4 — Emission Mechanics

[Unverified — from B4 §3.6, stated as applying to the workflow module.] [Inference — the same pattern should govern all event-emitting modules.]

Events are emitted synchronously within the database transaction that causes the state change. The relevant row in the module's event log is written in the same transaction. After the transaction commits, the event bus notifies downstream subscribers asynchronously. Downstream handler failures do not roll back the originating state change; consumers must implement their own retry logic. Events are never emitted speculatively — an event is always evidence of a committed database state.

---

## §3 — Common Types and Event Envelope

Defined in `/packages/shared/events/envelope.ts` and `/packages/shared/events/shared-types.ts`.

```typescript
import { z } from 'zod';

// ─── Shared payload types referenced by multiple events ───────────────────────

export const DocumentLifecycleStateSchema = z.enum([
  'Draft',
  'Submitted',
  'In-Workflow',
  'Pending-Approval',
  'Completed',
  'Released',
  'Archived',
  'Disposed',
  'Cancelled',   // Terminal; reachable from any active state by an authorized actor
]);
export type DocumentLifecycleState = z.infer<typeof DocumentLifecycleStateSchema>;

export const WorkflowStepTypeSchema = z.enum([
  'action',
  'approval',
  'multi_referral',
  'decision',
  'notification',
  'termination',
  'parallel_split',  // Phase 2 — schema column reserved in Phase 1 data model
  'parallel_join',   // Phase 2 — schema column reserved in Phase 1 data model
]);
export type WorkflowStepType = z.infer<typeof WorkflowStepTypeSchema>;

// ─── Common event envelope ────────────────────────────────────────────────────
// Every event published to the bus is wrapped in this envelope.
// Payload schemas below define the `payload` field only.

export const DomainEventEnvelopeSchema = <T extends z.ZodTypeAny>(payloadSchema: T) =>
  z.object({
    eventId:       z.string().uuid(),                        // UUID v4 — unique per emission
    eventType:     z.string(),                               // Namespaced string, e.g. 'document.created'
    occurredAt:    z.string().datetime({ offset: true }),    // Timestamp of committing transaction
    cityId:        z.string().uuid(),                        // Tenant isolation; Batac City UUID in Phase 1
    schemaVersion: z.number().int().min(1),                  // Starts at 1; increment on breaking payload change
    payload:       payloadSchema,
  });

// [Inference] Subscribers must handle unknown future fields gracefully (ignore, do not throw).
// Breaking payload changes require incrementing schemaVersion. Existing subscribers
// must not be broken by additive changes (new optional fields).
```

---

## §4 — IAM Module Events

**Module:** `iam` **Schema:** `iam` **Phase:** 1

IAM is the identity foundation. It emits events on authentication and role-management operations. It does not consume any domain events.

---

#### 4.1 `user.login`

|||
|---|---|
|**Emitter**|`iam`|
|**Phase**|1|
|**Trigger**|Successful user authentication — JWT issued, session record created|
|**Consumers**|`audit`|
|**Source**|B2 Module 1|

**Business Reason:** Provides a tamper-evident record of every authentication event for security audit, RA 10173 compliance, and forensic investigation. Required by B3 Context Reference §4 (all authentication events must produce an audit write).

```typescript
// /packages/shared/events/iam.ts
export const UserLoginPayloadSchema = z.object({
  userId:    z.string().uuid(),
  sessionId: z.string().uuid(),
  ipAddress: z.string(),
  userAgent: z.string(),
});
export type UserLoginPayload = z.infer<typeof UserLoginPayloadSchema>;
```

---

#### 4.2 `user.logout`

|||
|---|---|
|**Emitter**|`iam`|
|**Phase**|1|
|**Trigger**|User-initiated sign-out|
|**Consumers**|`audit`|
|**Source**|B2 Module 1|

**Business Reason:** Closes the audit trail for a session; confirms voluntary session termination as distinct from forced termination or timeout.

```typescript
export const UserLogoutPayloadSchema = z.object({
  userId:    z.string().uuid(),
  sessionId: z.string().uuid(),
  reason:    z.literal('user_action'),
});
export type UserLogoutPayload = z.infer<typeof UserLogoutPayloadSchema>;
```

---

#### 4.3 `session.terminated`

|||
|---|---|
|**Emitter**|`iam`|
|**Phase**|1|
|**Trigger**|IT/security admin forces session termination, or inactivity timeout (30-minute standard) elapses|
|**Consumers**|`audit`|
|**Source**|B2 Module 1|

**Business Reason:** System enforces a one-active-session-per-user policy. A new login from a different device terminates the prior session. IT admins can force-terminate any session with a mandatory reason. Both cases must be auditable to satisfy security obligations and RA 10173 access-control requirements.

```typescript
export const SessionTerminatedPayloadSchema = z.object({
  sessionId:    z.string().uuid(),
  userId:       z.string().uuid(),
  terminatedBy: z.string().uuid(), // [Inference] UUID of IT Admin actor; system-UUID for timeout
  reason:       z.enum(['forced', 'timeout']),
});
export type SessionTerminatedPayload = z.infer<typeof SessionTerminatedPayloadSchema>;
```

---

#### 4.4 `role.assigned`

|||
|---|---|
|**Emitter**|`iam`|
|**Phase**|1|
|**Trigger**|A role is granted to a user|
|**Consumers**|`audit`|
|**Source**|B2 Module 1|

**Business Reason:** Role assignments are an access-control event. The audit trail of all role changes is required for RA 10173 accountability and for post-incident investigation of unauthorized access.

```typescript
export const RoleAssignedPayloadSchema = z.object({
  userId:      z.string().uuid(),
  roleId:      z.string().uuid(),
  roleName:    z.string(),
  assignedBy:  z.string().uuid(),
  officeScope: z.string().uuid().optional(), // [Inference] absent when role is not scoped to a single office
});
export type RoleAssignedPayload = z.infer<typeof RoleAssignedPayloadSchema>;
```

---

#### 4.5 `role.revoked`

|||
|---|---|
|**Emitter**|`iam`|
|**Phase**|1|
|**Trigger**|A role is removed from a user|
|**Consumers**|`audit`|
|**Source**|B2 Module 1|

**Business Reason:** Role revocations are as security-critical as grants. An audit trail of revocations is required to verify that access was withdrawn at the correct time (e.g., upon employee departure).

```typescript
export const RoleRevokedPayloadSchema = z.object({
  userId:    z.string().uuid(),
  roleId:    z.string().uuid(),
  roleName:  z.string(),
  revokedBy: z.string().uuid(),
});
export type RoleRevokedPayload = z.infer<typeof RoleRevokedPayloadSchema>;
```

---

## §5 — Organization Module Events

**Module:** `organization` **Schema:** `organization` **Phase:** 1

The Organization module manages office hierarchy, employee records, and delegation (Designation) records. Designation is high-frequency (10+ Acting Mayor designations per year confirmed). One active delegation per person is enforced at both DB level (partial unique index on active `delegation_grants` per user) and application level. No Platform Admin confirmation is required — delegation takes immediate effect when Secretariat logs the Designation document.

The Organization module does not consume any domain events. It is updated only through its own Router.

---

#### 5.1 `delegation.granted`

|||
|---|---|
|**Emitter**|`organization`|
|**Phase**|1|
|**Trigger**|Secretariat logs a Designation document; `delegation_grant` record created with immediate effect|
|**Consumers**|`workflow` · `audit`|
|**Source**|B2 Module 2|

**Business Reason:** When a Mayor or Vice Mayor designates an acting authority, all active workflow steps that would be routed to the original authority must immediately re-route to the designated person. The Workflow module subscribes to this event to trigger instant re-routing without requiring a separate admin action. The event also closes the designation-numbering audit loop (D {YEAR}-{NN} number is assigned at logging).

> **Note `[Discrepancy]`:** B3 Context Reference §18 names this event `designation.activated`. This catalog uses `delegation.granted` per B2, which names the DB entity correctly (`delegation_grant`). Team must ratify.

```typescript
// /packages/shared/events/organization.ts
export const DelegationGrantedPayloadSchema = z.object({
  delegationId:          z.string().uuid(),
  designationDocumentId: z.string().uuid(), // D {YEAR}-{NN} document that initiated this grant
  delegatingUserId:      z.string().uuid(),
  delegatedToUserId:     z.string().uuid(),
  scope: z.object({
    officeId:   z.string().uuid(),
    positionId: z.string().uuid(),
  }),
  validFrom:  z.string().datetime({ offset: true }),
  validUntil: z.string().datetime({ offset: true }),
});
export type DelegationGrantedPayload = z.infer<typeof DelegationGrantedPayloadSchema>;
```

---

#### 5.2 `delegation.expired`

|||
|---|---|
|**Emitter**|`organization`|
|**Phase**|1|
|**Trigger**|pgboss scheduled job fires at `validUntil`; authority automatically returns to original holder|
|**Consumers**|`workflow` · `audit`|
|**Source**|B2 Module 2|

**Business Reason:** Open-ended delegations are prohibited — every designation must have an explicit end date. At expiry, the system must automatically restore routing to the original authority without requiring manual admin action. This event is the trigger for that re-routing.

> **Note `[Discrepancy]`:** B3 Context Reference §18 names this event `designation.expired`. This catalog uses `delegation.expired` per B2.

```typescript
export const DelegationExpiredPayloadSchema = z.object({
  delegationId:      z.string().uuid(),
  delegatingUserId:  z.string().uuid(),
  delegatedToUserId: z.string().uuid(),
  expiredAt:         z.string().datetime({ offset: true }),
});
export type DelegationExpiredPayload = z.infer<typeof DelegationExpiredPayloadSchema>;
```

---

#### 5.3 `delegation.revoked`

|||
|---|---|
|**Emitter**|`organization`|
|**Phase**|1|
|**Trigger**|Delegating authority manually revokes the designation before the `validUntil` date|
|**Consumers**|`workflow` · `audit`|
|**Source**|B2 Module 2|

**Business Reason:** Early revocation of a designation must have the same immediate routing effect as natural expiry. This event gives Workflow the signal to re-route in real time without polling.

```typescript
export const DelegationRevokedPayloadSchema = z.object({
  delegationId:      z.string().uuid(),
  delegatingUserId:  z.string().uuid(),
  delegatedToUserId: z.string().uuid(),
  revokedBy:         z.string().uuid(),
  revokedAt:         z.string().datetime({ offset: true }),
});
export type DelegationRevokedPayload = z.infer<typeof DelegationRevokedPayloadSchema>;
```

---

## §6 — Documents Module Events

**Module:** `documents` **Schema:** `documents` **Phase:** 1

The Documents module owns the document lifecycle state machine, immutable versioning, two-stage series numbering (preliminary → final), OCR on upload, file streaming to S3-compatible storage, QR cover sheet generation, and Secretariat decision logging (Approve / Reject / Amended).

**QR assignment sequence (confirmed):** Secretariat logs document → QR tracking number assigned first → Preliminary Draft number assigned second → Workflow instance created.

**Originating office rule (confirmed):** For SP workflow documents, `originatingOfficeId` is always the SP Secretariat regardless of authoring Councilor.

The Documents module does not consume any domain events. Its state is driven by user actions through its own Router and by synchronous API calls from the Workflow module.

---

#### 6.1 `document.created`

|||
|---|---|
|**Emitter**|`documents`|
|**Phase**|1|
|**Trigger**|Secretariat logs a new document; system record is created|
|**Consumers**|`tracking` · `workflow` · `audit`|
|**Source**|B2 Module 3, B2 Master Registry|

**Business Reason:** A newly logged document must immediately receive a QR tracking number (Tracking module) and a workflow instance (Workflow module). Both must happen before any other system action. The Tracking module acts first in the assignment sequence.

> **Note `[RESOLVED — OI-1]`:** B3 Context Reference §18 names this event `document.logged`. `document.created` (per B2) is ratified as canonical. See §0.1.

```typescript
// /packages/shared/events/documents.ts
export const DocumentCreatedPayloadSchema = z.object({
  documentId:          z.string().uuid(),
  documentTypeId:      z.string().uuid(),
  documentTypeName:    z.string(),
  originatingOfficeId: z.string().uuid(),
  createdBy:           z.string().uuid(),
  cityId:              z.string().uuid(), // Included explicitly per B2 payload specification
});
export type DocumentCreatedPayload = z.infer<typeof DocumentCreatedPayloadSchema>;
```

---

#### 6.2 `document.state_changed`

|||
|---|---|
|**Emitter**|`documents`|
|**Phase**|1|
|**Trigger**|The document lifecycle state machine advances to a new state|
|**Consumers**|`tracking` · `notifications` · `audit` · `search_meta` `[Phase 2]` · `portal` `[Phase 3]`|
|**Source**|B2 Module 3, B2 Master Registry|

**Business Reason:** State changes (e.g., Draft → Submitted, Released → Archived) must propagate to multiple consumers: routing history must be appended, affected parties must be notified, search indexes must be updated (Phase 2), and public portal document visibility must be synchronized (Phase 3). Centralizing this as a single event rather than direct calls preserves module isolation.

```typescript
export const DocumentStateChangedPayloadSchema = z.object({
  documentId: z.string().uuid(),
  fromState:  DocumentLifecycleStateSchema,
  toState:    DocumentLifecycleStateSchema,
  actorId:    z.string().uuid(),
  reason:     z.string().optional(),
});
export type DocumentStateChangedPayload = z.infer<typeof DocumentStateChangedPayloadSchema>;
```

---

#### 6.3 `document.number_assigned`

|||
|---|---|
|**Emitter**|`documents`|
|**Phase**|1|
|**Trigger**|A preliminary or final series number is assigned to a document|
|**Consumers**|`audit`|
|**Source**|B2 Module 3, B2 Master Registry|

**Business Reason:** Document numbering is legally significant. Preliminary numbers (`Draft 7SP 2026-01`) are assigned at Secretariat logging before workflow. Final numbers (Draft prefix removed, e.g., `7SP 2026-01`) are assigned after the last reading vote, before VP signs. Each assignment event creates an immutable audit record. The audit trail must distinguish preliminary from final assignment.

**Numbering rules reflected here:**

- Resolutions: final number assigned after Second Reading vote.
- Ordinances: final number assigned after Third Reading vote.
- Final numbers are immutable once the Draft prefix is removed.
- Separate PostgreSQL sequence per document type per year; counter never reused even if the document is cancelled.

> **Note `[RESOLVED — OI-2]`:** B3 Context Reference §18 named these as two separate events: `preliminary_number.assigned` and `final_number.assigned`. The unified B2 event with a `numberType` discriminator is confirmed as canonical; it is not being split. See §0.1.

```typescript
export const DocumentNumberAssignedPayloadSchema = z.object({
  documentId:  z.string().uuid(),
  numberType:  z.enum(['preliminary', 'final']),
  numberValue: z.string(), // Full assembled value, e.g. 'Draft 7SP 2026-01' or '7SP 2026-01'
  series:      z.string(), // Series prefix, e.g. '7SP', 'SPR', 'MO', 'NCH'
  assignedBy:  z.string().uuid(),
});
export type DocumentNumberAssignedPayload = z.infer<typeof DocumentNumberAssignedPayloadSchema>;
```

---

#### 6.4 `document.secretariat_decision` ~~[REMOVED — ADR-B2-3]~~

> **[SUPERSEDED — ADR-B2-3: Secretariat Decision Entry Point, June 2026]**
>
> This event has been **removed from the event taxonomy**. It is retained here for historical traceability only — per this team's practice of flagging superseded entries explicitly rather than silently deleting them.
>
> **What changed:** The Secretariat's "Approve / Reject / Amended" action now enters through the **Workflow Router**, not the Document Router. The Workflow Engine synchronously calls `Documents.transitionState()` as part of the same atomic operation, and emits `workflow.step.completed` (§7.12) with the `outcome` field carrying the decision result. `document.secretariat_decision` is no longer emitted by any module.
>
> **Why:** B2's own sync/async decision rule identifies "document state transition driven by workflow" as requiring the sync path for atomicity. Routing through Documents and then firing an async event to Workflow created a drift window (decision recorded in Documents while Workflow step silently failed). The direct Workflow → Documents sync path already existed in the Published API Call Matrix; the async event-driven path was a redundant second route to the same outcome.
>
> **Authoritative record:** `b2-module-boundary-and-internal-api-contracts-adrs/ADR-B2-3-secretariat-decision-entry-point.md`
>
> **Replacement:** See §7.12 `workflow.step.completed` — the `outcome` field carries `'APPROVED'` / `'REJECTED'` / `'AMENDED'` for `approval`-type steps.

~~**Original entry (Version 1.0, preserved for traceability):**~~

~~Emitter: `documents` · Phase: 1 · Trigger: Secretariat logs an Approve, Reject, or Amended decision via the Document Router · Consumers: `workflow` · `audit` · Source: B2 Module 3, B2 Master Registry~~

~~Business Reason: The Secretariat's Approve / Reject / Amended action on a submitted document must advance the corresponding workflow step. This event decoupled the Documents module (which owned the decision record) from the Workflow module (which owned step progression). The flow was Documents → Workflow via event bus.~~

~~`[Inference — from B2 Module 3 note on recordDecision()]`: The Document Router called `documentService.recordDecision()` internally, which recorded the decision and emitted this event. The Workflow module's event consumer then advanced the corresponding workflow step.~~

---

#### 6.5 `document.certification_urgency.logged`

|||
|---|---|
|**Emitter**|`documents`|
|**Phase**|1|
|**Trigger**|Secretariat logs a Mayor's written Certification of Urgency; the document is attached to one or more associated measures|
|**Consumers**|`workflow` · `audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 §6.1 `[Unverified]`|

**Business Reason:** A Certification of Urgency, once logged by the Secretariat, causes the workflow engine to bypass the `multi_referral` (committee referral) step for each associated measure and advance each instance directly to Second Reading. This is a legally sanctioned path (Mayor's written certification) that must be processed immediately and is frequent enough to require full Phase 1 support. One Certification can cover multiple measures in the same session. The Workflow module subscribes to this event and executes the bypass sequence for each listed `instanceId`.

> **Note `[RESOLVED — OI-3]`:** B3 Context Reference §18 named this event `certification_of_urgency.attached`; B4 §6.1 named it `documents.certification_urgency.logged` (plural prefix). This catalog ratifies `document.certification_urgency.logged` (singular prefix) as canonical — consistent with every other Documents-module event in this catalog. The plural form is treated as a B4 authoring inconsistency rather than an intentional convention.
> 
> **Note `[RESOLVED — OI-12, action item outside this document]`:** B2's Master Event Registry does not list this event. It must be added there (as `document.certification_urgency.logged`) in the same PR that introduces this event on the bus. This is an edit to the B2 document, outside this catalog's authority to make directly — flagged here as a required follow-up.

```typescript
export const DocumentCertificationUrgencyLoggedPayloadSchema = z.object({
  certificationDocumentId: z.string().uuid(),
  associatedInstanceIds:   z.array(z.string().uuid()), // All workflow instances to be bypassed
  loggedBy:                z.string().uuid(),
  loggedAt:                z.string().datetime({ offset: true }),
});
export type DocumentCertificationUrgencyLoggedPayload =
  z.infer<typeof DocumentCertificationUrgencyLoggedPayloadSchema>;
```

---

## §7 — Workflow Module Events

**Module:** `workflow` **Schema:** `workflow` **Phase:** 1 (core engine, all Phase 1 step types, Certified Urgent path, multi-committee referral); Phase 2 (`parallel_split`, `parallel_join` — data model columns reserved Phase 1)

The Workflow module is the custom domain-specific workflow engine for all legislative lifecycle steps. It emits events to the bus for every significant state transition. All events are persisted to `workflow.workflow_events` in the committing transaction and published to the event bus after commit. [Unverified — from B4 §3.6]

**Phase 1 step types in scope:** `action` · `approval` · `multi_referral` · `decision` · `notification` · `termination`

---

### §7.A — Instance Lifecycle Events

---

#### 7.1 `workflow.instance.created`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A new workflow instance is started for a document, triggered by consuming `document.created`|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`|

**Business Reason:** Every document that enters workflow must have a traceable instance record pinned to the definition version active at creation. This event begins the ARTA SLA clock. The instance pins to `definitionVersionId` for the lifetime of the document.

> **Note:** Not present in B2 Master Event Registry (B4 added it). Audit subscription required per B2 mandatory rule.

```typescript
// /packages/shared/events/workflow.ts
export const WorkflowInstanceCreatedPayloadSchema = z.object({
  instanceId:          z.string().uuid(),
  definitionVersionId: z.string().uuid(),
  documentId:          z.string().uuid(),
  documentType:        z.string(), // [Inference] Full enum not confirmed for all workflow-capable document types — deferred, see OI-13 (non-blocking)
  slaDeadline:         z.string().datetime({ offset: true }).nullable(),
});
export type WorkflowInstanceCreatedPayload = z.infer<typeof WorkflowInstanceCreatedPayloadSchema>;
```

---

#### 7.2 `workflow.instance.completed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The workflow instance reaches a termination step|
|**Consumers**|`records` `[Phase 2]` · `portal` `[Phase 3]` · `audit`|
|**Source**|B4 Appendix A `[Unverified]`; B2 equivalent: `workflow.completed`|

**Business Reason:** A completed workflow instance means a legislative document has cleared all required steps (readings, signatures, transmittal, Panlalawigan review). The Records module must create an archiving record and retention schedule entry. The Portal module must update public document visibility.

> **Note `[RESOLVED — OI-8]`:** B4 Appendix A lists only `instanceId`, `outcomeCode`, and `finalDocumentStatus`. `documentId` is confirmed as a required field in this payload. Rationale: both consuming modules (Records — creating an archiving/retention entry; Portal — updating public visibility) operate on a document, not merely an instance, and have no other path to the `documentId` from this event alone. Omitting it would force each consumer to make a separate lookup call back into the Workflow module for every event received, which conflicts with the event-bus design goal of decoupled, self-sufficient payloads. B4's omission is treated as a gap, not an intentional exclusion.

```typescript
export const WorkflowInstanceCompletedPayloadSchema = z.object({
  instanceId:          z.string().uuid(),
  documentId:          z.string().uuid(),          // [Inference] needed by Records and Portal consumers
  outcomeCode:         z.string(),                 // [Inference] exact outcome codes not specified in source — deferred, see OI-14 (non-blocking)
  finalDocumentStatus: DocumentLifecycleStateSchema.optional(), // [Inference] likely a DocumentLifecycleState
});
export type WorkflowInstanceCompletedPayload = z.infer<typeof WorkflowInstanceCompletedPayloadSchema>;
```

---

#### 7.3 `workflow.instance.cancelled`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A workflow instance is cancelled; `Cancelled` becomes terminal state for the document|
|**Consumers**|`audit`|
|**Source**|B4 Appendix A `[Unverified]` · `(Audit)` confirmed in B4|

**Business Reason:** Cancellation is a terminal, irreversible action that ends all further workflow processing. The mandatory reason field creates an audit trail explaining why a legislative document's workflow was terminated early.

```typescript
export const WorkflowInstanceCancelledPayloadSchema = z.object({
  instanceId:         z.string().uuid(),
  cancelledBy:        z.string().uuid(),
  cancellationReason: z.string(),
});
export type WorkflowInstanceCancelledPayload = z.infer<typeof WorkflowInstanceCancelledPayloadSchema>;
```

---

#### 7.4 `workflow.instance.stuck`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The engine evaluates transition rules for the current step and finds no matching transition|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`|

**Business Reason:** A stuck instance means the workflow engine cannot make progress — either a misconfigured definition or an unanticipated context state. The context snapshot and evaluated rules must be captured at the moment of failure to support diagnosis. An IT admin must be able to investigate and either fix the definition (publishing a new version) or manually advance the instance.

```typescript
export const WorkflowInstanceStuckPayloadSchema = z.object({
  instanceId:      z.string().uuid(),
  stepInstanceId:  z.string().uuid(),
  evaluatedRules:  z.array(z.unknown()),   // [Inference] structure of rule evaluation results not specified in source
  contextSnapshot: z.record(z.unknown()),  // [Inference] full JSONB context at moment of failure
});
export type WorkflowInstanceStuckPayload = z.infer<typeof WorkflowInstanceStuckPayloadSchema>;
```

---

#### 7.5 `workflow.instance.repassed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A workflow instance reaches a termination step with a REPASSED outcome|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`|

**Business Reason:** A REPASSED outcome occurs when a measure returned by the Panlalawigan (RETURNED outcome) is modified and re-enacted. The repass creates a new legislative cycle starting from drafting. This event distinguishes a repassed document from a normally completed one for records and reporting purposes.

```typescript
export const WorkflowInstanceRepassedPayloadSchema = z.object({
  instanceId: z.string().uuid(),
  documentId: z.string().uuid(),
});
export type WorkflowInstanceRepassedPayload = z.infer<typeof WorkflowInstanceRepassedPayloadSchema>;
```

---

#### 7.6 `workflow.instance.suspended`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|An admin suspends an active workflow instance|
|**Consumers**|`audit`|
|**Source**|B4 Appendix A `[Unverified]` · `(Audit)` confirmed in B4|

**Business Reason:** Administrative suspension halts all timer-based processing and step progression for an instance without permanently terminating it. The mandatory reason must be audited because suspension affects ARTA SLA obligations (note: system outages do not suspend ARTA obligations per B3 Context Reference §9.6 — suspension here is an administrative act, not a technical outage).

```typescript
export const WorkflowInstanceSuspendedPayloadSchema = z.object({
  instanceId:  z.string().uuid(),
  suspendedBy: z.string().uuid(),
  reason:      z.string(),
});
export type WorkflowInstanceSuspendedPayload = z.infer<typeof WorkflowInstanceSuspendedPayloadSchema>;
```

---

#### 7.7 `workflow.instance.resumed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|An admin resumes a suspended workflow instance|
|**Consumers**|`audit`|
|**Source**|B4 Appendix A `[Unverified]` · `(Audit)` confirmed in B4|

**Business Reason:** Counterpart to suspension. Resumption re-activates timer processing and step routing. Must be audited alongside the suspension event to create a complete picture of any administrative interruption.

```typescript
export const WorkflowInstanceResumedPayloadSchema = z.object({
  instanceId: z.string().uuid(),
  resumedBy:  z.string().uuid(),
});
export type WorkflowInstanceResumedPayload = z.infer<typeof WorkflowInstanceResumedPayloadSchema>;
```

---

### §7.B — Instance Migration Events

Version migration (Option B) requires second-level approval from the City Administrator and a 24-hour reversible window. All migration events are audit-required.

---

#### 7.8 `workflow.instance.migration.started`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|An in-flight instance migration (Option B) is initiated and second-level approval has been granted|
|**Consumers**|`audit`|
|**Source**|B4 Appendix A `[Unverified]` · `(Audit)` confirmed in B4|

**Business Reason:** Migrating an in-flight instance from one workflow definition version to another is a high-risk administrative action that changes the legally mandated processing path of an active legislative document. The step mapping, the actor, and the reason must be recorded for legal accountability and to support reversal within the 24-hour window.

```typescript
export const WorkflowInstanceMigrationStartedPayloadSchema = z.object({
  instanceId:    z.string().uuid(),
  fromVersionId: z.string().uuid(),
  toVersionId:   z.string().uuid(),
  actorId:       z.string().uuid(),
  reason:        z.string(),
  stepMapping:   z.record(z.string()), // [Inference] map of old stepKey → new stepKey
});
export type WorkflowInstanceMigrationStartedPayload =
  z.infer<typeof WorkflowInstanceMigrationStartedPayloadSchema>;
```

---

#### 7.9 `workflow.instance.migration.completed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The migration has successfully completed; the instance is now running under the new definition version|
|**Consumers**|`audit`|
|**Source**|B4 Appendix A `[Unverified]` · `(Audit)` confirmed in B4|

**Business Reason:** Closes the audit trail for a migration event. The combination of `migration.started`, `migration.completed` (and optionally `migration.reversed`) provides a complete tamper-evident record of every version migration action.

```typescript
export const WorkflowInstanceMigrationCompletedPayloadSchema = z.object({
  instanceId:    z.string().uuid(),
  fromVersionId: z.string().uuid(),
  toVersionId:   z.string().uuid(),
});
export type WorkflowInstanceMigrationCompletedPayload =
  z.infer<typeof WorkflowInstanceMigrationCompletedPayloadSchema>;
```

---

#### 7.10 `workflow.instance.migration.reversed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|An admin reverses a migration within the 24-hour reversible window|
|**Consumers**|`audit`|
|**Source**|B4 Appendix A `[Unverified]` · `(Audit)` confirmed in B4|

**Business Reason:** The 24-hour reversible window is a safety net for migration errors. The reversal itself must be audited with a reason and a reference to the original migration event to maintain a complete chain of custody.

```typescript
export const WorkflowInstanceMigrationReversedPayloadSchema = z.object({
  instanceId:               z.string().uuid(),
  actorId:                  z.string().uuid(),
  reversalReason:           z.string(),
  originalMigrationEventId: z.string().uuid(), // References the workflow_events row for migration.started
});
export type WorkflowInstanceMigrationReversedPayload =
  z.infer<typeof WorkflowInstanceMigrationReversedPayloadSchema>;
```

---

### §7.C — Step Lifecycle Events

---

#### 7.11 `workflow.step.started`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A step instance is activated and routed to an assignee; delegation resolution is applied|
|**Consumers**|`notifications` · `audit`|
|**Source**|B4 Appendix A `[Unverified]`; B2 equivalent: `workflow.step_assigned`|

**Business Reason:** When a workflow step is activated and assigned, the assignee (a Councilor, committee, or staff member) must be notified so they can take timely action. ARTA SLA obligations are tracked per step. Delegation resolution (substituting the designated person for the original authority) is applied before this event fires.

> **Note `[RESOLVED — OI-5]`:** B4 Appendix A's payload (`stepKey`, `assignedTo`) and B2's equivalent payload (`assigneeUserId`, `documentId`, `dueAt`) did not fully match. `documentId` and `dueAt` are confirmed as required fields in the merged schema below (not optional). Rationale: Notifications cannot compose a usable notification body without knowing which document the step belongs to, and `dueAt` is the due date displayed to the assignee — both are always known by the engine at the moment a step starts, so marking them optional would understate the actual guarantee this event makes. `dueAt` remains nullable (not every step type carries a due date, e.g. a `notification` step has none) but the field itself is always present.

```typescript
export const WorkflowStepStartedPayloadSchema = z.object({
  instanceId:     z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  stepType:       WorkflowStepTypeSchema,
  stepKey:        z.string(),                                  // from B4; unique key within the definition
  assignedTo:     z.string().uuid().nullable(),                // from B4; null for system-executed steps
  documentId:     z.string().uuid(),                           // from B2 equivalent; required — Notifications needs this to compose the notification body
  dueAt:          z.string().datetime({ offset: true }).nullable(), // from B2 equivalent; required field, nullable value — null for step types with no due date
});
export type WorkflowStepStartedPayload = z.infer<typeof WorkflowStepStartedPayloadSchema>;
```

---

#### 7.12 `workflow.step.completed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A user or system action completes a step instance|
|**Consumers**|`tracking` · `audit`|
|**Source**|B4 Appendix A `[Unverified]`; B2 equivalent: `workflow.step_completed`|

**Business Reason:** Step completion drives routing history (Tracking module appends a routing entry recording from/to office, actor, timestamp, and action type). Tracking determines the "action type" from `stepType` and `outcome`, so both are required in the payload.

> **Note `[RESOLVED — OI-10]`:** B4 Appendix A marks this event `(Audit for approval/multi_referral)` only, which read literally would mean other step types (`action`, `decision`, `notification`, `termination`) are not individually audited. This catalog confirms full audit scope — Audit subscribes to every `workflow.step.completed` emission regardless of `stepType`. Rationale: B2's architectural law states "all events" with no step-type carve-out, the project architecture reference (Part 11.11) lists "all approval actions" and "all Secretariat 'Approve/Reject/Amended' logging actions" among events that can never be disabled, and this catalog's own §9 Rule 1 states "No exceptions." B4's narrower annotation is treated as the author flagging the two highest-stakes step types for emphasis, not as a deliberate scoping decision — nothing in the source material articulates a reason to exempt the remaining step types from audit.
> 
> **Note `[RESOLVED — OI-6]`:** B4 has `actorType`, not present in B2. B2 has `stepType` and `documentId`, not present in B4. Both fields are confirmed as required (not optional) in the merged schema below. This corrects an internal inconsistency in the original draft: the Business Reason paragraph above already states "Tracking determines the 'action type' from `stepType` and `outcome`, so both are required," but the schema previously marked `stepType` as `.optional()` — required prose and optional schema cannot both be correct. `documentId` is likewise required: Tracking cannot look up the correct routing record without it.

```typescript
export const WorkflowStepCompletedPayloadSchema = z.object({
  instanceId:     z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  outcome:        z.string(),                 // [Inference] varies by stepType; exact enum not confirmed in source — see OI-15
  actorId:        z.string().uuid(),          // from B4; equivalent to 'completedBy' in B2
  actorType:      z.enum(['user', 'system']), // [Inference] from B4 actor_type field
  stepType:       WorkflowStepTypeSchema,      // from B2 equivalent; required — Tracking needs this to compute action type
  documentId:     z.string().uuid(),           // from B2 equivalent; required — Tracking needs this to locate the routing record
});
export type WorkflowStepCompletedPayload = z.infer<typeof WorkflowStepCompletedPayloadSchema>;
```

---

#### 7.13 `workflow.step.bypassed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A step is bypassed without normal completion (e.g., Certified Urgent path bypasses `multi_referral`)|
|**Consumers**|`audit`|
|**Source**|B4 Appendix A `[Unverified]` · `(Audit)` confirmed in B4|

**Business Reason:** A bypassed step represents a deviation from the standard legislative path. For Certified Urgent bypass (`bypassReason = 'CERTIFIED_URGENT'`), the audit entry records the constitutional and statutory basis. All bypasses must be fully auditable as they may be subject to legal challenge.

> **Note:** For Certified Urgent bypass, this event and `workflow.certification_urgency.bypass_applied` are both emitted within the same transaction for the active step instance. Both go to Audit. See §7.23.

```typescript
export const WorkflowStepBypassedPayloadSchema = z.object({
  instanceId:     z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  bypassReason:   z.string(),                         // Known value: 'CERTIFIED_URGENT'; others possible
  bypassedBy:     z.string().uuid().nullable(),        // [Inference] null for system-triggered bypass
});
export type WorkflowStepBypassedPayload = z.infer<typeof WorkflowStepBypassedPayloadSchema>;
```

---

#### 7.14 `workflow.step.failed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|An engine error occurs during step processing|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`|

**Business Reason:** Engine-level failures (not business-logic failures) that prevent a step from executing must be logged with error codes and messages for developer diagnosis. Unlike `workflow.instance.stuck` (no matching transition), this event represents an unexpected technical error during step execution.

```typescript
export const WorkflowStepFailedPayloadSchema = z.object({
  instanceId:     z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  errorCode:      z.string(),
  errorMessage:   z.string(),
});
export type WorkflowStepFailedPayload = z.infer<typeof WorkflowStepFailedPayloadSchema>;
```

---

### §7.D — Context Events

---

#### 7.15 `workflow.context.updated`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|One or more keys in the workflow instance context JSONB are modified|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`|

**Business Reason:** The instance context JSONB holds decision-critical fields: `mayor_action`, `panlalawigan_outcome`, `certified_urgent`, numbering references, and SLA control flags. Changes to these fields can affect document legality (e.g., recording that the Mayor signed vs. vetoed). A diff-style audit record of context changes provides traceability.

```typescript
export const WorkflowContextUpdatedPayloadSchema = z.object({
  instanceId:     z.string().uuid(),
  updatedKeys:    z.array(z.string()),
  previousValues: z.record(z.unknown()),
  newValues:      z.record(z.unknown()),
  actorId:        z.string().uuid(),
});
export type WorkflowContextUpdatedPayload = z.infer<typeof WorkflowContextUpdatedPayloadSchema>;
```

---

### §7.E — Multi-Referral Step Events

These events are specific to the `multi_referral` step type in which multiple committees are assigned simultaneously. All assigned committees must sign and contribute to the unified report before the step completes. Committees missing the Thursday cutoff are red-flagged in the Order of Business; the SP Secretary may manually advance the step with a mandatory audit-logged comment.

---

#### 7.16 `workflow.multi_referral.committee_submitted`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A committee submits its contribution document for the multi-referral unified report|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`|

**Business Reason:** In a joint committee referral, each committee's contribution must be individually tracked to determine whether all committees have submitted by the Thursday cutoff. This event is the signal that one committee has completed its part.

```typescript
export const WorkflowMultiReferralCommitteeSubmittedPayloadSchema = z.object({
  stepInstanceId:         z.string().uuid(),
  committeeId:            z.string().uuid(),
  submittedBy:            z.string().uuid(),
  contributionDocumentId: z.string().uuid(),
});
export type WorkflowMultiReferralCommitteeSubmittedPayload =
  z.infer<typeof WorkflowMultiReferralCommitteeSubmittedPayloadSchema>;
```

---

#### 7.17 `workflow.multi_referral.all_submitted`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The last unsubmitted committee submits; all committees have now contributed|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`|

**Business Reason:** Once all committees submit, the unified report can be compiled and the Second Reading can be scheduled. This event is the signal that the multi-referral step's prerequisite is met and the step is now eligible to complete.

```typescript
export const WorkflowMultiReferralAllSubmittedPayloadSchema = z.object({
  stepInstanceId: z.string().uuid(),
  allSubmittedAt: z.string().datetime({ offset: true }),
});
export type WorkflowMultiReferralAllSubmittedPayload =
  z.infer<typeof WorkflowMultiReferralAllSubmittedPayloadSchema>;
```

---

#### 7.18 `workflow.multi_referral.cutoff_missed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The Thursday cutoff passes and one or more committees have not submitted their contribution|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`; B4 §6.2 `[Unverified]`|

**Business Reason:** Committees missing the Thursday cutoff are flagged red in the Order of Business, and Second Reading is delayed to the following eligible Tuesday. `cutoffNumber` tracks how many consecutive cutoffs have been missed, which informs scheduling of the next eligible Second Reading date. The missing committee IDs are needed to render the red-flag display.

```typescript
export const WorkflowMultiReferralCutoffMissedPayloadSchema = z.object({
  stepInstanceId:      z.string().uuid(),
  cutoffTimestamp:     z.string().datetime({ offset: true }),
  missingCommitteeIds: z.array(z.string().uuid()),
  cutoffNumber:        z.number().int().positive(), // 1 for first missed Thursday; increments per missed cutoff
});
export type WorkflowMultiReferralCutoffMissedPayload =
  z.infer<typeof WorkflowMultiReferralCutoffMissedPayloadSchema>;
```

---

#### 7.19 `workflow.multi_referral.second_reading_eligible`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The eligible Tuesday for Second Reading has been computed (either all submitted, or a cutoff has cleared)|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`; B4 §6.2 `[Unverified]`|

**Business Reason:** The workflow engine must communicate to the scheduling layer the earliest date on which Second Reading can occur. This event carries that computed date so it can be used in the Order of Business preparation.

> **Note `[RESOLVED — OI-9]`:** B4 Appendix A lists `cutoffTimestampCleared` as a payload field; B4 §6.2's EMIT block pseudocode omits it. The field is confirmed as present (nullable). Rationale: the trigger condition for this event is explicitly two-branched — "either all submitted, **or** a cutoff has cleared" — so a consumer or auditor reading this event has no way to tell which branch produced it without this field. Appendix A is treated as the authoritative event catalog; §6.2 is illustrative pseudocode, and an omission there is weaker evidence of intent than its explicit inclusion in the catalog Appendix.

```typescript
export const WorkflowMultiReferralSecondReadingEligiblePayloadSchema = z.object({
  stepInstanceId:         z.string().uuid(),
  eligibleDate:           z.string().date(), // YYYY-MM-DD — requires Zod ≥ 3.23.0
  cutoffTimestampCleared: z.string().datetime({ offset: true }).nullable(), // null when eligibility came from all-committees-submitted rather than a cleared cutoff
});
export type WorkflowMultiReferralSecondReadingEligiblePayload =
  z.infer<typeof WorkflowMultiReferralSecondReadingEligiblePayloadSchema>;
```

---

#### 7.20 `workflow.multi_referral.secretary_advanced`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The SP Secretary manually overrides a blocked `multi_referral` step; a mandatory comment is required|
|**Consumers**|`audit`|
|**Source**|B4 Appendix A `[Unverified]` · `(Audit)` confirmed in B4; B2 equivalent: `workflow.manually_advanced`|

**Business Reason:** The SP Secretary is authorized to advance a blocked multi-referral step when necessary (e.g., absent or non-compliant committees). This is a legally significant manual override that must be fully audited with a mandatory comment explaining the reason. The missing committee IDs are recorded to identify which committees failed to submit in time.

```typescript
export const WorkflowMultiReferralSecretaryAdvancedPayloadSchema = z.object({
  stepInstanceId:      z.string().uuid(),
  actorId:             z.string().uuid(),
  comment:             z.string(),                    // Non-empty; mandatory per confirmed business rule
  missingCommitteeIds: z.array(z.string().uuid()),
  metadataSnapshot:    z.record(z.unknown()),          // [Inference] step metadata at time of advance
});
export type WorkflowMultiReferralSecretaryAdvancedPayload =
  z.infer<typeof WorkflowMultiReferralSecretaryAdvancedPayloadSchema>;
```

---

### §7.F — Timer and Lapse Events

---

#### 7.21 `workflow.approval.lapsed`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The 10-day Mayor review period elapses with no action; pgboss fires the scheduled job|
|**Consumers**|`notifications` · `audit`|
|**Source**|B4 Appendix A `[Unverified]`; B4 §6.3 `[Unverified]`; B2 equivalent: `workflow.lapsed` with `lapseType: 'mayor_10_day_lapsed'`|

**Business Reason:** RA 7160 Section 47 provides that if the Mayor takes no action within 10 calendar days of receiving a measure, it lapses into law. The timer is tracked from the date the Transmittal Letter (SPS format) is sent to the Mayor's Office. At lapse, the system transitions document status to "Lapsed into Law," records the RA 7160 legal basis phrase as the outcome comment, and notifies the SP Secretary. The SP Secretary must then proceed to docketing. Applies to both SP Resolutions and SP Ordinances.

> **Note `[Discrepancy]`:** B2's `workflow.lapsed` unified Mayor and Panlalawigan lapse into one event with a `lapseType` discriminator. B4 uses two separate events. This catalog follows B4's two-event model.

```typescript
export const WorkflowApprovalLapsedPayloadSchema = z.object({
  stepInstanceId: z.string().uuid(),
  legalBasis:     z.literal('RA 7160 Section 47'), // Verbatim per B4 §6.3
  deadlineWas:    z.string().datetime({ offset: true }),
});
export type WorkflowApprovalLapsedPayload = z.infer<typeof WorkflowApprovalLapsedPayloadSchema>;
```

---

#### 7.22 `workflow.panlalawigan.deemed_approved`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The 30-day Panlalawigan review period elapses with no action; pgboss fires the scheduled job|
|**Consumers**|`notifications` · `audit`|
|**Source**|B4 Appendix A `[Unverified]`; B4 §6.4 `[Unverified]`; B2 equivalent: `workflow.lapsed` with `lapseType: 'panlalawigan_30_day_deemed'`; B3 Context Reference equivalent: `panlalawigan_timer.expired`|

**Business Reason:** RA 7160 Section 56(d) provides that if the Sangguniang Panlalawigan takes no action within 30 calendar days of receiving a transmitted ordinance or resolution, it is deemed approved. The timer is tracked from the transmission date. At expiry, the system transitions status to "Deemed Approved per RA 7160 Section 56(d)," populates the remarks field with the statutory legal basis phrase, and notifies the SP Secretary.

> **Note `[Discrepancy]`:** B3 Context Reference §18 names this `panlalawigan_timer.expired`. B4 names it `workflow.panlalawigan.deemed_approved`. This catalog uses the B4 name.

```typescript
export const WorkflowPanlalawiganDeemedApprovedPayloadSchema = z.object({
  stepInstanceId:   z.string().uuid(),
  legalBasis:       z.literal('RA 7160 Section 56(d)'), // Verbatim per B4 §6.4
  transmissionDate: z.string().datetime({ offset: true }),
  deadlineWas:      z.string().datetime({ offset: true }),
});
export type WorkflowPanlalawiganDeemedApprovedPayload =
  z.infer<typeof WorkflowPanlalawiganDeemedApprovedPayloadSchema>;
```

---

### §7.G — Certification of Urgency Events

A Certification of Urgency is a formal written document issued by the Mayor. When the Secretariat logs it, the `documents` module emits `document.certification_urgency.logged` (§6.5), which the Workflow module consumes and processes. The Workflow module then emits one of the four events below depending on the state of each associated instance.

---

#### 7.23 `workflow.certification_urgency.bypass_applied`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The `multi_referral` step bypass completes successfully for an associated instance (both immediate-active and deferred cases)|
|**Consumers**|`audit`|
|**Source**|B4 Appendix A `[Unverified]` · `(Audit)` confirmed in B4; B4 §6.1 `[Unverified]`; B2 equivalent: `workflow.certified_urgent_applied`|

**Business Reason:** The bypass of the committee referral step is a legally sanctioned deviation from the standard legislative process, authorized by the Mayor's written certification. It must be fully audited with a reference to the certification document. Note that `workflow.step.bypassed` (with `bypassReason = 'CERTIFIED_URGENT'`) is also emitted within the same transaction for the active step instance; both audit entries serve the same event but at different levels of granularity.

```typescript
export const WorkflowCertificationUrgencyBypassAppliedPayloadSchema = z.object({
  instanceId:              z.string().uuid(),
  stepInstanceId:          z.string().uuid(),
  certificationDocumentId: z.string().uuid(),
});
export type WorkflowCertificationUrgencyBypassAppliedPayload =
  z.infer<typeof WorkflowCertificationUrgencyBypassAppliedPayloadSchema>;
```

---

#### 7.24 `workflow.certification_urgency.bypass_deferred`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A Certification is received and recorded for an instance, but the `multi_referral` step is not yet active; the bypass will apply when the step activates|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`; B4 §6.1 `[Unverified]`|

**Business Reason:** One Certification can cover multiple measures in the same session, and some measures may not yet have reached the `multi_referral` step when the Certification is processed. The deferred bypass must be recorded so the engine knows to apply the bypass when the step becomes active.

```typescript
export const WorkflowCertificationUrgencyBypassDeferredPayloadSchema = z.object({
  instanceId:              z.string().uuid(),
  certificationDocumentId: z.string().uuid(),
});
export type WorkflowCertificationUrgencyBypassDeferredPayload =
  z.infer<typeof WorkflowCertificationUrgencyBypassDeferredPayloadSchema>;
```

---

#### 7.25 `workflow.certification_urgency.already_past_referral`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A Certification is received for an instance whose `multi_referral` step is already completed or bypassed; no action is taken|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`; B4 §6.1 `[Unverified]`|

**Business Reason:** Provides diagnostic traceability when a Certification is logged after a measure has already passed committee referral. No state change occurs, but the fact that the Certification was received and evaluated must be recorded.

```typescript
export const WorkflowCertificationUrgencyAlreadyPastReferralPayloadSchema = z.object({
  instanceId:              z.string().uuid(),
  certificationDocumentId: z.string().uuid(),
});
export type WorkflowCertificationUrgencyAlreadyPastReferralPayload =
  z.infer<typeof WorkflowCertificationUrgencyAlreadyPastReferralPayloadSchema>;
```

---

#### 7.26 `workflow.certification_urgency.already_inactive`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|A Certification is received for an instance that is not active (already completed, cancelled, or stuck)|
|**Consumers**|`audit` `[Inference per B2 mandatory rule]`|
|**Source**|B4 Appendix A `[Unverified]`; B4 §6.1 `[Unverified]`|

**Business Reason:** Same diagnostic purpose as §7.25 but for fully inactive instances. The `instanceStatus` field identifies whether the instance was completed, cancelled, or stuck — each requiring different operator follow-up.

```typescript
export const WorkflowCertificationUrgencyAlreadyInactivePayloadSchema = z.object({
  instanceId:              z.string().uuid(),
  instanceStatus:          z.enum(['completed', 'cancelled', 'stuck']), // [Inference] from B4 §6.1 description
  certificationDocumentId: z.string().uuid(),
});
export type WorkflowCertificationUrgencyAlreadyInactivePayload =
  z.infer<typeof WorkflowCertificationUrgencyAlreadyInactivePayloadSchema>;
```

---

### §7.H — SLA Events

ARTA (RA 11032) SLA thresholds: simple ≤ 3 working days · complex ≤ 7 working days · highly technical ≤ 20 working days. SLA clock starts at workflow initiation. System outages do not suspend ARTA obligations.

---

#### 7.27 `workflow.sla.warning`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|80% of the ARTA SLA time has elapsed for the active step|
|**Consumers**|`notifications` · `audit`|
|**Source**|B4 Appendix A `[Unverified]`|

**Business Reason:** Provides an advance warning before a legally mandated SLA deadline is breached, giving the assignee time to accelerate processing before the matter escalates further. ARTA non-compliance carries administrative and civil liability consequences for LGU staff.

> **Note `[RESOLVED — OI-11, team decision]`:** Notifications consumption confirmed (no longer `[Inference]`). The team has decided on a three-tier escalation audience, distinct at each severity: **warning (80%)** notifies the step's current **assignee only** — the person who can still act before any escalation is warranted. **Breach (100%, §7.28)** notifies the **assignee's supervisor and the Records Officer**, per the project architecture reference's stated rule ("Automatic escalation at breach: notify supervisor + Records Officer"). **Critical (150%, §7.29)** adds the relevant **Department Head** to the breach audience (Department Head already exists as a role in the platform's auth model). See §7.28's note for how the audience is technically resolved (OI-7).

```typescript
export const WorkflowSlaWarningPayloadSchema = z.object({
  instanceId:     z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  slaDeadline:    z.string().datetime({ offset: true }),
  percentElapsed: z.literal(80),
});
export type WorkflowSlaWarningPayload = z.infer<typeof WorkflowSlaWarningPayloadSchema>;
```

---

#### 7.28 `workflow.sla.breached`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|The ARTA SLA deadline passes with the step still active|
|**Consumers**|`notifications` · `audit`|
|**Source**|B4 Appendix A `[Unverified]`; B2 equivalent: `workflow.escalated`|

**Business Reason:** At SLA breach, automatic escalation is required: notify the supervisor and the Records Officer. This is an ARTA compliance obligation under RA 11032. The `breachedAt` field equals `slaDeadline` per B4 (the breach moment is the deadline itself); `breachDetectedAt` is when the scheduled job detected the breach and may differ slightly from `slaDeadline` due to job scheduling timing.

> **Note `[RESOLVED — OI-7]`:** B2's `workflow.escalated` payload included `escalatedToUserIds: string[]` (the specific users notified). B4's `workflow.sla.breached` does not include this field. **Decision: the event payload does not carry escalation targets.** The Notifications module resolves them at notification time by looking up the current supervisor and Records Officer for the step's office, via the workflow definition's escalation configuration. Rationale: the project architecture reference explicitly classifies "escalation targets" as an **Administrator-configurable (no developer)** setting, distinct from data that flows through the event bus — meaning escalation targets are designed to be edited by an admin at any time without a code or schema change. If the event carried a snapshot of `escalatedToUserIds` instead, an admin's mid-flight change to escalation config would not affect already-fired-but-unprocessed events, and the snapshot could go stale between emission and consumption. Resolving at notification time avoids both problems and matches the stated configuration model. The same resolution applies to warning (§7.27) and critical (§7.29) audiences, each looked up per its own tier.

```typescript
export const WorkflowSlaBreachedPayloadSchema = z.object({
  instanceId:       z.string().uuid(),
  stepInstanceId:   z.string().uuid(),
  slaDeadline:      z.string().datetime({ offset: true }),
  breachDetectedAt: z.string().datetime({ offset: true }),
  breachedAt:       z.string().datetime({ offset: true }), // = slaDeadline per B4; the actual breach moment
});
export type WorkflowSlaBreachedPayload = z.infer<typeof WorkflowSlaBreachedPayloadSchema>;
```

---

#### 7.29 `workflow.sla.critical`

|||
|---|---|
|**Emitter**|`workflow`|
|**Phase**|1|
|**Trigger**|150% of the ARTA SLA time has elapsed for the active step|
|**Consumers**|`notifications` · `audit`|
|**Source**|B4 Appendix A `[Unverified]`|

**Business Reason:** A second escalation threshold beyond initial breach for severely overdue documents. At 150% of the SLA window, the severity warrants a distinct, wider notification. Not present in B2; B4 defines the threshold.

> **Note `[RESOLVED — OI-11, team decision]`:** Notifications consumption confirmed (no longer `[Inference]`). Per the team's tiered escalation decision (see §7.27's note), the critical-tier audience is the breach-tier audience (assignee's supervisor + Records Officer) **plus the relevant Department Head**. Resolved at notification time via the escalation configuration, same mechanism as §7.28 (OI-7) — no `escalatedToUserIds`-style field is added to this payload for the same staleness/configurability reasons given there. **Caveat:** the 150% threshold itself is sourced only from B4 (`[Unverified]`) — it does not appear in the project's primary architecture reference document, which states only an 80%-warning / breach-notification model with no third numeric tier. This catalog proceeds on B4's stated threshold since no contradicting figure exists, but the 150% number specifically (as opposed to the existence of a third escalation tier, which the team has now confirmed) has not been independently corroborated.

```typescript
export const WorkflowSlaCriticalPayloadSchema = z.object({
  instanceId:     z.string().uuid(),
  stepInstanceId: z.string().uuid(),
  slaDeadline:    z.string().datetime({ offset: true }),
  percentElapsed: z.literal(150), // [Unverified] sourced only from B4's trigger description; no corroborating figure in the project architecture reference
});
export type WorkflowSlaCriticalPayload = z.infer<typeof WorkflowSlaCriticalPayloadSchema>;
```

---

## §8 — Master Event Registry

Complete flat list of all 42 domain events. Every event in this table must have a corresponding Audit subscription. Events added to the bus in future must be added to this table in the same PR.

|#|Event Type|Emitter|Consumers|Phase|Source|
|---|---|---|---|---|---|
|1|`user.login`|`iam`|`audit`|1|B2|
|2|`user.logout`|`iam`|`audit`|1|B2|
|3|`session.terminated`|`iam`|`audit`|1|B2|
|4|`role.assigned`|`iam`|`audit`|1|B2|
|5|`role.revoked`|`iam`|`audit`|1|B2|
|6|`delegation.granted`|`organization`|`workflow` · `audit`|1|B2|
|7|`delegation.expired`|`organization`|`workflow` · `audit`|1|B2|
|8|`delegation.revoked`|`organization`|`workflow` · `audit`|1|B2|
|9|`document.created`|`documents`|`tracking` · `workflow` · `audit`|1|B2|
|10|`document.state_changed`|`documents`|`tracking` · `notifications` · `audit` · `search_meta` [Ph2] · `portal` [Ph3]|1|B2|
|11|`document.number_assigned`|`documents`|`audit`|1|B2|
|12|~~`document.secretariat_decision`~~ **[REMOVED — ADR-B2-3]**|~~`documents`~~|~~`workflow` · `audit`~~|~~1~~|Superseded — see §6.4 and ADR-B2-3. Outcome now carried in `workflow.step.completed` (row 25). `document.secretariat_decision` is no longer emitted.|
|13|`document.certification_urgency.logged`|`documents`|`workflow` · `audit`|1|B4 §6.1|
|14|`workflow.instance.created`|`workflow`|`audit` [Inf]|1|B4 App A|
|15|`workflow.instance.completed`|`workflow`|`records` [Ph2] · `portal` [Ph3] · `audit`|1|B4 App A|
|16|`workflow.instance.cancelled`|`workflow`|`audit`|1|B4 App A|
|17|`workflow.instance.stuck`|`workflow`|`audit` [Inf]|1|B4 App A|
|18|`workflow.instance.repassed`|`workflow`|`audit` [Inf]|1|B4 App A|
|19|`workflow.instance.suspended`|`workflow`|`audit`|1|B4 App A|
|20|`workflow.instance.resumed`|`workflow`|`audit`|1|B4 App A|
|21|`workflow.instance.migration.started`|`workflow`|`audit`|1|B4 App A|
|22|`workflow.instance.migration.completed`|`workflow`|`audit`|1|B4 App A|
|23|`workflow.instance.migration.reversed`|`workflow`|`audit`|1|B4 App A|
|24|`workflow.step.started`|`workflow`|`notifications` · `audit`|1|B4 App A|
|25|`workflow.step.completed`|`workflow`|`tracking` · `audit`|1|B4 App A|
|26|`workflow.step.bypassed`|`workflow`|`audit`|1|B4 App A|
|27|`workflow.step.failed`|`workflow`|`audit` [Inf]|1|B4 App A|
|28|`workflow.context.updated`|`workflow`|`audit` [Inf]|1|B4 App A|
|29|`workflow.multi_referral.committee_submitted`|`workflow`|`audit` [Inf]|1|B4 App A|
|30|`workflow.multi_referral.all_submitted`|`workflow`|`audit` [Inf]|1|B4 App A|
|31|`workflow.multi_referral.cutoff_missed`|`workflow`|`audit` [Inf]|1|B4 App A|
|32|`workflow.multi_referral.second_reading_eligible`|`workflow`|`audit` [Inf]|1|B4 App A|
|33|`workflow.multi_referral.secretary_advanced`|`workflow`|`audit`|1|B4 App A|
|34|`workflow.approval.lapsed`|`workflow`|`notifications` · `audit`|1|B4 App A|
|35|`workflow.panlalawigan.deemed_approved`|`workflow`|`notifications` · `audit`|1|B4 App A|
|36|`workflow.certification_urgency.bypass_applied`|`workflow`|`audit`|1|B4 App A|
|37|`workflow.certification_urgency.bypass_deferred`|`workflow`|`audit` [Inf]|1|B4 App A|
|38|`workflow.certification_urgency.already_past_referral`|`workflow`|`audit` [Inf]|1|B4 App A|
|39|`workflow.certification_urgency.already_inactive`|`workflow`|`audit` [Inf]|1|B4 App A|
|40|`workflow.sla.warning`|`workflow`|`notifications` · `audit`|1|B4 App A|
|41|`workflow.sla.breached`|`workflow`|`notifications` · `audit`|1|B4 App A|
|42|`workflow.sla.critical`|`workflow`|`notifications` · `audit`|1|B4 App A|

**Legend:** `[Inf]` = `[Inference per B2 mandatory audit rule or logical module responsibility]` · `[Ph2]` = Phase 2 subscription · `[Ph3]` = Phase 3 subscription

---

## §9 — Mandatory Rules

The following rules are non-negotiable prior to event bus implementation. They are derived from B2 Architectural Law #2 and the B2 prohibited patterns section.

**Rule 1 — All events must have Audit subscription.** Any event type published to the bus that is not registered with the Audit Event Consumer's subscription list before the PR merges is a prohibited pattern (B2: P4). No exceptions. This applies to every row in the Master Event Registry including those marked `[Inference]`.

**Rule 2 — New events require catalog update in the same PR.** No domain event may be introduced in application code without a corresponding entry added to this catalog in the same PR. The catalog is the single source of truth for the event bus contract.

**Rule 3 — Breaking payload changes require schemaVersion increment.** `schemaVersion` starts at 1. Removing a field, renaming a field, or changing a field type is a breaking change. Adding an optional field is not breaking but must still be reflected in this catalog. Consumers must handle unknown fields gracefully (ignore, do not throw).

**Rule 4 — Schemas live in `/packages/shared`.** All payload schemas are Zod schemas defined in `/packages/shared/events/`. The type safety chain is: Drizzle schema → drizzle-zod → Zod schemas in `/packages/shared` → all consumers. No consumer module may define its own payload type for another module's events.

**Rule 5 — Events are evidence, not instructions.** An event is never emitted speculatively or in anticipation of a future state. An event is always emitted within the committing database transaction, after the state change is written. Downstream handlers are asynchronous; their failure must not roll back the originating transaction.

**Rule 6 — Audit writes go through the Audit service only.** No emitting module writes directly to the `audit` schema. The Audit module's event consumer is the only writer to `audit.events`. This is enforced at the DB level (REVOKE UPDATE/DELETE on audit schema from application DB role).

---

## §10 — Open Items — Resolution Status

All items below were originally raised as requiring a team decision before implementation. This table now records the disposition of each. Items resolved by inference/architectural-precedent are marked `[Resolved — decided per B3 authority]`; the one item requiring a genuine product/stakeholder judgment call is marked `[Resolved — team decision]` with the decision recorded; items intentionally deferred pending other unfinished work remain `[Deferred — non-blocking]`.

| #     | Item                                                                                                                                    | Blocking | Resolution                                                                                                                                                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OI-1  | Event name `document.created` vs `document.logged` (§0.1 row 1)                                                                         | Yes      | **[Resolved]** `document.created` ratified. See §0.1.                                                                                                                                                                                                                                             |
| OI-2  | `document.number_assigned` unified event vs two separate events `preliminary_number.assigned` / `final_number.assigned` (§0.1 rows 2–3) | Yes      | **[Resolved]** Unified event with `numberType` discriminator retained. See §0.1.                                                                                                                                                                                                                  |
| OI-3  | `documents.certification_urgency.logged` prefix — plural `documents.` vs singular `document.` (§6.5 notes)                              | Yes      | **[Resolved]** Normalized to singular `document.certification_urgency.logged` throughout this catalog. See §0.1, §6.5, §7.G intro, §8 row 13.                                                                                                                                                     |
| OI-4  | B4 `workflow.step.started` vs B2 `workflow.step_assigned` — which name is canonical? (§0.2, §7.11)                                      | Yes      | **[Resolved]** `workflow.step.started` (B4 name) ratified, consistent with §0.2's stated B4-precedence rule for Workflow events. See §0.2.                                                                                                                                                        |
| OI-5  | `workflow.step.started` missing `documentId` and `dueAt` that exist in B2's equivalent (§7.11 notes)                                    | Yes      | **[Resolved]** Both confirmed required (not optional) in the payload. See §7.11.                                                                                                                                                                                                                  |
| OI-6  | `workflow.step.completed` missing `stepType` and `documentId` that exist in B2's equivalent (§7.12 notes)                               | Yes      | **[Resolved]** Both confirmed required (not optional) in the payload — this also corrects an internal prose/schema contradiction in the original draft. See §7.12.                                                                                                                                |
| OI-7  | `workflow.sla.breached` missing `escalatedToUserIds` that exists in B2's `workflow.escalated` (§7.28 notes)                             | Yes      | **[Resolved]** Confirmed: Notifications resolves escalation targets from admin-configurable escalation config at notification time; no targets field added to the payload. See §7.28.                                                                                                             |
| OI-8  | `workflow.instance.completed` missing `documentId` (§7.2 notes)                                                                         | Yes      | **[Resolved]** Confirmed required in the payload. See §7.2.                                                                                                                                                                                                                                       |
| OI-9  | `workflow.multi_referral.second_reading_eligible` — presence of `cutoffTimestampCleared` field (§7.19 notes)                            | Yes      | **[Resolved]** Field confirmed present (nullable), following B4 Appendix A over the §6.2 EMIT-block omission. See §7.19.                                                                                                                                                                          |
| OI-10 | Audit scope for `workflow.step.completed` — all step types, or only `approval` and `multi_referral` as B4 implies (§7.12 notes)         | Yes      | **[Resolved]** Confirmed: Audit subscribes to every emission regardless of step type. See §7.12.                                                                                                                                                                                                  |
| OI-11 | `workflow.sla.warning` and `workflow.sla.critical` consumer list — Notifications subscription is `[Inference]` (§7.27, §7.29)           | Yes      | **[Resolved — team decision]** Notifications confirmed as a consumer of both. Escalation audience is tiered by severity: warning → assignee only; breach → assignee's supervisor + Records Officer; critical → breach audience + Department Head. See §7.27, §7.28, §7.29.                        |
| OI-12 | `documents.certification_urgency.logged` missing from B2 Master Registry — B2 must be updated                                           | Yes      | **[Resolved — action item outside this document]** Confirmed the event (under its corrected name, see OI-3) must be added to B2's Master Registry in the same PR that introduces it on the bus. This is an edit to the B2 document, not something this catalog can complete on its own. See §6.5. |
| OI-13 | `workflow.instance.created` `documentType` field — full enum of workflow-capable document types                                         | No       | **[Deferred — non-blocking, confirmed]** No enum of workflow-capable document types exists yet in any source document, including the project's primary architecture reference. Remains `z.string()` until that enum is finalized elsewhere. See §7.1.                                             |
| OI-14 | `workflow.instance.completed` `outcomeCode` field — exact outcome code values                                                           | No       | **[Deferred — non-blocking, confirmed]** No outcome-code enum exists yet in any source document. Remains `z.string()` until termination step configurations are finalized. See §7.2.                                                                                                              |
| OI-15 | `workflow.step.completed` `outcome` field — exact outcome values per step type                                                          | No       | **[Deferred — non-blocking, confirmed]** No per-step-type outcome enum exists yet in any source document. Remains `z.string()` until step type configurations are finalized. See §7.12.                                                                                                           |

---

_End of B3 — Internal Domain Event Catalog v1.0. This document supersedes all event name references in B3 Context Reference §18. It does not supersede B2 (Module Boundary and Internal API Contracts) or B4 (Workflow Engine Specification); discrepancies between this catalog and those documents must be resolved through the open items in §10._