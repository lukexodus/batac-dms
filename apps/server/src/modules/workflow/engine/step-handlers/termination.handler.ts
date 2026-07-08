import type { InstanceRow, StepInstanceRow } from '../types.js';
import type { DbTransaction } from '../../../documents/documents.types.js';
import type { WorkflowRepository } from '../../workflow.repository.js';
import type { DocumentsPublicAPI } from '../../../documents/documents.types.js';
import type { EventBus } from '@batac/shared';
import type { AppDb } from '../../../../db.js';
import { stepInstances } from '@batac/database/schema/workflow.schema.js';
import { eq, and } from 'drizzle-orm';

export interface TerminationHandlerDeps {
  db: AppDb;
  workflowRepository: WorkflowRepository;
  documentsService: DocumentsPublicAPI;
  eventBus: EventBus;
}

export async function executeTerminationStep(
  instance: InstanceRow,
  stepInstance: StepInstanceRow,
  deps: TerminationHandlerDeps,
  trx?: DbTransaction
): Promise<void> {
  const versionData = await deps.workflowRepository.getDefinitionVersionWithSteps(
    instance.definitionVersionId,
    trx as any
  );
  if (!versionData) throw new Error('NO_ACTIVE_VERSION');

  const stepDef = versionData.steps.find(s => s.id === stepInstance.stepId);
  if (!stepDef) throw new Error('Step definition not found');

  const config = (stepDef.config as Record<string, any>) || {};
  const outcomeCode = config['outcome_code'] || 'COMPLETED';
  const finalDocumentStatus = config['final_document_status'] || null;

  const now = new Date();

  if (outcomeCode === 'CANCELLED') {
    // 1. Set all active step instances to cancelled
    // We don't have a specific repo method for mass-cancel, so we can do it via Drizzle query.
    // However, we should keep it within the repository if possible, or just run the query here.
    // Given the constraints, let's use the DB directly if we must, or add it to repository later.
    // For now, let's assume we can query them and update them one by one if mass update isn't available.
    
    // Actually, we can fetch active steps for the instance.
    const activeSteps = await deps.db.select({ id: stepInstances.id })
      .from(stepInstances)
      .where(
        and(
          eq(stepInstances.instanceId, instance.id),
          eq(stepInstances.status, 'active')
        )
      );

    for (const step of activeSteps) {
      await deps.workflowRepository.updateStepInstance(
        step.id,
        { status: 'cancelled', completedAt: now },
        trx as any
      );
    }

    // Mark instance as completed
    await deps.workflowRepository.updateInstanceStatus(instance.id, 'completed', now, trx as any);

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
        }
      },
      trx as any
    );

  } else if (outcomeCode === 'REPASSED') {
    // DO NOT set instances.status = 'Completed'
    // Set step_instances.status = 'Completed'
    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      { status: 'completed', completedAt: now, outcome: outcomeCode },
      trx as any
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
        }
      },
      trx as any
    );

  } else {
    // Standard terminal outcomes (APPROVED_AND_RELEASED, etc.)
    await deps.workflowRepository.updateStepInstance(
      stepInstance.id,
      { status: 'completed', completedAt: now, outcome: outcomeCode },
      trx as any
    );

    await deps.workflowRepository.updateInstanceStatus(instance.id, 'completed', now, trx as any);

    if (finalDocumentStatus) {
      try {
        // Transition document state
        // B2 specifies DocumentsPublicAPI has transitionState method
        if (typeof deps.documentsService.transitionState === 'function') {
          await deps.documentsService.transitionState(instance.documentId, finalDocumentStatus, 'SYSTEM', undefined, trx as any);
        }
      } catch (err) {
        console.error(`Failed to transition document ${instance.documentId} to ${finalDocumentStatus}:`, err);
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
        }
      },
      trx as any
    );
  }
}
