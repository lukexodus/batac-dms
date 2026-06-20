# J1 — Software Design Patterns _(filtered for J4)_

**Status:** Pre-Development Reference | Audience: Development Team **Stack baseline:** See `tech-stack.md` — Fastify + tRPC + Drizzle ORM + TanStack Query

---

## Purpose and Scope

This document defines the five mandatory patterns used in this codebase, how each pattern is implemented, and what is prohibited. Every developer contributing to this project must read this document before writing a single module file. Deviations require an ADR.

These patterns exist because the platform must:

- Remain testable in isolation at the repository and service levels
- Enforce module boundary isolation (no cross-schema reads; no direct service-to-service coupling for side effects)
- Give the workflow engine and audit log deterministic, auditable call sites

---

## Pattern Index

|#|Pattern|Primary concern|Files involved|
|---|---|---|---|
|1|Repository Pattern|Data access isolation per module|`{module}.repository.ts`|
|2|Service Layer Pattern|Business logic boundary|`{module}.service.ts`|
|3|Domain Event Pattern|Loose coupling between modules|`event-bus.ts`, `domain-events.ts`|
|4|Module Plugin Pattern|Fastify module encapsulation|`{module}.plugin.ts`|
|5|Query Key Factory Pattern|TanStack Query cache management|`query-keys/{module}.keys.ts`|

---

## 1. Repository Pattern

### What It Solves

Drizzle queries are data-access details. They must not appear in service files or route handlers. The repository is the only layer that knows about table names, column names, joins, and Drizzle-specific operators.

Each module owns exactly one repository. A module's repository queries only its own PostgreSQL schema. No repository ever queries another module's schema directly.

### Directory Placement

```
/apps/server/src/modules/{module-name}/
  {module}.repository.ts   ← Drizzle queries only
  {module}.types.ts        ← Domain types (aliased from Drizzle InferSelect where appropriate)
```

### Key Structural Rules

- A repository is a **factory function** (`createXxxRepository(db)`) that returns a typed interface. No classes. No decorators. No static methods.
- The repository interface must be defined as a TypeScript `interface`. The factory returns an object that satisfies it.
- Domain types (`DocumentRow`) must be exported from `{module}.types.ts`, not inlined in repository files.
- The `db` parameter type must be `DbClient | DbTransaction` so the same factory works inside or outside a transaction.
- The service layer (not the repository) creates transactions. The repository factory is called **inside** the transaction callback with the `tx` object.

---

## 2. Service Layer Pattern

### What It Solves

Services are where business logic lives. A tRPC procedure or REST route handler must not make business decisions — it translates HTTP/RPC input into service calls and returns the result. The service validates invariants, coordinates repositories, manages transactions, and emits domain events.

### Directory Placement

```
/apps/server/src/modules/{module-name}/
  {module}.service.ts    ← Business logic; calls repositories and other module services
```

### Key Structural Rules

- A service is a **factory function** (`createXxxService(deps)`) that receives dependencies via a typed `Deps` object. No classes.
- The service interface is defined separately for mocking in tests.
- The service creates transactions; repositories receive `tx`.
- Order within a service method: commit → audit → domain event emit.
- Typed error classes live in `{module}.errors.ts`.

### Where Services Are Consumed

tRPC procedures (`{module}.router.ts`) and REST route handlers (`{module}.routes.ts`) call services. They do nothing else business-related.

---

## 3. Domain Event Pattern

### What It Solves

Module A must not call Module B's service directly to trigger a side effect. The event bus inverts this — A emits a named event; B subscribes without A ever knowing B exists.

### Infrastructure Files

```
/apps/server/src/infrastructure/
  event-bus.ts        ← TypedEventBus class and singleton factory
  domain-events.ts    ← Master event registry (DomainEventMap type)
```

### Event Registry Structure

All event names and their payload types are declared in `domain-events.ts`. This is the type-safe contract between publishers and subscribers.

```
DomainEventMap key naming:
  {module-name}.{entity-name}.{verb-past-tense}

Examples:
  documents.document.logged
  documents.document.finalNumberAssigned
  workflow.instance.stepCompleted
  workflow.instance.slaBreached
  iam.delegation.granted
  tracking.qrCode.assigned
```

The module name prefix prevents cross-module name collisions. The verb must be past tense — events describe things that have already happened, not commands.

### Module-Level Event File

Each module re-exports the domain event keys it owns:

```
/apps/server/src/modules/{module-name}/
  {module}.events.ts   ← Re-exports the relevant DomainEventMap keys for this module;
                          registers subscriptions for events this module listens to
```

Subscriptions are registered in the subscribing module's plugin at initialization — never lazily at runtime.

### Key Structural Rules

- All event names and payload types must be declared in `domain-events.ts` before first use.
- Events fire **after** the primary transaction commits and after the audit log entry is written.
- Adding a new event type requires updating `DomainEventMap` — this is the only cross-module contract surface.

---

## 4. Module Plugin Pattern

### What It Solves

Fastify's native plugin system provides lexical scope isolation. This pattern is how each domain module is wired into the Fastify instance in a controlled, dependency-declared way.

- **With `fp` (fastify-plugin):** Decorations are visible to the parent and siblings — use this for the module plugin itself so `fastify.documentsService` is globally accessible.
- **Without `fp`:** Decorations stay scoped — use this for nested route registration so route-specific hooks don't leak globally.

### Directory Placement

```
/apps/server/src/modules/{module-name}/
  {module}.plugin.ts   ← Fastify plugin; wires repository + service + routes

/apps/server/src/app.ts  ← Registers all module plugins in dependency order
```

### Plugin Responsibilities (in order)

1. Instantiate the service via its factory, injecting `fastify.db`, `fastify.eventBus`, and any other decorated service dependencies.
2. Decorate the service onto `fastify` (`fastify.decorate('xxxService', service)`).
3. Attach the tRPC router for this module.
4. Register REST routes inside a **nested** `fastify.register()` scope (no `fp`).

### TypeScript Augmentation

Fastify decorations must be declared on the Fastify type interface in the module's type file:

```
/apps/server/src/modules/{module-name}/
  {module}.types.ts   ← Domain types + `declare module 'fastify'` augmentation
                         for FastifyInstance (service decoration + tRPC router type)
```

### Plugin Export Shape

```typescript
export default fp(xxxPlugin, {
  name: 'module-name',
  dependencies: ['database', 'event-bus', /* other module names */],
});
```

### App Registration Order

```
/apps/server/src/app.ts (registration order)

  Infrastructure:
    databasePlugin    ← no deps
    eventBusPlugin    ← no deps

  Modules (dependency order):
    auditPlugin       ← no module deps
    iamPlugin         ← database, audit
    organizationPlugin← database, audit, iam
    trackingPlugin    ← database, audit
    documentsPlugin   ← database, event-bus, tracking, audit
    workflowPlugin    ← database, event-bus, documents, audit
    notificationsPlugin← database, event-bus (subscriber only)

  Infrastructure (post-module):
    trpcPlugin        ← merges all module tRPC routers
```

### Infrastructure Plugin File Locations

```
/apps/server/src/infrastructure/
  database.plugin.ts    ← DB connection as Fastify decoration (fastify.db)
  event-bus.plugin.ts   ← TypedEventBus as Fastify decoration (fastify.eventBus)
```

---

## Appendix — Full Module File Structure Reference

A complete module, fully conforming to all five patterns:

```
/apps/server/src/modules/documents/
  documents.errors.ts       — Typed error classes (DocumentAlreadyFinalizedError, etc.)
  documents.events.ts       — Re-exports the relevant DomainEventMap keys for this module
  documents.plugin.ts       — Fastify plugin (fp-wrapped); wires everything together
  documents.repository.ts   — DocumentsRepository interface + createDocumentsRepository factory
  documents.router.ts       — tRPC router for /web (createDocumentsRouter)
  documents.routes.ts       — REST routes for external/portal API
  documents.service.ts      — DocumentsService interface + createDocumentsService factory
  documents.types.ts        — Domain types + Fastify module augmentation

/apps/server/src/infrastructure/
  database.plugin.ts        — DB connection as Fastify decoration
  event-bus.plugin.ts       — TypedEventBus as Fastify decoration
  domain-events.ts          — Master DomainEventMap type (all events declared here)
  event-bus.ts              — TypedEventBus class + getEventBus() singleton
```

> **Note:** `documents.schemas.ts` (Zod schemas not shared externally) is referenced in J4 but absent from this file structure. Shared schemas live in `/packages/shared/schemas/`. Module-private Zod schemas belong in `{module}.schemas.ts` alongside the other module files.