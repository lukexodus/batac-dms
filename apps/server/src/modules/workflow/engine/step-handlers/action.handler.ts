import type { InstanceRow, StepInstanceRow } from '../types.js';
import type { WorkflowRepository } from '../../workflow.repository.js';
import type { TxOrDb } from '../../../../db.js';
import { writeTimerContextIfTriggered } from '../context-writer.js';
import { resolveNextStep, type StepResolutionDeps } from '../step-resolution.js';

export interface ActionHandlerDeps extends StepResolutionDeps {
  workflowRepository: WorkflowRepository;
}

export async function submitStepAction(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  actorId: string,
  comment: string | null,
  deps: ActionHandlerDeps,
  trx?: TxOrDb,
): Promise<void> {
  if (stepInstance.status !== 'active') {
    throw new Error('CONFLICT: step is not active');
  }

  const assignedUsers = (stepInstance.assignedTo as Array<{ user_id: string }>) || [];
  const isAssigned = assignedUsers.some((a) => a.user_id === actorId);
  if (!isAssigned) {
    throw new Error('FORBIDDEN: actor is not assigned to this step');
  }

  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx,
  );
  if (!versionData) throw new Error('NO_ACTIVE_VERSION');

  const stepDef = versionData.steps.find((s) => s.id === stepInstance.stepId);
  if (!stepDef) throw new Error('Step definition not found');

  const config = (stepDef.config as Record<string, any>) || {};

  if (config['require_comment'] === true) {
    if (!comment || comment.trim() === '') {
      throw new Error('VALIDATION_FAILED: comment is required');
    }
  }

  const now = new Date();

  await deps.workflowRepository.updateStepInstance(
    stepInstance.id,
    { status: 'completed', completedAt: now, outcome: 'DONE' },
    trx,
  );

  // Invoke context writer (for timer flags, etc.)
  await writeTimerContextIfTriggered(stepDef, instance, actorId, 'user', deps as any, trx);

  await deps.workflowRepository.createWorkflowEvent(
    {
      instanceId: instance.id,
      eventType: 'workflow.step.completed',
      actorType: 'user',
      actorId: actorId,
      payload: {
        instanceId: instance.id,
        stepInstanceId: stepInstance.id,
        stepId: stepDef.id,
        stepType: stepDef.stepType,
        outcome: 'DONE',
        comment,
      },
    },
    trx,
  );

  // Refresh stepInstance state before resolving next step
  const updatedStepInstance = await deps.workflowRepository.getStepInstanceById(
    stepInstance.id,
    trx,
  );
  if (!updatedStepInstance) throw new Error('Failed to retrieve updated step instance');

  await resolveNextStep(instance, updatedStepInstance, 'DONE', deps, trx);
}

export async function autoCompleteActionStep(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  deps: ActionHandlerDeps,
  trx?: TxOrDb,
): Promise<void> {
  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx,
  );
  if (!versionData) throw new Error('NO_ACTIVE_VERSION');

  const stepDef = versionData.steps.find((s) => s.id === stepInstance.stepId);
  if (!stepDef) throw new Error('Step definition not found');

  const now = new Date();

  await deps.workflowRepository.updateStepInstance(
    stepInstance.id,
    { status: 'completed', completedAt: now, outcome: 'DONE' },
    trx,
  );

  // Invoke context writer (for timer flags, etc.), actorId is null for system
  await writeTimerContextIfTriggered(stepDef, instance, null, 'system', deps as any, trx);

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
        outcome: 'DONE',
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

  await resolveNextStep(instance, updatedStepInstance, 'DONE', deps, trx);
}
