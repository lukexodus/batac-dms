import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, 'packages/database/.env') });

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const usersRes = await pool.query(`SELECT id, username, roles FROM auth_users`);
  console.log("Users:", JSON.stringify(usersRes.rows, null, 2));

  const empRes = await pool.query(`SELECT id, "userId", "firstName", "lastName" FROM org_employees`);
  console.log("Employees:", JSON.stringify(empRes.rows, null, 2));
  
  process.exit(0);
}
main();
