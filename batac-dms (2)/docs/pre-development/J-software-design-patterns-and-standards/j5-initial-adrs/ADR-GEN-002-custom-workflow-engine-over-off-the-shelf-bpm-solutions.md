# ADR-GEN-002: Custom Workflow Engine over Off-the-Shelf BPM Solutions


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
- Define the `multi_referral` step type data model and execution behavior before the first workflow schema migration — it is a Phase 1 schema-level decision (see ADR-GEN-005)
- Reserve `parallel_split` and `parallel_join` step type values in the schema even though they are not implemented in Phase 1 (see ADR-GEN-006)
- Document the ARTA SLA clock behavior during system outages in a dedicated ADR (clock continues; outage does not suspend ARTA obligations)

### Related Decisions

- ADR-GEN-001 — Modular Monolith (engine lives in the single process; no network RPC for workflow operations)
- ADR-GEN-005 — Multi-Referral Step Type (domain-specific step type design for committee referral)
- ADR-GEN-006 — Parallel Split/Join Deferred to Phase 2 (parallel execution reserved but not implemented)

---
