# F1. Application Route Map

## 1. Cross-Cutting Architecture Context (applies to every route)

### 1.1 Monorepo and frontend/backend split

_Source: `tech-stack.md`_

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

[Inference] F1 is explicitly scoped to "All pages/views in `/apps/web` for Phase 1." The public portal (`/apps/portal`) is Next.js and is Phase 3, per the monorepo layout above — but the route map's own task description also asks for "the Phase 1 public portal subset," so Part 2 below (Phase 1 public portal scope) is included despite the portal app itself being a later phase, because Phase 1 public-facing pages may need to live somewhere (see "Phase 1 public portal behavior confirmed" sections, which describe functionality without confirming which app serves it).

### 1.2 tRPC architecture (relevant to "primary data dependencies" field)

_Source: `tech-stack.md`_

> **Rule:** tRPC is used exclusively for `/web` (internal app) ↔ `/server`. The public portal and any external-facing interface use REST only.
> 
> ```
> /web  ──tRPC──▶  /server (Fastify)  ──REST/OpenAPI──▶  /portal, mobile, third-party
> ```
> 
> - tRPC procedures are defined in `/server`, consumed in `/web` with full type inference via TanStack Query (tRPC v11 uses TanStack Query as its data layer).
> - REST routes are defined in `/server` with `@fastify/swagger` generating an OpenAPI 3.0 spec from route schemas.
> - Both live in the same Fastify process; they are separated by plugin scope.

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 9_

> |Internal API|tRPC on Fastify|End-to-end type safety for `/web` — no REST for internal routes| |External/public API|Fastify REST + OpenAPI (`@fastify/swagger`)|Required for portal, mobile, third-party, or non-TS clients|

[Inference] This confirms that every `/apps/web` route in F1 should list tRPC procedures (not REST endpoints) as its data dependency, and that the public portal subset (if served by `/portal`) would instead depend on REST/OpenAPI routes, not tRPC. No actual procedure names exist in source.

### 1.3 Module boundaries (relevant to inferring which backend domain a route's data comes from)

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 10.2_

> Each module owns its own PostgreSQL schema. Modules communicate only through the internal event bus or published module API interfaces. No module reads another module's schema directly. No cross-schema foreign key constraints.
> 
> ```
> Modules:
>   iam           → users, credentials, sessions, roles, permissions
>   organization  → offices, positions, employees, assignments, delegations
>   documents     → document types, documents, versions, attachments, numbers, signatures
>   workflow      → definitions, versions, steps, instances, step instances, events
>   tracking      → tracking records, routing entries, qr codes
>   records       → records, retention schedules, archive entries, classification
>   notifications → templates, events, delivery logs
>   audit         → events (append-only, hash-chained)
>   search_meta   → search index metadata (Phase 2)
>   portal        → public documents, citizen requests, complaints, announcements (Phase 3)
>   reporting     → report definitions, schedules, outputs (Phase 2)
> ```

### 1.4 Authorization model and tiers (relevant to "required role(s) to access" field)

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 11.8_

> **ABAC with RBAC as the simplified entry point.** Pure RBAC cannot express office-scoped rules. ABAC policies evaluated at request time. PostgreSQL Row-Level Security as a second data-isolation layer.
> 
> **IT admin must NOT have read access to confidential or restricted document content.** Enforced at the database permission level. Separate DB credentials for app runtime vs. IT admin.
> 
> **Platform Administrator role cannot be combined with any document-processing role.** Enforced as an invariant.
> 
> **Authorization tiers:**
> 
> - Tier 1 (System-level, hardcoded): Audit log read access, backup/restore, schema migrations, encryption key management
> - Tier 2 (Platform Administrator, no developer): Role definitions, workflow definitions, document types, office hierarchy, notification templates, retention schedules, SLA thresholds, numbering series, report definitions, public visibility rules
> - Tier 3 (Instance-level, runtime): Current workflow step assignee, document owning office, document classification, explicit share grants

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 12 (Architectural Invariants — role-relevant rows only)_

> |10|IT admin has no document content access|PostgreSQL RLS + application ABAC policy| |12|Platform Administrator role cannot be combined with operational roles|Role assignment validation| |13|Encoder and final approver of same document cannot be the same user|Workflow engine constraint|

### 1.5 Document classification levels (relevant to access-gating on document/audit views)

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 11.4_

> **Classification levels:**
> 
> |Level|Access|
> |---|---|
> |Public|All users + public portal|
> |Internal|Authenticated LGU employees|
> |Confidential|Restricted to explicit role allowlist (e.g., Administrative Cases)|
> |Restricted|Restricted to explicit role allowlist|

---

## 2. SP Secretary Dashboard

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 2 (Phase 1 Scope Decision), Phase 1 Deliverables list_

> - SP Secretary dashboard (queue, pending items, session calendar, Order of Business view)

_Source: same file, Part 1 — Module Priority Order context (Minimum Viable Core list)_

> 7. SP Secretary dashboard (including Order of Business view with session schedule and red-flagged items)

_Source: same file, Part 4.18 — Order of Business_

> **System implication:** The Order of Business is a derived view generated from all documents scheduled for the upcoming session. The SP Secretary dashboard must include an Order of Business management view showing scheduled documents, their committee referral status, and red-flagging items with missing committee reports.

_Source: same file, Part 13 — Roadmap, Phase 1 Included list_

> SP Secretary dashboard

[Unverified] No further detail on SP Secretary dashboard layout, widgets, or sub-views beyond what is quoted above exists elsewhere in either source file.

---

## 3. Order of Business View

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 4.18 — Order of Business (full section)_

> A session agenda document generated and managed by the SP Secretariat.
> 
> |Field|Detail|
> |---|---|
> |Generated by|SP Secretariat|
> |Frequency|Weekly (prior to each Tuesday session)|
> |Submission cutoff|Thursday of the preceding week|
> |Content|All documents scheduled for the upcoming session's First Reading|
> |Visual indicator|Items with missing or pending committee reports marked red|
> |Scheduling rule|Documents received by Secretariat before Thursday cutoff are included in the next Tuesday Order of Business|
> |Physical use|Participants read the Order of Business as a physical document during sessions|
> 
> **System implication:** The Order of Business is a derived view generated from all documents scheduled for the upcoming session. The SP Secretary dashboard must include an Order of Business management view showing scheduled documents, their committee referral status, and red-flagging items with missing committee reports.

_Source: same file, Part 7.2 — Session Patterns and Scheduling (rows directly describing Order of Business behavior)_

> |Session day|Tuesdays| |Cutoff for Order of Business|Thursday of the preceding week| |Included in Order of Business|Documents received by Secretariat before the Thursday cutoff| |Committee report deadline|**Thursday cutoff** — if report not submitted by Thursday, Second Reading is delayed to the next Tuesday after submission `[RESOLVES Q-A02]`| |Missing committee reports|Marked red in the Order of Business| |Multiple documents in one session|Allowed if the committees concerned are the same|

_Source: same file, Part 11.3 — Workflow Engine, `multi_referral` step type description_

> |multi_referral|Assigns to multiple committees simultaneously; **all committees must sign/contribute to the unified report**; committees missing Thursday cutoff delay Second Reading; absent committees marked red in Order of Business; completes when all-committee unified report submitted and accepted by SP Secretary|Phase 1|

_Source: same file, Part 10.4 — Multi-Committee Referral Implication_

> The `workflow` module's step type for committee referral must support a list of assigned committee roles. ... Phase 1 requires a `multi_referral` step type where: **all assigned committees must sign/contribute to the unified report** (not just one); committees that miss the Thursday cutoff cause Second Reading to be delayed; absent committees are marked red in the Order of Business but do not stop the hearing itself; and SP Secretary can manually advance with a mandatory audit-logged comment.

---

## 4. Document Intake Form

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 11.4 — Document Management (full relevant section)_

> **Lifecycle states:**
> 
> ```
> Draft → Submitted → In-Workflow → Pending Approval → Completed → Released → Archived → Disposed
> ```
> 
> Cancelled is a terminal state reachable from any active state by an authorized actor.
> 
> **Versioning:** All previous versions retained. No overwrite. No permanent deletion by any user or role.
> 
> **Physical-to-digital correspondence:** When a physical document is printed, wet-ink signed, and scanned back, the system flags the scanned image for manual verification by a Records Officer before acceptance as the official copy.
> 
> **Cover sheet / QR cover page `[UPDATED — developer decisions; RESOLVES Q-B02]`:** The "cover page before printing" referenced in Interview 2 is confirmed to be **the same as the QR cover sheet** — no separate document. Auto-generated by the system from document metadata. Contains **only three fields**: QR Code, Tracking Number, Series Number. Does not need to be a full A4/letter page size — takes only the space it needs. **When printing cover pages: allow multiple cover pages (horizontal rectangle layout) to fit on one paper.** This is configurable in the system to save paper.
> 
> **Originating office rules `[NEW — developer decisions; RESOLVES Q-B03]`:**
> 
> - For documents created within the SP workflow (SP Resolutions, Ordinances, Appropriation Ordinances): the `originating_office_id` is always the **SP Secretariat**, regardless of which Councilor drafted the document
> - For letters received from external offices (SPR documents): the `originating_office_id` records the **external sender** (sender's office name/organization)
> 
> **QR code scan output `[CONFIRMED — Interview 2]`:** When a QR code is scanned, the system displays:
> 
> - Document type
> - Remarks
> - History from draft (full routing history)
> - First page only (other pages blurred)
> - Link to request full copy ("Get a copy" button)
> 
> **Secretariat decision logging `[CONFIRMED — Interview 2]`:** For Ordinances, Resolutions, and Appropriation Ordinances, the Secretariat explicitly logs approval decisions via UI action buttons: "Approve," "Reject," or "Amended." The system records these as workflow step completions with actor and timestamp.
> 
> **OCR `[UPDATED — developer decisions; RESOLVES Q-C01]`:**
> 
> - OCR **runs automatically on upload**
> - System detects scan quality and **always shows a scan quality indicator to the user**, so the user can decide whether to perform a manual re-scan
> - OCR is also applied to **historical records migrated from LMITS** — OCR on migration is required
> - Poor-quality scan handling: the scan quality indicator covers this — user is informed and can act

_Source: same file, Part 11.6 — Document Tracking (DTS), assignment-sequence row_

> |Assignment sequence|Councilor Draft → Secretariat Logs → QR assigned → Preliminary Draft number assigned|

_Source: same file, Part 4.1 — SP Resolution, opening workflow node_

> ```mermaid
> A[Councilor or SP Staff\nDrafts resolution\nInputs sponsors in title] --> B[SP Secretariat\nReceives draft\nLogs in system\nQR code assigned — tracking starts\nPreliminary Draft number assigned]
> ```

[Inference] This first node of the resolution/ordinance workflow diagrams is the closest source description of what the "document intake form" actually captures (drafting actor, sponsors/title, then secretariat logging with QR + preliminary number assignment). No standalone "intake form field list" exists in source beyond what's quoted here and in the Document and Records Request Form section (Part 6, below) and the OCR section above.

_Source: `tech-stack.md` — OCR Strategy_

> OCR is a confirmed Phase 1 requirement. All uploaded documents are scanned automatically on upload and a scan quality indicator is always shown to the user so they can decide whether to re-scan before the document is formally logged.

_Source: `tech-stack.md` — File Storage Strategy, format/size constraints_

> Supported formats: PDF, DOCX, XLSX, PNG, JPG. Maximum file size: 25 MB per file (configurable via env).

---

## 5. Workflow Step Action Views

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 11.3 — Workflow Engine (full section)_

> **Implementation:** Custom domain-specific engine. Not Camunda, Temporal, or Flowable. Admin-configurable without developer involvement.
> 
> **Phase 1 step types:**
> 
> |Type|Description|Phase|
> |---|---|---|
> |action|User performs an action (review, comment)|Phase 1|
> |approval|User approves, rejects, or returns for revision|Phase 1|
> |multi_referral|Assigns to multiple committees simultaneously; **all committees must sign/contribute to the unified report**; committees missing Thursday cutoff delay Second Reading; absent committees marked red in Order of Business; completes when all-committee unified report submitted and accepted by SP Secretary|Phase 1|
> |decision|System evaluates a condition; routes accordingly|Phase 1|
> |notification|System sends a notification; no user action required|Phase 1|
> |termination|Ends the workflow|Phase 1|
> |parallel_split|Splits into parallel branches|Phase 2 (reserved in data model)|
> |parallel_join|Merges parallel branches|Phase 2 (reserved in data model)|
> 
> **Mayor's 10-day lapse-into-law:** Applies to **both SP Resolutions AND SP Ordinances**. `[CONFIRMED — Interview 2, resolves Q-03]` At day 10 with no Mayor action, system transitions to "Lapsed into Law," logs RA 7160 legal basis, and notifies SP Secretary.
> 
> **Certified Urgent path — Phase 1 (not Phase 1B) `[CONFIRMED — Interview 2; UPDATED — developer decisions]`:**
> 
> - Mayor issues a formal written Certification of Urgency document
> - Secretariat logs the Certification (does not create or authorize it)
> - A single Certification can cover **multiple measures in the same session**
> - The Certification has **no standalone numbering** — it is attached to the associated measure(s), not filed independently
> - Upon logging: each associated measure's workflow instance bypasses the committee referral step and advances directly to Second Reading
> - **Certified Urgent Resolutions and Ordinances skip committee review and report entirely** `[RESOLVES Q-C05]`
> - First and Second Reading occur in the same session
> - Frequency: **frequent** — must be supported fully in Phase 1
> - Branching logic for Certified Urgent path is Phase 1 scope
> 
> **Amendments:**
> 
> - Resolutions: at Second Reading. Secretariat logs and finalizes. No third reading. `[CONFIRMED — Interview 2]`
> - Ordinances: at Second Reading. Third Reading reads the final amended version. `[CONFIRMED — Interview 2]`
> 
> **Transmittal Letter as system step:** When a resolution or ordinance reaches the Mayor's review step, the system should generate (or prompt the Secretariat to generate) a Transmittal Letter (SPS format) to the Mayor's Office. This is a formal cover letter "For appropriate action."
> 
> **Hardcoded workflow constraints (legally mandated minimum steps):**
> 
> |Document Type|Minimum Required Steps|
> |---|---|
> |SP Resolution|Committee referral OR Certified Urgent path; Second Reading vote; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Release|
> |SP Ordinance / Appropriation Ordinance|Committee referral OR Certified Urgent path; 3 readings; VP certification; Transmittal to Mayor; Mayor review (10-day); Docketing; Panlalawigan review; Publication (if penalty); Release|
> 
> **Version pinning:** Instance pins to definition version active at creation. In-flight migration requires Option A (continue under old version) or Option B (admin migrates with mandatory reason, 2nd-level approval from City Administrator required, 24-hour reversible window, dedicated audit event).
> 
> **SLA and escalation:**
> 
> - SLA clock starts at workflow initiation
> - Warning at 80% of SLA time
> - Automatic escalation at breach: notify supervisor + Records Officer
> - ARTA defaults: simple ≤ 3 working days; complex ≤ 7 working days; highly technical ≤ 20 working days
> - System outage does not suspend ARTA obligations
> 
> **Administration transitions:** In-flight documents continue under the new administration. Whoever was presiding at the document's last action still signs/approves. Office-level step assignee fallback rules reassign to new officeholders when their accounts become active.

_Source: same file, Part 4.3 — Sangguniang Panlalawigan Review, system behavior decisions (action-view-relevant excerpt)_

> - **VALID-IN-PART handling:** System marks the document VALID-IN-PART, attaches the Panlalawigan's response, places step in "Awaiting SP Secretariat Action." SP Secretary chooses: (1) Resolve as-is with mandatory comment; (2) Route to Legal Office; (3) Route to concerned Committee for re-evaluation; (4) Implement revisions directly without repassing. All choices are audit-logged. `[UPDATED — developer decisions]`
> - **RETURNED handling:** System flags high-priority, requires immediate review. Secretariat decides path: modify and repass (back to drafting) is the standard outcome. No formal legal challenge mechanism exists. Implementation stops.

_Source: same file, Part 8.3 — Decision: Option B — Multi-Referral Step Type (`multi_referral` behavior, full)_

> - Accepts a list of assigned committees
> - **All assigned committees must sign and contribute to the unified report** before the step completes
> - Absent committees (and those that have not yet submitted their contribution) are **marked red in the Order of Business** — they are visually flagged but do not block the hearing itself
> - Committee report deadline: **Thursday cutoff** before the next Tuesday session
> - If one or more committees have not submitted their contribution before the Thursday cutoff: the Second Reading for that measure does not proceed at the immediately following Tuesday — it is delayed to the **Tuesday after the week in which all committees submit**
> - SP Secretary can manually advance the step (overriding a missing report) — this must be audit-logged with a mandatory comment
> - Completes when the unified committee report is submitted and accepted by the SP Secretary, with all required committee signatures

_Source: same file, Part 4.14 — Citizen Complaint, Resolution process (a non-legislative workflow's step actions)_

> 1. Complaint received and logged by Secretariat
> 2. Secretariat routes to appropriate committee (Secretariat decides)
> 3. Committee renders report
> 4. Secretariat logs the report
> 5. Secretariat sends report to complainant (via the notification channel discussed below)
> 6. Secretariat marks complaint as resolved

_Source: same file, Part 4.14 — Outcome states_

> 1. **Pending Hearing** — complaint received; committee referral in progress
> 2. **Received/Seen** — Vice Mayor and/or Committee has received/seen the complaint (intermediate status)
> 3. **Dismissed** — complaint dismissed
> 4. **Resolved** — committee report issued; complainant notified; case closed

---

## 6. Session Attendance Tracking

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 7.3 — Session Attendance Tracking (full section)_

> Session attendance tracked for quorum compliance.
> 
> |Item|Detail|
> |---|---|
> |Absence input timing|Recorded before the session|
> |Absence reasons|OB (official business), sick leave, vacation leave, absent (unqualified)|
> |Designated substitute|If VM is absent, a presiding officer is designated beforehand (requires Designation document)|
> |Quorum tracking|Attendance used for quorum calculation (7 of 12 required to pass)|
> |UI requirement|Session detail view: who is absent and why; visible before session|
> |Statistics|Count of present/absent councilors; graph of attendee numbers over time; printable summary|
> |Current state|Only counts recorded; system to add count + graph functionality `[CONFIRMED — Interview 2]`|

_Source: same file, Part 3.2 — SP Members, voting threshold context_

> **Voting threshold:** 12 members; half+1 required = **7 votes to pass**. No proxy voting. `[CONFIRMED]`
> 
> **Veto override threshold:** 2/3 majority = **8 of 12 members**. `[CONFIRMED]`

---

## 7. Mayor Dashboard

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 2 — Phase 1 Scope Decision, Phase 1 Deliverables list_

> - Mayor dashboard (pending signatures, overdue items)

_Source: same file, Part 1 — Minimum Viable Core list_

> 8. Mayor dashboard

_Source: same file, Part 4.1 / 4.2 — Mayor action node (resolution and ordinance workflows; structurally identical for both document types), describing what the Mayor's review step covers_

> ```mermaid
> N{Mayor action\nwithin 10 calendar days}
> 
> N -->|Mayor signs| O[Returns to SP Secretariat]
> N -->|10-day lapse — no Mayor action| LAPSE[Lapsed into Law\nLogged with RA 7160 legal basis\nSP Secretary notified]
> N -->|Mayor vetoes| P[Returned to SP with objections\nOverride vote: 2/3 = 8 of 12]
> ```

[Unverified] No further detail on Mayor dashboard layout or sub-views beyond "pending signatures, overdue items" and the action options available at the Mayor's 10-day review step (sign / let lapse / veto) exists in either source file.

---

## 8. Audit Log Viewer

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 11.11 — Audit Log (full section)_

> |Decision|Value|
> |---|---|
> |Schema|Separate `audit` schema; append-only|
> |DB permissions|Application audit user: INSERT-only on audit schema. No UPDATE, no DELETE|
> |Hash chaining|SHA-256; each entry includes hash of previous entry|
> |HMAC|Applied to each payload with a secret key|
> |External timestamp|Monthly export; RFC 3161 TSA (provider to be confirmed)|
> |Tamper detection|Hash chain validated at retrieval time; broken chain = tampering flagged|
> |Claim|**Tamper-evident (not tamper-proof)** — this distinction is documented|
> 
> **Events always audited (cannot be disabled):** All authentication events; all document state changes; all approval actions; all delegation grants/revocations; all role assignments/revocations; all bulk operations; all exports; all session terminations; all workflow definition publishes/deprecations; all Option B migration executions; all RA 10173 erasure actions; all Secretariat "Approve/Reject/Amended" logging actions.

_Source: same file, Part 11.8 — Authorization Model (audit-log-access-relevant row)_

> - Tier 1 (System-level, hardcoded): Audit log read access, backup/restore, schema migrations, encryption key management

_Source: `tech-stack.md` — Audit Log Integrity (full section)_

> The audit log is append-only at the database permission level (`INSERT` only; `UPDATE` and `DELETE` revoked from the application DB user). The application layer adds a second integrity layer: hash chaining and HMAC.
> 
> **Implementation uses Node built-in `crypto` only** — no external library.
> 
> **Hash chain:** Each audit event record stores `SHA-256(previous_event_hash + current_event_payload)` as its `chain_hash` column. The first record in a series uses a known genesis hash. The chain is validated at retrieval time — a broken chain is flagged as a tamper indicator.
> 
> **HMAC:** Each event payload is signed with `HMAC-SHA-256` using a secret key held by the application (stored in environment variable, not in the database). This prevents an attacker with direct DB write access from inserting a record and computing a valid chain hash without the key.
> 
> **Claim boundary:** The audit log is **tamper-evident, not tamper-proof.** Evidence of tampering can be detected. Prevention of tampering by a sufficiently privileged attacker (one who has both the DB write access and the HMAC secret) is outside the scope of this implementation. This distinction must be documented in the ADR for the audit log design.
> 
> **External timestamp:** Monthly export to an RFC 3161 timestamp authority (TSA). Provider to be confirmed. This extends the tamper-evidence guarantee to cover bulk deletion of recent records.

---

## 9. Platform Administrator Views

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 11.8 — Authorization Model, Tier 2 (full)_

> - Tier 2 (Platform Administrator, no developer): Role definitions, workflow definitions, document types, office hierarchy, notification templates, retention schedules, SLA thresholds, numbering series, report definitions, public visibility rules

_Source: same file, Part 11.21 — Extensibility Tiers, Administrator-configurable row_

> **Administrator-configurable (no developer):** All workflow definitions and step configurations; document type definitions and JSONB metadata schemas; office hierarchy; role definitions and permission assignments; notification templates; retention schedules; SLA thresholds; escalation targets; numbering series; report definitions; document type public visibility.

_Source: same file, Part 12 — Architectural Invariants (Platform-Administrator-relevant rows)_

> |12|Platform Administrator role cannot be combined with operational roles|Role assignment validation|

_Source: same file, Part 11.8 (repeated for emphasis — direct quote)_

> **Platform Administrator role cannot be combined with any document-processing role.** Enforced as an invariant.

_Source: same file, Part 4.12 — Designation, "Designation scope confirmation by Platform Admin" row_

> |Designation scope confirmation by Platform Admin|**Not required** — Interview 2 supersedes the prior design that included this step `[SUPERSEDES Interview 1 design]`|

[Inference] This last item is included because it explicitly rules out a Platform Administrator view/step that earlier design assumed would exist (designation confirmation) — relevant negative information for F1 so that view isn't mistakenly included in the route map.

---

## 10. Phase 1 Public Portal Subset

_Source: `consolidated-architecture-and-requirements-reference-iteration-3.md`, Part 2 — Phase 1 Deliverables list, public-portal row_

> - Public portal: approved resolutions and ordinances (title + first page public; full copy by paid Document Request)

_Source: same file, Part 1 — Minimum Viable Core list, public-portal row_

> 10. Public portal (Phase 1 subset: track by number + published documents with first-page preview)

_Source: same file, Part 11.18 — Citizen Portal and Identity (full section)_

> |Decision|Value|
> |---|---|
> |Citizen registration|Name, birthdate, phone, email + optional cross-reference with City Hall DB|
> |Verification|OTP to phone + OTP to email (both required)|
> |Ongoing login|Password + phone OTP|
> |Re-verification|Annual|
> |PhilSys|Feature-flagged; assume unavailable; enable if integration becomes available|
> |Accepted IDs|Government-issued ID, birth certificate, barangay residency certificate|
> |Privacy notice|Displayed at registration; citizen must acknowledge consent|
> 
> **Phase 1 public portal behavior confirmed:**
> 
> - First page of uploaded documents visible publicly; body is blurred
> - Title only shown in public listings
> - Full copy: Document Request Form required (three access modes) + VM + SP Secretary approval + payment
> - Complaint submission: same three access modes as document requests; physical signature still required

_Source: same file, Part 4.15 — Document and Records Request Form (full section)_

> Fee-based process for copies of SP documents. Approval requires both Vice Mayor AND SP Secretary signature.
> 
> **Confirmed fields:** Document type, title, number of pages, requester name/agency, date, email, ID presented, purpose, payment (Secretary's Fees under Ordinance No. 3SP 2014-05), OR number, collecting officer.
> 
> **QR code on form:** Confirmed. Website reference: sp.batac.gov.ph.
> 
> **Three access modes for both document requests and complaints `[CONFIRMED — Interview 2]`:**
> 
> 1. Citizen downloads template from sp.batac.gov.ph → submits physical document with handwritten/wet-ink signature
> 2. Citizen inputs details on digital form in batac-dms → system generates printable form → citizen prints, signs, and submits
> 3. Citizen goes to Secretariat in person → clerk inputs info into digital form → prints document on-site → citizen signs on the spot
> 
> Physical submission with signature is still required (documents must be signed). The digital form enables data capture and formatted document generation — not a replacement for the physical submission. `[CONFIRMED — Interview 2]`
> 
> **Post-approval notifications:** After a copy request is approved, person notified via contact number (primary channel). Payment then required before copy is released. `[CONFIRMED — Interview 2]`
> 
> **Payment system:** Deferred to **stages later than the currently planned phases**. Not Phase 1 or Phase 1B. `[RESOLVES Q-D04]`
> 
> **Public portal behavior confirmed:** First page of uploaded documents visible publicly; body is blurred. Title only shown in public listings. Full copy by request only. `[CONFIRMED]`

_Source: same file, Part 4.14 — Citizen Complaint, complainant access modes row_

> **Complainant access modes:** Same three access modes as Document Request Form (see Part 4.15): download-and-submit physical, digital form printed and signed, or in-person clerk-assisted.

_Source: same file, Part 11.6 — Document Tracking (DTS), public-facing QR-scan rows_

> |Scan result|Document type, remarks, history from draft, first page visible; other pages blurred| |Full copy access|"Get a copy" button on scan result → requires Document Request Form, VM + SP Secretary approval, payment|

_Source: same file, Part 7.5 — Current Systems and Migration Context, sp.batac.gov.ph coexistence row_

> |SP website sp.batac.gov.ph|**Subscription has been renewed. Usage continues indefinitely.** The batac-dms is a new system primarily for **internal use** with a public portal similar to sp.batac.gov.ph. Both systems will coexist. Formal retirement of sp.batac.gov.ph is not required. `[RESOLVES Q-C07]`|

_Source: `tech-stack.md` — Stack Decisions table, public portal row_

> |Public portal|Next.js (Phase 3)|SSG for SEO on citizen-facing document lookups|

[Unverified] This last row creates an apparent tension worth flagging rather than resolving: the stack-context file places the dedicated Next.js public portal app in Phase 3, while the requirements file repeatedly describes specific Phase 1 public-portal behavior (track by number, first-page preview, Document Request Form, Citizen Complaint submission). [Speculation] It's possible the Phase 1 portal functionality is intended to be served from within `/apps/web` itself (as unauthenticated routes) rather than from the not-yet-built `/apps/portal`, but neither source file states this directly, so F1 will need to resolve which app hosts these Phase 1 public routes — that decision is not made in source.

---

## 11. Roles Mentioned Across Source (raw inventory, not a finalized RBAC table)

[Unverified] Neither source file contains a single consolidated "list of all system roles." The following are all role-like terms found across both files, gathered here only as raw material — this is not a confirmed or exhaustive role taxonomy, and some of these may be job titles/offices rather than system roles.

- SP Secretary
- SP Secretariat (staff collectively; office, not necessarily one role)
- Mayor
- Vice Mayor (Presiding Officer)
- City Councilor
- Platform Administrator
- IT Admin / IT Director
- Records Officer
- City Administrator (mentioned re: Option B workflow-migration 2nd-level approval)
- City Legal Office
- Citizen (public portal user)
- Barangay official

_Source for "Platform Administrator role cannot be combined with any document-processing role" and the Tier 1/2/3 split: see Section 1.4 and Section 9 above (already quoted in full)._

---

## 12. Items Considered and Excluded as Not Needed for F1

[Inference] Per your instruction to exclude what "won't be used or is not needed," the following major sections of the source material were read in full but excluded from this curation because they describe business/legal process detail, data fields, or infrastructure that inform the _backend data model and workflow rules_, not the _frontend route structure_ — F1 only needs route paths, components, roles, tRPC dependencies, and child-route relationships:

- Detailed legislative workflow mermaid diagrams for SP Resolution and SP Ordinance beyond the action/decision points already excerpted in Section 5 (full diagrams describe sequencing, not separate views)
- Document numbering formats and delimiter rules (Part 5.1, 5.2, 5.3 of the requirements file) — these affect what a route _displays_, not which routes exist
- Standing Committees membership table (Part 6) — committee membership data, not a route
- Barangay Resolution and Barangay Budget workflows (Part 4.4, 4.5) — confirmed Phase 2/Phase 1B, not Phase 1 `/apps/web` scope per F1's own description
- Letters/Memos/Designations/NCH/NOSP document types (Part 4.6–4.12) — confirmed Phase 1B, not Phase 1
- Database schema conventions, disaster recovery, offline/connectivity, session management mechanics, citizen verification cryptography (Parts 11.7, 11.9–11.17 except where directly cited above) — backend/infra concerns, not route-level concerns
- Compliance/regulatory table (Part 11.19) and Roadmap phases 2–5 (Part 13, except the Phase 1 inclusion list already excerpted) — out of Phase 1 `/apps/web` scope
- Part 14 (Remaining Open Questions / Q&A resolution log) except where a specific resolved item directly changes a view's existence (Designation/Platform-Admin item, already included in Section 9)
- Full technology stack decision table beyond tRPC/module-boundary excerpts already pulled in Section 1 — most rows (ORM, email, PDF libraries, scheduling, etc.) don't bear on route structure

[Speculation] Some of these exclusions are debatable — for instance, the numbering-format rules could matter if F1 needs to note that a document detail route displays a Draft/Final number — but they describe data _content_ rather than the existence of a _route_, so they were left out of this gathering pass. If review of this curation later shows a gap, the original two files remain the source of truth and can be re-checked.

---

**Correction check:** I have not yet produced F1 itself — this document is explicitly the gathering/curation step you requested. No claims above were generated without a quoted source; everything outside quotation marks is either a heading, a verbatim Markdown table I reproduced from the source, or a labeled [Inference]/[Speculation]/[Unverified] note explaining a judgment call in what to include or exclude.