import type { InstanceRow, StepInstanceRow } from '../types.js';
import type { TxOrDb } from '../../../../db.js';
import { resolveNextStep, type StepResolutionDeps } from '../step-resolution.js';
import { resolveAssignees } from '../assignee-resolution.js';
import type { WorkflowRepository } from '../../workflow.repository.js';

export interface NotificationHandlerDeps extends StepResolutionDeps {
  workflowRepository: WorkflowRepository;
  notificationService?: any; // To be typed when Notifications API is implemented
  logger?: any; // Pino logger
}

export async function executeNotificationStep(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  deps: NotificationHandlerDeps,
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
  const context = (instance.context as Record<string, any>) || {};

  // 1. Resolve recipients
  let recipients: Array<{ user_id: string }> = [];
  if (config['recipients']) {
    try {
      recipients = await resolveAssignees(config['recipients'], context, deps);
    } catch (err) {
      if (deps.logger)
        deps.logger.warn({ err, stepId: stepDef.id }, 'Failed to resolve notification recipients');
      else console.warn('Failed to resolve notification recipients', err);
    }
  }

  // 2. Call Notifications Published API
  try {
    if (deps.notificationService && typeof deps.notificationService.enqueue === 'function') {
      const templateKey = config['template_key'] || 'DEFAULT_NOTIFICATION';
      const channels = config['channels'] || ['inapp'];
      const payload = {
        instanceId: instance.id,
        documentId: instance.documentId,
        ...context,
      };

      await deps.notificationService.enqueue({
        templateKey,
        recipients: recipients.map((r) => r.user_id),
        channels,
        payload,
      });
    } else {
      if (deps.logger) deps.logger.debug('Notification service not available. Skipping dispatch.');
      else console.debug('Notification service not available. Skipping dispatch.');
    }
  } catch (err) {
    // 3. LOG error, do NOT throw
    if (deps.logger) deps.logger.error({ err, stepId: stepDef.id }, 'Notification enqueue failed');
    else console.error('Notification enqueue failed', err);
  }

  const outcome = 'DISPATCHED';
  const now = new Date();

  // 4 & 5. Set status completed, emit event
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

  // 6. Run step resolution
  await resolveNextStep(instance, updatedStepInstance, outcome, deps, trx);
}
