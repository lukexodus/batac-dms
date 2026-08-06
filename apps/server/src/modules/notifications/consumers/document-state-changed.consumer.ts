import type { FastifyInstance } from 'fastify';

export interface DocumentStateChangedPayload {
  documentId: string;   // uuid
  fromState: 'Draft' | 'Submitted' | 'In-Workflow' | 'Pending-Approval' | 'Completed' | 'Released' | 'Archived' | 'Disposed' | 'Cancelled';
  toState: 'Draft' | 'Submitted' | 'In-Workflow' | 'Pending-Approval' | 'Completed' | 'Released' | 'Archived' | 'Disposed' | 'Cancelled';
  actorId: string;      // uuid
  reason?: string;      // optional
}

export function registerDocumentStateChangedConsumer(fastify: FastifyInstance) {
  fastify.eventBus.on(
    'document.state_changed',
    (event) => {
      const run = async () => {
        const payload = event.payload as DocumentStateChangedPayload;

        // 1. Resolve document details
        const document = await fastify.documentsService.getDocumentById(payload.documentId);
        if (!document) {
          throw new Error(`Document not found for ID: ${payload.documentId}`);
        }

        // [CROSS-MODULE REF: ORG — task list not yet supplied] 
        // getUserByOfficeRole is not yet stable in OrgService Published API.
        // TODO(NOTIF): recipient resolution here is a functional default, not the full "administrator-configurable per transition type" design H4 §4.2 describes — no concrete config-table design exists yet in the source documents
        const orgService = fastify.organizationService as any;
        let recipientUserId = 'unknown-fallback-user';
        if (typeof orgService.getUserByOfficeRole === 'function') {
           const users = await orgService.getUserByOfficeRole(document.originatingOfficeId, 'fallback_role');
           if (users && users.length > 0) {
              recipientUserId = users[0].userId;
           }
        }

        // H4 §4.2: The actorId who triggered the transition does not automatically receive a notification.
        // If the resolved recipient is the actor, skip it or we could let it send. But the criteria says:
        // "The actorId who triggered the transition does not automatically receive a notification". 
        // To strictly enforce this, we avoid sending if recipient == actorId.
        if (recipientUserId === payload.actorId) {
          return;
        }

        // 2. Call sendNotification
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

      // 3. Wrap in try/catch and log error locally
      run().catch((err) => {
        const payload = event.payload as DocumentStateChangedPayload;
        fastify.log.error(
          { 
            err, 
            eventId: event.eventId,
            documentId: payload.documentId
          },
          'notifications: document-state-changed consumer failed',
        );
      });
    },
    'notifications',
  );
}
