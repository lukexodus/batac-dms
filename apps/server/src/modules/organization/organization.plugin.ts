import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createOrgRepository }    from './organization.repository.js';
import { createOrgService }       from './organization.service.js';
import { createDelegationService } from './delegation.service.js';
import { registerDelegationExpiryJob } from './delegation-expiry.job.js';
import { createOrgRouter }        from './organization.router.js';

async function organizationPlugin(fastify: FastifyInstance): Promise<void> {
  const orgRepository      = createOrgRepository(fastify.db);
  const organizationService = createOrgService({ db: fastify.db, repository: orgRepository } as any);
  const delegationService  = createDelegationService({
    db: fastify.db,
    repository: orgRepository,
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
