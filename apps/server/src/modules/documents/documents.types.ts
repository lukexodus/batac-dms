import type { AppDb } from '../../db.js';

export type DbClient = AppDb;
export type DbTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

export type DocumentLifecycleState =
  | 'draft'
  | 'submitted'
  | 'in_workflow'
  | 'pending_mayor_action'
  | 'pending_panlalawigan_review'
  | 'completed'
  | 'released'
  | 'archived'
  | 'disposed'
  | 'cancelled'
  | 'superseded';

export type ClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export interface DocumentSummary {
  documentId: string;
  title: string;
  documentTypeCode: string;
  lifecycleState: DocumentLifecycleState;
  preliminaryNumber: string | null;
  finalNumber: string | null;
  classificationLevel: ClassificationLevel;
  createdAt: Date;
}

export interface DocumentTypeSummary {
  documentTypeId: string;
  name: string;
  workflowTemplateId: string;
  retentionScheduleId: string | null;
  publicVisibilityRule: string;
  requiredStepTypes: string[];
}

export interface DocumentNumberResult {
  finalNumber: string;
  assignedAt: Date;
}

export interface AttachmentRef {
  attachmentId: string;
  s3Key: string;
  presignedUrl: string;
  mediaType: string;
  ocrText: string | null;
  scanQualityScore: number | null;
  pageCount: number;
}


export interface DocumentStateChangedEvent {
  documentId: string;
  fromState: DocumentLifecycleState;
  toState: DocumentLifecycleState;
  actorId: string;
  reason?: string;
  cityId: string;
  timestamp: Date;
}

export interface DocumentNumberAssignedEvent {
  documentId: string;
  numberType: 'final' | 'preliminary' | 'control';
  numberValue: string;
  series: string;
  assignedBy: string;
  cityId: string;
  timestamp: Date;
}

export interface DocumentsPublicAPI {
  /**
   * B2 Module 3 -- called by Workflow, Records, Tracking.
   * Retrieves a document summary by its ID.
   */
  getDocumentById(documentId: string): Promise<DocumentSummary | null>;

  /**
   * B2 Module 3 -- called by Workflow to retrieve workflow template ref.
   * Retrieves a document type summary by its ID.
   */
  getDocumentType(documentTypeId: string): Promise<DocumentTypeSummary | null>;

  /**
   * B2 Module 3 -- called by Workflow at step completion; emits document.state_changed.
   * Transitions the lifecycle state of a document.
   */
  transitionState(
    documentId: string,
    toState: DocumentLifecycleState,
    actorId: string,
    reason?: string
  ): Promise<void>;

  /**
   * B2 Module 3 -- called by Workflow at correct lifecycle event.
   * Assigns a final control/series number to the document.
   */
  assignFinalNumber(documentId: string, actorId: string): Promise<DocumentNumberResult>;

  /**
   * B2 Module 3 -- called by Records for archiving; Search Meta for OCR (Phase 2).
   * Retrieves attachment references associated with the document.
   */
  getAttachmentRefs(documentId: string, actorId: string): Promise<AttachmentRef[]>;
}

declare module 'fastify' {
  interface FastifyInstance {
    documentsService: DocumentsPublicAPI;
    documentsTrpcRouter: any; // Will be properly typed when the router factory is implemented
  }
}
