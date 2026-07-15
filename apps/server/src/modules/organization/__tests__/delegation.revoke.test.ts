/**
 * delegation.revoke.test.ts
 *
 * Integration-style unit tests for revokeEarlyDelegationGrant().
 * All external dependencies (db, orgRepository, eventBus, auditService,
 * policyEvaluator) are mocked using Vitest.
 *
 * Source: TASK-ORG-006 Acceptance Criteria.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDelegationService } from '../delegation.service.js';
import {
  PolicyDeniedError,
  DelegationGrantNotFoundError,
} from '../../../errors/domain/organization.js';
import type {
  DelegationServiceDeps,
  RevokeEarlyDelegationGrantInput,
  DelegationSubject,
} from '../organization.types.js';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const grantId = 'grant-uuid';

const validInput: RevokeEarlyDelegationGrantInput = {
  writtenInstructionReference: 'DOC-123',
};

const mayorSubject: DelegationSubject = {
  userId: 'user-mayor-id',
  roles: ['mayor'],
  cityId: 'city-batac-uuid',
};

const spSecretarySubject: DelegationSubject = {
  userId: 'user-sp-secretary-id',
  roles: ['sp_secretary'],
  cityId: 'city-batac-uuid',
};

const nonSecretarySubject: DelegationSubject = {
  userId: 'user-encoder-id',
  roles: ['encoder'],
  cityId: 'city-batac-uuid',
};

// ── Mock factory helpers ───────────────────────────────────────────────────────

function makeMockDb(opts: { grantFound?: boolean; grantIsActive?: boolean }) {
  const grantFound = opts.grantFound ?? true;
  const grantIsActive = opts.grantIsActive ?? true;

  const rows = grantFound
    ? [
        {
          grant: {
            id: grantId,
            cityId: 'city-batac-uuid',
            isActive: grantIsActive,
            deletedAt: null,
            revokedAt: null,
            delegatingEmployeeId: 'emp-mayor-id',
            delegatedToEmployeeId: 'emp-acting-id',
          },
          delegatingUserId: 'user-mayor-id',
          delegatedToUserId: 'user-acting-id',
        },
      ]
    : [];

  const mockSelect = vi.fn().mockReturnThis();
  const mockFrom = vi.fn().mockReturnThis();
  const mockInnerJoin = vi.fn().mockReturnThis();
  const mockWhere = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockResolvedValue(rows);

  const mockUpdate = vi.fn().mockReturnThis();
  const mockSet = vi.fn().mockReturnThis();
  const mockReturning = vi.fn().mockResolvedValue([{ id: grantId, isActive: false }]);

  return {
    select: mockSelect,
    from: mockFrom,
    innerJoin: mockInnerJoin,
    where: mockWhere,
    limit: mockLimit,
    update: mockUpdate,
    set: mockSet,
    returning: mockReturning,
  };
}

function makeMockRepository() {
  return {
    delegationGrants: {} as any,
    offices: {} as any,
    positions: {} as any,
    employees: {} as any,
    assignments: {} as any,
    committees: {} as any,
    committeeMemberships: {} as any,
  };
}

function makeMockEventBus() {
  return { emit: vi.fn(), on: vi.fn(), off: vi.fn() };
}

function makeMockAuditService() {
  return {
    writeEvent: vi.fn().mockResolvedValue(undefined),
    queryEvents: vi.fn(),
    _internal: {} as any,
  };
}

function makeMockPolicyEvaluator(allowed: boolean, reason = '') {
  return {
    evaluate: vi.fn().mockResolvedValue(allowed ? { allowed: true } : { allowed: false, reason }),
    registerResourceHandler: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('revokeEarlyDelegationGrant', () => {
  // ── Not Found / State validation ─────────────────────────────────────────

  it('throws DelegationGrantNotFoundError if grant does not exist', async () => {
    const deps: DelegationServiceDeps = {
      db: makeMockDb({ grantFound: false }) as any,
      orgRepository: makeMockRepository(),
      eventBus: makeMockEventBus() as any,
      auditService: makeMockAuditService() as any,
      policyEvaluator: makeMockPolicyEvaluator(true) as any,
    };

    const service = createDelegationService(deps);

    await expect(
      service.revokeEarlyDelegationGrant(grantId, validInput, mayorSubject),
    ).rejects.toThrow(DelegationGrantNotFoundError);
  });

  it('throws PolicyDeniedError if grant is already inactive', async () => {
    const deps: DelegationServiceDeps = {
      db: makeMockDb({ grantIsActive: false }) as any,
      orgRepository: makeMockRepository(),
      eventBus: makeMockEventBus() as any,
      auditService: makeMockAuditService() as any,
      policyEvaluator: makeMockPolicyEvaluator(true) as any,
    };

    const service = createDelegationService(deps);

    await expect(
      service.revokeEarlyDelegationGrant(grantId, validInput, mayorSubject),
    ).rejects.toThrow(PolicyDeniedError);
  });

  // ── ABAC — policy gate ───────────────────────────────────────────────────

  it('throws PolicyDeniedError when PolicyEvaluator denies the action', async () => {
    const deps: DelegationServiceDeps = {
      db: makeMockDb({}) as any,
      orgRepository: makeMockRepository(),
      eventBus: makeMockEventBus() as any,
      auditService: makeMockAuditService() as any,
      policyEvaluator: makeMockPolicyEvaluator(
        false,
        'delegation_grant_revoke_not_permitted',
      ) as any,
    };

    const service = createDelegationService(deps);

    await expect(
      service.revokeEarlyDelegationGrant(grantId, validInput, nonSecretarySubject),
    ).rejects.toThrow(PolicyDeniedError);
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  describe('successful revoke', () => {
    let mockEventBus: ReturnType<typeof makeMockEventBus>;
    let mockAuditService: ReturnType<typeof makeMockAuditService>;
    let mockDb: ReturnType<typeof makeMockDb>;
    let result: any;

    beforeEach(async () => {
      mockEventBus = makeMockEventBus();
      mockAuditService = makeMockAuditService();
      mockDb = makeMockDb({});

      const deps: DelegationServiceDeps = {
        db: mockDb as any,
        orgRepository: makeMockRepository(),
        eventBus: mockEventBus as any,
        auditService: mockAuditService as any,
        policyEvaluator: makeMockPolicyEvaluator(true) as any,
      };

      const service = createDelegationService(deps);
      result = await service.revokeEarlyDelegationGrant(grantId, validInput, mayorSubject);
    });

    it('returns the updated delegation grant row', () => {
      expect(result).toMatchObject({ id: grantId, isActive: false });
    });

    it('updates the row in the database', () => {
      expect(mockDb.update).toHaveBeenCalledTimes(1);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          revokedBy: mayorSubject.userId,
          revokedAt: expect.any(Date),
        }),
      );
    });

    it('emits delegation.revoked on the event bus with correct payload shape', () => {
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const [eventType, envelope] = mockEventBus.emit.mock.calls[0] as [string, any];
      expect(eventType).toBe('delegation.revoked');
      expect(envelope.eventType).toBe('delegation.revoked');
      expect(envelope.cityId).toBe('city-batac-uuid');
      expect(envelope.payload).toMatchObject({
        delegationId: grantId,
        delegatingUserId: 'user-mayor-id',
        delegatedToUserId: 'user-acting-id',
        revokedBy: mayorSubject.userId,
        revokedAt: expect.any(Date),
      });
    });

    it('calls auditService.writeEvent with eventType delegation_grant.revoked_early', async () => {
      expect(mockAuditService.writeEvent).toHaveBeenCalledTimes(1);
      const callArg = mockAuditService.writeEvent.mock.calls[0][0] as any;
      expect(callArg.eventType).toBe('delegation_grant.revoked_early');
      expect(callArg.actorId).toBe(mayorSubject.userId);
      expect(callArg.targetId).toBe(grantId);
      expect(callArg.targetType).toBe('delegation_grant');
    });
  });
});
