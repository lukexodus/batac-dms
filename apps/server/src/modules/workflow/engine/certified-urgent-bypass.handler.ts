import type { EventPayloadMap } from '@batac/shared';
import { randomUUID } from 'node:crypto';
import type { WorkflowRepository } from '../workflow.repository.js';
import { resolveNextStep, type StepResolutionDeps } from './step-resolution.js';

export interface CertifiedUrgentBypassDeps extends StepResolutionDeps {
  workflowRepository: WorkflowRepository;
}

interface CertificationUrgencyPayload {
  certificationDocumentId: string;
  associatedInstanceIds: string[];
  loggedBy: string;
  loggedAt: string;
}

type BypassEmittedEvent = {
  [K in keyof EventPayloadMap]: {
    type: K;
    payload: EventPayloadMap[K];
    cityId: string;
  };
}[keyof EventPayloadMap];

export async function processCertificationUrgencyEvent(
  payload: CertificationUrgencyPayload,
  deps: CertifiedUrgentBypassDeps,
): Promise<void> {
  const { certificationDocumentId, associatedInstanceIds, loggedBy } = payload;

  for (const instanceId of associatedInstanceIds) {
    try {
      const emittedEvents: Array<BypassEmittedEvent> = [];

      await deps.db.transaction(async (trx) => {
        const instance = await deps.workflowRepository.getInstanceById(instanceId, trx);
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
            trx,
          );
          
          emittedEvents.push({
            type: 'workflow.certification_urgency.already_inactive',
            cityId: instance.cityId,
            payload: {
              instanceId,
              instanceStatus: instance.status,
              certificationDocumentId,
            }
          });
          return;
        }

        // Set context
        const patch = {
          certified_urgent: true,
          certified_urgent_document_id: certificationDocumentId,
        };
        await deps.workflowRepository.updateInstanceContext(instanceId, patch, trx);

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
          trx,
        );

        emittedEvents.push({
          type: 'workflow.context.updated',
          cityId: instance.cityId,
          payload: {
            instanceId,
            updatedKeys: ['certified_urgent', 'certified_urgent_document_id'],
            previousValues: {
              certified_urgent: false,
              certified_urgent_document_id: null,
            },
            newValues: patch,
            actorId: loggedBy,
          }
        });

        // We must re-fetch instance to pass the updated one to resolveNextStep, if Case A fires
        const updatedInstance = await deps.workflowRepository.getInstanceById(
          instanceId,
          trx,
        );
        if (!updatedInstance) throw new Error('Failed to retrieve updated instance');

        const stepInstance = await deps.workflowRepository.getMultiReferralStepInstanceForInstance(
          instanceId,
          trx,
        );
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
            trx,
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
                comment: 'System bypass via Certified Urgent',
              },
            },
            trx,
          );

          emittedEvents.push({
            type: 'workflow.step.bypassed',
            cityId: instance.cityId,
            payload: {
              instanceId,
              stepInstanceId: stepInstance.id,
              bypassReason: 'CERTIFIED_URGENT',
              bypassedBy: null,
              comment: 'System bypass via Certified Urgent',
            }
          });

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
            trx,
          );

          emittedEvents.push({
            type: 'workflow.certification_urgency.bypass_applied',
            cityId: instance.cityId,
            payload: {
              instanceId,
              stepInstanceId: stepInstance.id,
              certificationDocumentId,
            }
          });

          const updatedStepInstance = await deps.workflowRepository.getStepInstanceById(
            stepInstance.id,
            trx,
          );
          if (!updatedStepInstance) throw new Error('Failed to retrieve updated step instance');

          await resolveNextStep(
            updatedInstance,
            updatedStepInstance,
            'BYPASSED_CERTIFIED_URGENT',
            deps,
            trx,
          );
        } else if (stepInstance.status === 'pending') {
          // CASE B
          await deps.workflowRepository.createPendingBypass(
            {
              instanceId,
              stepKey: 'committee_referral',
              certificationDocumentId,
            },
            trx,
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
            trx,
          );

          emittedEvents.push({
            type: 'workflow.certification_urgency.bypass_deferred',
            cityId: instance.cityId,
            payload: {
              instanceId,
              certificationDocumentId,
            }
          });
        } else if (
          stepInstance.status === 'completed' ||
          stepInstance.status === 'bypassed' ||
          stepInstance.status === 'cancelled'
        ) {
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
            trx,
          );

          emittedEvents.push({
            type: 'workflow.certification_urgency.already_past_referral',
            cityId: instance.cityId,
            payload: {
              instanceId,
              certificationDocumentId,
            }
          });
        }
      });
      
      for (const evt of emittedEvents) {
        deps.eventBus.emit(evt.type as any, {
          eventId: randomUUID(),
          eventType: evt.type,
          occurredAt: new Date().toISOString(),
          cityId: evt.cityId,
          schemaVersion: 1,
          payload: evt.payload,
        } as any);
      }

    } catch (error) {
      // One failure should not block others. Log the error.
      console.error(`Failed to process Certified Urgent bypass for instance ${instanceId}:`, error);
    }
  }
}
