import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateDefinitionForPublish } from '../engine/definition-validator.js';
import { buildMockRepo } from './fixtures/workflow-test-helpers.js';

describe('Publish Validation (PUBVAL)', () => {
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = buildMockRepo();
  });

  const runValidator = async (steps: any[], transitionRules: any[]) => {
    mockRepo.getStepsAndRulesForValidation.mockResolvedValue({
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
        outcomeFilter: r.outcomeFilter ?? null,
        ...r,
      })),
    });
    return validateDefinitionForPublish('version-id', { workflowRepository: mockRepo });
  };

  it('PUBVAL-MISS-START: no start step → MISSING_START_STEP error', async () => {
    const result = await runValidator([{ id: 's1', isStart: false }], []);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(expect.objectContaining({ code: 'MISSING_START_STEP' }));
    }
  });

  it('PUBVAL-MULT-START: two start steps → MULTIPLE_START_STEPS error', async () => {
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

  it('PUBVAL-PAR (INV5): parallel_split/parallel_join → STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1', async () => {
    const result = await runValidator(
      [
        { id: 's1', isStart: true, stepType: 'parallel_split' },
        { id: 's2', isStart: false, stepType: 'parallel_join' },
      ],
      [],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1');
    }
  });

  it('PUBVAL-01a: LAPSED in allowed_outcomes but no LAPSED transition → MISSING_LAPSE_TRANSITION', async () => {
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
      // PUBVAL-02c: LAPSED should NOT also raise MISSING_OUTCOME_TRANSITION
      const hasOutcomeError = result.errors.some(
        (e) => e.code === 'MISSING_OUTCOME_TRANSITION' && e.missing_outcome_code === 'LAPSED',
      );
      expect(hasOutcomeError).toBe(false);
    }
  });

  it('PUBVAL-01b: LAPSED with rule present → valid', async () => {
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

  it('PUBVAL-02a: DEEMED_APPROVED without rule → MISSING_DEEMED_APPROVED_TRANSITION', async () => {
    const result = await runValidator(
      [
        {
          id: 's1',
          isStart: true,
          stepKey: 'panlalawigan_review',
          stepType: 'approval',
          config: { allowed_outcomes: ['VALID', 'DEEMED_APPROVED'] },
        },
        { id: 's2', isStart: false },
      ],
      [{ fromStepId: 's1', toStepId: 's2', outcomeFilter: 'VALID' }],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MISSING_DEEMED_APPROVED_TRANSITION' }),
      );
    }
  });

  it('PUBVAL-02b: REJECTED without rule → MISSING_OUTCOME_TRANSITION', async () => {
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

  it('PUBVAL-02c: wildcard (null) outcomeFilter rule covers any outcome → valid', async () => {
    const result = await runValidator(
      [
        {
          id: 's1',
          isStart: true,
          stepKey: 'vote_step',
          stepType: 'approval',
          config: { allowed_outcomes: ['APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION'] },
        },
        { id: 's2', isStart: false },
      ],
      [{ fromStepId: 's1', toStepId: 's2', outcomeFilter: null }], // wildcard covers all
    );
    expect(result.valid).toBe(true);
  });

  it('PUBVAL-MREF-CU: multi_referral without BYPASSED_CERTIFIED_URGENT rule → MISSING_CERTIFIED_URGENT_TRANSITION', async () => {
    const result = await runValidator(
      [
        {
          id: 's1',
          isStart: true,
          stepKey: 'committee_referral',
          stepType: 'multi_referral',
          config: { thursday_cutoff_enabled: true, require_all_committee_signatures: true },
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

  it('PUBVAL-MREF-CONFIG: multi_referral missing required config flags → MULTI_REFERRAL_INVALID_CONFIG', async () => {
    const result = await runValidator(
      [
        {
          id: 's1',
          isStart: true,
          stepKey: 'committee_referral',
          stepType: 'multi_referral',
          config: { thursday_cutoff_enabled: false }, // missing require_all_committee_signatures
        },
        { id: 's2', isStart: false },
      ],
      [
        { fromStepId: 's1', toStepId: 's2', outcomeFilter: 'REPORT_ACCEPTED' },
        { fromStepId: 's1', toStepId: 's2', outcomeFilter: 'BYPASSED_CERTIFIED_URGENT' },
      ],
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'MULTI_REFERRAL_INVALID_CONFIG' }),
      );
    }
  });

  it('PUBVAL-CROSS: cross-version transition rule → CROSS_VERSION_TRANSITION_REFERENCE', async () => {
    const result = await runValidator(
      [{ id: 's1', isStart: true, stepType: 'action' }],
      [{ fromStepId: 's1', toStepId: 'foreign-step-id', outcomeFilter: null }],
      // foreign-step-id is not in the version's steps
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'CROSS_VERSION_TRANSITION_REFERENCE' }),
      );
    }
  });

  it('PUBVAL-ALL: all errors collected (fail-open, not fail-fast)', async () => {
    const result = await runValidator(
      [
        {
          id: 's1',
          stepKey: 'bad_step',
          stepType: 'approval',
          config: { allowed_outcomes: ['A', 'B', 'LAPSED', 'DEEMED_APPROVED'] },
        },
        {
          id: 's2',
          stepKey: 'bad_multi',
          stepType: 'multi_referral',
          config: { thursday_cutoff_enabled: false },
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
      expect(codes).toContain('MISSING_OUTCOME_TRANSITION');
      expect(codes).toContain('MISSING_CERTIFIED_URGENT_TRANSITION');
      expect(codes).toContain('MULTI_REFERRAL_INVALID_CONFIG');
    }
  });
});
