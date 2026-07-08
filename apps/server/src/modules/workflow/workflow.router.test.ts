import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createWorkflowRouter } from './workflow.router.js';
import type { Context, AuthContext } from '../iam/iam.types.js';

// ─── Mocks ──────────────────────────────────────────────────────────────

// Mock the action and approval engine handlers to break the transitive
// json-logic-js dependency (step-resolution.ts → transition-evaluation.ts →
// json-logic-js is not installed in the test environment).
const mockSubmitStepAction = vi.fn().mockResolvedValue(undefined);
const mockSubmitStepApproval = vi.fn().mockResolvedValue(undefined);

vi.mock('./engine/step-handlers/action.handler.js', () => ({
  submitStepAction: (...args: any[]) => mockSubmitStepAction(...args),
  autoCompleteActionStep: vi.fn(),
}));

vi.mock('./engine/step-handlers/approval.handler.js', () => ({
  submitStepApproval: (...args: any[]) => mockSubmitStepApproval(...args),
}));

const mockSubmitCommitteeReport = vi.fn().mockResolvedValue(undefined);
const mockSubmitStepMultiReferral = vi.fn().mockResolvedValue(undefined);

vi.mock('./engine/step-handlers/multi-referral.handler.js', () => ({
  submitCommitteeReport: (...args: any[]) => mockSubmitCommitteeReport(...args),
  submitStepMultiReferral: (...args: any[]) => mockSubmitStepMultiReferral(...args),
}));

// Also break the transitive dep for step-resolution used by the handlers.
vi.mock('./engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

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

// ─────────────────────────────────────────────────────────────────────────────
// Mutation Procedures
// ─────────────────────────────────────────────────────────────────────────────

describe('Workflow Router Mutation Procedures', () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  // Shared fixture UUIDs
  const STEP_INSTANCE_ID = '55555555-5555-5555-5555-555555555555';
  const INSTANCE_ID = '66666666-6666-6666-6666-666666666666';
  const DOCUMENT_ID = '77777777-7777-7777-7777-777777777777';
  const STEP_ID = '88888888-8888-8888-8888-888888888888';
  const ENCODER_USER_ID = '99999999-9999-9999-9999-999999999999';

  /** A single joined row returned by fetchStepContext's query */
  function makeStepContextRow(overrides: {
    stepType?: string;
    stepStatus?: string;
    assignedTo?: any[];
    metadata?: Record<string, any>;
    isFinalApproval?: boolean;
    instanceCreatedBy?: string;
    documentCreatedBy?: string;
  } = {}) {
    return [
      {
        stepInstance: {
          id: STEP_INSTANCE_ID,
          stepId: STEP_ID,
          instanceId: INSTANCE_ID,
          status: overrides.stepStatus ?? 'active',
          assignedTo: overrides.assignedTo ?? [{ user_id: USER_ID }],
          metadata: overrides.metadata ?? {},
          deletedAt: null,
        },
        step: {
          id: STEP_ID,
          stepType: overrides.stepType ?? 'action',
          stepKey: 'dept_review',
          config: overrides.isFinalApproval
            ? { is_final_approval: true, allowed_outcomes: ['APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION'] }
            : { allowed_outcomes: ['APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION'] },
        },
        instance: {
          id: INSTANCE_ID,
          documentId: DOCUMENT_ID,
          definitionVersionId: VALID_UUID,
          createdBy: overrides.instanceCreatedBy ?? ENCODER_USER_ID,
          status: 'active',
          cityId: CITY_ID,
        },
        doc: {
          id: DOCUMENT_ID,
          ownedByOfficeId: OWN_OFFICE,
          classificationLevel: 'internal',
          createdBy: overrides.documentCreatedBy ?? ENCODER_USER_ID,
          cityId: CITY_ID,
        },
      },
    ];
  }

  beforeEach(() => {
    mockDb = makeMockDb();
    mockSubmitStepAction.mockClear();
    mockSubmitStepApproval.mockClear();
    mockSubmitCommitteeReport.mockClear();
    mockSubmitStepMultiReferral.mockClear();
  });

  // ── completeActionStep ────────────────────────────────────────────────────

  describe('completeActionStep', () => {
    it('throws NOT_FOUND when step instance does not exist', async () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      // fetchStepContext query returns empty
      mockDb.mockResponse([]);

      await expect(
        caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws FORBIDDEN when user role is not permitted for action steps', async () => {
      // records_officer is not in ACTION_STEP_ROLES
      const subject = makeSubject({ roles: ['records_officer'], effectiveRoles: ['records_officer'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(makeStepContextRow());

      await expect(
        caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('throws FORBIDDEN when user is not the assignee (encoder restriction)', async () => {
      // dept_encoder can only complete steps they are directly assigned to
      const subject = makeSubject({
        roles: ['dept_encoder'],
        effectiveRoles: ['dept_encoder'],
        userId: 'some-other-user',
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      // Step is assigned to USER_ID, caller is some-other-user, document created by ENCODER_USER_ID
      mockDb.mockResponse(
        makeStepContextRow({ assignedTo: [{ user_id: USER_ID }] })
      );

      await expect(
        caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('throws FORBIDDEN when non-encoder user is not assigned and no office match', async () => {
      const subject = makeSubject({
        roles: ['dept_approver'],
        effectiveRoles: ['dept_approver'],
        effectiveOfficeIds: ['different-office'],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({ assignedTo: [{ user_id: 'other-user', office_id: OWN_OFFICE }] })
      );

      await expect(
        caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('succeeds and calls submitStepAction for direct assignee', async () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      // fetchStepContext returns step assigned to USER_ID
      mockDb.mockResponse(makeStepContextRow({ assignedTo: [{ user_id: USER_ID }] }));
      // transaction mock is already set up in makeMockDb

      const result = await caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID, comment: 'Done.' });

      expect(result.success).toBe(true);
      expect(mockSubmitStepAction).toHaveBeenCalledOnce();
    });

    it('succeeds for dept_approver with office-queue assignment', async () => {
      const subject = makeSubject({
        roles: ['dept_approver'],
        effectiveRoles: ['dept_approver'],
        effectiveOfficeIds: [OWN_OFFICE],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({ assignedTo: [{ office_id: OWN_OFFICE }] })
      );

      const result = await caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID });
      expect(result.success).toBe(true);
      expect(mockSubmitStepAction).toHaveBeenCalledOnce();
    });
  });

  // ── approveStep ───────────────────────────────────────────────────────────

  describe('approveStep', () => {
    it('throws NOT_FOUND when step instance does not exist', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([]);

      await expect(
        caller.approveStep({ stepInstanceId: STEP_INSTANCE_ID })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws FORBIDDEN when dept_encoder tries to approve (not in APPROVAL_STEP_ROLES)', async () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(makeStepContextRow({ stepType: 'approval' }));

      await expect(
        caller.approveStep({ stepInstanceId: STEP_INSTANCE_ID })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('throws FORBIDDEN (Invariant #13) when approver is same as document creator on final approval step', async () => {
      // USER_ID is both the caller and the document creator
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({
          stepType: 'approval',
          assignedTo: [{ user_id: USER_ID }],
          isFinalApproval: true,
          documentCreatedBy: USER_ID, // same as caller
        })
      );

      await expect(
        caller.approveStep({ stepInstanceId: STEP_INSTANCE_ID })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('throws FORBIDDEN when step type is not approval', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      // stepType = 'action' — policy guard should reject
      mockDb.mockResponse(makeStepContextRow({ stepType: 'action', assignedTo: [{ user_id: USER_ID }] }));

      await expect(
        caller.approveStep({ stepInstanceId: STEP_INSTANCE_ID })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('succeeds for authorized approver and calls submitStepApproval with APPROVED', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ user_id: USER_ID }] })
      );

      const result = await caller.approveStep({ stepInstanceId: STEP_INSTANCE_ID, comment: 'Looks good.' });

      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval).toHaveBeenCalledOnce();
      // Third positional arg (after instance, stepInstance, actorId, actorType) is outcome
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('APPROVED');
    });
  });

  // ── rejectStep ────────────────────────────────────────────────────────────

  describe('rejectStep', () => {
    it('requires a non-empty comment (Zod-enforced)', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      await expect(
        caller.rejectStep({ stepInstanceId: STEP_INSTANCE_ID, comment: '' })
      ).rejects.toThrow();
    });

    it('succeeds and calls submitStepApproval with REJECTED', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ user_id: USER_ID }] })
      );

      const result = await caller.rejectStep({ stepInstanceId: STEP_INSTANCE_ID, comment: 'Not compliant.' });

      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval).toHaveBeenCalledOnce();
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('REJECTED');
    });
  });

  // ── returnStepForRevision ─────────────────────────────────────────────────

  describe('returnStepForRevision', () => {
    it('requires a non-empty comment (Zod-enforced)', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      await expect(
        caller.returnStepForRevision({ stepInstanceId: STEP_INSTANCE_ID, comment: '' })
      ).rejects.toThrow();
    });

    it('succeeds and calls submitStepApproval with RETURNED_FOR_REVISION', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ user_id: USER_ID }] })
      );

      const result = await caller.returnStepForRevision({
        stepInstanceId: STEP_INSTANCE_ID,
        comment: 'Missing attachments.',
      });

      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval).toHaveBeenCalledOnce();
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('RETURNED_FOR_REVISION');
    });
  });

  // ── submitCommitteeReport ──────────────────────────────────────────────────

  describe('submitCommitteeReport', () => {
    it('throws FORBIDDEN if sp_member is not in assigned committees', async () => {
      const subject = makeSubject({
        roles: ['sp_member'],
        effectiveRoles: ['sp_member'],
        committeeIds: ['22222222-2222-2222-2222-222222222222'],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({
          stepType: 'multi_referral',
          metadata: { assigned_committees: [{ committee_id: '11111111-1111-1111-1111-111111111111' }] },
        })
      );

      await expect(
        caller.submitCommitteeReport({
          stepInstanceId: STEP_INSTANCE_ID,
          committeeId: '11111111-1111-1111-1111-111111111111',
          reportText: 'Test report',
        })
      ).rejects.toThrow(/You are not a member of any committee assigned/);
    });

    it('succeeds for assigned sp_member and does not complete if not last', async () => {
      const subject = makeSubject({
        roles: ['sp_member'],
        effectiveRoles: ['sp_member'],
        committeeIds: ['11111111-1111-1111-1111-111111111111'],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      // First query: fetch context
      mockDb.mockResponse(
        makeStepContextRow({
          stepType: 'multi_referral',
          metadata: { assigned_committees: [{ committee_id: '11111111-1111-1111-1111-111111111111' }, { committee_id: '33333333-3333-3333-3333-333333333333' }] },
        })
      );

      // Second query: fetch updated instance in transaction
      mockDb.mockResponse([{
        id: STEP_INSTANCE_ID,
        metadata: {
          assigned_committees: [{ committee_id: '11111111-1111-1111-1111-111111111111' }, { committee_id: '33333333-3333-3333-3333-333333333333' }],
          submissions: [{ committee_id: '11111111-1111-1111-1111-111111111111' }], // only 1 submission
        },
      }]);

      const result = await caller.submitCommitteeReport({
        stepInstanceId: STEP_INSTANCE_ID,
        committeeId: '11111111-1111-1111-1111-111111111111',
        reportText: 'Test report',
      });

      expect(result.allCommitteesSubmitted).toBe(false);
      expect(mockSubmitCommitteeReport).toHaveBeenCalledOnce();
      expect(mockSubmitStepMultiReferral).not.toHaveBeenCalled();
    });

    it('completes step and calls submitStepMultiReferral if last committee submits', async () => {
      const subject = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      // First query: fetch context
      mockDb.mockResponse(
        makeStepContextRow({
          stepType: 'multi_referral',
          metadata: { assigned_committees: [{ committee_id: '11111111-1111-1111-1111-111111111111' }] },
        })
      );

      // Second query: fetch updated instance in transaction
      mockDb.mockResponse([{
        id: STEP_INSTANCE_ID,
        metadata: {
          assigned_committees: [{ committee_id: '11111111-1111-1111-1111-111111111111' }],
          submissions: [{ committee_id: '11111111-1111-1111-1111-111111111111' }], // all assigned submitted
        },
      }]);

      const result = await caller.submitCommitteeReport({
        stepInstanceId: STEP_INSTANCE_ID,
        committeeId: '11111111-1111-1111-1111-111111111111',
        reportText: 'Test report',
      });

      expect(result.allCommitteesSubmitted).toBe(true);
      expect(mockSubmitCommitteeReport).toHaveBeenCalledOnce();
      expect(mockSubmitStepMultiReferral).toHaveBeenCalledOnce();
      expect(mockSubmitStepMultiReferral.mock.calls[0]![4]).toBe('REPORT_ACCEPTED');
    });
  });

  // ── manuallyAdvanceMultiReferralStep ───────────────────────────────────────

  describe('manuallyAdvanceMultiReferralStep', () => {
    it('throws FORBIDDEN for non-secretary', async () => {
      const subject = makeSubject({ roles: ['sp_presiding_officer'], effectiveRoles: ['sp_presiding_officer'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(makeStepContextRow({ stepType: 'multi_referral' }));

      await expect(
        caller.manuallyAdvanceMultiReferralStep({
          stepInstanceId: STEP_INSTANCE_ID,
          mandatoryComment: 'Override',
        })
      ).rejects.toThrow(/Only the SP Secretary/);
    });

    it('succeeds for sp_secretary', async () => {
      const subject = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(makeStepContextRow({ stepType: 'multi_referral' }));

      const result = await caller.manuallyAdvanceMultiReferralStep({
        stepInstanceId: STEP_INSTANCE_ID,
        mandatoryComment: 'Force complete',
      });

      expect(result.success).toBe(true);
      expect(mockSubmitStepMultiReferral).toHaveBeenCalledOnce();
      expect(mockSubmitStepMultiReferral.mock.calls[0]![4]).toBe('SECRETARY_ADVANCED');
      expect(mockSubmitStepMultiReferral.mock.calls[0]![5]).toBe('Force complete');
    });
  });
});
