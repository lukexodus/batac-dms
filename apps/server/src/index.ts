/**
 * Fastify Server Bootstrap Entrypoint
 * Created as a minimal server bootstrap for TASK-INFRA-011.
 * Can be updated by succeeding tasks.
 */

import fastify from 'fastify';
import PgBoss from 'pg-boss';
import { env } from './config/env.js';
import { registerHealthRoute } from './routes/health.route.js';
import { createAuditDb } from './modules/audit/audit.db.js';
import { AuditRepository } from './modules/audit/audit.repository.js';
import { AuditWriteService } from './modules/audit/audit.write-service.js';
import { registerTsaExportJob } from './modules/audit/audit.tsa-export.js';

const app = fastify({
  logger: env.LOG_LEVEL !== 'silent' ? {
    level: env.LOG_LEVEL,
  } : false,
});

async function main(): Promise<void> {
  // Register health route
  await registerHealthRoute(app);

  // Register tRPC
  const { fastifyTRPCPlugin } = await import('@trpc/server/adapters/fastify');
  const { appRouter } = await import('./trpc/root.js');
  const { createContext } = await import('./trpc/trpc.js');
  
  await app.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError: ({ error, path }: any) => {
        app.log.error(`tRPC Error on '${path}':`, error);
      },
    },
  });
  try {
    // Start PgBoss and register background jobs
    app.log.info('Starting PgBoss...');
    const boss = new PgBoss(env.DATABASE_URL_APP);
    await boss.start();

    // Register TSA Export Job
    const auditDb = createAuditDb(env.DATABASE_URL_AUDIT);
    const repo = new AuditRepository(auditDb);
    const writeService = new AuditWriteService(repo, {
      AUDIT_HMAC_SECRET: env.AUDIT_HMAC_SECRET,
    });

    await registerTsaExportJob({
      boss,
      repo,
      writeService,
      env: {
        AUDIT_TSA_ENABLED: env.AUDIT_TSA_ENABLED,
        AUDIT_TSA_URL: env.AUDIT_TSA_URL,
        AUDIT_EXPORT_ENABLED: env.AUDIT_EXPORT_ENABLED,
        CITY_ID: env.CITY_ID,
      },
    });
  } catch (err) {
    app.log.error({ err }, 'Failed to initialize background jobs');
  }

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
