import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../config/env.js', () => ({
  env: {
    CITY_ID: '00000000-0000-4000-8000-000000000001',
    AUTH_JWT_ACCESS_SECRET: 'test-secret',
    AUTH_JWT_REFRESH_SECRET: 'test-secret',
    AUTH_JWT_ALGORITHM: 'HS256',
    AUTH_JWT_ACCESS_EXPIRES_IN: '15m',
    AUTH_JWT_REFRESH_EXPIRES_IN: '30d',
    AUTH_COOKIE_SECURE: false,
    AUTH_COOKIE_SAMESITE: 'Strict',
    AUTH_ACCESS_TOKEN_COOKIE_NAME: 'batac_at',
    AUTH_REFRESH_TOKEN_COOKIE_NAME: 'batac_rt',
    AUTH_SESSION_INACTIVITY_TIMEOUT_MS: 1800000,
  }
}));

import { randomUUID } from 'node:crypto';
import { createIamService } from '../iam.service.js';
import { RoleCombinationForbiddenError } from '../iam.errors.js';
import { NotFoundError } from '../../../errors/domain/not-found.js';
import type { IamRepository, IamServiceDeps, RoleRow, RoleAssignmentRow, UserRow } from '../iam.types.js';
import type { AuditPublicAPI } from '../../audit/index.js';
import type { EventBus } from '@batac/shared';

// ─── Test helpers ────────────────────────────────────────────────────────────

const CITY_ID = '00000000-0000-4000-8000-000000000001';

function makeRole(overrides: Partial<RoleRow> = {}): RoleRow {
  return {
    id: randomUUID(),
    cityId: CITY_ID,
    name: 'Test Role',
    code: 'test_role',
    typeCode: 'document_processor',
    description: null,
    isSystem: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: randomUUID(),
    cityId: CITY_ID,
    username: 'testuser',
    email: 'test@example.com',
    status: 'active',
    mfaEnabled: false,
    loginFailureCount: 0,
    loginLockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<RoleAssignmentRow> = {}): RoleAssignmentRow {
  return {
    id: randomUUID(),
    cityId: CITY_ID,
    userId: randomUUID(),
    roleId: randomUUID(),
    assignedBy: randomUUID(),
    officeScopeId: null,
    isActive: true,
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedBy: null,
    updatedBy: null,
    ...overrides,
  };
}

/** Returns a stub IamRepository with all methods that throw by default. */
function makeRepo(overrides: Partial<IamRepository> = {}): IamRepository {
  return {
    findUserById: vi.fn().mockResolvedValue(null),
    findUserByUsername: vi.fn().mockResolvedValue(null),
    findUserByEmail: vi.fn().mockResolvedValue(null),
    createUser: vi.fn().mockRejectedValue(new Error('not stubbed')),
    updateUser: vi.fn().mockRejectedValue(new Error('not stubbed')),
    softDeleteUser: vi.fn().mockRejectedValue(new Error('not stubbed')),
    listUsers: vi.fn().mockResolvedValue([]),
    updateLoginFailure: vi.fn().mockResolvedValue(undefined),
    resetLoginFailure: vi.fn().mockResolvedValue(undefined),

    findCredentialByUserId: vi.fn().mockResolvedValue(null),
    createCredential: vi.fn().mockResolvedValue(undefined),
    updateCredentialHash: vi.fn().mockResolvedValue(undefined),

    createSession: vi.fn().mockRejectedValue(new Error('not stubbed')),
    findActiveSessionByUserId: vi.fn().mockResolvedValue(null),
    findSessionByTokenHash: vi.fn().mockResolvedValue(null),
    findSessionById: vi.fn().mockResolvedValue(null),
    terminateSession: vi.fn().mockResolvedValue(undefined),
    updateLastActivity: vi.fn().mockResolvedValue(undefined),
    setSessionLocked: vi.fn().mockResolvedValue(undefined),
    listSessionsByUserId: vi.fn().mockResolvedValue([]),
    listAllActiveSessions: vi.fn().mockResolvedValue([]),

    createRefreshToken: vi.fn().mockRejectedValue(new Error('not stubbed')),
    findRefreshTokenById: vi.fn().mockResolvedValue(null),
    markRefreshTokenUsed: vi.fn().mockResolvedValue(undefined),
    revokeRefreshTokensBySessionId: vi.fn().mockResolvedValue(undefined),
    revokeRefreshTokenFamily: vi.fn().mockResolvedValue(undefined),
    findLatestActiveRefreshTokenForSession: vi.fn().mockResolvedValue(null),

    findRoleById: vi.fn().mockResolvedValue(null),
    findRoleByCode: vi.fn().mockResolvedValue(null),
    listActiveRoles: vi.fn().mockResolvedValue([]),

    findActiveRoleAssignmentsByUserId: vi.fn().mockResolvedValue([]),
    createRoleAssignment: vi.fn().mockRejectedValue(new Error('not stubbed')),
    revokeRoleAssignment: vi.fn().mockResolvedValue(undefined),
    findAssignmentsByUserId: vi.fn().mockResolvedValue([]),
    findConflictingTypeCodeForUser: vi.fn().mockResolvedValue(null),

    findPermissionsByRoleIds: vi.fn().mockResolvedValue([]),
    findMfaRecordByUserId: vi.fn().mockResolvedValue(null),

    ...overrides,
  };
}

/** Returns a stub EventBus with a spy on emit(). */
function makeEventBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as EventBus;
}

/** Returns a stub AuditPublicAPI. */
function makeAuditService(): AuditPublicAPI {
  return {
    writeEvent: vi.fn().mockResolvedValue(undefined),
    queryEvents: vi.fn().mockRejectedValue(new Error('not stubbed')),
    _internal: { repo: null as any, writeService: null as any },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('IamService.assignRole()', () => {
  let repo: IamRepository;
  let bus: EventBus;
  let deps: IamServiceDeps;

  const actorId    = randomUUID();
  const targetUser = makeUser();

  beforeEach(() => {
    repo = makeRepo();
    bus  = makeEventBus();
    deps = {
      db: null as any,
      iamRepository: repo,
      auditService: makeAuditService(),
      eventBus: bus,
      policyEvaluator: null as any,
    };
  });

  // ── Role not found ──────────────────────────────────────────────────────────

  it('throws NotFoundError when the role does not exist', async () => {
    const service = createIamService(deps);
    vi.mocked(repo.findRoleById).mockResolvedValue(null);

    await expect(
      service.assignRole({ actorId, targetUserId: targetUser.id, roleId: 'missing', officeScopeId: null }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(repo.createRoleAssignment).not.toHaveBeenCalled();
  });

  // ── Platform Admin → Document Processor conflict ────────────────────────────

  it('throws RoleCombinationForbiddenError before INSERT when assigning platform_admin to a document_processor user', async () => {
    const platformAdminRole = makeRole({ typeCode: 'platform_admin' });
    const existingDpRole    = makeRole({ typeCode: 'document_processor' });

    vi.mocked(repo.findRoleById).mockResolvedValue(platformAdminRole);
    vi.mocked(repo.findConflictingTypeCodeForUser).mockResolvedValue(existingDpRole);

    const service = createIamService(deps);

    await expect(
      service.assignRole({ actorId, targetUserId: targetUser.id, roleId: platformAdminRole.id, officeScopeId: null }),
    ).rejects.toThrow(RoleCombinationForbiddenError);

    // Conflict check called with the correct conflicting type
    expect(repo.findConflictingTypeCodeForUser).toHaveBeenCalledWith(
      targetUser.id,
      'document_processor',
    );

    // No INSERT must have been attempted
    expect(repo.createRoleAssignment).not.toHaveBeenCalled();
  });

  // ── Document Processor → Platform Admin conflict ────────────────────────────

  it('throws RoleCombinationForbiddenError before INSERT when assigning document_processor to a platform_admin user', async () => {
    const dpRole              = makeRole({ typeCode: 'document_processor' });
    const existingPlatAdmRole = makeRole({ typeCode: 'platform_admin' });

    vi.mocked(repo.findRoleById).mockResolvedValue(dpRole);
    vi.mocked(repo.findConflictingTypeCodeForUser).mockResolvedValue(existingPlatAdmRole);

    const service = createIamService(deps);

    const err = await service
      .assignRole({ actorId, targetUserId: targetUser.id, roleId: dpRole.id, officeScopeId: null })
      .catch((e) => e);

    expect(err).toBeInstanceOf(RoleCombinationForbiddenError);
    expect((err as RoleCombinationForbiddenError).httpStatus).toBe(422);
    expect((err as RoleCombinationForbiddenError).code).toBe('ROLE_COMBINATION_FORBIDDEN');

    // Conflict check called with the correct conflicting type
    expect(repo.findConflictingTypeCodeForUser).toHaveBeenCalledWith(
      targetUser.id,
      'platform_admin',
    );

    expect(repo.createRoleAssignment).not.toHaveBeenCalled();
  });

  // ── sys_admin type does NOT trigger exclusion check ─────────────────────────

  it('does not perform exclusion check for sys_admin type roles', async () => {
    const sysAdminRole = makeRole({ typeCode: 'sys_admin' });
    const assignment   = makeAssignment({ userId: targetUser.id, roleId: sysAdminRole.id });

    vi.mocked(repo.findRoleById).mockResolvedValue(sysAdminRole);
    vi.mocked(repo.findUserById).mockResolvedValue(targetUser);
    vi.mocked(repo.createRoleAssignment).mockResolvedValue(assignment);

    const service = createIamService(deps);
    await service.assignRole({ actorId, targetUserId: targetUser.id, roleId: sysAdminRole.id, officeScopeId: null });

    expect(repo.findConflictingTypeCodeForUser).not.toHaveBeenCalled();
    expect(repo.createRoleAssignment).toHaveBeenCalledOnce();
  });

  // ── Successful assignment ───────────────────────────────────────────────────

  it('inserts the assignment and emits role.assigned on success', async () => {
    const role       = makeRole({ typeCode: 'document_processor', name: 'Dept Encoder' });
    const assignment = makeAssignment({ userId: targetUser.id, roleId: role.id });

    vi.mocked(repo.findRoleById).mockResolvedValue(role);
    vi.mocked(repo.findConflictingTypeCodeForUser).mockResolvedValue(null);
    vi.mocked(repo.findUserById).mockResolvedValue(targetUser);
    vi.mocked(repo.createRoleAssignment).mockResolvedValue(assignment);

    const service = createIamService(deps);
    const result  = await service.assignRole({
      actorId,
      targetUserId: targetUser.id,
      roleId: role.id,
      officeScopeId: null,
    });

    // Returns the new assignment
    expect(result).toEqual(assignment);

    // INSERT was called with the correct shape
    expect(repo.createRoleAssignment).toHaveBeenCalledWith({
      userId: targetUser.id,
      roleId: role.id,
      assignedBy: actorId,
      officeScopeId: null,
      cityId: targetUser.cityId,
    });

    // Event emitted with correct payload
    expect(bus.emit).toHaveBeenCalledOnce();
    const [emittedType, emittedEnvelope] = vi.mocked(bus.emit).mock.calls[0]!;
    expect(emittedType).toBe('role.assigned');
    expect(emittedEnvelope.cityId).toBe(targetUser.cityId);
    expect(emittedEnvelope.payload).toMatchObject({
      actorId,
      targetUserId: targetUser.id,
      roleId: role.id,
      roleName: role.name,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('IamService.revokeRole()', () => {
  let repo: IamRepository;
  let bus: EventBus;
  let deps: IamServiceDeps;

  const actorId    = randomUUID();
  const targetUser = makeUser();

  beforeEach(() => {
    repo = makeRepo();
    bus  = makeEventBus();
    deps = {
      db: null as any,
      iamRepository: repo,
      auditService: makeAuditService(),
      eventBus: bus,
      policyEvaluator: null as any,
    };
  });

  // ── Assignment not found ────────────────────────────────────────────────────

  it('throws NotFoundError when the assignment does not exist', async () => {
    vi.mocked(repo.findAssignmentsByUserId).mockResolvedValue([]);

    const service = createIamService(deps);
    await expect(
      service.revokeRole({ actorId, targetUserId: targetUser.id, roleAssignmentId: 'missing', reason: 'test' }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(repo.revokeRoleAssignment).not.toHaveBeenCalled();
  });

  // ── Idempotent: already inactive ───────────────────────────────────────────

  it('returns without error or re-emission if the assignment is already inactive', async () => {
    const inactiveAssignment = makeAssignment({ userId: targetUser.id, isActive: false });
    vi.mocked(repo.findAssignmentsByUserId).mockResolvedValue([inactiveAssignment]);

    const service = createIamService(deps);
    await service.revokeRole({
      actorId,
      targetUserId: targetUser.id,
      roleAssignmentId: inactiveAssignment.id,
      reason: 'already done',
    });

    expect(repo.revokeRoleAssignment).not.toHaveBeenCalled();
    expect(bus.emit).not.toHaveBeenCalled();
  });

  // ── Successful revocation ───────────────────────────────────────────────────

  it('revokes the assignment and emits role.revoked on success', async () => {
    const role       = makeRole({ name: 'Dept Approver' });
    const assignment = makeAssignment({ userId: targetUser.id, roleId: role.id, isActive: true });

    vi.mocked(repo.findAssignmentsByUserId).mockResolvedValue([assignment]);
    vi.mocked(repo.revokeRoleAssignment).mockResolvedValue(undefined);
    vi.mocked(repo.findRoleById).mockResolvedValue(role);
    vi.mocked(repo.findUserById).mockResolvedValue(targetUser);

    const service = createIamService(deps);
    await service.revokeRole({
      actorId,
      targetUserId: targetUser.id,
      roleAssignmentId: assignment.id,
      reason: 'user resigned',
    });

    // DB call with correct args
    expect(repo.revokeRoleAssignment).toHaveBeenCalledWith(assignment.id, actorId);

    // Event emitted
    expect(bus.emit).toHaveBeenCalledOnce();
    const [emittedType, emittedEnvelope] = vi.mocked(bus.emit).mock.calls[0]!;
    expect(emittedType).toBe('role.revoked');
    expect(emittedEnvelope.cityId).toBe(targetUser.cityId);
    expect(emittedEnvelope.payload).toMatchObject({
      actorId,
      targetUserId: targetUser.id,
      roleId: assignment.roleId,
      roleName: role.name,
      reason: 'user resigned',
    });
  });

  // ── Audit event payload correctness ────────────────────────────────────────

  it('includes reason in the role.revoked event payload', async () => {
    const role       = makeRole({ name: 'SP Member' });
    const assignment = makeAssignment({ userId: targetUser.id, roleId: role.id, isActive: true });
    const reason     = 'term ended';

    vi.mocked(repo.findAssignmentsByUserId).mockResolvedValue([assignment]);
    vi.mocked(repo.revokeRoleAssignment).mockResolvedValue(undefined);
    vi.mocked(repo.findRoleById).mockResolvedValue(role);
    vi.mocked(repo.findUserById).mockResolvedValue(targetUser);

    const service = createIamService(deps);
    await service.revokeRole({ actorId, targetUserId: targetUser.id, roleAssignmentId: assignment.id, reason });

    const payload = vi.mocked(bus.emit).mock.calls[0]![1].payload as Record<string, unknown>;
    expect(payload['reason']).toBe(reason);
  });
});
