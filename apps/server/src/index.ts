/**
 * Fastify Server Bootstrap Entrypoint
 * Created as a minimal server bootstrap for TASK-INFRA-011.
 * Can be updated by succeeding tasks.
 */

import fastify from 'fastify';
import { env } from './config/env.js';
import { registerHealthRoute } from './routes/health.route.js';

const app = fastify({
  logger: env.LOG_LEVEL !== 'silent' ? {
    level: env.LOG_LEVEL,
  } : false,
});

async function main(): Promise<void> {
  // Register health route
  await registerHealthRoute(app);

  try {
    app.log.info(`Starting server on ${env.APP_HOST}:${env.APP_PORT}...`);
    await app.listen({
      port: env.APP_PORT,
      host: env.APP_HOST,
    });
    console.log(`Server listening on http://${env.APP_HOST}:${env.APP_PORT}${env.HEALTH_CHECK_PATH}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
