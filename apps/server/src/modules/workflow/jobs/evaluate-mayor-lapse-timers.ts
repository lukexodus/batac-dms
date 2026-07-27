import type { WorkflowRepository } from '../workflow.repository.js';
import { resolveNextStep } from '../engine/step-resolution.js';
import { randomUUID } from 'node:crypto';

import type { StepResolutionDeps } from '../engine/step-resolution.js';

export type EvaluateMayorLapseTimersDeps = StepResolutionDeps;

export async function evaluateMayorLapseTimers(
  deps: EvaluateMayorLapseTimersDeps,
  options?: { now?: Date },
): Promise<void> {
  const now = options?.now || new Date();

  const instancesAndSteps =
    await deps.workflowRepository.getActiveInstancesByDefinitionAndStepConfig({
      stepType: 'approval',
    });

  for (const { instance, stepInstance } of instancesAndSteps) {
    if (stepInstance.outcome !== null) {
      continue;
    }

    const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
      instance.definitionVersionId,
    );
    if (!versionData) continue;

    const stepDef = versionData.steps.find((s) => s.id === stepInstance.stepId);
    if (!stepDef) continue;

    const config = (stepDef.config as Record<string, any>) || {};
    const allowedOutcomes = (config['allowed_outcomes'] as string[]) || [];

    if (!allowedOutcomes.includes('LAPSED')) {
      continue;
    }

    const context = (instance.context as Record<string, any>) || {};
    const deadlineStr = context['mayor_action_deadline'];
    if (!deadlineStr) {
      continue;
    }

    const deadline = new Date(deadlineStr);
    if (now.getTime() <= deadline.getTime()) {
      continue;
    }

    // Deadline passed, execute lapse in a transaction
    let didLapse = false;
    await deps.workflowRepository.runInTransaction(async (tx) => {
      // 1. Lock the step instance
      const lockedStepInstance = await deps.workflowRepository.lockStepInstanceForUpdate(
        stepInstance.id,
        tx,
      );
      if (!lockedStepInstance) return;

      // 2. Race condition check
      if (lockedStepInstance.outcome !== null) {
        return; // Mayor beat the scheduler
      }

      // 3. Update step instance
      const updatedStepInstance = await deps.workflowRepository.updateStepInstance(
        stepInstance.id,
        {
          status: 'completed',
          outcome: 'LAPSED',
          outcomeComment:
            'Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47.',
          completedAt: deadline, // CRITICAL: deadline, not NOW()
        },
        tx,
      );

      // 4. Update instance context
      await deps.workflowRepository.updateInstanceContext(
        instance.id,
        {
          mayor_action: 'LAPSED',
          mayor_action_date: deadlineStr,
        },
        tx,
      );

      // 5. Emit event
      await deps.workflowRepository.createWorkflowEvent(
        {
          instanceId: instance.id,
          eventType: 'workflow.approval.lapsed',
          actorType: 'scheduler',
          actorId: null,
          payload: {
            stepInstanceId: stepInstance.id,
            legalBasis: 'RA 7160 Section 47',
            deadlineWas: deadlineStr,
          },
        },
        tx,
      );

      // Reload instance because context changed
      const updatedInstance = await deps.workflowRepository.getInstanceById(instance.id, tx);
      if (!updatedInstance) throw new Error('Instance not found during lapse execution');

      // 6. Run step resolution
      await resolveNextStep(updatedInstance, updatedStepInstance, 'LAPSED', deps, tx);
      
      didLapse = true;
    });

    if (didLapse && deps.eventBus) {
      deps.eventBus.emit('workflow.approval.lapsed', {
        eventId: randomUUID(),
        eventType: 'workflow.approval.lapsed',
        occurredAt: new Date().toISOString(),
        cityId: instance.cityId,
        schemaVersion: 1,
        payload: {
          instanceId: instance.id,
          stepInstanceId: stepInstance.id,
        },
      });
    }
  }
}
