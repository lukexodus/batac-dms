import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateThursdayCutoffs,
  getLatestThursdayCutoffPHT,
} from '../jobs/evaluate-thursday-cutoffs.js';
import { buildMockRepo } from './fixtures/workflow-test-helpers.js';

describe('Thursday Cutoff Scheduler (THU)', () => {
  describe('getLatestThursdayCutoffPHT helper', () => {
    it('THU-11a: Thursday 23:59:59 PHT exactly returns itself', () => {
      // Nov 9 2023 is a Thursday. 23:59:59 PHT = 15:59:59 UTC.
      const exactCutoff = new Date('2023-11-09T15:59:59Z');
      expect(getLatestThursdayCutoffPHT(exactCutoff).toISOString()).toBe(
        '2023-11-09T15:59:59.000Z',
      );
    });

    it('THU-11b: Friday 00:00:05 PHT returns the previous Thursday cutoff', () => {
      const slightlyAfter = new Date('2023-11-09T16:00:05Z');
      expect(getLatestThursdayCutoffPHT(slightlyAfter).toISOString()).toBe(
        '2023-11-09T15:59:59.000Z',
      );
    });

    it('THU-11c: Thursday 23:59:58 PHT (one second before cutoff) returns prior week', () => {
      const slightlyBefore = new Date('2023-11-09T15:59:58Z');
      expect(getLatestThursdayCutoffPHT(slightlyBefore).toISOString()).toBe(
        '2023-11-02T15:59:59.000Z',
      );
    });

    it('THU-11d: Monday PHT returns the previous Thursday', () => {
      // Nov 13 2023 = Monday
      const monday = new Date('2023-11-13T10:00:00Z');
      expect(getLatestThursdayCutoffPHT(monday).toISOString()).toBe('2023-11-09T15:59:59.000Z');
    });
  });

  describe('evaluateThursdayCutoffs job', () => {
    let mockRepo: any;
    const fixedCutoff = new Date('2023-11-09T15:59:59Z');

    const runJob = async (metadata: any) => {
      (mockRepo.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
        {
          instance: { id: 'inst-1' },
          stepInstance: { id: 'step-inst-1', metadata },
        },
      ]);
      return evaluateThursdayCutoffs(
        { workflowRepository: mockRepo, eventBus: { emit: vi.fn() } as any },
        { cutoffTs: fixedCutoff },
      );
    };

    beforeEach(() => {
      mockRepo = buildMockRepo();
    });

    it('THU-01: all submitted before cutoff → second_reading_eligible_date set', async () => {
      await runJob({
        assigned_committees: [{ committee_id: 'C1' }],
        submissions: [{ committee_id: 'C1' }],
        all_submitted_at: '2023-11-08T10:00:00Z',
      });
      expect(mockRepo.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            second_reading_eligible_date: '2023-11-14',
            last_cutoff_evaluated_at: fixedCutoff.toISOString(),
          }),
        }),
      );
      expect(mockRepo.updateInstanceContext).toHaveBeenCalledWith('inst-1', {
        second_reading_eligible_date: '2023-11-14',
      });
      expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.multi_referral.second_reading_eligible',
          payload: expect.objectContaining({ eligibleDate: '2023-11-14' }),
        }),
      );
    });

    it('THU-02: exactly-at-cutoff submission counts as before cutoff', async () => {
      await runJob({
        assigned_committees: [{ committee_id: 'C1' }],
        submissions: [{ committee_id: 'C1' }],
        all_submitted_at: fixedCutoff.toISOString(),
      });
      expect(mockRepo.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({ second_reading_eligible_date: '2023-11-14' }),
        }),
      );
    });

    it('THU-03: missed cutoff → missed count incremented and missing committees reported', async () => {
      await runJob({
        assigned_committees: [{ committee_id: 'C1' }, { committee_id: 'C2' }],
        submissions: [{ committee_id: 'C1' }],
        thursday_cutoffs_missed: 1,
      });
      expect(mockRepo.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            thursday_cutoffs_missed: 2,
            last_cutoff_evaluated_at: fixedCutoff.toISOString(),
          }),
        }),
      );
      expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.multi_referral.cutoff_missed',
          payload: expect.objectContaining({ missingCommitteeIds: ['C2'], cutoffNumber: 2 }),
        }),
      );
    });

    it('THU-04: no assigned committees, no submissions → missed event fired', async () => {
      await runJob({
        assigned_committees: [],
        submissions: [],
      });
      expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'workflow.multi_referral.cutoff_missed' }),
      );
    });

    it('THU-05: all_submitted_at AFTER cutoff → no eligible date set', async () => {
      await runJob({
        assigned_committees: [{ committee_id: 'C1' }],
        submissions: [{ committee_id: 'C1' }],
        all_submitted_at: '2023-11-10T10:00:00Z', // After cutoff
      });
      // No updateStepInstance call with second_reading_eligible_date
      const calls = mockRepo.updateStepInstance.mock.calls;
      const eligibleCalls = calls.filter((c: any) => c[1]?.metadata?.second_reading_eligible_date);
      expect(eligibleCalls.length).toBe(0);
    });

    it('THU-09: idempotent — double-run at same cutoff skips', async () => {
      await runJob({
        assigned_committees: [{ committee_id: 'C1' }],
        submissions: [{ committee_id: 'C1' }],
        all_submitted_at: '2023-11-08T10:00:00Z',
        last_cutoff_evaluated_at: fixedCutoff.toISOString(), // Already processed
      });
      expect(mockRepo.updateStepInstance).not.toHaveBeenCalled();
      expect(mockRepo.createWorkflowEvent).not.toHaveBeenCalled();
    });

    it('THU-10: no update if second_reading_eligible_date already set', async () => {
      await runJob({
        assigned_committees: [{ committee_id: 'C1' }],
        submissions: [{ committee_id: 'C1' }],
        all_submitted_at: '2023-11-01T10:00:00Z',
        second_reading_eligible_date: '2023-11-07',
        last_cutoff_evaluated_at: '2023-11-02T15:59:59Z',
      });
      expect(mockRepo.updateStepInstance).not.toHaveBeenCalled();
      expect(mockRepo.updateInstanceContext).not.toHaveBeenCalled();
    });

    it('THU-06: new cutoff after prior cutoff processes again', async () => {
      const laterCutoff = new Date('2023-11-16T15:59:59Z'); // next Thursday
      (mockRepo.getActiveInstancesByDefinitionAndStepConfig as any).mockResolvedValue([
        {
          instance: { id: 'inst-2' },
          stepInstance: {
            id: 'step-inst-2',
            metadata: {
              assigned_committees: [{ committee_id: 'C1' }],
              submissions: [{ committee_id: 'C1' }],
              all_submitted_at: '2023-11-15T10:00:00Z',
              last_cutoff_evaluated_at: fixedCutoff.toISOString(), // processed up to Nov 9
            },
          },
        },
      ]);
      await evaluateThursdayCutoffs(
        { workflowRepository: mockRepo, eventBus: { emit: vi.fn() } as any },
        { cutoffTs: laterCutoff },
      );
      expect(mockRepo.updateStepInstance).toHaveBeenCalled();
    });
  });
});
