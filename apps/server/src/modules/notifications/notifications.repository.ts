import { eq, and, or, lt, isNull, desc, gte, lte } from 'drizzle-orm';
import {
  templates,
  notificationEvents,
  deliveryLog,
  notificationPreferences,
} from '@batac/database/schema/notifications.schema.js';
import type { AppDb, TxOrDb } from '../../db.js';
import type {
  TemplateRecord,
  NotificationEventRecord,
  DeliveryLogRecord,
  NotificationPreferenceRecord,
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
      opts: { unreadOnly?: boolean; cursor?: string; pageSize: number },
    ): Promise<(NotificationEventRecord & { subjectTemplate: string | null; bodyTemplate: string; templateName: string })[]> => {
      const conditions = [
        eq(notificationEvents.recipientUserId, userId),
        isNull(notificationEvents.deletedAt),
      ];

      if (opts.unreadOnly) {
        conditions.push(eq(notificationEvents.isRead, false));
      }

      if (opts.cursor) {
        const parts = opts.cursor.split('_');
        if (parts.length === 2 && parts[0] && parts[1]) {
          const dateStr = parts[0];
          const idStr = parts[1];
          const cursorDate = new Date(parseInt(dateStr, 10));
          const condition = or(
            lt(notificationEvents.createdAt, cursorDate),
            and(
              eq(notificationEvents.createdAt, cursorDate),
              lt(notificationEvents.id, idStr)
            )
          );
          if (condition) conditions.push(condition);
        }
      }

      let query = db
        .select({
          event: notificationEvents,
          subjectTemplate: templates.subjectTemplate,
          bodyTemplate: templates.bodyTemplate,
          templateName: templates.name,
        })
        .from(notificationEvents)
        .leftJoin(templates, eq(notificationEvents.templateId, templates.id))
        .where(and(...conditions))
        .orderBy(desc(notificationEvents.createdAt), desc(notificationEvents.id))
        .limit(opts.pageSize);

      const rows = await query;
      return rows.map((r) => ({
        ...r.event,
        subjectTemplate: r.subjectTemplate,
        bodyTemplate: r.bodyTemplate!,
        templateName: r.templateName!,
      }));
    },

    markNotificationRead: async (id: string, userId: string): Promise<boolean> => {
      const [updated] = await db
        .update(notificationEvents)
        .set({ isRead: true })
        .where(
          and(
            eq(notificationEvents.id, id),
            eq(notificationEvents.recipientUserId, userId),
          ),
        )
        .returning({ id: notificationEvents.id });
      return !!updated;
    },

    listDeliveryLogs: async (opts: {
      cursor?: string;
      pageSize: number;
      from?: Date;
      to?: Date;
    }) => {
      const conditions: any[] = [];
      if (opts.from) conditions.push(gte(deliveryLog.createdAt, opts.from));
      if (opts.to) conditions.push(lte(deliveryLog.createdAt, opts.to));

      if (opts.cursor) {
        const parts = opts.cursor.split('_');
        if (parts.length === 2 && parts[0] && parts[1]) {
          const dateStr = parts[0];
          const idStr = parts[1];
          const cursorDate = new Date(parseInt(dateStr, 10));
          const condition = or(
            lt(deliveryLog.createdAt, cursorDate),
            and(
              eq(deliveryLog.createdAt, cursorDate),
              lt(deliveryLog.id, idStr)
            )
          );
          if (condition) conditions.push(condition);
        }
      }

      const rows = await db
        .select({
          deliveryLogId: deliveryLog.id,
          recipientUserId: notificationEvents.recipientUserId,
          recipientEmail: notificationEvents.recipientEmail,
          channel: notificationEvents.channel,
          status: deliveryLog.status,
          sentAt: deliveryLog.createdAt,
          errorMessage: deliveryLog.errorMessage,
        })
        .from(deliveryLog)
        .leftJoin(notificationEvents, eq(deliveryLog.notificationEventId, notificationEvents.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(deliveryLog.createdAt), desc(deliveryLog.id))
        .limit(opts.pageSize);
        
      return rows;
    },

    getOwnPreferences: async (userId: string): Promise<NotificationPreferenceRecord[]> => {
      return db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId));
    },

    updateOwnPreferences: async (
      userId: string,
      preferences: { templateCategory: string; channel: string; enabled: boolean }[],
    ): Promise<void> => {
      if (preferences.length === 0) return;
      await db.transaction(async (tx) => {
        for (const pref of preferences) {
          await tx
            .insert(notificationPreferences)
            .values({
              userId,
              templateCategory: pref.templateCategory,
              channel: pref.channel,
              enabled: pref.enabled,
            })
            .onConflictDoUpdate({
              target: [notificationPreferences.userId, notificationPreferences.templateCategory, notificationPreferences.channel],
              set: { enabled: pref.enabled, updatedAt: new Date() }
            });
        }
      });
    },
  };
}

export type NotificationsRepository = ReturnType<
  typeof createNotificationsRepository
>;
