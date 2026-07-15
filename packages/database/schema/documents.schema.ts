import {
  pgSchema,
  pgEnum,
  uuid,
  text,
  boolean,
  timestamp,
  smallint,
  integer,
  bigint,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  unique,
  check,
  customType,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * The `documents` PostgreSQL schema.
 *
 * Document lifecycle state machine, immutable version storage, two-stage
 * series numbering (preliminary → final), OCR-on-upload, QR cover sheet
 * generation, Panlalawigan review log, scanned signature tracking, and
 * sponsorship tracking.
 *
 * Sources:
 *   C1 Part 5 DDL (L741–L1233)
 *   C1 Part 1 (cross-schema FK / PK / city_id / timestamp / soft-delete conventions)
 *   ADR-DB-001 (panlalawigan_review_log has no document_types row, by design)
 *
 * NOTE ([Unverified] — not part of any source document): TASK-DOCS-001's AI
 * Prompt deliverable paths read `/packages/database/src/schema/documents.ts`
 * and `/apps/server/src/database/migrations/...`. Neither path exists in this
 * repository — there is no `src/` segment under `packages/database`, and
 * migrations live in `/packages/database/migrations/` per drizzle.config.ts
 * and C5 §2.1. This file is placed at the verified, established location
 * (`packages/database/schema/documents.schema.ts`, matching `iam.schema.ts`,
 * `organization.schema.ts`, etc.) instead of the literal AI Prompt path.
 */
export const documentsSchema = pgSchema('documents');

export const lifecycleStateEnum = documentsSchema.enum('lifecycle_state_enum', [
  'draft', 'submitted', 'in_workflow', 'pending_mayor_action',
  'pending_panlalawigan_review', 'completed', 'released', 'archived',
  'disposed', 'cancelled', 'superseded',
]);

export const classificationLevelEnum = documentsSchema.enum('classification_level_enum', [
  'public', 'internal', 'confidential', 'restricted',
]);

export const owningModuleEnum = documentsSchema.enum('owning_module_enum', [
  'workflow', 'organization', 'portal',
]);

export const publicVisibilityRuleEnum = documentsSchema.enum('public_visibility_rule_enum', [
  'title_and_first_page_public', 'not_public', 'complainant_restricted', 'requester_restricted',
]);

export const seriesTypeEnum = documentsSchema.enum('series_type_enum', [
  'legislative', 'administrative',
]);

export const phaseEnum = documentsSchema.enum('phase_enum', [
  '1', '1b',
]);

export const numberTypeEnum = documentsSchema.enum('number_type_enum', [
  'preliminary', 'final', 'control',
]);

export const scanQualityCategoryEnum = documentsSchema.enum('scan_quality_category_enum', [
  'good', 'fair', 'poor',
]);

export const attachmentTypeEnum = documentsSchema.enum('attachment_type_enum', [
  'certification_of_urgency', 'committee_report', 'transmittal_letter', 'scan', 'other',
]);

export const signatureTypeEnum = documentsSchema.enum('signature_type_enum', [
  'presiding_officer', 'mayor', 'sp_secretary', 'vice_mayor', 'committee_chair',
]);

export const sponsorshipTypeEnum = documentsSchema.enum('sponsorship_type_enum', [
  'principal_author', 'co_author', 'introducer', 'co_introducer',
]);

export const panlalawiganOutcomeEnum = documentsSchema.enum('panlalawigan_outcome_enum', [
  'valid', 'valid_in_part', 'returned', 'operative_in_its_entirety', 'deemed_approved',
]);

/**
 * `tsvector` has no built-in Drizzle pg-core column helper as of drizzle-orm
 * 0.45.2 (verified: no `tsvector` export under `drizzle-orm/pg-core`). Defined
 * here via `customType` so `documents.documents.tsv` and
 * `documents.versions.tsv` can be declared in-schema rather than appended as
 * post-generation manual SQL.
 */
const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

// ---------------------------------------------------------------------------
// documents.document_types
// owning_module is a routing/ownership label for the module that governs this
// document type's workflow. is_active DEFAULT false — types must be
// explicitly activated (C1 Decision 3.10).
// ---------------------------------------------------------------------------
export const documentTypes = documentsSchema.table(
  'document_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    name: text('name').notNull(),
    code: text('code').notNull(),
    owningModule: owningModuleEnum('owning_module').notNull(),
    /**
     * FK added after `numberSeries` below — breaks the circular DDL
     * dependency between document_types and number_series (C1 Part 5).
     */
    numberSeriesId: uuid('number_series_id').references((): AnyPgColumn => numberSeries.id),
    hasPreliminaryNumbering: boolean('has_preliminary_numbering').notNull().default(false),
    controlNumberDeferred: boolean('control_number_deferred').notNull().default(false),
    requiresPublication: boolean('requires_publication').notNull().default(false),
    retentionScheduleId: uuid('retention_schedule_id'), // logical FK -> records.retention_schedules.id (cross-schema)
    classificationDefault: classificationLevelEnum('classification_default').notNull(),
    publicVisibilityRule: publicVisibilityRuleEnum('public_visibility_rule').notNull(),
    requiredStepTypes: text('required_step_types').array(),
    metadataSchema: jsonb('metadata_schema'),
    isActive: boolean('is_active').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_document_types_city_code').on(table.cityId, table.code),
    check(
      'ck_document_types_retention_before_activation',
      sql`${table.isActive} = false OR ${table.retentionScheduleId} IS NOT NULL`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// documents.number_series
// document_type_id is NULL specifically for the panlalawigan_review_log
// series, which has no document_types row (confirmed per ADR-DB-001, not
// deferred). series_type and phase are load-bearing columns per H3 Table
// 1/D4 §SeriesType (C1 Decision 3.11).
// ---------------------------------------------------------------------------
export const numberSeries = documentsSchema.table(
  'number_series',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    seriesKey: text('series_key').notNull(),
    documentTypeId: uuid('document_type_id').references((): AnyPgColumn => documentTypes.id),
    seriesType: seriesTypeEnum('series_type').notNull(),
    /** '1' = active in Phase 1; '1b' = Phase 1B (seeded inactive, activated later). */
    phase: phaseEnum('phase').notNull().default('1'),
    prefix: text('prefix'),
    /**
     * Separates the "7" in "7SP" from the prefix string so an administration
     * change is a single field update. [Inference — H3 Note 1]
     */
    spOrdinal: text('sp_ordinal'),
    delimiter: text('delimiter').notNull().default(' '),
    sequencePadding: smallint('sequence_padding').notNull(),
    /** Used by fn_get_next_sequence_value() to locate the year's sequence, e.g. 'ns_nch' -> 'documents.ns_nch_2026_seq'. */
    sequenceNamePrefix: text('sequence_name_prefix').notNull(),
    yearFormat: text('year_format').notNull().default('YYYY'),
    preliminaryFormat: text('preliminary_format'),
    finalFormat: text('final_format').notNull(),
    resetsAnnually: boolean('resets_annually').notNull().default(true),
    authorityOfficeId: uuid('authority_office_id').notNull(), // logical FK -> organization.offices.id (cross-schema)
    preliminaryAssignmentEvent: text('preliminary_assignment_event'),
    finalAssignmentEvent: text('final_assignment_event').notNull(),
    deferredFinalAssignment: boolean('deferred_final_assignment').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_number_series_city_key').on(table.cityId, table.seriesKey),
  ],
);

// ---------------------------------------------------------------------------
// documents.documents
// lifecycle_state value set per D3 post-ADR-013/ADR-014 (C1 Discovered
// Issue #1). [Discovered Issue #2] superseded_by, superseded_at,
// closure_reason columns added per D3 L121 (ADR-014: "'Superseded' terminal
// state requires these").
// ---------------------------------------------------------------------------
export const documents = documentsSchema.table(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentTypeId: uuid('document_type_id')
      .notNull()
      .references(() => documentTypes.id),
    title: text('title').notNull(),
    lifecycleState: lifecycleStateEnum('lifecycle_state').notNull().default('draft'),
    classificationLevel: classificationLevelEnum('classification_level').notNull(),
    /** UUID encoded into the physical QR code. Immutable from QR assignment. */
    qrTrackingNumber: uuid('qr_tracking_number').notNull(),
    /** Denormalized current number values for fast reads; full history lives in documents.numbers. */
    preliminaryNumber: text('preliminary_number'),
    finalNumber: text('final_number'),
    /** Used only for Letters Received (SPR) / Letters Sent (SPS) per H2. */
    controlNumber: text('control_number'),
    numberSeriesId: uuid('number_series_id').references(() => numberSeries.id),
    originatingOfficeId: uuid('originating_office_id').notNull(), // logical FK -> organization.offices.id (cross-schema)
    ownedByOfficeId: uuid('owned_by_office_id').notNull(), // logical FK -> organization.offices.id (cross-schema)
    draftedByEmployeeId: uuid('drafted_by_employee_id'), // logical FK -> organization.employees.id (cross-schema)
    createdBy: uuid('created_by').notNull(), // logical FK -> iam.users.id (cross-schema)
    workflowInstanceId: uuid('workflow_instance_id'), // logical FK -> workflow.instances.id (cross-schema)
    retentionScheduleId: uuid('retention_schedule_id').notNull(), // logical FK -> records.retention_schedules.id (cross-schema)
    versionNumber: integer('version_number').notNull().default(1),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`),
    /** FTS vector for title; maintained by trg_documents_tsv_update (manual SQL). */
    tsv: tsvector('tsv'),
    /** superseded_by/superseded_at/closure_reason required for the 'superseded' terminal state (D3 L121, ADR-014). */
    supersededBy: uuid('superseded_by').references((): AnyPgColumn => documents.id),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    closureReason: text('closure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_documents_qr_tracking_number').on(table.qrTrackingNumber),
    index('idx_documents_type').on(table.documentTypeId),
    index('idx_documents_lifecycle_state').on(table.lifecycleState),
    index('idx_documents_originating_office').on(table.originatingOfficeId),
    index('idx_documents_owned_by_office').on(table.ownedByOfficeId),
    index('idx_documents_workflow_instance').on(table.workflowInstanceId),
    index('idx_documents_metadata_gin').using('gin', table.metadata),
    index('idx_documents_metadata_certified_urgent').on(sql`(metadata->>'certified_urgent')`),
    index('idx_documents_metadata_has_penalty').on(sql`(metadata->>'has_penalty_provision')`),
    index('idx_documents_metadata_outcome_state').on(sql`(metadata->>'outcome_state')`),
  ],
);

// ---------------------------------------------------------------------------
// documents.numbers
// Historical/event-sourced ledger of every number assignment. PRELIMINARY
// rows flip is_current = false when superseded, never edited in place. FINAL
// and CONTROL numbers are immutable once assigned (trg_numbers_immutability,
// manual SQL). No updated_at column — append-only / one-flag-flip-only per
// C1 §1.4 exception list.
// ---------------------------------------------------------------------------
export const numbers = documentsSchema.table(
  'numbers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    numberSeriesId: uuid('number_series_id')
      .notNull()
      .references(() => numberSeries.id),
    /** 'control' is for Letters Received/Sent (SPR/SPS) only. */
    numberType: numberTypeEnum('number_type').notNull(),
    numberValue: text('number_value').notNull(),
    sequenceYear: smallint('sequence_year').notNull(),
    sequenceNumber: integer('sequence_number').notNull(),
    isCurrent: boolean('is_current').notNull().default(true),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid('assigned_by').notNull(), // logical FK -> iam.users.id (cross-schema)
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    cancellationReason: text('cancellation_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    /** Scoped to (series, year, sequence) — not the rendered format string, since two series can legitimately render the same text. */
    unique('uq_numbers_series_year_seq').on(
      table.numberSeriesId,
      table.sequenceYear,
      table.sequenceNumber,
    ),
    /** At most one current number per type per document. */
    uniqueIndex('uq_numbers_one_current_per_type')
      .on(table.documentId, table.numberType)
      .where(sql`is_current = true AND deleted_at IS NULL`),
    index('idx_numbers_document').on(table.documentId),
  ],
);

// ---------------------------------------------------------------------------
// documents.versions
// file_key is UUID, never the original filename (Invariant #5). No
// updated_at column — matches C1 Part 5 literal DDL (versions are written
// once and selectively field-updated by OCR/verification, not generically
// "mutable"; verified_at / ocr_processed serve as the specific change
// signals).
// ---------------------------------------------------------------------------
export const versions = documentsSchema.table(
  'versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    versionNumber: integer('version_number').notNull(),
    fileKey: uuid('file_key').notNull(),
    originalFilename: text('original_filename'),
    mimeType: text('mime_type').notNull(),
    /**
     * [Inference] `{ mode: 'number' }`: the platform caps uploads at 25MB
     * (S3_UPLOAD_MAX_SIZE_MB / OCR_MAX_FILE_SIZE_MB in .env.example), well
     * within Number.MAX_SAFE_INTEGER, so byte-count arithmetic in
     * application code does not need BigInt. C1 specifies the SQL type
     * (BIGINT) but not the Drizzle driver mode.
     */
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    pageCount: integer('page_count'),
    /** 0.0-1.0 confidence value from the OCR engine. */
    scanQualityScore: numeric('scan_quality_score', {
      precision: 4,
      scale: 3,
    }),
    /** Derived at OCR-completion time by application against OCR_QUALITY_THRESHOLD; not a GENERATED column. */
    scanQualityCategory: scanQualityCategoryEnum('scan_quality_category'),
    ocrProcessed: boolean('ocr_processed').notNull().default(false),
    ocrText: text('ocr_text'),
    /** FTS vector for OCR text; maintained by trg_versions_tsv_update (manual SQL). */
    tsv: tsvector('tsv'),
    requiresManualVerification: boolean('requires_manual_verification').notNull().default(false),
    verifiedBy: uuid('verified_by'), // logical FK -> iam.users.id (cross-schema)
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    createdBy: uuid('created_by').notNull(), // logical FK -> iam.users.id (cross-schema)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_versions_document_number').on(table.documentId, table.versionNumber),
    check(
      'ck_versions_scan_quality_range',
      sql`${table.scanQualityScore} IS NULL OR (${table.scanQualityScore} >= 0 AND ${table.scanQualityScore} <= 1)`,
    ),
    index('idx_versions_document').on(table.documentId),
  ],
);

// ---------------------------------------------------------------------------
// documents.attachments
// CertificationOfUrgency is stored as an attachment row, not as its own
// table (D4 Relationship Note 6). source_document_id lets one Certification
// of Urgency Document (type CERTIFICATION_OF_URGENCY) be attached to
// several measures without re-uploading the file.
// ---------------------------------------------------------------------------
export const attachments = documentsSchema.table(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    attachmentType: attachmentTypeEnum('attachment_type').notNull(),
    fileKey: uuid('file_key'),
    sourceDocumentId: uuid('source_document_id').references(() => documents.id),
    mimeType: text('mime_type'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }), // [Inference] see versions.fileSizeBytes note
    description: text('description'),
    uploadedBy: uuid('uploaded_by').notNull(), // logical FK -> iam.users.id (cross-schema)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    check(
      'ck_attachments_file_or_source',
      sql`${table.fileKey} IS NOT NULL OR ${table.sourceDocumentId} IS NOT NULL`,
    ),
    index('idx_attachments_document').on(table.documentId),
    index('idx_attachments_source_document').on(table.sourceDocumentId),
  ],
);

// ---------------------------------------------------------------------------
// documents.signatures
// signed_by_employee_id -> organization.employees (not iam.users) per D4
// L244: "Signature '*' --> '1' Employee : signedBy". Employees may sign
// without having a platform login (e.g., Mayor who exists as employee
// before account activation).
// ---------------------------------------------------------------------------
export const signatures = documentsSchema.table(
  'signatures',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    signatureType: signatureTypeEnum('signature_type').notNull(),
    signedByEmployeeId: uuid('signed_by_employee_id').notNull(), // logical FK -> organization.employees.id (cross-schema)
    signedByDisplayName: text('signed_by_display_name'), // denormalized for rendering without a join
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull(),
    isWetInk: boolean('is_wet_ink').notNull().default(false),
    signatureImageS3Key: text('signature_image_s3_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    index('idx_signatures_document').on(table.documentId),
  ],
);

// ---------------------------------------------------------------------------
// documents.document_sponsorships
// [Decision 3.1] Dedicated table per D4 Relationship Note 15: "Sponsorship
// is distinct from the drafter; a document drafted by Secretariat staff may
// have multiple councilor sponsors. Required for the Index of Ordinances
// tracked fields." sponsor_employee_id -> organization.employees per D4
// L245: "DocumentSponsorship '*' --> '1' Employee : sponsor".
// ---------------------------------------------------------------------------
export const documentSponsorships = documentsSchema.table(
  'document_sponsorships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    sponsorEmployeeId: uuid('sponsor_employee_id').notNull(), // logical FK -> organization.employees.id (cross-schema)
    sponsorshipType: sponsorshipTypeEnum('sponsorship_type').notNull(),
    orderOfPriority: integer('order_of_priority').notNull().default(1),
    /** display_name: denormalized per D4 Relationship Note 15 for stable rendering when the employee record changes. */
    displayName: text('display_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_sponsorships').on(table.documentId, table.sponsorEmployeeId, table.sponsorshipType),
    index('idx_sponsorships_document').on(table.documentId),
  ],
);

// ---------------------------------------------------------------------------
// documents.panlalawigan_reviews
// [Decision 3.14] Dedicated table; column set sourced from B4's
// workflow.instances.context JSONB field names for the panlalawigan step.
// D4 Relationship Note 10: each Document has its own PanlalawiganReview for
// independent outcome tracking (multiple documents may share one batch
// control_no). control_no is NOT UNIQUE for this reason.
// ---------------------------------------------------------------------------
export const panlalawiganReviews = documentsSchema.table(
  'panlalawigan_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id),
    /** -> panlalawigan_review_log series (document_type_id = NULL on that row; confirmed per ADR-DB-001, not deferred). */
    numberSeriesId: uuid('number_series_id').references(() => numberSeries.id),
    /** The SP Secretariat's sequential log number (e.g. '2026-01'). Not unique — multiple documents per batch share one reference. */
    controlNo: text('control_no'),
    subject: text('subject'),
    transmittedAt: timestamp('transmitted_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    actionDeadline: timestamp('action_deadline', { withTimezone: true }),
    responseDate: timestamp('response_date', { withTimezone: true }),
    outcome: panlalawiganOutcomeEnum('outcome'),
    /** Original column naming used (not the abbreviated 'resolution_no'); sourced from B4 context field names. */
    resolutionNumber: text('resolution_number'),
    remarks: text('remarks'),
    daysElapsed: integer('days_elapsed'), // computed by application on outcome receipt
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_panlalawigan_reviews_document').on(table.documentId),
    index('idx_panlalawigan_reviews_document').on(table.documentId),
  ],
);

// ---------------------------------------------------------------------------
// documents.classification_allowlists (resolved I1 D-ABAC-02)
// Supports I1 Gate 4: one row per (document_type_id, role_code) grants that
// role read/download access to Confidential/Restricted documents of that
// type.
// ---------------------------------------------------------------------------
export const classificationAllowlists = documentsSchema.table(
  'classification_allowlists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    cityId: uuid('city_id')
      .notNull()
      .default(sql`'00000000-0000-4000-8000-000000000001'::uuid`),
    documentTypeId: uuid('document_type_id')
      .notNull()
      .references(() => documentTypes.id),
    roleCode: text('role_code').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by').notNull(), // logical FK -> iam.users.id (cross-schema)
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: uuid('deleted_by'), // logical FK -> iam.users.id (cross-schema)
  },
  (table) => [
    unique('uq_classification_allowlists_type_role').on(
      table.documentTypeId,
      table.roleCode,
      table.cityId,
    ),
    index('idx_classification_allowlists_type').on(table.documentTypeId),
  ],
);
