import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateTransitionRules } from '../engine/transition-evaluation.js';
import { submitStepApproval } from '../engine/step-handlers/approval.handler.js';
import {
  buildMockApprovalDeps,
  buildMockInstance,
  buildMockStepInstance,
} from './fixtures/workflow-test-helpers.js';

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Transition Resolution (RES)', () => {
  describe('RES-V: evaluateTransitionRules', () => {
    it('RES-V-01: exact outcome_filter match wins over wildcard (null) at same priority ordering', () => {
      const rules = [
        {
          id: 'r1',
          fromStepId: 's1',
          toStepId: 'step-end',
          outcomeFilter: null,
          priority: 1,
          conditionExpression: null,
        },
        {
          id: 'r2',
          fromStepId: 's1',
          toStepId: 'step-approved',
          outcomeFilter: 'APPROVED',
          priority: 10,
          conditionExpression: null,
        },
      ] as any[];
      // Priority ASC: r1 (1) comes first — wildcard null matches APPROVED, so r1.toStepId = 'step-end'
      const result = evaluateTransitionRules(rules, 'APPROVED', {});
      expect(result).toBe('step-end');
    });

    it('RES-V-02: specific outcome_filter at lower priority number beats wildcard at higher priority number', () => {
      const rules = [
        {
          id: 'r1',
          fromStepId: 's1',
          toStepId: 'step-specific',
          outcomeFilter: 'APPROVED',
          priority: 5,
          conditionExpression: null,
        },
        {
          id: 'r2',
          fromStepId: 's1',
          toStepId: 'step-wildcard',
          outcomeFilter: null,
          priority: 10,
          conditionExpression: null,
        },
      ] as any[];
      const result = evaluateTransitionRules(rules, 'APPROVED', {});
      // Priority 5 first → returns step-specific
      expect(result).toBe('step-specific');
    });

    it('RES-V-03: non-matching outcome_filter is excluded', () => {
      const rules = [
        {
          id: 'r1',
          fromStepId: 's1',
          toStepId: 'step-rejected',
          outcomeFilter: 'REJECTED',
          priority: 1,
          conditionExpression: null,
        },
      ] as any[];
      const result = evaluateTransitionRules(rules, 'APPROVED', {});
      expect(result).toBeNull();
    });

    it('RES-V-04: wildcard null outcomeFilter matches any outcome', () => {
      const rules = [
        {
          id: 'r1',
          fromStepId: 's1',
          toStepId: 'step-end',
          outcomeFilter: null,
          priority: 1,
          conditionExpression: null,
        },
      ] as any[];
      expect(evaluateTransitionRules(rules, 'VETOED', {})).toBe('step-end');
      expect(evaluateTransitionRules(rules, 'APPROVED', {})).toBe('step-end');
      expect(evaluateTransitionRules(rules, 'ANYTHING', {})).toBe('step-end');
    });

    it('RES-V-05: conditionExpression evaluated with jsonLogic against context', () => {
      const rules = [
        {
          id: 'r1',
          fromStepId: 's1',
          toStepId: 'step-wealthy',
          outcomeFilter: null,
          priority: 1,
          conditionExpression: { '==': [{ var: 'is_wealthy' }, true] },
        },
        {
          id: 'r2',
          fromStepId: 's1',
          toStepId: 'step-default',
          outcomeFilter: null,
          priority: 10,
          conditionExpression: null,
        },
      ] as any[];
      expect(evaluateTransitionRules(rules, 'APPROVED', { is_wealthy: true })).toBe('step-wealthy');
      expect(evaluateTransitionRules(rules, 'APPROVED', { is_wealthy: false })).toBe(
        'step-default',
      );
    });

    it('Stuck-on-no-match: no rules → returns null (instance goes stuck)', () => {
      expect(evaluateTransitionRules([], 'APPROVED', {})).toBeNull();
    });
  });

  describe('RES-I: Scheduler-only outcomes via submitStepApproval', () => {
    let mockDeps: any;
    let mockInstance: any;
    let mockStepInstance: any;

    beforeEach(() => {
      mockDeps = buildMockApprovalDeps();
      mockInstance = buildMockInstance();
      mockStepInstance = buildMockStepInstance();
    });

    const setupDef = (config: Record<string, any>) => {
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [{ id: 'step-mayor', stepType: 'approval', config }],
      });
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(mockStepInstance);
    };

    it('RES-I10: LAPSED submitted by user → FORBIDDEN with LAPSED_IS_SCHEDULER_ONLY', async () => {
      setupDef({ allowed_outcomes: ['APPROVED', 'LAPSED'] });
      try {
        await submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-mayor',
          'user',
          'LAPSED',
          null,
          mockDeps,
        );
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('FORBIDDEN');
        expect(e.cause).toBe('LAPSED_IS_SCHEDULER_ONLY');
      }
    });

    it('RES-I11: DEEMED_APPROVED submitted by user → FORBIDDEN with DEEMED_APPROVED_IS_SCHEDULER_ONLY', async () => {
      setupDef({ allowed_outcomes: ['APPROVED', 'DEEMED_APPROVED'] });
      try {
        await submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-mayor',
          'user',
          'DEEMED_APPROVED',
          null,
          mockDeps,
        );
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('FORBIDDEN');
        expect(e.cause).toBe('DEEMED_APPROVED_IS_SCHEDULER_ONLY');
      }
    });

    it('RES-I12: OVERRIDE_SUCCEEDED with voteCount < 8 throws insufficient votes', async () => {
      setupDef({ allowed_outcomes: ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED'] });
      mockInstance.context.veto_override_vote_count = 5;
      await expect(
        submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-mayor',
          'user',
          'OVERRIDE_SUCCEEDED',
          null,
          mockDeps,
        ),
      ).rejects.toThrow('VALIDATION_FAILED: insufficient votes for override');
    });

    it('RES-I13: OVERRIDE_FAILED with voteCount >= 8 throws override failed but count is >= 8', async () => {
      setupDef({ allowed_outcomes: ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED'] });
      mockInstance.context.veto_override_vote_count = 8;
      await expect(
        submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-mayor',
          'user',
          'OVERRIDE_FAILED',
          null,
          mockDeps,
        ),
      ).rejects.toThrow('VALIDATION_FAILED: override failed but vote count is >= 8');
    });
  });
});
