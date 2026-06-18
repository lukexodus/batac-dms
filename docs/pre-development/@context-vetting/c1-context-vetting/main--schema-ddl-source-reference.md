# Batac City LGU Platform — Schema DDL Source Reference (C1 Filtered)

**Purpose:** Filtered extract from the Consolidated Architecture & Requirements Reference (Iteration 3) and Stack Context, retaining only content needed to produce the Full Database Schema DDL for all Phase 1 schemas (`iam`, `organization`, `documents`, `workflow`, `tracking`, `records`, `notifications`, `audit`).

**Source document status:** Post-Interview 2 | Developer Decisions Resolved | Pre-Development Baseline

---

## DB Conventions and Invariants

### Universal Column Rules (All Tables)

|Convention|Decision|
|---|---|
|Primary keys|UUID v4 (`gen_random_uuid()`) everywhere|
|Timestamps|`TIMESTAMPTZ` on every timestamp column|
|Soft-delete|`deleted_at TIMESTAMPTZ` + `deleted_by UUID` on every table — no hard deletes|
|Tenant isolation|`city_id UUID NOT NULL` in all core entity tables (default: Batac City UUID)|
|Cross-schema FKs|**Prohibited** — enforced by automated migration linting|

### Architectural Invariants Directly Constraining Schema

|#|Invariant|Enforcement Method|
|---|---|---|
|1|Schema-per-module; no cross-schema foreign keys|Automated migration linting; code review policy|
|2|Soft-delete everywhere; no hard deletes|Repository layer; code review policy|
|3|Audit log INSERT-only at DB role level|PostgreSQL role permissions set in migration|
|4|Workflow instance pins to definition version at creation|DB column `definition_version_id`; all resolution uses pinned version|
|5|S3-compatible API only; UUID file keys|No provider SDK imports; code review policy|
|6|UUID v4 primary keys everywhere|Migration linting|
|7|`TIMESTAMPTZ` for all timestamps|Migration linting|
|8|`city_id UUID NOT NULL` in all core entity tables|Migration schema|
|9|Numbering assigned at defined lifecycle event only|Workflow engine constraint|
|10|IT admin has no document content access|PostgreSQL RLS + application ABAC policy|
|11|Document type must have retention schedule before activation|Application validation constraint|
|12|Platform Administrator role cannot be combined with operational roles|Role assignment validation|
|13|Encoder and final approver of same document cannot be the same user|Workflow engine constraint|
|14|Workflow constraints per document type (legally mandated minimum steps)|Workflow editor validation|
|15|Backup credentials separate from production credentials|Infrastructure policy; Terraform|
|16|One active designation per person at any time|Application-level validation + DB partial unique index on active `delegation_grants` per user|

### PostgreSQL Non-Negotiables

- **JSONB** — Admin-configurable document metadata (variable fields per document type). Use GIN indexes. Query with `@>` operator and `->>`accessors.
- **Row-Level Security (RLS)** — Office-level data isolation enforced at the DB engine, not only in application middleware.
- **Append-only audit log** — Revoke `UPDATE` and `DELETE` on the audit schema from the application DB user. Only `INSERT` is permitted. Enforced at the PostgreSQL grant level.
- **Check constraints for state transitions** — Enforce valid workflow state transitions at the DB level as a second line of defense.
- **Sequences for gapless document numbering** — Use PostgreSQL sequences with appropriate configuration per series per year.

---

## Schema Map (All Schemas with Tables)

```
schema: iam           → users, credentials, sessions, refresh_tokens, roles, permissions, mfa_records
schema: organization  → offices, positions, employees, assignments, delegations
schema: documents     → document_types, documents, versions, attachments, numbers, number_series, signatures
schema: workflow      → definitions, definition_versions, steps, transition_rules, instances, step_instances, workflow_events
schema: tracking      → tracking_records, routing_entries, qr_codes
schema: records       → records, retention_schedules, archive_entries, classification_rules, dispositions
schema: notifications → templates, notification_events, delivery_log
schema: audit         → events (append-only; INSERT-only DB permissions)
schema: search_meta   → index_metadata, index_jobs (Phase 2 — reserved in schema only)
schema: portal        → public_documents, citizen_requests, complaints, announcements (Phase 3 — reserved in schema only)
schema: reporting     → report_definitions, schedules, outputs (Phase 2 — reserved in schema only)
```

**Note:** `search_meta`, `portal`, and `reporting` are Phase 2/3. Reserve in the schema map but do not implement tables in Phase 1 DDL.

---

## Module Boundaries

Each module owns its own PostgreSQL schema. Modules communicate only through the internal event bus or published module API interfaces. No module reads another module's schema directly. **No cross-schema foreign key constraints.**

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
```

---

## IAM Schema

### Auth Architecture Requirements

|Decision|Value|
|---|---|
|Access token|JWT, 15–60 minutes|
|Refresh token storage|Server-side database (hashed value)|
|Cookie attributes|HTTP-only, Secure, SameSite=Strict|
|Client-side storage|Never localStorage or sessionStorage|
|MFA|TOTP designed from day one; not enabled in Phase 1; auth flow must accommodate it; TOTP required in Phase 2 for Mayor, SP Secretary, Department Heads, Platform Administrator, IT Admin|

### Authorization Model

- ABAC with RBAC as the simplified entry point. Pure RBAC cannot express office-scoped rules.
- ABAC policies evaluated at request time.
- PostgreSQL Row-Level Security as a second data-isolation layer.
- **IT admin must NOT have read access to confidential or restricted document content.** Enforced at the database permission level. Separate DB credentials for app runtime vs. IT admin.
- **Platform Administrator role cannot be combined with any document-processing role.** Enforced as an invariant.

### Authorization Tiers

- **Tier 1 (System-level, hardcoded):** Audit log read access, backup/restore, schema migrations, encryption key management
- **Tier 2 (Platform Administrator, no developer):** Role definitions, workflow definitions, document types, office hierarchy, notification templates, retention schedules, SLA thresholds, numbering series, report definitions, public visibility rules
- **Tier 3 (Instance-level, runtime):** Current workflow step assignee, document owning office, document classification, explicit share grants

### Session Management

|Decision|Value|
|---|---|
|Standard timeout|30 minutes of inactivity|
|Concurrent sessions|One active session per user|
|New login from different device|Logs out previous session|
|Forced logout|IT/security admin can force-terminate any session (audit-logged with reason)|

---

## Organization Schema

### Delegation / Designation Rules

High-frequency operation confirmed: 10+ Acting Mayor designations per year in 2023–2024. Delegation is a routine, first-class workflow feature.

|Rule|Value|
|---|---|
|Who initiates|Original authority (Mayor or Vice Mayor, per scope)|
|Who else confirms|**No one — no Platform Admin confirmation step**|
|Multiple simultaneous active designations per person|**NOT ALLOWED — only one active designation per person at any time**|
|Expiry|Automatic at end date — authority returns to original authority automatically|
|Early revocation|Permitted by delegating person|
|Open-ended delegations|Prohibited — duration must always be explicit|

**DB enforcement:** DB partial unique index on active `delegation_grants` per user (Invariant #16).

**System behavior:**

1. Mayor or Vice Mayor issues Designation document
2. Secretariat receives and logs it (`D {YEAR}-{NN}` number; QR assigned at logging)
3. Secretariat staff manually extracts scope and time bounds from document; enters in system
4. `delegation_grant` record created: **immediate effect, no Platform Admin confirmation**
5. System routes affected workflow steps to designated person for the duration
6. Auto-expires at end date: routing returns to original authority automatically

**Designation numbering:** `D {YEAR}-{NN}` — dual number system: originating authority's own memo/order number + SP Secretariat's control number (D format). Both stored.

**Audit trail records:** Original authority, designated person, time period, scope, legal basis (from Designation document).

**Administration transition:** In-flight documents requiring the prior Mayor's signature automatically wait for the new Mayor — no manual reassignment required. No formal transition procedure.

---

## Documents Schema

### Document Lifecycle States

```
Draft → Submitted → In-Workflow → Pending Approval → Completed → Released → Archived → Disposed
```

`Cancelled` is a terminal state reachable from any active state by an authorized actor.

### Document Classification Levels

|Level|Access|
|---|---|
|Public|All users + public portal|
|Internal|Authenticated LGU employees|
|Confidential|Restricted to explicit role allowlist (e.g., Administrative Cases)|
|Restricted|Restricted to explicit role allowlist|

### Versioning

- All previous versions retained. No overwrite. No permanent deletion by any user or role.
- When a physical document is printed, wet-ink signed, and scanned back, the system flags the scanned image for manual verification by a Records Officer before acceptance as the official copy.

### Cover Sheet / QR Cover Page

- Same as the QR cover sheet — no separate document.
- Auto-generated by the system from document metadata.
- Contains **only three fields**: QR Code, Tracking Number, Series Number.
- Does not need to be full paper size — takes only the space it needs.
- When printing: allow multiple cover pages (horizontal rectangle layout) to fit on one paper — configurable.

### Originating Office Rules

- For documents created within the SP workflow (SP Resolutions, Ordinances, Appropriation Ordinances): `originating_office_id` = **SP Secretariat**, regardless of which Councilor drafted the document.
- For letters received from external offices (SPR documents): `originating_office_id` = the **external sender** (their office/organization name).

### Secretariat Decision Logging

For Ordinances, Resolutions, and Appropriation Ordinances, the Secretariat explicitly logs approval decisions via UI action buttons: "Approve," "Reject," or "Amended." The system records these as workflow step completions with actor and timestamp.

### OCR

- OCR runs automatically on upload.
- System detects scan quality and always shows a quality indicator to the user.
- OCR also applied to historical records migrated from LMITS — OCR on migration is required.
- Phase 4 adds advanced OCR capabilities. Phase 1 = auto-run with quality indicator only.

### Numbering Architecture

#### Confirmed Number Formats

|Document Type|Preliminary Format|Final Format|Counter Scope|
|---|---|---|---|
|Resolution|`Draft 7SP {YEAR}-{NN}`|`7SP {YEAR}-{NN}`|Per year; resets. Final assigned after Second Reading vote, before VP sign.|
|Ordinance|`Draft 7SP {YEAR}-{NN}`|`7SP {YEAR}-{NN}`|Per year; resets. Final assigned after Third Reading vote, before VP sign.|
|Appropriation Ordinance|Same as Ordinance|Same as Ordinance|Per year; resets|
|Franchise Ordinance|**OUT OF SCOPE**|—|—|
|Notice of Committee Hearing|N/A|`NCH {YEAR}-{NN}`|Per year; resets; separate counter from NOSP|
|Notice of Special Session|N/A|`NOSP {YEAR}-{NN}`|Per year; resets; separate counter from NCH|
|Designation|N/A|`D {YEAR}-{NN}`|Per year; resets|
|Letters Received|N/A|`SPR {YEAR}-{NN}`|Per year; resets; separate from SPS|
|Letters Sent|N/A|`SPS {YEAR}-{NN}`|Per year; resets; separate from SPR|
|Memo Outgoing|N/A|`MO {YEAR}-{NN}`|Per year; resets; separate from MI|
|Memo Incoming|N/A|`MI {YEAR}-{NN}`|Per year; resets; separate from MO|
|Sangguniang Panlalawigan Review (SP's log)|N/A|`{YEAR}-{NN}`|Per year; resets|
|Panlalawigan's own reference|N/A|`R{YEAR}-{NNNN}`|Panlalawigan-assigned; stored as metadata|

**`{SP_NUMBER}`** = The ordinal SP (currently 7th SP → prefix "7"). Changes with each administration.

#### Numbering Architecture Decisions

|Rule|Decision|
|---|---|
|Preliminary number format|`"Draft " + {series_prefix} + " " + {YEAR} + "-" + {NN}` — e.g., `Draft 7SP 2026-02`. Assigned at secretariat logging. Space delimiter throughout.|
|Preliminary number mutability|Draft numbers can change before finalization. Nullable `preliminary_number` field on `document_numbers`; replaced when finalized.|
|Final number assignment|Resolutions: after Second Reading vote. Ordinances: after Third Reading vote. Always before VP and Mayor sign. Secretariat assigns and decides.|
|"Draft" prefix|Distinguishes preliminary from final. Removal of "Draft" = promotion to final number.|
|Delimiter|**Space** confirmed for all document types: `SPR 2026-01`, `MO 2025-01`, `D 2024-01`, `NCH 2026-01`, `NOSP 2026-01`.|
|Deferred assignment|For letters/memos: control numbers may not be assigned immediately at receipt. Nullable `control_number` supported; assignment is a distinct recorded action.|
|Immutability|Final numbers (after "Draft" removed) are immutable. Preliminary numbers can be replaced before finalization.|
|Gaps|Permitted only for cancelled documents; gap logged with cancellation reason|
|Reuse|Never, even if cancelled|
|Counters|Separate PostgreSQL sequence per document type per year — no shared counter|
|QR tracking number|System-generated UUID, independent of preliminary and final numbers. Assigned at secretariat logging (before preliminary number). Immutable for document's life.|

**Note on memos vs. letters:** Memos have the MO/MI number embedded in the document itself (e.g., "Memo No. MO 2025-01"). Letters have no number embedded in the document — only the SPR/SPS control number as a secretariat tracking reference.

---

## Workflow Schema

### Phase 1 Step Types

|Type|Description|Phase|
|---|---|---|
|`action`|User performs an action (review, comment)|Phase 1|
|`approval`|User approves, rejects, or returns for revision|Phase 1|
|`multi_referral`|Assigns to multiple committees simultaneously; **all committees must sign/contribute to the unified report**; committees missing Thursday cutoff delay Second Reading; absent committees marked red in Order of Business; completes when all-committee unified report submitted and accepted by SP Secretary|Phase 1|
|`decision`|System evaluates a condition; routes accordingly|Phase 1|
|`notification`|System sends a notification; no user action required|Phase 1|
|`termination`|Ends the workflow|Phase 1|
|`parallel_split`|Splits into parallel branches|Phase 2 (reserved in data model)|
|`parallel_join`|Merges parallel branches|Phase 2 (reserved in data model)|

### Mayor's 10-Day Lapse-into-Law

Applies to **both SP Resolutions AND SP Ordinances**. At day 10 with no Mayor action, system transitions to "Lapsed into Law," logs RA 7160 legal basis, and notifies SP Secretary.

### Certified Urgent Path

- Mayor issues a formal written Certification of Urgency document.
- Secretariat logs the Certification (does not create or authorize it).
- A single Certification can cover **multiple measures in the same session**.
- The Certification has **no standalone numbering** — it is attached to the associated measure(s), not filed independently.
- Upon logging: each associated measure's workflow instance bypasses the committee referral step and advances directly to Second Reading.
- **Certified Urgent Resolutions and Ordinances skip committee review and report entirely.**
- First and Second Reading occur in the same session.
- Frequency: **frequent** — must be supported fully in Phase 1.

### Amendments

- Resolutions: at Second Reading. Secretariat logs and finalizes. No third reading.
- Ordinances: at Second Reading. Third Reading reads the final amended version.

### Transmittal Letter as System Step

When a resolution or ordinance reaches the Mayor's review step, the system should generate (or prompt the Secretariat to generate) a Transmittal Letter (SPS format) to the Mayor's Office. This is a formal cover letter "For appropriate action."

### Hardcoded Workflow Constraints (Legally Mandated Minimum Steps)

|Document Type|Minimum Required Steps|
|---|---|
|SP Resolution|Committee referral OR Certified Urgent path; Second Reading vote; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Release|
|SP Ordinance / Appropriation Ordinance|Committee referral OR Certified Urgent path; 3 readings; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Publication (if penalty); Release|

### Version Pinning

- Instance pins to definition version active at creation.
- In-flight migration: Option A (continue under old version) or Option B (admin migrates with mandatory reason, 2nd-level approval from City Administrator required, 24-hour reversible window, dedicated audit event).

### SLA and Escalation

- SLA clock starts at workflow initiation.
- Warning at 80% of SLA time.
- Automatic escalation at breach: notify supervisor + Records Officer.
- ARTA defaults: simple ≤ 3 working days; complex ≤ 7 working days; highly technical ≤ 20 working days.
- System outage does not suspend ARTA obligations.

### Multi-Committee Referral (`multi_referral` step type)

Most SP measures are referred to **two committees simultaneously**: the relevant subject-matter committee AND the Committee on Laws. This is standard practice — the default, not a special case.

**`multi_referral` step type behavior:**

- Accepts a list of assigned committees.
- **All assigned committees must sign and contribute to the unified report** before the step completes.
- Absent committees (and those that have not yet submitted their contribution) are **marked red in the Order of Business** — visually flagged but do not block the hearing itself.
- Committee report deadline: **Thursday cutoff** before the next Tuesday session.
- If one or more committees have not submitted their contribution before the Thursday cutoff: Second Reading for that measure does not proceed at the immediately following Tuesday — it is delayed to the **Tuesday after the week in which all committees submit**.
- SP Secretary can manually advance the step (overriding a missing report) — must be audit-logged with a mandatory comment.
- Completes when the unified committee report is submitted and accepted by the SP Secretary, with all required committee signatures.

**`parallel_split` and `parallel_join`** step types remain reserved for Phase 2 (Barangay Budget workflow). Reserved in data model only — no Phase 1 implementation.

**This decision is finalized. The workflow engine schema must implement `multi_referral` as a distinct step type before Phase 1 development begins.**

---

## Tracking Schema

### DTS (Document Tracking System)

|Decision|Value|
|---|---|
|QR content|Unique tracking ID only (not a URL, not document content)|
|Tracking number format|Configurable; default: `DTS-{YEAR}-{SEQUENCE}`|
|QR assignment point|**At secretariat logging, before preliminary number is assigned**|
|Assignment sequence|Councilor Draft → Secretariat Logs → QR assigned → Preliminary Draft number assigned|
|QR code survives|Throughout entire document lifecycle (preliminary through final, through Mayor signature)|
|Immutability|QR tracking number never changes after assignment|
|Independence|QR tracking number completely independent of preliminary number, final number, and control number|
|Scan result|Document type, remarks, history from draft, first page visible; other pages blurred|
|Full copy access|"Get a copy" button on scan result → requires Document Request Form, VM + SP Secretary approval, payment|
|Routing history|Every movement recorded: from, to, actor, timestamp, action|
|Physical custody|Tracked separately from digital workflow status|

---

## Records Schema

### Retention Defaults

|Category|Retention|
|---|---|
|SP Resolutions, Ordinances|**Permanent**|
|All documents currently retained — none disposed of|—|
|Signed contracts, financial records|Permanent|
|Personnel records|10–15 years|
|Correspondence with citizens|10–15 years|
|Internal memos|5 years|
|Draft versions (final approved kept)|1 year|

### Disposition Rules

- Explicit Records Officer action required with mandatory comment. No automated disposal.
- Document under legal hold cannot have retention shortened.
- Disposition creates audit record, not data deletion.

### RA 10173 Erasure Exception

Citizen PII erasure requests require formal legal review (City Legal / DPO) before erasure. Each erasure creates a dedicated audit record.

### No-Deletion Policy

No document may be permanently deleted by any user or role. Only authorized disposition via the Records Management module.

---

## Notifications Schema

### Events Always Audited (Cannot Be Disabled)

All authentication events; all document state changes; all approval actions; all delegation grants/revocations; all role assignments/revocations; all bulk operations; all exports; all session terminations; all workflow definition publishes/deprecations; all Option B migration executions; all RA 10173 erasure actions; all Secretariat "Approve/Reject/Amended" logging actions.

---

## Audit Schema

### Audit Log Design

|Decision|Value|
|---|---|
|Schema|Separate `audit` schema; append-only|
|DB permissions|Application audit user: INSERT-only on audit schema. No UPDATE, no DELETE|
|Hash chaining|SHA-256; each entry includes hash of previous entry|
|HMAC|Applied to each payload with a secret key|
|External timestamp|Monthly export; RFC 3161 TSA (provider to be confirmed)|
|Tamper detection|Hash chain validated at retrieval time; broken chain = tampering flagged|
|Claim|**Tamper-evident (not tamper-proof)** — this distinction is documented|

**Hash chain:** Each audit event record stores `SHA-256(previous_event_hash + current_event_payload)` as its `chain_hash` column. First record uses a known genesis hash. Chain validated at retrieval time.

**HMAC:** Each event payload signed with `HMAC-SHA-256` using a secret key held by the application (stored in environment variable, not in the database).

**Implementation:** Node built-in `crypto` only — no external library.

---

## Document Workflow Details (Phase 1 Only)

### SP Resolution Workflow

**Numbering:**

- Preliminary: `Draft 7SP {YEAR}-{NN}` — assigned at secretariat logging, QR assigned before this
- Final: `7SP {YEAR}-{NN}` — assigned by Secretariat after Second Reading vote, before VP and Mayor sign

**Preliminary number mutability:** Draft numbers can change between readings. If Document A gets `Draft 7SP 2026-02` but Document B (originally `Draft 7SP 2026-01`) is approved first, Document A may be renumbered when finalized. Sequence of final numbers depends on which document completes its last reading vote first.

**Key facts for schema:**

- Two readings: First Reading (referral to committee) and Second Reading (debate, amendments, vote)
- Mayor's signature required; 10-day lapse rule applies
- Mayor can veto; veto override: 2/3 majority (8 of 12 members)
- Certified Urgent: First and Second Reading in the same session; skips committee referral entirely
- Final number assigned by Secretariat after Second Reading vote, before VP signs
- Amendments at Second Reading: Secretariat logs, finalizes, produces final copy; no separate third reading
- Transmittal Letter (cover letter: "For appropriate action") accompanies document to Mayor
- Docketing occurs after returning from Mayor (document already has final number at this point)
- Panlalawigan review: transmitted after Mayor action; 30-day timer
- Publication: title and first page publicly visible; full copy requires paid Document Request + VM + SP Secretary approval

**Panlalawigan review outcome states (applies to both Resolution and Ordinance):**

|Outcome|Meaning|
|---|---|
|VALID|Approved by Panlalawigan|
|VALID-IN-PART|Partially approved; some provisions found invalid|
|RETURNED|Returned with objections (treated as disapproved)|
|Referred to committee|Panlalawigan committee review in progress; 30-day clock running|
|Operative-in-its-entirety|Used specifically for Appropriation Ordinances; means valid/implementable|
|_(blank — 30 days elapsed)_|Deemed approved per RA 7160 Section 56(d); Remarks: "Lapsed 30 days"|

**Panlalawigan review log fields tracked by SP Secretariat:**

|Field|Detail|
|---|---|
|Control No.|SP Secretariat's own sequence number (e.g., 2026-01)|
|Date Received|When the Panlalawigan's response was received back|
|SP Reso. No.|Panlalawigan's own resolution number (e.g., R2026-0841)|
|Subject|Which SP document(s) were reviewed|
|Date Approved / Disapproved|From the Panlalawigan|
|Date Referred|Date Panlalawigan sent to their own committee|
|Remarks|Outcome and notes|

**System behavior for 30-day timer:** At day 30 with no response, system transitions status to "Deemed Approved per RA 7160 Section 56(d)" and notifies SP Secretary, who confirms. Remarks field populated with statutory legal basis phrase.

**VALID-IN-PART system behavior:** System marks VALID-IN-PART, attaches Panlalawigan's response, places step in "Awaiting SP Secretariat Action." SP Secretary chooses: (1) Resolve as-is with mandatory comment; (2) Route to Legal Office; (3) Route to concerned Committee; (4) Implement revisions directly without repassing. All audit-logged.

**RETURNED system behavior:** System flags high-priority, requires immediate review. Secretariat decides path: modify and repass (back to drafting) is the standard outcome. No formal legal challenge mechanism. Implementation stops.

### SP Ordinance Workflow

**Numbering:** Same format as Resolution (`Draft 7SP {YEAR}-{NN}` preliminary; `7SP {YEAR}-{NN}` final). Final assigned after Third Reading vote, before VP and Mayor sign.

**Key facts for schema:**

- Three readings: First Reading (referral), Second Reading (amendments), Third Reading (final version with amendments; final vote)
- Amendments at Second Reading; Third Reading reads the final amended version
- Final number assigned by Secretariat after Third Reading vote, before VP signs
- Docketing step after Mayor action: Secretariat readies document for distribution; document already has final number
- Mayor 10-day lapse: applies
- Publication: only ordinances **with penalty** require full newspaper publication (Ilocos Times); full ordinance text published; SP Secretariat arranges placement; publication date is a mandatory tracked field
- Ordinances **without penalty**: no newspaper publication required; shown on public portal only
- Appropriation Ordinance: same flow as regular ordinance; no special workflow
- "Operative in its entirety" Panlalawigan outcome = synonymous with VALID for Appropriation Ordinances

### Certification of Urgency

|Field|Detail|
|---|---|
|Issued by|Mayor (formal written document — not a verbal declaration)|
|Logged by|SP Secretariat (receives and logs; does not create or authorize)|
|Effect|Associated measure bypasses committee referral; goes directly to Second Reading in the same session|
|Frequency|**Frequent** — explicitly noted as a common occurrence|
|Number format|**No standalone number** — always associated with and referenced by the document(s) it certifies|
|Attachment|Attached to the specific legislative measure(s) in the system — not filed as a standalone document|
|Scope per certification|A single Certification of Urgency **can cover multiple measures** in the same session|

**System integration:** When logged by Secretariat: Certification document attached to associated measure(s); each measure's workflow instance updated to bypass committee referral; Certification archived as part of the measure's document record, not as standalone entry; if one Certification covers multiple measures, attached to each measure individually.

### Session and Order of Business

**Session attendance tracking — fields required in schema:**

|Item|Detail|
|---|---|
|Absence input timing|Recorded before the session|
|Absence reasons|OB (official business), sick leave, vacation leave, absent (unqualified)|
|Designated substitute|If VM is absent, a presiding officer is designated beforehand (requires Designation document)|
|Quorum tracking|Attendance used for quorum calculation (7 of 12 required to pass)|

**Order of Business:**

- Generated by SP Secretariat weekly prior to each Tuesday session
- Submission cutoff: Thursday of the preceding week
- Content: all documents scheduled for the upcoming session's First Reading
- Visual indicator: items with missing or pending committee reports marked red
- Scheduling rule: documents received by Secretariat before Thursday cutoff included in next Tuesday Order of Business

### Citizen Complaint Module

**Phase 1 feature.**

**Confirmed form fields (transportation complaint as primary type):** Violation type (overcharging, trip cutting, refused to convey, discourtesy, others), tricycle number, date and time, place, remarks, complainant name/address/contact.

**Routing:** Secretariat decides routing — to committee directly, or to Vice Mayor, depending on nature of complaint.

**Outcome states:**

1. **Pending Hearing** — complaint received; committee referral in progress
2. **Received/Seen** — Vice Mayor and/or Committee has received/seen the complaint
3. **Dismissed** — complaint dismissed
4. **Resolved** — committee report issued; complainant notified; case closed

**Respondent notification:**

- If respondent has an **email address**: notification AND formal written notice sent by email
- If respondent has **only a contact number**: notification sent by SMS/phone; respondent must claim formal written notice in person from the LGU

**Scope:** Any LGU-related complaint, not limited to tricycle/transportation.

### Document Request Form

Fee-based process for copies of SP documents. Approval requires both Vice Mayor AND SP Secretary signature.

**Confirmed fields:** Document type, title, number of pages, requester name/agency, date, email, ID presented, purpose, payment (Secretary's Fees under Ordinance No. 3SP 2014-05), OR number, collecting officer.

**Three access modes:**

1. Citizen downloads template → submits physical document with wet-ink signature
2. Citizen inputs details on digital form → system generates printable form → citizen prints, signs, and submits
3. Citizen goes to Secretariat in person → clerk inputs info → prints document on-site → citizen signs on the spot

**Post-approval notifications:** After copy request approved, person notified via contact number (primary channel). Payment required before copy is released.

**Public portal behavior:** First page of uploaded documents visible publicly; body blurred. Title only shown in public listings. Full copy by request only.

---

## Concurrency and Locking

|Decision|Value|
|---|---|
|Model|Pessimistic locking|
|Lock timeout|15 minutes (configurable per document type)|

---

## Committee Structure (Schema Implications)

22 standing committees confirmed. Committee membership changes with each administration.

**Key architectural implications:**

- Most measures are referred to **two committees simultaneously** — subject-matter committee plus Committee on Laws. Standard practice, not a special case.
- The Committee on Laws appears on nearly every Notice of Committee Hearing — effectively a co-reviewer by default.
- Each Councilor sits on 4–6 committees. Notification and inbox logic must handle overlapping membership without duplicating workflow steps.

**Multi-committee joint hearing rules:**

- When multiple committees referred: joint hearing; single unified compiled report
- If one committee is absent, hearing still continues
- Even if an entire committee is absent, the hearing proceeds
- System does **not** log individual committee absentees
- One hearing session can cover multiple documents as long as the committees concerned are the same

### Committee Report Timeline

- First Reading on Tuesday → committee referred
- Committee adds "hearing needed or not" note, schedules if needed
- Committee holds hearing; creates final report after the meeting
- Final report submitted to Secretariat **before Thursday cutoff**
- If committee report not submitted by cutoff: item marked red in Order of Business for next session
- If report still not submitted before the following Thursday: **Second Reading is delayed** — only proceeds on the Tuesday after the week the committee submits their report

---

## Voting Thresholds (Relevant to Workflow State Transitions)

|Threshold|Value|
|---|---|
|Pass vote|12 members; half+1 required = **7 votes to pass**|
|Veto override|2/3 majority = **8 of 12 members**|
|No proxy voting|Confirmed|