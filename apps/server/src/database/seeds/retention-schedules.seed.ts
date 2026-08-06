import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { retentionSchedules } from '@batac/database/schema/records.schema.js';

// PROVISIONAL: consolidated ref Part 11.7 gives a 10-15 year range for citizen
// correspondence, explicitly marked "configurable; to be confirmed with COA/DILG."
// Update this single constant once the real figure is confirmed.
const CITIZENS_CORRESPONDENCE_RETENTION_YEARS = 15;

const RETENTION_PERMANENT = 'a1b2c3d4-5e6f-4000-8000-1e2f3a4b5c6d';
const RETENTION_CITIZENS_CORRESPONDENCE = 'c3d4e5f6-7a8b-4000-8000-2e3f4a5b6c7d';
const CITY_ID = '00000000-0000-4000-8000-000000000001';

async function seed() {
  if (!process.env['DATABASE_URL_MIGRATE']) {
    throw new Error('DATABASE_URL_MIGRATE is not set');
  }

  const client = postgres(process.env['DATABASE_URL_MIGRATE'] as string, { max: 1 });
  const db = drizzle(client);

  console.log('🌱 Seeding records.retention_schedules...');

  const rows = [
    {
      id: RETENTION_PERMANENT,
      cityId: CITY_ID,
      code: 'retention_permanent',
      name: 'Permanent Retention',
      isPermanent: true,
      retentionPeriodYears: null,
      legalBasis: null,
      dispositionRule: null,
      configuredBy: null,
    },
    {
      id: RETENTION_CITIZENS_CORRESPONDENCE,
      cityId: CITY_ID,
      code: 'retention_citizens_correspondence',
      name: 'Citizen Correspondence',
      isPermanent: false,
      retentionPeriodYears: CITIZENS_CORRESPONDENCE_RETENTION_YEARS,
      legalBasis: null,
      dispositionRule: null,
      configuredBy: null,
    },
  ];

  for (const row of rows) {
    await db.insert(retentionSchedules).values(row).onConflictDoUpdate({
      target: [retentionSchedules.id],
      set: {
        name: sql`excluded.name`,
        isPermanent: sql`excluded.is_permanent`,
        retentionPeriodYears: sql`excluded.retention_period_years`,
      },
    });
  }

  console.log('✅ Seeded records.retention_schedules');
  await client.end();
}

seed().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});
