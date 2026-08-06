import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createNotificationsRepository } from './notifications.repository.js';
import { createNotificationsPublicAPI } from './notifications.public-api.js';
import type { NotificationsPublicAPI } from './notifications.types.js';
import { registerStepAssignmentConsumer } from './consumers/step-assignment.consumer.js';
import { registerSlaEscalationConsumer } from './consumers/sla-escalation.consumer.js';
import { registerDocumentStateChangedConsumer } from './consumers/document-state-changed.consumer.js';
import { registerLegislativeLapseConsumer } from './consumers/legislative-lapse.consumer.js';
import { registerSessionDisplacedConsumer } from './consumers/session-displaced.consumer.js';

declare module 'fastify' {
  interface FastifyInstance {
    notificationsService: NotificationsPublicAPI;
  }
}

const notificationsPlugin: FastifyPluginAsync = async (fastify) => {
  const db = fastify.db;
  if (!db) {
    throw new Error('Database client (fastify.db) is not initialized');
  }

  const repository = createNotificationsRepository(db);
  const notificationsService = createNotificationsPublicAPI({
    repository,
    logger: fastify.log,
    mailer: fastify.mailer,
  });

  fastify.decorate('notificationsService', notificationsService);

  // Register Event Bus Consumers
  registerStepAssignmentConsumer(fastify);
  registerSlaEscalationConsumer(fastify);
  registerDocumentStateChangedConsumer(fastify);
  registerLegislativeLapseConsumer(fastify);
  registerSessionDisplacedConsumer(fastify);

  fastify.log.info('notifications plugin registered');
};

export default fp(notificationsPlugin, {
  name: 'notifications',
  dependencies: ['database', 'event-bus', 'documents', 'workflow', 'organization', 'iam', 'mailer'], // depends on other modules for document and assignee lookup, plus mailer for email sending
});
