import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';

// Shared Fragment Schemas
const paginationInput = z.object({
  cursor: z.string().nullish(),
  pageSize: z.number().int().min(1).max(100).default(20),
});
const dateRangeInput = z.object({
  from: z.coerce.date().nullish(),
  to: z.coerce.date().nullish(),
});

// Helper for rendering templates inline
const renderTemplate = (text: string | null, data: Record<string, any>) => {
  if (!text) return '';
  let rendered = text;
  const matches = rendered.match(/\{\{([^}]+)\}\}/g);
  if (matches) {
    for (const match of matches) {
      const key = match.slice(2, -2).trim();
      if (key in data) {
        rendered = rendered.replace(match, String(data[key]));
      }
    }
  }
  return rendered;
};

export const notificationsRouter = router({
  listMine: protectedProcedure
    .input(paginationInput.extend({ unreadOnly: z.boolean().default(false) }))
    .output(
      z.object({
        items: z.array(
          z.object({
            notificationId: z.string().uuid(),
            templateId: z.string(),
            renderedTitle: z.string(),
            renderedBody: z.string(),
            isRead: z.boolean(),
            createdAt: z.coerce.date(),
            relatedDocumentId: z.string().uuid().nullable(),
          })
        ),
        nextCursor: z.string().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const auth = ctx.auth!;
      const allowedRoles = new Set([
        'records_officer',
        'dept_encoder',
        'dept_approver',
        'sp_secretary',
        'sp_member',
        'sp_presiding_officer',
        'mayor',
        'brgy_encoder',
        'brgy_captain',
      ]);

      if (
        !auth.roles.some((r) => allowedRoles.has(r)) &&
        !auth.effectiveRoles?.some((r) => allowedRoles.has(r))
      ) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const rows = await (ctx.req.server as any).notificationsRepository.listNotificationsForUser(auth.userId, {
        unreadOnly: input.unreadOnly,
        cursor: input.cursor ?? undefined,
        pageSize: input.pageSize,
      });

      const items = rows.map((r: any) => {
        const data = (r.templateData as Record<string, any>) || {};
        return {
          notificationId: r.id,
          templateId: r.templateName,
          renderedTitle: renderTemplate(r.subjectTemplate, data),
          renderedBody: renderTemplate(r.bodyTemplate, data),
          isRead: r.isRead,
          createdAt: r.createdAt,
          relatedDocumentId: typeof data['documentId'] === 'string' ? data['documentId'] : null,
        };
      });

      let nextCursor = null;
      if (rows.length === input.pageSize) {
        const lastRow = rows[rows.length - 1];
        nextCursor = `${lastRow.createdAt.getTime()}_${lastRow.id}`;
      }

      return { items, nextCursor };
    }),

  markAsRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .output(z.object({ success: z.literal(true) }))
    .mutation(async ({ ctx, input }) => {
      const auth = ctx.auth!;
      const allowedRoles = new Set([
        'records_officer',
        'dept_encoder',
        'dept_approver',
        'sp_secretary',
        'sp_member',
        'sp_presiding_officer',
        'mayor',
        'brgy_encoder',
        'brgy_captain',
      ]);

      if (
        !auth.roles.some((r) => allowedRoles.has(r)) &&
        !auth.effectiveRoles?.some((r) => allowedRoles.has(r))
      ) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const success = await (ctx.req.server as any).notificationsRepository.markNotificationRead(
        input.notificationId,
        auth.userId
      );
      if (!success) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Notification not found or access denied.',
        });
      }
      return { success: true as const };
    }),

  getOwnPreferences: protectedProcedure
    .output(
      z.object({
        preferences: z.array(
          z.object({
            templateCategory: z.string(),
            channel: z.string(),
            enabled: z.boolean(),
          })
        ),
      })
    )
    .query(async ({ ctx }) => {
      const prefs = await (ctx.req.server as any).notificationsRepository.getOwnPreferences(ctx.auth!.userId);
      return { preferences: prefs };
    }),

  updateOwnPreferences: protectedProcedure
    .input(
      z.object({
        channel: z.enum(['in_app']),
        templateCategory: z.string(),
        enabled: z.boolean(),
      })
    )
    .output(
      z.object({
        preferences: z.array(
          z.object({
            templateCategory: z.string(),
            channel: z.string(),
            enabled: z.boolean(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await (ctx.req.server as any).notificationsRepository.updateOwnPreferences(ctx.auth!.userId, [input]);
      const prefs = await (ctx.req.server as any).notificationsRepository.getOwnPreferences(ctx.auth!.userId);
      return { preferences: prefs };
    }),

  listDeliveryLogs: protectedProcedure
    .input(paginationInput.extend({ ...dateRangeInput.shape }))
    .output(
      z.object({
        items: z.array(
          z.object({
            deliveryLogId: z.string().uuid(),
            recipientUserId: z.string().uuid().nullable(),
            recipientEmail: z.string().nullable(),
            channel: z.string(),
            status: z.string(),
            sentAt: z.coerce.date(),
          })
        ),
        nextCursor: z.string().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      const auth = ctx.auth!;
      if (!auth.roles.includes('sys_admin') && !auth.roles.includes('plat_admin')) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const rows = await (ctx.req.server as any).notificationsRepository.listDeliveryLogs({
        cursor: input.cursor ?? undefined,
        pageSize: input.pageSize,
        from: input.from ?? undefined,
        to: input.to ?? undefined,
      });

      const items = rows.map((r: any) => ({
        deliveryLogId: r.deliveryLogId,
        recipientUserId: r.recipientUserId ?? null,
        recipientEmail: r.recipientEmail ?? null,
        channel: r.channel ?? 'unknown',
        status: r.status,
        sentAt: r.sentAt,
      }));

      let nextCursor = null;
      if (rows.length === input.pageSize) {
        const lastRow = rows[rows.length - 1];
        nextCursor = `${lastRow.sentAt.getTime()}_${lastRow.deliveryLogId}`;
      }

      return { items, nextCursor };
    }),
});
