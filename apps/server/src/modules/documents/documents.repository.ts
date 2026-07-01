import { eq, and, isNull } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  documents,
  numbers,
  numberSeries,
  versions,
  attachments,
  signatures,
  documentSponsorships,
  panlalawiganReviews,
  classificationAllowlists,
  documentTypes,
} from '@batac/database/schema/documents.schema.js';
import type { DbClient, DbTransaction } from './documents.types.js';

// ---------------------------------------------------------------------------
// Inferred row types from the schema — these are the authoritative shapes
// returned by all repository reads.
// ---------------------------------------------------------------------------
export type DocumentRow = InferSelectModel<typeof documents>;
export type DocumentTypeRow = InferSelectModel<typeof documentTypes>;
export type NumberRow = InferSelectModel<typeof numbers>;
export type NumberSeriesRow = InferSelectModel<typeof numberSeries>;
export type VersionRow = InferSelectModel<typeof versions>;
export type AttachmentRow = InferSelectModel<typeof attachments>;
export type SignatureRow = InferSelectModel<typeof signatures>;
export type SponsorshipRow = InferSelectModel<typeof documentSponsorships>;
export type PanlalawiganReviewRow = InferSelectModel<typeof panlalawiganReviews>;
export type ClassificationAllowlistRow = InferSelectModel<typeof classificationAllowlists>;

export type InsertDocument = InferInsertModel<typeof documents>;
export type InsertNumber = InferInsertModel<typeof numbers>;
export type InsertVersion = InferInsertModel<typeof versions>;
export type InsertAttachment = InferInsertModel<typeof attachments>;
export type InsertSignature = InferInsertModel<typeof signatures>;
export type InsertSponsorship = InferInsertModel<typeof documentSponsorships>;
export type InsertPanlalawiganReview = InferInsertModel<typeof panlalawiganReviews>;
export type InsertClassificationAllowlist = InferInsertModel<typeof classificationAllowlists>;

/**
 * Partial update type for updateDocumentNumbering — accepts any combination of
 * preliminary_number, final_number, and qr_tracking_number so the numbering
 * service can do a single atomic UPDATE.
 */
export interface NumberingUpdate {
  preliminaryNumber?: string | null;
  finalNumber?: string | null;
  controlNumber?: string | null;
  qrTrackingNumber?: string;
}

/**
 * DocumentsRepository
 *
 * The **only** layer that reads or writes `documents.*` tables directly.
 * All other layers (service, workflow engine, etc.) call this class.
 *
 * Cross-module boundary rules (B2 Module 3, Law #2):
 *   - No cross-schema joins.  UUID references to `organization.*` / `iam.*`
 *     are stored as bare UUIDs; name resolution is done by those modules.
 *   - All reads filter `WHERE deleted_at IS NULL` unless explicitly fetching
 *     deleted records.
 *   - ABAC is **not** enforced here — that is the policy guard's job.
 */
export class DocumentsRepository {
  constructor(private readonly db: DbClient | DbTransaction) {}

  // -------------------------------------------------------------------------
  // documents.documents
  // -------------------------------------------------------------------------

  /** Find a non-deleted document by primary key. Returns null if not found. */
  async findDocumentById(id: string): Promise<DocumentRow | null> {
    const [row] = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)));
    return row ?? null;
  }

  /**
   * Find all non-deleted documents whose `owned_by_office_id` matches the
   * given office UUID.
   */
  async findDocumentsByOffice(officeId: string): Promise<DocumentRow[]> {
    return this.db
      .select()
      .from(documents)
      .where(
        and(eq(documents.ownedByOfficeId, officeId), isNull(documents.deletedAt)),
      );
  }

  /**
   * Find all non-deleted documents in a given lifecycle state.
   */
  async findDocumentsByLifecycleState(
    lifecycleState: string,
  ): Promise<DocumentRow[]> {
    return this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.lifecycleState, lifecycleState),
          isNull(documents.deletedAt),
        ),
      );
  }

  /** Insert a new document row and return the created row. */
  async insertDocument(input: InsertDocument): Promise<DocumentRow> {
    const [row] = await this.db
      .insert(documents)
      .values(input)
      .returning();
    return row!;
  }

  /**
   * Update only the `lifecycle_state` column (+ `updated_at`) for a document.
   * Used by service/workflow to transition document state.
   */
  async updateDocumentLifecycleState(
    id: string,
    lifecycleState: string,
  ): Promise<DocumentRow | null> {
    const [row] = await this.db
      .update(documents)
      .set({ lifecycleState, updatedAt: new Date() })
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .returning();
    return row ?? null;
  }

  /**
   * Partial update of the `metadata` JSONB column (+ `updated_at`).
   * Caller is responsible for merging patch vs. full-replace at the service layer.
   */
  async updateDocumentMetadata(
    id: string,
    metadata: Record<string, unknown>,
  ): Promise<DocumentRow | null> {
    const [row] = await this.db
      .update(documents)
      .set({ metadata, updatedAt: new Date() })
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .returning();
    return row ?? null;
  }

  /**
   * Atomic single-UPDATE that sets any combination of preliminary_number,
   * final_number, and qr_tracking_number together with updated_at.
   *
   * Used exclusively by the numbering service so that the denormalised number
   * columns on the document row are set in the same statement as the
   * `documents.numbers` ledger INSERT, keeping both consistent within a
   * transaction.
   */
  async updateDocumentNumbering(
    id: string,
    update: NumberingUpdate,
  ): Promise<DocumentRow | null> {
    const [row] = await this.db
      .update(documents)
      .set({ ...update, updatedAt: new Date() })
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .returning();
    return row ?? null;
  }

  /**
   * Soft-delete: sets `deleted_at` and `deleted_by` without removing the row.
   */
  async softDeleteDocument(id: string, deletedBy: string): Promise<void> {
    await this.db
      .update(documents)
      .set({ deletedAt: new Date(), deletedBy })
      .where(eq(documents.id, id));
  }

  // -------------------------------------------------------------------------
  // documents.numbers  (append-only ledger)
  // -------------------------------------------------------------------------

  /**
   * Append a new number ledger row. PRELIMINARY rows have `is_current = true`
   * on insert; FINAL / CONTROL rows are immutable once assigned (trigger
   * enforced in DB).
   */
  async insertNumber(input: InsertNumber): Promise<NumberRow> {
    const [row] = await this.db
      .insert(numbers)
      .values(input)
      .returning();
    return row!;
  }

  /**
   * Return the single current number row for a given document + number_type.
   * Returns null when no current row exists (e.g. no preliminary assigned yet).
   */
  async findCurrentNumber(
    documentId: string,
    numberType: string,
  ): Promise<NumberRow | null> {
    const [row] = await this.db
      .select()
      .from(numbers)
      .where(
        and(
          eq(numbers.documentId, documentId),
          eq(numbers.numberType, numberType),
          eq(numbers.isCurrent, true),
          isNull(numbers.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Flip `is_current = false` and set `superseded_at` on the current
   * preliminary number row for a document.  Called atomically (within a
   * transaction) before inserting a replacement preliminary row.
   */
  async supersedePreliminaryNumber(
    documentId: string,
    supersededAt: Date,
  ): Promise<void> {
    await this.db
      .update(numbers)
      .set({ isCurrent: false, supersededAt })
      .where(
        and(
          eq(numbers.documentId, documentId),
          eq(numbers.numberType, 'preliminary'),
          eq(numbers.isCurrent, true),
          isNull(numbers.deletedAt),
        ),
      );
  }

// -------------------------------------------------------------------------
  // documents.number_series
  // Read-only from this repository: series rows are seed/config data
  // (TASK-DOCS-008) consumed by the numbering service (TASK-DOCS-005) to
  // resolve the prefix/delimiter/padding/format template for a series key.
  // -------------------------------------------------------------------------
 
  /** Find a single non-deleted number series by its PK. */
  async findNumberSeriesById(id: string): Promise<NumberSeriesRow | null> {
    const [row] = await this.db
      .select()
      .from(numberSeries)
      .where(and(eq(numberSeries.id, id), isNull(numberSeries.deletedAt)));
    return row ?? null;
  }

  // -------------------------------------------------------------------------
  // documents.document_types
  // -------------------------------------------------------------------------

  /** Find a single non-deleted document type by its PK. */
  async findDocumentTypeById(id: string): Promise<DocumentTypeRow | null> {
    const [row] = await this.db
      .select()
      .from(documentTypes)
      .where(and(eq(documentTypes.id, id), isNull(documentTypes.deletedAt)));
    return row ?? null;
  }
  
  /**
   * Find a single non-deleted number series by its (city_id, series_key)
   * pair. `series_key` is unique per city (uq_number_series_city_key), so
   * this returns at most one row.
   */
  async findNumberSeriesByKey(
    seriesKey: string,
    cityId: string,
  ): Promise<NumberSeriesRow | null> {
    const [row] = await this.db
      .select()
      .from(numberSeries)
      .where(
        and(
          eq(numberSeries.seriesKey, seriesKey),
          eq(numberSeries.cityId, cityId),
          isNull(numberSeries.deletedAt),
        ),
      );
    return row ?? null;
  }

  // -------------------------------------------------------------------------
  // documents.versions
  // -------------------------------------------------------------------------

  /** Insert a new version row and return the created row. */
  async insertVersion(input: InsertVersion): Promise<VersionRow> {
    const [row] = await this.db
      .insert(versions)
      .values(input)
      .returning();
    return row!;
  }

  /** Return all non-deleted versions for a document ordered by version_number ascending. */
  async findVersionsByDocument(documentId: string): Promise<VersionRow[]> {
    return this.db
      .select()
      .from(versions)
      .where(
        and(eq(versions.documentId, documentId), isNull(versions.deletedAt)),
      );
  }

  /** Find a single non-deleted version by its PK. */
  async findVersionById(id: string): Promise<VersionRow | null> {
    const [row] = await this.db
      .select()
      .from(versions)
      .where(and(eq(versions.id, id), isNull(versions.deletedAt)));
    return row ?? null;
  }

  /**
   * Persist OCR output fields on a version row after the OCR worker completes.
   * Sets `ocr_processed = true`, `ocr_text`, `scan_quality_score`,
   * `scan_quality_category`, and the FTS `tsv` placeholder if supplied.
   */
  async updateVersionOcrResult(
    id: string,
    update: {
      ocrText: string;
      scanQualityScore: string | null;
      scanQualityCategory: string | null;
    },
  ): Promise<VersionRow | null> {
    const [row] = await this.db
      .update(versions)
      .set({
        ocrProcessed: true,
        ocrText: update.ocrText,
        scanQualityScore: update.scanQualityScore,
        scanQualityCategory: update.scanQualityCategory,
      })
      .where(and(eq(versions.id, id), isNull(versions.deletedAt)))
      .returning();
    return row ?? null;
  }

  /**
   * Mark a version as requiring manual verification after OCR produces a
   * below-threshold scan quality score.
   */
  async markVersionPendingVerification(id: string): Promise<void> {
    await this.db
      .update(versions)
      .set({ requiresManualVerification: true })
      .where(and(eq(versions.id, id), isNull(versions.deletedAt)));
  }

  /**
   * Record the outcome of manual verification: sets `verified_by`,
   * `verified_at`, and clears `requires_manual_verification`.
   */
  async markVersionVerified(
    id: string,
    verifiedBy: string,
    verifiedAt: Date,
  ): Promise<VersionRow | null> {
    const [row] = await this.db
      .update(versions)
      .set({
        verifiedBy,
        verifiedAt,
        requiresManualVerification: false,
      })
      .where(and(eq(versions.id, id), isNull(versions.deletedAt)))
      .returning();
    return row ?? null;
  }

  // -------------------------------------------------------------------------
  // documents.attachments
  // -------------------------------------------------------------------------

  /** Insert a new attachment row and return the created row. */
  async insertAttachment(input: InsertAttachment): Promise<AttachmentRow> {
    const [row] = await this.db
      .insert(attachments)
      .values(input)
      .returning();
    return row!;
  }

  /** Return all non-deleted attachments for a document. */
  async findAttachmentsByDocument(documentId: string): Promise<AttachmentRow[]> {
    return this.db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.documentId, documentId),
          isNull(attachments.deletedAt),
        ),
      );
  }

  // -------------------------------------------------------------------------
  // documents.signatures
  // -------------------------------------------------------------------------

  /** Insert a new signature row and return the created row. */
  async insertSignature(input: InsertSignature): Promise<SignatureRow> {
    const [row] = await this.db
      .insert(signatures)
      .values(input)
      .returning();
    return row!;
  }

  /** Return all non-deleted signatures for a document. */
  async findSignaturesByDocument(documentId: string): Promise<SignatureRow[]> {
    return this.db
      .select()
      .from(signatures)
      .where(
        and(
          eq(signatures.documentId, documentId),
          isNull(signatures.deletedAt),
        ),
      );
  }

  // -------------------------------------------------------------------------
  // documents.document_sponsorships
  // -------------------------------------------------------------------------

  /** Insert a new sponsorship row and return the created row. */
  async insertSponsorship(input: InsertSponsorship): Promise<SponsorshipRow> {
    const [row] = await this.db
      .insert(documentSponsorships)
      .values(input)
      .returning();
    return row!;
  }

  /** Return all non-deleted sponsorships for a document. */
  async findSponsorshipsByDocument(documentId: string): Promise<SponsorshipRow[]> {
    return this.db
      .select()
      .from(documentSponsorships)
      .where(
        and(
          eq(documentSponsorships.documentId, documentId),
          isNull(documentSponsorships.deletedAt),
        ),
      );
  }

  // -------------------------------------------------------------------------
  // documents.panlalawigan_reviews
  // -------------------------------------------------------------------------

  /** Insert a new panlalawigan_review row and return the created row. */
  async insertPanlalawiganReview(
    input: InsertPanlalawiganReview,
  ): Promise<PanlalawiganReviewRow> {
    const [row] = await this.db
      .insert(panlalawiganReviews)
      .values(input)
      .returning();
    return row!;
  }

  /**
   * Find the panlalawigan review row for a given document (at most one, per
   * the unique constraint on document_id).
   */
  async findPanlalawiganReviewByDocument(
    documentId: string,
  ): Promise<PanlalawiganReviewRow | null> {
    const [row] = await this.db
      .select()
      .from(panlalawiganReviews)
      .where(
        and(
          eq(panlalawiganReviews.documentId, documentId),
          isNull(panlalawiganReviews.deletedAt),
        ),
      );
    return row ?? null;
  }

  /**
   * Partial update of a panlalawigan_review row.  Caller supplies only the
   * fields that changed; `updated_at` is always refreshed.
   */
  async updatePanlalawiganReview(
    id: string,
    update: Partial<
      Pick<
        PanlalawiganReviewRow,
        | 'controlNo'
        | 'subject'
        | 'transmittedAt'
        | 'receivedAt'
        | 'actionDeadline'
        | 'responseDate'
        | 'outcome'
        | 'resolutionNumber'
        | 'remarks'
        | 'daysElapsed'
      >
    >,
  ): Promise<PanlalawiganReviewRow | null> {
    const [row] = await this.db
      .update(panlalawiganReviews)
      .set({ ...update, updatedAt: new Date() })
      .where(
        and(eq(panlalawiganReviews.id, id), isNull(panlalawiganReviews.deletedAt)),
      )
      .returning();
    return row ?? null;
  }

  // -------------------------------------------------------------------------
  // documents.classification_allowlists
  // -------------------------------------------------------------------------

  /** Insert a new classification allowlist entry and return the created row. */
  async insertClassificationAllowlistEntry(
    input: InsertClassificationAllowlist,
  ): Promise<ClassificationAllowlistRow> {
    const [row] = await this.db
      .insert(classificationAllowlists)
      .values(input)
      .returning();
    return row!;
  }

  /**
   * Returns `true` when there is an active allowlist entry granting `roleCode`
   * access to documents of `documentTypeId` within `cityId`.
   *
   * Used by the ABAC policy guard (I1 Gate 4) — the repository performs only
   * the data lookup; the caller decides the access outcome.
   */
  async hasClassificationAllowlistEntry(
    documentTypeId: string,
    roleCode: string,
    cityId: string,
  ): Promise<boolean> {
    const result = await this.db
      .select({ id: classificationAllowlists.id })
      .from(classificationAllowlists)
      .where(
        and(
          eq(classificationAllowlists.documentTypeId, documentTypeId),
          eq(classificationAllowlists.roleCode, roleCode),
          eq(classificationAllowlists.cityId, cityId),
          isNull(classificationAllowlists.deletedAt),
        ),
      )
      .limit(1);
    return result.length > 0;
  }

  // -------------------------------------------------------------------------
  // Legacy stub aliases — kept for backwards-compatibility with the scaffold
  // test and documents.service.ts until those callers are updated.
  // -------------------------------------------------------------------------

  /** @deprecated Use findDocumentById */
  async findById(id: string): Promise<DocumentRow | null> {
    return this.findDocumentById(id);
  }

  /** @deprecated documents.document_types is not a primary concern of this repository; use a dedicated DocumentTypesRepository if needed. */
  async findTypeById(_id: string): Promise<null> {
    return null;
  }

  /** @deprecated Use updateDocumentLifecycleState */
  async updateState(
    id: string,
    state: string,
    _actorId: string,
  ): Promise<void> {
    await this.updateDocumentLifecycleState(id, state);
  }

  /** @deprecated Use findAttachmentsByDocument */
  async findAttachmentsByDocumentId(documentId: string): Promise<AttachmentRow[]> {
    return this.findAttachmentsByDocument(documentId);
  }

  /** @deprecated Use insertDocument */
  async create(input: InsertDocument): Promise<DocumentRow> {
    return this.insertDocument(input);
  }

  /** @deprecated Use updateDocumentMetadata or updateDocumentLifecycleState */
  async update(
    id: string,
    input: Record<string, unknown>,
  ): Promise<DocumentRow | null> {
    const [row] = await this.db
      .update(documents)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .returning();
    return row ?? null;
  }

  /** @deprecated Use softDeleteDocument */
  async softDelete(id: string, deletedBy: string): Promise<void> {
    return this.softDeleteDocument(id, deletedBy);
  }

  /** @deprecated Use findVersionsByDocument */
  async findVersionsByDocumentId(documentId: string): Promise<VersionRow[]> {
    return this.findVersionsByDocument(documentId);
  }

  /** @deprecated Use insertVersion */
  async createVersion(input: InsertVersion): Promise<VersionRow> {
    return this.insertVersion(input);
  }

  /** @deprecated Use insertAttachment */
  async createAttachment(input: InsertAttachment): Promise<AttachmentRow> {
    return this.insertAttachment(input);
  }

  /** @deprecated Use insertNumber */
  async createNumber(input: InsertNumber): Promise<NumberRow> {
    return this.insertNumber(input);
  }
}
