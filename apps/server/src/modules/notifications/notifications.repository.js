import { eq, and, isNull, desc } from 'drizzle-orm';
import { templates, notificationEvents, deliveryLog, } from '@batac/database/schema/notifications.schema.js';
export function createNotificationsRepository(db) {
    return {
        findActiveTemplateByNameAndChannel: async (name, channel) => {
            const [template] = await db
                .select()
                .from(templates)
                .where(and(eq(templates.name, name), eq(templates.channel, channel), eq(templates.isActive, true), isNull(templates.deletedAt)));
            return template || null;
        },
        findTemplateByNameAndChannel: async (name, channel) => {
            const [template] = await db
                .select()
                .from(templates)
                .where(and(eq(templates.name, name), eq(templates.channel, channel), isNull(templates.deletedAt)));
            return template || null;
        },
        insertTemplate: async (data) => {
            const [template] = await db
                .insert(templates)
                .values(data)
                .returning();
            return template;
        },
        insertNotificationEvent: async (data) => {
            const [event] = await db
                .insert(notificationEvents)
                .values(data)
                .returning();
            return event;
        },
        updateNotificationEventStatus: async (id, status) => {
            await db
                .update(notificationEvents)
                .set({ status })
                .where(eq(notificationEvents.id, id));
        },
        insertDeliveryLogEntry: async (data) => {
            const [log] = await db
                .insert(deliveryLog)
                .values(data)
                .returning();
            return log;
        },
        listNotificationsForUser: async (userId, opts) => {
            let query = db
                .select()
                .from(notificationEvents)
                .where(and(eq(notificationEvents.recipientUserId, userId), isNull(notificationEvents.deletedAt)))
                .$dynamic();
            if (opts.cursor) {
                // If needed, cursor pagination logic can be added here
            }
            return query
                .orderBy(desc(notificationEvents.createdAt))
                .limit(opts.pageSize);
        },
        markNotificationRead: async (id, userId) => {
            await db
                .update(notificationEvents)
                .set({ deletedAt: new Date() })
                .where(and(eq(notificationEvents.id, id), eq(notificationEvents.recipientUserId, userId)));
        },
        listDeliveryLogs: async (opts) => {
            return db
                .select()
                .from(deliveryLog)
                .orderBy(desc(deliveryLog.createdAt))
                .limit(opts.limit)
                .offset(opts.offset);
        },
    };
}
