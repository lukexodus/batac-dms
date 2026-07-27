import type { WorkflowRepository } from '../workflow.repository.js';
import type { EventBus } from '@batac/shared';
import cron from 'node-cron';
import { randomUUID } from 'node:crypto';

export interface EvaluateSlaBreachesDeps {
  workflowRepository: WorkflowRepository;
  eventBus: EventBus;
}

export async function evaluateSlaBreaches(
  deps: EvaluateSlaBreachesDeps,
  options?: { now?: Date },
): Promise<void> {
  const now = options?.now || new Date();
  const nowTime = now.getTime();

  // Fetch all active step instances (no specific stepType filter)
  const instancesAndSteps =
    await deps.workflowRepository.getActiveInstancesByDefinitionAndStepConfig({});

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

    const emittedEvents: Array<{ type: string; payload: any }> = [];

    // Process inside a transaction
    await deps.workflowRepository.runInTransaction(async (tx) => {
      const lockedStep = await deps.workflowRepository.lockStepInstanceForUpdate(
        stepInstance.id,
        tx,
      );
      if (!lockedStep) return; // Deleted or not found

      const lockedMeta = (lockedStep.metadata as Record<string, any>) || {};
      const applyUpdates: any = {};
      let shouldUpdate = false;

      // Re-check conditions under lock
      if (percent >= 0.8 && !lockedMeta['sla_warning_sent_at']) {
        lockedMeta['sla_warning_sent_at'] = now.toISOString();
        applyUpdates.metadata = lockedMeta;
        shouldUpdate = true;

        await deps.workflowRepository.createWorkflowEvent(
          {
            instanceId: instance.id,
            eventType: 'workflow.sla.warning',
            actorType: 'scheduler',
            actorId: null,
            payload: {
              stepInstanceId: lockedStep.id,
              slaDeadline: stepInstance.slaDeadline!.toISOString(),
              percentElapsed: 80,
            },
          },
          tx,
        );

        emittedEvents.push({
          type: 'workflow.sla.warning',
          payload: {
            stepInstanceId: lockedStep.id,
            slaDeadline: stepInstance.slaDeadline!.toISOString(),
            percentElapsed: 80,
          },
        });
      }

      if (nowTime > deadlineTime && !lockedStep.slaBreachedAt) {
        applyUpdates.slaBreachedAt = stepInstance.slaDeadline;
        shouldUpdate = true;

        await deps.workflowRepository.createWorkflowEvent(
          {
            instanceId: instance.id,
            eventType: 'workflow.sla.breached',
            actorType: 'scheduler',
            actorId: null,
            payload: {
              stepInstanceId: lockedStep.id,
              slaDeadline: stepInstance.slaDeadline!.toISOString(),
              breachDetectedAt: now.toISOString(),
              breachedAt: stepInstance.slaDeadline!.toISOString(),
            },
          },
          tx,
        );

        emittedEvents.push({
          type: 'workflow.sla.breached',
          payload: {
            stepInstanceId: lockedStep.id,
            slaDeadline: stepInstance.slaDeadline!.toISOString(),
            breachDetectedAt: now.toISOString(),
            breachedAt: stepInstance.slaDeadline!.toISOString(),
          },
        });
      }

      if (percent >= 1.5 && !lockedMeta['sla_critical_sent_at']) {
        lockedMeta['sla_critical_sent_at'] = now.toISOString();
        applyUpdates.metadata = lockedMeta;
        shouldUpdate = true;

        await deps.workflowRepository.createWorkflowEvent(
          {
            instanceId: instance.id,
            eventType: 'workflow.sla.critical',
            actorType: 'scheduler',
            actorId: null,
            payload: {
              stepInstanceId: lockedStep.id,
              slaDeadline: stepInstance.slaDeadline!.toISOString(),
            },
          },
          tx,
        );

        emittedEvents.push({
          type: 'workflow.sla.critical',
          payload: {
            stepInstanceId: lockedStep.id,
            slaDeadline: stepInstance.slaDeadline!.toISOString(),
          },
        });
      }

      if (shouldUpdate) {
        await deps.workflowRepository.updateStepInstance(lockedStep.id, applyUpdates, tx);
      }
    });

    if (emittedEvents.length > 0) {
      for (const evt of emittedEvents) {
        // TASK-WF-EVT-001: SLA event names are registered in EventPayloadMap.
        // The `as any` here is required for dynamic dispatch (evt.type is determined
        // at runtime from SLA evaluation logic), not from missing type registrations.
        deps.eventBus.emit(evt.type as any, {
          eventId: randomUUID(),
          eventType: evt.type,
          occurredAt: new Date().toISOString(),
          cityId: instance.cityId,
          schemaVersion: 1,
          payload: evt.payload,
        });
      }
    }
  }

  // ── Instance-Level SLA Pass ──────────────────────────────────────────────
  const activeInstances = await deps.workflowRepository.getActiveInstancesWithSla();

  for (const instance of activeInstances) {
    if (!instance.slaDeadline || !instance.startedAt) continue;

    const startedAtTime = instance.startedAt.getTime();
    const deadlineTime = instance.slaDeadline.getTime();
    const duration = deadlineTime - startedAtTime;

    if (duration <= 0) continue; // Safety check

    const elapsed = nowTime - startedAtTime;
    const percent = elapsed / duration;

    // Check conditions before acquiring lock
    const needsWarning = percent >= 0.8 && !instance.slaWarningSentAt;
    const needsBreach = nowTime > deadlineTime && !instance.slaBreachedAt;
    const needsCritical = percent >= 1.5 && !instance.slaCriticalSentAt;

    if (!needsWarning && !needsBreach && !needsCritical) {
      continue;
    }

    const emittedEvents: Array<{ type: string; payload: any }> = [];

    // Process inside a transaction
    await deps.workflowRepository.runInTransaction(async (tx) => {
      const lockedInstance = await deps.workflowRepository.lockInstanceForUpdate(instance.id, tx);
      if (!lockedInstance) return; // Deleted or not found

      const applyUpdates: any = {};
      let shouldUpdate = false;

      // Re-check conditions under lock
      if (percent >= 0.8 && !lockedInstance.slaWarningSentAt) {
        applyUpdates.slaWarningSentAt = now;
        shouldUpdate = true;

        await deps.workflowRepository.createWorkflowEvent(
          {
            instanceId: instance.id,
            eventType: 'workflow.instance.sla.warning',
            actorType: 'scheduler',
            actorId: null,
            payload: {
              slaDeadline: instance.slaDeadline!.toISOString(),
              percentElapsed: 80,
            },
          },
          tx,
        );

        emittedEvents.push({
          type: 'workflow.instance.sla.warning',
          payload: {
            slaDeadline: instance.slaDeadline!.toISOString(),
            percentElapsed: 80,
          },
        });
      }

      if (nowTime > deadlineTime && !lockedInstance.slaBreachedAt) {
        applyUpdates.slaBreachedAt = instance.slaDeadline;
        shouldUpdate = true;

        await deps.workflowRepository.createWorkflowEvent(
          {
            instanceId: instance.id,
            eventType: 'workflow.instance.sla.breached',
            actorType: 'scheduler',
            actorId: null,
            payload: {
              slaDeadline: instance.slaDeadline!.toISOString(),
              breachDetectedAt: now.toISOString(),
              breachedAt: instance.slaDeadline!.toISOString(),
            },
          },
          tx,
        );

        emittedEvents.push({
          type: 'workflow.instance.sla.breached',
          payload: {
            slaDeadline: instance.slaDeadline!.toISOString(),
            breachDetectedAt: now.toISOString(),
            breachedAt: instance.slaDeadline!.toISOString(),
          },
        });
      }

      if (percent >= 1.5 && !lockedInstance.slaCriticalSentAt) {
        applyUpdates.slaCriticalSentAt = now;
        shouldUpdate = true;

        await deps.workflowRepository.createWorkflowEvent(
          {
            instanceId: instance.id,
            eventType: 'workflow.instance.sla.critical',
            actorType: 'scheduler',
            actorId: null,
            payload: {
              slaDeadline: instance.slaDeadline!.toISOString(),
            },
          },
          tx,
        );

        emittedEvents.push({
          type: 'workflow.instance.sla.critical',
          payload: {
            slaDeadline: instance.slaDeadline!.toISOString(),
          },
        });
      }

      if (shouldUpdate) {
        await deps.workflowRepository.updateInstance(lockedInstance.id, applyUpdates, tx);
      }
    });

    if (emittedEvents.length > 0) {
      for (const evt of emittedEvents) {
        // TASK-WF-EVT-001: SLA event names are registered in EventPayloadMap.
        // The `as any` here is required for dynamic dispatch (evt.type is determined
        // at runtime from SLA evaluation logic), not from missing type registrations.
        deps.eventBus.emit(evt.type as any, {
          eventId: randomUUID(),
          eventType: evt.type,
          occurredAt: new Date().toISOString(),
          cityId: instance.cityId,
          schemaVersion: 1,
          payload: evt.payload,
        });
      }
    }
  }
}

export function registerSlaMonitorJob(deps: EvaluateSlaBreachesDeps) {
  // Run every 15 minutes
  cron.schedule(
    '*/15 * * * *',
    async () => {
      try {
        await evaluateSlaBreaches(deps);
      } catch (err) {
        console.error('[SLA Monitor] Failed to evaluate SLA breaches:', err);
      }
    },
    {
      timezone: 'Asia/Manila',
    },
  );
}
