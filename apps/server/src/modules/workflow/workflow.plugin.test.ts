import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import workflowPlugin from './workflow.plugin.js';
import * as bypassHandler from './engine/certified-urgent-bypass.handler.js';
import * as createInstanceModule from './engine/create-instance.js';
import cron from 'node-cron';
import { WorkflowRepository } from './workflow.repository.js';

// Mock dependencies
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
  },
}));

vi.mock('./engine/certified-urgent-bypass.handler.js', () => ({
  processCertificationUrgencyEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./engine/create-instance.js', () => ({
  createInstance: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./jobs/evaluate-thursday-cutoffs.js', () => ({
  evaluateThursdayCutoffs: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./jobs/evaluate-mayor-lapse-timers.js', () => ({
  evaluateMayorLapseTimers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./jobs/evaluate-panlalawigan-timers.js', () => ({
  evaluatePanlalawiganTimers: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./jobs/evaluate-sla-breaches.js', () => ({
  evaluateSlaBreaches: vi.fn().mockResolvedValue(undefined),
  registerSlaMonitorJob: vi.fn(),
}));

const mockDependenciesPlugin = fp(
  async (fastify) => {
    fastify.decorate('db', {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    } as any);

    const handlers = new Map<string, Function>();

    fastify.decorate('eventBus', {
      on: vi.fn((event, handler) => {
        handlers.set(event, handler);
      }),
      emit: vi.fn((event, payload) => {
        const handler = handlers.get(event);
        if (handler) {
          return handler(payload);
        }
      }),
    } as any);

    fastify.decorate('auditService', {} as any);
    fastify.decorate('documentsService', {} as any);
    fastify.decorate('organizationService', {} as any);
    fastify.decorate('delegationService', {} as any);
    fastify.decorate('documentsEventDb', {
      db: {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      },
      close: vi.fn().mockResolvedValue(undefined),
    } as any);
    fastify.decorate('documentsEventService', {} as any);
    fastify.decorate('boss', {
      createQueue: vi.fn().mockResolvedValue(undefined),
      work: vi.fn(),
      schedule: vi.fn(),
    } as any);
  },
  { name: 'mock-deps' },
);

describe('workflow.plugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();

    fastify = Fastify({ logger: false });

    fastify.log.info = vi.fn();
    fastify.log.error = vi.fn();

    await fastify.register(mockDependenciesPlugin);

    // Register required dependency names
    await fastify.register(fp(async () => {}, { name: 'database' }));
    await fastify.register(fp(async () => {}, { name: 'event-bus' }));
    await fastify.register(fp(async () => {}, { name: 'audit' }));
    await fastify.register(fp(async () => {}, { name: 'organization' }));
    await fastify.register(fp(async () => {}, { name: 'documents' }));
    await fastify.register(fp(async () => {}, { name: 'iam' }));

    // Register the plugin
    await fastify.register(workflowPlugin);
    await fastify.ready();
  });

  it('registers successfully and sets up required decorations', () => {
    expect(fastify.hasDecorator('workflowService')).toBe(true);
    expect(fastify.hasDecorator('workflowTrpcRouter')).toBe(true);
    expect(fastify.hasDecorator('sessionTrpcRouter')).toBe(true);
  });

  it('subscribes to document.certification_urgency.logged event', async () => {
    expect(fastify.eventBus.on).toHaveBeenCalledWith(
      'document.certification_urgency.logged',
      expect.any(Function),
      'workflow',
    );

    // Trigger event
    await fastify.eventBus.emit('document.certification_urgency.logged', {
      eventId: '123',
      eventType: 'document.certification_urgency.logged',
      occurredAt: '2023-01-01T00:00:00Z',
      cityId: '1',
      schemaVersion: 1,
      payload: {
        certificationDocumentId: '1',
        associatedInstanceIds: [],
        loggedBy: '1',
        loggedAt: '1',
      },
    });

    expect(bypassHandler.processCertificationUrgencyEvent).toHaveBeenCalled();
  });

  it('subscribes to document.created event and handles gracefully', async () => {
    expect(fastify.eventBus.on).toHaveBeenCalledWith(
      'document.created',
      expect.any(Function),
      'workflow',
    );

    const repoMock = vi
      .spyOn(WorkflowRepository.prototype, 'getActiveDefinitionForDocumentType')
      .mockResolvedValue(null);

    await fastify.eventBus.emit('document.created', {
      eventId: '123',
      eventType: 'document.created',
      occurredAt: '2023-01-01T00:00:00Z',
      cityId: '1',
      schemaVersion: 1,
      payload: {
        documentTypeId: '456',
        documentId: '789',
        ownedByOfficeId: '1',
        actorId: '1',
        cityId: '1',
      },
    });

    expect(repoMock).toHaveBeenCalledWith('456');
    expect(createInstanceModule.createInstance).not.toHaveBeenCalled();
    expect(fastify.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: '789' }),
      expect.any(String),
    );
  });

  it('registers cron jobs and boss jobs', () => {
    expect(fastify.boss.schedule).toHaveBeenCalledWith(
      'evaluateMayorLapseTimers',
      '0 * * * *',
      {},
      { tz: 'Asia/Manila' },
    );
    expect(fastify.boss.schedule).toHaveBeenCalledWith(
      'evaluatePanlalawiganTimers',
      '0 6 * * *',
      {},
      { tz: 'Asia/Manila' },
    );
    expect(fastify.boss.work).toHaveBeenCalledWith(
      'evaluateMayorLapseTimers',
      expect.any(Function),
    );
    expect(fastify.boss.work).toHaveBeenCalledWith(
      'evaluatePanlalawiganTimers',
      expect.any(Function),
    );
    expect(fastify.boss.schedule).toHaveBeenCalledWith('evaluateThursdayCutoffs', '0 0 * * 4', {});
    expect(fastify.boss.work).toHaveBeenCalledWith('evaluateThursdayCutoffs', expect.any(Function));
  });
});
