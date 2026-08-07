# Batac City LGU Platform

## System Architecture — C4 Model (Levels 1–3)

**Document ID:** B1 **Type:** System Architecture **Status:** Pre-Development Baseline **Version:** 1.0 **Date:** June 2026 **Based on:** Consolidated Architecture and Requirements Reference (Iteration 3); Stack Context **Audience:** Development team — internal reference

---

## Table of Contents

- [L32–L61] Notation and Conventions — C4 level mappings, source fidelity labels (e.g. Inference, Phase N), and Phase 1-4+ delivery scope mappings.
- [L62–L103] Level 1 — System Context — C4 context diagram defining platform boundaries, user roles (Citizen, Secretariat, Mayor), and integrations with external LGU systems.
- [L104–L158] Level 2 — Container Diagram — C4 container diagram and constraints including static SPA, Fastify server, direct S3 uploads, and PostgreSQL-backed job queues.
- [L159–L628] Level 3 — Component Diagrams — C4 component diagrams for cross-cutting infrastructure and the 11 domain modules governing application server internals.
  - [L165–L174] Cross-Cutting Infrastructure (referenced throughout) — Architectural details on the in-process event bus, Drizzle ORM usage rules, and pgboss job queue integrations.
  - [L175–L215] Module 1 — IAM — Components for Argon2id hashing, session limits, JWT issuance, ABAC engine, and Phase 2 MFA enforcement rules.
  - [L216–L254] Module 2 — Organization — Components for office hierarchies, employee positions, and automatic delegation scaling with no admin activation step required.
  - [L255–L307] Module 3 — Documents — Two-stage numbering rules, direct S3 uploads, OCR integration, version tracking, soft-deletes, and tracking QR generation.
  - [L308–L354] Module 4 — Workflow — Workflow engine logic, multi-committee rules with Thursday cutoffs, urgent path bypassing, lapse timers, and ARTA SLA escalations.
  - [L355–L392] Module 5 — Tracking — Immutable QR assignment order, physical custody vs. digital status tracking, and public lookup page blurring rules.
  - [L393–L432] Module 6 — Records — Archive rules, permanent retention lists, four-tier classification logic, and restricted Records Officer bulk operation schemas.
  - [L433–L469] Module 7 — Notifications — SSE in-app pushes, SMTP/Nodemailer email routing, Phase 3 SMS placeholders, and configurable notification template mechanics.
  - [L470–L507] Module 8 — Audit — HMAC and hash-chained tamper-evident design, Postgres insert-only constraints, and monthly RFC 3161 TSA export triggers.
  - [L508–L544] Module 9 — Search Meta [Phase 2] — Search abstraction details, Phase 1 PostgreSQL FTS, Phase 2 Meilisearch sync queue, and typo-tolerant search rules.
  - [L545–L592] Module 10 — Portal [Phase 3] — Next.js portal REST endpoints, citizen OTP authentication, document blurring logic, and complaint intake access channels.
  - [L593–L628] Module 11 — Reporting [Phase 2] — Configurable templates, React-PDF/SheetJS generation engines, and automated ARTA compliance reporting using live SLA details.
- [L629–L659] Appendix A — Cross-Module Event Reference [Inference] — Tabulated catalog of in-process event contracts defining publishers, subscribers, and side-effects across all 11 modules.
- [L660–L677] Appendix B — Architectural Invariants Affecting This Document — Twelve rigid architectural rules mapping system-wide invariants to specific diagram implementations and database constraints.

---

## Notation and Conventions

### C4 Levels Covered

| Level | Diagram Type   | Describes                                                              |
| ----- | -------------- | ---------------------------------------------------------------------- |
| 1     | System Context | Platform as one box; all external actors and systems it interacts with |
| 2     | Container      | Every deployable unit and how they communicate                         |
| 3     | Component      | Internal structure of the Application Server, one diagram per module   |

### Source Fidelity

|Label|Meaning|
|---|---|
|_(unlabelled)_|Confirmed in source documents (Consolidated Reference or Stack Context)|
|`[Inference]`|Logically derived from confirmed elements; not explicitly stated. All internal component names and decompositions within modules are proposed design — not confirmed implementation.|
|`[Phase N]`|Scoped to that delivery phase. Schema may be reserved in Phase 1 even if the module is Phase 2 or 3.|

### Phase Summary

|Phase|Primary Scope|
|---|---|
|1|SP Resolutions, Ordinances, Appropriation Ordinances, Citizen Complaints, core IAM and infrastructure|
|1B|Administrative documents: Letters (SPR/SPS), Memos (MI/MO), NCH, NOSP, Designations, Barangay Resolutions|
|2|Executive branch, MFA enforcement, Meilisearch, Records Management, email notifications, parallel workflow engine (Barangay Budget)|
|3|Full Next.js citizen portal, Barangay offline access, SMS gateway|
|4+|Advanced OCR, configurable report builder, electronic signature PKI|

---

## Level 1 — System Context

Batac City LGU Platform shown as a single system with all external actors, organisations, and legacy systems it interacts with.

**Note on Panlalawigan and Ilocos Times:** These are not electronic integrations. The platform logs the outcomes of those physical interactions when Secretariat staff enters them manually.

```mermaid
C4Context
    title Level 1 - System Context: Batac City LGU Platform

    Person(citizen, "Citizen", "Files complaints, tracks documents, requests certified copies via public portal. Three access modes: download form, digital form, or in-person clerk-assisted.")
    Person(spStaff, "SP Secretariat Staff", "Logs all documents, manages legislative workflow steps, generates QR cover pages, maintains Order of Business, monitors dashboards.")
    Person(mayor, "Mayor", "Signs legislative measures from pending queue. Issues Certifications of Urgency and Designations as formal written documents logged by Secretariat.")
    Person(vm, "Vice Mayor", "Presiding officer. Signs certified copies of approved measures. Routes received letters. Issues Designations.")
    Person(councilor, "City Councilor", "Drafts measures submitted via Secretariat. Views committee referral and hearing status.")
    Person(itAdmin, "IT Administrator", "Infrastructure access only. No document content access - enforced at PostgreSQL RLS level and ABAC policy.")

    System(lguPlatform, "Batac City LGU Platform", "SP legislative workflow for Resolutions, Ordinances, and Appropriation Ordinances. QR-based document tracking. Records management. Citizen complaints. Public portal.")

    System_Ext(panlalawigan, "Sangguniang Panlalawigan", "Reviews all transmitted SP measures within 30 days. Returns formal written notification with outcome: VALID, VALID-IN-PART, RETURNED, or no action within 30 days (deemed approved per RA 7160 Sec 56d).")
    System_Ext(ilocosTimes, "Ilocos Times", "Newspaper of record. Publishes full text of penalty ordinances. Placement arranged by SP Secretariat. Publication date is a mandatory tracked field.")
    System_Ext(lmits, "LMITS", "Legacy legislative tracking system managed by CPDO. Source for historical data migration in later phases. Export format TBD.")
    System_Ext(spWebsite, "sp.batac.gov.ph", "Existing public SP website. Subscription renewed; continues indefinitely. New platform portal provides similar citizen-facing functionality. Both coexist with no retirement planned.")
    System_Ext(tsa, "RFC 3161 TSA", "Receives monthly audit log exports. Extends tamper-evidence guarantee to cover bulk deletion scenarios. Provider to be confirmed.")
    System_Ext(smtpServer, "LGU SMTP Server", "Delivers step-assignment notifications, overdue alerts, and formal respondent notices when respondent has an email address.")

    Rel(citizen, lguPlatform, "Tracks documents, files complaints, requests copies", "HTTPS")
    Rel(spStaff, lguPlatform, "Logs and routes documents, manages all SP Secretariat workflows", "HTTPS")
    Rel(mayor, lguPlatform, "Signs measures, views executive dashboard", "HTTPS")
    Rel(vm, lguPlatform, "Signs certified copies, routes letters, views session calendar", "HTTPS")
    Rel(councilor, lguPlatform, "Views referral and hearing status", "HTTPS")
    Rel(itAdmin, lguPlatform, "Infrastructure management only", "SSH")
    Rel(lguPlatform, panlalawigan, "Secretariat transmits measures and logs outcomes in system", "Physical and system log")
    Rel(panlalawigan, lguPlatform, "Secretariat receives and logs formal written notification of review outcome", "Physical document")
    Rel(lguPlatform, ilocosTimes, "Secretariat arranges publication of penalty ordinances", "External arrangement")
    Rel(lmits, lguPlatform, "Historical data migration via CPDO - later phases", "Data export")
    Rel(lguPlatform, tsa, "Monthly audit log export", "HTTPS")
    Rel(lguPlatform, smtpServer, "Transactional email", "SMTP with TLS")
```

---

## Level 2 — Container Diagram

All deployable units within the platform and how they communicate.

**Key architectural constraints:**

- The Internal Web App is a static bundle served by Nginx or Caddy — no Node.js process required for frontend serving.
- The Application Server is a single Fastify process serving both tRPC (for the internal app) and REST/OpenAPI (for portal and external clients), separated by plugin scope.
- Files never touch the application server disk — streamed directly between client and S3-compatible storage via presigned URLs.
- No provider-specific SDK imports anywhere in the codebase. Only the S3-compatible API (`@aws-sdk/client-s3` pointed at the configured endpoint) is permitted.

```mermaid
C4Container
    title Level 2 - Container Diagram: Batac City LGU Platform

    Person(lgusStaff, "LGU Internal Users", "SP Secretariat, Mayor, Vice Mayor, Councilors, IT Admin")
    Person(citizen, "Citizen", "Public portal users")

    System_Boundary(b, "Batac City LGU Platform") {
        Container(proxy, "Reverse Proxy", "Nginx or Caddy", "Terminates TLS. Serves Internal Web App static bundle. Proxies API requests to Application Server. No Node.js required for frontend serving.")
        Container(webSpa, "Internal Web App", "Vite and React SPA", "Authenticated internal application served as static bundle. All server communication via tRPC. TanStack Query for server state. Zustand for UI state. No SSR.")
        Container(portal, "Citizen Portal", "Next.js - Phase 3", "Public-facing portal. Static site generation for SEO on citizen-facing document lookups. Consumes public REST API only. Phase 3.")
        Container(server, "Application Server", "Fastify Node.js", "Single process. tRPC procedures for internal app. REST and OpenAPI for portal and external clients. Separated by plugin scope. Hosts all 11 domain modules and in-process event bus.")
        ContainerDb(db, "Primary Database", "PostgreSQL 15+", "One schema per module. JSONB for configurable metadata. Row-Level Security for office-level isolation. Audit schema INSERT-only. Check constraints for state transitions. Sequences for gapless numbering.")
        Container(s3, "Object Storage", "S3-compatible API", "Cloudflare R2 for Phase 1; MinIO for on-premise path. UUID keys only. Files streamed directly. S3 versioning enabled. Provider switch is env-var change only. Max 25 MB per file.")
        Container(meilisearch, "Search Engine", "Meilisearch - Phase 2+", "Self-hosted Docker container. Typo-tolerant full-text search for Filipino proper names. Faceted filtering. Phase 1 uses PostgreSQL FTS instead.")
        Container(pgboss, "Job Queue", "pgboss PostgreSQL-backed", "Durable scheduled jobs: Mayor 10-day lapse timers, Panlalawigan 30-day review timers, ARTA SLA escalations, OCR processing queue, monthly TSA export trigger.")
        Container(sseEndpoint, "SSE Endpoint", "Fastify SSE plugin", "Real-time one-directional push of in-app notifications to authenticated browser clients. Receives events from in-process event bus. No WebSocket or external message broker.")
    }

    System_Ext(smtpServer, "LGU SMTP Server", "Email delivery")
    System_Ext(tsa, "RFC 3161 TSA", "Monthly audit log timestamping")
    System_Ext(sentry, "Sentry", "Error tracking and alerting for unhandled exceptions")
    System_Ext(s3Provider, "Cloudflare R2 or MinIO", "Physical S3-compatible storage endpoint")

    Rel(lgusStaff, proxy, "Loads internal app", "HTTPS")
    Rel(citizen, portal, "Accesses public portal", "HTTPS")
    Rel(proxy, webSpa, "Serves static bundle")
    Rel(proxy, server, "Proxies API requests", "HTTP internal")
    Rel(webSpa, server, "Procedure calls", "tRPC over HTTPS")
    Rel(portal, server, "Public API calls", "REST and OpenAPI over HTTPS")
    Rel(server, db, "Reads and writes domain data", "Drizzle ORM over SQL")
    Rel(server, s3, "Streams files via presigned URLs", "S3-compatible API")
    Rel(s3, s3Provider, "Backed by physical storage endpoint")
    Rel(server, meilisearch, "Indexes documents and runs search queries - Phase 2", "Meilisearch HTTP API")
    Rel(server, pgboss, "Enqueues and processes durable jobs", "pgboss Node.js client")
    Rel(pgboss, db, "Persists job state", "PostgreSQL pgboss schema")
    Rel(sseEndpoint, webSpa, "Pushes real-time notifications", "SSE over HTTPS")
    Rel(server, smtpServer, "Sends transactional email", "SMTP with TLS via Nodemailer")
    Rel(server, tsa, "Monthly audit log export", "HTTPS")
    Rel(server, sentry, "Reports unhandled exceptions", "Sentry SDK")
```

---

## Level 3 — Component Diagrams

Internal structure of the Application Server container, organized by the 11 domain modules defined in Part 10.2 of the Consolidated Reference.

> **[Inference]** All internal component names, service boundaries, and decompositions within each module are architectural proposals. The source documents confirm module schemas and boundaries; the specific component decompositions shown here are pre-development design decisions subject to refinement during implementation.

### Cross-Cutting Infrastructure (referenced throughout)

|Element|Description|
|---|---|
|**Internal Event Bus**|In-process. Decouples modules without distributed messaging overhead. Publishers emit typed domain events; subscribers in other modules consume them. Modules must never access another module's schema directly — only via the event bus or a published module API.|
|**Drizzle ORM**|Each module has its own Repository component wrapping Drizzle queries for that module's schema only. No cross-schema foreign key constraints permitted anywhere.|
|**pgboss client**|Available to any module requiring durable delayed or scheduled background jobs. Job state persisted in PostgreSQL in the pgboss schema.|

---

### Module 1 — IAM

**Schema:** `iam` **Tables:** `users`, `credentials`, `sessions`, `refresh_tokens`, `roles`, `permissions`, `role_assignments`, `mfa_records` **Responsibility:** Authentication, session control, JWT issuance, role and permission resolution, ABAC policy evaluation.

MFA is architected and schema-reserved in Phase 1 but not enforced. Phase 2 enforces TOTP for Mayor, SP Secretary, Department Heads, Platform Admin, and IT Admin.

```mermaid
C4Component
    title Level 3 - IAM Module

    Container_Boundary(iam, "IAM Module - schema: iam") {
        Component(authRouter, "Auth Router", "Fastify Plugin (tRPC + REST)", "Login, logout, token refresh, and current-user endpoints. Rate-limited by @fastify/rate-limit. Issues HTTP-only Secure SameSite=Strict cookies.")
        Component(jwtSvc, "JWT Service", "Node built-in crypto", "Issues and validates short-lived access tokens (15-60 minutes). Tokens never stored in localStorage or sessionStorage.")
        Component(sessionMgr, "Session Manager", "Service", "Creates and terminates server-side sessions. Enforces one active session per user. Supports IT admin forced-logout, audit-logged with mandatory reason.")
        Component(refreshTokenSvc, "Refresh Token Service", "Service", "Issues, rotates, and validates long-lived refresh tokens. Stored server-side in PostgreSQL as hashed value. Rotated on every use. Delivered via HTTP-only cookie.")
        Component(credentialSvc, "Credential Service", "Argon2id", "Password hashing and verification using Argon2id per OWASP recommendation. No plaintext passwords stored or logged.")
        Component(roleResolver, "Role and Permission Resolver", "Service", "Resolves effective permissions from role_assignments for a given user. RBAC entry point feeding the ABAC engine. Enforces: Platform Admin role cannot be combined with any document-processing role.")
        Component(abacEngine, "ABAC Policy Engine", "Service", "Evaluates attribute-based policies at request time: office scope, document classification, workflow step assignee. Operates alongside PostgreSQL RLS as a second isolation layer.")
        Component(mfaSvc, "MFA Service", "TOTP - Phase 2 enforcement", "TOTP-based MFA. Code and schema present in Phase 1. Enforcement activated in Phase 2 for designated roles.")
        Component(iamRepo, "IAM Repository", "Drizzle ORM", "Data access for all iam schema tables.")
        Component(iamEventPub, "IAM Event Publisher", "Internal Event Bus", "Publishes: user.login, user.logout, session.terminated, role.assigned, role.revoked. All consumed by Audit module.")
    }

    ContainerDb(db, "PostgreSQL", "iam schema")
    Container(auditMod, "Audit Module", "Consumes all auth and role events")

    Rel(authRouter, jwtSvc, "Issues and validates access tokens")
    Rel(authRouter, sessionMgr, "Creates and terminates sessions")
    Rel(authRouter, refreshTokenSvc, "Rotates refresh tokens on use")
    Rel(authRouter, credentialSvc, "Verifies credentials on login")
    Rel(authRouter, mfaSvc, "Validates TOTP when enrolled")
    Rel(sessionMgr, roleResolver, "Resolves permissions for new session")
    Rel(roleResolver, abacEngine, "Provides role context for ABAC evaluation")
    Rel(iamRepo, db, "Reads and writes")
    Rel(authRouter, iamRepo, "User and session data access")
    Rel(roleResolver, iamRepo, "Role and permission data access")
    Rel(iamEventPub, auditMod, "Auth and role events via event bus")
```

---

### Module 2 — Organization

**Schema:** `organization` **Tables:** `offices`, `positions`, `employees`, `assignments`, `delegations` **Responsibility:** Office hierarchy, employee records, position assignments, and delegation management.

Delegation is a confirmed high-frequency first-class operation (10+ Acting Mayor designations per year). One active delegation per person is enforced at both the DB level (partial unique index on active `delegation_grants` per user) and the application level. No Platform Admin confirmation step is required — Secretariat logs the Designation and it takes immediate effect.

```mermaid
C4Component
    title Level 3 - Organization Module

    Container_Boundary(org, "Organization Module - schema: organization") {
        Component(orgRouter, "Organization Router", "tRPC", "CRUD for offices, positions, employees, and assignments. Admin-only delegation management. Designation document logging.")
        Component(officeSvc, "Office Service", "Service", "Office hierarchy management. Parent-child office relationships. Hierarchy consumed by ABAC engine for office-scoped access rules.")
        Component(employeeSvc, "Employee Service", "Service", "Employee records and position assignments. Resolves current active position and any delegated role for a given user at request time.")
        Component(delegationSvc, "Delegation Service", "Service", "Creates, validates, expires, and revokes delegation_grant records. One active delegation per person enforced via DB partial unique index and application validation. Auto-expires at end date with automatic return of authority to original authority.")
        Component(designationLogger, "Designation Logger", "Service", "Logs incoming Designation documents in the D YEAR-NN series. Issued by Mayor or Vice Mayor. Secretariat extracts scope and time bounds manually. Creates delegation_grant with immediate effect - no Platform Admin confirmation required.")
        Component(orgRepo, "Organization Repository", "Drizzle ORM", "Data access for all organization schema tables.")
        Component(orgEventPub, "Organization Event Publisher", "Internal Event Bus", "Publishes: delegation.granted, delegation.expired, delegation.revoked. Consumed by Workflow module for step re-routing and by Audit module.")
    }

    ContainerDb(db, "PostgreSQL", "organization schema")
    Container(wfMod, "Workflow Module", "Consumes delegation events for step re-routing")
    Container(auditMod, "Audit Module", "Receives all delegation events")

    Rel(orgRouter, officeSvc, "Office hierarchy operations")
    Rel(orgRouter, employeeSvc, "Employee and assignment operations")
    Rel(orgRouter, delegationSvc, "Delegation management")
    Rel(orgRouter, designationLogger, "Logs incoming Designation documents")
    Rel(designationLogger, delegationSvc, "Creates delegation_grant record on Designation log")
    Rel(orgRepo, db, "Reads and writes")
    Rel(officeSvc, orgRepo, "Office data access")
    Rel(employeeSvc, orgRepo, "Employee data access")
    Rel(delegationSvc, orgRepo, "Delegation data access")
    Rel(orgEventPub, wfMod, "Delegation events trigger immediate step re-routing")
    Rel(orgEventPub, auditMod, "Delegation events for audit log")
```

---

### Module 3 — Documents

**Schema:** `documents` **Tables:** `document_types`, `documents`, `versions`, `attachments`, `numbers`, `number_series`, `signatures` **Responsibility:** Document lifecycle management, immutable versioning, two-stage numbering, OCR on upload, file streaming to S3, QR cover sheet generation.

**Numbering summary:**

- Preliminary: `Draft 7SP YEAR-NN` — assigned at secretariat logging, before QR even (QR is first)
- Final: `7SP YEAR-NN` — assigned by Secretariat after last reading vote (Second Reading for Resolutions; Third Reading for Ordinances), before VP signs
- Space delimiter throughout all document type formats
- Final numbers are immutable once Draft prefix is removed
- Separate PostgreSQL sequence per document type per year; no shared counters

```mermaid
C4Component
    title Level 3 - Documents Module

    Container_Boundary(docs, "Documents Module - schema: documents") {
        Component(docRouter, "Document Router", "tRPC", "Document CRUD, version history, attachment upload and download, number assignment actions. Secretariat decision routing moved to Workflow Router per ADR-B2-3 — this Router no longer logs it directly.")
        Component(docTypeSvc, "Document Type Registry", "Service", "Admin-configurable type definitions: required fields, workflow template reference, retention schedule link, public visibility rules. Retention schedule must exist before type can be activated.")
        Component(docSvc, "Document Service", "Service", "Lifecycle state machine (C1/D3 post-ADR-013/ADR-014): Draft, Submitted, In-Workflow, Pending Mayor Action, Pending Panlalawigan Review, Completed, Released, Archived, Disposed, Superseded. Cancelled is terminal from any active state. Soft-delete only - no hard deletes.")
        Component(numberSeriesSvc, "Number Series Service", "Service", "Preliminary number at secretariat logging using Draft prefix and space delimiter. Final number after last reading vote. Separate PostgreSQL sequence per document type per year. Final numbers immutable after Draft prefix is removed.")
        Component(versionMgr, "Version Manager", "Service", "Immutable version history. No overwrites. Physical-to-digital copies flagged for Records Officer verification before being accepted as the official copy.")
        Component(attachmentSvc, "Attachment Service", "Service", "Generates S3 presigned URLs for direct client-to-storage transfer. UUID key generation. Triggers OCR on successful upload. Files never touch application server disk.")
        Component(ocrSvc, "OCR Service Interface", "Service wrapper - tesseract.js preferred", "Wraps OCR library behind a service interface so the underlying library is swappable without changing call sites. Auto-runs on every upload. Always returns scan quality indicator so user can decide on re-scan. Applied to migration imports also.")
        Component(signatureSvc, "Signature Record Service", "Service", "Stores scanned signature image references linked to document versions. Provides authentication trail; not cryptographic non-repudiation. PKI upgrade path reserved for post-Phase 1.")
        Component(coverSheetGen, "Cover Sheet Generator", "Service", "Auto-generates compact QR cover page from document metadata. Contains only three fields: QR code, Tracking Number, Series Number. Compact layout - multiple cover pages per printed sheet configurable.")
        Component(docsRepo, "Documents Repository", "Drizzle ORM", "Data access for all documents schema tables.")
        Component(docsEventPub, "Documents Event Publisher", "Internal Event Bus", "Publishes: document.created, document.state_changed, document.number_assigned. (document.secretariat_decision removed — never existed as a published event per ADR-B2-3; the decision flows through Workflow calling Documents.transitionState() synchronously instead.)")
    }

    ContainerDb(db, "PostgreSQL", "documents schema")
    Container(s3, "Object Storage", "S3-compatible")
    Container(trackMod, "Tracking Module", "Consumes document.created for QR assignment")
    Container(wfMod, "Workflow Module", "Consumes document events to drive workflow instances")
    Container(auditMod, "Audit Module", "Receives all document events")

    Rel(docRouter, docSvc, "Document lifecycle operations")
    Rel(docRouter, numberSeriesSvc, "Number assignment actions")
    Rel(docSvc, docTypeSvc, "Validates against document type configuration")
    Rel(docSvc, versionMgr, "Creates immutable versions")
    Rel(docSvc, docsRepo, "Persists document data")
    Rel(attachmentSvc, s3, "File streaming via presigned URLs")
    Rel(attachmentSvc, ocrSvc, "Triggers OCR on successful upload")
    Rel(attachmentSvc, docsRepo, "Records attachment metadata")
    Rel(numberSeriesSvc, docsRepo, "Persists number assignments using PostgreSQL sequences")
    Rel(docsRepo, db, "Reads and writes")
    Rel(docsEventPub, trackMod, "document.created triggers QR generation")
    Rel(docsEventPub, wfMod, "document.created triggers workflow instance creation")
    Rel(docsEventPub, auditMod, "All document events")
```

---

### Module 4 — Workflow

**Schema:** `workflow` **Tables:** `definitions`, `definition_versions`, `steps`, `transition_rules`, `instances`, `step_instances`, `workflow_events` **Responsibility:** Custom domain-specific workflow engine, admin-configurable without developer involvement. Workflow instances pin to definition version active at creation. Certified Urgent path is Phase 1. Multi-committee referral with all-committees-must-sign rule is Phase 1. Mayor 10-day lapse and Panlalawigan 30-day review timers run via pgboss.

**Phase 1 step types:** `action`, `approval`, `multi_referral`, `decision`, `notification`, `termination` **Phase 2 reserved (schema present in Phase 1):** `parallel_split`, `parallel_join`

```mermaid
C4Component
    title Level 3 - Workflow Module

    Container_Boundary(wf, "Workflow Module - schema: workflow") {
        Component(wfRouter, "Workflow Router", "tRPC", "Step actions: Approve, Reject, Amended, Advance with mandatory audit-logged comment. Workflow instance queries. Order of Business view with red-flag indicators for missing committee reports.")
        Component(wfDefMgr, "Workflow Definition Manager", "Service", "Admin-configurable workflow definitions and versioned step configurations. Validates legally required minimum steps per document type. Instances pin to the definition version active at creation.")
        Component(wfEngine, "Workflow Engine", "Service", "Orchestrates step execution. Evaluates transition rules. Routes to next step on completion. Handles decision branching. Publishes domain events after each state change.")
        Component(stepExecutor, "Step Executor", "Service", "Dispatches to step-type-specific handler: action, approval, multi_referral, decision, notification, termination; parallel_split and parallel_join reserved for Phase 2.")
        Component(multiReferralHandler, "Multi-Referral Step Handler", "Service", "Assigns to multiple committees simultaneously. All committees must sign and contribute to the unified report before step completes. Red-flags absent committees in Order of Business. Thursday cutoff enforced - missing report delays Second Reading to the following Tuesday. SP Secretary manual advance requires mandatory audit-logged comment.")
        Component(certUrgentHandler, "Certified Urgent Path Handler", "Service", "Triggered when Secretariat logs a Certification of Urgency. No standalone number on the Certification - it attaches to associated measures only. Bypasses committee referral for each associated measure. Advances each directly to Second Reading. One Certification can cover multiple measures in the same session.")
        Component(lapseTimerCoord, "Lapse Timer Coordinator", "Service", "Enqueues Mayor 10-day lapse timers and Panlalawigan 30-day review timers via pgboss. On expiry: transitions status, logs RA 7160 legal basis in Remarks field, notifies SP Secretary.")
        Component(artaMonitor, "ARTA SLA Monitor", "Service", "Tracks SLA clock from workflow initiation per RA 11032. Warning at 80% of SLA elapsed. Automatic escalation at breach: notifies supervisor and Records Officer. System outage does not pause ARTA obligation.")
        Component(wfRepo, "Workflow Repository", "Drizzle ORM", "Data access for all workflow schema tables.")
        Component(wfEventPub, "Workflow Event Publisher", "Internal Event Bus", "Publishes: workflow.step.started, workflow.step.completed, workflow.approval.lapsed, workflow.panlalawigan.deemed_approved, workflow.sla.breached, workflow.certification_urgency.bypass_applied, workflow.multi_referral.secretary_advanced, workflow.instance.completed. `[Corrected — this list previously used pre-B3 names throughout (step_assigned, escalated, certified_urgent_applied, manually_advanced, completed, unsplit lapsed); same reconciliation already applied to B2's event registry]`")
    }

    ContainerDb(db, "PostgreSQL", "workflow schema")
    Container(pgbossCont, "pgboss", "Durable lapse and SLA escalation timers")
    Container(notifMod, "Notifications Module", "Consumes step.started and sla.breached events")
    Container(auditMod, "Audit Module", "Receives all workflow events")
    Container(orgMod, "Organization Module", "Provides delegation context for step routing")

    Rel(wfRouter, wfEngine, "Submits step actions")
    Rel(wfRouter, wfDefMgr, "Workflow definition management")
    Rel(wfEngine, stepExecutor, "Dispatches by step type")
    Rel(stepExecutor, multiReferralHandler, "Routes multi_referral step type")
    Rel(stepExecutor, certUrgentHandler, "Routes Certified Urgent trigger")
    Rel(wfEngine, lapseTimerCoord, "Schedules lapse timers on relevant step initiation")
    Rel(wfEngine, artaMonitor, "Registers workflow instance with SLA tracker on creation")
    Rel(lapseTimerCoord, pgbossCont, "Enqueues timed lapse and review jobs")
    Rel(artaMonitor, pgbossCont, "Enqueues SLA warning and escalation jobs")
    Rel(wfEngine, orgMod, "Resolves current assignee accounting for active delegations")
    Rel(wfRepo, db, "Reads and writes")
    Rel(wfEngine, wfRepo, "Persists step instances and workflow events")
    Rel(wfEventPub, notifMod, "Step assignment and escalation events")
    Rel(wfEventPub, auditMod, "All workflow events")
```

---

### Module 5 — Tracking

**Schema:** `tracking` **Tables:** `tracking_records`, `routing_entries`, `qr_codes` **Responsibility:** QR code generation at secretariat logging (before preliminary number is assigned). Append-only routing history for every document movement. Physical custody tracking separate from digital workflow status. Public scan-result view.

**Confirmed QR assignment sequence:** Councilor submits draft → Secretariat logs → **QR tracking number assigned** → Preliminary Draft number assigned → workflow instance created.

```mermaid
C4Component
    title Level 3 - Tracking Module

    Container_Boundary(track, "Tracking Module - schema: tracking") {
        Component(trackRouter, "Tracking Router", "tRPC + REST public endpoint", "QR code lookup for authenticated internal users and the public scan route. Routing history queries. Physical custody update actions for Secretariat.")
        Component(qrCodeSvc, "QR Code Service", "Service using qrcode library", "Generates UUID-based tracking number at secretariat logging - before preliminary document number is assigned. QR tracking number is immutable for the full document lifetime, independent of both preliminary and final document numbers.")
        Component(routingHistorySvc, "Routing History Service", "Service", "Records every document movement: from office, to office, actor, timestamp, and action type. Append-only routing log per document.")
        Component(physCustodyTracker, "Physical Custody Tracker", "Service", "Tracks physical document location separately from digital workflow status. Allows Secretariat to log physical hand-offs independently of workflow step completion.")
        Component(publicLookupHandler, "Public Lookup Handler", "Service", "Processes QR scan for public display: document type, remarks, full routing history from draft. First page only visible - all other pages blurred. Get-a-Copy link to Document Request Form.")
        Component(trackRepo, "Tracking Repository", "Drizzle ORM", "Data access for all tracking schema tables.")
        Component(trackEventConsumer, "Tracking Event Consumer", "Internal Event Bus", "Consumes document.created to trigger QR generation and tracking record creation. Consumes workflow.step.completed to append routing entry.")
    }

    ContainerDb(db, "PostgreSQL", "tracking schema")
    Container(docsMod, "Documents Module", "Emits document.created")
    Container(wfMod, "Workflow Module", "Emits workflow.step.completed")

    Rel(trackEventConsumer, docsMod, "Subscribes to document.created")
    Rel(trackEventConsumer, wfMod, "Subscribes to workflow.step.completed")
    Rel(trackEventConsumer, qrCodeSvc, "Triggers QR generation on document.created")
    Rel(trackEventConsumer, routingHistorySvc, "Appends routing entry on step completion")
    Rel(trackRouter, publicLookupHandler, "Public QR scan route")
    Rel(trackRouter, routingHistorySvc, "Authenticated routing history queries")
    Rel(trackRouter, physCustodyTracker, "Physical custody update actions")
    Rel(trackRepo, db, "Reads and writes")
    Rel(qrCodeSvc, trackRepo, "Persists QR code record and tracking record")
    Rel(routingHistorySvc, trackRepo, "Appends routing entries")
```

---

### Module 6 — Records

**Schema:** `records` **Tables:** `records`, `retention_schedules`, `archive_entries`, `classification_rules`, `dispositions` **Responsibility:** Records lifecycle after workflow completion. Retention schedule enforcement. Classification level enforcement. Bulk operations restricted to Records Officers. Disposition with mandatory comment and legal hold check. No hard deletes by any user or role at any level.

**Confirmed retention policy:** SP Resolutions and Ordinances have permanent retention. Currently no documents disposed of at Batac SP Secretariat.

```mermaid
C4Component
    title Level 3 - Records Module

    Container_Boundary(rec, "Records Module - schema: records") {
        Component(recRouter, "Records Router", "tRPC", "Archive actions, retention schedule management, bulk operations for Records Officers only, disposition requests, legal hold management.")
        Component(retentionMgr, "Retention Schedule Manager", "Service", "Admin-configurable retention rules per document type. A retention schedule must exist before a document type can be activated. SP Resolutions and Ordinances: permanent retention confirmed.")
        Component(archiveSvc, "Archive Service", "Service", "Moves completed workflow documents to archive state. Soft-delete enforced on every table via deleted_at and deleted_by columns. No permanent deletion by any user or role.")
        Component(classificationSvc, "Classification Service", "Service", "Enforces four classification levels: Public (all users and public portal), Internal (authenticated LGU employees), Confidential and Restricted (explicit role allowlist only - e.g. Administrative Cases).")
        Component(dispositionSvc, "Disposition Service", "Service", "Authorized disposition requires Records Officer action with mandatory comment. No automated disposal. Validates legal hold before proceeding. Creates an audit record rather than deleting data. RA 10173 erasure requests require formal legal review by City Legal or DPO before action.")
        Component(bulkOpHandler, "Bulk Operation Handler", "Service", "Bulk archive, search, and export for Records Officers only. Dry-run preview then confirmation dialog required. Each individual item logged separately in audit. No bulk-delete permitted. Exports limited by classification level of requestor.")
        Component(recRepo, "Records Repository", "Drizzle ORM", "Data access for all records schema tables.")
        Component(recEventConsumer, "Records Event Consumer", "Internal Event Bus", "Consumes workflow.instance.completed terminal events to trigger record creation and initial archive entry.")
    }

    ContainerDb(db, "PostgreSQL", "records schema")
    Container(wfMod, "Workflow Module", "Emits terminal workflow.instance.completed events")
    Container(auditMod, "Audit Module", "Receives disposition and bulk operation events")

    Rel(recEventConsumer, wfMod, "Subscribes to terminal workflow.instance.completed events")
    Rel(recEventConsumer, archiveSvc, "Triggers record creation on workflow completion")
    Rel(recRouter, retentionMgr, "Retention schedule management")
    Rel(recRouter, archiveSvc, "Archive actions")
    Rel(recRouter, classificationSvc, "Classification rule management")
    Rel(recRouter, dispositionSvc, "Disposition requests")
    Rel(recRouter, bulkOpHandler, "Bulk operations")
    Rel(dispositionSvc, retentionMgr, "Validates retention schedule before disposition")
    Rel(recRepo, db, "Reads and writes")
    Rel(bulkOpHandler, auditMod, "Individual audit log entry per bulk item")
    Rel(dispositionSvc, auditMod, "Disposition audit records")
```

---

### Module 7 — Notifications

**Schema:** `notifications` **Tables:** `templates`, `notification_events`, `delivery_log` **Responsibility:** Multi-channel notification delivery. In-app via SSE. Email via Nodemailer. SMS via gateway (Phase 3 only). Admin-configurable templates requiring no developer involvement for changes. Formal respondent notices delivered by email if available; physical in-person pickup otherwise in Phase 1 and Phase 2.

```mermaid
C4Component
    title Level 3 - Notifications Module

    Container_Boundary(notif, "Notifications Module - schema: notifications") {
        Component(notifSvc, "Notification Service", "Service", "Receives notification triggers from internal event bus. Selects appropriate template. Determines delivery channel per recipient and notification type. Queues delivery to the right service.")
        Component(templateEngine, "Template Engine", "Service", "Admin-configurable templates for: step assignment, overdue alerts, SLA warnings, workflow completion, and formal respondent notices. No developer involvement required for template changes.")
        Component(inAppDeliverySvc, "In-App Delivery Service", "Service via SSE Endpoint", "Delivers real-time notifications to authenticated browser clients connected to the SSE endpoint. Stores unread notifications in database for clients not currently connected.")
        Component(emailDeliverySvc, "Email Delivery Service", "Nodemailer and react-email", "Delivers via LGU SMTP. Covers step-assignment emails, overdue alerts, and formal respondent notices when respondent has an email address on file.")
        Component(smsDlvInterface, "SMS Delivery Interface", "Reserved - Phase 3", "Phase 3: delivers via SMS gateway for respondents with only a contact number. Phase 1 and 2: respondent is called by phone; formal written notice must be claimed in person from LGU.")
        Component(notifRepo, "Notifications Repository", "Drizzle ORM", "Data access for notifications schema tables. delivery_log records all delivery attempts and their outcomes.")
        Component(notifEventConsumer, "Notification Event Consumer", "Internal Event Bus", "Subscribes to: workflow.step.started, workflow.sla.breached, workflow.approval.lapsed, workflow.panlalawigan.deemed_approved, document.state_changed. Routes each event to Notification Service for processing. `[Corrected — pre-B3 names updated; workflow.lapsed split into its two ratified successor events per B3 §0.2, both routed here since both notify the SP Secretary]`")
    }

    Container(sseEndpoint, "SSE Endpoint", "Fastify SSE plugin")
    System_Ext(smtpServer, "LGU SMTP Server", "Email delivery")
    ContainerDb(db, "PostgreSQL", "notifications schema")
    Container(wfMod, "Workflow Module", "Emits step, lapse, and escalation events")

    Rel(notifEventConsumer, wfMod, "Subscribes to workflow events")
    Rel(notifEventConsumer, notifSvc, "Triggers notification processing for each event")
    Rel(notifSvc, templateEngine, "Selects and renders appropriate template")
    Rel(notifSvc, inAppDeliverySvc, "Routes in-app notifications")
    Rel(notifSvc, emailDeliverySvc, "Routes email notifications")
    Rel(notifSvc, smsDlvInterface, "Routes SMS - Phase 3 only")
    Rel(inAppDeliverySvc, sseEndpoint, "Pushes events to SSE endpoint")
    Rel(emailDeliverySvc, smtpServer, "SMTP with TLS")
    Rel(notifRepo, db, "Reads and writes")
    Rel(notifSvc, notifRepo, "Logs all delivery attempts and outcomes")
```

---

### Module 8 — Audit

**Schema:** `audit` **Tables:** `events` (append-only; INSERT-only at PostgreSQL DB role level) **Responsibility:** Tamper-evident audit log for all system activity. Hash chaining and HMAC using Node built-in `crypto` only — no external library. Monthly RFC 3161 TSA export. `UPDATE` and `DELETE` are revoked from the application DB user on the audit schema at the PostgreSQL role level.

**Claim boundary (required in ADR):** The audit log is tamper-evident, not tamper-proof. A sufficiently privileged attacker holding both DB write access and the HMAC secret key could insert records that pass validation. This distinction is documented in the ADR for the audit log design.

```mermaid
C4Component
    title Level 3 - Audit Module

    Container_Boundary(audit, "Audit Module - schema: audit") {
        Component(auditSvc, "Audit Service", "Service", "The only permitted path for writing audit events. No module may write directly to the audit schema. Validates event structure. All domain modules route events through this service exclusively.")
        Component(hashChainMgr, "Hash Chain Manager", "Node built-in crypto SHA-256", "Maintains SHA-256 hash chain across all audit events. Each entry stores SHA-256(previous_chain_hash + current_event_payload). Genesis hash used for first record in a series. Chain computed atomically with the INSERT.")
        Component(hmacSigner, "HMAC Signer", "Node built-in crypto HMAC-SHA-256", "Signs each event payload with HMAC-SHA-256 using a secret key held in environment variable only - not stored in the database. Prevents an attacker from computing a valid chain hash without the key.")
        Component(chainValidator, "Chain Validator", "Service", "Validates hash chain integrity at retrieval time. A broken chain is flagged as a tamper indicator and surfaced to the authorized requester.")
        Component(auditQuerySvc, "Audit Query Service", "Service", "Authenticated read access for authorized roles. Returns events alongside chain validation status per batch. Supports filtering by event type, actor, date range, and document ID.")
        Component(tsaExportSvc, "TSA Export Service", "Service scheduled by pgboss", "Monthly job: compiles and exports a signed audit snapshot to RFC 3161 TSA. Provides tamper-evidence coverage for bulk deletion scenarios. The export action itself is recorded as an audit event.")
        Component(auditRepo, "Audit Repository", "Drizzle ORM - INSERT only", "Data access for audit.events. INSERT operations only. PostgreSQL application DB user has UPDATE and DELETE revoked on the audit schema.")
        Component(auditEventConsumer, "Audit Event Consumer", "Internal Event Bus", "Subscribes to events from all modules: IAM, Organization, Documents, Workflow, Tracking, Records, Notifications. Routes all to Audit Service.")
    }

    ContainerDb(db, "PostgreSQL", "audit schema - INSERT only for application DB user")
    Container(pgbossCont, "pgboss", "Monthly TSA export trigger")
    System_Ext(tsa, "RFC 3161 TSA", "External timestamp authority")

    Rel(auditEventConsumer, auditSvc, "Routes all domain events for writing")
    Rel(auditSvc, hashChainMgr, "Computes chain hash for each event before write")
    Rel(auditSvc, hmacSigner, "Signs event payload before write")
    Rel(auditSvc, auditRepo, "INSERTs audit event - no updates or deletes")
    Rel(auditQuerySvc, chainValidator, "Validates chain on every retrieval")
    Rel(auditQuerySvc, auditRepo, "Reads audit events")
    Rel(tsaExportSvc, pgbossCont, "Scheduled monthly by pgboss")
    Rel(tsaExportSvc, tsa, "Exports signed audit snapshot")
    Rel(auditRepo, db, "INSERT only")
```

---

### Module 9 — Search Meta [Phase 2]

**Schema:** `search_meta` **Tables:** `index_metadata`, `index_jobs` **Responsibility:** Provider-agnostic search abstraction layer. Phase 1 uses PostgreSQL FTS (`tsvector`/`tsquery`). Phase 2 adds Meilisearch. All call sites across the codebase reference only the abstraction interface — never the underlying provider. Provider swap requires no call site changes. Typo tolerance is required for Filipino proper names.

```mermaid
C4Component
    title Level 3 - Search Meta Module (Phase 2)

    Container_Boundary(search, "Search Meta Module - schema: search_meta") {
        Component(searchRouter, "Search Router", "tRPC", "Exposes search endpoint to the Internal Web App. Routes all queries through the Search Abstraction Interface exclusively.")
        Component(searchAbstraction, "Search Abstraction Interface", "Service", "Single interface for all search queries across the codebase. Phase 1: delegates to FTS Query Service. Phase 2: delegates to Meilisearch Client. Provider swap is a configuration and deployment change only - no call site changes required.")
        Component(ftsSvc, "FTS Query Service", "Service - PostgreSQL tsvector", "Phase 1 search provider. Executes tsvector and tsquery against PostgreSQL. Acceptable for initial document volume with no additional infrastructure.")
        Component(meilisearchClient, "Meilisearch Client", "Service - Phase 2", "Phase 2 search provider. Queries self-hosted Meilisearch HTTP API. Typo-tolerant search and faceted filtering for Filipino proper names. Activated when Meilisearch container is deployed in Phase 2.")
        Component(syncWorker, "Meilisearch Sync Worker", "pgboss job - Phase 2", "pgboss job that syncs new and updated documents from PostgreSQL to Meilisearch after each relevant document state change. Handles failures and retries.")
        Component(indexJobMgr, "Index Job Manager", "Service - Phase 2", "Tracks indexing job state and failure records. Supports admin-triggered manual re-index for specific document sets.")
        Component(searchRepo, "Search Meta Repository", "Drizzle ORM", "Data access for search_meta schema tables.")
    }

    ContainerDb(db, "PostgreSQL", "search_meta schema and FTS tsvector indexes")
    Container(meilisearchExt, "Meilisearch", "Phase 2 - self-hosted Docker container")
    Container(pgbossCont, "pgboss", "Sync job scheduling - Phase 2")
    Container(docsMod, "Documents Module", "Emits document state change events")

    Rel(searchRouter, searchAbstraction, "Routes all search queries")
    Rel(searchAbstraction, ftsSvc, "Phase 1: delegates to PostgreSQL FTS")
    Rel(searchAbstraction, meilisearchClient, "Phase 2: delegates to Meilisearch")
    Rel(ftsSvc, db, "tsvector and tsquery execution")
    Rel(meilisearchClient, meilisearchExt, "Meilisearch HTTP API")
    Rel(syncWorker, docsMod, "Triggered by document state change events")
    Rel(syncWorker, meilisearchExt, "Writes updated documents to Meilisearch index")
    Rel(syncWorker, pgbossCont, "Enqueued and scheduled via pgboss")
    Rel(indexJobMgr, searchRepo, "Records job state and failures")
    Rel(searchRepo, db, "Reads and writes")
```

---

### Module 10 — Portal [Phase 3]

**Schema:** `portal` **Tables:** `public_documents`, `citizen_requests`, `complaints`, `announcements` **Responsibility:** Public-facing REST API consumed by the Next.js citizen portal. Citizen OTP-based authentication. Public document lookup (first page visible; body blurred). Citizen complaint submission. Document Request Form. Phase 3.

**Three confirmed access modes for both Document Requests and Complaints:**

1. Citizen downloads template from sp.batac.gov.ph and submits physical document with wet-ink signature
2. Citizen inputs on digital form → system generates printable form → citizen prints, signs, and submits
3. Citizen visits Secretariat in person → clerk inputs on digital form → prints on-site → citizen signs on the spot

```mermaid
C4Component
    title Level 3 - Portal Module (Phase 3)

    Container_Boundary(port, "Portal Module - schema: portal") {
        Component(portalRestRouter, "Portal REST Router", "Fastify REST and OpenAPI", "Public REST endpoints documented via @fastify/swagger OpenAPI spec. Rate-limited on auth and submission routes. Consumed by Next.js portal and optionally mobile or third-party clients.")
        Component(publicDocSvc, "Public Document Service", "Service", "Manages publicly visible document listings. Title shown in listings. First page of document visible. Body of all other pages blurred. Full copy requires Document Request Form plus VP and SP Secretary approval plus payment.")
        Component(citizenRequestHandler, "Citizen Request Handler", "Service", "Document and records request form processing. Supports three access modes. Approval requires both VP and SP Secretary. Physical wet-ink signature still required - digital form generates formatted document only, not a substitute for wet signature.")
        Component(complaintIngester, "Complaint Ingester", "Service", "Citizen complaint submission for any LGU-related subject - not limited to transportation. Supports three access modes. Secretariat decides routing to committee directly or to Vice Mayor depending on complaint nature. Four outcome states: Pending Hearing, Received or Seen, Dismissed, Resolved.")
        Component(respondentNoticeSvc, "Respondent Notice Service", "Service", "Issues formal written notice to complaint respondent. Email delivery when email address is on file. Phone notification plus in-person written notice pickup when only contact number available.")
        Component(announcementSvc, "Announcement Service", "Service", "Manages and serves public announcements visible on the citizen portal.")
        Component(citizenAuthSvc, "Citizen Auth Service", "Service", "Citizen registration requires name, birthdate, phone, and email. OTP verification required on both phone and email. Annual re-verification. PhilSys feature-flagged and assumed unavailable until integration is confirmed.")
        Component(portalRepo, "Portal Repository", "Drizzle ORM", "Data access for all portal schema tables.")
        Component(portalEventConsumer, "Portal Event Consumer", "Internal Event Bus", "Consumes workflow.instance.completed and document.state_changed events. Updates public_documents visibility when SP Secretary action publishes an approved legislative document.")
    }

    ContainerDb(db, "PostgreSQL", "portal schema")
    Container(wfMod, "Workflow Module", "Emits workflow.instance.completed events")
    Container(docsMod, "Documents Module", "Emits document.state_changed events")
    System_Ext(smtpServer, "LGU SMTP Server", "Respondent formal notice email delivery")
    Container(nextjsPortal, "Citizen Portal", "Next.js with SSG")

    Rel(nextjsPortal, portalRestRouter, "Public REST and OpenAPI calls")
    Rel(portalRestRouter, publicDocSvc, "Document lookup and listing routes")
    Rel(portalRestRouter, citizenRequestHandler, "Document request form routes")
    Rel(portalRestRouter, complaintIngester, "Complaint submission routes")
    Rel(portalRestRouter, announcementSvc, "Announcement listing routes")
    Rel(portalRestRouter, citizenAuthSvc, "Citizen authentication routes")
    Rel(complaintIngester, respondentNoticeSvc, "Triggers respondent notification after routing")
    Rel(respondentNoticeSvc, smtpServer, "Sends formal email notice when email address on file")
    Rel(portalEventConsumer, wfMod, "Subscribes to workflow.instance.completed")
    Rel(portalEventConsumer, docsMod, "Subscribes to document.state_changed")
    Rel(portalEventConsumer, publicDocSvc, "Updates public document visibility on publication event")
    Rel(portalRepo, db, "Reads and writes")
```

---

### Module 11 — Reporting [Phase 2]

**Schema:** `reporting` **Tables:** `report_definitions`, `schedules`, `outputs` **Responsibility:** Admin-configurable report generation requiring no developer involvement for new report types. RA 11032 ARTA compliance reports generated from live workflow SLA data. Scheduled and on-demand. PDF via `@react-pdf/renderer`. Spreadsheet via SheetJS.

```mermaid
C4Component
    title Level 3 - Reporting Module (Phase 2)

    Container_Boundary(report, "Reporting Module - schema: reporting") {
        Component(reportRouter, "Reporting Router", "tRPC", "On-demand report generation, schedule management, output listing and download. Admin-only definition management. Access controlled by role.")
        Component(reportDefMgr, "Report Definition Manager", "Service", "Admin-configurable report templates and column definitions. No developer involvement required for new report types. Validates definition completeness before activation.")
        Component(reportScheduler, "Report Scheduler", "node-cron and pgboss", "node-cron for simple fixed schedules. pgboss for durable scheduled execution with failure recovery and automatic retry.")
        Component(reportGenerator, "Report Generator", "Service", "Executes parameterized report queries against PostgreSQL. Produces PDF via react-pdf renderer or spreadsheet via SheetJS. Stores output files in S3 or database per report configuration.")
        Component(artaReporter, "ARTA Compliance Reporter", "Service", "Generates RA 11032 SLA compliance reports sourced from live Workflow module SLA tracking data. Surfaces: average processing times, SLA breaches, pending items by office, overdue counts. Generated from system data - not manual input.")
        Component(reportRepo, "Reporting Repository", "Drizzle ORM", "Data access for reporting schema tables.")
    }

    ContainerDb(db, "PostgreSQL", "reporting schema and read access to workflow schema")
    Container(pgbossCont, "pgboss", "Durable scheduled report job execution")
    Container(s3, "Object Storage", "Report output file storage")
    Container(wfMod, "Workflow Module", "SLA tracking data source for ARTA reports")

    Rel(reportRouter, reportDefMgr, "Report definition CRUD")
    Rel(reportRouter, reportScheduler, "Schedule management")
    Rel(reportRouter, reportGenerator, "On-demand report generation trigger")
    Rel(reportScheduler, pgbossCont, "Enqueues generation jobs at configured intervals")
    Rel(pgbossCont, reportGenerator, "Triggers scheduled report generation")
    Rel(reportGenerator, db, "Executes parameterized report queries")
    Rel(reportGenerator, s3, "Stores output files with UUID keys")
    Rel(artaReporter, wfMod, "Reads SLA tracking and escalation data")
    Rel(artaReporter, reportGenerator, "Delegates formatted output generation")
    Rel(reportRepo, db, "Reads and writes")
```

---

## Appendix A — Cross-Module Event Reference [Inference]

All events travel via the in-process event bus. Event names and subscriptions listed here are proposed design and subject to refinement during implementation.

|Event|Emitting Module|Consuming Modules|Notes|
|---|---|---|---|
|`user.login`|IAM|Audit||
|`user.logout`|IAM|Audit||
|`session.terminated`|IAM|Audit|Includes forced-logout by IT admin|
|`role.assigned`|IAM|Audit||
|`role.revoked`|IAM|Audit||
|`delegation.granted`|Organization|Workflow, Audit|Triggers immediate step re-routing to designated person|
|`delegation.expired`|Organization|Workflow, Audit|Auto-return of authority at end date|
|`delegation.revoked`|Organization|Workflow, Audit|Early revocation by delegating authority|
|`document.created`|Documents|Tracking, Workflow, Audit|QR generation and workflow instance creation|
|`document.state_changed`|Documents|Tracking, Notifications, Search Meta, Portal, Audit||
|`document.number_assigned`|Documents|Audit|Both preliminary and final assignment events|
|`document.certification_urgency.logged`|Documents|Workflow, Audit|`[Added]` Was absent from this list entirely; see B2 Master Event Bus Registry fix|
|`workflow.step.started`|Workflow|Notifications, Audit|Triggers notification to new assignee|
|`workflow.step.completed`|Workflow|Tracking, Audit|Appends routing entry to routing history. `[UPDATED — ADR-B2-3]` Also now carries Approve/Reject/Amended Secretariat decision outcomes in its `outcome` field — `document.secretariat_decision` never existed as a published event; this row previously listed it a third time in this same document (see the Document Router and Documents Event Publisher fixes elsewhere in this file)|
|`workflow.approval.lapsed`|Workflow|Notifications, Audit|Mayor 10-day timer expired, RA 7160 §47|
|`workflow.panlalawigan.deemed_approved`|Workflow|Notifications, Audit|Panlalawigan 30-day timer expired, RA 7160 §56(d)|
|`workflow.sla.breached`|Workflow|Notifications, Audit|ARTA SLA breach escalation|
|`workflow.sla.warning`|Workflow|Notifications, Audit|`[Added]` Was absent from this list entirely; SLA warning tier at 80% elapsed|
|`workflow.sla.critical`|Workflow|Notifications, Audit|`[Added]` Was absent from this list entirely; second SLA escalation tier|
|`workflow.certification_urgency.bypass_applied`|Workflow|Audit|Committee step bypassed on associated measures|
|`workflow.multi_referral.secretary_advanced`|Workflow|Audit|SP Secretary override — mandatory comment logged|
|`workflow.instance.completed`|Workflow|Records, Portal, Audit|Triggers record creation and public visibility update|

---

## Appendix B — Architectural Invariants Affecting This Document

Invariants from Part 12 of the Consolidated Reference that directly constrain the component boundaries shown above.

|#|Invariant|How It Appears in the Diagrams|
|---|---|---|
|1|Schema-per-module; no cross-schema FK constraints|Each module has its own Repository; no Drizzle query reaches into another module's schema|
|2|Modules communicate only via event bus or published APIs|All cross-module arrows are event bus subscriptions or explicit API calls — never direct schema access|
|3|Audit log INSERT-only at PostgreSQL DB role level|Audit Repository shown as INSERT-only; all writes route through Audit Service exclusively — no module has a direct DB arrow to audit schema|
|4|Workflow instance pins to definition version at creation|Workflow Definition Manager stores `definition_version_id` on instance at creation; all resolution uses the pinned version|
|5|S3-compatible API only; UUID file keys; no provider SDK imports|Attachment Service calls only the S3-compatible API; UUID key generation is in the service layer before the S3 call|
|6|No hard deletes by any user or role|Archive Service and all Repository components enforce soft-delete (deleted_at and deleted_by columns)|
|7|IT Admin has no document content access|Enforced by ABAC Policy Engine in IAM module and by PostgreSQL RLS — both layers required|
|8|Platform Admin cannot combine with operational roles|Role and Permission Resolver in IAM enforces this invariant at role assignment time|
|9|One active delegation per person at any time|Delegation Service enforces via DB partial unique index on active delegation_grants per user and application-level validation|
|10|Final document numbers immutable after Draft prefix removed|Number Series Service applies immutability check; DB constraint as second enforcement layer|
|11|Audit writes through Audit Service only|No module diagram has a direct DB arrow to the audit schema — all route through the Audit Service component|
|12|Audit log is tamper-evident, not tamper-proof|Hash Chain Manager and HMAC Signer combined provide evidence of tampering, not prevention; this distinction must be documented in the ADR|
