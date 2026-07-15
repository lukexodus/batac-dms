import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { TrackingRepository } from './tracking.repository.js';
import { QrCodeService } from './tracking.qr-service.js';
import { createTrackingService } from './tracking.service.js';
import { createPublicLookupHandler } from './tracking.public-handler.js';
import { createTrackingRouter } from './tracking.router.js';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';
import { TrackingEventConsumer } from './tracking.event-consumer.js';

/**
 * Decorate the Fastify instance with the tracking module's services and the
 * tRPC sub-router.  The `trackingRepository` decoration is needed by
 * `tracking.router.ts`, which reads it from `ctx.req.server` at request time.
 *
 * Source: TASK-TRACK-007 (wiring).
 */
declare module 'fastify' {
  interface FastifyInstance {
    trackingRepository: TrackingRepository;
    trackingService: ReturnType<typeof createTrackingService>;
    qrCodeService: QrCodeService;
    trackingTrpcRouter: ReturnType<typeof createTrackingRouter>;
  }
}

import { EventBus } from '@batac/shared';

declare module 'fastify' {
  interface FastifyInstance {
    eventBus: EventBus;
  }
}

export const trackingPlugin: FastifyPluginAsync = async (fastify) => {
  const repository = new TrackingRepository(fastify.db);
  const s3Client = new S3Client({
    region: env.S3_REGION || 'ap-southeast-1',
    endpoint: env.S3_ENDPOINT,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY || '',
      secretAccessKey: env.S3_SECRET_KEY || '',
    },
    forcePathStyle: true,
  });

  const qrCodeService = new QrCodeService(repository, s3Client, env as any, fastify.db);

  const trackingService = createTrackingService(repository);

  // Decorate for router access via ctx.req.server.*
  fastify.decorate('trackingRepository', repository);
  fastify.decorate('trackingService', trackingService);
  fastify.decorate('qrCodeService', qrCodeService);

  const trackingTrpcRouter = createTrackingRouter();
  fastify.decorate('trackingTrpcRouter', trackingTrpcRouter);

  const publicLookupHandler = createPublicLookupHandler({
    repository,
    trackingService,
    documentsService: fastify.documentsService,
    s3Client,
    s3Bucket: env.S3_BUCKET || 'batac-dms-assets',
    config: {
      APP_BASE_URL: env.APP_URL,
      PREVIEW_URL_EXPIRY_SECONDS: String(env.S3_SIGNED_URL_EXPIRES_S),
    },
  });

  fastify.get('/track/:trackingId', publicLookupHandler);

  const eventConsumer = new TrackingEventConsumer(
    repository,
    qrCodeService,
    fastify.log,
    fastify.db,
  );

  fastify.eventBus.on(
    'document.created',
    (event) => {
      eventConsumer.handleDocumentCreated(event).catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId },
          'tracking: document.created handler failed',
        );
        // dead-letter handling is owned by the INFRA pgboss dead-letter task
      });
    },
    'tracking',
  );

  fastify.eventBus.on(
    'workflow.step_completed',
    (event) => {
      eventConsumer.handleWorkflowStepCompleted(event).catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId },
          'tracking: workflow.step_completed handler failed',
        );
      });
    },
    'tracking',
  );

  // TODO(PORTAL-INTEGRATION): Portal (Phase 3) will call trackingService.getTrackingRecordForDocument()
  // for the public scan display on the citizen portal.

  fastify.log.info('tracking.module.ready');
};

export default fp(trackingPlugin, {
  name: 'tracking-plugin',
  dependencies: ['documents'],
});
