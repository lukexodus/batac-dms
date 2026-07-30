import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { offices, employees, committees, committeeMemberships } from '@batac/database/schema/organization.schema.js';
import { sql } from 'drizzle-orm';

// ────────── CONSTANTS ────────────────────────────────────────────────────────
const CITY_ID = '00000000-0000-4000-8000-000000000001';

// ────────── TYPES ─────────────────────────────────────────────────────────────
type OrgOfficeType = 'executive' | 'legislative' | 'department' | 'barangay' | 'external';

interface OfficeDef {
  code: string;
  name: string;
  type: OrgOfficeType;
  parentCode: string | null;
}

interface SpMemberDef {
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

interface CommitteeDef {
  code: string;
  name: string;
  chairEmployeeNumber: string;
  viceChairEmployeeNumber: string;
  memberEmployeeNumber: string;
}

// ────────── OFFICE DEFINITIONS ────────────────────────────────────────────────
// Offices to seed [Confirmed by developer — 2026-06-27]
// All department offices are standalone (parentCode: null).
// SPS has SP as parent — handled by two-pass insertion.
const OFFICES: OfficeDef[] = [
  // Executive branch
  { code: 'OOM', name: 'Office of the Mayor', type: 'executive', parentCode: null },
  // Legislative branch
  { code: 'OVM', name: 'Office of the Vice Mayor', type: 'legislative', parentCode: null },
  { code: 'SP', name: 'Sangguniang Panlungsod', type: 'legislative', parentCode: null },
  { code: 'SPS', name: 'SP Secretariat', type: 'legislative', parentCode: 'SP' },
  // City departments — all standalone (parentCode: null)
  { code: 'CAO', name: 'City Accounting Office', type: 'department', parentCode: null },
  { code: 'BO', name: 'Budget Office', type: 'department', parentCode: null },
  { code: 'CEO', name: "City Engineer's Office", type: 'department', parentCode: null },
  { code: 'CHO', name: 'City Health Office', type: 'department', parentCode: null },
  {
    code: 'CHMO',
    name: 'City Human Resources Management Office',
    type: 'department',
    parentCode: null,
  },
  { code: 'CLO', name: 'City Legal Office', type: 'department', parentCode: null },
  {
    code: 'CPDO',
    name: 'City Planning and Development Office',
    type: 'department',
    parentCode: null,
  },
  { code: 'CTO', name: "City Treasurer's Office", type: 'department', parentCode: null },
  // External — for documents received from outside the LGU
  { code: 'EXT', name: 'External', type: 'external', parentCode: null },
];

// ────────── SP MEMBER DEFINITIONS ─────────────────────────────────────────────
// 12 unique SP members (7th Sangguniang Panlungsod) [Confirmed — 2026-06-27].
// These are development placeholder employee records; a Platform Administrator
// will link them to real IAM users after seeding via TASK-ORG-008 tRPC procedures.
const SP_MEMBERS: SpMemberDef[] = [
  { employeeNumber: 'SP-FLOJO', firstName: 'Juan Paulo P.', lastName: 'Flojo' },
  { employeeNumber: 'SP-AGUINALDO', firstName: 'MacArthur A.', lastName: 'Aguinaldo' },
  { employeeNumber: 'SP-PUNGTILAN', firstName: 'Kichel Jomarie G.', lastName: 'Pungtilan' },
  { employeeNumber: 'SP-DAGUIO', firstName: 'John Gabrielle Dominique M.', lastName: 'Daguio' },
  { employeeNumber: 'SP-BORLEO', firstName: 'Martha Louise Aurora M.', lastName: 'Borleo' },
  { employeeNumber: 'SP-QUIDANG', firstName: 'Gwyneth S.', lastName: 'Quidang' },
  { employeeNumber: 'SP-MEDINA', firstName: 'Gilbert O.', lastName: 'Medina' },
  { employeeNumber: 'SP-MIRASOL', firstName: 'Reign Gwendia T.', lastName: 'Mirasol' },
  { employeeNumber: 'SP-CASTILLO', firstName: 'Rizal P.', lastName: 'Castillo' },
  { employeeNumber: 'SP-NALUPTA', firstName: 'Violeta Eugenia D.', lastName: 'Nalupta' },
  { employeeNumber: 'SP-BUNYE', firstName: 'Lucky Rene G.', lastName: 'Bunye' },
  { employeeNumber: 'SP-SALAMANGKIT', firstName: 'Eleuterio A.', lastName: 'Salamangkit Jr.' },
];

// ────────── COMMITTEE DEFINITIONS ─────────────────────────────────────────────
// 23 standing committees from the official 7th SP Standing Committees list
// (requirements-gathering/scanned-documents/standing-committees/standing-committees.md)
// [Confirmed — 2026-06-27]
const COMMITTEES: CommitteeDef[] = [
  {
    code: 'CLREP',
    name: 'Committee on Laws, Rules, Ethics & Privileges',
    chairEmployeeNumber: 'SP-FLOJO',
    viceChairEmployeeNumber: 'SP-DAGUIO',
    memberEmployeeNumber: 'SP-BORLEO',
  },
  {
    code: 'CPOPSD',
    name: 'Committee on Peace and Order & Public Safety & Dangerous Drugs',
    chairEmployeeNumber: 'SP-AGUINALDO',
    viceChairEmployeeNumber: 'SP-FLOJO',
    memberEmployeeNumber: 'SP-SALAMANGKIT',
  },
  {
    code: 'CSWDPS',
    name: 'Committee on Social Welfare Development & Public Service & Calamities',
    chairEmployeeNumber: 'SP-PUNGTILAN',
    viceChairEmployeeNumber: 'SP-SALAMANGKIT',
    memberEmployeeNumber: 'SP-DAGUIO',
  },
  {
    code: 'CECST',
    name: 'Committee on Education, Culture, Science & Technology',
    chairEmployeeNumber: 'SP-DAGUIO',
    viceChairEmployeeNumber: 'SP-PUNGTILAN',
    memberEmployeeNumber: 'SP-MIRASOL',
  },
  {
    code: 'CHSP',
    name: 'Committee on Health and Sanitation & Public Welfare',
    chairEmployeeNumber: 'SP-BORLEO',
    viceChairEmployeeNumber: 'SP-DAGUIO',
    memberEmployeeNumber: 'SP-MIRASOL',
  },
  {
    code: 'CAFWM',
    name: 'Committee on Appropriations and Finance & Ways and Means',
    chairEmployeeNumber: 'SP-BORLEO',
    viceChairEmployeeNumber: 'SP-DAGUIO',
    memberEmployeeNumber: 'SP-SALAMANGKIT',
  },
  { code: 'CHRCS', name: 'Committee on Human Rights & CSOs', chairEmployeeNumber: 'SP-QUIDANG', viceChairEmployeeNumber: 'SP-BUNYE', memberEmployeeNumber: 'SP-FLOJO' },
  {
    code: 'CSPCA',
    name: 'Committee on Special Projects & Corporate Affairs',
    chairEmployeeNumber: 'SP-AGUINALDO',
    viceChairEmployeeNumber: 'SP-BORLEO',
    memberEmployeeNumber: 'SP-NALUPTA',
  },
  { code: 'CBA', name: 'Committee on Barangay Affairs', chairEmployeeNumber: 'SP-MEDINA', viceChairEmployeeNumber: 'SP-SALAMANGKIT', memberEmployeeNumber: 'SP-CASTILLO' },
  {
    code: 'CTC',
    name: 'Committee on Transportation and Communication',
    chairEmployeeNumber: 'SP-MEDINA',
    viceChairEmployeeNumber: 'SP-AGUINALDO',
    memberEmployeeNumber: 'SP-PUNGTILAN',
  },
  {
    code: 'CTPI',
    name: 'Committee on Tourism & Public Information',
    chairEmployeeNumber: 'SP-DAGUIO',
    viceChairEmployeeNumber: 'SP-SALAMANGKIT',
    memberEmployeeNumber: 'SP-BORLEO',
  },
  { code: 'CGA', name: 'Committee on Games and Amusements', chairEmployeeNumber: 'SP-MIRASOL', viceChairEmployeeNumber: 'SP-FLOJO', memberEmployeeNumber: 'SP-QUIDANG' },
  { code: 'CSCN', name: 'Committee on Senior Citizens & NGOs', chairEmployeeNumber: 'SP-CASTILLO', viceChairEmployeeNumber: 'SP-PUNGTILAN', memberEmployeeNumber: 'SP-AGUINALDO' },
  {
    code: 'CEEMS',
    name: 'Committee on Economic Enterprise, Market & Slaughterhouse',
    chairEmployeeNumber: 'SP-FLOJO',
    viceChairEmployeeNumber: 'SP-AGUINALDO',
    memberEmployeeNumber: 'SP-PUNGTILAN',
  },
  {
    code: 'CLEA',
    name: 'Committee on Landed Estates & Assessments',
    chairEmployeeNumber: 'SP-NALUPTA',
    viceChairEmployeeNumber: 'SP-QUIDANG',
    memberEmployeeNumber: 'SP-DAGUIO',
  },
  {
    code: 'CGGE',
    name: 'Committee on Good Government/Public Ethics and Accountability',
    chairEmployeeNumber: 'SP-BUNYE',
    viceChairEmployeeNumber: 'SP-NALUPTA',
    memberEmployeeNumber: 'SP-FLOJO',
  },
  {
    code: 'CPWIH',
    name: 'Committee on Public Works, Infrastructure, Housing & Urban Development',
    chairEmployeeNumber: 'SP-SALAMANGKIT',
    viceChairEmployeeNumber: 'SP-MEDINA',
    memberEmployeeNumber: 'SP-AGUINALDO',
  },
  {
    code: 'CAFCL',
    name: 'Committee on Agriculture, Food, Cooperatives and Livelihood',
    chairEmployeeNumber: 'SP-SALAMANGKIT',
    viceChairEmployeeNumber: 'SP-PUNGTILAN',
    memberEmployeeNumber: 'SP-MIRASOL',
  },
  {
    code: 'CENR',
    name: 'Committee on Environment, Natural Resources, Climate Change Adaptation, Water Sustainability & Energy',
    chairEmployeeNumber: 'SP-SALAMANGKIT',
    viceChairEmployeeNumber: 'SP-CASTILLO',
    memberEmployeeNumber: 'SP-MEDINA',
  },
  {
    code: 'CTCI',
    name: 'Committee on Trade, Commerce & Industry',
    chairEmployeeNumber: 'SP-AGUINALDO',
    viceChairEmployeeNumber: 'SP-SALAMANGKIT',
    memberEmployeeNumber: 'SP-BUNYE',
  },
  {
    code: 'CWCF',
    name: 'Committee on Women, Children & Family Relations & Indigenous Peoples',
    chairEmployeeNumber: 'SP-PUNGTILAN',
    viceChairEmployeeNumber: 'SP-BORLEO',
    memberEmployeeNumber: 'SP-FLOJO',
  },
  {
    code: 'CLEC',
    name: 'Committee on Labor, Employment & Civil Service',
    chairEmployeeNumber: 'SP-FLOJO',
    viceChairEmployeeNumber: 'SP-MIRASOL',
    memberEmployeeNumber: 'SP-BORLEO',
  },
  {
    code: 'CYSD',
    name: 'Committee on Youth & Sports Development',
    chairEmployeeNumber: 'SP-MIRASOL',
    viceChairEmployeeNumber: 'SP-DAGUIO',
    memberEmployeeNumber: 'SP-PUNGTILAN',
  },
];

import { fileURLToPath } from 'node:url';

// ────────── MAIN SEED FUNCTION ─────────────────────────────────────────────────
export async function seedOrganization(db: any) {
  await db.transaction(async (tx: any) => {
    // ── Step 1: Upsert offices (two-pass for hierarchy) ──────────────────────
    // Pass 1 inserts all standalone offices (parentCode: null).
    // Pass 2 inserts SPS which references SP as its parent.
    // This ordering guarantees the parent row exists before the child FK is set.
    console.log('[seed:org] Step 1: Upserting offices (two-pass)...');

    const standaloneOffices = OFFICES.filter((o) => o.parentCode === null);
    const childOffices = OFFICES.filter((o) => o.parentCode !== null);

    // Map of office code → seeded row id, built as offices are inserted.
    const seededOfficeIds: Record<string, string> = {};

    for (const pass of [standaloneOffices, childOffices]) {
      for (const office of pass) {
        const parentOfficeId =
          office.parentCode !== null ? (seededOfficeIds[office.parentCode] ?? null) : null;

        const [row] = await tx
          .insert(offices)
          .values({
            cityId: CITY_ID,
            code: office.code,
            name: office.name,
            officeType: office.type,
            parentOfficeId,
          })
          .onConflictDoUpdate({
            target: [offices.cityId, offices.code],
            set: {
              name: sql`excluded.name`,
              officeType: sql`excluded.office_type`,
              updatedAt: new Date(),
            },
          })
          .returning({ id: offices.id });

        if (!row) {
          throw new Error(`[seed:org] Failed to upsert office code="${office.code}"`);
        }

        seededOfficeIds[office.code] = row.id;
      }
    }

    console.log(`[seed:org] Upserted ${OFFICES.length} offices.`);

    // ── Step 2: Upsert SP member placeholder employees ───────────────────────
    // employee_number 'SP-{LASTNAME}' format is a development placeholder.
    // A Platform Administrator links these to real IAM users via TASK-ORG-008.
    // Note: Mayor and Vice Mayor employee records are NOT created here per spec.
    console.log('[seed:org] Step 2: Upserting SP member placeholder employees...');

    const seededEmployeeIds: Record<string, string> = {};

    for (const member of SP_MEMBERS) {
      const [row] = await tx
        .insert(employees)
        .values({
          cityId: CITY_ID,
          employeeNumber: member.employeeNumber,
          firstName: member.firstName,
          lastName: member.lastName,
        })
        .onConflictDoUpdate({
          target: [employees.cityId, employees.employeeNumber],
          set: {
            firstName: sql`excluded.first_name`,
            lastName: sql`excluded.last_name`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: employees.id });

      if (!row) {
        throw new Error(`[seed:org] Failed to upsert employee number="${member.employeeNumber}"`);
      }

      seededEmployeeIds[member.employeeNumber] = row.id;
    }

    console.log(`[seed:org] Upserted ${SP_MEMBERS.length} SP member placeholder employees.`);

    // ── Step 3: Upsert standing committees ───────────────────────────────────
    // Committees reference chairedByEmployeeId which must exist first (Step 2).
    // The chaired_by_employee_id column is NOT NULL — upsert will fail at the
    // DB level if the employee row was not inserted in Step 2.
    console.log('[seed:org] Step 3: Upserting SP standing committees...');

    let committeesSeeded = 0;

    for (const committee of COMMITTEES) {
      const chairedByEmployeeId = seededEmployeeIds[committee.chairEmployeeNumber];

      if (!chairedByEmployeeId) {
        // Guard: should never happen given SP_MEMBERS covers all chair codes.
        throw new Error(
          `[seed:org] Chair employee "${committee.chairEmployeeNumber}" not found for committee "${committee.code}". ` +
            'Ensure SP_MEMBERS covers all chairEmployeeNumber values in COMMITTEES.',
        );
      }

      await tx
        .insert(committees)
        .values({
          cityId: CITY_ID,
          code: committee.code,
          name: committee.name,
          chairedByEmployeeId,
        })
        .onConflictDoUpdate({
          target: [committees.cityId, committees.code],
          set: {
            name: sql`excluded.name`,
            chairedByEmployeeId: sql`excluded.chaired_by_employee_id`,
            updatedAt: new Date(),
          },
        });

      committeesSeeded++;
    }

    console.log(`[seed:org] Upserted ${committeesSeeded} standing committees.`);

    // ── Step 4: Upsert committee memberships ─────────────────────────────────
    console.log('[seed:org] Step 4: Upserting committee memberships...');
    let membershipsSeeded = 0;

    const seededCommitteeIds: Record<string, string> = {};
    const committeeRows = await tx.select({ id: committees.id, code: committees.code }).from(committees).where(sql`${committees.cityId} = ${CITY_ID}`);
    for (const row of committeeRows) {
      seededCommitteeIds[row.code] = row.id;
    }

    for (const committee of COMMITTEES) {
      const committeeId = seededCommitteeIds[committee.code];
      const chairId = seededEmployeeIds[committee.chairEmployeeNumber];
      const viceChairId = seededEmployeeIds[committee.viceChairEmployeeNumber];
      const memberId = seededEmployeeIds[committee.memberEmployeeNumber];

      const rolesToAssign = [
        { empId: chairId, role: 'chairman' },
        { empId: viceChairId, role: 'vice_chairman' },
        { empId: memberId, role: 'member' },
      ];

      for (const { empId, role } of rolesToAssign) {
        if (!empId) continue;

        const [existing] = await tx
          .select({ id: committeeMemberships.id })
          .from(committeeMemberships)
          .where(
            sql`${committeeMemberships.committeeId} = ${committeeId} AND ${committeeMemberships.employeeId} = ${empId} AND ${committeeMemberships.isActive} = true AND ${committeeMemberships.deletedAt} IS NULL`,
          )
          .limit(1);

        if (existing) {
          await tx
            .update(committeeMemberships)
            .set({ committeeRole: role, updatedAt: new Date() })
            .where(sql`${committeeMemberships.id} = ${existing.id}`);
        } else {
          await tx.insert(committeeMemberships).values({
            cityId: CITY_ID,
            committeeId,
            employeeId: empId,
            committeeRole: role,
            startDate: new Date('2026-01-01').toISOString(),
          });
        }
        membershipsSeeded++;
      }
    }

    console.log(`[seed:org] Upserted ${membershipsSeeded} committee memberships.`);
  });
}

async function main() {
  const databaseUrl = process.env['DATABASE_URL_MIGRATE'] || process.env['DATABASE_URL_APP'];
  if (!databaseUrl) {
    console.error(
      '[seed:org] Error: DATABASE_URL_MIGRATE or DATABASE_URL_APP environment variable is not set.',
    );
    process.exit(1);
  }
  console.log('[seed:org] Connecting to database...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  try {
    await seedOrganization(db);
    console.log('[seed:org] Organization seed completed successfully.');
  } catch (error) {
    console.error('[seed:org] Database seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error('[seed:org] Unhandled error during seeding:', err);
    process.exit(1);
  });
}
