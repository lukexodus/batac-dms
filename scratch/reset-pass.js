const { Pool } = require('pg');
const argon2 = require('argon2');

async function run() {
  const pool = new Pool({ connectionString: 'postgresql://batac_app:app_devpassword@127.0.0.1:5432/batac_lgu' });
  const hash = await argon2.hash('BatacDemo2026!');
  await pool.query(`
    UPDATE iam.credentials c 
    SET password_hash = $1
    FROM iam.users u
    WHERE u.id = c.user_id AND u.email = 'secretary.lagura@batac.gov.ph'
  `, [hash]);
  console.log('Password updated');
  pool.end();
}
run().catch(console.error);
