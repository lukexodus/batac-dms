import { router } from './trpc.js';
import { iamRouter } from '../modules/iam/iam.router.js';
import { createComplaintsRouter } from '../modules/documents/index.js';

export const appRouter = router({
  iam: iamRouter,
  complaints: createComplaintsRouter(),
});

export type AppRouter = typeof appRouter;
