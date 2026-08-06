import type { FastifyInstance } from 'fastify';

export interface WorkflowStepStartedPayload {
  instanceId: string;      // uuid
  stepInstanceId: string;  // uuid
  stepType: 'action' | 'approval' | 'multi_referral' | 'decision' | 'notification' | 'termination' | 'parallel_split' | 'parallel_join';
  stepKey: string;
  assignedTo: string | null;   // uuid; null for system-executed steps
  documentId: string;          // uuid — REQUIRED, always present
  dueAt: string | null;        // ISO 8601 datetime; field always present, value nullable
}

export function registerStepAssignmentConsumer(fastify: FastifyInstance) {
  fastify.eventBus.on(
    'workflow.step.started',
    (event) => {
      const run = async () => {
        const payload = event.payload as WorkflowStepStartedPayload;

        // 1. If payload.assignedTo === null: return immediately. No notification for system-executed steps.
        if (!payload.assignedTo) {
          return;
        }

        // 2. Resolve document display details
        const document = await fastify.documentsService.getDocumentById(payload.documentId);
        if (!document) {
          throw new Error(`Document not found for ID: ${payload.documentId}`);
        }
        
        // 3. Call sendNotification
        await fastify.notificationsService.sendNotification({
          recipientUserId: payload.assignedTo,
          templateId: 'notif.workflow.step_assignment.in_app',
          channel: 'in_app',
          templateData: {
            instanceId: payload.instanceId,
            stepInstanceId: payload.stepInstanceId,
            stepType: payload.stepType,
            stepKey: payload.stepKey,
            assignedTo: payload.assignedTo,
            documentId: payload.documentId,
            dueAt: payload.dueAt ?? '',
            documentTitle: document.title,
            documentSeriesNumber: document.finalNumber || document.preliminaryNumber || '', // whichever is set
          },
        });
      };

      // 4. Wrap in try/catch and log error locally
      run().catch((err) => {
        const payload = event.payload as WorkflowStepStartedPayload;
        fastify.log.error(
          { 
            err, 
            eventId: event.eventId,
            stepInstanceId: payload.stepInstanceId,
            documentId: payload.documentId
          },
          'notifications: step-assignment consumer failed',
        );
      });
    },
    'notifications',
  );
}
