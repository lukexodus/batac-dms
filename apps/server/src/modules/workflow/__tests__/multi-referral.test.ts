import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  submitCommitteeReport,
  submitStepMultiReferral,
  updateAssignedCommittees,
} from '../engine/step-handlers/multi-referral.handler.js';
import { buildMockApprovalDeps, buildMockInstance, buildMockStepInstance } from './fixtures/workflow-test-helpers.js';

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Multi-Referral Handler (MREF)', () => {
  let mockDeps: any;
  let mockInstance: any;
  let mockStepInstance: any;

  beforeEach(() => {
    mockDeps = buildMockApprovalDeps();
    mockInstance = buildMockInstance();
    mockStepInstance = buildMockStepInstance({
      metadata: {
        assigned_committees: [
          { committee_id: 'comm-1' },
          { committee_id: 'comm-2' },
        ],
        submissions: [],
      },
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-08T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setupMultiRefDef = (config: Record<string, any> = {}) => {
    mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
      steps: [{ id: 'step-mayor', stepType: 'multi_referral', config }],
    });
    mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(mockStepInstance);
  };

  describe('submitCommitteeReport', () => {
    it('MREF-01 prep: appends submission and emits committee_submitted event', async () => {
      setupMultiRefDef();
      await submitCommitteeReport(mockInstance, mockStepInstance, 'comm-1', 'user-1', 'doc-1', mockDeps);
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            submissions: [expect.objectContaining({ committee_id: 'comm-1', missed: false })],
          }),
        }),
        undefined
      );
      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'workflow.multi_referral.committee_submitted' }),
        undefined
      );
    });

    it('MREF-02: step stays active until REPORT_ACCEPTED (all submitted but not yet accepted)', async () => {
      setupMultiRefDef();
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
      ];
      await submitCommitteeReport(mockInstance, mockStepInstance, 'comm-2', 'user-2', 'doc-2', mockDeps);
      const calls = mockDeps.workflowRepository.updateStepInstance.mock.calls;
      const completedCalls = calls.filter((c: any) => c[1].status === 'completed');
      expect(completedCalls.length).toBe(0);
    });

    it('MREF-03: sets all_submitted_at when last committee submits', async () => {
      setupMultiRefDef();
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
      ];
      await submitCommitteeReport(mockInstance, mockStepInstance, 'comm-2', 'user-2', 'doc-2', mockDeps);
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({ all_submitted_at: '2026-07-08T00:00:00.000Z' }),
        }),
        undefined
      );
      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'workflow.multi_referral.all_submitted' }),
        undefined
      );
    });

    it('MREF-04: unassigned committee throws FORBIDDEN', async () => {
      setupMultiRefDef();
      await expect(
        submitCommitteeReport(mockInstance, mockStepInstance, 'comm-99', 'user-1', 'doc-1', mockDeps)
      ).rejects.toThrow('FORBIDDEN: committee is not assigned to this step');
    });

    it('MREF-05: duplicate submission throws CONFLICT', async () => {
      setupMultiRefDef();
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: '2026-01-01' },
      ];
      await expect(
        submitCommitteeReport(mockInstance, mockStepInstance, 'comm-1', 'user-1', 'doc-1', mockDeps)
      ).rejects.toThrow('CONFLICT: committee has already submitted');
    });
  });

  describe('submitStepMultiReferral', () => {
    it('MREF-06: REPORT_ACCEPTED when all submitted succeeds', async () => {
      setupMultiRefDef();
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
        { committee_id: 'comm-2', submitted_by: 'u', submitted_at: 'old' },
      ];
      await submitStepMultiReferral(mockInstance, mockStepInstance, 'user-sec', 'user', 'REPORT_ACCEPTED', null, mockDeps);
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'completed', outcome: 'REPORT_ACCEPTED' }),
        undefined
      );
    });

    it('MREF-07: REPORT_ACCEPTED when NOT all submitted throws CONFLICT (INV2)', async () => {
      setupMultiRefDef();
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
      ];
      try {
        await submitStepMultiReferral(mockInstance, mockStepInstance, 'user-sec', 'user', 'REPORT_ACCEPTED', null, mockDeps);
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('all assigned committees must submit');
        expect(e.cause).toBe('REQUIRE_ALL_COMMITTEE_SIGNATURES_VIOLATED');
      }
    });

    it('MREF-08 (INV7): SECRETARY_ADVANCED with empty comment throws COMMENT_REQUIRED', async () => {
      setupMultiRefDef({ allow_secretary_advance: true });
      await expect(
        submitStepMultiReferral(mockInstance, mockStepInstance, 'user-sec', 'user', 'SECRETARY_ADVANCED', '', mockDeps)
      ).rejects.toThrow('COMMENT_REQUIRED');
    });

    it('MREF-09: SECRETARY_ADVANCED with comment marks missing committees as missed', async () => {
      setupMultiRefDef({ allow_secretary_advance: true });
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
      ];
      await submitStepMultiReferral(mockInstance, mockStepInstance, 'user-sec', 'user', 'SECRETARY_ADVANCED', 'override', mockDeps);
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            manual_advance: true,
            submissions: expect.arrayContaining([
              expect.objectContaining({ committee_id: 'comm-2', missed: true }),
            ]),
          }),
        }),
        undefined
      );
    });

    it('MREF-10: BYPASSED_CERTIFIED_URGENT by user throws FORBIDDEN', async () => {
      setupMultiRefDef();
      await expect(
        submitStepMultiReferral(mockInstance, mockStepInstance, 'user-u', 'user', 'BYPASSED_CERTIFIED_URGENT', null, mockDeps)
      ).rejects.toThrow('FORBIDDEN: BYPASSED_CERTIFIED_URGENT cannot be set by user');
    });

    it('MREF-10b: BYPASSED_CERTIFIED_URGENT by system succeeds', async () => {
      setupMultiRefDef();
      await submitStepMultiReferral(mockInstance, mockStepInstance, 'sys', 'system', 'BYPASSED_CERTIFIED_URGENT', 'bypass', mockDeps);
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'completed', outcome: 'BYPASSED_CERTIFIED_URGENT' }),
        undefined
      );
    });

    // NOTE: Engine gap — ROUTED_TO_COMMITTEE is NOT in the require_comment_on list for multi_referral,
    // so submitting with an empty comment on ROUTED_TO_COMMITTEE path would NOT throw VALIDATION_FAILED.
    // This is a known gap flagged for review. See development-findings-log.md.
  });

  describe('updateAssignedCommittees', () => {
    it('Committee list is locked after first submission without bypass', async () => {
      mockStepInstance.metadata.submissions = [{ committee_id: 'comm-1' }];
      try {
        await updateAssignedCommittees(mockStepInstance, [], false, null, mockDeps);
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toContain('locked');
        expect(e.cause).toBe('COMMITTEE_LIST_LOCKED');
      }
    });

    it('Allows update before first submission', async () => {
      await updateAssignedCommittees(mockStepInstance, [{ committee_id: 'comm-3' }], false, null, mockDeps);
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalled();
    });

    it('Allows bypass update with comment even after submissions', async () => {
      mockStepInstance.metadata.submissions = [{ committee_id: 'comm-1' }];
      await updateAssignedCommittees(mockStepInstance, [{ committee_id: 'comm-3' }], true, 'bypass', mockDeps);
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalled();
    });

    it('Bypass without comment throws COMMENT_REQUIRED', async () => {
      mockStepInstance.metadata.submissions = [{ committee_id: 'comm-1' }];
      await expect(
        updateAssignedCommittees(mockStepInstance, [], true, null, mockDeps)
      ).rejects.toThrow('COMMENT_REQUIRED');
    });
  });
});
