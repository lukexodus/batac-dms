import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  submitCommitteeReport,
  submitStepMultiReferral,
  updateAssignedCommittees,
} from './multi-referral.handler.js';

vi.mock('../step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Multi-Referral Step Handler', () => {
  let mockDeps: any;
  let mockInstance: any;
  let mockStepInstance: any;

  beforeEach(() => {
    mockDeps = {
      workflowRepository: {
        getDefinitionVersionWithSteps: vi.fn(),
        updateStepInstance: vi.fn(),
        updateInstanceContext: vi.fn(),
        createWorkflowEvent: vi.fn(),
        getStepInstanceById: vi.fn(),
      },
    };

    mockInstance = {
      id: 'inst-1',
      definitionVersionId: 'ver-1',
      context: {},
    };

    mockStepInstance = {
      id: 'step-inst-1',
      stepId: 'step-1',
      status: 'active',
      metadata: {
        assigned_committees: [{ committee_id: 'comm-1' }, { committee_id: 'comm-2' }],
        submissions: [],
      },
    };

    // Set stable now
    const mockDate = new Date('2026-07-08T00:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setupMockDefinition = (config: Record<string, any>) => {
    mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
      steps: [{ id: 'step-1', stepType: 'multi_referral', config }],
    });
    mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(mockStepInstance);
  };

  describe('submitCommitteeReport', () => {
    it('appends submission correctly and emits event', async () => {
      setupMockDefinition({});
      await submitCommitteeReport(
        mockInstance,
        mockStepInstance,
        'comm-1',
        'user-1',
        'doc-1',
        mockDeps,
      );

      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            submissions: [
              {
                committee_id: 'comm-1',
                submitted_by: 'user-1',
                submitted_at: '2026-07-08T00:00:00.000Z',
                contribution_document_id: 'doc-1',
                missed: false,
                report_text: null,
              },
            ],
          }),
        }),
        undefined,
      );
    });

    it('stores report text when provided', async () => {
      setupMockDefinition({});
      await submitCommitteeReport(
        mockInstance,
        mockStepInstance,
        'comm-1',
        'user-1',
        'doc-1',
        mockDeps,
        undefined,
        'Committee recommendation: approve.',
      );

      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            submissions: [
              expect.objectContaining({
                committee_id: 'comm-1',
                report_text: 'Committee recommendation: approve.',
              }),
            ],
          }),
        }),
        undefined,
      );
    });

    it('sets all_submitted_at when last committee submits (MREF-01 prep)', async () => {
      setupMockDefinition({});
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
      ];

      await submitCommitteeReport(
        mockInstance,
        mockStepInstance,
        'comm-2',
        'user-2',
        'doc-2',
        mockDeps,
      );

      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            all_submitted_at: '2026-07-08T00:00:00.000Z',
          }),
        }),
        undefined,
      );

      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'workflow.multi_referral.all_submitted' }),
        undefined,
      );
    });

    it('K2 MREF-03: all submitted, not yet accepted, step stays Active', async () => {
      setupMockDefinition({});
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
      ];

      await submitCommitteeReport(
        mockInstance,
        mockStepInstance,
        'comm-2',
        'user-2',
        'doc-2',
        mockDeps,
      );

      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            all_submitted_at: '2026-07-08T00:00:00.000Z',
          }),
        }),
        undefined,
      );

      const calls = vi.mocked(mockDeps.workflowRepository.updateStepInstance).mock.calls;
      const completedCalls = calls.filter((c: any) => c[1].status === 'completed');
      expect(completedCalls.length).toBe(0);
    });
  });

  describe('submitStepMultiReferral', () => {
    it('K2 MREF-01: normal completion (all submitted + accepted) works', async () => {
      setupMockDefinition({});
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
        { committee_id: 'comm-2', submitted_by: 'u', submitted_at: 'old' },
      ];

      await submitStepMultiReferral(
        mockInstance,
        mockStepInstance,
        'user-sec',
        'user',
        'REPORT_ACCEPTED',
        null,
        mockDeps,
      );

      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'completed', outcome: 'REPORT_ACCEPTED' }),
        undefined,
      );
    });

    it('K2 MREF-02: not all submitted, no override throws CONFLICT', async () => {
      setupMockDefinition({});
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
      ];

      try {
        await submitStepMultiReferral(
          mockInstance,
          mockStepInstance,
          'user-sec',
          'user',
          'REPORT_ACCEPTED',
          null,
          mockDeps,
        );
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('all assigned committees must submit');
        expect(e.cause).toBe('REQUIRE_ALL_COMMITTEE_SIGNATURES_VIOLATED');
      }
    });

    it('K2 MREF-06: SECRETARY_ADVANCED with empty comment throws', async () => {
      setupMockDefinition({ allow_secretary_advance: true });

      await expect(
        submitStepMultiReferral(
          mockInstance,
          mockStepInstance,
          'user-sec',
          'user',
          'SECRETARY_ADVANCED',
          '',
          mockDeps,
        ),
      ).rejects.toThrow('COMMENT_REQUIRED: comment required for SECRETARY_ADVANCED');
    });

    it('SECRETARY_ADVANCED populates missing committees and completes', async () => {
      setupMockDefinition({ allow_secretary_advance: true });
      mockStepInstance.metadata.submissions = [
        { committee_id: 'comm-1', submitted_by: 'u', submitted_at: 'old' },
      ];

      await submitStepMultiReferral(
        mockInstance,
        mockStepInstance,
        'user-sec',
        'user',
        'SECRETARY_ADVANCED',
        'Override',
        mockDeps,
      );

      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          status: 'completed',
          outcome: 'SECRETARY_ADVANCED',
          metadata: expect.objectContaining({
            manual_advance: true,
            submissions: expect.arrayContaining([
              expect.objectContaining({ committee_id: 'comm-2', missed: true }),
            ]),
          }),
        }),
        undefined,
      );
    });

    it('BYPASSED_CERTIFIED_URGENT with actor_type = user throws FORBIDDEN', async () => {
      setupMockDefinition({});
      await expect(
        submitStepMultiReferral(
          mockInstance,
          mockStepInstance,
          'user-u',
          'user',
          'BYPASSED_CERTIFIED_URGENT',
          null,
          mockDeps,
        ),
      ).rejects.toThrow('FORBIDDEN: BYPASSED_CERTIFIED_URGENT cannot be set by user');
    });

    it('BYPASSED_CERTIFIED_URGENT with actor_type = system succeeds', async () => {
      setupMockDefinition({});
      await submitStepMultiReferral(
        mockInstance,
        mockStepInstance,
        'sys',
        'system',
        'BYPASSED_CERTIFIED_URGENT',
        'Bypass',
        mockDeps,
      );
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'completed', outcome: 'BYPASSED_CERTIFIED_URGENT' }),
        undefined,
      );
    });
  });

  describe('updateAssignedCommittees', () => {
    it('Committee list locked after first submission without bypass', async () => {
      mockStepInstance.metadata.submissions = [{ committee_id: 'comm-1' }];
      try {
        await updateAssignedCommittees(mockStepInstance, [], false, null, mockDeps);
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('locked');
        expect(e.cause).toBe('COMMITTEE_LIST_LOCKED');
      }
    });

    it('Allows updating assigned committees if submissions empty', async () => {
      await updateAssignedCommittees(
        mockStepInstance,
        [{ committee_id: 'comm-3' }],
        false,
        null,
        mockDeps,
      );
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalled();
    });

    it('Allows bypass with comment', async () => {
      mockStepInstance.metadata.submissions = [{ committee_id: 'comm-1' }];
      await updateAssignedCommittees(
        mockStepInstance,
        [{ committee_id: 'comm-3' }],
        true,
        'Bypass',
        mockDeps,
      );
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalled();
    });
  });
});
