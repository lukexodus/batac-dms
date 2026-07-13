import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import type PgBoss from 'pg-boss';
import 'dotenv/config';
import { createAuditDb } from '../audit.db.js';
import { AuditRepository } from '../audit.repository.js';
import { AuditWriteService } from '../audit.write-service.js';
import { registerTsaExportJob } from '../audit.tsa-export.js';
import { auditEvents } from '@batac/database/schema/audit.schema.js';
import { eq, desc } from 'drizzle-orm';
import { createHash } from 'node:crypto';

describe('TSA Export Job (Integration)', () => {
  const databaseUrlAudit = process.env.DATABASE_URL_AUDIT;

  if (!databaseUrlAudit) {
    console.warn('Skipping integration tests: DATABASE_URL_AUDIT is not set');
    it.skip('Skipped due to missing env var', () => {});
    return;
  }

  const auditDb = createAuditDb(databaseUrlAudit);
  const repo = new AuditRepository(auditDb);
  const env = { 
    AUDIT_HMAC_SECRET: 'test_secret_key',
    AUDIT_CHAIN_VERIFY_ON_READ: false,
    AUDIT_TSA_ENABLED: false,
    AUDIT_EXPORT_ENABLED: true,
    CITY_ID: '00000000-0000-4000-8000-000000000001',
  };
  const writeService = new AuditWriteService(repo, env as any);

  it('compiles snapshot, hashes it, logs digest, inserts audit_log_exported row, and exits with no network call', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn');
    
    const bossMock = {
      createQueue: vi.fn().mockResolvedValue(undefined),
      schedule: vi.fn().mockResolvedValue(undefined),
      work: vi.fn().mockImplementation(async (name, handler) => {
        // immediately invoke the handler for testing
        await handler();
      }),
    } as unknown as PgBoss;

    // Capture the state before export to compute our expected hash
    const snapshotJson = await repo.compileMonthlySnapshot();
    const expectedDigest = createHash('sha256').update(snapshotJson).digest('hex');

    await registerTsaExportJob({
      boss: bossMock,
      repo,
      writeService,
      env: env as any,
    });

    expect(bossMock.schedule).toHaveBeenCalledWith('audit:monthly-tsa-export', '0 0 1 * *', {}, { tz: 'UTC' });
    expect(bossMock.work).toHaveBeenCalledWith('audit:monthly-tsa-export', expect.any(Function));

    // Verify DB
    const results = await auditDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'audit_log_exported'))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(1);

    expect(results.length).toBe(1);
    const row = results[0];
    
    expect(row.payload.snapshotDigest).toBe(expectedDigest);
    expect(row.payload.snapshotDigest).toHaveLength(64);
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[audit:tsa] TSA submission skipped'),
      expectedDigest
    );
  });
});
