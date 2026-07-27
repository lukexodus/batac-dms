import type { AppDb, TxOrDb } from '../../../db.js';
import { eq, and, isNull } from 'drizzle-orm';
import { workflowEvents } from '@batac/database/schema/workflow.schema.js';
import type { WorkflowRepository } from '../workflow.repository.js';
import {
  ValidationFailedError,
  NoAdminApprovalError,
  ApprovalExpiredError,
  InstanceNotActiveError,
  StepKeyNotFoundInTargetVersionError,
  InvalidWorkflowTransitionError,
} from '../../../errors/domain/workflow.js';
import { resolveNextStep, type StepResolutionDeps } from './step-resolution.js';

export interface AdminOperationsDeps {
  db: TxOrDb;
  workflowRepository: WorkflowRepository;
}

/**
 * bypassStep-specific deps. Extends AdminOperationsDeps with the full
 * StepResolutionDeps shape, since bypassStep forwards into resolveNextStep
 * (B4 §3.3) after marking the current step bypassed. The other three
 * functions in this file (cancelInstance, migrateInstance, reverseMigration)
 * do not call resolveNextStep and must keep using the narrower
 * AdminOperationsDeps — do not widen that shared interface for this fix.
 */
export interface BypassStepDeps extends AdminOperationsDeps {
  documentsService: StepResolutionDeps['documentsService'];
  eventBus: StepResolutionDeps['eventBus'];
  orgService: StepResolutionDeps['orgService'];
  delegationService: StepResolutionDeps['delegationService'];
  iamService: StepResolutionDeps['iamService'];
  getApprovalGrant: (instanceId: string, versionId: string) => ReturnType<WorkflowRepository['getApprovalGrant']>;
  markApprovalGrantUsed: (grantId: string) => ReturnType<WorkflowRepository['markApprovalGrantUsed']>;
}

export async function cancelInstance(
  instanceId: string,
  actorId: string,
  reason: string,
  deps: AdminOperationsDeps,
): Promise<void> {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationFailedError('cancellation reason must not be empty');
  }

  await deps.db.transaction(async (trxParams) => {
    const trx = trxParams as any as AppDb;
    // Throws InvalidWorkflowTransitionError (CONFLICT) if already completed/cancelled.
    await deps.workflowRepository.updateInstanceStatus(instanceId, 'cancelled', new Date(), trx);

    await deps.workflowRepository.cancelActiveAndPendingStepInstancesForInstance(instanceId, trx);

    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId,
        eventType: 'workflow.instance.cancelled',
        actorType: 'user',
        actorId,
        payload: {
          instance_id: instanceId,
          cancelled_by: actorId,
          cancellation_reason: reason,
        },
      },
      trx,
    );
  });
}

export async function bypassStep(
  stepInstanceId: string,
  actorId: string,
  bypassReason: string,
  comment: string,
  outcomeCode: string,
  deps: BypassStepDeps,
): Promise<void> {
  if (!comment || comment.trim().length === 0) {
    throw new ValidationFailedError('bypass comment must not be empty');
  }
  if (!outcomeCode || outcomeCode.trim().length === 0) {
    throw new ValidationFailedError('bypass outcomeCode must not be empty');
  }

  await deps.db.transaction(async (trxParams) => {
    const trx = trxParams as any as AppDb;
    const stepInstance = await deps.workflowRepository.getStepInstanceById(stepInstanceId, trx);
    if (!stepInstance || stepInstance.status !== 'active') {
      throw new InvalidWorkflowTransitionError(
        `Cannot bypass a step instance that is not active (current: ${stepInstance?.status ?? 'not found'}).`,
      );
    }

    const instance = await deps.workflowRepository.getInstanceById(stepInstance.instanceId, trx);
    if (!instance) throw new Error(`Instance ${stepInstance.instanceId} not found`);

    const updatedStepInstance = await deps.workflowRepository.updateStepInstance(
      stepInstanceId,
      {
        status: 'bypassed',
        bypassedAt: new Date(),
        bypassedBy: actorId,
        bypassReason,
        outcomeComment: comment,
      },
      trx,
    );

    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        stepInstanceId,
        eventType: 'workflow.step.bypassed',
        actorType: 'user',
        actorId,
        payload: {
          instance_id: instance.id,
          step_instance_id: stepInstanceId,
          bypass_reason: bypassReason,
          bypassed_by: actorId,
        },
      },
      trx,
    );

    // B4 invariant #12: if outcomeCode doesn't match an outcome filter in target version, resolveNextStep
    // will leave the instance stuck and emit workflow.instance.stuck.
    await resolveNextStep(instance, updatedStepInstance, outcomeCode, deps, trx);
  });
}

export async function migrateInstance(
  instanceId: string,
  targetVersionId: string,
  actorId: string,
  reason: string,
  deps: AdminOperationsDeps,
): Promise<{ migrationId: string; reversibleUntil: Date }> {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationFailedError('migration reason must not be empty');
  }

  return await deps.db.transaction(async (trxParams) => {
    const trx = trxParams as any as AppDb;
    const instance = await deps.workflowRepository.getInstanceById(instanceId, trx);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    if (instance.status !== 'active') {
      throw new InstanceNotActiveError(
        `Cannot migrate instance that is not active (current: ${instance.status}).`,
      );
    }

    // 1. targetVersionId must be a published version for the same definition_id
    const targetVersionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
      targetVersionId,
      trx,
    );
    if (!targetVersionData) throw new Error(`Target version ${targetVersionId} not found`);
    if (!targetVersionData.version.publishedAt) {
      throw new ValidationFailedError(`Target version ${targetVersionId} is not published`);
    }

    const currentVersionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
      instance.definitionVersionId,
      trx,
    );
    if (!currentVersionData)
      throw new Error(`Current version ${instance.definitionVersionId} not found`);

    if (targetVersionData.version.definitionId !== currentVersionData.version.definitionId) {
      throw new ValidationFailedError(`Target version belongs to a different definition`);
    }

    // 2. City Administrator approval record
    const approvalGrant = await deps.workflowRepository.getApprovalGrant(
      instanceId,
      targetVersionId,
      trx,
    );

    if (!approvalGrant) {
      throw new NoAdminApprovalError('No admin approval grant found for this instance migration');
    }

    if (new Date(approvalGrant.expiresAt).getTime() < Date.now()) {
      throw new ApprovalExpiredError('Admin approval grant has expired');
    }

    // Load active step instances
    const activeStepInstances = await deps.workflowRepository.getActiveStepInstancesForInstance(
      instanceId,
      trx,
    );

    // Step mapping
    const stepMapping: Record<string, string> = {}; // { oldStepInstanceId: newStepId }
    const missingKeys: string[] = [];

    const currentStepsById = new Map(currentVersionData.steps.map((s) => [s.id, s]));

    for (const activeStepInst of activeStepInstances) {
      const oldStep = currentStepsById.get(activeStepInst.stepId);
      if (!oldStep) throw new Error(`Step ${activeStepInst.stepId} not found in current version`);

      const newStep = targetVersionData.steps.find((s) => s.stepKey === oldStep.stepKey);
      if (!newStep) {
        missingKeys.push(oldStep.stepKey);
      } else {
        stepMapping[activeStepInst.id] = newStep.id;
      }
    }

    if (missingKeys.length > 0) {
      throw new StepKeyNotFoundInTargetVersionError(missingKeys);
    }

    // Context compatibility check (NO-OP)
    // [Inference] no mechanism exists in steps.config or elsewhere to declare required context keys per step;
    // B4 §7.3 step 4 assumes one exists without specifying it. This NO-OP passes vacuously until such a mechanism
    // and its DDL are defined — likely requires an H1/C1 decision, not just an engine change.

    // Emit migration.started
    const startedEventPayload = {
      instance_id: instanceId,
      from_version_id: instance.definitionVersionId,
      to_version_id: targetVersionId,
      actor_id: actorId,
      reason,
      step_mapping: stepMapping,
    };
    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId,
        eventType: 'workflow.instance.migration.started',
        actorType: 'user',
        actorId,
        payload: startedEventPayload,
      },
      trx,
    );

    // ONLY function allowed to write definition_version_id
    await deps.workflowRepository.migrateInstanceVersion(instanceId, targetVersionId, trx);

    for (const activeStepInst of activeStepInstances) {
      const newStepId = stepMapping[activeStepInst.id];
      if (newStepId) {
        await deps.workflowRepository.updateStepInstance(
          activeStepInst.id,
          { stepId: newStepId },
          trx,
        );
      }
    }

    await deps.workflowRepository.markApprovalGrantUsed(approvalGrant.id, trx);

    const completedAt = new Date();
    const completedEvent = await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId,
        eventType: 'workflow.instance.migration.completed',
        actorType: 'system',
        actorId: null,
        payload: {
          instance_id: instanceId,
          from_version_id: instance.definitionVersionId,
          to_version_id: targetVersionId,
        },
      },
      trx,
    );

    // B4 invariant #12: defensive check.
    let isStuck = false;
    for (const activeStepInst of activeStepInstances) {
      const newStepId = stepMapping[activeStepInst.id];
      const rules = targetVersionData.transitionRules.filter((r) => r.fromStepId === newStepId);
      for (const rule of rules) {
        const targetStepExists = targetVersionData.steps.some((s) => s.id === rule.toStepId);
        if (!targetStepExists) {
          isStuck = true;
          break;
        }
      }
      if (isStuck) break;
    }

    if (isStuck) {
      await deps.workflowRepository.updateInstanceStatus(instanceId, 'stuck', undefined, trx);
      await deps.workflowRepository.createWorkflowEvent(
        {
          instanceId,
          eventType: 'workflow.instance.stuck',
          actorType: 'system',
          actorId: null,
          payload: {
            instance_id: instanceId,
            reason: 'Migration resulted in stale transition references (invariant #12 violation).',
          },
        },
        trx,
      );
    }

    const reversibleUntil = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
    return { migrationId: completedEvent.id, reversibleUntil };
  });
}

export async function reverseMigration(
  instanceId: string,
  actorId: string,
  reversalReason: string,
  originalMigrationEventId: string,
  deps: AdminOperationsDeps,
): Promise<void> {
  if (!reversalReason || reversalReason.trim().length === 0) {
    throw new ValidationFailedError('reversal reason must not be empty');
  }

  await deps.db.transaction(async (trxParams) => {
    const trx = trxParams as any as AppDb;
    // Because we do not have a dedicated method for getting by ID on workflowRepository,
    // we use a cast or raw query if it doesn't exist.
    let originalEvent: any = await (deps.workflowRepository as any).getWorkflowEventById?.(
      originalMigrationEventId,
      trx,
    );
    if (!originalEvent) {
      const results = await trx
        .select()
        .from(workflowEvents)
        .where(eq(workflowEvents.id, originalMigrationEventId))
        .limit(1);
      originalEvent = results[0];
    }

    if (!originalEvent || originalEvent.eventType !== 'workflow.instance.migration.completed') {
      throw new ValidationFailedError('Invalid original migration event ID');
    }

    const completedAt = originalEvent.createdAt;
    const now = new Date();
    const reversibleUntil = new Date(completedAt.getTime() + 24 * 60 * 60 * 1000);
    const targetVersionId = (originalEvent.payload as any).from_version_id;

    if (now > reversibleUntil) {
      const approvalGrant = await deps.workflowRepository.getApprovalGrant(
        instanceId,
        targetVersionId,
        trx,
      );
      if (!approvalGrant) {
        throw new NoAdminApprovalError('No admin approval grant found for this reversal past 24h');
      }
      if (new Date(approvalGrant.expiresAt).getTime() < Date.now()) {
        throw new ApprovalExpiredError('Admin approval grant has expired');
      }
      await deps.workflowRepository.markApprovalGrantUsed(approvalGrant.id, trx);
    }

    const instance = await deps.workflowRepository.getInstanceById(instanceId, trx);
    if (!instance) throw new Error(`Instance ${instanceId} not found`);

    if (instance.status !== 'active') {
      throw new InstanceNotActiveError(
        `Cannot reverse migration of instance that is not active (current: ${instance.status}).`,
      );
    }

    const activeStepInstances = await deps.workflowRepository.getActiveStepInstancesForInstance(
      instanceId,
      trx,
    );

    const targetVersionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
      targetVersionId,
      trx,
    );
    if (!targetVersionData) throw new Error(`Target version ${targetVersionId} not found`);

    const stepMapping: Record<string, string> = {};
    const missingKeys: string[] = [];

    const currentVersionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
      instance.definitionVersionId,
      trx,
    );
    if (!currentVersionData)
      throw new Error(`Current version ${instance.definitionVersionId} not found`);
    const currentStepsById = new Map(currentVersionData.steps.map((s) => [s.id, s]));

    for (const activeStepInst of activeStepInstances) {
      const oldStep = currentStepsById.get(activeStepInst.stepId);
      if (!oldStep) throw new Error(`Step ${activeStepInst.stepId} not found in current version`);

      const newStep = targetVersionData.steps.find((s) => s.stepKey === oldStep.stepKey);
      if (!newStep) {
        missingKeys.push(oldStep.stepKey);
      } else {
        stepMapping[activeStepInst.id] = newStep.id;
      }
    }

    if (missingKeys.length > 0) {
      throw new StepKeyNotFoundInTargetVersionError(missingKeys);
    }

    await deps.workflowRepository.migrateInstanceVersion(instanceId, targetVersionId, trx);

    for (const activeStepInst of activeStepInstances) {
      const newStepId = stepMapping[activeStepInst.id];
      if (newStepId) {
        await deps.workflowRepository.updateStepInstance(
          activeStepInst.id,
          { stepId: newStepId },
          trx,
        );
      }
    }

    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId,
        eventType: 'workflow.instance.migration.reversed',
        actorType: 'user',
        actorId,
        payload: {
          instance_id: instanceId,
          actor_id: actorId,
          reversal_reason: reversalReason,
          original_migration_event_id: originalMigrationEventId,
        },
      },
      trx,
    );

    let isStuck = false;
    for (const activeStepInst of activeStepInstances) {
      const newStepId = stepMapping[activeStepInst.id];
      const rules = targetVersionData.transitionRules.filter((r) => r.fromStepId === newStepId);
      for (const rule of rules) {
        const targetStepExists = targetVersionData.steps.some((s) => s.id === rule.toStepId);
        if (!targetStepExists) {
          isStuck = true;
          break;
        }
      }
      if (isStuck) break;
    }

    if (isStuck) {
      await deps.workflowRepository.updateInstanceStatus(instanceId, 'stuck', undefined, trx);
      await deps.workflowRepository.createWorkflowEvent(
        {
          instanceId,
          eventType: 'workflow.instance.stuck',
          actorType: 'system',
          actorId: null,
          payload: {
            instance_id: instanceId,
            reason:
              'Migration reversal resulted in stale transition references (invariant #12 violation).',
          },
        },
        trx,
      );
    }
  });
}
