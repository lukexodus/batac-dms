import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import trackingPlugin from '../tracking.plugin.js';
import { TrackingRepository } from '../tracking.repository.js';
import { env } from '../../../config/env.js';

// Mock dependencies
vi.mock('../../../config/env.js', () => ({
  env: {
    S3_REGION: 'ap-southeast-1',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'test',
    S3_SECRET_KEY: 'test',
    S3_BUCKET: 'test-bucket',
    APP_URL: 'http://localhost:3000',
    S3_SIGNED_URL_EXPIRES_S: 3600,
  }
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  GetObjectCommand: vi.fn(),
}));

vi.mock('@get-signed-url', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('http://mock-signed-url'),
}));

vi.mock('../tracking.repository.js', () => {
  return {
    TrackingRepository: vi.fn().mockImplementation(() => ({
      // mock repository methods if needed by plugin init
    }))
  };
});

import fp from 'fastify-plugin';

const mockDependenciesPlugin = fp(async (fastify) => {
  fastify.decorate('db', {});
  
  fastify.decorate('eventBus', {
    on: vi.fn(),
    emit: vi.fn(),
  });

  fastify.decorate('documentsService', {
    getDocumentById: vi.fn(),
  });

  fastify.decorate('iamService', {
    getUserById: vi.fn(),
  });
}, { name: 'documents-plugin' });

const mockIamPlugin = fp(async () => {}, { name: 'iam-plugin' });

describe('tracking.plugin', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    fastify = Fastify({ logger: false });
    
    fastify.log.info = vi.fn();
    fastify.log.error = vi.fn();

    await fastify.register(mockDependenciesPlugin);
    await fastify.register(mockIamPlugin);
    await fastify.register(trackingPlugin);
    await fastify.ready();
  });

  it('registers successfully and sets up required decorations', () => {
    expect(fastify.trackingService).toBeDefined();
    expect(typeof fastify.trackingService.getTrackingRecordForDocument).toBe('function');
    
    expect(fastify.trackingTrpcRouter).toBeDefined();
    
    const routeInfo = fastify.hasRoute({
      method: 'GET',
      url: '/track/:trackingId'
    });
    expect(routeInfo).toBe(true);
    
    expect(fastify.log.info).toHaveBeenCalledWith('tracking.module.ready');
  });
  
  it('subscribes to required event bus events', () => {
    expect(fastify.eventBus.on).toHaveBeenCalledWith('document.created', expect.any(Function), 'tracking');
    expect(fastify.eventBus.on).toHaveBeenCalledWith('workflow.step_completed', expect.any(Function), 'tracking');
  });
});
