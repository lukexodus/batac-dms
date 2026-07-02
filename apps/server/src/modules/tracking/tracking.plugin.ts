import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { TrackingRepository } from './tracking.repository.js';
import { QrCodeService } from './tracking.qr-service.js';
import { createTrackingService } from './tracking.service.js';
import { createPublicLookupHandler } from './tracking.public-handler.js';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../../config/env.js';

const trackingPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.log.info('tracking.module.stub');
  
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
  
  fastify.decorate('trackingService', trackingService);
  fastify.decorate('qrCodeService', qrCodeService);

  const publicLookupHandler = createPublicLookupHandler({
    repository,
    trackingService,
    documentsService: fastify.documentsService,
    s3Client,
    s3Bucket: env.S3_BUCKET || 'batac-dms-assets',
    config: { APP_BASE_URL: env.APP_URL, PREVIEW_URL_EXPIRY_SECONDS: String(env.S3_SIGNED_URL_EXPIRES_S) }
  });

  fastify.get('/track/:trackingId', publicLookupHandler);

  // Full wiring in TASK-TRACK-009
};

export default fp(trackingPlugin, {
  name: 'tracking-plugin',
  dependencies: ['documents-plugin'],
});
