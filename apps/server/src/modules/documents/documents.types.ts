import type { AppDb, TxOrDb } from '../../db.js';
import type {
  CreatePublicSubmissionInput,
  CreatePublicSubmissionResult,
} from './documents.public-submission.service.js';

export type DbClient = AppDb;
export type DbTransaction = TxOrDb;

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
  originatingOfficeId: string;
  createdAt: Date;
  hasPenaltyProvision?: boolean;
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

/**
 * Input for createSupersedingDocument (ADR-014).
 */
export interface SupersedingDocumentInput {
  /** The document being superseded. */
  oldDocumentId: string;
  /** Human-readable reason written into closureReason on the old document row. */
  closureReason: string;
}

/**
 * Return value of createSupersedingDocument (ADR-014).
 * Carries the identifiers the caller needs to emit document.created.
 */
export interface SupersedingDocumentResult {
  newDocumentId: string;
  /** Equals the old document's createdBy — used as actorId in document.created. */
  actorId: string;
  cityId: string;
  documentTypeId: string;
  ownedByOfficeId: string;
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
   *
   * [Inference] `trx` is an optional caller-supplied transaction handle,
   * added to support TASK-DOCS-018's cross-module atomicity requirement
   * (see docs/development-findings-log.md). When omitted, behavior is
   * unchanged: this method opens its own transaction as before. This is
   * additive — every pre-existing call site passes 3 or 4 arguments and is
   * unaffected.
   */
  transitionState(
    documentId: string,
    toState: DocumentLifecycleState,
    actorId: string,
    reason?: string,
    trx?: DbTransaction,
  ): Promise<void>;

  /**
   * B2 Module 3 -- called by Workflow when a workflow instance is created.
   * Sets the document's inverse FK `workflow_instance_id` → instance id.
   * `trx` optional, same convention as `transitionState`. See
   * development-findings-log.md LOG-0211.
   */
  setWorkflowInstance(documentId: string, instanceId: string, trx?: DbTransaction): Promise<void>;

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

  /**
   * ADR-014 — called by documents.plugin.ts's workflow.instance.repassed subscriber.
   *
   * In a single atomic transaction:
   *   1. Inserts a new document row (superseding document) with fields copied from
   *      the old document: title appended with " v2", fresh qrTrackingNumber, same
   *      createdBy, same preliminaryNumber / finalNumber, lifecycleState = 'submitted'.
   *   2. Transitions the old document to 'superseded' (lifecycleState).
   *   3. Writes supersededBy / supersededAt / closureReason on the old document row.
   *
   * Returns identifiers needed by the caller to emit document.created for the new
   * document. Does NOT emit document.created itself. See LOG-0222.
   */
  createSupersedingDocument(input: SupersedingDocumentInput): Promise<SupersedingDocumentResult>;

  /**
   * TASK-PORTAL-003 — unauthenticated citizen-submission write path (backed by
   * POST /v1/public/complaints and /v1/public/document-requests). Creates a
   * documents.documents row with a fresh QR tracking UUID, reserves a
   * COMP-/DREQ- reference code, emits document.created after commit, and
   * returns the reference code synchronously so the public endpoint can return
   * it in the same HTTP response. See documents.public-submission.service.ts.
   */
  createPublicSubmission(
    input: CreatePublicSubmissionInput,
  ): Promise<CreatePublicSubmissionResult>;
}

declare module 'fastify' {
  interface FastifyInstance {
    documentsService: DocumentsPublicAPI;
    documentsTrpcRouter: any; // Will be properly typed when the router factory is implemented
  }
}
