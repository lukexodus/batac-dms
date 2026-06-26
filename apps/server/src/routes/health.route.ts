/**
 * Fastify Liveness Health Check Route
 * Created as a bootstrap liveness probe for TASK-INFRA-011.
 * Can be updated by succeeding tasks.
 */

import type { FastifyInstance } from 'fastify';
import { env } from '../config/env';

const startedAt = Date.now();

export async function registerHealthRoute(app: FastifyInstance): Promise<void> {
  app.get(env.HEALTH_CHECK_PATH, async (_request, reply) => {
    reply.send({
      status: 'ok',
      version: env.APP_VERSION,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
    });
  });
}
