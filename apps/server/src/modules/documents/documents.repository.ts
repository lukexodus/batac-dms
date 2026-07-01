import type { DbClient, DbTransaction, DocumentLifecycleState } from './documents.types.js';

export class DocumentsRepository {
  constructor(private readonly db: DbClient | DbTransaction) {}

  /**
   * B2 Module 3 -- called by service to fetch a document by its ID
   */
  async findById(id: string): Promise<any> {
    throw new Error('not implemented');
  }

  /**
   * B2 Module 3 -- called by service to fetch a document type by its ID
   */
  async findTypeById(id: string): Promise<any> {
    throw new Error('not implemented');
  }

  /**
   * B2 Module 3 -- called by service to update a document's lifecycle state
   */
  async updateState(
    id: string,
    state: DocumentLifecycleState,
    actorId: string,
    reason?: string
  ): Promise<void> {
    throw new Error('not implemented');
  }

  /**
   * B2 Module 3 -- called by service to fetch attachment records for a document
   */
  async findAttachmentsByDocumentId(documentId: string): Promise<any[]> {
    throw new Error('not implemented');
  }

  /**
   * Phase 1 core query/mutation -- create a new document record
   */
  async create(input: any): Promise<any> {
    throw new Error('not implemented');
  }

  /**
   * Phase 1 core query/mutation -- update an existing document record
   */
  async update(id: string, input: any): Promise<any> {
    throw new Error('not implemented');
  }

  /**
   * Phase 1 core query/mutation -- soft-delete a document record
   */
  async softDelete(id: string, deletedBy: string): Promise<void> {
    throw new Error('not implemented');
  }

  /**
   * Phase 1 core query/mutation -- fetch versions of a document
   */
  async findVersionsByDocumentId(documentId: string): Promise<any[]> {
    throw new Error('not implemented');
  }

  /**
   * Phase 1 core query/mutation -- create a new document version record
   */
  async createVersion(input: any): Promise<any> {
    throw new Error('not implemented');
  }

  /**
   * Phase 1 core query/mutation -- create a new attachment record
   */
  async createAttachment(input: any): Promise<any> {
    throw new Error('not implemented');
  }

  /**
   * Phase 1 core query/mutation -- create/assign a number record
   */
  async createNumber(input: any): Promise<any> {
    throw new Error('not implemented');
  }
}
