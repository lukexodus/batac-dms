# ADR-API-001: Event Bus Implementation

**Status:** Accepted
**Date:** June 2026
**Decided by:** Development team (delegated technical decision)
**Related documents:** B2 — Module Boundary and Internal API Contracts; B1 — System Architecture

---

## Context

B2 establishes that the internal in-process event bus is the asynchronous communication path between all 11 domain modules, alongside the synchronous Published API path (B2, "Enforcement Model" and "Synchronous vs. Asynchronous — Decision Rule"). Every module that emits domain events (`document.created`, `workflow.step.completed`, `delegation.granted`, etc.) and every module that consumes them (most prominently Audit, which subscribes to all events) depends on this mechanism existing with a stable, typed contract.

B2's "Common Event Envelope" section already specifies the payload shape (`eventId`, `eventType`, `occurredAt`, `cityId`, `schemaVersion`, `payload`) but does not specify the underlying transport mechanism. This decision was left open in B2's Required ADRs table (ADR-API-001) and needs to be resolved before the first module emits or consumes an event.

The two candidate approaches considered:

1. **Typed wrapper around Node's built-in `EventEmitter`.** No new runtime dependency. Requires a thin typing layer on top since `EventEmitter` itself is untyped.
2. **A minimal third-party typed pub/sub library** (e.g. `mitt`, `eventemitter3`, or similar). Slightly more ergonomic typing out of the box, at the cost of an added dependency to vet, pin, and keep patched for the lifetime of a 10+ year deployment.

## Decision

**Use a typed wrapper around Node's built-in `EventEmitter`.** No third-party event bus library is introduced.

### Implementation requirements

1. **Single bus instance.** One `EventBus` instance is constructed at application startup and passed to every module's event publisher and event consumer component. It is not re-instantiated per-request.

2. **Typed event registration.** A central type map (in `/packages/shared`) declares every valid `eventType` string and its corresponding payload type, e.g.:

   ```typescript
   interface EventPayloadMap {
     'document.created': DocumentCreatedPayload;
     'document.state_changed': DocumentStateChangedPayload;
     'workflow.step.started': WorkflowStepStartedPayload;
     // ... one entry per event in the Master Event Bus Registry
   }
   ```

   `[Corrected — this example previously used workflow.step_assigned, a pre-B3 event name;
   see B2's Master Event Bus Registry and B3 §0.2 for the ratified name, workflow.step.started]`

   The `EventBus` wrapper exposes `emit<K extends keyof EventPayloadMap>(type: K, envelope: DomainEvent<EventPayloadMap[K]>)` and `on<K extends keyof EventPayloadMap>(type: K, handler: (envelope: DomainEvent<EventPayloadMap[K]>) => void | Promise<void>)`. This makes an attempt to emit or subscribe to an unregistered `eventType`, or with a mismatched payload shape, a compile-time error rather than a runtime surprise.

3. **Subscriber isolation — a throwing subscriber must not fail the emitter or any other subscriber.** `EventEmitter.emit()` invokes listeners synchronously and propagates a thrown exception back to the caller, which would mean one misbehaving consumer (e.g. a bug in the Notifications subscriber) could crash the Documents module's write path. The wrapper's `emit()` therefore:
   - Iterates registered handlers for the event type individually.
   - Wraps each handler invocation (sync or async) in a `try/catch` (and `.catch()` for promises).
   - On a handler throwing or rejecting, logs the error via Pino with the event envelope, the failing handler's registered module name, and the error, then **continues to the next handler**. It does not re-throw to the emitting module.
   - The emitting module's call to `emit()` always resolves successfully once all handlers have been attempted, regardless of individual handler outcomes.

4. **Dead-letter strategy.** A handler failure is not silently discarded. Each failed handler invocation is recorded as a row in a dedicated `event_bus_dead_letters` table (owned by no domain module — created in a shared/infrastructure migration, not a domain schema, to avoid assigning audit-adjacent infrastructure to an arbitrary module's schema) with: `eventId`, `eventType`, `payload`, `failedModule`, `errorMessage`, `failedAt`, `retryCount`. A scheduled pgboss job retries dead-lettered events with exponential backoff up to a configurable maximum (default 5 attempts); after exhausting retries, the entry remains in the dead-letter table for manual operator review and is **not** automatically dropped. Given Rule P4 ("Event without Audit subscription" is a build-time violation) and the fact that Audit subscribes to every event, a failure in the Audit handler specifically is treated as a priority alert (Sentry-reported) since it represents a potential silent gap in the tamper-evident log.

5. **No cross-process delivery.** This bus is in-process only, consistent with B1's Container Diagram note ("No WebSocket or external message broker") and the modular monolith decision in the Consolidated Reference (Part 10.1). If the platform is later decomposed into separate deployable services, this bus is the extraction seam — every module already only talks to it through `emit`/`on`, never to another module's emitter instance directly, so swapping the transport (e.g. to a real message queue) would not require call-site changes in domain modules.

6. **Schema version handling.** Per B2's Common Event Envelope note, subscribers must ignore unknown future fields. The typed wrapper does not enforce this at the type level (TypeScript structural typing already permits extra fields to be ignored by destructuring), but the coupling test suite includes a lint rule against object spreads or exhaustive destructuring patterns on event payloads that would break on additive schema changes.

## Consequences

- **Positive:** Zero new runtime dependencies for a piece of infrastructure that is load-bearing for the entire module-boundary enforcement model. One fewer library to security-patch over a 10+ year LGU deployment lifespan, consistent with the project's cloud-agnostic, dependency-conservative posture (Consolidated Reference, Part 11.2 and Part 9 stack table).
- **Positive:** A throwing subscriber cannot cascade into a failure of the emitting module's transaction, satisfying the requirement in B2's sync/async decision rule that "the consuming module's failure must not fail the emitting module's operation."
- **Negative:** The typed wrapper is bespoke code the team must maintain, rather than relying on a library's existing typings and edge-case handling. This is a small, well-understood surface area (a handful of methods) and is judged to be lower long-term risk than a new dependency.
- **Negative:** Dead-lettered events that exhaust retries require manual operator intervention. This is an accepted trade-off — for a system whose compliance posture already requires human review of audit anomalies (Consolidated Reference, Part 11.11), a manual review queue for event-delivery failures is consistent with existing operational expectations rather than a net-new burden.
- **Follow-on requirement:** Every new `eventType` added to the Master Event Bus Registry in B2 must have a corresponding entry added to `EventPayloadMap` in the same PR, or the build fails at compile time. This makes B2's existing rule ("Every new domain event must be registered with the Audit module's consumer before the feature is merged") enforceable by the compiler rather than only by code-review policy.
