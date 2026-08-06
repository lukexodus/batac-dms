import type { FastifyInstance } from 'fastify';

export function registerSessionDisplacedConsumer(fastify: FastifyInstance) {
  fastify.eventBus.on(
    'session.replaced',
    (event) => {
      const run = async () => {
        // The event payload schema from IAM
        const payload = event.payload as unknown as {
          user_id: string;
          old_session_id: string;
          new_session_id: string;
          new_ip_address: string | null;
        };

        await fastify.notificationsService.sendNotification({
          recipientUserId: payload.user_id,
          templateId: 'notif.iam.session_displaced.in_app',
          channel: 'in_app',
          templateData: {
            oldSessionId: payload.old_session_id,
            newSessionId: payload.new_session_id,
            newIpAddress: payload.new_ip_address ?? 'unknown location',
          },
        });
      };

      run().catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId },
          'notifications: session.replaced consumer failed'
        );
      });
    },
    'notifications',
  );
}
