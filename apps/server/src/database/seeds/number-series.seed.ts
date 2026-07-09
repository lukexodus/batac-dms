import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { numberSeries, documentTypes } from '@batac/database/schema/documents.schema.js';
import { offices } from '@batac/database/schema/organization.schema.js';

// ────────── CONSTANTS ────────────────────────────────────────────────────────
const CITY_ID = '00000000-0000-4000-8000-000000000001';

// ────────── TYPES ─────────────────────────────────────────────────────────────
interface NumberSeriesDef {
  seriesKey: string;
  documentTypeCode: string | null;
  seriesType: 'legislative' | 'administrative';
  phase: '1' | '1b';
  prefix: string | null;
  spOrdinal: string | null;
  sequencePadding: number;
  sequenceNamePrefix: string;
  preliminaryFormat: string | null;
  finalFormat: string;
  preliminaryAssignmentEvent: string | null;
  finalAssignmentEvent: string;
  deferredFinalAssignment: boolean;
}

// ────────── DEFINITIONS ───────────────────────────────────────────────────────
const SERIES_DEFINITIONS: NumberSeriesDef[] = [
  {
    seriesKey: 'sp_resolution',
    documentTypeCode: 'SP_RESOLUTION',
    seriesType: 'legislative',
    phase: '1',
    prefix: null,
    spOrdinal: '7',
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_sp_resolution',
    preliminaryFormat: 'Draft 7SP {YEAR}-{NN}',
    finalFormat: '7SP {YEAR}-{NN}',
    preliminaryAssignmentEvent: 'SECRETARIAT_LOGGING',
    finalAssignmentEvent: 'SECOND_READING_VOTE_APPROVED',
    deferredFinalAssignment: false,
  },
  {
    seriesKey: 'sp_ordinance',
    documentTypeCode: 'SP_ORDINANCE',
    seriesType: 'legislative',
    phase: '1',
    prefix: null,
    spOrdinal: '7',
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_sp_ordinance',
    preliminaryFormat: 'Draft 7SP {YEAR}-{NN}',
    finalFormat: '7SP {YEAR}-{NN}',
    preliminaryAssignmentEvent: 'SECRETARIAT_LOGGING',
    finalAssignmentEvent: 'THIRD_READING_VOTE_APPROVED',
    deferredFinalAssignment: false,
  },
  {
    seriesKey: 'sp_appropriation_ordinance',
    documentTypeCode: 'SP_APPROPRIATION_ORDINANCE',
    seriesType: 'legislative',
    phase: '1',
    prefix: null,
    spOrdinal: '7',
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_sp_appropriation_ordinance',
    preliminaryFormat: 'Draft 7SP {YEAR}-{NN}',
    finalFormat: '7SP {YEAR}-{NN}',
    preliminaryAssignmentEvent: 'SECRETARIAT_LOGGING',
    finalAssignmentEvent: 'THIRD_READING_VOTE_APPROVED',
    deferredFinalAssignment: false,
  },
  {
    seriesKey: 'notice_committee_hearing',
    documentTypeCode: 'NOTICE_COMMITTEE_HEARING',
    seriesType: 'administrative',
    phase: '1b',
    prefix: 'NCH',
    spOrdinal: null,
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_nch',
    preliminaryFormat: null,
    finalFormat: 'NCH {YEAR}-{NN}',
    preliminaryAssignmentEvent: null,
    finalAssignmentEvent: 'SECRETARIAT_LOGGING',
    deferredFinalAssignment: false,
  },
  {
    seriesKey: 'notice_special_session',
    documentTypeCode: 'NOTICE_SPECIAL_SESSION',
    seriesType: 'administrative',
    phase: '1b',
    prefix: 'NOSP',
    spOrdinal: null,
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_nosp',
    preliminaryFormat: null,
    finalFormat: 'NOSP {YEAR}-{NN}',
    preliminaryAssignmentEvent: null,
    finalAssignmentEvent: 'SECRETARIAT_LOGGING',
    deferredFinalAssignment: false,
  },
  {
    seriesKey: 'designation',
    documentTypeCode: 'DESIGNATION',
    seriesType: 'administrative',
    phase: '1b',
    prefix: 'D',
    spOrdinal: null,
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_designation',
    preliminaryFormat: null,
    finalFormat: 'D {YEAR}-{NN}',
    preliminaryAssignmentEvent: null,
    finalAssignmentEvent: 'SECRETARIAT_LOGGING',
    deferredFinalAssignment: false,
  },
  {
    seriesKey: 'letters_received',
    documentTypeCode: 'LETTER_RECEIVED',
    seriesType: 'administrative',
    phase: '1b',
    prefix: 'SPR',
    spOrdinal: null,
    sequencePadding: 3,
    sequenceNamePrefix: 'ns_letters_received',
    preliminaryFormat: null,
    finalFormat: 'SPR {YEAR}-{NNN}',
    preliminaryAssignmentEvent: null,
    finalAssignmentEvent: 'SECRETARIAT_NUMBER_ASSIGNMENT',
    deferredFinalAssignment: true,
  },
  {
    seriesKey: 'letters_sent',
    documentTypeCode: 'LETTER_SENT',
    seriesType: 'administrative',
    phase: '1b',
    prefix: 'SPS',
    spOrdinal: null,
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_letters_sent',
    preliminaryFormat: null,
    finalFormat: 'SPS {YEAR}-{NN}',
    preliminaryAssignmentEvent: null,
    finalAssignmentEvent: 'SECRETARIAT_LOGGING',
    deferredFinalAssignment: false,
  },
  {
    seriesKey: 'memo_outgoing',
    documentTypeCode: 'MEMO_OUTGOING',
    seriesType: 'administrative',
    phase: '1b',
    prefix: 'MO',
    spOrdinal: null,
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_memo_outgoing',
    preliminaryFormat: null,
    finalFormat: 'MO {YEAR}-{NN}',
    preliminaryAssignmentEvent: null,
    finalAssignmentEvent: 'SECRETARIAT_FINALIZATION',
    deferredFinalAssignment: false,
  },
  {
    seriesKey: 'memo_incoming',
    documentTypeCode: 'MEMO_INCOMING',
    seriesType: 'administrative',
    phase: '1b',
    prefix: 'MI',
    spOrdinal: null,
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_memo_incoming',
    preliminaryFormat: null,
    finalFormat: 'MI {YEAR}-{NN}',
    preliminaryAssignmentEvent: null,
    finalAssignmentEvent: 'SECRETARIAT_LOGGING',
    deferredFinalAssignment: false,
  },
  {
    seriesKey: 'panlalawigan_review_log',
    documentTypeCode: null,
    seriesType: 'administrative',
    phase: '1',
    prefix: null,
    spOrdinal: null,
    sequencePadding: 2,
    sequenceNamePrefix: 'ns_panlalawigan_review_log',
    preliminaryFormat: null,
    finalFormat: '{YEAR}-{NN}',
    preliminaryAssignmentEvent: null,
    finalAssignmentEvent: 'RECEIPT_OF_PROVINCIAL_RESPONSE',
    deferredFinalAssignment: false,
  },
];

import { fileURLToPath } from 'node:url';

// ────────── MAIN SEED FUNCTION ─────────────────────────────────────────────────
export async function seedNumberSeries(db: any) {
  await db.transaction(async (tx: any) => {
    // ── Step 1: Resolve SP Secretariat office (code='SPS') ─────────────────
      console.log('[seed:series] Step 1: Querying SPS office id...');
      const [spsOffice] = await tx
        .select({ id: offices.id })
        .from(offices)
        .where(sql`${offices.code} = 'SPS'`)
        .limit(1);

      if (!spsOffice) {
        throw new Error('[seed:series] Error: SPS office not found. Please run organization seed first.');
      }
      const authorityOfficeId = spsOffice.id;
      console.log(`[seed:series] Resolved authorityOfficeId = ${authorityOfficeId}`);

      // ── Step 2: Upsert numbering series ────────────────────────────────────
      console.log('[seed:series] Step 2: Seeding 11 numbering series...');
      let seededCount = 0;

      for (const def of SERIES_DEFINITIONS) {
        // Query if document type exists to get documentTypeId
        let documentTypeId: string | null = null;
        if (def.documentTypeCode) {
          const [docType] = await tx
            .select({ id: documentTypes.id })
            .from(documentTypes)
            .where(sql`${documentTypes.code} = ${def.documentTypeCode}`)
            .limit(1);
          if (docType) {
            documentTypeId = docType.id;
          }
        }

        await tx
          .insert(numberSeries)
          .values({
            cityId: CITY_ID,
            seriesKey: def.seriesKey,
            documentTypeId,
            seriesType: def.seriesType,
            phase: def.phase,
            prefix: def.prefix,
            spOrdinal: def.spOrdinal,
            delimiter: ' ',
            sequencePadding: def.sequencePadding,
            sequenceNamePrefix: def.sequenceNamePrefix,
            yearFormat: 'YYYY',
            preliminaryFormat: def.preliminaryFormat,
            finalFormat: def.finalFormat,
            resetsAnnually: true,
            authorityOfficeId,
            preliminaryAssignmentEvent: def.preliminaryAssignmentEvent,
            finalAssignmentEvent: def.finalAssignmentEvent,
            deferredFinalAssignment: def.deferredFinalAssignment,
            isActive: true,
          })
          .onConflictDoUpdate({
            target: [numberSeries.cityId, numberSeries.seriesKey],
            set: {
              documentTypeId,
              seriesType: def.seriesType,
              phase: def.phase,
              prefix: def.prefix,
              spOrdinal: def.spOrdinal,
              delimiter: ' ',
              sequencePadding: def.sequencePadding,
              sequenceNamePrefix: def.sequenceNamePrefix,
              yearFormat: 'YYYY',
              preliminaryFormat: def.preliminaryFormat,
              finalFormat: def.finalFormat,
              resetsAnnually: true,
              authorityOfficeId,
              preliminaryAssignmentEvent: def.preliminaryAssignmentEvent,
              finalAssignmentEvent: def.finalAssignmentEvent,
              deferredFinalAssignment: def.deferredFinalAssignment,
              isActive: true,
              updatedAt: new Date(),
            },
          });

        seededCount++;
      }

      console.log(`[seed:series] Seeded/upserted ${seededCount} numbering series records.`);

      // ── Step 3: Create 2026 sequences for Phase 1 active series ────────────
      console.log('[seed:series] Step 3: Pre-creating sequences for year 2026...');

      await tx.execute(sql`CREATE SEQUENCE IF NOT EXISTS documents.ns_sp_resolution_2026_seq AS INTEGER INCREMENT 1 START 1;`);
      await tx.execute(sql`CREATE SEQUENCE IF NOT EXISTS documents.ns_sp_ordinance_2026_seq AS INTEGER INCREMENT 1 START 1;`);
      await tx.execute(sql`CREATE SEQUENCE IF NOT EXISTS documents.ns_sp_appropriation_ordinance_2026_seq AS INTEGER INCREMENT 1 START 1;`);
      await tx.execute(sql`CREATE SEQUENCE IF NOT EXISTS documents.ns_panlalawigan_review_log_2026_seq AS INTEGER INCREMENT 1 START 1;`);

      console.log('[seed:series] Sequence pre-creation completed.');
  });
}

async function main() {
  const databaseUrl = process.env['DATABASE_URL_MIGRATE'] || process.env['DATABASE_URL_APP'];
  if (!databaseUrl) {
    console.error('[seed:series] Error: DATABASE_URL_MIGRATE or DATABASE_URL_APP environment variable is not set.');
    process.exit(1);
  }
  console.log('[seed:series] Connecting to database...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  try {
    await seedNumberSeries(db);
    console.log('[seed:series] Number series seeding completed successfully.');
  } catch (error) {
    console.error('[seed:series] Database seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[seed:series] Unhandled error during seeding:', err);
    process.exit(1);
  });
}
