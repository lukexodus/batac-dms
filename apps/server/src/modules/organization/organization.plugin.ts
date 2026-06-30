import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

async function organizationPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.log.info('organization plugin registered');
}

export default fp(organizationPlugin, {
  name: 'organization',
  dependencies: ['database', 'event-bus', 'audit'],
});
