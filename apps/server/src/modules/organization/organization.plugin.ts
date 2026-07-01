import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

import { initializePublishedAPI } from './index.js';
import { registerDelegationExpiryJob } from './delegation-expiry.job.js';

async function organizationPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('organization plugin registered');
  
  initializePublishedAPI(
    fastify.db,
    fastify.auditService,
    fastify.policyEvaluator,
    fastify.boss
  );

  await registerDelegationExpiryJob({
    boss: fastify.boss,
    db: fastify.db,
    eventBus: fastify.eventBus,
    auditService: fastify.auditService,
  });
}

export default fp(organizationPlugin, {
  name: 'organization',
  dependencies: ['database', 'event-bus', 'audit'],
});
