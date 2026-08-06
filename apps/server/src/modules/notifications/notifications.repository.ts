import { eq, and, isNull, desc } from 'drizzle-orm';
import {
  templates,
  notificationEvents,
  deliveryLog,
} from '@batac/database/schema/notifications.schema.js';
import type { AppDb, TxOrDb } from '../../db.js';
import type {
  TemplateRecord,
  NotificationEventRecord,
  DeliveryLogRecord,
} from './notifications.types.js';

export function createNotificationsRepository(db: AppDb | TxOrDb) {
  return {
    findActiveTemplateByNameAndChannel: async (
      name: string,
      channel: string,
    ): Promise<TemplateRecord | null> => {
      const [template] = await db
        .select()
        .from(templates)
        .where(
          and(
            eq(templates.name, name),
            eq(templates.channel, channel),
            eq(templates.isActive, true),
            isNull(templates.deletedAt),
          ),
        );
      return template || null;
    },

    findTemplateByNameAndChannel: async (
      name: string,
      channel: string,
    ): Promise<TemplateRecord | null> => {
      const [template] = await db
        .select()
        .from(templates)
        .where(
          and(
            eq(templates.name, name),
            eq(templates.channel, channel),
            isNull(templates.deletedAt),
          ),
        );
      return template || null;
    },

    insertTemplate: async (
      data: typeof templates.$inferInsert,
    ): Promise<TemplateRecord> => {
      const [template] = await db
        .insert(templates)
        .values(data)
        .returning();
      return template!;
    },

    insertNotificationEvent: async (
      data: typeof notificationEvents.$inferInsert,
    ): Promise<NotificationEventRecord> => {
      const [event] = await db
        .insert(notificationEvents)
        .values(data)
        .returning();
      return event!;
    },

    updateNotificationEventStatus: async (
      id: string,
      status: 'pending' | 'sent' | 'failed' | 'cancelled',
    ): Promise<void> => {
      await db
        .update(notificationEvents)
        .set({ status })
        .where(eq(notificationEvents.id, id));
    },

    insertDeliveryLogEntry: async (
      data: typeof deliveryLog.$inferInsert,
    ): Promise<DeliveryLogRecord> => {
      const [log] = await db
        .insert(deliveryLog)
        .values(data)
        .returning();
      return log!;
    },

    listNotificationsForUser: async (
      userId: string,
      opts: { unreadOnly?: boolean; cursor?: Date; pageSize: number },
    ): Promise<NotificationEventRecord[]> => {
      const conditions = [
        eq(notificationEvents.recipientUserId, userId),
        isNull(notificationEvents.deletedAt),
      ];

      if (opts.unreadOnly) {
        conditions.push(eq(notificationEvents.isRead, false));
      }

      let query = db
        .select()
        .from(notificationEvents)
        .where(and(...conditions))
        .$dynamic();

      if (opts.cursor) {
        // NOT part of this fix — cursor pagination remains unimplemented.
        // See TASK-NOTIF-002-FIX-03 (not yet written) for that gap.
      }

      return query
        .orderBy(desc(notificationEvents.createdAt))
        .limit(opts.pageSize);
    },

    markNotificationRead: async (id: string, userId: string): Promise<void> => {
      await db
        .update(notificationEvents)
        .set({ isRead: true })
        .where(
          and(
            eq(notificationEvents.id, id),
            eq(notificationEvents.recipientUserId, userId),
          ),
        );
    },

    listDeliveryLogs: async (opts: {
      limit: number;
      offset: number;
    }): Promise<DeliveryLogRecord[]> => {
      return db
        .select()
        .from(deliveryLog)
        .orderBy(desc(deliveryLog.createdAt))
        .limit(opts.limit)
        .offset(opts.offset);
    },
  };
}

export type NotificationsRepository = ReturnType<
  typeof createNotificationsRepository
>;
