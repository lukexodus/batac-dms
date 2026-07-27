import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateThursdayCutoffs,
  getLatestThursdayCutoffPHT,
} from './evaluate-thursday-cutoffs.js';
import type { WorkflowRepository } from '../workflow.repository.js';

describe('Thursday Cutoff Scheduler Job', () => {
  describe('getLatestThursdayCutoffPHT', () => {
    it('THU-11: computes cutoff exactly in Asia/Manila (UTC+8) logic', () => {
      // 1. If now is exactly Thursday 23:59:59 PHT (Thursday 15:59:59 UTC)
      const exactCutoff = new Date('2023-11-09T15:59:59Z');
      // Nov 9 2023 is a Thursday.
      expect(getLatestThursdayCutoffPHT(exactCutoff).toISOString()).toBe(
        '2023-11-09T15:59:59.000Z',
      );

      // 2. If now is Thursday 16:00:05 UTC (Friday 00:00:05 PHT)
      const slightlyAfter = new Date('2023-11-09T16:00:05Z');
      expect(getLatestThursdayCutoffPHT(slightlyAfter).toISOString()).toBe(
        '2023-11-09T15:59:59.000Z',
      );

      // 3. If now is Thursday 15:59:58 UTC (Thursday 23:59:58 PHT)
      const slightlyBefore = new Date('2023-11-09T15:59:58Z');
      // Cutoff should be one week prior!
      expect(getLatestThursdayCutoffPHT(slightlyBefore).toISOString()).toBe(
        '2023-11-02T15:59:59.000Z',
      );
    });
  });

  describe('evaluateThursdayCutoffs', () => {
    let mockWorkflowRepository: Partial<WorkflowRepository>;

    beforeEach(() => {
      mockWorkflowRepository = {
        getActiveInstancesByDefinitionAndStepConfig: vi.fn(),
        updateStepInstance: vi.fn(),
        updateInstanceContext: vi.fn(),
        createWorkflowEvent: vi.fn(),
      };
    });

    const runJob = async (stepInstancesData: any[], cutoffTs: Date) => {
      (mockWorkflowRepository.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue(
        stepInstancesData.map((si, i) => ({
          instance: { id: `inst-${i}` },
          stepInstance: {
            id: `step-inst-${i}`,
            metadata: si,
          },
        })),
      );

      return evaluateThursdayCutoffs(
        {
          workflowRepository: mockWorkflowRepository as WorkflowRepository,
          eventBus: { emit: vi.fn() } as any,
        },
        { cutoffTs },
      );
    };

    const fixedCutoff = new Date('2023-11-09T15:59:59Z'); // Thursday 23:59:59 PHT

    it('THU-01: all submitted before cutoff -> eligible_date = following Tuesday', async () => {
      await runJob(
        [
          {
            assigned_committees: [{ committee_id: 'C1' }],
            submissions: [{ committee_id: 'C1' }],
            all_submitted_at: '2023-11-08T10:00:00Z', // Before cutoff
          },
        ],
        fixedCutoff,
      );

      expect(mockWorkflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-0',
        expect.objectContaining({
          metadata: expect.objectContaining({
            second_reading_eligible_date: '2023-11-14', // Tuesday next week
            last_cutoff_evaluated_at: fixedCutoff.toISOString(),
          }),
        }),
      );

      expect(mockWorkflowRepository.updateInstanceContext).toHaveBeenCalledWith('inst-0', {
        second_reading_eligible_date: '2023-11-14',
      });

      expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.multi_referral.second_reading_eligible',
          payload: expect.objectContaining({
            eligibleDate: '2023-11-14',
            cutoffTimestampCleared: fixedCutoff.toISOString(),
          }),
        }),
      );
    });

    it('THU-02: exactly-23:59:59 submission counts as before cutoff', async () => {
      await runJob(
        [
          {
            assigned_committees: [{ committee_id: 'C1' }],
            submissions: [{ committee_id: 'C1' }],
            all_submitted_at: fixedCutoff.toISOString(), // Exactly at cutoff
          },
        ],
        fixedCutoff,
      );

      expect(mockWorkflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-0',
        expect.objectContaining({
          metadata: expect.objectContaining({
            second_reading_eligible_date: '2023-11-14',
          }),
        }),
      );
    });

    it('THU-03: missed cutoff -> missed count incremented, missing committees reported', async () => {
      await runJob(
        [
          {
            assigned_committees: [{ committee_id: 'C1' }, { committee_id: 'C2' }],
            submissions: [{ committee_id: 'C1' }],
            thursday_cutoffs_missed: 1, // Already missed once
            // all_submitted_at is null
          },
        ],
        fixedCutoff,
      );

      expect(mockWorkflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-0',
        expect.objectContaining({
          metadata: expect.objectContaining({
            thursday_cutoffs_missed: 2,
            last_cutoff_evaluated_at: fixedCutoff.toISOString(),
          }),
        }),
      );

      expect(mockWorkflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.multi_referral.cutoff_missed',
          payload: expect.objectContaining({
            missingCommitteeIds: ['C2'],
            cutoffNumber: 2,
          }),
        }),
      );
    });

    it('THU-09: idempotent on double-run in same window', async () => {
      await runJob(
        [
          {
            assigned_committees: [{ committee_id: 'C1' }],
            submissions: [{ committee_id: 'C1' }],
            all_submitted_at: '2023-11-08T10:00:00Z',
            last_cutoff_evaluated_at: fixedCutoff.toISOString(), // Already evaluated exactly at this cutoff
          },
        ],
        fixedCutoff,
      );

      // Should skip completely
      expect(mockWorkflowRepository.updateStepInstance).not.toHaveBeenCalled();
      expect(mockWorkflowRepository.createWorkflowEvent).not.toHaveBeenCalled();
    });

    it('THU-10: no update once second_reading_eligible_date is set', async () => {
      await runJob(
        [
          {
            assigned_committees: [{ committee_id: 'C1' }],
            submissions: [{ committee_id: 'C1' }],
            all_submitted_at: '2023-11-01T10:00:00Z',
            second_reading_eligible_date: '2023-11-07',
            // last_cutoff_evaluated_at is strictly less than cutoffTs, so it doesn't skip from idempotency
            last_cutoff_evaluated_at: '2023-11-02T15:59:59Z',
          },
        ],
        fixedCutoff,
      );

      // Should PASS because second_reading_eligible_date is already set
      expect(mockWorkflowRepository.updateStepInstance).not.toHaveBeenCalled();
      expect(mockWorkflowRepository.updateInstanceContext).not.toHaveBeenCalled();
    });
  });
});
