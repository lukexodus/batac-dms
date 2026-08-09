import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  PublishedDocumentListResponseSchema,
  ValidationErrorResponseSchema,
  ErrorResponseSchema,
} from '@batac/shared';
import { presignFirstPage } from '../lib/presign-first-page.js';

const querySchema = z.object({
  documentType: z.enum(['SP_RESOLUTION', 'SP_ORDINANCE', 'APPROPRIATION_ORDINANCE']).optional(),
  year: z.coerce.number().int().min(2000).max(2099).optional(),
  number: z.string().max(50).optional(),
  q: z.string().min(2).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export default async function listDocumentsRoute(fastify: FastifyInstance) {
  fastify.get(
    '/public/documents',
    {
      schema: {
        tags: ['documents'],
        summary: 'List published legislative documents',
        querystring: querySchema,
        response: {
          200: PublishedDocumentListResponseSchema,
          400: ValidationErrorResponseSchema,
          429: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { data, meta } = await fastify.documentsService.listPublishedDocuments(request.query as any);
      const enrichedData = await Promise.all(
        data.map(async (row) => ({
          ...row,
          firstPagePreview: await presignFirstPage(row.documentId),
        }))
      );
      return reply.send({
        data: enrichedData,
        meta,
      });
    }
  );
}
