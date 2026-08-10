import { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import submitComplaintRoute from './routes/submit-complaint.js';
import submitDocumentRequestRoute from './routes/submit-document-request.js';
import { env } from '../../config/env.js';

export default async function portalPlugin(fastify: FastifyInstance) {
  // Register rate limiting for the public portal scope. Each route can
  // override the default via its `config.rateLimit` (e.g. the submission
  // routes cap at 20/hour per IP). Without this registration the per-route
  // `config.rateLimit` values are inert — @fastify/rate-limit only honors
  // them where the plugin itself is registered.
  await fastify.register(rateLimit, {
    max: env.RATE_PORTAL_MAX,
    timeWindow: env.RATE_PORTAL_WINDOW_MS,
  });

  // Routes for the portal module
  await fastify.register(submitComplaintRoute, { prefix: '/v1' });
  await fastify.register(submitDocumentRequestRoute, { prefix: '/v1' });
}
