/**
 * delegation.create.test.ts
 *
 * Integration-style unit tests for createDelegationGrant().
 * All external dependencies (db, orgRepository, eventBus, auditService,
 * policyEvaluator) are mocked using Vitest.
 *
 * Source: TASK-ORG-005 Acceptance Criteria.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDelegationService } from '../delegation.service.js';
import { PolicyDeniedError, ActiveDesignationExistsError } from '../../../errors/domain/organization.js';
import type { DelegationServiceDeps, CreateDelegationGrantInput, DelegationSubject } from '../organization.types.js';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const validInput: CreateDelegationGrantInput = {
  delegatingEmployeeId:  'emp-mayor-id',
  delegatedToEmployeeId: 'emp-acting-id',
  officeId:              'office-executive-id',
  positionId:            'position-mayor-id',
  designationDocumentId: 'doc-designation-uuid',
  scopeDescription:      'Acting Mayor designation',
  scope: {
    roles:     ['mayor'],
    officeIds: ['office-executive-id'],
    actions:   ['document:approve'],
  },
  startDate: '2026-07-01',
  endDate:   '2026-07-15',
  cityId:    'city-batac-uuid',
};

const spSecretarySubject: DelegationSubject = {
  userId: 'user-sp-secretary-id',
  roles:  ['sp_secretary'],
  cityId: 'city-batac-uuid',
};

const nonSecretarySubject: DelegationSubject = {
  userId: 'user-encoder-id',
  roles:  ['encoder'],
  cityId: 'city-batac-uuid',
};

// ── Mock factory helpers ───────────────────────────────────────────────────────

function makeMockDb(opts: {
  existingActiveDelegation?: boolean;
  empRowResult?: { delegatingUserId: string; delegatedToUserId: string } | null;
}) {
  const existingRows = opts.existingActiveDelegation ? [{ id: 'existing-grant-id' }] : [];
  const empRow = opts.empRowResult !== undefined
    ? opts.empRowResult
      ? [opts.empRowResult]
      : []
    : [{ delegatingUserId: 'user-mayor-id', delegatedToUserId: 'user-acting-id' }];

  const mockSelect = vi.fn().mockReturnThis();
  const mockFrom   = vi.fn().mockReturnThis();
  const mockInnerJoin = vi.fn().mockReturnThis();
  const mockWhere  = vi.fn().mockReturnThis();
  const mockLimit  = vi.fn();

  // First .limit() call → Invariant #16 pre-check
  // Second .limit() call → employee userId resolution
  mockLimit
    .mockResolvedValueOnce(existingRows)
    .mockResolvedValueOnce(empRow);

  return {
    select:    mockSelect,
    from:      mockFrom,
    innerJoin: mockInnerJoin,
    where:     mockWhere,
    limit:     mockLimit,
  };
}

function makeMockRepository(grantResult: any = { id: 'new-grant-id', ...validInput, isActive: true }) {
  return {
    delegationGrants: {
      create: vi.fn().mockResolvedValue(grantResult),
      findById: vi.fn(),
      findAll: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      findActiveByUserId: vi.fn(),
      findByIdAndActive: vi.fn(),
    },
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
  return { writeEvent: vi.fn().mockResolvedValue(undefined), queryEvents: vi.fn(), _internal: {} as any };
}

/**
 * Build a PolicyEvaluator mock.
 * @param allowed Whether evaluate() returns allowed:true or allowed:false.
 * @param reason  Denial reason (only used when allowed=false).
 */
function makeMockPolicyEvaluator(allowed: boolean, reason = '') {
  return {
    evaluate: vi.fn().mockResolvedValue(
      allowed ? { allowed: true } : { allowed: false, reason }
    ),
    registerResourceHandler: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createDelegationGrant', () => {
  // ── ABAC — role gate ─────────────────────────────────────────────────────

  it('throws PolicyDeniedError when PolicyEvaluator denies the action', async () => {
    const deps: DelegationServiceDeps = {
      db:               makeMockDb({ existingActiveDelegation: false }) as any,
      orgRepository:    makeMockRepository(),
      eventBus:         makeMockEventBus() as any,
      auditService:     makeMockAuditService() as any,
      policyEvaluator:  makeMockPolicyEvaluator(false, 'delegation_grant_create_requires_sp_secretary') as any,
      boss:             { send: vi.fn().mockResolvedValue(undefined) } as any,
    };

    const service = createDelegationService(deps);

    await expect(
      service.createDelegationGrant(validInput, nonSecretarySubject),
    ).rejects.toThrow(PolicyDeniedError);
  });

  // ── designationDocumentId presence ──────────────────────────────────────

  it('throws PolicyDeniedError when designationDocumentId is empty', async () => {
    const deps: DelegationServiceDeps = {
      db:              makeMockDb({ existingActiveDelegation: false }) as any,
      orgRepository:   makeMockRepository(),
      eventBus:        makeMockEventBus() as any,
      auditService:    makeMockAuditService() as any,
      policyEvaluator: makeMockPolicyEvaluator(true) as any,
      boss:            { send: vi.fn().mockResolvedValue(undefined) } as any,
    };

    const service = createDelegationService(deps);
    const inputMissingDoc = { ...validInput, designationDocumentId: '' };

    await expect(
      service.createDelegationGrant(inputMissingDoc, spSecretarySubject),
    ).rejects.toThrow(PolicyDeniedError);
  });

  // ── Invariant #16 ────────────────────────────────────────────────────────

  it('throws ActiveDesignationExistsError when delegatee already has an active grant', async () => {
    const deps: DelegationServiceDeps = {
      db:              makeMockDb({ existingActiveDelegation: true }) as any,
      orgRepository:   makeMockRepository(),
      eventBus:        makeMockEventBus() as any,
      auditService:    makeMockAuditService() as any,
      policyEvaluator: makeMockPolicyEvaluator(true) as any,
      boss:            { send: vi.fn().mockResolvedValue(undefined) } as any,
    };

    const service = createDelegationService(deps);

    await expect(
      service.createDelegationGrant(validInput, spSecretarySubject),
    ).rejects.toThrow(ActiveDesignationExistsError);
  });

  // ── Happy path ──────────────────────────────────────────────────────────

  describe('successful create', () => {
    const grantRow = {
      id:                    'new-grant-id',
      cityId:                validInput.cityId,
      delegatingEmployeeId:  validInput.delegatingEmployeeId,
      delegatedToEmployeeId: validInput.delegatedToEmployeeId,
      officeId:              validInput.officeId,
      positionId:            validInput.positionId,
      designationDocumentId: validInput.designationDocumentId,
      scopeDescription:      validInput.scopeDescription,
      scope:                 validInput.scope,
      legalBasis:            null,
      startDate:             validInput.startDate,
      endDate:               validInput.endDate,
      isActive:              true,
      revokedBy:             null,
      revokedAt:             null,
      createdAt:             new Date(),
      updatedAt:             new Date(),
      deletedAt:             null,
      deletedBy:             null,
    };

    let mockEventBus: ReturnType<typeof makeMockEventBus>;
    let mockAuditService: ReturnType<typeof makeMockAuditService>;
    let result: any;

    beforeEach(async () => {
      mockEventBus    = makeMockEventBus();
      mockAuditService = makeMockAuditService();

      const deps: DelegationServiceDeps = {
        db:              makeMockDb({ existingActiveDelegation: false }) as any,
        orgRepository:   makeMockRepository(grantRow),
        eventBus:        mockEventBus as any,
        auditService:    mockAuditService as any,
        policyEvaluator: makeMockPolicyEvaluator(true) as any,
        boss:            { send: vi.fn().mockResolvedValue(undefined) } as any,
      };

      const service = createDelegationService(deps);
      result = await service.createDelegationGrant(validInput, spSecretarySubject);
    });

    it('returns the inserted delegation grant row', () => {
      expect(result).toMatchObject({ id: 'new-grant-id', isActive: true });
    });

    it('emits delegation.granted on the event bus with correct payload shape', () => {
      expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
      const [eventType, envelope] = mockEventBus.emit.mock.calls[0] as [string, any];
      expect(eventType).toBe('delegation.granted');
      expect(envelope.eventType).toBe('delegation.granted');
      expect(envelope.cityId).toBe(validInput.cityId);
      expect(envelope.payload).toMatchObject({
        delegationId:          'new-grant-id',
        designationDocumentId: validInput.designationDocumentId,
        scope: {
          officeId:   validInput.officeId,
          positionId: validInput.positionId,
        },
        validFrom:  validInput.startDate,
        validUntil: validInput.endDate,
      });
    });

    it('calls auditService.writeEvent with eventType delegation_grant.created and grant id in targetId', async () => {
      expect(mockAuditService.writeEvent).toHaveBeenCalledTimes(1);
      const callArg = mockAuditService.writeEvent.mock.calls[0][0] as any;
      expect(callArg.eventType).toBe('delegation_grant.created');
      expect(callArg.actorId).toBe(spSecretarySubject.userId);
      expect(callArg.targetId).toBe('new-grant-id');
      expect(callArg.targetType).toBe('delegation_grant');
    });
  });
});
