import { FastifyInstance } from 'fastify';
import {
  ComplaintSubmissionRequestSchema,
  ComplaintSubmissionResponseSchema,
  ValidationErrorResponseSchema,
  ErrorResponseSchema,
} from '@batac/shared';
import { generatePrintableForm } from '../lib/generate-printable-form.js';
import { env } from '../../../config/env.js';

export default async function submitComplaintRoute(fastify: FastifyInstance) {
  fastify.post(
    '/public/complaints',
    {
      schema: {
        tags: ['complaints'],
        summary: 'Submit a citizen complaint',
        body: ComplaintSubmissionRequestSchema,
        response: {
          201: ComplaintSubmissionResponseSchema,
          400: ValidationErrorResponseSchema,
          429: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const { documentId, referenceCode, submittedAt } =
        await fastify.documentsService.createPublicSubmission({
          documentType: 'CITIZEN_COMPLAINT',
          metadata: request.body as any,
          cityId: env.CITY_ID,
        });

      let printableFormUrl: string | null = null;
      if ((request.body as any).accessMode === 'digital_form') {
        printableFormUrl = await generatePrintableForm({
          formType: 'complaint',
          referenceCode,
          data: request.body as Record<string, unknown>,
        });
      }

      return reply.status(201).send({
        data: {
          complaintId: documentId,
          referenceCode,
          submittedAt,
          status: 'pending_hearing',
          message: `Your complaint has been received by the SP Secretariat (reference: ${referenceCode}). It will be reviewed and routed to the appropriate committee. You will be notified of the outcome via your contact number.`,
          printableFormUrl,
        },
      });
    }
  );
}
