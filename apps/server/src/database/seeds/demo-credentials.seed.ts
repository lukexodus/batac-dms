// apps/server/src/database/seeds/demo-credentials.seed.ts
//
// DEMO/PRESENTATION USE ONLY — do not run against a production database.
//
// Purpose: the standard `pnpm db:seed` orchestrator seeds roles, permissions,
// offices, the 12 councilor employee records, and committees — but it does NOT
// create any login-capable iam.users accounts (confirmed: iam.seed.ts inserts
// only one inactive `system` sentinel user), and organization.seed.ts explicitly
// skips Mayor/Vice Mayor employee records ("NOT created here per spec").
// The sysadmin "Create User" UI generates a random, never-surfaced password
// (iam.service.ts createUserAccount, line ~1132), so it cannot produce a
// known login either.
//
// This script closes that gap by creating real, known-password login accounts
// for the actual named 7th SP stakeholders, using the exact users/credentials/
// roleAssignments insert pattern already proven in apps/server/src/demo-backend.ts,
// and linking them to organization.employees per the userId FK confirmed in
// packages/database/schema/organization.schema.ts.
//
// Run with:  pnpm --filter server exec tsx src/database/seeds/demo-credentials.seed.ts
// (Run AFTER `pnpm db:seed` — this script depends on offices, roles, and the
// 12 councilor employee placeholders already existing.)

import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { users, credentials, roleAssignments, roles } from '@batac/database/schema/iam.schema.js';
import { offices, employees, positions, assignments } from '@batac/database/schema/organization.schema.js';
import { env } from '../../config/env.js';

// Same system-user sentinel used by iam.seed.ts and demo-backend.ts.
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const CITY_ID = env.CITY_ID ?? '00000000-0000-4000-8000-000000000001';

// One shared, easy-to-say demo password. Presentation-only — never reuse in prod.
const DEMO_PASSWORD = 'BatacDemo2026!';

interface DemoAccountDef {
  username: string;
  email: string;
  roleCode: string; // must match a roles.code seeded by iam.seed.ts
  officeCode: string; // must match an offices.code seeded by organization.seed.ts
  displayName: string; // for console output only
  // Only set for people who need a NEW employees row (Mayor, Vice Mayor).
  // Leave undefined for people whose employee row already exists (the 12 councilors) —
  // for those, we UPDATE the existing row's userId instead of inserting.
  newEmployee?: { employeeNumber: string; firstName: string; lastName: string };
  // Only set when linking to an EXISTING employee row (the 12 councilors),
  // matching the employeeNumber convention 'SP-{LASTNAME}' from organization.seed.ts.
  existingEmployeeNumber?: string;
}

// ────────── ACCOUNTS TO CREATE ─────────────────────────────────────────────
// Names, roles, and offices cross-checked against:
//   docs/requirements-gathering/consolidated-architecture-and-requirements-reference-iteration-3.md
//   Part 3.1 (Mayor/VM), Part 3.3 (Secretariat), Part 3.2 (SP Members)
const DEMO_ACCOUNTS: DemoAccountDef[] = [
  {
    username: 'it.admin',
    email: 'it.admin@batac.gov.ph',
    roleCode: 'sys_admin',
    officeCode: 'OOM',
    displayName: 'IT Administrator',
    newEmployee: {
      employeeNumber: 'OOM-IT-ADMIN',
      firstName: 'IT',
      lastName: 'Administrator',
    },
  },
  {
    username: 'plat.admin',
    email: 'plat.admin@batac.gov.ph',
    roleCode: 'plat_admin',
    officeCode: 'OOM',
    displayName: 'Platform Administrator',
    newEmployee: {
      employeeNumber: 'OOM-PLAT-ADMIN',
      firstName: 'Platform',
      lastName: 'Administrator',
    },
  },
  {
    username: 'mayor.chua',
    email: 'mayor.chua@batac.gov.ph',
    roleCode: 'mayor',
    officeCode: 'OOM',
    displayName: 'Hon. Mark Christian R. Chua (Mayor)',
    newEmployee: {
      employeeNumber: 'OOM-CHUA-MRC',
      firstName: 'Mark Christian R.',
      lastName: 'Chua',
    },
  },
  {
    username: 'vicemayor.chua',
    email: 'vicemayor.chua@batac.gov.ph',
    roleCode: 'sp_presiding_officer',
    officeCode: 'OVM',
    displayName: 'Hon. Albert D. Chua (Vice Mayor / Presiding Officer)',
    newEmployee: { employeeNumber: 'OVM-CHUA-ADC', firstName: 'Albert D.', lastName: 'Chua' },
  },
  {
    username: 'secretary.lagura',
    email: 'secretary.lagura@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Gladys R. Lagura (SP Secretary)',
    newEmployee: { employeeNumber: 'SPS-LAGURA', firstName: 'Gladys R.', lastName: 'Lagura' },
  },
  {
    username: 'records.mesina',
    email: 'mesina@batac.gov.ph',
    roleCode: 'records_officer',
    officeCode: 'SPS',
    displayName: 'Mia Prima M. Mesina (Records Officer — Admin Officer II)',
    newEmployee: { employeeNumber: 'SPS-MESINA', firstName: 'Mia Prima M.', lastName: 'Mesina' },
  },
  {
    username: 'sps.beltran',
    email: 'beltran@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Ronald P. Beltran (Administrative Officer II — Franchise Section)',
    newEmployee: { employeeNumber: 'SPS-BELTRAN', firstName: 'Ronald P.', lastName: 'Beltran' },
  },
  {
    username: 'sps.rosales',
    email: 'rosales@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Bonn Roger G. Rosales (Administrative Aide VI)',
    newEmployee: { employeeNumber: 'SPS-ROSALES', firstName: 'Bonn Roger G.', lastName: 'Rosales' },
  },
  {
    username: 'sps.ilayat',
    email: 'ilayat@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Kathielyn R. Ilayat (Administrative Aide VI)',
    newEmployee: { employeeNumber: 'SPS-ILAYAT', firstName: 'Kathielyn R.', lastName: 'Ilayat' },
  },
  {
    username: 'sps.chua',
    email: 'sps.chua@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Paul Josiah N. Chua (Administrative Aide VI)',
    newEmployee: { employeeNumber: 'SPS-CHUA', firstName: 'Paul Josiah N.', lastName: 'Chua' },
  },
  {
    username: 'sps.macugay',
    email: 'macugay@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Joanne Marie Q. Macugay (Administrative Aide VI)',
    newEmployee: { employeeNumber: 'SPS-MACUGAY', firstName: 'Joanne Marie Q.', lastName: 'Macugay' },
  },
  {
    username: 'sps.gaoiran',
    email: 'gaoiran@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Jeniffer S. Gaoiran (Administrative Aide VI)',
    newEmployee: { employeeNumber: 'SPS-GAOIRAN', firstName: 'Jeniffer S.', lastName: 'Gaoiran' },
  },
  {
    username: 'sps.yaplag',
    email: 'yaplag@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Antonia Elizabeth G. Yaplag (Administrative Aide VI)',
    newEmployee: { employeeNumber: 'SPS-YAPLAG', firstName: 'Antonia Elizabeth G.', lastName: 'Yaplag' },
  },
  {
    username: 'sps.lumang',
    email: 'lumang@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Florentino Pablo R. Lumang (Administrative Aide VI)',
    newEmployee: { employeeNumber: 'SPS-LUMANG', firstName: 'Florentino Pablo R.', lastName: 'Lumang' },
  },
  {
    username: 'sps.purisima',
    email: 'purisima@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Ronell R. Purisima (Administrative Aide III)',
    newEmployee: { employeeNumber: 'SPS-PURISIMA', firstName: 'Ronell R.', lastName: 'Purisima' },
  },
  {
    username: 'sps.rante',
    email: 'rante@batac.gov.ph',
    roleCode: 'sp_secretary',
    officeCode: 'SPS',
    displayName: 'Ramil F. Rante (Administrative Aide IV)',
    newEmployee: { employeeNumber: 'SPS-RANTE', firstName: 'Ramil F.', lastName: 'Rante' },
  },
  {
    username: 'sps.malicad',
    email: 'malicad@batac.gov.ph',
    roleCode: 'records_officer',
    officeCode: 'SPS',
    displayName: 'Cherill S. Malicad (Librarian I)',
    newEmployee: { employeeNumber: 'SPS-MALICAD', firstName: 'Cherill S.', lastName: 'Malicad' },
  },
  {
    username: 'councilor.flojo',
    email: 'flojo@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Juan Paulo P. Flojo (City Councilor, Chair — Committee on Laws)',
    existingEmployeeNumber: 'SP-FLOJO',
  },
  {
    username: 'councilor.aguinaldo',
    email: 'aguinaldo@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. MacArthur A. Aguinaldo (City Councilor, Chair — Peace & Order)',
    existingEmployeeNumber: 'SP-AGUINALDO',
  },
  {
    username: 'councilor.pungtilan',
    email: 'pungtilan@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Kichel Jomarie G. Pungtilan (City Councilor)',
    existingEmployeeNumber: 'SP-PUNGTILAN',
  },
  {
    username: 'councilor.salamangkit',
    email: 'salamangkit@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Eleuterio A. Salamangkit Jr. (City Councilor)',
    existingEmployeeNumber: 'SP-SALAMANGKIT',
  },
  {
    username: 'councilor.borleo',
    email: 'borleo@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Martha Louise Aurora M. Borleo (City Councilor)',
    existingEmployeeNumber: 'SP-BORLEO',
  },
  {
    username: 'councilor.quidang',
    email: 'quidang@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Gwyneth S. Quidang (City Councilor)',
    existingEmployeeNumber: 'SP-QUIDANG',
  },
  {
    username: 'councilor.daguio',
    email: 'daguio@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. John Gabrielle Dominique M. Daguio (City Councilor)',
    existingEmployeeNumber: 'SP-DAGUIO',
  },
  {
    username: 'councilor.bunye',
    email: 'bunye@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Lucky Rene G. Bunye (City Councilor)',
    existingEmployeeNumber: 'SP-BUNYE',
  },
  {
    username: 'councilor.nalupta',
    email: 'nalupta@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Violeta Eugenia D. Nalupta (City Councilor)',
    existingEmployeeNumber: 'SP-NALUPTA',
  },
  {
    username: 'councilor.castillo',
    email: 'castillo@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Rizal P. Castillo (City Councilor)',
    existingEmployeeNumber: 'SP-CASTILLO',
  },
  {
    username: 'councilor.medina',
    email: 'medina@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Gilbert O. Medina (ABC Representative)',
    existingEmployeeNumber: 'SP-MEDINA',
  },
  {
    username: 'councilor.mirasol',
    email: 'mirasol@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Reign Gwendia T. Mirasol (SK Representative)',
    existingEmployeeNumber: 'SP-MIRASOL',
  }
];

async function main() {
  const databaseUrl = process.env['DATABASE_URL_APP'] || process.env['DATABASE_URL_MIGRATE'];
  if (!databaseUrl) {
    console.error(
      '[seed:demo-credentials] Error: DATABASE_URL_APP or DATABASE_URL_MIGRATE not set.',
    );
    process.exit(1);
  }

  console.log('[seed:demo-credentials] Connecting to database...');
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  const created: { username: string; displayName: string; roleCode: string }[] = [];
  const skipped: { username: string; reason: string }[] = [];

  try {
    // Pre-hash once; Argon2id params match demo-backend.ts / env config exactly,
    // so the resulting hash verifies correctly against the real login route.
    const passwordHash = await argon2.hash(DEMO_PASSWORD, {
      memoryCost: env.ARGON2_MEMORY_COST ?? 65536,
      timeCost: env.ARGON2_TIME_COST ?? 3,
      parallelism: env.ARGON2_PARALLELISM ?? 4,
      hashLength: env.ARGON2_HASH_LENGTH ?? 32,
    });

    for (const account of DEMO_ACCOUNTS) {
      await db.transaction(async (tx) => {
        // ── Resolve office ────────────────────────────────────────────────
        const [office] = await tx
          .select({ id: offices.id })
          .from(offices)
          .where(eq(offices.code, account.officeCode))
          .limit(1);

        if (!office) {
          throw new Error(
            `Office code "${account.officeCode}" not found. Run "pnpm db:seed" first.`,
          );
        }

        // ── Resolve role ──────────────────────────────────────────────────
        const [role] = await tx
          .select({ id: roles.id })
          .from(roles)
          .where(eq(roles.code, account.roleCode))
          .limit(1);

        if (!role) {
          throw new Error(`Role code "${account.roleCode}" not found. Run "pnpm db:seed" first.`);
        }

        // ── Check if this username already exists (idempotency) ───────────
        const [existingUser] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, account.username))
          .limit(1);

        let userId: string;

        if (existingUser) {
          userId = existingUser.id;
          skipped.push({
            username: account.username,
            reason: 'user already exists — left untouched',
          });
        } else {
          userId = randomUUID();

          await tx.insert(users).values({
            id: userId,
            cityId: CITY_ID,
            username: account.username,
            email: account.email,
            status: 'active',
          });

          await tx.insert(credentials).values({
            id: randomUUID(),
            cityId: CITY_ID,
            userId,
            passwordHash,
          });

          await tx.insert(roleAssignments).values({
            id: randomUUID(),
            cityId: CITY_ID,
            userId,
            roleId: role.id,
            officeScopeId: office.id,
            assignedBy: SYSTEM_USER_ID,
          });

          created.push({
            username: account.username,
            displayName: account.displayName,
            roleCode: account.roleCode,
          });
        }

        // ── Link or create the employees row ───────────────────────────────
        if (account.newEmployee) {
          // Mayor / Vice Mayor / SP Secretary: employee row may not exist yet
          // (first run) or may already be linked (re-run). Check first to avoid
          // violating uq_employees_user_id on re-runs.
          const [existingEmp] = await tx
            .select({ id: employees.id })
            .from(employees)
            .where(sql`${employees.userId} = ${userId}`)
            .limit(1);

          if (!existingEmp) {
            await tx
              .insert(employees)
              .values({
                cityId: CITY_ID,
                userId,
                employeeNumber: account.newEmployee.employeeNumber,
                firstName: account.newEmployee.firstName,
                lastName: account.newEmployee.lastName,
                email: account.email,
              })
              .onConflictDoUpdate({
                target: [employees.cityId, employees.employeeNumber],
                set: { userId, updatedAt: new Date() },
              });
          }
        } else if (account.existingEmployeeNumber) {
          // Councilors: employee row already exists from organization.seed.ts —
          // link it to the new user account by setting userId.
          const result = await tx
            .update(employees)
            .set({ userId, updatedAt: new Date() })
            .where(
              sql`${employees.cityId} = ${CITY_ID} AND ${employees.employeeNumber} = ${account.existingEmployeeNumber}`,
            )
            .returning({ id: employees.id });

          if (result.length === 0) {
            throw new Error(
              `Employee number "${account.existingEmployeeNumber}" not found — ` +
                `expected it to exist from organization.seed.ts. Run "pnpm db:seed" first.`,
            );
          }
        }

        // ── Assign Position and Office ─────────────────────────────────────────
        const [emp] = await tx
          .select({ id: employees.id })
          .from(employees)
          .where(sql`${employees.userId} = ${userId}`)
          .limit(1);

        if (emp) {
          // Create a dummy position for the user in this office if one doesn't exist
          const positionCode = `POS-${account.username.toUpperCase()}`;
          let positionId: string;
          const [existingPosition] = await tx
            .select({ id: positions.id })
            .from(positions)
            .where(sql`${positions.cityId} = ${CITY_ID} AND ${positions.code} = ${positionCode}`)
            .limit(1);

          if (existingPosition) {
            positionId = existingPosition.id;
          } else {
            positionId = randomUUID();
            await tx.insert(positions).values({
              id: positionId,
              cityId: CITY_ID,
              officeId: office.id,
              title: account.displayName.split(' (')[0] || 'Demo Position',
              code: positionCode,
              authorityLevel: account.roleCode === 'mayor' ? 'executive' : 'staff',
            });
          }

          // Create the assignment linking the employee to the office and position
          const [existingAssignment] = await tx
            .select({ id: assignments.id })
            .from(assignments)
            .where(sql`${assignments.employeeId} = ${emp.id} AND ${assignments.isPrimary} = true AND ${assignments.isActive} = true`)
            .limit(1);

          if (!existingAssignment) {
            await tx.insert(assignments).values({
              id: randomUUID(),
              cityId: CITY_ID,
              employeeId: emp.id,
              positionId,
              officeId: office.id,
              startDate: new Date('2026-01-01').toISOString(), // Use string to match date type
              isPrimary: true,
              isActive: true,
            });
          }
        }
      });
    }

    // ── Print the credential sheet you'll actually use during the demo ─────
    console.log('\n' + '='.repeat(72));
    console.log('DEMO LOGIN CREDENTIALS — for presentation use only');
    console.log('='.repeat(72));
    console.log(`Shared password for all accounts: ${DEMO_PASSWORD}\n`);

    if (created.length > 0) {
      console.log('Created:');
      for (const c of created) {
        console.log(`  ${c.username.padEnd(20)} → ${c.displayName}  [${c.roleCode}]`);
      }
    }
    if (skipped.length > 0) {
      console.log('\nAlready existed (skipped, not modified):');
      for (const s of skipped) {
        console.log(`  ${s.username.padEnd(20)} — ${s.reason}`);
      }
    }
    console.log('='.repeat(72) + '\n');
  } catch (error) {
    console.error('[seed:demo-credentials] Failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[seed:demo-credentials] Unhandled error:', err);
  process.exit(1);
});
