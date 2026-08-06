import { router } from './trpc.js';
import { iamRouter } from '../modules/iam/iam.router.js';
import { createDocumentsAppRouter } from '../modules/documents/documents.app.router.js';
import { createTrackingRouter } from '../modules/tracking/tracking.router.js';

// Type-only imports: pull in the `declare module 'fastify'` augmentations
// for documentsRepository/documentsPolicyGuard/numberingService/
// designationHandler (documents.plugin.ts) and trackingService/
// qrCodeService (tracking.plugin.ts). These augmentations already exist and
// are already correct; they are not otherwise reachable from this file's
// import graph, which is what apps/web's tsc walks to resolve AppRouter's
// type. Do not remove — removing these re-introduces 12 TS2339 errors in
// apps/web's typecheck. See root.ts's own git history / commit message for
// this line for the full root-cause trace if this comment is ever
// insufficient context on its own.
import type {} from '../modules/documents/documents.plugin.js';
import type {} from '../modules/tracking/tracking.plugin.js';
import type {} from '../modules/notifications/notifications.plugin.js';
import type {} from '../infrastructure/mailer.plugin.js';
import { workflowRouter } from '../modules/workflow/workflow.router.js';
import { sessionRouter } from '../modules/workflow/session.router.js';

import { createOrgRouter } from '../modules/organization/organization.router.js';
import { createAuditTrpcRouter } from '../modules/audit/audit.router.js';
import { notificationsRouter } from '../modules/notifications/notifications.router.js';

export const appRouter = router({
  iam: iamRouter,
  documents: createDocumentsAppRouter(),
  tracking: createTrackingRouter(),
  workflow: workflowRouter,
  session: sessionRouter,
  organization: createOrgRouter(),
  audit: createAuditTrpcRouter(),
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
