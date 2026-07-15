# ADR-API-005: Phase 1 FTS Column Ownership

**Status:** Accepted
**Date:** June 2026
**Decided by:** Luke (stakeholder/architect decision — engineering effort vs. Phase 2 migration cost trade-off)
**Related documents:** B2 — Module Boundary and Internal API Contracts, Module 3 (Documents), Module 9 (Search Meta); B1 — System Architecture, Module 9 Component Diagram; Stack Context, "Search Strategy"

---

## Context

Phase 1 uses PostgreSQL full-text search (`tsvector`/`tsquery`); Phase 2 adds Meilisearch (Stack Context, "Search Strategy" table; Consolidated Reference, Part 9 stack table). Both B1 and B2 describe the Search Meta module itself as Phase 2 (B1, Module 9 header: *"[Phase 2]"*; B2, Module 9 header: *"Phase 2 (module delivered Phase 2; Phase 1 uses PostgreSQL FTS directly without this abstraction layer)"*), with B2 going further to state explicitly: *"In Phase 1, full-text search is executed directly by the Documents Router against PostgreSQL FTS. The Search Meta module abstraction layer is not active. The `tsvector` columns are in the `documents` schema, maintained by DB triggers. No cross-module call to Search Meta is needed in Phase 1."* (B2, Module 9, flagged `[Inference]`).

This created a tension the Required ADRs table flagged explicitly: the Stack Context's own stated design goal for the search abstraction is *"Design the search interface as an abstraction layer in the application from day one so the underlying provider is swappable without touching call sites"* — but a Phase 1 design where the Documents Router queries `tsvector` directly means Phase 1 call sites do **not** go through any abstraction, and migrating them to call `SearchMeta.search()` when Meilisearch arrives in Phase 2 would require finding and rewriting every Phase 1 FTS call site — exactly the kind of call-site churn the "from day one" abstraction goal was meant to avoid.

The trade-off is between Phase 1 simplicity (zero Search Meta implementation) and Phase 2 migration cleanliness (zero call-site changes when the provider swaps).

## Decision

**A thin Search Meta pass-through layer is implemented in Phase 1.** The Search Meta module is not deferred entirely to Phase 2; it ships in Phase 1 with a minimal implementation that delegates to PostgreSQL FTS.

### Mechanics

1. **The `tsvector` column still lives in the `documents` schema**, maintained by a DB trigger, exactly as B2's prior design stated. This part of the design is unchanged — Search Meta does not own the underlying FTS index or the trigger that maintains it in Phase 1. Schema ownership of the trigger and column remains with Documents.
2. **What changes is the call path.** In Phase 1, the Documents Router (or any other internal caller needing search) does **not** query `tsvector` against the `documents` schema directly. Instead, it calls `SearchMeta.search(query: SearchQuery): Promise<SearchResult[]>` — the same Published API method already defined in B2's Module 9 for Phase 2+.
3. **Search Meta's Phase 1 implementation of `search()` is a thin pass-through:** internally, it executes `tsvector`/`tsquery` against the `documents` schema's FTS columns (the same SQL that would otherwise have lived directly in the Documents Router), and returns results in the same `SearchResult[]` shape Phase 2's Meilisearch-backed implementation will return. There is no separate `FTS Query Service` component distinct from this — Phase 1's Search Meta module *is* the FTS Query Service, wrapped behind the stable interface.
4. **This requires one exception to Law #2's schema-ownership rule, which must be explicitly carved out:** Search Meta's Phase 1 `search()` implementation reads the `documents` schema's `tsvector` column — this is a cross-schema read, which would otherwise be Prohibited Pattern P1. This is accepted as a narrow, explicitly documented exception (not a precedent for other modules) because: (a) the alternative is Documents.getSomeSearchMethod() being called by every internal search consumer, which just relocates the same coupling one module over without solving anything; (b) the `tsvector` column is, in effect, a derived/computed index over Documents data rather than a piece of business state Documents needs to protect access to; and (c) this exception is scoped to disappear in Phase 2 — once Meilisearch is introduced, Search Meta's own `search_meta` schema (the synced index) becomes the data Search Meta reads, and the cross-schema read into `documents.tsvector` is removed.
5. **Phase 1 Search Meta module footprint, concretely:** `Search Router` (exposes the endpoint to the Internal Web App, per B1 Module 9), `Search Abstraction Interface` (delegates to FTS in Phase 1, to Meilisearch in Phase 2 — already named as such in B1), and the FTS execution logic described above. The `Meilisearch Sync Worker` and `Index Job Manager` components (B1, Module 9) remain genuinely Phase 2-only — they have no Phase 1 role, since there is no second index to sync to yet.
6. **Phase 2 cutover becomes a configuration/internal-implementation change, not a call-site migration:** when Meilisearch is introduced, `SearchAbstraction.search()`'s internal delegation target switches from the FTS path to the Meilisearch Client path. Every caller across the codebase that already calls `SearchMeta.search()` — the Documents Router, and later the Portal REST Router in Phase 3 — needs zero changes. This is the migration-cleanliness benefit this ADR is choosing to pay for upfront.

## Consequences

- **Positive:** The Phase 2 migration to Meilisearch touches one module's internals (Search Meta) and zero call sites elsewhere in the codebase — fulfilling the Stack Context's "from day one" abstraction goal in practice, not just in stated intent.
- **Positive:** Consistent with this team's established pattern (per project history) of building configurable, properly-routed paths from the start rather than simplified shortcuts that need rework later (cf. the routed-approval-over-simplified-paths precedent already established for workflow steps).
- **Negative (accepted):** More Phase 1 implementation work than the zero-footprint alternative — a Search Router, an Abstraction Interface, and a Phase 1 FTS-execution component must all be built and tested in Phase 1, for a module whose only Phase 1 job is to wrap a single PostgreSQL query.
- **Negative (accepted, explicitly scoped):** A narrow, named exception to Law #2's no-cross-schema-read rule is introduced for Search Meta's Phase 1 read of `documents.tsvector`. This must be called out in B2's "Prohibited Patterns" section as an explicit, bounded exception (not a precedent), and is expected to be removed entirely once Phase 2's Meilisearch sync makes the `search_meta` schema itself the read target.
- **Follow-on requirement:** The Phase 2 rollout work for Search Meta must include removing the Phase 1 cross-schema-read exception as a named task, alongside standing up the Meilisearch Sync Worker and Index Job Manager — Phase 2 is not just "add Meilisearch," it is also "retire the Phase 1 carve-out."
