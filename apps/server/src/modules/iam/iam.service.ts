import { randomUUID, createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import type {
  IamService,
  IamServiceDeps,
  IamRepository,
  RoleAssignmentRow,
  UserRow,
  SessionRow,
} from './iam.types.js';
import { RoleCombinationForbiddenError } from './iam.errors.js';
import { NotFoundError } from '../../errors/domain/not-found.js';
import { IAM_EVENTS } from './iam.events.js';
import { env } from '../../config/env.js';
import { employees } from '@batac/database/schema/organization.schema.js';
import { users } from '@batac/database/schema/iam.schema.js';
import { eq, and, isNull } from 'drizzle-orm';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Platform-wide city ID used for user lookups. Sourced from CITY_ID env var.
 * Source: TASK-IAM-006 AI Prompt, "Find user" step.
 */
const BATAC_CITY_ID = env.CITY_ID;

/**
 * Access token TTL in seconds. Derived from AUTH_JWT_ACCESS_EXPIRES_IN.
 * The env var is a duration string (e.g. '15m', '900s', '3600s').
 * We parse it to seconds for Max-Age cookie and expiresAt response fields.
 *
 * [Inference] Parsing logic: if the value ends with 'm' treat as minutes,
 * if 's' treat as seconds, if 'd' treat as days. Default fallback: 900 (15 min).
 * This is a reasonable parsing convention given the env var examples in env.server.ts.
 */
function parseExpiresInSeconds(expiresIn: string): number {
  if (expiresIn.endsWith('m')) return parseInt(expiresIn, 10) * 60;
  if (expiresIn.endsWith('h')) return parseInt(expiresIn, 10) * 3600;
  if (expiresIn.endsWith('d')) return parseInt(expiresIn, 10) * 86400;
  if (expiresIn.endsWith('s')) return parseInt(expiresIn, 10);
  return parseInt(expiresIn, 10) || 900;
}

const JWT_ACCESS_TTL_SECONDS = parseExpiresInSeconds(env.AUTH_JWT_ACCESS_EXPIRES_IN);
const JWT_REFRESH_TTL_SECONDS = 14 * 24 * 3600; // 14 days — spec: Max-Age = 14*24*3600

/**
 * Type codes that participate in the Platform Admin exclusion invariant.
 * A user may never hold both a `platform_admin` role and a `document_processor`
 * role simultaneously. Enforced at two layers:
 *   1. Application layer (this service): pre-INSERT check.
 *   2. Database layer (TASK-IAM-001): trg_enforce_platform_admin_exclusion trigger.
 */
const EXCLUSIVE_TYPE_CODES = new Set(['platform_admin', 'document_processor'] as const);

type ExclusiveTypeCode = 'platform_admin' | 'document_processor';

function conflictingTypeCode(typeCode: ExclusiveTypeCode): ExclusiveTypeCode {
  return typeCode === 'platform_admin' ? 'document_processor' : 'platform_admin';
}

// ─── SHA-256 helpers ──────────────────────────────────────────────────────────

/**
 * Compute SHA-256 of a UTF-8 string and return the digest as a hex string.
 * Used for: PKCE code_challenge verification, session_token_hash, and
 * attempted_identifier_hash in audit events.
 */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Compute SHA-256 of a UTF-8 string and return the digest base64url-encoded
 * (no padding). Used for PKCE S256 code_challenge comparison.
 * RFC 7636 §4.2: code_challenge = BASE64URL(SHA256(ASCII(code_verifier))).
 */
function sha256Base64url(input: string): string {
  return createHash('sha256').update(input, 'ascii').digest('base64url');
}

// ─── Progressive lockout delays ───────────────────────────────────────────────

/**
 * Compute the lockout duration given the new failure count (post-increment).
 * Source: TASK-IAM-006 AI Prompt, "Progressive account lockout delays" table.
 *
 * | login_failure_count after increment | Delay                        |
 * |-------------------------------------|------------------------------|
 * | 1–5                                 | no lockout (null)            |
 * | 6                                   | 30 seconds                   |
 * | 7                                   | 60 seconds                   |
 * | 8                                   | 2 minutes (120 s)            |
 * | 9                                   | 5 minutes (300 s)            |
 * | 10+                                 | 15 minutes (900 s)           |
 */
function computeLockoutUntil(newFailureCount: number): Date | null {
  let delaySec: number | null = null;
  if (newFailureCount === 6) delaySec = 30;
  else if (newFailureCount === 7) delaySec = 60;
  else if (newFailureCount === 8) delaySec = 120;
  else if (newFailureCount === 9) delaySec = 300;
  else if (newFailureCount >= 10) delaySec = 900;

  if (delaySec === null) return null;
  return new Date(Date.now() + delaySec * 1000);
}

// ─── User projection ──────────────────────────────────────────────────────────

/**
 * Return a safe public view of a UserRow, excluding credential fields.
 * Matches what the frontend useSessionStore expects (ADR-UI-012 / F2 §5).
 */
function toUserSelectSchema(user: UserRow): {
  id: string;
  username: string;
  email: string;
  cityId: string;
  status: string;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    cityId: user.cityId,
    status: user.status,
    mfaEnabled: user.mfaEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ─── Service factory ──────────────────────────────────────────────────────────

export function createIamService(deps: IamServiceDeps): IamService {
  const { db, iamRepository: iamRepo, auditService, eventBus } = deps;

  // Org-context resolvers — optional deps defaulting to Phase-1 no-ops.
  // The ORG module's Step 2 pass wires the real implementations via iam.plugin.ts
  // (TASK-IAM-014) without modifying this file.
  // Source: TASK-IAM-006 AI Prompt "Org-context resolver design" [RESOLVED].
  const getPrimaryOffice = deps.getPrimaryOffice ?? (async () => null);
  const getCommitteeIds = deps.getCommitteeIds ?? (async () => []);
  const resolveActiveDelegationGrantDep = deps.resolveActiveDelegationGrant ?? (async () => null);

  // ─── buildAccessTokenClaims ─────────────────────────────────────────────────
  /**
   * Build the structured claim set for a new access token.
   *
   * Shared by login (TASK-IAM-006), refresh (TASK-IAM-007), and unlock's
   * silent-refresh path (TASK-IAM-011) — all three call this helper so that
   * oid/cid/dg are always resolved identically and can never drift.
   *
   * Takes `userId` (not a full UserRow) deliberately: TASK-IAM-007 only has
   * `row.user_id` at the point it needs this helper and must not make an extra
   * `findUserById` call just to satisfy a wider signature.
   *
   * Source: TASK-IAM-006 AI Prompt, step 9 of the login flow.
   */
  async function buildAccessTokenClaims(userId: string, sessionId: string) {
    const activeRoles = await iamRepo.findActiveRoleAssignmentsByUserId(userId);
    const roleCodes = activeRoles.map((ra) => ra.role.code);

    const [office, committeeIds] = await Promise.all([
      getPrimaryOffice(userId),
      getCommitteeIds(userId),
    ]);

    return {
      registered: {
        iss: 'batac-lgu-platform',
        sub: userId,
        jti: randomUUID(),
      },
      private: {
        uid: userId,
        oid: office?.officeId ?? null,
        rid: roleCodes,
        perm: [], // Resolved dynamically in middleware to prevent cookie bloat
        cid: committeeIds,
        dg: null, // login always starts dg null; picked up at next refresh if active
        city: BATAC_CITY_ID,
        sid: sessionId,
        is_ita: activeRoles.some((ra) => ra.role.code === 'sys_admin'),
        is_pa: activeRoles.some((ra) => (ra.role as any).is_platform_admin === true),
      },
      display: {
        roleCodes,
        officeScopeId: office?.officeId ?? null,
        officeCode: office?.officeCode ?? null,
        committeeIds,
      },
    };
  }

  /**
   * Create a password-reset token row and build the reset URL for a given user.
   * Does not emit any event — callers are responsible for emitting whichever
   * event fits their context (PASSWORD_RESET_TOKEN_GENERATED for a standalone
   * admin-triggered reset link; USER_CREATED already covers the account-creation
   * case, so createUserAccount does not additionally emit
   * PASSWORD_RESET_TOKEN_GENERATED for the token it generates as part of setup).
   *
   * Accepts a repo parameter so it can be called with either the outer iamRepo
   * (standalone generatePasswordResetToken) or a transaction-scoped repo
   * (createUserAccount, so the token row commits atomically with the new user
   * and credential rows).
   *
   * Source: TASK-IAM-052, extracted from generatePasswordResetToken to allow
   * createUserAccount to reuse the same token-generation logic atomically.
   */
  async function createResetTokenAndUrl(
    repo: IamRepository,
    input: { userId: string; cityId: string },
  ): Promise<{ resetUrl: string }> {
    const rawBytes = randomBytes(32);
    const saltBytes = randomBytes(16);
    const rawBase64url = rawBytes.toString('base64url');
    const saltBase64url = saltBytes.toString('base64url');
    const tokenHash = sha256Hex(rawBase64url + saltBase64url);

    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

    const token = await repo.createPasswordResetToken({
      userId: input.userId,
      cityId: input.cityId,
      tokenHash,
      salt: saltBase64url,
      expiresAt,
    });

    const baseUrl = env.APP_URL ? env.APP_URL.replace(/\/$/, '') : '';
    const resetUrl = `${baseUrl}/reset-password?token=${token.id}.${rawBase64url}`;

    return { resetUrl };
  }

  return {
    evaluatePolicy: () => {
      throw new Error('not implemented');
    },
    getUserById: async (id: string) => {
      const u = await iamRepo.findUserById(id);
      if (!u) return null;
      return {
        userId: u.id,
        displayName: u.username,
        email: u.email,
        officeId: null,
        positionTitle: null,
      };
    },
    getUsersByRole: async (roleCode: string) => {
      const rows = await iamRepo.findUsersByRoleCode(BATAC_CITY_ID, roleCode);
      return rows.map((u) => ({
        userId: u.id,
        displayName: u.username,
        email: u.email,
        officeId: null,
        positionTitle: null,
      }));
    },
    // ─── logout ──────────────────────────────────────────────────────────────
    async logout(sessionId: string, userId: string): Promise<void> {
      await db.transaction(async (tx) => {
        const { createIamRepository } = await import('./iam.repository.js');
        const txRepo = createIamRepository(tx);

        const session = await txRepo.findSessionById(sessionId);
        if (!session || !session.active) {
          return; // Idempotent: already inactive or not found
        }

        await txRepo.terminateSession(sessionId, 'logout', userId);
        await txRepo.revokeRefreshTokensBySessionId(sessionId, 'logout');

        // Note: out-of-transaction best-effort write, just like login.
        void eventBus.emit(IAM_EVENTS.LOGOUT_SUCCESS, {
          eventId: randomUUID(),
          eventType: IAM_EVENTS.LOGOUT_SUCCESS,
          occurredAt: new Date().toISOString(),
          cityId: BATAC_CITY_ID,
          schemaVersion: 1,
          payload: {
            user_id: userId,
            session_id: sessionId,
          },
        });
      });
    },

    verifyAccessToken: () => {
      throw new Error('not implemented');
    },
    resolveActiveDelegationGrant: (id) => resolveActiveDelegationGrantDep(id ?? ''),

    // ─── login ───────────────────────────────────────────────────────────────

    /**
     * POST /api/auth/login — full authentication flow.
     *
     * Steps (abort on first failure):
     *  1. PKCE S256 verification
     *  2. User lookup by username (BATAC_CITY_ID scope)
     *  3. Status check (inactive/deactivated → 401)
     *  4. Lockout check (locked_until in the future → 429)
     *  5. Argon2id password verification
     *  6. MFA hook (Phase 1 no-op)
     *  7. Concurrent-session enforcement (single DB transaction)
     *  8. JWT issuance (RS256 or HS256 per AUTH_JWT_ALGORITHM)
     *  9. Refresh-token issuance
     * 10. Lockout counter reset
     * 11. Audit event: login_success
     *
     * The caller (iam.routes.ts) is responsible for setting the two Set-Cookie
     * headers and returning the 200 response with the body from this return value.
     *
     * Source: TASK-IAM-006 AI Prompt, "Login flow" section.
     */
    async login(input) {
      const { username, password, code_verifier, code_challenge, ipAddress, userAgent } = input;

      // ── Step 2: PKCE S256 verification ────────────────────────────────────
      // (Rate limiting is enforced at the Fastify route level via @fastify/rate-limit)
      // RFC 7636 §4.6: server recomputes SHA-256(code_verifier) and base64url-encodes
      // it, then compares to the code_challenge submitted by the client.
      const expectedChallenge = sha256Base64url(code_verifier);
      if (expectedChallenge !== code_challenge) {
        throw Object.assign(new Error('PKCE code_verifier does not match code_challenge'), {
          code: 'PKCE_MISMATCH',
          statusCode: 400,
        });
      }

      // ── Step 3: Find user ─────────────────────────────────────────────────
      const user = await iamRepo.findUserByUsername(BATAC_CITY_ID, username);
      if (!user) {
        throw Object.assign(new Error('Invalid credentials'), {
          code: 'INVALID_CREDENTIALS',
          statusCode: 401,
        });
      }

      // ── Step 4: Status check ──────────────────────────────────────────────
      if (user.status === 'inactive' || user.status === 'deactivated') {
        throw Object.assign(new Error('Invalid credentials'), {
          code: 'INVALID_CREDENTIALS',
          statusCode: 401,
        });
      }

      // ── Step 5: Lockout check ─────────────────────────────────────────────
      if (user.loginLockedUntil !== null && new Date() < user.loginLockedUntil) {
        const retryAfterSec = Math.ceil((user.loginLockedUntil.getTime() - Date.now()) / 1000);
        throw Object.assign(new Error('Account temporarily locked'), {
          code: 'ACCOUNT_LOCKED',
          statusCode: 429,
          retryAfter: retryAfterSec,
        });
      }

      // ── Step 6: Password verification ────────────────────────────────────
      const credential = await iamRepo.findCredentialByUserId(user.id);
      if (!credential) {
        // No credential record — treat as wrong password
        await eventBus.emit(IAM_EVENTS.LOGIN_FAILED, {
          eventId: randomUUID(),
          eventType: IAM_EVENTS.LOGIN_FAILED,
          occurredAt: new Date().toISOString(),
          cityId: BATAC_CITY_ID,
          schemaVersion: 1,
          payload: {
            attempted_identifier_hash: sha256Hex(username),
            ip_address: ipAddress,
            user_agent: userAgent,
            failure_reason: 'no_credential',
          },
        });
        throw Object.assign(new Error('Invalid credentials'), {
          code: 'INVALID_CREDENTIALS',
          statusCode: 401,
        });
      }

      let passwordValid: boolean;
      try {
        passwordValid = await argon2.verify(credential.passwordHash, password);
      } catch {
        // argon2.verify can throw on malformed hashes — treat as mismatch
        passwordValid = false;
      }

      if (!passwordValid) {
        // Increment failure count and compute new lockout deadline
        const newCount = (user.loginFailureCount ?? 0) + 1;
        const lockedUntil = computeLockoutUntil(newCount);
        await iamRepo.updateLoginFailure(user.id, newCount, lockedUntil);

        await eventBus.emit(IAM_EVENTS.LOGIN_FAILED, {
          eventId: randomUUID(),
          eventType: IAM_EVENTS.LOGIN_FAILED,
          occurredAt: new Date().toISOString(),
          cityId: BATAC_CITY_ID,
          schemaVersion: 1,
          payload: {
            attempted_identifier_hash: sha256Hex(username),
            ip_address: ipAddress,
            user_agent: userAgent,
            failure_reason: 'wrong_password',
          },
        });

        throw Object.assign(new Error('Invalid credentials'), {
          code: 'INVALID_CREDENTIALS',
          statusCode: 401,
        });
      }

      // ── Step 7: MFA hook (Phase 1 no-op) ─────────────────────────────────
      // Per spec: all users fall through in Phase 1; MFA enforcement is Phase 2.
      // Source: TASK-IAM-006 AI Prompt, step 7.

      // ── Step 8: Concurrent-session enforcement (single DB transaction) ────
      // a. Find existing active session; if found, terminate it + revoke its
      //    refresh tokens, emit session_replaced event.
      // b. INSERT new iam.sessions row.
      // c. Commit. Capture new session id.
      let newSessionId!: string;

      await db.transaction(async (tx) => {
        // Set the context for RLS so INSERT ... RETURNING succeeds
        const { sql } = await import('drizzle-orm');
        await tx.execute(sql`SELECT set_config('app.current_user_id', ${user.id}, true)`);

        // We need a transactional repo so all ops within this block are atomic.
        // createIamRepository accepts a DbTransaction directly.
        const { createIamRepository } = await import('./iam.repository.js');
        const txRepo = createIamRepository(tx);

        // a. Find existing active session
        const oldSession = await txRepo.findActiveSessionByUserId(user.id);

        if (oldSession) {
          // Terminate old session
          await txRepo.terminateSession(oldSession.id, 'replaced', null);
          // Revoke old session's refresh tokens
          await txRepo.revokeRefreshTokensBySessionId(oldSession.id, 'replaced');
          // Emit session_replaced audit event (fire-and-forget; best-effort)
          // We use a placeholder for new_session_id because the new session doesn't
          // exist yet. The new session id is appended after INSERT below.
          // [Inference] We defer the audit call to after the INSERT so we can pass
          // the real new_session_id. This does not break atomicity — the audit write
          // is on the separate auditService (audit DB), which is independent of the
          // IAM transaction. If the IAM tx fails the session_replaced event may not
          // be written, which is acceptable (event is informational, not authoritative).
        }

        // b. INSERT new session with a placeholder token hash; we will UPDATE it
        //    after building the JWT jti. Use an empty placeholder so NOT NULL is
        //    satisfied; updated in step 9 once jti is known.
        const newSession = await txRepo.createSession({
          userId: user.id,
          sessionTokenHash: `pending_${randomUUID()}`, // overwritten in step 9
          ipAddress,
          userAgent,
          cityId: BATAC_CITY_ID,
        });
        newSessionId = newSession.id;

        if (oldSession) {
          // Now emit session_replaced with the real new session id.
          // Out-of-transaction best-effort write.
          void eventBus.emit(IAM_EVENTS.SESSION_REPLACED, {
            eventId: randomUUID(),
            eventType: IAM_EVENTS.SESSION_REPLACED,
            occurredAt: new Date().toISOString(),
            cityId: BATAC_CITY_ID,
            schemaVersion: 1,
            payload: {
              user_id: user.id,
              old_session_id: oldSession.id,
              new_session_id: newSessionId,
              new_ip_address: ipAddress,
            },
          });
        }
      });

      // ── Step 9: Build claims and issue JWT ───────────────────────────────
      const claims = await buildAccessTokenClaims(user.id, newSessionId);

      const jwtPayload = { ...claims.registered, ...claims.private };
      const accessToken = jwt.sign(jwtPayload, env.AUTH_JWT_ACCESS_SECRET, {
        algorithm: env.AUTH_JWT_ALGORITHM as jwt.Algorithm,
        expiresIn: JWT_ACCESS_TTL_SECONDS,
      });

      // Update session_token_hash to SHA-256(jti) now that jti is known.
      const jti = claims.registered.jti;
      const sessionTokenHash = sha256Hex(jti);
      
      // Best-effort UPDATE — wrapped in a transaction strictly to pass RLS policy.
      await db.transaction(async (tx) => {
        const { sql, eq } = await import('drizzle-orm');
        await tx.execute(sql`SELECT set_config('app.current_user_id', ${user.id}, true)`);
        
        const { createIamRepository } = await import('./iam.repository.js');
        const txRepo = createIamRepository(tx);
        await txRepo.updateLastActivity(newSessionId);
        
        const { sessions } = await import('@batac/database/schema/iam.schema.js');
        await tx.update(sessions).set({ sessionTokenHash }).where(eq(sessions.id, newSessionId));
      });

      // ── Step 10: Issue refresh token ──────────────────────────────────────
      // raw = crypto.randomBytes(32) → base64url
      // salt = crypto.randomBytes(16) → base64url
      // token_hash = SHA256(raw + salt)
      // Cookie value: `${token_id}.${raw}`
      const rawBytes = randomBytes(32);
      const saltBytes = randomBytes(16);
      const rawBase64url = rawBytes.toString('base64url');
      const saltBase64url = saltBytes.toString('base64url');
      const tokenHash = sha256Hex(rawBase64url + saltBase64url);
      const tokenId = randomUUID();
      const familyId = randomUUID();
      const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL_SECONDS * 1000);

      await iamRepo.createRefreshToken({
        id: tokenId,
        userId: user.id,
        sessionId: newSessionId,
        tokenHash,
        salt: saltBase64url,
        familyId,
        expiresAt,
        cityId: BATAC_CITY_ID,
      } as any);

      // ── Step 11: Reset lockout counter ────────────────────────────────────
      await iamRepo.resetLoginFailure(user.id);

      // ── Step 12: Audit event: login_success ───────────────────────────────
      await eventBus.emit(IAM_EVENTS.LOGIN_SUCCESS, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.LOGIN_SUCCESS,
        occurredAt: new Date().toISOString(),
        cityId: BATAC_CITY_ID,
        schemaVersion: 1,
        payload: {
          user_id: user.id,
          session_id: newSessionId,
          ip_address: ipAddress,
          user_agent: userAgent,
        },
      });

      // ── Step 13: Return tokens and body data ──────────────────────────────
      // The route handler reads these and:
      //   - Sets batac_at cookie (value = accessToken)
      //   - Sets batac_rt cookie (value = `${tokenId}.${rawBase64url}`)
      //   - Returns 200 JSON body matching AuthResponseSchema
      // We surface the refresh token cookie value as a property so the route
      // handler can set the cookie without knowing the cookie assembly logic.
      const loginResult = {
        user: toUserSelectSchema(user) as unknown as UserRow,
        sessionId: newSessionId,
        expiresAt: new Date(Date.now() + JWT_ACCESS_TTL_SECONDS * 1000),
        roleCodes: claims.display.roleCodes,
        officeScopeId: claims.display.officeScopeId,
        officeCode: claims.display.officeCode,
        committeeIds: claims.display.committeeIds,
        // Private: used by route handler to set cookies; NOT part of AuthResponse body
        _cookies: {
          accessToken,
          refreshTokenCookieValue: `${tokenId}.${rawBase64url}`,
          accessMaxAge: JWT_ACCESS_TTL_SECONDS,
          refreshMaxAge: JWT_REFRESH_TTL_SECONDS,
        },
      };

      return loginResult;
    },

    // ─── refresh ──────────────────────────────────────────────────────────────

    /**
     * POST /api/auth/refresh
     * Rotate the refresh token and issue a new access token JWT.
     * Prevents reuse by revoking the entire token family if a used token is presented.
     *
     * Source: TASK-IAM-007.
     */
    async listAllUsers(cityId: string) {
      const db = deps.db;
      
      const query = db
        .select({
          id: users.id,
          username: users.username,
          email: users.email,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(users)
        .leftJoin(employees, eq(users.id, employees.userId))
        .where(
          and(
            eq(users.cityId, cityId),
            isNull(users.deletedAt)
          )
        )
        .orderBy(users.username);
        
      const rows = await query;
      
      return rows.map((r) => ({
        id: r.id,
        username: r.username,
        email: r.email,
        displayName: r.firstName && r.lastName ? `${r.firstName} ${r.lastName}` : r.username,
      }));
    },

    async refresh(refreshTokenValue: string, ipAddress: string | null, userAgent: string | null) {
      // 1. Parse token
      const parts = refreshTokenValue.split('.');
      if (parts.length !== 2) {
        throw Object.assign(new Error('Invalid refresh token format'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }
      const [tokenId, rawBase64url] = parts;
      if (!tokenId || !rawBase64url) {
        throw Object.assign(new Error('Invalid refresh token format'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }

      // 2. Lookup by ID
      const tokenRow = await iamRepo.findRefreshTokenById(tokenId);
      if (!tokenRow) {
        throw Object.assign(new Error('Invalid refresh token'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }

      // 3. Verify Hash
      const computedHash = sha256Hex(rawBase64url + tokenRow.salt);
      if (computedHash !== tokenRow.tokenHash) {
        throw Object.assign(new Error('Invalid refresh token signature'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }

      // 4. Reuse Detection
      if (tokenRow.usedAt !== null) {
        await db.transaction(async (tx) => {
          const { createIamRepository } = await import('./iam.repository.js');
          const txRepo = createIamRepository(tx);
          await txRepo.revokeRefreshTokenFamily(tokenRow.familyId, 'reuse_detected');
          const session = await txRepo.findSessionById(tokenRow.sessionId);
          if (session && session.active) {
            await txRepo.terminateSession(session.id, 'forced', null);
          }
        });

        void eventBus.emit(IAM_EVENTS.TOKEN_REUSE_DETECTED, {
          eventId: randomUUID(),
          eventType: IAM_EVENTS.TOKEN_REUSE_DETECTED,
          occurredAt: new Date().toISOString(),
          cityId: BATAC_CITY_ID,
          schemaVersion: 1,
          payload: {
            user_id: tokenRow.userId,
            family_id: tokenRow.familyId,
            ip_address: ipAddress,
            action_taken: 'session_terminated_and_family_revoked',
          },
        });

        throw Object.assign(new Error('Session security event detected'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }

      // 5. Validity Checks
      if (tokenRow.revokedAt !== null) {
        throw Object.assign(new Error('Refresh token has been revoked'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }
      if (tokenRow.expiresAt < new Date()) {
        throw Object.assign(new Error('Refresh token has expired'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }

      // 6. Check User/Session
      const session = await iamRepo.findSessionById(tokenRow.sessionId);
      if (!session || !session.active) {
        throw Object.assign(new Error('Session is inactive or terminated'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }
      const user = await iamRepo.findUserById(tokenRow.userId);
      if (!user || user.status === 'inactive' || user.status === 'deactivated') {
        throw Object.assign(new Error('User account is inactive'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }

      // 7. Token Rotation Transaction
      let newRawBase64url = '';
      let newTokenId = '';

      await db.transaction(async (tx) => {
        const { createIamRepository } = await import('./iam.repository.js');
        const txRepo = createIamRepository(tx);

        const rawBytes = randomBytes(32);
        const saltBytes = randomBytes(16);
        newRawBase64url = rawBytes.toString('base64url');
        const saltBase64url = saltBytes.toString('base64url');
        const tokenHash = sha256Hex(newRawBase64url + saltBase64url);
        newTokenId = randomUUID();
        const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL_SECONDS * 1000);

        // Insert the new token FIRST so the replaced_by FK constraint
        // (refresh_tokens_replaced_by_refresh_tokens_id_fk) is satisfied
        // before we try to point the old token at it.
        await txRepo.createRefreshToken({
          id: newTokenId,
          userId: user.id,
          sessionId: session.id,
          tokenHash,
          salt: saltBase64url,
          familyId: tokenRow.familyId,
          expiresAt,
          cityId: BATAC_CITY_ID,
        } as any);

        const wasMarkedUsed = await txRepo.markRefreshTokenUsed(tokenId, newTokenId);
        if (!wasMarkedUsed) {
          // Another concurrent request already marked this token as used
          // between this request's step-4 reuse check and this rotation
          // step. Treat identically to the step-4 reuse-detection branch:
          // this is the same observable fact (a used token was presented)
          // discovered at a different point in the flow.
          await txRepo.revokeRefreshTokenFamily(tokenRow.familyId, 'reuse_detected');
          const raceSession = await txRepo.findSessionById(tokenRow.sessionId);
          if (raceSession && raceSession.active) {
            await txRepo.terminateSession(raceSession.id, 'forced', null);
          }
          // Note: audit event intentionally omitted from this branch.
          // Add follow-up audit write here if coverage for this race path is needed.
          throw Object.assign(new Error('Session security event detected'), {
            code: 'UNAUTHORIZED',
            statusCode: 401,
          });
        }

        await txRepo.updateLastActivity(session.id);
      });

      // 8. Build claims and issue JWT
      const newClaims = await buildAccessTokenClaims(user.id, session.id);
      const jwtPayload = { ...newClaims.registered, ...newClaims.private };
      const newAccessToken = jwt.sign(jwtPayload, env.AUTH_JWT_ACCESS_SECRET, {
        algorithm: env.AUTH_JWT_ALGORITHM as jwt.Algorithm,
        expiresIn: JWT_ACCESS_TTL_SECONDS,
      });

      // Update session_token_hash best-effort
      const jti = newClaims.registered.jti;
      const sessionTokenHash = sha256Hex(jti);
      const { sessions } = await import('@batac/database/schema/iam.schema.js');
      const { eq } = await import('drizzle-orm');
      const { sql } = await import('drizzle-orm');
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_user_id', ${session.userId}, true)`);
        await tx.update(sessions).set({ sessionTokenHash }).where(eq(sessions.id, session.id));
      });

      const refreshResult = {
        user: toUserSelectSchema(user) as unknown as UserRow,
        sessionId: session.id,
        expiresAt: new Date(Date.now() + JWT_ACCESS_TTL_SECONDS * 1000),
        roleCodes: newClaims.display.roleCodes,
        officeScopeId: newClaims.display.officeScopeId,
        officeCode: newClaims.display.officeCode,
        committeeIds: newClaims.display.committeeIds,
        _cookies: {
          accessToken: newAccessToken,
          refreshTokenCookieValue: `${newTokenId}.${newRawBase64url}`,
          accessMaxAge: JWT_ACCESS_TTL_SECONDS,
          refreshMaxAge: JWT_REFRESH_TTL_SECONDS,
        },
      };

      return refreshResult;
    },

    // ─── assignRole ───────────────────────────────────────────────────────────

    /**
     * Assign a role to a user.
     *
     * @remarks
     * Role changes take effect on the **next token refresh** (next POST /api/auth/refresh),
     * not immediately. If instant permission enforcement is required, use the
     * force-terminate session functionality implemented in TASK-IAM-010.
     */
    async assignRole(input: {
      actorId: string;
      targetUserId: string;
      roleId: string;
      officeScopeId: string | null;
    }): Promise<RoleAssignmentRow> {
      const { actorId, targetUserId, roleId, officeScopeId } = input;

      // ── Step 1: Load incoming role ─────────────────────────────────────────
      const incomingRole = await iamRepo.findRoleById(roleId);
      if (!incomingRole) {
        throw new NotFoundError('Role', roleId);
      }

      // ── Step 2: Platform Admin exclusion check (BEFORE any INSERT) ─────────
      if (EXCLUSIVE_TYPE_CODES.has(incomingRole.typeCode as ExclusiveTypeCode)) {
        const conflictType = conflictingTypeCode(incomingRole.typeCode as ExclusiveTypeCode);
        const existingConflict = await iamRepo.findConflictingTypeCodeForUser(
          targetUserId,
          conflictType,
        );
        if (existingConflict) {
          throw new RoleCombinationForbiddenError({
            incomingRoleType: incomingRole.typeCode,
            conflictingRoleType: conflictType,
            userId: targetUserId,
          });
        }
      }

      // ── Step 3: Load target user (needed for cityId on the event envelope) ─
      const targetUser = await iamRepo.findUserById(targetUserId);
      if (!targetUser) {
        throw new NotFoundError('User', targetUserId);
      }

      // ── Step 4: Create the assignment ──────────────────────────────────────
      let assignment: RoleAssignmentRow;
      try {
        assignment = await iamRepo.createRoleAssignment({
          userId: targetUserId,
          roleId,
          assignedBy: actorId,
          officeScopeId,
          cityId: targetUser.cityId,
        });
      } catch (err: unknown) {
        // Surface DB trigger violations (e.g. race-condition bypass) as 500.
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('enforce_platform_admin_exclusion') ||
          message.includes('role_combination')
        ) {
          throw new Error(
            'Role assignment constraint violated at database layer — possible race condition',
          );
        }
        throw err;
      }

      // ── Step 5: Emit role.assigned domain event ───────────────────────────
      eventBus.emit(IAM_EVENTS.ROLE_ASSIGNED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.ROLE_ASSIGNED,
        occurredAt: new Date().toISOString(),
        cityId: targetUser.cityId,
        schemaVersion: 1,
        payload: {
          actorId,
          targetUserId,
          roleId,
          roleName: incomingRole.name,
        },
      });

      return assignment;
    },

    // ─── revokeRole ───────────────────────────────────────────────────────────

    /**
     * Revoke an active role assignment from a user.
     *
     * @remarks
     * Role changes take effect on the **next token refresh** (next POST /api/auth/refresh),
     * not immediately. If instant permission enforcement is required, use the
     * force-terminate session functionality implemented in TASK-IAM-010.
     */
    async revokeRole(input: {
      actorId: string;
      targetUserId: string;
      roleAssignmentId: string;
      reason: string;
    }): Promise<void> {
      const { actorId, targetUserId, roleAssignmentId, reason } = input;

      // ── Step 1: Load the assignment ────────────────────────────────────────
      const assignments = await iamRepo.findAssignmentsByUserId(targetUserId);
      const assignment = assignments.find((a) => a.id === roleAssignmentId);

      if (!assignment) {
        throw new NotFoundError('RoleAssignment', roleAssignmentId);
      }

      // Idempotent: already revoked — return without re-emitting an event.
      if (!assignment.isActive) {
        return;
      }

      // ── Step 2: Revoke the assignment ──────────────────────────────────────
      await iamRepo.revokeRoleAssignment(roleAssignmentId, actorId);

      // ── Step 3: Load role name for audit ──────────────────────────────────
      const role = await iamRepo.findRoleById(assignment.roleId);
      const roleName = role?.name ?? assignment.roleId;

      // ── Step 4: Load target user for cityId ───────────────────────────────
      const targetUser = await iamRepo.findUserById(targetUserId);
      const cityId = targetUser?.cityId ?? '';

      // ── Step 5: Emit role.revoked domain event ────────────────────────────
      eventBus.emit(IAM_EVENTS.ROLE_REVOKED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.ROLE_REVOKED,
        occurredAt: new Date().toISOString(),
        cityId,
        schemaVersion: 1,
        payload: {
          actorId,
          targetUserId,
          roleId: assignment.roleId,
          roleName,
          reason,
        },
      });
    },

    // ─── forceTerminateSession ────────────────────────────────────────────────

    /**
     * Forcibly terminate another user's session (IT Admin only).
     *
     * Steps:
     *  1. Load target session. Not found → NotFoundError (404 at route).
     *  2. Already inactive → return { terminated: true } (idempotent).
     *  3. In a transaction: terminateSession('forced', actorId) +
     *     revokeRefreshTokensBySessionId('forced').
     *  4. Emit forced_logout audit event (fire-and-forget, outside transaction).
     *  5. Return { terminated: true }.
     *
     * ABAC (IT Admin gate) is enforced by the route handler BEFORE this call.
     * This method performs no ABAC check of its own.
     *
     * Source: TASK-IAM-010 AI Prompt.
     */
    async forceTerminateSession(input: {
      actorId: string;
      targetSessionId: string;
      reason: string;
      cityId: string;
    }): Promise<{ terminated: boolean }> {
      const { actorId, targetSessionId, reason, cityId } = input;

      // Step 1: Load target session (outside transaction — early exit on 404/idempotent)
      const session = await iamRepo.findSessionById(targetSessionId);
      if (!session) {
        throw new NotFoundError('Session', targetSessionId);
      }

      // Step 2: Idempotent — session already terminated, no side effects
      if (!session.active) {
        return { terminated: true };
      }

      // Step 3: Atomically terminate session and revoke all associated refresh tokens
      await db.transaction(async (tx) => {
        const { createIamRepository } = await import('./iam.repository.js');
        const txRepo = createIamRepository(tx);

        await txRepo.terminateSession(targetSessionId, 'forced', actorId);
        await txRepo.revokeRefreshTokensBySessionId(targetSessionId, 'forced');
      });

      // Step 4: Emit forced_logout audit event — fire-and-forget, outside transaction.
      // Pattern matches logout() — best-effort; failure here does not roll back session.
      void eventBus.emit(IAM_EVENTS.FORCED_LOGOUT, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.FORCED_LOGOUT,
        occurredAt: new Date().toISOString(),
        cityId,
        schemaVersion: 1,
        payload: {
          actor_id: actorId,
          target_user_id: session.userId,
          target_session_id: targetSessionId,
          reason,
        },
      });

      return { terminated: true };
    },

    async updateOwnProfile(input: {
      userId: string;
      displayName?: string;
      phoneNumber?: string;
    }): Promise<UserRow> {
      const user = await iamRepo.findUserById(input.userId);
      if (!user) throw new NotFoundError('User', input.userId);
      return user;
    },

    async changeOwnPassword(input: {
      userId: string;
      currentPassword: string;
      newPassword: string;
    }): Promise<void> {
      const cred = await iamRepo.findCredentialByUserId(input.userId);
      if (!cred) throw new Error('UNAUTHORIZED');

      const isValid = await argon2.verify(cred.passwordHash, input.currentPassword);
      if (!isValid) throw new Error('UNAUTHORIZED');

      const newHash = await argon2.hash(input.newPassword, {
        memoryCost: env.ARGON2_MEMORY_COST ?? 65536,
        timeCost: env.ARGON2_TIME_COST ?? 3,
        parallelism: env.ARGON2_PARALLELISM ?? 4,
        hashLength: env.ARGON2_HASH_LENGTH ?? 32,
      });

      await iamRepo.updateCredentialHash(input.userId, newHash);

      const user = await iamRepo.findUserById(input.userId);
      eventBus.emit(IAM_EVENTS.PASSWORD_CHANGED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.PASSWORD_CHANGED,
        occurredAt: new Date().toISOString(),
        cityId: user?.cityId || BATAC_CITY_ID,
        schemaVersion: 1,
        payload: {
          actorId: input.userId,
          userId: input.userId,
        },
      });
    },

    async listSessionsByUserId(userId: string): Promise<SessionRow[]> {
      return iamRepo.listSessionsByUserId(userId);
    },

    async listAllActiveSessions(
      cityId: string,
      opts: { limit: number; offset: number },
    ): Promise<SessionRow[]> {
      return iamRepo.listAllActiveSessions(cityId, opts);
    },

    async lockSession(input: { sessionId: string; userId: string }): Promise<{ locked: boolean }> {
      const { sessionId, userId } = input;
      await iamRepo.setSessionLocked(sessionId, new Date());

      void eventBus.emit(IAM_EVENTS.SESSION_LOCKED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.SESSION_LOCKED,
        occurredAt: new Date().toISOString(),
        cityId: BATAC_CITY_ID,
        schemaVersion: 1,
        payload: {
          user_id: userId,
          session_id: sessionId,
        },
      });
      return { locked: true };
    },

    async unlockSession(input: {
      sessionId: string;
      userId: string;
      passwordPlain: string;
      isAccessTokenExpired: boolean;
      ipAddress: string | null;
      userAgent: string | null;
    }) {
      const { sessionId, userId, passwordPlain, isAccessTokenExpired, ipAddress, userAgent } =
        input;

      const session = await iamRepo.findSessionById(sessionId);
      if (!session || !session.active) {
        throw Object.assign(new Error('Session is inactive or terminated'), {
          code: 'UNAUTHORIZED',
          statusCode: 401,
        });
      }

      if (session.locked_at === null) {
        return { unlocked: true };
      }

      const credential = await iamRepo.findCredentialByUserId(userId);
      if (!credential) {
        throw Object.assign(new Error('Invalid password'), {
          code: 'INVALID_PASSWORD',
          statusCode: 401,
        });
      }

      let passwordValid = false;
      try {
        passwordValid = await argon2.verify(credential.passwordHash, passwordPlain);
      } catch {
        passwordValid = false;
      }

      if (!passwordValid) {
        throw Object.assign(new Error('Invalid password'), {
          code: 'INVALID_PASSWORD',
          statusCode: 401,
        });
      }

      await iamRepo.setSessionLocked(sessionId, null);

      let cookies;
      if (isAccessTokenExpired) {
        const latestRt = await iamRepo.findLatestActiveRefreshTokenForSession(sessionId);
        if (!latestRt || latestRt.expiresAt < new Date() || latestRt.revokedAt !== null) {
          throw Object.assign(new Error('Your session has expired. Please log in again.'), {
            code: 'REFRESH_REQUIRED',
            statusCode: 401,
          });
        }

        let newRawBase64url = '';
        let newTokenId = '';

        await db.transaction(async (tx) => {
          const { createIamRepository } = await import('./iam.repository.js');
          const txRepo = createIamRepository(tx);

          const rawBytes = randomBytes(32);
          const saltBytes = randomBytes(16);
          newRawBase64url = rawBytes.toString('base64url');
          const saltBase64url = saltBytes.toString('base64url');
          const tokenHash = sha256Hex(newRawBase64url + saltBase64url);
          newTokenId = randomUUID();
          const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL_SECONDS * 1000);

          const wasMarkedUsed = await txRepo.markRefreshTokenUsed(latestRt.id, newTokenId);
          if (!wasMarkedUsed) {
            // Same rationale as the equivalent guard in refresh() — see
            // that method for the full explanation.
            await txRepo.revokeRefreshTokenFamily(latestRt.familyId, 'reuse_detected');
            const raceSession = await txRepo.findSessionById(sessionId);
            if (raceSession && raceSession.active) {
              await txRepo.terminateSession(raceSession.id, 'forced', null);
            }
            // Note: audit event intentionally omitted from this branch.
            // Add follow-up audit write here if coverage for this race path is needed.
            throw Object.assign(new Error('Session security event detected'), {
              code: 'UNAUTHORIZED',
              statusCode: 401,
            });
          }

          await txRepo.createRefreshToken({
            id: newTokenId,
            userId: userId,
            sessionId: sessionId,
            tokenHash,
            salt: saltBase64url,
            familyId: latestRt.familyId,
            expiresAt,
            cityId: BATAC_CITY_ID,
          } as any);

          await txRepo.updateLastActivity(sessionId);
        });

        const newClaims = await buildAccessTokenClaims(userId, sessionId);
        const jwtPayload = { ...newClaims.registered, ...newClaims.private };
        const newAccessToken = jwt.sign(jwtPayload, env.AUTH_JWT_ACCESS_SECRET, {
          algorithm: env.AUTH_JWT_ALGORITHM as jwt.Algorithm,
          expiresIn: JWT_ACCESS_TTL_SECONDS,
        });

        const jti = newClaims.registered.jti;
        const sessionTokenHash = sha256Hex(jti);
        const { sessions } = await import('@batac/database/schema/iam.schema.js');
        const { eq } = await import('drizzle-orm');
        const { sql } = await import('drizzle-orm');
        await db.transaction(async (tx) => {
          await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
          await tx.update(sessions).set({ sessionTokenHash }).where(eq(sessions.id, sessionId));
        });

        cookies = {
          accessToken: newAccessToken,
          refreshTokenCookieValue: `${newTokenId}.${newRawBase64url}`,
          accessMaxAge: JWT_ACCESS_TTL_SECONDS,
          refreshMaxAge: JWT_REFRESH_TTL_SECONDS,
        };
      } else {
        await iamRepo.updateLastActivity(sessionId);
      }

      void eventBus.emit(IAM_EVENTS.SESSION_UNLOCKED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.SESSION_UNLOCKED,
        occurredAt: new Date().toISOString(),
        cityId: BATAC_CITY_ID,
        schemaVersion: 1,
        payload: {
          user_id: userId,
          session_id: sessionId,
        },
      });

      return {
        unlocked: true,
        ...(cookies ? { _cookies: cookies } : {}),
      };
    },

    async listUserDirectory(
      cityId: string,
      opts: { limit: number; offset: number; officeId?: string; search?: string },
    ): Promise<UserRow[]> {
      return iamRepo.listUsers(cityId, opts);
    },

    async createUserAccount(input: {
      username: string;
      email: string;
      employeeId: string;
      cityId: string;
      actorId: string;
    }): Promise<UserRow & { resetUrl: string }> {
      const { user, resetUrl } = await db.transaction(async (tx) => {
        const { createIamRepository } = await import('./iam.repository.js');
        const txRepo = createIamRepository(tx);

        const createdUser = await txRepo.createUser({
          username: input.username,
          email: input.email,
          cityId: input.cityId,
          status: 'active',
        });

        const tempHash = await argon2.hash(randomBytes(32).toString('hex'));
        await txRepo.createCredential(createdUser.id, tempHash);

        const { resetUrl: generatedResetUrl } = await createResetTokenAndUrl(txRepo, {
          userId: createdUser.id,
          cityId: input.cityId,
        });

        return { user: createdUser, resetUrl: generatedResetUrl };
      });

      eventBus.emit(IAM_EVENTS.USER_CREATED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.USER_CREATED,
        occurredAt: new Date().toISOString(),
        cityId: input.cityId,
        schemaVersion: 1,
        payload: {
          actorId: input.actorId,
          newUserId: user.id,
        },
      });

      return { ...user, resetUrl };
    },

    async generatePasswordResetToken(input: {
      userId: string;
      actorId: string;
      cityId: string;
    }): Promise<{ resetUrl: string }> {
      const { resetUrl } = await createResetTokenAndUrl(iamRepo, {
        userId: input.userId,
        cityId: input.cityId,
      });

      eventBus.emit(IAM_EVENTS.PASSWORD_RESET_TOKEN_GENERATED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.PASSWORD_RESET_TOKEN_GENERATED,
        occurredAt: new Date().toISOString(),
        cityId: input.cityId,
        schemaVersion: 1,
        payload: {
          actorId: input.actorId,
          targetUserId: input.userId,
        },
      });

      return { resetUrl };
    },

    async redeemPasswordResetToken(input: {
      tokenId: string;
      rawToken: string;
      newPassword: string;
    }): Promise<void> {
      const storedRow = await iamRepo.findPasswordResetTokenById(input.tokenId);
      if (!storedRow) {
        throw new NotFoundError('PasswordResetToken', input.tokenId);
      }

      if (storedRow.usedAt !== null) {
        throw Object.assign(new Error('Password reset link has already been used'), {
          code: 'RESET_TOKEN_USED',
          statusCode: 400,
        });
      }

      if (storedRow.expiresAt < new Date()) {
        throw Object.assign(new Error('Password reset link has expired'), {
          code: 'RESET_TOKEN_EXPIRED',
          statusCode: 400,
        });
      }

      const computedHash = sha256Hex(input.rawToken + storedRow.salt);
      if (computedHash !== storedRow.tokenHash) {
        throw new NotFoundError('PasswordResetToken', input.tokenId);
      }

      const newHash = await argon2.hash(input.newPassword);
      await iamRepo.updateCredentialHash(storedRow.userId, newHash);
      await iamRepo.markPasswordResetTokenUsed(input.tokenId);

      eventBus.emit(IAM_EVENTS.PASSWORD_RESET_COMPLETED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.PASSWORD_RESET_COMPLETED,
        occurredAt: new Date().toISOString(),
        cityId: storedRow.cityId,
        schemaVersion: 1,
        payload: {
          actorId: storedRow.userId,
          targetUserId: storedRow.userId,
        },
      });
    },

    async updateUserAccount(input: {
      userId: string;
      email?: string;
      status?: string;
      officeId?: string;
    }): Promise<UserRow> {
      const user = await iamRepo.updateUser(input.userId, {
        email: input.email,
        status: input.status,
      });
      return user;
    },

    async deactivateUserAccount(userId: string, actorId: string): Promise<void> {
      await iamRepo.updateUser(userId, { status: 'deactivated' });
    },

    async reactivateUserAccount(userId: string, actorId: string): Promise<void> {
      await iamRepo.updateUser(userId, { status: 'active' });
    },

    async registerCitizenAccountClerkAssisted(input: {
      fullName: string;
      birthdate: Date;
      phone: string;
      email: string;
      idType: string;
      idReference?: string;
      actorId: string;
    }): Promise<{ citizenUserId: string }> {
      return { citizenUserId: randomUUID() };
    },
  };
}
