import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluatePanlalawiganTimers } from './evaluate-panlalawigan-timers.js';
import type { WorkflowRepository } from '../workflow.repository.js';
import { resolveNextStep } from '../engine/step-resolution.js';

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Panlalawigan Timer Scheduler Job', () => {
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
    return evaluatePanlalawiganTimers(
      { workflowRepository: mockWorkflowRepository as WorkflowRepository } as any,
      { now },
    );
  };

  it('PANLA-01: 30 days elapsed -> step completes DEEMED_APPROVED with deadline completedAt', async () => {
    const now = new Date('2023-11-20T12:00:00Z');
    const deadline = new Date('2023-11-15T12:00:00Z'); // 5 days ago (elapsed)
    const transmissionDate = new Date('2023-10-15T12:00:00Z');

    (mockWorkflowRepository.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
      {
        instance: {
          id: 'inst-1',
          definitionVersionId: 'ver-1',
          context: {
            panlalawigan_action_deadline: deadline.toISOString(),
            panlalawigan_transmission_date: transmissionDate.toISOString(),
          },
        },
        stepInstance: { id: 'step-inst-1', stepId: 'step-1', outcome: null },
      },
    ]);

    (mockWorkflowRepository.getDefinitionVersionWithSteps as any).mockResolvedValue({
      steps: [{ id: 'step-1', config: { allowed_outcomes: ['VALID', 'DEEMED_APPROVED'] } }],
    });

    (mockWorkflowRepository.lockStepInstanceForUpdate as any).mockResolvedValue({
      id: 'step-inst-1',
      outcome: null,
    });

    (mockWorkflowRepository.getInstanceById as any).mockResolvedValue({ id: 'inst-1' });

    await runJob(now);

    // Assert updateStepInstance has specific DEEMED_APPROVED outcome & exact comment & completedAt
    expect(mockWorkflowRepository.updateStepInstance).toHaveBeenCalledWith(
      'step-inst-1',
      {
        status: 'completed',
        outcome: 'DEEMED_APPROVED',
        outcomeComment:
          'Deemed approved per RA 7160 Section 56(d) — 30 calendar days elapsed with no action from the Sangguniang Panlalawigan.',
        completedAt: deadline, // Crucial: NOT now
      },
      'mock-tx',
    );

    // Assert instance context updated
    expect(mockWorkflowRepository.updateInstanceContext).toHaveBeenCalledWith(
      'inst-1',
      {
        panlalawigan_outcome: 'DEEMED_APPROVED',
        panlalawigan_response_date: deadline.toISOString(),
      },
      'mock-tx',
    );

    // Assert event emitted
    expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
      {
        instanceId: 'inst-1',
        eventType: 'workflow.panlalawigan.deemed_approved',
        actorType: 'scheduler',
        actorId: null,
        payload: {
          stepInstanceId: 'step-inst-1',
          legalBasis: 'RA 7160 Section 56(d)',
          transmissionDate: transmissionDate.toISOString(),
          deadlineWas: deadline.toISOString(),
        },
      },
      'mock-tx',
    );

    // Assert step resolution called
    expect(resolveNextStep).toHaveBeenCalledWith(
      { id: 'inst-1' },
      undefined,
      'DEEMED_APPROVED',
      expect.anything(),
      'mock-tx',
    );
  });

  it('Race condition: Secretariat submits between SELECT and lock -> job skips', async () => {
    const now = new Date('2023-11-20T12:00:00Z');
    const deadline = new Date('2023-11-15T12:00:00Z');

    (mockWorkflowRepository.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
      {
        instance: {
          id: 'inst-1',
          definitionVersionId: 'ver-1',
          context: { panlalawigan_action_deadline: deadline.toISOString() },
        },
        stepInstance: { id: 'step-inst-1', stepId: 'step-1', outcome: null },
      },
    ]);

    (mockWorkflowRepository.getDefinitionVersionWithSteps as any).mockResolvedValue({
      steps: [{ id: 'step-1', config: { allowed_outcomes: ['VALID', 'DEEMED_APPROVED'] } }],
    });

    // MOCK: When lock occurs, outcome is ALREADY SET to 'VALID' (Secretariat beat the scheduler)
    (mockWorkflowRepository.lockStepInstanceForUpdate as any).mockResolvedValue({
      id: 'step-inst-1',
      outcome: 'VALID',
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
          context: { panlalawigan_action_deadline: deadline.toISOString() },
        },
        stepInstance: { id: 'step-inst-1', stepId: 'step-1', outcome: null },
      },
    ]);

    (mockWorkflowRepository.getDefinitionVersionWithSteps as any).mockResolvedValue({
      steps: [{ id: 'step-1', config: { allowed_outcomes: ['VALID', 'DEEMED_APPROVED'] } }],
    });

    await runJob(now);

    expect(mockWorkflowRepository.runInTransaction).not.toHaveBeenCalled();
  });
});
