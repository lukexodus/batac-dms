import { buildApp } from './app.js';
import PgBoss from 'pg-boss';
import { env } from './config/env.js';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { users, credentials, roleAssignments, roles } from '@batac/database/schema/iam.schema.js';
import { offices } from '@batac/database/schema/organization.schema.js';
import { eq } from 'drizzle-orm';
import type { AuditEvent } from './modules/audit/index.js';

async function runDemo() {
  console.log('\x1b[36m%s\x1b[0m', '=== Batac DMS Backend Functionalities Live Demo ===\n');

  // 1. Initialize DB and Fastify plugins
  console.log('1. Starting PgBoss & booting Fastify service tree...');
  let boss: PgBoss | null = null;
  try {
    boss = new PgBoss(env.DATABASE_URL_APP);
    await boss.start();
  } catch (err) {
    console.warn('\x1b[33m%s\x1b[0m', '   [Warning] Could not connect/start PgBoss. Running without background queue decoration.');
  }

  const app = await buildApp(boss ? { boss } : {});
  await app.ready();
  console.log('   Fastify app registry successfully initialized.');

  const db = app.db;
  if (!db) {
    console.error('   Error: Database connection not initialized. Exiting.');
    process.exit(1);
  }

  // Generate random IDs for the demo
  const testUserId = randomUUID();
  const demoUsername = `demo_clerk_${Math.floor(1000 + Math.random() * 9000)}`;
  const passwordPlain = 'SecurePass123!';

  try {
    console.log('\n2. Creating a test user and credentials via DB transactions...');
    
    // Hash password using Argon2id
    const passwordHash = await argon2.hash(passwordPlain, {
      memoryCost: env.ARGON2_MEMORY_COST ?? 65536,
      timeCost: env.ARGON2_TIME_COST ?? 3,
      parallelism: env.ARGON2_PARALLELISM ?? 4,
      hashLength: env.ARGON2_HASH_LENGTH ?? 32,
    });

    await db.transaction(async (tx) => {
      // Find SP Secretariat office
      const officeRows = await tx.select().from(offices).where(eq(offices.code, 'SPS')).limit(1);
      const spsOffice = officeRows[0];
      
      if (!spsOffice) {
        throw new Error('SPS office not found. Please run "pnpm db:seed" first.');
      }

      // Insert User
      await tx.insert(users).values({
        id: testUserId,
        cityId: env.CITY_ID,
        username: demoUsername,
        email: `${demoUsername}@batac.gov.ph`,
        status: 'active',
      });

      // Insert Credentials
      await tx.insert(credentials).values({
        id: randomUUID(),
        cityId: env.CITY_ID,
        userId: testUserId,
        passwordHash,
      });

      // Find sp_secretary role
      const roleRows = await tx.select().from(roles).where(eq(roles.code, 'sp_secretary')).limit(1);
      const secretaryRole = roleRows[0];
      
      if (secretaryRole) {
        // Assign sp_secretary role to our user
        await tx.insert(roleAssignments).values({
          id: randomUUID(),
          cityId: env.CITY_ID,
          userId: testUserId,
          roleId: secretaryRole.id,
          officeScopeId: spsOffice.id,
          assignedBy: '00000000-0000-0000-0000-000000000001', // system user sentinel
        });
      }
    });

    console.log(`   Demo user created successfully!`);
    console.log(`   - Username: \x1b[32m${demoUsername}\x1b[0m`);
    console.log(`   - Role: \x1b[32msp_secretary\x1b[0m (SP Secretariat)`);
    console.log(`   - Password: \x1b[32m${passwordPlain}\x1b[0m`);

    // 3. Demo REST login
    console.log('\n3. Testing REST API Login (POST /api/auth/login)...');
    const loginResult = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: demoUsername,
        password: passwordPlain,
        code_verifier: 'verifier', // stub value for PKCE
        code_challenge: 'verifier',
      },
    });

    console.log(`   Response status: \x1b[32m${loginResult.statusCode}\x1b[0m`);
    console.log('   Response cookies (including HttpOnly session tokens):');
    const setCookieHeaders = loginResult.headers['set-cookie'];
    if (Array.isArray(setCookieHeaders)) {
      setCookieHeaders.forEach(cookie => console.log(`     - ${cookie.split(';')[0]}`));
    } else if (setCookieHeaders) {
      console.log(`     - ${setCookieHeaders.split(';')[0]}`);
    }

    console.log('   Response Body:');
    const parsedBody = JSON.parse(loginResult.body);
    console.log(`     User: ${parsedBody.user.username} (${parsedBody.user.email})`);
    console.log(`     Session ID: ${parsedBody.sessionId}`);
    console.log(`     Assigned Roles: ${parsedBody.roleCodes.join(', ')}`);

    // 4. Demo tamper-evident Cryptographic Audit Trail
    console.log('\n4. Reading Cryptographic Audit Logs & verifying chain integrity...');
    const result = await app.auditService.queryEvents({ pageSize: 5 });
    const auditLogs = result.events;
    const chainValidationStatus = result.chainValidationStatus;

    console.log(`   Found ${auditLogs.length} audit entries. Showing latest entries:`);
    auditLogs.slice(0, 3).forEach((entry: AuditEvent, idx: number) => {
      console.log(`     [${idx + 1}] Event: \x1b[33m${entry.eventType}\x1b[0m`);
      console.log(`         Actor: ${entry.actorId}`);
      console.log(`         Hash Chain: ${entry.chainHash}`);
    });

    console.log('   Verifying entire audit chain integrity...');
    if (chainValidationStatus === 'intact') {
      console.log('\x1b[32m%s\x1b[0m', '   ✓ Cryptographic integrity verified: Hash chain is fully intact and unmodified.');
    } else {
      console.log('\x1b[31m%s\x1b[0m', `   ✗ Integrity Verification Failed: Chain is broken.`);
    }

    // Clean up demo user
    console.log('\n5. Cleaning up demo data...');
    await db.transaction(async (tx) => {
      await tx.delete(roleAssignments).where(eq(roleAssignments.userId, testUserId));
      await tx.delete(credentials).where(eq(credentials.userId, testUserId));
      await tx.delete(users).where(eq(users.id, testUserId));
    });
    console.log('   Demo data cleaned up successfully.');

  } catch (error) {
    console.error('\nAn error occurred during the demo:', error);
  } finally {
    if (boss) {
      await boss.stop();
    }
    await app.close();
    console.log('\nDemo complete. Fastify application closed.');
    process.exit(0);
  }
}

runDemo().catch(console.error);
