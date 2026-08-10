import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import rateLimitPlugin from '../../../plugins/rate-limit.js';
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

describe('POST /public/complaints', () => {
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

  it('returns 201 with reference code and printable form for digital_form', async () => {
    mockDocumentsService.createPublicSubmission.mockResolvedValue({
      documentId: '123e4567-e89b-12d3-a456-426614174000',
      referenceCode: 'COMP-2026-0001',
      submittedAt: '2026-08-09T00:00:00Z',
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/public/complaints',
      payload: {
        violationType: 'overcharging',
        tricycleNumber: 'BTC-1234',
        incidentDate: '2026-06-10',
        incidentTime: '14:30',
        place: 'Public Market to Barangay 1, Batac City',
        remarks: 'Driver charged PHP 50 for a route with a regulated fare of PHP 15.',
        complainantName: 'Juan Dela Cruz',
        complainantAddress: 'Barangay 5, Batac City, Ilocos Norte',
        complainantContact: '09171234567',
        complainantEmail: 'juan.delacruz@email.com',
        accessMode: 'digital_form',
      },
    });

    const body = response.json();
    console.log('Test 1 body:', body);
    expect(response.statusCode).toBe(201);
    expect(body.data.status).toBe('pending_hearing');
    expect(body.data.status).toBe('pending_hearing');
    expect(body.data.referenceCode).toMatch(/^COMP-\d{4}-\d{4}$/);
    expect(body.data.printableFormUrl).toBe('https://s3.example.com/presigned-pdf-url');
    expect(generatePrintableForm).toHaveBeenCalled();
  });

  it('returns 201 with null printable form for clerk_assisted', async () => {
    mockDocumentsService.createPublicSubmission.mockResolvedValue({
      documentId: '123e4567-e89b-12d3-a456-426614174000',
      referenceCode: 'COMP-2026-0002',
      submittedAt: '2026-08-09T00:00:00Z',
    });

    const response = await fastify.inject({
      method: 'POST',
      url: '/public/complaints',
      payload: {
        violationType: 'overcharging',
        incidentDate: '2026-06-10',
        incidentTime: '14:30',
        place: 'Public Market',
        complainantName: 'Juan Dela Cruz',
        complainantAddress: 'Batac City',
        complainantContact: '09171234567',
        accessMode: 'clerk_assisted',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.printableFormUrl).toBeNull();
    expect(generatePrintableForm).not.toHaveBeenCalled();
  });

  it('returns 400 for violationType: other missing violationTypeOther', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/public/complaints',
      payload: {
        violationType: 'other',
        incidentDate: '2026-06-10',
        incidentTime: '14:30',
        place: 'Public Market',
        complainantName: 'Juan Dela Cruz',
        complainantAddress: 'Batac City',
        complainantContact: '09171234567',
        accessMode: 'digital_form',
      },
    });

    const body = response.json();
    console.log('Test 3 body:', body);
    expect(response.statusCode).toBe(400);
    expect(body.message).toContain('Required when violationType is \'other\'');
  });

  it('returns 400 for invalid incidentTime format', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/public/complaints',
      payload: {
        violationType: 'overcharging',
        incidentDate: '2026-06-10',
        incidentTime: '2:30 PM', // invalid format
        place: 'Public Market',
        complainantName: 'Juan Dela Cruz',
        complainantAddress: 'Batac City',
        complainantContact: '09171234567',
        accessMode: 'digital_form',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('Must be in 24-hour HH:MM format');
  });

  it('returns 429 on the 21st complaint submission from the same IP', async () => {
    mockDocumentsService.createPublicSubmission.mockResolvedValue({
      documentId: '123e4567-e89b-12d3-a456-426614174000',
      referenceCode: 'COMP-2026-0003',
      submittedAt: '2026-08-09T00:00:00Z',
    });

    const requestHeaders = { 'x-forwarded-for': '203.0.113.10' };
    let finalResponse;

    for (let attempt = 1; attempt <= 21; attempt += 1) {
      finalResponse = await fastify.inject({
        method: 'POST',
        url: '/public/complaints',
        headers: requestHeaders,
        payload: {
          violationType: 'overcharging',
          incidentDate: '2026-06-10',
          incidentTime: '14:30',
          place: 'Public Market',
          complainantName: 'Juan Dela Cruz',
          complainantAddress: 'Batac City',
          complainantContact: '09171234567',
          accessMode: 'clerk_assisted',
        },
      });
    }

    expect(finalResponse?.statusCode).toBe(429);
    expect(finalResponse?.headers['retry-after']).toBeDefined();
    expect(mockDocumentsService.createPublicSubmission).toHaveBeenCalledTimes(20);
  });
});
