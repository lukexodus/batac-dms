import { z } from 'zod';
import { createSelectSchema, createInsertSchema, createUpdateSchema } from 'drizzle-zod';
import {
  documents,
  versions,
  documentTypes,
  attachments,
  numbers,
  signatures,
  panlalawiganReviews,
} from '@batac/database/schema/documents.schema.js';
import {
  UuidSchema,
  TimestampSchema,
  DateSchema,
  PaginationInputSchema,
  SortOrderSchema,
  DateRangeSchema,
  AllowedMimeTypeSchema,
} from './common.js';
import { OfficeSummarySchema } from './organization.js';

// Enums
/**
 * [Inference — TASK-DOCS-011] Corrected against the authoritative 11-value
 * set: packages/database/schema/documents.schema.ts `documents_lifecycle_state_check`
 * (identical to `DocumentLifecycleState` in apps/server/.../documents.types.ts
 * and the VALID_TRANSITIONS map in documents.service.ts). The previous 9-value
 * list here ("under_review", "approved", "rejected") predates the D3
 * post-ADR-013/ADR-014 state-machine revision documented at the top of
 * documents.schema.ts ("[Discovered Issue #1]" / "[Discovered Issue #2]") and
 * does not parse real rows (e.g. 'submitted', 'in_workflow'). Nothing outside
 * this file imported `LifecycleStateSchema` prior to this change (verified by
 * repo-wide grep), so widening it here is additive and non-breaking. See
 * docs/development-findings-log.md for the full note.
 */
export const LifecycleStateSchema = z.enum([
  'draft',
  'submitted',
  'in_workflow',
  'pending_mayor_action',
  'pending_panlalawigan_review',
  'completed',
  'released',
  'archived',
  'disposed',
  'cancelled',
  'superseded',
]);
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

export const ClassificationLevelSchema = z.enum([
  'public',
  'internal',
  'confidential',
  'restricted',
]);
export type ClassificationLevel = z.infer<typeof ClassificationLevelSchema>;

export const PublicVisibilityRuleSchema = z.enum([
  'title_and_first_page_public',
  'not_public',
  'complainant_restricted',
  'requester_restricted',
]);
export type PublicVisibilityRule = z.infer<typeof PublicVisibilityRuleSchema>;

export const AttachmentTypeSchema = z.enum([
  'certification_of_urgency',
  'committee_report',
  'transmittal_letter',
  'scan',
  'other',
]);
export type AttachmentType = z.infer<typeof AttachmentTypeSchema>;

export const SignatureTypeSchema = z.enum([
  'presiding_officer',
  'mayor',
  'sp_secretary',
  'vice_mayor',
  'committee_chair',
]);
export type SignatureType = z.infer<typeof SignatureTypeSchema>;

export const PanlalawiganOutcomeSchema = z.enum([
  'valid',
  'valid_in_part',
  'returned',
  'operative_in_its_entirety',
  'deemed_approved',
]);
export type PanlalawiganOutcome = z.infer<typeof PanlalawiganOutcomeSchema>;

export const ScanQualityCategorySchema = z.enum(['good', 'fair', 'poor']);
export type ScanQualityCategory = z.infer<typeof ScanQualityCategorySchema>;

// Document Type
export const DocumentTypeSummarySchema = z.object({
  id: UuidSchema,
  name: z.string(),
  code: z.string(),
  classificationDefault: ClassificationLevelSchema,
  preliminaryNumbering: z.boolean(),
});
export type DocumentTypeSummary = z.infer<typeof DocumentTypeSummarySchema>;

export const DocumentTypeSelectSchema = z.object({
  ...createSelectSchema(documentTypes).omit({
    cityId: true,
    deletedAt: true,
    deletedBy: true,
  }).shape,
  id: UuidSchema,
  numberSeriesId: UuidSchema.nullable(),
  // Renamed from Drizzle's `hasPreliminaryNumbering` to
  // `preliminaryNumbering` to match this field's existing, established
  // name in this schema. Confirmed via repo-wide search: no live code
  // outside this file depends on the OLD Drizzle-matching name
  // (`hasPreliminaryNumbering` is not referenced anywhere as a property
  // access), so this override is a safe rename, not a compatibility
  // requirement — kept as an explicit override rather than accepting the
  // derived name because `preliminaryNumbering` is the name already used
  // by this schema's existing consumers, and there was no reason found
  // to force a rename onto them.
  preliminaryNumbering: z.boolean(),
  classificationDefault: ClassificationLevelSchema,
  publicVisibilityRule: PublicVisibilityRuleSchema,
  metadataSchema: z.record(z.string(), z.unknown()),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type DocumentTypeSelect = z.infer<typeof DocumentTypeSelectSchema>;

// Core Document
export const DocumentSelectSchema = z.object({
  ...createSelectSchema(documents).omit({
    cityId: true,
    numberSeriesId: true,
    draftedByEmployeeId: true,
    retentionScheduleId: true,
    tsv: true,
    deletedAt: true,
    deletedBy: true,
  }).shape,
  id: UuidSchema,
  documentTypeId: UuidSchema,
  documentType: DocumentTypeSummarySchema,
  title: z.string().min(1),
  // [KNOWN GAP — see docs/development-findings-log.md] The underlying
  // Drizzle column (lifecycle_state) is plain text() with the 11-value
  // constraint living only in a raw SQL CHECK — Drizzle's type system
  // has no way to derive an enum from that. This means TypeScript CANNOT
  // catch it if this override key is ever misspelled, renamed, or
  // dropped — it would silently fall back to an unconstrained string
  // with zero compile error. This override is the ONLY place this
  // constraint is enforced at the type level. Do not remove it without
  // first giving the underlying column a real Drizzle-level type (native
  // pgEnum or .$type<LifecycleState>() narrowing) — a schema-level
  // change outside the scope of this file.
  lifecycleState: LifecycleStateSchema,
  // classificationLevel has the identical gap — see the comment above
  // lifecycleState.
  classificationLevel: ClassificationLevelSchema,
  qrTrackingNumber: UuidSchema,
  preliminaryNumber: z.string().nullable(),
  finalNumber: z.string().nullable(),
  controlNumber: z.string().nullable(),
  originatingOfficeId: UuidSchema,
  originatingOffice: OfficeSummarySchema,
  ownedByOfficeId: UuidSchema,
  createdBy: UuidSchema,
  workflowInstanceId: UuidSchema.nullable(),
  versionNumber: z.number().int().min(1),
  metadata: z.record(z.string(), z.unknown()),
  supersededBy: UuidSchema.nullable(),
  supersededAt: TimestampSchema.nullable(),
  closureReason: z.string().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type DocumentSelect = z.infer<typeof DocumentSelectSchema>;

export const DocumentSummarySchema = z.object({
  id: UuidSchema,
  title: z.string(),
  documentTypeCode: z.string(),
  lifecycleState: LifecycleStateSchema,
  preliminaryNumber: z.string().nullable(),
  finalNumber: z.string().nullable(),
  qrTrackingNumber: UuidSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;

export const LogDocumentInputSchema = z.object({
  documentTypeId: UuidSchema,
  title: z.string().min(1).max(1024).trim(),
  classificationLevel: ClassificationLevelSchema,
  originatingOfficeId: UuidSchema,
  ownedByOfficeId: UuidSchema,
  metadata: z.record(z.string(), z.unknown()),
  uploadedFile: z.object({
    s3Key: z.string().min(1),
    originalFilename: z.string().max(512),
    mimeType: AllowedMimeTypeSchema,
    fileSizeBytes: z.number().int().positive().max(26_214_400),
  }),
});
export type LogDocumentInput = z.infer<typeof LogDocumentInputSchema>;

export const DocumentFilterSchema = z.object({
  documentTypeCode: z.string().optional(),
  lifecycleState: LifecycleStateSchema.optional(),
  classificationLevel: ClassificationLevelSchema.optional(),
  officeId: UuidSchema.optional(),
  search: z.string().max(256).optional(),
  dateRange: DateRangeSchema.optional(),
  sortBy: z
    .enum(['title', 'createdAt', 'updatedAt', 'finalNumber', 'lifecycleState'])
    .default('createdAt'),
  sortOrder: SortOrderSchema,
  ...PaginationInputSchema.shape,
});
export type DocumentFilter = z.infer<typeof DocumentFilterSchema>;

export const CancelDocumentInputSchema = z.object({
  documentId: UuidSchema,
  reason: z.string().min(10).max(1024).trim(),
});
export type CancelDocumentInput = z.infer<typeof CancelDocumentInputSchema>;

// --- General CRUD (TASK-DOCS-011) ---------------------------------------

export const CreateDocumentInputSchema = createInsertSchema(documents, {
  title: (schema) => schema.min(1).max(500).trim(),
}).pick({
  documentTypeId: true,
  title: true,
  classificationLevel: true,
  metadata: true,
}).extend({
  classificationLevel: ClassificationLevelSchema.default('internal'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type CreateDocumentInput = z.infer<typeof CreateDocumentInputSchema>;

export const CreateDocumentOutputSchema = z.object({
  documentId: UuidSchema,
  lifecycleState: z.literal('draft'),
});
export type CreateDocumentOutput = z.infer<typeof CreateDocumentOutputSchema>;

/** Shared by documents.get, documents.getMetadataForAdmin, and documents.delete. */
export const DocumentIdInputSchema = z.object({
  documentId: UuidSchema,
});
export type DocumentIdInput = z.infer<typeof DocumentIdInputSchema>;

export const UpdateDocumentInputSchema = z.object({
  documentId: UuidSchema,
  ...createUpdateSchema(documents, {
    title: (schema) => schema.min(1).max(500).trim(),
  }).pick({
    title: true,
    metadata: true,
  }).shape,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentInputSchema>;

/** Narrow projection for documents.getMetadataForAdmin (sys_admin only, Gate 2). */
export const AdminDocumentMetadataSchema = z.object({
  documentId: UuidSchema,
  title: z.string(),
  lifecycleState: LifecycleStateSchema,
  finalNumber: z.string().nullable(),
  classificationLevel: ClassificationLevelSchema,
});
export type AdminDocumentMetadata = z.infer<typeof AdminDocumentMetadataSchema>;

export const ListDocumentsInputSchema = z.object({
  documentTypeId: UuidSchema.optional(),
  lifecycleState: LifecycleStateSchema.optional(),
  officeId: UuidSchema.optional(),
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
  ...PaginationInputSchema.shape,
});
export type ListDocumentsInput = z.infer<typeof ListDocumentsInputSchema>;

export const ListDocumentsOutputSchema = z.object({
  items: z.array(DocumentSummarySchema),
  nextCursor: UuidSchema.nullable(),
});
export type ListDocumentsOutput = z.infer<typeof ListDocumentsOutputSchema>;

export const SearchDocumentsInputSchema = z.object({
  queryText: z.string().min(1).max(256),
  documentTypeIds: z.array(UuidSchema).max(20).optional(),
  classificationLevels: z.array(ClassificationLevelSchema).max(4).optional(),
  dateFrom: DateSchema.optional(),
  dateTo: DateSchema.optional(),
  ...PaginationInputSchema.shape,
});
export type SearchDocumentsInput = z.infer<typeof SearchDocumentsInputSchema>;

export const SearchResultItemSchema = z.object({
  documentId: UuidSchema,
  title: z.string(),
  documentTypeName: z.string(),
  finalNumber: z.string().nullable(),
  currentState: LifecycleStateSchema,
});
export type SearchResultItem = z.infer<typeof SearchResultItemSchema>;

export const SearchDocumentsOutputSchema = z.object({
  items: z.array(SearchResultItemSchema),
  nextCursor: UuidSchema.nullable(),
});
export type SearchDocumentsOutput = z.infer<typeof SearchDocumentsOutputSchema>;

// Versions
export const VersionSelectSchema = z.object({
  ...createSelectSchema(versions).omit({
    cityId: true,
    ocrText: true,
    tsv: true,
    verifiedBy: true,
    verifiedAt: true,
    requiresManualVerification: true,
    createdBy: true,
  }).shape,
  id: UuidSchema,
  documentId: UuidSchema,
  versionNumber: z.number().int().min(1),
  fileKey: UuidSchema,
  originalFilename: z.string().nullable(),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().positive(),
  pageCount: z.number().int().positive().nullable(),
  scanQualityScore: z.number().min(0).max(1).nullable(),
  scanQualityCategory: ScanQualityCategorySchema.nullable(),
  ocrProcessed: z.boolean(),
  uploadedBy: UuidSchema,
  createdAt: TimestampSchema,
});
export type VersionSelect = z.infer<typeof VersionSelectSchema>;

export const UploadNewVersionInputSchema = z.object({
  documentId: UuidSchema,
  s3Key: z.string().min(1),
  originalFilename: z.string().max(512),
  mimeType: AllowedMimeTypeSchema,
  fileSizeBytes: z.number().int().positive().max(26_214_400),
  reason: z.string().min(1).max(512).trim(),
});
export type UploadNewVersionInput = z.infer<typeof UploadNewVersionInputSchema>;

export const RequestUploadUrlInputSchema = z.object({
  documentId: UuidSchema,
  mimeType: AllowedMimeTypeSchema,
});
export type RequestUploadUrlInput = z.infer<typeof RequestUploadUrlInputSchema>;

export const RequestUploadUrlOutputSchema = z.object({
  s3Key: z.string(),
  uploadUrl: z.string(),
});
export type RequestUploadUrlOutput = z.infer<typeof RequestUploadUrlOutputSchema>;

export const ConfirmUploadInputSchema = z.object({
  documentId: UuidSchema,
  s3Key: z.string(),
  originalFilename: z.string().max(512),
  mimeType: AllowedMimeTypeSchema,
  fileSizeBytes: z.number().int().positive().max(26_214_400),
  reason: z.string().max(512).optional(),
});
export type ConfirmUploadInput = z.infer<typeof ConfirmUploadInputSchema>;

export const ConfirmUploadOutputSchema = z.object({
  versionId: UuidSchema,
});
export type ConfirmUploadOutput = z.infer<typeof ConfirmUploadOutputSchema>;

export const VersionIdInputSchema = z.object({
  versionId: UuidSchema,
});
export type VersionIdInput = z.infer<typeof VersionIdInputSchema>;

export const DownloadVersionInputSchema = z.object({
  versionId: UuidSchema,
});
export type DownloadVersionInput = z.infer<typeof DownloadVersionInputSchema>;

export const DownloadVersionOutputSchema = z.object({
  downloadUrl: z.string(),
  expiresAt: TimestampSchema,
});
export type DownloadVersionOutput = z.infer<typeof DownloadVersionOutputSchema>;

export const OcrTextOutputSchema = z.object({
  ocrText: z.string().nullable(),
});
export type OcrTextOutput = z.infer<typeof OcrTextOutputSchema>;

export const ScanQualityIndicatorOutputSchema = z.object({
  scanQualityCategory: ScanQualityCategorySchema.nullable(),
  scanQualityScore: z.number().nullable(),
  requiresManualVerification: z.boolean(),
});
export type ScanQualityIndicatorOutput = z.infer<typeof ScanQualityIndicatorOutputSchema>;

export const FlagScannedBackInputSchema = z.object({
  versionId: UuidSchema,
  reason: z.string().min(1).max(512),
});
export type FlagScannedBackInput = z.infer<typeof FlagScannedBackInputSchema>;

// Attachments
export const AttachmentSelectSchema = z.object({
  ...createSelectSchema(attachments).omit({
    cityId: true,
    deletedAt: true,
    deletedBy: true,
  }).shape,
  id: UuidSchema,
  documentId: UuidSchema,
  // Renamed from Drizzle's `fileKey` to `s3Key` to match this field's
  // existing, established name in this schema. Confirmed via repo-wide
  // search: no live code depends on the OLD Drizzle-matching name
  // (`fileKey` is not referenced as a property access on any
  // attachment-shaped object outside this file), so this is a safe
  // rename. The underlying Drizzle column is nullable
  // (`fileKey: uuid('file_key')`, no `.notNull()`), but this schema's
  // existing consumers expect a non-nullable string — preserved as-is
  // below rather than silently widening to nullable, since that would be
  // a behavior change beyond this task's scope. If a genuinely
  // attachment-without-a-file-key row can exist (the Drizzle comment for
  // `sourceDocumentId` below suggests one can — a Certification of
  // Urgency attachment referencing a source document instead of its own
  // file), this non-nullable override may be WRONG and is flagged here
  // as a finding, not silently resolved:
  s3Key: z.string(),
  sourceDocumentId: UuidSchema.nullable(),
  description: z.string().nullable(),
  fileSizeBytes: z.number().int().positive(),
  uploadedBy: UuidSchema,
  createdAt: TimestampSchema,
});
export type AttachmentSelect = z.infer<typeof AttachmentSelectSchema>;

export const UploadAttachmentInputSchema = z.object({
  documentId: UuidSchema,
  attachmentType: AttachmentTypeSchema,
  description: z.string().max(512).optional(),
  s3Key: z.string().min(1),
  mimeType: AllowedMimeTypeSchema,
  fileSizeBytes: z.number().int().positive().max(26_214_400),
});
export type UploadAttachmentInput = z.infer<typeof UploadAttachmentInputSchema>;

// Numbers
export const DocumentNumberSelectSchema = z.object({
  ...createSelectSchema(numbers).omit({
    cityId: true,
    deletedAt: true,
    deletedBy: true,
  }).shape,
  id: UuidSchema,
  documentId: UuidSchema,
  // Renamed from Drizzle's `numberSeriesId` to `seriesId` to match this
  // field's existing, established name in this schema. Confirmed via
  // repo-wide search: no live code depends on the OLD Drizzle-matching
  // name (`numberSeriesId` is not referenced as a property access on any
  // number-shaped object outside this file), so this is a safe rename.
  seriesId: UuidSchema,
  numberValue: z.string(),
  assignedAt: TimestampSchema,
  assignedBy: UuidSchema,
  supersededAt: TimestampSchema.nullable(),
  cancellationReason: z.string().nullable(),
});
export type DocumentNumberSelect = z.infer<typeof DocumentNumberSelectSchema>;

export const AssignFinalNumberInputSchema = z.object({
  documentId: UuidSchema,
  reason: z.string().min(1).max(512).trim(),
});
export type AssignFinalNumberInput = z.infer<typeof AssignFinalNumberInputSchema>;

// Signatures
export const SignatureSelectSchema = z.object({
  ...createSelectSchema(signatures).omit({
    cityId: true,
    deletedAt: true,
    deletedBy: true,
  }).shape,
  id: UuidSchema,
  documentId: UuidSchema,
  signedByEmployeeId: UuidSchema,
  signedByDisplayName: z.string().nullable(),
  signedAt: TimestampSchema,
  signatureImageS3Key: z.string().nullable(),
  createdAt: TimestampSchema,
});
export type SignatureSelect = z.infer<typeof SignatureSelectSchema>;

export const LogSignatureInputSchema = z.object({
  documentId: UuidSchema,
  signedByEmployeeId: UuidSchema,
  signedByDisplayName: z.string().min(1).max(256).trim(),
  signatureType: SignatureTypeSchema,
  signedAt: TimestampSchema,
  isWetInk: z.boolean().default(true),
  signatureImageS3Key: z.uuid().optional(),
});
export type LogSignatureInput = z.infer<typeof LogSignatureInputSchema>;

// Panlalawigan
export const PanlalawiganReviewSelectSchema = z.object({
  ...createSelectSchema(panlalawiganReviews).omit({
    cityId: true,
    deletedAt: true,
    deletedBy: true,
  }).shape,
  id: UuidSchema,
  documentId: UuidSchema,
  numberSeriesId: UuidSchema.nullable(),
  // OVERRIDE REQUIRED, NOT OPTIONAL: the underlying Drizzle column is
  // named `controlNo` (DB: `control_no`), but this schema has ALWAYS
  // exposed it as `controlNumber`, and live code genuinely depends on
  // that name — confirmed via repo-wide search:
  // `apps/server/src/modules/workflow/workflow.router.ts` line ~1940
  // reads `input.controlNumber`. Renaming this to match Drizzle would
  // break that call site. Do NOT rename to `controlNo` — keep the
  // override exactly as below.
  controlNumber: z.string().nullable(),
  subject: z.string().nullable(),
  transmittedAt: TimestampSchema.nullable(),
  receivedAt: TimestampSchema.nullable(),
  actionDeadline: TimestampSchema.nullable(),
  responseDate: TimestampSchema.nullable(),
  outcome: PanlalawiganOutcomeSchema.nullable(),
  // OVERRIDE REQUIRED, NOT OPTIONAL: same situation as controlNumber
  // above — the underlying Drizzle column is named `resolutionNumber`,
  // but this schema has always exposed it as
  // `panlalawiganResolutionNumber`, and live code depends on that name
  // (`apps/server/src/modules/workflow/workflow.router.ts` line ~1941,
  // `apps/server/src/modules/documents/panlalawigan.router.ts` line
  // ~138). Do NOT rename to `resolutionNumber` — keep the override
  // exactly as below.
  panlalawiganResolutionNumber: z.string().nullable(),
  remarks: z.string().nullable(),
  daysElapsed: z.number().int().nonnegative().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type PanlalawiganReviewSelect = z.infer<typeof PanlalawiganReviewSelectSchema>;

export const InitiatePanlalawiganTransmittalInputSchema = z.object({
  documentId: UuidSchema,
  transmittedAt: TimestampSchema,
  controlNumber: z.string().max(64).optional(),
  subject: z.string().max(512).optional(),
});
export type InitiatePanlalawiganTransmittalInput = z.infer<
  typeof InitiatePanlalawiganTransmittalInputSchema
>;

export const LogPanlalawiganOutcomeInputSchema = z
  .object({
    documentId: UuidSchema,
    outcome: PanlalawiganOutcomeSchema,
    panlalawiganResolutionNumber: z.string().max(64).optional(),
    receivedAt: TimestampSchema,
    dateReferred: TimestampSchema.optional(),
    remarks: z.string().max(2048).optional(),
  })
  .refine((v) => v.outcome !== 'valid_in_part' || (v.remarks && v.remarks.length >= 10), {
    message: 'Remarks required for VALID-IN-PART (min 10 chars)',
    path: ['remarks'],
  })
  .refine((v) => v.outcome !== 'returned' || (v.remarks && v.remarks.length >= 10), {
    message: 'Remarks required for RETURNED (min 10 chars)',
    path: ['remarks'],
  });
export type LogPanlalawiganOutcomeInput = z.infer<typeof LogPanlalawiganOutcomeInputSchema>;

// --- SP Workflow & Secretariat Specifics (TASK-DOCS-012) ---

export const SubmitDocumentInputSchema = z.object({
  documentId: UuidSchema,
});
export type SubmitDocumentInput = z.infer<typeof SubmitDocumentInputSchema>;

export const SubmitDocumentOutputSchema = z.object({
  lifecycleState: z.literal('submitted'),
  qrTrackingNumber: UuidSchema,
  preliminaryNumber: z.string().nullable(),
});
export type SubmitDocumentOutput = z.infer<typeof SubmitDocumentOutputSchema>;

export const AssignPreliminaryNumberInputSchema = z.object({
  documentId: UuidSchema,
});
export type AssignPreliminaryNumberInput = z.infer<typeof AssignPreliminaryNumberInputSchema>;

export const AssignPreliminaryNumberOutputSchema = z.object({
  preliminaryNumber: z.string(),
});
export type AssignPreliminaryNumberOutput = z.infer<typeof AssignPreliminaryNumberOutputSchema>;

// Note: AssignFinalNumberInputSchema is already defined above at line 398, but the prompt
// requested it to just be { documentId: z.string().uuid() }. The existing one includes `reason`.
// I will create a specific schema for this procedure to match the acceptance criteria,
// or I could just re-use DocumentIdInputSchema. I'll use DocumentIdInputSchema for input,
// and create the output schema.
export const AssignFinalNumberOutputSchema = z.object({
  finalNumber: z.string(),
  assignedAt: TimestampSchema,
});
export type AssignFinalNumberOutput = z.infer<typeof AssignFinalNumberOutputSchema>;

export const LogCertificationOfUrgencyInputSchema = z.object({
  certifyingDocumentId: UuidSchema,
  associatedMeasureIds: z.array(UuidSchema).min(1).max(10),
});
export type LogCertificationOfUrgencyInput = z.infer<typeof LogCertificationOfUrgencyInputSchema>;

export const LogCertificationOfUrgencyOutputSchema = z.object({
  certificationDocumentId: UuidSchema,
  affectedDocumentIds: z.array(UuidSchema),
});
export type LogCertificationOfUrgencyOutput = z.infer<typeof LogCertificationOfUrgencyOutputSchema>;

export const PortalPublishInputSchema = z.object({
  documentId: UuidSchema,
});
export type PortalPublishInput = z.infer<typeof PortalPublishInputSchema>;

export const ArchiveDocumentInputSchema = z.object({
  documentId: UuidSchema,
});
export type ArchiveDocumentInput = z.infer<typeof ArchiveDocumentInputSchema>;

export const LogSecretariatDecisionInputSchema = z.object({
  documentId: UuidSchema,
  stepInstanceId: UuidSchema,
  decision: z.enum(['approve', 'reject', 'amended']),
  remarks: z.string().max(2048).optional(),
});
export type LogSecretariatDecisionInput = z.infer<typeof LogSecretariatDecisionInputSchema>;
