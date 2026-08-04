import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocumentsService } from '../documents.service.js';
import { DocumentsRepository } from '../documents.repository.js';
import type { DbClient } from '../documents.types.js';

describe('DocumentsService', () => {
  let mockDeps: any;
  let service: ReturnType<typeof createDocumentsService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDeps = {
      db: {
        transaction: vi.fn(async (cb) => cb(mockDeps.db)),
      },
      documentsRepository: {} as any, // Not used since it instantiates a new one
      numberingService: {},
      s3Client: {},
      env: {},
      eventBus: {
        emit: vi.fn(),
      },
    };

    service = createDocumentsService(mockDeps);
  });

  describe('transitionState', () => {
    it('should throw error when transitioning from draft to disposed (invalid)', async () => {
      vi.spyOn(DocumentsRepository.prototype, 'findDocumentById').mockResolvedValueOnce({
        id: 'doc-1',
        lifecycleState: 'draft',
        cityId: 'city-1',
      } as any);

      await expect(service.transitionState('doc-1', 'disposed', 'user-1')).rejects.toThrowError(
        'invalid state transition: draft -> disposed',
      );

      expect(mockDeps.eventBus.emit).not.toHaveBeenCalled();
    });

    it('should succeed when transitioning from in_workflow to cancelled and emit event', async () => {
      vi.spyOn(DocumentsRepository.prototype, 'findDocumentById').mockResolvedValueOnce({
        id: 'doc-2',
        lifecycleState: 'in_workflow',
        cityId: 'city-1',
      } as any);

      const updateSpy = vi
        .spyOn(DocumentsRepository.prototype, 'updateDocumentLifecycleState')
        .mockResolvedValueOnce(undefined as any);

      await service.transitionState('doc-2', 'cancelled', 'user-1', 'Test reason');

      expect(updateSpy).toHaveBeenCalledWith('doc-2', 'cancelled');

      expect(mockDeps.eventBus.emit).toHaveBeenCalledWith(
        'document.state_changed',
        expect.objectContaining({
          eventType: 'document.state_changed',
          cityId: 'city-1',
          payload: expect.objectContaining({
            documentId: 'doc-2',
            fromState: 'in_workflow',
            toState: 'cancelled',
            actorId: 'user-1',
            reason: 'Test reason',
          }),
        }),
      );
    });
  });

  describe('createSupersedingDocument', () => {
    beforeEach(() => {
      // Create a real instance so prototype spies work on the outer deps.documentsRepository
      // as well as the inner txRepo.
      mockDeps.documentsRepository = new DocumentsRepository(mockDeps.db);
    });

    it('happy path: all three writes happen inside the transaction, event emitted after, correct return shape', async () => {
      const oldDoc = {
        id: 'doc-1',
        title: 'Original Title',
        documentTypeId: 'type-1',
        classificationLevel: 'public',
        originatingOfficeId: 'office-1',
        ownedByOfficeId: 'office-2',
        createdBy: 'user-1',
        retentionScheduleId: 'sched-1',
        cityId: 'city-1',
        numberSeriesId: 'series-1',
        preliminaryNumber: 'PRE-123',
        finalNumber: 'FIN-123',
        lifecycleState: 'pending_panlalawigan_review',
      };
      vi.spyOn(DocumentsRepository.prototype, 'findDocumentById').mockResolvedValueOnce(oldDoc as any);

      const insertSpy = vi.spyOn(DocumentsRepository.prototype, 'insertDocument').mockResolvedValueOnce({ id: 'new-doc-1' } as any);
      const updateStateSpy = vi.spyOn(DocumentsRepository.prototype, 'updateDocumentLifecycleState').mockResolvedValueOnce(undefined as any);
      const setSupersessionSpy = vi.spyOn(DocumentsRepository.prototype, 'setDocumentSupersession').mockResolvedValueOnce(undefined as any);

      const input = { oldDocumentId: 'doc-1', closureReason: 'Needs revision' };
      const result = await service.createSupersedingDocument(input);

      // Assert all three writes were called (strict ordering not explicitly asserted by mock call order alone)
      expect(insertSpy).toHaveBeenCalledTimes(1);
      const insertArgs = insertSpy.mock.calls[0][0];
      expect(insertArgs.title).toBe('Original Title v2');
      expect(insertArgs.qrTrackingNumber).toEqual(expect.any(String));
      expect(insertArgs.lifecycleState).toBe('submitted');

      expect(updateStateSpy).toHaveBeenCalledWith('doc-1', 'superseded');
      expect(setSupersessionSpy).toHaveBeenCalledWith('doc-1', 'new-doc-1', 'Needs revision');

      expect(mockDeps.eventBus.emit).toHaveBeenCalledWith(
        'document.state_changed',
        expect.objectContaining({
          payload: expect.objectContaining({
            documentId: 'doc-1',
            fromState: 'pending_panlalawigan_review',
            toState: 'superseded',
            actorId: 'user-1',
            reason: 'Needs revision',
            cityId: 'city-1',
          }),
        }),
      );

      expect(result).toEqual({
        newDocumentId: 'new-doc-1',
        actorId: 'user-1',
        cityId: 'city-1',
        documentTypeId: 'type-1',
        ownedByOfficeId: 'office-2',
      });
    });

    it('throws when old document not found, does not start a transaction', async () => {
      vi.spyOn(DocumentsRepository.prototype, 'findDocumentById').mockResolvedValueOnce(null);

      await expect(
        service.createSupersedingDocument({ oldDocumentId: 'doc-missing', closureReason: 'reason' })
      ).rejects.toThrowError('createSupersedingDocument: document not found: doc-missing');

      expect(mockDeps.db.transaction).not.toHaveBeenCalled();
    });

    it('throws when lifecycleState does not allow superseded transition, does not start a transaction', async () => {
      vi.spyOn(DocumentsRepository.prototype, 'findDocumentById').mockResolvedValueOnce({
        id: 'doc-1',
        lifecycleState: 'cancelled',
      } as any);

      await expect(
        service.createSupersedingDocument({ oldDocumentId: 'doc-1', closureReason: 'reason' })
      ).rejects.toThrowError('createSupersedingDocument: invalid state transition: cancelled -> superseded');

      expect(mockDeps.db.transaction).not.toHaveBeenCalled();
    });

    it('atomicity: if a write inside the transaction throws, no partial state is committed and the function rejects', async () => {
      // NOTE: This test only proves the service function's own behavior is correct
      // when the transaction callback rejects: no emit, error propagates.
      // True DB-backed rollback atomicity would require an integration test against a real DB.
      vi.spyOn(DocumentsRepository.prototype, 'findDocumentById').mockResolvedValueOnce({
        id: 'doc-1',
        lifecycleState: 'pending_panlalawigan_review',
        cityId: 'city-1',
      } as any);

      vi.spyOn(DocumentsRepository.prototype, 'insertDocument').mockResolvedValueOnce({ id: 'new-doc-1' } as any);
      vi.spyOn(DocumentsRepository.prototype, 'updateDocumentLifecycleState').mockResolvedValueOnce(undefined as any);
      
      const dbError = new Error('DB write failed');
      vi.spyOn(DocumentsRepository.prototype, 'setDocumentSupersession').mockRejectedValueOnce(dbError);

      await expect(
        service.createSupersedingDocument({ oldDocumentId: 'doc-1', closureReason: 'reason' })
      ).rejects.toThrow(dbError);

      expect(mockDeps.eventBus.emit).not.toHaveBeenCalled();
    });
  });
});
