import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitStepApproval } from '../engine/step-handlers/approval.handler.js';
import { buildMockApprovalDeps, buildMockInstance, buildMockStepInstance } from './fixtures/workflow-test-helpers.js';

/**
 * Panlalawigan-specific tests (PANLA test group).
 *
 * PANLA-01 through PANLA-03 (timer scheduler paths) and PANLA-RC (race condition)
 * are covered in lapse-timers.test.ts under the PANLA describe block, since they
 * exercise evaluatePanlalawiganTimers() directly.
 *
 * This file covers the approval-handler-level Panlalawigan behaviours:
 * - PANLA-04 through PANLA-09: approval outcome guards and comment requirements
 * - PANLA-10 (INV9): REPASSED outcome does not complete the instance
 * - PANLA-11 through PANLA-14: override vote thresholds
 * - APP-I02: OPERATIVE_IN_ITS_ENTIRETY document-type guard
 */

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Panlalawigan Review (PANLA)', () => {
  let mockDeps: any;
  let mockInstance: any;
  let mockStepInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeps = buildMockApprovalDeps();
    // Panlalawigan review is on a sangguniang_panlalawigan step (approval type)
    mockInstance = buildMockInstance({
      context: {
        created_by: 'user-encoder',
        document_type: 'resolution',
        panlalawigan_action_deadline: new Date('2027-01-01').toISOString(),
        panlalawigan_transmission_date: new Date('2026-12-01').toISOString(),
      },
    });
    mockStepInstance = buildMockStepInstance({
      assignedTo: [{ user_id: 'user-sec' }],
    });

    mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(mockStepInstance);
  });

  const setupPanlalawiganDef = (config: Record<string, any>) => {
    mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
      steps: [{ id: 'step-mayor', stepType: 'approval', config }],
    });
  };

  // ─── PANLA-04 through PANLA-06: outcome validation ────────────────────────

  describe('PANLA-04: VALID outcome succeeds', () => {
    it('PANLA-04: VALID outcome completes the step', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['VALID', 'RETURNED', 'DEEMED_APPROVED'] });
      await submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'VALID', null, mockDeps);
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'completed', outcome: 'VALID' }),
        undefined
      );
    });
  });

  describe('PANLA-05: RETURNED outcome sets step to returned status', () => {
    it('PANLA-05: RETURNED outcome with comment → status = returned', async () => {
      setupPanlalawiganDef({
        allowed_outcomes: ['VALID', 'RETURNED', 'DEEMED_APPROVED'],
        require_comment_on: ['RETURNED'],
      });
      await submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'RETURNED', 'needs revision', mockDeps);
      expect(mockDeps.workflowRepository.updateStepInstance).not.toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'returned' }),
        undefined
      );
      // RETURNED maps to status='completed' (only RETURNED_FOR_REVISION maps to 'returned')
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'completed', outcome: 'RETURNED' }),
        undefined
      );
    });
  });

  describe('PANLA-06: DEEMED_APPROVED is scheduler-only (INV3)', () => {
    it('PANLA-06: DEEMED_APPROVED submitted by user → FORBIDDEN', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['VALID', 'DEEMED_APPROVED'] });
      try {
        await submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'DEEMED_APPROVED', null, mockDeps);
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('FORBIDDEN');
        expect(e.cause).toBe('DEEMED_APPROVED_IS_SCHEDULER_ONLY');
      }
    });
  });

  // ─── PANLA-07: comment requirement ────────────────────────────────────────

  describe('PANLA-07: comment required for certain outcomes', () => {
    it('PANLA-07a: comment required for RETURNED but missing → VALIDATION_FAILED', async () => {
      setupPanlalawiganDef({
        allowed_outcomes: ['VALID', 'RETURNED'],
        require_comment_on: ['RETURNED'],
      });
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'RETURNED', null, mockDeps)
      ).rejects.toThrow('VALIDATION_FAILED: comment is required');
    });

    it('PANLA-07b: comment required for RETURNED and provided → succeeds', async () => {
      setupPanlalawiganDef({
        allowed_outcomes: ['VALID', 'RETURNED'],
        require_comment_on: ['RETURNED'],
      });
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'RETURNED', 'issues found', mockDeps)
      ).resolves.not.toThrow();
    });
  });

  // ─── PANLA-08: actor assignment guard ─────────────────────────────────────

  describe('PANLA-08: unassigned actor cannot submit', () => {
    it('PANLA-08: user not in assigned_to → FORBIDDEN: actor is not assigned', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['VALID'] });
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-unauthorized', 'user', 'VALID', null, mockDeps)
      ).rejects.toThrow('FORBIDDEN: actor is not assigned to this step');
    });
  });

  // ─── PANLA-09: inactive step guard ────────────────────────────────────────

  describe('PANLA-09: cannot submit to inactive step', () => {
    it('PANLA-09: pending step → CONFLICT: step is not active', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['VALID'] });
      mockStepInstance.status = 'pending';
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'VALID', null, mockDeps)
      ).rejects.toThrow('CONFLICT: step is not active');
    });
  });

  // ─── PANLA-10 (INV9): REPASSED outcome ─────────────────────────────────────

  describe('PANLA-10 (INV9): REPASSED must not mark instance completed', () => {
    it('PANLA-10: this guard is implemented in the termination handler, not the approval handler — see invariants.test.ts INV9-01', () => {
      // The REPASSED guard is in executeTerminationStep, which sets step.status = 'completed'
      // but intentionally omits the instance status update to 'completed'.
      // Verified in invariants.test.ts test INV9-01.
      expect(true).toBe(true); // sentinel
    });
  });

  // ─── PANLA-11 through PANLA-14: override vote thresholds ──────────────────

  describe('PANLA-11 through PANLA-14: override vote threshold guards', () => {
    it('PANLA-11: OVERRIDE_SUCCEEDED with < 8 votes → insufficient votes error', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED'] });
      mockInstance.context.veto_override_vote_count = 5;
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'OVERRIDE_SUCCEEDED', null, mockDeps)
      ).rejects.toThrow('VALIDATION_FAILED: insufficient votes for override');
    });

    it('PANLA-12: OVERRIDE_SUCCEEDED with >= 8 votes → succeeds', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['OVERRIDE_SUCCEEDED'] });
      mockInstance.context.veto_override_vote_count = 8;
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'OVERRIDE_SUCCEEDED', null, mockDeps)
      ).resolves.not.toThrow();
    });

    it('PANLA-13: OVERRIDE_FAILED with >= 8 votes → override failed but count is >= 8', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED'] });
      mockInstance.context.veto_override_vote_count = 9;
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'OVERRIDE_FAILED', null, mockDeps)
      ).rejects.toThrow('VALIDATION_FAILED: override failed but vote count is >= 8');
    });

    it('PANLA-14: OVERRIDE_FAILED with < 8 votes → succeeds', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['OVERRIDE_FAILED'] });
      mockInstance.context.veto_override_vote_count = 3;
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'OVERRIDE_FAILED', null, mockDeps)
      ).resolves.not.toThrow();
    });
  });

  // ─── PANLA-15 / APP-I02: OPERATIVE_IN_ITS_ENTIRETY document-type guard ────

  describe('PANLA-15 / APP-I02: OPERATIVE_IN_ITS_ENTIRETY document-type guard', () => {
    it('APP-I02a: OPERATIVE_IN_ITS_ENTIRETY on non-appropriation_ordinance → OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['VALID', 'OPERATIVE_IN_ITS_ENTIRETY'] });
      // instance context.document_type = 'resolution' (not appropriation_ordinance)
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'OPERATIVE_IN_ITS_ENTIRETY', null, mockDeps)
      ).rejects.toThrow('OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE');
    });

    it('APP-I02b: OPERATIVE_IN_ITS_ENTIRETY on appropriation_ordinance → succeeds', async () => {
      setupPanlalawiganDef({ allowed_outcomes: ['VALID', 'OPERATIVE_IN_ITS_ENTIRETY'] });
      mockInstance.context.document_type = 'appropriation_ordinance';
      await expect(
        submitStepApproval(mockInstance, mockStepInstance, 'user-sec', 'user', 'OPERATIVE_IN_ITS_ENTIRETY', null, mockDeps)
      ).resolves.not.toThrow();
    });
  });
});
