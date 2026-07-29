import { config } from 'dotenv';
config({ path: '.env' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createOrganizationService } from './src/modules/organization/organization.service';

const client = postgres(process.env.DATABASE_URL_APP as string);
const db = drizzle(client);

// need to use the default export if any
import orgServiceModule from './src/modules/organization/organization.service';
const orgService = orgServiceModule(db);

async function main() {
  const result = await orgService.listEmployees('00000000-0000-4000-8000-000000000001', 25, undefined, undefined);
  console.log("Found:", result.items.length);
  console.log(JSON.stringify(result.items.slice(0, 2), null, 2));
  process.exit(0);
}
main();
