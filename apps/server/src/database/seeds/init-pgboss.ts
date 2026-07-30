import PgBoss from 'pg-boss';
import { env } from '../../config/env.js';

async function main() {
  const url = env.DATABASE_URL_MIGRATE;
  if (!url) throw new Error('DATABASE_URL_MIGRATE is required for init-pgboss');
  console.log('[init-pgboss] Initialising PgBoss schema as batac_migrate...');
  const boss = new PgBoss(url);
  await boss.start();
  await boss.stop();
  console.log('[init-pgboss] PgBoss schema initialised successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
