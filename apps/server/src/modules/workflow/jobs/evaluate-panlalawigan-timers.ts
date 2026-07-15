import type { StepResolutionDeps } from '../engine/step-resolution.js';
import { resolveNextStep } from '../engine/step-resolution.js';

export type EvaluatePanlalawiganTimersDeps = StepResolutionDeps;

export async function evaluatePanlalawiganTimers(
  deps: EvaluatePanlalawiganTimersDeps,
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

    if (!allowedOutcomes.includes('DEEMED_APPROVED')) {
      continue;
    }

    const context = (instance.context as Record<string, any>) || {};
    const deadlineStr = context['panlalawigan_action_deadline'];
    if (!deadlineStr) {
      continue;
    }

    const deadline = new Date(deadlineStr);
    if (now.getTime() <= deadline.getTime()) {
      continue;
    }

    // Deadline passed, execute lapse in a transaction
    await deps.workflowRepository.runInTransaction(async (tx) => {
      // 1. Lock the step instance
      const lockedStepInstance = await deps.workflowRepository.lockStepInstanceForUpdate(
        stepInstance.id,
        tx,
      );
      if (!lockedStepInstance) return;

      // 2. Race condition check
      if (lockedStepInstance.outcome !== null) {
        return; // Secretariat beat the scheduler
      }

      // 3. Update step instance
      const updatedStepInstance = await deps.workflowRepository.updateStepInstance(
        stepInstance.id,
        {
          status: 'completed',
          outcome: 'DEEMED_APPROVED',
          outcomeComment:
            'Deemed approved per RA 7160 Section 56(d) — 30 calendar days elapsed with no action from the Sangguniang Panlalawigan.',
          completedAt: deadline, // CRITICAL: deadline, not NOW()
        },
        tx,
      );

      // 4. Update instance context
      await deps.workflowRepository.updateInstanceContext(
        instance.id,
        {
          panlalawigan_outcome: 'DEEMED_APPROVED',
          panlalawigan_response_date: deadlineStr,
        },
        tx,
      );

      // 5. Emit event
      await deps.workflowRepository.createWorkflowEvent(
        {
          instanceId: instance.id,
          eventType: 'workflow.panlalawigan.deemed_approved',
          actorType: 'scheduler',
          actorId: null,
          payload: {
            stepInstanceId: stepInstance.id,
            legalBasis: 'RA 7160 Section 56(d)',
            transmissionDate: context['panlalawigan_transmission_date'],
            deadlineWas: deadlineStr,
          },
        },
        tx,
      );

      // Reload instance because context changed
      const updatedInstance = await deps.workflowRepository.getInstanceById(instance.id, tx);
      if (!updatedInstance) throw new Error('Instance not found during lapse execution');

      // 6. Run step resolution
      await resolveNextStep(
        updatedInstance,
        updatedStepInstance,
        'DEEMED_APPROVED',
        deps,
        tx as any,
      );
    });
  }
}
