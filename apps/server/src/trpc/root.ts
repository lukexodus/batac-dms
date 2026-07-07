import { router } from './trpc.js';
import { iamRouter } from '../modules/iam/iam.router.js';
import { createDocumentsAppRouter } from '../modules/documents/index.js';
import { createTrackingRouter } from '../modules/tracking/tracking.router.js';

export const appRouter = router({
  iam: iamRouter,
  documents: createDocumentsAppRouter(),
  tracking: createTrackingRouter(),
});

export type AppRouter = typeof appRouter;
