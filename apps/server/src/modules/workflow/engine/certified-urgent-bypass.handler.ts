import type { WorkflowRepository } from '../workflow.repository.js';
import type { AppDb } from '../../../db.js';
import { resolveNextStep } from './step-resolution.js';

export interface CertifiedUrgentBypassDeps {
  db: AppDb;
  workflowRepository: WorkflowRepository;
  // include other deps needed by resolveNextStep, they will be provided by the consumer wrapper
  documentsService: any;
  eventBus: any;
  orgService: any;
  delegationService: any;
}

interface CertificationUrgencyPayload {
  certificationDocumentId: string;
  associatedInstanceIds: string[];
  loggedBy: string;
  loggedAt: string;
}

export async function processCertificationUrgencyEvent(
  payload: CertificationUrgencyPayload,
  deps: CertifiedUrgentBypassDeps
): Promise<void> {
  const { certificationDocumentId, associatedInstanceIds, loggedBy } = payload;

  for (const instanceId of associatedInstanceIds) {
    try {
      await deps.db.transaction(async (trx) => {
        const instance = await deps.workflowRepository.getInstanceById(instanceId, trx as any);
        if (!instance) {
          throw new Error(`Instance ${instanceId} not found`);
        }

        if (instance.status !== 'active') {
          await deps.workflowRepository.createWorkflowEvent(
            {
              instanceId,
              eventType: 'workflow.certification_urgency.already_inactive',
              actorType: 'system',
              actorId: null,
              payload: {
                instanceId,
                instanceStatus: instance.status,
                certificationDocumentId,
              },
            },
            trx as any
          );
          return;
        }

        // Set context
        const patch = {
          certified_urgent: true,
          certified_urgent_document_id: certificationDocumentId,
        };
        await deps.workflowRepository.updateInstanceContext(instanceId, patch, trx as any);

        await deps.workflowRepository.createWorkflowEvent(
          {
            instanceId,
            eventType: 'workflow.context.updated',
            actorType: 'user',
            actorId: loggedBy,
            payload: {
              instanceId,
              updatedKeys: ['certified_urgent', 'certified_urgent_document_id'],
              previousValues: {
                certified_urgent: false,
                certified_urgent_document_id: null,
              },
              newValues: patch,
              actorId: loggedBy,
            },
          },
          trx as any
        );

        // We must re-fetch instance to pass the updated one to resolveNextStep, if Case A fires
        const updatedInstance = await deps.workflowRepository.getInstanceById(instanceId, trx as any);
        if (!updatedInstance) throw new Error('Failed to retrieve updated instance');

        const stepInstance = await deps.workflowRepository.getMultiReferralStepInstanceForInstance(instanceId, trx as any);
        if (!stepInstance) {
          throw new Error(`No multi_referral step found for instance ${instanceId}`);
        }

        if (stepInstance.status === 'active') {
          // CASE A
          const bypassedAt = new Date();
          await deps.workflowRepository.updateStepInstance(
            stepInstance.id,
            {
              status: 'bypassed',
              bypassedAt,
              bypassedBy: null,
              bypassReason: 'CERTIFIED_URGENT',
              outcome: 'BYPASSED_CERTIFIED_URGENT',
            },
            trx as any
          );

          await deps.workflowRepository.createWorkflowEvent(
            {
              instanceId,
              eventType: 'workflow.step.bypassed',
              actorType: 'system',
              actorId: null,
              payload: {
                instanceId,
                stepInstanceId: stepInstance.id,
                bypassReason: 'CERTIFIED_URGENT',
                bypassedBy: null,
              },
            },
            trx as any
          );

          await deps.workflowRepository.createWorkflowEvent(
            {
              instanceId,
              eventType: 'workflow.certification_urgency.bypass_applied',
              actorType: 'system',
              actorId: null,
              payload: {
                instanceId,
                stepInstanceId: stepInstance.id,
                certificationDocumentId,
              },
            },
            trx as any
          );

          const updatedStepInstance = await deps.workflowRepository.getStepInstanceById(stepInstance.id, trx as any);
          if (!updatedStepInstance) throw new Error('Failed to retrieve updated step instance');

          await resolveNextStep(updatedInstance, updatedStepInstance, 'BYPASSED_CERTIFIED_URGENT', deps, trx as any);

        } else if (stepInstance.status === 'pending') {
          // CASE B
          await deps.workflowRepository.createPendingBypass(
            {
              instanceId,
              stepKey: 'committee_referral',
              certificationDocumentId,
            },
            trx as any
          );

          await deps.workflowRepository.createWorkflowEvent(
            {
              instanceId,
              eventType: 'workflow.certification_urgency.bypass_deferred',
              actorType: 'system',
              actorId: null,
              payload: {
                instanceId,
                certificationDocumentId,
              },
            },
            trx as any
          );

        } else if (stepInstance.status === 'completed' || stepInstance.status === 'bypassed' || stepInstance.status === 'cancelled') {
          // CASE C
          await deps.workflowRepository.createWorkflowEvent(
            {
              instanceId,
              eventType: 'workflow.certification_urgency.already_past_referral',
              actorType: 'system',
              actorId: null,
              payload: {
                instanceId,
                certificationDocumentId,
              },
            },
            trx as any
          );
        }
      });
    } catch (error) {
      // One failure should not block others. Log the error.
      console.error(`Failed to process Certified Urgent bypass for instance ${instanceId}:`, error);
    }
  }
}
