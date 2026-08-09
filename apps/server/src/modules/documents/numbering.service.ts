/**
 * NumberingService — TASK-DOCS-005
 *
 * The ONLY code path that assigns series numbers to documents. No other code
 * may write to documents.numbers or the preliminary_number / final_number /
 * control_number columns of documents.documents directly.
 *
 * All public methods are atomic: each wraps three steps inside a single DB
 * transaction so they either all succeed or all roll back:
 *   1. Call documents.fn_get_next_sequence_value() to obtain the next sequence value.
 *   2. INSERT a row into documents.numbers with the formatted number_value.
 *   3. UPDATE the denormalised column on documents.documents.
 *
 * Format rendering rules (H3 §4-5, consolidated reference §5.1-5.2):
 *   - SP-type legislative series:
 *       spOrdinal + delimiter + year + '-' + paddedNN
 *       e.g. '7' + ' ' + '2026' + '-' + '01' = '7SP 2026-01' (prefix IS NULL)
 *   - Administrative series:
 *       prefix + delimiter + year + '-' + paddedNN
 *       e.g. 'NCH' + '-' + '2026' + '-' + '001' = 'NCH-2026-001'
 *   - Format templates ({YEAR}, {NN} placeholders) from number_series rows
 *     take precedence over the fallback built-from-parts logic.
 *
 * Sources: H3, C1 Part 5, TASK-DOCS-005 AI Prompt.
 */

import { sql, eq } from 'drizzle-orm';
import { numbers } from '@batac/database/schema/documents.schema.js';
import { FinalNumberAlreadyAssignedError } from '../../errors/domain/documents.js';
import type { Logger } from 'pino';
import type { DbClient, DbTransaction } from './documents.types.js';
import { DocumentsRepository } from './documents.repository.js';
import type { NumberSeriesRow } from './documents.repository.js';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface NumberingServiceDeps {
  db: DbClient;
  logger: Logger;
}

export interface NumberAssignmentResult {
  numberValue: string;
  sequenceNumber: number;
  sequenceYear: number;
  assignedAt: Date;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Zero-pad n to width digits. */
function padSequence(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/**
 * Render a human-readable number string from the series row + sequence value.
 *
 * When the template contains {YEAR} and {NN} placeholders those are substituted
 * directly.  When the template is missing, we fall back to building the string
 * from series.spOrdinal / series.prefix / series.delimiter.
 */
function renderNumber(
  series: NumberSeriesRow,
  year: number,
  sequenceValue: number,
  template: string | null,
): string {
  const paddedNN = padSequence(sequenceValue, series.sequencePadding);
  const yearStr = String(year);

  if (template) {
    return template.replace('{YEAR}', yearStr).replace('{NN}', paddedNN);
  }

  // Fallback — build from parts (should not occur for seeded series)
  const ordinal = series.spOrdinal ?? '';
  const prefix = series.prefix ?? '';
  const delimiter = series.delimiter;
  return `${ordinal}${prefix}${delimiter}${yearStr}-${paddedNN}`;
}

// ---------------------------------------------------------------------------
// NumberingService
// ---------------------------------------------------------------------------

export class NumberingService {
  private readonly db: DbClient;
  private readonly logger: Logger;

  constructor(deps: NumberingServiceDeps) {
    this.db = deps.db;
    this.logger = deps.logger;
  }

  // -------------------------------------------------------------------------
  // assignPreliminaryNumber
  // -------------------------------------------------------------------------

  /**
   * Assign a preliminary number to a document.
   *
   * Rules (H3 §4, AI Prompt):
   *  - Only SP_RESOLUTION, SP_ORDINANCE, SP_APPROPRIATION_ORDINANCE use this path.
   *  - Triggered at SECRETARIAT_LOGGING by the workflow layer.
   *  - Throws 'preliminary number already assigned' if a current preliminary row exists.
   *  - Atomic: sequence value → numbers INSERT → documents UPDATE.
   */
  async assignPreliminaryNumber(
    documentId: string,
    seriesKey: string,
    cityId: string,
    actorId: string,
    trx?: DbTransaction,
  ): Promise<NumberAssignmentResult> {
    const runInTransaction = async (tx: DbTransaction | DbClient): Promise<NumberAssignmentResult> => {
      const repo = new DocumentsRepository(tx);

      // Guard: no duplicate preliminary number for same document
      const existing = await repo.findCurrentNumber(documentId, 'preliminary');
      if (existing) {
        throw new Error('preliminary number already assigned');
      }

      // Resolve series
      const series = await repo.findNumberSeriesByKey(seriesKey, cityId);
      if (!series) {
        throw new Error(`number series not found: ${seriesKey}`);
      }

      const year = new Date().getFullYear();

      // Step 1: call fn_get_next_sequence_value
      const { sequenceValue, wasCreated } = await this.callSequenceFunction(tx, seriesKey, year);
      if (wasCreated) {
        this.logger.warn(
          { seriesKey, year },
          '[numbering] On-demand year sequence created -- operational log only, NOT an audit event',
        );
      }

      // Step 2: render the formatted number
      const numberValue = renderNumber(
        series,
        year,
        Number(sequenceValue),
        series.preliminaryFormat,
      );
      const now = new Date();

      // Step 3a: insert documents.numbers ledger row
      const numberRow = await repo.insertNumber({
        documentId,
        numberSeriesId: series.id,
        cityId,
        numberType: 'preliminary',
        numberValue,
        sequenceYear: year,
        sequenceNumber: Number(sequenceValue),
        isCurrent: true,
        assignedBy: actorId,
        assignedAt: now,
      });

      // Step 3b: update denormalised column on the document
      await repo.updateDocumentNumbering(documentId, {
        preliminaryNumber: numberValue,
      });

      return {
        numberValue: numberRow.numberValue,
        sequenceNumber: numberRow.sequenceNumber,
        sequenceYear: numberRow.sequenceYear,
        assignedAt: numberRow.assignedAt,
      };
    };

    if (trx) {
      return runInTransaction(trx);
    } else {
      return this.db.transaction(async (ownTrx) => {
        return runInTransaction(ownTrx);
      });
    }
  }

  // -------------------------------------------------------------------------
  // assignFinalNumber
  // -------------------------------------------------------------------------

  /**
   * Assign a final number to a document, superseding the preliminary number.
   *
   * Rules (H3 §5, AI Prompt):
   *  - Throws 'final number already assigned' if documents.documents.final_number IS NOT NULL.
   *  - Supersedes the current preliminary row: is_current=false, superseded_at=now().
   *  - Inserts a 'final' row in documents.numbers.
   *  - Sets documents.documents.final_number and clears preliminary_number=NULL.
   *  - Atomic.
   */
  async assignFinalNumber(
    documentId: string,
    seriesKey: string,
    cityId: string,
    actorId: string,
  ): Promise<NumberAssignmentResult> {
    return this.db.transaction(async (trx) => {
      const repo = new DocumentsRepository(trx);

      // Guard: must not already have a final number
      const doc = await repo.findDocumentById(documentId);
      if (!doc) {
        throw new Error(`document not found: ${documentId}`);
      }
      if (doc.finalNumber !== null) {
        throw new FinalNumberAlreadyAssignedError(documentId, doc.finalNumber);
      }

      // Resolve series
      const series = await repo.findNumberSeriesByKey(seriesKey, cityId);
      if (!series) {
        throw new Error(`number series not found: ${seriesKey}`);
      }

      const year = new Date().getFullYear();

      // Step 1: call fn_get_next_sequence_value
      const { sequenceValue, wasCreated } = await this.callSequenceFunction(trx, seriesKey, year);
      if (wasCreated) {
        this.logger.warn(
          { seriesKey, year },
          '[numbering] On-demand year sequence created -- operational log only, NOT an audit event',
        );
      }

      // Step 2: render the formatted number
      const numberValue = renderNumber(series, year, Number(sequenceValue), series.finalFormat);
      const now = new Date();

      // Step 3a: supersede the current preliminary row (no-op if none)
      await repo.supersedePreliminaryNumber(documentId, now);

      // Step 3b: insert documents.numbers ledger row for the final number
      const numberRow = await repo.insertNumber({
        documentId,
        numberSeriesId: series.id,
        cityId,
        numberType: 'final',
        numberValue,
        sequenceYear: year,
        sequenceNumber: Number(sequenceValue),
        isCurrent: true,
        assignedBy: actorId,
        assignedAt: now,
      });

      // Step 3c: update denormalised columns — set final, clear preliminary
      await repo.updateDocumentNumbering(documentId, {
        finalNumber: numberValue,
        preliminaryNumber: null,
      });

      return {
        numberValue: numberRow.numberValue,
        sequenceNumber: numberRow.sequenceNumber,
        sequenceYear: numberRow.sequenceYear,
        assignedAt: numberRow.assignedAt,
      };
    });
  }

  // -------------------------------------------------------------------------
  // assignControlNumber
  // -------------------------------------------------------------------------

  /**
   * Assign a control number (Letters Received/Sent — SPR/SPS only).
   *
   * Rules (H3 §3, schema note):
   *  - Inserts a 'control' row in documents.numbers.
   *  - Updates documents.documents.control_number.
   *  - Atomic.
   */
  async assignControlNumber(
    documentId: string,
    seriesKey: string,
    cityId: string,
    actorId: string,
  ): Promise<NumberAssignmentResult> {
    return this.db.transaction(async (trx) => {
      const repo = new DocumentsRepository(trx);

      // Resolve series
      const series = await repo.findNumberSeriesByKey(seriesKey, cityId);
      if (!series) {
        throw new Error(`number series not found: ${seriesKey}`);
      }

      const year = new Date().getFullYear();

      // Step 1: call fn_get_next_sequence_value
      const { sequenceValue, wasCreated } = await this.callSequenceFunction(trx, seriesKey, year);
      if (wasCreated) {
        this.logger.warn(
          { seriesKey, year },
          '[numbering] On-demand year sequence created -- operational log only, NOT an audit event',
        );
      }

      // Step 2: render the formatted number (control numbers use finalFormat)
      const numberValue = renderNumber(series, year, Number(sequenceValue), series.finalFormat);
      const now = new Date();

      // Step 3a: insert documents.numbers ledger row
      const numberRow = await repo.insertNumber({
        documentId,
        numberSeriesId: series.id,
        cityId,
        numberType: 'control',
        numberValue,
        sequenceYear: year,
        sequenceNumber: Number(sequenceValue),
        isCurrent: true,
        assignedBy: actorId,
        assignedAt: now,
      });

      // Step 3b: update denormalised control_number column on the document
      await repo.updateDocumentNumbering(documentId, {
        controlNumber: numberValue,
      });

      return {
        numberValue: numberRow.numberValue,
        sequenceNumber: numberRow.sequenceNumber,
        sequenceYear: numberRow.sequenceYear,
        assignedAt: numberRow.assignedAt,
      };
    });
  }

  // -------------------------------------------------------------------------
  // reserveReferenceNumber
  // -------------------------------------------------------------------------

  /**
   * Reserve the next value of an administrative reference-code series without
   * writing a documents.numbers ledger row or touching the document's
   * preliminary/final/control number columns (TASK-PORTAL-003).
   *
   * Used for the public submission reference codes (CITIZEN_COMPLAINT_REF →
   * 'COMP-{YEAR}-{NNNN}', DOCUMENT_REQUEST_REF → 'DREQ-{YEAR}-{NNNN}'). Those
   * types have no series-number lifecycle: the rendered reference code is
   * stored in documents.metadata.referenceCode, and the documents row keeps
   * preliminary_number / final_number NULL (per TrackingLookupData's schema
   * note). The per-year PostgreSQL sequence is still the single counter, so
   * this method calls the same fn_get_next_sequence_value() helper and the
   * same format-rendering path as the numbered series, but it performs no
   * side-effect write. [Inference — no pre-development document defines this
   * method; it is a gap TASK-PORTAL-003 closes. See development-findings-log.]
   *
   * @param seriesKey  Number-series key, e.g. 'CITIZEN_COMPLAINT_REF'.
   * @param cityId     Tenant city UUID.
   * @param trx        Optional caller-supplied transaction; when omitted this
   *                   method runs against the base connection (used by
   *                   callers that already hold their own transaction).
   */
  async reserveReferenceNumber(
    seriesKey: string,
    cityId: string,
    trx?: DbTransaction,
  ): Promise<{ numberValue: string; sequenceNumber: number; sequenceYear: number }> {
    const run = async (db: DbClient | DbTransaction) => {
      const repo = new DocumentsRepository(db);

      const series = await repo.findNumberSeriesByKey(seriesKey, cityId);
      if (!series) {
        throw new Error(`number series not found: ${seriesKey}`);
      }

      const year = new Date().getFullYear();

      const { sequenceValue, wasCreated } = await this.callSequenceFunction(db, seriesKey, year);
      if (wasCreated) {
        this.logger.warn(
          { seriesKey, year },
          '[numbering] On-demand year sequence created -- operational log only, NOT an audit event',
        );
      }

      const numberValue = renderNumber(series, year, Number(sequenceValue), series.finalFormat);

      return {
        numberValue,
        sequenceNumber: Number(sequenceValue),
        sequenceYear: year,
      };
    };

    if (trx) {
      return run(trx);
    }
    return run(this.db);
  }

  // -------------------------------------------------------------------------
  // logCancellationGap
  // -------------------------------------------------------------------------

  /**
   * Record a cancellation reason on a documents.numbers row (gap policy — H3 §9).
   *
   * The sequence continues; gaps are permanent. Only writes cancellation_reason
   * to the existing ledger row — does NOT allocate a new sequence value.
   *
   * @param numberId  UUID of the documents.numbers row to annotate.
   * @param reason    Free-text cancellation reason.
   * @param actorId   Reserved for the caller's audit log; unused here (numbers
   *                  table is append-only with no updated_by column).
   */
  async logCancellationGap(numberId: string, reason: string, _actorId: string): Promise<void> {
    await this.db
      .update(numbers)
      .set({ cancellationReason: reason })
      .where(eq(numbers.id, numberId));
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Call documents.fn_get_next_sequence_value and return typed result.
   * Works with both DbClient and the transaction sub-client (both have `.execute()`).
   */
  private async callSequenceFunction(
    db: { execute: (query: any) => Promise<any> },
    seriesKey: string,
    year: number,
  ): Promise<{ sequenceValue: bigint | number; wasCreated: boolean }> {
    const result = await db.execute(
      sql`SELECT sequence_value, was_created FROM documents.fn_get_next_sequence_value(${seriesKey}, ${year})`,
    );
    const row = result.rows ? result.rows[0] : result[0];
    if (!row) {
      throw new Error(`fn_get_next_sequence_value returned no rows for series ${seriesKey}`);
    }
    return {
      sequenceValue: row['sequence_value'] as bigint | number,
      wasCreated: Boolean(row['was_created']),
    };
  }
}
