import { FastifyInstance } from 'fastify';
import submitComplaintRoute from './routes/submit-complaint.js';

export default async function portalPlugin(fastify: FastifyInstance) {
  // Routes for the portal module
  await fastify.register(submitComplaintRoute, { prefix: '/v1' });
}
