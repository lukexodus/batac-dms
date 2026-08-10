import fp from 'fastify-plugin';
import cors from '@fastify/cors';

export default fp(async (fastify) => {
  const allowedOrigins = (process.env['CORS_ALLOWED_ORIGINS'] ?? '').split(',').filter(Boolean);
  await fastify.register(cors, {
    origin: allowedOrigins,
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 600,
  });
});
