import { t } from '../../trpc/trpc.js';
import { createDocumentsRouter } from './documents.router.js';
import { createComplaintsRouter } from './complaints.router.js';
import { createDocumentRequestsRouter } from './document-requests.router.js';

export function createDocumentsAppRouter() {
  return t.mergeRouters(
    createDocumentsRouter(),
    createComplaintsRouter(),
    createDocumentRequestsRouter()
  );
}
