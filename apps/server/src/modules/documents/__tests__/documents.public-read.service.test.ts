/**
 * Integration tests for TASK-PORTAL-004 — public portal published-document
 * reads (documents.public-read.service.ts + the repository methods backing
 * them).
 *
 * Requires DATABASE_URL_MIGRATE (table owner — bypasses RLS so inserts and
 * reads both work). Test rows are cleaned up in afterAll.
 *
 * RLS note: the public REST handler (TASK-PORTAL-005) will read under the
 * `batac_app` role and must prime `app.bypass_office_isolation`; that priming
 * is out of scope here.
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, and, isNull, inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  documents,
  documentTypes,
  numbers,
  numberSeries,
  documentSponsorships,
} from '@batac/database/schema/documents.schema.js';
import { DocumentsRepository } from '../documents.repository.js';
import {
  getPublishedDocumentDetail,
  listPublishedDocuments,
} from '../documents.public-read.service.js';
import type { DbClient } from '../documents.types.js';
import 'dotenv/config';

const CITY_ID = '00000000-0000-4000-8000-000000000001';

interface TypeDef {
  code: string;
  name: string;
  owningModule: 'workflow' | 'organization' | 'portal';
  classificationDefault: 'public' | 'internal' | 'confidential' | 'restricted';
  publicVisibilityRule: 'title_and_first_page_public' | 'not_public';
}

const TYPE_DEFS: TypeDef[] = [
  {
    code: 'SP_RESOLUTION',
    name: 'Sangguniang Panlungsod Resolution',
    owningModule: 'workflow',
    classificationDefault: 'public',
    publicVisibilityRule: 'title_and_first_page_public',
  },
  {
    code: 'SP_ORDINANCE',
    name: 'Sangguniang Panlungsod Ordinance',
    owningModule: 'workflow',
    classificationDefault: 'public',
    publicVisibilityRule: 'title_and_first_page_public',
  },
  {
    code: 'SP_APPROPRIATION_ORDINANCE',
    name: 'Appropriation Ordinance',
    owningModule: 'workflow',
    classificationDefault: 'public',
    publicVisibilityRule: 'title_and_first_page_public',
  },
  {
    code: 'CITIZEN_COMPLAINT',
    name: 'Citizen Complaint',
    owningModule: 'portal',
    classificationDefault: 'internal',
    publicVisibilityRule: 'not_public',
  },
];

describe('Documents public-read service (Integration)', () => {
  const databaseUrl = process.env.DATABASE_URL_MIGRATE;

  if (!databaseUrl) {
    console.warn('Skipping integration tests: DATABASE_URL_MIGRATE is not set');
    it.skip('Skipped due to missing env var', () => {});
    return;
  }

  const db: DbClient = drizzle(postgres(databaseUrl, { max: 1 }));
  const repository = new DocumentsRepository(db);
  const deps = { db, portalBaseUrl: 'https://portal.batac.ph' };

  const insertedDocumentIds: string[] = [];
  const insertedSeriesIds: string[] = [];
  const insertedTypeCodes: string[] = [];
  let testSeriesId: string;

  const typeIds = new Map<string, string>();

  async function ensureDocumentType(def: TypeDef): Promise<string> {
    const existingId = typeIds.get(def.code);
    if (existingId) return existingId;
    const rows = await db
      .select({ id: documentTypes.id })
      .from(documentTypes)
      .where(and(eq(documentTypes.cityId, CITY_ID), eq(documentTypes.code, def.code)));
    if (rows.length > 0) {
      typeIds.set(def.code, rows[0]!.id);
      return rows[0]!.id;
    }
    const [row] = await db
      .insert(documentTypes)
      .values({
        cityId: CITY_ID,
        code: def.code,
        name: def.name,
        owningModule: def.owningModule,
        classificationDefault: def.classificationDefault,
        publicVisibilityRule: def.publicVisibilityRule,
        isActive: false,
      })
      .returning();
    typeIds.set(def.code, row!.id);
    insertedTypeCodes.push(def.code);
    return row!.id;
  }

  async function insertDocument(opts: {
    title: string;
    typeCode: string;
    lifecycleState?: 'draft' | 'released' | 'archived';
    classificationLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
    finalNumber?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const typeId = await ensureDocumentType(TYPE_DEFS.find((t) => t.code === opts.typeCode)!);
    const doc = await repository.insertDocument({
      cityId: CITY_ID,
      documentTypeId: typeId,
      title: opts.title,
      classificationLevel: opts.classificationLevel ?? 'public',
      qrTrackingNumber: randomUUID(),
      finalNumber: opts.finalNumber ?? null,
      lifecycleState: opts.lifecycleState ?? 'released',
      originatingOfficeId: randomUUID(),
      ownedByOfficeId: randomUUID(),
      createdBy: randomUUID(),
      retentionScheduleId: randomUUID(),
      metadata: opts.metadata ?? {},
    });
    insertedDocumentIds.push(doc.id);
    return doc;
  }

  async function assignFinalNumber(
    documentId: string,
    opts: { year: number; seq: number; value: string; assignedAt: Date },
  ) {
    await repository.insertNumber({
      cityId: CITY_ID,
      documentId,
      numberSeriesId: testSeriesId,
      numberType: 'final',
      numberValue: opts.value,
      sequenceYear: opts.year,
      sequenceNumber: opts.seq,
      isCurrent: true,
      assignedAt: opts.assignedAt,
      assignedBy: randomUUID(),
    });
  }

  let resolutionId: string;
  let ordinanceId: string;
  let appropriationId: string;
  let draftId: string;
  let confidentialId: string;
  let complaintId: string;

  beforeAll(async () => {
    // A single test number_series for all final-number ledger rows.
    const [series] = await db
      .insert(numberSeries)
      .values({
        cityId: CITY_ID,
        seriesKey: `test_portal_${randomUUID().slice(0, 8)}`,
        seriesType: 'legislative',
        phase: '1',
        delimiter: ' ',
        sequencePadding: 0,
        sequenceNamePrefix: 'test',
        yearFormat: 'YYYY',
        preliminaryFormat: 'Draft {prefix} {year}-{seq}',
        finalFormat: '{prefix} {year}-{seq}',
        resetsAnnually: true,
        authorityOfficeId: randomUUID(),
        finalAssignmentEvent: 'test',
        isActive: true,
      })
      .returning();
    testSeriesId = series!.id;
    insertedSeriesIds.push(series!.id);

    // Eligible: SP Resolution approved 2026-02-18.
    const resolution = await insertDocument({
      title: 'Resolution requesting construction of a covered court',
      typeCode: 'SP_RESOLUTION',
      finalNumber: '2026-02',
    });
    resolutionId = resolution.id;
    await assignFinalNumber(resolution.id, {
      year: 2026,
      seq: 2,
      value: '2026-02',
      assignedAt: new Date('2026-02-18T09:00:00+08:00'),
    });

    // Eligible: SP Ordinance approved 2026-03-05 (most recently approved).
    const ordinance = await insertDocument({
      title: 'Ordinance imposing a penalty for improper waste disposal',
      typeCode: 'SP_ORDINANCE',
      finalNumber: '2026-03',
    });
    ordinanceId = ordinance.id;
    await assignFinalNumber(ordinance.id, {
      year: 2026,
      seq: 3,
      value: '2026-03',
      assignedAt: new Date('2026-03-05T09:00:00+08:00'),
    });

    // Eligible: Appropriation Ordinance approved 2025-12-10 (oldest).
    const appropriation = await insertDocument({
      title: 'Appropriation ordinance funding the annual fiesta',
      typeCode: 'SP_APPROPRIATION_ORDINANCE',
      finalNumber: '2025-12',
    });
    appropriationId = appropriation.id;
    await assignFinalNumber(appropriation.id, {
      year: 2025,
      seq: 12,
      value: '2025-12',
      assignedAt: new Date('2025-12-10T09:00:00+08:00'),
    });

    // Not eligible: still in draft (not released).
    draftId = (
      await insertDocument({
        title: 'Draft resolution on barangay hall repairs',
        typeCode: 'SP_RESOLUTION',
        lifecycleState: 'draft',
        finalNumber: '2026-04',
      })
    ).id;

    // Not eligible: confidential classification.
    confidentialId = (
      await insertDocument({
        title: 'Confidential resolution on personnel matters',
        typeCode: 'SP_RESOLUTION',
        classificationLevel: 'confidential',
        finalNumber: '2026-05',
      })
    ).id;

    // Not eligible: no final number assigned.
    await insertDocument({
      title: 'Resolution yet to be approved',
      typeCode: 'SP_RESOLUTION',
      finalNumber: null,
    });

    // Not eligible: type is not publicly visible (CITIZEN_COMPLAINT).
    complaintId = (
      await insertDocument({
        title: 'Complaint about street lighting',
        typeCode: 'CITIZEN_COMPLAINT',
        finalNumber: '2026-06',
      })
    ).id;
  });

  afterAll(async () => {
    if (insertedDocumentIds.length > 0) {
      await db
        .delete(documentSponsorships)
        .where(inArray(documentSponsorships.documentId, insertedDocumentIds));
      await db.delete(numbers).where(inArray(numbers.documentId, insertedDocumentIds));
      await db.delete(documents).where(inArray(documents.id, insertedDocumentIds));
    }
    if (insertedSeriesIds.length > 0) {
      await db.delete(numberSeries).where(inArray(numberSeries.id, insertedSeriesIds));
    }
    if (insertedTypeCodes.length > 0) {
      await db
        .delete(documentTypes)
        .where(
          and(
            inArray(documentTypes.code, insertedTypeCodes),
            eq(documentTypes.cityId, CITY_ID),
          ),
        );
    }
  });

  // ─── Visibility gating ─────────────────────────────────────────────────────

  it('list returns only eligible published documents', async () => {
    const result = await listPublishedDocuments(deps, { page: 1, limit: 20 });

    expect(result.meta.total).toBe(3);
    expect(result.data).toHaveLength(3);
    const ids = result.data.map((d) => d.documentId);
    expect(ids).toContain(resolutionId);
    expect(ids).toContain(ordinanceId);
    expect(ids).toContain(appropriationId);
  });

  it('list includes internal-classified documents when the visibility rule is title_and_first_page_public', async () => {
    // Mirrors the seed reality (document-types.seed.ts classificationDefault
    // 'internal' for SP_RESOLUTION) — the eligibility gate must treat
    // internal + title_and_first_page_public as publishable, matching the
    // canPublishPortal policy rule. Cleaned up after the assertion so the
    // shared fixture dataset used by the hard-coded total/order assertions
    // stays unchanged.
    const internalDoc = await insertDocument({
      title: 'Internal resolution published via first-page visibility rule',
      typeCode: 'SP_RESOLUTION',
      classificationLevel: 'internal',
      finalNumber: '2026-07',
    });
    await assignFinalNumber(internalDoc.id, {
      year: 2026,
      seq: 7,
      value: '2026-07',
      assignedAt: new Date('2026-07-20T09:00:00+08:00'),
    });

    try {
      const result = await listPublishedDocuments(deps, { page: 1, limit: 20 });
      expect(result.data.map((d) => d.documentId)).toContain(internalDoc.id);
    } finally {
      await db.delete(numbers).where(eq(numbers.documentId, internalDoc.id));
      await db.delete(documents).where(eq(documents.id, internalDoc.id));
    }
  });

  it('list orders by most recently approved first (final number assigned_at)', async () => {
    const result = await listPublishedDocuments(deps, { page: 1, limit: 20 });

    expect(result.data.map((d) => d.documentId)).toEqual([ordinanceId, resolutionId, appropriationId]);
    expect(result.data[0]!.approvedAt).toBe('2026-03-05');
  });

  // ─── Filters ───────────────────────────────────────────────────────────────

  it('documentType filter returns only documents of that type', async () => {
    const result = await listPublishedDocuments(deps, {
      documentType: 'SP_RESOLUTION',
      page: 1,
      limit: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.documentId).toBe(resolutionId);
    expect(result.data[0]!.documentType).toBe('SP_RESOLUTION');
  });

  it('APPROPRIATION_ORDINANCE query maps to the SP_APPROPRIATION_ORDINANCE DB code', async () => {
    const result = await listPublishedDocuments(deps, {
      documentType: 'APPROPRIATION_ORDINANCE',
      page: 1,
      limit: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.documentId).toBe(appropriationId);
    expect(result.data[0]!.documentType).toBe('APPROPRIATION_ORDINANCE');
  });

  it('year filter restricts by the current final number sequence year', async () => {
    const result = await listPublishedDocuments(deps, { year: 2026, page: 1, limit: 20 });

    expect(result.meta.total).toBe(2);
    const ids = result.data.map((d) => d.documentId);
    expect(ids).not.toContain(appropriationId);
  });

  it('number exact match takes precedence over other filters and returns at most one', async () => {
    const result = await listPublishedDocuments(deps, {
      number: '2026-02',
      documentType: 'SP_ORDINANCE', // deliberately conflicting filter
      page: 1,
      limit: 20,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.documentId).toBe(resolutionId);
    expect(result.data[0]!.finalNumber).toBe('2026-02');
  });

  it('number exact match with no match returns empty', async () => {
    const result = await listPublishedDocuments(deps, { number: '9999-99', page: 1, limit: 20 });

    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
  });

  it('q full-text search matches titles and returns nothing for gibberish', async () => {
    const hit = await listPublishedDocuments(deps, { q: 'penalty', page: 1, limit: 20 });
    expect(hit.data.map((d) => d.documentId)).toEqual([ordinanceId]);

    const miss = await listPublishedDocuments(deps, { q: 'zzzzzz', page: 1, limit: 20 });
    expect(miss.data).toHaveLength(0);
    expect(miss.meta.total).toBe(0);
  });

  // ─── Pagination ────────────────────────────────────────────────────────────

  it('paginates with page/limit and reports hasNextPage/hasPrevPage', async () => {
    const page1 = await listPublishedDocuments(deps, { page: 1, limit: 1 });
    expect(page1.data).toHaveLength(1);
    expect(page1.data[0]!.documentId).toBe(ordinanceId);
    expect(page1.meta).toMatchObject({ total: 3, totalPages: 3, hasNextPage: true, hasPrevPage: false });

    const page2 = await listPublishedDocuments(deps, { page: 2, limit: 1 });
    expect(page2.data[0]!.documentId).toBe(resolutionId);
    expect(page2.meta).toMatchObject({ hasNextPage: true, hasPrevPage: true });
  });

  // ─── Detail ────────────────────────────────────────────────────────────────

  it('detail returns full metadata for an eligible document', async () => {
    const detail = await getPublishedDocumentDetail(deps, resolutionId);

    expect(detail).not.toBeNull();
    expect(detail!.documentId).toBe(resolutionId);
    expect(detail!.title).toBe('Resolution requesting construction of a covered court');
    expect(detail!.documentType).toBe('SP_RESOLUTION');
    expect(detail!.approvedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(detail!.releasedAt).toMatch(/\+08:00$/);
    expect(detail!.authors).toEqual([]);
    expect(detail!.sponsors).toEqual([]);
    expect(detail!.committees).toEqual([]);
    expect(detail!.panlalawiganOutcome).toBeNull();
    expect(detail!.panlalawiganOutcomeDate).toBeNull();
    expect(detail!.hasNewspaperPublication).toBe(false);
    expect(detail!.newspaperPublicationDate).toBeNull();
    expect(detail!.documentRequestUrl).toBe(
      `https://portal.batac.ph/document-requests?ref=${encodeURIComponent('2026-02')}`,
    );
  });

  it('detail returns null for ineligible documents (draft, confidential, wrong type, missing)', async () => {
    expect(await getPublishedDocumentDetail(deps, draftId)).toBeNull();
    expect(await getPublishedDocumentDetail(deps, confidentialId)).toBeNull();
    expect(await getPublishedDocumentDetail(deps, complaintId)).toBeNull();
    expect(await getPublishedDocumentDetail(deps, randomUUID())).toBeNull();
  });

  it('detail includes authors and sponsors from document_sponsorships ordered by priority', async () => {
    await repository.insertSponsorship({
      cityId: CITY_ID,
      documentId: resolutionId,
      sponsorEmployeeId: randomUUID(),
      sponsorshipType: 'principal_author',
      orderOfPriority: 1,
      displayName: 'Councilor A',
    });
    await repository.insertSponsorship({
      cityId: CITY_ID,
      documentId: resolutionId,
      sponsorEmployeeId: randomUUID(),
      sponsorshipType: 'co_author',
      orderOfPriority: 2,
      displayName: 'Councilor B',
    });
    await repository.insertSponsorship({
      cityId: CITY_ID,
      documentId: resolutionId,
      sponsorEmployeeId: randomUUID(),
      sponsorshipType: 'introducer',
      orderOfPriority: 1,
      displayName: 'Vice Mayor V',
    });

    const detail = await getPublishedDocumentDetail(deps, resolutionId);

    expect(detail!.authors).toEqual(['Councilor A', 'Councilor B']);
    expect(detail!.sponsors).toEqual(['Vice Mayor V']);
  });

  it('relative documentRequestUrl is returned when portalBaseUrl is omitted', async () => {
    const result = await listPublishedDocuments({ db }, { number: '2026-02', page: 1, limit: 20 });

    expect(result.data[0]!.documentRequestUrl).toBe(
      `/document-requests?ref=${encodeURIComponent('2026-02')}`,
    );
  });
});
