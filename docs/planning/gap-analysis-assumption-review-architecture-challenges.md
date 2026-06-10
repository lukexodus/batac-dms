# Batac City LGU Platform — Gap Analysis, Assumption Review & Architecture Challenges

> **Context:** Phase 1 prototype development begins before formal requirements gathering is complete. The architecture is intentionally modular and configurable to absorb future corrections. This document identifies what remains unresolved, what assumptions are being made and whether they hold, and what decisions must be protected regardless of future changes.
> 
> **Label convention:**
> 
> - `[Inference]` — logically reasoned, not confirmed
> - `[Speculation]` — plausible but unconfirmed
> - `[Unverified]` — no reliable source; verify before acting

---

## 1. Remaining Unresolved Questions

Each item is classified by the latest phase at which it must be resolved. Classifications:

- **Before Phase 1 Development** — blocks correct prototype design
- **Before Phase 1 Deployment** — blocks safe production use
- **Before Phase 2 Development** — blocks Phase 2 module design
- **Before Production Rollout** — must be resolved before city-wide use
- **Before Public Portal Launch** — must be resolved before citizen-facing features go live
- **Before External Integrations** — must be resolved before any system-to-system connections
- **Can Be Deferred Indefinitely** — no current dependency

---

### Q1. Real SP Workflow Walkthrough

**Description:** The entire Phase 1 scope — SP Resolution and SP Ordinance workflows — is built on educated guesses. No real workflow walkthrough with the SP Secretary or Records Officer has been conducted yet.

**Why it matters:** The guessed workflow may differ from actual practice in ways that require redesigning the workflow engine's step model, numbering events, committee assignment logic, or session structure.

**Default:** Use the educated workflow documented in Part 1. Build as configurable steps, not hardcoded sequence.

**Consequences if wrong:** Phase 1 prototype demonstrates the wrong process; rework required before deployment.

**Confidence:** Low.

**Classification:** Before Phase 1 Development — the walkthrough is scheduled next week; block no code that assumes the workflow structure until confirmed.

---

### Q2. Official Org Chart and Office Hierarchy

**Description:** The org chart used for role and office design is `[Inference]` from RA 7160 and general LGU patterns. Batac City's actual structure, reporting lines, and office names have not been confirmed.

**Why it matters:** Role definitions, workflow assignee rules, and ABAC office-scoping policies are all built on the org chart.

**Default:** Use the standard LGU structure from RA 7160 as the starting model.

**Consequences if wrong:** Roles and office assignments must be reconfigured before deployment; this is low-cost if the admin configuration layer is working correctly.

**Confidence:** Medium.

**Classification:** Before Phase 1 Deployment — not blocking prototype development since it is configuration, not architecture.

---

### Q3. Who Controls Each Document Numbering Series

**Description:** Which person or office is the authority for issuing numbers per series (SP Secretary for resolutions, Mayor's Office for Executive Orders, etc.) has not been confirmed.

**Default:** Model numbering series as office-owned, not person-owned. Each series has a designated Series Authority office with delegated operators. This is configurable.

**Consequences if wrong:** Numbering authority reconfiguration required; low cost if office-owned model is used.

**Classification:** Before Phase 1 Development — the data model for numbering series must reflect the ownership model before tables are created.

---

### Q4. Existing Systems Inventory

**Description:** What software the LGU currently uses (payroll, HRIS, treasury, accounting, BPLO) has not been confirmed.

**Default:** Assume systems exist; design the platform to operate independently with integration-ready boundaries. Do not import or replace any external system in Phase 1.

**Consequences if wrong:** Integration conflicts discovered later; high rework risk if the platform was built to duplicate a still-active system.

**Classification:** Before Phase 1 Deployment — integration points must be scoped before going live.

---

### Q5. COA Acceptance of Digital Records

**Description:** Whether the Commission on Audit accepts digital records without wet-ink physical originals, and whether there are COA circulars specific to Batac City, has not been confirmed. `[Unverified]`

**Default:** Assume hybrid model — digital is operational truth, physical is legal truth — for all financial, contractual, and audit-sensitive documents.

**Consequences if wrong:** If COA rejects digital records for audit purposes, the system's role as operational source of truth is diminished; records management workflow must be redesigned.

**Classification:** Before Production Rollout — does not block Phase 1 prototype but must be resolved before city-wide deployment.

---

### Q6. DPO Designation and RA 10173 Compliance Timeline

**Description:** Whether a Data Protection Officer has been formally designated, and when the Privacy Impact Assessment will be conducted, has not been confirmed.

**Default:** Implement privacy-by-design controls in Phase 1 (RBAC, audit log, data classification, retention policies). Formal PIA and DPO designation deferred to Phase 2.

**Consequences if wrong:** If Phase 1 goes to production with citizen data before PIA is complete, the LGU is in violation of RA 10173.

**Classification:** Before Production Rollout — specifically, before any citizen personal data enters the production system.

---

### Q7. Physical Records Retention After Digitization

**Description:** For which document types physical originals must still be retained after digital processing, and for how long, has not been confirmed with the Records Officer, Legal Office, or COA.

**Default:** Retain all physical originals until confirmed otherwise per document category. The system tracks physical custody separately from digital status.

**Consequences if wrong:** Paper disposal occurs on documents that legally required retention; legal and COA audit liability.

**Classification:** Before Production Rollout.

---

### Q8. Department Head Delegation Chains

**Description:** Whether a Section Chief can act for a Department Head when the Department Head is unavailable — and the legal basis (Office Order, Memorandum, or designation) — has not been defined per department.

**Default:** System supports configurable delegation chains with explicit legal basis fields, effective dates, and auto-expiration. No delegation is assumed unless configured.

**Consequences if wrong:** Approvals stall when Department Heads are absent.

**Classification:** Before Phase 1 Deployment.

---

### Q9. Specific SLA Thresholds per Batac City Document Type

**Description:** ARTA provides the general framework (3/7/20 days). The exact classification of each Batac City document type (simple vs. complex vs. highly technical) has not been confirmed with the LGU.

**Default:** Use ARTA categories as defaults; make all SLA thresholds configurable per document type and per workflow step.

**Consequences if wrong:** ARTA compliance reports generate incorrect breach calculations.

**Classification:** Before Phase 1 Deployment — SLA enforcement begins with the first real user.

---

### Q10. Offline Sync Conflict Resolution — Locking Interaction

**Description:** The design specifies pessimistic locking for document editing AND offline caching for barangay connectivity. If a user opens a document on a mobile device, loses connectivity, and the pessimistic lock persists indefinitely, another user cannot act on the same document until connectivity is restored.

**Default:** Locks must have a configurable timeout (e.g., 15 minutes). A document locked by a user who loses connectivity auto-releases after timeout. Offline action cache checks lock status on reconnect before submitting.

**Consequences if wrong:** Documents become inaccessible whenever a mobile user goes offline, potentially for hours or days.

**Classification:** Before Phase 1 Deployment — affects every workflow step in a mobile context.

---

### Q11. SP Committee Structure and Composition

**Description:** The actual number, names, and membership of SP committees in Batac City has not been confirmed. `[Inference: standard committees exist]`

**Default:** Model committees as admin-configurable entities within the Organization module. Do not hardcode committee names or membership.

**Consequences if wrong:** Low — committee structure is configuration, not architecture.

**Classification:** Before Phase 1 Deployment.

---

### Q12. Budget Continuity for Hosting and Phase 2

**Description:** Whether funding is confirmed beyond Phase 1 development — for hosting, maintenance, and Phase 2 features — has not been confirmed.

**Why it matters:** If hosting funds are cut, the system goes offline. Architecture decisions (cloud vs. on-premise, managed vs. self-hosted services) must account for this.

**Default:** Design for portability so the system can migrate to LGU-owned infrastructure if cloud budget is cut.

**Consequences if wrong:** System goes offline; government data trapped in inaccessible cloud.

**Classification:** Before Phase 1 Deployment.

---

### Q13. Procurement Workflow Detail (Phase 2)

**Description:** Purchase Request → Purchase Order → BAC workflow details — approval authorities, monetary thresholds, required attachments, COA pre-audit interactions — have not been confirmed.

**Default:** Implement procurement as a configurable workflow in Phase 2. Do not hardcode approval chains.

**Classification:** Before Phase 2 Development.

---

### Q14. Virus Scanning Policy for File Uploads

**Description:** The organization's policy for scanning uploaded attachments has not been defined. A placeholder exists in the architecture.

**Default:** All uploaded files enter a quarantine state; scanned asynchronously by ClamAV (self-hosted, no-cost baseline); only marked available after passing. Policy is configurable to integrate a commercial AV engine later.

**Classification:** Before Phase 1 Deployment — file uploads are live immediately.

---

### Q15. Veto Override Workflow

**Description:** If the Mayor vetoes an SP ordinance, the SP can override with a 2/3 vote. This is a legally defined workflow step that has no design. `[Inference based on RA 7160]`

**Default:** Model veto and veto-override as named workflow states with configurable transition rules. The ordinance workflow must support: Sent to Mayor → Mayor Vetoes → SP Override Vote → Override Result → Effective / Failed.

**Classification:** Before Phase 1 Deployment — SP Ordinance is a Phase 1 document type.

---

### Q16. Mayor's 10-Day Lapse-into-Law Rule

**Description:** If the Mayor does not act on an ordinance within 10 days, it lapses into law. The system has no automated handling for this.

**Default:** Implement a workflow SLA timer at the "Mayor Review" step: 10 calendar days (not working days). On expiration, system alerts the SP Secretary and transitions the document to "Lapsed into Law" status, which is treated as equivalent to "Approved" for records purposes. The timer is configurable per document type.

**Classification:** Before Phase 1 Deployment.

---

### Q17. Liga ng mga Barangay Resolutions

**Description:** Liga resolutions are passed by the body of all barangay captains and have different legal standing from individual barangay resolutions. They have not been addressed in any workflow design. `[Inference based on RA 7160]`

**Default:** Model Liga resolutions as a separate document type with its own configurable workflow, routed through the SP Secretariat.

**Classification:** Before Phase 2 Development (barangay access).

---

### Q18. SK (Sangguniang Kabataan) Documents

**Description:** SK resolutions and documents follow a different process (through DILG, not the SP). Whether they are in scope has not been decided.

**Default:** Exclude from Phase 1 scope. Design the document type configuration system to allow SK documents to be added as a document type in a future phase without code changes.

**Classification:** Can Be Deferred Indefinitely until scope decision is made.

---

### Q19. .gov.ph Domain and SSL Certificate

**Description:** Government systems in the Philippines typically use .gov.ph domains, requiring DICT coordination. This has not been addressed. `[Unverified: DICT .gov.ph requirements]`

**Default:** Begin with an interim domain (e.g., batac-lgu.cloud or similar) for prototype. Coordinate DICT .gov.ph application before Production Rollout.

**Classification:** Before Production Rollout.

---

### Q20. Development Team Production Data Access Policy

**Description:** Whether the 4-person development team has access to production data during and after deployment has not been defined. This is a significant security and DPA risk.

**Default:** Development team has zero access to production data. Production credentials are held exclusively by the LGU IT Office. A separate sanitized staging environment with synthetic data is maintained for debugging. Emergency access requires formal LGU authorization and is audit-logged.

**Classification:** Before Phase 1 Deployment.

---

## 2. Architectural Assumption Review

### A1. Modular Monolith Is the Correct Initial Architecture

**Assessment:** Reasonable. Four developers cannot operate a distributed microservices system safely without significant tooling overhead.

**If false:** Premature microservices introduction causes deployment complexity, distributed debugging overhead, and inter-service auth complexity that will consume Phase 1 entirely.

**Mitigation:** Enforce hard module boundaries now. Measure inter-module coupling with automated tests. If a module must communicate with another, it does so only through the event bus or a published module API — never by direct schema access.

**Verdict:** Accept.

---

### A2. PostgreSQL Schema-Per-Module Isolation Is Sufficient

**Assessment:** Reasonable. Schema isolation enforces boundaries at the database level without the cost of separate database servers.

**If false:** If a developer creates a cross-schema foreign key or a cross-schema JOIN in application code, the isolation collapses silently. There is no database-level enforcement preventing this.

**Mitigation:** Automated linting rule: no cross-schema foreign key constraints in migrations. Integration test that asserts each module's repository class only queries its own schema. Code review checklist item.

**Verdict:** Accept — with automated enforcement, not manual discipline.

---

### A3. 100–250 Initial Users

**Assessment:** Likely an underestimate. Adding 42 barangay officials + secretaries, SP members, department employees, records officers, and service accounts yields a realistic estimate of 400–600 accounts. Citizen portal accounts are unbounded.

**If false:** Session management, connection pooling, and application performance are under-provisioned from day one.

**Mitigation:** Design for 1,000 concurrent authenticated users from the start. This costs almost nothing to design for but is expensive to retrofit.

**Verdict:** Reject the 100–250 number as a design target. Use 1,000 concurrent users as the performance design baseline.

---

### A4. Admin-Configurable Workflows Are Sufficient Without Developer Involvement

**Assessment:** Partially correct. Administrative workflow configuration is powerful enough for routine cases, but configuration errors on legally mandated workflows (e.g., removing the 3rd reading from an ordinance) can cause legal violations without any code change.

**If false:** Admins misconfigure a workflow; a resolution is approved without committee review; the document's legal validity is questionable.

**Mitigation:** Implement workflow validation rules — certain document types have minimum required step types that cannot be removed. These constraints are hardcoded as validator rules, not configurable. The workflow editor rejects definitions that violate them.

**Verdict:** Accept the configurability; add constraint validation as a non-negotiable feature.

---

### A5. Scanned Signatures With LGU Written Acceptance

**Assessment:** Pragmatic given PKI unavailability. But the written acceptance is not yet signed. Until it is signed, this is a gap.

**If false (acceptance not obtained):** System goes live without a documented stance; legal disputes cannot be resolved by reference to any accepted limitation.

**Mitigation:** Make LGU acceptance signature on the non-repudiation limitation document a go/no-go gate for Phase 1 Deployment. No deployment without signed acceptance.

**Verdict:** Accept — with signed acceptance as a formal prerequisite.

---

### A6. Pessimistic Locking Is the Right Concurrency Model

**Assessment:** Reasonable for government users who have low tolerance for merge conflicts. But pessimistic locking combined with offline mobile use is contradictory (see Q10 above).

**If false:** Documents become locked indefinitely when a mobile user loses connectivity.

**Mitigation:** Locks must have a mandatory timeout. Lock timeout is configurable per document type. Timed-out locks are released automatically and logged in the audit trail.

**Verdict:** Accept — with mandatory lock timeout as a non-negotiable constraint.

---

### A7. No Parallel Workflow Steps in Phase 1

**Assessment:** Reasonable simplification. Parallel steps (e.g., document simultaneously with two committees) are architecturally complex and not required for Phase 1.

**If false:** Discovery reveals that at least one critical document type requires parallel review (e.g., ordinance referred to two committees simultaneously).

**Mitigation:** Design the workflow engine state machine to support a `parallel_split` step type in the data model — even if no UI or executor is built for it in Phase 1. Reserve the step type; do not fill it with a conflicting implementation.

**Verdict:** Accept the simplification — with the data model reserving the parallel step type for Phase 2.

---

### A8. Meilisearch Is Sufficient for the Document Search Scale

**Assessment:** Reasonable for Phase 1. For 50,000 migrated documents plus OCR text, Meilisearch performance at that document volume needs validation. `[Unverified]`

**If false:** Search becomes slow after migration; user experience degrades.

**Mitigation:** Meilisearch is not introduced until Phase 2. Phase 1 uses PostgreSQL full-text search (`tsvector`). Index rebuilding from PostgreSQL is always supported, giving a clean migration path to Meilisearch or OpenSearch.

**Verdict:** Accept — but do not introduce Meilisearch in Phase 1. PostgreSQL FTS is sufficient and reduces operational complexity.

---

### A9. Workflow Instances Always Pin to Definition Version at Creation

**Assessment:** This must not be treated as an assumption — it must be an enforced architectural invariant. Any ambiguity here will produce data integrity failures on the first workflow definition update.

**If false (not enforced):** An admin updates a workflow definition; all in-flight instances silently continue under the new definition; steps completed under the old definition no longer map to valid steps; audit trail becomes incoherent.

**Mitigation:** The `workflow_instances` table has a `definition_version_id` column (UUID, not integer version). All step resolution, transition evaluation, and SLA calculation use the pinned definition version, never the current active version. This must be enforced in the database schema, not just application logic.

**Verdict:** Enforce as an invariant — not an assumption.

---

### A10. The LGU Will Maintain the System Internally After Handover

**Assessment:** Stated as resolved. But "internal IT team takes over" is optimistic if the IT team has no experience with containerized PostgreSQL, Fastify, or TypeScript.

**If false:** The system becomes unmaintainable after handover; bugs accumulate; the system is abandoned within 3 years.

**Mitigation:** Architecture Decision Records are mandatory. Every non-obvious design choice is documented. Runbooks for all operational procedures. Knowledge transfer sessions before handover. Source code escrow with the LGU from day one (not at contract end).

**Verdict:** Validate Immediately — confirm the IT team's capability before finalizing the technology selection.

---

## 3. The "Configurable Everything" Challenge

Configurability has a cost: it adds complexity, creates misconfiguration risk, and can allow legal violations through administrative action. The following matrix distinguishes what should and should not be configurable.

---

### Workflow Engine

**Configurable:** Step definitions (name, type, assignee rule, SLA threshold, notification trigger, transition conditions). Document type–to–workflow association. Escalation targets.

**Standardized:** The execution model (step is assigned → actor acts → event emitted → next step resolved). The event schema. The SLA calculation method (working days, not calendar days, for ARTA compliance).

**Hardcoded:**

- Workflow instance pins to definition version at creation. Not a setting.
- Completed and cancelled instances are immutable. Not a setting.
- Every step action writes an audit event. Cannot be disabled.
- A workflow definition cannot be published if it has no terminal step.

**Prohibited:**

- Configuring a workflow that skips legally required steps for a given document type. SP Ordinances must have at minimum: committee referral, 3 readings, vote, VP certification. These are validation constraints on the workflow editor, not default values.
- Configuring a workflow step with no assignee resolution rule.
- Publishing a workflow definition without at least one reviewer approval.

---

### Document Lifecycle

**Configurable:** Which status labels exist for a document type. Which metadata fields are required at each lifecycle stage. Which classification level is the default for a document type.

**Standardized:** The core lifecycle event types: Created, Submitted, In-Workflow, Completed, Released, Archived, Disposed. These are the canonical states used in reporting and audit queries regardless of document type.

**Hardcoded:**

- No document may be permanently deleted by any user or role. Only authorized disposition via the Records Management module is permitted, and disposition creates an audit record not a data deletion.
- Every document must have a document type, an owning office, and a classification level. These are non-nullable schema constraints, not validation rules.

**Prohibited:**

- Configuring a document type with no retention schedule. Every document type must map to a retention schedule before activation.
- Setting the classification level of a document to Public for a type that the Records Officer has marked as Restricted.

---

### Numbering Systems

**Configurable:** Prefix format (e.g., `RES`, `ORD`, `EO`). Year inclusion and position. Starting sequence number. Reset policy (yearly vs. continuous). Series authority office.

**Standardized:** The assignment event (number is assigned at a specific named lifecycle stage, not at document creation). The gap audit mechanism (cancellations log a gap record with reason, not just mark the number unused).

**Hardcoded:**

- Number uniqueness within series + year is enforced by a database unique constraint. Not an application-level check.
- Numbers are never reused, even if the document is cancelled.
- Number assignment creates an immutable audit record.

**Prohibited:**

- Manual editing of an assigned number by any user or role.
- Assigning a number before the configured lifecycle event for that series.
- Configuring a series with zero leading digits (numbers must have a consistent width for correct lexicographic sorting in official records).

---

### Approval Matrices

**Configurable:** Who approves what (by role, office, or specific user). How many approvers are required. Approval thresholds (e.g., above a monetary threshold, Mayor signature is required). Delegated approver rules.

**Standardized:** Approval actions: Approve, Reject, Return for Revision, Escalate. The approval record schema: actor, timestamp, action, comment, document version at time of action.

**Hardcoded:**

- Every approval action creates an immutable audit record. Not a feature that can be turned off per document type.
- An approver cannot approve a document they authored (separation of duties). This is a workflow engine constraint, not a setting.

**Prohibited:**

- Configuring an approval step with no required role or user (open approvals are a compliance violation).
- Configuring a document type where the same user can be both encoder and final approver.

---

### Security Policies

**Configurable:** Session timeout duration (within a defined range: minimum 5 minutes, maximum 60 minutes for standard users). Password complexity requirements (within minimums). Which roles are authorized to access which classification levels.

**Standardized:** Token format (JWT with defined claims). Refresh token storage (server-side database table, not client-side). Cookie attributes (HTTP-only, Secure, SameSite=Strict).

**Hardcoded:**

- Audit log is append-only. This is enforced at the PostgreSQL role permission level (INSERT only, no UPDATE or DELETE). Not a setting.
- IT admin role cannot read confidential or restricted documents. This is an ABAC policy enforced at the data layer, not configurable by the IT admin themselves.
- Tokens are never stored in localStorage or sessionStorage. This is enforced by the frontend framework — there is no configuration option to do otherwise.
- MFA architecture must be present in the auth flow even if TOTP is not yet enabled.

**Prohibited:**

- A single role that combines IT administrative access with document content access.
- Configuring the session timeout to zero (infinite session) for any human user role.
- Disabling audit logging for any user, role, or document type.

---

### Retention Schedules

**Configurable:** Retention period per document type. Archival review trigger (e.g., 80% of retention period elapsed). Retention category (permanent, long-term, finite).

**Standardized:** Retention lifecycle states: Active, Inactive, Archived, Disposition-Pending, Disposed.

**Hardcoded:**

- Retention cannot be shortened for a document under a legal hold.
- Disposition requires an authorized Records Officer action with a mandatory comment. No automated disposal without explicit human authorization.
- Disposed records are marked as disposed with actor and timestamp — the metadata row is never deleted.

**Prohibited:**

- Configuring zero retention (instant disposal). Every document type must have a minimum retention period.
- Disposition without the legal hold check passing.

---

### Audit Controls

**Configurable:** Which additional domain events (beyond mandatory ones) generate audit entries. Audit log retention period (separate from document retention).

**Hardcoded:**

- These events always generate audit entries regardless of configuration: authentication (success and failure), document state changes, approval actions, delegation grants and revocations, role assignments and revocations, bulk operations, exports, session termination.
- Hash-chaining algorithm (SHA-256). Not configurable.
- External timestamp export schedule (monthly minimum).

**Prohibited:**

- Disabling audit entries for any of the mandatory event types.
- Granting any application user UPDATE or DELETE permission on the audit schema.

---

### Access Control

**Configurable:** Role definitions and their permission sets. Office-scoped access rules. Which roles can view which classification levels.

**Standardized:** The ABAC evaluation model (policy is evaluated at request time for every protected resource). The permission inheritance model (role permissions are additive; no negative permissions).

**Hardcoded:**

- A user cannot access documents classified above their maximum authorized level, regardless of role configuration.
- The public portal never exposes Internal, Confidential, or Restricted documents, regardless of portal configuration.

**Prohibited:**

- Configuring a role that grants both IT system administration and document content read access.
- Granting public (unauthenticated) access to any document with a classification level above Public.

---

### Public Portal

**Configurable:** Which document types appear on the public portal. Which metadata fields are shown in the public view. Announcement content and scheduling.

**Hardcoded:**

- Classification gate: only documents explicitly classified as Public at the document level are visible on the portal — portal configuration cannot override document-level classification.
- Citizen data isolation: a citizen can only see their own submitted requests and complaints, never another citizen's.

**Prohibited:**

- Making a document with a non-Public classification visible on the portal through any configuration path.

---

## 4. Expensive-to-Reverse Decisions

### D1. Database Architecture: Schema-Per-Module

**Reversibility:** Very Low. Changing would require migrating all data and rewriting all queries.

**Risk:** High.

**Consequences if changed later:** Every module's queries must be rewritten; foreign key constraints re-examined; inter-module data access redesigned.

**Default:** PostgreSQL schema-per-module. Commit permanently. Enforce with automated tests on every PR.

---

### D2. Primary Key Strategy: UUID v4 Everywhere

**Reversibility:** Very Low. Sequential integer PKs and UUID PKs cannot be mixed without migration.

**Risk:** High.

**Consequences if changed:** All foreign keys must be migrated; existing URL/reference schemes break.

**Default:** UUID v4 (`gen_random_uuid()`) as the primary key for every table in every schema. No exceptions. No sequential integer IDs on any entity exposed externally.

---

### D3. Soft-Delete Pattern on All Entities

**Reversibility:** Very Low. Retrofitting soft-delete to tables that used hard-delete destroys historical data that cannot be recovered.

**Risk:** Very High for government records.

**Consequences if changed:** Deleted records are unrecoverable; audit trail has gaps; COA audit fails.

**Default:** Every table has `deleted_at TIMESTAMPTZ` and `deleted_by UUID`. The application enforces soft-delete in the repository layer. Hard-delete is not exposed in any application code path.

---

### D4. Audit Log as Append-Only, Hash-Chained Schema

**Reversibility:** Very Low. Changing the audit log schema means historical records do not validate against the new format. The chain breaks at the migration boundary.

**Risk:** High.

**Consequences if changed:** Historical tamper-detection becomes unreliable at the boundary of the schema change.

**Default:** Commit to the hash-chained, INSERT-only audit schema from the first migration. Never migrate the audit table schema. If new fields are needed, add them as nullable columns only — existing rows must remain valid.

---

### D5. Workflow Engine: Custom Domain-Specific vs. Third-Party BPMN

**Reversibility:** Very Low. Replacing a workflow engine means migrating all in-flight instances, all definition data, and all historical execution records. At production scale with active government documents, this is effectively impossible.

**Risk:** Very High. This is the single highest-stakes architectural decision in the entire project.

**Consequences if chosen wrong:**

- If custom engine is too limited: Phase 2+ workflows cannot be modeled without engine redesign.
- If third-party BPMN engine is adopted: steep learning curve, complex operational requirements, and likely lock-in to vendor-specific formats.

**Default:** Custom domain-specific engine. Commit. The engine's step types and transition model must be designed for extensibility from the start. Reserve the `parallel_split` and `parallel_join` step types even if Phase 1 does not implement executors for them.

---

### D6. File Storage Strategy: S3-Compatible API, UUID Keys

**Reversibility:** Very Low. Moving 50,000+ documents to a different storage model or key scheme requires touching every file reference in the database.

**Risk:** Very High.

**Consequences if changed:** Every `attachment` record must be updated; every stored file must be re-keyed; any cached URL or QR code becomes invalid.

**Default:** S3-compatible API only. No provider-specific SDK calls anywhere in the codebase. Every stored file is keyed by UUID. Original filenames are stored only as metadata in PostgreSQL. This must be enforced by code review policy.

---

### D7. Identity Architecture: JWT + Server-Side Refresh Token Registry

**Reversibility:** Low. Changing the authentication model requires all clients (web, mobile, offline cache) to update their token handling simultaneously.

**Risk:** High.

**Consequences if changed:** All active sessions must be invalidated; all clients must update; forced logout event for all users.

**Default:** JWT access tokens (15-minute expiry), stored in HTTP-only Secure SameSite=Strict cookies. Refresh tokens stored as hashed values in a database table (never in the token itself). Server-side invalidation is always possible by deleting the refresh token row.

---

### D8. Authorization Architecture: ABAC with RBAC Entry Point

**Reversibility:** Low. Changing the authorization model requires touching every permission check in the codebase.

**Risk:** High.

**Consequences if changed:** All permission checks must be rewritten. Existing role assignments may not map to the new model.

**Default:** ABAC policy evaluation engine. RBAC is implemented as the default policy (role membership grants permissions). Office-scoped and document-classification policies are ABAC rules evaluated alongside role checks. The ABAC engine is the boundary — not the role table.

---

### D9. Tenant Isolation: Add city_id to Core Entity Tables

**Reversibility:** Very Low. Retrofitting multi-tenancy means adding a column to every table, updating every query, and migrating every row — at production scale.

**Risk:** Medium (conditional on whether multi-LGU expansion is ever a real goal).

**Default:** Add a `city_id UUID NOT NULL` column to all core entity tables (`documents`, `workflow_instances`, `users`, `offices`, etc.) from the first migration. Default the value to the Batac City UUID for all rows. This costs one column width of storage and zero application complexity, but preserves the multi-tenancy migration path indefinitely.

---

### D10. Timestamp Convention: TIMESTAMPTZ Everywhere

**Reversibility:** Low. Mixing timestamp-with-timezone and timestamp-without-timezone columns produces subtle bugs in SLA calculations, audit trail ordering, and reporting across timezone boundaries.

**Risk:** Medium (Batac City is in PST UTC+8, but the server may be in a different timezone).

**Default:** Every timestamp column is `TIMESTAMPTZ`. All application code stores UTC, displays in the user's configured timezone. No exceptions. This is enforced by linting the migration files.

---

### D11. Numbering Assignment Event: At Approval, Not at Creation

**Reversibility:** Medium — can be changed before go-live by migrating the numbering tables, but impossible to change after real documents have been issued.

**Risk:** Very High once the first real document is numbered.

**Consequences if changed after go-live:** Official government document numbering is disrupted; corrections require manual intervention on official records.

**Default:** Numbers are assigned at the defined lifecycle stage for each series (typically the approval or certification step). Draft documents never hold a number. This must be committed before the first SP Secretary uses the system.

---

## 5. Stakeholder Coverage Analysis

### SP Secretary

**Decisions dependent:** SP Resolution and Ordinance workflow steps, numbering series authority, session agenda compilation process, committee assignment mechanism, document release workflow.

**Risks of not consulting:** Phase 1 prototype models the wrong process. Discovery reveals this at the walkthrough scheduled next week.

**Latest phase:** Before Phase 1 Development. Walkthrough must happen before workflow engine step definitions are coded.

---

### Records Officer

**Decisions dependent:** Document lifecycle after workflow completion, retention schedules, classification levels, archive workflow, physical-to-digital correspondence handling.

**Risks of not consulting:** Records Management module designed incorrectly; compliance failures.

**Latest phase:** Before Phase 1 Development. Records Officer is already scheduled for next week's walkthrough.

---

### Vice Mayor / SP Presiding Officer

**Decisions dependent:** Certification step in SP workflows, session management workflow, Vice Mayor's role in the veto override workflow.

**Risks of not consulting:** SP workflow reaches the certification step with no designed action for the Vice Mayor; Phase 1 demo fails.

**Latest phase:** Before Phase 1 Deployment.

---

### City IT Office

**Decisions dependent:** Network topology, device inventory, existing system inventory, maintenance capability after handover, infrastructure readiness.

**Risks of not consulting:** System deployed on infrastructure that cannot support it; no one capable of maintaining it after handover.

**Latest phase:** Before Phase 1 Development — specifically, IT capability must be assessed before tech stack is finalized.

---

### City Legal Office

**Decisions dependent:** Legal basis for digital records, formal delegation policy (is it an ordinance or an EO?), legal requirements for document types, DPA compliance oversight.

**Risks of not consulting:** System lacks formal legal basis; documents challenged legally; DPA compliance has no legal owner.

**Latest phase:** Before Phase 1 Deployment.

---

### Budget Office, Accounting Office, BAC Secretariat

**Decisions dependent:** Procurement workflow step design, budget certification timing, COA pre-audit requirements, approval thresholds.

**Risks of not consulting:** Procurement module (Phase 2) is built incorrectly and is COA non-compliant.

**Latest phase:** Before Phase 2 Development.

---

### Department Heads (3–4 representative departments)

**Decisions dependent:** Inter-department routing rules, document categorization for their office, what dashboards they actually need, approval authority thresholds.

**Risks of not consulting:** Low system adoption by departments; system doesn't match actual inter-department practice.

**Latest phase:** Before Phase 1 Deployment.

---

### Barangay Officials (2–3 representative barangays)

**Decisions dependent:** Barangay submission workflow, device and connectivity profile, offline capability requirements, barangay document types.

**Risks of not consulting:** Barangay access module (Phase 3) designed for wrong device types or connectivity assumptions.

**Latest phase:** Before Phase 2 Development (before barangay access).

---

### Data Protection Officer

**Decisions dependent:** All PII handling policies, citizen portal data collection, consent tracking, breach response, erasure request procedures.

**Risks of not consulting:** RA 10173 non-compliance; fine and reputational liability.

**Latest phase:** Before Production Rollout (before citizen PII enters the production system).

---

### COA Representative

**Decisions dependent:** Physical records retention requirements, digital records acceptance conditions, audit trail format requirements, financial document controls.

**Risks of not consulting:** System is non-compliant with COA audit requirements; records are invalidated during COA audit.

**Latest phase:** Before Production Rollout.

---

### Citizens (Focus Group)

**Decisions dependent:** Portal UX, complaint workflow usability, language preferences (Filipino/English/Ilocano), trust factors.

**Risks of not consulting:** Portal is unused; citizens don't trust or understand it.

**Latest phase:** Before Public Portal Launch.

---

## 6. Governance and Compliance Gap Analysis

### RA 10173 — Data Privacy Act

|Gap|Status|Default|Required By|
|---|---|---|---|
|DPO designation|Not confirmed|Assign responsibility to City Legal or Administrator|Production Rollout|
|Privacy Impact Assessment|Not done|Defer formal PIA to Phase 2; implement privacy-by-design in Phase 1|Production Rollout|
|Privacy Notice at data collection point|Not designed|Required on citizen registration and complaint forms|Public Portal Launch|
|Consent tracking for citizen data|Not designed|Consent flag per citizen account with timestamp and version|Public Portal Launch|
|Data subject access request procedure|Not designed|Admin workflow for DPA access requests|Production Rollout|
|Data subject erasure request procedure|Partially designed|Legal review workflow exists; PII-only erasure implemented|Production Rollout|
|Breach notification procedure|Not designed|Define: detect → assess (72h deadline) → notify NPC → notify affected|Production Rollout|
|Data sharing agreements|Not designed|Required before any External Integration|External Integrations|

**Critical unresolved contradiction:** The erasure request procedure allows PII-only erasure from metadata fields. However, for citizen complaints, the PII (name, address, complaint details) is embedded in the document text and the attached scanned file — not only in metadata. Erasing the metadata record while retaining the document file means the PII still exists in the file. The erasure procedure must address file-level PII, which may require redaction of the file content itself — not just deletion of metadata fields.

### Records Management

|Gap|Status|Default|Required By|
|---|---|---|---|
|Specific retention periods per document type|Educated defaults only|Use documented defaults; flag for COA/LGU confirmation|Production Rollout|
|National Archives Act (RA 10095) applicability|`[Unverified]`|Assume applicable; consult National Archives of Philippines|Production Rollout|
|DILG records management circulars|Not reviewed|Consult DILG regional office|Production Rollout|
|Records disposition authority (who can authorize)|Not defined|Records Officer + Department Head + Legal sign-off|Phase 1 Deployment|
|Physical custody tracking after digitization|Not fully designed|Physical custody field in TrackingRecord; Records Officer updates on transfer|Phase 1 Deployment|

### Audit Trail

|Gap|Status|Default|Required By|
|---|---|---|---|
|External timestamp authority (RFC 3161 TSA provider)|Not selected|Research: DigiCert, GlobalSign, or Philippine e-gov authority|Phase 1 Deployment|
|Database activity monitoring for IT admin actions|Not designed|Optional Phase 2; document risk acceptance for Phase 1|Phase 2|
|Security incident log retention period|Not specified|2 years minimum `[Inference]`; confirm with COA|Phase 1 Deployment|

### Electronic Signatures

|Gap|Status|Default|Required By|
|---|---|---|---|
|RA 8792 Electronic Commerce Act analysis|Not done|Physical original = legal truth accepts this gap|Production Rollout|
|PKI roadmap (when and how)|Placeholder only|Document placeholder in ADR; no implementation date|Phase 3+|
|Formal LGU non-repudiation acceptance document|Not yet signed|Hard gate for Phase 1 Deployment|Phase 1 Deployment|

---

## 7. Identity and Access Management Review

### Organizational Structure in IAM

**Gap:** Batac City's official org chart has not been confirmed for IAM design. **Default:** Configurable. Office hierarchy is admin-managed, not hardcoded. **Urgency:** Before Phase 1 Deployment.

### Separation of Duties

**Gap:** The design does not explicitly prohibit the same user from being both encoder and final approver on the same document. **Default:** Enforce as a workflow engine constraint: the user who submitted a document to a workflow cannot be the final approval actor on that same document. This is a hardcoded invariant, not a configurable rule. **Urgency:** Before Phase 1 Development — must be in the workflow engine design.

**Gap:** Whether an SP Secretary can also hold the Platform Administrator role is not restricted. **Default:** Restrict. The Platform Administrator role should be held by IT staff, not operational users. An operational user with Platform Administrator access can modify the workflow that processes their own documents. This is a conflict of interest. Enforce at the role assignment level: document that Platform Administrator cannot be combined with any document-processing role (Encoder, Approver, SP Secretary). **Urgency:** Before Phase 1 Development.

### Vendor and Contractor Access

**Gap:** Not designed. **Default:** Contractor accounts are disabled by default. Enabled only through an approved, role-based, time-limited (maximum 30-day) account with full audit logging. Contractor accounts cannot access classified or confidential documents. All contractor activity is logged separately. **Urgency:** Before Phase 1 Deployment.

### Emergency Break-Glass Access

**Gap:** Not designed. **Default:** Define a break-glass procedure: emergency admin account credentials stored in a physical sealed envelope in the LGU IT Office safe. Opening the envelope is logged (physical log + digital alert). The account is audited in full on next working day and deactivated after use. **Urgency:** Before Phase 1 Deployment.

### User Lifecycle Management

**Gap:** Employee departure and election-cycle bulk reassignment procedures are not designed. **Default:**

- Employee departure: Department Head or HR initiates termination request → IT Office deactivates account → all active workflow step assignments are automatically reassigned to the office queue for manual reassignment by the Department Head.
- Election-cycle (2028): Platform Administrator bulk-deactivation of outgoing official accounts + bulk role reassignment for incoming officials. This must be a specific admin workflow, not a manual procedure. **Urgency:** Bulk reassignment is a feature that must be designed before Phase 1 Deployment (since the next election is 2028 and requires forward planning).

### Shared Workstation Session Policy

**Gap:** The one-active-session-per-user policy combined with shared workstations means a user who forgets to log out locks out their colleague from the same workstation until the 30-minute timeout. **Default:** Shared workstations must have a visible "Switch User / Lock Screen" action that does not terminate the previous session but suspends it, allowing the next user to log in on the same device. This is a UX feature, not just a policy decision. **Urgency:** Before Phase 1 Deployment.

---

## 8. Workflow and Business Process Review

### Workflows Without Any Design

|Workflow|Priority|Notes|
|---|---|---|
|Committee Report submission|Phase 1|Required for SP Resolution workflow; how does committee chair attach report to parent document?|
|Session Agenda compilation|Phase 1|Is this a workflow or a planning feature? Who adds items? Who approves the agenda?|
|SP Session Minutes creation|Phase 1|Who creates, who reviews, who certifies? Separate workflow or sub-document of session?|
|SP Veto Override|Phase 1 (Ordinance)|If Mayor vetoes, SP must have a defined workflow to re-vote|
|Mayor 10-Day Lapse Rule|Phase 1 (Ordinance)|Automated SLA timer; transition to "Lapsed into Law" state|
|Executive Order|Phase 2|Draft → Legal Review → Mayor Sign → Release|
|Memorandum Circular|Phase 2|Mayor to all departments; routing for acknowledgment only|
|Administrative Complaint|Phase 2|Complaint against employee; different from citizen complaint|
|Inspection Report|Phase 2|Engineering or health inspection result; who reviews and acts?|
|Liga ng mga Barangay Resolution|Phase 3|Different from individual barangay resolution|
|Citizen Complaint (full)|Phase 3|What happens after investigation? Who notifies complainant?|
|Leave Application|Phase 2|Employee → Supervisor → Department Head → HRMO|

### Undefined Exception Handling

These scenarios will occur in real use and need defined system behavior:

- A Councilor assigned to vote is absent during session. → **Default:** SP Presiding Officer records absence. Vote proceeds if quorum met. Absent Councilor's workflow step is marked "Abstained — Absent."
    
- A committee does not submit its report by the SLA deadline. → **Default:** Escalation to SP Secretary at 80% of SLA. At 100%, SP Secretary receives an overdue alert and may recall the document from committee or escalate to the Presiding Officer.
    
- Mayor does not act within 10 days on an ordinance. → **Default:** System transitions the document to "Lapsed into Law" and notifies SP Secretary. This is not a rejection — it has the same legal effect as approval. `[Inference based on RA 7160]`
    
- A document is routed to the wrong workflow type (e.g., a resolution submitted under the ordinance workflow). → **Default:** Only the SP Secretary (or Platform Administrator) may change the document type and associated workflow of a document in the `Draft` or `Submitted` state. The action is audit-logged. Documents in active workflow cannot have their type changed.
    
- A workflow step assignee account is deactivated mid-workflow. → **Default:** The step is automatically reassigned to the assignee's office queue. The Department Head or office manager is notified. The workflow SLA clock does not pause.
    
- A workflow definition is deprecated while instances are running under it. → **Default:** All in-flight instances continue under the pinned definition version. The Platform Administrator can view all in-flight instances under a deprecated definition. Option B (manual migration) requires a second-level approval from the City Administrator and creates a dedicated audit event recording the migration reason and actor.
    

### Undefined Cancellation Rules

- Who can cancel an in-flight workflow? → Document originator + SP Secretary for SP documents; Department Head for departmental documents; Mayor for any document.
- Does cancellation require a reason? → Yes. Reason is mandatory and is logged in the audit trail.
- Can a cancelled workflow be re-initiated? → Yes, as a new workflow instance on the same document, after a supervisor review step.
- Is the cancelled status permanent? → Yes. A cancelled instance never transitions to another status. A new instance is created instead.

---

## 9. Data Migration and Legacy Records

### Volume Estimate

Approximately 50,000 documents. This is not trivial.

|Factor|Estimate|Notes|
|---|---|---|
|Average file size|2–5 MB|Scanned PDFs; varies significantly|
|Total storage|100–250 GB|For files only; does not include database|
|OCR compute time|`[Speculation]` 50–200 hours|Depends on OCR engine and hardware|
|Metadata enrichment|Manual for legacy records|No structured metadata on most paper records|

### Architecture Implications

- Migration is a separate admin tool, not part of the main application. This prevents migration logic from contaminating the production document creation workflow.
- The migration tool must support: batch file ingestion, duplicate detection (same document scanned multiple times), OCR extraction to a separate `document_extracted_text` table, metadata mapping from filename conventions (if any), manual metadata entry for records with no metadata, and resumable processing (50,000 documents cannot be imported in a single run).
- Migration happens after Phase 1 deployment, but the database schema must support migration-origin documents from the start. Add `migration_source`, `migration_batch_id`, and `imported_at` to the `documents` table.

### Risk

The condition of historical records is unknown. Assume: significant inconsistency in metadata, duplicate scans, missing classification, broken numbering sequences, and documents without owning office attribution. The migration tool must support quality review dashboards and manual correction workflows, not just batch import.

---

## 10. Integration Readiness Analysis

|Integration|Likelihood|Phase|Abstraction Strategy|
|---|---|---|---|
|Budget system (internal)|High|Phase 2+|`BudgetCertification` event type; budget module stub with manual entry in Phase 1; API adapter in Phase 2|
|Accounting system|High|Phase 2+|`AccountingReview` event type; manual in Phase 1; adapter in Phase 2|
|Treasury / Revenue system|Medium|Phase 2+|Same pattern|
|HRMO / Payroll|Medium|Phase 2+|Employee master data import; payroll integration deferred|
|Email (SMTP outbound)|High|Phase 2|Abstract `NotificationChannel` interface; SMTP adapter in Phase 2|
|SMS gateway|High|Phase 3|Same `NotificationChannel` interface; SMS adapter in Phase 3|
|PhilSys (citizen identity)|Low|Phase 5|Feature flag in citizen verification flow|
|DICT e-Gov Portal|`[Speculation]`|Phase 5|Not planned; reserve API gateway for future|
|COA eNGAS|`[Unverified]`|Defer|May not apply to LGUs; check with COA|

**Integration Hub bounded context** (Phase 5): All integrations are mediated through an Integration Hub module with: outbound event publishers, inbound webhook receivers, file-based import/export pipelines, and scheduled sync services. No integration ever accesses module databases directly. All integration activity is logged in the audit trail.

---

## 11. Non-Functional Requirements

### Performance

|Requirement|Target|Status|
|---|---|---|
|Page load (P95)|< 2 seconds|Not specified — define now|
|Search response|< 500ms for typical query|Not specified|
|Document upload (single file)|< 30 seconds for ≤ 25MB file|Not specified|
|Concurrent authenticated users|1,000 peak|Not specified — use this as design target|
|Max file size per upload|25MB per file|Not specified — define now|
|API response (P99)|< 5 seconds|Not specified|

### Accessibility

Not mentioned anywhere in the resolved decisions or architecture. WCAG 2.1 AA compliance is standard for government web applications. `[Inference]` Minimum requirements:

- Keyboard navigability for all interactive elements
- Screen reader compatibility (ARIA labels on all form controls)
- Minimum 4.5:1 contrast ratio for text
- Text scaling to 200% without horizontal scroll on standard viewport

**Classification:** Before Public Portal Launch at minimum. Preferably from Phase 1.

### Monitoring and Observability

Not designed. Required before Phase 1 Deployment:

- Application error tracking (e.g., Sentry or self-hosted Glitchtip)
- Structured application logs with correlation IDs (request_id propagated through all layers)
- Health check endpoint (`/health` returning database, storage, and queue status)
- Database connection pool metrics
- Alerting on: error rate spike, SLA breach volume above threshold, backup job failure, failed login rate spike, disk usage approaching limit

### Storage Growth

- 50,000 migrated documents: 100–250GB (estimated)
- Ongoing growth: `[Estimation]` ~5,000 new documents/year × 2–5MB average = 10–25GB/year
- Plan for 1TB total storage capacity with monitoring at 70% utilization

---

## 12. Failure and Recovery Analysis

### Ransomware

**Gap:** Backup credentials are not separated from production credentials. If ransomware compromises the production system and the backup service uses the same credentials, backups are also encrypted.

**Default:**

- Backup storage credentials are held exclusively by the LGU IT Office (not the development team and not the production application).
- At least one cold backup copy is stored in write-once (object lock / immutable) storage that cannot be overwritten or deleted, even with the storage account credentials.
- Production system has no credentials that can write to the backup storage bucket — backup jobs run with separate credentials under a separate IAM user.

**Urgency:** Before Phase 1 Deployment.

---

### Workflow Stuck Instance (Assignee Deactivated)

**Gap:** Not fully designed. If a step assignee account is deactivated and the step is never acted on, the workflow stalls indefinitely.

**Default:**

- Every workflow step has an office assignment in addition to a user assignment. If the user account is deactivated, the step falls back to the office queue.
- Platform Administrator can manually reassign any step in any workflow instance, with audit record of the reassignment reason.

**Urgency:** Before Phase 1 Deployment.

---

### DNS Failover (Automated vs. Manual)

**Gap:** The DR plan defines that the standby is promoted when primary heartbeat is lost for 60 seconds. Whether DNS failover is automated or manual is not specified.

**Default:** Automated DNS failover using the cloud provider's health-check-based routing (e.g., Route 53 health checks or Cloudflare load balancing). Manual failover is documented as a fallback but should not be the primary mechanism, as it requires a human response within 4 hours.

**Urgency:** Before Phase 1 Deployment.

---

### Single-Person DR Knowledge

**Gap:** If only one team member knows the DR procedure, a DR incident that occurs when that person is unavailable fails the RTO.

**Default:** DR runbooks are written, versioned in the repository, and tested by at least two team members. The LGU IT Office has a printed physical copy of the runbook in the server room (for cloud and eventual on-premise).

**Urgency:** Before Phase 1 Deployment.

---

### Backup Restoration Ownership

**Gap:** Who is responsible for performing a backup restoration is not assigned.

**Default:** LGU IT Office owns backup restoration. Development team provides support during the transition period. Quarterly restoration tests are the responsibility of the LGU IT Office from Phase 1 Deployment onward.

**Urgency:** Before Phase 1 Deployment.

---

## 13. Phase 1 Scope Challenge

The following evaluates every proposed Phase 1 deliverable against two criteria: (a) required to prove architectural viability, (b) required to demonstrate business value.

|Deliverable|Required for Architecture|Required for Business Value|Recommendation|
|---|---|---|---|
|IAM module (login, roles, sessions)|Yes|Yes|**Keep — mandatory**|
|Organization master data|Yes|Yes|**Keep — mandatory**|
|Document Core (upload, classify, version, number)|Yes|Yes|**Keep — reduce to SP series only**|
|Workflow Engine (linear + simple branching)|Yes|Yes|**Keep — no parallel steps**|
|Document Tracking (QR, cover sheet, routing)|No|Yes|**Keep — SP Secretary's core need**|
|SP Resolution workflow|No|Yes|**Keep — Phase 1 primary use case**|
|SP Ordinance workflow|No|Partial|**Defer to Phase 1B** — build Resolution first, validate, then Ordinance|
|In-app notifications|No|Yes|**Keep — workflow is unusable without it**|
|Mayor dashboard|No|Yes|**Keep — MVP only: pending signatures + overdue items**|
|SP Secretary dashboard|No|Yes|**Keep — MVP only: queue + pending items**|
|Department Head dashboard|No|Partial|**Defer — basic inbox is sufficient; analytics are Phase 2**|
|Audit log (append-only, hash-chained)|Yes|No|**Keep — mandatory from day one**|
|PostgreSQL with schema isolation|Yes|No|**Keep — mandatory**|
|S3-compatible file storage|Yes|No|**Keep — mandatory**|
|Docker + Terraform IaC|Yes|No|**Keep — mandatory**|
|Automated database backup|Yes|No|**Keep — mandatory**|
|Meilisearch integration|No|No|**Remove from Phase 1 — use PostgreSQL FTS**|
|Records Management module|No|No|**Defer to Phase 2**|
|Full ABAC policy engine|No|No|**Defer — use RBAC + office scoping in Phase 1**|
|Email notifications|No|No|**Defer to Phase 2**|
|MFA (TOTP) implementation|No|No|**Defer — but architecture must support it from day one**|
|Delegation management UI|No|No|**Defer to Phase 2 — design the data model now**|
|ARTA compliance reports|No|No|**Defer to Phase 2 — need Phase 1 data first**|
|Election transition bulk reassignment|No|No|**Defer to Phase 2 — required before 2028**|
|Cover sheet customization|No|Partial|**Reduce to basic cover sheet; customization is Phase 2**|

**Phase 1 Minimum Viable Scope:**

1. IAM (users, roles, RBAC + office scoping, login, session management with lock timeout)
2. Organization (offices, positions, assignments — admin-managed)
3. Document Core (upload, classify, version, document number for SP Resolution series)
4. Workflow Engine (linear + simple branching, admin-configurable, version pinning enforced)
5. SP Resolution workflow end-to-end
6. Document Tracking (QR generation, basic cover sheet, routing history)
7. In-app notifications for step assignments and overdue items
8. SP Secretary dashboard (queue, pending, actions)
9. Mayor dashboard (pending signatures)
10. Audit log (append-only, hash-chained, INSERT-only permissions at DB level)
11. Infrastructure (PostgreSQL, S3-compatible storage, Docker, Terraform, backup)

---

## 14. Contradictions and Inconsistencies

### C1. Non-Repudiation Stated as Important + Scanned Signatures

**Conflict:** The requirement states non-repudiation is important. Scanned signatures provide no cryptographic non-repudiation.

**Resolution:** Explicitly document that the LGU accepts process-level non-repudiation (audit trail of who approved in the system, backed by physical original) in lieu of cryptographic non-repudiation. The signed acceptance document is the formal resolution. Treat this as an open gap until the acceptance is signed.

---

### C2. No Deletion Policy + RA 10173 Erasure of File-Embedded PII

**Conflict:** The erasure procedure allows PII-only erasure from metadata fields. But for citizen complaints, PII is embedded in the document file (scanned letter, complaint form) — not only in metadata.

**Resolution:** The erasure procedure must explicitly address three categories: (a) metadata fields: erasure replaces field values with a placeholder and logs the erasure; (b) document text (DOCX/typed): redaction of PII before the legal hold confirmation; (c) scanned image files: redaction of PII from the image (pixel-level) or replacement of the file with a redacted version. The architecture must support file-level redaction as a distinct operation from metadata erasure. This is currently not designed.

---

### C3. Option A vs. Option B Workflow Migration — Who Decides and Under What Constraints

**Conflict:** Admin can choose Option A (continue under old version) or Option B (manual migration) for each version change without defined constraints.

**Resolution:** Option B (manual migration of in-flight instances) requires: (1) a second-level approval from the City Administrator (not the Platform Administrator who initiates the change), (2) a mandatory migration reason field, (3) a dedicated audit event recording the pre-migration and post-migration state of each affected instance, and (4) a 24-hour review period during which the migration can be reversed before it is committed. Without these constraints, Option B is a backdoor to modify official government documents.

---

### C4. Pessimistic Locking + Offline Mobile Caching

**Conflict:** Pessimistic locking holds a document for the user who opens it. A user who opens a document on mobile and loses connectivity holds the lock indefinitely unless the lock has a timeout.

**Resolution:** Locks have a mandatory configurable timeout (default 15 minutes). On timeout, the lock is released and logged in the audit trail. The user's offline cached action is still submitted on reconnect — the system then checks whether the document is still in the expected state. If not (another user acted during the lock release period), the conflict is flagged for manual review by the SP Secretary or Department Head.

---

### C5. Configurable Workflow + Legally Mandated Minimum Steps

**Conflict:** Admin-configurable workflows can be configured to skip legally required steps (e.g., removing the 3rd reading from an SP Ordinance workflow).

**Resolution:** Implement workflow validation constraints per document type. For document types with legally mandated minimum steps, the workflow editor validates that the required step types are present before allowing the definition to be published. These constraints are hardcoded in the application, not configurable. The SP Ordinance type requires at minimum: three reading steps, a vote step, a certification step, and a release step. Attempting to publish an ordinance workflow without these steps is rejected with a descriptive validation error.

---

### C6. Audit Log "Tamper-Evident" vs. "Tamper-Proof"

**Conflict:** The architecture claims tamper-evident audit logs. But if the DBA has OS-level access to the PostgreSQL server, they can modify files at the filesystem level — bypassing database-level INSERT-only permissions.

**Resolution:** The correct claim is "tamper-evident," not "tamper-proof." The hash chain and external RFC 3161 timestamp make tampering _detectable_ after the fact, but do not _prevent_ tampering by a motivated actor with OS-level server access. This distinction must be explicit in the system documentation and in the LGU's security risk acceptance. Tamper-prevention (not just detection) requires a separate audit database server with independent access controls — this is a Phase 2 hardening measure.

---

### C7. 4-Hour RTO + 4-Person Development Team On-Call Capacity

**Conflict:** The 4-hour RTO requires rapid incident response. The 4-person development team is also building Phase 2. A serious production incident may exceed the team's available response capacity.

**Resolution:** Define a minimum on-call rotation before Phase 1 Deployment: at minimum, one team member on-call at all times during business hours (0800–1800 PST weekdays). Automated monitoring reduces the human response burden. Runbooks enable the LGU IT Office to perform first-response actions before the development team is engaged. If the LGU IT Office cannot perform first response, the RTO target is aspirational, not guaranteed.

---

## 15. Unknown Unknowns

Questions not currently being asked that should be:

**1. National Archives Act of 2017 (RA 10095)** `[Unverified]` Whether this law applies to city LGUs and whether the National Archives of the Philippines has jurisdiction over LGU records needs confirmation. If applicable, records disposition may require National Archives approval, not just internal LGU authorization.

**2. DICT e-Government Standards** `[Unverified]` DICT may have interoperability standards, data format requirements, or security standards for Philippine government digital systems. Not consulted.

**3. System Bypass Risk** Officials may choose to process documents outside the system (WhatsApp, email, physical only) to avoid traceability, reduce workload, or maintain informal authority. This is the most common cause of government digital system abandonment. It is a governance problem, not a technical one. The LGU must establish a formal policy that the system is the official processing channel — without enforcement, adoption is voluntary.

**4. .gov.ph Domain Requirement** `[Unverified]` Government systems may be required to use .gov.ph domains. DICT coordination for .gov.ph is not addressed. An interim domain is needed for Phase 1.

**5. Test Data Management and Sanitization Policy** If real historical documents are used for acceptance testing, PII from those documents is now in the development and test environments. A test data sanitization policy is required before acceptance testing begins.

**6. IT Literacy Baseline of LGU Staff** No baseline assessment of user IT literacy has been conducted. The system's complexity must match its users' actual capability. A system that is technically correct but requires training that staff cannot absorb will not be adopted.

**7. Approval In Absentia / Proxy Voting** Philippine legislative rules generally do not allow proxy voting in formal sessions. `[Inference based on RA 7160]` But informal practices vary. The SP Rules of Procedure for Batac City must be reviewed before the voting step is designed.

**8. Session Minutes as Sub-Documents vs. Standalone Documents** Session Minutes could be a standalone document type with its own workflow, or a sub-document attached to the session record. This is a significant data model decision not yet made.

**9. Source Code Escrow and Handover Requirements** The development contract should specify that source code, database schemas, infrastructure definitions, ADRs, and runbooks are delivered to the LGU — not only at contract end, but as a living handover from Phase 1 forward. This is an organizational risk if not in the contract.

**10. QR Cover Sheet Paper Waste** If every document gets a printed QR cover sheet, paper consumption increases. Government procurement of paper is budget-tracked. This is not a technical problem but it will be raised by the Treasurer or Budget Office if not anticipated.

**11. Historical Session Minutes Migration Boundary** If the system goes live in the middle of a legislative term, do session minutes from before go-live get migrated? If not, the archive is incomplete. If yes, migration of session minutes is more complex than simple PDF imports (each minute must be linked to the correct session record, resolution records, attendee list, etc.).

**12. Post-Retirement Data Access for Former Officials** Can former officials access documents they signed during their term after their term ends? This has legal and privacy implications. No policy exists for this.

**13. What Happens to In-Flight Documents at End of Administration (2028)** When a new Mayor takes office, documents that were in-flight under the previous Mayor's workflow (e.g., a Purchase Request awaiting the Mayor's signature) must either: (a) be automatically rejected and re-submitted to the new Mayor, (b) continue under the old delegation rules until manually cancelled, or (c) be automatically reassigned to the incoming Mayor. No policy exists for this scenario.

---

## 16. Executive Summary

### Top 10 Highest-Risk Unresolved Items

|#|Item|Why Critical|
|---|---|---|
|1|SP Secretary / Records Officer walkthrough (next week)|Entire Phase 1 scope built on assumptions; walkthrough may invalidate core workflow model|
|2|Pessimistic lock timeout for offline/mobile conflict|Without lock timeout, documents become inaccessible when a mobile user loses connectivity|
|3|Workflow validation constraints for legally mandated steps|Without these, admin misconfiguration can produce an SP Ordinance without 3 readings — a legal violation|
|4|Scanned signature non-repudiation acceptance (signed, in writing)|Hard gate for Phase 1 Deployment; must not deploy without it|
|5|COA acceptance of digital records|Affects entire records management model; cannot design retention correctly without this|
|6|DPO designation and Privacy Impact Assessment|Legal requirement before citizen PII enters production|
|7|Ransomware resilience: backup credential separation and immutable storage|If production credentials can reach backup storage, ransomware destroys both|
|8|Document numbering assignment event timing|The first number issued defines the pattern forever; cannot change retroactively|
|9|System bypass risk (governance, not technical)|The most common cause of government system abandonment is informal workarounds|
|10|Election-cycle transition procedure (2028)|2028 is within the 10-year horizon; must be a Phase 2 feature, not an afterthought|

---

### Top 10 Items That Can Safely Be Deferred

|#|Item|Why Safe to Defer|
|---|---|---|
|1|Meilisearch integration|PostgreSQL `tsvector` full-text search is sufficient for Phase 1 volume|
|2|Full ABAC policy engine|RBAC + office-scoped access covers all Phase 1 use cases|
|3|Records Management module|No documents will be ready for archiving until Phase 1 workflows have run for months|
|4|Email notification channel|In-app notifications are sufficient for Phase 1; email is Phase 2|
|5|MFA implementation (TOTP)|Architecture must support it; implementation can wait for Phase 2|
|6|Citizen portal|No citizen-facing features in Phase 1|
|7|SMS gateway integration|Phase 3|
|8|Barangay offline PWA|Phase 3; barangay access not in Phase 1|
|9|OCR for document content search|Phase 4; depends on migration|
|10|Electronic signature PKI|Phase 3+ with formal LGU decision and budget|

---

### Top 10 Architectural Decisions to Protect Now

|#|Decision|Why It Must Be Protected|
|---|---|---|
|1|Schema-per-module isolation (no cross-schema foreign keys)|Cannot be retrofitted; module boundaries collapse silently if violated|
|2|Soft-delete everywhere (no hard deletes in any table)|Deleted government records are irrecoverable; COA audit fails|
|3|Audit log INSERT-only at PostgreSQL role level|Must be in the first migration; cannot add after production use begins|
|4|Workflow instance pins to definition version at creation (DB enforced)|Not enforcing this produces data integrity failures on first workflow update|
|5|S3-compatible API only, UUID file keys (no original filenames as keys)|Cannot migrate 50,000 files to new key scheme after production|
|6|UUID v4 primary keys everywhere|Cannot mix with integer PKs without full migration|
|7|TIMESTAMPTZ for all timestamps|Timezone bugs in SLA calculations and audit ordering are silent and pervasive|
|8|city_id column in all core entity tables|Retrofitting multi-tenancy is a full rewrite|
|9|Numbering assigned at defined lifecycle event (not at creation)|First official document issued sets the pattern permanently|
|10|Separation of IT admin role from document content access (DB-enforced)|Cannot add data separation after documents are in production|

---

### Phase 1 Priorities (Prototype)

1. Complete SP Secretary and Records Officer walkthrough — validate workflow model
2. IAM module (users, roles, RBAC + office scoping, sessions with lock timeout)
3. Organization module (offices, positions, assignments)
4. Document Core (upload, version, classify, metadata, SP numbering series)
5. Workflow Engine (linear + simple branching, version pinning, validation constraints)
6. SP Resolution workflow end-to-end
7. Document Tracking (QR generation, basic cover sheet, routing history)
8. In-app notifications (step assignment, overdue alert)
9. SP Secretary and Mayor dashboards (MVP inbox views)
10. Audit log (append-only, hash-chained, INSERT-only DB permissions)
11. Infrastructure (Docker, Terraform, PostgreSQL, S3-compatible storage, backup, monitoring)

### Phase 2 Priorities

1. SP Ordinance workflow (including veto + lapse-into-law handling)
2. MFA implementation (TOTP)
3. Delegation management (UI + expiration enforcement)
4. Meilisearch full-text search integration
5. Records Management module (retention schedules, archiving)
6. Email notification channel
7. ARTA SLA compliance reports
8. Department workflows (Travel Order, Leave Application, Memorandum)
9. Election-cycle bulk reassignment feature
10. Audit log hardening (separate audit DB server)

### Phase 3 Priorities

1. Citizen portal (request submission, status lookup, complaint submission)
2. Barangay official access (offline-capable)
3. SMS notification gateway
4. DPA compliance features (consent tracking, erasure workflow, breach notification)
5. Executive Order and Memorandum Circular workflows
6. Procurement workflows (Purchase Request, Purchase Order)

---

_End of Document. This document covers the state as of the pre-Phase-1 architecture review. Items marked for Phase 1 Development must be resolved before coding starts. Items marked for Phase 1 Deployment must be resolved before any real LGU data enters production._