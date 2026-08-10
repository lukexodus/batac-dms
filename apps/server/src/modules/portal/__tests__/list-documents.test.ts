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

const LIST_ITEM = {
  documentId: '123e4567-e89b-12d3-a456-426614174000',
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
};

describe('GET /public/documents', () => {
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

  it('returns 200 with default pagination when no query params are provided', async () => {
    mockDocumentsService.listPublishedDocuments.mockResolvedValue({
      data: [LIST_ITEM],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/public/documents',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(20);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].firstPagePreview).toMatchObject({
      url: 'https://s3.example.com/presigned-first-page.jpg',
    });
    expect(presignFirstPage).toHaveBeenCalledWith(LIST_ITEM.documentId);
  });

  it('returns 400 when limit exceeds the schema maximum', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/public/documents?limit=500',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    expect(response.statusCode).toBe(400);
    expect(mockDocumentsService.listPublishedDocuments).not.toHaveBeenCalled();
  });

  it('passes parsed document filters to the service', async () => {
    mockDocumentsService.listPublishedDocuments.mockResolvedValue({
      data: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/public/documents?documentType=SP_ORDINANCE&year=2026',
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockDocumentsService.listPublishedDocuments).toHaveBeenCalledWith({
      documentType: 'SP_ORDINANCE',
      year: 2026,
      page: 1,
      limit: 20,
    });
  });

  it('returns 429 on the 121st request from the same IP', async () => {
    mockDocumentsService.listPublishedDocuments.mockResolvedValue({
      data: [LIST_ITEM],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      },
    });

    let finalResponse: any;

    for (let attempt = 1; attempt <= 121; attempt += 1) {
      finalResponse = await fastify.inject({
        method: 'GET',
        url: '/public/documents',
        headers: { 'x-forwarded-for': '203.0.113.10' },
      });
    }

    expect(finalResponse.statusCode).toBe(429);
    expect(finalResponse.headers['retry-after']).toBeDefined();
    expect(mockDocumentsService.listPublishedDocuments).toHaveBeenCalledTimes(120);
  });
});
