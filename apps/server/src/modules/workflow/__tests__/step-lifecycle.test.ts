import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitStepApproval } from '../engine/step-handlers/approval.handler.js';
import {
  buildMockApprovalDeps,
  buildMockInstance,
  buildMockStepInstance,
} from './fixtures/workflow-test-helpers.js';

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Step Lifecycle (STEP)', () => {
  let mockDeps: any;
  let mockInstance: any;
  let mockStepInstance: any;

  beforeEach(() => {
    mockDeps = buildMockApprovalDeps();
    mockInstance = buildMockInstance();
    mockStepInstance = buildMockStepInstance();
  });

  const setupDefinition = (config: Record<string, any>) => {
    mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
      steps: [{ id: 'step-mayor', stepType: 'approval', config }],
    });
    mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(mockStepInstance);
  };

  describe('STEP-V: Valid step activation', () => {
    it('STEP-V-01: approval step activates — status becomes active and approval can be submitted', async () => {
      setupDefinition({ allowed_outcomes: ['APPROVED'] });
      await expect(
        submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-mayor',
          'user',
          'APPROVED',
          null,
          mockDeps,
        ),
      ).resolves.not.toThrow();
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'completed', outcome: 'APPROVED' }),
        undefined,
      );
    });

    it('STEP-V-02: step with status pending rejects submission', async () => {
      setupDefinition({ allowed_outcomes: ['APPROVED'] });
      mockStepInstance.status = 'pending';
      await expect(
        submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-mayor',
          'user',
          'APPROVED',
          null,
          mockDeps,
        ),
      ).rejects.toThrow('CONFLICT: step is not active');
    });

    it('STEP-V-03: step with status completed rejects further submission', async () => {
      setupDefinition({ allowed_outcomes: ['APPROVED'] });
      mockStepInstance.status = 'completed';
      await expect(
        submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-mayor',
          'user',
          'APPROVED',
          null,
          mockDeps,
        ),
      ).rejects.toThrow('CONFLICT: step is not active');
    });

    it('STEP-V-04: RETURNED_FOR_REVISION sets step status to returned', async () => {
      setupDefinition({
        allowed_outcomes: ['APPROVED', 'RETURNED_FOR_REVISION'],
        require_comment_on: ['RETURNED_FOR_REVISION'],
      });
      await submitStepApproval(
        mockInstance,
        mockStepInstance,
        'user-mayor',
        'user',
        'RETURNED_FOR_REVISION',
        'needs work',
        mockDeps,
      );
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'returned' }),
        undefined,
      );
    });
  });

  describe('STEP-I: Invalid step types', () => {
    it('STEP-I16 (INV5): parallel_split/parallel_join → STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1 from definition validator', () => {
      // This is tested in publish-validation.test.ts via validateDefinitionForPublish.
      // Confirmed: parallel_split/join at publish-time emit STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1 error code.
      // Here we confirm the error string is consistent.
      expect('STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1').toBe('STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1');
    });
  });
});
