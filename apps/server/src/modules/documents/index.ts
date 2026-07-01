import { DocumentsRepository } from './documents.repository.js';
import { createDocumentsService } from './documents.service.js';
import type { DocumentsPublicAPI, DbClient } from './documents.types.js';

export * from './documents.types.js';
export { default as documentsPlugin } from './documents.plugin.js';
export { createDocumentsRouter } from './documents.router.js';
export { DocumentsRepository } from './documents.repository.js';
export { createDocumentsService } from './documents.service.js';

/**
 * Factory to create the Documents Module instance.
 * Initializes the repository and service, returning the DocumentsPublicAPI.
 */
export function createDocumentsModule(deps: {
  db: DbClient;
  eventBus?: any;
  auditService?: any;
}): DocumentsPublicAPI {
  const repo = new DocumentsRepository(deps.db);
  return createDocumentsService({
    db: deps.db,
    documentsRepository: repo,
    eventBus: deps.eventBus,
    auditService: deps.auditService,
  });
}
