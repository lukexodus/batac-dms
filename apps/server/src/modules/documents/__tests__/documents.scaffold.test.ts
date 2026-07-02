import { describe, it, expect, vi } from 'vitest';
import {
  createDocumentsModule,
  createDocumentsService,
  createDocumentsRouter,
  DocumentsRepository,
} from '../index.js';

vi.mock('../../../config/env.js', () => ({
  env: {}
}));

describe('Documents Module Scaffold', () => {
  it('exposes the factory functions and repository class', () => {
    expect(createDocumentsModule).toBeDefined();
    expect(createDocumentsService).toBeDefined();
    expect(createDocumentsRouter).toBeDefined();
    expect(DocumentsRepository).toBeDefined();
  });

  it('allows creating the module and exposes the public API methods', () => {
    const mockDb = {} as any;
    const documentsModule = createDocumentsModule({
      db: mockDb,
      numberingService: {} as any,
      s3Client: {} as any,
      env: {} as any,
    });

    expect(documentsModule).toBeDefined();
    expect(typeof documentsModule.getDocumentById).toBe('function');
    expect(typeof documentsModule.getDocumentType).toBe('function');
    expect(typeof documentsModule.transitionState).toBe('function');
    expect(typeof documentsModule.assignFinalNumber).toBe('function');
    expect(typeof documentsModule.getAttachmentRefs).toBe('function');
  });

});

