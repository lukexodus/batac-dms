import type { FastifyRequest } from 'fastify';
import type { AppDb } from '../../db.js';
import type { InferSelectModel } from 'drizzle-orm';
import {
  users,
  credentials,
  sessions,
  refreshTokens,
  roles,
  permissions,
  rolePermissions,
  roleAssignments,
  mfaRecords,
} from '@batac/database/schema/iam.schema.js';
import type { AuditPublicAPI } from '../audit/index.js';
import type { EventBus } from '@batac/shared';
import type { PolicyEvaluator } from './iam.policy.js';
import type { iamRouter } from './iam.router.js';

export type DbClient = AppDb;
export type DbTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

export type UserRow = InferSelectModel<typeof users>;
export type CredentialRow = InferSelectModel<typeof credentials>;
export type SessionRow = InferSelectModel<typeof sessions>;
export type RefreshTokenRow = InferSelectModel<typeof refreshTokens>;
export type RoleRow = InferSelectModel<typeof roles>;
export type PermissionRow = InferSelectModel<typeof permissions>;
export type RolePermissionRow = InferSelectModel<typeof rolePermissions>;
export type RoleAssignmentRow = InferSelectModel<typeof roleAssignments>;
export type MfaRecordRow = InferSelectModel<typeof mfaRecords>;

export interface CreateUserInput {
  username: string;
  email: string;
  cityId?: string;
  status?: string;
  mfaEnabled?: boolean;
}

export interface UpdateUserInput {
  username?: string;
  email?: string;
  status?: string;
  mfaEnabled?: boolean;
}

export interface CreateSessionInput {
  userId: string;
  sessionTokenHash: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  cityId?: string;
}

export interface CreateRefreshTokenInput {
  userId: string;
  sessionId: string;
  tokenHash: string;
  salt: string;
  familyId: string;
  expiresAt: Date;
  cityId?: string;
}

export interface CreateRoleAssignmentInput {
  userId: string;
  roleId: string;
  assignedBy: string;
  officeScopeId?: string | null;
  cityId?: string;
}

export type AuthContext = {
  userId:             string;
  sessionId:          string;
  officeId:           string | null;
  cityId:             string;
  roles:              string[];
  permissions:        string[];
  committeeIds:       string[];
  delegationGrantId:  string | null;
  effectiveOfficeIds: string[];
  effectiveRoles:     string[];
  isItAdmin:          boolean;
  isPlatformAdmin:    boolean;
};

export type Context = {
  auth: AuthContext | null;
  db:   DbClient;
  req:  FastifyRequest;
};

export interface UserSummary {
  userId: string;
  displayName: string;
  email: string;
  officeId: string | null;
  positionTitle: string | null;
}

export interface IamPublicAPI {
  evaluatePolicy(
    userId: string,
    resource: string,
    action: string,
    context?: {
      officeId?: string;
      documentId?: string;
      workflowStepAssigneeId?: string;
    }
  ): Promise<boolean>;

  getUserById(userId: string): Promise<UserSummary | null>;
}

export interface IamServiceDeps {
  db: DbClient;
  iamRepository: IamRepository;
  auditService: AuditPublicAPI;
  eventBus: EventBus;
  policyEvaluator: PolicyEvaluator;
  getPrimaryOffice?: (userId: string) => Promise<{ officeId: string; officeCode: string } | null>;
  getCommitteeIds?: (userId: string) => Promise<string[]>;
  resolveActiveDelegationGrant?: (delegationGrantId: string) => Promise<{
    scope: { roles: string[]; officeIds: string[]; actions: string[] };
  } | null>;
}

export interface IamService extends IamPublicAPI {
  /**
   * Authenticate a user via username/password + PKCE S256, issue JWT and
   * refresh token as HTTP-only cookies. Returns the AuthResponse body for
   * the frontend to hydrate identity state (ADR-UI-012 / F2 §5).
   * Source: TASK-IAM-006.
   */
  login(input: {
    username:              string;
    password:              string;
    code_verifier:         string;
    code_challenge:        string;
    code_challenge_method: 'S256';
    ipAddress:             string | null;
    userAgent:             string | null;
  }): Promise<{
    user:          UserRow;
    sessionId:     string;
    expiresAt:     Date;
    roleCodes:     string[];
    officeScopeId: string | null;
    officeCode:    string | null;
    committeeIds:  string[];
  }>;
  logout(sessionId: string, userId: string): Promise<void>;
  refresh(refreshToken: string, ipAddress: string | null, userAgent: string | null): Promise<{
    user:          UserRow;
    sessionId:     string;
    expiresAt:     Date;
    roleCodes:     string[];
    officeScopeId: string | null;
    officeCode:    string | null;
    committeeIds:  string[];
    _cookies?: {
      accessToken:              string;
      refreshTokenCookieValue:  string;
      accessMaxAge:             number;
      refreshMaxAge:            number;
    };
  }>;
  verifyAccessToken(token: string): Promise<AuthContext>;
  resolveActiveDelegationGrant(delegationGrantId: string | null): Promise<{
    scope: { roles: string[]; officeIds: string[]; actions: string[] };
  } | null>;

  /**
   * Assign a role to a user.
   *
   * @remarks
   * Role changes take effect on the **next token refresh** (next POST /api/auth/refresh),
   * not immediately. If instant permission enforcement is required, use the
   * force-terminate session functionality implemented in TASK-IAM-010.
   */
  assignRole(input: {
    actorId: string;
    targetUserId: string;
    roleId: string;
    officeScopeId: string | null;
  }): Promise<RoleAssignmentRow>;

  /**
   * Revoke an active role assignment from a user.
   *
   * @remarks
   * Role changes take effect on the **next token refresh** (next POST /api/auth/refresh),
   * not immediately. If instant permission enforcement is required, use the
   * force-terminate session functionality implemented in TASK-IAM-010.
   */
  revokeRole(input: {
    actorId: string;
    targetUserId: string;
    roleAssignmentId: string;
    reason: string;
  }): Promise<void>;

  /**
   * Forcibly terminate another user's session as an IT Administrator.
   *
   * Terminates the session (active → false), revokes all associated refresh
   * tokens, and emits a `forced_logout` audit event. The operation is
   * idempotent — calling it on an already-terminated session returns
   * `{ terminated: true }` without re-emitting the audit event.
   *
   * ABAC enforcement (IT Admin only) is performed by the route handler
   * BEFORE this method is called. This method does not re-check ABAC.
   *
   * Source: TASK-IAM-010.
   */
  forceTerminateSession(input: {
    actorId:         string;
    targetSessionId: string;
    reason:          string;
    cityId:          string;
  }): Promise<{ terminated: boolean }>;
  updateOwnProfile(input: {
    userId: string;
    displayName?: string;
    phoneNumber?: string;
  }): Promise<UserRow>;

  changeOwnPassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<void>;

  listSessionsByUserId(userId: string): Promise<SessionRow[]>;
  
  listAllActiveSessions(
    cityId: string,
    opts: { limit: number; offset: number }
  ): Promise<SessionRow[]>;


  lockSession(input: {
    sessionId: string;
    userId: string;
  }): Promise<{ locked: boolean }>;

  unlockSession(input: {
    sessionId: string;
    userId: string;
    passwordPlain: string;
    isAccessTokenExpired: boolean;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<{
    unlocked: boolean;
    _cookies?: {
      accessToken: string;
      refreshTokenCookieValue: string;
      accessMaxAge: number;
      refreshMaxAge: number;
    };
  }>;

  listUserDirectory(
    cityId: string,
    opts: { limit: number; offset: number; officeId?: string; search?: string }
  ): Promise<UserRow[]>;

  createUserAccount(input: {
    username: string;
    email: string;
    employeeId: string;
    cityId: string;
    actorId: string;
  }): Promise<UserRow>;

  updateUserAccount(input: {
    userId: string;
    email?: string;
    status?: string;
    officeId?: string;
  }): Promise<UserRow>;

  deactivateUserAccount(userId: string, actorId: string): Promise<void>;
  reactivateUserAccount(userId: string, actorId: string): Promise<void>;

  registerCitizenAccountClerkAssisted(input: {
    fullName: string;
    birthdate: Date;
    phone: string;
    email: string;
    idType: string;
    idReference?: string;
    actorId: string;
  }): Promise<{ citizenUserId: string }>;
}


export interface IamRepository {
  // Users
  findUserById(id: string): Promise<UserRow | null>;
  findUserByUsername(cityId: string, username: string): Promise<UserRow | null>;
  findUserByEmail(cityId: string, email: string): Promise<UserRow | null>;
  createUser(input: CreateUserInput): Promise<UserRow>;
  updateUser(id: string, input: Partial<UpdateUserInput>): Promise<UserRow>;
  softDeleteUser(id: string, deletedBy: string): Promise<void>;
  listUsers(cityId: string, opts: { limit: number; offset: number; search?: string }): Promise<UserRow[]>;
  updateLoginFailure(id: string, count: number, lockedUntil: Date | null): Promise<void>;
  resetLoginFailure(id: string): Promise<void>;

  // Credentials
  findCredentialByUserId(userId: string): Promise<CredentialRow | null>;
  createCredential(userId: string, passwordHash: string): Promise<void>;
  updateCredentialHash(userId: string, passwordHash: string): Promise<void>;

  // Sessions
  createSession(input: CreateSessionInput): Promise<SessionRow>;
  findActiveSessionByUserId(userId: string): Promise<SessionRow | null>;
  findSessionByTokenHash(tokenHash: string): Promise<SessionRow | null>;
  findSessionById(id: string): Promise<SessionRow | null>;
  terminateSession(id: string, reason: string, terminatedBy: string | null): Promise<void>;
  updateLastActivity(id: string): Promise<void>;
  setSessionLocked(id: string, lockedAt: Date | null): Promise<void>;
  listSessionsByUserId(userId: string): Promise<SessionRow[]>;
  listAllActiveSessions(cityId: string, opts: { limit: number; offset: number }): Promise<SessionRow[]>;

  // Refresh tokens
  createRefreshToken(input: CreateRefreshTokenInput): Promise<RefreshTokenRow>;
  findRefreshTokenById(id: string): Promise<RefreshTokenRow | null>;
  markRefreshTokenUsed(id: string, replacedById: string): Promise<void>;
  revokeRefreshTokensBySessionId(sessionId: string, reason: string): Promise<void>;
  revokeRefreshTokenFamily(familyId: string, reason: string): Promise<void>;
  findLatestActiveRefreshTokenForSession(sessionId: string): Promise<RefreshTokenRow | null>;

  // Roles
  findRoleById(id: string): Promise<RoleRow | null>;
  findRoleByCode(cityId: string, code: string): Promise<RoleRow | null>;
  listActiveRoles(cityId: string): Promise<RoleRow[]>;

  // Role assignments
  findActiveRoleAssignmentsByUserId(userId: string): Promise<(RoleAssignmentRow & { role: RoleRow })[]>;
  createRoleAssignment(input: CreateRoleAssignmentInput): Promise<RoleAssignmentRow>;
  revokeRoleAssignment(id: string, revokedBy: string): Promise<void>;
  findAssignmentsByUserId(userId: string): Promise<RoleAssignmentRow[]>;
  findConflictingTypeCodeForUser(userId: string, conflictTypeCode: string): Promise<RoleRow | null>;

  // Permissions
  findPermissionsByRoleIds(roleIds: string[]): Promise<PermissionRow[]>;

  // MFA
  findMfaRecordByUserId(userId: string): Promise<MfaRecordRow | null>;
}

declare module 'fastify' {
  interface FastifyInstance {
    iamService:        IamService;
    policyEvaluator:   PolicyEvaluator;
    /**
     * IAM repository — made available on the Fastify instance by the IAM
     * plugin so that preHandler hooks (which only receive `FastifyInstance`
     * via `this`) can reach the repository without importing it directly.
     * Populated by TASK-IAM-006's plugin registration.
     */
    iamRepository:     IamRepository;
    /**
     * Drizzle ORM database client for the `batac_app` PostgreSQL role.
     * Registered on the Fastify instance by the database plugin so all
     * hooks and plugins can reach it via `fastify.db`.
     * Populated before IAM middleware registration.
     */
    db:                DbClient;
    /**
     * Static IAM tRPC sub-router, decorated for consistency with other
     * modules' `<module>TrpcRouter` decorations (see audit.plugin.ts's
     * `auditTrpcRouter`). [Unverified] `iamRouter` itself reads
     * `ctx.req.server.iamService` / `.policyEvaluator` at request time
     * rather than taking them as constructor arguments, and `trpc/root.ts`
     * already imports `iamRouter` directly — so nothing currently consumes
     * this decoration. It is provided so a future router-merging plugin can
     * use it without an iam.plugin.ts change.
     * Populated by TASK-IAM-014's plugin registration.
     */
    iamTrpcRouter:     typeof iamRouter;
  }

  interface FastifyRequest {
    /**
     * Populated by the `verifyAccessToken` preHandler hook (TASK-IAM-005 Hook 1)
     * for every authenticated request. Null on public/unauthenticated routes.
     * Hook 2 (`loadDelegationContext`) expands `effectiveOfficeIds` and
     * effectiveRoles` in-place after Hook 1 populates the base context.
     */
    auth: AuthContext | null;
    /**
     * Promise bridge pair stored by Hook 3 (`setDatabaseSessionVars`) for the
     * request-scoped RLS transaction. `resolve` commits the transaction (called
     * by the `onResponse` hook on success); `reject` rolls it back (called on
     * error responses >= 400). Source: TASK-IAM-041, TASK-IAM-042.
     */
    _rlsTx?: { resolve: () => void; reject: (err: unknown) => void };
  }
}
