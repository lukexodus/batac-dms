# J4 — Module Structure Template

**Document ID:** J4
**Type:** Module Structure Reference
**Status:** Pre-Development
**Version:** 1.0
**Date:** June 2026
**Based on:** J1 (Software Design Patterns), B2 (Module Boundary and Internal API Contracts Extract), Consolidated Architecture & Requirements Reference (Iteration 3)
**Audience:** Development team — internal reference

> **Conflict note — `index.ts` role:** The J4 scope brief assigned "Fastify plugin registration" to `index.ts`. This conflicts with two source documents. B2 (Enforcement Mechanisms) states that `index.ts` is the Published API barrel file: it "exports **only** the Published API interface. Internal files, services, and repositories are not re-exported." J1 (§4 Module Plugin Pattern) places Fastify plugin registration in `{module}.plugin.ts`. This document follows J1 and B2. If the intent is to merge plugin registration into `index.ts`, that is a deviation and requires an ADR before implementation.

---

## Table of Contents

- [L38–L50] 1. Purpose and Scope — states the file layout applies to all 11 modules and that deviations require an ADR; points to J1/B2 for the underlying pattern rules.
- [L52–L72] 2. Canonical Module Folder Layout — the 10-file tree for the `documents` example, naming convention (module-name prefix, `index.ts` excepted), and file-count note.
- [L74–L335] 3. File Reference — per-file Role/Source/Key rules/Contains/Must-not-contain for all 10 files; parent section, see 3.1–3.10 below for individual files.
  - [L76–L99] 3.1 `index.ts` — Published API Barrel — barrel exports only the Published API and its types; explicitly forbids re-exporting services, repositories, or the Fastify plugin.
  - [L101–L140] 3.2 `documents.plugin.ts` — Fastify Plugin — `fp`-wrapped registration order (service → decorate → tRPC → nested REST), `dependencies` array, export shape example.
  - [L142–L168] 3.3 `documents.service.ts` — Service Layer — factory-function service holding business logic, transaction creation, and the commit → audit → emit ordering rule.
  - [L170–L193] 3.4 `documents.repository.ts` — Repository — Drizzle-only data access scoped to the `documents` schema; cross-schema queries explicitly prohibited.
  - [L195–L218] 3.5 `documents.events.ts` — Domain Events — re-exports event keys from the master `domain-events.ts` registry; new events require same-PR Audit consumer registration.
  - [L220–L247] 3.6 `documents.types.ts` — Domain Types — repository/service interfaces, Fastify augmentation; flags that "module-private" in the brief is only partially accurate since some types here are re-exported via `index.ts`.
  - [L249–L273] 3.7 `documents.schemas.ts` — Module-Private Zod Schemas — module-internal Zod only; shared schemas redirect to `/packages/shared/schemas/`; conditional, omittable if nothing is module-private.
  - [L275–L299] 3.8 `documents.router.ts` — tRPC Router — `/web` tRPC procedures that validate input and call the service only; maps typed domain errors to `TRPCError`.
  - [L301–L314] 3.9 `documents.routes.ts` — REST Routes — external/portal REST handlers nested in the plugin without `fp`; conditional, omitted if a module has no external REST surface.
  - [L316–L335] 3.10 `documents.errors.ts` — Typed Error Classes — named domain error classes thrown by the service and caught by the router/routes for protocol-level mapping.
- [L337–L354] 4. File Classification — Core vs. Conditional table for all 10 files plus the open [Inference] flag on whether `router.ts` is truly Core for every module.
- [L356–L374] 5. Module Applicability — all 11 modules with their schema name and delivery phase (1/2/3); notes Phase 2–3 schemas are reserved early but code lands later.
- [L376–L390] 6. Infrastructure Files — Not Part of This Template — lists the 4 infra-level files (`domain-events.ts`, `event-bus.ts`, two `.plugin.ts` files) that are not created per module.
- [L392–L403] 7. Relationship to Other Documents — table mapping J1/B2/Consolidated Reference/shared-schemas/domain-events/app.ts to what each is authoritative for relative to this document.
- [L405–L417] 8. Deviation Policy — five example changes (new file type, file merges, moving the plugin into `index.ts`, etc.) that require an ADR before implementation.

---

## 1. Purpose and Scope

This document defines the canonical folder and file layout for all server-side modules under:

```
/apps/server/src/modules/{module-name}/
```

The `documents` module is used as the reference example throughout. All 11 modules follow this structure. **Deviations require an ADR.**

This document names the files and defines the role, permitted contents, and key structural rules of each. For the full pattern specifications (Repository Pattern, Service Layer Pattern, Domain Event Pattern, Module Plugin Pattern, Query Key Factory Pattern), see **J1 — Software Design Patterns**. For cross-module communication contracts, event tables, and the Published API surface per module, see **B2 — Module Boundary and Internal API Contracts**.

---

## 2. Canonical Module Folder Layout

```
/apps/server/src/modules/documents/
  index.ts                     ← Published API barrel; the only file other modules may import
  documents.errors.ts          ← Typed domain error classes
  documents.events.ts          ← Re-exports owned event keys; registers subscriptions
  documents.plugin.ts          ← Fastify plugin (fp-wrapped); wires the module into Fastify
  documents.repository.ts      ← Drizzle queries; data access only; documents schema only
  documents.router.ts          ← tRPC router for /web (internal authenticated SPA)
  documents.routes.ts          ← REST routes for external/portal-facing API
  documents.schemas.ts         ← Module-private Zod schemas not shared externally
  documents.service.ts         ← Business logic; transaction management; event emission
  documents.types.ts           ← Domain types; repository/service interfaces; Fastify augmentation
```

**File naming convention:** Every file inside a module folder carries the module name as a prefix (`documents.repository.ts`, not `repository.ts`). The one exception is `index.ts`, which has no prefix by convention — it is the module's public surface.

**Total files:** 10 per module at full build. Not all files are required for every module — see §4 (Core vs Conditional classification).

---

## 3. File Reference

### 3.1 `index.ts` — Published API Barrel

**Role:** The module's only permitted export point for other modules. Exports the Published API interface and the cross-module types callers need to consume it. Contains no implementation code.

**Source:** B2 — Enforcement Mechanisms.

**Key rules:**

- Exports **only** the Published API interface and associated public types. Internal files, services, repositories, and schemas are never re-exported from this file.
- The automated coupling test suite rejects any import of `modules/documents/src/...` in another module's source. The only permitted cross-module import path is `modules/documents/index.ts`. (B2 — Prohibited Pattern P2)
- Any new type added to the Published API surface must be declared in `documents.types.ts` and re-exported here.

**Contains:**
- The `DocumentsPublicAPI` interface (declared in `documents.types.ts` and re-exported here, or declared directly if brief)
- Named exports of public-facing types (e.g., `DocumentSummary`, `DocumentLifecycleState`, `AttachmentRef`) that cross-module callers need to use the Published API

**Must not contain:**
- Service factory functions or implementations
- Repository factory functions or implementations
- Drizzle schema references
- Fastify plugin registration
- Module-private types that have no Published API use

---

### 3.2 `documents.plugin.ts` — Fastify Plugin

**Role:** Wires the module into the Fastify instance. Wrapped with `fastify-plugin` (`fp`) so its decorations are visible to the parent scope and sibling plugins. This is the module's entry point for Fastify registration.

**Source:** J1 — §4 Module Plugin Pattern.

**Key rules:**

- Plugin responsibilities execute in this order:
  1. Instantiate the service via its factory, injecting `fastify.db`, `fastify.eventBus`, and any upstream module services already decorated onto `fastify`.
  2. Decorate the service onto `fastify` (`fastify.decorate('documentsService', service)`).
  3. Attach the tRPC router for this module.
  4. Register REST routes inside a **nested** `fastify.register()` scope **without** `fp` — route-specific hooks must not leak to sibling plugins.

- Plugin export shape:
  ```typescript
  export default fp(documentsPlugin, {
    name: 'documents',
    dependencies: ['database', 'event-bus', 'tracking', 'audit'],
  });
  ```

- Registration order is declared in `dependencies`. The Fastify runtime enforces that all named plugins are registered before this one.

- The global registration order across all modules is managed in `/apps/server/src/app.ts`.

**Contains:**
- The plugin function and its `fp` wrapper
- `dependencies` array listing all prerequisite plugin names
- Service instantiation via `createDocumentsService(deps)`
- `fastify.decorate('documentsService', service)` call
- tRPC router attachment
- `fastify.register(documentsRoutes)` call (nested, no `fp`)

**Must not contain:**
- Business logic
- Drizzle queries
- Domain event emits

---

### 3.3 `documents.service.ts` — Service Layer

**Role:** Business logic boundary. The only layer that validates domain invariants, coordinates repositories, manages transactions, and emits domain events.

**Source:** J1 — §2 Service Layer Pattern.

**Key rules:**

- A service is a **factory function** (`createDocumentsService(deps: DocumentsServiceDeps)`) that receives all dependencies through a typed `Deps` object. No classes, no decorators.
- The `DocumentsService` interface is defined in `documents.types.ts` and used for mocking in tests.
- The service creates transactions. The repository factory is called **inside** the transaction callback with the `tx` object — the repository does not create transactions.
- Required operation order within any service method that mutates state: commit database write → write audit log entry → emit domain event.
- Domain error classes are imported from `documents.errors.ts` and thrown to signal expected failure states.

**Contains:**
- `createDocumentsService(deps: DocumentsServiceDeps)` factory function
- Business invariant validation
- Transaction creation and repository coordination
- Post-commit audit log writes (via `Audit.writeEvent()` or event bus — see B2 §Audit)
- Domain event emits after commit and after audit write

**Must not contain:**
- Drizzle queries (all queries delegate to the repository)
- Route-level input parsing
- HTTP status codes or tRPC error codes (those are the router's concern)

---

### 3.4 `documents.repository.ts` — Repository

**Role:** The only layer with knowledge of table names, column names, joins, and Drizzle-specific operators. Queries only the `documents` PostgreSQL schema.

**Source:** J1 — §1 Repository Pattern.

**Key rules:**

- A repository is a **factory function** (`createDocumentsRepository(db: DbClient | DbTransaction)`) that returns a typed interface. No classes, no static methods.
- The `DocumentsRepository` interface is defined in `documents.types.ts`. The factory returns an object satisfying it.
- The `db` parameter type must be `DbClient | DbTransaction` so the same factory works inside or outside a transaction.
- **Cross-schema queries are prohibited.** This repository queries the `documents` schema only. Any data from another module's schema must be obtained through that module's Published API.

**Contains:**
- `createDocumentsRepository(db: DbClient | DbTransaction)` factory function
- All Drizzle query implementations for the `documents` schema

**Must not contain:**
- Business logic or invariant validation
- Transaction creation
- Queries against any schema other than `documents`
- Domain event emits

---

### 3.5 `documents.events.ts` — Domain Events

**Role:** Re-exports the domain event keys this module owns. Registers the event subscriptions this module listens to (called once at plugin initialization, never lazily).

**Source:** J1 — §3 Domain Event Pattern.

**Key rules:**

- All event names and their payload types are declared in the master registry at `/apps/server/src/infrastructure/domain-events.ts`. This file re-exports from there; it does not declare new event types.
- Any new event type this module introduces requires a corresponding update to `domain-events.ts`. That update and the new event's first use must be in the same PR.
- Event key naming: `{module-name}.{entity-name}.{verb-past-tense}` (e.g., `documents.document.created`, `documents.document.stateChanged`).
- Any new event added to this module must also be registered with the Audit module's consumer in the same PR (B2 — §Module 8 Audit rule).
- Events fire **after** the primary transaction commits and after the audit log entry is written. This ordering is enforced in the service layer — not here.

**Contains:**
- Named re-exports of the event key constants this module publishes (e.g., `export { DOCUMENT_CREATED } from '../../infrastructure/domain-events'`)
- Subscription registration logic for events this module consumes, called from the plugin at initialization time

**Must not contain:**
- New event type declarations (all event types go in `domain-events.ts`)
- Business logic triggered by events (that belongs in service methods called from the subscription handler)
- Runtime subscription registration (all subscriptions registered at initialization)

---

### 3.6 `documents.types.ts` — Domain Types

**Role:** Domain types for this module. Holds repository and service interfaces, domain row types, and the Fastify module augmentation that makes `fastify.documentsService` type-safe. Types that are part of the Published API surface are declared here and re-exported through `index.ts`.

**Source:** J1 — §1, §2, §4.

**Key rules:**

- Domain types (`DocumentRow`, `DocumentSummary`) are exported from this file, not inlined in repository or service files.
- The `DocumentsRepository` interface (the typed return shape of `createDocumentsRepository`) is declared here.
- The `DocumentsService` interface (the typed return shape of `createDocumentsService`) is declared here, to allow mocking in tests.
- The `declare module 'fastify'` augmentation block lives here. It declares the service decoration on `FastifyInstance` so TypeScript recognizes `fastify.documentsService` throughout the app.

> **Note on "module-private" scope:** The J4 scope brief described `types.ts` as holding "module-private types." This is partially accurate — many types here are internal. However, types that are part of the Published API (e.g., `DocumentSummary`) are declared here and re-exported through `index.ts` for cross-module use. Not all types in this file are private. [Inference — the precise split between public and private types in `types.ts` will be determined per module.]

**Contains:**
- Domain types and Drizzle-inferred row types (`type DocumentRow = typeof documents.$inferSelect`)
- `DocumentsRepository` interface
- `DocumentsService` interface
- `DocumentsServiceDeps` type
- `declare module 'fastify'` augmentation for `FastifyInstance`
- Any other module-internal type that does not warrant its own file

**Must not contain:**
- Zod schemas (those live in `documents.schemas.ts` or `/packages/shared/schemas/`)
- Implementation code

---

### 3.7 `documents.schemas.ts` — Module-Private Zod Schemas

**Role:** Zod schemas used only within this module. Input validation for tRPC procedures and REST route handlers that does not belong in `/packages/shared/schemas/`.

**Source:** J1 — §1 Appendix note.

> From J1: "Shared schemas live in `/packages/shared/schemas/`. Module-private Zod schemas belong in `{module}.schemas.ts` alongside the other module files."

**Key rules:**

- If a Zod schema is consumed by more than one module or by the `/apps/web` package, it belongs in `/packages/shared/schemas/`, not here.
- Schemas here are module-internal. They are not re-exported through `index.ts`.

**Contains:**
- Zod schemas for tRPC procedure input validation
- Zod schemas for REST request body and query parameter validation
- TypeScript types derived via `z.infer<typeof ...>`

**Must not contain:**
- Schemas intended for cross-module or cross-package use (those go in `/packages/shared/schemas/`)
- Business logic

**Conditional:** If all of this module's Zod schemas are shared and live in `/packages/shared/schemas/`, this file may be omitted. See §4.

---

### 3.8 `documents.router.ts` — tRPC Router

**Role:** tRPC procedure definitions for the `/web` internal authenticated SPA. Translates tRPC input into service calls and returns results. Contains no business logic.

**Source:** J1 — §2 Service Layer Pattern (service consumption); §4 Module Plugin Pattern (attachment).

**Key rules:**

- A procedure validates input (using Zod schemas from `documents.schemas.ts` or `/packages/shared/schemas/`) and then calls the corresponding service method.
- The procedure does nothing business-related beyond calling the service and returning the result.
- Typed domain errors from `documents.errors.ts` are caught here and mapped to tRPC `TRPCError` with appropriate codes.
- Export shape: `createDocumentsRouter(fastify: FastifyInstance)` factory function.

**Contains:**
- tRPC procedure definitions (`query`, `mutation`)
- Input validation via Zod
- Calls to `fastify.documentsService.*`
- Error mapping from domain error classes to `TRPCError`

**Must not contain:**
- Business logic
- Direct repository calls
- Drizzle queries

---

### 3.9 `documents.routes.ts` — REST Routes

**Role:** REST route handlers for external-facing or portal-facing API endpoints. Registered inside a nested `fastify.register()` scope (without `fp`) in the plugin, so route-specific hooks do not leak to sibling plugins.

**Source:** J1 — §4 Module Plugin Pattern.

**Key rules:**

- Route handlers call services only. No direct repository calls.
- Registered as a nested plugin (without `fp`) — route-level hooks stay scoped.

**Conditional:** Not all modules require REST routes. A module serving only the internal `/web` SPA may expose all endpoints via tRPC with no REST surface. If a module has no external REST API, this file is omitted. See §4.

---

### 3.10 `documents.errors.ts` — Typed Error Classes

**Role:** Typed, named error classes for domain violations and expected failure states. Used by the service layer to signal specific error conditions to callers.

**Source:** J1 — §2 Service Layer Pattern.

**Key rules:**

- The service layer throws these errors to signal domain violations (e.g., attempting to finalize a document already in a terminal state).
- Route handlers (tRPC router, REST routes) catch typed errors and map them to appropriate protocol-level error responses.

**Contains:**
- Named error classes extending a base error (e.g., `DocumentAlreadyFinalizedError`, `DocumentNotFoundError`)
- Error codes or message templates where applicable

**Must not contain:**
- Business logic
- Database queries

---

## 4. File Classification

| File | Classification | Omit when |
|------|---------------|-----------|
| `index.ts` | Core | — Required for all modules |
| `{module}.plugin.ts` | Core | — Required for all modules |
| `{module}.service.ts` | Core | — Required for all modules |
| `{module}.repository.ts` | Core | — Required for all modules |
| `{module}.types.ts` | Core | — Required for all modules |
| `{module}.events.ts` | Core | — Required for all modules |
| `{module}.errors.ts` | Core | — Required for all modules |
| `{module}.router.ts` | Core | [Inference] Module has no tRPC surface for `/web` |
| `{module}.routes.ts` | Conditional | Module has no external REST surface |
| `{module}.schemas.ts` | Conditional | All schemas live in `/packages/shared/schemas/` |

> **[Inference — `router.ts` classification]:** Whether every module requires a `router.ts` is not explicitly confirmed in J1 or B2. Some modules (e.g., `notifications`, `audit`, `tracking`) are primarily consumed via Published API or domain events rather than direct user interaction. The Core classification for `router.ts` is a reasonable inference from the architecture; it should be confirmed per module before scaffolding.

---

## 5. Module Applicability

| Module | Schema | Phase |
|--------|--------|-------|
| `iam` | `iam` | 1 |
| `organization` | `organization` | 1 |
| `documents` | `documents` | 1 |
| `workflow` | `workflow` | 1 |
| `tracking` | `tracking` | 1 |
| `notifications` | `notifications` | 1 |
| `audit` | `audit` | 1 |
| `records` | `records` | 2 (schema reserved in Phase 1) |
| `search_meta` | `search_meta` | 2 (schema reserved in Phase 1) |
| `reporting` | `reporting` | 2 |
| `portal` | `portal` | 3 |

Phase 2 and Phase 3 modules follow this same file structure. Their schemas are reserved in Phase 1 migrations; module code is not added until the relevant phase begins.

> **`search_meta` Phase 1 exception `[ADR-B2-5]`:** Although the full `search_meta` module (schema, Meilisearch sync jobs, admin UI) is Phase 2, ADR-B2-5 requires a thin `SearchMeta.search()` pass-through interface to exist in Phase 1 so that all FTS call sites are routed through a stable abstraction from the start. This Phase 1 stub is **not** a separate module folder under `modules/search_meta/` — it lives in the `documents` module's service layer (`documents.service.ts`) as a local utility that calls into the PostgreSQL FTS GIN indexes directly. When Phase 2 begins, this stub is extracted into the full `modules/search_meta/` folder per this template; callers do not change because the interface contract (`SearchMeta.search(queryText, filters, callerContext)`) is preserved.

---

## 6. Infrastructure Files — Not Part of This Template

The following files are infrastructure-level, not module-level, and are not created per module:

```
/apps/server/src/infrastructure/
  domain-events.ts      ← Master DomainEventMap type (all event names and payloads declared here)
  event-bus.ts          ← TypedEventBus class + getEventBus() singleton
  database.plugin.ts    ← DB connection as Fastify decoration (fastify.db)
  event-bus.plugin.ts   ← TypedEventBus as Fastify decoration (fastify.eventBus)
```

`{module}.events.ts` re-exports from `domain-events.ts`. It does not add new event type declarations.

---

## 7. Relationship to Other Documents

| Document | Relationship |
|----------|-------------|
| J1 — Software Design Patterns | Authoritative source for the five mandatory patterns implemented in each file. J4 names the files; J1 defines the rules inside them. |
| B2 — Module Boundary and Internal API Contracts | Authoritative source for the `index.ts` barrel rule, the Published API surface per module, event tables, and the P2 cross-module import prohibition. |
| Consolidated Architecture & Requirements Reference | Architectural Laws 1–3 are the high-level constraints this file layout enforces. Database conventions in §11.9 apply to all repository files. |
| `/packages/shared/schemas/` | Home for Zod schemas shared across modules or packages. Module-private schemas belong in `{module}.schemas.ts`, not here. |
| `/apps/server/src/infrastructure/domain-events.ts` | Master event registry. `{module}.events.ts` re-exports from here; it does not declare new event types locally. |
| `/apps/server/src/app.ts` | Registers all module plugins in declared dependency order. The registration order is defined there, not in individual plugin files. |

---

## 8. Deviation Policy

Deviations from this file structure require an ADR before implementation. Examples of changes that require an ADR:

- Adding a new file type to the module folder
- Merging two files (e.g., combining `service.ts` and `repository.ts`)
- Placing the Fastify plugin in `index.ts` instead of `{module}.plugin.ts`
- Changing `index.ts` to export internal implementation details
- Splitting a module into sub-folders

---

*End of document. Pending review before first module scaffold.*