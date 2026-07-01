import { describe, it, expect } from 'vitest';
import {
  createDocumentsModule,
  createDocumentsService,
  createDocumentsRouter,
  DocumentsRepository,
} from '../index.js';

describe('Documents Module Scaffold', () => {
  it('exposes the factory functions and repository class', () => {
    expect(createDocumentsModule).toBeDefined();
    expect(createDocumentsService).toBeDefined();
    expect(createDocumentsRouter).toBeDefined();
    expect(DocumentsRepository).toBeDefined();
  });

  it('allows calling public API methods and throws not implemented error', async () => {
    const mockDb = {} as any;
    const documentsModule = createDocumentsModule({ db: mockDb });

    expect(documentsModule).toBeDefined();
    await expect(documentsModule.getDocumentById('doc-1')).rejects.toThrow('not implemented');
    await expect(documentsModule.getDocumentType('type-1')).rejects.toThrow('not implemented');
    await expect(documentsModule.transitionState('doc-1', 'draft', 'actor-1')).rejects.toThrow('not implemented');
    await expect(documentsModule.assignFinalNumber('doc-1', 'actor-1')).rejects.toThrow('not implemented');
    await expect(documentsModule.getAttachmentRefs('doc-1', 'actor-1')).rejects.toThrow('not implemented');
  });

});

