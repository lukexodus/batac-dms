import { config } from 'dotenv';
config({ path: '.env' });

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_APP });

async function main() {
  const usersRes = await pool.query(`SELECT id, username, roles FROM iam.users`);
  console.log("Users:", JSON.stringify(usersRes.rows, null, 2));

  const empRes = await pool.query(`SELECT id, "user_id", "first_name", "last_name" FROM organization.employees`);
  console.log("Employees:", JSON.stringify(empRes.rows, null, 2));
  
  process.exit(0);
}
main();
