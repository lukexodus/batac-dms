import {
  pgSchema,
  uuid,
  text,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The `tracking` PostgreSQL schema.
 *
 * QR code identity, the physical/custody tracking record per document, and
 * the append-style routing history. Deliberately kept separate from
 * `documents.documents.lifecycle_state` — physical custody is tracked
 * separately from digital workflow status.
 *
 * Sources:
 *   C1 Part 7 DDL (L1572–L1710)
 *   C1 Part 1 (cross-schema FK / PK / city_id / timestamp / soft-delete conventions)
 *   C1 Part 11 (tracking.dts_2026_seq pre-created sequence — manual SQL, see migration)
 *   C1 Part 12 (tracking schema grants — manual SQL, see migration + post-migrate-grants.sql)
 *   [RESOLVED — SPEC-GAP-TRACK-01, 2026-06-30] (tracking_number format/assignment)
 *
 * NOTE ([Unverified] — not part of any source document): TASK-TRACK-001's AI
 * Prompt deliverable paths read `/packages/database/src/schema/tracking.ts`
 * and `/apps/server/src/database/migrations/{timestamp}_create_tracking_schema.sql`.
 * Neither path exists in this repository — there is no `src/` segment under
 * `packages/database`, and migrations live in `/packages/database/migrations/`,
 * numbered sequentially by Drizzle Kit (not timestamped) per C5 §2.1/§3.1.
 * This file is placed at the verified, established location
 * (`packages/database/schema/tracking.schema.ts`, matching `documents.schema.ts`,
 * `organization.schema.ts`, etc.) instead of the literal AI Prompt path — the
 * same discrepancy TASK-DOCS-001 already hit and resolved the same way (see
 * that file's header comment).
 *
 * No `updated_at` column and no `fn_set_updated_at()` trigger on any table in
 * this schema (C1 §1.4) — `qr_codes` and `tracking_records` simply omit it by
 * DDL choice, and `routing_entries` is append-only. `routing_entries` also has
 * UPDATE/DELETE revoked for `batac_app` at the grant level — enforced in the
 * migration's manual-additions section and in `post-migrate-grants.sql`, not
 * representable here since GRANT/REVOKE are outside Drizzle's table schema API.
 */
export const trackingSchema = pgSchema('tracking');

// ---------------------------------------------------------------------------
// tracking.qr_codes
// tracking_id holds the same UUID value as documents.documents.qr_tracking_number
// (D4 Relationship Note 9). Assigned at secretariat logging, before the
// preliminary number. tracking_number is a distinct, human-readable
// DTS-{YEAR}-{SEQUENCE} display label populated at the application layer via
// tracking.fn_get_next_tracking_number(year) (manual SQL, see migration) — never
// a DB-level column default. [RESOLVED — SPEC-GAP-TRACK-01, 2026-06-30]
// ---------------------------------------------------------------------------
export const qrCodes = trackingSchema.table(
  'qr_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentId: uuid('document_id').notNull(), // logical FK → documents.documents.id (cross-schema)
    /** UUID encoded in the physical QR image. */
    trackingId: uuid('tracking_id').notNull(),
    /**
     * Human-readable display label, e.g. 'DTS-2026-0001'. Distinct from
     * `tracking_id`. Populated at the application layer via
     * `tracking.fn_get_next_tracking_number(year)`; stored as immutable TEXT,
     * never regenerated.
     */
    trackingNumber: text('tracking_number').notNull(),
    qrImageFileKey: uuid('qr_image_file_key'),
    assignedAt: timestamp('assigned_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    generatedBy: uuid('generated_by'), // logical FK → iam.users.id (cross-schema)
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_qr_codes_tracking_id').on(table.trackingId),
    unique('uq_qr_codes_document').on(table.documentId),
    unique('uq_qr_codes_tracking_number').on(table.trackingNumber),
  ],
);

// ---------------------------------------------------------------------------
// tracking.tracking_records
// current_status is intentionally free TEXT — not CHECK-constrained against
// documents.lifecycle_state. Physical custody is a separate state machine.
// ---------------------------------------------------------------------------
export const trackingRecords = trackingSchema.table(
  'tracking_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentId: uuid('document_id').notNull(), // logical FK → documents.documents.id (cross-schema)
    qrCodeId: uuid('qr_code_id')
      .notNull()
      .references(() => qrCodes.id),
    currentStatus: text('current_status'),
    /** NULL if the document is currently with an external party. */
    currentCustodianOfficeId: uuid('current_custodian_office_id'), // logical FK → organization.offices.id (cross-schema)
    physicalLocation: text('physical_location'),
    lastMovedAt: timestamp('last_moved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_tracking_records_document').on(table.documentId),
    index('idx_tracking_records_qr_code').on(table.qrCodeId),
  ],
);

// ---------------------------------------------------------------------------
// tracking.routing_entries
// Append-only: no updated_at (C1 §1.4). UPDATE/DELETE additionally revoked at
// the grant level for batac_app (see migration + post-migrate-grants.sql).
// Field shape follows B2's RoutingEntry TypeScript interface
// (fromOfficeId/toOfficeId/actorId/actionDescription/timestamp).
// ---------------------------------------------------------------------------
export const routingEntries = trackingSchema.table(
  'routing_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    trackingRecordId: uuid('tracking_record_id')
      .notNull()
      .references(() => trackingRecords.id),
    /** NULL at the first entry. */
    fromOfficeId: uuid('from_office_id'), // logical FK → organization.offices.id (cross-schema)
    /** NULL when the destination is external. */
    toOfficeId: uuid('to_office_id'), // logical FK → organization.offices.id (cross-schema)
    /** NULL = system action. */
    actorId: uuid('actor_id'), // logical FK → iam.users.id (cross-schema)
    actionDescription: text('action_description').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK → iam.users.id (cross-schema)
  },
  (table) => [
    index('idx_routing_entries_tracking_record').on(table.trackingRecordId),
    index('idx_routing_entries_occurred_at').on(table.occurredAt),
  ],
);
