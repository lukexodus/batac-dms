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
  login(input: any): Promise<any>;
  logout(sessionId: string, userId: string): Promise<void>;
  refresh(refreshToken: string, ipAddress: string, userAgent: string): Promise<any>;
  verifyAccessToken(token: string): Promise<AuthContext>;
  resolveActiveDelegationGrant(delegationGrantId: string | null): Promise<any>;
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
    iamService:      IamService;
    policyEvaluator: PolicyEvaluator;
  }
}
