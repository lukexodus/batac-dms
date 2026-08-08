# J1 — Software Design Patterns

**Status:** Pre-Development Reference | Audience: Development Team
**Stack baseline:** See `tech-stack.md` — Fastify + tRPC + Drizzle ORM + TanStack Query

## Table of Contents

- [L59–L71] Purpose and Scope — Mandatory codebase patterns, system objectives (isolation, auditability), and architectural deviation (ADR) requirement.
- [L72–L83] Pattern Index — Quick-reference table listing the five design patterns, their primary concerns, and associated file naming conventions.
- [L84–L259] 1. Repository Pattern
  - [L86–L91] What It Solves — Ensuring cache invalidation consistency via tRPC useUtils and hierarchical REST query key factories.
  - [L92–L99] Directory Placement — File path conventions for hierarchical REST query key files and shared tRPC invalidation helpers.
  - [L100–L209] Canonical Implementation — Standard plugin wiring, including global service decoration, tRPC router mapping, and nested REST routing.
  - [L210–L229] Transaction Support — Executing repository operations within service-managed transactions by passing the transaction context.
  - [L230–L239] Concurrency Control: Advisory Locks vs. Row Locks
  - [L240–L247] Rules — Mandatory caching rules including tRPC-REST division, as const tuple returns, and unique root keys.
  - [L248–L259] Prohibitions — Prohibitions against inline query key literals, tRPC custom keys, global invalidations, and mutable keys.
- [L260–L487] 2. Service Layer Pattern
  - [L262–L265] What It Solves — Ensuring cache invalidation consistency via tRPC useUtils and hierarchical REST query key factories.
  - [L266–L272] Directory Placement — File path conventions for hierarchical REST query key files and shared tRPC invalidation helpers.
  - [L273–L415] Canonical Implementation — Standard plugin wiring, including global service decoration, tRPC router mapping, and nested REST routing.
  - [L416–L467] Where Services Are Consumed — Consuming services exclusively inside tRPC procedures and Fastify REST route handlers.
  - [L468–L475] Rules — Mandatory caching rules including tRPC-REST division, as const tuple returns, and unique root keys.
  - [L476–L487] Prohibitions — Prohibitions against inline query key literals, tRPC custom keys, global invalidations, and mutable keys.
- [L488–L713] 3. Domain Event Pattern
  - [L490–L495] What It Solves — Ensuring cache invalidation consistency via tRPC useUtils and hierarchical REST query key factories.
  - [L496–L503] Infrastructure Files — Target paths for the event registry and the TypedEventBus infrastructure files.
  - [L504–L558] Canonical Implementation — Event Registry — Standard plugin wiring, including global service decoration, tRPC router mapping, and nested REST routing.
  - [L559–L633] Canonical Implementation — TypedEventBus — Standard plugin wiring, including global service decoration, tRPC router mapping, and nested REST routing.
  - [L634–L661] How a Module Subscribes — Registering event handlers inside module plugins during Fastify server startup.
  - [L662–L689] Event Naming Convention — Naming conventions enforcing lowercase module namespaces and past-tense verbs for event identifiers.
  - [L690–L701] Rules — Mandatory caching rules including tRPC-REST division, as const tuple returns, and unique root keys.
  - [L702–L713] Prohibitions — Prohibitions against inline query key literals, tRPC custom keys, global invalidations, and mutable keys.
- [L714–L909] 4. Module Plugin Pattern
  - [L716–L719] What It Solves — Ensuring cache invalidation consistency via tRPC useUtils and hierarchical REST query key factories.
  - [L720–L727] Key Fastify Behavior to Understand — Lexical scope differences between Fastify's encapsulated plugins and global plugins wrapped with fastify-plugin.
  - [L728–L738] Directory Placement — File path conventions for hierarchical REST query key files and shared tRPC invalidation helpers.
  - [L739–L793] Canonical Implementation — Standard plugin wiring, including global service decoration, tRPC router mapping, and nested REST routing.
  - [L794–L811] TypeScript Augmentation — Extending FastifyInstance types with module service and router signatures for type safety.
  - [L812–L852] App Registration Order — Declaring and ordering module registration, starting with infrastructure followed by dependency-sequenced modules.
  - [L853–L889] Infrastructure Plugin Example — Concrete code example showing database connection decorator and connection cleanup hooks.
  - [L890–L897] Rules — Mandatory caching rules including tRPC-REST division, as const tuple returns, and unique root keys.
  - [L898–L909] Prohibitions — Prohibitions against inline query key literals, tRPC custom keys, global invalidations, and mutable keys.
- [L910–L1143] 5. Query Key Factory Pattern
  - [L912–L921] What It Solves — Ensuring cache invalidation consistency via tRPC useUtils and hierarchical REST query key factories.
  - [L922–L934] Directory Placement — File path conventions for hierarchical REST query key files and shared tRPC invalidation helpers.
  - [L935–L1014] Tier 1 — tRPC Cache Invalidation via `useUtils` — tRPC Cache Invalidation via `useUtils` — Creating custom hooks to bundle related tRPC query invalidations inside useMutation success callbacks.
  - [L1015–L1105] Tier 2 — Explicit Query Keys for REST Calls — Explicit Query Keys for REST Calls — Defining type-safe, hierarchical query key factories using as const tuples for REST endpoints.
  - [L1106–L1123] Hierarchical Invalidation — Targeting cache invalidations at specific resources, full listing arrays, or entire domain scopes.
  - [L1124–L1131] Rules — Mandatory caching rules including tRPC-REST division, as const tuple returns, and unique root keys.
  - [L1132–L1143] Prohibitions — Prohibitions against inline query key literals, tRPC custom keys, global invalidations, and mutable keys.
- [L1144–L1225] 6. How the Patterns Compose — End-to-end execution trace and mapping table showing how all five patterns coordinate during operations.
- [L1226–L1255] Appendix — File Structure Reference — File Structure Reference — Complete list of files and folder paths required to implement a fully conforming module.

---

---

## Purpose and Scope

This document defines the five mandatory patterns used in this codebase, how each pattern is implemented, and what is prohibited. Every developer contributing to this project must read this document before writing a single module file. Deviations require an ADR.

These patterns exist because the platform must:
- Remain testable in isolation at the repository and service levels
- Enforce module boundary isolation (no cross-schema reads; no direct service-to-service coupling for side effects)
- Give the workflow engine and audit log deterministic, auditable call sites

The patterns are not optional style preferences. They are the structural constraint that keeps a modular monolith from becoming a tangle at scale.

---

## Pattern Index

| # | Pattern | Primary concern | Files involved |
|---|---|---|---|
| 1 | Repository Pattern | Data access isolation per module | `{module}.repository.ts` |
| 2 | Service Layer Pattern | Business logic boundary | `{module}.service.ts` |
| 3 | Domain Event Pattern | Loose coupling between modules | `event-bus.ts`, `event-payload-map.ts` |
| 4 | Module Plugin Pattern | Fastify module encapsulation | `{module}.plugin.ts` |
| 5 | Query Key Factory Pattern | TanStack Query cache management | `query-keys/{module}.keys.ts` |

---

## 1. Repository Pattern

### What It Solves

Drizzle queries are data-access details. They must not appear in service files or route handlers. The repository is the only layer that knows about table names, column names, joins, and Drizzle-specific operators. If Drizzle is ever swapped, only repository files change.

Each module owns exactly one repository. A module's repository queries only its own PostgreSQL schema. No repository ever queries another module's schema directly.

### Directory Placement

```
/apps/server/src/modules/{module-name}/
  {module}.repository.ts   ← Drizzle queries only
  {module}.types.ts        ← Domain types (aliased from Drizzle InferSelect where appropriate)
```

### Canonical Implementation

A repository is a **factory function** that receives a `db` reference (either the main Drizzle client or a transaction object) and returns a typed interface. No classes. No decorators. No static methods.

```typescript
// /apps/server/src/modules/documents/documents.repository.ts

import { and, desc, eq, isNull } from 'drizzle-orm';
import type { DbClient, DbTransaction } from '@batac/database';
import { documents, documentVersions, numberSeries } from '@batac/database/schema/documents';
import type {
  DocumentRow,
  DocumentVersionRow,
  CreateDocumentInput,
  UpdateDocumentStatusInput,
} from './documents.types';

// ─── Interface ───────────────────────────────────────────────────────────────
// Always define the interface separately. Tests mock against this type,
// not against the concrete factory return.

export interface DocumentsRepository {
  findById(id: string): Promise<DocumentRow | null>;
  findByTrackingId(trackingId: string): Promise<DocumentRow | null>;
  findByPreliminaryNumber(series: string, year: number, seq: number): Promise<DocumentRow | null>;
  listByOffice(officeId: string, limit: number, offset: number): Promise<DocumentRow[]>;
  create(input: CreateDocumentInput): Promise<DocumentRow>;
  updateStatus(input: UpdateDocumentStatusInput): Promise<DocumentRow>;
  softDelete(id: string, deletedBy: string): Promise<void>;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDocumentsRepository(db: DbClient | DbTransaction): DocumentsRepository {
  return {
    async findById(id) {
      const result = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findByTrackingId(trackingId) {
      const result = await db
        .select()
        .from(documents)
        .where(and(eq(documents.qrTrackingId, trackingId), isNull(documents.deletedAt)))
        .limit(1);
      return result[0] ?? null;
    },

    async findByPreliminaryNumber(series, year, seq) {
      const result = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.numberSeriesId, series),
            eq(documents.preliminaryYear, year),
            eq(documents.preliminarySeq, seq),
            isNull(documents.deletedAt),
          ),
        )
        .limit(1);
      return result[0] ?? null;
    },

    async listByOffice(officeId, limit, offset) {
      return db
        .select()
        .from(documents)
        .where(and(eq(documents.originatingOfficeId, officeId), isNull(documents.deletedAt)))
        .orderBy(desc(documents.createdAt))
        .limit(limit)
        .offset(offset);
    },

    async create(input) {
      const result = await db
        .insert(documents)
        .values({
          ...input,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return result[0];
    },

    async updateStatus(input) {
      const result = await db
        .update(documents)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(documents.id, input.id))
        .returning();
      return result[0];
    },

    async softDelete(id, deletedBy) {
      await db
        .update(documents)
        .set({ deletedAt: new Date(), deletedBy })
        .where(eq(documents.id, id));
    },
  };
}
```

### Transaction Support

The service layer (not the repository) creates transactions. The same repository factory is called **inside** the transaction callback with the `tx` object:

```typescript
// In a service function — the service owns the transaction boundary:
async function logDocumentAndAssignTracking(input: LogDocumentInput) {
  return db.transaction(async (tx) => {
    const docRepo = createDocumentsRepository(tx);       // ← tx, not db
    const trackingRepo = createTrackingRepository(tx);   // ← same tx

    const document = await docRepo.create(input.document);
    const qrCode = await trackingRepo.createQrCode({ documentId: document.id });

    return { document, qrCode };
  });
  // Domain events emitted AFTER the transaction commits (see Pattern 3)
}
```

### Concurrency Control: Advisory Locks vs. Row Locks

The default approach to serializing concurrent writes within a repository method is a row-level lock — Drizzle's `.for('update')`, which generates `SELECT ... FOR UPDATE`. This requires the `UPDATE` privilege on the locked table for the connecting role.

Some database roles intentionally do not have `UPDATE` on the tables they write to. `batac_audit`, for example, has `UPDATE` and `DELETE` revoked on `audit.events` by design (Security Invariant #3; I3 §16), since audit rows must be append-only at the database role level. A repository method running as that role cannot use `.for('update')` on that table — PostgreSQL rejects it with a permission error.

In that situation, use a PostgreSQL advisory lock instead: `pg_advisory_xact_lock(<key>)`, scoped to the current transaction. Advisory locks are not tied to a specific row and do not require any table privilege — only the ability to call the lock function, which any role has by default. `AuditRepository` uses this pattern to serialize chain-hash computation on `audit.events` without granting `UPDATE` to `batac_audit` (ADR-GEN-013).

Advisory locks are a cooperative convention, not an enforced constraint — any other code path that writes to the same table without taking the same lock is not serialized against it. Use a row lock by default; reach for an advisory lock only when a row lock is unavailable for a documented reason (such as a revoked grant), and reference the deciding ADR in a comment at the call site.

### Rules

- One repository per module. One module per schema.
- The repository interface must be defined as a TypeScript `interface`. The factory returns an object that satisfies it.
- Domain types (`DocumentRow`) must be exported from `{module}.types.ts`, not inlined in repository files.
- Soft-delete is the only deletion operation permitted. Every `DELETE` in a query is a lint error.
- The `db` parameter type must be `DbClient | DbTransaction` so the same factory works inside or outside a transaction.

### Prohibitions

| Prohibited | Why |
|---|---|
| `import { db } from '@batac/database'` inside a repository | Creates a module-level singleton. Breaks testability and prevents transaction injection. Always receive `db` as a parameter. |
| Queries against another module's schema | Violates module boundary. Go through that module's service instead. |
| Business logic (conditionals, calculations, domain rule checks) inside repository methods | The repository is dumb data access. If you find yourself writing `if (document.status === 'COMPLETED')` in a repository, that logic belongs in the service. |
| Raw SQL strings (`sql\`...\``) except as last resort | Use Drizzle operators. If a complex query genuinely requires raw SQL, document why in a comment and limit to one function. |
| Classes, decorators, or `new` keyword | Factory functions only. This aligns with the rest of the functional codebase style. |

---

## 2. Service Layer Pattern

### What It Solves

Services are where business logic lives. A tRPC procedure or REST route handler must not make business decisions — it translates HTTP/RPC input into service calls and returns the result. The service validates invariants, coordinates repositories, manages transactions, and emits domain events.

### Directory Placement

```
/apps/server/src/modules/{module-name}/
  {module}.service.ts    ← Business logic; calls repositories and other module services
```

### Canonical Implementation

A service is also a **factory function** that receives its dependencies via a typed `Deps` object. The service interface is defined separately for mocking in tests.

```typescript
// /apps/server/src/modules/documents/documents.service.ts

import type { DbClient } from '@batac/database';
import type { DocumentsRepository } from './documents.repository';
import { createDocumentsRepository } from './documents.repository';
import type { TrackingService } from '../tracking/tracking.service';
import type { AuditService } from '../audit/audit.service';
import type { TypedEventBus } from '../../infrastructure/event-bus';
import type { LogDocumentInput, LogDocumentResult, AssignFinalNumberInput } from './documents.types';
import { DocumentAlreadyFinalizedError, DuplicateFinalNumberError } from './documents.errors';

// ─── Interface ───────────────────────────────────────────────────────────────

export interface DocumentsService {
  /** Receives a draft from a Councilor; assigns QR tracking ID and preliminary number. */
  logDocument(input: LogDocumentInput): Promise<LogDocumentResult>;
  /** Assigns the final number after the last reading vote. Removes 'Draft' prefix. */
  assignFinalNumber(input: AssignFinalNumberInput): Promise<LogDocumentResult>;
}

// ─── Dependencies ────────────────────────────────────────────────────────────

interface DocumentsServiceDeps {
  db: DbClient;
  trackingService: TrackingService;
  auditService: AuditService;
  eventBus: TypedEventBus;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createDocumentsService(deps: DocumentsServiceDeps): DocumentsService {
  const { db, trackingService, auditService, eventBus } = deps;

  return {
    async logDocument(input) {
      // 1. Validate business invariants (not just types — Zod already did that).
      //    Example: check the series exists and is active for the current year.
      const series = await createDocumentsRepository(db).findSeriesById(input.numberSeriesId);
      if (!series || !series.isActive) {
        throw new Error(`Number series ${input.numberSeriesId} is inactive or not found`);
      }

      // 2. Coordinate across repositories within a single transaction.
      //    The service creates the transaction; repositories receive tx.
      const result = await db.transaction(async (tx) => {
        const docRepo = createDocumentsRepository(tx);

        const preliminarySeq = await docRepo.nextPreliminarySeq(input.numberSeriesId, input.year);
        const document = await docRepo.create({
          ...input.documentFields,
          numberSeriesId: input.numberSeriesId,
          preliminaryYear: input.year,
          preliminarySeq,
          status: 'SUBMITTED',
        });

        // 3. Coordinate with another module's repository via its service is WRONG.
        //    Instead, call the other module's service — but only if it does NOT
        //    need to share this transaction. QR assignment is a tracking concern.
        //    In this case we call trackingService.assignQrCode AFTER the transaction
        //    so the document ID is committed. See note below on transaction scope.
        return { document };
      });

      // 4. Cross-module side effects happen AFTER the transaction commits.
      //    If these fail, the document is already committed (and can be retried).
      await trackingService.assignQrCode({ documentId: result.document.id });
      await auditService.log({
        action: 'document.logged',
        actorId: input.actorId,
        entityId: result.document.id,
        entityType: 'document',
        payload: { documentType: input.documentFields.documentTypeId },
      });

      // 5. Emit domain event for any interested subscribers (notifications module, etc.)
      //    Fire after all synchronous work is done.
      eventBus.emit('documents.document.logged', {
        documentId: result.document.id,
        documentTypeId: input.documentFields.documentTypeId,
        originatingOfficeId: input.documentFields.originatingOfficeId,
        actorId: input.actorId,
      });

      return { document: result.document };
    },

    async assignFinalNumber(input) {
      const docRepo = createDocumentsRepository(db);

      // Business invariant: cannot finalize an already-finalized document.
      const document = await docRepo.findById(input.documentId);
      if (!document) throw new Error('Document not found');
      if (document.finalNumber !== null) {
        throw new DocumentAlreadyFinalizedError(input.documentId);
      }

      // Business invariant: final number must be unique in the series+year.
      const collision = await docRepo.findByFinalNumber(
        input.numberSeriesId,
        input.year,
        input.seq,
      );
      if (collision) {
        throw new DuplicateFinalNumberError(input.numberSeriesId, input.year, input.seq);
      }

      const updated = await db.transaction(async (tx) => {
        const repo = createDocumentsRepository(tx);
        return repo.setFinalNumber({
          documentId: input.documentId,
          seq: input.seq,
          year: input.year,
          assignedBy: input.actorId,
        });
      });

      await auditService.log({
        action: 'document.finalNumberAssigned',
        actorId: input.actorId,
        entityId: input.documentId,
        entityType: 'document',
        payload: { finalSeq: input.seq, year: input.year },
      });

      eventBus.emit('documents.document.finalNumberAssigned', {
        documentId: input.documentId,
        finalSeq: input.seq,
        actorId: input.actorId,
      });

      return { document: updated };
    },
  };
}
```

### Where Services Are Consumed

tRPC procedures and REST route handlers call services. They do nothing else business-related.

```typescript
// /apps/server/src/modules/documents/documents.router.ts (tRPC, for /web)

import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { logDocumentInputSchema } from '@batac/shared/schemas/documents';

export function createDocumentsRouter(documentsService: DocumentsService) {
  return router({
    logDocument: protectedProcedure
      .input(logDocumentInputSchema)
      .mutation(async ({ input, ctx }) => {
        // Handler does two things only: call service, return result.
        // No business logic here. No direct repository calls here.
        return documentsService.logDocument({
          ...input,
          actorId: ctx.session.userId,
        });
      }),
  });
}
```

```typescript
// /apps/server/src/modules/documents/documents.routes.ts (REST, for portal/external)

import type { FastifyInstance } from 'fastify';
import type { DocumentsService } from './documents.service';
import { logDocumentBodySchema } from '@batac/shared/schemas/documents';

export async function registerDocumentsRoutes(
  fastify: FastifyInstance,
  documentsService: DocumentsService,
) {
  fastify.post('/documents', {
    schema: { body: logDocumentBodySchema },
    handler: async (request, reply) => {
      // Same constraint: call service, return result.
      const result = await documentsService.logDocument({
        ...request.body,
        actorId: request.session.userId,
      });
      return reply.status(201).send(result);
    },
  });
}
```

### Rules

- Services receive all dependencies via `Deps`. No module-level imports of concrete implementations from other modules — only their interfaces.
- The service creates transactions. Repositories receive `tx` and are never responsible for transaction lifecycle.
- Audit log writes happen inside the service, after the transaction commits, before the domain event fires. Order: commit → audit → event.
- Domain events fire last, after all synchronous work is complete.
- Services validate business invariants, not data types. Zod schemas in `/packages/shared` validate types. Services check domain rules (uniqueness, state machine transitions, authorization invariants).

### Prohibitions

| Prohibited | Why |
|---|---|
| Business logic in tRPC procedures or Fastify route handlers | Handlers are transport adapters. Business logic there cannot be reused, tested in isolation, or audited. |
| Direct repository calls from handlers | Route handlers must go through the service. |
| One service importing another module's repository directly | Cross-module data access goes through the other module's service. |
| Calling `eventBus.emit()` inside a transaction callback | If the event fires before the transaction commits, subscribers may act on uncommitted data. Always emit after the `db.transaction()` call resolves. |
| Throwing generic `Error` for known domain failures | Export typed error classes from `{module}.errors.ts` (`DocumentAlreadyFinalizedError`, etc.) so callers can distinguish error types. |

---

## 3. Domain Event Pattern

### What It Solves

Module A must not call Module B's service directly to trigger a side effect. Direct cross-service calls create tight coupling: Module A must know B exists, import it, and receive it in its deps. The event bus inverts this — A emits a named event; B subscribes without A ever knowing B exists.

Example: When the documents module logs a new SP Resolution, the notifications module must send an alert to the SP Secretary. The documents service does not import or call `notificationsService.sendAlert(...)`. It emits `documents.document.logged`. The notifications module subscribes to this event.

### Infrastructure Files

```
/apps/server/src/infrastructure/
  event-bus.ts        ← TypedEventBus class and singleton factory
  event-payload-map.ts ← Master event registry (EventPayloadMap type)
```

### Canonical Implementation — Event Registry

All event names and their payload types are declared in one place. This is the type-safe contract between publishers and subscribers.

```typescript
// /packages/shared/src/events/event-payload-map.ts

// ─── Event Payload Types ──────────────────────────────────────────────────────
// See B2's Master Event Bus Registry for the authoritative, complete list — this
// is a representative excerpt, not the full map.

export interface EventPayloadMap {
  // ── documents module ────────────────────────────────────────────────────────
  'document.created': DocumentCreatedPayload;
  'document.state_changed': DocumentStateChangedEvent;
  'document.number_assigned': DocumentNumberAssignedEvent;
  'document.certification_urgency.logged': DocumentCertificationUrgencyLoggedPayload;

  // ── workflow module ─────────────────────────────────────────────────────────
  'workflow.instance.created': WorkflowInstanceCreatedPayload;
  'workflow.instance.completed': WorkflowInstanceCompletedPayload;
  'workflow.step.started': WorkflowStepStartedPayload;
  'workflow.step.completed': WorkflowStepCompletedPayload;
  'workflow.approval.lapsed': WorkflowApprovalLapsedPayload;
  'workflow.panlalawigan.deemed_approved': WorkflowPanlalawiganDeemedApprovedPayload;
  'workflow.sla.warning': WorkflowSlaWarningPayload;
  'workflow.sla.breached': WorkflowSlaBreachedPayload;

  // ── tracking module ─────────────────────────────────────────────────────────
  'tracking.qr_code.assigned': TrackingQrCodeAssignedPayload; // [Unverified — exact real name; confirm against tracking.event-consumer.ts before relying on this specific entry]

  // ── iam / organization module ───────────────────────────────────────────────
  'delegation.granted': DelegationGrantedEvent;
  'delegation.expired': DelegationExpiredEvent;
  'delegation.revoked': DelegationRevokedEvent;
}

export type DomainEventName = keyof EventPayloadMap;
```

`[Corrected — every event name in this example previously used a stale, invented convention
that doesn't match any real event actually declared in packages/shared/src/events/event-payload-map.ts
or B2's Master Event Bus Registry — e.g. "documents.document.statusChanged" and
"workflow.instance.slaBreached" do not exist anywhere in the real system; the real names are
"document.state_changed" and "workflow.sla.breached". This is the highest-stakes staleness found
in this document, precisely because this section is presented as the pattern to copy, not just
an aside — a developer implementing a new event by copying this example's structure would create
event names nothing else in the system recognizes. The corrected list above pulls directly from
the real, live event-payload-map.ts file and B2's Master Event Bus Registry (already reconciled
to B3's ratified names in an earlier pass); the file path and type name in the code comment are
also corrected (domain-events.ts / DomainEventMap → event-payload-map.ts / EventPayloadMap,
matching the real file). One entry (tracking.qr_code.assigned) is marked [Unverified] rather
than silently asserted, since it wasn't directly confirmed against source during this pass — the
rest were.]`

### Canonical Implementation — TypedEventBus

```typescript
// /packages/shared/src/event-bus.ts

import { EventEmitter } from 'node:events';
import type { EventPayloadMap, DomainEventName } from './events/event-payload-map.js';

// ─── Typed wrapper ────────────────────────────────────────────────────────────

export class TypedEventBus {
  private readonly emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    // Raise the limit — large apps with many subscribers per event will hit the
    // default of 10 and trigger a MaxListenersExceededWarning.
    this.emitter.setMaxListeners(50);
  }

  emit<K extends DomainEventName>(event: K, payload: EventPayloadMap[K]): void {
    this.emitter.emit(event, payload);
  }

  on<K extends DomainEventName>(
    event: K,
    handler: (payload: EventPayloadMap[K]) => void | Promise<void>,
  ): void {
    this.emitter.on(event, (payload: EventPayloadMap[K]) => {
      // Both sync and async handler errors are caught and logged here. They must
      // NOT propagate — a throwing subscriber must not fail the emitter or any
      // other subscriber (ADR-API-001). A synchronous throw inside handler()
      // would otherwise propagate straight back through emitter.emit() to the
      // calling module; this try/catch is what prevents that.
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          result.catch((err) => {
            // Replace with your structured logger (Pino) in production.
            console.error(`[EventBus] Unhandled error in handler for "${event}":`, err);
          });
        }
      } catch (err) {
        console.error(`[EventBus] Unhandled synchronous error in handler for "${event}":`, err);
      }
    });
  }

  off<K extends DomainEventName>(
    event: K,
    handler: (payload: EventPayloadMap[K]) => void | Promise<void>,
  ): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  /** Use in tests only — removes all listeners for a given event. */
  removeAllListeners<K extends DomainEventName>(event?: K): void {
    this.emitter.removeAllListeners(event);
  }
}

// ─── Singleton factory ────────────────────────────────────────────────────────
// One bus per process. Created once in the app entrypoint and injected into
// plugins via Fastify decoration.

let _eventBus: TypedEventBus | null = null;

export function getEventBus(): TypedEventBus {
  if (!_eventBus) {
    _eventBus = new TypedEventBus();
  }
  return _eventBus;
}
```

### How a Module Subscribes

Subscriptions are registered in the module's plugin (Pattern 4). They are set up once when the plugin initializes.

```typescript
// /apps/server/src/modules/notifications/notifications.plugin.ts (excerpt)

async function notificationsPlugin(fastify: FastifyInstance) {
  const service = createNotificationsService({ ... });

  // Subscribe to events from other modules.
  // The event bus is already decorated on fastify by the infrastructure plugin.
  fastify.eventBus.on('documents.document.logged', async (payload) => {
    await service.notifySecretaryOfNewDocument({
      documentId: payload.documentId,
      documentTypeId: payload.documentTypeId,
    });
  });

  fastify.eventBus.on('workflow.instance.slaBreached', async (payload) => {
    await service.notifySupervisorOfSlaBreach({
      instanceId: payload.instanceId,
      supervisorId: payload.supervisorId,
    });
  });
}
```

### Event Naming Convention

```
{domain}.{verb-past-tense-or-dot-qualified-noun}

Examples:
  document.created
  document.state_changed
  workflow.step.started
  workflow.sla.breached
  delegation.granted
  document.certification_urgency.logged
```

`[Corrected — this section previously stated the rule as {module-name}.{entity-name}.{verb-past-tense}
(e.g. "documents.document.logged", "workflow.instance.slaBreached", "iam.delegation.granted"),
which does not match the real, ratified event names actually used throughout B2's Master Event
Bus Registry, B3, and the live packages/shared/src/events/event-payload-map.ts. The real
convention does not always prefix with the full module name (delegation.granted, not
iam.delegation.granted), and does not use camelCase verbs (state_changed, not statusChanged;
sla.breached, not slaBreached). There is no single fully regular rule — event names are
domain-qualified and past-tense, but the exact segmentation follows B2's Master Event Bus
Registry as the source of truth, not a mechanical formula. Do not construct a new event name
from the old formula above; check the Master Event Bus Registry (B2) for the exact name of an
existing event, and follow its established pattern when naming a genuinely new one.]`

The domain-qualifying prefix ensures no name collisions between unrelated concepts. The verb must be past tense — events describe things that have already happened, not commands.

### Rules

- All event names and payload types must be declared in `event-payload-map.ts` before first use. No inline event strings.
- Events fire after the primary transaction commits and after the audit log entry is written.
- Async handlers must catch their own errors. The `TypedEventBus.on()` wrapper catches uncaught promise rejections and logs them, but individual handlers should still handle their own expected failure cases.
- Subscriptions are registered in the subscribing module's plugin `onReady` or at plugin initialization — never lazily at runtime.
- Adding a new event type requires updating `EventPayloadMap`. This is the only cross-module contract surface.

`[Corrected — "domain-events.ts"/"DomainEventMap" throughout this section previously didn't
match the real file/type names; the actual file is packages/shared/src/events/event-payload-map.ts
and the actual exported type is EventPayloadMap]`

### Prohibitions

| Prohibited | Why |
|---|---|
| `eventBus.emit(...)` inside a `db.transaction()` callback | Subscribers may act on data before it is committed. Emit only after the transaction resolves. |
| Using the event bus for synchronous results (emitting and reading a response) | Events are fire-and-forget. They cannot return values. Use direct service calls if you need a result. |
| Using events for critical path steps that require atomicity | Domain events for side effects only. The core business operation (create document, advance workflow step) must complete synchronously and transactionally before the event fires. |
| String literals for event names anywhere except `event-payload-map.ts` | Always use the `EventPayloadMap` key type. TypeScript will catch typos. |
| A module subscribing to its own events | If Module A emits and needs to react to its own emission in the same module, call the function directly. Self-subscription is a code smell. |

---

## 4. Module Plugin Pattern

### What It Solves

Fastify's native plugin system provides lexical scope isolation: a plugin's decorations, hooks, and routes are not visible outside its scope by default. This codebase uses this isolation to enforce the architectural law that no module can reach into another module's internals. The Module Plugin Pattern is how each domain module is wired into the Fastify instance in a controlled, dependency-declared way.

### Key Fastify Behavior to Understand

Without `fastify-plugin` (`fp`): Fastify creates a new scope for the plugin. Anything decorated on `fastify` inside the plugin is invisible to the parent and to sibling plugins registered after it.

With `fp`: Fastify breaks the scope and decorations are visible to the parent — effectively making the decoration globally available.

**Rule:** Wrap module plugins with `fp` so their service decoration is visible to the app for injection into other plugins. Route handlers are registered in a nested, non-`fp` scope so they do not pollute the global fastify instance with route-specific hooks.

### Directory Placement

```
/apps/server/src/modules/{module-name}/
  {module}.plugin.ts   ← Fastify plugin; wires repository + service + routes
```

```
/apps/server/src/app.ts  ← Registers all module plugins in dependency order
```

### Canonical Implementation

```typescript
// /apps/server/src/modules/documents/documents.plugin.ts

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createDocumentsRepository } from './documents.repository';
import { createDocumentsService } from './documents.service';
import { createDocumentsRouter } from './documents.router';
import { registerDocumentsRoutes } from './documents.routes';

// ─── Plugin ───────────────────────────────────────────────────────────────────

async function documentsPlugin(fastify: FastifyInstance): Promise<void> {
  // 1. Wire up the service using dependencies already decorated on fastify
  //    by previously-registered plugins.
  //    fastify.db, fastify.eventBus, fastify.trackingService, fastify.auditService
  //    must all be available before this plugin runs — see dependency declaration below.

  const service = createDocumentsService({
    db: fastify.db,
    trackingService: fastify.trackingService,
    auditService: fastify.auditService,
    eventBus: fastify.eventBus,
  });

  // 2. Decorate the service onto fastify so downstream plugins that depend on
  //    'documents' can use fastify.documentsService.
  fastify.decorate('documentsService', service);

  // 3. Register the tRPC router for this module.
  //    The tRPC app router merges this with other module routers.
  fastify.documentsTrpcRouter = createDocumentsRouter(service);

  // 4. Register REST routes in a nested scope (no fp wrapper here).
  //    REST routes for the external/portal API live in a child scope.
  //    This means route-specific hooks (e.g. rate limiting) don't leak globally.
  await fastify.register(async (scopedInstance) => {
    await registerDocumentsRoutes(scopedInstance, service);
  }, { prefix: '/api/v1' });
}

// ─── Export with fp ───────────────────────────────────────────────────────────
// fp() breaks Fastify's encapsulation so that fastify.documentsService is visible
// to the parent and to sibling plugins registered after this one.

export default fp(documentsPlugin, {
  name: 'documents',
  dependencies: ['database', 'event-bus', 'tracking', 'audit'],
  //             ↑ Fastify will throw at startup if any of these are not yet registered.
  //               This replaces manual ordering checks.
});
```

### TypeScript Augmentation

Fastify decorations must be declared on the Fastify type interface. Add them to the module's type file:

```typescript
// /apps/server/src/modules/documents/documents.types.ts (append at bottom)

import type { DocumentsService } from './documents.service';
import type { RootRouter as DocumentsTrpcRouter } from './documents.router';

declare module 'fastify' {
  interface FastifyInstance {
    documentsService: DocumentsService;
    documentsTrpcRouter: DocumentsTrpcRouter;
  }
}
```

### App Registration Order

Module plugins are registered in the main application file in dependency order. Fastify's `dependencies` declaration in `fp()` catches ordering mistakes, but the explicit order here is the source of truth for humans:

```typescript
// /apps/server/src/app.ts

import Fastify from 'fastify';
import databasePlugin from './infrastructure/database.plugin';
import eventBusPlugin from './infrastructure/event-bus.plugin';
import iamPlugin from './modules/iam/iam.plugin';
import organizationPlugin from './modules/organization/organization.plugin';
import auditPlugin from './modules/audit/audit.plugin';
import trackingPlugin from './modules/tracking/tracking.plugin';
import documentsPlugin from './modules/documents/documents.plugin';
import workflowPlugin from './modules/workflow/workflow.plugin';
import notificationsPlugin from './modules/notifications/notifications.plugin';

export async function buildApp() {
  const fastify = Fastify({ logger: true });

  // Infrastructure first — these have no inter-module dependencies.
  await fastify.register(databasePlugin);
  await fastify.register(eventBusPlugin);

  // Core modules in dependency order.
  await fastify.register(auditPlugin);      // no module deps
  await fastify.register(iamPlugin);        // depends on: database, audit
  await fastify.register(organizationPlugin); // depends on: database, audit, iam
  await fastify.register(trackingPlugin);   // depends on: database, audit
  await fastify.register(documentsPlugin);  // depends on: database, event-bus, tracking, audit
  await fastify.register(workflowPlugin);   // depends on: database, event-bus, documents, audit
  await fastify.register(notificationsPlugin); // depends on: database, event-bus (subscriber only)

  // Register the merged tRPC router after all module routers are decorated.
  await fastify.register(trpcPlugin);

  return fastify;
}
```

### Infrastructure Plugin Example

Infrastructure plugins (database connection, event bus) follow the same pattern:

```typescript
// /apps/server/src/infrastructure/database.plugin.ts

import fp from 'fastify-plugin';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@batac/database/schema';
import type { FastifyInstance } from 'fastify';

async function databasePlugin(fastify: FastifyInstance): Promise<void> {
  const client = postgres(fastify.config.DATABASE_URL, {
    max: 10,
    idle_timeout: 30,
  });
  const db = drizzle(client, { schema });

  fastify.decorate('db', db);

  fastify.addHook('onClose', async () => {
    await client.end();
  });
}

export default fp(databasePlugin, { name: 'database' });

// Type augmentation
declare module 'fastify' {
  interface FastifyInstance {
    db: ReturnType<typeof drizzle>;
  }
}
```

### Rules

- Every module plugin must be wrapped with `fp()` with an explicit `name` and `dependencies` array.
- The `name` string must match the string used in other plugins' `dependencies` arrays exactly.
- Module services are decorated onto the `fastify` instance by their own plugin — they must not be imported directly by other module plugins.
- REST routes must be registered inside a nested `fastify.register()` scope (no `fp`), not at the top level of the module plugin, to preserve hook isolation.
- Cleanup code (DB connections, timers) must be registered with `fastify.addHook('onClose', ...)` — not in a `process.on('exit')` handler.

### Prohibitions

| Prohibited | Why |
|---|---|
| `import { documentsService } from '../documents/documents.service'` directly in another module | Creates tight compile-time coupling. All cross-module access goes through `fastify.documentsService` (the Fastify decoration). |
| Omitting `fp()` wrapping on a module plugin | Without `fp`, decorations are invisible to sibling plugins. The app will crash at runtime with `FST_ERR_DEC_ALREADY_PRESENT` or a "not found" error. |
| Omitting the `dependencies` array | Fastify registers plugins in the order `fastify.register()` is called. Missing `dependencies` declaration means a wrong registration order will silently fail at runtime rather than crashing immediately with a clear message at startup. |
| Registering REST routes at the module plugin's top scope (without a nested `fastify.register()`) | Route-specific hooks (authentication guards, rate limiting, serialization schemas) applied in the top scope of a module plugin leak to all sibling plugins registered afterward. |
| Circular plugin dependencies | If Module A depends on B and B depends on A, extract the shared concern into a third infrastructure plugin. |

---

## 5. Query Key Factory Pattern

### What It Solves

TanStack Query caches server state by query key. When a mutation succeeds, the cache must be invalidated for all queries that now show stale data. Without a consistent key structure, invalidation becomes a guessing game where keys defined in one file don't match keys in another.

This codebase uses a two-tier approach:

**Tier 1 — tRPC queries** (primary): tRPC's TanStack Query integration manages its own key structure internally via `trpc.useUtils()`. For all `/web` ↔ `/server` communication over tRPC, use tRPC's utils for invalidation. Do not manually define keys for tRPC-backed queries.

**Tier 2 — REST queries** (secondary): The `/apps/portal` (Next.js, Phase 3) and any non-tRPC fetch calls in `/apps/web` (direct REST calls to the public API) use explicit query keys managed by the Query Key Factory pattern.

### Directory Placement

```
/apps/web/src/lib/query-keys/
  index.ts             ← Re-exports all key factories
  documents.keys.ts
  tracking.keys.ts
  portal.keys.ts       ← Keys for REST calls from /portal (Phase 3)

/apps/web/src/lib/cache/
  invalidations.ts     ← Named invalidation helpers grouping related tRPC utils calls
```

### Tier 1 — tRPC Cache Invalidation via `useUtils`

For tRPC-backed queries in `/web`, always use the utils pattern. Never manually construct a tRPC query key.

```typescript
// /apps/web/src/lib/cache/invalidations.ts

import { trpc } from '../trpc';

/**
 * Named invalidation helpers.
 * Group related procedure invalidations that must fire together after a mutation.
 * Import and call these in useMutation onSuccess callbacks — not inline.
 */

export function useDocumentCacheInvalidation() {
  const utils = trpc.useUtils();

  return {
    /** Call when a document is logged (created). Stale: list queries. */
    async onDocumentLogged() {
      await utils.documents.list.invalidate();
      await utils.documents.listByOffice.invalidate();
    },

    /** Call when a document's status changes or final number is assigned. */
    async onDocumentUpdated(documentId: string) {
      await Promise.all([
        utils.documents.getById.invalidate({ id: documentId }),
        utils.documents.list.invalidate(),
        utils.tracking.getByDocument.invalidate({ documentId }),
      ]);
    },

    /** Call when a workflow step completes — stales dashboard counts and queues. */
    async onWorkflowStepCompleted(instanceId: string, documentId: string) {
      await Promise.all([
        utils.workflow.getInstance.invalidate({ id: instanceId }),
        utils.documents.getById.invalidate({ id: documentId }),
        utils.dashboard.secretariatQueue.invalidate(),
        utils.dashboard.mayorPending.invalidate(),
      ]);
    },
  };
}

export function useDelegationCacheInvalidation() {
  const utils = trpc.useUtils();

  return {
    async onDelegationGranted() {
      await utils.organization.getActiveDelegations.invalidate();
    },
    async onDelegationRevoked(delegationId: string) {
      await utils.organization.getDelegation.invalidate({ id: delegationId });
      await utils.organization.getActiveDelegations.invalidate();
    },
  };
}
```

Usage in a mutation:

```typescript
// /apps/web/src/features/documents/hooks/useLogDocument.ts

import { trpc } from '@/lib/trpc';
import { useDocumentCacheInvalidation } from '@/lib/cache/invalidations';

export function useLogDocument() {
  const { onDocumentLogged } = useDocumentCacheInvalidation();

  return trpc.documents.logDocument.useMutation({
    onSuccess: async () => {
      await onDocumentLogged();
    },
  });
}
```

### Tier 2 — Explicit Query Keys for REST Calls

For queries that call the REST API directly (portal pages, public document lookups, non-tRPC internal calls), define explicit key factories.

```typescript
// /apps/web/src/lib/query-keys/documents.keys.ts

import type { DocumentListFilters, PublicDocumentFilters } from '@batac/shared/types';

/**
 * Hierarchical query key factory for documents.
 *
 * Key structure:
 *   ['documents']                          — root; invalidates ALL document queries
 *   ['documents', 'list']                  — all list queries
 *   ['documents', 'list', filters]         — specific filtered list
 *   ['documents', 'detail']               — all detail queries
 *   ['documents', 'detail', id]            — one document
 *   ['documents', 'tracking', number]      — lookup by tracking number
 *
 * Invalidation tip:
 *   queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
 *   ↑ invalidates ALL list queries regardless of filters.
 */

export const documentKeys = {
  all: ['documents'] as const,

  lists: () => [...documentKeys.all, 'list'] as const,
  list: (filters: DocumentListFilters) => [...documentKeys.lists(), filters] as const,

  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,

  byTracking: (trackingNumber: string) =>
    [...documentKeys.all, 'tracking', trackingNumber] as const,

  byNumber: (series: string, year: number, seq: number) =>
    [...documentKeys.all, 'number', series, year, seq] as const,
} as const;
```

```typescript
// /apps/web/src/lib/query-keys/portal.keys.ts

import type { PublicDocumentFilters } from '@batac/shared/types';

/**
 * Query keys for the public portal (Phase 3).
 * Prefixed with 'portal' to avoid collision with internal document keys.
 * Portal queries hit REST endpoints, not tRPC.
 */

export const portalKeys = {
  all: ['portal'] as const,

  documents: {
    all: ['portal', 'documents'] as const,
    lists: () => [...portalKeys.documents.all, 'list'] as const,
    list: (filters: PublicDocumentFilters) => [...portalKeys.documents.lists(), filters] as const,
    detail: (id: string) => [...portalKeys.documents.all, 'detail', id] as const,
    byTracking: (number: string) =>
      [...portalKeys.documents.all, 'tracking', number] as const,
  },

  complaints: {
    all: ['portal', 'complaints'] as const,
    status: (referenceNumber: string) =>
      [...portalKeys.complaints.all, 'status', referenceNumber] as const,
  },
} as const;
```

Usage with TanStack Query's `useQuery`:

```typescript
// /apps/web/src/features/portal/hooks/usePublicDocument.ts

import { useQuery } from '@tanstack/react-query';
import { portalKeys } from '@/lib/query-keys/portal.keys';
import { fetchPublicDocument } from '@/lib/api/portal.api';

export function usePublicDocument(id: string) {
  return useQuery({
    queryKey: portalKeys.documents.detail(id),
    queryFn: () => fetchPublicDocument(id),
    staleTime: 5 * 60 * 1000, // 5 min — public documents change infrequently
  });
}
```

### Hierarchical Invalidation

The hierarchical structure enables targeted or broad invalidation:

```typescript
// Invalidate only the specific document detail:
queryClient.invalidateQueries({ queryKey: documentKeys.detail(documentId) });

// Invalidate all document list queries (any filter combination):
queryClient.invalidateQueries({ queryKey: documentKeys.lists() });

// Invalidate everything document-related:
queryClient.invalidateQueries({ queryKey: documentKeys.all });

// Invalidate the entire portal cache:
queryClient.invalidateQueries({ queryKey: portalKeys.all });
```

### Rules

- For tRPC-backed queries in `/web`, always use `trpc.useUtils()` for invalidation. Never define explicit keys for tRPC queries.
- For REST-backed queries, define keys in `/apps/web/src/lib/query-keys/{module}.keys.ts` using the hierarchical factory pattern.
- All factory functions must return `as const` arrays to preserve TypeScript tuple literal types.
- Named invalidation helpers (in `/apps/web/src/lib/cache/invalidations.ts`) group related invalidations that logically belong together. Use these in `useMutation` callbacks — do not inline `utils.xxx.invalidate()` calls at the call site.
- The root key segment must be unique per module. `['documents']` for documents, `['portal', 'documents']` for portal document views — never share a root.

### Prohibitions

| Prohibited | Why |
|---|---|
| Inline string or array literals as query keys at the call site | `useQuery({ queryKey: ['documents', id] })` — this key is invisible to the factory, preventing hierarchical invalidation. Always use the factory. |
| Defining keys for tRPC-backed queries | tRPC manages its own keys. Parallel manual keys for the same procedure will diverge and break cache consistency. |
| `queryClient.invalidateQueries()` with no `queryKey` argument | This invalidates the entire cache — all queries re-fetch simultaneously. Use a scoped key. |
| Putting keys in the component file that uses them | Keys are reused across components and in mutation success callbacks. Inline definitions cannot be shared without import coupling. |
| Mutable key objects (non-`const` factory returns) | TanStack Query compares keys by deep equality. Returning a plain array without `as const` makes TypeScript treat the values as `string[]` rather than a tuple, losing type information at call sites. |

---

## 6. How the Patterns Compose

Every user-initiated action in this system passes through all five patterns. Here is a complete trace for the most common operation: **an SP Secretariat staff member logs a new SP Resolution draft**.

```
Browser (React SPA — /apps/web)
│
│  1. Staff fills the "Log Document" form and submits.
│     React Hook Form validates against the shared Zod schema.
│     trpc.documents.logDocument.useMutation fires.
│     onSuccess calls useDocumentCacheInvalidation().onDocumentLogged()
│     which invokes utils.documents.list.invalidate()
│                                               [Query Key Factory — Pattern 5]
│
▼
Fastify + tRPC (/apps/server)
│
│  2. tRPC router receives the procedure call.
│     The router was created in createDocumentsRouter(service) and registered
│     by the documents module plugin.        [Module Plugin Pattern — Pattern 4]
│
│  3. The procedure handler calls:
│       documentsService.logDocument(input)
│     That is all the handler does.          [Service Layer Pattern — Pattern 2]
│
▼
documentsService.logDocument()
│
│  4. Service validates business invariants:
│     - Series is active
│     - Actor has permission to log this document type
│     (Zod already validated types; service validates domain rules)
│
│  5. Service opens a DB transaction.
│     Inside the transaction:
│       const docRepo = createDocumentsRepository(tx)
│       const document = await docRepo.create(input.document)
│     docRepo only queries the `documents` schema.
│                                            [Repository Pattern — Pattern 1]
│
│  6. Transaction commits.
│
│  7. Service calls auditService.log(...)
│     (Direct call — audit is a synchronous critical-path requirement)
│
│  8. Service calls trackingService.assignQrCode({ documentId })
│     (Direct call — also synchronous; QR assignment happens immediately)
│
│  9. Service emits:
│       eventBus.emit('documents.document.logged', { documentId, ... })
│     Fire-and-forget.                       [Domain Event Pattern — Pattern 3]
│
▼
Event Bus
│
│  10. The notifications module subscriber fires asynchronously:
│        notificationsService.notifySecretaryOfNewDocument({ documentId })
│
│  11. If any other module subscribed to 'documents.document.logged',
│      their handlers also fire — unknown to the documents module.
│
▼
Back to Fastify handler → tRPC response → browser

  12. useMutation onSuccess fires in the browser.
      useDocumentCacheInvalidation().onDocumentLogged() invalidates
      the list queries, causing the dashboard to refetch automatically.
```

### Cross-Pattern Rules That Apply Everywhere

| Rule | Enforced by |
|---|---|
| No module reads another module's DB schema | Repository pattern (schema ownership) |
| No business logic in route handlers | Service layer pattern |
| No direct cross-module service imports | Module plugin pattern (decorate → consume) |
| No cross-module side effects via direct service calls | Domain event pattern |
| No inline cache keys at the call site | Query key factory pattern |
| All five patterns must be present for a complete module | This document |

---

## Appendix — File Structure Reference

A complete module, fully conforming to all five patterns:

```
/apps/server/src/modules/documents/
  documents.errors.ts       — Typed error classes (DocumentAlreadyFinalizedError, etc.)
  documents.events.ts       — Re-exports the relevant EventPayloadMap keys for this module
  documents.plugin.ts       — Fastify plugin (fp-wrapped); wires everything together
  documents.repository.ts   — DocumentsRepository interface + createDocumentsRepository factory
  documents.router.ts       — tRPC router for /web (createDocumentsRouter)
  documents.routes.ts       — REST routes for external/portal API
  documents.service.ts      — DocumentsService interface + createDocumentsService factory
  documents.types.ts        — Domain types + Fastify module augmentation

/apps/server/src/infrastructure/
  database.plugin.ts        — DB connection as Fastify decoration
  event-bus.plugin.ts       — TypedEventBus as Fastify decoration
  event-payload-map.ts      — Master EventPayloadMap type (all events declared here)
  event-bus.ts              — TypedEventBus class + getEventBus() singleton

/apps/web/src/lib/query-keys/
  documents.keys.ts         — documentKeys factory
  tracking.keys.ts          — trackingKeys factory
  portal.keys.ts            — portalKeys factory (Phase 3)
  index.ts                  — Re-exports all key factories

/apps/web/src/lib/cache/
  invalidations.ts          — Named invalidation helpers using tRPC utils
```
