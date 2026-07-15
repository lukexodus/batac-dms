import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DesignationHandler, DesignationMetadataInvalidError } from '../designation.handler.js';
import type { DocumentsRepository } from '../documents.repository.js';
import type {
  DelegationService,
  DelegationSubject,
} from '../../organization/organization.types.js';

describe('DesignationHandler', () => {
  let mockDocumentsRepo: any;
  let mockDelegationService: any;
  let handler: DesignationHandler;

  const validMetadata = {
    delegatingAuthorityEmployeeId: 'emp-1',
    designatedPersonEmployeeId: 'emp-2',
    designatedOfficeId: 'office-1',
    designatedPositionId: 'pos-1',
    scopeDescription: 'Test scope',
    effectiveFrom: '2026-07-01',
    effectiveUntil: '2026-07-15',
    legalBasis: 'Test basis',
  };

  const subject: DelegationSubject = {
    userId: 'user-1',
    roles: ['sp_secretary'],
    cityId: 'city-1',
  };

  beforeEach(() => {
    mockDocumentsRepo = {
      updateDocumentMetadata: vi.fn().mockResolvedValue(undefined),
    };

    mockDelegationService = {
      createDelegationGrant: vi.fn().mockResolvedValue({ id: 'grant-1' }),
      revokeEarlyDelegationGrant: vi.fn().mockResolvedValue({ id: 'grant-1' }),
    };

    handler = new DesignationHandler({
      documentsRepository: mockDocumentsRepo as unknown as DocumentsRepository,
      delegationService: mockDelegationService as unknown as DelegationService,
      runInTransaction: async (fn) => fn({} as any),
    });
  });

  describe('handleDesignationLogged', () => {
    it('throws DesignationMetadataInvalidError if missing required fields', async () => {
      const invalidMetadata = { ...validMetadata };
      delete (invalidMetadata as any).delegatingAuthorityEmployeeId;

      await expect(
        handler.handleDesignationLogged('doc-1', invalidMetadata, 'actor-1', subject),
      ).rejects.toThrow(DesignationMetadataInvalidError);
    });

    it('creates a delegation grant and updates document metadata', async () => {
      const result = await handler.handleDesignationLogged(
        'doc-1',
        validMetadata,
        'actor-1',
        subject,
      );

      expect(result).toEqual({ delegationGrantId: 'grant-1' });

      expect(mockDelegationService.createDelegationGrant).toHaveBeenCalledWith(
        expect.objectContaining({
          delegatingEmployeeId: 'emp-1',
          delegatedToEmployeeId: 'emp-2',
          officeId: 'office-1',
          positionId: 'pos-1',
          designationDocumentId: 'doc-1',
          scopeDescription: 'Test scope',
          legalBasis: 'Test basis',
          startDate: '2026-07-01',
          endDate: '2026-07-15',
          cityId: 'city-1',
        }),
        subject,
        expect.anything(),
      );

      expect(mockDocumentsRepo.updateDocumentMetadata).toHaveBeenCalledWith('doc-1', {
        ...validMetadata,
        delegationGrantId: 'grant-1',
      });
    });
  });

  describe('handleDesignationCancelled', () => {
    it('revokes the delegation grant', async () => {
      await handler.handleDesignationCancelled('grant-1', 'Test reason', subject);

      expect(mockDelegationService.revokeEarlyDelegationGrant).toHaveBeenCalledWith(
        'grant-1',
        { writtenInstructionReference: 'Test reason' },
        subject,
      );
    });
  });
});
