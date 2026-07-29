import { config } from 'dotenv';
config({ path: '.env' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { createOrganizationService } from './src/modules/organization/organization.service';

const client = postgres(process.env.DATABASE_URL_APP as string);
const db = drizzle(client);
const service = createOrganizationService(db);

async function main() {
  const result = await service.listEmployees('00000000-0000-4000-8000-000000000001', 25, null, '');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
main();
