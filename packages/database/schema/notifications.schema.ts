import {
  pgSchema,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  unique,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The `notifications` PostgreSQL schema.
 *
 * Handles notification templates, notification events, and delivery logs.
 */
export const notificationsSchema = pgSchema('notifications');

/**
 * notifications.templates table
 * Stores templates for various notification channels.
 */
export const templates = notificationsSchema.table(
  'templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    name: text('name').notNull(),
    channel: text('channel').notNull(),
    subjectTemplate: text('subject_template'),
    bodyTemplate: text('body_template').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by'), // logical FK -> iam.users.id (cross-schema)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_templates_city_name_channel').on(table.cityId, table.name, table.channel),
    check(
      'templates_channel_check',
      sql`${table.channel} IN ('in_app','email','sms')`,
    ),
  ],
);

/**
 * notifications.notification_events table
 * Records individual notification events triggered in the system.
 */
export const notificationEvents = notificationsSchema.table(
  'notification_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    templateId: uuid('template_id')
      .notNull()
      .references(() => templates.id),
    channel: text('channel').notNull(),
    recipientUserId: uuid('recipient_user_id'), // logical FK -> iam.users.id (cross-schema)
    recipientEmail: text('recipient_email'),
    recipientPhone: text('recipient_phone'),
    templateData: jsonb('template_data').$type<Record<string, unknown>>(),
    status: text('status').notNull().default('pending'),
    triggeredAt: timestamp('triggered_at', { withTimezone: true }).notNull().defaultNow(),
    sourceEventType: text('source_event_type'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    check(
      'notification_events_channel_check',
      sql`${table.channel} IN ('in_app','email','sms')`,
    ),
    check(
      'notification_events_status_check',
      sql`${table.status} IN ('pending','sent','failed','cancelled')`,
    ),
    index('idx_notification_events_template').on(table.templateId),
    index('idx_notification_events_recipient').on(table.recipientUserId),
  ],
);

/**
 * notifications.delivery_log table
 * Append-only log of delivery attempts for notification events.
 */
export const deliveryLog = notificationsSchema.table(
  'delivery_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    notificationEventId: uuid('notification_event_id')
      .notNull()
      .references(() => notificationEvents.id),
    attemptCount: integer('attempt_count').notNull().default(1),
    status: text('status').notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    check(
      'delivery_log_status_check',
      sql`${table.status} IN ('delivered','bounced','failed')`,
    ),
    index('idx_delivery_log_event').on(table.notificationEventId),
  ],
);
