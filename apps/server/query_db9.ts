import { config } from 'dotenv';
config({ path: '.env' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createOrgService } from './src/modules/organization/organization.service';

const client = postgres(process.env.DATABASE_URL_APP as string);
const db = drizzle(client);

const orgService = createOrgService({ db });

async function main() {
  const result = await orgService.listEmployees('00000000-0000-4000-8000-000000000001', 25, undefined, undefined);
  console.log("Found:", result.items.length);
  console.log(JSON.stringify(result.items.slice(0, 5), null, 2));
  process.exit(0);
}
main();
