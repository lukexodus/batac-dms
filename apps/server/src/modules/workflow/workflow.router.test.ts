import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createWorkflowRouter } from './workflow.router.js';
import type { Context, AuthContext } from '../iam/iam.types.js';

const CITY_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '44444444-4444-4444-4444-444444444444';
const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const OTHER_OFFICE = '22222222-2222-2222-2222-222222222222';
const OWN_OFFICE = 'office-1';

function makeSubject(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: USER_ID,
    sessionId: 'session-1',
    officeId: OWN_OFFICE,
    cityId: CITY_ID,
    roles: ['dept_encoder'],
    permissions: [],
    committeeIds: [],
    delegationGrantId: null,
    effectiveOfficeIds: [OWN_OFFICE],
    effectiveRoles: ['dept_encoder'],
    isItAdmin: false,
    isPlatformAdmin: false,
    ...overrides,
  };
}

function makeMockDb() {
  const responses: any[] = [];
  const db: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    transaction: vi.fn().mockImplementation(async (cb) => {
      return await cb(db);
    }),
    then: vi.fn().mockImplementation((onFulfilled) => {
      const val = responses.shift();
      return Promise.resolve(val).then(onFulfilled);
    }),
    mockResponse: (val: any) => {
      responses.push(val);
    },
  };
  return db;
}

function makeCtx(subject: AuthContext, db: ReturnType<typeof makeMockDb>): Context {
  return {
    auth: subject,
    db: db as any,
    req: {
      server: {},
    } as any,
  };
}

const t = initTRPC.context<Context>().create();
const callerFactory = t.createCallerFactory(t.router({ workflow: createWorkflowRouter() }));

function callerFor(ctx: Context) {
  return callerFactory(ctx).workflow;
}

describe('Workflow Router Read Procedures', () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  describe('getInstance', () => {
    it('throws NOT_FOUND when instance does not exist', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([]); // 1. instance select -> empty

      await expect(
        caller.getInstance({ instanceId: VALID_UUID })
      ).rejects.toThrowError(/Workflow instance not found/);
    });

    it('allows read when user has operational role in own office', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: VALID_UUID, documentId: VALID_UUID, status: 'active', definitionVersionId: VALID_UUID }]); // 1. instance
      mockDb.mockResponse([{ id: VALID_UUID, ownedByOfficeId: OWN_OFFICE, classificationLevel: 'internal' }]); // 2. parent document
      mockDb.mockResponse([{ stepInstanceId: VALID_UUID, stepType: 'approval', assignedTo: [{ user_id: USER_ID }] }]); // 3. current steps lookup
      mockDb.mockResponse([]); // 4. all steps lookup (for lapse status)

      const result = await caller.getInstance({ instanceId: VALID_UUID });

      expect(result.instanceId).toBe(VALID_UUID);
      expect(result.status).toBe('Active');
      expect(result.currentStepType).toBe('approval');
    });

    it('denies read when user has operational role in another office', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: VALID_UUID, documentId: VALID_UUID, status: 'active' }]);
      mockDb.mockResponse([{ id: VALID_UUID, ownedByOfficeId: OTHER_OFFICE, classificationLevel: 'internal' }]);

      await expect(
        caller.getInstance({ instanceId: VALID_UUID })
      ).rejects.toThrowError(/You do not have permission/);
    });

    it('allows read for SP secretary on SP document in other office scope', async () => {
      const subject = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: VALID_UUID, documentId: VALID_UUID, status: 'active', definitionVersionId: VALID_UUID }]);
      mockDb.mockResponse([{ id: VALID_UUID, ownedByOfficeId: OTHER_OFFICE, classificationLevel: 'internal' }]);
      mockDb.mockResponse([{ code: 'SP' }]); // 3. offices select (check SP code)
      mockDb.mockResponse([{ stepInstanceId: VALID_UUID, stepType: 'action', assignedTo: [] }]); // 4. current steps
      mockDb.mockResponse([]); // 5. lapse status check

      const result = await caller.getInstance({ instanceId: VALID_UUID });
      expect(result.instanceId).toBe(VALID_UUID);
    });

    it('allows cross-office read for senior roles on public/internal documents', async () => {
      const subject = makeSubject({ roles: ['mayor'], effectiveRoles: ['mayor'], effectiveOfficeIds: ['mayor-office'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: VALID_UUID, documentId: VALID_UUID, status: 'active', definitionVersionId: VALID_UUID }]);
      mockDb.mockResponse([{ id: VALID_UUID, ownedByOfficeId: OTHER_OFFICE, classificationLevel: 'internal' }]); // internal document
      mockDb.mockResponse([{ stepInstanceId: VALID_UUID, stepType: 'decision', assignedTo: [] }]);
      mockDb.mockResponse([]);

      const result = await caller.getInstance({ instanceId: VALID_UUID });
      expect(result.instanceId).toBe(VALID_UUID);
    });

    it('denies cross-office read for senior roles on confidential/restricted documents', async () => {
      const subject = makeSubject({ roles: ['mayor'], effectiveRoles: ['mayor'], effectiveOfficeIds: ['mayor-office'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: VALID_UUID, documentId: VALID_UUID, status: 'active' }]);
      mockDb.mockResponse([{ id: VALID_UUID, ownedByOfficeId: OTHER_OFFICE, classificationLevel: 'confidential' }]); // confidential

      await expect(
        caller.getInstance({ instanceId: VALID_UUID })
      ).rejects.toThrowError(/You do not have permission/);
    });
  });

  describe('getActiveInstanceForDocument', () => {
    it('returns null if no active instance exists', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([]); // 1. active instance check -> empty

      const result = await caller.getActiveInstanceForDocument({ documentId: VALID_UUID });
      expect(result).toBeNull();
    });

    it('returns active instance when authorized', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: VALID_UUID, documentId: VALID_UUID, status: 'active', definitionVersionId: VALID_UUID }]);
      mockDb.mockResponse([{ id: VALID_UUID, ownedByOfficeId: OWN_OFFICE, classificationLevel: 'public' }]);
      mockDb.mockResponse([{ stepInstanceId: VALID_UUID, stepType: 'action', assignedTo: [] }]);
      mockDb.mockResponse([]);

      const result = await caller.getActiveInstanceForDocument({ documentId: VALID_UUID });
      expect(result).not.toBeNull();
      expect(result?.instanceId).toBe(VALID_UUID);
    });
  });

  describe('listMyAssignedSteps', () => {
    it('returns steps assigned directly to user', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      // 1. mock step instances select returns two steps
      mockDb.mockResponse([
        {
          stepInstanceId: 'step-1',
          instanceId: VALID_UUID,
          documentId: VALID_UUID,
          documentTitle: 'Title 1',
          stepType: 'action',
          assignedTo: [{ user_id: USER_ID }],
          createdAt: new Date(),
          slaDeadline: null,
          documentOfficeId: OWN_OFFICE,
        },
        {
          stepInstanceId: 'step-2',
          instanceId: VALID_UUID,
          documentId: VALID_UUID,
          documentTitle: 'Title 2',
          stepType: 'approval',
          assignedTo: [{ user_id: 'other-user' }],
          createdAt: new Date(),
          slaDeadline: null,
          documentOfficeId: OWN_OFFICE,
        },
      ]);
      // 2. mock offices select
      mockDb.mockResponse([]);

      const result = await caller.listMyAssignedSteps({});
      expect(result.items.length).toBe(1);
      expect(result.items[0]?.stepInstanceId).toBe('step-1');
    });

    it('returns steps assigned to user office when user has operational role', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([
        {
          stepInstanceId: 'step-1',
          instanceId: VALID_UUID,
          documentId: VALID_UUID,
          documentTitle: 'Title 1',
          stepType: 'action',
          assignedTo: [{ office_id: OWN_OFFICE }],
          createdAt: new Date(),
          slaDeadline: null,
          documentOfficeId: OWN_OFFICE,
        },
        {
          stepInstanceId: 'step-2',
          instanceId: VALID_UUID,
          documentId: VALID_UUID,
          documentTitle: 'Title 2',
          stepType: 'action',
          assignedTo: [{ office_id: OTHER_OFFICE }],
          createdAt: new Date(),
          slaDeadline: null,
          documentOfficeId: OWN_OFFICE,
        },
      ]);
      mockDb.mockResponse([]);

      const result = await caller.listMyAssignedSteps({});
      expect(result.items.length).toBe(1);
      expect(result.items[0]?.stepInstanceId).toBe('step-1');
    });
  });

  describe('getSlaComplianceData', () => {
    it('throws FORBIDDEN for non-authorized roles', async () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      await expect(
        caller.getSlaComplianceData({})
      ).rejects.toThrowError(/You do not have permission/);
    });

    it('returns calculated SLA compliance data', async () => {
      const subject = makeSubject({ roles: ['mayor'], effectiveRoles: ['mayor'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([
        {
          instanceId: VALID_UUID,
          documentId: VALID_UUID,
          status: 'active',
          context: {},
          slaDeadline: new Date('2026-07-20'),
          slaBreachedAt: null,
          startedAt: new Date('2026-07-01'),
          completedAt: null,
          documentTypeCode: 'SP_RESOLUTION',
        },
      ]);

      const result = await caller.getSlaComplianceData({});
      expect(result.length).toBe(1);
      expect(result[0]?.slaClassification).toBe('complex');
      expect(result[0]?.slaThresholdDays).toBe(7);
      expect(result[0]?.isBreached).toBe(false);
    });
  });
});
