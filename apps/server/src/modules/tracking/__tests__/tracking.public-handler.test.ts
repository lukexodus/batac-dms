import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { createPublicLookupHandler } from '../tracking.public-handler.js';
import type { TrackingRepository } from '../tracking.repository.js';
import type { TrackingPublicAPI } from '../index.js';
import type { DocumentsPublicAPI } from '../../documents/documents.types.js';
import { S3Client } from '@aws-sdk/client-s3';
import * as s3Presigner from '@aws-sdk/s3-request-presigner';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

describe('publicLookupHandler', () => {
  let mockRepo: Partial<TrackingRepository>;
  let mockTrackingService: Partial<TrackingPublicAPI>;
  let mockDocumentsService: Partial<DocumentsPublicAPI>;
  let mockS3Client: S3Client;
  let handler: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRepo = {
      findQrCodeByTrackingId: vi.fn(),
    };

    mockTrackingService = {
      getRoutingHistory: vi.fn(),
    };

    mockDocumentsService = {
      getDocumentById: vi.fn(),
    };

    mockS3Client = new S3Client({ region: 'us-east-1' });

    handler = createPublicLookupHandler({
      repository: mockRepo as TrackingRepository,
      trackingService: mockTrackingService as TrackingPublicAPI,
      documentsService: mockDocumentsService as DocumentsPublicAPI,
      s3Client: mockS3Client,
      s3Bucket: 'test-bucket',
      config: { APP_BASE_URL: 'http://localhost:3000', PREVIEW_URL_EXPIRY_SECONDS: '3600' },
    });
  });

  const createMockReply = () => {
    const reply: Partial<FastifyReply> = {};
    reply.status = vi.fn().mockReturnValue(reply);
    reply.send = vi.fn().mockReturnValue(reply);
    return reply as FastifyReply;
  };

  it('should return 400 for invalid UUID', async () => {
    const req = { params: { trackingId: 'not-a-uuid' } } as unknown as FastifyRequest<{ Params: { trackingId: string } }>;
    const reply = createMockReply();

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Invalid tracking ID format' });
  });

  it('should return 404 for unknown UUID', async () => {
    const req = { params: { trackingId: '123e4567-e89b-12d3-a456-426614174000' } } as unknown as FastifyRequest<{ Params: { trackingId: string } }>;
    const reply = createMockReply();
    
    vi.mocked(mockRepo.findQrCodeByTrackingId!).mockResolvedValue(null);

    await handler(req, reply);

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: 'Tracking ID not found' });
  });

  it('should return 200 with correct shape for valid UUID', async () => {
    const trackingId = '123e4567-e89b-12d3-a456-426614174000';
    const documentId = 'doc-123';
    const req = { params: { trackingId } } as unknown as FastifyRequest<{ Params: { trackingId: string } }>;
    const reply = createMockReply();

    vi.mocked(mockRepo.findQrCodeByTrackingId!).mockResolvedValue({ documentId } as any);
    
    vi.mocked(mockDocumentsService.getDocumentById!).mockResolvedValue({
      documentTypeCode: 'SP Resolution',
      remarks: 'Test remarks',
    } as any);

    vi.mocked(mockTrackingService.getRoutingHistory!).mockResolvedValue([
      { actionDescription: 'Draft created', timestamp: new Date('2026-07-02T10:00:00Z') } as any
    ]);

    const mockPresignedUrl = 'https://s3.example.com/presigned';
    vi.mocked(s3Presigner.getSignedUrl).mockResolvedValue(mockPresignedUrl);

    await handler(req, reply);

    expect(reply.send).toHaveBeenCalledWith({
      documentType: 'SP Resolution',
      remarks: 'Test remarks',
      routingHistory: [
        {
          actionDescription: 'Draft created',
          timestamp: '2026-07-02T10:00:00.000Z',
        }
      ],
      firstPageImageUrl: mockPresignedUrl,
      getCopyUrl: 'http://localhost:3000/request-copy?documentId=doc-123',
    });

    // Ensure no document versions file url is leaked in the output
    const sentData = vi.mocked(reply.send).mock.calls[0][0] as any;
    expect(sentData.firstPageImageUrl).toBe(mockPresignedUrl);
    expect(sentData).not.toHaveProperty('documentUrl');
    expect(sentData).not.toHaveProperty('fileUrl');
  });
});
