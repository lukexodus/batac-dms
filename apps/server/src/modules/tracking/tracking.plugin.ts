import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { TrackingRepository } from './tracking.repository.js';
import { QrCodeService } from './tracking.qr-service.js';
import { createTrackingService } from './tracking.service.js';
import { createPublicLookupHandler } from './tracking.public-handler.js';
import { createTrackingRouter } from './tracking.router.js';
import { S3Client } from '@aws-sdk/client-s3';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../../config/env.js';
import type { AppDb } from '../../db.js';
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

  const trackingParamsSchema = z.object({
    trackingNumber: z.string().uuid(),
  });

  const trackingSuccessSchema = z.object({
    documentType: z.string(),
    remarks: z.string().nullable(),
    routingHistory: z.array(
      z.object({
        actionDescription: z.string(),
        timestamp: z.string(),
      }),
    ),
    firstPageImageUrl: z.string(),
    getCopyUrl: z.string(),
  });

  const trackingErrorSchema = z.object({
    error: z.string(),
  });

  fastify.get(
    '/public/tracking/:trackingNumber',
    {
      schema: {
        tags: ['tracking'],
        summary: 'Document status lookup by QR tracking number',
        params: trackingParamsSchema,
        response: {
          200: trackingSuccessSchema,
          404: trackingErrorSchema,
          429: trackingErrorSchema,
          500: trackingErrorSchema,
        },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    publicLookupHandler,
  );

  const eventConsumerDb: AppDb = drizzle(postgres(env.DATABASE_URL_APP, {
    max: 2,
    idle_timeout: 30,
  }));

  const eventConsumer = new TrackingEventConsumer(
    repository,
    qrCodeService,
    fastify.log,
    eventConsumerDb,
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
    'workflow.step.completed',
    (event) => {
      eventConsumer.handleWorkflowStepCompleted(event).catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId },
          'tracking: workflow.step.completed handler failed',
        );
      });
    },
    'tracking',
  );

  fastify.eventBus.on(
    'document.certification_urgency.logged',
    (event) => {
      eventConsumer.handleCertificationUrgencyLogged(event).catch((err) => {
        fastify.log.error(
          { err, eventId: event.eventId },
          'tracking: document.certification_urgency.logged handler failed',
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
  name: 'tracking',
  dependencies: ['documents'],
});
