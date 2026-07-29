import { config } from 'dotenv';
config({ path: '.env' });
import postgres from 'postgres';
const client = postgres(process.env.DATABASE_URL_APP as string);
async function main() {
  const users = await client`SELECT id, username, city_id FROM iam.users WHERE username = 'secretary.lagura'`;
  console.log("Users:", users);
  
  const employees = await client`SELECT id, city_id, employee_number FROM organization.employees WHERE employee_number = 'SPS-LAGURA'`;
  console.log("Employees:", employees);
  
  process.exit(0);
}
main();
