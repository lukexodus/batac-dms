import type { FastifyRequest, FastifyReply } from 'fastify';
import type { TrackingRepository } from './tracking.repository.js';
import type { TrackingPublicAPI } from './index.js';
import type { DocumentsPublicAPI } from '../documents/documents.types.js';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export function createPublicLookupHandler(deps: {
  repository: TrackingRepository;
  trackingService: TrackingPublicAPI;
  documentsService: DocumentsPublicAPI;
  s3Client: S3Client;
  s3Bucket: string;
  config: { APP_BASE_URL: string; PREVIEW_URL_EXPIRY_SECONDS?: string };
}) {
  return async function publicLookupHandler(
    request: FastifyRequest<{ Params: { trackingId: string } }>,
    reply: FastifyReply,
  ) {
    const { trackingId } = request.params;

    // Validate UUID format (the QR content is always a UUID)
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(trackingId)) {
      return reply.status(400).send({ error: 'Invalid tracking ID format' });
    }

    const qrCode = await deps.repository.findQrCodeByTrackingId(trackingId);
    if (!qrCode) return reply.status(404).send({ error: 'Tracking ID not found' });

    // Cross-module call: Documents Published API
    const document = await deps.documentsService.getDocumentById(qrCode.documentId);
    if (!document) return reply.status(404).send({ error: 'Document not found' });

    const history = await deps.trackingService.getRoutingHistory(qrCode.documentId, 'public-scan');

    // Canonical S3 key set by TASK-DOCS-010's generateFirstPagePreview.
    const previewKey = `documents/previews/${qrCode.documentId}/page-1.webp`;
    const expirySeconds = parseInt(deps.config.PREVIEW_URL_EXPIRY_SECONDS ?? '3600', 10);

    const command = new GetObjectCommand({
      Bucket: deps.s3Bucket,
      Key: previewKey,
    });
    const firstPageImageUrl = await getSignedUrl(deps.s3Client, command, {
      expiresIn: expirySeconds,
    });

    return reply.send({
      documentType: (document as any).documentTypeName ?? document.documentTypeCode ?? 'Document',
      remarks: (document as any).remarks ?? null,
      routingHistory: history.map((e) => ({
        actionDescription: e.actionDescription,
        timestamp: e.timestamp.toISOString(),
      })),
      firstPageImageUrl,
      getCopyUrl: `${deps.config.APP_BASE_URL}/request-copy?documentId=${qrCode.documentId}`,
    });
  };
}
