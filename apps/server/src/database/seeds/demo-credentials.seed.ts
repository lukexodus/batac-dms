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
    // SP Secretary is Secretariat staff, not one of the 12 SP_MEMBERS placeholder
    // employees — organization.seed.ts does not create this employee row either,
    // so this also needs a fresh insert.
    newEmployee: { employeeNumber: 'SPS-LAGURA', firstName: 'Gladys R.', lastName: 'Lagura' },
  },
  {
    username: 'records.mesina',
    email: 'mesina@batac.gov.ph',
    roleCode: 'records_officer',
    officeCode: 'SPS',
    displayName:
      'Mia Prima M. Mesina (Records Officer — Admin Officer II, Ordinances & Resolutions Section)',
    // Not one of the 12 SP_MEMBERS councilors seeded by organization.seed.ts,
    // and not created by any other seed — needs a fresh employees row, same
    // as mayor.chua / vicemayor.chua / secretary.lagura above.
    newEmployee: { employeeNumber: 'SPS-MESINA', firstName: 'Mia Prima M.', lastName: 'Mesina' },
  },
  {
    // One representative councilor for the demo — chair of Laws (co-referral
    // committee on nearly every measure) and Economic Enterprise per Part 6.
    username: 'councilor.flojo',
    email: 'flojo@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. Juan Paulo P. Flojo (City Councilor, Chair — Committee on Laws)',
    existingEmployeeNumber: 'SP-FLOJO',
  },
  {
    // Second councilor — different committee assignments, useful for showing
    // the multi_referral / joint-hearing workflow with two distinct committee chairs.
    username: 'councilor.aguinaldo',
    email: 'aguinaldo@batac.gov.ph',
    roleCode: 'sp_member',
    officeCode: 'SP',
    displayName: 'Hon. MacArthur A. Aguinaldo (City Councilor, Chair — Peace & Order)',
    existingEmployeeNumber: 'SP-AGUINALDO',
  },
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
