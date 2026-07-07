import { router } from './trpc.js';
import { iamRouter } from '../modules/iam/iam.router.js';
import { createDocumentsAppRouter } from '../modules/documents/index.js';
import { createTrackingRouter } from '../modules/tracking/tracking.router.js';
import { workflowRouter } from '../modules/workflow/workflow.router.js';
import { sessionRouter } from '../modules/workflow/session.router.js';

export const appRouter = router({
  iam: iamRouter,
  documents: createDocumentsAppRouter(),
  tracking: createTrackingRouter(),
  workflow: workflowRouter,
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
