import type { WorkflowRepository } from '../workflow.repository.js';
import cron from 'node-cron';

export interface EvaluateSlaBreachesDeps {
  workflowRepository: WorkflowRepository;
}

export async function evaluateSlaBreaches(
  deps: EvaluateSlaBreachesDeps,
  options?: { now?: Date }
): Promise<void> {
  const now = options?.now || new Date();
  const nowTime = now.getTime();

  // Fetch all active step instances (no specific stepType filter)
  const instancesAndSteps = await deps.workflowRepository.getActiveInstancesByDefinitionAndStepConfig({});

  for (const { instance, stepInstance } of instancesAndSteps) {
    if (!stepInstance.slaDeadline || !stepInstance.startedAt) continue;

    const startedAtTime = stepInstance.startedAt.getTime();
    const deadlineTime = stepInstance.slaDeadline.getTime();
    const duration = deadlineTime - startedAtTime;
    
    if (duration <= 0) continue; // Safety check

    const elapsed = nowTime - startedAtTime;
    const percent = elapsed / duration;

    // Check conditions before acquiring lock
    const metadata = (stepInstance.metadata as Record<string, any>) || {};
    const slaWarningSentAt = metadata['sla_warning_sent_at'];
    const slaCriticalSentAt = metadata['sla_critical_sent_at'];

    const needsWarning = percent >= 0.8 && !slaWarningSentAt;
    const needsBreach = nowTime > deadlineTime && !stepInstance.slaBreachedAt;
    const needsCritical = percent >= 1.5 && !slaCriticalSentAt;

    if (!needsWarning && !needsBreach && !needsCritical) {
      continue;
    }

    // Process inside a transaction
    await deps.workflowRepository.runInTransaction(async (tx) => {
      const lockedStep = await deps.workflowRepository.lockStepInstanceForUpdate(stepInstance.id, tx);
      if (!lockedStep) return; // Deleted or not found

      const lockedMeta = (lockedStep.metadata as Record<string, any>) || {};
      const applyUpdates: any = {};
      let shouldUpdate = false;

      // Re-check conditions under lock
      if (percent >= 0.8 && !lockedMeta['sla_warning_sent_at']) {
        lockedMeta['sla_warning_sent_at'] = now.toISOString();
        applyUpdates.metadata = lockedMeta;
        shouldUpdate = true;
        
        await deps.workflowRepository.createWorkflowEvent({
          instanceId: instance.id,
          eventType: 'workflow.sla.warning',
          actorType: 'scheduler',
          actorId: null,
          payload: {
            stepInstanceId: lockedStep.id,
            slaDeadline: stepInstance.slaDeadline!.toISOString(),
            percentElapsed: 80
          }
        }, tx);
      }

      if (nowTime > deadlineTime && !lockedStep.slaBreachedAt) {
        applyUpdates.slaBreachedAt = stepInstance.slaDeadline;
        shouldUpdate = true;
        
        await deps.workflowRepository.createWorkflowEvent({
          instanceId: instance.id,
          eventType: 'workflow.sla.breached',
          actorType: 'scheduler',
          actorId: null,
          payload: {
            stepInstanceId: lockedStep.id,
            slaDeadline: stepInstance.slaDeadline!.toISOString(),
            breachDetectedAt: now.toISOString(),
            breachedAt: stepInstance.slaDeadline!.toISOString()
          }
        }, tx);
      }

      if (percent >= 1.5 && !lockedMeta['sla_critical_sent_at']) {
        lockedMeta['sla_critical_sent_at'] = now.toISOString();
        applyUpdates.metadata = lockedMeta;
        shouldUpdate = true;

        await deps.workflowRepository.createWorkflowEvent({
          instanceId: instance.id,
          eventType: 'workflow.sla.critical',
          actorType: 'scheduler',
          actorId: null,
          payload: {
            stepInstanceId: lockedStep.id,
            slaDeadline: stepInstance.slaDeadline!.toISOString()
          }
        }, tx);
      }

      if (shouldUpdate) {
        await deps.workflowRepository.updateStepInstance(
          lockedStep.id,
          applyUpdates,
          tx
        );
      }
    });
  }
}

export function registerSlaMonitorJob(deps: EvaluateSlaBreachesDeps) {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await evaluateSlaBreaches(deps);
    } catch (err) {
      console.error('[SLA Monitor] Failed to evaluate SLA breaches:', err);
    }
  }, {
    timezone: 'Asia/Manila'
  });
}
