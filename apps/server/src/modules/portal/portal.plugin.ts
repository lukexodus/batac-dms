import fp from 'fastify-plugin';
import listDocumentsRoute from './routes/list-documents.js';
import getDocumentRoute from './routes/get-document.js';
import submitComplaintRoute from './routes/submit-complaint.js';
import submitDocumentRequestRoute from './routes/submit-document-request.js';

export default fp(async (fastify) => {
  await fastify.register(listDocumentsRoute);
  await fastify.register(getDocumentRoute);
  await fastify.register(submitComplaintRoute);
  await fastify.register(submitDocumentRequestRoute);
});
