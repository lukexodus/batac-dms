import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cancelInstance } from '../engine/admin-operations.js';
import {
  ValidationFailedError,
  InvalidWorkflowTransitionError,
} from '../../../errors/domain/workflow.js';
import * as StepResolution from '../engine/step-resolution.js';

describe('Admin Operations — Cancel (CANCEL)', () => {
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
        updateInstanceStatus: vi.fn(),
        cancelActiveAndPendingStepInstancesForInstance: vi.fn(),
        createWorkflowEvent: vi.fn().mockResolvedValue({ id: 'mock-event-id' }),
      },
    };

    vi.spyOn(StepResolution, 'resolveNextStep').mockResolvedValue(undefined);
  });

  describe('CANCEL-V: Valid cancel operations', () => {
    it('CANCEL-V-01 (INV10): cancels instance with reason and emits event', async () => {
      await cancelInstance('inst-1', 'admin-1', 'Testing cancel', mockDeps);

      expect(mockDeps.workflowRepository.updateInstanceStatus).toHaveBeenCalledWith(
        'inst-1',
        'cancelled',
        expect.any(Date),
        mockTrx,
      );
      expect(
        mockDeps.workflowRepository.cancelActiveAndPendingStepInstancesForInstance,
      ).toHaveBeenCalledWith('inst-1', mockTrx);
      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.instance.cancelled',
          actorType: 'user',
          actorId: 'admin-1',
          payload: expect.objectContaining({
            instance_id: 'inst-1',
            cancelled_by: 'admin-1',
            cancellation_reason: 'Testing cancel',
          }),
        }),
        mockTrx,
      );
    });
  });

  describe('CANCEL-I: Invalid cancel operations', () => {
    it('CANCEL-I-01 (INV10): empty reason throws ValidationFailedError', async () => {
      await expect(cancelInstance('inst-1', 'admin-1', '', mockDeps)).rejects.toThrow(
        ValidationFailedError,
      );
    });

    it('CANCEL-I-02 (INV10): whitespace-only reason throws ValidationFailedError', async () => {
      await expect(cancelInstance('inst-1', 'admin-1', '   ', mockDeps)).rejects.toThrow(
        'cancellation reason must not be empty',
      );
    });

    it('CANCEL-I-03 (INV6): already-terminal instance propagates InvalidWorkflowTransitionError', async () => {
      mockDeps.workflowRepository.updateInstanceStatus.mockRejectedValue(
        new InvalidWorkflowTransitionError(
          'Cannot update status of a completed workflow instance.',
        ),
      );
      await expect(cancelInstance('inst-1', 'admin-1', 'some reason', mockDeps)).rejects.toThrow(
        InvalidWorkflowTransitionError,
      );
    });
  });
});
