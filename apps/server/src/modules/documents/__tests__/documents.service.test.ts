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
        cityId: 'city-1'
      } as any);

      await expect(service.transitionState('doc-1', 'disposed', 'user-1')).rejects.toThrowError(
        'invalid state transition: draft -> disposed'
      );
      
      expect(mockDeps.eventBus.emit).not.toHaveBeenCalled();
    });

    it('should succeed when transitioning from in_workflow to cancelled and emit event', async () => {
      vi.spyOn(DocumentsRepository.prototype, 'findDocumentById').mockResolvedValueOnce({
        id: 'doc-2',
        lifecycleState: 'in_workflow',
        cityId: 'city-1'
      } as any);
      
      const updateSpy = vi.spyOn(DocumentsRepository.prototype, 'updateDocumentLifecycleState').mockResolvedValueOnce(undefined as any);

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
          })
        })
      );
    });
  });
});
