/**
 * tracking.router.ts — TASK-TRACK-007
 *
 * Five tRPC procedures for the tracking module:
 *   1. getTrackingRecord      — query, I1 §7.1 own-office / cross-office ABAC
 *   2. printQrCoverSheet      — query, I1 §7.5 sp_secretary only
 *   3. getRoutingHistory      — query, I1 §7.1 own-office / cross-office ABAC
 *   4. logRoutingEntry        — mutation, I1 §7.2 sp_secretary + ownership
 *   5. scanQrCodeAuthenticated — query, I1 §7.3 any authenticated non-citizen role
 *
 * ABAC is enforced inline (not via PolicyEvaluator.evaluate) because the
 * tracking_record resource type has no registered handler in PolicyEvaluator —
 * only session and delegation_grant are registered. The inline logic directly
 * implements I1 §7.1–7.5 conditions.
 *
 * [Inference] The SP Secretariat office is identified via the office code 'SPS'
 * (same constant used by documents.router.ts and the seed scripts). Retrieved at
 * request time via organizationService.getOfficeByCode — not cached — so that
 * office renames/deactivations take effect without restart.
 *
 * Source: E1 §Module 5, I1 §7, I2 §Section 7.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import type { Context } from '../iam/iam.types.js';
import type { TrackingRepository } from './tracking.repository.js';
import type { QrCodeService } from './tracking.qr-service.js';
import type { TrackingPublicAPI } from './index.js';
import type { DocumentsPublicAPI } from '../documents/documents.types.js';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../../config/env.js';

// ─── Role sets from I1 §7 ────────────────────────────────────────────────────

/**
 * Roles allowed to view tracking history for their own office (I1 §7.1).
 */
const OWN_OFFICE_TRACKING_ROLES = new Set([
  'dept_encoder',
  'dept_approver',
  'sp_secretary',
  'sp_member',
  'sp_presiding_officer',
  'mayor',
  'brgy_encoder',
  'brgy_captain',
  'records_officer',
  'auditor',
]);

/**
 * Roles allowed to view tracking history cross-office, subject to classification
 * gate (I1 §7.1).
 */
const CROSS_OFFICE_TRACKING_ROLES = new Set([
  'sp_secretary',
  'sp_presiding_officer',
  'mayor',
  'records_officer',
  'auditor',
]);

/**
 * Roles allowed to perform the authenticated in-app QR scan (I1 §7.3).
 */
const AUTHENTICATED_SCAN_ROLES = new Set([
  'records_officer',
  'dept_encoder',
  'dept_approver',
  'sp_secretary',
  'sp_member',
  'sp_presiding_officer',
  'mayor',
  'brgy_encoder',
  'brgy_captain',
  'auditor',
]);

const SP_SECRETARIAT_OFFICE_CODE = 'SPS';

// Classification levels that permit cross-office read (I1 §7.1)
const CROSS_OFFICE_ALLOWED_CLASSIFICATIONS = new Set(['public', 'internal']);

// ─── Context helpers ─────────────────────────────────────────────────────────

function getTrackingRepository(ctx: Context): TrackingRepository {
  return (ctx.req.server as any).trackingRepository;
}

function getQrCodeService(ctx: Context): QrCodeService {
  return ctx.req.server.qrCodeService;
}

function getTrackingService(ctx: Context): TrackingPublicAPI {
  return ctx.req.server.trackingService;
}

function getDocumentsService(ctx: Context): DocumentsPublicAPI {
  return ctx.req.server.documentsService;
}

function getIamService(ctx: Context) {
  return ctx.req.server.iamService;
}

function getOrgService(ctx: Context) {
  return ctx.req.server.organizationService;
}

let _s3Client: S3Client | null = null;
function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: env.S3_REGION || 'ap-southeast-1',
      endpoint: env.S3_ENDPOINT,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY || '',
        secretAccessKey: env.S3_SECRET_KEY || '',
      },
      forcePathStyle: true,
    });
  }
  return _s3Client;
}

// ─── ABAC helpers ─────────────────────────────────────────────────────────────

/**
 * Check whether the calling subject has any of the given roles.
 * Uses `effectiveRoles` (includes delegation grant expansion).
 */
function hasAnyRole(ctx: Context, roleSet: Set<string>): boolean {
  const auth = ctx.auth!;
  return (
    auth.effectiveRoles.some((r) => roleSet.has(r)) ||
    auth.roles.some((r) => roleSet.has(r))
  );
}

/**
 * Implements I1 §7.1 — `tracking_record:read`.
 *
 * Returns true if the subject is permitted to read the tracking record for
 * a document owned by `documentOfficeId` with `classificationLevel`.
 *
 * Own-office check: document.officeId ∈ subject.effectiveOfficeIds.
 * Cross-office: role ∈ CROSS_OFFICE_TRACKING_ROLES AND classification ∈ {public, internal}.
 */
function canReadTrackingRecord(
  ctx: Context,
  documentOfficeId: string,
  classificationLevel: string,
): boolean {
  const auth = ctx.auth!;

  // Own-office branch
  const isOwnOffice = auth.effectiveOfficeIds.includes(documentOfficeId);
  if (isOwnOffice && hasAnyRole(ctx, OWN_OFFICE_TRACKING_ROLES)) {
    return true;
  }

  // Cross-office branch (classification-gated)
  if (
    hasAnyRole(ctx, CROSS_OFFICE_TRACKING_ROLES) &&
    CROSS_OFFICE_ALLOWED_CLASSIFICATIONS.has(classificationLevel)
  ) {
    return true;
  }

  return false;
}

/**
 * Resolve the display name for an actor UUID.
 * Returns 'System' for the SYSTEM sentinel actor.
 *
 * [Inference] 'SYSTEM' is the sentinel string used by the repository mapper
 * when actorId is null. A human should confirm the display string is acceptable.
 */
async function resolveActorDisplayName(ctx: Context, actorId: string): Promise<string> {
  if (actorId === 'SYSTEM') return 'System';
  try {
    const user = await getIamService(ctx).getUserById(actorId);
    return user?.displayName ?? `User ${actorId.slice(0, 8)}`;
  } catch {
    return `User ${actorId.slice(0, 8)}`;
  }
}

// ─── Output schemas (matching E1 §Module 5) ───────────────────────────────────

const TrackingRecordOutputSchema = z.object({
  trackingId: z.string().uuid(),
  documentId: z.string().uuid(),
  trackingNumber: z.string(),
  qrCodeS3Key: z.string(),
  assignedAt: z.coerce.date(),
  physicalLocation: z.string().nullable(),
});

const RoutingEntryOutputSchema = z.object({
  entryId: z.string().uuid(),
  fromOfficeId: z.string().uuid().nullable(),
  toOfficeId: z.string().uuid().nullable(),
  actorId: z.string(),
  actorDisplayName: z.string(),
  actionDescription: z.string(),
  timestamp: z.coerce.date(),
});

// ─── Router factory ───────────────────────────────────────────────────────────

export function createTrackingRouter() {
  return router({
    // -----------------------------------------------------------------------
    // tracking.getTrackingRecord
    // E1 §Module 5; I1 §7.1
    // -----------------------------------------------------------------------
    getTrackingRecord: protectedProcedure
      .input(z.object({ documentId: z.string().uuid() }))
      .output(TrackingRecordOutputSchema)
      .query(async ({ ctx, input }) => {
        const trackingService = getTrackingService(ctx);
        const documentsService = getDocumentsService(ctx);

        const doc = await documentsService.getDocumentById(input.documentId);
        if (!doc) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
        }

        // Use documentsRepository to get the full document row with officeId.
        // DocumentsPublicAPI.getDocumentById() returns DocumentSummary which
        // does not expose officeId — we need the raw row.
        const docsRepo = (ctx.req.server as any).documentsRepository;
        const docRow = docsRepo ? await docsRepo.findById(input.documentId) : null;
        const officeId: string = docRow?.originatingOfficeId ?? docRow?.ownedByOfficeId ?? '';
        const classificationLevel: string = docRow?.classificationLevel ?? doc.classificationLevel;

        if (!canReadTrackingRecord(ctx, officeId, classificationLevel)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not authorised to view this tracking record.' });
        }


        const record = await trackingService.getTrackingRecordForDocument(input.documentId);
        if (!record) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No tracking record found for this document.' });
        }

        return {
          trackingId: record.trackingId,
          documentId: record.documentId,
          trackingNumber: record.trackingNumber,
          qrCodeS3Key: record.qrCodeS3Key,
          assignedAt: record.assignedAt,
          physicalLocation: record.physicalLocation ?? null,
        };
      }),

    // -----------------------------------------------------------------------
    // tracking.printQrCoverSheet
    // E1 §Module 5; I1 §7.5
    // Returns a presigned S3 URL for the generated PDF.
    // -----------------------------------------------------------------------
    printQrCoverSheet: protectedProcedure
      .input(
        z.object({
          documentIds: z.array(z.string().uuid()).min(1),
          layout: z.enum(['single', 'multi_per_page']).default('multi_per_page'),
        })
      )
      .output(z.object({ pdfPresignedUrl: z.string().url() }))
      .query(async ({ ctx, input }) => {
        const auth = ctx.auth!;

        // Gate: sp_secretary only (I1 §7.5)
        const isSpSecretary =
          auth.roles.includes('sp_secretary') || auth.effectiveRoles.includes('sp_secretary');
        if (!isSpSecretary) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the SP Secretary may print QR cover sheets.' });
        }

        // Resolve SP Secretariat office
        const orgService = getOrgService(ctx);
        const spOffice = await orgService.getOfficeByCode(SP_SECRETARIAT_OFFICE_CODE, auth.cityId);
        if (!spOffice) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'SP Secretariat office not found; cannot verify document ownership.',
          });
        }

        // Ownership check: each document must belong to the SP Secretariat (I1 §7.5)
        const docsRepo = (ctx.req.server as any).documentsRepository;
        for (const documentId of input.documentIds) {
          const docRow = docsRepo ? await docsRepo.findById(documentId) : null;
          if (!docRow) {
            throw new TRPCError({ code: 'NOT_FOUND', message: `Document ${documentId} not found.` });
          }
          const docOfficeId = docRow.originatingOfficeId ?? docRow.ownedByOfficeId;
          if (docOfficeId !== spOffice.officeId) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `Document ${documentId} is not in the SP Secretariat's scope.`,
            });
          }
        }

        const qrCodeService = getQrCodeService(ctx);
        const pdfBuffer = await qrCodeService.generateCoverSheetPdf(
          input.documentIds,
          input.layout,
          docsRepo ?? undefined
        );

        // Upload PDF to S3 and return a presigned URL
        const s3Client = getS3Client();
        const s3Bucket = env.S3_BUCKET || 'batac-dms-assets';
        const pdfKey = `cover-sheets/${auth.userId}/${Date.now()}.pdf`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: pdfKey,
            Body: pdfBuffer,
            ContentType: 'application/pdf',
          })
        );

        const expirySeconds = parseInt(String(env.S3_SIGNED_URL_EXPIRES_S ?? 3600), 10);
        const pdfPresignedUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: s3Bucket, Key: pdfKey }),
          { expiresIn: expirySeconds }
        );

        return { pdfPresignedUrl };
      }),

    // -----------------------------------------------------------------------
    // tracking.getRoutingHistory
    // E1 §Module 5; I1 §7.1
    // -----------------------------------------------------------------------
    getRoutingHistory: protectedProcedure
      .input(z.object({ documentId: z.string().uuid() }))
      .output(z.array(RoutingEntryOutputSchema))
      .query(async ({ ctx, input }) => {
        // Resolve document for ABAC
        const docsRepo = (ctx.req.server as any).documentsRepository;
        const docRow = docsRepo ? await docsRepo.findById(input.documentId) : null;
        if (!docRow) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
        }

        const officeId: string = docRow.originatingOfficeId ?? docRow.ownedByOfficeId ?? '';
        const classificationLevel: string = docRow.classificationLevel ?? 'internal';

        if (!canReadTrackingRecord(ctx, officeId, classificationLevel)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not authorised to view this routing history.' });
        }

        const trackingService = getTrackingService(ctx);
        const entries = await trackingService.getRoutingHistory(input.documentId, ctx.auth!.userId);

        // Resolve actorDisplayName for each entry
        const resolved = await Promise.all(
          entries.map(async (entry) => ({
            entryId: entry.entryId,
            fromOfficeId: entry.fromOfficeId,
            toOfficeId: entry.toOfficeId,
            actorId: entry.actorId,
            actorDisplayName: await resolveActorDisplayName(ctx, entry.actorId),
            actionDescription: entry.actionDescription,
            timestamp: entry.timestamp,
          }))
        );

        return resolved;
      }),

    // -----------------------------------------------------------------------
    // tracking.logRoutingEntry
    // E1 §Module 5; I1 §7.2
    // Phase 1: sp_secretary only; other offices deferred to Phase 2.
    // -----------------------------------------------------------------------
    logRoutingEntry: protectedProcedure
      .input(
        z.object({
          documentId: z.string().uuid(),
          toOfficeId: z.string().uuid().nullable(),
          actionDescription: z.string().min(1),
        })
      )
      .output(z.object({ entryId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const auth = ctx.auth!;

        // Gate: sp_secretary only (I1 §7.2)
        const isSpSecretary =
          auth.roles.includes('sp_secretary') || auth.effectiveRoles.includes('sp_secretary');
        if (!isSpSecretary) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Only the SP Secretary may log physical routing entries.' });
        }

        // Resolve SP Secretariat office for ownership check
        const orgService = getOrgService(ctx);
        const spOffice = await orgService.getOfficeByCode(SP_SECRETARIAT_OFFICE_CODE, auth.cityId);
        if (!spOffice) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'SP Secretariat office not found; cannot verify document ownership.',
          });
        }

        // Ownership check: document must be an SP Secretariat document (I1 §7.2)
        const docsRepo = (ctx.req.server as any).documentsRepository;
        const docRow = docsRepo ? await docsRepo.findById(input.documentId) : null;
        if (!docRow) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
        }
        const docOfficeId = docRow.originatingOfficeId ?? docRow.ownedByOfficeId;
        if (docOfficeId !== spOffice.officeId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Physical routing entries can only be logged for SP Secretariat documents in Phase 1.',
          });
        }

        // Get current custodian office from the tracking record row (raw)
        const trackingRepo = getTrackingRepository(ctx);
        const trackingRecordRow = await trackingRepo.findTrackingRecordRowByDocumentId(input.documentId);
        if (!trackingRecordRow) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No tracking record found for this document. QR code must be generated first.',
          });
        }

        const entry = await trackingRepo.appendRoutingEntry({
          trackingRecordId: trackingRecordRow.id,
          fromOfficeId: trackingRecordRow.currentCustodianOfficeId,
          toOfficeId: input.toOfficeId,
          actorId: auth.userId,
          actionDescription: input.actionDescription,
          cityId: auth.cityId,
        });

        // Update the tracking record's current custodian
        if (input.toOfficeId !== null) {
          await trackingRepo.updateTrackingRecordCustodian(
            trackingRecordRow.id,
            input.toOfficeId,
            new Date()
          );
        }

        return { entryId: entry.id };
      }),

    // -----------------------------------------------------------------------
    // tracking.scanQrCodeAuthenticated
    // E1 §Module 5; I1 §7.3
    // Any authenticated non-citizen, non-system role may use this.
    // -----------------------------------------------------------------------
    scanQrCodeAuthenticated: protectedProcedure
      .input(z.object({ qrTrackingNumber: z.string().uuid() }))
      .output(
        z.object({
          documentType: z.string(),
          remarks: z.string().nullable(),
          fullRoutingHistory: z.array(
            z.object({
              actionDescription: z.string(),
              actorDisplayName: z.string(),
              timestamp: z.coerce.date(),
            })
          ),
          firstPageImageUrl: z.string().url(),
          getCopyAvailable: z.literal(true),
        })
      )
      .query(async ({ ctx, input }) => {
        const auth = ctx.auth!;

        // Gate: any authenticated non-citizen, non-system role (I1 §7.3)
        const hasPermission =
          auth.roles.some((r) => AUTHENTICATED_SCAN_ROLES.has(r)) ||
          auth.effectiveRoles.some((r) => AUTHENTICATED_SCAN_ROLES.has(r));
        if (!hasPermission) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Your role is not permitted to perform an authenticated QR scan.' });
        }

        const trackingRepo = getTrackingRepository(ctx);
        const qrCode = await trackingRepo.findQrCodeByTrackingId(input.qrTrackingNumber);
        if (!qrCode) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'QR tracking ID not found.' });
        }

        const documentsService = getDocumentsService(ctx);
        const doc = await documentsService.getDocumentById(qrCode.documentId);
        if (!doc) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
        }

        // Routing history — full history from draft for the authenticated scan (I1 §7.3)
        const trackingService = getTrackingService(ctx);
        const entries = await trackingService.getRoutingHistory(qrCode.documentId, auth.userId);

        const fullRoutingHistory = await Promise.all(
          entries.map(async (entry) => ({
            actionDescription: entry.actionDescription,
            actorDisplayName: await resolveActorDisplayName(ctx, entry.actorId),
            timestamp: entry.timestamp,
          }))
        );

        // First page preview: canonical key set by TASK-DOCS-010's generateFirstPagePreview.
        const previewKey = `documents/previews/${qrCode.documentId}/page-1.webp`;
        const expirySeconds = parseInt(String(env.S3_SIGNED_URL_EXPIRES_S ?? 3600), 10);
        const s3Client = getS3Client();
        const s3Bucket = env.S3_BUCKET || 'batac-dms-assets';

        const firstPageImageUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({ Bucket: s3Bucket, Key: previewKey }),
          { expiresIn: expirySeconds }
        );

        // [Inference] `remarks` is not exposed on DocumentSummary in Phase 1.
        // Returning null until the Documents module exposes a remarks field.
        // See development-findings-log.md LOG-0037.
        const remarks: string | null = null;

        return {
          documentType: doc.documentTypeCode,
          remarks,
          fullRoutingHistory,
          firstPageImageUrl,
          getCopyAvailable: true as const,
        };
      }),
  });
}

// Re-export a static instance for the tRPC root
export const trackingRouter = createTrackingRouter();
