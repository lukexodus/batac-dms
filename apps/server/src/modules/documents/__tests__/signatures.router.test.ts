import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createDocumentsRouter } from '../documents.router.js';
import { DocumentPolicyGuard } from '../documents.policy.js';
import type { Context } from '../../iam/iam.types.js';
import type { AuthContext } from '../../iam/iam.types.js';
import type { DocumentRow, SignatureRow } from '../documents.repository.js';

vi.mock('../../../config/env.js', () => ({
  env: {},
}));

function makeSubject(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: '44444444-4444-4444-4444-444444444444',
    sessionId: 'session-1',
    officeId: '33333333-3333-3333-3333-333333333333',
    cityId: '55555555-5555-5555-5555-555555555555',
    roles: ['sp_secretary'],
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: ['33333333-3333-3333-3333-333333333333'],
    effectiveRoles: ['sp_secretary'],
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

function makeMockRepository() {
  return {
    findDocumentById: vi.fn(),
    insertSignature: vi.fn(),
    findSignatureById: vi.fn(),
    updateSignatureImageKey: vi.fn(),
    findSignaturesByDocument: vi.fn(),
  };
}

function makeCtx(
  subject: AuthContext,
  overrides: {
    repository?: ReturnType<typeof makeMockRepository>;
  } = {},
): Context {
  const repository = overrides.repository ?? makeMockRepository();
  return {
    auth: subject,
    db: {} as any,
    req: {
      server: {
        documentsRepository: repository,
        documentsPolicyGuard: new DocumentPolicyGuard(),
        documentsService: {} as any,
        organizationService: {} as any,
      },
    } as any,
  };
}

const t = initTRPC.context<Context>().create();
const callerFactory = t.createCallerFactory(t.router({ documents: createDocumentsRouter() }));

function callerFor(ctx: Context) {
  return callerFactory(ctx).documents;
}

describe('Signatures Router tRPC Procedures', () => {
  describe('documents.logSignature', () => {
    it('allows allowed roles (e.g. sp_secretary) to log a signature', async () => {
      const repository = makeMockRepository();
      const subject = makeSubject({ roles: ['sp_secretary'] });
      const ctx = makeCtx(subject, { repository });
      const caller = callerFor(ctx);

      const document = makeDocumentRow();
      repository.findDocumentById.mockResolvedValue(document);

      const mockSignatureRow: SignatureRow = {
        id: '99999999-9999-9999-9999-999999999999',
        cityId: subject.cityId,
        documentId: document.id,
        signedByEmployeeId: '88888888-8888-8888-8888-888888888888',
        signedByDisplayName: 'John Doe',
        signatureType: 'sp_secretary',
        signedAt: new Date('2026-06-02T10:00:00Z'),
        isWetInk: true,
        signatureImageS3Key: null,
        createdAt: new Date('2026-06-02T10:00:00Z'),
        deletedAt: null,
        deletedBy: null,
      };

      repository.insertSignature.mockResolvedValue(mockSignatureRow);

      const response = await caller.logSignature({
        documentId: document.id,
        signedByEmployeeId: '88888888-8888-8888-8888-888888888888',
        signedByDisplayName: 'John Doe',
        signatureType: 'sp_secretary',
        signedAt: '2026-06-02T10:00:00Z',
        isWetInk: true,
      });

      expect(repository.findDocumentById).toHaveBeenCalledWith(document.id);
      expect(repository.insertSignature).toHaveBeenCalledWith({
        cityId: subject.cityId,
        documentId: document.id,
        signedByEmployeeId: '88888888-8888-8888-8888-888888888888',
        signedByDisplayName: 'John Doe',
        signatureType: 'sp_secretary',
        signedAt: new Date('2026-06-02T10:00:00Z'),
        isWetInk: true,
        signatureImageS3Key: null,
      });

      expect(response).toEqual({
        id: '99999999-9999-9999-9999-999999999999',
        documentId: document.id,
        signedByEmployeeId: '88888888-8888-8888-8888-888888888888',
        signedByDisplayName: 'John Doe',
        signatureType: 'sp_secretary',
        signedAt: '2026-06-02T10:00:00.000Z',
        isWetInk: true,
        signatureImageS3Key: null,
        createdAt: '2026-06-02T10:00:00.000Z',
      });
    });

    it('denies disallowed roles (e.g. dept_encoder) from logging a signature', async () => {
      const repository = makeMockRepository();
      const subject = makeSubject({ roles: ['dept_encoder'] });
      const ctx = makeCtx(subject, { repository });
      const caller = callerFor(ctx);

      const document = makeDocumentRow();
      repository.findDocumentById.mockResolvedValue(document);

      await expect(
        caller.logSignature({
          documentId: document.id,
          signedByEmployeeId: '88888888-8888-8888-8888-888888888888',
          signedByDisplayName: 'John Doe',
          signatureType: 'sp_secretary',
          signedAt: '2026-06-02T10:00:00Z',
          isWetInk: true,
        }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('documents.uploadSignatureImage', () => {
    it('allows upload signature image when user has access to ownedByOfficeId', async () => {
      const repository = makeMockRepository();
      const subject = makeSubject({
        roles: ['sp_secretary'],
        effectiveOfficeIds: ['office-sps'],
      });
      const ctx = makeCtx(subject, { repository });
      const caller = callerFor(ctx);

      const mockSignatureRow: SignatureRow = {
        id: '99999999-9999-9999-9999-999999999999',
        cityId: subject.cityId,
        documentId: '11111111-1111-1111-1111-111111111111',
        signedByEmployeeId: '88888888-8888-8888-8888-888888888888',
        signedByDisplayName: 'John Doe',
        signatureType: 'sp_secretary',
        signedAt: new Date(),
        isWetInk: true,
        signatureImageS3Key: null,
        createdAt: new Date(),
        deletedAt: null,
        deletedBy: null,
      };

      const document = makeDocumentRow({
        id: '11111111-1111-1111-1111-111111111111',
        ownedByOfficeId: 'office-sps',
      });

      repository.findSignatureById.mockResolvedValue(mockSignatureRow);
      repository.findDocumentById.mockResolvedValue(document);

      const response = await caller.uploadSignatureImage({
        signatureId: '99999999-9999-9999-9999-999999999999',
        s3Key: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      });

      expect(repository.findSignatureById).toHaveBeenCalledWith(
        '99999999-9999-9999-9999-999999999999',
      );
      expect(repository.findDocumentById).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
      );
      expect(repository.updateSignatureImageKey).toHaveBeenCalledWith(
        '99999999-9999-9999-9999-999999999999',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      );
      expect(response).toEqual({ success: true });
    });

    it('denies upload signature image when user does not have access to ownedByOfficeId', async () => {
      const repository = makeMockRepository();
      const subject = makeSubject({
        roles: ['sp_secretary'],
        effectiveOfficeIds: ['office-some-other'],
      });
      const ctx = makeCtx(subject, { repository });
      const caller = callerFor(ctx);

      const mockSignatureRow: SignatureRow = {
        id: '99999999-9999-9999-9999-999999999999',
        cityId: subject.cityId,
        documentId: '11111111-1111-1111-1111-111111111111',
        signedByEmployeeId: '88888888-8888-8888-8888-888888888888',
        signedByDisplayName: 'John Doe',
        signatureType: 'sp_secretary',
        signedAt: new Date(),
        isWetInk: true,
        signatureImageS3Key: null,
        createdAt: new Date(),
        deletedAt: null,
        deletedBy: null,
      };

      const document = makeDocumentRow({
        id: '11111111-1111-1111-1111-111111111111',
        ownedByOfficeId: 'office-sps',
      });

      repository.findSignatureById.mockResolvedValue(mockSignatureRow);
      repository.findDocumentById.mockResolvedValue(document);

      await expect(
        caller.uploadSignatureImage({
          signatureId: '99999999-9999-9999-9999-999999999999',
          s3Key: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        }),
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('documents.getSignatureRecords', () => {
    it('returns signatures list sorted by signedAt ASC', async () => {
      const repository = makeMockRepository();
      const subject = makeSubject({ roles: ['auditor'] });
      const ctx = makeCtx(subject, { repository });
      const caller = callerFor(ctx);

      const document = makeDocumentRow();
      repository.findDocumentById.mockResolvedValue(document);

      const mockSignatures: SignatureRow[] = [
        {
          id: '99999999-9999-9999-9999-000000000001',
          cityId: subject.cityId,
          documentId: document.id,
          signedByEmployeeId: '88888888-8888-8888-8888-000000000001',
          signedByDisplayName: 'Alice',
          signatureType: 'vice_mayor',
          signedAt: new Date('2026-06-02T10:00:00Z'),
          isWetInk: true,
          signatureImageS3Key: null,
          createdAt: new Date('2026-06-02T10:00:00Z'),
          deletedAt: null,
          deletedBy: null,
        },
        {
          id: '99999999-9999-9999-9999-000000000002',
          cityId: subject.cityId,
          documentId: document.id,
          signedByEmployeeId: '88888888-8888-8888-8888-000000000002',
          signedByDisplayName: 'Bob',
          signatureType: 'mayor',
          signedAt: new Date('2026-06-03T10:00:00Z'),
          isWetInk: true,
          signatureImageS3Key: null,
          createdAt: new Date('2026-06-03T10:00:00Z'),
          deletedAt: null,
          deletedBy: null,
        },
      ] as any[];

      repository.findSignaturesByDocument.mockResolvedValue(mockSignatures);

      const response = await caller.getSignatureRecords({
        documentId: document.id,
      });

      expect(repository.findSignaturesByDocument).toHaveBeenCalledWith(document.id);
      expect(response).toHaveLength(2);
      expect(response[0]!.id).toBe('99999999-9999-9999-9999-000000000001');
      expect(response[1]!.id).toBe('99999999-9999-9999-9999-000000000002');
    });

    it('denies disallowed roles (e.g. plat_admin)', async () => {
      const repository = makeMockRepository();
      const subject = makeSubject({ roles: ['plat_admin'] });
      const ctx = makeCtx(subject, { repository });
      const caller = callerFor(ctx);

      const document = makeDocumentRow();
      repository.findDocumentById.mockResolvedValue(document);

      await expect(
        caller.getSignatureRecords({
          documentId: document.id,
        }),
      ).rejects.toThrow(TRPCError);
    });
  });
});
