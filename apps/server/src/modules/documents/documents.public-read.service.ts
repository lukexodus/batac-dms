/**
 * Public portal published-document reads (TASK-PORTAL-004).
 *
 * Data-access layer backing the E2 public endpoints:
 *   GET /v1/public/documents          → listPublishedDocuments
 *   GET /v1/public/documents/{id}     → getPublishedDocumentDetail
 *
 * All SQL lives in DocumentsRepository (Module 3 Law #2 — the repository is
 * the only layer that touches `documents.*` tables directly). This service
 * owns presentation mapping only: DB document-type codes → the API enum,
 * Asia/Manila date formatting, and the detail-extra derivation (authors,
 * sponsors, Panlalawigan outcome, newspaper publication).
 *
 * Choices the pre-development documents do not pin down are labelled
 * [Inference] in this file and recorded in docs/development-findings-log.md
 * (TASK-PORTAL-004 entry).
 */

import type {
  PublicDocumentType,
  PublicDocumentsQuery,
  PublicPaginationMeta,
  PublicPanlalawiganOutcome,
  PublishedDocumentDetail,
  PublishedDocumentListResponse,
  PublishedDocumentSummary,
} from '@batac/shared';
import { DocumentsRepository } from './documents.repository.js';
import type { PublicPortalDocumentRow } from './documents.repository.js';
import type { DbClient } from './documents.types.js';

export interface PublicReadDeps {
  db: DbClient;
  /**
   * Base URL of the portal (the `PORTAL_URL` env var, when set). Used to make
   * `documentRequestUrl` absolute. When omitted the service returns a relative
   * path; the TASK-PORTAL-005 REST handler supplies this value. `firstPagePreview`
   * is always null here — S3 presigning is the handler's job.
   */
  portalBaseUrl?: string | undefined;
}

/**
 * DB document-type code → public API enum. `SP_APPROPRIATION_ORDINANCE`
 * maps to the API's `APPROPRIATION_ORDINANCE`; the other two are identical.
 */
const DB_CODE_TO_PUBLIC_TYPE: Record<string, PublicDocumentType> = {
  SP_RESOLUTION: 'SP_RESOLUTION',
  SP_ORDINANCE: 'SP_ORDINANCE',
  SP_APPROPRIATION_ORDINANCE: 'APPROPRIATION_ORDINANCE',
};

/** Public API enum → DB document-type code (inverse of DB_CODE_TO_PUBLIC_TYPE). */
const PUBLIC_TYPE_TO_DB_CODE: Record<PublicDocumentType, string> = {
  SP_RESOLUTION: 'SP_RESOLUTION',
  SP_ORDINANCE: 'SP_ORDINANCE',
  APPROPRIATION_ORDINANCE: 'SP_APPROPRIATION_ORDINANCE',
};

const AUTHOR_SPONSORSHIP_TYPES: ReadonlySet<string> = new Set(['principal_author', 'co_author']);
const SPONSOR_SPONSORSHIP_TYPES: ReadonlySet<string> = new Set(['introducer', 'co_introducer']);

const PH_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Format a JS Date as `YYYY-MM-DD` in Asia/Manila. The Philippines has no
 * DST (fixed UTC+8), so shifting by the fixed offset and reading UTC parts
 * yields the exact Manila calendar date without Intl/ICU locale variance.
 */
function toPhDate(d: Date): string {
  const shifted = new Date(d.getTime() + PH_UTC_OFFSET_MS);
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${month}-${day}`;
}

/**
 * Format a JS Date as an ISO-8601 timestamp with a `+08:00` offset (the
 * convention used in the E2 examples, e.g. `2026-03-05T09:00:00+08:00`).
 */
function toPhTimestamp(d: Date): string {
  return new Date(d.getTime() + PH_UTC_OFFSET_MS).toISOString().replace('Z', '+08:00');
}

function toSummaryRow(
  row: PublicPortalDocumentRow,
  portalBaseUrl: string | undefined,
): PublishedDocumentSummary {
  const doc = row.document;
  const documentType = DB_CODE_TO_PUBLIC_TYPE[row.documentTypeCode];
  if (!documentType) {
    throw new Error(`Unexpected public document type code: ${row.documentTypeCode}`);
  }
  const finalNumber = doc.finalNumber;
  if (!finalNumber) {
    throw new Error(`Public document ${doc.id} has no final number`);
  }

  const requestPath = `/document-requests?ref=${encodeURIComponent(finalNumber)}`;
  const documentRequestUrl = portalBaseUrl
    ? `${portalBaseUrl.replace(/\/+$/, '')}${requestPath}`
    : requestPath;

  return {
    documentId: doc.id,
    documentType,
    documentTypeName: row.documentTypeName,
    title: doc.title,
    finalNumber,
    /**
     * [Inference] approvedAt = the current FINAL series number's assignment
     * date (numbers.assigned_at). When the ledger row is missing (shouldn't
     * happen for eligible rows, since eligibility requires final_number),
     * fall back to the document's updatedAt date as the closest proxy.
     */
    approvedAt: row.approvedAt ? toPhDate(row.approvedAt) : toPhDate(doc.updatedAt),
    /**
     * [Inference] releasedAt = documents.updated_at. There is no released_at
     * column; updateDocumentLifecycleState stamps updatedAt on the lifecycle
     * transition to 'released'.
     */
    releasedAt: toPhTimestamp(doc.updatedAt),
    trackingNumber: doc.qrTrackingNumber ?? doc.id,
    /**
     * [Inference] Always null in the data-access layer (no S3 presigner). The
     * TASK-PORTAL-005 REST handler fills firstPagePreview from the first-page
     * image key.
     */
    firstPagePreview: null,
    documentRequestUrl,
    supersededBy: doc.supersededBy,
    supersededAt: doc.supersededAt ? toPhTimestamp(doc.supersededAt) : null,
    closureReason: doc.closureReason,
  };
}

/**
 * Page through publicly visible published documents (E2 `GET
 * /v1/public/documents`). Delegates the query to the repository, which enforces
 * the shared eligibility gates and applies the E2 filter precedence (exact
 * `number` match wins over all other filters).
 */
export async function listPublishedDocuments(
  deps: PublicReadDeps,
  input: PublicDocumentsQuery,
): Promise<PublishedDocumentListResponse> {
  const repository = new DocumentsRepository(deps.db);
  const { rows, total } = await repository.listPublicPortalDocuments({
    documentTypeCode: input.documentType ? PUBLIC_TYPE_TO_DB_CODE[input.documentType] : undefined,
    year: input.year,
    number: input.number,
    q: input.q,
    page: input.page,
    limit: input.limit,
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / input.limit);
  const meta: PublicPaginationMeta = {
    total,
    page: input.page,
    limit: input.limit,
    totalPages,
    hasNextPage: input.page < totalPages,
    hasPrevPage: input.page > 1,
  };

  return {
    data: rows.map((row) => toSummaryRow(row, deps.portalBaseUrl)),
    meta,
  };
}

/**
 * Fetch a single publicly visible published document (E2 `GET
 * /v1/public/documents/{id}`). Returns null when the document is missing or
 * not publicly visible — the caller maps that to 404.
 */
export async function getPublishedDocumentDetail(
  deps: PublicReadDeps,
  documentId: string,
): Promise<PublishedDocumentDetail | null> {
  const repository = new DocumentsRepository(deps.db);
  const row = await repository.findPublicPortalDocumentById(documentId);
  if (!row) return null;

  const doc = row.document;
  const summary = toSummaryRow(row, deps.portalBaseUrl);

  const sponsorships = await repository.findSponsorshipsByDocument(doc.id);
  const sponsorshipAuthorNames = sponsorships
    .filter((s) => AUTHOR_SPONSORSHIP_TYPES.has(s.sponsorshipType))
    .sort((a, b) => a.orderOfPriority - b.orderOfPriority)
    .map((s) => s.displayName);
  const sponsorshipSponsorNames = sponsorships
    .filter((s) => SPONSOR_SPONSORSHIP_TYPES.has(s.sponsorshipType))
    .sort((a, b) => a.orderOfPriority - b.orderOfPriority)
    .map((s) => s.displayName);

  const meta = (doc.metadata ?? {}) as Record<string, unknown>;
  const metaSponsors = Array.isArray(meta['sponsors'])
    ? (meta['sponsors'] as Array<Record<string, unknown>>)
    : [];

  const metaDisplayName = (s: Record<string, unknown>): string => {
    const name = s['display_name'] ?? s['displayName'];
    return typeof name === 'string' ? name.trim() : '';
  };

  /**
   * [Inference] Authors/sponsors come from documents.document_sponsorships
   * first (ordered by order_of_priority). When the table has no rows, fall
   * back to metadata.sponsors — runtime writers use either snake_case or
   * camelCase keys, so both are read.
   */
  const authors =
    sponsorshipAuthorNames.length > 0
      ? sponsorshipAuthorNames
      : metaSponsors
          .filter((s) => s['role'] === 'author' || s['role'] === 'co_author')
          .map(metaDisplayName)
          .filter((name) => name.length > 0);
  const sponsors =
    sponsorshipSponsorNames.length > 0
      ? sponsorshipSponsorNames
      : metaSponsors
          .filter((s) => s['role'] === 'introduced_by')
          .map(metaDisplayName)
          .filter((name) => name.length > 0);

  const panlalawiganReview = await repository.findPanlalawiganReviewByDocument(doc.id);
  const panlalawiganOutcome = (panlalawiganReview?.outcome ??
    null) as PublicPanlalawiganOutcome;
  /**
   * [Inference] Outcome date = panlalawigan_reviews.response_date. The
   * Panlalawigan plugin sets response_date on the deemed_approved lapse, so
   * this covers both an explicit action and a lapse.
   */
  const panlalawiganOutcomeDate = panlalawiganReview?.responseDate
    ? toPhDate(panlalawiganReview.responseDate)
    : null;

  const isOrdinance = row.documentTypeCode === 'SP_ORDINANCE';
  const metaHasPenalty =
    meta['has_penalty_provision'] === true || meta['hasPenaltyProvision'] === true;
  const newspaper = (meta['newspaper_publication'] ??
    meta['newspaperPublication']) as Record<string, unknown> | null | undefined;
  const newspaperDateRaw =
    newspaper && (newspaper['publication_date'] ?? newspaper['publicationDate']);
  const newspaperDate = typeof newspaperDateRaw === 'string' ? newspaperDateRaw : null;

  /**
   * [Inference] True only for SP Ordinances that have a penalty provision AND
   * a recorded newspaper publication date. The runtime write path currently
   * stores publication in the workflow context rather than documents.metadata,
   * so this reads false/null in practice until that wiring lands.
   */
  const hasNewspaperPublication = isOrdinance && metaHasPenalty && newspaperDate !== null;
  const newspaperPublicationDate = hasNewspaperPublication ? newspaperDate : null;

  return {
    ...summary,
    authors,
    sponsors,
    /**
     * [Inference] Committee names live in organization.committees — a
     * cross-schema boundary for this module (no cross-schema joins per B2
     * Module 3 Law #2) — and are not resolvable here. The E2 contract leaves
     * this as an array; we return an empty one.
     */
    committees: [],
    panlalawiganOutcome,
    panlalawiganOutcomeDate,
    hasNewspaperPublication,
    newspaperPublicationDate,
  };
}
