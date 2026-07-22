import { describe, it, expect, vi } from 'vitest';
import { createDocumentsService } from '../documents.service.js';
import { DocumentsRepository } from '../documents.repository.js';
import { createDocumentsRouter } from '../index.js';

vi.mock('../../../config/env.js', () => ({
  env: {},
}));

describe('Documents Module Scaffold', () => {
  it('exposes the factory functions and repository class', () => {
    expect(createDocumentsService).toBeDefined();
    expect(createDocumentsRouter).toBeDefined();
    expect(DocumentsRepository).toBeDefined();
  });

  it('allows creating the service and exposes the public API methods', () => {
    const mockDb = {} as any;
    const documentsRepository = new DocumentsRepository(mockDb);
    const documentsService = createDocumentsService({
      db: mockDb,
      documentsRepository,
      numberingService: {} as any,
      s3Client: {} as any,
      env: {} as any,
      eventBus: {} as any,
    });

    expect(documentsService).toBeDefined();
    expect(typeof documentsService.getDocumentById).toBe('function');
    expect(typeof documentsService.getDocumentType).toBe('function');
    expect(typeof documentsService.transitionState).toBe('function');
    expect(typeof documentsService.assignFinalNumber).toBe('function');
    expect(typeof documentsService.getAttachmentRefs).toBe('function');
  });
});
