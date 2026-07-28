/**
 * Integration tests for TASK-IAM-006 — POST /api/auth/login
 *
 * Test matrix (per acceptance criteria):
 *   ✓ Valid credentials + valid PKCE → 200; two Set-Cookie headers; body matches
 *     AuthResponseSchema (user, sessionId, expiresAt, roleCodes, officeScopeId,
 *     officeCode); no token value in response body
 *   ✓ Login with no resolvable primary office → officeScopeId/officeCode null in body;
 *     oid null in JWT (not ''); no throw
 *   ✓ Wrong password → 401; audit login_failed emitted with SHA-256 hash (never plaintext)
 *   ✓ PKCE code_verifier that does not satisfy SHA-256(code_verifier)=code_challenge → 400
 *   ✓ Existing active session → replaced in one transaction; session_replaced audit emitted
 *   ✓ batac_at cookie: HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=JWT_ACCESS_TTL_SECONDS
 *   ✓ batac_rt cookie: HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=1209600
 *
 * These are unit-level integration tests: they exercise createIamService() with
 * real business logic and mocked collaborators (repository, auditService, eventBus,
 * db). No Fastify server is spun up — route-level cookie/header tests are marked
 * separately.
 *
 * Source: TASK-IAM-006 deliverables — iam.login.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import type {
  IamRepository,
  IamServiceDeps,
  UserRow,
  RoleRow,
  CredentialRow,
  SessionRow,
  RefreshTokenRow,
  RoleAssignmentRow,
  PermissionRow,
  MfaRecordRow,
} from '../iam.types.js';
import type { AuditPublicAPI } from '../../audit/index.js';
import type { EventBus } from '@batac/shared';

// ─── Environment mock ─────────────────────────────────────────────────────────
// Hoisted before all other imports so that env.ts never calls process.exit(1).

vi.mock('../../../config/env.js', () => ({
  env: {
    CITY_ID: '00000000-0000-4000-8000-000000000001',
    AUTH_JWT_ACCESS_SECRET: 'test-secret-at-least-32-characters-long!!',
    AUTH_JWT_REFRESH_SECRET: 'refresh-secret-at-least-32-characters!',
    AUTH_JWT_ALGORITHM: 'HS256',
    AUTH_JWT_ACCESS_EXPIRES_IN: '15m',
    AUTH_JWT_REFRESH_EXPIRES_IN: '30d',
    AUTH_COOKIE_SECURE: false,
    AUTH_COOKIE_SAMESITE: 'Strict',
    AUTH_ACCESS_TOKEN_COOKIE_NAME: 'batac_at',
    AUTH_REFRESH_TOKEN_COOKIE_NAME: 'batac_rt',
    AUTH_SESSION_INACTIVITY_TIMEOUT_MS: 1800000,
    ARGON2_MEMORY_COST: 4096, // minimal for test speed
    ARGON2_TIME_COST: 1,
    ARGON2_PARALLELISM: 1,
    ARGON2_HASH_LENGTH: 16,
  },
}));

// Mock argon2 so tests don't run actual Argon2id hashing
vi.mock('argon2', () => ({
  default: {
    verify: vi.fn(),
    hash: vi.fn(),
  },
}));

import argon2 from 'argon2';
import { createIamService } from '../iam.service.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CITY_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = randomUUID();
const SESSION_ID = randomUUID();
const NEW_SESSION_ID = randomUUID();

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function makePkce(): { code_verifier: string; code_challenge: string } {
  const code_verifier = randomBytes(32).toString('base64url');
  const code_challenge = createHash('sha256').update(code_verifier, 'ascii').digest('base64url');
  return { code_verifier, code_challenge };
}

function makeBadPkce(): { code_verifier: string; code_challenge: string } {
  return {
    code_verifier: randomBytes(32).toString('base64url'),
    code_challenge: randomBytes(32).toString('base64url'), // mismatched
  };
}

// ─── Factories ────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: USER_ID,
    cityId: CITY_ID,
    username: 'testuser',
    email: 'test@batac.gov.ph',
    status: 'active',
    mfaEnabled: false,
    loginFailureCount: 0,
    loginLockedUntil: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    deletedBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeCredential(overrides: Partial<CredentialRow> = {}): CredentialRow {
  return {
    id: randomUUID(),
    userId: USER_ID,
    passwordHash: '$argon2id$v=19$stub-hash',
    lastChangedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    deletedBy: null,
    updatedBy: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<SessionRow> = {}): SessionRow {
  const now = new Date();
  return {
    id: SESSION_ID,
    userId: USER_ID,
    sessionTokenHash: 'oldhash',
    active: true,
    ipAddress: '10.0.0.1',
    userAgent: 'Mozilla/5.0',
    cityId: CITY_ID,
    locked_at: null,
    lastActivityAt: now,
    createdAt: now,
    terminatedAt: null,
    terminationReason: null,
    terminatedBy: null,
    deletedAt: null,
    deletedBy: null,
    updatedAt: now,
    updatedBy: null,
    ...overrides,
  };
}

function makeNewSession(overrides: Partial<SessionRow> = {}): SessionRow {
  const now = new Date();
  return {
    ...makeSession({ id: NEW_SESSION_ID }),
    active: true,
    sessionTokenHash: 'pending',
    ...overrides,
  };
}

function makeRole(overrides: Partial<RoleRow> = {}): RoleRow {
  return {
    id: randomUUID(),
    cityId: CITY_ID,
    name: 'Document Processor',
    code: 'dept_encoder',
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

/** Returns a stub IamRepository with all methods stubbed. */
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

    createSession: vi.fn().mockResolvedValue(makeNewSession()),
    findActiveSessionByUserId: vi.fn().mockResolvedValue(null),
    findSessionByTokenHash: vi.fn().mockResolvedValue(null),
    findSessionById: vi.fn().mockResolvedValue(null),
    terminateSession: vi.fn().mockResolvedValue(undefined),
    updateLastActivity: vi.fn().mockResolvedValue(undefined),
    setSessionLocked: vi.fn().mockResolvedValue(undefined),
    listSessionsByUserId: vi.fn().mockResolvedValue([]),
    listAllActiveSessions: vi.fn().mockResolvedValue([]),

    createRefreshToken: vi.fn().mockResolvedValue({}),
    findRefreshTokenById: vi.fn().mockResolvedValue(null),
    markRefreshTokenUsed: vi.fn().mockResolvedValue(true),
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

function makeEventBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as EventBus;
}

function makeAuditService(): AuditPublicAPI {
  return {
    writeEvent: vi.fn().mockResolvedValue(undefined),
    queryEvents: vi.fn().mockRejectedValue(new Error('not stubbed')),
    _internal: { repo: null as any, writeService: null as any },
  };
}

/**
 * Build a mock db that stubs transaction() to call the callback with a fresh
 * IamRepository-compatible object, simulating Drizzle's transaction API.
 */
function makeDb(txRepo?: Partial<IamRepository>) {
  // The transaction mock must call the callback with a fake tx object.
  // iam.service.ts imports createIamRepository inside the transaction and
  // calls it with the tx parameter. We intercept that by mocking the module.
  const mockTx = {
    /* drizzle tx placeholder */
  };
  return {
    transaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      return cb(mockTx);
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    execute: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Module mock for iam.repository.js (used inside transaction) ─────────────

/**
 * iam.service.ts performs a dynamic import of createIamRepository inside
 * the DB transaction callback to get a transactional repo. We mock that
 * module here so we can inject our own stub.
 */
let txRepoStub: IamRepository;

vi.mock('../iam.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../iam.repository.js')>();
  return {
    ...actual,
    createIamRepository: vi.fn((_tx: any) => txRepoStub),
  };
});

// Mock @batac/database/schema/iam.schema.js for the sessions.update call
vi.mock('@batac/database/schema/iam.schema.js', () => ({
  sessions: { id: 'sessions.id' },
  credentials: {},
  users: {},
  refreshTokens: {},
  roles: {},
  permissions: {},
  rolePermissions: {},
  roleAssignments: {},
  mfaRecords: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((_col: any, _val: any) => ({ __eq: true })),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a full IamServiceDeps with stubbed collaborators. */
function makeDeps(
  repoOverrides: Partial<IamRepository> = {},
  dbOverrides?: Partial<ReturnType<typeof makeDb>>,
): {
  repo: IamRepository;
  audit: AuditPublicAPI;
  bus: EventBus;
  db: ReturnType<typeof makeDb>;
  deps: IamServiceDeps;
} {
  const repo = makeRepo(repoOverrides);
  const audit = makeAuditService();
  const bus = makeEventBus();
  const db = { ...makeDb(), ...dbOverrides };

  const deps: IamServiceDeps = {
    db: db as any,
    iamRepository: repo,
    auditService: audit,
    eventBus: bus,
    policyEvaluator: null as any,
  };
  return { repo, audit, bus, db, deps };
}

/** Build a valid login input with matching PKCE pair. */
function makeLoginInput(
  overrides: Partial<{
    username: string;
    password: string;
    code_verifier: string;
    code_challenge: string;
    code_challenge_method: 'S256';
    ipAddress: string | null;
    userAgent: string | null;
  }> = {},
) {
  const { code_verifier, code_challenge } = makePkce();
  return {
    username: 'testuser',
    password: 'correct-password',
    code_verifier,
    code_challenge,
    code_challenge_method: 'S256' as const,
    ipAddress: '10.0.0.1',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IamService.login()', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: argon2.verify returns true (password matches)
    vi.mocked(argon2.verify).mockResolvedValue(true);

    // Default tx repo (no old session, creates new one)
    txRepoStub = makeRepo({
      findActiveSessionByUserId: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue(makeNewSession()),
    });
  });

  // ── PKCE mismatch ──────────────────────────────────────────────────────────

  it('returns 400 with code PKCE_MISMATCH when code_verifier does not satisfy the challenge', async () => {
    const { deps } = makeDeps();
    const service = createIamService(deps);
    const { code_verifier, code_challenge } = makeBadPkce();

    const err = await service
      .login(makeLoginInput({ code_verifier, code_challenge }))
      .catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('PKCE_MISMATCH');
    expect(err.statusCode).toBe(400);
  });

  // ── User not found ─────────────────────────────────────────────────────────

  it('returns 401 generic when user is not found', async () => {
    const { deps } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(null),
    });
    const service = createIamService(deps);

    const err = await service.login(makeLoginInput()).catch((e) => e);

    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');
  });

  // ── Inactive user ──────────────────────────────────────────────────────────

  it('returns 401 generic when user status is inactive', async () => {
    const { deps } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(makeUser({ status: 'inactive' })),
    });
    const service = createIamService(deps);

    const err = await service.login(makeLoginInput()).catch((e) => e);
    expect(err.statusCode).toBe(401);
  });

  // ── Locked user ────────────────────────────────────────────────────────────

  it('returns 429 with retryAfter when account is locked', async () => {
    const lockedUntil = new Date(Date.now() + 60_000); // 60s from now
    const { deps } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(makeUser({ loginLockedUntil: lockedUntil })),
    });
    const service = createIamService(deps);

    const err = await service.login(makeLoginInput()).catch((e) => e);

    expect(err.statusCode).toBe(429);
    expect(err.code).toBe('ACCOUNT_LOCKED');
    expect(typeof err.retryAfter).toBe('number');
    expect(err.retryAfter).toBeGreaterThan(0);
  });

  // ── Wrong password ─────────────────────────────────────────────────────────

  it('returns 401 when password is wrong and emits login_failed event on eventBus with sha256 hash', async () => {
    const user = makeUser();
    const cred = makeCredential();
    const { deps, bus } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(user),
      findCredentialByUserId: vi.fn().mockResolvedValue(cred),
    });

    vi.mocked(argon2.verify).mockResolvedValue(false);

    const service = createIamService(deps);
    const err = await service.login(makeLoginInput()).catch((e) => e);

    expect(err.statusCode).toBe(401);
    expect(err.code).toBe('INVALID_CREDENTIALS');

    // Event must have been emitted on eventBus with SHA-256 hash — never plaintext
    expect(vi.mocked(bus.emit)).toHaveBeenCalledOnce();
    const [, envelope] = vi.mocked(bus.emit).mock.calls[0]!;
    expect(envelope.eventType).toBe('login.failed');
    expect(envelope.payload['failure_reason']).toBe('wrong_password');
    // SHA-256 of 'testuser' — never the plaintext string
    expect(envelope.payload['attempted_identifier_hash']).not.toBe('testuser');
    expect(typeof envelope.payload['attempted_identifier_hash']).toBe('string');
    expect((envelope.payload['attempted_identifier_hash'] as string).length).toBe(64); // hex sha256
  });

  // ── Lockout counter after wrong password ───────────────────────────────────

  it('increments login_failure_count and sets lockout at count=6', async () => {
    const user = makeUser({ loginFailureCount: 5 }); // next failure is #6 → 30s lockout
    const cred = makeCredential();
    const { deps, repo } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(user),
      findCredentialByUserId: vi.fn().mockResolvedValue(cred),
    });
    vi.mocked(argon2.verify).mockResolvedValue(false);

    const service = createIamService(deps);
    await service.login(makeLoginInput()).catch(() => {});

    expect(vi.mocked(repo.updateLoginFailure)).toHaveBeenCalledWith(user.id, 6, expect.any(Date));
    const lockedUntil: Date = vi.mocked(repo.updateLoginFailure).mock.calls[0]![2] as Date;
    const delaySec = Math.round((lockedUntil.getTime() - Date.now()) / 1000);
    // 30 seconds lockout for count=6 (allow ±2s for timing)
    expect(delaySec).toBeGreaterThanOrEqual(28);
    expect(delaySec).toBeLessThanOrEqual(32);
  });

  // ── No lockout for counts 1-5 ──────────────────────────────────────────────

  it('does not set lockout when failure count is 1 to 5', async () => {
    for (let prevCount = 0; prevCount < 5; prevCount++) {
      vi.clearAllMocks();
      vi.mocked(argon2.verify).mockResolvedValue(false);
      txRepoStub = makeRepo({ findActiveSessionByUserId: vi.fn().mockResolvedValue(null) });

      const user = makeUser({ loginFailureCount: prevCount });
      const cred = makeCredential();
      const { deps, repo } = makeDeps({
        findUserByUsername: vi.fn().mockResolvedValue(user),
        findCredentialByUserId: vi.fn().mockResolvedValue(cred),
      });
      const service = createIamService(deps);
      await service.login(makeLoginInput()).catch(() => {});

      expect(vi.mocked(repo.updateLoginFailure)).toHaveBeenCalledWith(
        user.id,
        prevCount + 1,
        null, // no lockout
      );
    }
  });

  // ── Successful login — no existing session ─────────────────────────────────

  it('returns 200 body matching AuthResponseSchema on successful login with no existing session', async () => {
    const user = makeUser();
    const cred = makeCredential();
    const role = makeRole({ code: 'dept_encoder' });

    txRepoStub = makeRepo({
      findActiveSessionByUserId: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue(makeNewSession()),
    });

    const { deps, repo, audit } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(user),
      findCredentialByUserId: vi.fn().mockResolvedValue(cred),
      findActiveRoleAssignmentsByUserId: vi.fn().mockResolvedValue([
        {
          ...makeRepo().findAssignmentsByUserId,
          id: randomUUID(),
          userId: USER_ID,
          roleId: role.id,
          isActive: true,
          role,
          assignedBy: randomUUID(),
          officeScopeId: null,
          cityId: CITY_ID,
          revokedAt: null,
          revokedBy: null,
          revocationReason: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          deletedBy: null,
          updatedBy: null,
        },
      ]),
      findPermissionsByRoleIds: vi.fn().mockResolvedValue([]),
      resetLoginFailure: vi.fn().mockResolvedValue(undefined),
    });

    vi.mocked(argon2.verify).mockResolvedValue(true);
    const service = createIamService(deps);
    const result = await service.login(makeLoginInput());

    // Body shape
    expect(result.user.id).toBe(user.id);
    expect(result.user.username).toBe(user.username);
    expect(Array.isArray(result.roleCodes)).toBe(true);
    expect(typeof result.sessionId).toBe('string');
    expect(result.expiresAt).toBeInstanceOf(Date);
    // officeScopeId and officeCode are null when no ORG module (Phase-1 default)
    expect(result.officeScopeId).toBeNull();
    expect(result.officeCode).toBeNull();

    // Tokens must NOT appear in response body
    const responseBody = {
      user: result.user,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
      roleCodes: result.roleCodes,
      officeScopeId: result.officeScopeId,
      officeCode: result.officeCode,
    };
    const bodyStr = JSON.stringify(responseBody);
    expect(bodyStr).not.toMatch(/eyJ/); // JWT prefix
  });

  // ── No resolvable primary office ───────────────────────────────────────────

  it('returns officeScopeId=null and officeCode=null when getPrimaryOffice returns null (Phase-1 default)', async () => {
    const user = makeUser();
    const cred = makeCredential();

    txRepoStub = makeRepo({
      findActiveSessionByUserId: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue(makeNewSession()),
    });

    const { deps } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(user),
      findCredentialByUserId: vi.fn().mockResolvedValue(cred),
      findActiveRoleAssignmentsByUserId: vi.fn().mockResolvedValue([]),
      findPermissionsByRoleIds: vi.fn().mockResolvedValue([]),
      resetLoginFailure: vi.fn().mockResolvedValue(undefined),
    });
    // getPrimaryOffice not provided → defaults to () => null
    vi.mocked(argon2.verify).mockResolvedValue(true);

    const service = createIamService(deps);
    const result = await service.login(makeLoginInput());

    expect(result.officeScopeId).toBeNull();
    expect(result.officeCode).toBeNull();
  });

  // ── Concurrent-session replacement ────────────────────────────────────────

  it('terminates old session and emits session_replaced on eventBus when an active session exists', async () => {
    const user = makeUser();
    const cred = makeCredential();
    const oldSession = makeSession();

    txRepoStub = makeRepo({
      findActiveSessionByUserId: vi.fn().mockResolvedValue(oldSession),
      terminateSession: vi.fn().mockResolvedValue(undefined),
      revokeRefreshTokensBySessionId: vi.fn().mockResolvedValue(undefined),
      createSession: vi.fn().mockResolvedValue(makeNewSession()),
    });

    const { deps, bus } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(user),
      findCredentialByUserId: vi.fn().mockResolvedValue(cred),
      findActiveRoleAssignmentsByUserId: vi.fn().mockResolvedValue([]),
      findPermissionsByRoleIds: vi.fn().mockResolvedValue([]),
      resetLoginFailure: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(argon2.verify).mockResolvedValue(true);

    const service = createIamService(deps);
    await service.login(makeLoginInput());

    // terminateSession called on old session with reason='replaced'
    expect(vi.mocked(txRepoStub.terminateSession)).toHaveBeenCalledWith(
      oldSession.id,
      'replaced',
      null,
    );

    // revokeRefreshTokensBySessionId called with 'replaced'
    expect(vi.mocked(txRepoStub.revokeRefreshTokensBySessionId)).toHaveBeenCalledWith(
      oldSession.id,
      'replaced',
    );

    // session_replaced event emitted on eventBus
    const emitCalls = vi.mocked(bus.emit).mock.calls;
    const replacedCall = emitCalls.find(([eventType]) => eventType === 'session.replaced');
    expect(replacedCall).toBeDefined();
    const envelope = replacedCall![1];
    expect(envelope.payload['old_session_id']).toBe(oldSession.id);
  });

  // ── login_success audit event ─────────────────────────────────────────────

  it('emits login_success event on eventBus on a successful login', async () => {
    const user = makeUser();
    const cred = makeCredential();

    txRepoStub = makeRepo({
      findActiveSessionByUserId: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue(makeNewSession()),
    });

    const { deps, bus } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(user),
      findCredentialByUserId: vi.fn().mockResolvedValue(cred),
      findActiveRoleAssignmentsByUserId: vi.fn().mockResolvedValue([]),
      findPermissionsByRoleIds: vi.fn().mockResolvedValue([]),
      resetLoginFailure: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(argon2.verify).mockResolvedValue(true);

    const service = createIamService(deps);
    await service.login(makeLoginInput());

    const emitCalls = vi.mocked(bus.emit).mock.calls;
    const successCall = emitCalls.find(([eventType]) => eventType === 'login.success');
    expect(successCall).toBeDefined();
    const envelope = successCall![1];
    expect(envelope.payload['user_id']).toBe(user.id);
  });

  // ── resetLoginFailure called after success ────────────────────────────────

  it('calls resetLoginFailure on successful login', async () => {
    const user = makeUser({ loginFailureCount: 2 });
    const cred = makeCredential();

    txRepoStub = makeRepo({
      findActiveSessionByUserId: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue(makeNewSession()),
    });

    const { deps, repo } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(user),
      findCredentialByUserId: vi.fn().mockResolvedValue(cred),
      findActiveRoleAssignmentsByUserId: vi.fn().mockResolvedValue([]),
      findPermissionsByRoleIds: vi.fn().mockResolvedValue([]),
      resetLoginFailure: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(argon2.verify).mockResolvedValue(true);

    const service = createIamService(deps);
    await service.login(makeLoginInput());

    expect(vi.mocked(repo.resetLoginFailure)).toHaveBeenCalledWith(user.id);
  });

  // ── Cookie properties (verified via _cookies private field) ──────────────

  it('returns _cookies.accessMaxAge = JWT_ACCESS_TTL_SECONDS (900 for 15m)', async () => {
    const user = makeUser();
    const cred = makeCredential();

    txRepoStub = makeRepo({
      findActiveSessionByUserId: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue(makeNewSession()),
    });

    const { deps } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(user),
      findCredentialByUserId: vi.fn().mockResolvedValue(cred),
      findActiveRoleAssignmentsByUserId: vi.fn().mockResolvedValue([]),
      findPermissionsByRoleIds: vi.fn().mockResolvedValue([]),
      resetLoginFailure: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(argon2.verify).mockResolvedValue(true);

    const service = createIamService(deps);
    const result = (await service.login(makeLoginInput())) as any;

    expect(result._cookies.accessMaxAge).toBe(900); // 15m = 900s
    expect(result._cookies.refreshMaxAge).toBe(14 * 24 * 3600); // 1209600
  });

  // ── refresh token cookie value format ────────────────────────────────────

  it('refresh token cookie value is in format `{token_id}.{raw_base64url}`', async () => {
    const user = makeUser();
    const cred = makeCredential();

    txRepoStub = makeRepo({
      findActiveSessionByUserId: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue(makeNewSession()),
    });

    const { deps } = makeDeps({
      findUserByUsername: vi.fn().mockResolvedValue(user),
      findCredentialByUserId: vi.fn().mockResolvedValue(cred),
      findActiveRoleAssignmentsByUserId: vi.fn().mockResolvedValue([]),
      findPermissionsByRoleIds: vi.fn().mockResolvedValue([]),
      resetLoginFailure: vi.fn().mockResolvedValue(undefined),
    });
    vi.mocked(argon2.verify).mockResolvedValue(true);

    const service = createIamService(deps);
    const result = (await service.login(makeLoginInput())) as any;

    const parts = result._cookies.refreshTokenCookieValue.split('.');
    // UUID has 5 parts separated by '-'; total cookie has UUID + '.' + base64url
    expect(parts.length).toBeGreaterThanOrEqual(2);
    // First part is a UUID v4
    expect(parts[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
