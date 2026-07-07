/**
 * app.ts — constructs and fully wires the Fastify application instance.
 *
 * Owns: the health route, all infrastructure/module plugins (database →
 * event-bus → audit → iam → ...future modules), and the merged tRPC
 * adapter (registered last, after every module's decorations exist, so
 * `createContext` and the IAM auth preHandlers can rely on `fastify.db` /
 * `fastify.iamService` / etc. already being present).
 *
 * Deliberately does NOT call `.listen()` — that remains src/index.ts's job,
 * alongside process-level bootstrap concerns unrelated to the HTTP plugin
 * tree (starting PgBoss, registering background jobs).
 *
 * [Inference] Folding `registerHealthRoute` in here (rather than leaving it
 * in index.ts, where it lived before this task) is this task's own choice,
 * not something stated in TASK-IAM-014's deliverables or AI Prompt. It is
 * done so that `buildApp()` returns a fully-formed, ready-to-listen app on
 * its own — consistent with how every other route/plugin in this file is
 * wired — rather than leaving one route registration as an extra step the
 * caller has to remember. This is a judgment call, not a confirmed
 * requirement; flagging it as such per project preference for labeling
 * inferences.
 *
 * Registration order: database, event-bus, and audit are prerequisites of
 * iam (TASK-IAM-014 prerequisites: TASK-IAM-006…013, TASK-AUDIT-003) and of
 * each other transitively (event-bus needs database for
 * DeadLetterRepository; audit needs database + event-bus). The organization
 * plugin is intentionally NOT registered here — TASK-IAM-014's acceptance
 * criteria require a full login to succeed end-to-end with no organization
 * module registered, confirming iam.service.ts's default no-op org-context
 * resolvers (TASK-IAM-006) are sufficient through Wave B alone.
 *
 * Source: TASK-IAM-014.
 */
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { env } from './config/env.js';
import { registerHealthRoute } from './routes/health.route.js';
import databasePlugin from './infrastructure/database.plugin.js';
import eventBusPlugin from './infrastructure/event-bus.plugin.js';
import auditPlugin from './modules/audit/audit.plugin.js';
import iamPlugin from './modules/iam/iam.plugin.js';
import organizationPlugin from './modules/organization/organization.plugin.js';
import documentsPlugin from './modules/documents/documents.plugin.js';
import trackingPlugin from './modules/tracking/tracking.plugin.js';
import { workflowPlugin } from './modules/workflow/index.js';
import rateLimit from '@fastify/rate-limit';
// organization, documents, workflow, tracking, notifications: add
// `await fastify.register(...)` below, after iamPlugin and before the tRPC
// registration, when each module's own plugin-wiring task completes.

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: env.LOG_LEVEL !== 'silent' ? { level: env.LOG_LEVEL } : false,
    ...opts,
  });

  await registerHealthRoute(fastify);

  // Wave B infrastructure + module plugins, in dependency order.
  await fastify.register(databasePlugin);
  await fastify.register(eventBusPlugin);
  await fastify.register(auditPlugin);
  await fastify.register(rateLimit, {
    max: env.RATE_API_MAX,
    timeWindow: env.RATE_API_WINDOW_MS,
    allowList: [env.HEALTH_CHECK_PATH],
  });
  await fastify.register(iamPlugin);
  await fastify.register(organizationPlugin);
  await fastify.register(documentsPlugin);
  await fastify.register(trackingPlugin);
  await fastify.register(workflowPlugin);

  // Merged tRPC router — must come last so every module's decorations are
  // already present when createContext/procedures run.
  const { fastifyTRPCPlugin } = await import('@trpc/server/adapters/fastify');
  const { appRouter } = await import('./trpc/root.js');
  const { createContext } = await import('./trpc/trpc.js');

  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError: ({ error, path }: { error: unknown; path?: string }) => {
        fastify.log.error({ err: error, path }, 'tRPC error');
      },
    },
  });

  return fastify;
}
