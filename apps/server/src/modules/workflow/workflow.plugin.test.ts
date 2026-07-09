import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import workflowPlugin from './workflow.plugin.js';
import * as bypassHandler from './engine/certified-urgent-bypass.handler.js';
import * as createInstanceModule from './engine/create-instance.js';
import cron from 'node-cron';

// Mock dependencies
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(),
  }
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

const mockDependenciesPlugin = fp(async (fastify) => {
  fastify.decorate('db', {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  });
  
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
  });

  fastify.decorate('auditService', {});
  fastify.decorate('documentsService', {});
  fastify.decorate('organizationService', {});
  fastify.decorate('delegationService', {});
  fastify.decorate('boss', {
    work: vi.fn(),
    schedule: vi.fn(),
  });
}, { name: 'mock-deps' });

describe('workflow.plugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    fastify = Fastify({ logger: false });
    
    fastify.log.info = vi.fn();
    fastify.log.error = vi.fn();

    await fastify.register(mockDependenciesPlugin);
    
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
    expect(fastify.eventBus.on).toHaveBeenCalledWith('document.certification_urgency.logged', expect.any(Function), 'workflow');
    
    // Trigger event
    await fastify.eventBus.emit('document.certification_urgency.logged', { eventId: '123' });
    
    expect(bypassHandler.processCertificationUrgencyEvent).toHaveBeenCalled();
  });

  it('subscribes to document.created event and handles gracefully', async () => {
    expect(fastify.eventBus.on).toHaveBeenCalledWith('document.created', expect.any(Function), 'workflow');
    
    // Mock the repository to simulate NO_ACTIVE_VERSION
    const repoMock = vi.spyOn(require('./workflow.repository.js').WorkflowRepository.prototype, 'getActiveDefinitionForDocumentType')
      .mockResolvedValue(null);
      
    await fastify.eventBus.emit('document.created', { eventId: '123', payload: { documentTypeId: '456', documentId: '789' } });
    
    expect(repoMock).toHaveBeenCalledWith('456');
    expect(createInstanceModule.createInstance).not.toHaveBeenCalled();
    expect(fastify.log.info).toHaveBeenCalledWith(expect.objectContaining({ documentId: '789' }), expect.any(String));
  });

  it('registers cron jobs', () => {
    expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function), { timezone: 'Asia/Manila' });
    expect(cron.schedule).toHaveBeenCalledWith('0 6 * * *', expect.any(Function), { timezone: 'Asia/Manila' });
    expect(fastify.boss.schedule).toHaveBeenCalledWith('evaluateThursdayCutoffs', '0 0 * * 4', {});
    expect(fastify.boss.work).toHaveBeenCalledWith('evaluateThursdayCutoffs', expect.any(Function));
  });
});
