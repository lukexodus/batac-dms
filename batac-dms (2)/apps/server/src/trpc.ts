import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './modules/iam/iam.types.js';

/**
 * Initialize tRPC backend builder with request Context
 */
const t = initTRPC.context<Context>().create();

/**
 * Base tRPC router creator
 */
export const router = t.router;

/**
 * Public procedure base (optional, but good practice to keep)
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure base. Requires a valid session context.
 * Automatically throws UNAUTHORIZED if not logged in.
 * Maps ctx.auth to ctx.session to supply roles for ABAC / RBAC checks.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.auth) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  return next({
    ctx: {
      auth: ctx.auth,
      session: {
        roles: ctx.auth.roles,
        userId: ctx.auth.userId,
        sessionId: ctx.auth.sessionId,
      },
    },
  });
});
