import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateDefinitionForPublish } from './definition-validator.js';
import type { WorkflowRepository } from '../workflow.repository.js';
import type { StepRow, TransitionRuleRow } from './types.js';

describe('Definition Publish-Time Validator', () => {
  let mockWorkflowRepository: Partial<WorkflowRepository>;

  beforeEach(() => {
    mockWorkflowRepository = {
      getStepsAndRulesForValidation: vi.fn(),
    };
  });

  const runValidator = async (
    steps: Partial<StepRow>[],
    transitionRules: Partial<TransitionRuleRow>[],
  ) => {
    (mockWorkflowRepository.getStepsAndRulesForValidation as any).mockResolvedValue({
      steps: steps.map((s) => ({
        id: s.id || 'step-id',
        stepKey: s.stepKey || 'step-key',
        stepType: s.stepType || 'action',
        isStart: s.isStart ?? false,
        config: s.config || {},
        ...s,
      })),
      transitionRules: transitionRules.map((r) => ({
        id: r.id || 'rule-id',
        fromStepId: r.fromStepId || 'step-id',
        toStepId: r.toStepId || 'other-step',
        outcomeFilter: r.outcomeFilter || null,
        ...r,
      })),
    });

    return validateDefinitionForPublish('version-id', {
      workflowRepository: mockWorkflowRepository as WorkflowRepository,
    });
  };

  it('MISSING_START_STEP: zero is_start = true steps fails', async () => {
    const result = await runValidator([{ id: 's1', isStart: false }], []);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_START_STEP' }));
    }
  });

  it('MULTIPLE_START_STEPS: more than one is_start = true step fails', async () => {
    const result = await runValidator(
      [
        { id: 's1', isStart: true },
        { id: 's2', isStart: true },
      ],
      [],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MULTIPLE_START_STEPS' }),
      );
    }
  });

  it('STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1: parallel_split/join fails (STEP-I16)', async () => {
    const result = await runValidator(
      [
        { id: 's1', isStart: true, stepType: 'parallel_split' },
        { id: 's2', isStart: false, stepType: 'parallel_join' },
      ],
      [],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1' }),
      );
      expect(result.errors.length).toBe(2);
    }
  });

  it('PUBVAL-01a: mayor_review step with LAPSED but no rule fails with MISSING_LAPSE_TRANSITION', async () => {
    const result = await runValidator(
      [
        {
          id: 's1',
          isStart: true,
          stepKey: 'mayor_review',
          stepType: 'approval',
          config: { allowed_outcomes: ['APPROVED', 'LAPSED'] },
        },
        { id: 's2', isStart: false },
      ],
      [{ fromStepId: 's1', toStepId: 's2', outcomeFilter: 'APPROVED' }],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_LAPSE_TRANSITION', step_key: 'mayor_review' }),
      );
      // PUBVAL-02c: ensures we do NOT return MISSING_OUTCOME_TRANSITION for LAPSED
      const hasOutcomeError = result.errors.some(
        (e) => e.code === 'MISSING_OUTCOME_TRANSITION' && e.missing_outcome_code === 'LAPSED',
      );
      expect(hasOutcomeError).toBe(false);
    }
  });

  it('PUBVAL-01b: LAPSED -> docketing rule present -> publish succeeds', async () => {
    const result = await runValidator(
      [
        {
          id: 's1',
          isStart: true,
          stepKey: 'mayor_review',
          stepType: 'approval',
          config: { allowed_outcomes: ['APPROVED', 'LAPSED'] },
        },
        { id: 's2', isStart: false },
      ],
      [
        { fromStepId: 's1', toStepId: 's2', outcomeFilter: 'APPROVED' },
        { fromStepId: 's1', toStepId: 's2', outcomeFilter: 'LAPSED' },
      ],
    );
    expect(result.valid).toBe(true);
  });

  it('PUBVAL-02a: second_reading_vote with REJECTED but no rule fails with MISSING_OUTCOME_TRANSITION', async () => {
    const result = await runValidator(
      [
        {
          id: 's1',
          isStart: true,
          stepKey: 'second_reading_vote',
          stepType: 'approval',
          config: { allowed_outcomes: ['APPROVED', 'REJECTED'] },
        },
        { id: 's2', isStart: false },
      ],
      [{ fromStepId: 's1', toStepId: 's2', outcomeFilter: 'APPROVED' }],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_OUTCOME_TRANSITION',
          step_key: 'second_reading_vote',
          missing_outcome_code: 'REJECTED',
        }),
      );
    }
  });

  it('MISSING_CERTIFIED_URGENT_TRANSITION: multi_referral without bypass rule fails', async () => {
    const result = await runValidator(
      [
        {
          id: 's1',
          isStart: true,
          stepKey: 'committee_referral',
          stepType: 'multi_referral',
          config: {
            thursday_cutoff_enabled: true,
            require_all_committee_signatures: true,
          },
        },
        { id: 's2', isStart: false },
      ],
      [{ fromStepId: 's1', toStepId: 's2', outcomeFilter: 'REPORT_ACCEPTED' }],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          code: 'MISSING_CERTIFIED_URGENT_TRANSITION',
          step_key: 'committee_referral',
        }),
      );
    }
  });

  it('All errors collected together (not fail-fast)', async () => {
    const result = await runValidator(
      [
        {
          id: 's1', // Missing start step (isStart is false by default)
          stepKey: 'bad_step',
          stepType: 'approval', // Will trigger missing outcome transitions
          config: { allowed_outcomes: ['A', 'B', 'LAPSED', 'DEEMED_APPROVED'] },
        },
        {
          id: 's2',
          stepKey: 'bad_multi',
          stepType: 'multi_referral', // Will trigger invalid config AND missing urgent bypass
          config: { thursday_cutoff_enabled: false }, // missing require_all...
        },
      ],
      [],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(4);
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('MISSING_START_STEP');
      expect(codes).toContain('MISSING_LAPSE_TRANSITION');
      expect(codes).toContain('MISSING_DEEMED_APPROVED_TRANSITION');
      expect(codes).toContain('MISSING_OUTCOME_TRANSITION'); // for A and B
      expect(codes).toContain('MISSING_CERTIFIED_URGENT_TRANSITION');
      expect(codes).toContain('MULTI_REFERRAL_INVALID_CONFIG');
    }
  });
});
