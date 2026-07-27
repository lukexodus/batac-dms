import type { InstanceRow, StepInstanceRow } from '../types.js';
import type { TxOrDb } from '../../../../db.js';
import { resolveNextStep, type StepResolutionDeps } from '../step-resolution.js';
import jsonLogic from 'json-logic-js';

export async function executeDecisionStep(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  deps: StepResolutionDeps,
  trx?: TxOrDb,
): Promise<void> {
  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx,
  );
  if (!versionData) throw new Error('NO_ACTIVE_VERSION');

  const stepDef = versionData.steps.find((s) => s.id === stepInstance.stepId);
  if (!stepDef) throw new Error('Step definition not found');

  const config = (stepDef.config as Record<string, any>) || {};
  const expression = config['condition_expression'];
  const trueOutcome = config['true_outcome'] || 'TRUE';
  const falseOutcome = config['false_outcome'] || 'FALSE';

  let isTruthy = false;
  if (expression) {
    const context = (instance.context as Record<string, any>) || {};
    try {
      isTruthy = !!jsonLogic.apply(expression, context);
    } catch (err) {
      console.warn(`Failed to evaluate JSONLogic for decision step ${stepDef.id}:`, err);
      isTruthy = false;
    }
  }

  const outcome = isTruthy ? trueOutcome : falseOutcome;
  const now = new Date();

  await deps.workflowRepository.updateStepInstance(
    stepInstance.id,
    { status: 'completed', completedAt: now, outcome },
    trx,
  );

  await deps.workflowRepository.createWorkflowEvent(
    {
      instanceId: instance.id,
      eventType: 'workflow.step.completed',
      actorType: 'system',
      actorId: null,
      payload: {
        instanceId: instance.id,
        stepInstanceId: stepInstance.id,
        stepId: stepDef.id,
        stepType: stepDef.stepType,
        outcome,
        comment: null,
      },
    },
    trx,
  );

  const updatedStepInstance = await deps.workflowRepository.getStepInstanceById(
    stepInstance.id,
    trx,
  );
  if (!updatedStepInstance) throw new Error('Failed to retrieve updated step instance');

  await resolveNextStep(instance, updatedStepInstance, outcome, deps, trx);
}
