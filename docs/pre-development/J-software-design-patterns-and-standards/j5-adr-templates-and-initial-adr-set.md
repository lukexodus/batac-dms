# Batac City LGU Platform — ADR Templates and Initial ADR Set

**Status:** Pre-Development Baseline **Project Phase:** Pre-Development — Iteration 3 (Post-Interview 2 + Developer Decisions Resolved) **Last Updated:** June 2026 **Audience:** Development team; LGU IT Office (post-delivery reference)

---

## What Is an ADR?

An Architecture Decision Record (ADR) documents a significant architecture or design decision together with its context and consequences. The format is intentional: future developers and maintainers need to understand not just what was decided but why — so they do not inadvertently reverse a decision without understanding what it would cost.

ADRs are written once and never deleted. If a decision is later reversed, the original ADR is marked **Superseded** and a new ADR documents the reversal. The old record remains.

### When to Write a New ADR

Write an ADR whenever a decision:

- Cannot easily be undone once production data exists (schema design, numbering format, deletion policy, module boundaries)
- Is not obvious from reading the code or requirements alone
- Has significant trade-offs that a future maintainer needs to understand before changing it
- Was actively contested and the losing option might plausibly be revisited

Do not write ADRs for routine implementation choices (e.g., which npm package to use for date formatting).

### ADR Status Values

|Status|Meaning|
|---|---|
|**Proposed**|Decision is under active discussion; not yet binding|
|**Accepted**|Decision is final and in effect|
|**Deprecated**|Decision was valid but a better approach now exists; use the newer ADR going forward|
|**Superseded**|Decision has been reversed; see the referenced superseding ADR|

---

## ADR Template

Copy this template when writing a new ADR. Fill every section; leave none blank.

```markdown
# ADR-XXX: [Short noun phrase describing the decision]

**Status:** Proposed | Accepted | Deprecated | Superseded by ADR-XXX
**Date:** YYYY-MM
**Deciders:** [Who made this decision — use role titles, not personal names]

---

## Context

[Describe the forces at play: the technical situation, operational constraints, legal requirements,
organizational context, or stakeholder findings that make a decision necessary. Write in present
tense as of the decision date. Do not justify the chosen option here — just describe the situation
and what makes a decision necessary.]

## Decision

[State the decision in one or two sentences. Be specific and unambiguous. Use active voice:
"We will use X" or "X is the chosen approach." Do not explain rationale here — that belongs
in Alternatives Considered.]

## Alternatives Considered

[List every option that was seriously evaluated. For each alternative, briefly state what it is
and why it was not chosen. This section justifies the decision by documenting what was ruled out.]

### [Option 1 — Name]

[What it is and why it was not chosen.]

### [Option 2 — Name]

[What it is and why it was not chosen.]

## Consequences

### Positive

- [Benefit or advantage this decision creates]
- [Another benefit]

### Negative / Trade-offs

- [Cost, risk, or limitation this decision introduces]
- [Another trade-off]

### Required Follow-On Actions

- [Action that must happen as a direct result of this decision]
- [Another follow-on]

## Related Decisions

- [ADR-XXX — Title of a closely related ADR]
```

---

## ADR Index

| ID      | Title                                                                                | Status   | Date      |
| ------- | ------------------------------------------------------------------------------------ | -------- | --------- |
| ADR-001 | Modular Monolith over Microservices                                                  | Accepted | June 2026 |
| ADR-002 | Custom Workflow Engine over Off-the-Shelf BPM Solutions                              | Accepted | June 2026 |
| ADR-003 | PostgreSQL as the Sole Database Engine                                               | Accepted | June 2026 |
| ADR-004 | Pessimistic Locking for Document Editing                                             | Accepted | June 2026 |
| ADR-005 | Multi-Referral Step Type for Committee Referral (Option B)                           | Accepted | June 2026 |
| ADR-006 | Parallel Split/Join Engine Deferred to Phase 2                                       | Accepted | June 2026 |
| ADR-007 | QR Tracking Number Assigned at Secretariat Logging, Before Preliminary Series Number | Accepted | June 2026 |
| ADR-008 | No-Deletion Invariant with Soft-Delete on Every Table                                | Accepted | June 2026 |
| ADR-009 | Two-Stage Preliminary/Final Document Numbering                                       | Accepted | June 2026 |
| ADR-010 | sp.batac.gov.ph Coexistence Without Mandatory Migration                              | Accepted | June 2026 |
| ADR-011 | No Existing Digital QR System Assumed for Letters and Memos                          | Accepted | June 2026 |

---

## ADR-001: Modular Monolith over Microservices

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

The platform spans eleven bounded contexts: IAM, Organization, Documents, Workflow, Tracking, Records, Notifications, Audit, Search, Portal, and Reporting. These are distinct domains that benefit from clear separation and will evolve at different rates.

The development team is four people. The initial user base is 100–250 (SP Secretariat, Mayor's Office, City Hall departments). The LGU IT Office — a small team with no distributed systems expertise — will own and operate the platform after delivery. On-premise deployment is a near-certainty within the platform's 10+ year operational lifespan. There is no existing service mesh, container orchestration experience, or distributed tracing infrastructure at the LGU.

### Decision

The platform is built as a modular monolith: a single deployable process with hard internal module boundaries enforced by PostgreSQL schema ownership, a typed in-process event bus, and automated coupling tests. Modules communicate only through the event bus or published module API interfaces. No module reads another module's schema directly. No cross-schema foreign key constraints are permitted.

### Alternatives Considered

**Microservices from day one** — Each bounded context would be a separate deployable service with its own database and network interface. At this team size and user scale, microservices require distributed tracing, inter-service authentication, network partition handling, and deployment orchestration as day-one operational requirements. The LGU IT Office would need to maintain a service mesh. The operational failure risk far outweighs the scalability benefit for a system that starts at under 250 users. Rejected.

**Traditional monolith with no module boundaries** — A single codebase with no enforced internal separation. Easy to start but produces a "big ball of mud" that becomes unmaintainable as the system grows. Extraction of any domain later becomes very expensive because no existing boundaries exist to respect. Rejected in favor of the modular approach, which enforces those boundaries from the first line of code.

### Consequences

**Positive**

- Single process to deploy, monitor, and restart; LGU IT Office can manage this with standard tooling
- No distributed tracing, inter-service authentication, or network partition complexity
- Module boundaries exist and are enforced; if a module needs extraction later (e.g., the portal becoming its own service for a multi-LGU rollout), the boundary already exists in the code and schema
- Turborepo and pnpm workspaces enforce package-level separation at the build level without requiring separate runtimes

**Negative / Trade-offs**

- A bug in one module can affect the entire process (mitigated by process supervision and replicas)
- Module boundaries are enforced by convention, tooling, and policy — not by network isolation; discipline must be actively maintained
- Coupling lint rules and PR review policies must be written and enforced from the first sprint

**Required Follow-On Actions**

- Implement automated coupling tests that fail the build on any direct cross-schema database query or cross-module import that bypasses the event bus or module API interfaces
- Write and publish a module boundary policy in the developer onboarding documentation before the first external contributor touches the codebase
- Configure Turborepo to treat each package as an independent build unit with explicit declared dependencies

### Related Decisions

- ADR-002 — Custom Workflow Engine (also avoids external runtime infrastructure)
- ADR-003 — PostgreSQL (schema-per-module isolation enforced at the database level)

---

## ADR-002: Custom Workflow Engine over Off-the-Shelf BPM Solutions

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

The SP legislative workflow has highly specific requirements with no direct equivalent in generic BPM systems:

- **Two-stage numbering**: a preliminary "Draft" series number assigned at logging; a final number assigned at a specific lifecycle event (last reading vote), before the VP signs — not at intake, not after the Mayor signs
- **Certified Urgent path**: Mayor-issued formal document bypasses committee referral; First and Second Reading occur in the same session; a single Certification of Urgency can cover multiple measures simultaneously
- **Multi-committee referral with unified report**: measures are typically referred to two committees simultaneously (subject-matter committee + Committee on Laws); the result is a single unified compiled report, not N separate reports
- **Mayor's 10-day lapse rule**: applies to both resolutions and ordinances; automatic status transition to "Lapsed into Law" with a specific RA 7160 statutory remark in the record
- **Panlalawigan 30-day review timer**: automatic "Deemed Approved per RA 7160 Section 56(d)" transition at day 30 with no action; Secretariat confirms
- **Veto override vote**: 2/3 majority (8 of 12 members) tracked as a distinct workflow outcome with a separate vote record
- **ARTA SLA tracking**: per RA 11032, SLA tracking is mandatory per workflow step; the clock does not stop during system outages
- **Admin-configurable without developer involvement**: the Platform Administrator must be able to modify workflow definitions without code changes or deployments

The stack is TypeScript throughout. The on-premise deployment constraint excludes cloud BPM services. A Java-based BPM system would introduce a polyglot runtime that neither the development team nor the LGU IT Office can maintain.

### Decision

A custom domain-specific workflow engine is implemented within the `/server` application. Step types, transition rules, SLA configurations, and notification triggers are configurable by the Platform Administrator via an administrative interface with no code change or deployment required. Workflow definitions are versioned; running instances pin to the definition version active at creation time. The engine is the sole source of workflow state; no external BPM process or service is involved.

### Alternatives Considered

**Camunda BPM** — BPMN-based workflow engine that runs as a separate Java service. The BPMN 2.0 model can represent the legislative process but requires complex sub-process nesting and gateway configuration to represent the Certified Urgent path, multi-committee referral, and two-stage numbering — patterns that are natural primitives in a custom engine but awkward in BPMN. Requires a Java runtime that neither the development team nor the LGU IT Office has expertise to operate. Introduces a network-separated external service, adding distributed system complexity. Rejected: language mismatch, operational complexity, and poor conceptual fit to the domain.

**Temporal** — Durable execution framework with excellent support for long-running workflows and failure recovery. Requires a separate Temporal cluster (self-hostable but operationally complex). Workflow definitions are code, not admin-configurable data: the Platform Administrator could not modify them without a developer writing code and triggering a deployment. Admin-configurability is a hard requirement. Rejected.

**Flowable** — Similar to Camunda; Java-based; heavyweight. Same rejection rationale as Camunda.

**AWS Step Functions** — Managed cloud workflow service. Violates the cloud-agnostic, on-premise-deployable constraint (Architectural Law 5). Rejected immediately on constraint grounds.

**Node.js BPM library (e.g., `bpmn-engine`)** — Lightweight library that executes BPMN 2.0 models in Node.js. BPMN still does not map well to the domain model; admin-configurability requires significant additional tooling on top of the library; the library has limited production track record for government compliance patterns. Rejected.

### Consequences

**Positive**

- Step types map directly to actual LGU workflow constructs: `action`, `approval`, `multi_referral`, `decision`, `notification`, `termination`
- Admin-configurable: Platform Administrator modifies workflow definitions without developer involvement or redeployment
- TypeScript throughout; no polyglot runtime; development team and LGU IT Office can maintain a single runtime
- No additional infrastructure components to deploy and operate
- Domain-specific invariants (e.g., "encoder and final approver of the same document cannot be the same user") can be enforced as first-class engine constraints

**Negative / Trade-offs**

- The engine must be built from scratch; this is substantial initial development effort and the largest single engineering risk in Phase 1
- Edge cases in workflow execution must be discovered and handled explicitly; off-the-shelf engines have years of production-hardened edge case handling baked in
- No ecosystem of pre-built connectors or extensions
- The engine itself must be tested exhaustively (workflow state machine tests are the top testing priority)

**Required Follow-On Actions**

- Write exhaustive state machine tests covering every valid and invalid state transition before any workflow is exposed in the UI; broken state machines in production are unacceptable for legal records
- Define the `multi_referral` step type data model and execution behavior before the first workflow schema migration — it is a Phase 1 schema-level decision (see ADR-005)
- Reserve `parallel_split` and `parallel_join` step type values in the schema even though they are not implemented in Phase 1 (see ADR-006)
- Document the ARTA SLA clock behavior during system outages in a dedicated ADR (clock continues; outage does not suspend ARTA obligations)

### Related Decisions

- ADR-001 — Modular Monolith (engine lives in the single process; no network RPC for workflow operations)
- ADR-005 — Multi-Referral Step Type (domain-specific step type design for committee referral)
- ADR-006 — Parallel Split/Join Deferred to Phase 2 (parallel execution reserved but not implemented)

---

## ADR-003: PostgreSQL as the Sole Database Engine

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

The platform requires several database capabilities that are not universally available across relational engines:

1. **Admin-configurable variable metadata per document type** — Different document types have different custom fields set by the Platform Administrator. These must be stored without requiring a schema migration for each new field.
2. **Office-level data isolation enforced at the database engine level** — The ABAC authorization model requires that Row-Level Security policies prevent any query from returning out-of-scope data, even if application middleware has a bug. This is a defense-in-depth requirement, not just an application convention.
3. **Append-only audit log enforced at the database permission level** — The audit schema must be INSERT-only for the application database user; `UPDATE` and `DELETE` must be revoked at the PostgreSQL grant level, not just prevented in application code. This is an Architectural Invariant (Invariant 3).
4. **Gapless document numbering sequences per document type per year** — Legislative series numbers cannot have unintended gaps. PostgreSQL sequences provide this with correct behavior under concurrent writes.
5. **Full-text search for Phase 1** — `tsvector`/`tsquery` for Filipino government document titles and bodies, without additional infrastructure in Phase 1.
6. **Check constraints for workflow state transitions** — A second enforcement layer at the database level to prevent invalid state transitions even if the application layer has a bug.

### Decision

PostgreSQL is the sole relational database engine for the entire platform. MySQL and MariaDB are excluded entirely and permanently. No other relational database engine is used for any data storage requirement.

### Alternatives Considered

**MySQL / MariaDB** — Lacks JSONB (the MySQL `JSON` type does not support GIN indexing or efficient containment queries), lacks Row-Level Security as a native feature, and lacks the append-only grant model needed for audit log enforcement at the database permission level. All three are load-bearing architectural requirements. MySQL is excluded permanently.

**MongoDB** — Document-oriented storage seems appealing for variable document metadata. However, MongoDB does not provide the same ACID transaction guarantees across collections, has a weaker query model for relational data (committee membership, role assignment chains, delegation hierarchies), lacks the RLS model required for office-scoped isolation, and lacks native sequence support for gapless numbering. Rejected.

**SQLite** — Not suitable for a multi-user server with concurrent writes. Not considered beyond initial evaluation.

**PostgreSQL + a separate document store or time-series database** — Unnecessary complexity at this scale. PostgreSQL with JSONB and GIN indexing handles the variable-metadata requirement within a single engine. A second data store adds operational overhead and synchronization risk. Rejected.

### Consequences

**Positive**

- JSONB with GIN indexing supports admin-configurable metadata fields per document type without schema migrations
- RLS policies enforce office-scoped data isolation at the engine level — a second layer behind application ABAC
- Append-only audit schema enforcement via revoking `UPDATE`/`DELETE` grants from the application database user
- PostgreSQL sequences provide gapless per-series-per-year numbering under concurrent write conditions
- `tsvector`/`tsquery` provides Phase 1 full-text search with no additional infrastructure
- Drizzle ORM provides full TypeScript inference from the PostgreSQL schema with end-to-end type safety

**Negative / Trade-offs**

- Requires PostgreSQL-specific expertise; generic SQL or MySQL knowledge does not transfer fully to RLS, JSONB, and sequence behavior
- RLS policies add schema complexity; queries must be tested with RLS enabled (not bypassed via superuser), or policy gaps will not be caught in development
- JSONB queries are less readable than typed column queries; GIN index maintenance adds storage overhead at high document volumes

**Required Follow-On Actions**

- All migration files must include RLS policy definitions for new tables alongside the table DDL; a table without an RLS policy on a tenant-scoped schema is a migration lint error
- The application runtime database user must never be granted `UPDATE` or `DELETE` on the `audit` schema; this must be enforced in the initial migration and tested in CI
- Check constraints for workflow state machine transitions must be written alongside the workflow schema

### Related Decisions

- ADR-001 — Modular Monolith (schema-per-module isolation enforced at the PostgreSQL schema boundary)
- ADR-008 — No-Deletion Invariant (soft-delete is a schema-level convention; no-delete on audit schema is a PostgreSQL grant)

---

## ADR-004: Pessimistic Locking for Document Editing

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

The SP Secretariat has multiple clerks who work simultaneously. Documents in active workflow carry legal weight: a partially overwritten resolution or an ordinance where two clerks' edits conflict creates ambiguity in the official record. All document versions are retained permanently (see ADR-008); merge conflicts cannot be silently discarded.

The realistic concurrency pattern is low: at most two or three clerks would simultaneously access the same document in exceptional circumstances. The goal is to prevent the collision entirely rather than detect and resolve it after the fact.

### Decision

Pessimistic locking is used for document editing. When a user opens a document for editing, an exclusive lock is acquired. Other users see an informational notice identifying the lock-holder. The lock has a 15-minute timeout (configurable per document type). The lock is released on save, on explicit user release, or on timeout. Admin force-release is available and is audit-logged with a mandatory reason.

### Alternatives Considered

**Optimistic locking** — Allows concurrent edits and detects conflicts at write time via a version counter. Appropriate for collaborative editing scenarios where merge is acceptable. For official government documents where every state change is audited and the document's integrity is a legal matter, a conflict error requiring a clerk to manually reconcile two versions of a legislative measure introduces procedural risk. Rejected.

**No locking (last write wins)** — Unacceptable; concurrent edits would silently overwrite each other, producing a document whose final state reflects only one of the concurrent edits with no indication that the other was lost. Rejected immediately.

**Real-time collaborative editing (CRDT or OT)** — Operational transforms or CRDTs allow multiple users to edit simultaneously with automatic merge. The technical complexity is high, and no scenario in the SP Secretariat requires two clerks to simultaneously type into the same document in real time. The complexity is not justified by the use case. Rejected.

### Consequences

**Positive**

- Prevents conflicting concurrent edits on official documents; no manual conflict resolution required
- Lock timeout (15 minutes) prevents indefinite blocking if a user abandons a session without saving
- The lock-holder notification enables clerks to coordinate: "Mia has this document open; try again in a few minutes"

**Negative / Trade-offs**

- If a user's session dies without releasing the lock, other users wait up to the timeout duration
- Requires a lock management UI: show who holds the lock, when it expires, and an admin force-release action
- Admin force-release must be audit-logged with a mandatory reason; force-releasing a lock on an unsaved document discards that user's changes
- Timeout value requires calibration; 15 minutes is the default but some complex ordinances may require longer edit sessions

**Required Follow-On Actions**

- Implement lock TTL cleanup as a scheduled job that sweeps and releases expired locks at regular intervals (every minute)
- Admin interface must show all currently held locks with lock-holder identity and expiry time
- Lock acquisition and release events must each produce a dedicated audit log entry
- Document the force-release procedure in the Records Officer training guide

### Related Decisions

- ADR-008 — No-Deletion Invariant (all versions are retained; conflicts cannot be discarded, which is part of why pessimistic locking is preferred)

---

## ADR-005: Multi-Referral Step Type for Committee Referral (Option B)

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (confirmed against Interview 1 and Interview 2 findings)

---

### Context

Interview 1 and Interview 2 confirmed that most SP measures are referred to **two committees simultaneously**: the relevant subject-matter committee and the Committee on Laws. This is standard practice — the Committee on Laws appears on nearly every Notice of Committee Hearing in the SP logs. It is not a special case; it is the default.

When multiple committees are referred, they hold a **joint hearing** and produce a **single unified compiled report**. If one committee is absent from the hearing, the hearing continues regardless. All assigned committees must sign and contribute to the unified report before the workflow step can complete and the measure can proceed to the next reading. The committee report deadline is the Thursday before the next Tuesday session; if a committee has not submitted by that cutoff, the measure's Second Reading is delayed.

A pre-development decision had stated "parallel steps not included in Phase 1." This conflicts with the operational reality: deferring multi-committee referral would mean Phase 1 cannot accurately model the actual SP legislative process. Three options were evaluated to resolve this conflict.

### Decision

Option B is selected: a `multi_referral` step type is implemented as a distinct step type in the Phase 1 workflow engine. A single step accepts a list of assigned committees. The step completes when the SP Secretary accepts the unified committee report with all required committee signatures. Committees that have not submitted by the Thursday cutoff are marked red in the Order of Business view; their absence delays Second Reading but does not block the hearing itself. The SP Secretary can manually advance the step with a mandatory audit-logged comment to handle exceptional situations.

### Alternatives Considered

**Option A — Sequential referral** — Each committee reviews separately in sequence; the step type would repeat per committee. This does not reflect actual SP practice. A joint hearing producing a unified report is operationally and legally distinct from sequential individual reviews. Modeling it as sequential misrepresents the workflow and would create confusing UX and incorrect audit records. Rejected.

**Option C — Full parallel split/join engine in Phase 1** — Full parallel branches with a join gate would accurately represent concurrent independent processing. However, the unified-report model means there is a single completion event (the joint report), not N independent branch completions. Full parallel split/join is significantly more complex than `multi_referral` and solves a harder problem than Phase 1 requires. It is reserved for Phase 2 (Barangay Budget workflow), which genuinely needs independent parallel paths with independent completion events. Rejected as over-engineering for Phase 1.

### Consequences

**Positive**

- Accurately models the actual SP legislative process: joint hearing, single unified report, all committees must sign
- Simpler implementation than full parallel split/join; single completion event with a clear trigger
- Absent committees are marked red in the Order of Business, preserving visibility without stopping the hearing
- SP Secretary override with mandatory audit-logged comment handles genuinely exceptional situations without breaking the engine

**Negative / Trade-offs**

- All assigned committees must contribute signatures to the unified report; if one committee is unresponsive and the SP Secretary does not use the override, Second Reading is delayed indefinitely
- The SP Secretary override action must be prominently displayed and require explicit confirmation to prevent accidental use
- `multi_referral` must be defined in the workflow schema before the first workflow migration; it cannot be added later without a schema change

**Required Follow-On Actions**

- Define the `multi_referral` step type in the workflow schema in the first workflow module migration, before any workflow definitions are created
- The SP Secretary dashboard Order of Business view must visually red-flag any measure where one or more committees have not submitted by the Thursday cutoff
- The SP Secretary manual-advance action must require a mandatory free-text comment and produce a named audit event distinct from standard step completion

### Related Decisions

- ADR-002 — Custom Workflow Engine (`multi_referral` is a domain-specific step type only possible in a custom engine)
- ADR-006 — Parallel Split/Join Deferred to Phase 2 (`multi_referral` explicitly replaces but does not replace the need for `parallel_split`/`parallel_join` in later phases)

---

## ADR-006: Parallel Split/Join Engine Deferred to Phase 2

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

The Barangay Budget workflow requires four offices — the Local Finance Committee, Budget Office, Treasury Office, and CPDO — to conduct simultaneous independent preliminary reviews. This is a genuine parallel split/join pattern: the workflow splits into four independent branches, each branch completes independently, and the workflow only proceeds once all four branches have completed. Each branch has its own completion state and is not producing a shared unified output.

This is fundamentally different from the multi-committee referral pattern (ADR-005), which has multiple assignees but a single completion event (the joint unified committee report). The Barangay Budget workflow requires four independent completion events that must all be satisfied before the join.

Barangay Budget is not in Phase 1 scope. Barangay-related workflows are Phase 1B at the earliest. The `multi_referral` step type in Phase 1 (ADR-005) addresses all Phase 1 multi-assignee requirements.

### Decision

`parallel_split` and `parallel_join` step type values are reserved in the workflow step type schema in Phase 1 but are not implemented in the Phase 1 engine. No Phase 1 workflow definition uses these step types. The engine rejects any attempt to instantiate a workflow using these types in Phase 1 with a clear error. Implementation occurs in Phase 2 to support the Barangay Budget workflow.

### Alternatives Considered

**Implement parallel split/join in Phase 1** — Would require building and testing the full parallel branch execution model, including partial completion tracking, branch failure and retry handling, and join gate logic. This engineering effort is not needed for any Phase 1 workflow. Rejected as unnecessary scope increase in the highest-risk development phase.

**Omit parallel step type values from the schema entirely and add them in Phase 2 via migration** — If the schema does not reserve these values now, Phase 2 will require a migration that modifies the core step type enumeration — a migration that touches all workflow definitions and instances. Reserving the values as Phase 2 placeholders avoids a disruptive and potentially risky migration later. Rejected in favor of reserving now.

### Consequences

**Positive**

- Phase 1 workflow engine complexity is reduced; only step types needed in Phase 1 are fully implemented
- The schema already contains the correct step type values for Phase 2 without requiring a breaking migration
- Barangay Budget and similar workflows are not blocked by Phase 1 — they begin implementation in Phase 2 when the engine is ready

**Negative / Trade-offs**

- If any Phase 1 workflow turns out to require genuine parallel execution that cannot be modeled with `multi_referral`, it will be a scope expansion requiring the Phase 2 engine to be pulled forward
- Phase 2 must implement the full parallel engine before any Barangay Budget or multi-branch workflow can be activated

**Required Follow-On Actions**

- The workflow step type schema must include `parallel_split` and `parallel_join` as reserved values with an inline comment marking them as Phase 2 implementations
- The Phase 1 workflow engine instantiation path must include a guard that rejects any workflow definition using `parallel_split` or `parallel_join`, with an error message that identifies them as Phase 2 features

### Related Decisions

- ADR-002 — Custom Workflow Engine (parallel execution is a planned feature of the engine, not a separate system)
- ADR-005 — Multi-Referral Step Type (the Phase 1 multi-assignee pattern; explicitly distinct from parallel split/join)

---

## ADR-007: QR Tracking Number Assigned at Secretariat Logging, Before Preliminary Series Number

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (confirmed by Interview 2, resolving Q-02)

---

### Context

QR codes are the physical tracking mechanism for SP Secretariat documents. When a document enters the Secretariat, a QR code label is generated and affixed to the physical document so its routing through offices can be recorded by scanning at each transfer. Tracking must begin the moment a document is logged — not when it receives a series number.

The preliminary "Draft" series number is also assigned at logging, but it is a separate event that happens after QR assignment. The preliminary number can change before finalization (see ADR-009). The final series number is assigned much later (after the last reading vote). If the QR code were tied to or dependent on the series number, it would either need to be regenerated when the series number changes, or would not exist during the early stages of the document's life — both are unacceptable.

Interview 2 confirmed the sequence explicitly, resolving Q-02: "QR code: assigned at secretariat logging, before preliminary number."

### Decision

The QR tracking number is a system-generated UUID (v4) assigned at the moment of secretariat logging, as the first operation in the logging transaction, before the preliminary series number is assigned. It is completely independent of the preliminary number, the final series number, and any control number. It is immutable for the document's entire lifecycle.

Assignment sequence: Councilor submits draft → Secretariat logs → **QR tracking UUID assigned** → Preliminary "Draft" series number assigned.

The QR code encodes only the tracking UUID — not a URL, not the series number, not document metadata. The scan result page displays document type, routing history, current status, and the first page; the series number is displayed as metadata alongside the UUID.

### Alternatives Considered

**Assign the QR code simultaneously with the preliminary series number** — Operationally close to the chosen approach but creates conceptual coupling: if the preliminary series number changes (which it can before finalization), the system must either regenerate the QR code (invalidating printed labels) or keep the QR code while the number has changed (confusing). Decoupling them entirely is cleaner. Rejected.

**Assign the QR code only at final series number assignment** — A document in the committee referral stage would have no QR code and could not be tracked physically during its longest and most complex workflow phase. This directly contradicts the purpose of QR tracking. Rejected.

**Use the series number as the QR code content** — Series numbers change (preliminary to final, and preliminary numbers can also change between readings); using them as QR content would require reprinting labels whenever the number changes. The UUID's immutability is the point. Rejected.

### Consequences

**Positive**

- Tracking begins the moment a document enters the system; physical routing is recorded from the first scan
- QR UUID is immutable; it survives preliminary-to-final number changes, VP signing, Mayor signing, Panlalawigan review, and archival without any label reprinting
- The QR scan result can display any associated number (preliminary or final) as current metadata without the UUID itself needing to change

**Negative / Trade-offs**

- Three distinct identifiers exist for a document during its active lifecycle: QR UUID, preliminary number, and eventually final number; staff must understand that these are separate identifiers serving different purposes
- UI must clearly explain the relationship between the QR UUID and the series numbers, particularly to new clerks

**Required Follow-On Actions**

- QR UUID generation must be the first database write in the secretariat logging transaction; no prior numbering or metadata assignment should precede it
- Physical QR label printing must be available immediately after logging, before any series number field is required to be present
- The QR scan result page must display the current series number (preliminary "Draft" or final) as labeled metadata alongside the UUID; the UUID itself is never the primary display identifier shown to citizens

### Related Decisions

- ADR-009 — Two-Stage Preliminary/Final Numbering (explains why the QR UUID and series number are separate and why QR precedes the series number)

---

## ADR-008: No-Deletion Invariant with Soft-Delete on Every Table

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

SP Resolutions and Ordinances are permanent public records under RA 7160 (Local Government Code). The Commission on Audit (COA) requires physical originals to be retained until COA formally accepts the digital record as the legal equivalent per document category — that confirmation has not yet been obtained for any category. ARTA compliance under RA 11032 requires a complete audit trail of all document processing steps. Accidental deletion of a government record creates legal exposure and violates the trust of the public the system serves.

Interview findings confirmed: all current SP documents are retained; none have been disposed of. The Secretariat has no active disposal process in practice.

RA 10173 (Data Privacy Act) creates a narrow exception: citizens may have a legal right to erasure of their personal identifying information. This is handled as a dedicated Records Management operation requiring formal legal review, not as a routine application-layer delete.

### Decision

No document, record, version, attachment, or audit entry may be permanently deleted by any user or any role — including Platform Administrators, IT Administrators, and Records Officers. Hard deletes (`DELETE` SQL statements) are prohibited in all application code for all tables. Every table carries `deleted_at TIMESTAMPTZ` and `deleted_by UUID` columns. "Deletion" in the UI sets these columns; the row remains in the database. All queries for active records must include `WHERE deleted_at IS NULL`.

Only the Records Management module may initiate disposition of records, and only via an explicit Records Officer action with a mandatory comment, after the applicable retention period has elapsed, with no active legal hold on the record. Disposition creates an audit entry; it does not remove any database row.

### Alternatives Considered

**Allow hard delete for non-legislative documents (memos, letters, complaints) after their retention period** — A graduated policy where impermanent records could be hard-deleted after retention expiry. Simpler for those record types, but creates two tiers of deletion behavior that increases implementation complexity without meaningful benefit at current scale. Retention-period disposition through the Records Management module is sufficient for all types. Rejected.

**Allow Platform Administrator hard delete with multi-step confirmation** — Even with confirmation steps, a permanent hard delete by any user is a single point of failure with no recovery path. The invariant is cleaner, more defensible in a government audit context, and eliminates an entire class of irreversible accidents. Rejected.

**No soft-delete columns — rely on the audit log to reconstruct deleted records** — The audit log records state changes but is not the primary record store; it is the tamper-evidence layer. The document record itself must be retained in the documents schema. Reconstructing a record from audit events for routine access is impractical. Rejected.

### Consequences

**Positive**

- COA compliance: no accidental or unauthorized destruction of public records
- RA 7160 compliance for all legislative records
- The complete history of any document, including "cancelled" or "archived" items, is always retrievable from the primary data store
- No legal exposure from accidental deletion by any role

**Negative / Trade-offs**

- The database grows indefinitely with soft-deleted and expired records; requires a retention-based archival strategy in the Records Management module to manage table sizes
- Every query for active records must include `WHERE deleted_at IS NULL`; a missing filter is a silent data correctness bug that returns logically deleted records
- RA 10173 PII erasure is a special exception that requires a separate legal review workflow; the system must provide this pathway, and it must nullify PII fields in place rather than deleting rows — a more complex operation than a standard application delete
- Soft-deleted records must still be protected by RLS policies; "deleted" does not mean "inaccessible to all"

**Required Follow-On Actions**

- Migration linting must enforce that every table in the application schemas has `deleted_at TIMESTAMPTZ` and `deleted_by UUID` columns; a migration that creates a table without them is a lint error
- A shared repository query helper must automatically append `WHERE deleted_at IS NULL` unless the caller explicitly uses a named bypass (which must be documented and reviewed on every PR)
- The RA 10173 PII erasure workflow must be designed as a named Records Management operation with a dedicated audit event type; it must nullify PII field values in place rather than removing rows
- Legal hold functionality must be implemented before any retention-period disposal can be activated in the Records Management module

### Related Decisions

- ADR-003 — PostgreSQL (soft-delete is a schema convention; the audit no-delete is a PostgreSQL grant enforcement)
- ADR-007 — QR Tracking Number (QR codes must survive soft-delete; a cancelled workflow's physical document may still need to be located)

---

## ADR-009: Two-Stage Preliminary/Final Document Numbering

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (confirmed by Interview 2, superseding Interview 1's understanding, resolving Q-01)

---

### Context

The SP Secretariat assigns legislative document series numbers in two distinct stages at two distinct lifecycle events:

**Stage 1 — Preliminary number** (at secretariat logging): A "Draft" series number is assigned when the document first enters the system (e.g., `Draft 7SP 2026-02`). This number appears in the Order of Business and on early workflow steps. It is not the final number.

**Stage 2 — Final number** (after last reading vote, before VP signs): The final series number is assigned by the Secretariat after the last reading vote — Second Reading for resolutions, Third Reading for ordinances — and before the Vice Mayor signs. The "Draft" prefix is removed. The final number reflects the order in which documents complete their last reading vote, not the order in which they were introduced. If Document A was introduced before Document B but Document B's last reading vote passes first, Document B receives the lower final number. Preliminary numbers can therefore change between the first and last readings.

Interview 1 had incorrectly understood the final number to be assigned after the Mayor signs; Interview 2 explicitly superseded this. Interview 2 also confirmed the "Draft" prefix at the preliminary stage, resolving Q-01.

The QR tracking UUID is completely independent of both numbering stages (see ADR-007).

### Decision

The document numbering data model stores a nullable `preliminary_number` field and a separately nullable-until-assignment `final_number` field. These are distinct fields, not a single "current number" field.

- **Preliminary number format**: `Draft {SP_NUMBER}SP {YEAR}-{NN}` — e.g., `Draft 7SP 2026-02`. Assigned at secretariat logging. Nullable. Can be updated before finalization.
- **Final number format**: `{SP_NUMBER}SP {YEAR}-{NN}` — e.g., `7SP 2026-01`. Assigned by the Secretariat after the last reading vote (Second Reading for resolutions; Third Reading for ordinances), before VP signs. Immutable once set. The removal of the "Draft" prefix constitutes promotion to final status.
- Number assignment events are named, distinct, audit-logged workflow actions.
- `{SP_NUMBER}` (currently `7` for the 7th Sangguniang Panlungsod) is a configurable system parameter, not a hardcoded string.
- All document number formats use a space as the delimiter between prefix, year, and sequence number: `Draft 7SP 2026-02`, `SPR 2026-01`, `MO 2025-01`.
- A separate PostgreSQL sequence per document type per year; sequences do not reset mid-year and cannot be decremented.

### Alternatives Considered

**Assign the final number at secretariat logging** — Simpler (single number from intake) but operationally incorrect: the Secretariat cannot determine the final approval order at intake. If Document A is logged first but Document B is approved first, Document A's number would need to change after it appeared in the Order of Business and on physical printouts, creating confusion and invalid references. Rejected.

**Assign the final number after the Mayor signs** — This was the Interview 1 understanding. Interview 2 explicitly corrected it: the Secretariat assigns the final number after the last reading vote, before VP and Mayor sign. Using post-Mayor assignment would delay final number availability and would mean VP-signed copies carry no series number — which does not reflect actual practice. Rejected (superseded by Interview 2).

**Single "current number" field that changes from preliminary to final** — Simpler schema but loses the history of what the preliminary number was. Queries that need to look up a document by its preliminary number (as it appeared in an earlier Order of Business) would fail. The audit log would retain the history, but separate fields are more practical for operational queries. Rejected.

### Consequences

**Positive**

- Accurately models SP Secretariat operational practice
- Final number sequence reflects the true legal order of approval, not the order of introduction
- Documents are trackable by QR UUID and preliminary number well before their final number is known
- Configurable `{SP_NUMBER}` parameter supports new SP administrations (8th SP, 9th SP) without code changes

**Negative / Trade-offs**

- Two distinct number fields in the data model; lookup queries ("find document by number") must search both preliminary and final number fields
- UI must clearly communicate the "Draft" vs. final status distinction and explain that a document's number can change before finalization — this requires clear UX design and clerk training
- When the preliminary number changes, any physical printouts (cover sheets, Order of Business pages) that showed the old preliminary number are outdated; the system should prompt for a new cover sheet print after a preliminary number update

**Required Follow-On Actions**

- The `number_series` configuration must include `{SP_NUMBER}` as a Platform Administrator-configurable parameter, updated at each new SP administration without a code change or migration
- The workflow engine must enforce that final number assignment is only permitted after the last reading vote step has completed; premature assignment must be rejected with a clear error
- Both the preliminary number assignment and the final number assignment (promotion) must produce dedicated named audit events with the assigning user, timestamp, and assigned value

### Related Decisions

- ADR-007 — QR Tracking Number Assigned Before Preliminary Number (QR UUID is independent of both numbering stages)

---

## ADR-010: sp.batac.gov.ph Coexistence Without Mandatory Migration

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (confirmed by Interview 2, resolving Q-C07)

---

### Context

sp.batac.gov.ph is the SP Secretariat's current public-facing website. It provides public access to SP documents and serves citizens who look up ordinances, resolutions, and other legislative records. The subscription was recently renewed (Interview 2 confirmed this directly); the site is in active use.

batac-dms will include a public portal with overlapping citizen-facing functionality. Citizens will eventually look up documents in batac-dms. However, batac-dms's primary Phase 1 value proposition is internal workflow automation and operational tracking — not replacing the public website.

The data format and completeness of existing sp.batac.gov.ph content have not been assessed. The LMITS historical data migration is separately unresolved (format TBD, later phases). Forcing a migration of sp.batac.gov.ph data into Phase 1 scope adds unpredictable effort to the most risk-dense development phase.

### Decision

sp.batac.gov.ph continues to operate without a required retirement date. batac-dms is developed and deployed as a parallel system, primarily for internal use, with a public portal that will eventually serve the same citizen-facing purpose. Both systems coexist indefinitely. Migration of sp.batac.gov.ph data into batac-dms is deferred until after batac-dms has been in production use for a significant period and the LGU has independently decided it is ready to retire sp.batac.gov.ph.

### Alternatives Considered

**Mandatory migration and retirement of sp.batac.gov.ph at Phase 1 launch** — Forces a data migration of unknown complexity into the Phase 1 scope. Risks delaying Phase 1 if the migration is harder than expected, or launching batac-dms with missing historical data if a deadline is held. Rejected.

**Federation: sync sp.batac.gov.ph data into batac-dms via API or scraping** — Requires either confirmed API access to sp.batac.gov.ph (not confirmed to exist) or a web-scraping pipeline. Adds an ongoing maintenance dependency between two systems with different owners and update schedules. Rejected.

**Immediate redirect: forward sp.batac.gov.ph traffic to the batac-dms public portal at launch** — Requires the batac-dms public portal to have feature parity with sp.batac.gov.ph and contain the full historical document set before a single user can visit. Both conditions cannot be guaranteed at Phase 1 launch. Rejected.

### Consequences

**Positive**

- Phase 1 scope does not include data migration risk from sp.batac.gov.ph
- No disruption to existing citizen access during batac-dms development and rollout
- Data migration can be scoped, planned, and executed with real operational experience of batac-dms
- LGU retains flexibility to retire sp.batac.gov.ph on their own timeline

**Negative / Trade-offs**

- Two public portals for legislative documents exist simultaneously; citizens may be unsure which system has the most recent content
- The LGU incurs subscription costs for sp.batac.gov.ph while also operating batac-dms
- Documents entered into batac-dms are not visible on sp.batac.gov.ph, and vice versa; cross-system search is not possible
- batac-dms public portal will have a historical data gap until the migration is executed

**Required Follow-On Actions**

- The batac-dms public portal must display a visible notice at launch acknowledging that historical documents may be found on sp.batac.gov.ph and providing a direct link to the site
- When the LGU decides to migrate, a separate migration project must be formally scoped: assess sp.batac.gov.ph data format, extract, transform, import, verify data integrity, then retire the site

### Related Decisions

- ADR-011 — No Existing Digital QR System for Letters and Memos (similar pattern: don't force integration with a system of uncertain state)

---

## ADR-011: No Existing Digital QR System Assumed for Letters and Memos

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team (developer decision, resolving Q-D06)

---

### Context

Physical letters and memos currently in circulation at the SP Secretariat already have QR code labels affixed. This raises the question: do these QR codes connect to an existing digital tracking system? If they do, integration with that system would be necessary to avoid creating a second disconnected tracking layer that splits the document history.

Interview 2 directly addressed this question (Q-D06). No existing digital system behind the QR codes was confirmed. The Secretariat could not identify what system, if any, generates or reads the existing codes. The possibility exists that these labels are simply printed identifiers with no live digital backend — applied manually or via a local label-printing tool with no server component.

Attempting to integrate with an unconfirmed system introduces unpredictable risk: the system may have no accessible API, may hold incomplete data, may have already been abandoned, or may not exist at all. A discovery effort during Phase 1 development creates schedule risk with an uncertain outcome.

### Decision

The development team assumes no existing digital QR system exists behind the QR codes currently affixed to letters and memos at the SP Secretariat. QR code generation and tracking for all document types — including Letters Received (SPR), Letters Sent (SPS), Memos Outgoing (MO), and Memos Incoming (MI) — is implemented entirely within batac-dms with no integration with any external QR system. Physical documents with existing QR codes are treated as pre-system artifacts; their existing QR codes will not resolve in batac-dms unless those documents are formally re-entered.

### Alternatives Considered

**Investigate and integrate with the existing QR system before building batac-dms QR features** — Requires identifying the system, confirming API access, understanding its data model, and building an integration layer. The system may not exist; if it does, the integration scope is unknown. A discovery effort during Phase 1 creates schedule risk with an uncertain outcome. Rejected.

**Assume an existing system exists and delay QR implementation until investigation is complete** — Would defer the QR tracking feature indefinitely, since the investigation has no guaranteed resolution timeline. QR tracking is a Phase 1 deliverable. Rejected.

**Attempt to decode existing QR codes and reverse-engineer any backend system** — Even if the QR content can be decoded, there may be no accessible backend behind it. A decoded URL or identifier is not an integration contract. Rejected as unlikely to yield actionable information.

### Consequences

**Positive**

- QR generation and tracking is implemented entirely in batac-dms; no external integration dependency
- A consistent QR UUID model (as defined in ADR-007) is applied uniformly across all document types from day one
- No integration risk, discovery overhead, or schedule dependency on an unconfirmed external system

**Negative / Trade-offs**

- Existing QR codes on physical letters and memos currently in circulation will not resolve in batac-dms; scanning an existing document returns no result
- Physical documents created before batac-dms go-live must be re-entered or re-logged in batac-dms to receive a batac-dms QR code and appear in tracking
- If an existing digital QR backend is later discovered (at a future interview or during migration assessment), this decision will need to be revisited; it would become a superseding ADR at that time

**Required Follow-On Actions**

- The batac-dms QR scan result page must handle "QR code not found" gracefully with a user-facing message (not a technical error): "This QR code was not generated by this system. If you are scanning an older document, it may need to be re-entered into batac-dms to appear here."
- When historical letters and memos are re-entered into batac-dms during any future migration effort, a new batac-dms QR UUID is generated for each document and a new label is printed for attachment to the physical document

### Related Decisions

- ADR-007 — QR Tracking Number Assigned at Secretariat Logging (establishes the QR UUID model used in batac-dms for all document types)
- ADR-010 — sp.batac.gov.ph Coexistence (similar pattern: assume a clean start rather than forcing integration with a system whose current state is uncertain)