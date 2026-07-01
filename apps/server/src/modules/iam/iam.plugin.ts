/**
 * iam.plugin.ts — wires the complete IAM module onto the Fastify instance.
 *
 * Instantiates PolicyGuard + PolicyEvaluator, the IAM repository + service,
 * decorates all four onto `fastify`, exposes the static `iamRouter` as
 * `fastify.iamTrpcRouter`, and registers the REST routes.
 *
 * [Unverified — divergence from this task's own AI Prompt] The AI Prompt
 * sample code for this task assumed:
 *   (a) `createIamRouter(fastify)` is a factory function, and
 *   (b) `registerIamRoutes(scope, iamService, policyEvaluator, { public })`
 *       takes the service/evaluator and a public/protected flag as
 *       parameters, registered twice under an external `{ prefix: '/api' }`.
 * Neither matches what TASK-IAM-006–013 actually built:
 *   (a) `iam.router.ts` exports a single pre-built `iamRouter` constant
 *       (built via `router({...})`); each procedure reads
 *       `ctx.req.server.iamService` / `.policyEvaluator` at request time.
 *       There is no `createIamRouter` factory to call.
 *   (b) `registerIamRoutes(fastify: FastifyInstance): Promise<void>` takes
 *       only the Fastify instance. It hardcodes the full `/api/auth/...`
 *       paths itself and already performs its own internal public/protected
 *       split — public routes are registered directly, and protected routes
 *       are registered inside `registerIamRoutes`'s own nested
 *       `fastify.register(async (protectedApp) => { await
 *       protectedApp.register(authMiddlewarePlugin); ... })` block. Calling
 *       it with a second `{ prefix: '/api' }` wrapper would double the
 *       prefix (`/api/api/auth/login`).
 * This file follows the actual, already-implemented signatures (treating
 * the AI Prompt code as illustrative pseudocode, not prescriptive — see
 * development-findings-log.md for prior entries doing the same, e.g. the
 * TASK-INFRA-023 entry on spec pseudocode).
 *
 * Org-context resolvers (getPrimaryOffice, getCommitteeIds,
 * resolveActiveDelegationGrant) are intentionally omitted from the
 * createIamService() call below; createIamService() defaults all three to
 * safe no-ops (confirmed directly in iam.service.ts). Per the IAM Module
 * Summary's "Forward note for the ORG module," a future ORG task edits
 * ONLY this object literal, adding three adapter functions backed by
 * fastify.organizationService — no other IAM file changes.
 *
 * Source: TASK-IAM-014.
 */
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createIamRepository } from './iam.repository.js';
import { createIamService } from './iam.service.js';
import { iamRouter } from './iam.router.js';
import { registerIamRoutes } from './iam.routes.js';
import { PolicyGuard, PolicyEvaluator } from './iam.policy.js';

async function iamPlugin(fastify: FastifyInstance): Promise<void> {
  // 1. PolicyGuard + PolicyEvaluator. The session resource handler is
  // registered inside the PolicyEvaluator constructor (TASK-IAM-004).
  const policyGuard = new PolicyGuard();
  const policyEvaluator = new PolicyEvaluator(policyGuard);
  fastify.decorate('policyEvaluator', policyEvaluator);

  // 2. IAM repository + service. `iamRepository` is decorated separately
  // (not just passed into createIamService) because iam.middleware.ts's
  // preHandler hooks read `this.iamRepository` directly — see
  // iam.types.ts's FastifyInstance augmentation.
  const iamRepository = createIamRepository(fastify.db);
  fastify.decorate('iamRepository', iamRepository);

  const iamService = createIamService({
    db: fastify.db,
    iamRepository,
    auditService: fastify.auditService, // decorated by the audit plugin (dependency)
    eventBus: fastify.eventBus,         // decorated by the event-bus plugin (dependency)
    policyEvaluator,
    // TASK-ORG-010: wire real org-context resolvers
    getPrimaryOffice: (userId) =>
      fastify.organizationService.getPrimaryOfficeForUser(userId),

    getCommitteeIds: (userId) =>
      fastify.organizationService.getCommitteeIdsForUser(userId),

    resolveActiveDelegationGrant: (delegationGrantId) =>
      fastify.delegationService.getDelegationGrantById(delegationGrantId),
  });
  fastify.decorate('iamService', iamService);

  // 3. tRPC router. `iamRouter` is already a complete, request-time-bound
  // router (see file header comment), so it is decorated directly with no
  // factory call.
  fastify.decorate('iamTrpcRouter', iamRouter);

  // 4. REST routes — one registration. registerIamRoutes() performs its own
  // internal public/protected scope split and already hardcodes the
  // `/api/...` paths (see file header comment), so it is registered here
  // nested (no fp, for hook-isolation per the module-plugin pattern) with
  // no external prefix.
  await fastify.register(registerIamRoutes);
}

export default fp(iamPlugin, {
  name: 'iam',
  dependencies: ['database', 'event-bus', 'audit'],
});
