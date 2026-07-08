import type { WorkflowRepository } from '../workflow.repository.js';
import type { StepRow, TransitionRuleRow } from './types.js';

export type ValidationError = {
  code: string;
  step_key?: string;
  missing_outcome_code?: string;
  message: string;
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

export type DefinitionValidatorDeps = {
  workflowRepository: WorkflowRepository;
};

export async function validateDefinitionForPublish(
  versionId: string,
  deps: DefinitionValidatorDeps
): Promise<ValidationResult> {
  const { steps, transitionRules } =
    await deps.workflowRepository.getStepsAndRulesForValidation(versionId);

  const errors: ValidationError[] = [];

  // 1. Start step check
  const startSteps = steps.filter((s) => s.isStart);
  if (startSteps.length === 0) {
    errors.push({
      code: 'MISSING_START_STEP',
      message: 'Definition has no start step.',
    });
  } else if (startSteps.length > 1) {
    errors.push({
      code: 'MULTIPLE_START_STEPS',
      message: 'Definition has multiple start steps.',
    });
  }

  for (const step of steps) {
    const config = (step.config as Record<string, unknown>) || {};

    // 2. Phase 1 parallel step guard (B4 §5, invariant #5)
    if (step.stepType === 'parallel_split' || step.stepType === 'parallel_join') {
      errors.push({
        code: 'STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1',
        step_key: step.stepKey,
        message: `Step type ${step.stepType} is not supported in Phase 1.`,
      });
    }

    if (step.stepType === 'approval') {
      const allowedOutcomes = (config['allowed_outcomes'] as string[]) || [];

      // 3. MISSING_LAPSE_TRANSITION
      if (allowedOutcomes.includes('LAPSED')) {
        const hasLapsedRule = transitionRules.some(
          (r) => r.fromStepId === step.id && r.outcomeFilter === 'LAPSED'
        );
        if (!hasLapsedRule) {
          errors.push({
            code: 'MISSING_LAPSE_TRANSITION',
            step_key: step.stepKey,
            message: `Approval step ${step.stepKey} allows LAPSED but has no LAPSED transition rule.`,
          });
        }
      }

      // 4. MISSING_DEEMED_APPROVED_TRANSITION [Inference: symmetric with LAPSED]
      if (allowedOutcomes.includes('DEEMED_APPROVED')) {
        const hasDeemedRule = transitionRules.some(
          (r) => r.fromStepId === step.id && r.outcomeFilter === 'DEEMED_APPROVED'
        );
        if (!hasDeemedRule) {
          errors.push({
            code: 'MISSING_DEEMED_APPROVED_TRANSITION',
            step_key: step.stepKey,
            message: `Approval step ${step.stepKey} allows DEEMED_APPROVED but has no DEEMED_APPROVED transition rule.`,
          });
        }
      }

      // 5. MISSING_OUTCOME_TRANSITION
      for (const code of allowedOutcomes) {
        if (code === 'LAPSED' || code === 'DEEMED_APPROVED') continue;
        const hasMatchingRule = transitionRules.some(
          (r) =>
            r.fromStepId === step.id &&
            (r.outcomeFilter === code || r.outcomeFilter === null)
        );
        if (!hasMatchingRule) {
          errors.push({
            code: 'MISSING_OUTCOME_TRANSITION',
            step_key: step.stepKey,
            missing_outcome_code: code,
            message: `Approval step ${step.stepKey} is missing a transition rule for outcome ${code}.`,
          });
        }
      }
    }

    if (step.stepType === 'multi_referral') {
      // 6. MISSING_CERTIFIED_URGENT_TRANSITION
      const hasBypassRule = transitionRules.some(
        (r) =>
          r.fromStepId === step.id && r.outcomeFilter === 'BYPASSED_CERTIFIED_URGENT'
      );
      if (!hasBypassRule) {
        errors.push({
          code: 'MISSING_CERTIFIED_URGENT_TRANSITION',
          step_key: step.stepKey,
          message: `Multi-referral step ${step.stepKey} is missing the BYPASSED_CERTIFIED_URGENT transition rule.`,
        });
      }

      // 8. multi_referral config requirements
      const thursdayCutoff = config['thursday_cutoff_enabled'] === true;
      const requireAll = config['require_all_committee_signatures'] === true;
      if (!thursdayCutoff || !requireAll) {
        errors.push({
          code: 'MULTI_REFERRAL_INVALID_CONFIG',
          step_key: step.stepKey,
          message: `Multi-referral step ${step.stepKey} must have thursday_cutoff_enabled and require_all_committee_signatures set to true.`,
        });
      }
    }
  }

  // 7. Cross-version transition guard
  // As a structural guard matching the schema comment, we verify all rules
  // point only to steps within this version.
  const stepIdsInVersion = new Set(steps.map((s) => s.id));
  for (const rule of transitionRules) {
    if (!stepIdsInVersion.has(rule.fromStepId) || !stepIdsInVersion.has(rule.toStepId)) {
      // Find the stepKey for fromStep to include in the error
      // Note: if fromStepId is from another version, it might not be in `steps`.
      const fromStep = steps.find((s) => s.id === rule.fromStepId);
      errors.push({
        code: 'CROSS_VERSION_TRANSITION_REFERENCE',
        step_key: fromStep?.stepKey,
        message: `Transition rule references a step outside of definition version ${versionId}.`,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }
  return { valid: true };
}
