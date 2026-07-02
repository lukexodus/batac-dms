import { DocumentsRepository } from './documents.repository.js';
import { createDocumentsService } from './documents.service.js';
import type { DocumentsPublicAPI, DbClient } from './documents.types.js';
import type { NumberingService } from './numbering.service.js';
import type { S3Client } from '@aws-sdk/client-s3';
import type { ServerEnv } from '../../config/env.server.js';

export * from './documents.types.js';
export { default as documentsPlugin } from './documents.plugin.js';
export { createDocumentsRouter } from './documents.router.js';
export { DocumentsRepository } from './documents.repository.js';
export { createDocumentsService } from './documents.service.js';
export type {
  SubjectContext as DocumentsSubjectContext,
  CreateDocumentAttrs,
  ReadMetadataAttrs,
  UpdateDocumentAttrs,
  SoftDeleteDocumentAttrs,
  SubmitDocumentAttrs,
  CancelDocumentAttrs,
  AssignPreliminaryNumberAttrs,
  AssignFinalNumberAttrs,
  CertifyUrgentAttrs,
  ArchiveDocumentAttrs,
  PublishPortalAttrs,
  ContentReadAttrs,
  CreateVersionAttrs,
  ScanQualityAttrs,
} from './documents.policy.js';
export { DocumentPolicyGuard } from './documents.policy.js';

/**
 * Factory to create the Documents Module instance.
 * Initializes the repository and service, returning the DocumentsPublicAPI.
 */
export function createDocumentsModule(deps: {
  db: DbClient;
  eventBus?: any;
  auditService?: any;
  numberingService: NumberingService;
  s3Client: S3Client;
  env: ServerEnv;
}): DocumentsPublicAPI {
  const repo = new DocumentsRepository(deps.db);
  return createDocumentsService({
    db: deps.db,
    documentsRepository: repo,
    eventBus: deps.eventBus,
    auditService: deps.auditService,
    numberingService: deps.numberingService,
    s3Client: deps.s3Client,
    env: deps.env,
  });
}
