import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createDocumentsRouter } from '../documents.router.js';
import type { Context, AuthContext } from '../../iam/iam.types.js';

vi.mock('../../../config/env.js', () => ({
  env: {},
}));

let fakeDbState: any;
let txState: any;

vi.mock('../documents.repository.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    DocumentsRepository: vi.fn().mockImplementation(function (dbOrTx: any) {
      const getState = () => (dbOrTx && dbOrTx.__isTx) ? txState : fakeDbState;
      return {
        findDocumentById: vi.fn(async (id) => getState().documents.get(id) || null),
        findDocumentTypeById: vi.fn(async (id) => getState().documentTypes.get(id) || null),
        findNumberSeriesById: vi.fn(async (id) => getState().numberSeries.get(id) || null),
        updateDocumentNumbering: vi.fn(async (id, updates) => {
          const doc = getState().documents.get(id);
          if (doc) {
            getState().documents.set(id, { ...doc, ...updates });
          }
        }),
        updateDocumentMetadata: vi.fn(async (id, metadata) => {
          if (id === '77777777-7777-4777-8777-777777777777' && (globalThis as any).forceMeas2Error) {
            throw new Error('DB Error on meas-2');
          }
          const doc = getState().documents.get(id);
          if (doc) {
            getState().documents.set(id, { ...doc, metadata });
          }
        })
      };
    })
  };
});

const mockNumberingService = {
  assignPreliminaryNumber: vi.fn()
};

const mockDocumentsService = {
  transitionState: vi.fn()
};

const mockEventBus = {
  emit: vi.fn()
};

const mockDesignationHandler = {
  handleDesignationLogged: vi.fn()
};

function makeSubject(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: '44444444-4444-4444-8444-444444444444',
    sessionId: 'session-1',
    officeId: '33333333-3333-4333-8333-333333333333',
    cityId: '55555555-5555-4555-8555-555555555555',
    roles: ['dept_encoder'],
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: ['33333333-3333-4333-8333-333333333333'],
    effectiveRoles: ['dept_encoder'],
    isItAdmin: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

async function makeCtx(subject: AuthContext): Promise<Context> {
  const { DocumentsRepository } = await import('../documents.repository.js');
  return {
    auth: subject,
    db: {
      transaction: vi.fn(async (cb) => {
        txState = {
          documents: new Map(fakeDbState.documents),
          documentTypes: new Map(fakeDbState.documentTypes),
          numberSeries: new Map(fakeDbState.numberSeries)
        };
        try {
          await cb({ __isTx: true });
          fakeDbState = txState;
          txState = null;
        } catch (e) {
          txState = null;
          throw e;
        }
      })
    },
    req: {
      server: {
        documentsRepository: new DocumentsRepository({}),
        documentsPolicyGuard: {
          canSubmit: vi.fn().mockReturnValue(true),
          canCertifyUrgent: vi.fn().mockReturnValue(true),
          requiresSpSecretaryForSubmit: vi.fn().mockReturnValue(false)
        },
        documentsService: mockDocumentsService,
        numberingService: mockNumberingService,
        designationHandler: mockDesignationHandler,
        eventBus: mockEventBus,
        organizationService: {
          getOfficeByCode: vi.fn().mockResolvedValue(null)
        }
      }
    }
  } as any;
}

const t = initTRPC.context<Context>().create();
const callerFactory = t.createCallerFactory(t.router({ documents: createDocumentsRouter() }));

describe('documents.router transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocumentsService.transitionState.mockReset();
    fakeDbState = {
      documents: new Map(),
      documentTypes: new Map(),
      numberSeries: new Map()
    };
    txState = null;
  });

  describe('submit', () => {
    it('happy path: sets QR, assigns preliminary number, and transitions state', async () => {
      fakeDbState.documents.set('11111111-1111-4111-8111-111111111111', { id: '11111111-1111-4111-8111-111111111111', documentTypeId: '22222222-2222-4222-8222-222222222222', cityId: '55555555-5555-4555-8555-555555555555', lifecycleState: 'draft' });
      fakeDbState.documentTypes.set('22222222-2222-4222-8222-222222222222', { id: '22222222-2222-4222-8222-222222222222', code: 'SP_ORDINANCE', hasPreliminaryNumbering: true, numberSeriesId: '33333333-3333-4333-8333-333333333333' });
      fakeDbState.numberSeries.set('33333333-3333-4333-8333-333333333333', { id: '33333333-3333-4333-8333-333333333333', seriesKey: 'sp_ord' });
      
      mockNumberingService.assignPreliminaryNumber.mockResolvedValue({ numberValue: 'PRE-123' });
      
      const subject = makeSubject();
      const ctx = await makeCtx(subject);
      const caller = callerFactory(ctx).documents;
      
      const result = await caller.submit({ documentId: '11111111-1111-4111-8111-111111111111' } as any);
      
      expect(result.lifecycleState).toBe('submitted');
      expect(result.preliminaryNumber).toBe('PRE-123');
      expect(result.qrTrackingNumber).toBeDefined();
      
      const updatedDoc = fakeDbState.documents.get('11111111-1111-4111-8111-111111111111');
      expect(updatedDoc.qrTrackingNumber).toBeDefined();
      
      expect(mockDocumentsService.transitionState).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111', 'submitted', subject.userId, 'Document submitted', expect.anything()
      );
      expect(mockEventBus.emit).toHaveBeenCalledWith('document.created', expect.anything());
    });

    it('partial-failure rollback: QR update rolls back if transitionState throws', async () => {
      fakeDbState.documents.set('11111111-1111-4111-8111-111111111111', { id: '11111111-1111-4111-8111-111111111111', documentTypeId: '22222222-2222-4222-8222-222222222222', cityId: '55555555-5555-4555-8555-555555555555', lifecycleState: 'draft' });
      fakeDbState.documentTypes.set('22222222-2222-4222-8222-222222222222', { id: '22222222-2222-4222-8222-222222222222', code: 'MEMO', hasPreliminaryNumbering: false });
      
      mockDocumentsService.transitionState.mockRejectedValue(new Error('Validation failed inside transitionState'));
      
      const subject = makeSubject();
      const ctx = await makeCtx(subject);
      const caller = callerFactory(ctx).documents;
      
      await expect(caller.submit({ documentId: '11111111-1111-4111-8111-111111111111' } as any)).rejects.toThrow('Validation failed inside transitionState');
      
      const doc = fakeDbState.documents.get('11111111-1111-4111-8111-111111111111');
      expect(doc.qrTrackingNumber).toBeUndefined(); // Rolled back
    });

    it('without preliminary numbering: sets QR and transitions state', async () => {
      fakeDbState.documents.set('11111111-1111-4111-8111-111111111111', { id: '11111111-1111-4111-8111-111111111111', documentTypeId: '22222222-2222-4222-8222-222222222222', cityId: '55555555-5555-4555-8555-555555555555', lifecycleState: 'draft' });
      fakeDbState.documentTypes.set('22222222-2222-4222-8222-222222222222', { id: '22222222-2222-4222-8222-222222222222', code: 'MEMO', hasPreliminaryNumbering: false });
      
      const subject = makeSubject();
      const ctx = await makeCtx(subject);
      const caller = callerFactory(ctx).documents;
      
      const result = await caller.submit({ documentId: '11111111-1111-4111-8111-111111111111' } as any);
      
      expect(result.preliminaryNumber).toBeNull();
      expect(result.qrTrackingNumber).toBeDefined();
      
      const updatedDoc = fakeDbState.documents.get('11111111-1111-4111-8111-111111111111');
      expect(updatedDoc.qrTrackingNumber).toBeDefined();
    });
  });

  describe('logCertificationOfUrgency', () => {
    it('happy path: updates all associated measures metadata', async () => {
      fakeDbState.documents.set('44444444-4444-4444-8444-444444444444', { id: '44444444-4444-4444-8444-444444444444', documentTypeId: '88888888-8888-4888-8888-888888888888', cityId: '55555555-5555-4555-8555-555555555555' });
      fakeDbState.documentTypes.set('88888888-8888-4888-8888-888888888888', { id: '88888888-8888-4888-8888-888888888888', code: 'CERT' });
      
      fakeDbState.documents.set('66666666-6666-4666-8666-666666666666', { id: '66666666-6666-4666-8666-666666666666', cityId: '55555555-5555-4555-8555-555555555555', lifecycleState: 'in_workflow', metadata: { foo: 'bar' } });
      fakeDbState.documents.set('77777777-7777-4777-8777-777777777777', { id: '77777777-7777-4777-8777-777777777777', cityId: '55555555-5555-4555-8555-555555555555', lifecycleState: 'in_workflow', metadata: {} });
      
      const subject = makeSubject();
      const ctx = await makeCtx(subject);
      const caller = callerFactory(ctx).documents;
      
      await caller.logCertificationOfUrgency({ certifyingDocumentId: '44444444-4444-4444-8444-444444444444', associatedMeasureIds: ['66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777'] } as any);
      
      expect(fakeDbState.documents.get('66666666-6666-4666-8666-666666666666').metadata).toEqual({ foo: 'bar', certifiedUrgent: true, certificationDocumentId: '44444444-4444-4444-8444-444444444444' });
      expect(fakeDbState.documents.get('77777777-7777-4777-8777-777777777777').metadata).toEqual({ certifiedUrgent: true, certificationDocumentId: '44444444-4444-4444-8444-444444444444' });
    });

    it('partial-failure rollback: first update rolls back if second fails', async () => {
      fakeDbState.documents.set('44444444-4444-4444-8444-444444444444', { id: '44444444-4444-4444-8444-444444444444', documentTypeId: '88888888-8888-4888-8888-888888888888', cityId: '55555555-5555-4555-8555-555555555555' });
      fakeDbState.documentTypes.set('88888888-8888-4888-8888-888888888888', { id: '88888888-8888-4888-8888-888888888888', code: 'CERT' });
      
      fakeDbState.documents.set('66666666-6666-4666-8666-666666666666', { id: '66666666-6666-4666-8666-666666666666', cityId: '55555555-5555-4555-8555-555555555555', lifecycleState: 'in_workflow', metadata: {} });
      fakeDbState.documents.set('77777777-7777-4777-8777-777777777777', { id: '77777777-7777-4777-8777-777777777777', cityId: '55555555-5555-4555-8555-555555555555', lifecycleState: 'in_workflow', metadata: {} });
      
      const subject = makeSubject();
      const ctx = await makeCtx(subject);
      const caller = callerFactory(ctx).documents;
      
      (globalThis as any).forceMeas2Error = true;
      
      await expect(caller.logCertificationOfUrgency({ certifyingDocumentId: '44444444-4444-4444-8444-444444444444', associatedMeasureIds: ['66666666-6666-4666-8666-666666666666', '77777777-7777-4777-8777-777777777777'] } as any)).rejects.toThrow('DB Error on meas-2');
      
      (globalThis as any).forceMeas2Error = false;
      
      // meas-1 should not be updated in fakeDbState
      expect(fakeDbState.documents.get('66666666-6666-4666-8666-666666666666').metadata).toEqual({});
    });

    it('pre-existing validation-loop behavior, unchanged: throws before any writes if validation fails', async () => {
      fakeDbState.documents.set('44444444-4444-4444-8444-444444444444', { id: '44444444-4444-4444-8444-444444444444', documentTypeId: '88888888-8888-4888-8888-888888888888', cityId: '55555555-5555-4555-8555-555555555555' });
      fakeDbState.documentTypes.set('88888888-8888-4888-8888-888888888888', { id: '88888888-8888-4888-8888-888888888888', code: 'CERT' });
      
      fakeDbState.documents.set('66666666-6666-4666-8666-666666666666', { id: '66666666-6666-4666-8666-666666666666', cityId: '55555555-5555-4555-8555-555555555555', lifecycleState: 'draft', metadata: {} }); // not in_workflow
      
      const subject = makeSubject();
      const ctx = await makeCtx(subject);
      const caller = callerFactory(ctx).documents;
      
      await expect(caller.logCertificationOfUrgency({ certifyingDocumentId: '44444444-4444-4444-8444-444444444444', associatedMeasureIds: ['66666666-6666-4666-8666-666666666666'] } as any)).rejects.toThrow(/is not in_workflow/);
      
      expect(ctx.db.transaction).not.toHaveBeenCalled();
    });
  });
});
