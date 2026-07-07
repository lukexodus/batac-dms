import { router } from './trpc.js';
import { iamRouter } from '../modules/iam/iam.router.js';
import {
  createComplaintsRouter,
  createDocumentRequestsRouter,
} from '../modules/documents/index.js';
import { createTrackingRouter } from '../modules/tracking/tracking.router.js';
import { workflowRouter } from '../modules/workflow/workflow.router.js';
import { sessionRouter } from '../modules/workflow/session.router.js';

export const appRouter = router({
  iam: iamRouter,
  complaints: createComplaintsRouter(),
  documentRequests: createDocumentRequestsRouter(),
  tracking: createTrackingRouter(),
  workflow: workflowRouter,
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
