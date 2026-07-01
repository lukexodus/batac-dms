import type {
  DocumentsPublicAPI,
  DocumentSummary,
  DocumentTypeSummary,
  DocumentLifecycleState,
  DocumentNumberResult,
  AttachmentRef,
  DbClient,
} from './documents.types.js';
import type { DocumentsRepository } from './documents.repository.js';

export interface DocumentsServiceDeps {
  db: DbClient;
  documentsRepository: DocumentsRepository;
  eventBus?: any;
  auditService?: any;
}

/**
 * Factory to create the Documents Service instance.
 * Returns an object implementing the DocumentsPublicAPI.
 */
export function createDocumentsService(deps: DocumentsServiceDeps): DocumentsPublicAPI {
  return {
    /**
     * B2 Module 3 -- called by Workflow, Records, Tracking.
     * Retrieves a document summary by its ID.
     */
    async getDocumentById(documentId: string): Promise<DocumentSummary | null> {
      throw new Error('not implemented');
    },

    /**
     * B2 Module 3 -- called by Workflow to retrieve workflow template ref.
     * Retrieves a document type summary by its ID.
     */
    async getDocumentType(documentTypeId: string): Promise<DocumentTypeSummary | null> {
      throw new Error('not implemented');
    },

    /**
     * B2 Module 3 -- called by Workflow at step completion; emits document.state_changed.
     * Transitions the lifecycle state of a document.
     */
    async transitionState(
      documentId: string,
      toState: DocumentLifecycleState,
      actorId: string,
      reason?: string
    ): Promise<void> {
      throw new Error('not implemented');
    },

    /**
     * B2 Module 3 -- called by Workflow at correct lifecycle event.
     * Assigns a final control/series number to the document.
     */
    async assignFinalNumber(documentId: string, actorId: string): Promise<DocumentNumberResult> {
      throw new Error('not implemented');
    },

    /**
     * B2 Module 3 -- called by Records for archiving; Search Meta for OCR (Phase 2).
     * Retrieves attachment references associated with the document.
     */
    async getAttachmentRefs(documentId: string, actorId: string): Promise<AttachmentRef[]> {
      throw new Error('not implemented');
    },
  };
}
