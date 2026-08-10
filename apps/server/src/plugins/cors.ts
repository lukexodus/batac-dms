import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { env } from '../config/env.js';

export default fp(async (fastify) => {
  await fastify.register(cors, {
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: false,
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 600,
  });
});
