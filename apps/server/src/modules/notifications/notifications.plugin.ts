import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { createNotificationsRepository } from './notifications.repository.js';
import { createNotificationsPublicAPI } from './notifications.public-api.js';
import type { NotificationsPublicAPI } from './notifications.types.js';
import { registerStepAssignmentConsumer } from './consumers/step-assignment.consumer.js';
import { registerDocumentStateChangedConsumer } from './consumers/document-state-changed.consumer.js';

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
  });

  fastify.decorate('notificationsService', notificationsService);

  // Register Event Bus Consumers
  registerStepAssignmentConsumer(fastify);
  registerDocumentStateChangedConsumer(fastify);

  fastify.log.info('notifications plugin registered');
};

export default fp(notificationsPlugin, {
  name: 'notifications',
  dependencies: ['database', 'event-bus', 'documents'], // depends on documentsService for document lookup
});
