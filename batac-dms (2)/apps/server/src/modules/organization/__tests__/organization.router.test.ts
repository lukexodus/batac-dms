/**
 * TASK-ORG-008 — Tests for organization.router.ts
 *
 * Strategy mirrors apps/server/src/modules/audit/__tests__/audit.router.test.ts:
 * call procedures through a real tRPC caller (t.createCallerFactory),
 * bypassing HTTP transport, with createOrgRouter's dependencies fully mocked
 * so no real database is required.
 *
 * Coverage:
 *  - Role enforcement (UNAUTHORIZED) on office/position/employee/assignment
 *    mutation procedures for non-plat_admin roles, and a plat_admin success
 *    path proving the gate isn't simply rejecting everyone.
 *  - createCommittee rejects dept_encoder (explicit Acceptance Criterion).
 *  - getActiveDesignations: role gate AND the I1 §11.3 party-to-a-grant
 *    exception (explicit Acceptance Criterion, including the "not a party"
 *    negative case).
 *  - getOfficeHierarchy: accessible to the full I2 §2 role list including
 *    dept_encoder/dept_approver (read-only), denied to roles outside it.
 *  - getDesignationHistory: role gate + input forwarding.
 *  - assignEmployeeToPosition: the singular-vs-plural "one active holder"
 *    business rule.
 *  - Unauthenticated caller -> UNAUTHORIZED (protectedProcedure baseline).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createOrgRouter } from '../organization.router.js';
import type { OrgRouterDeps } from '../organization.types.js';
import type { Context } from '../../iam/iam.types.js';
import {
  PolicyDeniedError,
  ActiveDesignationExistsError,
  DelegationGrantNotFoundError,
} from '../../../errors/domain/organization.js';

// ─── Fixture UUIDs (valid RFC4122-shaped, version 4 / variant 8) ──────────

const OFFICE_ID = '00000000-0000-4000-8000-000000000001';
const PARENT_OFFICE_ID = '00000000-0000-4000-8000-000000000002';
const POSITION_ID = '00000000-0000-4000-8000-000000000003';
const EMPLOYEE_ID = '00000000-0000-4000-8000-000000000004';
const COMMITTEE_ID = '00000000-0000-4000-8000-000000000005';
const USER_ID = '00000000-0000-4000-8000-000000000006';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000007';

// ─── Mock dependency builder ───────────────────────────────────────────────

function makeDeps(): OrgRouterDeps {
  const orgRepository = {
    offices: {
      findById: vi.fn().mockResolvedValue({ id: OFFICE_ID, name: 'Existing', code: 'EX', officeType: 'department', parentOfficeId: null }),
      findAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: OFFICE_ID, name: 'New Office', code: 'NEW', officeType: 'department', parentOfficeId: null }),
      update: vi.fn().mockResolvedValue({ id: OFFICE_ID, name: 'Updated', code: 'EX', officeType: 'department', parentOfficeId: null }),
      softDelete: vi.fn().mockResolvedValue(undefined),
    },
    positions: {
      findById: vi.fn().mockResolvedValue({ id: POSITION_ID, title: 'Councilor', officeId: OFFICE_ID, code: 'CNC', authorityLevel: 'staff' }),
      findAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: POSITION_ID, title: 'New Position' }),
      update: vi.fn().mockResolvedValue({ id: POSITION_ID, title: 'Updated Position' }),
      softDelete: vi.fn().mockResolvedValue(undefined),
    },
    employees: {
      findById: vi.fn().mockResolvedValue({ id: EMPLOYEE_ID, firstName: 'Juan', lastName: 'Dela Cruz' }),
      findByUserId: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: EMPLOYEE_ID }),
      update: vi.fn().mockResolvedValue({ id: EMPLOYEE_ID }),
      softDelete: vi.fn().mockResolvedValue(undefined),
    },
    assignments: {
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-0000000000a1' }),
      update: vi.fn().mockResolvedValue({}),
      softDelete: vi.fn().mockResolvedValue(undefined),
      setPrimaryAssignment: vi.fn().mockResolvedValue(undefined),
    },
    delegationGrants: {
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      softDelete: vi.fn().mockResolvedValue(undefined),
      findActiveByUserId: vi.fn().mockResolvedValue([]),
      findByIdAndActive: vi.fn().mockResolvedValue(null),
    },
    committees: {
      findById: vi.fn().mockResolvedValue({ id: COMMITTEE_ID, name: 'Existing Committee', code: 'EC', chairedByEmployeeId: EMPLOYEE_ID }),
      findAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: COMMITTEE_ID }),
      update: vi.fn().mockResolvedValue({ id: COMMITTEE_ID }),
      softDelete: vi.fn().mockResolvedValue(undefined),
    },
    committeeMemberships: {
      findById: vi.fn().mockResolvedValue(null),
      findAll: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-0000000000b1' }),
      update: vi.fn().mockResolvedValue({}),
      softDelete: vi.fn().mockResolvedValue(undefined),
      findActiveByUserId: vi.fn().mockResolvedValue([]),
    },
  };

  const orgService = {
    resolveCurrentHolder: vi.fn(),
    getOfficeById: vi.fn(),
    getOfficeHierarchy: vi.fn().mockResolvedValue({
      offices: [{ officeId: OFFICE_ID, name: 'Office of the Mayor', parentOfficeId: null, type: 'executive' }],
    }),
    getEmployeeByUserId: vi.fn(),
    getPrimaryOfficeForUser: vi.fn(),
    getCommitteeIdsForUser: vi.fn(),
  };

  const delegationService = {
    getActiveDelegationForUser: vi.fn(),
    getDelegationGrantById: vi.fn(),
    createDelegationGrant: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-0000000000d1' }),
    revokeEarlyDelegationGrant: vi.fn().mockResolvedValue({ id: '00000000-0000-4000-8000-0000000000d1' }),
    listActiveDesignations: vi.fn().mockResolvedValue([
      {
        delegationId: '00000000-0000-4000-8000-0000000000c1',
        designationDocumentId: '00000000-0000-4000-8000-0000000000c2',
        delegatingUserId: USER_ID,
        delegatingDisplayName: 'Mayor Person',
        delegatedToUserId: OTHER_USER_ID,
        delegatedToDisplayName: 'VP Person',
        officeId: OFFICE_ID,
        positionTitle: 'Mayor',
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-12-31'),
      },
    ]),
    listDesignationHistory: vi.fn().mockResolvedValue([]),
    listActiveDesignationParties: vi.fn().mockResolvedValue([
      { delegatingUserId: USER_ID, delegatedToUserId: OTHER_USER_ID },
    ]),
  };

  return {
    orgRepository: orgRepository as unknown as OrgRouterDeps['orgRepository'],
    orgService: orgService as unknown as OrgRouterDeps['orgService'],
    delegationService: delegationService as unknown as OrgRouterDeps['delegationService'],
    policyEvaluator: { evaluate: vi.fn(), registerResourceHandler: vi.fn() } as unknown as OrgRouterDeps['policyEvaluator'],
  };
}

// ─── Caller factory helper (mirrors audit.router.test.ts) ─────────────────

function buildCaller(ctx: Context, deps: OrgRouterDeps) {
  const orgRouter = createOrgRouter(deps);
  const t = initTRPC.context<Context>().create();
  const callerFactory = t.createCallerFactory(t.router({ organization: orgRouter }));
  return callerFactory(ctx);
}

// ─── Context fixtures ───────────────────────────────────────────────────────

function makeCtx(roles: string[], opts?: { isPlatformAdmin?: boolean; userId?: string }): Context {
  const isPlatformAdmin = opts?.isPlatformAdmin ?? roles.includes('plat_admin');
  return {
    auth: {
      userId: opts?.userId ?? USER_ID,
      sessionId: 'sess-001',
      officeId: null,
      cityId: 'city-001',
      roles,
      permissions: [],
      committeeIds: [],
      delegationGrantId: null,
      effectiveOfficeIds: [],
      effectiveRoles: roles,
      isItAdmin: false,
      isPlatformAdmin,
    },
    db: {} as any,
    req: {} as any,
  };
}

function makeUnauthCtx(): Context {
  return { auth: null, db: {} as any, req: {} as any };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('organization router — plat_admin-only mutations', () => {
  let deps: OrgRouterDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  const NON_ADMIN_ROLE = 'records_officer';

  it.each([
    ['createOffice', { name: 'New', code: 'NEW', officeType: 'department' as const }],
    ['updateOffice', { officeId: OFFICE_ID, name: 'Renamed' }],
    ['deactivateOffice', { officeId: OFFICE_ID }],
    ['createPosition', { officeId: OFFICE_ID, title: 'Clerk', code: 'CLK', authorityLevel: 'staff' as const }],
    ['updatePosition', { positionId: POSITION_ID, title: 'Senior Clerk' }],
    ['createEmployee', { firstName: 'Juan', lastName: 'Cruz', employeeNumber: 'EMP-1' }],
    ['updateEmployee', { employeeId: EMPLOYEE_ID, firstName: 'Juana' }],
    [
      'assignEmployeeToPosition',
      { employeeId: EMPLOYEE_ID, positionId: POSITION_ID, officeId: OFFICE_ID, startDate: new Date('2026-01-01') },
    ],
  ] as const)('%s rejects a non-plat_admin role with UNAUTHORIZED and does not touch the repository', async (procedure, input) => {
    const caller = buildCaller(makeCtx([NON_ADMIN_ROLE]), deps);

    await expect((caller.organization as any)[procedure](input)).rejects.toThrowError(TRPCError);
    try {
      await (caller.organization as any)[procedure](input);
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe('UNAUTHORIZED');
    }

    expect(deps.orgRepository.offices.create).not.toHaveBeenCalled();
    expect(deps.orgRepository.offices.update).not.toHaveBeenCalled();
    expect(deps.orgRepository.offices.softDelete).not.toHaveBeenCalled();
    expect(deps.orgRepository.positions.create).not.toHaveBeenCalled();
    expect(deps.orgRepository.positions.update).not.toHaveBeenCalled();
    expect(deps.orgRepository.employees.create).not.toHaveBeenCalled();
    expect(deps.orgRepository.employees.update).not.toHaveBeenCalled();
    expect(deps.orgRepository.assignments.create).not.toHaveBeenCalled();
  });

  it('createOffice succeeds for plat_admin (proves the gate is not rejecting everyone)', async () => {
    const caller = buildCaller(makeCtx(['plat_admin']), deps);

    const result = await caller.organization.createOffice({ name: 'New Office', code: 'NEW', officeType: 'department' });

    expect(result).toEqual({ officeId: OFFICE_ID, name: 'New Office', parentOfficeId: null, type: 'department' });
    expect(deps.orgRepository.offices.create).toHaveBeenCalledOnce();
  });

  it('updateOffice rejects a parentOfficeId equal to the office\u2019s own id with BAD_REQUEST', async () => {
    const caller = buildCaller(makeCtx(['plat_admin']), deps);
    await expect(
      caller.organization.updateOffice({ officeId: OFFICE_ID, parentOfficeId: OFFICE_ID }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('createEmployee requires employeeNumber and returns BAD_REQUEST (not a raw DB error) when omitted', async () => {
    const caller = buildCaller(makeCtx(['plat_admin']), deps);
    await expect(
      caller.organization.createEmployee({ firstName: 'Juan', lastName: 'Cruz' }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(deps.orgRepository.employees.create).not.toHaveBeenCalled();
  });
});

describe('organization router — committees (I2 §3, plat_admin only)', () => {
  let deps: OrgRouterDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('createCommittee called as dept_encoder returns UNAUTHORIZED', async () => {
    const caller = buildCaller(makeCtx(['dept_encoder']), deps);

    await expect(
      caller.organization.createCommittee({ name: 'New Committee', code: 'NC', chairedByEmployeeId: EMPLOYEE_ID }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(deps.orgRepository.committees.create).not.toHaveBeenCalled();
  });

  it('createCommittee succeeds for plat_admin', async () => {
    const caller = buildCaller(makeCtx(['plat_admin']), deps);
    const result = await caller.organization.createCommittee({
      name: 'New Committee',
      code: 'NC',
      chairedByEmployeeId: EMPLOYEE_ID,
    });
    expect(result).toEqual({ committeeId: COMMITTEE_ID });
  });

  it('assignCommitteeMembership called as a non-plat_admin role returns UNAUTHORIZED', async () => {
    const caller = buildCaller(makeCtx(['sp_secretary']), deps);
    await expect(
      caller.organization.assignCommitteeMembership({
        committeeId: COMMITTEE_ID,
        employeeId: EMPLOYEE_ID,
        committeeRole: 'member',
        startDate: new Date('2026-01-01'),
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(deps.orgRepository.committeeMemberships.create).not.toHaveBeenCalled();
  });
});

describe('organization.getActiveDesignations — I1 §11.3 read policy', () => {
  let deps: OrgRouterDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  const ALLOWED_ROLES = ['sys_admin', 'plat_admin', 'sp_secretary', 'sp_presiding_officer', 'mayor', 'auditor'];

  it.each(ALLOWED_ROLES)('returns the active designation list for role=%s', async (role) => {
    const caller = buildCaller(makeCtx([role], { userId: 'someone-else-entirely' }), deps);
    const result = await caller.organization.getActiveDesignations();
    expect(result).toHaveLength(1);
    expect(result[0]?.positionTitle).toBe('Mayor');
  });

  it('a subject whose role is not allowed AND who is not a party to any listed grant returns UNAUTHORIZED', async () => {
    const caller = buildCaller(makeCtx(['dept_encoder'], { userId: 'not-a-party-user' }), deps);
    await expect(caller.organization.getActiveDesignations()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(deps.delegationService.listActiveDesignations).not.toHaveBeenCalled();
  });

  it('a subject whose role is not allowed but who IS a party to an active grant is let through', async () => {
    // USER_ID is the delegatingUserId on the mocked active grant.
    const caller = buildCaller(makeCtx(['dept_encoder'], { userId: USER_ID }), deps);
    const result = await caller.organization.getActiveDesignations();
    expect(result).toHaveLength(1);
  });

  it('the delegated-to party is also let through', async () => {
    const caller = buildCaller(makeCtx(['dept_encoder'], { userId: OTHER_USER_ID }), deps);
    const result = await caller.organization.getActiveDesignations();
    expect(result).toHaveLength(1);
  });

  it('unauthenticated caller gets UNAUTHORIZED before any party check is made', async () => {
    const caller = buildCaller(makeUnauthCtx(), deps);
    await expect(caller.organization.getActiveDesignations()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});

describe('organization.getDesignationHistory', () => {
  let deps: OrgRouterDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('rejects a role outside the I1 §11.3 list with UNAUTHORIZED', async () => {
    const caller = buildCaller(makeCtx(['dept_approver']), deps);
    await expect(caller.organization.getDesignationHistory({})).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(deps.delegationService.listDesignationHistory).not.toHaveBeenCalled();
  });

  it('forwards pageSize and employeeId to the service and returns nextCursor: null', async () => {
    const caller = buildCaller(makeCtx(['auditor']), deps);
    const result = await caller.organization.getDesignationHistory({ pageSize: 5, employeeId: EMPLOYEE_ID });
    expect(deps.delegationService.listDesignationHistory).toHaveBeenCalledWith({ limit: 5, employeeId: EMPLOYEE_ID });
    expect(result.nextCursor).toBeNull();
  });
});

describe('organization.getOfficeHierarchy — I2 §2 view permissions, "ABAC: none"', () => {
  let deps: OrgRouterDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it.each([
    'sys_admin', 'plat_admin', 'records_officer', 'sp_secretary', 'sp_member',
    'sp_presiding_officer', 'mayor', 'auditor',
  ])('full-tree role %s can call getOfficeHierarchy', async (role) => {
    const caller = buildCaller(makeCtx([role]), deps);
    const result = await caller.organization.getOfficeHierarchy();
    expect(result.offices).toHaveLength(1);
  });

  it.each(['dept_encoder', 'dept_approver'])('read-only role %s can call getOfficeHierarchy', async (role) => {
    const caller = buildCaller(makeCtx([role]), deps);
    const result = await caller.organization.getOfficeHierarchy();
    expect(result.offices).toHaveLength(1);
  });

  it('a role outside the I2 §2 list (e.g. citizen) is rejected with UNAUTHORIZED', async () => {
    const caller = buildCaller(makeCtx(['citizen']), deps);
    await expect(caller.organization.getOfficeHierarchy()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(deps.orgService.getOfficeHierarchy).not.toHaveBeenCalled();
  });
});

describe('organization.assignEmployeeToPosition — singular vs. plural position business rule', () => {
  let deps: OrgRouterDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('rejects a second active holder for a singular position (Mayor) with CONFLICT', async () => {
    deps.orgRepository.positions.findById = vi.fn().mockResolvedValue({ id: POSITION_ID, title: 'Mayor' });
    deps.orgRepository.assignments.findAll = vi.fn().mockResolvedValue([
      { positionId: POSITION_ID, isActive: true },
    ]);
    const caller = buildCaller(makeCtx(['plat_admin']), deps);

    await expect(
      caller.organization.assignEmployeeToPosition({
        employeeId: EMPLOYEE_ID,
        positionId: POSITION_ID,
        officeId: OFFICE_ID,
        startDate: new Date('2026-01-01'),
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(deps.orgRepository.assignments.create).not.toHaveBeenCalled();
  });

  it('allows a second active holder for a plural position (Councilor)', async () => {
    deps.orgRepository.positions.findById = vi.fn().mockResolvedValue({ id: POSITION_ID, title: 'Councilor' });
    deps.orgRepository.assignments.findAll = vi.fn().mockResolvedValue([
      { positionId: POSITION_ID, isActive: true },
    ]);
    const caller = buildCaller(makeCtx(['plat_admin']), deps);

    const result = await caller.organization.assignEmployeeToPosition({
      employeeId: EMPLOYEE_ID,
      positionId: POSITION_ID,
      officeId: OFFICE_ID,
      startDate: new Date('2026-01-01'),
    });
    expect(result).toEqual({ assignmentId: '00000000-0000-4000-8000-0000000000a1' });
    expect(deps.orgRepository.assignments.create).toHaveBeenCalledOnce();
  });

  it('allows the first holder of a singular position (no conflict when none exists yet)', async () => {
    deps.orgRepository.positions.findById = vi.fn().mockResolvedValue({ id: POSITION_ID, title: 'SP Secretary' });
    deps.orgRepository.assignments.findAll = vi.fn().mockResolvedValue([]);
    const caller = buildCaller(makeCtx(['plat_admin']), deps);

    const result = await caller.organization.assignEmployeeToPosition({
      employeeId: EMPLOYEE_ID,
      positionId: POSITION_ID,
      officeId: OFFICE_ID,
      startDate: new Date('2026-01-01'),
    });
    expect(result).toEqual({ assignmentId: '00000000-0000-4000-8000-0000000000a1' });
  });
});

describe('organization router — designation creation and revocation mutations', () => {
  let deps: OrgRouterDeps;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('createDesignationGrant forwards input and returns delegationId', async () => {
    const caller = buildCaller(makeCtx(['sp_secretary']), deps);
    const input = {
      designationDocumentId: '00000000-0000-4000-8000-0000000000c2',
      delegatingEmployeeId: EMPLOYEE_ID,
      delegatedToEmployeeId: '00000000-0000-4000-8000-000000000009',
      officeId: OFFICE_ID,
      positionId: POSITION_ID,
      scopeDescription: 'Test Scope',
      legalBasis: 'Basis',
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
    };

    const result = await caller.organization.createDesignationGrant(input);

    expect(result).toEqual({ delegationId: '00000000-0000-4000-8000-0000000000d1' });
    expect(deps.delegationService.createDelegationGrant).toHaveBeenCalledWith(
      {
        designationDocumentId: input.designationDocumentId,
        delegatingEmployeeId: input.delegatingEmployeeId,
        delegatedToEmployeeId: input.delegatedToEmployeeId,
        officeId: input.officeId,
        positionId: input.positionId,
        scopeDescription: input.scopeDescription,
        legalBasis: input.legalBasis,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        cityId: 'city-001',
      },
      {
        userId: USER_ID,
        roles: ['sp_secretary'],
        cityId: 'city-001',
      }
    );
  });

  it('createDesignationGrant maps PolicyDeniedError to UNAUTHORIZED', async () => {
    deps.delegationService.createDelegationGrant = vi.fn().mockRejectedValue(
      new PolicyDeniedError({ reason: 'not_allowed', action: 'delegation_grant:create' })
    );
    const caller = buildCaller(makeCtx(['citizen']), deps);
    const input = {
      designationDocumentId: '00000000-0000-4000-8000-0000000000c2',
      delegatingEmployeeId: EMPLOYEE_ID,
      delegatedToEmployeeId: '00000000-0000-4000-8000-000000000009',
      officeId: OFFICE_ID,
      positionId: POSITION_ID,
      scopeDescription: 'Test Scope',
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
    };

    await expect(caller.organization.createDesignationGrant(input)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('createDesignationGrant maps ActiveDesignationExistsError to CONFLICT', async () => {
    deps.delegationService.createDelegationGrant = vi.fn().mockRejectedValue(
      new ActiveDesignationExistsError({ delegatedToEmployeeId: '00000000-0000-4000-8000-000000000009' })
    );
    const caller = buildCaller(makeCtx(['sp_secretary']), deps);
    const input = {
      designationDocumentId: '00000000-0000-4000-8000-0000000000c2',
      delegatingEmployeeId: EMPLOYEE_ID,
      delegatedToEmployeeId: '00000000-0000-4000-8000-000000000009',
      officeId: OFFICE_ID,
      positionId: POSITION_ID,
      scopeDescription: 'Test Scope',
      validFrom: new Date('2026-01-01'),
      validUntil: new Date('2026-12-31'),
    };

    await expect(caller.organization.createDesignationGrant(input)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('revokeDesignationGrantEarly forwards input and returns success', async () => {
    const caller = buildCaller(makeCtx(['mayor']), deps);
    const input = {
      delegationId: '00000000-0000-4000-8000-0000000000d1',
      writtenInstructionReference: 'REF-123',
    };

    const result = await caller.organization.revokeDesignationGrantEarly(input);

    expect(result).toEqual({ success: true });
    expect(deps.delegationService.revokeEarlyDelegationGrant).toHaveBeenCalledWith(
      input.delegationId,
      {
        writtenInstructionReference: input.writtenInstructionReference,
      },
      {
        userId: USER_ID,
        roles: ['mayor'],
        cityId: 'city-001',
      }
    );
  });

  it('revokeDesignationGrantEarly maps PolicyDeniedError to UNAUTHORIZED', async () => {
    deps.delegationService.revokeEarlyDelegationGrant = vi.fn().mockRejectedValue(
      new PolicyDeniedError({ reason: 'not_owner', action: 'delegation_grant:revoke_early' })
    );
    const caller = buildCaller(makeCtx(['mayor']), deps);
    const input = {
      delegationId: '00000000-0000-4000-8000-0000000000d1',
    };

    await expect(caller.organization.revokeDesignationGrantEarly(input)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('revokeDesignationGrantEarly maps DelegationGrantNotFoundError to NOT_FOUND', async () => {
    deps.delegationService.revokeEarlyDelegationGrant = vi.fn().mockRejectedValue(
      new DelegationGrantNotFoundError({ grantId: '00000000-0000-4000-8000-0000000000d1' })
    );
    const caller = buildCaller(makeCtx(['mayor']), deps);
    const input = {
      delegationId: '00000000-0000-4000-8000-0000000000d1',
    };

    await expect(caller.organization.revokeDesignationGrantEarly(input)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
