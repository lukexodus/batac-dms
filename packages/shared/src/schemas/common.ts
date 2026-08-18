import { z } from 'zod';

// ─── Primitive scalars ────────────────────────────────────────────────────────

export const UuidSchema = z.uuid();
export type Uuid = z.infer<typeof UuidSchema>;

export const TimestampSchema = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;

export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date — expected YYYY-MM-DD');
export type DateString = z.infer<typeof DateSchema>;

// ─── Pagination ───────────────────────────────────────────────────────────────

/** Cursor-based pagination — used by most internal tRPC list procedures. */
export const PaginationInputSchema = z.object({
  cursor: UuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(25),
});
export type PaginationInput = z.infer<typeof PaginationInputSchema>;

/** Offset-based pagination — used by public REST list endpoints and reports. */
export const OffsetPaginationInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(25),
});
export type OffsetPaginationInput = z.infer<typeof OffsetPaginationInputSchema>;

/**
 * Generic paginated list wrapper.
 *
 * Usage: `PaginatedResponseSchema(DocumentSummarySchema)`
 *
 * Layers: [R]
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: UuidSchema.nullable(),
    total: z.number().int().nonnegative(),
  });

// ─── Sorting ──────────────────────────────────────────────────────────────────

export const SortOrderSchema = z.enum(['asc', 'desc']).default('asc');
export type SortOrder = z.infer<typeof SortOrderSchema>;

// ─── Date range ───────────────────────────────────────────────────────────────

export const DateRangeSchema = z
  .object({
    from: DateSchema.optional(),
    to: DateSchema.optional(),
  })
  .refine((v) => !(v.from && v.to) || v.from <= v.to, {
    message: "'from' must not be later than 'to'",
  });
export type DateRange = z.infer<typeof DateRangeSchema>;

// ─── Path parameters ─────────────────────────────────────────────────────────

/** Path parameters for `/:id` routes. Layers: [B] [T] */
export const IdParamsSchema = z.object({
  id: UuidSchema,
});
export type IdParams = z.infer<typeof IdParamsSchema>;

// ─── Error envelope ───────────────────────────────────────────────────────────

/**
 * Standard error body returned by all Fastify error responses.
 *
 * Layers: [R]
 */
export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const ValidationErrorResponseSchema = ErrorResponseSchema.extend({
  details: z.array(
    z.object({
      field: z.string(),
      message: z.string(),
      code: z.string().optional(),
    })
  ).optional(),
});
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;

// ─── File upload ─────────────────────────────────────────────────────────────

export const AllowedMimeTypeSchema = z.enum([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);
export type AllowedMimeType = z.infer<typeof AllowedMimeTypeSchema>;

/**
 * Client requests a pre-signed S3 upload URL before sending a file.
 * Files are streamed directly to S3-compatible storage per the file storage
 * strategy — they never pass through the application server.
 *
 * Layers: [B] [T] [R]
 */
export const PresignedUploadRequestSchema = z.object({
  filename: z.string().max(512),
  mimeType: AllowedMimeTypeSchema,
  fileSizeBytes: z.number().int().positive().max(26_214_400), // 25 MB cap
});
export type PresignedUploadRequest = z.infer<typeof PresignedUploadRequestSchema>;

export const PresignedUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  s3Key: z.string().min(1),
  expiresAt: TimestampSchema,
});
export type PresignedUploadResponse = z.infer<typeof PresignedUploadResponseSchema>;

// ─── Health check ─────────────────────────────────────────────────────────────

/**
 * Service health status values.
 *
 * - `ok` — all dependencies healthy; all operations available
 * - `degraded` — non-critical dependency unavailable; primary read operations
 *   continue; mutations may be affected
 * - `unavailable` — PostgreSQL unreachable; service cannot operate
 *
 * Layers: [B] [R]
 */
export const HealthStatusSchema = z.enum(['ok', 'degraded', 'unavailable']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

/**
 * Response schema for `GET /v1/health`.
 *
 * Layers: [B] [R]
 */
export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  version: z.string(),
  timestamp: TimestampSchema,
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
