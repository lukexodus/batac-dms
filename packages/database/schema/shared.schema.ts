/**
 * Drizzle schema for the `shared` PostgreSQL schema.
 *
 * The `shared` schema hosts infrastructure/operational tables that are not
 * owned by any single domain module. Phase 1 contains only the dead-letter
 * table for the in-process event bus.
 *
 * Intentional invariant exceptions (per C5 §4.2):
 *   - No `city_id` column: `event_bus_dead_letters` is a system-global
 *     operational table tracking infrastructure failures, not a tenant-scoped
 *     entity. Dead-letter events span all tenants (Batac City UUID in Phase 1)
 *     and cannot be meaningfully partitioned by tenant.
 *   - No soft-delete columns (`deleted_at`, `deleted_by`): rows are either
 *     retried (and deleted via `markRetried`) or exhausted (and kept for manual
 *     review). Soft-delete semantics do not apply to operational queue entries.
 *
 * Sources: TASK-INFRA-023 spec; ADR-API-001; B2 §"Master Event Bus Registry".
 */
import { pgSchema, uuid, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';

/** The `shared` PostgreSQL schema — created by this migration. */
export const sharedSchema = pgSchema('shared');

/**
 * Dead-letter table for the in-process event bus.
 *
 * A row is inserted whenever a domain event handler throws (synchronously or
 * via a rejected Promise). The dead-letter retry job (`infra:dead-letter-retry`)
 * reads this table and re-emits events with exponential backoff up to 5 attempts.
 *
 * Retry lifecycle:
 *   INSERT → retryCount=0, exhaustedAt=NULL
 *   Each failed retry: retryCount++, failedAt advanced by backoff duration
 *   After 5 failed retries: exhaustedAt=NOW(), no further automatic retries
 *   Successful retry: row deleted via markRetried()
 */
export const eventBusDeadLetters = sharedSchema.table('event_bus_dead_letters', {
  /** UUID v4 primary key — identifies a specific dead-letter row. */
  id: uuid('id').primaryKey().defaultRandom(),
  /** eventId from the original DomainEvent envelope (UUID v4). */
  eventId: uuid('event_id').notNull(),
  /** eventType from the original DomainEvent envelope (e.g. 'document.created'). */
  eventType: text('event_type').notNull(),
  /** Full payload from the original DomainEvent envelope. */
  payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
  /** Module name of the failing handler (e.g. 'audit', 'notifications'). */
  failedModule: text('failed_module').notNull(),
  /** Error message from the failing handler's thrown error. */
  errorMessage: text('error_message').notNull(),
  /**
   * Timestamp of the most recent failure. On first insert: NOW().
   * After each failed retry: advanced to NOW() + backoff interval so that
   * `fetchPending` can cheaply order by next-retry-due-at using this column.
   */
  failedAt: timestamp('failed_at', { withTimezone: true }).notNull().defaultNow(),
  /** Number of retry attempts made so far. Starts at 0 on first insert. */
  retryCount: integer('retry_count').notNull().default(0),
  /**
   * Set to NOW() when retryCount reaches MAX_RETRIES (5) and all retries
   * are exhausted. NULL means the row is still eligible for retry.
   * Once set, the row is kept permanently for manual investigation.
   */
  exhaustedAt: timestamp('exhausted_at', { withTimezone: true }),
});
