import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

const trackingPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.log.info('tracking.module.stub');
  // Full wiring in TASK-TRACK-009
};

export default fp(trackingPlugin, {
  name: 'tracking-plugin',
  dependencies: ['documents-plugin'],
});
