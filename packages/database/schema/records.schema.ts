import { pgSchema, pgTable, uuid, text, integer, boolean, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const recordsSchema = pgSchema('records');

export const retentionSchedules = recordsSchema.table(
  'retention_schedules',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    name: text('name').notNull(),
    code: text('code').notNull(),
    retentionPeriodYears: integer('retention_period_years'),
    isPermanent: boolean('is_permanent').notNull().default(false),
    dispositionRule: text('disposition_rule'),
    legalBasis: text('legal_basis'),
    // configured_by: logical FK -> iam.users.id (cross-schema); Platform Admin, Tier 2
    configuredBy: uuid('configured_by'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
    deletedBy: uuid('deleted_by'),
  },
  (table) => ({
    chkRetentionPeriod: check(
      'chk_retention_period',
      sql`${table.isPermanent} = true OR ${table.retentionPeriodYears} IS NOT NULL`
    ),
  })
);
