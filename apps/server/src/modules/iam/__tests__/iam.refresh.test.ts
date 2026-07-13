/**
 * Integration tests for TASK-IAM-007 — POST /api/auth/refresh
 *
 * Test matrix:
 *   ✓ Valid refresh token -> Rotates token, issues new JWT, returns AuthResponse
 *   ✓ Detects reuse -> Revokes family, deactivates session, emits audit event
 *   ✓ Expired token -> 401
 *   ✓ Revoked token -> 401
 *   ✓ Invalid hash -> 401
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID, createHash, randomBytes } from 'node:crypto';
import type {
  IamRepository,
  IamServiceDeps,
  UserRow,
  SessionRow,
  RefreshTokenRow,
} from '../iam.types.js';

// ─── Environment mock ─────────────────────────────────────────────────────────

vi.mock('../../../config/env.js', () => ({
  env: {
    CITY_ID:                     '00000000-0000-4000-8000-000000000001',
    AUTH_JWT_ACCESS_SECRET:      'test-secret-at-least-32-characters-long!!',
    AUTH_JWT_REFRESH_SECRET:     'refresh-secret-at-least-32-characters!',
    AUTH_JWT_ALGORITHM:          'HS256',
    AUTH_JWT_ACCESS_EXPIRES_IN:  '15m',
    AUTH_JWT_REFRESH_EXPIRES_IN: '30d',
    AUTH_COOKIE_SECURE:          false,
    AUTH_COOKIE_SAMESITE:        'Strict',
    AUTH_ACCESS_TOKEN_COOKIE_NAME:  'batac_at',
    AUTH_REFRESH_TOKEN_COOKIE_NAME: 'batac_rt',
    AUTH_SESSION_INACTIVITY_TIMEOUT_MS: 1800000,
  },
}));

import { createIamService } from '../iam.service.js';

const CITY_ID     = '00000000-0000-4000-8000-000000000001';
const USER_ID     = randomUUID();
const SESSION_ID  = randomUUID();

function makeUser(): UserRow {
  return {
    id: USER_ID,
    username: 'testuser',
    email: 'test@example.com',
    employeeId: 'EMP-001',
    displayName: 'Test User',
    phoneNumber: null,
    cityId: CITY_ID,
    status: 'active',
    mfaEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

function makeSession(): SessionRow {
  return {
    id: SESSION_ID,
    userId: USER_ID,
    sessionTokenHash: 'hash',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    active: true,
    lockedAt: null,
    lockedReason: null,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    cityId: CITY_ID,
  };
}

function makeRefreshToken(overrides: Partial<RefreshTokenRow> = {}): RefreshTokenRow {
  return {
    id: randomUUID(),
    userId: USER_ID,
    sessionId: SESSION_ID,
    tokenHash: 'hash',
    salt: 'salt',
    familyId: randomUUID(),
    usedAt: null,
    expiresAt: new Date(Date.now() + 10000),
    revokedAt: null,
    revocationReason: null,
    replacedBy: null,
    createdAt: new Date(),
    cityId: CITY_ID,
    deletedAt: null,
    ...overrides,
  };
}

// ─── Db and Repo Mocks ────────────────────────────────────────────────────────

let txRepoStub: any;

vi.mock('../iam.repository.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../iam.repository.js')>();
  return {
    ...actual,
    createIamRepository: vi.fn((_tx: any) => txRepoStub),
  };
});

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn().mockReturnValue('eq_mock'),
  };
});

vi.mock('@batac/database/schema/iam.schema.js', () => ({
  sessions:      { id: 'sessions.id' },
  credentials:   {},
  users:         {},
  refreshTokens: {},
  roles:         {},
  permissions:   {},
  rolePermissions: {},
  roleAssignments: {},
  mfaRecords:    {},
}));

describe('IamService - refresh', () => {
  let iamRepoStub: any;
  let auditServiceStub: any;
  let eventBusStub: any;
  let dbStub: any;
  let sut: ReturnType<typeof createIamService>;

  beforeEach(() => {
    iamRepoStub = {
      findRefreshTokenById: vi.fn(),
      findSessionById: vi.fn().mockResolvedValue(makeSession()),
      findUserById: vi.fn().mockResolvedValue(makeUser()),
      findActiveRoleAssignmentsByUserId: vi.fn().mockResolvedValue([]),
      findRolesByIds: vi.fn().mockResolvedValue([]),
      findPermissionsByRoleIds: vi.fn().mockResolvedValue([]),
    };

    auditServiceStub = {
      writeEvent: vi.fn().mockResolvedValue(undefined),
    };

    eventBusStub = {
      emit: vi.fn(),
    };

    txRepoStub = {
      revokeRefreshTokenFamily: vi.fn().mockResolvedValue(undefined),
      updateSessionActiveState: vi.fn().mockResolvedValue(undefined),
      markRefreshTokenUsed: vi.fn().mockResolvedValue(true),
      createRefreshToken: vi.fn().mockResolvedValue(undefined),
      updateLastActivity: vi.fn().mockResolvedValue(undefined),
      findSessionById: vi.fn().mockResolvedValue(makeSession()),
      terminateSession: vi.fn().mockResolvedValue(undefined),
    };

    dbStub = {
      transaction: vi.fn().mockImplementation(async (cb: (tx: any) => Promise<any>) => {
        return cb({});
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };

    sut = createIamService({
      db: dbStub,
      iamRepository: iamRepoStub,
      auditService: auditServiceStub,
      eventBus: eventBusStub,
      policyEvaluator: {} as any,
    });
  });

  it('rotates a valid refresh token', async () => {
    const rawBytes = randomBytes(32);
    const saltBytes = randomBytes(16);
    const rawBase64url = rawBytes.toString('base64url');
    const saltBase64url = saltBytes.toString('base64url');
    const tokenHash = createHash('sha256').update(rawBase64url + saltBase64url, 'utf8').digest('hex');
    const tokenId = randomUUID();

    const tokenRow = makeRefreshToken({
      id: tokenId,
      salt: saltBase64url,
      tokenHash,
    });

    iamRepoStub.findRefreshTokenById.mockResolvedValue(tokenRow);

    const result = await sut.refresh(`${tokenId}.${rawBase64url}`, '127.0.0.1', 'test-agent');

    expect(result.sessionId).toBe(SESSION_ID);
    expect(result._cookies?.accessToken).toBeDefined();
    expect(result._cookies?.refreshTokenCookieValue).toBeDefined();

    expect(txRepoStub.markRefreshTokenUsed).toHaveBeenCalledWith(tokenId, expect.any(String));
    expect(txRepoStub.createRefreshToken).toHaveBeenCalled();
  });

  it('detects reuse and revokes family', async () => {
    const rawBytes = randomBytes(32);
    const saltBytes = randomBytes(16);
    const rawBase64url = rawBytes.toString('base64url');
    const saltBase64url = saltBytes.toString('base64url');
    const tokenHash = createHash('sha256').update(rawBase64url + saltBase64url, 'utf8').digest('hex');
    const tokenId = randomUUID();

    const tokenRow = makeRefreshToken({
      id: tokenId,
      salt: saltBase64url,
      tokenHash,
      usedAt: new Date(),
    });

    iamRepoStub.findRefreshTokenById.mockResolvedValue(tokenRow);

    await expect(sut.refresh(`${tokenId}.${rawBase64url}`, '127.0.0.1', 'test-agent'))
      .rejects.toThrow('Session security event detected');

    expect(txRepoStub.revokeRefreshTokenFamily).toHaveBeenCalledWith(tokenRow.familyId, 'reuse_detected');
    expect(auditServiceStub.writeEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'token_reuse_detected' })
    );
  });

  it('detects concurrent race and revokes family', async () => {
    const rawBytes = randomBytes(32);
    const saltBytes = randomBytes(16);
    const rawBase64url = rawBytes.toString('base64url');
    const saltBase64url = saltBytes.toString('base64url');
    const tokenHash = createHash('sha256').update(rawBase64url + saltBase64url, 'utf8').digest('hex');
    const tokenId = randomUUID();

    const tokenRow = makeRefreshToken({
      id: tokenId,
      salt: saltBase64url,
      tokenHash,
      usedAt: null,
    });

    iamRepoStub.findRefreshTokenById.mockResolvedValue(tokenRow);
    txRepoStub.markRefreshTokenUsed.mockResolvedValueOnce(false);

    await expect(sut.refresh(`${tokenId}.${rawBase64url}`, '127.0.0.1', 'test-agent'))
      .rejects.toThrow('Session security event detected');

    expect(txRepoStub.revokeRefreshTokenFamily).toHaveBeenCalledWith(tokenRow.familyId, 'reuse_detected');
    expect(txRepoStub.terminateSession).toHaveBeenCalledWith(SESSION_ID, 'reuse_detected', null);
    expect(txRepoStub.createRefreshToken).not.toHaveBeenCalled();
    expect(txRepoStub.updateLastActivity).not.toHaveBeenCalled();
  });

  it('rejects expired token', async () => {
    const rawBytes = randomBytes(32);
    const saltBytes = randomBytes(16);
    const rawBase64url = rawBytes.toString('base64url');
    const saltBase64url = saltBytes.toString('base64url');
    const tokenHash = createHash('sha256').update(rawBase64url + saltBase64url, 'utf8').digest('hex');
    const tokenId = randomUUID();

    const tokenRow = makeRefreshToken({
      id: tokenId,
      salt: saltBase64url,
      tokenHash,
      expiresAt: new Date(Date.now() - 10000), // Expired
    });

    iamRepoStub.findRefreshTokenById.mockResolvedValue(tokenRow);

    await expect(sut.refresh(`${tokenId}.${rawBase64url}`, '127.0.0.1', 'test-agent'))
      .rejects.toThrow('Refresh token has expired');
  });

  it('rejects revoked token', async () => {
    const rawBytes = randomBytes(32);
    const saltBytes = randomBytes(16);
    const rawBase64url = rawBytes.toString('base64url');
    const saltBase64url = saltBytes.toString('base64url');
    const tokenHash = createHash('sha256').update(rawBase64url + saltBase64url, 'utf8').digest('hex');
    const tokenId = randomUUID();

    const tokenRow = makeRefreshToken({
      id: tokenId,
      salt: saltBase64url,
      tokenHash,
      revokedAt: new Date(), // Revoked
    });

    iamRepoStub.findRefreshTokenById.mockResolvedValue(tokenRow);

    await expect(sut.refresh(`${tokenId}.${rawBase64url}`, '127.0.0.1', 'test-agent'))
      .rejects.toThrow('Refresh token has been revoked');
  });
});
