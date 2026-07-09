import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateSlaBreaches } from './evaluate-sla-breaches.js';
import type { WorkflowRepository } from '../workflow.repository.js';

describe('SLA Escalation Monitor Job', () => {
  let mockWorkflowRepository: Partial<WorkflowRepository>;
  let mockEventBus: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWorkflowRepository = {
      getActiveInstancesByDefinitionAndStepConfig: vi.fn().mockResolvedValue([]),
      getActiveInstancesWithSla: vi.fn().mockResolvedValue([]),
      runInTransaction: vi.fn(async (cb) => cb('mock-tx' as any)),
      lockStepInstanceForUpdate: vi.fn(),
      lockInstanceForUpdate: vi.fn(),
      updateStepInstance: vi.fn(),
      updateInstance: vi.fn(),
      createWorkflowEvent: vi.fn(),
    };

    mockEventBus = {
      emit: vi.fn(),
    };
  });

  const runJob = async (now: Date) => {
    return evaluateSlaBreaches(
      { 
        workflowRepository: mockWorkflowRepository as WorkflowRepository,
        eventBus: mockEventBus
      },
      { now }
    );
  };

  it('80% threshold -> emit workflow.sla.warning at most once', async () => {
    const startedAt = new Date('2023-11-01T12:00:00Z');
    const deadline = new Date('2023-11-11T12:00:00Z'); // 10 days
    const now = new Date('2023-11-09T12:00:00Z'); // 8 days elapsed (80%)

    (mockWorkflowRepository.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
      {
        instance: { id: 'inst-1', cityId: 'city-1' },
        stepInstance: { id: 'step-inst-1', startedAt, slaDeadline: deadline, metadata: {} }
      }
    ]);

    (mockWorkflowRepository.lockStepInstanceForUpdate as any).mockResolvedValue({
      id: 'step-inst-1', slaBreachedAt: null, metadata: {}
    });

    await runJob(now);

    expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'workflow.sla.warning',
      payload: expect.objectContaining({ percentElapsed: 80 })
    }), 'mock-tx');

    expect(mockEventBus.emit).toHaveBeenCalledWith('workflow.sla.warning', expect.objectContaining({
      cityId: 'city-1',
      payload: expect.objectContaining({ percentElapsed: 80, stepInstanceId: 'step-inst-1' })
    }));

    expect(mockWorkflowRepository.updateStepInstance).toHaveBeenCalledWith('step-inst-1', expect.objectContaining({
      metadata: { sla_warning_sent_at: now.toISOString() }
    }), 'mock-tx');
  });

  it('100% threshold -> set slaBreachedAt = deadline and emit breached', async () => {
    const startedAt = new Date('2023-11-01T12:00:00Z');
    const deadline = new Date('2023-11-11T12:00:00Z'); // 10 days
    const now = new Date('2023-11-15T12:00:00Z'); // 14 days elapsed (>100%)

    (mockWorkflowRepository.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
      {
        instance: { id: 'inst-1', cityId: 'city-1' },
        stepInstance: { id: 'step-inst-1', startedAt, slaDeadline: deadline, metadata: {} }
      }
    ]);

    (mockWorkflowRepository.lockStepInstanceForUpdate as any).mockResolvedValue({
      id: 'step-inst-1', slaBreachedAt: null, metadata: {}
    });

    await runJob(now);

    expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'workflow.sla.breached',
      payload: expect.objectContaining({ 
        breachDetectedAt: now.toISOString(),
        breachedAt: deadline.toISOString()
      })
    }), 'mock-tx');

    expect(mockEventBus.emit).toHaveBeenCalledWith('workflow.sla.breached', expect.objectContaining({
      cityId: 'city-1',
      payload: expect.objectContaining({
        breachDetectedAt: now.toISOString(),
        breachedAt: deadline.toISOString(),
        stepInstanceId: 'step-inst-1'
      })
    }));

    expect(mockWorkflowRepository.updateStepInstance).toHaveBeenCalledWith('step-inst-1', expect.objectContaining({
      slaBreachedAt: deadline
    }), 'mock-tx');
  });

  it('150% threshold -> emit critical', async () => {
    const startedAt = new Date('2023-11-01T12:00:00Z');
    const deadline = new Date('2023-11-11T12:00:00Z'); // 10 days
    const now = new Date('2023-11-16T12:00:00Z'); // 15 days elapsed (150%)

    (mockWorkflowRepository.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
      {
        instance: { id: 'inst-1', cityId: 'city-1' },
        stepInstance: { id: 'step-inst-1', startedAt, slaDeadline: deadline, metadata: { sla_warning_sent_at: '2023-11-09T12:00:00Z' }, slaBreachedAt: deadline }
      }
    ]);

    (mockWorkflowRepository.lockStepInstanceForUpdate as any).mockResolvedValue({
      id: 'step-inst-1', slaBreachedAt: deadline, metadata: { sla_warning_sent_at: '2023-11-09T12:00:00Z' }
    });

    await runJob(now);

    expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'workflow.sla.critical',
    }), 'mock-tx');

    expect(mockEventBus.emit).toHaveBeenCalledWith('workflow.sla.critical', expect.objectContaining({
      cityId: 'city-1',
      payload: expect.objectContaining({
        stepInstanceId: 'step-inst-1',
        slaDeadline: deadline.toISOString()
      })
    }));

    expect(mockWorkflowRepository.updateStepInstance).toHaveBeenCalledWith('step-inst-1', expect.objectContaining({
      metadata: expect.objectContaining({ sla_critical_sent_at: now.toISOString() })
    }), 'mock-tx');
  });

  describe('Instance-level SLA', () => {
    it('80% threshold -> emit workflow.instance.sla.warning at most once', async () => {
      const startedAt = new Date('2023-11-01T12:00:00Z');
      const deadline = new Date('2023-11-11T12:00:00Z'); // 10 days
      const now = new Date('2023-11-09T12:00:00Z'); // 8 days elapsed (80%)

      (mockWorkflowRepository.getActiveInstancesWithSla as any).mockResolvedValue([
        { id: 'inst-1', cityId: 'city-1', startedAt, slaDeadline: deadline, slaWarningSentAt: null }
      ]);

      (mockWorkflowRepository.lockInstanceForUpdate as any).mockResolvedValue({
        id: 'inst-1', cityId: 'city-1', startedAt, slaDeadline: deadline, slaWarningSentAt: null
      });

      await runJob(now);

      expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(expect.objectContaining({
        instanceId: 'inst-1',
        eventType: 'workflow.instance.sla.warning',
        payload: expect.objectContaining({ percentElapsed: 80 })
      }), 'mock-tx');

      expect(mockEventBus.emit).toHaveBeenCalledWith('workflow.instance.sla.warning', expect.objectContaining({
        cityId: 'city-1',
        payload: expect.objectContaining({ percentElapsed: 80, slaDeadline: deadline.toISOString() })
      }));

      expect(mockWorkflowRepository.updateInstance).toHaveBeenCalledWith('inst-1', expect.objectContaining({
        slaWarningSentAt: now
      }), 'mock-tx');
    });

    it('100% threshold -> set slaBreachedAt = deadline and emit breached', async () => {
      const startedAt = new Date('2023-11-01T12:00:00Z');
      const deadline = new Date('2023-11-11T12:00:00Z'); // 10 days
      const now = new Date('2023-11-15T12:00:00Z'); // 14 days elapsed (>100%)

      (mockWorkflowRepository.getActiveInstancesWithSla as any).mockResolvedValue([
        { id: 'inst-1', cityId: 'city-1', startedAt, slaDeadline: deadline, slaBreachedAt: null }
      ]);

      (mockWorkflowRepository.lockInstanceForUpdate as any).mockResolvedValue({
        id: 'inst-1', cityId: 'city-1', startedAt, slaDeadline: deadline, slaBreachedAt: null
      });

      await runJob(now);

      expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(expect.objectContaining({
        instanceId: 'inst-1',
        eventType: 'workflow.instance.sla.breached',
        payload: expect.objectContaining({ 
          breachDetectedAt: now.toISOString(),
          breachedAt: deadline.toISOString()
        })
      }), 'mock-tx');

      expect(mockEventBus.emit).toHaveBeenCalledWith('workflow.instance.sla.breached', expect.objectContaining({
        cityId: 'city-1',
        payload: expect.objectContaining({
          breachDetectedAt: now.toISOString(),
          breachedAt: deadline.toISOString()
        })
      }));

      expect(mockWorkflowRepository.updateInstance).toHaveBeenCalledWith('inst-1', expect.objectContaining({
        slaBreachedAt: deadline
      }), 'mock-tx');
    });

    it('150% threshold -> emit critical', async () => {
      const startedAt = new Date('2023-11-01T12:00:00Z');
      const deadline = new Date('2023-11-11T12:00:00Z'); // 10 days
      const now = new Date('2023-11-16T12:00:00Z'); // 15 days elapsed (150%)

      (mockWorkflowRepository.getActiveInstancesWithSla as any).mockResolvedValue([
        { id: 'inst-1', cityId: 'city-1', startedAt, slaDeadline: deadline, slaWarningSentAt: new Date('2023-11-09T12:00:00Z'), slaCriticalSentAt: null, slaBreachedAt: deadline }
      ]);

      (mockWorkflowRepository.lockInstanceForUpdate as any).mockResolvedValue({
        id: 'inst-1', cityId: 'city-1', startedAt, slaDeadline: deadline, slaWarningSentAt: new Date('2023-11-09T12:00:00Z'), slaCriticalSentAt: null, slaBreachedAt: deadline
      });

      await runJob(now);

      expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(expect.objectContaining({
        instanceId: 'inst-1',
        eventType: 'workflow.instance.sla.critical',
      }), 'mock-tx');

      expect(mockEventBus.emit).toHaveBeenCalledWith('workflow.instance.sla.critical', expect.objectContaining({
        cityId: 'city-1',
        payload: expect.objectContaining({
          slaDeadline: deadline.toISOString()
        })
      }));

      expect(mockWorkflowRepository.updateInstance).toHaveBeenCalledWith('inst-1', expect.objectContaining({
        slaCriticalSentAt: now
      }), 'mock-tx');
    });
  });
});
