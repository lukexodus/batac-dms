import type { FastifyInstance } from 'fastify';
import type { DocumentStateChangedEvent } from '@batac/shared';

export function registerDocumentStateChangedConsumer(fastify: FastifyInstance) {
  fastify.eventBus.on(
    'document.state_changed',
    (event) => {
      const run = async () => {
        const payload = event.payload;

        // 1. Resolve document details
        const document = await fastify.documentsService.getDocumentById(payload.documentId);
        if (!document) {
          throw new Error(`Document not found for ID: ${payload.documentId}`);
        }

        // [CROSS-MODULE REF: ORG — task list not yet supplied]
        // getUserByOfficeRole is not yet stable in OrgService Published API.
        // TODO(NOTIF): recipient resolution here is a functional default, not the full "administrator-configurable per transition type" design H4 §4.2 describes — no concrete config-table design exists yet in the source documents
        const orgService = fastify.organizationService as any;
        let recipientUserId: string | null = null;
        if (typeof orgService.getUserByOfficeRole === 'function') {
          const users = await orgService.getUserByOfficeRole(document.originatingOfficeId, 'fallback_role');
          if (users && users.length > 0) {
            recipientUserId = users[0].userId;
          }
        }

        // 2. If no recipient could be resolved, skip sending — do not fall back
        //    to a placeholder value. This is expected under current conditions
        //    (getUserByOfficeRole is not yet implemented by the Organization
        //    module), not an error case.
        if (!recipientUserId) {
          fastify.log.warn(
            {
              eventId: event.eventId,
              documentId: payload.documentId,
            },
            'notifications: document-state-changed consumer could not resolve a recipient (getUserByOfficeRole unavailable) — skipping',
          );
          return;
        }

        // H4 §4.2: The actorId who triggered the transition does not automatically receive a notification.
        if (recipientUserId === payload.actorId) {
          return;
        }

        // 3. Call sendNotification
        await fastify.notificationsService.sendNotification({
          recipientUserId,
          templateId: 'notif.document.state_changed.in_app',
          channel: 'in_app',
          templateData: {
            documentId: payload.documentId,
            fromState: payload.fromState,
            toState: payload.toState,
            actorId: payload.actorId,
            reason: payload.reason ?? '',
          },
        });
      };

      // 4. Wrap in try/catch and log error locally
      run().catch((err) => {
        const payload = event.payload;
        fastify.log.error(
          {
            err,
            eventId: event.eventId,
            documentId: payload.documentId,
          },
          'notifications: document-state-changed consumer failed',
        );
      });
    },
    'notifications',
  );
}
