import { FastifyInstance } from 'fastify';
import {
  DocumentRequestSubmissionRequestSchema,
  DocumentRequestSubmissionResponseSchema,
  ValidationErrorResponseSchema,
  ErrorResponseSchema,
} from '@batac/shared';
import { generatePrintableForm } from '../lib/generate-printable-form.js';
import { env } from '../../../config/env.js';

/**
 * `estimatedWorkingDays` is hardcoded to 3 per E2's example payload and its
 * field description ("RA 11032 (ARTA) default SLA thresholds. Simple
 * transactions: ≤3 working days") and consolidated reference Part 11.19,
 * which makes ARTA SLA tracking a Phase 1 requirement with "configurable
 * thresholds". No loaded document says where that threshold is configured
 * (env var / DB row / constant). [SPEC GAP — see development-findings-log
 * LOG-0302.] Hardcoded here; configurability deferred for human decision.
 */
const ESTIMATED_WORKING_DAYS = 3;

export default async function submitDocumentRequestRoute(fastify: FastifyInstance) {
  fastify.post(
    '/public/document-requests',
    {
      schema: {
        tags: ['document-requests'],
        summary: 'Submit a Document and Records Request Form',
        body: DocumentRequestSubmissionRequestSchema,
        response: {
          201: DocumentRequestSubmissionResponseSchema,
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
          documentType: 'DOCUMENT_REQUEST_FORM',
          metadata: request.body as any,
          cityId: env.CITY_ID,
        });

      let printableFormUrl: string | null = null;
      if ((request.body as any).accessMode === 'digital_form') {
        printableFormUrl = await generatePrintableForm({
          formType: 'document-request',
          referenceCode,
          data: request.body as Record<string, unknown>,
        });
      }

      return reply.status(201).send({
        data: {
          requestId: documentId,
          referenceCode,
          submittedAt,
          message: `Your document request has been received (reference: ${referenceCode}). It will be reviewed by the Vice Mayor and SP Secretary. You will be contacted via phone when your request is approved and ready for payment.`,
          estimatedWorkingDays: ESTIMATED_WORKING_DAYS,
          printableFormUrl,
        },
      });
    }
  );
}
