/**
 * IAM route registration — POST /api/auth/login
 *
 * This is a PUBLIC route (no auth preHandlers). Rate limited to 5 req / 15 min
 * per IP via @fastify/rate-limit, registered at the route level.
 *
 * Cookie specification:
 *   batac_at: HttpOnly; Secure; SameSite=Strict; Path=/;              Max-Age=JWT_ACCESS_TTL_SECONDS
 *   batac_rt: HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=14*24*3600
 *
 * Response body matches AuthResponseSchema (tokens are NEVER in the body).
 *
 * Source: TASK-IAM-006 deliverables — iam.routes.ts.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { LoginInputSchema } from './iam.schemas.js';
import { authMiddlewarePlugin, clearAuthCookies } from './iam.middleware.js';

/** Access-token TTL in seconds — parsed from AUTH_JWT_ACCESS_EXPIRES_IN. */
function parseExpiresInSeconds(expiresIn: string): number {
  if (expiresIn.endsWith('m')) return parseInt(expiresIn, 10) * 60;
  if (expiresIn.endsWith('h')) return parseInt(expiresIn, 10) * 3600;
  if (expiresIn.endsWith('d')) return parseInt(expiresIn, 10) * 86400;
  if (expiresIn.endsWith('s')) return parseInt(expiresIn, 10);
  return parseInt(expiresIn, 10) || 900;
}

const JWT_ACCESS_TTL_SECONDS = parseExpiresInSeconds(env.AUTH_JWT_ACCESS_EXPIRES_IN);
const REFRESH_TTL_SECONDS    = 14 * 24 * 3600;

/**
 * Assemble a Set-Cookie header string without relying on `@fastify/cookie`.
 * Produces a single string value suitable for `reply.header('Set-Cookie', [v1, v2])`.
 */
function buildCookieHeader(
  name:    string,
  value:   string,
  options: {
    maxAge:   number;
    path:     string;
    secure:   boolean;
    sameSite: string;
  },
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    'HttpOnly',
    `SameSite=${options.sameSite}`,
  ];
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

export async function registerIamRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /api/auth/login
   *
   * Public route — no auth preHandlers.
   * Rate limit: 5 requests per 15 minutes per IP (RATE_AUTH_MAX / RATE_AUTH_WINDOW_MS
   * env vars are used for the global auth rate limiter; see iam.md task spec for the
   * 5 req / 15 min login-specific limit).
   *
   * Source: TASK-IAM-006 deliverables — iam.routes.ts.
   */
  fastify.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: {
          max:      5,
          timeWindow: 15 * 60 * 1000, // 15 minutes in ms
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // ── Parse and validate request body ──────────────────────────────────
      const parseResult = LoginInputSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          code:   'VALIDATION_ERROR',
          errors: parseResult.error.flatten().fieldErrors,
        });
      }

      const body      = parseResult.data;
      const ipAddress = (request.headers['x-forwarded-for'] as string | undefined)
        ?? request.ip
        ?? null;
      const userAgent = request.headers['user-agent'] ?? null;

      // ── Call service.login ────────────────────────────────────────────────
      let result: Awaited<ReturnType<typeof fastify.iamService.login>> & {
        _cookies?: {
          accessToken:              string;
          refreshTokenCookieValue:  string;
          accessMaxAge:             number;
          refreshMaxAge:            number;
        };
      };

      try {
        result = await fastify.iamService.login({
          username:              body.username,
          password:              body.password,
          code_verifier:         body.code_verifier,
          code_challenge:        body.code_challenge,
          code_challenge_method: 'S256',
          ipAddress,
          userAgent,
        }) as typeof result;
      } catch (err: unknown) {
        const e = err as { code?: string; statusCode?: number; retryAfter?: number };

        if (e.statusCode === 400) {
          return reply.status(400).send({ code: e.code ?? 'BAD_REQUEST' });
        }
        if (e.statusCode === 429) {
          if (e.retryAfter !== undefined) {
            reply.header('Retry-After', String(e.retryAfter));
          }
          return reply.status(429).send({ code: e.code ?? 'TOO_MANY_REQUESTS' });
        }
        if (e.statusCode === 401) {
          return reply.status(401).send({ code: 'INVALID_CREDENTIALS' });
        }
        // Unexpected error — rethrow for Fastify's error handler
        throw err;
      }

      // ── Set HTTP-only cookies ─────────────────────────────────────────────
      const cookies = result._cookies;
      if (!cookies) {
        // Should never happen — guard against future refactors
        fastify.log.error('iam.routes: login result missing _cookies property');
        return reply.status(500).send({ code: 'INTERNAL_ERROR' });
      }

      const secure   = env.AUTH_COOKIE_SECURE;
      const sameSite = env.AUTH_COOKIE_SAMESITE;

      const atCookie = buildCookieHeader(
        env.AUTH_ACCESS_TOKEN_COOKIE_NAME,
        cookies.accessToken,
        { maxAge: JWT_ACCESS_TTL_SECONDS, path: '/', secure, sameSite },
      );

      const rtCookie = buildCookieHeader(
        env.AUTH_REFRESH_TOKEN_COOKIE_NAME,
        cookies.refreshTokenCookieValue,
        { maxAge: REFRESH_TTL_SECONDS, path: '/api/auth/refresh', secure, sameSite },
      );

      reply.header('Set-Cookie', [atCookie, rtCookie]);

      // ── Return 200 with AuthResponseSchema body ───────────────────────────
      // Tokens are NEVER in this body.
      return reply.status(200).send({
        user:          result.user,
        sessionId:     result.sessionId,
        expiresAt:     result.expiresAt,
        roleCodes:     result.roleCodes,
        officeScopeId: result.officeScopeId,
        officeCode:    result.officeCode,
      });
    },
  );

  // ── Protected Routes ────────────────────────────────────────────────────────
  fastify.register(async (protectedApp) => {
    await protectedApp.register(authMiddlewarePlugin);

    /**
     * POST /api/auth/logout
     *
     * Protected route — requires valid access token.
     * Terminates the session, revokes refresh tokens, clears cookies, and writes audit event.
     * Source: TASK-IAM-008
     */
    protectedApp.post(
      '/api/auth/logout',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const auth = request.auth!;
        await protectedApp.iamService.logout(auth.sessionId, auth.userId);

        clearAuthCookies(reply);

        return reply.status(204).send();
      }
    );
  });
}
