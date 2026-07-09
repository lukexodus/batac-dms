import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createDocumentsRouter } from '../documents.router.js';
import { DocumentPolicyGuard } from '../documents.policy.js';
import type { Context } from '../../iam/iam.types.js';
import type { AuthContext } from '../../iam/iam.types.js';
import type { DocumentRow, DocumentTypeRow } from '../documents.repository.js';

vi.mock('../../../config/env.js', () => ({
  env: {}
}));

/**
 * [Unverified] Written against the real DocumentPolicyGuard and
 * documents.router.ts implementations, but never actually executed with
 * vitest in this environment (no working node_modules / network access to
 * install — see the PR summary). Treat pass/fail expectations here as
 * [Inference], not a confirmed test run.
 *
 * Two layers:
 *  1. DocumentPolicyGuard unit tests — exercise the real guard directly
 *     with constructed subject/resource fixtures. No mocking.
 *  2. Router-level tests via t.createCallerFactory (same pattern as
 *     organization.router.test.ts), covering this task's six acceptance
 *     criteria end-to-end through a mocked ctx.req.server.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSubject(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: '44444444-4444-4444-4444-444444444444',
    sessionId: 'session-1',
    officeId: '33333333-3333-3333-3333-333333333333',
    cityId: '55555555-5555-5555-5555-555555555555',
    roles: ['dept_encoder'],
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: ['33333333-3333-3333-3333-333333333333'],
    effectiveRoles: ['dept_encoder'],
    isItAdmin: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

function makeDocumentRow(overrides: Partial<DocumentRow> = {}): DocumentRow {
  const now = new Date('2026-06-01T00:00:00.000Z');
  return {
    id: '11111111-1111-1111-1111-111111111111',
    cityId: '55555555-5555-5555-5555-555555555555',
    documentTypeId: '22222222-2222-2222-2222-222222222222',
    title: 'Test document',
    lifecycleState: 'draft',
    classificationLevel: 'internal',
    qrTrackingNumber: 'qr-1',
    preliminaryNumber: null,
    finalNumber: null,
    controlNumber: null,
    originatingOfficeId: '33333333-3333-3333-3333-333333333333',
    ownedByOfficeId: '33333333-3333-3333-3333-333333333333',
    createdBy: '44444444-4444-4444-4444-444444444444',
    workflowInstanceId: null,
    versionNumber: 1,
    metadata: {},
    supersededBy: null,
    supersededAt: null,
    closureReason: null,
    retentionScheduleId: '66666666-6666-6666-6666-666666666666',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  } as unknown as DocumentRow;
}

function makeDocumentType(overrides: Partial<DocumentTypeRow> = {}): DocumentTypeRow {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: '22222222-2222-2222-2222-222222222222',
    cityId: '55555555-5555-5555-5555-555555555555',
    name: 'Memo',
    code: 'MEMO',
    owningModule: 'documents',
    numberSeriesId: null,
    hasPreliminaryNumbering: false,
    controlNumberDeferred: false,
    classificationDefault: 'internal',
    publicVisibilityRule: 'not_public',
    metadataSchema: {},
    requiredStepTypes: [],
    requiresPublication: false,
    retentionScheduleId: '66666666-6666-6666-6666-666666666666',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    ...overrides,
  } as unknown as DocumentTypeRow;
}

function makeOfficeSummary(officeId: string, name = 'Test Office') {
  return { officeId, name, parentOfficeId: null, type: 'department' };
}

/** Minimal mock satisfying only the DocumentsRepository methods the router calls. */
function makeMockRepository() {
  return {
    findDocumentById: vi.fn(),
    findDocumentTypeById: vi.fn(),
    hasClassificationAllowlistEntry: vi.fn().mockResolvedValue(false),
    insertDocument: vi.fn(),
    updateDocumentFields: vi.fn(),
    softDeleteDocument: vi.fn().mockResolvedValue(undefined),
    listDocuments: vi.fn().mockResolvedValue([]),
    searchDocuments: vi.fn().mockResolvedValue([]),
  };
}

function makeMockOrgService() {
  return {
    getOfficeById: vi.fn().mockImplementation(async (officeId: string) => makeOfficeSummary(officeId)),
    getOfficeByCode: vi.fn(),
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
    orgService?: ReturnType<typeof makeMockOrgService>;
    documentsService?: ReturnType<typeof makeMockDocumentsService>;
  } = {},
): Context {
  const repository = overrides.repository ?? makeMockRepository();
  const orgService = overrides.orgService ?? makeMockOrgService();
  const documentsService = overrides.documentsService ?? makeMockDocumentsService();
  return {
    auth: subject,
    db: {} as any,
    req: {
      server: {
        documentsRepository: repository,
        documentsPolicyGuard: new DocumentPolicyGuard(),
        documentsService,
        organizationService: orgService,
      },
    } as any,
  };
}

const t = initTRPC.context<Context>().create();
const callerFactory = t.createCallerFactory(t.router({ documents: createDocumentsRouter() }));

function callerFor(ctx: Context) {
  return callerFactory(ctx).documents;
}

// ---------------------------------------------------------------------------
// 1. DocumentPolicyGuard unit tests
// ---------------------------------------------------------------------------

describe('DocumentPolicyGuard', () => {
  const guard = new DocumentPolicyGuard();

  describe('canCreate', () => {
    it('allows dept_encoder', () => {
      expect(guard.canCreate(makeSubject({ roles: ['dept_encoder'] }), { documentTypeCode: 'MEMO' })).toBe(true);
    });

    it('denies sys_admin', () => {
      expect(guard.canCreate(makeSubject({ roles: ['sys_admin'] }), { documentTypeCode: 'MEMO' })).toBe(false);
    });

    it('denies plat_admin, records_officer, auditor, citizen', () => {
      for (const role of ['plat_admin', 'records_officer', 'auditor', 'citizen']) {
        expect(guard.canCreate(makeSubject({ roles: [role] }), { documentTypeCode: 'MEMO' })).toBe(false);
      }
    });
  });

  describe('canReadMetadata (Gate 4)', () => {
    it('denies confidential without an allowlist entry, even for an own-office role', () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
      const allowed = guard.canReadMetadata(subject, {
        ownedByOfficeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        classificationLevel: 'confidential',
        hasCrossOfficeGrant: false,
        hasAllowlistEntry: false,
      });
      expect(allowed).toBe(false);
    });

    it('allows confidential with an own-office allowlist entry', () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
      const allowed = guard.canReadMetadata(subject, {
        ownedByOfficeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        classificationLevel: 'confidential',
        hasCrossOfficeGrant: false,
        hasAllowlistEntry: true,
      });
      expect(allowed).toBe(true);
    });

    it('allows public classification for any operational role regardless of office', () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
      const allowed = guard.canReadMetadata(subject, {
        ownedByOfficeId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        classificationLevel: 'public',
        hasCrossOfficeGrant: false,
        hasAllowlistEntry: false,
      });
      expect(allowed).toBe(true);
    });

    it('denies a different office for a plain encoder (no cross-office standing)', () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
      const allowed = guard.canReadMetadata(subject, {
        ownedByOfficeId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        classificationLevel: 'internal',
        hasCrossOfficeGrant: false,
        hasAllowlistEntry: false,
      });
      expect(allowed).toBe(false);
    });
  });

  describe('canReadMetadataAdmin (Gate 2 extension for the admin view)', () => {
    it('denies confidential and restricted even though the caller is sys_admin', () => {
      expect(guard.canReadMetadataAdmin(makeSubject({ roles: ['sys_admin'] }), { classificationLevel: 'confidential' })).toBe(false);
      expect(guard.canReadMetadataAdmin(makeSubject({ roles: ['sys_admin'] }), { classificationLevel: 'restricted' })).toBe(false);
    });

    it('allows public and internal', () => {
      expect(guard.canReadMetadataAdmin(makeSubject({ roles: ['sys_admin'] }), { classificationLevel: 'public' })).toBe(true);
      expect(guard.canReadMetadataAdmin(makeSubject({ roles: ['sys_admin'] }), { classificationLevel: 'internal' })).toBe(true);
    });
  });

  describe('canCancel', () => {
    const office = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const subjectInOffice = (roles: string[]) => makeSubject({ roles, effectiveOfficeIds: [office] });

    it('blocks cancellation once the document is disposed', () => {
      const allowed = guard.canCancel(subjectInOffice(['dept_approver']), {
        ownedByOfficeId: office,
        lifecycleState: 'disposed',
        workflowInstanceId: null,
      });
      expect(allowed).toBe(false);
    });

    it('blocks cancellation once archived or already cancelled', () => {
      for (const lifecycleState of ['archived', 'cancelled'] as const) {
        expect(
          guard.canCancel(subjectInOffice(['dept_approver']), { ownedByOfficeId: office, lifecycleState, workflowInstanceId: null }),
        ).toBe(false);
      }
    });

    it('allows an unrestricted role (dept_approver) to cancel a submitted document', () => {
      const allowed = guard.canCancel(subjectInOffice(['dept_approver']), {
        ownedByOfficeId: office,
        lifecycleState: 'submitted',
        workflowInstanceId: null,
      });
      expect(allowed).toBe(true);
    });

    it('allows dept_encoder to cancel only while draft/submitted with no workflow instance', () => {
      expect(
        guard.canCancel(subjectInOffice(['dept_encoder']), { ownedByOfficeId: office, lifecycleState: 'draft', workflowInstanceId: null }),
      ).toBe(true);
      expect(
        guard.canCancel(subjectInOffice(['dept_encoder']), { ownedByOfficeId: office, lifecycleState: 'in_workflow', workflowInstanceId: 'wf-1' }),
      ).toBe(false);
    });
  });

  describe('getSearchScope', () => {
    it('gives sp_secretary an unscoped (all-offices) search scope', () => {
      expect(guard.getSearchScope(makeSubject({ roles: ['sp_secretary'] }))).toEqual({ kind: 'all' });
    });

    it('scopes dept_encoder to their own effective offices', () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'] });
      expect(guard.getSearchScope(subject)).toEqual({ kind: 'own', officeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'] });
    });

    it('denies brgy_encoder full-text search entirely (I2 §5)', () => {
      expect(guard.getSearchScope(makeSubject({ roles: ['brgy_encoder'] }))).toEqual({ kind: 'none' });
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Router-level tests (the task's six acceptance criteria)
// ---------------------------------------------------------------------------

describe('documents.router (general CRUD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // AC: documents.create with dept_encoder caller inserts lifecycle_state='draft';
  // qr_tracking_number NOT yet assigned (not returned by the procedure).
  it('create: dept_encoder produces a draft document and does not return a qr tracking number', async () => {
    const subject = makeSubject({ roles: ['dept_encoder'], officeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
    const repository = makeMockRepository();
    repository.findDocumentTypeById.mockResolvedValue(makeDocumentType({ code: 'MEMO', classificationDefault: 'internal' }));
    repository.insertDocument.mockImplementation(async (input: any) => makeDocumentRow({ id: '77777777-7777-7777-7777-777777777777', ...input }));

    const caller = callerFor(makeCtx(subject, { repository }));
    const result = await caller.create({ documentTypeId: '22222222-2222-2222-2222-222222222222', title: 'A memo', metadata: {} } as any);

    expect(result.lifecycleState).toBe('draft');
    expect(result).not.toHaveProperty('qrTrackingNumber');
    expect(repository.insertDocument).toHaveBeenCalledTimes(1);
    const insertArg = repository.insertDocument.mock.calls[0][0];
    expect(insertArg.lifecycleState).toBe('draft');
    expect(typeof insertArg.qrTrackingNumber).toBe('string'); // written to satisfy the NOT NULL DB column, not exposed
  });

  // AC: documents.create with sys_admin caller throws FORBIDDEN.
  it('create: sys_admin is rejected with FORBIDDEN', async () => {
    const subject = makeSubject({ roles: ['sys_admin'], officeId: null });
    const repository = makeMockRepository();
    repository.findDocumentTypeById.mockResolvedValue(makeDocumentType());

    const caller = callerFor(makeCtx(subject, { repository }));
    await expect(caller.create({ documentTypeId: '22222222-2222-2222-2222-222222222222', title: 'x', metadata: {} } as any)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  // AC: documents.get with sys_admin caller and classification='confidential' throws FORBIDDEN (Gate 2).
  it('get: sys_admin is rejected with FORBIDDEN and redirected to getMetadataForAdmin', async () => {
    const subject = makeSubject({ roles: ['sys_admin'] });
    const repository = makeMockRepository();
    repository.findDocumentById.mockResolvedValue(makeDocumentRow({ classificationLevel: 'confidential' }));

    const caller = callerFor(makeCtx(subject, { repository }));
    await expect(caller.get({ documentId: '11111111-1111-1111-1111-111111111111' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // sys_admin is rejected before the document is even fetched for this procedure.
    expect(repository.findDocumentById).not.toHaveBeenCalled();
  });

  it('getMetadataForAdmin: sys_admin is rejected for a confidential document (Gate 2 extension)', async () => {
    const subject = makeSubject({ roles: ['sys_admin'] });
    const repository = makeMockRepository();
    repository.findDocumentById.mockResolvedValue(makeDocumentRow({ classificationLevel: 'confidential' }));

    const caller = callerFor(makeCtx(subject, { repository }));
    await expect(caller.getMetadataForAdmin({ documentId: '11111111-1111-1111-1111-111111111111' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('getMetadataForAdmin: a non-sys_admin caller is rejected regardless of classification', async () => {
    const subject = makeSubject({ roles: ['records_officer'] });
    const repository = makeMockRepository();
    const caller = callerFor(makeCtx(subject, { repository }));
    await expect(caller.getMetadataForAdmin({ documentId: '11111111-1111-1111-1111-111111111111' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repository.findDocumentById).not.toHaveBeenCalled();
  });

  // AC: documents.cancel requires non-empty reason; cancel on lifecycle_state='disposed' throws.
  it('cancel: rejects an empty reason at the Zod layer before the procedure runs', async () => {
    const subject = makeSubject({ roles: ['dept_approver'] });
    const caller = callerFor(makeCtx(subject));
    await expect(caller.cancel({ documentId: '11111111-1111-1111-1111-111111111111', reason: '' } as any)).rejects.toBeTruthy();
  });

  it('cancel: throws on a disposed document', async () => {
    const subject = makeSubject({ roles: ['dept_approver'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
    const repository = makeMockRepository();
    repository.findDocumentById.mockResolvedValue(
      makeDocumentRow({ ownedByOfficeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', lifecycleState: 'disposed' }),
    );
    const documentsService = makeMockDocumentsService();

    const caller = callerFor(makeCtx(subject, { repository, documentsService }));
    await expect(
      caller.cancel({ documentId: '11111111-1111-1111-1111-111111111111', reason: 'Superseded by a later resolution.' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // The policy guard rejects it before documentsService.transitionState is
    // ever reached (defense in depth: transitionState's own VALID_TRANSITIONS
    // map would independently reject 'disposed' -> 'cancelled' too).
    expect(documentsService.transitionState).not.toHaveBeenCalled();
  });

  it('cancel: succeeds for an unrestricted role on a submitted document and threads the reason through', async () => {
    const subject = makeSubject({ roles: ['dept_approver'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
    const repository = makeMockRepository();
    repository.findDocumentById.mockResolvedValue(
      makeDocumentRow({ ownedByOfficeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', lifecycleState: 'submitted' }),
    );
    const documentsService = makeMockDocumentsService();

    const caller = callerFor(makeCtx(subject, { repository, documentsService }));
    const result = await caller.cancel({ documentId: '11111111-1111-1111-1111-111111111111', reason: 'Superseded by a later resolution.' });

    expect(result).toEqual({ success: true });
    expect(documentsService.transitionState).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'cancelled',
      subject.userId,
      'Superseded by a later resolution.',
    );
  });

  // AC: documents.search results are filtered to caller's office scope
  // (sp_secretary sees all SP office docs).
  it('search: sp_secretary gets an unscoped repository call (sees all offices, including SP)', async () => {
    const subject = makeSubject({ roles: ['sp_secretary'], effectiveOfficeIds: ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'] });
    const repository = makeMockRepository();
    repository.searchDocuments.mockResolvedValue([]);

    const caller = callerFor(makeCtx(subject, { repository }));
    await caller.search({ queryText: 'resolution', limit: 25 } as any);

    expect(repository.searchDocuments).toHaveBeenCalledTimes(1);
    const arg = repository.searchDocuments.mock.calls[0][0];
    expect(arg.scope).toEqual({ kind: 'all' });
  });

  it('search: dept_encoder gets an office-scoped repository call', async () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
    const repository = makeMockRepository();

    const caller = callerFor(makeCtx(subject, { repository }));
    await caller.search({ queryText: 'memo', limit: 25 } as any);

    const arg = repository.searchDocuments.mock.calls[0][0];
    expect(arg.scope).toEqual({ kind: 'own', officeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
  });

  it('search: brgy_encoder is denied full-text search entirely (I2 §5) — scope is "none"', async () => {
    const subject = makeSubject({ roles: ['brgy_encoder'], effectiveOfficeIds: ['cccccccc-cccc-cccc-cccc-cccccccccccc'] });
    const repository = makeMockRepository();

    const caller = callerFor(makeCtx(subject, { repository }));
    const result = await caller.search({ queryText: 'memo', limit: 25 } as any);

    // The router always calls the repository; getSearchScope's { kind:
    // 'none' } is what makes the *real* searchDocuments implementation
    // (not this mock) return no rows without querying the DB. Assert the
    // scope actually passed through is 'none' rather than asserting the
    // mock wasn't called.
    expect(result.items).toEqual([]);
    expect(repository.searchDocuments).toHaveBeenCalledTimes(1);
    expect(repository.searchDocuments.mock.calls[0][0].scope).toEqual({ kind: 'none' });
  });

  // Additional coverage: delete (soft-delete only) and update (draft-only).
  it('delete: soft-deletes without ever calling a hard-delete path (Invariant #2)', async () => {
    const subject = makeSubject({ roles: ['dept_approver'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
    const repository = makeMockRepository();
    repository.findDocumentById.mockResolvedValue(
      makeDocumentRow({ ownedByOfficeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', lifecycleState: 'draft', workflowInstanceId: null }),
    );

    const caller = callerFor(makeCtx(subject, { repository }));
    const result = await caller.delete({ documentId: '11111111-1111-1111-1111-111111111111' });

    expect(result).toEqual({ success: true });
    expect(repository.softDeleteDocument).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', subject.userId);
  });

  it('update: rejects when the document is no longer in draft', async () => {
    const subject = makeSubject({ roles: ['dept_encoder'], effectiveOfficeIds: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'] });
    const repository = makeMockRepository();
    repository.findDocumentById.mockResolvedValue(
      makeDocumentRow({ ownedByOfficeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', lifecycleState: 'submitted' }),
    );

    const caller = callerFor(makeCtx(subject, { repository }));
    await expect(caller.update({ documentId: '11111111-1111-1111-1111-111111111111', title: 'New title' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });
});
