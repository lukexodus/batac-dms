import type { FastifyInstance } from 'fastify';
import type { WorkflowStepStartedPayload } from '@batac/shared';

export function registerStepAssignmentConsumer(fastify: FastifyInstance) {
  fastify.eventBus.on(
    'workflow.step.started',
    (event) => {
      const run = async () => {
        const payload = event.payload;

        // 1. If payload.assignedTo is null or empty: return immediately. No notification for system-executed steps.
        if (!payload.assignedTo || payload.assignedTo.length === 0) {
          return;
        }

        // 2. Resolve document display details
        const document = await fastify.documentsService.getDocumentById(payload.documentId);
        if (!document) {
          throw new Error(`Document not found for ID: ${payload.documentId}`);
        }

        // 3. Call sendNotification once per assignee — assignedTo is a multi-assignee array
        //    (committee/role-based resolution can produce more than one concurrent assignee).
        for (const assigneeUserId of payload.assignedTo) {
          await fastify.notificationsService.sendNotification({
            recipientUserId: assigneeUserId,
            templateId: 'notif.workflow.step_assignment.in_app',
            channel: 'in_app',
            templateData: {
              instanceId: payload.instanceId,
              stepInstanceId: payload.stepInstanceId,
              stepType: payload.stepType,
              stepKey: payload.stepKey,
              assignedTo: assigneeUserId,
              documentId: payload.documentId,
              dueAt: payload.dueAt ? payload.dueAt.toISOString() : '',
              documentTitle: document.title,
              documentSeriesNumber: document.finalNumber || document.preliminaryNumber || '',
            },
          });
        }
      };

      // 4. Wrap in try/catch and log error locally
      run().catch((err) => {
        const payload = event.payload;
        fastify.log.error(
          {
            err,
            eventId: event.eventId,
            stepInstanceId: payload.stepInstanceId,
            documentId: payload.documentId,
          },
          'notifications: step-assignment consumer failed',
        );
      });
    },
    'notifications',
  );
}
