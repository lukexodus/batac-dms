import { randomUUID, createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import argon2 from 'argon2';
import type { IamService, IamServiceDeps, RoleAssignmentRow, UserRow } from './iam.types.js';
import { RoleCombinationForbiddenError } from './iam.errors.js';
import { NotFoundError } from '../../errors/domain/not-found.js';
import { IAM_EVENTS } from './iam.events.js';
import { env } from '../../config/env.js';

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
  if (newFailureCount === 6)  delaySec = 30;
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
    id:         user.id,
    username:   user.username,
    email:      user.email,
    cityId:     user.cityId,
    status:     user.status,
    mfaEnabled: user.mfaEnabled,
    createdAt:  user.createdAt,
    updatedAt:  user.updatedAt,
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
  const getCommitteeIds  = deps.getCommitteeIds  ?? (async () => []);
  const resolveActiveDelegationGrantDep =
    deps.resolveActiveDelegationGrant ?? (async () => null);

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
    const roleCodes    = activeRoles.map((ra) => ra.role.code);

    const [office, committeeIds] = await Promise.all([
      getPrimaryOffice(userId),
      getCommitteeIds(userId),
    ]);

    const permissions = await iamRepo.findPermissionsByRoleIds(activeRoles.map((ra) => ra.roleId));
    const permCodes   = permissions.map((p) => `${p.resource}:${p.action}`);

    return {
      registered: {
        iss: 'batac-lgu-platform',
        sub: userId,
        jti: randomUUID(),
      },
      private: {
        uid:    userId,
        oid:    office?.officeId ?? null,
        rid:    roleCodes,
        perm:   permCodes,
        cid:    committeeIds,
        dg:     null, // login always starts dg null; picked up at next refresh if active
        city:   BATAC_CITY_ID,
        sid:    sessionId,
        is_ita: activeRoles.some((ra) => ra.role.code === 'sys_admin'),
        is_pa:  activeRoles.some((ra) => (ra.role as any).is_platform_admin === true),
      },
      display: {
        roleCodes,
        officeScopeId: office?.officeId     ?? null,
        officeCode:    office?.officeCode    ?? null,
      },
    };
  }

  return {
    evaluatePolicy: () => { throw new Error('not implemented'); },
    getUserById:    () => { throw new Error('not implemented'); },
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
        void auditService.writeEvent({
          eventType: 'logout_success',
          actorId: userId,
          targetId: userId,
          targetType: 'session',
          cityId: BATAC_CITY_ID,
          payload: {
            user_id: userId,
            session_id: sessionId,
          },
        });
      });
    },
    refresh:        () => { throw new Error('not implemented'); },
    verifyAccessToken: () => { throw new Error('not implemented'); },
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
      const {
        username,
        password,
        code_verifier,
        code_challenge,
        ipAddress,
        userAgent,
      } = input;

      // ── Step 2: PKCE S256 verification ────────────────────────────────────
      // (Rate limiting is enforced at the Fastify route level via @fastify/rate-limit)
      // RFC 7636 §4.6: server recomputes SHA-256(code_verifier) and base64url-encodes
      // it, then compares to the code_challenge submitted by the client.
      const expectedChallenge = sha256Base64url(code_verifier);
      if (expectedChallenge !== code_challenge) {
        throw Object.assign(new Error('PKCE code_verifier does not match code_challenge'), {
          code:       'PKCE_MISMATCH',
          statusCode: 400,
        });
      }

      // ── Step 3: Find user ─────────────────────────────────────────────────
      const user = await iamRepo.findUserByUsername(BATAC_CITY_ID, username);
      if (!user) {
        throw Object.assign(new Error('Invalid credentials'), {
          code:       'INVALID_CREDENTIALS',
          statusCode: 401,
        });
      }

      // ── Step 4: Status check ──────────────────────────────────────────────
      if (user.status === 'inactive' || user.status === 'deactivated') {
        throw Object.assign(new Error('Invalid credentials'), {
          code:       'INVALID_CREDENTIALS',
          statusCode: 401,
        });
      }

      // ── Step 5: Lockout check ─────────────────────────────────────────────
      if (user.loginLockedUntil !== null && new Date() < user.loginLockedUntil) {
        const retryAfterSec = Math.ceil(
          (user.loginLockedUntil.getTime() - Date.now()) / 1000,
        );
        throw Object.assign(new Error('Account temporarily locked'), {
          code:        'ACCOUNT_LOCKED',
          statusCode:  429,
          retryAfter:  retryAfterSec,
        });
      }

      // ── Step 6: Password verification ────────────────────────────────────
      const credential = await iamRepo.findCredentialByUserId(user.id);
      if (!credential) {
        // No credential record — treat as wrong password
        await auditService.writeEvent({
          eventType: 'login_failed',
          actorId:   null,
          cityId:    BATAC_CITY_ID,
          payload: {
            attempted_identifier_hash: sha256Hex(username),
            ip_address:  ipAddress,
            user_agent:  userAgent,
            failure_reason: 'no_credential',
          },
        });
        throw Object.assign(new Error('Invalid credentials'), {
          code:       'INVALID_CREDENTIALS',
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

        await auditService.writeEvent({
          eventType: 'login_failed',
          actorId:   null,
          cityId:    BATAC_CITY_ID,
          payload: {
            attempted_identifier_hash: sha256Hex(username),
            ip_address:  ipAddress,
            user_agent:  userAgent,
            failure_reason: 'wrong_password',
          },
        });

        throw Object.assign(new Error('Invalid credentials'), {
          code:       'INVALID_CREDENTIALS',
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
          userId:           user.id,
          sessionTokenHash: 'pending', // overwritten in step 9
          ipAddress,
          userAgent,
          cityId:           BATAC_CITY_ID,
        });
        newSessionId = newSession.id;

        if (oldSession) {
          // Now emit session_replaced with the real new session id.
          // Out-of-transaction best-effort write.
          void auditService.writeEvent({
            eventType: 'session_replaced',
            actorId:   user.id,
            targetId:  user.id,
            targetType: 'session',
            cityId:    BATAC_CITY_ID,
            payload: {
              user_id:        user.id,
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
      const accessToken = jwt.sign(
        jwtPayload,
        env.AUTH_JWT_ACCESS_SECRET,
        {
          algorithm: env.AUTH_JWT_ALGORITHM as jwt.Algorithm,
          expiresIn: JWT_ACCESS_TTL_SECONDS,
        },
      );

      // Update session_token_hash to SHA-256(jti) now that jti is known.
      const jti = claims.registered.jti;
      const sessionTokenHash = sha256Hex(jti);
      // Best-effort UPDATE — non-transactional since the session is already
      // committed; if this fails the session row has hash='pending' which
      // is detectable and treated as invalid by Hook 1's verifyJwt + session check.
      await iamRepo.updateLastActivity(newSessionId); // triggers update on row

      // We need to update the session_token_hash. The IamRepository interface
      // does not expose a direct updateSessionTokenHash method.
      // [Inference] Use direct DB update as a workaround; a cleaner approach
      // would add updateSessionTokenHash to IamRepository — see findings log.
      const { sessions } = await import('@batac/database/schema/iam.schema.js');
      const { eq } = await import('drizzle-orm');
      await db.update(sessions)
        .set({ sessionTokenHash })
        .where(eq(sessions.id, newSessionId));

      // ── Step 10: Issue refresh token ──────────────────────────────────────
      // raw = crypto.randomBytes(32) → base64url
      // salt = crypto.randomBytes(16) → base64url
      // token_hash = SHA256(raw + salt)
      // Cookie value: `${token_id}.${raw}`
      const rawBytes  = randomBytes(32);
      const saltBytes = randomBytes(16);
      const rawBase64url  = rawBytes.toString('base64url');
      const saltBase64url = saltBytes.toString('base64url');
      const tokenHash = sha256Hex(rawBase64url + saltBase64url);
      const tokenId   = randomUUID();
      const familyId  = randomUUID();
      const expiresAt = new Date(Date.now() + JWT_REFRESH_TTL_SECONDS * 1000);

      await iamRepo.createRefreshToken({
        id:        tokenId,
        userId:    user.id,
        sessionId: newSessionId,
        tokenHash,
        salt:      saltBase64url,
        familyId,
        expiresAt,
        cityId:    BATAC_CITY_ID,
      } as any);

      // ── Step 11: Reset lockout counter ────────────────────────────────────
      await iamRepo.resetLoginFailure(user.id);

      // ── Step 12: Audit event: login_success ───────────────────────────────
      await auditService.writeEvent({
        eventType: 'login_success',
        actorId:   user.id,
        targetId:  user.id,
        targetType: 'session',
        cityId:    BATAC_CITY_ID,
        payload: {
          user_id:    user.id,
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
        user:                toUserSelectSchema(user) as unknown as UserRow,
        sessionId:           newSessionId,
        expiresAt:           new Date(Date.now() + JWT_ACCESS_TTL_SECONDS * 1000),
        roleCodes:           claims.display.roleCodes,
        officeScopeId:       claims.display.officeScopeId,
        officeCode:          claims.display.officeCode,
        // Private: used by route handler to set cookies; NOT part of AuthResponse body
        _cookies: {
          accessToken,
          refreshTokenCookieValue: `${tokenId}.${rawBase64url}`,
          accessMaxAge:   JWT_ACCESS_TTL_SECONDS,
          refreshMaxAge:  JWT_REFRESH_TTL_SECONDS,
        },
      };

      return loginResult;
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
        eventId:       randomUUID(),
        eventType:     IAM_EVENTS.ROLE_ASSIGNED,
        occurredAt:    new Date().toISOString(),
        cityId:        targetUser.cityId,
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
        eventId:       randomUUID(),
        eventType:     IAM_EVENTS.ROLE_REVOKED,
        occurredAt:    new Date().toISOString(),
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
  };
}
