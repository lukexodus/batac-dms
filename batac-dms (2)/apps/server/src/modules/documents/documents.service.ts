import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'node:crypto';

import type {
  DocumentsPublicAPI,
  DocumentSummary,
  DocumentTypeSummary,
  DocumentLifecycleState,
  DocumentNumberResult,
  AttachmentRef,
  DbClient,
  DbTransaction,
} from './documents.types.js';
import { DocumentsRepository } from './documents.repository.js';
import type { NumberingService } from './numbering.service.js';
import type { ServerEnv } from '../../config/env.server.js';

export interface DocumentsServiceDeps {
  db: DbClient;
  documentsRepository: DocumentsRepository;
  numberingService: NumberingService;
  s3Client: S3Client;
  env: ServerEnv;
  eventBus: any;
  auditService?: any;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  'draft':                       ['submitted','cancelled'],
  'submitted':                   ['in_workflow','cancelled'],
  'in_workflow':                 ['pending_mayor_action','pending_panlalawigan_review','completed','cancelled'],
  'pending_mayor_action':        ['in_workflow','completed','cancelled'],
  'pending_panlalawigan_review': ['completed','superseded','cancelled'],
  'completed':                   ['released','cancelled'],
  'released':                    ['archived','cancelled'],
  'archived':                    ['disposed'],
  'disposed':                    [],
  'cancelled':                   [],
  'superseded':                  [],
};

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
      const doc = await deps.documentsRepository.findDocumentById(documentId);
      if (!doc) {
        return null;
      }
      
      const type = await deps.documentsRepository.findDocumentTypeById(doc.documentTypeId);
      
      return {
        documentId: doc.id,
        title: doc.title,
        documentTypeCode: type?.code ?? 'UNKNOWN',
        lifecycleState: doc.lifecycleState as DocumentLifecycleState,
        preliminaryNumber: doc.preliminaryNumber,
        finalNumber: doc.finalNumber,
        classificationLevel: doc.classificationLevel as any,
        createdAt: doc.createdAt,
      };
    },

    /**
     * B2 Module 3 -- called by Workflow to retrieve workflow template ref.
     * Retrieves a document type summary by its ID.
     */
    async getDocumentType(documentTypeId: string): Promise<DocumentTypeSummary | null> {
      const type = await deps.documentsRepository.findDocumentTypeById(documentTypeId);
      if (!type) {
        return null;
      }
      
      return {
        documentTypeId: type.id,
        name: type.name,
        workflowTemplateId: type.code,
        retentionScheduleId: type.retentionScheduleId,
        publicVisibilityRule: type.publicVisibilityRule,
        requiredStepTypes: type.requiredStepTypes as string[],
      };
    },

    /**
     * B2 Module 3 -- called by Workflow at step completion; emits document.state_changed.
     * Transitions the lifecycle state of a document.
     *
     * [Inference — not in any TASK-DOCS-0NN AI Prompt read so far; added to
     * unblock TASK-DOCS-018's cross-module atomicity requirement, per
     * explicit human sign-off during that task's investigation. See
     * docs/development-findings-log.md for the finding this responds to.]
     *
     * `trx` is an optional caller-supplied transaction handle. When
     * provided, this method participates in the caller's transaction
     * instead of opening its own — this is what makes it possible to
     * compose a document state transition with a write in another module
     * (e.g. organization.delegation_grants) as a single atomic unit.
     *
     * When `trx` is omitted, behavior is unchanged from before this
     * parameter existed: this method opens and commits its own transaction,
     * exactly as every existing caller (documents.router.ts,
     * documents.plugin.ts, panlalawigan.router.ts, complaints.router.ts,
     * document-requests.router.ts) already expects, since none of them pass
     * a 5th argument. [Unverified] I have not executed this against a real
     * database; this is a claim about what the code below does, not a
     * tested guarantee.
     */
    async transitionState(
      documentId: string,
      toState: DocumentLifecycleState,
      actorId: string,
      reason?: string,
      trx?: DbTransaction
    ): Promise<void> {
      const runInTransaction = async (tx: DbTransaction): Promise<void> => {
        // We instantiate a repository with the transaction client to ensure atomic operations
        const txRepo = new DocumentsRepository(tx as unknown as DbClient);

        const doc = await txRepo.findDocumentById(documentId);
        if (!doc) {
          throw new Error(`Document not found: ${documentId}`);
        }

        const current = doc.lifecycleState;
        const allowedTransitions = VALID_TRANSITIONS[current] ?? [];
        if (!allowedTransitions.includes(toState)) {
          throw new Error(`invalid state transition: ${current} -> ${toState}`);
        }

        await txRepo.updateDocumentLifecycleState(documentId, toState);

        const now = new Date();
        deps.eventBus.emit('document.state_changed', {
          eventId: crypto.randomUUID(),
          eventType: 'document.state_changed',
          occurredAt: now.toISOString(),
          cityId: doc.cityId,
          schemaVersion: 1,
          payload: {
            documentId: doc.id,
            fromState: current,
            toState,
            actorId,
            reason,
            cityId: doc.cityId,
            timestamp: now,
          }
        });
      };

      if (trx) {
        // Caller-supplied transaction: participate in it, do not open a new one.
        await runInTransaction(trx);
      } else {
        // No caller-supplied transaction: preserve pre-existing behavior exactly.
        await deps.db.transaction(async (ownTrx) => {
          await runInTransaction(ownTrx);
        });
      }
    },

    /**
     * B2 Module 3 -- called by Workflow at correct lifecycle event.
     * Assigns a final control/series number to the document.
     */
    async assignFinalNumber(documentId: string, actorId: string): Promise<DocumentNumberResult> {
      const doc = await deps.documentsRepository.findDocumentById(documentId);
      if (!doc) {
        throw new Error(`Document not found: ${documentId}`);
      }
      
      const type = await deps.documentsRepository.findDocumentTypeById(doc.documentTypeId);
      if (!type) {
        throw new Error(`Document type not found for document: ${documentId}`);
      }
      
      const numberSeries = await deps.documentsRepository.findNumberSeriesById(type.numberSeriesId!);
      if (!numberSeries) {
        throw new Error(`Number series not found for document type: ${type.id}`);
      }

      const result = await deps.numberingService.assignFinalNumber(
        documentId, 
        numberSeries.seriesKey, 
        doc.cityId, 
        actorId
      );

      deps.eventBus.emit('document.number_assigned', {
        eventId: crypto.randomUUID(),
        eventType: 'document.number_assigned',
        occurredAt: result.assignedAt.toISOString(),
        cityId: doc.cityId,
        schemaVersion: 1,
        payload: {
          documentId,
          numberType: 'final',
          numberValue: result.numberValue,
          series: numberSeries.seriesKey,
          assignedBy: actorId,
          cityId: doc.cityId,
          timestamp: result.assignedAt,
        }
      });

      return {
        finalNumber: result.numberValue,
        assignedAt: result.assignedAt,
      };
    },

    /**
     * B2 Module 3 -- called by Records for archiving; Search Meta for OCR (Phase 2).
     * Retrieves attachment references associated with the document.
     */
    async getAttachmentRefs(documentId: string, actorId: string): Promise<AttachmentRef[]> {
      const versions = await deps.documentsRepository.findVersionsByDocument(documentId);
      const attachments = await deps.documentsRepository.findAttachmentsByDocument(documentId);
      
      const expiry = deps.env.S3_SIGNED_URL_EXPIRES_S || 900;
      
      const refs: AttachmentRef[] = [];

      for (const version of versions) {
        if (!version.fileKey) continue;
        const command = new GetObjectCommand({
          Bucket: deps.env.S3_BUCKET,
          Key: version.fileKey,
        });
        const url = await getSignedUrl(deps.s3Client, command, { expiresIn: expiry });
        refs.push({
          attachmentId: version.id,
          s3Key: version.fileKey,
          presignedUrl: url,
          mediaType: version.mimeType,
          ocrText: version.ocrText ?? null,
          scanQualityScore: version.scanQualityScore !== null ? Number(version.scanQualityScore) : null,
          pageCount: version.pageCount ?? 0,
        });
      }

      for (const attachment of attachments) {
        if (!attachment.fileKey) continue;
        const command = new GetObjectCommand({
          Bucket: deps.env.S3_BUCKET,
          Key: attachment.fileKey,
        });
        const url = await getSignedUrl(deps.s3Client, command, { expiresIn: expiry });
        refs.push({
          attachmentId: attachment.id,
          s3Key: attachment.fileKey,
          presignedUrl: url,
          mediaType: attachment.mimeType ?? 'application/octet-stream',
          ocrText: null,
          scanQualityScore: null,
          pageCount: 0,
        });
      }

      return refs;
    },
  };
}
