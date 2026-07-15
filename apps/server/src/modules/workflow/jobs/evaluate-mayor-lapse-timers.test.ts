import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateMayorLapseTimers } from './evaluate-mayor-lapse-timers.js';
import type { WorkflowRepository } from '../workflow.repository.js';
import { resolveNextStep } from '../engine/step-resolution.js';

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Mayor Lapse Timer Scheduler Job', () => {
  let mockWorkflowRepository: Partial<WorkflowRepository>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWorkflowRepository = {
      getActiveInstancesByDefinitionAndStepConfig: vi.fn(),
      getDefinitionVersionWithSteps: vi.fn(),
      runInTransaction: vi.fn(async (cb) => cb('mock-tx' as any)),
      lockStepInstanceForUpdate: vi.fn(),
      updateStepInstance: vi.fn(),
      updateInstanceContext: vi.fn(),
      createWorkflowEvent: vi.fn(),
      getInstanceById: vi.fn(),
    };
  });

  const runJob = async (now: Date) => {
    return evaluateMayorLapseTimers(
      { workflowRepository: mockWorkflowRepository as WorkflowRepository } as any,
      { now },
    );
  };

  it('MAYOR-01: 10 days elapsed, no Mayor action -> step completes LAPSED with deadline completedAt', async () => {
    const now = new Date('2023-11-20T12:00:00Z');
    const deadline = new Date('2023-11-15T12:00:00Z'); // 5 days ago (elapsed)

    (mockWorkflowRepository.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
      {
        instance: {
          id: 'inst-1',
          definitionVersionId: 'ver-1',
          context: { mayor_action_deadline: deadline.toISOString() },
        },
        stepInstance: { id: 'step-inst-1', stepId: 'step-1', outcome: null },
      },
    ]);

    (mockWorkflowRepository.getDefinitionVersionWithSteps as any).mockResolvedValue({
      steps: [{ id: 'step-1', config: { allowed_outcomes: ['APPROVED', 'VETOED', 'LAPSED'] } }],
    });

    (mockWorkflowRepository.lockStepInstanceForUpdate as any).mockResolvedValue({
      id: 'step-inst-1',
      outcome: null,
    });

    (mockWorkflowRepository.getInstanceById as any).mockResolvedValue({ id: 'inst-1' });

    await runJob(now);

    // Assert updateStepInstance has specific LAPSED outcome & exact comment & completedAt
    expect(mockWorkflowRepository.updateStepInstance).toHaveBeenCalledWith(
      'step-inst-1',
      {
        status: 'completed',
        outcome: 'LAPSED',
        outcomeComment:
          'Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47.',
        completedAt: deadline, // Crucial: NOT now
      },
      'mock-tx',
    );

    // Assert instance context updated
    expect(mockWorkflowRepository.updateInstanceContext).toHaveBeenCalledWith(
      'inst-1',
      {
        mayor_action: 'LAPSED',
        mayor_action_date: deadline.toISOString(),
      },
      'mock-tx',
    );

    // Assert event emitted
    expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
      {
        instanceId: 'inst-1',
        eventType: 'workflow.approval.lapsed',
        actorType: 'scheduler',
        actorId: null,
        payload: {
          stepInstanceId: 'step-inst-1',
          legalBasis: 'RA 7160 Section 47',
          deadlineWas: deadline.toISOString(),
        },
      },
      'mock-tx',
    );

    // Assert step resolution called
    expect(resolveNextStep).toHaveBeenCalledWith(
      { id: 'inst-1' },
      undefined, // `updatedStepInstance` mock return value (undefined because updateStepInstance mock wasn't set to return anything, which is fine for this check)
      'LAPSED',
      expect.anything(),
      'mock-tx',
    );
  });

  it('Race condition: Mayor submits between SELECT and lock -> job skips', async () => {
    const now = new Date('2023-11-20T12:00:00Z');
    const deadline = new Date('2023-11-15T12:00:00Z');

    (mockWorkflowRepository.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
      {
        instance: {
          id: 'inst-1',
          definitionVersionId: 'ver-1',
          context: { mayor_action_deadline: deadline.toISOString() },
        },
        stepInstance: { id: 'step-inst-1', stepId: 'step-1', outcome: null },
      },
    ]);

    (mockWorkflowRepository.getDefinitionVersionWithSteps as any).mockResolvedValue({
      steps: [{ id: 'step-1', config: { allowed_outcomes: ['APPROVED', 'VETOED', 'LAPSED'] } }],
    });

    // MOCK: When lock occurs, outcome is ALREADY SET to 'APPROVED' (Mayor beat the scheduler)
    (mockWorkflowRepository.lockStepInstanceForUpdate as any).mockResolvedValue({
      id: 'step-inst-1',
      outcome: 'APPROVED',
    });

    await runJob(now);

    // Assert NO updates happen
    expect(mockWorkflowRepository.updateStepInstance).not.toHaveBeenCalled();
    expect(mockWorkflowRepository.updateInstanceContext).not.toHaveBeenCalled();
    expect(mockWorkflowRepository.createWorkflowEvent).not.toHaveBeenCalled();
    expect(resolveNextStep).not.toHaveBeenCalled();
  });

  it('Ignores if now <= deadline', async () => {
    const now = new Date('2023-11-10T12:00:00Z');
    const deadline = new Date('2023-11-15T12:00:00Z'); // Future

    (mockWorkflowRepository.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
      {
        instance: {
          id: 'inst-1',
          definitionVersionId: 'ver-1',
          context: { mayor_action_deadline: deadline.toISOString() },
        },
        stepInstance: { id: 'step-inst-1', stepId: 'step-1', outcome: null },
      },
    ]);

    (mockWorkflowRepository.getDefinitionVersionWithSteps as any).mockResolvedValue({
      steps: [{ id: 'step-1', config: { allowed_outcomes: ['APPROVED', 'VETOED', 'LAPSED'] } }],
    });

    await runJob(now);

    expect(mockWorkflowRepository.runInTransaction).not.toHaveBeenCalled();
  });
});
