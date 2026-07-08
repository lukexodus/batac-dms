import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc.js';
import type { AuditPublicAPI, AuditQueryResult } from './index.js';

// ─── Allowed roles ────────────────────────────────────────────────────────────

const ALLOWED_ROLES = ['sys_admin', 'auditor'] as const;

// ─── Input schema ─────────────────────────────────────────────────────────────

/**
 * Zod schema for audit.queryEvents input.
 * Mirrors AuditQueryFilter from index.ts, but as a validated tRPC input.
 */
const auditQueryEventsInput = z.object({
  actorId:    z.string().uuid().optional(),
  targetId:   z.string().uuid().optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  pageSize:   z.number().int().min(1).max(200).optional(),
  cursor:     z.string().optional(),
});

export type AuditQueryEventsInput = z.infer<typeof auditQueryEventsInput>;

// ─── Router factory ───────────────────────────────────────────────────────────

/**
 * Creates the audit tRPC router bound to the provided AuditPublicAPI instance.
 *
 * Procedure: audit.queryEvents
 *   - Requires an authenticated session (protectedProcedure enforces this).
 *   - Restricts access to 'sys_admin' or 'auditor' roles (RBAC gate, I1 §8).
 *   - Delegates query execution to AuditQueryService via AuditPublicAPI.
 *
 * @param auditService - The AuditPublicAPI facade, typically from fastify.auditService.
 */
export function createAuditTrpcRouter(auditService?: AuditPublicAPI) {
  return router({
    queryEvents: protectedProcedure
      .input(auditQueryEventsInput)
      .query(async ({ ctx, input }): Promise<AuditQueryResult> => {
        // ── RBAC gate ────────────────────────────────────────────────────────
        // Only sys_admin and auditor may query audit events (I1 §8, task spec).
        // ctx.session is guaranteed non-null by protectedProcedure.
        const hasRole = ctx.session.roles.some((r) =>
          (ALLOWED_ROLES as readonly string[]).includes(r),
        );

        if (!hasRole) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Access denied: requires sys_admin or auditor role',
          });
        }

        // ── Delegate to AuditQueryService ────────────────────────────────────
        const service = auditService ?? (ctx.req.server as any).auditService;
        return service.queryEvents({
          actorId:    input.actorId,
          targetId:   input.targetId,
          eventTypes: input.eventTypes,
          from:       input.from,
          to:         input.to,
          pageSize:   input.pageSize,
          cursor:     input.cursor,
        });
      }),
  });
}

export type AuditTrpcRouter = ReturnType<typeof createAuditTrpcRouter>;
