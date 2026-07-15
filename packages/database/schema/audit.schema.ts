import {
  pgSchema,
  uuid,
  bigint,
  text,
  jsonb,
  integer,
  timestamp,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The `audit` PostgreSQL schema.
 *
 * This schema acts as a tamper-evident append-only log for all system activities.
 *
 * Intentional invariant exceptions (per C5 §1.5 exception list):
 *   - No soft-delete columns (`deleted_at`, `deleted_by`) and no `updated_at` column.
 *     The table is append-only by design. UPDATE and DELETE privileges are revoked
 *     at the database grant level.
 *
 * Sources: C1 Part 10 DDL, Decision D-ABAC-04 (I3 §18.1 / I1 §8.3).
 */
export const auditSchema = pgSchema('audit');

/**
 * Monotonic sequence for unambiguous "previous record" pointer,
 * independent of wall-clock timestamp ordering.
 */
export const eventsSequenceSeq = auditSchema.sequence('events_sequence_seq', {
  startWith: 1,
  increment: 1,
});

/**
 * Append-only, hash-chained, HMAC-signed audit events.
 */
export const auditEvents = auditSchema.table(
  'events',
  {
    /** UUID v4 primary key. */
    id: uuid('id').primaryKey().defaultRandom(),
    /** Tenant identifier (Batac City LGU default UUID). */
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    /** Monotonically increasing sequence number. */
    sequenceNumber: bigint('sequence_number', { mode: 'bigint' })
      .notNull()
      .default(sql`nextval('audit.events_sequence_seq')`),
    /** Logical identifier of the event class (e.g. 'document.created'). */
    eventType: text('event_type').notNull(),
    /** Logical FK to iam.users.id (cross-schema); null for system/anonymous events. */
    actorId: uuid('actor_id'),
    /** ID of the target resource. */
    targetId: uuid('target_id'),
    /** Entity type of the target resource (e.g. 'document'). */
    targetType: text('target_type'),
    /** Denormalized owning office UUID of the target resource at write time. */
    resourceOfficeId: uuid('resource_office_id'),
    /** Full domain event structured payload. */
    payload: jsonb('payload').notNull().$type<Record<string, unknown>>(),
    /** Sha256 SHA-2 hash linking this event to the previous chain hash. */
    chainHash: text('chain_hash').notNull(),
    /** HMAC-SHA256 signature for data integrity. */
    hmac: text('hmac').notNull(),
    /** Version of the key used to generate the HMAC. */
    hmacKeyVersion: integer('hmac_key_version').notNull().default(1),
    /** Wall-clock timestamp of when the event occurred. */
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Unique Index
    uniqueIndex('uq_audit_events_sequence').on(table.sequenceNumber),
    // Standard Indexes
    index('idx_audit_events_city_occurred').on(table.cityId, table.occurredAt),
    index('idx_audit_events_actor').on(table.actorId),
    index('idx_audit_events_target').on(table.targetId),
    // Partial Index
    index('idx_audit_events_resource_office')
      .on(table.resourceOfficeId)
      .where(sql`${table.resourceOfficeId} IS NOT NULL`),
    // Check Constraints
    check('chain_hash_check', sql`${table.chainHash} ~ '^[a-f0-9]{64}$'`),
    check('hmac_check', sql`${table.hmac} ~ '^[a-f0-9]{64}$'`),
  ],
);
