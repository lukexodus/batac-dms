# ADR-GEN-006: Parallel Split/Join Engine Deferred to Phase 2

**Status:** Accepted **Date:** June 2026 **Deciders:** Development team

---

### Context

The Barangay Budget workflow requires four offices — the Local Finance Committee, Budget Office, Treasury Office, and CPDO — to conduct simultaneous independent preliminary reviews. This is a genuine parallel split/join pattern: the workflow splits into four independent branches, each branch completes independently, and the workflow only proceeds once all four branches have completed. Each branch has its own completion state and is not producing a shared unified output.

This is fundamentally different from the multi-committee referral pattern (ADR-GEN-005), which has multiple assignees but a single completion event (the joint unified committee report). The Barangay Budget workflow requires four independent completion events that must all be satisfied before the join.

Barangay Budget is not in Phase 1 scope. Barangay-related workflows are Phase 1B at the earliest. The `multi_referral` step type in Phase 1 (ADR-GEN-005) addresses all Phase 1 multi-assignee requirements.

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

- ADR-GEN-002 — Custom Workflow Engine (parallel execution is a planned feature of the engine, not a separate system)
- ADR-GEN-005 — Multi-Referral Step Type (the Phase 1 multi-assignee pattern; explicitly distinct from parallel split/join)

---
