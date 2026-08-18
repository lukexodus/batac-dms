/**
 * TASK-PORTAL-003 — createPublicSubmission unit tests.
 *
 * Fully isolated: all DB interaction is mocked via Vitest (no live database),
 * following the same pattern as numbering.service.test.ts and
 * documents.service.test.ts.
 *
 * Acceptance criteria covered:
 *  ✔ Sequential CITIZEN_COMPLAINT submissions produce COMP-{year}-0001 then COMP-{year}-0002
 *  ✔ DOCUMENT_REQUEST_FORM produces DREQ-{year}-0001
 *  ✔ Inserted row carries preliminary_number / final_number both NULL
 *  ✔ A non-portal documentType is a compile-time type error (two-member literal union)
 *  ✔ Emits document.created after commit with the system actor sentinel
 *  ✔ Public accessMode ('digital_form' | 'clerk_assisted') is translated to the
 *    internal vocabulary ('digital_form_printed' | 'in_person_clerk') before storage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createPublicSubmission,
  SYSTEM_ACTOR_ID,
} from '../documents.public-submission.service.js';
import { DocumentsRepository } from '../documents.repository.js';

const YEAR = new Date().getFullYear();

const COMPLAINT_DOC_TYPE = {
  id: 'doc-type-complaint',
  name: 'Citizen Complaint',
  code: 'CITIZEN_COMPLAINT',
  retentionScheduleId: 'retention-1',
  classificationDefault: 'internal',
};

const REQUEST_DOC_TYPE = {
  id: 'doc-type-request',
  name: 'Document Request Form',
  code: 'DOCUMENT_REQUEST_FORM',
  retentionScheduleId: 'retention-1',
  classificationDefault: 'internal',
};

const COMPLAINT_SERIES = {
  id: 'series-complaint',
  seriesKey: 'CITIZEN_COMPLAINT_REF',
  authorityOfficeId: 'office-sp-secretariat',
  finalFormat: 'COMP-{YEAR}-{NN}',
};

const REQUEST_SERIES = {
  id: 'series-request',
  seriesKey: 'DOCUMENT_REQUEST_REF',
  authorityOfficeId: 'office-sp-secretariat',
  finalFormat: 'DREQ-{YEAR}-{NN}',
};

describe('createPublicSubmission', () => {



  let mockDb: any;
  let numberingService: any;
  let eventBus: any;
  let logger: any;
  let insertSpy: ReturnType<typeof vi.spyOn>;

  const buildDeps = (overrides: Record<string, any> = {}) => ({
    db: mockDb,
    numberingService,
    eventBus,
    logger,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      transaction: vi.fn(async (cb: any) => cb(mockDb)),
    };

    numberingService = {
      reserveReferenceNumber: vi.fn(),
    };

    eventBus = { emit: vi.fn() };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    vi.spyOn(DocumentsRepository.prototype, 'findDocumentTypeByCode').mockResolvedValue(
      COMPLAINT_DOC_TYPE as any,
    );
    vi.spyOn(DocumentsRepository.prototype, 'findNumberSeriesByKey').mockResolvedValue(
      COMPLAINT_SERIES as any,
    );
    insertSpy = vi
      .spyOn(DocumentsRepository.prototype, 'insertDocument')
      .mockImplementation(async (input: any) => ({ ...input, id: 'doc-created-1' }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('translates accessMode digital_form to digital_form_printed', async () => {
    numberingService.reserveReferenceNumber.mockResolvedValueOnce({
      numberValue: `COMP-${YEAR}-0001`,
      sequenceNumber: 1,
      sequenceYear: YEAR,
    });
    const result = await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Test User' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ accessMode: 'digital_form_printed' })
      })
    );
  });

  it('translates accessMode clerk_assisted to in_person_clerk', async () => {
    numberingService.reserveReferenceNumber.mockResolvedValueOnce({
      numberValue: `COMP-${YEAR}-0002`,
      sequenceNumber: 2,
      sequenceYear: YEAR,
    });
    const result = await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Test Clerk' }, accessMode: 'clerk_assisted' },
      cityId: 'city-1',
    });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ accessMode: 'in_person_clerk' })
      })
    );
  });


    numberingService.reserveReferenceNumber.mockResolvedValueOnce({
      numberValue: `COMP-${YEAR}-0001`,
      sequenceNumber: 1,
      sequenceYear: YEAR,
    });
    const result = await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Test User' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ accessMode: 'digital_form_printed' })
      })
    );
  });

  it('translates accessMode clerk_assisted to in_person_clerk', async () => {
    // Test: accessMode 'clerk_assisted' is translated to 'in_person_clerk' in storedMetadata

    numberingService.reserveReferenceNumber.mockResolvedValueOnce({
      numberValue: `COMP-${YEAR}-0002`,
      sequenceNumber: 2,
      sequenceYear: YEAR,
    });
    const result = await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Test Clerk' }, accessMode: 'clerk_assisted' },
      cityId: 'city-1',
    });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ accessMode: 'in_person_clerk' })
      })
    );
  });

    numberingService.reserveReferenceNumber
      .mockResolvedValueOnce({
        numberValue: `COMP-${YEAR}-0001`,
        sequenceNumber: 1,
        sequenceYear: YEAR,
      })
      .mockResolvedValueOnce({
        numberValue: `COMP-${YEAR}-0002`,
        sequenceNumber: 2,
        sequenceYear: YEAR,
      });

    const first = await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Juan Dela Cruz' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });
    const second = await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Maria Santos' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });

    expect(first.referenceCode).toBe(`COMP-${YEAR}-0001`);
    expect(second.referenceCode).toBe(`COMP-${YEAR}-0002`);
    expect(numberingService.reserveReferenceNumber).toHaveBeenNthCalledWith(
      1,
      'CITIZEN_COMPLAINT_REF',
      'city-1',
      mockDb,
    );
  });

  it('produces DREQ-{year}-0001 for a document request form', async () => {
    vi.spyOn(DocumentsRepository.prototype, 'findDocumentTypeByCode').mockResolvedValue(
      REQUEST_DOC_TYPE as any,
    );
    vi.spyOn(DocumentsRepository.prototype, 'findNumberSeriesByKey').mockResolvedValue(
      REQUEST_SERIES as any,
    );
    numberingService.reserveReferenceNumber.mockResolvedValue({
      numberValue: `DREQ-${YEAR}-0001`,
      sequenceNumber: 1,
      sequenceYear: YEAR,
    });

    const result = await createPublicSubmission(buildDeps(), {
      documentType: 'DOCUMENT_REQUEST_FORM',
      metadata: { requester: { name: 'LGU Vendor' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });

    expect(result.referenceCode).toBe(`DREQ-${YEAR}-0001`);
  });

  it('produces sequential DREQ-{year}-0001 / DREQ-{year}-0002 codes independent of the COMP sequence', async () => {
    vi.spyOn(DocumentsRepository.prototype, 'findDocumentTypeByCode').mockResolvedValue(
      REQUEST_DOC_TYPE as any,
    );
    vi.spyOn(DocumentsRepository.prototype, 'findNumberSeriesByKey').mockResolvedValue(
      REQUEST_SERIES as any,
    );
    numberingService.reserveReferenceNumber
      .mockResolvedValueOnce({
        numberValue: `DREQ-${YEAR}-0001`,
        sequenceNumber: 1,
        sequenceYear: YEAR,
      })
      .mockResolvedValueOnce({
        numberValue: `DREQ-${YEAR}-0002`,
        sequenceNumber: 2,
        sequenceYear: YEAR,
      });

    const first = await createPublicSubmission(buildDeps(), {
      documentType: 'DOCUMENT_REQUEST_FORM',
      metadata: { requester: { name: 'LGU Vendor' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });
    const second = await createPublicSubmission(buildDeps(), {
      documentType: 'DOCUMENT_REQUEST_FORM',
      metadata: { requester: { name: 'City Hall Staff' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });

    // DREQ codes are sequential within their own DOCUMENT_REQUEST_REF series —
    // the series key passed to reserveReferenceNumber is what keeps them off
    // the shared COMP counter (each series key has its own per-year sequence).
    expect(first.referenceCode).toBe(`DREQ-${YEAR}-0001`);
    expect(second.referenceCode).toBe(`DREQ-${YEAR}-0002`);
    expect(numberingService.reserveReferenceNumber).toHaveBeenNthCalledWith(
      1,
      'DOCUMENT_REQUEST_REF',
      'city-1',
      mockDb,
    );
    expect(numberingService.reserveReferenceNumber).toHaveBeenNthCalledWith(
      2,
      'DOCUMENT_REQUEST_REF',
      'city-1',
      mockDb,
    );

    // Each submission is auditable via the document.created emission.
    expect(eventBus.emit).toHaveBeenCalledTimes(2);
    expect(eventBus.emit.mock.calls[0][0]).toBe('document.created');
    expect(eventBus.emit.mock.calls[1][0]).toBe('document.created');
  });

  it('inserts the row with preliminary_number / final_number both NULL and lifecycle draft', async () => {
    numberingService.reserveReferenceNumber.mockResolvedValue({
      numberValue: `COMP-${YEAR}-0042`,
      sequenceNumber: 42,
      sequenceYear: YEAR,
    });

    const result = await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Juan Dela Cruz' }, subjectCategory: 'transportation', accessMode: 'digital_form' },
      cityId: 'city-1',
    });

    const insertArgs = insertSpy.mock.calls[0][0];

    expect(insertArgs.lifecycleState).toBe('draft');
    expect(insertArgs.classificationLevel).toBe('internal');
    expect(insertArgs.preliminaryNumber).toBeNull();
    expect(insertArgs.finalNumber).toBeNull();
    expect(insertArgs.controlNumber).toBeNull();
    expect(insertArgs.originatingOfficeId).toBe('office-sp-secretariat');
    expect(insertArgs.ownedByOfficeId).toBe('office-sp-secretariat');
    expect(insertArgs.createdBy).toBe(SYSTEM_ACTOR_ID);
    expect(insertArgs.title).toBe('Citizen Complaint -- Juan Dela Cruz');
    expect(insertArgs.qrTrackingNumber).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // Reference code lives in metadata, never in the number columns
    expect(insertArgs.metadata.referenceCode).toBe(`COMP-${YEAR}-0042`);
    expect(insertArgs.metadata.subjectCategory).toBe('transportation');

    expect(result.documentId).toBe('doc-created-1');
  });

  it('translates a public accessMode of digital_form to the internal digital_form_printed value', async () => {
    numberingService.reserveReferenceNumber.mockResolvedValue({
      numberValue: `COMP-${YEAR}-0001`,
      sequenceNumber: 1,
      sequenceYear: YEAR,
    });

    await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Juan Dela Cruz' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });

    const insertArgs = insertSpy.mock.calls[0][0];
    expect(insertArgs.metadata.accessMode).toBe('digital_form_printed');
  });

  it('translates a public accessMode of clerk_assisted to the internal in_person_clerk value', async () => {
    numberingService.reserveReferenceNumber.mockResolvedValue({
      numberValue: `COMP-${YEAR}-0001`,
      sequenceNumber: 1,
      sequenceYear: YEAR,
    });

    await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Juan Dela Cruz' }, accessMode: 'clerk_assisted' },
      cityId: 'city-1',
    });

    const insertArgs = insertSpy.mock.calls[0][0];
    expect(insertArgs.metadata.accessMode).toBe('in_person_clerk');
  });

  it('emits document.created after commit with the system actor sentinel', async () => {
    numberingService.reserveReferenceNumber.mockResolvedValue({
      numberValue: `COMP-${YEAR}-0001`,
      sequenceNumber: 1,
      sequenceYear: YEAR,
    });

    await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Juan Dela Cruz' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });

    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    const [eventType, envelope] = eventBus.emit.mock.calls[0];

    expect(eventType).toBe('document.created');
    expect(envelope.eventType).toBe('document.created');
    expect(envelope.cityId).toBe('city-1');
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.payload).toEqual({
      documentId: 'doc-created-1',
      documentTypeId: 'doc-type-complaint',
      ownedByOfficeId: 'office-sp-secretariat',
      actorId: SYSTEM_ACTOR_ID,
      cityId: 'city-1',
    });

    // Emit happens only after the transaction callback has completed
    const txCallback = mockDb.transaction.mock.calls[0][0];
    await txCallback(mockDb);
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('logs an operational note and returns an ISO submittedAt', async () => {
    numberingService.reserveReferenceNumber.mockResolvedValue({
      numberValue: `COMP-${YEAR}-0001`,
      sequenceNumber: 1,
      sequenceYear: YEAR,
    });

    const result = await createPublicSubmission(buildDeps(), {
      documentType: 'CITIZEN_COMPLAINT',
      metadata: { complainant: { name: 'Juan Dela Cruz' }, accessMode: 'digital_form' },
      cityId: 'city-1',
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ referenceCode: `COMP-${YEAR}-0001` }),
      expect.stringContaining('no workflow instance'),
    );
    expect(result.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ---------------------------------------------------------------------------
// Type-level guarantee: the documentType parameter is a two-member literal
// union. These lines are deliberate compile errors; `pnpm typecheck` fails if
// the union ever widens to accept arbitrary strings (an unused @ts-expect-error
// is itself an error under strict mode).
// ---------------------------------------------------------------------------
type _PublicDocumentType = Parameters<
  typeof createPublicSubmission
>[1]['documentType'];

// @ts-expect-error - only CITIZEN_COMPLAINT / DOCUMENT_REQUEST_FORM allowed
const _rejectedType: _PublicDocumentType = 'SP_RESOLUTION';
void _rejectedType;
