import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createOrgRepository }    from './organization.repository.js';
import { createOrgService }       from './organization.service.js';
import { createDelegationService } from './delegation.service.js';
import { registerDelegationExpiryJob } from './delegation-expiry.job.js';
import { createOrgRouter }        from './organization.router.js';

async function organizationPlugin(fastify: FastifyInstance): Promise<void> {
  const orgRepository      = createOrgRepository(fastify.db);
  const organizationService = createOrgService({ db: fastify.db, orgRepository, eventBus: fastify.eventBus });
  const delegationService  = createDelegationService({
    db: fastify.db,
    orgRepository,
    auditService: fastify.auditService,
    eventBus: fastify.eventBus,
    policyEvaluator: fastify.policyEvaluator,
    boss: fastify.boss,
  });

  // Register the pgboss delegation-expiry job handler (TASK-ORG-007)
  await registerDelegationExpiryJob({
    boss: fastify.boss,
    db: fastify.db,
    eventBus: fastify.eventBus,
    auditService: fastify.auditService,
  });

  fastify.decorate('organizationService', organizationService);
  fastify.decorate('delegationService', delegationService);

  // Attach tRPC router for merging
  fastify.decorate('orgTrpcRouter', createOrgRouter({
    policyEvaluator: fastify.policyEvaluator,
    organizationService,
    delegationService,
  }));
}

export default fp(organizationPlugin, {
  name: 'organization',
  dependencies: ['database', 'event-bus', 'audit', 'iam'],
});
