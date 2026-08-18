/**
 * Tracking / QR Code Domain Schemas
 *
 * File: packages/shared/src/schemas/tracking.ts
 * Spec references: E2 §TrackingLookupData, §RoutingHistoryEntry, §PresignedImageRef
 *                  E3 Part 7
 *
 * NOTE [Inference — TASK-PORTAL-002]: E3's QrCodeScanResultSchema uses
 * `UserSummarySchema` (from the IAM domain, iam.ts — not yet created) for the
 * actor field inside routing history entries. However, E2's authoritative
 * OpenAPI contract represents the actor as `actorDisplayName: string | null`
 * (a display-name string, not an embedded user object). The public REST layer
 * is unauthenticated and must not expose internal user UUIDs or IAM objects;
 * E2 is correct. This file implements the E2 shape. See
 * docs/development-findings-log.md for the full note.
 */

import { z } from 'zod';
import { UuidSchema, TimestampSchema, DateSchema } from './common.js';

// ─── Path parameters ─────────────────────────────────────────────────────────

/**
 * Path parameters for `GET /v1/public/tracking/{trackingNumber}`.
 *
 * The `trackingNumber` is the QR UUID assigned at secretariat logging — immutable
 * for the document's full lifetime (per consolidated reference Part 11.6).
 * It is independent of the preliminary and final series numbers.
 *
 * Source: documents.documents.qr_tracking_number (C1 §4.5)
 *
 * Layers: [B]
 */
export const TrackingParamsSchema = z.object({
  trackingNumber: UuidSchema,
});
export type TrackingParams = z.infer<typeof TrackingParamsSchema>;

// ─── Presigned image reference ────────────────────────────────────────────────

/**
 * A presigned S3-compatible URL for a first-page image preview.
 *
 * Default TTL: 15 minutes (configurable via PRESIGNED_URL_TTL_SECONDS).
 * Clients must not cache beyond `expiresAt`. Re-fetch the parent endpoint
 * after expiry to obtain a fresh URL.
 *
 * Spec: E2 §PresignedImageRef
 *
 * Layers: [R]
 */
export const PresignedImageRefSchema = z.object({
  url: z.url(),
  expiresAt: TimestampSchema,
  widthPx: z.number().int().nullable().optional(),
  heightPx: z.number().int().nullable().optional(),
});
export type PresignedImageRef = z.infer<typeof PresignedImageRefSchema>;

// ─── Routing history ─────────────────────────────────────────────────────────

/**
 * A single entry in a document's routing history.
 *
 * `actorDisplayName` is null when the action was system-generated (e.g., a
 * lapse timer firing) or when disclosure is restricted by classification level.
 *
 * Spec: E2 §RoutingHistoryEntry
 *
 * Layers: [R]
 */
export const RoutingHistoryEntrySchema = z.object({
  timestamp: TimestampSchema,
  action: z.string(),
  fromOfficeName: z.string().nullable(),
  toOfficeName: z.string().nullable(),
  actorDisplayName: z.string().nullable(),
});
export type RoutingHistoryEntry = z.infer<typeof RoutingHistoryEntrySchema>;

// ─── Tracking lookup response ─────────────────────────────────────────────────

/**
 * Data payload returned by `GET /v1/public/tracking/{trackingNumber}`.
 *
 * Returns information for documents at any lifecycle stage, not only released
 * documents. A document still in workflow will show its current routing history.
 *
 * `lifecycleStatus` is a human-readable display label (locale-aware), not the
 * raw `lifecycle_state` DB enum. It is derived from both the lifecycle_state and
 * the current workflow step for richer display (e.g. "With Mayor — Pending
 * Signature" rather than the raw "in_workflow").
 *
 * `firstPagePreview` is a presigned URL for the first page image only (TTL: 15 min).
 * All subsequent pages are blurred at the rendering layer.
 *
 * Spec: E2 §TrackingLookupData
 *
 * Layers: [B] [R]
 */
export const TrackingLookupDataSchema = z.object({
  trackingNumber: UuidSchema,
  documentId: UuidSchema,
  documentType: z.string(),
  documentTypeName: z.string(),
  title: z.string(),
  preliminaryNumber: z.string().nullable(),
  finalNumber: z.string().nullable(),
  /** Free-text display label — not the raw lifecycle_state enum value. */
  lifecycleStatus: z.string(),
  remarks: z.string().nullable(),
  routingHistory: z.array(RoutingHistoryEntrySchema),
  firstPagePreview: PresignedImageRefSchema.nullable(),
  /**
   * Either an absolute URL (when APP_BASE_URL is set — see
   * tracking.public-handler.ts) or a root-relative path beginning with "/"
   * (the default when APP_BASE_URL is unset). Both shapes are accepted
   * deliberately; do not narrow this back to z.url() alone without first
   * confirming APP_BASE_URL is populated in every environment this schema
   * validates responses for.
   */
  documentRequestUrl: z.union([
    z.url(),
    z.string().regex(/^\/[^\s]*$/, 'must be an absolute URL or a root-relative path'),
  ]),
  supersededBy: UuidSchema.nullable(),
  supersededAt: TimestampSchema.nullable(),
  closureReason: z.string().nullable(),
});
export type TrackingLookupData = z.infer<typeof TrackingLookupDataSchema>;

/**
 * Full response envelope for `GET /v1/public/tracking/{trackingNumber}`.
 *
 * Spec: E2 §TrackingLookupResponse
 *
 * Layers: [B] [R]
 */
export const TrackingLookupResponseSchema = z.object({
  data: TrackingLookupDataSchema,
});
export type TrackingLookupResponse = z.infer<typeof TrackingLookupResponseSchema>;

// ─── Internal / tRPC schemas (re-exported from E3 Part 7) ────────────────────
// These are used by the internal tRPC routing layer and are distinct from the
// public REST shapes above.

/**
 * Input for recording a new routing entry in the DTS.
 *
 * Layers: [B] [T] [F]
 */
export const LogRoutingEntryInputSchema = z.object({
  documentId: UuidSchema,
  fromOfficeId: UuidSchema.optional(),
  toOfficeId: UuidSchema,
  action: z.string().min(1).max(128).trim(),
  notes: z.string().max(1024).optional(),
  occurredAt: TimestampSchema,
});
export type LogRoutingEntryInput = z.infer<typeof LogRoutingEntryInputSchema>;

/**
 * Input schema for QR scan operations (tRPC only).
 *
 * Layers: [B] [T]
 */
export const QrScanInputSchema = z.object({
  trackingNumber: UuidSchema,
});
export type QrScanInput = z.infer<typeof QrScanInputSchema>;
