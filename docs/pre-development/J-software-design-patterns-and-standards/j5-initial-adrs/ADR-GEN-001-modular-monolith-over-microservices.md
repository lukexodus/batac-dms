# ADR-GEN-001: Modular Monolith over Microservices

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

- ADR-GEN-002 — Custom Workflow Engine (also avoids external runtime infrastructure)
- ADR-GEN-003 — PostgreSQL (schema-per-module isolation enforced at the database level)

---
