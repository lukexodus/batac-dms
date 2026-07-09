import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { seedPhase1WorkflowDefinitions } from './workflow/phase1-legislative.js';

async function main() {
  const databaseUrl = process.env['DATABASE_URL_APP'];
  if (!databaseUrl) {
    console.error('[seed] Error: DATABASE_URL_MIGRATE or DATABASE_URL_APP environment variable is not set.');
    process.exit(1);
  }
  
  console.log('[seed] Connecting to database...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      console.log('[seed] Seeding Phase 1 legislative workflows...');
      await seedPhase1WorkflowDefinitions(tx);
      console.log('[seed] Workflow seeding complete.');
    });
  } catch (error) {
    console.error('[seed] Database seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[seed] Unhandled error during seeding:', err);
  process.exit(1);
});
