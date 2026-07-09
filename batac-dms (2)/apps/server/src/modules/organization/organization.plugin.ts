import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createOrgRepository }    from './organization.repository.js';
import { createOrgService }       from './organization.service.js';
import { createDelegationService } from './delegation.service.js';
import { registerDelegationExpiryJob } from './delegation-expiry.job.js';
import { createOrgRouter }        from './organization.router.js';

async function organizationPlugin(fastify: FastifyInstance): Promise<void> {
  const orgRepository      = createOrgRepository(fastify.db);
  // [Confirmed — see docs/development-findings-log.md, Bug A] The object
  // literals below previously used the key `repository` where
  // OrgServiceDeps/DelegationServiceDeps declare `orgRepository`. Because
  // both calls were cast `as any`, TypeScript's structural check was
  // suppressed and this went uncaught by `pnpm typecheck`. For
  // createOrgService, this was a latent/dormant bug (organization.service.ts
  // never reads `deps.orgRepository`, only `deps.db`), so it had no runtime
  // symptom. For createDelegationService, this was a live bug:
  // delegation.service.ts's createDelegationGrant calls
  // `deps.orgRepository.delegationGrants.create(...)` directly, so
  // `deps.orgRepository` being `undefined` would throw `TypeError: Cannot
  // read properties of undefined` the first time a grant was actually
  // created. Fixed by using the correct key name in both calls.
  const organizationService = createOrgService({ db: fastify.db, orgRepository } as any);
  const delegationService  = createDelegationService({
    db: fastify.db,
    orgRepository,
    auditService: fastify.auditService,
    eventBus: fastify.eventBus,
    policyEvaluator: fastify.policyEvaluator,
    boss: fastify.boss,
  } as any);

  fastify.addHook('onReady', async () => {
    if (fastify.boss) {
      await registerDelegationExpiryJob({
        boss: fastify.boss,
        db: fastify.db,
        repository: orgRepository,
        auditService: fastify.auditService,
        eventBus: fastify.eventBus,
      } as any);
    }
  });

  fastify.decorate('orgRepository', orgRepository);
  fastify.decorate('organizationService', organizationService);
  fastify.decorate('delegationService', delegationService);

  fastify.decorate('orgTrpcRouter', createOrgRouter({
    policyEvaluator: fastify.policyEvaluator,
    organizationService,
    delegationService,
  } as any));
}

export default fp(organizationPlugin, {
  name: 'organization',
  dependencies: ['database', 'event-bus', 'audit', 'iam'],
});
