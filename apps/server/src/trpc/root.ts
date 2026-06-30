import { router } from './trpc.js';
import { iamRouter } from '../modules/iam/iam.router.js';

export const appRouter = router({
  iam: iamRouter,
});

export type AppRouter = typeof appRouter;
