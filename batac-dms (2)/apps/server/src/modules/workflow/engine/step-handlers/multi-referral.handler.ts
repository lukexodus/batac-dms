import type { InstanceRow, StepInstanceRow } from '../types.js';
import type { WorkflowRepository } from '../../workflow.repository.js';
import type { DbTransaction } from '../../../documents/documents.types.js';
import { resolveNextStep, type StepResolutionDeps } from '../step-resolution.js';

export interface MultiReferralHandlerDeps extends StepResolutionDeps {
  workflowRepository: WorkflowRepository;
}

export async function submitCommitteeReport(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  committeeId: string,
  actorId: string,
  contributionDocId: string,
  deps: MultiReferralHandlerDeps,
  trx?: DbTransaction
): Promise<void> {
  if (stepInstance.status !== 'active') {
    throw new Error('CONFLICT: step is not active');
  }

  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx as any
  );
  if (!versionData) throw new Error('NO_ACTIVE_VERSION');
  
  const stepDef = versionData.steps.find(s => s.id === stepInstance.stepId);
  if (!stepDef || stepDef.stepType !== 'multi_referral') {
    throw new Error('CONFLICT: step is not a multi_referral step');
  }

  const metadata = (stepInstance.metadata as Record<string, any>) || {};
  const assignedCommittees = (metadata['assigned_committees'] as Array<{ committee_id: string }>) || [];
  
  const isAssigned = assignedCommittees.some(c => c.committee_id === committeeId);
  if (!isAssigned) {
    throw new Error('FORBIDDEN: committee is not assigned to this step');
  }

  const submissions = (metadata['submissions'] as Array<any>) || [];
  const alreadySubmitted = submissions.some(s => s.committee_id === committeeId);
  if (alreadySubmitted) {
    throw new Error('CONFLICT: committee has already submitted');
  }

  // Append submission
  const now = new Date();
  const newSubmission = {
    committee_id: committeeId,
    submitted_by: actorId,
    submitted_at: now.toISOString(),
    contribution_document_id: contributionDocId,
    missed: false,
  };

  submissions.push(newSubmission);
  
  const isLast = submissions.length >= assignedCommittees.length;
  if (isLast) {
    metadata['all_submitted_at'] = now.toISOString();
  }
  metadata['submissions'] = submissions;

  await deps.workflowRepository.updateStepInstance(
    stepInstance.id,
    { metadata },
    trx as any
  );

  await deps.workflowRepository.createWorkflowEvent(
    {
      instanceId: instance.id,
      eventType: 'workflow.multi_referral.committee_submitted',
      actorType: 'user',
      actorId: actorId,
      payload: {
        instanceId: instance.id,
        stepInstanceId: stepInstance.id,
        committeeId,
        contributionDocumentId: contributionDocId,
      },
    },
    trx as any
  );

  if (isLast) {
    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        eventType: 'workflow.multi_referral.all_submitted',
        actorType: 'system',
        actorId: null,
        payload: {
          instanceId: instance.id,
          stepInstanceId: stepInstance.id,
          allSubmittedAt: metadata['all_submitted_at'],
        },
      },
      trx as any
    );
  }
}

export async function submitStepMultiReferral(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  actorId: string,
  actorType: 'user' | 'scheduler' | 'system',
  outcome: string,
  comment: string | null,
  deps: MultiReferralHandlerDeps,
  trx?: DbTransaction
): Promise<void> {
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

  if (outcome === 'BYPASSED_CERTIFIED_URGENT' && actorType === 'user') {
    throw new Error('FORBIDDEN: BYPASSED_CERTIFIED_URGENT cannot be set by user');
  }

  const metadata = (stepInstance.metadata as Record<string, any>) || {};
  const config = (stepDef.config as Record<string, any>) || {};
  const assignedCommittees = (metadata['assigned_committees'] as Array<{ committee_id: string }>) || [];
  const submissions = (metadata['submissions'] as Array<any>) || [];

  const now = new Date();
  
  if (outcome === 'REPORT_ACCEPTED') {
    // Requires ALL committees to have submitted (or manual_advance)
    if (metadata['manual_advance'] !== true) {
      if (submissions.length < assignedCommittees.length) {
        const err: any = new Error('CONFLICT: all assigned committees must submit before report acceptance');
        err.cause = 'REQUIRE_ALL_COMMITTEE_SIGNATURES_VIOLATED';
        throw err;
      }
    }

    metadata['secretary_accepted_at'] = now.toISOString();
    metadata['secretary_accepted_by'] = actorId;

    // Update instance context
    if (metadata['second_reading_eligible_date']) {
      const context = { ...(instance.context as Record<string, any>) };
      context['second_reading_eligible_date'] = metadata['second_reading_eligible_date'];
      await deps.workflowRepository.updateInstanceContext(instance.id, context, trx as any);
      // Wait, updateInstanceContext merges using ||, so this is fine.
    }

    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      {
        status: 'completed',
        outcome,
        outcomeComment: comment,
        completedAt: now,
        metadata
      },
      trx as any
    );

  } else if (outcome === 'SECRETARY_ADVANCED') {
    if (config['allow_secretary_advance'] !== true) {
      throw new Error('CONFLICT: secretary advance not allowed');
    }
    if (!comment || comment.trim() === '') {
      throw new Error('COMMENT_REQUIRED: comment required for SECRETARY_ADVANCED');
    }

    const missingCommitteeIds = [];
    for (const ac of assignedCommittees) {
      if (!submissions.some(s => s.committee_id === ac.committee_id)) {
        missingCommitteeIds.push(ac.committee_id);
        submissions.push({
          committee_id: ac.committee_id,
          submitted_by: null,
          submitted_at: now.toISOString(),
          contribution_document_id: null,
          missed: true,
        });
      }
    }

    metadata['submissions'] = submissions;
    metadata['manual_advance'] = true;
    metadata['manual_advance_comment'] = comment;
    metadata['manual_advance_by'] = actorId;

    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      {
        status: 'completed',
        outcome,
        outcomeComment: comment,
        completedAt: now,
        metadata
      },
      trx as any
    );

    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        eventType: 'workflow.multi_referral.secretary_advanced',
        actorType,
        actorId,
        payload: {
          stepInstanceId: stepInstance.id,
          actorId,
          comment,
          missingCommitteeIds,
          metadataSnapshot: metadata,
        }
      },
      trx as any
    );

  } else if (outcome === 'BYPASSED_CERTIFIED_URGENT') {
    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      {
        status: 'completed',
        outcome,
        outcomeComment: comment,
        completedAt: now,
      },
      trx as any
    );
  } else {
    throw new Error(`VALIDATION_FAILED: outcome ${outcome} is not a valid multi_referral completion outcome`);
  }

  await deps.workflowRepository.createWorkflowEvent(
    {
      instanceId: instance.id,
      eventType: 'workflow.step.completed',
      actorType,
      actorId,
      payload: {
        instanceId: instance.id,
        stepInstanceId: stepInstance.id,
        stepId: stepDef.id,
        stepType: stepDef.stepType,
        outcome,
        comment,
      },
    },
    trx as any
  );

  const updatedStepInstance = await deps.workflowRepository.getStepInstanceById(stepInstance.id, trx as any);
  if (!updatedStepInstance) throw new Error('Failed to retrieve updated step instance');

  await resolveNextStep(instance, updatedStepInstance, outcome, deps, trx);
}

export async function updateAssignedCommittees(
  stepInstance: StepInstanceRow,
  newAssignedCommittees: Array<{ committee_id: string }>,
  isBypass: boolean,
  comment: string | null,
  deps: MultiReferralHandlerDeps,
  trx?: DbTransaction
): Promise<void> {
  const metadata = (stepInstance.metadata as Record<string, any>) || {};
  const submissions = (metadata['submissions'] as Array<any>) || [];
  
  if (submissions.length > 0 && !isBypass) {
    const err: any = new Error('CONFLICT: committee list is locked after first submission');
    err.cause = 'COMMITTEE_LIST_LOCKED';
    throw err;
  }

  if (isBypass && (!comment || comment.trim() === '')) {
    throw new Error('COMMENT_REQUIRED: bypass requires a mandatory comment');
  }

  metadata['assigned_committees'] = newAssignedCommittees;
  
  await deps.workflowRepository.updateStepInstance(
    stepInstance.id,
    { metadata },
    trx as any
  );
}
