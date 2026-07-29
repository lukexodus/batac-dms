import { config } from 'dotenv';
config({ path: '.env' });

import postgres from 'postgres';
const client = postgres(process.env.DATABASE_URL_APP as string);

async function main() {
  const emps = await client`SELECT e.id, e.employee_number, e.first_name, e.last_name, a.id as assignment_id, a.is_primary, a.is_active FROM organization.employees e LEFT JOIN organization.assignments a ON e.id = a.employee_id`;
  console.log("Employees & Assignments:");
  console.log(JSON.stringify(emps, null, 2));

  process.exit(0);
}
main();
