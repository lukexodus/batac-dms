/**
 * Fastify Server Bootstrap Entrypoint
 * Originally created as a minimal server bootstrap for TASK-INFRA-011.
 *
 * [Inference] Refactored by TASK-IAM-014 to delegate Fastify app
 * construction (health route, plugin tree, tRPC adapter) to the new
 * buildApp() factory in ./app.ts, so that app.ts can be imported and
 * exercised on its own (e.g. for in-process testing via fastify.inject())
 * without going through PgBoss/listen(). This file now owns only
 * process-level bootstrap concerns: starting PgBoss, registering
 * background jobs, and listening on the configured host/port. This is not
 * an explicit TASK-IAM-014 deliverable, but is necessary for the task's own
 * acceptance criteria ("pnpm dev starts with no plugin registration
 * errors", "a full login succeeds end-to-end") to be checkable at all —
 * without this change, `pnpm dev` would keep running the old inline setup
 * and never invoke the new IAM plugin wiring. Flagged here per project
 * preference for labeling judgment calls outside the literal deliverables
 * list.
 */
import PgBoss from 'pg-boss';
import { env } from './config/env.js';
import { buildApp } from './app.js';
import { createAuditDb } from './modules/audit/audit.db.js';
import { AuditRepository } from './modules/audit/audit.repository.js';
import { AuditWriteService } from './modules/audit/audit.write-service.js';
import { registerTsaExportJob } from './modules/audit/audit.tsa-export.js';

async function main(): Promise<void> {
  const app = await buildApp();

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
