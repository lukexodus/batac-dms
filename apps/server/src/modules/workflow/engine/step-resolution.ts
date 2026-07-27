import type { InstanceRow, StepInstanceRow } from './types.js';
import type { WorkflowRepository } from '../workflow.repository.js';
import type { EventBus } from '@batac/shared';
import { evaluateTransitionRules } from './transition-evaluation.js';
import { resolveAssignees } from './assignee-resolution.js';
import type { OrgService, DelegationService } from '../../organization/organization.types.js';
import type { IamPublicAPI } from '../../iam/iam.types.js';
import type { DbTransaction } from '../../documents/documents.types.js';
import type { AppDb, TxOrDb } from '../../../db.js';
import type { DocumentsPublicAPI } from '../../documents/documents.types.js';

export interface StepResolutionDeps {
  db: TxOrDb;
  workflowRepository: WorkflowRepository;
  documentsService: DocumentsPublicAPI;
  eventBus: EventBus;
  orgService: OrgService;
  delegationService: DelegationService;
  iamService: IamPublicAPI;
}

/**
 * Executes step resolution algorithm (B4 §3.3).
 * Called after a step reaches a terminal status (e.g., completed or bypassed).
 */
export async function resolveNextStep(
  instance: InstanceRow,
  currentStepInstance: StepInstanceRow,
  outcome: string | null,
  deps: StepResolutionDeps,
  trx?: TxOrDb,
): Promise<void> {
  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx,
  );

  if (!versionData) {
    throw new Error(`Definition version ${instance.definitionVersionId} not found.`);
  }

  const { steps, transitionRules } = versionData;
  const currentStep = steps.find((s) => s.id === currentStepInstance.stepId);
  if (!currentStep) {
    throw new Error(`Step ${currentStepInstance.stepId} not found in definition version.`);
  }

  const rulesForCurrentStep = transitionRules.filter((r) => r.fromStepId === currentStep.id);
  const context = (instance.context as Record<string, any>) || {};

  const nextStepId = evaluateTransitionRules(rulesForCurrentStep, outcome, context);

  if (!nextStepId) {
    await deps.workflowRepository.updateInstanceStatus(instance.id, 'stuck', undefined, trx);
    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        eventType: 'workflow.instance.stuck',
        actorType: 'system',
        actorId: null,
        payload: {
          instanceId: instance.id,
          stepInstanceId: currentStepInstance.id,
          evaluatedRules: rulesForCurrentStep,
          contextSnapshot: context,
        },
      },
      trx,
    );
    return;
  }

  const nextStep = steps.find((s) => s.id === nextStepId);
  if (!nextStep) {
    throw new Error(`Target step ${nextStepId} not found in definition version.`);
  }

  if (nextStep.stepType === 'termination') {
    // Termination execution is scoped to TASK-WF-006.
  }

  if (nextStep.stepType === 'parallel_split' || nextStep.stepType === 'parallel_join') {
    await deps.workflowRepository.updateInstanceStatus(instance.id, 'stuck', undefined, trx);
    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        eventType: 'workflow.step.failed',
        actorType: 'system',
        actorId: null,
        payload: {
          instanceId: instance.id,
          stepInstanceId: 'NONE',
          stepId: nextStep.id,
          errorCode: 'STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1',
          errorMessage: 'parallel_split and parallel_join are Phase 2 reserved step types',
        },
      },
      trx,
    );
    throw new Error('STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1');
  }

  const newStepInstance = await deps.workflowRepository.createStepInstance(
    {
      instanceId: instance.id,
      stepId: nextStep.id,
      status: 'active',
      startedAt: new Date(),
    },
    trx,
  );

  const config = (nextStep.config as Record<string, any>) || {};
  let assignees: any[] = [];
  if (config['assignee']) {
    assignees = await resolveAssignees(config['assignee'], context, deps);
    await deps.workflowRepository.updateStepInstance(
      newStepInstance.id,
      { assignedTo: assignees },
      trx,
    );
  }

  await deps.workflowRepository.createWorkflowEvent(
    {
      instanceId: instance.id,
      eventType: 'workflow.step.started',
      actorType: 'system',
      actorId: null,
      payload: {
        instanceId: instance.id,
        stepInstanceId: newStepInstance.id,
        stepType: nextStep.stepType,
        stepKey: nextStep.stepKey,
        documentId: instance.documentId,
        // TODO(temporary placeholder): Needs clarification from Luke whether multiple
        // concurrent assignees are intended here. Reverting to single UUID to match B3 exactly.
        assignedTo: assignees.length > 0 ? assignees[0].user_id : null,
        dueAt: null,
      },
    },
    trx,
  );

  if (nextStep.stepType === 'multi_referral') {
    const pendingBypass = await deps.workflowRepository.getPendingBypassForInstance(
      instance.id,
      nextStep.stepKey,
      trx,
    );
    if (pendingBypass && !pendingBypass.appliedAt) {
      await deps.workflowRepository.markBypassApplied(
        pendingBypass.id,
        newStepInstance.id,
        trx,
      );

      await deps.workflowRepository.updateStepInstance(
        newStepInstance.id,
        {
          status: 'bypassed',
          bypassedAt: new Date(),
          bypassedBy: null,
          bypassReason: 'CERTIFIED_URGENT',
          outcome: 'BYPASSED_CERTIFIED_URGENT',
        },
        trx,
      );

      await deps.workflowRepository.createWorkflowEvent(
        {
          instanceId: instance.id,
          eventType: 'workflow.step.bypassed',
          actorType: 'system',
          actorId: null,
          payload: {
            instanceId: instance.id,
            stepInstanceId: newStepInstance.id,
            bypassReason: 'CERTIFIED_URGENT',
            bypassedBy: null,
          },
        },
        trx,
      );

      await deps.workflowRepository.createWorkflowEvent(
        {
          instanceId: instance.id,
          eventType: 'workflow.certification_urgency.bypass_applied',
          actorType: 'system',
          actorId: null,
          payload: {
            instanceId: instance.id,
            stepInstanceId: newStepInstance.id,
            certificationDocumentId: pendingBypass.certificationDocumentId,
          },
        },
        trx,
      );

      const bypassedStepInstance = await deps.workflowRepository.getStepInstanceById(
        newStepInstance.id,
        trx,
      );
      if (!bypassedStepInstance) throw new Error('Failed to retrieve bypassed step instance');

      await resolveNextStep(instance, bypassedStepInstance, 'BYPASSED_CERTIFIED_URGENT', deps, trx);
      return;
    }
  }

  if (
    nextStep.stepType === 'decision' ||
    nextStep.stepType === 'notification' ||
    nextStep.stepType === 'termination' ||
    config['auto_complete'] === true
  ) {
    if (nextStep.stepType === 'decision') {
      const { executeDecisionStep } = await import('./step-handlers/decision.handler.js');
      await executeDecisionStep(instance, newStepInstance, deps, trx);
    } else if (nextStep.stepType === 'notification') {
      const { executeNotificationStep } = await import('./step-handlers/notification.handler.js');
      await executeNotificationStep(instance, newStepInstance, deps, trx);
    } else if (nextStep.stepType === 'termination') {
      const { executeTerminationStep } = await import('./step-handlers/termination.handler.js');
      // Termination needs db from deps? StepResolutionDeps does not have db or documentsService.
      // I will need to update StepResolutionDeps and inject them from the top.
      // Wait, let's just pass deps as any to executeTerminationStep for now,
      // but I need to make sure those services are on deps.
      await executeTerminationStep(instance, newStepInstance, deps as any, trx);
    } else if (config['auto_complete'] === true) {
      const { autoCompleteActionStep } = await import('./step-handlers/action.handler.js');
      await autoCompleteActionStep(instance, newStepInstance, deps as any, trx);
    }
  }
}
