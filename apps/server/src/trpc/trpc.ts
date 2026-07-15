import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { Context } from '../modules/iam/iam.types.js';
import type { AppDb } from '../db.js';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';

export function createContext({ req, res }: CreateFastifyContextOptions): Context {
  return {
    auth: (req as any).auth || null,
    db: (req.server as any).db as AppDb,
    req: req as any,
    requestId: req.id,
  };
}

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, ctx }) {
    const isProduction = process.env['NODE_ENV'] === 'production';

    const domainError =
      error.cause instanceof AppError
        ? {
            code: error.cause.code,
            details: error.cause.details ?? null,
          }
        : null;

    const zodError =
      error.cause instanceof ZodError
        ? error.cause.flatten()
        : null;

    return {
      ...shape,
      data: {
        ...shape.data,
        traceId: ctx?.requestId ?? null,
        domainError,
        zodError,
        // Strip stack trace in production
        stack: isProduction ? undefined : shape.data.stack,
      },
    };
  },
});

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
