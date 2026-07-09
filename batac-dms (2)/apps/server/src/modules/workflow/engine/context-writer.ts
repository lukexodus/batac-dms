import type { StepRow, InstanceRow } from './types.js';
import type { WorkflowRepository } from '../workflow.repository.js';
import type { DbTransaction } from '../../documents/documents.types.js';

export interface ContextWriterDeps {
  workflowRepository: WorkflowRepository;
}

/**
 * Checks for timer trigger flags in step configuration and writes deadlines to instance context (H1-X-1).
 * Also emits a `workflow.context.updated` event if changes are made.
 * 
 * @param step The step that just completed.
 * @param instance The workflow instance.
 * @param actorId The user completing the step.
 * @param deps Injected dependencies.
 * @param trx Drizzle transaction for atomic updates.
 */
export async function writeTimerContextIfTriggered(
  step: StepRow,
  instance: InstanceRow,
  actorId: string,
  deps: ContextWriterDeps,
  trx?: DbTransaction
): Promise<void> {
  const config = step.config as Record<string, any> | null;
  if (!config) return;

  const now = new Date();
  const newValues: Record<string, unknown> = {};
  const updatedKeys: string[] = [];

  // Check Mayor Lapse Timer
  if (config['triggers_mayor_lapse_timer'] === true) {
    const deadline = new Date(now.getTime());
    deadline.setDate(deadline.getDate() + 10); // 10 calendar days

    newValues['mayor_transmittal_date'] = now.toISOString();
    newValues['mayor_action_deadline'] = deadline.toISOString();
    updatedKeys.push('mayor_transmittal_date', 'mayor_action_deadline');
  }

  // Check Panlalawigan Timer
  if (config['triggers_panlalawigan_timer'] === true) {
    const deadline = new Date(now.getTime());
    deadline.setDate(deadline.getDate() + 30); // 30 calendar days

    newValues['panlalawigan_transmission_date'] = now.toISOString();
    newValues['panlalawigan_action_deadline'] = deadline.toISOString();
    updatedKeys.push('panlalawigan_transmission_date', 'panlalawigan_action_deadline');
  }

  if (updatedKeys.length === 0) {
    return; // Nothing to update
  }

  const previousValues = instance.context as Record<string, unknown>;

  // Merge the new values into the instance context using repository JSONB merge
  await deps.workflowRepository.updateInstanceContext(instance.id, newValues, trx as any);

  // Emit workflow.context.updated within the same transaction
  await deps.workflowRepository.createWorkflowEvent(
    {
      instanceId: instance.id,
      eventType: 'workflow.context.updated',
      actorType: 'user',
      actorId: actorId,
      payload: {
        instanceId: instance.id,
        updatedKeys,
        previousValues: updatedKeys.reduce((acc, key) => ({ ...acc, [key]: previousValues[key] ?? null }), {}),
        newValues,
        actorId,
      },
    },
    trx as any
  );
}
