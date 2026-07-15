import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { seedIam } from './iam.seed.js';
import { seedOrganization } from './organization.seed.js';
import { seedNumberSeries } from './number-series.seed.js';
import { seedDocumentTypes } from './document-types.seed.js';
import { seedPhase1WorkflowDefinitions } from '../../../../../packages/database/src/seeds/workflow/phase1-legislative.js';

async function main() {
  const databaseUrl = process.env['DATABASE_URL_APP'] || process.env['DATABASE_URL_MIGRATE'];
  if (!databaseUrl) {
    console.error(
      '[seed:orchestrator] Error: DATABASE_URL_MIGRATE or DATABASE_URL_APP environment variable is not set.',
    );
    process.exit(1);
  }

  console.log('[seed:orchestrator] Connecting to database...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    // Run all seeds sequentially in a single connection transaction
    await db.transaction(async (tx) => {
      console.log('[seed:orchestrator] Running IAM seed...');
      await seedIam(tx);

      console.log('[seed:orchestrator] Running Organization seed...');
      await seedOrganization(tx);

      console.log('[seed:orchestrator] Running Number Series seed...');
      await seedNumberSeries(tx);

      console.log('[seed:orchestrator] Running Document Types seed...');
      const documentTypeIds = await seedDocumentTypes(tx);

      console.log('[seed:orchestrator] Running Phase 1 Workflow Definitions seed...');
      await seedPhase1WorkflowDefinitions(tx, documentTypeIds);

      console.log('[seed:orchestrator] Database seeding completed successfully.');
    });
  } catch (error) {
    console.error('[seed:orchestrator] Database seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[seed:orchestrator] Unhandled error during seeding:', err);
  process.exit(1);
});
