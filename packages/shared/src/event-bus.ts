/**
 * EventBus — typed in-process domain event bus.
 *
 * INFRA-owned singleton. Wraps Node's built-in EventEmitter with:
 *   - Full TypeScript type safety: emit/on are constrained to EventPayloadMap keys.
 *   - Per-handler isolation: a throwing subscriber never propagates to the emitter.
 *   - Dead-letter routing: failed handlers produce a row in shared.event_bus_dead_letters.
 *   - Pino error logging per failing handler.
 *
 * Instantiate ONE instance at Fastify startup and inject into all module factories:
 *   const bus = new EventBus(logger, deadLetterRepo);
 *
 * Sources: ADR-API-001 (canonical); B2 §"Common Event Envelope"; ADR-B2-1;
 *          ADR-INFRA-023-01 (IDeadLetterRepository dependency inversion).
 */
import EventEmitter from 'node:events';
export interface IEventBusLogger {
  error(obj: object, msg?: string, ...args: any[]): void;
  error(msg: string, ...args: any[]): void;
}
import type { EventPayloadMap } from './events/event-payload-map.js';
import type { DomainEvent } from './events/domain-event.js';
import type { IDeadLetterRepository } from './dead-letter-repository.interface.js';

// Internal handler type — erased to allow the Map to hold mixed-typed handlers.
type AnyHandler = (envelope: DomainEvent<unknown>) => void | Promise<void>;

export class EventBus {
  private readonly emitter = new EventEmitter();
  /**
   * Tracks the registering module name for each handler so the dead-letter row
   * can record which module failed. Module names are caller-supplied strings
   * (e.g. 'audit', 'notifications') — they are not validated against an enum in
   * Phase 1 because the set of modules is still growing.
   */
  private readonly moduleNames = new Map<AnyHandler, string>();

  constructor(
    private readonly logger: IEventBusLogger,
    private readonly deadLetterRepo: IDeadLetterRepository,
  ) {
    // 50 listeners covers the 18 Phase 1 events × multiple consumers per event.
    // If a future phase exceeds this, raise the limit rather than suppressing
    // Node's warning, so the warning remains a signal of an actual misconfiguration.
    this.emitter.setMaxListeners(50);
  }

  /**
   * Register a typed handler for an event.
   *
   * @param eventType  Key in EventPayloadMap — compile error for unlisted events.
   * @param handler    Receives a fully-typed DomainEvent<EventPayloadMap[K]>.
   * @param moduleName Caller-supplied module identifier logged in error/dead-letter records.
   */
  on<K extends keyof EventPayloadMap>(
    eventType: K,
    handler: (envelope: DomainEvent<EventPayloadMap[K]>) => void | Promise<void>,
    moduleName: string,
  ): void {
    this.moduleNames.set(handler as AnyHandler, moduleName);
    this.emitter.on(eventType as string, handler as AnyHandler);
  }

  /**
   * Emit a typed event.
   *
   * ADR-API-001 §3: each registered handler is called individually inside its
   * own try/catch. A handler failure — synchronous or asynchronous — is logged,
   * routed to the dead-letter table, and does NOT propagate to this caller.
   *
   * @param eventType Key in EventPayloadMap — compile error for unlisted events.
   * @param envelope  Fully-typed DomainEvent<EventPayloadMap[K]>.
   */
  emit<K extends keyof EventPayloadMap>(
    eventType: K,
    envelope: DomainEvent<EventPayloadMap[K]>,
  ): void {
    const listeners = this.emitter.rawListeners(eventType as string) as AnyHandler[];

    for (const handler of listeners) {
      const mod = this.moduleNames.get(handler) ?? 'unknown';
      try {
        const result = handler(envelope as DomainEvent<unknown>);
        if (result instanceof Promise) {
          result.catch((err: unknown) =>
            this.onHandlerFailure(envelope as DomainEvent<unknown>, mod, err),
          );
        }
      } catch (err) {
        this.onHandlerFailure(envelope as DomainEvent<unknown>, mod, err);
      }
    }
  }

  /** Remove a previously registered handler (e.g. for test teardown). */
  off<K extends keyof EventPayloadMap>(
    eventType: K,
    handler: (envelope: DomainEvent<EventPayloadMap[K]>) => void | Promise<void>,
  ): void {
    this.emitter.off(eventType as string, handler as AnyHandler);
    this.moduleNames.delete(handler as AnyHandler);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private onHandlerFailure(envelope: DomainEvent<unknown>, moduleName: string, err: unknown): void {
    this.logger.error(
      { err, eventId: envelope.eventId, eventType: envelope.eventType, moduleName },
      '[event-bus] subscriber failure — routing to dead-letter table',
    );

    // ADR-API-001 §4: "priority alert" for the Audit module handler specifically.
    // Sentry SDK is a stub in Phase 1; the call site is preserved for Phase 2 wiring.
    if (moduleName === 'audit') {
      // Sentry.captureException(err, { extra: { envelope, moduleName } });
    }

    // Fire-and-forget dead-letter insert. If the write itself fails, log and move on —
    // the emitter must not block or throw under any circumstances.
    void this.deadLetterRepo
      .insert({
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        payload: envelope.payload as Record<string, unknown>,
        failedModule: moduleName,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
      .catch((dlErr: unknown) =>
        this.logger.error(
          { dlErr, envelope },
          '[event-bus] dead-letter write also failed — event permanently unrecoverable',
        ),
      );
  }
}
