/**
 * Portal Public REST Endpoint Schemas
 *
 * File: packages/shared/src/schemas/portal.ts
 * Spec references: E2 §PublishedDocumentSummary, §PublishedDocumentDetail,
 *                  §ComplaintSubmissionRequest, §ComplaintSubmissionResult,
 *                  §DocumentRequestSubmissionRequest, §DocumentRequestSubmissionResult
 *                  E3 (document types and portal contracts)
 *
 * Covers three public portal endpoints:
 *   GET  /v1/public/documents               — list published legislative documents
 *   GET  /v1/public/documents/{documentId}  — single published document detail
 *   POST /v1/public/complaints              — citizen complaint submission
 *   POST /v1/public/document-requests       — document copy request form submission
 *
 * All Phase 1 public portal endpoints are unauthenticated (no JWT required).
 */

import { z } from 'zod';
import { UuidSchema, TimestampSchema, DateSchema } from './common.js';
import { PresignedImageRefSchema } from './tracking.js';
import { ComplaintViolationTypeSchema } from './document-metadata.js';

// Re-export so consumers can import this type from the portal schemas too.
export { ComplaintViolationTypeSchema } from './document-metadata.js';
export type ComplaintViolationType = z.infer<typeof ComplaintViolationTypeSchema>;

// ─── Shared enums ─────────────────────────────────────────────────────────────

/**
 * Phase 1 public document types.
 *
 * Document types that are not publicly listed (CITIZEN_COMPLAINT,
 * DOCUMENT_REQUEST_FORM, CERTIFICATION_OF_URGENCY, TRANSMITTAL_LETTER) are
 * never returned by public document endpoints.
 *
 * Source: E2 §PublishedDocumentType
 * Layers: [B] [F] [R]
 */
export const PublicDocumentTypeSchema = z.enum([
  'SP_RESOLUTION',
  'SP_ORDINANCE',
  'APPROPRIATION_ORDINANCE',
]);
export type PublicDocumentType = z.infer<typeof PublicDocumentTypeSchema>;

/**
 * Outcome of the Sangguniang Panlalawigan 30-day review per RA 7160 §56.
 *
 * Null when the review has not yet concluded.
 * `operative_in_its_entirety` applies specifically to Appropriation Ordinances.
 * `deemed_approved` — 30 days elapsed with no Panlalawigan action (RA 7160 §56(d)).
 *
 * Source: E2 §PanlalawiganOutcome, documents.panlalawigan_outcome_enum (C1 §4.2)
 * Layers: [R]
 */
export const PublicPanlalawiganOutcomeSchema = z
  .enum([
    'valid',
    'valid_in_part',
    'returned',
    'operative_in_its_entirety',
    'deemed_approved',
  ])
  .nullable();
export type PublicPanlalawiganOutcome = z.infer<typeof PublicPanlalawiganOutcomeSchema>;

/**
 * How a complaint form was completed.
 *
 * - `digital_form` — citizen filled the form online; system generates a
 *   printable copy; citizen must print, sign, and submit physically.
 * - `clerk_assisted` — Secretariat staff filled the form on behalf of a citizen
 *   present in person; physical signing happens on-site.
 *
 * Source: E2 §ComplaintAccessMode
 * Layers: [B] [F]
 */
export const ComplaintAccessModeSchema = z.enum(['digital_form', 'clerk_assisted']);
export type ComplaintAccessMode = z.infer<typeof ComplaintAccessModeSchema>;

/**
 * How a document request form was completed.
 *
 * Mirrors the complaint access mode semantics for the document request flow.
 *
 * Source: E2 §DocumentRequestAccessMode
 * Layers: [B] [F]
 */
export const DocumentRequestAccessModeSchema = z.enum(['digital_form', 'clerk_assisted']);
export type DocumentRequestAccessMode = z.infer<typeof DocumentRequestAccessModeSchema>;

// ─── Pagination meta (offset-based, for public list endpoints) ────────────────

/**
 * Offset-based pagination metadata returned by the public documents list endpoint.
 *
 * Source: E2 §PaginationMeta
 * Layers: [R]
 */
export const PublicPaginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});
export type PublicPaginationMeta = z.infer<typeof PublicPaginationMetaSchema>;

// ─── GET /v1/public/documents — Query parameters ─────────────────────────────

/**
 * Query parameters for `GET /v1/public/documents`.
 *
 * When `number` is provided it takes precedence over all other filters and
 * returns at most one result (exact final-series-number match).
 *
 * `q` uses PostgreSQL full-text search in Phase 1 (tsvector/tsquery).
 * Minimum 2 characters. Supports Filipino, English, and Ilocano text.
 *
 * Results default to descending final-number assignment date (most recently
 * approved first).
 *
 * Source: E2 §PublishedDocuments list parameters
 * Layers: [B]
 */
export const PublicDocumentsQuerySchema = z.object({
  documentType: PublicDocumentTypeSchema.optional(),
  year: z.number().int().min(2000).max(2099).optional(),
  number: z.string().max(50).optional(),
  q: z.string().min(2).max(200).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type PublicDocumentsQuery = z.infer<typeof PublicDocumentsQuerySchema>;

// ─── Published document — summary (list item) ─────────────────────────────────

/**
 * Single item in the published documents list.
 *
 * Only documents with `public_visibility_rule = 'title_and_first_page_public'`
 * are returned. Internal, confidential, and restricted documents are excluded.
 *
 * `firstPagePreview` is a presigned URL for the first page image only (TTL:
 * 15 minutes). All subsequent pages are blurred at the rendering layer. Full
 * copies require a Document Request Form.
 *
 * Source: E2 §PublishedDocumentSummary
 * Layers: [B] [R]
 */
export const PublishedDocumentSummarySchema = z.object({
  documentId: UuidSchema,
  documentType: PublicDocumentTypeSchema,
  documentTypeName: z.string(),
  title: z.string(),
  /** Final series number e.g. "7SP 2026-02". Space-delimited format (consolidated ref Part 5.1). */
  finalNumber: z.string(),
  /**
   * Date of the last reading vote (Second Reading for Resolutions; Third
   * Reading for Ordinances). This is when the final number was assigned.
   */
  approvedAt: DateSchema,
  /**
   * Timestamp when the document was released to the public portal
   * (lifecycle_state transition to "released").
   */
  releasedAt: TimestampSchema,
  trackingNumber: UuidSchema,
  firstPagePreview: PresignedImageRefSchema.nullable(),
  documentRequestUrl: z.url(),
  supersededBy: UuidSchema.nullable(),
  supersededAt: TimestampSchema.nullable(),
  closureReason: z.string().nullable(),
});
export type PublishedDocumentSummary = z.infer<typeof PublishedDocumentSummarySchema>;

// ─── Published document — detail (single document endpoint) ──────────────────

/**
 * Full metadata for a single published legislative document.
 *
 * Returned by `GET /v1/public/documents/{documentId}`.
 * Extends `PublishedDocumentSummary` with authorship, committee, Panlalawigan
 * review, and publication details.
 *
 * Returns 404 if:
 * - The document does not exist
 * - The document has not been released (still in workflow)
 * - The document's public_visibility_rule is not 'title_and_first_page_public'
 *
 * Source: E2 §PublishedDocumentDetail
 * Layers: [B] [R]
 */
export const PublishedDocumentDetailSchema = PublishedDocumentSummarySchema.extend({
  /**
   * Full names of councilors and Vice Mayor who authored or co-authored the
   * measure, as recorded in the document title and Index of Ordinances.
   */
  authors: z.array(z.string()),
  /**
   * Formal sponsors of the measure. Only councilors can sponsor; the Vice
   * Mayor is included/mentioned after the title but is not a sponsor in the
   * technical sense (consolidated reference Part 4.1).
   */
  sponsors: z.array(z.string()),
  /**
   * Names of standing committees that reviewed the measure via a joint hearing.
   * Standard practice: subject-matter committee plus Committee on Laws, Rules,
   * Ethics & Privileges (consolidated reference Part 8.1).
   */
  committees: z.array(z.string()),
  panlalawiganOutcome: PublicPanlalawiganOutcomeSchema,
  /**
   * Date of Panlalawigan action, or the lapse date for `deemed_approved`
   * outcomes (30 days from transmission date). Null if outcome is still pending.
   */
  panlalawiganOutcomeDate: DateSchema.nullable(),
  /**
   * True if this ordinance includes a penalty provision and has been published
   * in a newspaper of general circulation (Ilocos Times). Always false for SP
   * Resolutions and Appropriation Ordinances. Per consolidated reference Part
   * 4.2, SP Secretariat arranges publication; date is a mandatory tracked field.
   */
  hasNewspaperPublication: z.boolean(),
  /** Date of newspaper publication. Null for documents that do not require publication. */
  newspaperPublicationDate: DateSchema.nullable(),
});
export type PublishedDocumentDetail = z.infer<typeof PublishedDocumentDetailSchema>;

// ─── GET /v1/public/documents — Response envelopes ───────────────────────────

/**
 * Response envelope for `GET /v1/public/documents`.
 *
 * Source: E2 §PublishedDocumentListResponse
 * Layers: [B] [R]
 */
export const PublishedDocumentListResponseSchema = z.object({
  data: z.array(PublishedDocumentSummarySchema),
  meta: PublicPaginationMetaSchema,
});
export type PublishedDocumentListResponse = z.infer<typeof PublishedDocumentListResponseSchema>;

/**
 * Path parameters for `GET /v1/public/documents/{documentId}`.
 *
 * Layers: [B]
 */
export const PublicDocumentParamsSchema = z.object({
  documentId: UuidSchema,
});
export type PublicDocumentParams = z.infer<typeof PublicDocumentParamsSchema>;

/**
 * Response envelope for `GET /v1/public/documents/{documentId}`.
 *
 * Source: E2 §PublishedDocumentDetailResponse
 * Layers: [B] [R]
 */
export const PublishedDocumentDetailResponseSchema = z.object({
  data: PublishedDocumentDetailSchema,
});
export type PublishedDocumentDetailResponse = z.infer<typeof PublishedDocumentDetailResponseSchema>;

// ─── POST /v1/public/complaints ───────────────────────────────────────────────

/**
 * Request body for `POST /v1/public/complaints`.
 *
 * Complaints may cover any LGU-related matter — not limited to transportation
 * subjects (consolidated reference Part 4.14).
 *
 * Routing note: the SP Secretariat decides routing after submission — to a
 * committee directly, or to the Vice Mayor, depending on the nature of the
 * complaint. There is no fixed routing rule.
 *
 * Rate limit: 20 requests per IP per hour (anti-spam).
 *
 * Source: E2 §ComplaintSubmissionRequest
 * Layers: [B] [F]
 */
export const SubmitComplaintInputSchema = z
  .object({
    violationType: ComplaintViolationTypeSchema,
    /**
     * Required when violationType is 'other'. Free-text description of the
     * complaint subject.
     */
    violationTypeOther: z.string().max(500).nullable().optional(),
    /** Tricycle or vehicle body/plate number, if applicable to a transportation complaint. */
    tricycleNumber: z.string().max(50).nullable().optional(),
    /** Date the incident or violation occurred (ISO 8601 date). */
    incidentDate: DateSchema,
    /** Time of the incident in 24-hour HH:MM format. */
    incidentTime: z
      .string()
      .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Must be in 24-hour HH:MM format (e.g. "14:30")'),
    /** Location where the incident occurred. */
    place: z.string().max(500),
    /** Additional context or details about the incident. */
    remarks: z.string().max(2000).nullable().optional(),
    complainantName: z.string().max(200),
    complainantAddress: z.string().max(500),
    complainantContact: z.string().max(50),
    complainantEmail: z.email().max(254).nullable().optional(),
    respondentName: z.string().max(200).nullable().optional(),
    respondentContact: z.string().max(50).nullable().optional(),
    respondentEmail: z.email().max(254).nullable().optional(),
    accessMode: ComplaintAccessModeSchema,
  })
  .refine(
    (v) => v.violationType !== 'other' || (v.violationTypeOther && v.violationTypeOther.length > 0),
    {
      message: "Required when violationType is 'other'",
      path: ['violationTypeOther'],
    },
  );
export type SubmitComplaintInput = z.infer<typeof SubmitComplaintInputSchema>;

export const ComplaintSubmissionRequestSchema = SubmitComplaintInputSchema;
export type ComplaintSubmissionRequest = SubmitComplaintInput;

/**
 * Data returned on successful complaint submission.
 *
 * `referenceCode` format: `COMP-{YYYY}-{NNNN}` (zero-padded to 4 digits).
 *
 * `status` is always `pending_hearing` on initial submission. Subsequent
 * transitions (received_seen → dismissed or resolved) are not surfaced via
 * the public API in Phase 1.
 *
 * Source: E2 §ComplaintSubmissionResult
 * Layers: [R]
 */
export const ComplaintSubmissionResultSchema = z.object({
  complaintId: UuidSchema,
  referenceCode: z.string(),
  submittedAt: TimestampSchema,
  status: z.literal('pending_hearing'),
  message: z.string(),
  /**
   * Present when accessMode is 'digital_form'. Presigned URL to download the
   * system-generated printable complaint form. Valid for 24 hours.
   */
  printableFormUrl: z.url().nullable(),
});
export type ComplaintSubmissionResult = z.infer<typeof ComplaintSubmissionResultSchema>;

/**
 * Full response envelope for `POST /v1/public/complaints`.
 *
 * Source: E2 §ComplaintSubmissionResponse
 * Layers: [B] [R]
 */
export const ComplaintSubmissionResponseSchema = z.object({
  data: ComplaintSubmissionResultSchema,
});
export type ComplaintSubmissionResponse = z.infer<typeof ComplaintSubmissionResponseSchema>;

// ─── POST /v1/public/document-requests ───────────────────────────────────────

/**
 * Request body for `POST /v1/public/document-requests`.
 *
 * Submits a request for a certified copy of an SP document.
 *
 * Fee structure: Secretary's Fees under Ordinance No. 3SP 2014-05. Per-page
 * fee applies. Payment is collected in person at the Secretariat after approval.
 * Payment processing via this API is deferred to a future phase
 * (consolidated reference Part 4.15).
 *
 * Approval required: Vice Mayor AND SP Secretary must both sign before the
 * copy is released.
 *
 * Rate limit: 20 requests per IP per hour.
 *
 * Source: E2 §DocumentRequestSubmissionRequest
 * Layers: [B] [F]
 */
export const SubmitDocumentRequestInputSchema = z.object({
  requesterName: z.string().max(200),
  /** Agency, department, or organization of the requester, if applicable. */
  requesterAgency: z.string().max(300).nullable().optional(),
  /**
   * Email address for notifications. Contact number is the primary notification
   * channel after approval; email is supplementary (consolidated reference Part 4.15).
   */
  requesterEmail: z.email().max(254),
  /**
   * Primary contact number. The requester is contacted here when the request
   * is approved and ready for payment collection.
   */
  requesterPhone: z.string().max(50).nullable().optional(),
  documentType: PublicDocumentTypeSchema,
  /**
   * Full title of the document being requested, as printed on the physical
   * document or as shown on the public portal.
   */
  documentTitle: z.string().max(1000),
  /**
   * Series number (e.g. "7SP 2026-03"). Provide if known; the Secretariat
   * will verify this on processing. May be null if the requester does not know
   * the exact number.
   */
  documentNumber: z.string().max(50).nullable().optional(),
  /**
   * Number of pages to be copied. Affects the fee calculation under Ordinance
   * No. 3SP 2014-05. If null, the Secretariat will fill this in during processing.
   */
  numberOfPagesCopied: z.number().int().min(1).nullable().optional(),
  purpose: z.string().max(1000),
  /**
   * Type of government-issued identification that will be presented by the
   * requester when submitting the signed physical form. Accepted: Government
   * employee ID, birth certificate, barangay residency certificate, or any
   * government-issued photo ID.
   */
  idType: z.string().max(100),
  accessMode: DocumentRequestAccessModeSchema,
});
export type SubmitDocumentRequestInput = z.infer<typeof SubmitDocumentRequestInputSchema>;

/**
 * Data returned on successful document request submission.
 *
 * `referenceCode` format: `DREQ-{YYYY}-{NNNN}` (zero-padded to 4 digits).
 *
 * `estimatedWorkingDays` is based on RA 11032 (ARTA) default SLA thresholds:
 * simple transactions ≤ 3 working days. Actual processing may vary; this is
 * an informational estimate only.
 *
 * Source: E2 §DocumentRequestSubmissionResult
 * Layers: [R]
 */
export const DocumentRequestSubmissionResultSchema = z.object({
  requestId: UuidSchema,
  referenceCode: z.string(),
  submittedAt: TimestampSchema,
  message: z.string(),
  estimatedWorkingDays: z.number().int().positive().nullable(),
  /**
   * Present when accessMode is 'digital_form'. Presigned URL to download the
   * system-generated printable Document Request Form. Valid for 24 hours.
   */
  printableFormUrl: z.url().nullable(),
});
export type DocumentRequestSubmissionResult = z.infer<typeof DocumentRequestSubmissionResultSchema>;

/**
 * Full response envelope for `POST /v1/public/document-requests`.
 *
 * Source: E2 §DocumentRequestSubmissionResponse
 * Layers: [B] [R]
 */
export const DocumentRequestSubmissionResponseSchema = z.object({
  data: DocumentRequestSubmissionResultSchema,
});
export type DocumentRequestSubmissionResponse = z.infer<
  typeof DocumentRequestSubmissionResponseSchema
>;
