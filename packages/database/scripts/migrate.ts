import { config } from 'dotenv';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

if (!process.env['DATABASE_URL_MIGRATE']) {
  console.error(
    '[migrate] DATABASE_URL_MIGRATE is not set. ' +
      'This variable is required for migrations and post-migrate grants.',
  );
  process.exit(1);
}

const client = postgres(process.env['DATABASE_URL_MIGRATE'], {
  max: 1,
  onnotice: () => {},
});

const db = drizzle(client);

console.log('[migrate] Applying Drizzle migrations...');
await migrate(db, { migrationsFolder: join(__dirname, '../migrations') });

console.log('[migrate] Applying post-migrate grants...');
const grantsSQL = readFileSync(join(__dirname, './post-migrate-grants.sql'), 'utf-8');
await client.unsafe(grantsSQL);
await client.end();

console.log('[migrate] Done.');
