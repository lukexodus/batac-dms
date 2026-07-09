/**
 * document-requests.router.test.ts
 *
 * Router-level tests for the six documentRequests procedures.
 * Uses the same t.createCallerFactory pattern as documents.router.test.ts.
 *
 * Coverage targets (acceptance criteria from TASK-DOCS-017):
 *  AC1  createDocumentRequestClerkAssisted inserts lifecycle_state='draft',
 *       metadata.accessMode='in_person_clerk'
 *  AC2  approveAsPresidingOfficer — sp_presiding_officer succeeds; all
 *       other roles throw FORBIDDEN
 *  AC3  approveAsSecretary — throws PRECONDITION_FAILED when VM has not approved
 *  AC4  releaseCopy — marks released without requiring payment; OR number
 *       recorded when provided; throws BAD_REQUEST if not yet completed
 *  AC5  listAll — allowed roles see items; forbidden roles throw FORBIDDEN
 *  AC6  generatePrintableForm — sp_secretary can retrieve form data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC } from '@trpc/server';
import { createDocumentRequestsRouter } from '../document-requests.router.js';
import type { Context, AuthContext } from '../../iam/iam.types.js';
import type { DocumentRow, DocumentTypeRow } from '../documents.repository.js';

vi.mock('../../../config/env.js', () => ({
  env: {},
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CITY_ID = '55555555-5555-5555-5555-555555555555';
const OFFICE_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';
const DOC_ID = '11111111-1111-1111-1111-111111111111';
const DOC_TYPE_ID = '22222222-2222-2222-2222-222222222222';
const RETENTION_ID = '66666666-6666-6666-6666-666666666666';

function makeSubject(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: USER_ID,
    sessionId: 'session-1',
    officeId: OFFICE_ID,
    cityId: CITY_ID,
    roles: ['sp_secretary'],
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: [OFFICE_ID],
    effectiveRoles: ['sp_secretary'],
    isItAdmin: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

function makeDrfDocType(overrides: Partial<DocumentTypeRow> = {}): DocumentTypeRow {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: DOC_TYPE_ID,
    cityId: CITY_ID,
    name: 'Document Request Form',
    code: 'DOCUMENT_REQUEST_FORM',
    owningModule: 'portal',
    numberSeriesId: null,
    hasPreliminaryNumbering: false,
    controlNumberDeferred: false,
    classificationDefault: 'internal',
    publicVisibilityRule: 'REQUESTER_RESTRICTED',
    metadataSchema: {},
    requiredStepTypes: [],
    requiresPublication: false,
    retentionScheduleId: RETENTION_ID,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  } as unknown as DocumentTypeRow;
}

function makeDrfRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  const now = new Date('2026-06-01T00:00:00.000Z');
  return {
    id: DOC_ID,
    cityId: CITY_ID,
    documentTypeId: DOC_TYPE_ID,
    title: 'Document Request -- Juan dela Cruz',
    lifecycleState: 'draft',
    classificationLevel: 'internal',
    qrTrackingNumber: 'qr-drf-1',
    preliminaryNumber: null,
    finalNumber: null,
    controlNumber: null,
    originatingOfficeId: OFFICE_ID,
    ownedByOfficeId: OFFICE_ID,
    createdBy: USER_ID,
    workflowInstanceId: null,
    versionNumber: 1,
    metadata: {
      requester: { name: 'Juan dela Cruz', contactNumber: '09171234567', agencyOrOrganization: null, email: null, idTypePresented: null, citizenUserId: null },
      documentsRequested: [{ documentTitle: 'SP Resolution No. 001-2026', documentId: null, documentTypeLabel: null, documentNumber: 'SP-2026-001', numberOfPages: null }],
      purpose: 'Personal reference',
      accessMode: 'in_person_clerk',
      payment: null,
      notificationChannel: null,
    },
    supersededBy: null,
    supersededAt: null,
    closureReason: null,
    retentionScheduleId: RETENTION_ID,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  } as unknown as DocumentRow;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function makeMockDb(docType?: DocumentTypeRow | null) {
  // Simulate a minimal Drizzle-style db where .select() chains resolve to
  // arrays. The db returned here is called by the router for documentTypes
  // lookups only.
  const resolvedDocType = docType !== undefined ? docType : makeDrfDocType();

  // We use a simple proxy approach: track calls and return canned data.
  let selectChain: any;
  selectChain = {
    from: () => selectChain,
    where: () => selectChain,
    limit: () => Promise.resolve(resolvedDocType ? [resolvedDocType] : []),
  };

  return {
    select: () => selectChain,
  } as any;
}

function makeMockRepository(rowOverrides: Partial<DocumentRow> = {}) {
  return {
    findDocumentById: vi.fn().mockResolvedValue(makeDrfRow(rowOverrides)),
    insertDocument: vi.fn().mockImplementation(async (input: any) =>
      makeDrfRow({ ...input, id: DOC_ID })
    ),
    updateDocumentMetadata: vi.fn().mockResolvedValue(makeDrfRow(rowOverrides)),
    listDocuments: vi.fn().mockResolvedValue([]),
  };
}

function makeMockDocumentsService() {
  return {
    transitionState: vi.fn().mockResolvedValue(undefined),
  };
}

function makeCtx(
  subject: AuthContext,
  overrides: {
    repository?: ReturnType<typeof makeMockRepository>;
    documentsService?: ReturnType<typeof makeMockDocumentsService>;
    db?: any;
  } = {}
): Context {
  const repository = overrides.repository ?? makeMockRepository();
  const documentsService = overrides.documentsService ?? makeMockDocumentsService();
  const db = overrides.db ?? makeMockDb();

  return {
    auth: subject,
    db: db as any,
    req: {
      server: {
        db,
        documentsRepository: repository,
        documentsService,
        eventBus: null,
        auditService: null,
      },
    } as any,
  };
}

const t = initTRPC.context<Context>().create();
const callerFactory = t.createCallerFactory(
  t.router({ documentRequests: createDocumentRequestsRouter() })
);

function callerFor(ctx: Context) {
  return callerFactory(ctx).documentRequests;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('documentRequests.createDocumentRequestClerkAssisted', () => {
  beforeEach(() => vi.clearAllMocks());

  it('AC1: inserts document with lifecycleState=draft and accessMode=in_person_clerk', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const repository = makeMockRepository();
    const db = makeMockDb();
    const caller = callerFor(makeCtx(subject, { repository, db }));

    const result = await caller.createDocumentRequestClerkAssisted({
      requesterName: 'Juan dela Cruz',
      requesterContact: '09171234567',
      documentsRequested: [{ documentTitle: 'SP Resolution No. 001-2026', documentNumber: 'SP-2026-001' }],
      purpose: 'Personal reference',
    });

    expect(result).toHaveProperty('requestId');
    expect(repository.insertDocument).toHaveBeenCalledTimes(1);

    const insertArg = repository.insertDocument.mock.calls[0][0];
    expect(insertArg.lifecycleState).toBe('draft');
    expect(insertArg.metadata.accessMode).toBe('in_person_clerk');
    expect(insertArg.metadata.requester.name).toBe('Juan dela Cruz');
    expect(insertArg.metadata.requester.contactNumber).toBe('09171234567');
    expect(insertArg.metadata.documentsRequested).toHaveLength(1);
    expect(insertArg.metadata.documentsRequested[0].documentTitle).toBe('SP Resolution No. 001-2026');
  });

  it('throws FORBIDDEN for any role other than sp_secretary', async () => {
    for (const role of ['sp_presiding_officer', 'auditor', 'records_officer', 'dept_encoder', 'sp_member']) {
      const subject = makeSubject({ roles: [role] });
      const caller = callerFor(makeCtx(subject));
      await expect(
        caller.createDocumentRequestClerkAssisted({
          requesterName: 'Test',
          documentsRequested: [{ documentTitle: 'Test Doc' }],
        })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
  });

  it('builds the title from requesterName', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const repository = makeMockRepository();
    const db = makeMockDb();
    const caller = callerFor(makeCtx(subject, { repository, db }));

    await caller.createDocumentRequestClerkAssisted({
      requesterName: 'Maria Santos',
      documentsRequested: [{ documentTitle: 'SP Ordinance No. 002-2026' }],
    });

    const insertArg = repository.insertDocument.mock.calls[0][0];
    expect(insertArg.title).toBe('Document Request -- Maria Santos');
  });
});

// ---------------------------------------------------------------------------

describe('documentRequests.approveAsPresidingOfficer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('AC2: sp_presiding_officer can approve; metadata receives vm_approved=true', async () => {
    const subject = makeSubject({ roles: ['sp_presiding_officer'] });
    const repository = makeMockRepository({ lifecycleState: 'draft' });
    const db = makeMockDb();
    const caller = callerFor(makeCtx(subject, { repository, db }));

    const result = await caller.approveAsPresidingOfficer({ requestId: DOC_ID });

    expect(result).toEqual({ success: true });
    expect(repository.updateDocumentMetadata).toHaveBeenCalledTimes(1);

    const metaArg = repository.updateDocumentMetadata.mock.calls[0][1];
    expect(metaArg.vm_approved).toBe(true);
    expect(metaArg.vm_approved_by).toBe(subject.userId);
    expect(typeof metaArg.vm_approved_at).toBe('string');
  });

  it('AC2: throws FORBIDDEN for sp_secretary', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const caller = callerFor(makeCtx(subject));
    await expect(
      caller.approveAsPresidingOfficer({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('AC2: throws FORBIDDEN for auditor', async () => {
    const subject = makeSubject({ roles: ['auditor'] });
    const caller = callerFor(makeCtx(subject));
    await expect(
      caller.approveAsPresidingOfficer({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('AC2: throws FORBIDDEN for records_officer', async () => {
    const subject = makeSubject({ roles: ['records_officer'] });
    const caller = callerFor(makeCtx(subject));
    await expect(
      caller.approveAsPresidingOfficer({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('AC2: throws FORBIDDEN for dept_encoder', async () => {
    const subject = makeSubject({ roles: ['dept_encoder'] });
    const caller = callerFor(makeCtx(subject));
    await expect(
      caller.approveAsPresidingOfficer({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('throws BAD_REQUEST when document is already released', async () => {
    const subject = makeSubject({ roles: ['sp_presiding_officer'] });
    const repository = makeMockRepository({ lifecycleState: 'released' });
    const db = makeMockDb();
    const caller = callerFor(makeCtx(subject, { repository, db }));

    await expect(
      caller.approveAsPresidingOfficer({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

// ---------------------------------------------------------------------------

describe('documentRequests.approveAsSecretary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('AC3: throws PRECONDITION_FAILED when presiding officer has not approved', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    // metadata has no vm_approved field
    const repository = makeMockRepository({
      lifecycleState: 'draft',
      metadata: {
        requester: { name: 'Juan', contactNumber: null, agencyOrOrganization: null, email: null, idTypePresented: null, citizenUserId: null },
        documentsRequested: [{ documentTitle: 'Test', documentId: null, documentTypeLabel: null, documentNumber: null, numberOfPages: null }],
        purpose: null,
        accessMode: 'in_person_clerk',
        payment: null,
        notificationChannel: null,
        // vm_approved intentionally absent
      },
    });
    const db = makeMockDb();
    const caller = callerFor(makeCtx(subject, { repository, db }));

    await expect(
      caller.approveAsSecretary({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('AC3: succeeds and transitions to completed when vm_approved=true', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const repository = makeMockRepository({
      lifecycleState: 'draft',
      metadata: {
        requester: { name: 'Juan', contactNumber: null, agencyOrOrganization: null, email: null, idTypePresented: null, citizenUserId: null },
        documentsRequested: [{ documentTitle: 'Test', documentId: null, documentTypeLabel: null, documentNumber: null, numberOfPages: null }],
        purpose: null,
        accessMode: 'in_person_clerk',
        payment: null,
        notificationChannel: null,
        vm_approved: true,
        vm_approved_at: '2026-07-07T00:00:00.000Z',
        vm_approved_by: 'aaaa-presiding-officer-uuid',
      },
    });
    const db = makeMockDb();
    const documentsService = makeMockDocumentsService();
    const caller = callerFor(makeCtx(subject, { repository, db, documentsService }));

    const result = await caller.approveAsSecretary({ requestId: DOC_ID });

    expect(result).toEqual({ success: true });

    // Must have merged sp_approved into metadata
    const metaArg = repository.updateDocumentMetadata.mock.calls[0][1];
    expect(metaArg.sp_approved).toBe(true);
    expect(metaArg.sp_approved_by).toBe(subject.userId);

    // Must transition to 'completed'
    expect(documentsService.transitionState).toHaveBeenCalledWith(
      DOC_ID,
      'completed',
      subject.userId,
      expect.any(String)
    );
  });

  it('throws FORBIDDEN for sp_presiding_officer', async () => {
    const subject = makeSubject({ roles: ['sp_presiding_officer'] });
    const caller = callerFor(makeCtx(subject));
    await expect(
      caller.approveAsSecretary({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ---------------------------------------------------------------------------

describe('documentRequests.releaseCopy', () => {
  beforeEach(() => vi.clearAllMocks());

  it('AC4: marks document released without requiring payment', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const repository = makeMockRepository({ lifecycleState: 'completed' });
    const db = makeMockDb();
    const documentsService = makeMockDocumentsService();
    const caller = callerFor(makeCtx(subject, { repository, db, documentsService }));

    // No orNumber provided — payment optional per Q-D04
    const result = await caller.releaseCopy({ requestId: DOC_ID });

    expect(result).toEqual({ success: true });
    expect(documentsService.transitionState).toHaveBeenCalledWith(
      DOC_ID,
      'released',
      subject.userId,
      expect.any(String)
    );
  });

  it('AC4: records orNumber in metadata.payment when provided', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const repository = makeMockRepository({ lifecycleState: 'completed' });
    const db = makeMockDb();
    const documentsService = makeMockDocumentsService();
    const caller = callerFor(makeCtx(subject, { repository, db, documentsService }));

    await caller.releaseCopy({
      requestId: DOC_ID,
      orNumber: 'OR-2026-001',
      collectingOfficer: 'Maria Reyes',
      amountPaid: 50,
    });

    const metaArg = repository.updateDocumentMetadata.mock.calls[0][1];
    expect(metaArg.payment).toBeDefined();
    expect(metaArg.payment.orNumber).toBe('OR-2026-001');
    expect(metaArg.payment.collectingOfficer).toBe('Maria Reyes');
    expect(metaArg.payment.amountPaid).toBe(50);
  });

  it('AC4: throws BAD_REQUEST when document is not in completed state', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const repository = makeMockRepository({ lifecycleState: 'draft' });
    const db = makeMockDb();
    const caller = callerFor(makeCtx(subject, { repository, db }));

    await expect(
      caller.releaseCopy({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws FORBIDDEN for sp_presiding_officer', async () => {
    const subject = makeSubject({ roles: ['sp_presiding_officer'] });
    const caller = callerFor(makeCtx(subject));
    await expect(
      caller.releaseCopy({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ---------------------------------------------------------------------------

describe('documentRequests.listAll', () => {
  beforeEach(() => vi.clearAllMocks());

  const listAllDb = () => {
    // Need db that returns both docType (for initial lookup) and [] for rows
    let callCount = 0;
    const chain: any = {
      from: () => chain,
      where: () => chain,
      limit: () => {
        callCount++;
        // First call = docType lookup; subsequent = cursor/rows
        return Promise.resolve(callCount === 1 ? [makeDrfDocType()] : []);
      },
      orderBy: () => chain,
      select: () => chain,
    };
    return { select: () => chain } as any;
  };

  it('AC5: sp_secretary can list — returns items array', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    // Build a db mock that also handles the main SELECT from documents
    const db: any = (() => {
      let selectCall = 0;
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => {
          selectCall++;
          return Promise.resolve(selectCall === 1 ? [makeDrfDocType()] : []);
        },
        orderBy: () => chain,
      };
      return { select: () => chain };
    })();

    const caller = callerFor(makeCtx(subject, { db }));
    const result = await caller.listAllDocumentRequests({ limit: 25 });
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('nextCursor');
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('AC5: sp_presiding_officer can list', async () => {
    const subject = makeSubject({ roles: ['sp_presiding_officer'] });
    const db: any = (() => {
      let selectCall = 0;
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => {
          selectCall++;
          return Promise.resolve(selectCall === 1 ? [makeDrfDocType()] : []);
        },
        orderBy: () => chain,
      };
      return { select: () => chain };
    })();
    const caller = callerFor(makeCtx(subject, { db }));
    const result = await caller.listAllDocumentRequests({ limit: 25 });
    expect(result).toHaveProperty('items');
  });

  it('AC5: records_officer can list', async () => {
    const subject = makeSubject({ roles: ['records_officer'] });
    const db: any = (() => {
      let selectCall = 0;
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => {
          selectCall++;
          return Promise.resolve(selectCall === 1 ? [makeDrfDocType()] : []);
        },
        orderBy: () => chain,
      };
      return { select: () => chain };
    })();
    const caller = callerFor(makeCtx(subject, { db }));
    const result = await caller.listAllDocumentRequests({ limit: 25 });
    expect(result).toHaveProperty('items');
  });

  it('AC5: auditor can list', async () => {
    const subject = makeSubject({ roles: ['auditor'] });
    const db: any = (() => {
      let selectCall = 0;
      const chain: any = {
        from: () => chain,
        where: () => chain,
        limit: () => {
          selectCall++;
          return Promise.resolve(selectCall === 1 ? [makeDrfDocType()] : []);
        },
        orderBy: () => chain,
      };
      return { select: () => chain };
    })();
    const caller = callerFor(makeCtx(subject, { db }));
    const result = await caller.listAllDocumentRequests({ limit: 25 });
    expect(result).toHaveProperty('items');
  });

  it('AC5: dept_encoder is FORBIDDEN', async () => {
    const subject = makeSubject({ roles: ['dept_encoder'] });
    const caller = callerFor(makeCtx(subject));
    await expect(caller.listAllDocumentRequests({ limit: 25 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('AC5: sp_member is FORBIDDEN', async () => {
    const subject = makeSubject({ roles: ['sp_member'] });
    const caller = callerFor(makeCtx(subject));
    await expect(caller.listAllDocumentRequests({ limit: 25 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

// ---------------------------------------------------------------------------

describe('documentRequests.generatePrintableForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('AC6: sp_secretary retrieves full request metadata', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'] });
    const repository = makeMockRepository({ lifecycleState: 'draft' });
    const db = makeMockDb();
    const caller = callerFor(makeCtx(subject, { repository, db }));

    const result = await caller.generatePrintableForm({ requestId: DOC_ID });

    expect(result.requestId).toBe(DOC_ID);
    expect(result.requester).toBeDefined();
    expect(result.requester.name).toBe('Juan dela Cruz');
    expect(result.documentsRequested).toHaveLength(1);
    expect(result.accessMode).toBe('in_person_clerk');
  });

  it('throws FORBIDDEN for sp_presiding_officer', async () => {
    const subject = makeSubject({ roles: ['sp_presiding_officer'] });
    const caller = callerFor(makeCtx(subject));
    await expect(
      caller.generatePrintableForm({ requestId: DOC_ID })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
