/**
 * IAM — Auth preHandler Middleware Chain
 *
 * Implements the four-hook authenticated-request lifecycle described in
 * B5 §10.1 and TASK-IAM-005.
 *
 * Hook 1 — verifyAccessToken
 *   Extracts and verifies the JWT from the access-token cookie,
 *   checks that the session is active and not expired/locked,
 *   and populates `request.auth` from the verified claims.
 *
 * Hook 2 — loadDelegationContext
 *   If `request.auth.delegationGrantId` is non-null, resolves the active
 *   delegation grant via `fastify.iamService.resolveActiveDelegationGrant`
 *   and expands `effectiveOfficeIds` / `effectiveRoles` accordingly.
 *   Uses an injected resolver that defaults to a Phase-1 no-op (returns null)
 *   until the ORG module wires the real implementation.
 *   Source: TASK-IAM-005 Hook 2 note; B5 §5.7.
 *
 * Hook 3 — setDatabaseSessionVars
 *   Sets PostgreSQL session-local variables used by RLS policies.
 *   `app.current_office_id` is set to SQL NULL (not the string "null")
 *   when `request.auth.officeId` is null — see TASK-IAM-005 Hook 3 note.
 *
 * Hook 4 — updateLastActivity
 *   Updates `iam.sessions.last_activity_at` to NOW() for the current session.
 *
 * The plugin is registered on PROTECTED-route scopes only.
 * Public auth endpoints (login, refresh, portal) MUST NOT register this plugin.
 *
 * Source: B5 §10.1 [Inference]; TASK-IAM-005 spec.
 */

import fp from 'fastify-plugin';
import jwt from 'jsonwebtoken';
import { sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthContext } from './iam.types.js';
import { env } from '../../config/env.js';

// ─── Inactivity Timeout ──────────────────────────────────────────────────────

/**
 * Maximum session inactivity in milliseconds before the session is
 * considered expired. Sourced from AUTH_SESSION_INACTIVITY_TIMEOUT_MS env var
 * (default: 1800000 ms = 30 minutes). Source: B5 §4.4; TASK-IAM-005 Hook 1.
 */
const INACTIVITY_TIMEOUT_MS = env.AUTH_SESSION_INACTIVITY_TIMEOUT_MS;

// ─── Cookie helpers ──────────────────────────────────────────────────────────

/**
 * Clear both auth cookies by setting Max-Age=0.
 * Called when a session is terminated due to inactivity.
 * Source: TASK-IAM-005 Hook 1 step 5.
 */
function clearAuthCookies(reply: FastifyReply): void {
  const base = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  const secure = env.AUTH_COOKIE_SECURE ? '; Secure' : '';
  reply.header('Set-Cookie', [
    `${env.AUTH_ACCESS_TOKEN_COOKIE_NAME}=; ${base}${secure}`,
    `${env.AUTH_REFRESH_TOKEN_COOKIE_NAME}=; Path=/api/auth/refresh; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`,
  ]);
}

// ─── JWT claim shape ─────────────────────────────────────────────────────────

/**
 * Shape of the private claims embedded in the access token.
 * Source: B5 §1.1 JWT Payload — Private Claims.
 */
interface JwtPrivateClaims {
  uid:    string;
  oid:    string | null;
  rid:    string[];
  perm:   string[];
  cid:    string[];
  dg:     string | null;
  city:   string;
  sid:    string;
  is_ita: boolean;
  is_pa:  boolean;
}

// ─── JWT verification ────────────────────────────────────────────────────────

/**
 * Verify a JWT access token and return the decoded private claims.
 * Supports HS256 (using AUTH_JWT_ACCESS_SECRET as a shared secret) and
 * RS256/ES256 (using AUTH_JWT_ACCESS_SECRET as a PEM-encoded key string).
 * Throws a jsonwebtoken error on failure (invalid signature, expiry, etc.).
 *
 * Source: B5 §1.1; TASK-IAM-005 Hook 1 steps 1–2; env.server.ts AUTH_JWT_*.
 */
function verifyJwt(token: string): JwtPrivateClaims {
  const secret = env.AUTH_JWT_ACCESS_SECRET;
  const algorithm = env.AUTH_JWT_ALGORITHM as jwt.Algorithm;

  const decoded = jwt.verify(token, secret, {
    algorithms: [algorithm],
  }) as jwt.JwtPayload;

  return {
    uid:    String(decoded['uid'] ?? ''),
    oid:    (decoded['oid'] ?? null) as string | null,
    rid:    Array.isArray(decoded['rid']) ? (decoded['rid'] as string[]) : [],
    perm:   Array.isArray(decoded['perm']) ? (decoded['perm'] as string[]) : [],
    cid:    Array.isArray(decoded['cid']) ? (decoded['cid'] as string[]) : [],
    dg:     (decoded['dg'] ?? null) as string | null,
    city:   String(decoded['city'] ?? ''),
    sid:    String(decoded['sid'] ?? ''),
    is_ita: Boolean(decoded['is_ita']),
    is_pa:  Boolean(decoded['is_pa']),
  };
}

// ─── Hook 1 — verifyAccessToken ──────────────────────────────────────────────

/**
 * Hook 1: verifyAccessToken
 *
 * 1. Extracts the access-token cookie (name from AUTH_ACCESS_TOKEN_COOKIE_NAME).
 *    Absent → 401.
 * 2. Verifies the JWT signature and expiry. Invalid/expired → 401.
 * 3. Loads the session from iam.sessions WHERE id = claims.sid AND active = true.
 *    Not found or active=false → 401.
 * 4. If session.locked_at IS NOT NULL AND url ≠ /api/auth/unlock → 423 Locked.
 * 5. Inactivity check: if NOW() - session.last_activity_at > INACTIVITY_TIMEOUT_MS →
 *    terminate session, revoke refresh tokens, clear cookies, return 401.
 * 6. Populates `request.auth` from the verified JWT claims.
 *
 * Source: B5 §10.1 Hook 1; TASK-IAM-005 Hook 1.
 */
async function verifyAccessToken(
  this: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Step 1 — extract cookie
  const cookieName = env.AUTH_ACCESS_TOKEN_COOKIE_NAME;
  const rawCookie = request.headers.cookie ?? '';
  const tokenMatch = rawCookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`));

  if (!tokenMatch) {
    return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Missing access token' });
  }

  const token = tokenMatch.slice(cookieName.length + 1);

  // Step 2 — verify JWT
  let claims: JwtPrivateClaims;
  try {
    claims = verifyJwt(token);
  } catch {
    return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Invalid or expired access token' });
  }

  // Step 3 — load session
  const session = await this.iamRepository.findSessionById(claims.sid);
  if (!session || !session.active) {
    return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Session not found or inactive' });
  }

  // Step 4 — locked session check
  // Exclude /api/auth/unlock so the unlock endpoint can bypass this check.
  // Source: TASK-IAM-005 Hook 1 step 4; B5 §4.6.
  if (session.locked_at !== null && request.url !== '/api/auth/unlock') {
    return reply.code(423).send({ code: 'SESSION_LOCKED', message: 'Session is locked' });
  }

  // Step 5 — inactivity check
  const idleMs = Date.now() - session.lastActivityAt.getTime();

  if (idleMs > INACTIVITY_TIMEOUT_MS) {
    // Terminate session (best-effort)
    try {
      await this.iamRepository.terminateSession(claims.sid, 'inactivity', null);
    } catch {
      // Non-fatal — still reject the request
    }

    // Revoke all refresh tokens for this session (best-effort)
    try {
      await this.iamRepository.revokeRefreshTokensBySessionId(claims.sid, 'logout');
    } catch {
      // Non-fatal
    }

    clearAuthCookies(reply);
    return reply.code(401).send({ code: 'SESSION_EXPIRED', reason: 'inactivity' });
  }

  // Step 6 — populate request.auth
  // effectiveOfficeIds starts from the primary officeId; Hook 2 expands it
  // if a delegation grant is active. null officeId is filtered out so that
  // effectiveOfficeIds is always string[] (never contains null).
  // Source: TASK-IAM-005 Hook 2 note on effectiveOfficeIds type safety.
  const auth: AuthContext = {
    userId:             claims.uid,
    sessionId:          claims.sid,
    officeId:           claims.oid,
    cityId:             claims.city,
    roles:              claims.rid,
    permissions:        claims.perm,
    committeeIds:       claims.cid,
    delegationGrantId:  claims.dg,
    effectiveOfficeIds: claims.oid !== null ? [claims.oid] : [],
    effectiveRoles:     [...claims.rid],
    isItAdmin:          claims.is_ita,
    isPlatformAdmin:    claims.is_pa,
  };

  request.auth = auth;
}

// ─── Hook 2 — loadDelegationContext ─────────────────────────────────────────

/**
 * Hook 2: loadDelegationContext
 *
 * If `request.auth.delegationGrantId` is non-null, resolves the active
 * delegation grant via `fastify.iamService.resolveActiveDelegationGrant`.
 * That method internally filters out rows that are not found, expired, or revoked.
 *
 * On a valid grant, merges the grant scope into the auth context:
 *   effectiveOfficeIds = [officeId (if non-null), ...grant.scope.officeIds]
 *   effectiveRoles     = [...roles, ...grant.scope.roles]
 *
 * `effectiveOfficeIds` is always `string[]` (never contains null). If the
 * user's primary `officeId` is null it is filtered out rather than letting
 * a null flow into ABAC office-membership checks.
 *
 * The `resolveActiveDelegationGrant` method is declared on `IamService` and
 * backed by an injected resolver in `IamServiceDeps`, defaulting to a Phase-1
 * no-op (returns null) until the ORG module wires the real implementation.
 * Direct SQL on `organization.delegation_grants` is explicitly prohibited here —
 * see B2 §Enforcement Mechanisms (Law #2: no cross-module schema access).
 *
 * Source: B5 §5.7; TASK-IAM-005 Hook 2; TASK-IAM-006 IamServiceDeps note.
 */
async function loadDelegationContext(
  this: FastifyInstance,
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const auth = request.auth;
  if (!auth?.delegationGrantId) {
    // No delegation active — nothing to expand
    return;
  }

  const grant = await this.iamService.resolveActiveDelegationGrant(auth.delegationGrantId);

  if (!grant) {
    // Grant not found, expired, or revoked — clear the delegation claim so
    // downstream ABAC evaluators don't attempt to use a stale grant ID.
    auth.delegationGrantId = null;
    return;
  }

  // Expand effective scope with delegation grant
  auth.effectiveOfficeIds = [
    auth.officeId,
    ...grant.scope.officeIds,
  ].filter((id): id is string => id !== null);

  auth.effectiveRoles = [...auth.roles, ...grant.scope.roles];
}

// ─── Hook 3 — setDatabaseSessionVars ─────────────────────────────────────────

/**
 * Hook 3: setDatabaseSessionVars
 *
 * Sets PostgreSQL session-local GUC variables used by RLS policies.
 * All variables use the `is_local=true` flag on set_config, which provides
 * SET LOCAL semantics — they are cleared automatically when the transaction ends.
 *
 * IMPORTANT — null officeId handling:
 * When `request.auth.officeId` is null, `set_config('app.current_office_id', NULL, true)`
 * sets the GUC to SQL NULL rather than the 3-character string 'null'. Any
 * RLS policy that compares `current_setting('app.current_office_id')::uuid`
 * against a document's `office_id` column evaluates to NULL (excluded row)
 * rather than throwing `invalid input syntax for type uuid`. This is the
 * correct fail-closed behavior for a user with no resolved office.
 * Source: TASK-IAM-005 Hook 3 note; LOG-0010.
 *
 * `app.current_role_tier` derivation:
 *   'IT_ADMIN'       if isItAdmin
 *   'SECURITY_ADMIN' if roles includes 'auditor'
 *   'STANDARD'       otherwise
 * Source: TASK-IAM-005 Hook 3.
 */
async function setDatabaseSessionVars(
  this: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const auth = request.auth;
  if (!auth) {
    // Guard: should not reach here on a protected route — Hook 1 would have
    // rejected the request. Included for defense-in-depth.
    return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Missing auth context' });
  }

  const roleTier = auth.isItAdmin
    ? 'IT_ADMIN'
    : auth.roles.includes('auditor')
      ? 'SECURITY_ADMIN'
      : 'STANDARD';

  // set_config(name, value, is_local). is_local=true → SET LOCAL semantics.
  // Passing null as value sets the GUC to SQL NULL — not the string 'null'.
  await this.db.execute(sql`
    SELECT
      set_config('app.current_user_id',   ${auth.userId},   true),
      set_config('app.current_office_id', ${auth.officeId}, true),
      set_config('app.city_id',           ${auth.cityId},   true),
      set_config('app.current_role_tier', ${roleTier},      true),
      set_config('app.is_ita',            ${String(auth.isItAdmin)},      true),
      set_config('app.is_pa',             ${String(auth.isPlatformAdmin)}, true)
  `);
}

// ─── Hook 4 — updateLastActivity ─────────────────────────────────────────────

/**
 * Hook 4: updateLastActivity
 *
 * Updates `iam.sessions.last_activity_at` to NOW() for the current session.
 * This is a simple UPDATE acceptable on every authenticated request.
 * Source: B5 §10.1 Hook 4; TASK-IAM-005 Hook 4.
 */
async function updateLastActivity(
  this: FastifyInstance,
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const auth = request.auth;
  if (!auth) return; // Guard — Hook 1 already enforced auth presence.

  await this.iamRepository.updateLastActivity(auth.sessionId);
}

// ─── Plugin export ────────────────────────────────────────────────────────────

/**
 * Fastify plugin that registers the four preHandler hooks for authenticated routes.
 *
 * Register this plugin on PROTECTED-route scopes only. Public endpoints
 * (POST /api/auth/login, POST /api/auth/refresh, public portal endpoints)
 * must NOT register this plugin.
 *
 * Source: B5 §10.1; TASK-IAM-005 Export section.
 */
export const authMiddlewarePlugin = fp(
  async function authMiddlewarePluginFn(fastify: FastifyInstance): Promise<void> {
    fastify.addHook('preHandler', verifyAccessToken);
    fastify.addHook('preHandler', loadDelegationContext);
    fastify.addHook('preHandler', setDatabaseSessionVars);
    fastify.addHook('preHandler', updateLastActivity);
  },
  { name: 'auth-middleware', dependencies: ['iam'] },
);
