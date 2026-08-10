import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';

export default fp(async (fastify) => {
  await fastify.register(rateLimit, {
    global: false, // per-route config.rateLimit blocks opt in individually
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? request.ip,
  });
});
