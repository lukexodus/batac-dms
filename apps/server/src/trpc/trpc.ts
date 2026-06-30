import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { Context } from '../modules/iam/iam.types.js';
import type { AppDb } from '../db.js';

export function createContext({ req, res }: CreateFastifyContextOptions): Context {
  return {
    auth: (req as any).auth || null,
    db: (req.server as any).db as AppDb,
    req: req as any,
  };
}

export const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.auth) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource.',
    });
  }
  return opts.next({
    ctx: {
      ...opts.ctx,
      auth: opts.ctx.auth,
    },
  });
});
