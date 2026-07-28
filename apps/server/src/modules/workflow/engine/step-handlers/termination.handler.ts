import type { InstanceRow, StepInstanceRow } from '../types.js';
import type { DbTransaction } from '../../../documents/documents.types.js';
import type { WorkflowRepository } from '../../workflow.repository.js';
import type { DocumentsPublicAPI } from '../../../documents/documents.types.js';
import type { EventBus } from '@batac/shared';
import type { AppDb, TxOrDb } from '../../../../db.js';

export interface TerminationHandlerDeps {
  db: TxOrDb;
  workflowRepository: WorkflowRepository;
  documentsService: DocumentsPublicAPI;
  eventBus: EventBus;
}

export async function executeTerminationStep(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  deps: TerminationHandlerDeps,
  trx?: TxOrDb,
): Promise<void> {
  const tx = trx || deps.db;
  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    tx,
  );
  if (!versionData) throw new Error('NO_ACTIVE_VERSION');

  const stepDef = versionData.steps.find((s) => s.id === stepInstance.stepId);
  if (!stepDef) throw new Error('Step definition not found');

  const config = (stepDef.config as Record<string, any>) || {};
  const outcomeCode = config['outcome_code'] || 'COMPLETED';
  const finalDocumentStatus = config['final_document_status'] || null;

  const now = new Date();

  if (outcomeCode === 'CANCELLED') {
    // Cancel all active AND pending step instances for this instance, atomically,
    // in the same transaction as the instance status update below.
    await deps.workflowRepository.cancelActiveAndPendingStepInstancesForInstance(
      instance.id,
      tx,
    );

    // Mark instance as completed
    await deps.workflowRepository.updateInstanceStatus(instance.id, 'completed', now, tx);

    // Emit workflow.instance.completed
    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        eventType: 'workflow.instance.completed',
        actorType: 'system',
        actorId: null,
        payload: {
          instanceId: instance.id,
          documentId: instance.documentId,
          outcomeCode: 'CANCELLED',
          finalDocumentStatus: null,
        },
      },
      tx,
    );
  } else if (outcomeCode === 'REPASSED') {
    // DO NOT set instances.status = 'Completed'
    // Set step_instances.status = 'Completed'
    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      { status: 'completed', completedAt: now, outcome: outcomeCode },
      trx,
    );

    // Emit workflow.instance.repassed
    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        eventType: 'workflow.instance.repassed',
        actorType: 'system',
        actorId: null,
        payload: {
          instanceId: instance.id,
          documentId: instance.documentId,
        },
      },
      trx,
    );
  } else {
    // Standard terminal outcomes (APPROVED_AND_RELEASED, etc.)
    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      { status: 'completed', completedAt: now, outcome: outcomeCode },
      tx,
    );

    await deps.workflowRepository.updateInstanceStatus(instance.id, 'completed', now, tx);

    if (finalDocumentStatus) {
      try {
        // Transition document state
        // B2 specifies DocumentsPublicAPI has transitionState method
        if (typeof deps.documentsService.transitionState === 'function') {
          if (finalDocumentStatus === 'archived') {
            const currentDoc = await deps.documentsService.getDocumentById(instance.documentId);
            if (currentDoc?.lifecycleState === 'completed') {
              // Chain-of-custody requirement: a document may only reach
              // 'archived' via 'released'. See TASK-WF-014 for the decision
              // record — do not widen VALID_TRANSITIONS or the DB trigger
              // to skip this hop instead of inserting it here.
              await deps.documentsService.transitionState(
                instance.documentId,
                'released',
                'SYSTEM',
                undefined,
                tx,
              );
            }
          }
          await deps.documentsService.transitionState(
            instance.documentId,
            finalDocumentStatus,
            'SYSTEM',
            undefined,
            tx,
          );
        }
      } catch (err) {
        console.error(
          `Failed to transition document ${instance.documentId} to ${finalDocumentStatus}:`,
          err,
        );
        // Prompt says "Call Documents.transitionState", if it fails it should probably fail the tx
        throw err;
      }
    }

    // Emit workflow.instance.completed
    await deps.workflowRepository.createWorkflowEvent(
      {
        instanceId: instance.id,
        eventType: 'workflow.instance.completed',
        actorType: 'system',
        actorId: null,
        payload: {
          instanceId: instance.id,
          documentId: instance.documentId,
          outcomeCode,
          finalDocumentStatus,
        },
      },
      tx,
    );
  }
}
