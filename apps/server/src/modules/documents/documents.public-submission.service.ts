/**
 * TASK-PORTAL-003 — unauthenticated citizen-submission write method.
 *
 * No pre-development document defines this method; it is a gap this task
 * closes, [Inference]-labeled throughout. It lives in the `documents` module
 * because `documents.documents` is owned by this module's schema — per the
 * "no cross-schema reference, even informally" architectural law, only code
 * inside this module directory may write to it.
 *
 * What this method does, atomically (single DB transaction):
 *   1. Resolve the document_types row for `input.documentType` (must already
 *      be seeded — TASK-DOCS-007).
 *   2. Reserve the next reference-code sequence value via the existing
 *      NumberingService (series CITIZEN_COMPLAINT_REF / DOCUMENT_REQUEST_REF),
 *      inside the same transaction. The rendered code (e.g. COMP-2026-0042)
 *      is stored in metadata.referenceCode — these types have NO series-number
 *      lifecycle, so preliminary_number / final_number stay NULL (per
 *      TrackingLookupData's schema note).
 *   3. INSERT a documents.documents row: lifecycle 'draft' (no workflow
 *      definition drives these types in Phase 1 — see wf.md TASK-WF-016 scope
 *      note), classification 'internal', qr_tracking_number = fresh UUID
 *      (mirrors the assignment-order rule in consolidated ref Part 11.6 — the
 *      QR UUID is assigned at logging, before any series number), metadata =
 *      input.metadata plus { referenceCode, accessMode }.
 *   4. Emit `document.created` AFTER the transaction commits (LOG-0207/LOG-0210:
 *      fire-and-forget consumers must not resolve the emitter's in-flight
 *      transaction). [SPEC GAP resolution from TASK-PORTAL-003: emitting is the
 *      safer default — TASK-AUDIT-004's consumer captures creation events; a
 *      silently dropped event would leave citizen submissions outside the
 *      tamper-evident audit chain required by Section 11.11 / Architectural
 *      Law #3. Flag for human confirmation before merge.]
 *
 * actorId / createdBy for an unauthenticated submission use the established
 * SYSTEM_ACTOR_ID sentinel ('00000000-0000-4000-8000-000000000000'), the same
 * value documents.plugin.ts and panlalawigan.router.ts use for actions with no
 * human actor. [Inference — see development-findings-log.]
 *
 * Sources: TASK-PORTAL-003 AI Prompt; E2 ComplaintSubmissionResult /
 * DocumentRequestSubmissionResult; H3; consolidated reference Part 11.6.
 */

import crypto from 'node:crypto';
import type { Logger } from 'pino';
import type { EventBus } from '@batac/shared';
import type { DbClient, DbTransaction } from './documents.types.js';
import { DocumentsRepository } from './documents.repository.js';
import type { NumberingService } from './numbering.service.js';

/** System-actor sentinel for actions with no human actor (see file header). */
export const SYSTEM_ACTOR_ID = '00000000-0000-4000-8000-000000000000';

export type PublicSubmissionDocumentType = 'CITIZEN_COMPLAINT' | 'DOCUMENT_REQUEST_FORM';

export interface CreatePublicSubmissionInput {
  /** Two-member literal union — any other document type is a compile error. */
  documentType: PublicSubmissionDocumentType;
  /** The citizen-submitted form fields, stored verbatim as JSONB. */
  metadata: Record<string, unknown>;
  cityId: string;
}

export interface CreatePublicSubmissionResult {
  documentId: string;
  referenceCode: string;
  submittedAt: string; // ISO 8601 — [Inference] UTC (new Date().toISOString()); Asia/Manila conversion is a rendering concern
}

export interface PublicSubmissionServiceDeps {
  db: DbClient;
  numberingService: NumberingService;
  eventBus: Pick<EventBus, 'emit'>;
  logger: Logger;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const SERIES_BY_DOCUMENT_TYPE: Record<PublicSubmissionDocumentType, string> = {
  CITIZEN_COMPLAINT: 'CITIZEN_COMPLAINT_REF',
  DOCUMENT_REQUEST_FORM: 'DOCUMENT_REQUEST_REF',
};

/**
 * Derive the row title from the submitter name nested in the JSONB metadata
 * (complainant.name / requester.name per H2), matching the internal clerk
 * convention (e.g. 'Citizen Complaint -- <name>'). Falls back to the document
 * type name when the name is absent or not a string. [Inference]
 */
function deriveSubmitterName(
  documentType: PublicSubmissionDocumentType,
  metadata: Record<string, unknown>,
): string | null {
  const key = documentType === 'CITIZEN_COMPLAINT' ? 'complainant' : 'requester';
  const holder = metadata[key];
  if (holder && typeof holder === 'object' && !Array.isArray(holder)) {
    const name = (holder as Record<string, unknown>)['name'];
    if (typeof name === 'string' && name.trim().length > 0) {
      return name;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// createPublicSubmission
// ---------------------------------------------------------------------------

export async function createPublicSubmission(
  deps: PublicSubmissionServiceDeps,
  input: CreatePublicSubmissionInput,
): Promise<CreatePublicSubmissionResult> {
  const seriesKey = SERIES_BY_DOCUMENT_TYPE[input.documentType];
  const qrTrackingNumber = crypto.randomUUID();

  const committed = await deps.db.transaction(async (tx) => {
    const repo = new DocumentsRepository(tx as DbTransaction);

    const docType = await repo.findDocumentTypeByCode(input.documentType, input.cityId);
    if (!docType) {
      throw new Error(`document type not found: ${input.documentType}`);
    }
    if (docType.retentionScheduleId === null) {
      throw new Error(`document type ${input.documentType} has no retention schedule`);
    }

    const series = await repo.findNumberSeriesByKey(seriesKey, input.cityId);
    if (!series) {
      throw new Error(`number series not found: ${seriesKey}`);
    }

    const { numberValue } = await deps.numberingService.reserveReferenceNumber(
      seriesKey,
      input.cityId,
      tx as DbTransaction,
    );

    const submitterName = deriveSubmitterName(input.documentType, input.metadata);
    const title = submitterName ? `${docType.name} -- ${submitterName}` : docType.name;

    const storedMetadata: Record<string, unknown> = {
      ...input.metadata,
      referenceCode: numberValue,
      accessMode: input.metadata['accessMode'] ?? 'digital_form_printed',
    };

    const row = await repo.insertDocument({
      cityId: input.cityId,
      documentTypeId: docType.id,
      title,
      lifecycleState: 'draft',
      classificationLevel: 'internal',
      qrTrackingNumber,
      preliminaryNumber: null,
      finalNumber: null,
      controlNumber: null,
      originatingOfficeId: series.authorityOfficeId,
      ownedByOfficeId: series.authorityOfficeId,
      createdBy: SYSTEM_ACTOR_ID,
      retentionScheduleId: docType.retentionScheduleId,
      metadata: storedMetadata,
    });

    return {
      documentId: row.id,
      documentTypeId: docType.id,
      ownedByOfficeId: series.authorityOfficeId,
      referenceCode: numberValue,
    };
  });

  // Emit only after the transaction has committed (see file header LOG-0207).
  deps.eventBus.emit('document.created', {
    eventId: crypto.randomUUID(),
    eventType: 'document.created',
    occurredAt: new Date().toISOString(),
    cityId: input.cityId,
    schemaVersion: 1,
    payload: {
      documentId: committed.documentId,
      documentTypeId: committed.documentTypeId,
      ownedByOfficeId: committed.ownedByOfficeId,
      actorId: SYSTEM_ACTOR_ID,
      cityId: input.cityId,
    },
  });

  // Operational log only — NOT an audit event (TASK-AUDIT-004's consumer
  // captures document.created for that). Records that no workflow instance
  // drives these types in Phase 1 (wf.md TASK-WF-016 scope note).
  deps.logger.info(
    {
      documentId: committed.documentId,
      referenceCode: committed.referenceCode,
      documentType: input.documentType,
    },
    '[public-submission] document created — no workflow instance in Phase 1',
  );

  return {
    documentId: committed.documentId,
    referenceCode: committed.referenceCode,
    submittedAt: new Date().toISOString(),
  };
}
