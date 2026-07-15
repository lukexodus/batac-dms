# ADR-INFRA-023-01: IDeadLetterRepository Dependency Inversion in EventBus

**Status:** Accepted  
**Date:** 2026-06-26  
**Decided by:** Agent (TASK-INFRA-023); human-approved in PR review  
**Related documents:** ADR-API-001 (Event Bus Implementation); B2 §"Common Event Envelope"; TASK-INFRA-023  

---

## Context

The TASK-INFRA-023 specification shows `EventBus` (in `/packages/shared/src/event-bus.ts`)
importing `DeadLetterRepository` directly from
`../../apps/server/src/infra/dead-letter.repository`. This creates a
`packages/shared → apps/server` dependency direction, which violates the
standard monorepo layering rule: **packages may not depend on app code.**

If `packages/shared` imported from `apps/server`, any consumer of `@batac/shared`
would transitively pull in the Fastify server's concrete infrastructure classes —
including their own dependencies (drizzle-orm, postgres, etc.) — into contexts
that have no need for them (e.g. frontend packages, test harnesses, or a future
standalone CLI).

The two options considered:

1. **Import the concrete class** — as shown in the spec pseudocode. Simple, but
   creates a `packages → apps` dependency that is architecturally backwards and
   propagates server-only transitive deps into the shared package.

2. **Extract an interface** — define `IDeadLetterRepository` in `packages/shared`;
   `EventBus` depends on the interface only. The concrete `DeadLetterRepository`
   class lives in `apps/server` and implements the interface. The interface is
   injected at Fastify startup — no circular dependency exists.

## Decision

**Option 2: extract `IDeadLetterRepository` into `packages/shared`.**

`/packages/shared/src/dead-letter-repository.interface.ts` declares:

```typescript
export interface IDeadLetterRepository {
  insert(row: { eventId: string; eventType: string; payload: Record<string, unknown>;
                failedModule: string; errorMessage: string; }): Promise<void>;
  fetchPending(opts: { maxRetries: number }): Promise<PendingDeadLetter[]>;
  markRetried(id: string): Promise<void>;
  incrementRetry(id: string, backoffSeconds: number): Promise<void>;
  markExhausted(id: string): Promise<void>;
}
```

`EventBus` constructor accepts `IDeadLetterRepository` (the interface), not the
concrete class. The concrete `DeadLetterRepository` (in `apps/server`) implements
this interface and is injected at Fastify startup:

```typescript
// Fastify bootstrap:
const deadLetterRepo = new DeadLetterRepository(db);
const bus = new EventBus(logger, deadLetterRepo);
```

## Consequences

**Positive:**
- `packages/shared` has zero dependency on `apps/server`. Importing `@batac/shared`
  in a test harness or a future package does not pull in Drizzle, postgres, or
  Fastify.
- The interface contract is explicit and testable — any test can provide a mock
  `IDeadLetterRepository` to the `EventBus` without standing up a database.
- Follows standard dependency-inversion principle (DIP): high-level policy
  (`EventBus`) depends on an abstraction, not on a concrete implementation.

**Negative / Trade-offs:**
- One additional file (`dead-letter-repository.interface.ts`) to maintain.
  Acceptable: it is thin (< 20 lines) and changes only when the dead-letter API changes.
- The task spec's illustrative pseudocode must be mentally translated to this
  pattern by the next developer. This ADR is the translation record.

## Alternatives Considered

**Single file with a local interface** — define the interface inline in `event-bus.ts`
and never export it. Rejected: `fetchPending`'s return type (`PendingDeadLetter[]`)
would need to be defined somewhere shareable anyway, and hiding the interface makes
the retry job's type signature more awkward.
