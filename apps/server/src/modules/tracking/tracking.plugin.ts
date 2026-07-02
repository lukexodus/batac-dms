import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { TrackingRepository } from './tracking.repository.js';
import { QrCodeService } from './tracking.qr-service.js';
import { createTrackingService } from './tracking.service.js';
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
  
  const trackingService = createTrackingService({ repository });
  
  fastify.decorate('trackingService', trackingService);
  fastify.decorate('qrCodeService', qrCodeService);

  // Full wiring in TASK-TRACK-009
};

export default fp(trackingPlugin, {
  name: 'tracking-plugin',
  dependencies: ['documents-plugin'],
});
