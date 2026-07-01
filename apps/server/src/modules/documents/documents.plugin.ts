import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { createDocumentsService } from './documents.service.js';
import { createDocumentsRouter } from './documents.router.js';
import { DocumentsRepository } from './documents.repository.js';
import { NumberingService } from './numbering.service.js';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

async function documentsPlugin(fastify: FastifyInstance): Promise<void> {
  const db = fastify.db;
  if (!db) {
    throw new Error('Database client (fastify.db) is not initialized');
  }

  const repository = new DocumentsRepository(db);
  const numberingService = new NumberingService({ db, logger: fastify.log as any });
  const s3Client = new S3Client({
    region: env.S3_REGION || 'ap-southeast-1',
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY || '',
      secretAccessKey: env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true,
  });

  const service = createDocumentsService({
    db,
    documentsRepository: repository,
    numberingService,
    s3Client,
    env,
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
