# ADR-API-006: Published API Versioning and Deprecation

**Status:** Accepted
**Date:** June 2026
**Decided by:** Luke (stakeholder/architect decision — team process choice with no source-document precedent)
**Related documents:** B2 — Module Boundary and Internal API Contracts, "Enforcement Model" and "Prohibited Patterns" (P5, P6)

---

## Context

B2's Prohibited Patterns already flag two related but distinct violations:

- **P5 — Published API extension without table update:** adding a method without updating the API Call Matrix and documenting the new caller.
- **P6 — Caller not in API Call Matrix:** calling a method without that caller being listed.

Neither addresses the reverse situation: **removing or changing the signature of an existing Published API method that already has confirmed callers.** B2's Required ADRs table (ADR-API-006) calls this out explicitly: _"Define how breaking changes to a Published API method are handled before the first inter-module API is deployed to production. Specifically: how is an old method signature deprecated, and how long must it coexist with the new signature."_

This is a pure process/policy decision with no technical correctness answer and no precedent in the source documents — it depends on team size, deployment model, and risk tolerance, all of which point toward a specific answer for this project: a 4-person team, a modular monolith (Consolidated Reference, Part 10.1), a single Fastify process (B1, Level 2 Container Diagram: _"Single process... Hosts all 11 domain modules"_), and a single deployable unit with no independent release trains per module. This is explicitly **not** a multi-team microservices organization where one team's API consumer might be on an older deployed version while the producer has already shipped a breaking change.

## Decision

**Breaking changes to a Published API method are made directly, in the same PR, with no versioned coexistence period.** There is no `getDocumentByIdV2` pattern, no deprecation window, and no requirement that an old method signature remain callable after a new one is introduced.

### Mechanics

1. When a Published API method's signature needs to change in a breaking way (parameter added/removed/retyped, return type changed, behavior changed in a way that existing callers depend on), the developer making the change **updates the method directly** in the module's `index.ts` barrel file and its implementation.
2. **The TypeScript compiler immediately surfaces every call site across the monorepo** that no longer type-checks against the new signature, because all internal modules are TypeScript and the Published API types flow through `/packages/shared` per the Type Safety Chain (Stack Context). There is no possibility of a caller silently continuing to use an old, incompatible signature at runtime, because the build does not succeed until every caller is updated.
3. **The same PR that changes the method signature also fixes every resulting caller**, found via the compiler error list. This is mechanically straightforward in a monorepo with pnpm workspaces and Turborepo (Consolidated Reference, Part 9) — there is one source tree, one `tsc` run, one PR.
4. **The automated coupling test suite and the Published API Call Matrix update requirement (already mandated by P5/P6) apply unchanged:** the same PR that breaks and fixes the signature must also update the API Call Matrix entry for that method and confirm every listed caller is still accurate. A signature change is, in effect, treated the same as P5's "extension" case — the matrix entry is corrected in the same PR as the code change, just for a modification rather than an addition.
5. **No `schemaVersion`-style versioning applies to Published API methods.** (`schemaVersion` in the Common Event Envelope is a distinct concept that applies to **event payloads** on the async bus, where a publisher and a not-yet-redeployed subscriber could genuinely be running different code versions momentarily during a rolling restart. Published API methods are synchronous, in-process, same-deployment calls — there is no "old version still running somewhere" scenario for them, because the entire application is one process deployed atomically.)
6. **Exception — none.** This ADR does not carve out a softer path for any module. Every Published API method, in every module, is governed by this same break-and-fix-atomically rule. If a future circumstance arose where this team needed independent deployability of modules (e.g. extracting a module to a separate service per the modular monolith's stated extraction path, Consolidated Reference Part 10.1), **that circumstance would itself require revisiting this ADR** — the single-process assumption underlying this decision would no longer hold, and a versioning scheme would become necessary at that point, not before.

## Consequences

- **Positive:** Zero process overhead for the common case of evolving an internal API. No "maintain two signatures for N releases" bookkeeping, no tracking which callers have migrated, no stale `V1` methods lingering in the codebase because nobody got around to removing them.
- **Positive:** The compiler does the verification work that a deprecation-window process would otherwise need manual tracking for — every caller is provably updated before merge, not "should have been updated by the deprecation deadline."
- **Positive:** Matches the team's actual deployment reality (single process, single deploy) rather than importing process overhead designed for a different organizational shape (independent services, independent release cadence) that doesn't apply here.
- **Negative (accepted):** A single breaking-change PR to a heavily-called method (e.g. `IAM.evaluatePolicy()`, called by "every module") could touch many files at once. This is accepted as a one-time cost per breaking change, not an ongoing one, and is exactly the kind of large-but-mechanical change a small team with full compiler support can execute safely in one sitting.
- **Negative (accepted):** This approach does not generalize if the architecture is later decomposed into independently deployable services (the stated long-term extraction path). This is explicitly flagged in the Decision section above as a trigger for revisiting this ADR, not a flaw in the ADR as written for the current architecture.
- **Documentation requirement:** This ADR's rule supersedes any future temptation to introduce ad hoc versioned methods "just to be safe" — if a developer is tempted to add a `V2` suffix, that should be read as a signal to re-read this ADR and confirm whether circumstances have actually changed (i.e., is this module being extracted to a separate deployable), rather than defaulting to versioning out of habit from other (non-monolith) projects.
