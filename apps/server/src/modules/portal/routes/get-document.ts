import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  PublishedDocumentDetailResponseSchema,
  ErrorResponseSchema,
} from '@batac/shared';
import { presignFirstPage } from '../lib/presign-first-page.js';

export default async function getDocumentRoute(fastify: FastifyInstance) {
  fastify.get(
    '/public/documents/:documentId',
    {
      schema: {
        tags: ['documents'],
        summary: 'Get a single published document',
        params: z.object({ documentId: z.string().uuid() }),
        response: {
          200: PublishedDocumentDetailResponseSchema,
          404: ErrorResponseSchema,
          429: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const params = request.params as { documentId: string };
      const detail = await fastify.documentsService.getPublishedDocumentDetail(params.documentId);
      if (!detail) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Document not found or not yet available on the public portal.',
        });
      }
      return reply.send({
        data: {
          ...detail,
          firstPagePreview: await presignFirstPage(detail.documentId),
        },
      });
    }
  );
}
