import type { InstanceRow, StepInstanceRow } from '../types.js';
import type { WorkflowRepository } from '../../workflow.repository.js';
import type { DbTransaction } from '../../../documents/documents.types.js';
import { resolveNextStep, type StepResolutionDeps } from '../step-resolution.js';

export interface ApprovalHandlerDeps extends StepResolutionDeps {
  workflowRepository: WorkflowRepository;
}

export async function submitStepApproval(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  actorId: string,
  actorType: 'user' | 'scheduler',
  outcome: string,
  comment: string | null,
  deps: ApprovalHandlerDeps,
  trx?: DbTransaction
): Promise<void> {
  // 1. Check status
  if (stepInstance.status !== 'active') {
    throw new Error('CONFLICT: step is not active');
  }

  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx as any
  );
  if (!versionData) throw new Error('NO_ACTIVE_VERSION');

  const stepDef = versionData.steps.find(s => s.id === stepInstance.stepId);
  if (!stepDef) throw new Error('Step definition not found');

  const config = (stepDef.config as Record<string, any>) || {};

  // 2. Verify outcome in config.allowed_outcomes
  const allowedOutcomes = (config['allowed_outcomes'] as string[]) || [];
  if (!allowedOutcomes.includes(outcome)) {
    throw new Error('VALIDATION_FAILED: outcome not allowed');
  }

  // 3. Scheduler-only guard
  if (outcome === 'LAPSED' && actorType !== 'scheduler') {
    const err: any = new Error('FORBIDDEN');
    err.cause = 'LAPSED_IS_SCHEDULER_ONLY';
    throw err;
  }
  if (outcome === 'DEEMED_APPROVED' && actorType !== 'scheduler') {
    const err: any = new Error('FORBIDDEN');
    err.cause = 'DEEMED_APPROVED_IS_SCHEDULER_ONLY';
    throw err;
  }

  // 4. Verify actorId in assigned_to
  if (actorType !== 'scheduler') {
    const assignedUsers = (stepInstance.assignedTo as Array<{ user_id: string }>) || [];
    const isAssigned = assignedUsers.some(a => a.user_id === actorId);
    if (!isAssigned) {
      throw new Error('FORBIDDEN: actor is not assigned to this step');
    }
  }

  const context = (instance.context as Record<string, any>) || {};

  // 5. Encoder != final approver
  if (config['is_final_approval'] === true && actorId === context['created_by']) {
    throw new Error('ENCODER_CANNOT_BE_FINAL_APPROVER');
  }

  // 6. Comment requirements
  const requireCommentOn = (config['require_comment_on'] as string[]) || ['REJECTED', 'RETURNED_FOR_REVISION'];
  if (requireCommentOn.includes(outcome)) {
    if (!comment || comment.trim() === '') {
      throw new Error('VALIDATION_FAILED: comment is required');
    }
  }

  // 7. Override vote threshold
  if (outcome === 'OVERRIDE_SUCCEEDED') {
    const voteCount = context['veto_override_vote_count'] || 0;
    if (voteCount < 8) {
      throw new Error('VALIDATION_FAILED: insufficient votes for override');
    }
  }
  if (outcome === 'OVERRIDE_FAILED') {
    const voteCount = context['veto_override_vote_count'] || 0;
    if (voteCount >= 8) {
      throw new Error('VALIDATION_FAILED: override failed but vote count is >= 8');
    }
  }

  // 8. OPERATIVE_IN_ITS_ENTIRETY guard
  if (outcome === 'OPERATIVE_IN_ITS_ENTIRETY') {
    if (context['document_type'] !== 'appropriation_ordinance') {
      throw new Error('OUTCOME_NOT_VALID_FOR_DOCUMENT_TYPE');
    }
  }

  // State change on success
  const now = new Date();
  
  if (outcome === 'RETURNED_FOR_REVISION') {
    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      { status: 'returned', completedAt: now, outcome, outcomeComment: comment },
      trx as any
    );
  } else {
    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      { status: 'completed', completedAt: now, outcome, outcomeComment: comment },
      trx as any
    );
  }

  await deps.workflowRepository.createWorkflowEvent(
    {
      instanceId: instance.id,
      eventType: 'workflow.step.completed',
      actorType: actorType,
      actorId: actorType === 'scheduler' ? null : actorId,
      payload: {
        instanceId: instance.id,
        stepInstanceId: stepInstance.id,
        stepId: stepDef.id,
        stepType: stepDef.stepType,
        outcome,
        comment,
      }
    },
    trx as any
  );

  const updatedStepInstance = await deps.workflowRepository.getStepInstanceById(stepInstance.id, trx as any);
  if (!updatedStepInstance) throw new Error('Failed to retrieve updated step instance');

  await resolveNextStep(instance, updatedStepInstance, outcome, deps, trx);
}
