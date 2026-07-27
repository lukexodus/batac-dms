import type { InstanceRow } from './types.js';
import type { WorkflowRepository } from '../workflow.repository.js';
import type { DocumentsPublicAPI } from '../../documents/documents.types.js';
import type { OrgService, DelegationService } from '../../organization/organization.types.js';
import type { IamPublicAPI } from '../../iam/iam.types.js';
import type { EventBus } from '@batac/shared';
import type { AppDb, TxOrDb } from '../../../db.js';
import { resolveAssignees } from './assignee-resolution.js';
import { resolveNextStep } from './step-resolution.js';

import { eq, and, isNotNull } from 'drizzle-orm';
import { definitionVersions, definitions } from '@batac/database/schema/workflow.schema.js';

export interface CreateInstanceDeps {
  db: TxOrDb;
  workflowRepository: WorkflowRepository;
  documentsService: DocumentsPublicAPI;
  orgService: OrgService;
  delegationService: DelegationService;
  iamService: IamPublicAPI;
  eventBus: EventBus;
}

/**
 * Creates a new workflow instance (B4 §3.2).
 */
export async function createInstance(
  documentId: string,
  definitionId: string,
  actorId: string,
  deps: CreateInstanceDeps,
): Promise<InstanceRow> {
  const versionDataResult = await deps.db
    .select({
      id: definitionVersions.id,
      isActive: definitions.isActive,
    })
    .from(definitionVersions)
    .innerJoin(definitions, eq(definitions.id, definitionVersions.definitionId))
    .where(
      and(
        eq(definitionVersions.definitionId, definitionId),
        eq(definitionVersions.isCurrent, true),
        isNotNull(definitionVersions.publishedAt),
      ),
    )
    .limit(1)
    .then((res) => res[0]);

  if (!versionDataResult || !versionDataResult.isActive) {
    throw new Error('NO_ACTIVE_VERSION');
  }

  const versionId = versionDataResult.id;

  return await deps.db.transaction(async (trx: any) => {
    let requiresPublication = false;
    let documentTypeCode = 'UNKNOWN'; // Fallback
    try {
      const doc = await deps.documentsService.getDocumentById(documentId);
      if (doc) {
        documentTypeCode = doc.documentTypeCode;
        requiresPublication = doc.hasPenaltyProvision ?? false;
      } else {
        console.warn(`getDocumentById returned null for documentId ${documentId}`);
      }
    } catch (err) {
      console.warn(`Failed to resolve document ${documentId}:`, err);
    }

    const now = new Date();
    const slaDeadline = new Date(now.getTime());
    slaDeadline.setDate(slaDeadline.getDate() + 9);

    const instance = await deps.workflowRepository.createInstance(
      {
        definitionVersionId: versionId,
        documentId,
        status: 'active',
        createdBy: actorId,
        context: {
          document_id: documentId,
          document_type: documentTypeCode,
          created_by: actorId,
          certified_urgent: false,
          certified_urgent_document_id: null,
          sla_paused: false,
          requires_publication: requiresPublication,
        },
        slaDeadline,
      },
      trx,
    );

    const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(versionId, trx);
    if (!versionData) throw new Error('NO_ACTIVE_VERSION');

    const startSteps = versionData.steps.filter((s) => s.isStart);
    if (startSteps.length !== 1) {
      throw new Error('INVALID_DEFINITION: Exactly one start step is required.');
    }
    const startStep = startSteps[0]!;

    if (startStep.stepType === 'parallel_split' || startStep.stepType === 'parallel_join') {
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
            stepId: startStep.id,
            errorCode: 'STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1',
            errorMessage: 'parallel_split and parallel_join are Phase 2 reserved step types',
          },
        },
        trx,
      );
      throw new Error('STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1');
    }

    const stepInstance = await deps.workflowRepository.createStepInstance(
      {
        instanceId: instance.id,
        stepId: startStep.id,
        status: 'active',
        startedAt: now,
      },
      trx,
    );

    const config = (startStep.config as Record<string, any>) || {};
    let assignees = [];
    if (config['assignee']) {
      assignees = await resolveAssignees(
        config['assignee'],
        instance.context as Record<string, any>,
        deps,
      );
      await deps.workflowRepository.updateStepInstance(
        stepInstance.id,
        { assignedTo: assignees },
        trx,
      );
    }

    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        eventType: 'workflow.instance.created',
        actorType: 'user',
        actorId: actorId,
        payload: {
          instanceId: instance.id,
          documentId,
          documentType: documentTypeCode,
          definitionVersionId: versionId,
        },
      },
      trx,
    );

    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        eventType: 'workflow.step.started',
        actorType: 'system', // step started by system
        actorId: null,
        payload: {
          instanceId: instance.id,
          stepInstanceId: stepInstance.id,
          stepType: startStep.stepType,
          stepKey: startStep.stepKey,
          documentId,
          assignedTo: null,
          dueAt: null,
        },
      },
      trx,
    );

    if (startStep.stepType === 'decision' || startStep.stepType === 'notification') {
      await deps.workflowRepository.updateStepInstance(
        stepInstance.id,
        { status: 'completed', completedAt: new Date(), outcome: 'DECISION_MADE' },
        trx,
      );
      await resolveNextStep(instance, stepInstance, 'DECISION_MADE', deps, trx);
    }

    return instance;
  });
}
