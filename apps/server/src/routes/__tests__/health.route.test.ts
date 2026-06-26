/**
 * Fastify Liveness Health Check Route Unit Test
 * Created as a bootstrap test for TASK-INFRA-011.
 * Can be updated by succeeding tasks.
 */

import { vi, describe, it, expect } from 'vitest';
import fastify from 'fastify';

// Mock the environment config module to prevent unsafeParse process.exit calls
vi.mock('../../config/env', () => ({
  env: {
    HEALTH_CHECK_PATH: '/health-check-test',
    APP_VERSION: '1.0.0-test',
  },
}));

import { registerHealthRoute } from '../health.route';

describe('health route liveness probe', () => {
  it('registers route at the configured path and returns HTTP 200 with required keys', async () => {
    const app = fastify();

    await registerHealthRoute(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health-check-test',
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body).toEqual({
      status: 'ok',
      version: '1.0.0-test',
      uptime: expect.any(Number),
    });
    
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });
});
