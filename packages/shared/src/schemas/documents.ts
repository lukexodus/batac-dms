import { z } from "zod";
import {
  UuidSchema,
  TimestampSchema,
  PaginationInputSchema,
  SortOrderSchema,
  DateRangeSchema,
  AllowedMimeTypeSchema,
} from "./common.js";
import { OfficeSummarySchema } from "./organization.js";

// Enums
export const LifecycleStateSchema = z.enum([
  "draft",
  "under_review",
  "pending_mayor_action",
  "pending_panlalawigan_review",
  "approved",
  "released",
  "superseded",
  "cancelled",
  "rejected",
]);
export type LifecycleState = z.infer<typeof LifecycleStateSchema>;

export const ClassificationLevelSchema = z.enum(["public", "internal", "confidential", "restricted"]);
export type ClassificationLevel = z.infer<typeof ClassificationLevelSchema>;

export const PublicVisibilityRuleSchema = z.enum([
  "title_and_first_page_public",
  "not_public",
  "complainant_restricted",
  "requester_restricted",
]);
export type PublicVisibilityRule = z.infer<typeof PublicVisibilityRuleSchema>;

export const NumberTypeSchema = z.enum(["preliminary", "final"]);
export type NumberType = z.infer<typeof NumberTypeSchema>;

export const AttachmentTypeSchema = z.enum([
  "certification_of_urgency",
  "committee_report",
  "transmittal_letter",
  "scan",
  "other",
]);
export type AttachmentType = z.infer<typeof AttachmentTypeSchema>;

export const SignatureTypeSchema = z.enum([
  "presiding_officer",
  "mayor",
  "sp_secretary",
  "vice_mayor",
  "committee_chair",
]);
export type SignatureType = z.infer<typeof SignatureTypeSchema>;

export const PanlalawiganOutcomeSchema = z.enum([
  "valid",
  "valid_in_part",
  "returned",
  "operative_in_its_entirety",
  "deemed_approved",
]);
export type PanlalawiganOutcome = z.infer<typeof PanlalawiganOutcomeSchema>;

export const ScanQualityCategorySchema = z.enum(["good", "fair", "poor"]);
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
  id: UuidSchema,
  name: z.string(),
  code: z.string(),
  owningModule: z.string(),
  numberSeriesId: UuidSchema.nullable(),
  preliminaryNumbering: z.boolean(),
  controlNumberDeferred: z.boolean(),
  classificationDefault: ClassificationLevelSchema,
  publicVisibilityRule: PublicVisibilityRuleSchema,
  metadataSchema: z.record(z.unknown()),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type DocumentTypeSelect = z.infer<typeof DocumentTypeSelectSchema>;

// Core Document
export const DocumentSelectSchema = z.object({
  id: UuidSchema,
  documentTypeId: UuidSchema,
  documentType: DocumentTypeSummarySchema,
  title: z.string().min(1),
  lifecycleState: LifecycleStateSchema,
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
  metadata: z.record(z.unknown()),
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
  metadata: z.record(z.unknown()),
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
  sortBy: z.enum(["title", "createdAt", "updatedAt", "finalNumber", "lifecycleState"]).default("createdAt"),
  sortOrder: SortOrderSchema,
  ...PaginationInputSchema.shape,
});
export type DocumentFilter = z.infer<typeof DocumentFilterSchema>;

export const CancelDocumentInputSchema = z.object({
  documentId: UuidSchema,
  reason: z.string().min(10).max(1024).trim(),
});
export type CancelDocumentInput = z.infer<typeof CancelDocumentInputSchema>;

// Versions
export const VersionSelectSchema = z.object({
  id: UuidSchema,
  documentId: UuidSchema,
  versionNumber: z.number().int().min(1),
  s3Key: z.string(),
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

// Attachments
export const AttachmentSelectSchema = z.object({
  id: UuidSchema,
  documentId: UuidSchema,
  s3Key: z.string(),
  attachmentType: AttachmentTypeSchema,
  description: z.string().nullable(),
  mimeType: z.string(),
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
  id: UuidSchema,
  documentId: UuidSchema,
  seriesId: UuidSchema,
  numberType: NumberTypeSchema,
  numberValue: z.string(),
  sequenceYear: z.number().int(),
  sequenceNumber: z.number().int(),
  isCurrent: z.boolean(),
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
  id: UuidSchema,
  documentId: UuidSchema,
  signedByEmployeeId: UuidSchema,
  signedByDisplayName: z.string(),
  signatureType: SignatureTypeSchema,
  signedAt: TimestampSchema,
  isWetInk: z.boolean(),
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
  signatureImageS3Key: z.string().optional(),
});
export type LogSignatureInput = z.infer<typeof LogSignatureInputSchema>;

// Panlalawigan
export const PanlalawiganReviewSelectSchema = z.object({
  id: UuidSchema,
  documentId: UuidSchema,
  controlNumber: z.string().nullable(),
  subject: z.string().nullable(),
  transmittedAt: TimestampSchema.nullable(),
  receivedAt: TimestampSchema.nullable(),
  dateReferred: TimestampSchema.nullable(),
  outcome: PanlalawiganOutcomeSchema.nullable(),
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
export type InitiatePanlalawiganTransmittalInput = z.infer<typeof InitiatePanlalawiganTransmittalInputSchema>;

export const LogPanlalawiganOutcomeInputSchema = z
  .object({
    documentId: UuidSchema,
    outcome: PanlalawiganOutcomeSchema,
    panlalawiganResolutionNumber: z.string().max(64).optional(),
    receivedAt: TimestampSchema,
    dateReferred: TimestampSchema.optional(),
    remarks: z.string().max(2048).optional(),
  })
  .refine((v) => v.outcome !== "valid_in_part" || (v.remarks && v.remarks.length >= 10), {
    message: "Remarks required for VALID-IN-PART (min 10 chars)",
    path: ["remarks"],
  })
  .refine((v) => v.outcome !== "returned" || (v.remarks && v.remarks.length >= 10), {
    message: "Remarks required for RETURNED (min 10 chars)",
    path: ["remarks"],
  });
export type LogPanlalawiganOutcomeInput = z.infer<typeof LogPanlalawiganOutcomeInputSchema>;
