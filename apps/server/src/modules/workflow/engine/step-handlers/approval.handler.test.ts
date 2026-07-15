import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitStepApproval, type ApprovalHandlerDeps } from './approval.handler.js';
import type { InstanceRow, StepInstanceRow } from '../types.js';

vi.mock('../step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Approval Step Handler', () => {
  let mockDeps: any;
  let mockInstance: any;
  let mockStepInstance: any;

  beforeEach(() => {
    mockDeps = {
      workflowRepository: {
        getDefinitionVersionWithSteps: vi.fn(),
        updateStepInstance: vi.fn(),
        createWorkflowEvent: vi.fn(),
        getStepInstanceById: vi.fn(),
      },
      // Missing required step-resolution deps but we mock resolveNextStep anyway so they are unused here except as pass-through
    };

    mockInstance = {
      id: 'inst-1',
      definitionVersionId: 'ver-1',
      context: { created_by: 'user-encoder', veto_override_vote_count: 0 },
    };

    mockStepInstance = {
      id: 'step-inst-1',
      stepId: 'step-1',
      status: 'active',
      assignedTo: [{ user_id: 'user-approver' }],
    };
  });

  const setupMockDefinition = (config: Record<string, any>) => {
    mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
      steps: [{ id: 'step-1', stepType: 'approval', config }],
    });
    mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(mockStepInstance);
  };

  it('throws VALIDATION_FAILED if outcome not in allowed_outcomes', async () => {
    setupMockDefinition({ allowed_outcomes: ['APPROVED', 'REJECTED'] });

    await expect(
      submitStepApproval(
        mockInstance,
        mockStepInstance,
        'user-approver',
        'user',
        'UNKNOWN_OUTCOME',
        'comment',
        mockDeps,
      ),
    ).rejects.toThrow('VALIDATION_FAILED: outcome not allowed');
  });

  it('K2 RES-I10: LAPSED submitted with actor_type = user throws FORBIDDEN', async () => {
    setupMockDefinition({ allowed_outcomes: ['APPROVED', 'REJECTED', 'LAPSED'] });

    try {
      await submitStepApproval(
        mockInstance,
        mockStepInstance,
        'user-approver',
        'user',
        'LAPSED',
        'comment',
        mockDeps,
      );
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.message).toContain('FORBIDDEN');
      expect(e.cause).toBe('LAPSED_IS_SCHEDULER_ONLY');
    }
  });

  it('K2 RES-I11: DEEMED_APPROVED submitted with actor_type = user throws FORBIDDEN', async () => {
    setupMockDefinition({ allowed_outcomes: ['APPROVED', 'REJECTED', 'DEEMED_APPROVED'] });

    try {
      await submitStepApproval(
        mockInstance,
        mockStepInstance,
        'user-approver',
        'user',
        'DEEMED_APPROVED',
        'comment',
        mockDeps,
      );
      expect.fail('Should have thrown');
    } catch (e: any) {
      expect(e.message).toContain('FORBIDDEN');
      expect(e.cause).toBe('DEEMED_APPROVED_IS_SCHEDULER_ONLY');
    }
  });

  it('K2 RES-I12: OVERRIDE_SUCCEEDED with veto_override_vote_count < 8 throws', async () => {
    setupMockDefinition({ allowed_outcomes: ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED'] });
    mockInstance.context.veto_override_vote_count = 7;

    await expect(
      submitStepApproval(
        mockInstance,
        mockStepInstance,
        'user-approver',
        'user',
        'OVERRIDE_SUCCEEDED',
        null,
        mockDeps,
      ),
    ).rejects.toThrow('VALIDATION_FAILED: insufficient votes for override');
  });

  it('K2 RES-I13: OVERRIDE_FAILED with veto_override_vote_count >= 8 throws', async () => {
    setupMockDefinition({ allowed_outcomes: ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED'] });
    mockInstance.context.veto_override_vote_count = 8;

    await expect(
      submitStepApproval(
        mockInstance,
        mockStepInstance,
        'user-approver',
        'user',
        'OVERRIDE_FAILED',
        null,
        mockDeps,
      ),
    ).rejects.toThrow('VALIDATION_FAILED: override failed but vote count is >= 8');
  });

  it('K2 INV11-01a: vp_certification with is_final_approval = true and actorId === encoder throws', async () => {
    setupMockDefinition({ allowed_outcomes: ['APPROVED'], is_final_approval: true });

    // Assign encoder to the step to bypass role check
    mockStepInstance.assignedTo = [{ user_id: 'user-encoder' }];

    await expect(
      submitStepApproval(
        mockInstance,
        mockStepInstance,
        'user-encoder',
        'user',
        'APPROVED',
        null,
        mockDeps,
      ),
    ).rejects.toThrow('ENCODER_CANNOT_BE_FINAL_APPROVER');
  });

  it('K2 INV11-01b: is_final_approval = true and actorId !== encoder succeeds normally', async () => {
    setupMockDefinition({ allowed_outcomes: ['APPROVED'], is_final_approval: true });

    // Test resolveNextStep is a mocked module in a real run, but here it might throw if not mocked.
    // We mock resolveNextStep by intercepting it or just let it fail if it reaches there.
    // Actually, Vitest doesn't mock resolveNextStep by default unless we use vi.mock.
    // Let's vi.mock '../step-resolution.js'

    await submitStepApproval(
      mockInstance,
      mockStepInstance,
      'user-approver',
      'user',
      'APPROVED',
      null,
      mockDeps,
    );

    expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
      'step-inst-1',
      expect.objectContaining({ status: 'completed', outcome: 'APPROVED' }),
      undefined,
    );
  });

  it('RETURNED_FOR_REVISION outcome sets step status to Returned (NOT Completed)', async () => {
    setupMockDefinition({
      allowed_outcomes: ['APPROVED', 'RETURNED_FOR_REVISION'],
      require_comment_on: ['RETURNED_FOR_REVISION'],
    });

    await submitStepApproval(
      mockInstance,
      mockStepInstance,
      'user-approver',
      'user',
      'RETURNED_FOR_REVISION',
      'needs work',
      mockDeps,
    );

    expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
      'step-inst-1',
      expect.objectContaining({ status: 'returned', outcome: 'RETURNED_FOR_REVISION' }),
      undefined,
    );
  });
});
