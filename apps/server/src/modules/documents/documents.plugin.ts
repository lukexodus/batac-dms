import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createDocumentsService } from './documents.service.js';
import { createDocumentsRouter } from './documents.router.js';
import { DocumentsRepository } from './documents.repository.js';

async function documentsPlugin(fastify: FastifyInstance): Promise<void> {
  const db = fastify.db;
  if (!db) {
    throw new Error('Database client (fastify.db) is not initialized');
  }

  const repository = new DocumentsRepository(db);
  const service = createDocumentsService({
    db,
    documentsRepository: repository,
    eventBus: fastify.eventBus,
    auditService: fastify.auditService,
  });

  const trpcRouter = createDocumentsRouter();

  fastify.decorate('documentsService', service);
  fastify.decorate('documentsTrpcRouter', trpcRouter);

  fastify.log.info('documents plugin registered');
}

export default fp(documentsPlugin, {
  name: 'documents',
  dependencies: ['database', 'event-bus', 'audit'],
});
