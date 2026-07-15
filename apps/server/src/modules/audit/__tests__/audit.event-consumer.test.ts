import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { EventBus } from '@batac/shared/event-bus';
import { registerAuditEventConsumer } from '../audit.event-consumer.js';
import { AuditWriteService } from '../audit.write-service.js';
import { AuditRepository } from '../audit.repository.js';
import { createAuditDb } from '../audit.db.js';
import pino from 'pino';
import 'dotenv/config';
import { auditEvents } from '@batac/database/schema/audit.schema.js';
import { eq } from 'drizzle-orm';
import type { DomainEvent } from '@batac/shared/events/domain-event';

describe('Audit Event Consumer (Integration)', () => {
  const logger = pino({ level: 'trace' });
  const databaseUrlAudit = process.env.DATABASE_URL_AUDIT;

  if (!databaseUrlAudit) {
    console.warn('Skipping integration tests: DATABASE_URL_AUDIT is not set');
    it.skip('Skipped due to missing env var', () => {});
    return;
  }

  const auditDb = createAuditDb(databaseUrlAudit);
  const repo = new AuditRepository(auditDb);
  const env = { AUDIT_HMAC_SECRET: 'test_secret_key' };
  const writeService = new AuditWriteService(repo, env as any);

  // Stub deadLetterRepo for EventBus
  const deadLetterRepo = {
    insert: vi.fn().mockResolvedValue(undefined),
  };
  const bus = new EventBus(logger, deadLetterRepo as any);

  // Wrap writeService in AuditPublicAPI stub
  const auditApi = {
    writeEvent: (e: any) => writeService.writeEvent(e),
    queryEvents: async () => {
      throw new Error('Not implemented');
    },
  };

  beforeAll(() => {
    registerAuditEventConsumer(bus, auditApi, logger);
  });

  afterAll(async () => {
    // Cleanup pool if necessary
  });

  it('emitting a user.login event causes one row to appear in audit.events with event_type = "user.login"', async () => {
    const cityId = randomUUID();
    const eventId = randomUUID();
    const userId = randomUUID();

    const event: DomainEvent<any> = {
      eventId,
      eventType: 'user.login',
      occurredAt: new Date().toISOString(),
      cityId,
      schemaVersion: 1,
      payload: { userId },
    };

    const writeSpy = vi.spyOn(writeService, 'writeEvent');
    vi.clearAllMocks();

    bus.emit('user.login', event);

    // Wait for the async handler to complete
    await vi.waitFor(
      () => {
        if (writeSpy.mock.calls.length === 0) throw new Error('Not called yet');
      },
      { timeout: 2000 },
    );
    // Wait a bit more for the DB transaction to actually commit
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify in DB
    const results = await auditDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'user.login'));
    console.log('results for user.login:', results);
    const matched = results.filter((r) => r.actorId === userId && r.cityId === cityId);

    expect(deadLetterRepo.insert).not.toHaveBeenCalled();
    expect(matched.length).toBe(1);
    expect(matched[0]?.eventType).toBe('user.login');
    expect(matched[0]?.resourceOfficeId).toBeNull();
  });

  it('spot-check 3 event types produce corresponding rows in audit.events', async () => {
    const cityId = randomUUID();

    const docCreated: DomainEvent<any> = {
      eventId: randomUUID(),
      eventType: 'document.created',
      occurredAt: new Date().toISOString(),
      cityId,
      schemaVersion: 1,
      payload: { documentId: randomUUID(), creatorId: randomUUID(), officeId: randomUUID() },
    };

    const delGranted: DomainEvent<any> = {
      eventId: randomUUID(),
      eventType: 'delegation.granted',
      occurredAt: new Date().toISOString(),
      cityId,
      schemaVersion: 1,
      payload: { delegationId: randomUUID(), grantorId: randomUUID() },
    };

    const stepComp: DomainEvent<any> = {
      eventId: randomUUID(),
      eventType: 'workflow.step_completed',
      occurredAt: new Date().toISOString(),
      cityId,
      schemaVersion: 1,
      payload: { documentId: randomUUID(), completerId: randomUUID(), officeId: randomUUID() },
    };

    const writeSpy2 = vi.spyOn(writeService, 'writeEvent');

    bus.emit('document.created', docCreated);
    bus.emit('delegation.granted', delGranted);
    bus.emit('workflow.step_completed', stepComp);

    await vi.waitFor(
      () => {
        if (writeSpy2.mock.calls.length < 3) throw new Error('Not all called yet');
      },
      { timeout: 2000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 300));

    const resDoc = await auditDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.targetId, docCreated.payload.documentId));
    expect(resDoc.length).toBe(1);
    expect(resDoc[0]?.eventType).toBe('document.created');

    const resDel = await auditDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.targetId, delGranted.payload.delegationId));
    expect(resDel.length).toBe(1);
    expect(resDel[0]?.eventType).toBe('delegation.granted');

    const resStep = await auditDb
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.targetId, stepComp.payload.documentId));
    expect(resStep.length).toBe(1);
    expect(resStep[0]?.eventType).toBe('workflow.step_completed');
  });

  it("a handler that throws does not prevent the emitting module's call from completing", async () => {
    // Create a new bus to test isolation
    const isolatedBus = new EventBus(logger, deadLetterRepo as any);

    // Register a faulty consumer
    isolatedBus.on(
      'user.logout',
      async (envelope) => {
        throw new Error('Intentional handler failure');
      },
      'faulty-audit',
    );

    // Register a healthy consumer
    let healthyCalled = false;
    isolatedBus.on(
      'user.logout',
      (envelope) => {
        healthyCalled = true;
      },
      'healthy-module',
    );

    const event: DomainEvent<any> = {
      eventId: randomUUID(),
      eventType: 'user.logout',
      occurredAt: new Date().toISOString(),
      cityId: randomUUID(),
      schemaVersion: 1,
      payload: { userId: randomUUID() },
    };

    // Emit should not throw
    expect(() => isolatedBus.emit('user.logout', event)).not.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(healthyCalled).toBe(true);
    expect(deadLetterRepo.insert).toHaveBeenCalled();
  });
});
