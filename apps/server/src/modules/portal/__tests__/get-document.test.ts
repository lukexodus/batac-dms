import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import rateLimitPlugin from '../../../plugins/rate-limit.js';
import portalPlugin from '../portal.plugin.js';
import fp from 'fastify-plugin';

vi.mock('../lib/presign-first-page.js', () => ({
  presignFirstPage: vi.fn(async () => ({
    url: 'https://s3.example.com/presigned-first-page.jpg',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  })),
}));

import { presignFirstPage } from '../lib/presign-first-page.js';

const mockDocumentsService = {
  listPublishedDocuments: vi.fn(),
  getPublishedDocumentDetail: vi.fn(),
};

const mockDependenciesPlugin = fp(async (fastify) => {
  fastify.decorate('documentsService', mockDocumentsService);
  fastify.decorate('config', { CITY_ID: 'batac-city' });
});

const DOCUMENT_ID = '123e4567-e89b-12d3-a456-426614174000';

const DETAIL = {
  documentId: DOCUMENT_ID,
  documentType: 'SP_ORDINANCE',
  documentTypeName: 'SP Ordinance',
  title: 'Ordinance No. 3SP 2026-01',
  finalNumber: '3SP 2026-01',
  approvedAt: '2026-08-10',
  releasedAt: '2026-08-10T00:00:00+08:00',
  trackingNumber: '123e4567-e89b-12d3-a456-426614174001',
  firstPagePreview: null,
  documentRequestUrl: '/document-requests?ref=3SP+2026-01',
  supersededBy: null,
  supersededAt: null,
  closureReason: null,
  authors: ['Councilor A'],
  sponsors: ['Councilor A'],
  committees: ['Committee on Laws'],
  panlalawiganOutcome: 'valid',
  panlalawiganOutcomeDate: '2026-08-10',
  hasNewspaperPublication: false,
  newspaperPublicationDate: null,
};

describe('GET /public/documents/:documentId', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    fastify = Fastify({ logger: false });
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);

    await fastify.register(rateLimitPlugin);
    await fastify.register(mockDependenciesPlugin);
    await fastify.register(portalPlugin);
    await fastify.ready();
  });

  it('returns 200 with a first-page preview that expires in about 15 minutes', async () => {
    mockDocumentsService.getPublishedDocumentDetail.mockResolvedValue(DETAIL);

    const response = await fastify.inject({
      method: 'GET',
      url: `/public/documents/${DOCUMENT_ID}`,
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const expiresAt = body.data.firstPagePreview.expiresAt;
    const deltaMs = new Date(expiresAt).getTime() - Date.now();
    expect(Number.isNaN(new Date(expiresAt).getTime())).toBe(false);
    expect(deltaMs).toBeGreaterThanOrEqual(14 * 60 * 1000);
    expect(deltaMs).toBeLessThanOrEqual(16 * 60 * 1000);
    expect(presignFirstPage).toHaveBeenCalledWith(DOCUMENT_ID);
  });

  it('returns 404 with the documented not-found body when the service returns null', async () => {
    mockDocumentsService.getPublishedDocumentDetail.mockResolvedValue(null);

    const response = await fastify.inject({
      method: 'GET',
      url: `/public/documents/${DOCUMENT_ID}`,
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Document not found or not yet available on the public portal.',
    });
  });

  it('returns 429 on the 121st request from the same IP', async () => {
    mockDocumentsService.getPublishedDocumentDetail.mockResolvedValue(DETAIL);

    let finalResponse: any;

    for (let attempt = 1; attempt <= 121; attempt += 1) {
      finalResponse = await fastify.inject({
        method: 'GET',
        url: `/public/documents/${DOCUMENT_ID}`,
        headers: { 'x-forwarded-for': '203.0.113.10' },
      });
    }

    expect(finalResponse.statusCode).toBe(429);
    expect(finalResponse.headers['retry-after']).toBeDefined();
    expect(mockDocumentsService.getPublishedDocumentDetail).toHaveBeenCalledTimes(120);
  });
});
