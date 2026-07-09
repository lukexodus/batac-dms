import { router } from './trpc.js';
import { iamRouter } from '../modules/iam/iam.router.js';
import { createDocumentsAppRouter } from '../modules/documents/index.js';
import { createTrackingRouter } from '../modules/tracking/tracking.router.js';
import { workflowRouter } from '../modules/workflow/workflow.router.js';
import { sessionRouter } from '../modules/workflow/session.router.js';

import { createOrgRouter } from '../modules/organization/organization.router.js';
import { createAuditTrpcRouter } from '../modules/audit/audit.router.js';

export const appRouter = router({
  iam: iamRouter,
  documents: createDocumentsAppRouter(),
  tracking: createTrackingRouter(),
  workflow: workflowRouter,
  session: sessionRouter,
  organization: createOrgRouter(),
  audit: createAuditTrpcRouter(),
});

export type AppRouter = typeof appRouter;
