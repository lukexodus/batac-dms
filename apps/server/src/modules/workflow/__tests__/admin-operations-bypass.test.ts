import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bypassStep } from '../engine/admin-operations.js';
import {
  ValidationFailedError,
  InvalidWorkflowTransitionError,
} from '../../../errors/domain/workflow.js';
import * as StepResolution from '../engine/step-resolution.js';

describe('Admin Operations — Bypass Step (BYPASS)', () => {
  let mockDeps: any;
  let mockTrx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTrx = { _isMockTrx: true };
    const dbMock = {
      transaction: vi.fn(async (cb: any) => cb(mockTrx)),
    };

    mockDeps = {
      db: dbMock,
      workflowRepository: {
        getStepInstanceById: vi.fn(),
        getInstanceById: vi.fn(),
        updateStepInstance: vi.fn(),
        createWorkflowEvent: vi.fn().mockResolvedValue({ id: 'mock-event-id' }),
      },
    };

    vi.spyOn(StepResolution, 'resolveNextStep').mockResolvedValue(undefined);
  });

  describe('BYPASS-V: Valid bypass operations', () => {
    it('BYPASS-V-01: bypasses active step and emits workflow.step.bypassed event', async () => {
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue({
        id: 'step-1',
        status: 'active',
        instanceId: 'inst-1',
      });
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
      });
      mockDeps.workflowRepository.updateStepInstance.mockResolvedValue({
        id: 'step-1',
        status: 'bypassed',
      });

      await bypassStep(
        'step-1',
        'admin-1',
        'ADMIN_OVERRIDE',
        'Justification',
        'ADMIN_BYPASS',
        mockDeps,
      );

      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-1',
        expect.objectContaining({
          status: 'bypassed',
          bypassedBy: 'admin-1',
          bypassReason: 'ADMIN_OVERRIDE',
          outcomeComment: 'Justification',
        }),
        mockTrx,
      );
      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.step.bypassed',
          actorType: 'user',
          actorId: 'admin-1',
          payload: expect.objectContaining({
            bypassReason: 'ADMIN_OVERRIDE',
            bypassedBy: 'admin-1',
          }),
        }),
        mockTrx,
      );
      expect(StepResolution.resolveNextStep).toHaveBeenCalledWith(
        { id: 'inst-1', status: 'active' },
        { id: 'step-1', status: 'bypassed' },
        'ADMIN_BYPASS',
        mockDeps,
        mockTrx,
      );
    });
  });

  describe('BYPASS-I: Invalid bypass operations', () => {
    it('BYPASS-I-01 (INV10): empty comment throws ValidationFailedError', async () => {
      await expect(
        bypassStep('step-1', 'admin-1', 'reason', '', 'OUTCOME', mockDeps),
      ).rejects.toThrow(ValidationFailedError);
    });

    it('BYPASS-I-02 (INV10): whitespace comment throws ValidationFailedError', async () => {
      await expect(
        bypassStep('step-1', 'admin-1', 'reason', '   ', 'OUTCOME', mockDeps),
      ).rejects.toThrow('bypass comment must not be empty');
    });

    it('BYPASS-I-03 (INV10): empty outcomeCode throws ValidationFailedError', async () => {
      await expect(
        bypassStep('step-1', 'admin-1', 'reason', 'comment', '', mockDeps),
      ).rejects.toThrow('bypass outcomeCode must not be empty');
    });

    it('BYPASS-I-04: non-active step throws InvalidWorkflowTransitionError', async () => {
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue({
        id: 'step-1',
        status: 'completed',
        instanceId: 'inst-1',
      });
      await expect(
        bypassStep('step-1', 'admin-1', 'reason', 'comment', 'OUTCOME', mockDeps),
      ).rejects.toThrow(InvalidWorkflowTransitionError);
    });

    it('BYPASS-I-05: step not found throws InvalidWorkflowTransitionError', async () => {
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(null);
      await expect(
        bypassStep('step-1', 'admin-1', 'reason', 'comment', 'OUTCOME', mockDeps),
      ).rejects.toThrow(InvalidWorkflowTransitionError);
    });
  });
});
