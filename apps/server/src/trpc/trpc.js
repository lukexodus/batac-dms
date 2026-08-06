import { initTRPC, TRPCError } from '@trpc/server';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';
export function createContext({ req, res }) {
    return {
        auth: req.auth || null,
        db: req.server.db,
        req: req,
        requestId: req.id,
    };
}
export const t = initTRPC.context().create({
    errorFormatter({ shape, error, ctx }) {
        const isProduction = process.env['NODE_ENV'] === 'production';
        const domainError = error.cause instanceof AppError
            ? {
                code: error.cause.code,
                details: error.cause.details ?? null,
            }
            : null;
        const zodError = error.cause instanceof ZodError ? error.cause.flatten() : null;
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
