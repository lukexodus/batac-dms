import type { FastifyInstance } from 'fastify';

// Using local declarations for the payload interfaces as they are specific
// and help enforce the verbatim literal types 'RA 7160...'
// even though the underlying EventPayloadMap has them as well.
interface WorkflowApprovalLapsedPayload {
  stepInstanceId: string;
  legalBasis: 'RA 7160 Section 47';
  deadlineWas: string;
}

interface WorkflowPanlalawiganDeemedApprovedPayload {
  stepInstanceId: string;
  legalBasis: 'RA 7160 Section 56(d)';
  transmissionDate: string;
  deadlineWas: string;
}

export function registerLegislativeLapseConsumer(fastify: FastifyInstance) {
  // Mayor 10-day lapse timer
  fastify.eventBus.on(
    'workflow.approval.lapsed',
    (event) => {
      const run = async () => {
        const payload = event.payload as unknown as WorkflowApprovalLapsedPayload;

        const users = await fastify.iamService.getUsersByRole('sp_secretary');
        if (users.length === 0) {
          fastify.log.warn(
            { eventId: event.eventId },
            'notifications: SP Secretary role has no assigned users, skipping workflow.approval.lapsed notification'
          );
          return;
        }

        if (users.length > 1) {
          fastify.log.warn(
            { eventId: event.eventId, count: users.length },
            'notifications: Multiple SP Secretaries resolved; sending to the first one'
          );
        }

        const spSecretary = users[0];
        if (!spSecretary) return;

        await fastify.notificationsService.sendNotification({
          recipientUserId: spSecretary.userId,
          templateId: 'notif.workflow.mayor_lapse.in_app',
          channel: 'in_app',
          templateData: {
            stepInstanceId: payload.stepInstanceId,
            legalBasis: payload.legalBasis,
            deadlineWas: payload.deadlineWas,
          },
        });
      };

      run().catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId },
          'notifications: workflow.approval.lapsed consumer failed'
        );
      });
    },
    'notifications',
  );

  // Panlalawigan 30-day deemed approved timer
  fastify.eventBus.on(
    'workflow.panlalawigan.deemed_approved',
    (event) => {
      const run = async () => {
        const payload = event.payload as unknown as WorkflowPanlalawiganDeemedApprovedPayload;

        const users = await fastify.iamService.getUsersByRole('sp_secretary');
        if (users.length === 0) {
          fastify.log.warn(
            { eventId: event.eventId },
            'notifications: SP Secretary role has no assigned users, skipping workflow.panlalawigan.deemed_approved notification'
          );
          return;
        }

        if (users.length > 1) {
          fastify.log.warn(
            { eventId: event.eventId, count: users.length },
            'notifications: Multiple SP Secretaries resolved; sending to the first one'
          );
        }

        const spSecretary = users[0];
        if (!spSecretary) return;

        await fastify.notificationsService.sendNotification({
          recipientUserId: spSecretary.userId,
          templateId: 'notif.workflow.panlalawigan_deemed_approved.in_app',
          channel: 'in_app',
          templateData: {
            stepInstanceId: payload.stepInstanceId,
            legalBasis: payload.legalBasis,
            transmissionDate: payload.transmissionDate,
            deadlineWas: payload.deadlineWas,
          },
        });
      };

      run().catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId },
          'notifications: workflow.panlalawigan.deemed_approved consumer failed'
        );
      });
    },
    'notifications',
  );
}
