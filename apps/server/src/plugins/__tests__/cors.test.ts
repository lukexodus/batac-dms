import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import corsPlugin from '../cors.js';
import portalPlugin from '../../modules/portal/portal.plugin.js';

vi.mock('../../modules/portal/lib/presign-first-page.js', () => ({
  presignFirstPage: vi.fn(async () => null),
}));

import { presignFirstPage } from '../../modules/portal/lib/presign-first-page.js';

const mockDocumentsService = {
  listPublishedDocuments: vi.fn(),
  getPublishedDocumentDetail: vi.fn(),
};

const mockDependenciesPlugin = fp(async (fastify) => {
  fastify.decorate('documentsService', mockDocumentsService);
  fastify.decorate('config', { CITY_ID: 'batac-city' });
});

describe('public REST CORS', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
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

    fastify = Fastify({ logger: false });
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
    await fastify.register(corsPlugin);
    await fastify.register(mockDependenciesPlugin);
    await fastify.register(
      async (portalApp) => {
        await portalApp.register(portalPlugin);
      },
      { prefix: '/v1' },
    );
    await fastify.ready();
  });

  it('echoes an allowed portal origin on a versioned public REST route', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/public/documents',
      headers: { origin: 'https://portal.batac.gov.ph' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('https://portal.batac.gov.ph');
    expect(presignFirstPage).not.toHaveBeenCalled();
  });

  it('does not echo an unlisted origin', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/v1/public/documents',
      headers: { origin: 'https://evil.example.com' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).not.toBe('https://evil.example.com');
  });
});
