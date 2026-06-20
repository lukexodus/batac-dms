# B3 Context Reference — Internal Domain Event Catalog

**Purpose:** Consolidated context for authoring B3 — the Internal Domain Event Catalog. Contains only the information needed to define every domain event: its name, producing module, consuming modules, Zod payload schema, and business reason.

**Sources:** `tech-stack.md` + `consolidated-architecture-and-requirements-reference-iteration-3.md` (Post-Interview 2, developer decisions resolved)

---

## 1. Architecture Foundation — Why This Catalog Exists

### 1.1 Pattern: Modular Monolith with Internal Event Bus

Microservices at 100–250 users with a 4-person team is an operational anti-pattern. The modular monolith gives clean domain separation with an extraction path if needed. The **internal in-process event bus** decouples modules without distributed systems overhead.

### 1.2 Module Boundaries

Each module owns its own PostgreSQL schema. Modules communicate **only** through the internal event bus or published module API interfaces. No module reads another module's schema directly. No cross-schema foreign key constraints.

```
Modules:
  iam           → users, credentials, sessions, roles, permissions
  organization  → offices, positions, employees, assignments, delegations
  documents     → document types, documents, versions, attachments, numbers, signatures
  workflow      → definitions, versions, steps, instances, step instances, events
  tracking      → tracking records, routing entries, qr codes
  records       → records, retention schedules, archive entries, classification
  notifications → templates, events, delivery logs
  audit         → events (append-only, hash-chained)
  search_meta   → search index metadata (Phase 2)
  portal        → public documents, citizen requests, complaints, announcements (Phase 3)
  reporting     → report definitions, schedules, outputs (Phase 2)
```

### 1.3 Architectural Laws (Non-Negotiable)

1. Each module owns its own PostgreSQL schema. No cross-schema foreign key constraints.
2. Modules communicate through the event bus or published module APIs only. Never by direct schema access.
3. Audit writes go through the audit service only. No module writes directly to the audit schema.
4. All file references are UUID storage keys. Never original filenames.
5. All infrastructure is defined in code. No manual cloud resource creation.

### 1.4 Multi-Committee Referral Implication on Workflow Events

The `workflow` module's `multi_referral` step type assigns to multiple committees simultaneously. Behavior:

- All assigned committees must sign and contribute to the unified report before the step completes.
- Committees missing the Thursday cutoff are marked red in the Order of Business but do not stop the hearing.
- SP Secretary can manually advance the step (audit-logged with a mandatory comment).
- Completes when the unified committee report is submitted and accepted by the SP Secretary.

This is a schema decision that must be reflected in workflow event payloads before the first workflow module migration.

---

## 2. Type Safety Chain — How Event Payload Schemas Are Authored

```
Drizzle schema (PostgreSQL)
  └─▶ drizzle-zod → Zod schemas
        └─▶ /packages/shared (single source of truth)
              ├─▶ Fastify route validation (fastify-type-provider-zod)
              ├─▶ tRPC procedure input validation
              ├─▶ React Hook Form validation (@hookform/resolvers/zod)
              └─▶ TanStack Query response types
```

- **All event payload schemas are Zod schemas** defined in `/packages/shared`.
- A DB schema change propagates as a compile error to every layer.
- The event bus consumes these same shared Zod schemas for payload typing and runtime validation.

**Relevant stack entries:**

|Layer|Choice|Constraint|
|---|---|---|
|Validation / contracts|Zod (shared package)|Single source of truth: backend validation, DB types, frontend|
|Backend framework|Fastify|Schema-first routes; plugin scope enforces module encapsulation|
|Internal API|tRPC on Fastify|End-to-end type safety for `/web` — no REST for internal routes|
|Database|PostgreSQL|JSONB, Row-Level Security, append-only audit grants|
|ORM|Drizzle ORM + Drizzle Kit|Full PostgreSQL feature access with TypeScript inference|
|Real-time notifications|Server-Sent Events (SSE)|One-directional push; no WebSocket infrastructure needed|
|Scheduling|node-cron (simple) + pgboss (durable)|Durable jobs relevant to timer-based events|

**Monorepo structure (event bus lives in `/server`; schemas in `/packages/shared`):**

```
/apps
  /web        — Vite + React SPA (internal authenticated app)
  /server     — Fastify backend (tRPC + REST routes, single process)
  /portal     — Next.js (public citizen portal — Phase 3 only)

/packages
  /shared     — Zod schemas, TypeScript types, API contracts, constants
  /ui         — Shared React component library (shadcn/ui + Tailwind)
  /config     — Shared ESLint, TypeScript, Prettier, tsconfig
  /database   — Drizzle schema, migrations, query helpers, seed data

/tools
  /scripts    — Deployment, DB seeding, maintenance, migration scripts
```

---

## 3. Database Conventions — Invariants Affecting Event Payloads

|Convention|Decision|
|---|---|
|Primary keys|UUID v4 (`gen_random_uuid()`) everywhere|
|Timestamps|`TIMESTAMPTZ` on every timestamp column|
|Soft-delete|`deleted_at TIMESTAMPTZ` + `deleted_by UUID` on every table — no hard deletes|
|Tenant isolation|`city_id UUID NOT NULL` in all core entity tables (default: Batac City UUID)|
|Cross-schema FKs|Prohibited — enforced by automated migration linting|

**Schema map (module → PostgreSQL schema):**

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

**PostgreSQL non-negotiables relevant to events:**

- **Append-only audit:** REVOKE `UPDATE` and `DELETE` on the audit schema from the application DB user. Only `INSERT` permitted. The `audit.events` table is written to only via the audit service — never directly by producing modules.
- **Sequences for gapless document numbering:** Use PostgreSQL sequences with appropriate configuration per series per year. Numbering events must be atomic with sequence consumption.
- **Check constraints for state transitions:** Enforce valid workflow state transitions at the DB level as a second line of defense. State transition events must match allowed transitions.

---

## 4. Audit Log — Events Always Written

The audit log is append-only. Every domain event that touches any of the following **must** also emit an audit write (via the audit service, not directly):

- All authentication events
- All document state changes
- All approval actions
- All delegation grants/revocations
- All role assignments/revocations
- All bulk operations
- All exports
- All session terminations
- All workflow definition publishes/deprecations
- All workflow instance version-migration executions (Option B)
- All RA 10173 erasure actions
- All Secretariat "Approve/Reject/Amended" logging actions

**Audit log integrity:** SHA-256 hash chain + HMAC-SHA-256 per entry. Node built-in `crypto` only. No external library.

---

## 5. Authentication Events — Context for IAM Module

**Token architecture:**

|Decision|Value|
|---|---|
|Access token|JWT, 15–60 minutes|
|Refresh token storage|Server-side database (hashed value)|
|Cookie attributes|HTTP-only, Secure, SameSite=Strict|
|Client-side storage|Never localStorage or sessionStorage|

**Session management rules (drive IAM events):**

|Rule|Value|
|---|---|
|Standard timeout|30 minutes of inactivity|
|Concurrent sessions|One active session per user|
|New login from different device|Logs out previous session; notification sent to user|
|Forced logout|IT/security admin can force-terminate (audit-logged with reason)|
|Shared workstation suspend|"Switch User / Lock Screen" suspends without terminating|

---

## 6. Document Lifecycle States

```
Draft → Submitted → In-Workflow → Pending Approval → Completed → Released → Archived → Disposed
```

`Cancelled` is a terminal state reachable from any active state by an authorized actor.

**Classification levels:**

|Level|Access|
|---|---|
|Public|All users + public portal|
|Internal|Authenticated LGU employees|
|Confidential|Restricted to explicit role allowlist|
|Restricted|Restricted to explicit role allowlist|

**Versioning:** All previous versions retained. No overwrite. No permanent deletion.

**Physical-to-digital correspondence:** When a physical document is printed, wet-ink signed, and scanned back, the system flags the scanned image for manual verification by a Records Officer before acceptance as the official copy.

---

## 7. Document Numbering — Events and Rules

### 7.1 Confirmed Number Formats

|Document Type|Preliminary Format|Final Format|Counter Scope|
|---|---|---|---|
|Resolution|`Draft 7SP {YEAR}-{NN}`|`7SP {YEAR}-{NN}`|Per year; resets. Final assigned after Second Reading vote, before VP sign.|
|Ordinance|`Draft 7SP {YEAR}-{NN}`|`7SP {YEAR}-{NN}`|Per year; resets. Final assigned after Third Reading vote, before VP sign.|
|Appropriation Ordinance|Same as Ordinance|Same as Ordinance|Per year; resets|
|Notice of Committee Hearing|N/A|`NCH {YEAR}-{NN}`|Per year; resets; separate counter from NOSP|
|Notice of Special Session|N/A|`NOSP {YEAR}-{NN}`|Per year; resets; separate counter from NCH|
|Designation|N/A|`D {YEAR}-{NN}`|Per year; resets|
|Letters Received|N/A|`SPR {YEAR}-{NN}`|Per year; resets; separate from SPS|
|Letters Sent|N/A|`SPS {YEAR}-{NN}`|Per year; resets; separate from SPR|
|Memo Outgoing|N/A|`MO {YEAR}-{NN}`|Per year; resets; separate from MI|
|Memo Incoming|N/A|`MI {YEAR}-{NN}`|Per year; resets; separate from MO|
|Panlalawigan Review (SP's log)|N/A|`{YEAR}-{NN}`|Per year; resets|

**Delimiter:** Space throughout — `SPR 2026-01`, `MO 2025-01`, `D 2024-01`, `NCH 2026-01`. The `number_series.format` field stores this assembled format string.

### 7.2 Numbering Architecture Rules

|Rule|Decision|
|---|---|
|Preliminary number format|`"Draft " + {series_prefix} + " " + {YEAR} + "-" + {NN}` — e.g., `Draft 7SP 2026-02`. Assigned at secretariat logging.|
|Preliminary number mutability|Draft numbers can change before finalization. Nullable `preliminary_number` field; replaced when finalized.|
|Final number assignment|Resolutions: after Second Reading vote. Ordinances: after Third Reading vote. Before VP and Mayor sign. Secretariat assigns.|
|Delimiter|Space confirmed for all document types.|
|Deferred assignment|Letters/memos: control numbers may not be assigned immediately at receipt. Nullable `control_number` supported.|
|Immutability|Final numbers (after "Draft" removed) are immutable. Preliminary numbers can be replaced before finalization.|
|Gaps|Permitted only for cancelled documents; gap logged with cancellation reason.|
|Reuse|Never, even if cancelled.|
|Counters|Separate PostgreSQL sequence per document type per year — no shared counter.|
|QR tracking number|System-generated UUID, independent of preliminary and final numbers. Assigned at secretariat logging (before preliminary number). Immutable for document's life.|

---

## 8. QR Code and Tracking — Events and Rules

|Decision|Value|
|---|---|
|QR content|Unique tracking ID only (not a URL, not document content)|
|Tracking number format|Configurable; default: `DTS-{YEAR}-{SEQUENCE}`|
|QR assignment point|At secretariat logging, **before** preliminary number is assigned|
|Assignment sequence|Councilor Draft → Secretariat Logs → QR assigned → Preliminary Draft number assigned|
|QR code survives|Throughout entire document lifecycle (preliminary through final, through Mayor signature)|
|Immutability|QR tracking number never changes after assignment|
|Scan result|Document type, remarks, history from draft, first page visible; other pages blurred|
|Routing history|Every movement recorded: from, to, actor, timestamp, action|
|Physical custody|Tracked separately from digital workflow status|

---

## 9. Workflow Engine — Step Types and Timer Events

### 9.1 Phase 1 Step Types

|Type|Description|Phase|
|---|---|---|
|action|User performs an action (review, comment)|Phase 1|
|approval|User approves, rejects, or returns for revision|Phase 1|
|multi_referral|Assigns to multiple committees simultaneously; all committees must sign/contribute to unified report; committees missing Thursday cutoff delay Second Reading; absent committees marked red in Order of Business; SP Secretary can manually advance (audit-logged)|Phase 1|
|decision|System evaluates a condition; routes accordingly|Phase 1|
|notification|System sends a notification; no user action required|Phase 1|
|termination|Ends the workflow|Phase 1|
|parallel_split|Splits into parallel branches|Phase 2 (reserved in data model)|
|parallel_join|Merges parallel branches|Phase 2 (reserved in data model)|

### 9.2 Mayor's 10-Day Lapse-into-Law (Timer Event)

Applies to **both SP Resolutions AND SP Ordinances**. At day 10 with no Mayor action, system transitions to "Lapsed into Law," logs RA 7160 legal basis, and notifies SP Secretary. Timer is tracked from the date the Transmittal Letter is sent to the Mayor.

### 9.3 Certified Urgent Path

- Mayor issues a formal written Certification of Urgency document (not verbal).
- Secretariat logs the Certification — does not create or authorize it.
- A single Certification can cover multiple measures in the same session.
- The Certification has no standalone numbering — attached to the associated measure(s).
- Upon logging: each associated measure's workflow instance bypasses the committee referral step and advances directly to Second Reading.
- **Certified Urgent Resolutions and Ordinances skip committee review and report entirely.**
- First and Second Reading occur in the same session.
- Frequency: frequent — must be supported fully in Phase 1.

### 9.4 Panlalawigan 30-Day Review Timer

- 30-day timer tracked from transmission date.
- At day 30 with no response: system transitions status to "Deemed Approved per RA 7160 Section 56(d)" and notifies SP Secretary.
- Remarks field populated with the statutory legal basis phrase.
- When Panlalawigan acts within 30 days: SP Secretariat receives a formal written notification (Panlalawigan resolution).

### 9.5 Amendments

- **Resolutions:** at Second Reading. Secretariat logs and finalizes. No third reading.
- **Ordinances:** at Second Reading. Third Reading reads the final amended version.

### 9.6 SLA and Escalation (ARTA)

- SLA clock starts at workflow initiation.
- Warning at 80% of SLA time.
- Automatic escalation at breach: notify supervisor + Records Officer.
- ARTA defaults: simple ≤ 3 working days; complex ≤ 7 working days; highly technical ≤ 20 working days.
- System outage does not suspend ARTA obligations.

### 9.7 Workflow Instance Version Pinning

Instance pins to definition version active at creation. In-flight migration (Option B) requires 2nd-level approval from City Administrator, 24-hour reversible window, and a dedicated audit event.

### 9.8 Transmittal Letter as Workflow Step

When a resolution or ordinance reaches the Mayor's review step, the system generates (or prompts Secretariat to generate) a Transmittal Letter (SPS format) to the Mayor's Office — formal cover letter "For appropriate action."

### 9.9 Hardcoded Workflow Constraints

|Document Type|Minimum Required Steps|
|---|---|
|SP Resolution|Committee referral OR Certified Urgent path; Second Reading vote; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Release|
|SP Ordinance / Appropriation Ordinance|Committee referral OR Certified Urgent path; 3 readings; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Publication (if penalty); Release|

---

## 10. SP Resolution Workflow — State Transitions (Condensed, No Diagram)

**Assignment sequence:** Councilor/SP Staff drafts → Secretariat logs → QR assigned → Preliminary Draft number assigned → Consolidated into Order of Business (Thursday cutoff) → First Reading (Tuesday; VP refers to committee/s) → Committee/s (joint hearing if multi-referred; unified report due Thursday) **OR** Certified Urgent path (skip to Second Reading same session) → Second Reading (debate, amendments if any; Secretariat logs amended final copy if amended) → [If amendments: final vote on amended version] → SP Secretary assigns Final Number (Draft prefix removed) → VP signs → Transmittal Letter to Mayor → Mayor action within 10 calendar days:

- **Mayor signs** → Returns to SP Secretariat → Docketing
- **10-day lapse** → Lapsed into Law (RA 7160) → SP Secretary notified → Docketing
- **Mayor vetoes** → Returned to SP → Override vote (2/3 = 8 of 12) → If override succeeds → Docketing; If fails → Archived

After docketing → Panlalawigan review (30-day timer) → Outcome:

- **VALID** → SP Secretary records → Notification to relevant offices → Publication (title + first page public) → Archive
- **VALID-IN-PART** → Manual review (Secretariat decides: resolve as-is / route to Legal / route to Committee / implement directly)
- **RETURNED** → Follow recommendations; implementation stops; may repass (back to drafting)
- **30 days no action** → Deemed Approved (RA 7160 §56d) → Remarks: "Lapsed 30 days" → Publication → Archive

**Key numbering facts:**

- Preliminary numbers can change between readings (sequence depends on which document completes its last reading vote first).
- QR assigned before preliminary number; both assigned at secretariat logging.

---

## 11. SP Ordinance Workflow — State Transitions (Condensed)

Same as Resolution **except:**

- Three readings (First Reading: referral; Second Reading: amendments; Third Reading: final version with amendments; final vote).
- Final number assigned after **Third Reading vote**, before VP signs.
- Publication required only if ordinance has a penalty provision (full text in newspaper; SP Secretariat arranges with Ilocos Times; publication date is a mandatory tracked field).
- Panlalawigan outcome type: **OPERATIVE IN ITS ENTIRETY** (applies specifically to Appropriation Ordinances; synonymous with VALID).

**Appropriation Ordinance:** Same workflow as regular Ordinance. Included in Phase 1.

---

## 12. Panlalawigan Review — All Outcome Types

|Outcome|Meaning|
|---|---|
|VALID|Approved by Panlalawigan|
|VALID-IN-PART|Partially approved; some provisions found invalid; Secretariat decides path|
|RETURNED|Returned with objections; implementation stops; may repass|
|Referred to committee|Panlalawigan committee review in progress; 30-day clock running|
|OPERATIVE-IN-ITS-ENTIRETY|Appropriation Ordinances only; synonymous with VALID|
|(blank — 30 days elapsed)|Deemed approved per RA 7160 §56(d); Remarks: "Lapsed 30 days"|

**VALID-IN-PART system behavior:** Marks document VALID-IN-PART, attaches Panlalawigan response, places step in "Awaiting SP Secretariat Action." SP Secretary chooses: (1) Resolve as-is with mandatory comment; (2) Route to Legal Office; (3) Route to concerned Committee; (4) Implement revisions directly without repassing. All choices audit-logged.

**RETURNED system behavior:** High-priority flag; Secretariat decides path. Standard outcome: modify and repass (back to drafting). No formal legal challenge mechanism exists. Implementation stops.

---

## 13. Designation Workflow — Events and Rules

### 13.1 Confirmed Rules

|Rule|Value|
|---|---|
|Who initiates|Original authority only (Mayor or Vice Mayor per scope)|
|Platform Admin confirmation|**Not required** — immediate effect|
|Multiple simultaneous active designations|**NOT ALLOWED** — one active designation per person at a time|
|Expiry|Automatic at end date — authority returns to original authority automatically|
|Early revocation|Permitted by delegating person|
|Open-ended delegations|Prohibited — duration must always be explicit|
|Frequency|High — 10+ Acting Mayor designations in 2023–2024 alone|

### 13.2 System Behavior Sequence

1. Mayor or Vice Mayor issues Designation document
2. Secretariat receives and logs it (D {YEAR}-{NN} number; QR assigned at logging)
3. Staff manually extracts scope and time bounds; enters in system
4. `delegation_grant` record created: **immediate effect, no Platform Admin confirmation**
5. System routes affected workflow steps to the designated person for the duration
6. Auto-expires at end date: routing returns to original authority automatically
7. One active designation per person enforced: DB partial unique index on active `delegation_grants` per user

### 13.3 Administration Transition Interaction

- No formal transition procedure exists.
- In-flight documents requiring the prior Mayor's signature automatically wait for the new Mayor — no manual reassignment required.

---

## 14. Certification of Urgency — Events and Rules

|Field|Detail|
|---|---|
|Issued by|Mayor (formal written document — not verbal)|
|Logged by|SP Secretariat (receives and logs; does not create or authorize)|
|Number format|**No standalone number** — attached to the measure(s) it certifies|
|Attachment|Attached to each associated measure individually in the system|
|Scope per certification|A single Certification can cover multiple measures in the same session|
|Workflow effect|Associated measure's workflow instance bypasses committee referral; advances to Second Reading|
|Phase|Phase 1|

---

## 15. Citizen Complaint — Events and States

**Routing:** Secretariat decides — no fixed routing path.

**Resolution process:**

1. Complaint received and logged by Secretariat
2. Secretariat routes to appropriate committee
3. Committee renders report
4. Secretariat logs the report
5. Secretariat sends report to complainant
6. Secretariat marks complaint as resolved

**Outcome states:**

|State|Meaning|
|---|---|
|Pending Hearing|Complaint received; committee referral in progress|
|Received/Seen|VM and/or Committee has seen the complaint (intermediate)|
|Dismissed|Complaint dismissed|
|Resolved|Committee report issued; complainant notified; case closed|

**Respondent notification:**

- Has email → notification + formal written notice sent by email
- Has only contact number → SMS/phone notification; respondent claims formal notice in person

---

## 16. OCR Events

- OCR runs automatically on upload.
- System detects scan quality and always shows a scan quality indicator to the user.
- User decides whether to perform a manual re-scan.
- OCR is applied to historical records migrated from LMITS.

---

## 17. Architectural Invariants Relevant to Events

|#|Invariant|Enforcement Method|
|---|---|---|
|1|Schema-per-module; no cross-schema foreign keys|Automated migration linting; code review policy|
|2|Soft-delete everywhere; no hard deletes|Repository layer; code review policy|
|3|Audit log INSERT-only at DB role level|PostgreSQL role permissions set in migration|
|4|Workflow instance pins to definition version at creation|DB column `definition_version_id`|
|5|S3-compatible API only; UUID file keys|No provider SDK imports allowed; code review policy|
|6|UUID v4 primary keys everywhere|Migration linting|
|7|TIMESTAMPTZ for all timestamps|Migration linting|
|8|`city_id UUID NOT NULL` in all core entity tables|Migration schema|
|9|Numbering assigned at defined lifecycle event only|Workflow engine constraint|
|10|IT admin has no document content access|PostgreSQL RLS + application ABAC policy|
|11|Document type must have retention schedule before activation|Application validation constraint|
|12|Platform Administrator role cannot be combined with operational roles|Role assignment validation|
|13|Encoder and final approver of same document cannot be the same user|Workflow engine constraint|
|14|Workflow constraints per document type (legally mandated minimum steps)|Workflow editor validation|
|16|One active designation per person at any time|Application-level validation + DB partial unique index|

---

## 18. Events Explicitly Named in Source Documents

The following event names are mentioned directly in the source documents and are the minimum confirmed set. The catalog must cover these and derive additional ones from the workflows above.

- `document.logged` — document received and logged by Secretariat
- `workflow.step_assigned` — workflow step assigned to a user or committee
- `preliminary_number.assigned` — Draft prefix number assigned at secretariat logging
- `final_number.assigned` — Draft prefix removed; final series number assigned after last reading vote
- `certification_of_urgency.attached` — Certification of Urgency attached to a measure; triggers bypass of committee referral
- `panlalawigan_timer.expired` — 30-day review timer expired; document deemed approved per RA 7160 §56(d)
- `designation.activated` — delegation_grant created; routing immediately updated
- `designation.expired` — delegation_grant reached end date; routing returned to original authority

---

## 19. Extensibility Tiers — What Requires Developer vs. Admin

**Developer-only (code change + deployment) — relevant to event bus:**

- New domain event types
- Changes to audit log schema
- New auth provider integration
- New notification delivery channels
- ABAC policy engine changes
- Database schema migrations

**Administrator-configurable (no developer) — drives configuration-driven events:**

- All workflow definitions and step configurations
- Document type definitions and JSONB metadata schemas
- Office hierarchy
- Role definitions and permission assignments
- Notification templates
- Retention schedules
- SLA thresholds and escalation targets
- Numbering series

---

_End of B3 context reference._