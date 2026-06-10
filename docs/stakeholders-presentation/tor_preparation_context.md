# Batac City LGU Platform — TOR Preparation & Context Document
**Source Material for Writing the Final Terms of Reference**

> This document is the preparation briefing for drafting the final Terms of Reference (TOR).
> It contains everything needed to write the TOR: how to reframe the project, what
> the TOR must cover, the domain context, the legal framework, the stakeholder map,
> the interview methodology, and an assessment of the initial TOR.
>
> The final TOR is a stakeholder-facing document. It does not incorporate developer
> decisions. It is the basis for stakeholder interviews, the presentation to LGU Batac,
> and the formal project agreement.

---

## 1. The Project in Plain Terms

### What It Is

The project is the development of a web-based **LGU Operations Platform** for the
**City Government of Batac, Ilocos Norte, Philippines**. The platform will digitize,
centralize, and streamline how the city government creates, tracks, approves, stores,
and makes available its official documents and records.

The system will serve:
- The **Sangguniang Panlungsod (SP)** — the legislative body (City Council)
- The **SP Secretariat** — the administrative office that manages all SP documents
- **City Hall departments and offices** — executive branch offices
- **Barangay governments** — the 42 barangays under Batac City
- **Citizens and the general public** — for access to public documents and services

### What It Is Not

The initial TOR frames this as a "Document Management System (DMS)." This framing is
accurate for Phase 1, but must be understood as the starting point of a larger platform.
A narrow DMS label may limit stakeholder expectations and miss the broader value this
platform delivers. The final TOR should describe it as an **LGU Operations Platform**
whose first implementation is document and records management.

### The Physical–Digital Distinction

The platform does not replace physical documents as the legal source of truth. Official
government documents — resolutions, ordinances, contracts, signed orders — remain legally
authoritative in their physical signed form. The platform is the **operational source of
truth**: it provides the digital record of what was processed, by whom, when, and in what
sequence. Both coexist.

---

## 2. Assessment of the Initial TOR

### What the Initial TOR Got Right

- Identified the correct primary user groups (SP Secretary, Barangay Secretary, SP Member,
  Public/Client).
- Identified the correct technical foundation (React, TypeScript, Fastify, PostgreSQL).
- Framed the need correctly: paper-based document management has problems with retrieval,
  version control, accessibility, and efficiency.
- Identified the key functional areas: authentication, RBAC, document management (CMS),
  dashboard, notifications.
- Positioned the document as a living document pending requirements gathering.

### What the Initial TOR Understated or Missed

| Gap | Explanation |
|---|---|
| Scope is SP-only | The final platform serves not just the SP but the Mayor's Office, all City Hall departments, barangays, and citizens. The TOR must reflect this broader scope even if Phase 1 starts with the SP. |
| No mention of workflows | Document approval and endorsement is marked "scope to be confirmed." Workflows are a core feature, not optional. |
| No tracking/DTS | Document tracking — QR codes, routing history, custodian records — is not mentioned. It is a core Phase 1 deliverable. |
| No mention of ARTA | RA 11032 (Ease of Doing Business Act) mandates processing time limits. SLA tracking is a legal requirement, not a feature. |
| No mention of data privacy | RA 10173 (Data Privacy Act) governs all citizen personal data. The system handles citizen complaints and requests containing PII. |
| No mention of records management | Retention schedules, archiving, and disposal policies are a legal and compliance requirement, not just a storage feature. |
| Roles are incomplete | Only 4 roles listed; the complete role set includes Mayor, Department Head, Records Officer, Barangay Captain, City Administrator, Platform Administrator, IT Administrator, and others. |
| No mention of physical-digital coexistence | The platform must account for the legal status of physical originals alongside digital records. |
| No phasing | The TOR presents one flat scope; the final TOR must describe the phased implementation clearly. |
| "SP Members to see session schedules" is vague | SP Members need clearly defined capabilities around reviewing, commenting, and acting on assigned legislative documents. |
| MFA is "to be confirmed" | MFA architecture is confirmed. The TOR should state that MFA is included. |
| Technology stack incomplete | Search engine (Meilisearch), object storage, job queue, deployment approach, and infrastructure strategy are not in the initial TOR. |

---

## 3. Reframing for the Final TOR

### Project Name Recommendation

> **Batac City LGU Platform — Document and Records Management System (Phase 1)**

This framing:
- Accurately names what is being built in Phase 1
- Signals that it is part of a larger platform
- Avoids locking the platform into the narrow "DMS" label

### How to Describe the Phased Approach

The final TOR must make clear that:

1. Phase 1 delivers a working system for SP documents and executive branch document tracking.
2. The architecture of Phase 1 is designed to expand without major rework.
3. Future phases add modules for the full executive branch, citizen-facing services, and barangay access.
4. Stakeholders are being consulted during requirements gathering to confirm scope, priorities, and workflows.

### Language to Avoid in the TOR

| Avoid                                                      | Replace With                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| "Document Management System (DMS)" as the sole description | "LGU Operations Platform" or "Document and Records Management Platform" |
| "scope to be confirmed" for major features                 | Describe what is included and what is deferred to a named phase         |
| "may submit document requests" for citizens                | Define what citizens can and cannot do on the portal                    |
| Listing roles without descriptions                         | Describe each role's scope and purpose                                  |
| Technical jargon (JWT, Meilisearch, S3, ABAC)              | Use plain language for stakeholder audiences                            |

---

## 4. Final TOR — Recommended Structure

The following is the recommended outline for the final TOR. Each section describes what
it should contain.

### 4.1 Cover Page and Document Information
- Project title, version, date
- Prepared by, reviewed by, approved by
- Document status (draft / for review / final)
- Version history

### 4.2 Executive Summary
- 1 paragraph: what the project is and why it matters for LGU Batac
- 1 paragraph: what will be built and who will use it
- 1 paragraph: what this TOR is for

### 4.3 Background and Rationale
- Current state: how documents are managed today (paper-based, challenges with retrieval,
  version control, lost documents, delayed processing, lack of transparency)
- Why digitization matters: ARTA compliance, public accountability, operational efficiency
- Why Batac City needs this: the volume of SP and departmental documents, the barangay
  coordination challenge, citizen service accessibility
- Reference to relevant law: RA 7160, RA 11032, RA 10173

### 4.4 Project Objectives
Expand from the initial TOR. Suggested objectives:

1. Digitize and centralize document storage for the Sangguniang Panlungsod, all City Hall
   departments, and all 42 barangay governments.
2. Implement configurable document workflows that enforce proper routing, approval, and
   tracking across offices.
3. Provide real-time document tracking with QR code generation and routing history.
4. Enforce role-based access controls aligned with organizational positions and authority.
5. Enable compliance with RA 11032 (Ease of Doing Business Act) through automated SLA
   tracking and processing time monitoring.
6. Provide a public-facing portal for citizens to access published government documents
   and track the status of their requests.
7. Ensure long-term records preservation through configurable retention schedules and
   archiving policies.
8. Support transparency and accountability through tamper-evident audit trails.
9. Establish a scalable digital foundation capable of serving the city government for
   ten or more years.

### 4.5 Project Scope

**In Scope — Phase 1:**
- User authentication and session management
- Role-based access control for all identified user types
- Document creation, uploading, versioning, and metadata management
- Document classification and sensitivity controls
- Document workflow (routing, review, approval, rejection, revision loop)
- Document tracking with QR code generation, cover sheet printing, and routing history
- Official document numbering and series management
- In-app notifications for pending actions and overdue items
- Dashboards per role (SP Secretary, Mayor, Department Head)
- Tamper-evident audit logging
- Basic reporting and document status monitoring
- Infrastructure: cloud deployment, automated backup, disaster recovery

**In Scope — Future Phases (post-requirements gathering):**
- Public-facing government portal (document status lookup, citizen requests, complaints)
- Barangay official access module
- Records management and retention schedules
- Full-text document search
- Email and SMS notifications
- ARTA compliance reports
- Integration with other LGU systems (payroll, HRIS, treasury, accounting)
- Electronic signature infrastructure

**Out of Scope:**
- Replacement of existing payroll, HRIS, or accounting systems
- Hardware procurement
- Network infrastructure setup
- Training (unless specified as a deliverable)
- Printing or physical records management equipment

### 4.6 User Roles and Stakeholders

This section must list all identified user groups and their system roles. See Section 6
of this document for the complete role descriptions.

### 4.7 Functional Requirements

Organized by module. Each requirement should:
- Be written as a user story or capability statement ("The system shall…" or "As an [role],
  I can…")
- Be marked as Phase 1, Phase 2, or Phase 3
- Reference the role it applies to

Note: Detailed functional requirements are to be completed after stakeholder interviews.
The TOR at presentation stage lists high-level capabilities; detailed requirements are
captured in the Requirements Specification Document.

### 4.8 Non-Functional Requirements

Key areas to cover (at a high level, appropriate for stakeholders):
- Performance: system must respond within acceptable time under normal use
- Availability: system must support ARTA compliance requirements (cannot be down during
  official business hours for extended periods)
- Security: data must be protected; access must be controlled by role
- Accessibility: system must be usable on mobile devices
- Portability: system must not be locked to a single cloud provider
- Longevity: system architecture must support at least 10 years of operation

### 4.9 Deliverables

For each phase, list:
- Working software (deployed and accessible)
- Source code (delivered to LGU with documentation)
- Infrastructure configuration (deployable to any compatible environment)
- Architecture documentation
- User documentation / training materials (TBD)
- Test results and acceptance evidence

### 4.10 Roles and Responsibilities

| Party | Role | Responsibilities |
|---|---|---|
| LGU Batac | Project owner | Requirements input, user acceptance testing, final approval |
| SP Secretariat | Primary Phase 1 user | Requirements definition, workflow walkthroughs, UAT |
| City IT Office | Technical counterpart | Infrastructure coordination, post-delivery maintenance |
| Development Team | System developer | Design, development, testing, deployment, documentation |

### 4.11 Timeline and Milestones

Phased timeline; exact dates TBD after requirements gathering.

| Milestone | Phase |
|---|---|
| Requirements gathering completed | Pre-Phase 1 |
| Phase 1 prototype demonstrated to stakeholders | Phase 1 (Month 3) |
| Phase 1 system deployed and accepted | Phase 1 (Month 6) |
| Phase 2 features delivered | Phase 2 (Month 12) |
| Phase 3 features delivered | Phase 3 (Month 18) |

### 4.12 Legal and Regulatory Compliance

List the applicable laws and what the system does to comply. See Section 7 of this
document for the full legal context.

### 4.13 Acceptance Criteria

High-level criteria for accepting each deliverable. Detailed acceptance criteria are
developed during requirements gathering.

### 4.14 Assumptions and Constraints

- Physical documents remain the legal source of truth.
- LGU Batac will designate a Data Protection Officer before production launch.
- Internet connectivity is available at City Hall offices.
- LGU IT Office will assume system maintenance after handover.
- Formal requirements gathering will be completed before Phase 1 development begins.

### 4.15 Glossary

Key terms defined for stakeholder clarity. See Section 9 of this document.

---

## 5. LGU Domain Context (Summary for TOR Use)

*Full domain context is in `01_project_domain_context.md`. This section provides the
summary needed for TOR writing.*

### The Three Branches

| Branch | Body | Primary Document Activity |
|---|---|---|
| Executive | Mayor and City Hall departments | Executive Orders, Memoranda, Purchase Requests, Travel Orders, Citizen Requests |
| Legislative | Vice Mayor + Sangguniang Panlungsod (SP) | Resolutions, Ordinances, Session Minutes, Committee Reports |
| Barangay | 42 Barangay Captains and Councils | Barangay Resolutions, Endorsements, Transmittals to City Hall |

### The SP Secretariat's Central Role in Phase 1

The SP Secretariat is the administrative office of the legislative branch. The SP
Secretary:
- Manages the complete lifecycle of all SP resolutions and ordinances
- Maintains the official numbering series for resolutions and ordinances
- Prepares and manages the session agenda
- Coordinates committee referrals and committee reports
- Certifies and releases official copies of approved legislation
- Archives legislative records

The SP Secretariat is the Phase 1 primary user. The entire Phase 1 prototype is built
to serve this office first.

### How Documents Flow

Documents in an LGU do not stay in one office. They cross office boundaries multiple
times before completion. The system must model cross-office routing, not single-office
file storage. See `01_project_domain_context.md` Section 5 for detailed flow diagrams.

### Document Categories

Three operational categories determine how the platform handles each document type:

**Category A — Full workflow documents** (routing, approvals, signatures, tracking,
notifications, audit): SP Resolutions, Ordinances, Executive Orders, Barangay Resolutions,
Citizen Requests, Endorsements.

**Category B — Administrative documents** (simpler workflows, approval tracking):
Travel Orders, Leave Applications, Purchase Requests, Purchase Orders, Project Proposals,
Disbursement Vouchers.

**Category C — Archive documents** (storage, search, access control only; no active
workflow): Approved ordinance PDFs, certified resolution copies, finalized session minutes,
completed committee reports.

---

## 6. Stakeholder Groups and Their Primary Concerns

This is the complete list of stakeholders for TOR and interview purposes.

| Stakeholder | Primary System Concerns | Interview Priority |
|---|---|---|
| Mayor | Visibility of pending approvals, delegation when traveling, city-wide operational status | Before Phase 1 Deployment |
| Vice Mayor / Presiding Officer | SP session workflow, certification of approved legislation | Before Phase 1 Deployment |
| SP Secretary | End-to-end SP document lifecycle, numbering, session management, tracking | **Before Phase 1 Development — scheduled** |
| SP Councilors | Receiving documents for review, providing comments, accessing session materials | Before Phase 1 Deployment |
| Records Officer | Archiving, retention schedules, classification, physical-digital correspondence | **Before Phase 1 Development — scheduled** |
| Department Heads | Inter-department routing, approval authority, workload visibility | Before Phase 1 Deployment |
| City IT Office | Infrastructure, existing systems, maintenance capability | Before Phase 1 Development |
| City Legal Office | Legal basis for digital records, delegation policy, privacy compliance | Before Phase 1 Deployment |
| Budget Office | Procurement workflow, fund certification | Before Phase 2 Development |
| HRMO | Personnel documents, leave and travel workflows | Before Phase 2 Development |
| Barangay Officials | Document submission to City Hall, connectivity, device constraints | Before Phase 3 Development |
| Data Protection Officer | PII handling, citizen portal, consent, breach response | Before Production Rollout |
| COA Representative | Physical records retention, audit trail requirements | Before Production Rollout |
| Citizens (focus group) | Portal usability, language, trust | Before Public Portal Launch |

---

## 7. Legal and Regulatory Context

The following laws and regulations directly affect how the system must be designed.
These should be referenced in the TOR.

### RA 7160 — Local Government Code of 1991

- Defines the mandatory offices, authority scopes, and inter-government document flows
  for Philippine local governments.
- Prescribes the SP legislative process (readings, votes, VP certification, Mayor review).
- Establishes the legal structure the platform must support and enforce.

### RA 11032 — Ease of Doing Business and Efficient Government Service Delivery Act (2018)

- Mandates maximum processing times: simple transactions within 3 working days, complex
  within 7 working days, highly technical within 20 working days.
- "The system is down" is not a valid excuse for failing to meet these deadlines.
- SLA tracking and ARTA compliance reporting are legal requirements.
- The platform must track time-to-process per document type and generate compliance reports.

### RA 10173 — Data Privacy Act of 2012

- Governs all personal data collected, stored, and processed by the LGU.
- The platform stores citizen personal data (names, contact information, complaint details).
- Requires: Data Protection Officer designation, Privacy Impact Assessment before launch,
  Privacy Notice at point of collection, data subject rights (access, correction, erasure),
  and breach notification within 72 hours.
- The LGU must formally designate a DPO before the system goes live with citizen data.

### RA 9184 — Government Procurement Reform Act

- Governs all procurement-related documents (Purchase Requests, Purchase Orders, Bids,
  contracts with suppliers).
- Requires transparency, publication, and specific record-keeping for procurement processes.
- The platform must enforce, not merely facilitate, these requirements for procurement
  documents.

### Commission on Audit (COA) Requirements

- COA prescribes retention periods for financial and procurement records.
- COA must be consulted before the system goes live to confirm: whether digital records
  are acceptable without wet-ink originals, and what audit trail format satisfies COA
  requirements.
- Physical originals are retained until COA acceptance is formally confirmed.

---

## 8. Requirements Gathering Methodology

### Interview Approach

The following is the agreed approach for stakeholder interviews:

**Preparation**
- Request official organizational chart from LGU before interview.
- Request process flow charts or any existing workflow documentation.
- Prepare role-specific question sets (available in the separate interview guide document).

**Opening the Interview**
- Show prototype UI pages to ground the conversation in something concrete.
- Frame the session: "What we have gathered so far are starting points. The final result
  will be shaped by what you tell us."

**Main Interview Questions**
- Walk me through the complete lifecycle of [specific document type] from creation to filing.
- What is the biggest problem with how documents are handled today?
- What do you need that you currently cannot do?
- Review prototype: What would you add? What would you change?
- Explicitly state: "What we gather from this session are starting points. The final
  system can be expanded based on your needs."

**Closing**
- Confirm: what we heard, what we will follow up on.
- Request: samples of actual documents (redacted if necessary).
- Request: published/public documents, resolutions, reports for reference.
- Confirm next steps.

**Post-Interview (All Stakeholders)**
- Collect sample documents of each document type discussed.
- Collect any published resolutions, ordinances, or public reports.
- Review against the educated workflow models and identify discrepancies.

### What to Do With Findings

1. Compare actual workflows against the educated workflow models.
2. Identify any steps, approvals, or exceptions that were not anticipated.
3. Identify new document types not currently in scope.
4. Update the workflow definitions before development begins.
5. Update role definitions based on actual organizational structure.
6. Update SLA thresholds based on actual ARTA classification per document type.
7. Document all findings in a Requirements Specification Document (separate from the TOR).

### Interview Question Reference

Complete role-specific interview question sets are available in:
- Part B (General Stakeholder Questions)
- Part C (Role-Specific Question Sets for: Mayor, Vice Mayor, SP Secretary, Councilors,
  Department Heads, Records Officers, Barangay Officials, General Employees, Citizens,
  IT Personnel)

---

## 9. Key Terms to Define in the Final TOR

The following terms must be clearly defined in the TOR's glossary for stakeholder
audiences.

| Term | Plain Language Definition |
|---|---|
| Document Management System (DMS) | Software that digitally stores, organizes, and manages official documents. |
| Document Tracking System (DTS) | The system component that records where a document is, who has it, and where it has been. |
| Workflow | A defined sequence of steps and approvals that a document must pass through from submission to completion. |
| Resolution | A formal legislative decision passed by the Sangguniang Panlungsod. |
| Ordinance | A local law passed by the Sangguniang Panlungsod and signed (or not vetoed) by the Mayor. |
| SP Secretariat | The administrative office responsible for managing all SP documents and records. |
| Role-Based Access Control (RBAC) | A security method where each user's access is determined by their assigned role (e.g., SP Secretary, Barangay Secretary). |
| Audit Trail | A secure, chronological record of every action taken in the system — who did what and when. |
| Version Control | The ability to keep all previous versions of a document and track changes over time. |
| Metadata | Descriptive information about a document (e.g., title, author, date, document type, barangay). |
| Retention Schedule | A policy that defines how long a document must be kept before it can be archived or disposed of. |
| QR Code | A machine-readable code printed on physical document cover sheets that links to the document's digital record and routing history. |
| SLA (Service Level Agreement) | The maximum time allowed to process a document or transaction, as required by RA 11032 (ARTA). |
| Platform Administrator | A designated LGU staff member authorized to configure the system (add users, modify workflows, manage document types) without developer involvement. |
| DPA (Data Privacy Act) | RA 10173 — the Philippine law governing the collection and protection of personal information. |
| COA | Commission on Audit — the independent government body that audits all government accounts and records. |
| ARTA | Anti-Red Tape Act — RA 11032, which sets maximum processing time limits for government transactions. |
| Barangay | The smallest administrative division of the Philippines; Batac City has 42 barangays. |
| Sangguniang Panlungsod (SP) | The legislative body of a city; composed of the Vice Mayor (presiding) and elected Councilors. |

---

## 10. Notes for the Presentation

The presentation (to be created after the TOR) will introduce the platform to LGU Batac
stakeholders. The following are notes on what the presentation must achieve.

### Audience

Primary audience: Mayor, Vice Mayor, SP Secretary, Department Heads, Records Officer.
Secondary audience: City IT Office, Councilors.

### Tone

- Focus on benefits and problems solved, not technical details.
- Use plain Filipino and English (avoid technical jargon).
- Show, don't just tell — prototype UI screenshots or live demo if available.

### What It Must Cover

1. **The problem today** — what is hard about the current paper-based system (lost documents,
   slow retrieval, no tracking, difficulty in compliance reporting).
2. **What the platform does** — a simple, visual description of the platform's capabilities.
3. **Who uses it and how** — a scenario for each major user group (SP Secretary processing
   a resolution, a citizen checking request status, a Department Head approving a travel
   order).
4. **The phased approach** — what will be delivered first, what comes later. Manage
   expectations clearly.
5. **What we need from you** — the requirements gathering process: interviews, document
   samples, feedback on prototype.
6. **The commitment** — what the LGU needs to commit to (stakeholder time for interviews,
   DPO designation, IT team maintenance responsibility, budget continuity).
7. **Next steps** — schedule interviews, confirm key contacts, set timeline.

### What the Presentation Must NOT Do

- Promise a specific go-live date without confirmed requirements.
- Commit to features not yet validated by requirements gathering.
- Present the technical architecture (not relevant to this audience).
- Present the platform as fully specified — it is still being defined with stakeholder input.

---

## 11. Differences Between This Project and the Initial TOR Framing

| Initial TOR | Final Framing |
|---|---|
| Document Management System (DMS) | LGU Operations Platform — Document and Records Management System (Phase 1 of broader platform) |
| Serves SP, barangay secretariats, SP members, public | Serves SP, Mayor's Office, all City Hall departments, all 42 barangays, citizens |
| 4 roles | 10+ roles across all branches and user types |
| CMS features (upload, tag, version, search) | Full document lifecycle: creation, routing, tracking, approval, signature, archiving, retrieval |
| "Document approval and endorsement workflow (scope to be confirmed)" | Workflow management is a core confirmed Phase 1 deliverable |
| No mention of document tracking | Document Tracking System (DTS) with QR codes is a Phase 1 deliverable |
| No mention of ARTA | ARTA SLA tracking is a legal requirement included in Phase 2 |
| No mention of records management | Records Management is a Phase 2 module |
| No mention of data privacy | RA 10173 compliance is addressed from Phase 1 |
| No mention of physical records | Physical-digital coexistence is an explicit design principle |
| One flat scope | Phased delivery: Phase 1 (SP + executive foundation), Phase 2 (full executive), Phase 3 (portal + barangays) |
| Technology stack partially listed | Full stack confirmed: React, TypeScript, Fastify, PostgreSQL, S3 storage, Docker/Terraform |
| MFA "to be confirmed" | MFA architecture confirmed; TOTP implementation in Phase 2 |

---

*Use this document alongside `01_project_domain_context.md` when writing the final TOR.
The Key Decisions reference (`03_key_decisions_developer_reference.md`) is for the
developer's internal use and should not be included in or referenced by the TOR.*
