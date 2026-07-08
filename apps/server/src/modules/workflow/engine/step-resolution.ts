import type { InstanceRow, StepInstanceRow } from './types.js';
import type { WorkflowRepository } from '../workflow.repository.js';
import type { EventBus } from '@batac/shared';
import { evaluateTransitionRules } from './transition-evaluation.js';
import { resolveAssignees } from './assignee-resolution.js';
import type { OrgService, DelegationService } from '../../organization/organization.types.js';
import type { DbTransaction } from '../../documents/documents.types.js';

export interface StepResolutionDeps {
  workflowRepository: WorkflowRepository;
  eventBus: EventBus;
  orgService: OrgService;
  delegationService: DelegationService;
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
  trx?: DbTransaction
): Promise<void> {
  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx as any
  );

  if (!versionData) {
    throw new Error(`Definition version ${instance.definitionVersionId} not found.`);
  }

  const { steps, transitionRules } = versionData;
  const currentStep = steps.find(s => s.id === currentStepInstance.stepId);
  if (!currentStep) {
    throw new Error(`Step ${currentStepInstance.stepId} not found in definition version.`);
  }

  const rulesForCurrentStep = transitionRules.filter(r => r.fromStepId === currentStep.id);
  const context = (instance.context as Record<string, any>) || {};
  
  const nextStepId = evaluateTransitionRules(rulesForCurrentStep, outcome, context);

  if (!nextStepId) {
    await deps.workflowRepository.updateInstanceStatus(instance.id, 'stuck', undefined, trx as any);
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
      trx as any
    );
    return;
  }

  const nextStep = steps.find(s => s.id === nextStepId);
  if (!nextStep) {
    throw new Error(`Target step ${nextStepId} not found in definition version.`);
  }

  if (nextStep.stepType === 'termination') {
    // Termination execution is scoped to TASK-WF-006. 
  }

  const newStepInstance = await deps.workflowRepository.createStepInstance(
    {
      instanceId: instance.id,
      stepId: nextStep.id,
      status: 'active',
      startedAt: new Date(),
    },
    trx as any
  );

  const config = (nextStep.config as Record<string, any>) || {};
  let assignees = [];
  if (config['assignee']) {
    assignees = await resolveAssignees(config['assignee'], context, deps);
    await deps.workflowRepository.updateStepInstance(
      newStepInstance.id,
      { assignedTo: assignees },
      trx as any
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
        stepId: nextStep.id,
        stepType: nextStep.stepType,
        dueAt: null,
      },
    },
    trx as any
  );

  if (nextStep.stepType === 'decision' || nextStep.stepType === 'notification') {
    await deps.workflowRepository.updateStepInstance(
      newStepInstance.id,
      { status: 'completed', completedAt: new Date(), outcome: 'DECISION_MADE' },
      trx as any
    );
    await resolveNextStep(instance, newStepInstance, 'DECISION_MADE', deps, trx as any);
  }
}
