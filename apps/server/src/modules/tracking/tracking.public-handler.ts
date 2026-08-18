import type { FastifyRequest, FastifyReply } from 'fastify';
import type { TrackingRepository } from './tracking.repository.js';
import type { TrackingPublicAPI } from './index.js';
import type { DocumentsPublicAPI } from '../documents/documents.types.js';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { TrackingLookupData } from '@batac/shared';

const PH_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Format a JS Date as an ISO-8601 timestamp with a `+08:00` offset — the
 * convention used across E2's public REST examples (e.g.
 * `2026-03-05T09:00:00+08:00`). The Philippines has no DST (fixed UTC+8), so
 * shifting by the fixed offset and reading UTC parts is exact.
 */
function toPhTimestamp(d: Date): string {
  return new Date(d.getTime() + PH_UTC_OFFSET_MS).toISOString().replace('Z', '+08:00');
}

/**
 * [Inference] Document-type code → display name for the public tracking
 * response. `DocumentSummary` (the Documents Public API shape this handler
 * consumes) carries only `documentTypeCode`, not the DB's display name, so a
 * code map is used here — the same label style E2's example payloads use
 * ("SP Resolution", "SP Ordinance"). Not yet recorded in the findings log as
 * of this fix.
 */
const DOCUMENT_TYPE_NAMES: Record<string, string> = {
  SP_RESOLUTION: 'SP Resolution',
  SP_ORDINANCE: 'SP Ordinance',
  SP_APPROPRIATION_ORDINANCE: 'Appropriation Ordinance',
  CITIZEN_COMPLAINT: 'Citizen Complaint',
  DOCUMENT_REQUEST_FORM: 'Document Request Form',
  CERTIFICATION_OF_URGENCY: 'Certification of Urgency',
  TRANSMITTAL_LETTER: 'Transmittal Letter',
};

/**
 * [Inference] Human-readable display labels derived from the raw
 * `documents.lifecycle_state` enum. E2's `lifecycleStatus` is explicitly "a
 * human-readable display label (locale-aware), not the raw lifecycle_state DB
 * enum... derived from both the lifecycle_state and the current workflow
 * step". The Tracking module has no workflow-step access, so the
 * step-specific suffix (e.g. "With Mayor — Pending Signature") cannot be
 * reproduced here; these labels are the lifecycle-state-only approximation.
 * Not yet recorded in the findings log as of this fix.
 */
const LIFECYCLE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Received and logged by SP Secretariat',
  in_workflow: 'In legislative workflow',
  pending_mayor_action: 'With Mayor — Pending Signature',
  pending_panlalawigan_review: 'Under Sangguniang Panlalawigan review',
  completed: 'Completed',
  released: 'Released to the public portal',
  archived: 'Archived',
  disposed: 'Disposed',
  cancelled: 'Cancelled',
  superseded: 'Superseded',
};

export function createPublicLookupHandler(deps: {
  repository: TrackingRepository;
  trackingService: TrackingPublicAPI;
  documentsService: DocumentsPublicAPI;
  s3Client: S3Client;
  s3Bucket: string;
  config: { APP_BASE_URL: string; PREVIEW_URL_EXPIRY_SECONDS?: string };
}) {
  return async function publicLookupHandler(
    request: FastifyRequest<{ Params: { trackingNumber: string } }>,
    reply: FastifyReply,
  ) {
    const trackingId = request.params.trackingNumber;

    const qrCode = await deps.repository.findQrCodeByTrackingId(trackingId);
    if (!qrCode) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No document found for the provided tracking number.',
      });
    }

    // Cross-module call: Documents Published API
    const document = await deps.documentsService.getDocumentById(qrCode.documentId);
    if (!document) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'No document found for the provided tracking number.',
      });
    }

    const history = await deps.trackingService.getRoutingHistory(qrCode.documentId, 'public-scan');

    // Canonical S3 key set by TASK-DOCS-010's generateFirstPagePreview.
    const previewKey = `documents/previews/${qrCode.documentId}/page-1.webp`;
    const expirySeconds = parseInt(deps.config.PREVIEW_URL_EXPIRY_SECONDS ?? '3600', 10);

    const command = new GetObjectCommand({
      Bucket: deps.s3Bucket,
      Key: previewKey,
    });
    const firstPagePreviewUrl = await getSignedUrl(deps.s3Client, command, {
      expiresIn: expirySeconds,
    });

    const finalNumber = document.finalNumber;
    const requestPath = `/document-requests?ref=${encodeURIComponent(finalNumber ?? qrCode.documentId)}`;
    const documentRequestUrl = deps.config.APP_BASE_URL
      ? `${deps.config.APP_BASE_URL.replace(/\/+$/, '')}${requestPath}`
      : requestPath;

    const data: TrackingLookupData = {
      trackingNumber: qrCode.trackingId,
      documentId: document.documentId,
      documentType: document.documentTypeCode,
      documentTypeName: DOCUMENT_TYPE_NAMES[document.documentTypeCode] ?? document.documentTypeCode,
      title: document.title,
      preliminaryNumber: document.preliminaryNumber,
      finalNumber: document.finalNumber,
      lifecycleStatus: LIFECYCLE_STATUS_LABELS[document.lifecycleState] ?? document.lifecycleState,
      /**
       * [Inference] Always null — `DocumentSummary` (the cross-module shape
       * used here) does not expose `remarks`. The pre-E2 narrow handler read
       * it via an untyped `(document as any).remarks` access that was always
       * null for the same reason.
       */
      remarks: null,
      routingHistory: history.map((e) => ({
        timestamp: toPhTimestamp(e.timestamp),
        action: e.actionDescription,
        fromOfficeName: e.fromOfficeName,
        toOfficeName: e.toOfficeName,
        /**
         * [Inference] Always null — resolving the IAM display name for
         * `actorId` would require a cross-module IAM call that is not part of
         * the Tracking/Documents published APIs. E2 allows null ("when the
         * action was system-generated... or when disclosure is restricted").
         */
        actorDisplayName: null,
      })),
      firstPagePreview: {
        url: firstPagePreviewUrl,
        expiresAt: toPhTimestamp(new Date(Date.now() + expirySeconds * 1000)),
        widthPx: null,
        heightPx: null,
      },
      documentRequestUrl,
      /**
       * [Inference] Always null — supersession/closure columns are not part
       * of `DocumentSummary`. The lifecycle label for a superseded document
       * still reads "Superseded" via LIFECYCLE_STATUS_LABELS.
       */
      supersededBy: null,
      supersededAt: null,
      closureReason: null,
    };

    return reply.send({ data });
  };
}
