import { FastifyInstance } from 'fastify';
import submitComplaintRoute from './routes/submit-complaint.js';
import listDocumentsRoute from './routes/list-documents.js';
import getDocumentRoute from './routes/get-document.js';

export default async function portalRouter(fastify: FastifyInstance) {
  // Routes for the portal module
  await fastify.register(submitComplaintRoute);
  await fastify.register(listDocumentsRoute);
  await fastify.register(getDocumentRoute);
}
