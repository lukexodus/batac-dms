# Document Management System

**City Government of Batac · Ilocos Norte** Stakeholder Briefing · Terms of Reference v0.1

_Draft — For Review · June 2026 · Development Team_

---

## Section 2.1 — How documents move today

City Hall currently manages official documents through predominantly manual, paper-based processes.

- **Routing depends on physical presence.** Documents are manually handed off between offices. Delays occur whenever a responsible person is absent or unavailable.
- **No real-time status visibility.** There is no centralized view of where a document is in its processing lifecycle. Status requires manual inquiry.
- **Retrieval is time-consuming.** Locating a specific document for audit or reference requires searching physical storage — unreliable and slow.
- **Version control is manual.** Earlier document versions are sometimes confused with or replace final copies, creating compliance and accuracy risks.
- **ARTA compliance unenforceable.** RA 11032 processing time limits cannot be monitored or enforced without automated tracking systems.
- **Records preservation at risk.** Inconsistent archiving creates risk of document loss and non-compliance with COA retention requirements.

---

## Section 2.2 — Why this is necessary

This is not simply an efficiency initiative. It is a legal obligation and a foundation for accountable governance.

### RA 11032 — Ease of Doing Business Act

Mandates legally enforceable maximum processing times: **3 days** for simple, **7 days** for complex, and **20 days** for highly technical transactions. Non-compliance carries penalties.

### Public Accountability & Transparency

Citizens have a right to access public government records and to know the status of their submissions. Digital infrastructure makes this feasible.

### Operational Scale

The volume of documents spanning SP legislative output, executive issuances, departmental operations, 43 barangay transmittals, and citizen services has reached a scale where manual management is an operational liability.

---

## Section 2.3 — Physical documents remain the legal source of truth

**Physical Records — Legal Source of Truth** Official resolutions, ordinances, contracts, and signed orders remain legally authoritative in their physical, wet-ink-signed form until COA formally confirms the legal equivalence of digital records for each document category.

**This System — Operational Source of Truth** The system provides the digital record of what was processed, by whom, when, and in what sequence. It manages workflows, tracking, and visibility — not legal originals replacement.

Physical and digital records coexist throughout system operation. LGU Batac will retain all physical originals post-digitization until formal regulatory confirmation is received from COA for each document category. This is not a paperless initiative — it is a digital operations layer alongside existing physical records.

---

## Project Overview

**A digital operations platform for City Hall**

Not merely file storage — a system that manages the complete lifecycle of official government documents from creation through routing, approval, tracking, archiving, and public access.

---

## Section 3 — Project Objectives

### Objectives (1 of 2)

1. **Digitize and centralize document storage** for the SP, Mayor's Office, all City Hall departments, and all 43 barangay governments of Batac City.
2. **Implement configurable document workflows** that enforce proper routing, approval, and tracking consistent with established LGU procedures.
3. **Provide real-time document tracking** with QR code generation, cover sheet printing, and complete routing history for every document.
4. **Enforce role-based access controls** strictly aligned with organizational positions and authority boundaries.
5. **Enable compliance with RA 11032** through automated service-level tracking and processing time monitoring per document type.

### Objectives (2 of 2)

6. **Provide a public-facing component** for citizens to access published government documents and track the status of their submitted requests — without visiting City Hall.
7. **Ensure long-term records preservation** through configurable retention schedules and disposition procedures consistent with COA and DILG requirements.
8. **Support transparency and accountability** through tamper-evident, append-only audit trails that record every action taken in the system.
9. **Establish a long-term digital foundation** designed to serve the city government reliably, with the capacity to add users and functionality as operational needs grow.

---

## Section 6 — User Roles

|Role|Type|Description|
|---|---|---|
|SP Secretary|Primary user|Full lifecycle control over SP resolutions and ordinances: logging, numbering, committee referral, certification, release, and archiving.|
|Mayor|Executive|Highest approval authority. Reviews and signs executive documents and SP ordinances. Views city-wide pending items from dashboard.|
|Vice Mayor|SP Presiding|Manages SP sessions. Certifies approved resolutions and ordinances after final vote.|
|SP Members / Councilors|Legislative|Reviews, comments on, and acts on legislative documents. Accesses session materials and committee referrals.|
|Department Heads & Staff|Departmental|Approvers and encoders within their own office. Cannot approve documents they also create, and cannot act outside their office scope.|
|Barangay Officials|Barangay|Barangay Secretaries and Captains submit and sign documents for their barangay via mobile browser. Access limited to their own barangay.|
|Records Officer|Compliance|Manages archiving, retention, and disposition of official records. Performs bulk archiving and export operations.|
|Auditor|Read-only|Read-only access to finalized documents and the audit log. Cannot modify any record.|
|Citizens|Public portal|Access to the public portal only. Can view public documents, submit requests and complaints, and track their own submissions.|

---

## Section 7 — Document Categories

### Category A — Full Workflow Documents

Full routing, approvals, signature recording, tracking, notifications, and audit trails.

- SP Resolution
- SP Ordinance
- Barangay Resolution
- Executive Order
- Citizen Request / Complaint

### Category B — Administrative Documents

Require approvals and tracking, but follow simpler, more linear workflows.

- Travel Order
- Leave Application
- Purchase Request / Order
- Disbursement Voucher
- Internal Memorandum

### Category C — Archive Documents

Completed documents requiring only storage, search, access control, and retrieval. No active workflow.

- Final certified resolution / ordinance PDFs
- Session minutes and attendance records
- Completed committee reports
- Historical migrated records

---

## Section 10.1 — Key Workflow: SP Resolution (Full Lifecycle)

Phase 1 priority. The system manages every step from draft to public record.

1. **Draft Prepared** — Councilor or SP Secretary
2. **Logged in System** — SP Secretary
3. **Committee Assignment** — SP Secretary
4. **Committee Review & Report** — Committee
5. **First Reading** — SP Session
6. **Amendment Phase** — SP Session (if any)
7. **2nd Reading & Vote** — SP Session
8. **Certification** — Vice Mayor
9. **Series No. Assigned & Released** — SP Secretary
10. **Reference Copy Transmitted** — Mayor's Office
11. **Archived** — Records Officer
12. **Published (if Public)** — Public Portal

> **System enforces this sequence.** No step can be bypassed unless the workflow definition explicitly permits it. Series numbers are assigned only at Step 9 — never at draft creation. Once assigned, numbers are immutable.

---

## Section 10.2 — Key Workflow: SP Ordinance (Full Lifecycle)

Includes legally mandated steps that the system cannot allow to be bypassed or removed from configuration.

1. **Draft Logged** — Councilor / SP Secretary
2. **Committee Review** — Committee (incl. public hearing if required)
3. **First Reading** — SP Session
4. **Second Reading** — SP Session
5. **Third Reading & Vote** — SP Session
6. **Vice Mayor Certification** — Vice Mayor
7. **Mayor's 10-Day Review** — Mayor: Sign · Veto · Lapse into law
8. **Official Copy & Publication** — SP Secretary
9. **Archived** — Records Officer

> **Automatic lapse-into-law handling.** If the Mayor does not act within 10 calendar days, the system automatically marks it as lapsed into law and notifies the SP Secretary. Three readings, Vice Mayor certification, and Mayor review are legally mandated steps that no configuration can remove.

---

## Section 4.1 — Document Tracking Identity

Every document gets a tracking identity.

1. A **unique tracking number** is assigned upon registration (format: `DTS-2026-000123`).
2. A **QR code** is generated for the physical cover sheet, encoding only the tracking number — no document content.
3. The **cover sheet** shows tracking number, QR code, document type, author, date, approvers, and retention schedule.
4. **Scan-to-lookup**: scanning the QR code retrieves current status and complete routing history — no login required for public documents.
5. Every movement between offices is recorded: from/to office, acting user, timestamp, and action taken.

---

## Section 10.4 — Key Workflow: Citizen Request

Citizens can submit requests in person or via the public portal. They receive a tracking number and can check status without visiting City Hall again.

1. **Citizen** submits request in person or via the public portal.
2. **Central Receiving** logs the document, assigns tracking number and QR label.
3. **Mayor's Office** assesses and assigns to the relevant department.
4. **Concerned Department** takes action on the request.
5. **Mayor's Office** confirms completion.
6. **Citizen** receives response or released document. Notified via the portal.

---

## Section 4.1 — Role-Specific Dashboards

Each user role sees a view tailored to their authority and responsibilities — not a generic document list.

- **SP Secretary** — Legislative queue, pending actions, session calendar, certification pipeline.
- **Mayor** — Pending signatures across all document types, overdue items, 10-day ordinance countdown.
- **Department Heads** — Departmental inbox, SLA status, items requiring approval, staff document activity.

---

## Use Cases

### Use Case 1 — Draft and Submit a Document

An encoder or staff member creates a new document in the system, attaches files, fills in metadata, and formally submits it to begin the workflow.

**Who does this:** Department Encoders, SP Secretary, Barangay Secretary — anyone authorized to originate a document for their office.

**What the system does:** Assigns a tracking number, stores the file(s) with version history, records metadata, and hands the document to the first workflow step. No series number yet — that is assigned only on formal approval.

> **No version is ever overwritten.** Every upload creates a new version. All previous versions are retained and accessible to authorized users.

---

### Use Case 2 — Document Routing and Approval

An approver receives an assigned document in their queue, reviews it, and takes an action — approve, reject, or return for revision.

1. System assigns the document to the current step's designated approver.
2. Approver receives an in-app notification and sees the item in their queue.
3. Approver reviews the document and attached files.
4. Action taken: **Approve** (advances), **Return for revision** (loops back), or **Reject** (requires written reason).
5. All actions are permanently recorded in the audit trail with timestamp.

---

### Use Case 3 — Scan a Physical Document, See Its Status

Any physical document with a printed cover sheet can be scanned to instantly retrieve its complete routing history and current status — no login required for public documents.

**The flow:** Staff member or citizen points phone camera at QR code on cover sheet → system resolves the tracking ID → routing history and current status are shown instantly.

**What they see:** Document type, current status, current holder (office), full movement history with timestamps, and the names of actors at each step.

> **QR code contains only the tracking ID.** No document content, no URLs, no metadata is encoded in the QR itself. All data is fetched from the database using the ID.

---

### Use Case 4 — SLA Monitoring and Escalation

The system continuously tracks how long each document has been at each step and automatically alerts and escalates when limits are approached or breached — as required by RA 11032.

**At 80% of the time limit:** The assigned user and their supervisor receive an in-app warning notification. The document is flagged in their queue with a visual indicator.

**At 100% — SLA breach:** The system automatically escalates the document to the designated supervisor, logs an escalation event in the audit trail, and sends notifications to both the user and supervisor.

> **System outage does not pause the SLA clock.** RA 11032 obligations continue regardless of system availability. Thresholds: simple ≤ 3 days, complex ≤ 7 days, highly technical ≤ 20 working days.

---

### Use Case 5 — Citizen Submits and Tracks a Request

A resident of Batac City submits a service request through the public portal and monitors its progress from their phone — without a single visit to City Hall.

**Portal registration:** Citizens register with name, phone, and email. Both are verified via one-time passwords before the account activates. A privacy notice is acknowledged at registration.

**No account needed for status lookup:** Anyone can enter a tracking number on the public portal and see the current status and routing history of any Public-classified document — no login required.

**What citizens can see and do:** Track submitted requests, view approved SP resolutions and ordinances, read announcements, and submit complaints. Classification guardrails prevent internal documents from ever being visible.

---

### Use Case 6 — Barangay Submits to City Hall

A Barangay Secretary digitally transmits a barangay resolution or endorsement letter to City Hall from their phone — no physical delivery needed to initiate the process.

**Mobile-first design:** Barangay officials primarily use personal phones. All 43 barangay-facing functions operate via mobile browser on iOS and Android, including offline queuing for intermittent connections.

**Access is scoped to the barangay:** A Barangay Secretary can only see and manage documents from their own barangay. City Hall documents from other offices are not visible to them.

**What happens after submission:** City Hall Receiving logs and assigns a tracking number. The document is routed to the SP Secretariat or Mayor's Office depending on subject matter. The barangay receives a response when complete.

---

### Use Case 7 — Records Archiving and Retention

Once a document's workflow is complete, it enters the records lifecycle — governed by retention schedules, classification rules, and COA requirements.

1. Completed documents are promoted to **official record status** by the Records Officer.
2. The system applies the **retention schedule** assigned to that document type — permanent, long-term, or finite.
3. At **80% of the retention period**, the Records Officer receives an alert to review the document.
4. **Disposition** requires explicit Records Officer action with a mandatory written reason. No automated disposal.
5. A **disposed record's metadata row is never deleted** — it is marked as disposed with actor and timestamp.

**Retention schedule examples:**

|Schedule|Document Types|
|---|---|
|Permanent|SP Resolutions, Ordinances, Signed Contracts|
|10–15 years|Personnel records, Citizen correspondence|
|5 years|Internal memos, non-critical minutes|
|1 year|Routine workflow logs, draft versions|

> **No document is ever permanently deleted.** Disposition creates an audit record. The metadata row persists, marked as disposed, with actor and timestamp preserved forever.

---

### Use Case 8 — Administrator Configures a Workflow

An authorized Platform Administrator defines or updates a document workflow — adding steps, assigning roles, setting SLA timers — without any developer involvement.

**Fully configurable without code:** Workflow steps, transitions, assignee rules, SLA thresholds, escalation targets, branching conditions, and notification templates are all admin-configurable via the system interface.

**Versioned — safe to change:** Changes create a new workflow version. Documents already in progress continue under their original version. No in-flight document is disrupted by a configuration change.

> **Legally mandated steps cannot be removed.** The system validates that SP Ordinance and SP Resolution workflows include all steps required by law. Attempting to publish a definition without these steps is blocked.

---

### Use Case 9 — Search and Retrieve a Document

Any authorized user can find a specific document in seconds — by type, office, date range, status, or keyword — without searching physical cabinets.

**Search filters:** Document type, originating office, date range, status (draft, in-workflow, archived), and classification level. Results are scoped to what the user's role and office permit them to see.

**Version history always accessible:** Every version of a document is retained. Authorized users can view, download, or compare any previous version. The current official copy is always clearly identified.

> **Access is enforced, not just displayed.** A user only sees documents their role and office permit. Confidential and restricted documents are excluded from results unless the user is on the explicit allowlist.

---

### Use Case 10 — Audit Log Review

An Auditor or COA reviewer examines the complete, unalterable action history of any document — every action, every actor, every timestamp — to verify that all steps were performed correctly.

**What is recorded:** Every authentication event, document state change, approval, role assignment, bulk operation, export, and session event — with actor identity, IP, timestamp, and session ID.

**Tamper-evident by design:** Each audit entry includes a hash of the previous entry, forming a cryptographic chain. Any modification to historical entries breaks the chain and is automatically flagged at retrieval time.

> **The Auditor role is read-only.** An Auditor cannot modify any record. The audit schema uses INSERT-only database permissions — no UPDATE or DELETE is possible, even for IT Administrators.

---

_Document Management System · Terms of Reference v0.1 · City Government of Batac, Ilocos Norte_ _Draft — For Stakeholder Review · June 2026_

This presentation is based on the preliminary TOR. All scope, timelines, and requirements are subject to revision following stakeholder consultation.