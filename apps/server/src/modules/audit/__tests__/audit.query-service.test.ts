import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { createAuditDb } from '../audit.db.js';
import { AuditRepository } from '../audit.repository.js';
import { AuditWriteService } from '../audit.write-service.js';
import { AuditQueryService } from '../audit.query-service.js';
import type { AuditEventInput } from '../index.js';
import 'dotenv/config';

describe('AuditQueryService (Integration)', () => {
  const databaseUrlAudit = process.env.DATABASE_URL_AUDIT;
  const databaseUrlMigrate = process.env.DATABASE_URL_MIGRATE;

  if (!databaseUrlAudit) {
    console.warn('Skipping integration tests: DATABASE_URL_AUDIT is not set');
    it.skip('Skipped due to missing env var', () => {});
    return;
  }

  const HMAC_SECRET = 'test_hmac_secret_key_min32chars_pad';
  const auditDb = createAuditDb(databaseUrlAudit);
  const repo = new AuditRepository(auditDb);
  const env = { AUDIT_HMAC_SECRET: HMAC_SECRET, AUDIT_CHAIN_VERIFY_ON_READ: true };
  const writeService = new AuditWriteService(repo, env);
  const queryService = new AuditQueryService(repo, env);

  // Privileged DB connection for tampering tests (simulates superuser SQL tampering)
  // Falls back to auditDb if DATABASE_URL_MIGRATE is not set (tests requiring UPDATE
  // will then be skipped or fail gracefully).
  const migrateDb = databaseUrlMigrate ? drizzle(postgres(databaseUrlMigrate, { max: 1 })) : null;

  /**
   * Helper: write an audit event and wait for DB commit.
   */
  async function writeEvent(
    overrides: Partial<AuditEventInput> & { actorId: string },
  ): Promise<void> {
    const input: AuditEventInput = {
      eventType: 'test.event',
      targetId: randomUUID(),
      targetType: 'test_resource',
      resourceOfficeId: null,
      payload: { test: true },
      cityId: randomUUID(),
      ...overrides,
    };
    await writeService.writeEvent(input);
  }

  afterAll(async () => {
    // No cleanup needed — batac_audit role cannot DELETE; test rows remain in DB
    // and are isolated by unique actorIds.
  });

  // ─── Test 1: Three correctly linked events return 'intact' ─────────────────

  it('queryEvents({}) on three correctly linked events returns chainValidationStatus: intact', async () => {
    const actorId = randomUUID();
    // Write 3 events sequentially so they are correctly chained
    await writeEvent({ actorId, eventType: 'test.chain.a' });
    await writeEvent({ actorId, eventType: 'test.chain.b' });
    await writeEvent({ actorId, eventType: 'test.chain.c' });

    const result = await queryService.queryEvents({ actorId });

    expect(result.chainValidationStatus).toBe('intact');
    expect(result.events).toHaveLength(3);
    expect(result.events.map((e) => e.eventType)).toEqual([
      'test.chain.a',
      'test.chain.b',
      'test.chain.c',
    ]);
  });

  // ─── Test 2: Tampered chain_hash returns 'broken' ──────────────────────────

  it('tampered chain_hash causes chainValidationStatus: broken', async () => {
    if (!migrateDb) {
      console.warn('Skipping: DATABASE_URL_MIGRATE not set; cannot tamper with chain_hash');
      return;
    }

    const actorId = randomUUID();
    await writeEvent({ actorId, eventType: 'test.tamper.hash' });

    // Directly UPDATE a row's chain_hash using a privileged role (simulating DB-level tampering)
    await migrateDb.execute(
      sql`UPDATE audit.events SET chain_hash = ${'a'.repeat(64)} WHERE actor_id = ${actorId}`,
    );

    const result = await queryService.queryEvents({ actorId });

    expect(result.chainValidationStatus).toBe('broken');
  });

  // ─── Test 3: Tampered hmac returns 'broken' ────────────────────────────────

  it('tampered hmac causes chainValidationStatus: broken', async () => {
    if (!migrateDb) {
      console.warn('Skipping: DATABASE_URL_MIGRATE not set; cannot tamper with hmac');
      return;
    }

    const actorId = randomUUID();
    await writeEvent({ actorId, eventType: 'test.tamper.hmac' });

    // Directly UPDATE the hmac using a privileged role
    await migrateDb.execute(
      sql`UPDATE audit.events SET hmac = ${'b'.repeat(64)} WHERE actor_id = ${actorId}`,
    );

    const result = await queryService.queryEvents({ actorId });

    expect(result.chainValidationStatus).toBe('broken');
  });

  // ─── Test 4: actorId filter ────────────────────────────────────────────────

  it('queryEvents({ actorId }) returns only rows for that actor', async () => {
    const actorA = randomUUID();
    const actorB = randomUUID();

    await writeEvent({ actorId: actorA, eventType: 'test.filter.actor' });
    await writeEvent({ actorId: actorB, eventType: 'test.filter.actor' });
    await writeEvent({ actorId: actorA, eventType: 'test.filter.actor' });

    const result = await queryService.queryEvents({ actorId: actorA });

    expect(result.events.length).toBe(2);
    for (const ev of result.events) {
      expect(ev.actorId).toBe(actorA);
    }
  });

  // ─── Test 5: Cursor pagination ─────────────────────────────────────────────

  it('cursor pagination: pageSize=2 returns 2 events and nextCursor; following cursor returns remaining', async () => {
    const actorId = randomUUID();
    await writeEvent({ actorId, eventType: 'test.page.1' });
    await writeEvent({ actorId, eventType: 'test.page.2' });
    await writeEvent({ actorId, eventType: 'test.page.3' });

    // First page
    const page1 = await queryService.queryEvents({ actorId, pageSize: 2 });

    expect(page1.events).toHaveLength(2);
    expect(page1.nextCursor).toBeDefined();

    // Second page using cursor
    const page2 = await queryService.queryEvents({
      actorId,
      pageSize: 2,
      cursor: page1.nextCursor!,
    });

    expect(page2.events).toHaveLength(1);
    expect(page2.nextCursor).toBeUndefined();

    // All 3 unique events are returned across both pages
    const allTypes = [...page1.events, ...page2.events].map((e) => e.eventType);
    expect(allTypes).toContain('test.page.1');
    expect(allTypes).toContain('test.page.2');
    expect(allTypes).toContain('test.page.3');
  });

  // ─── Test 6: AUDIT_CHAIN_VERIFY_ON_READ = false ────────────────────────────

  it('AUDIT_CHAIN_VERIFY_ON_READ=false returns intact unconditionally even for tampered rows', async () => {
    if (!migrateDb) {
      console.warn('Skipping: DATABASE_URL_MIGRATE not set; cannot tamper with chain_hash');
      return;
    }

    const actorId = randomUUID();
    await writeEvent({ actorId, eventType: 'test.bypass.verify' });

    // Tamper with chain_hash using privileged role
    await migrateDb.execute(
      sql`UPDATE audit.events SET chain_hash = ${'c'.repeat(64)} WHERE actor_id = ${actorId}`,
    );

    const bypassQueryService = new AuditQueryService(repo, {
      AUDIT_HMAC_SECRET: HMAC_SECRET,
      AUDIT_CHAIN_VERIFY_ON_READ: false,
    });

    const result = await bypassQueryService.queryEvents({ actorId });

    // Should be 'intact' unconditionally even though data is tampered
    expect(result.chainValidationStatus).toBe('intact');
    expect(result.events).toHaveLength(1);
  });
});
