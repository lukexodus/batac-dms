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
import { applyTimeMockIfConfigured } from './mock-time.js';
applyTimeMockIfConfigured();

import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
  validatorCompiler,
  serializerCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type PgBoss from 'pg-boss';
import { env } from './config/env.js';
import { nanoid } from 'nanoid';
import pino from 'pino';
import { parseOtlpHeaders } from './config/otlp-headers.js';
import { registerHealthRoute } from './routes/health.route.js';
import databasePlugin from './infrastructure/database.plugin.js';
import eventBusPlugin from './infrastructure/event-bus.plugin.js';
import mailerPlugin from './infrastructure/mailer.plugin.js';
import auditPlugin from './modules/audit/audit.plugin.js';
import iamPlugin from './modules/iam/iam.plugin.js';
import organizationPlugin from './modules/organization/organization.plugin.js';
import documentsPlugin from './modules/documents/documents.plugin.js';
import trackingPlugin from './modules/tracking/tracking.plugin.js';
import workflowPlugin from './modules/workflow/workflow.plugin.js';
import notificationsPlugin from './modules/notifications/notifications.plugin.js';
import portalPlugin from './modules/portal/portal.plugin.js';
import openapiPlugin from './plugins/openapi.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import corsPlugin from './plugins/cors.js';

import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
// organization, documents, workflow, tracking, notifications: add
// `await fastify.register(...)` below, after iamPlugin and before the tRPC
// registration, when each module's own plugin-wiring task completes.

/**
 * [Confirmed — see docs/development-findings-log.md, Bug B] `organizationPlugin`
 * reads `fastify.boss` synchronously during its own registration (to build
 * `delegationService`'s deps). Previously, `index.ts`'s `main()` called
 * `buildApp()` (which registers `organizationPlugin`) BEFORE constructing
 * PgBoss and decorating `fastify.boss` — so `fastify.boss` was `undefined`
 * the entire time `organizationPlugin` ran, on every real boot.
 * `createDelegationGrant`'s Step 7 (`deps.boss.send(...)`) would throw at
 * runtime the first time it was actually invoked.
 *
 * Fix: `buildApp()` now accepts an optional pre-constructed `boss` instance.
 * When supplied, it is decorated onto the Fastify instance BEFORE
 * `organizationPlugin` registers, so `fastify.boss` exists by the time
 * `organizationPlugin` reads it. `index.ts` is updated to construct and
 * start PgBoss first, then pass it into `buildApp({ boss })`.
 *
 * This param is optional and defaults to not decorating `boss` at all,
 * preserving this file's own stated testability contract (buildApp() can
 * still be called with zero required setup, e.g. for fastify.inject()-based
 * tests that don't need PgBoss). [Unverified] — I have not executed this
 * against a real database/PgBoss instance; this is a claim about what the
 * code below does, not a tested guarantee.
 */
export interface BuildAppOptions extends FastifyServerOptions {
  boss?: PgBoss;
}

export async function buildApp(opts: BuildAppOptions = {}): Promise<FastifyInstance> {
  const { boss, ...fastifyOpts } = opts;

  let loggerConfig: any = false;

  if (env.LOG_LEVEL !== 'silent') {
    // Resolve the primary destination (stdout / stderr / file path) as a
    // pino/file transport target rather than a separate `dest` argument.
    // [Fixed — see docs/development-findings-log.md, LOG-0108] Pino does not
    // allow both `opts.transport` and a second positional `dest` argument to
    // be pino.destination(...) at the same time: when opts.transport is set,
    // Pino builds its stream entirely from `opts.transport` and silently
    // ignores whatever `dest` was also passed — no error is thrown, but
    // LOG_DESTINATION's actual value (stdout vs. stderr vs. a file) has no
    // effect whenever LOG_PRETTY is true. This was confirmed by direct
    // reproduction: constructing pino({ transport }, pino.destination('/tmp/x.log'))
    // and logging a line writes nothing to /tmp/x.log; the line goes to
    // stdout via pino-pretty instead. Folding the primary destination into
    // the same `targets` array as every other transport (pino-pretty, the
    // OTLP log shipper below) avoids this footgun entirely, since there is
    // then only ever one `transport` option and no separate `dest` argument.
    let destinationTarget: { target: string; options: Record<string, unknown> };
    if (env.LOG_DESTINATION === 'stdout') {
      destinationTarget = { target: 'pino/file', options: { destination: 1 } };
    } else if (env.LOG_DESTINATION === 'stderr') {
      destinationTarget = { target: 'pino/file', options: { destination: 2 } };
    } else {
      // Fail loudly at startup if the configured path can't actually be
      // opened for writing, rather than silently falling back to stdout —
      // a swallowed misconfiguration here would recreate the exact
      // "declared but not doing what you think" problem this file's own
      // logging setup exists to fix.
      try {
        pino.destination(env.LOG_DESTINATION).end();
      } catch (err) {
        throw new Error(
          `Invalid LOG_DESTINATION configuration: ${env.LOG_DESTINATION}. Failed to open for writing: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      destinationTarget = {
        target: 'pino/file',
        options: { destination: env.LOG_DESTINATION, mkdir: true },
      };
    }

    const targets: Array<{ target: string; options: Record<string, unknown>; level?: string }> = [];

    if (env.LOG_PRETTY) {
      // In pretty mode, pino-pretty owns stdout/stderr formatting directly
      // (it accepts its own `destination` option), so the plain
      // destinationTarget above would be redundant with it for stdout/stderr.
      // For a genuine file destination, keep both: a human-readable stream
      // to the console plus the raw JSON file, since pretty-printing a
      // long-lived log file defeats the point of a machine-parseable
      // LOG_DESTINATION.
      const prettyDestination =
        env.LOG_DESTINATION === 'stdout' ? 1 : env.LOG_DESTINATION === 'stderr' ? 2 : 1;
      targets.push({
        target: 'pino-pretty',
        options: { colorize: true, destination: prettyDestination },
      });
      if (env.LOG_DESTINATION !== 'stdout' && env.LOG_DESTINATION !== 'stderr') {
        targets.push(destinationTarget);
      }
    } else {
      targets.push(destinationTarget);
    }

    // Ship Pino log content to OpenObserve via OTLP, so that log lines (not
    // just traces) are visible and searchable in OpenObserve's UI. Uses the
    // same OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_HEADERS env vars
    // already declared for the trace exporter in instrumentation.ts.
    // Protocol is fixed to 'http/protobuf' to match this project's chosen
    // HTTP-OTLP transport (see instrumentation.ts's OTLPTraceExporter from
    // @opentelemetry/exporter-trace-otlp-http) rather than gRPC. Shape
    // verified directly against otlp-logger@2.1.1's own published types
    // (LogRecordProcessorOptions.exporterOptions is a discriminated union on
    // `protocol`; for 'http/protobuf' the url/headers config lives one level
    // deeper, under `protobufExporterOptions`, not flat under
    // `exporterOptions` itself).
    targets.push({
      target: 'pino-opentelemetry-transport',
      level: env.LOG_LEVEL,
      options: {
        loggerName: 'batac-server',
        serviceVersion: env.APP_VERSION,
        resourceAttributes: { 'service.name': 'batac-server' },
        logRecordProcessorOptions: {
          recordProcessorType: 'batch',
          exporterOptions: {
            protocol: 'http/protobuf',
            protobufExporterOptions: {
              url: `${env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/logs`,
              headers: parseOtlpHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
            },
          },
        },
      },
    });

    loggerConfig = pino({
      level: env.LOG_LEVEL,
      redact: env.LOG_REDACT_PATHS,
      transport: { targets },
    });
  }

  const fastify = Fastify({
    ...(loggerConfig ? { loggerInstance: loggerConfig } : { logger: false }),
    genReqId: () => `req_${nanoid(12)}`,
    maxParamLength: 10000,
    ...fastifyOpts,
  });

  fastify.setValidatorCompiler(validatorCompiler);
  fastify.setSerializerCompiler(serializerCompiler);

  await registerHealthRoute(fastify);

  await fastify.register(openapiPlugin);
  await fastify.register(rateLimitPlugin);
  await fastify.register(corsPlugin);

  await fastify.register(helmet, {
    xFrameOptions: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true },
  });

  // Wave B infrastructure + module plugins, in dependency order.
  await fastify.register(databasePlugin);
  await fastify.register(eventBusPlugin);
  await fastify.register(mailerPlugin);
  await fastify.register(auditPlugin);
  await fastify.register(iamPlugin);

  // Must be decorated before organizationPlugin registers — see the Bug B
  // note above. If `boss` is not supplied, organizationPlugin still
  // registers, but `fastify.boss` will be undefined within it, exactly as
  // before this fix (callers that don't need delegation-grant creation are
  // unaffected either way).
  if (boss) {
    fastify.decorate('boss', boss);
  }
  await fastify.register(organizationPlugin);
  await fastify.register(documentsPlugin);
  await fastify.register(trackingPlugin);
  await fastify.register(workflowPlugin);
  await fastify.register(notificationsPlugin);
  await fastify.register(portalPlugin);


  // Merged tRPC router — must come last so every module's decorations are
  // already present when createContext/procedures run.
  const { fastifyTRPCPlugin } = await import('@trpc/server/adapters/fastify');
  const { appRouter } = await import('./trpc/root.js');
  const { createContext } = await import('./trpc/trpc.js');

  await fastify.register(async (trpcApp) => {
    await trpcApp.register(rateLimit, {
      max: env.RATE_API_MAX,
      timeWindow: env.RATE_API_WINDOW_MS,
    });

    const { authMiddlewarePlugin } = await import('./modules/iam/iam.middleware.js');
    await trpcApp.register(authMiddlewarePlugin);

    await trpcApp.register(fastifyTRPCPlugin, {
      prefix: '/api/trpc',
      trpcOptions: {
        router: appRouter,
        createContext,
        onError: ({ error, path }: { error: unknown; path?: string }) => {
          trpcApp.log.error({ err: error, path }, 'tRPC error');
        },
      },
    });
  });

  return fastify;
}
