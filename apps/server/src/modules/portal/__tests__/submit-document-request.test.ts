import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import portalPlugin from '../portal.plugin.js';
import fp from 'fastify-plugin';

vi.mock('../lib/generate-printable-form.js', () => ({
  generatePrintableForm: vi.fn().mockResolvedValue('https://s3.example.com/presigned-pdf-url'),
}));

import { generatePrintableForm } from '../lib/generate-printable-form.js';

const mockDocumentsService = {
  createPublicSubmission: vi.fn(),
};

const mockDependenciesPlugin = fp(async (fastify) => {
  fastify.decorate('documentsService', mockDocumentsService);
  fastify.decorate('config', { CITY_ID: 'batac-city' });
});

const VALID_PAYLOAD = {
  requesterName: 'Maria Santos',
  requesterAgency: 'Barangay 5 Office',
  requesterEmail: 'maria.santos@email.com',
  requesterPhone: '09171234567',
  documentType: 'SP_ORDINANCE',
  documentTitle: 'Ordinance No. 3SP 2014-05',
  documentNumber: '3SP 2014-05',
  numberOfPagesCopied: 5,
  purpose: 'For personal records and legal reference',
  idType: 'Government employee ID',
  accessMode: 'digital_form',
};

describe('POST /v1/public/document-requests', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = Fastify({ logger: false });
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);

    // Mock rate limit
    await fastify.register(async (f) => {
      // no-op
    }, { name: '@fastify/rate-limit' });

    await fastify.register(mockDependenciesPlugin);
    await fastify.register(portalPlugin);
    await fastify.ready();
  });

  it('returns 201 with DREQ reference code, estimatedWorkingDays 3, and printable form for digital_form', async () => {
    mockDocumentsService.createPublicSubmission.mockResolvedValue({
      documentId: '123e4567-e89b-12d3-a456-426614174000',
      referenceCode: 'DREQ-2026-0001',
      submittedAt: '2026-08-09T00:00:00Z',
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/public/document-requests',
      payload: VALID_PAYLOAD,
    });

    const body = response.json();
    expect(response.statusCode).toBe(201);
    expect(body.data.referenceCode).toMatch(/^DREQ-\d{4}-\d{4}$/);
    expect(body.data.estimatedWorkingDays).toBe(3);
    expect(body.data.printableFormUrl).toBe('https://s3.example.com/presigned-pdf-url');
    expect(body.data.requestId).toBe('123e4567-e89b-12d3-a456-426614174000');

    expect(mockDocumentsService.createPublicSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'DOCUMENT_REQUEST_FORM',
        cityId: expect.any(String),
      }),
    );
    expect(generatePrintableForm).toHaveBeenCalledWith(
      expect.objectContaining({
        formType: 'document-request',
        referenceCode: 'DREQ-2026-0001',
      }),
    );
  });

  it('returns 201 with null printable form for clerk_assisted', async () => {
    mockDocumentsService.createPublicSubmission.mockResolvedValue({
      documentId: '123e4567-e89b-12d3-a456-426614174000',
      referenceCode: 'DREQ-2026-0002',
      submittedAt: '2026-08-09T00:00:00Z',
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/public/document-requests',
      payload: { ...VALID_PAYLOAD, accessMode: 'clerk_assisted' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.printableFormUrl).toBeNull();
    expect(generatePrintableForm).not.toHaveBeenCalled();
  });

  it('returns 400 when requesterEmail (a required field) is omitted', async () => {
    const { requesterEmail: _omitted, ...withoutEmail } = VALID_PAYLOAD;

    const response = await fastify.inject({
      method: 'POST',
      url: '/v1/public/document-requests',
      payload: withoutEmail,
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(mockDocumentsService.createPublicSubmission).not.toHaveBeenCalled();
    expect(body.message).toBeDefined();
  });

  it('passes through sequential DREQ reference codes on consecutive submissions', async () => {
    mockDocumentsService.createPublicSubmission
      .mockResolvedValueOnce({
        documentId: '123e4567-e89b-12d3-a456-426614174000',
        referenceCode: 'DREQ-2026-0001',
        submittedAt: '2026-08-09T00:00:00Z',
      })
      .mockResolvedValueOnce({
        documentId: '123e4567-e89b-12d3-a456-426614174001',
        referenceCode: 'DREQ-2026-0002',
        submittedAt: '2026-08-09T00:00:01Z',
      });

    const first = await fastify.inject({
      method: 'POST',
      url: '/v1/public/document-requests',
      payload: VALID_PAYLOAD,
    });
    const second = await fastify.inject({
      method: 'POST',
      url: '/v1/public/document-requests',
      payload: { ...VALID_PAYLOAD, requesterName: 'Jose Santos' },
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().data.referenceCode).toBe('DREQ-2026-0001');
    expect(second.json().data.referenceCode).toBe('DREQ-2026-0002');
  });
});
