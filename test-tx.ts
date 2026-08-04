import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

async function main() {
  const client = postgres('postgresql://batac_app:app_devpassword@localhost:5435/batac_lgu');
  const db = drizzle(client);
  
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.bypass_office_isolation', 'true', true)`);
    const res = await tx.execute(sql`SELECT current_setting('app.bypass_office_isolation', true) as val`);
    console.log("Inside tx:", res[0].val);
  });
  
  const res2 = await db.execute(sql`SELECT current_setting('app.bypass_office_isolation', true) as val`);
  console.log("Outside tx:", res2[0].val);
  process.exit(0);
}
main();
