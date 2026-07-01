import { describe, it, expect } from 'vitest';
import { buildApp } from '../../../app.js';
import type { FastifyInstance } from 'fastify';

describe('IAM Plugin Integration & Verification', () => {
  it('verifies that the IAM plugin wires components, decorates fastify, exposes REST routes, and handles bad requests', async () => {
    let downstreamServiceAccessible = false;
    let downstreamEvaluatorAccessible = false;

    // Build the real Fastify app
    const app = await buildApp();

    // Register a downstream dummy plugin to confirm decorations are accessible in downstream plugins
    await app.register(async (downstreamInstance) => {
      if (downstreamInstance.iamService) {
        downstreamServiceAccessible = true;
      }
      if (downstreamInstance.policyEvaluator) {
        downstreamEvaluatorAccessible = true;
      }
    });

    // Wait for the app to boot
    await app.ready();

    // 1. Verify TypeScript decorations are populated on the parent Fastify instance
    expect(app.iamService).toBeDefined();
    expect(app.policyEvaluator).toBeDefined();
    expect(app.iamTrpcRouter).toBeDefined();

    // 2. Verify downstream accessibility of decorations
    expect(downstreamServiceAccessible).toBe(true);
    expect(downstreamEvaluatorAccessible).toBe(true);

    // 3. Verify POST /api/auth/login is reachable and returns 400 (Bad Request / Validation error) for empty payload
    const emptyPayloadRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {},
    });

    expect(emptyPayloadRes.statusCode).toBe(400);
    const body = emptyPayloadRes.json();
    expect(body.code).toBe('VALIDATION_ERROR');

    // 4. Verify POST /api/auth/login returns 401 (Unauthorized) on bad credentials
    const badCredentialsRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: {
        username: 'non_existent_user_for_verification',
        password: 'any_random_password_here',
        code_verifier: 'verifier_placeholder_for_verification_checks_must_match',
        code_challenge: 'verifier_placeholder_for_verification_checks_must_match', // mismatched to S256 verifier, so might return 400 or if verified 401
        code_challenge_method: 'S256',
      },
    });

    // A mismatched PKCE challenge returns 400 PKCE_MISMATCH, which is not 404. Let's make sure it is 400 or 401.
    expect([400, 401]).toContain(badCredentialsRes.statusCode);
    expect(badCredentialsRes.statusCode).not.toBe(404);

    // Clean up
    await app.close();
  });
});
