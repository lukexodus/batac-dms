import postgres from 'postgres';
const sql = postgres('postgresql://batac_app:app_devpassword@localhost:5435/batac_lgu');

async function test() {
  try {
    const res = await sql.begin(async tx => {
      await tx`SELECT set_config('app.current_user_id', '6faf133e-8d7e-41ad-be80-bdfa5f504d2c', true)`;
      await tx`SELECT set_config('app.current_office_id', '00000000-0000-0000-0000-000000000000', true)`;
      await tx`SELECT set_config('app.bypass_office_isolation', 'false', true)`;
      
      const r = await tx`INSERT INTO documents.documents (
        document_type_id, title, classification_level, qr_tracking_number, originating_office_id, owned_by_office_id, created_by, retention_schedule_id
      ) VALUES (
        'de30b91e-3f6c-4b5b-8f3e-8c3b1e7c5c01', 'Test Title', 'internal', gen_random_uuid(), 'e2c5b1f8-d688-4c79-86c4-dff9095a48b6', 'e2c5b1f8-d688-4c79-86c4-dff9095a48b6', '6faf133e-8d7e-41ad-be80-bdfa5f504d2c', 'a1b2c3d4-5e6f-4000-8000-1e2f3a4b5c6d'
      ) RETURNING id`;
      return r;
    });
    console.log("SUCCESS:", res);
  } catch(e) {
    console.error("ERROR:", e);
  } finally {
    await sql.end();
  }
}
test();
