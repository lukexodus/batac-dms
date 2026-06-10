# Batac City LGU Platform — Domain Context

---

## 1. What This Platform Is

The **Batac City LGU Platform** is an official government operations platform for **Batac City, Ilocos Norte, Philippines** — a component city under the province of Ilocos Norte, governed by a City Hall (City LGU).

It is **not** a narrow document management system. It is a multi-module platform intended to become the official digital operations backbone for the entire city government, including:

- The Mayor's Office (Executive Branch)
- The Sangguniang Panlungsod or SP Office (Legislative Branch)
- All City Hall departments and offices
- Barangay governments (42 barangays under Batac City)
- Citizens (public access to selected functionality)

**Physical documents remain the legal source of truth. The digital platform is the operational source of truth for tracking, workflow, reporting, transparency, and efficiency.**

---

## 2. Platform Purpose

The platform digitizes and centralizes:

- **Document lifecycle management** — from creation or receipt through routing, approval, signature, archiving, and retrieval
- **Cross-office workflow execution** — routing documents between offices with enforced steps, approvals, and SLA tracking
- **Accountability and auditability** — who acted on what, when, and in what capacity
- **Records preservation** — retention policies, classification, and long-term archiving
- **Public transparency** — citizen access to document status and published government records
- **Operational visibility** — dashboards, KPIs, and reports for management and department heads

---

## 3. Implementation Scope (Phased)

Modules in priority order. Only the first two are in the initial implementation phase; however, all architectural foundations must support all five from the beginning.

|Priority|Module|Description|
|---|---|---|
|1|Document Management System (DMS)|Store, organize, version, and retrieve documents and file attachments|
|2|Document Tracking System (DTS)|Track document movement between offices; QR code generation and lookup; routing history|
|3|Workflow Management System (WMS)|Admin-configurable process definitions; step-by-step routing enforcement; SLA timers; branching, merging, looping, versioning|
|4|Records Management System (RMS)|Retention schedules; classification; archiving; disposition|
|5|Government Portal|Public-facing document status lookup; citizen request submission; published resolutions and ordinances; transparency portal|

---

## 4. LGU Organizational Structure

### 4.1 Government Branches

```
Batac City Government
│
├── Executive Branch          ← Mayor; runs day-to-day operations
├── Legislative Branch        ← Vice Mayor + City Council (SP); creates local laws
└── Barangay Governments      ← 42 barangays; each semi-autonomous
```

### 4.2 Executive Branch — Core Offices

The Mayor heads the executive branch. All department heads report to the Mayor, coordinated by the City Administrator.

| Office                                                | Primary Responsibility                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| Office of the Mayor                                   | Executive authority; approves major documents; issues Executive Orders |
| Office of the City Administrator                      | Coordinates all departments; operations oversight                      |
| City Treasurer's Office                               | Revenue collection; taxes; fees; permits                               |
| City Accountant's Office                              | Financial recording; disbursement; ledgers                             |
| City Budget Office                                    | Budget preparation; fund allocation; monitoring                        |
| City Assessor's Office                                | Property valuation; tax declarations; assessment records               |
| City Engineering Office                               | Infrastructure; public works; building permits; inspections            |
| City Health Office                                    | Health programs; clinics; health inspections                           |
| City Social Welfare and Development Office (CSWDO)    | Senior citizens; PWDs; financial assistance; social programs           |
| City Civil Registrar                                  | Birth, death, marriage records                                         |
| Human Resource Management Office (HRMO)               | Employee records; leave; attendance; recruitment                       |
| Business Permits and Licensing Office (BPLO)          | Business registration; permit issuance; renewal                        |
| City Planning and Development Office (CPDO)           | Long-term development planning                                         |
| City Agriculture Office                               | Agricultural programs and support                                      |
| Disaster Risk Reduction and Management Office (DRRMO) | Disaster preparedness and response                                     |
| City Legal Office                                     | Legal advice; review of ordinances and contracts                       |
| City IT Office                                        | Technology infrastructure                                              |
| Public Information Office (PIO)                       | Communications; public notices                                         |

**Mandatory offices under RA 7160 (Local Government Code):** Treasurer, Accountant, Budget Officer, Assessor, Planning Officer, Engineer, Health Officer, Civil Registrar, Legal Officer, Administrator.

### 4.3 Legislative Branch — SP Office

The **Sangguniang Panlungsod (SP)** is the City Council. The Vice Mayor presides.

|Role|Responsibility|
|---|---|
|Vice Mayor|Presides over SP sessions; certifies passed legislation|
|City Councilors|Propose, review, and vote on resolutions and ordinances|
|SP Secretary|Manages all SP documents; maintains legislative records; controls resolution/ordinance numbering|
|SP Committees|Review specific legislation by subject (Finance, Public Works, Health, etc.)|
|Liga ng mga Barangay Rep.|Represents all 42 barangay captains in the SP|
|SK Federation Rep.|Youth sector representation|

### 4.4 Barangay Governments

Each of the 42 barangays under Batac City has:

|Role|Responsibility|
|---|---|
|Barangay Captain|Chief executive of the barangay; authority limited to within the barangay|
|Barangay Council|Passes barangay resolutions; approves barangay budget|
|Barangay Secretary|Administers barangay documents; transmits documents to city hall|
|Barangay Treasurer|Manages barangay funds|
|SK Chairperson|Heads the youth council (Sangguniang Kabataan)|

Barangays frequently transmit resolutions and endorsement letters to the city government for action.

### 4.5 Jurisdiction and Authority Boundaries

Each office has authority only within its defined scope. **No office may modify another office's official records without explicit authorization.** This is a core data ownership rule enforced at the permission level.

|Official / Body|Scope of Authority|
|---|---|
|Mayor|Entire city|
|City Council (SP)|Local legislation for the entire city|
|Department Heads|Their own office and its documents|
|Barangay Captain|Within their barangay only|
|City Treasurer|City revenue collection and cashiering|
|City Assessor|Property assessment within the city|

---

## 5. How LGU Work Actually Flows

**LGU work is fundamentally cross-office workflows.** Departments do not operate in isolation. A single document typically passes through multiple offices before completion.

The platform must model this reality, not a simplified single-office view.

### 5.1 General Document Flow Pattern

```
Origination (citizen, employee, or official)
        ↓
Central Receiving (log, assign tracking number, attach QR label)
        ↓
Routing Office (Mayor's Office or SP Secretariat, depending on document type)
        ↓
One or More Departments (review, action, endorsement)
        ↓
Approval Authority (Department Head, Mayor, SP)
        ↓
Completion / Release
        ↓
Records (archive, classify, apply retention policy)
        ↓
Public Portal (if applicable)
```

### 5.2 Key Workflow Examples

**SP Resolution (Legislative)**

```
Draft (Councilor or Secretary)
  → SP Secretary (log, assign series number)
  → Committee Assignment
  → Committee Review and Report
  → 1st Reading (SP Session)
  → Amendment phase (if any)
  → 2nd Reading or Final Reading
  → SP Session Vote
  → Vice Mayor (certify)
  → SP Secretary (official copy; release)
  → Mayor's Office (transmit reference copy)
  → Records (archive)
  → Public Portal (publish)
```

**SP Ordinance (Local Law — more stages than a resolution)**

```
Draft
  → SP Secretary (log)
  → Committee (review; may require public hearing)
  → 1st Reading
  → 2nd Reading
  → 3rd Reading (final vote)
  → Vice Mayor (certify)
  → Mayor (10-day review; may veto or allow lapse into law)
  → SP Secretary (official archive copy)
  → Publication (legally required)
  → Records
```

**Executive Document — Travel Order**

```
Employee (request)
  → Supervisor (endorse)
  → Department Head (approve)
  → Mayor's Office (approve if required)
  → HRMO (record)
  → Finance (if funding implications)
```

**Procurement — Purchase Request**

```
Requesting Office
  → Department Head (endorse)
  → Budget Office (certify fund availability)
  → City Accountant (pre-obligation)
  → BAC Secretariat (procurement process)
  → Award → Delivery → Acceptance Inspection
  → Accounting (disbursement)
```

**Citizen Request**

```
Citizen (submit)
  → Central Receiving (log, assign tracking number)
  → Mayor's Office (assess, assign to department)
  → Concerned Department (action)
  → Mayor's Office (confirm completion)
  → Citizen (response / release)
```

**Barangay to City Hall**

```
Barangay Council (passes resolution or endorsement)
  → Barangay Secretary (certify, transmit to city hall)
  → City Hall Central Receiving
  → SP Secretariat or Mayor's Office (depending on subject)
  → Committee or Department (action)
  → Response to Barangay
```

---

## 6. The Five System Types

The platform is composed of five functional systems, each responsible for a distinct phase of the document lifecycle.

```
Document Lifecycle:
  Creation → Storage → Movement → Approval → Completion → Archiving → Retrieval
```

### 6.1 Document Management System (DMS)

**Core question answered:** _Where is the document stored? What is it?_

Responsibilities:

- Uploading, versioning, and categorizing documents
- File storage (PDFs, scanned images, DOCX, attachments)
- Document metadata (type, author, date, classification, owning office)
- Download and retrieval
- Full-text search across stored content

The DMS does **not** manage who approves it or where it goes next. It stores.

### 6.2 Document Tracking System (DTS)

**Core question answered:** _Where is the document right now? Who has it? How long?_

Responsibilities:

- Assigning tracking numbers (e.g., `DTS-2026-000123`)
- Generating QR codes or barcodes that encode only the tracking ID
- Recording each movement: received at, forwarded to, returned from
- Logging custodian at each stage (office + user)
- Providing scan-to-lookup functionality for physical documents
- Surfacing routing history to any authorized user

The DTS records what happened. The WMS defines what should happen. These are distinct.

**QR/Barcode rule:** The QR code stores only the tracking number. All document data is fetched from the database using that ID. Never embed document content in a QR code.

### 6.3 Workflow Management System (WMS)

**Core question answered:** _What is required to happen next? Who must act? By when?_

Responsibilities:

- Storing configurable workflow definitions (steps, transitions, conditions, roles)
- Executing workflow instances (one instance per document)
- Enforcing step order — a step cannot be bypassed unless the definition allows it
- Resolving step assignees at runtime from role definitions and org structure
- Tracking SLA timers per step and escalating overdue items
- Supporting branching (conditional next step), parallel splits/merges, and loop-backs
- Versioning workflow definitions; pinning each instance to its definition version at creation time
- All definitions are admin-configurable without developer involvement

### 6.4 Records Management System (RMS)

**Core question answered:** _How long must this record be kept? Who can access it? Can it be disposed of?_

Responsibilities:

- Classifying documents as official records upon workflow completion
- Applying retention schedules (permanent, long-term, finite) per document type
- Managing the active → inactive → archived → disposition lifecycle
- Enforcing classification levels (public, internal, restricted, confidential)
- Supporting compliance with COA, DILG, and other regulatory retention requirements
- Authorizing and documenting records disposition

### 6.5 Government Portal

**Core question answered:** _How do citizens and external parties interact with the system?_

Responsibilities:

- Public document status lookup by tracking number (no login required)
- Citizen request submission and tracking
- Citizen complaint submission and tracking
- Published library of approved resolutions and ordinances
- City government announcements and public notices
- Role-gated internal portal (login required for employees and barangay officials)

---

## 7. Document Types and Classification

Documents fall into three operational categories that determine how the platform handles them.

### Category A — Workflow Documents

Require full routing, approvals, signature recording, tracking, notifications, and audit logs. These justify the full workflow engine.

|Document Type|Primary Owner|Approvers|Permanent Record|
|---|---|---|---|
|SP Resolution|SP Secretariat|SP (vote) + Vice Mayor|Yes|
|SP Ordinance|SP Secretariat|SP (vote) + Vice Mayor + Mayor|Yes|
|Barangay Resolution|Barangay Office|Barangay Council|Yes|
|Executive Order|Mayor's Office|Mayor|Yes|
|Memorandum Order|Mayor's Office|Mayor|Yes|
|Endorsement Letter|Originating Office|Department Head or Mayor|Yes|
|Citizen Request|Central Receiving|Department Head (Mayor if required)|Medium retention|
|Citizen Complaint|Central Receiving|None (investigated and closed)|Medium retention|

### Category B — Administrative Documents

Require approvals and tracking but follow simpler, more linear workflows.

|Document Type|Approvers|Retention|
|---|---|---|
|Travel Order|Supervisor → Department Head → Mayor|Finite (per COA policy)|
|Leave Application|Supervisor → Department Head → HRMO|Finite|
|Purchase Request|Department Head → Budget → Accounting → Mayor (above threshold)|Finite (financial)|
|Purchase Order|BAC → Department Head → Mayor|Finite (financial)|
|Project Proposal|Department Head → Mayor (or SP if budget-linked)|Long-term|
|Memorandum (Internal)|Department Head|No (working document)|
|Disbursement Voucher|Accountant → Mayor|Long-term (COA)|
|Inspection Report|Inspector → Department Head|Long-term|
|Accomplishment Report|Department Head|Long-term|
|Job Order / Contract|HR → Legal → Mayor|Long-term|

### Category C — Archive Documents

Completed documents that require only storage, search, download, and access control. No active workflow.

- Approved ordinance PDFs (final published copies)
- Approved resolution PDFs (final certified copies)
- Session minutes (finalized)
- Committee reports (finalized)
- Reference documents and attachments
- Historical records

---

## 8. Document Lifecycle States

All documents progress through a defined lifecycle. States vary by document type and workflow definition, but the general model is:

```
Draft
  → Submitted (formally entered into the system)
  → In Review / In Routing (active workflow instance running)
  → Pending Approval (waiting for an approver's action)
  → Returned for Revision (sent back; loops)
  → Approved / Completed
  → Released (official copy issued)
  → Archived (transferred to records; workflow closed)
  → Disposed (retention period expired; authorized disposition)
```

Cancelled is a terminal state reachable from any active state by an authorized actor.

---

## 9. Key Domain Entities

These are the primary entities the platform models. Detailed schemas are in Part 2.

|Entity|Description|
|---|---|
|User|Any person with system access; linked to an employee record or citizen profile|
|Office|An LGU office or department (e.g., SP Secretariat, City Engineering Office)|
|Employee|An LGU staff member; belongs to an office; holds a position|
|Position|The organizational job title (e.g., SP Secretary, Department Head)|
|Role|A system permission group (e.g., Approver, Encoder, Records Officer); separate from position|
|Document|The core entity; has a type, classification, owning office, metadata, and file attachments|
|DocumentType|Configurable classification (SP Resolution, Travel Order, etc.) with associated metadata schema|
|DocumentVersion|Each upload or revision of a document file; previous versions retained|
|DocumentNumber|Official sequential series number (e.g., Resolution No. 2026-001); assigned by the system|
|Attachment|A file linked to a document; stored in object storage; referenced by UUID key|
|WorkflowDefinition|A named, versioned process with steps and transition rules; admin-configurable|
|WorkflowInstance|A running execution of a definition for a specific document|
|WorkflowStep|A node in a definition: action, approval, parallel split/join, decision, or notification|
|StepInstance|A single step execution within an instance; has an assignee, SLA timer, and status|
|TrackingRecord|The DTS record for a document; holds the full routing history|
|RoutingEntry|One movement event in the routing history: from, to, actor, timestamp, action|
|QRCode|A QR or barcode label encoding only the tracking number; links to the document's public status page|
|SignatureRecord|Records who signed, when, and with what method (scanned image initially; extensible for PKI)|
|Record|A document promoted to official record status; governed by retention and classification rules|
|RetentionSchedule|Policy defining how long a record of a given type must be kept|
|AuditEvent|An append-only tamper-evident log entry for every system action|
|Notification|A message sent to a user triggered by a workflow or tracking event|
|CitizenRequest|A request submitted by a citizen through the portal|
|CitizenComplaint|A complaint submitted by a citizen through the portal|

---

## 10. System Roles

These are system-level roles (permission groups), not organizational positions. One person may hold multiple roles.

|Role|Description|
|---|---|
|System Administrator|Infrastructure-level access; no read access to confidential document content|
|Platform Administrator|Configures workflows, document types, roles, offices, notification templates, retention schedules, numbering series|
|Records Officer|Manages archiving, retention, and disposition|
|Department Encoder|Creates and submits documents on behalf of their office|
|Department Approver|Approves documents at their office level; scoped to their own office|
|SP Secretary|Full control over SP legislative document lifecycle|
|SP Member|Reviews, comments, and acts on legislative documents assigned to them|
|SP Presiding Officer|Certifies SP legislative output|
|Mayor|Highest executive approval authority|
|Barangay Encoder|Submits documents on behalf of a barangay|
|Barangay Captain|Approves and signs barangay-originated documents|
|Auditor|Read-only access to finalized documents and audit logs|
|Citizen|Public portal access; own submitted requests and complaints only|

---

## 11. Legal and Regulatory Context

The platform must operate within these Philippine legal frameworks. They have direct implications for system behavior.

|Law / Regulation|Implication|
|---|---|
|RA 7160 — Local Government Code|Defines mandatory offices, authority scopes, legislative processes, and inter-government document flows|
|RA 11032 — Ease of Doing Business Act (ARTA)|Mandates maximum processing times: simple transactions ≤ 3 working days, complex ≤ 7 days, highly technical ≤ 20 days. SLA tracking and ARTA compliance reporting are a legal requirement|
|RA 10173 — Data Privacy Act|Citizen personal data is PII; requires consent tracking, data subject rights handling, and breach notification; conflicts with no-deletion policy for certain data categories|
|RA 9184 — Government Procurement Reform Act|Procurement documents have specific legal requirements for transparency, publication, and record-keeping|
|COA Circulars|Commission on Audit prescribes retention periods and format requirements for financial and procurement records|
|DILG Circulars|Department of Interior and Local Government may prescribe operational and records standards for LGUs|

