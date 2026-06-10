REPUBLIC OF THE PHILIPPINES
Province of Ilocos Norte
CITY GOVERNMENT OF BATAC

TERMS OF REFERENCE
Document Management System
Sangguniang Panlungsod and City Government of Batac

| Document Status        | Draft — For Stakeholder Review                         |
| :--------------------- | :----------------------------------------------------- |
| **Version**            | 0.1                                                    |
| **Date**               | June 2026                                              |
| **Prepared By**        | Development Team                                       |
| **Primary Recipients** | LGU Batac Stakeholders; SP Secretariat; City IT Office |

This document is preliminary. All scope, timelines, and requirements are subject to revision following stakeholder consultation.

# **1\. Executive Summary**

The City Government of Batac, Ilocos Norte, is commissioning the development of a web-based Document Management System (DMS) to digitize, centralize, and streamline how the Sangguniang Panlungsod (SP), the Mayor's Office, and City Hall departments create, route, approve, store, and retrieve their official documents and records.

The system will serve the SP Secretariat as its primary user — managing the complete lifecycle of SP resolutions, ordinances, and supporting legislative documents — alongside the Mayor's Office, City Hall department personnel, barangay secretariats, and SP members. In a later stage, a public-facing component will allow citizens to access published government documents.

This Terms of Reference defines the objectives, scope, user roles, functional requirements, non-functional requirements, deliverables, timeline, and compliance obligations for the project. It is the primary reference document for all parties involved and serves as the basis for stakeholder consultation, requirements gathering, and formal project agreement. All items herein are subject to revision following the requirements-gathering process.

# **2\. Background and Rationale**

## 2.1 Current State

The City Government of Batac currently manages its official documents — resolutions, ordinances, travel orders, purchase requests, citizen requests, complaints, and many other document types — through predominantly manual, paper-based processes. Documents are physically routed between offices, filed in folders and cabinets, and tracked through logbooks and informal systems.

The operational consequences of this approach include:

* Documents are frequently delayed because routing depends on physical presence and manual handoff between offices.

* Locating a specific document for retrieval, audit, or reference requires searching physical storage, which is time-consuming and unreliable.

* There is no centralized, real-time view of where a document is in its processing lifecycle.

* Citizens have no reliable way to check the status of their submitted requests without visiting City Hall in person.

* Compliance with the Ease of Doing Business Act (RA 11032\) processing time limits is difficult to monitor and enforce without automated tracking.

* Version control for documents under revision is manual, and earlier versions are sometimes lost or confused with final copies.

* Records preservation is inconsistent; some documents lack systematic archiving, creating risks of loss and non-compliance with COA retention requirements.

## 2.2 Why Digitization Is Necessary

Republic Act 11032 (Ease of Doing Business and Efficient Government Service Delivery Act of 2018\) legally mandates maximum processing times for all government transactions: simple transactions within 3 working days, complex transactions within 7 working days, and highly technical transactions within 20 working days. The LGU is therefore required to have systems that enable, enforce, and report on these processing times.

Beyond legal compliance, digitization supports public accountability and transparency. Citizens have a right to access public government records and to know the status of their submissions.

The volume of documents processed by the City Government of Batac — spanning SP legislative output, executive issuances, departmental operations, barangay transmittals, and citizen services — has reached a scale where manual management is an operational liability. A centralized digital system is the necessary foundation for efficient, accountable governance.

## 2.3 The Physical–Digital Distinction

This system does not replace physical documents as the legal source of truth. Official government documents — resolutions, ordinances, contracts, signed orders, and other legally binding instruments — remain legally authoritative in their physical, wet-ink-signed form until such time as the Commission on Audit and relevant regulatory bodies formally confirm the legal equivalence of digital records for each document category.

The system serves as the operational source of truth: it provides the digital record of what was processed, by whom, when, and in what sequence. Physical and digital records coexist throughout the system's operation.

# **3\. Project Objectives**

The project aims to achieve the following objectives:

1. Digitize and centralize document storage for the Sangguniang Panlungsod, the Mayor's Office, all City Hall departments, and all 42 barangay governments of Batac City.

2. Implement configurable document workflows that enforce proper routing, approval, and tracking of official documents across offices, consistent with established LGU procedures.

3. Provide real-time document tracking with QR code generation, cover sheet printing, and complete routing history for every document in the system.

4. Enforce role-based access controls strictly aligned with organizational positions and authority boundaries, ensuring that users can access only what their role and office permit.

5. Enable compliance with RA 11032 (Ease of Doing Business Act) through automated service-level tracking and processing time monitoring per document type.

6. Provide a public-facing component for citizens to access published government documents and track the status of their submitted requests.

7. Ensure long-term records preservation through configurable retention schedules, archiving policies, and disposition procedures consistent with COA and DILG requirements.

8. Support transparency and accountability through tamper-evident, append-only audit trails that record every action taken in the system.

9. Establish a digital foundation designed to serve the city government reliably for the long term, with the capacity to add users and functionality as operational needs grow.

# **4\. Project Scope**

## 4.1 In Scope

### User Authentication and Session Management

* Secure login and logout with session management.

* Password reset and account recovery.

* Multi-factor authentication (MFA) for high-privilege accounts (Mayor, SP Secretary, Department Heads, Platform Administrator, IT Administrator).

* User account creation, modification, and deactivation by authorized administrators.

* Session management for shared workstations: a user can suspend their session and allow another user to log in on the same device without terminating the first session.

* Audit logging of all login events and authentication activities.

### Role-Based Access Control

* A defined set of system roles for all identified user types (see Section 6).

* Access to documents and actions governed by the user's assigned role and office membership.

* Office-scoped permissions: users may access only documents belonging to their office unless explicitly granted broader access.

* Document classification levels controlling who can view sensitive documents.

* Full separation between system administration functions and document processing functions.

### Document Management

* Upload, version, classify, and retrieve documents in standard formats: PDF, DOCX, XLSX, and images (PNG, JPG).

* Document metadata management: type, originating office, author, subject, date, and classification level.

* Version history: all previous versions retained and accessible to authorized users. No version may be overwritten or deleted.

* Official document series number management (e.g., Resolution No. 2026-001), assigned at the point of formal approval — not at draft creation. Numbers, once assigned, are immutable.

* Document search and filtering by metadata fields.

* Document classification by sensitivity: Public, Internal, Confidential, or Restricted.

### Document Workflow

* Configurable workflow definitions: an authorized administrator can define and modify document routing steps, approval requirements, and conditions without developer involvement.

* Enforced step-by-step routing: a document cannot skip a required step unless the workflow definition explicitly permits it.

* Approval, rejection, and return-for-revision actions at each step, with mandatory comments on rejection.

* Loop-back support: rejection returns the document to a specified earlier step.

* Conditional branching: workflow paths can diverge based on document attributes or approval outcomes.

* Service-level tracking per step, with alerts when deadlines are approaching or exceeded.

* The following workflows are delivered: SP Resolution (full lifecycle), and the SP Ordinance (full lifecycle including Mayor's 10-day review period).

* Executive document workflows (Travel Order, Leave Application, internal Memoranda) are included as configurable workflow definitions.

### Document Tracking

* A unique tracking number assigned to every document upon registration (e.g., DTS-2026-000123).

* QR code generation for physical document cover sheets, encoding only the document's tracking number.

* Cover sheet generation: a printable page containing the tracking number, QR code, document type, author, date, approvers, and retention schedule.

* Scan-to-lookup: scanning the QR code retrieves the document's current status and complete routing history.

* Complete routing history: every movement between offices recorded with timestamps and responsible personnel.

* Physical custody tracking maintained separately from the digital workflow status.

### Dashboards and Notifications

* Role-specific dashboards for: SP Secretary (legislative queue, pending actions, session calendar), Mayor (pending signatures, overdue items), and Department Heads (departmental inbox).

* In-application notifications for pending actions, approaching deadlines, and workflow events.

* Real-time document status visibility for all authorized users.

### Audit Trail

* Tamper-evident, append-only audit log recording every action in the system: who did what, to which document, and when.

* Hash-chained records ensuring any modification to historical entries is detectable.

* Accessible to authorized auditors; not modifiable by any user or administrator.

### Public Document Portal

* Any member of the public can look up a document's status and routing history by entering its tracking number, without creating an account.

* A searchable library of all approved SP resolutions and ordinances classified as Public.

* Registered citizens can submit service requests and complaints through the portal and receive notifications on their status.

* The portal never exposes documents classified as Internal, Confidential, or Restricted, regardless of any configuration setting.

### Infrastructure

* Cloud-based deployment using provider-agnostic technologies to preserve future flexibility for on-premise migration.

* Automated daily database backups with point-in-time recovery capability.

* Hot standby with automated failover, targeting a maximum system recovery time of 4 hours and maximum data loss of 1 hour.

* All infrastructure defined in code; no manual configuration.

## 4.2 Out of Scope

* Replacement of existing payroll, HRIS, accounting, or treasury systems.

* Hardware procurement (computers, printers, scanners, networking equipment).

* Network infrastructure installation or upgrades.

* Physical records management (cabinets, storage facilities, physical archiving).

* Training delivery, unless separately agreed as a project deliverable.

* Any system serving LGUs other than Batac City.

* Electronic signature with cryptographic PKI infrastructure.

* Integration with national government systems (e.g., PhilSys, GSIS).

# **5\. System Components**

The system is organized around three core functional components, each responsible for a distinct aspect of the document lifecycle.

| Component | Primary Function | Answers the Question |
| :---- | :---- | :---- |
| Document Management System (DMS) | Store, organize, version, classify, and retrieve documents. | What is the document? Where is it stored? What version is current? |
| Document Tracking System (DTS) | Track document movement between offices. QR codes. Routing history. | Where is the document right now? Who has it? Where has it been? |
| Workflow Management System (WMS) | Define and enforce document routing and approval sequences. SLA tracking. | What is required to happen next? Who must act? By when? |

# **6\. User Roles**

The system supports the following user roles. A single person may hold more than one role. Each role determines what the user can see and do within the system.

| Role | Description and Scope |
| :---- | :---- |
| Platform Administrator | Configures the system: workflow definitions, document types, office hierarchy, user roles, notification templates, and numbering series. Cannot simultaneously hold any document-processing role. |
| Records Officer | Manages archiving, retention, and disposition of official records. Performs bulk archiving and export operations. |
| SP Secretary | Full control over the SP legislative document lifecycle: logging, numbering, committee referral, session management, certification, release, and archiving of resolutions and ordinances. |
| SP Presiding Officer (Vice Mayor) | Manages SP sessions. Certifies approved resolutions and ordinances. |
| SP Member (Councilor) | Reviews, comments on, and acts on legislative documents assigned to their queue. Accesses session materials and committee referrals. |
| Mayor | Highest executive approval authority. Reviews and signs executive documents and SP ordinances. Views city-wide pending items. |
| Department Approver | Approves documents within their own office's scope. Cannot approve documents from another office. |
| Department Encoder | Creates and submits documents on behalf of their office. Cannot approve the same documents they encode. |
| Barangay Secretary | Submits documents on behalf of a barangay government. Manages and tracks barangay-level records. Access limited to their barangay's documents. |
| Barangay Captain | Approves and signs barangay-originated documents. Authority limited to their own barangay. |
| Auditor | Read-only access to finalized documents and the audit log. Cannot modify any record. |
| System Administrator (IT) | Manages system infrastructure, user accounts, and technical operations. Does not have read access to confidential or restricted document content. |
| Citizen (Public Portal) | Access to the public portal only. Can view publicly available documents, submit requests and complaints, and track their own submissions. |

# **7\. Document Categories and Types**

All documents in the system are classified into one of three operational categories, which determine how the system handles them.

## 7.1 Category A — Full Workflow Documents

These documents require complete routing, approvals, signature recording, tracking, notifications, and audit trails.

| Document Type | Primary Owner | Approval Authority |
| :---- | :---- | :---- |
| SP Resolution | SP Secretariat | SP Session Vote \+ Vice Mayor Certification |
| SP Ordinance | SP Secretariat | SP Session Vote \+ Vice Mayor Certification \+ Mayor Review |
| Barangay Resolution | Barangay Office | Barangay Council |
| Executive Order | Mayor's Office | Legal Review \+ Mayor Signature |
| Memorandum Order | Mayor's Office | Mayor |
| Endorsement Letter | Originating Office | Department Head or Mayor |
| Citizen Request | Central Receiving | Department Head (Mayor if required) |
| Citizen Complaint | Central Receiving | Office Head / Investigating Officer |

## 7.2 Category B — Administrative Documents

These documents require approvals and tracking but follow simpler, more linear workflows.

| Document Type | Key Approval Steps |
| :---- | :---- |
| Travel Order | Supervisor → Department Head → Mayor |
| Leave Application | Supervisor → Department Head → HRMO |
| Purchase Request | Department Head → Budget Office → Accounting → Mayor (above threshold) |
| Purchase Order | BAC Secretariat → Department Head → Mayor |
| Disbursement Voucher | Accountant → Mayor |
| Project Proposal | Department Head → Mayor |
| Job Order / Contract | HR → Legal → Mayor |
| Internal Memorandum | Department Head |

## 7.3 Category C — Archive Documents

Documents that are complete and require only storage, search, access control, and retrieval. No active workflow.

* Approved ordinance and resolution PDFs (final certified copies).

* Finalized session minutes and attendance records.

* Completed committee reports.

* Reference documents and supporting attachments.

* Historical records migrated from previous filing systems.

# **8\. Functional Requirements**

Detailed functional requirements will be confirmed and expanded after stakeholder interviews. The following provides the structured baseline for each functional area.

## 8.1 User Authentication

| \# | Requirement |
| :---- | :---- |
| FR-01 | Users must authenticate with a username and password before accessing the system. |
| FR-02 | Passwords must meet minimum security requirements: at least 12 characters with complexity requirements. The last 5 passwords may not be reused. |
| FR-03 | Users must be able to reset forgotten passwords through a secure, verified channel. |
| FR-04 | Sessions must expire after 30 minutes of inactivity, with a warning shown to the user at 25 minutes. |
| FR-05 | Only one active session is permitted per user. A new login on a different device terminates the previous session and notifies the user. |
| FR-06 | Shared workstation support: a user must be able to suspend their session and allow another user to log in on the same device without terminating the first session. |
| FR-07 | Multi-factor authentication (TOTP) must be enforced for high-privilege accounts: Mayor, SP Secretary, Department Heads, Platform Administrator, IT Administrator. |
| FR-08 | All login events — successful and failed — must be recorded in the audit log. |

## 8.2 Document Management

| \# | Requirement |
| :---- | :---- |
| FR-10 | Users must be able to upload documents in PDF, DOCX, XLSX, and image formats (PNG, JPG), up to 25MB per file. |
| FR-11 | All documents must have associated metadata: document type, originating office, author, subject, date, and classification level. |
| FR-12 | Document versions must be retained permanently. No version may be overwritten or deleted. |
| FR-13 | Documents must be classified by sensitivity level: Public, Internal, Confidential, or Restricted. Classification controls who can view the document. |
| FR-14 | Official document series numbers must be assigned at the point of formal approval or certification, not at draft creation. Numbers, once assigned, are immutable and are never reused. |
| FR-15 | The system must generate a printable cover sheet for each document containing: tracking number, QR code, document type, author, date, approvers, and retention schedule. |
| FR-16 | Users must be able to search and filter documents by metadata fields (document type, office, date range, status, classification). |
| FR-17 | No document may be permanently deleted by any user or administrator. Documents may only be archived or disposed through an authorized Records Management process. |
| FR-18 | When a physical document is printed, wet-ink signed, and scanned back into the system, the scanned copy must be flagged for manual verification by a Records Officer before being accepted as the official copy. |

## 8.3 Document Workflow

| \# | Requirement |
| :---- | :---- |
| FR-20 | The Platform Administrator must be able to define, publish, and update document workflow definitions without developer involvement. |
| FR-21 | A workflow instance must be executed step-by-step. A step cannot be bypassed unless the workflow definition explicitly permits it. |
| FR-22 | Each workflow step must have a defined assignee (by role, specific user, or office queue) and a service-level time limit. |
| FR-23 | At approval steps, the assignee must be able to approve, reject, or return the document for revision. Rejection and return-for-revision require a mandatory written comment. |
| FR-24 | The system must warn assigned users when they are at 80% of their step's time limit, and automatically escalate to a designated supervisor when the limit is breached. |
| FR-25 | Workflow definitions must be versioned. Changes create a new version; documents already in progress continue under their original version. |
| FR-26 | Certain document types have legally mandated minimum workflow steps that cannot be removed from the definition. SP Ordinances must include: committee referral, three readings, SP vote, Vice Mayor certification, and Mayor review. SP Resolutions must include: vote or approval, Vice Mayor certification, and release. |
| FR-27 | For SP Ordinances: if the Mayor does not act within 10 calendar days of receiving the ordinance, the system must automatically mark it as lapsed into law and notify the SP Secretary. |
| FR-28 | Workflow cancellation requires a mandatory reason. Cancelled status is final and cannot be reversed. |

## 8.4 Document Tracking

| \# | Requirement |
| :---- | :---- |
| FR-30 | Every document must receive a unique tracking number upon registration (format: DTS-YYYY-NNNNNN, configurable). |
| FR-31 | The system must generate a QR code for each document's cover sheet, encoding only the tracking number. The QR code must not contain document content. |
| FR-32 | Scanning a document's QR code must retrieve the document's current status and complete routing history, accessible without login for Public-classified documents. |
| FR-33 | Every movement of a document between offices must be recorded: from office, to office, acting user, timestamp, and action taken. |
| FR-34 | Physical custody of a document must be trackable separately from its digital workflow status. |

## 8.5 Records Management

| \# | Requirement |
| :---- | :---- |
| FR-40 | Every document type must have an assigned retention schedule before it can be activated in the system. |
| FR-41 | The system must alert Records Officers when documents are approaching 80% of their retention period. |
| FR-42 | Disposition of records requires explicit Records Officer action with a mandatory written reason. No automated disposal without human authorization. |
| FR-43 | Disposing of a record creates an audit entry recording the actor, timestamp, and reason. The record's metadata row is never deleted; it is marked as disposed. |
| FR-44 | A document under a legal hold cannot have its retention period shortened or be disposed of. |

## 8.6 Public Document Portal

| \# | Requirement |
| :---- | :---- |
| FR-50 | Any member of the public must be able to look up a document's status and routing history by entering its tracking number, without creating an account. |
| FR-51 | The portal must publish a searchable library of all approved SP resolutions and ordinances classified as Public. |
| FR-52 | Registered citizens must be able to submit service requests and complaints through the portal and receive notifications on their status. |
| FR-53 | The portal must never expose documents classified as Internal, Confidential, or Restricted, regardless of any configuration setting. |
| FR-54 | Citizens registering on the portal must verify ownership of both their phone number and email address via one-time passwords before their account is activated. |

# **9\. Non-Functional Requirements**

## 9.1 Performance

* Standard page loads and document retrieval must complete within acceptable time under normal operating conditions.

* The system must maintain acceptable performance with the number of concurrent users consistent with full City Hall deployment.

## 9.2 Availability and Reliability

* The system must target a minimum of 99.5% uptime during official government business hours.

* A system outage does not excuse non-compliance with RA 11032 processing time limits; the service-level clock continues regardless of system availability.

* The maximum recovery time following a full system failure must not exceed 4 hours. The maximum data loss from any failure must not exceed 1 hour of transactions.

## 9.3 Security

* All data must be encrypted in transit (TLS) and at rest.

* Access to documents must be strictly governed by role, office membership, and document classification level.

* System administrators must not have read access to confidential or restricted document content. This separation is enforced at the database level, not only in application logic.

* The audit log must be tamper-evident: any modification to historical entries must be automatically detectable.

* Session tokens must be stored in secure, HTTP-only cookies. Client-side browser storage must not be used for authentication tokens.

## 9.4 Accessibility and Usability

* The system must be fully functional on mobile devices (iOS and Android) and Windows workstations.

* Barangay officials, who primarily use personal mobile phones, must be able to perform all barangay-facing functions via a mobile browser.

* The interface must be operable without specialized technical knowledge by LGU administrative staff.

## 9.5 Portability and Vendor Independence

* The system must be deployable on any standard cloud provider or on-premise server environment without code changes.

* No component of the system may depend on a single cloud provider's proprietary services.

## 9.6 Longevity and Maintainability

* The source code must be written and documented to a standard that allows City IT staff to maintain the system after handover.

* All significant architectural and design decisions must be documented and version-controlled alongside the source code.

# **10\. Key Workflow Examples**

The following illustrate how documents flow through the city government. These are starting points based on standard LGU practice; the actual workflows will be confirmed and refined through stakeholder consultation.

## 10.1 SP Resolution

| Step | Actor | Action |
| :---- | :---- | :---- |
| 1 | Councilor or SP Secretary | Draft resolution prepared. |
| 2 | SP Secretary | Document logged; no series number assigned yet. |
| 3 | SP Secretary | Assigned to relevant committee. |
| 4 | Committee | Reviews; prepares and submits committee report. |
| 5 | SP Session | First reading. |
| 6 | SP Session | Amendment phase (if any). |
| 7 | SP Session | Second reading and vote. |
| 8 | Vice Mayor | Certifies the approved resolution. |
| 9 | SP Secretary | Series number assigned; official copy produced and released. |
| 10 | Mayor's Office | Reference copy transmitted for filing. |
| 11 | Records Officer | Archived as permanent record. |
| 12 | Public Portal | Published if classified as Public. |

## 10.2 SP Ordinance

| Step | Actor | Action |
| :---- | :---- | :---- |
| 1 | Councilor or SP Secretary | Draft ordinance prepared and logged. |
| 2 | Committee | Review; public hearing if required by law. |
| 3 | SP Session | First Reading. |
| 4 | SP Session | Second Reading. |
| 5 | SP Session | Third Reading and final vote. |
| 6 | Vice Mayor | Certifies after third reading. |
| 7 | Mayor | 10-calendar-day review. May sign, veto, or allow to lapse into law. |
| 8 | SP Secretary | Official copy produced; mandatory publication. |
| 9 | Records Officer | Archived as permanent record. |

## 10.3 Executive Document — Travel Order

| Step | Actor | Action |
| :---- | :---- | :---- |
| 1 | Employee | Submits travel order request. |
| 2 | Immediate Supervisor | Endorses. |
| 3 | Department Head | Approves. |
| 4 | Mayor's Office | Approves (if required by policy). |
| 5 | HRMO | Records approved travel order. |
| 6 | Finance | Notes if there are funding implications. |

## 10.4 Citizen Request

| Step | Actor | Action |
| :---- | :---- | :---- |
| 1 | Citizen | Submits request in person or via the public portal. |
| 2 | Central Receiving | Logs document; assigns tracking number and QR label. |
| 3 | Mayor's Office | Assesses and assigns to relevant department. |
| 4 | Concerned Department | Takes action on the request. |
| 5 | Mayor's Office | Confirms completion. |
| 6 | Citizen | Receives response or released document. |

## 10.5 Barangay to City Hall

| Step | Actor | Action |
| :---- | :---- | :---- |
| 1 | Barangay Council | Passes resolution or prepares endorsement. |
| 2 | Barangay Secretary | Certifies and transmits to City Hall. |
| 3 | City Hall Receiving | Logs and assigns tracking number. |
| 4 | SP Secretariat or Mayor's Office | Routes depending on subject matter. |
| 5 | Committee or Department | Takes action. |
| 6 | SP Secretariat or Mayor's Office | Sends response back to barangay. |

# **11\. Deliverables**

## 11.1 Software

* Deployed, functioning system accessible to all authorized LGU users, covering all in-scope capabilities.

* Source code delivered to the LGU City IT Office, including database schemas, infrastructure configuration, and deployment scripts.

## 11.2 Documentation

* Architecture documentation: component descriptions, data model summaries, and key design decision records.

* User guides: role-specific guides for SP Secretary, Mayor, Department Heads, Barangay Secretaries, and citizen portal users.

* System administration guide: managing users, roles, offices, workflows, and document types.

* Disaster recovery runbooks: documented, tested, and version-controlled.

## 11.3 Acceptance Evidence

* Test results covering all functional requirements.

* User acceptance testing sign-off from the SP Secretariat and City IT Office.

* Disaster recovery drill results demonstrating that the 4-hour recovery target can be met.

# **12\. Roles and Responsibilities**

| Party | Responsibilities |
| :---- | :---- |
| LGU Batac (Project Owner) | Provide requirements input during stakeholder interviews. Designate key contacts for requirements gathering and testing. Conduct user acceptance testing. Formally accept project deliverables. Designate a Data Protection Officer before production rollout. |
| SP Secretariat | Lead requirements definition for SP workflows. Participate in workflow walkthroughs and prototype reviews. Conduct user acceptance testing for all SP-related functions. |
| City IT Office | Coordinate infrastructure access and environment provisioning. Participate in handover and assume system maintenance after delivery. Hold all production credentials and encryption keys. |
| Development Team | Conduct stakeholder requirements gathering and document findings. Design, develop, test, and deploy the system. Deliver all documentation, source code, and infrastructure configuration to the LGU. Provide consultation support after handover. The development team will have no access to production data or credentials after handover. |

# **13\. Proposed Timeline and Milestones**

The following timeline is preliminary. Exact dates will be confirmed after requirements gathering is complete and stakeholders have reviewed the scope.

| Milestone | Target | Description |
| :---- | :---- | :---- |
| M0 | Pre-development | Requirements gathering completed. Stakeholder interviews, workflow walkthroughs, and document sample review done. Requirements Specification Document finalized. |
| M1 | Week 2 | Prototype demonstrated to key stakeholders (SP Secretary, Mayor, Records Officer). Feedback incorporated. |
| M2 | Week 8 | System fully deployed, tested, and formally accepted by LGU. Source code and documentation delivered to City IT Office. |

# **14\. Legal and Regulatory Compliance**

| Law / Regulation | Implications for the System |
| :---- | :---- |
| RA 7160—Local Government Code of 1991 | Defines mandatory offices, authority scopes, and inter-government document flows. Prescribes the SP legislative process (readings, votes, VP certification, Mayor review). The system must enforce these structures and procedures. |
| RA 11032—Ease of Doing Business Act (ARTA) | Mandates maximum processing times: simple transactions (3 working days), complex (7 working days), highly technical (20 working days). SLA tracking and ARTA compliance reporting are legal requirements, not optional features. A system outage does not suspend these obligations. |
| RA 10173—Data Privacy Act of 2012 | All citizen personal data collected by the LGU is subject to this law. The LGU must designate a Data Protection Officer, conduct a Privacy Impact Assessment before going live with citizen data, display a Privacy Notice at the point of collection, and respond to data subject rights requests. Breach notification within 72 hours is required. |
| RA 9184—Government Procurement Reform Act | Procurement documents have legal requirements for transparency, publication, and specific record-keeping. The system must enforce these requirements for procurement document types. |
| Commission on Audit (COA) | COA prescribes retention periods and format requirements for financial and procurement records. COA must be formally consulted before the system goes live to confirm whether digital records satisfy audit requirements. Physical originals are retained until COA confirmation is received. |
| DILG Circulars | The Department of Interior and Local Government may prescribe operational and records standards for LGUs. Applicable circulars will be reviewed during requirements gathering. |

# **15\. Assumptions and Constraints**

## 15.1 Assumptions

* Physical documents remain the legal source of truth for official government instruments until COA confirms otherwise for each document category.

* LGU Batac will formally designate a Data Protection Officer before the system processes any citizen personal data.

* Internet connectivity is available and reliable at all City Hall office locations, with backup power.

* The City IT Office will assume primary responsibility for system maintenance after handover.

* Stakeholder interviews and workflow walkthroughs will be completed before development begins.

* LGU Batac will retain all physical originals post-digitization until formal regulatory confirmation is received for each document category.

* The LGU will provide existing organizational charts, process documentation, and document samples as requested during requirements gathering.

## 15.2 Constraints

* The system must operate within all Philippine legal and regulatory frameworks cited in Section 14\.

* No component of the system may create vendor dependency that prevents future migration to on-premise infrastructure.

* The development team will have no access to production data or credentials after handover; all production credentials are held exclusively by the City IT Office.

* SP Ordinances and Executive Orders have legally mandated minimum workflow steps that cannot be circumvented by configuration.

* The audit log is append-only. This is enforced at the database level and cannot be changed by any user or administrator.

# **16\. Acceptance Criteria**

Detailed acceptance criteria will be agreed upon during requirements gathering. The following provides the high-level framework.

## 16.1 Functional Acceptance

* The SP Secretary can complete a full SP Resolution lifecycle — from draft creation to archived official copy — entirely within the system.

* The SP Secretary can complete a full SP Ordinance lifecycle including the Mayor's 10-day review period and lapse-into-law handling.

* The Mayor can view all documents pending their signature and take action from their dashboard.

* A document's QR code, when scanned, correctly retrieves the document's current status and routing history.

* The system correctly prevents users from taking actions outside their assigned role and office scope.

* All authentication, document state change, and approval events appear correctly in the audit log.

* The system generates correct cover sheets with tracking numbers and QR codes.

* All workflow steps enforce their SLA timers and trigger alerts at the correct thresholds.

* A citizen can submit a request or complaint through the public portal and receive status notifications.

## 16.2 Non-Functional Acceptance

* The system is accessible and functional on both Windows workstations and mobile browsers (iOS and Android).

* A full system restoration from backup can be completed within 4 hours.

* Source code, schemas, infrastructure configuration, and all documentation are fully delivered to the City IT Office.

* Disaster recovery runbooks have been tested by a minimum of two team members.

# **17\. Glossary**

| Term | Definition |
| :---- | :---- |
| ARTA | Anti-Red Tape Act (RA 11032). Sets maximum processing time limits for all government transactions. |
| Audit Trail | A secure, chronological record of every action taken in the system — who did what, to which document, and when. Cannot be modified or deleted. |
| Barangay | The smallest administrative division of the Philippines. Batac City has 42 barangays. |
| COA | Commission on Audit. The independent government body that audits all government accounts and records. |
| DMS | Document Management System. Software that digitally stores, organizes, and manages official documents. |
| DPA | Data Privacy Act (RA 10173). Governs the collection, storage, and protection of personal information. |
| DTS | Document Tracking System. The component that records where a document is, who has it, and where it has been. |
| LGU | Local Government Unit. Refers here to the City Government of Batac. |
| Metadata | Descriptive information about a document: title, author, date, document type, originating office, classification level. |
| Ordinance | A local law passed by the Sangguniang Panlungsod and signed (or not vetoed) by the Mayor. Carries the force of law within the city. |
| Platform Administrator | An authorized LGU staff member who can configure the system — add users, define workflows, manage document types — without requiring developer involvement. |
| QR Code | A machine-readable code printed on physical document cover sheets, encoding only the document's tracking number. |
| Resolution | A formal legislative decision passed by the Sangguniang Panlungsod. Expresses the sense of the body but does not carry the force of a local law. |
| RBAC | Role-Based Access Control. A security model where each user's access is determined by their assigned system role. |
| Retention Schedule | A policy defining how long a document must be kept before it can be archived or disposed of. |
| Sangguniang Panlungsod (SP) | The legislative body of a city. Composed of the Vice Mayor (presiding) and elected City Councilors. |
| SLA | Service Level Agreement. Here: the maximum allowed time to process a document or transaction, as required by ARTA. |
| SP Secretariat | The administrative office responsible for managing all SP documents, legislative records, and session coordination. |
| Version Control | The system's ability to retain all previous versions of a document. No version is ever overwritten. |
| WMS | Workflow Management System. The component that defines and enforces document routing and approval sequences. |

# **18\. Document Version History**

| Version | Date | Author | Description |
| :---- | :---- | :---- | :---- |
| 0.1 | June 2026 | Development Team | Initial draft. Pre-requirements gathering baseline. Pending stakeholder review and update following requirements interviews. |

This document is a pre-requirements gathering draft. All scope, timelines, and requirements stated herein are subject to revision following stakeholder consultation.

City Government of Batac | Ilocos Norte, Philippines