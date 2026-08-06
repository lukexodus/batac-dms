import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initTRPC, TRPCError } from '@trpc/server';
import { createWorkflowRouter } from './workflow.router.js';
import type { Context, AuthContext } from '../iam/iam.types.js';
import { WorkflowRepository } from './workflow.repository.js';

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
const USER_ID = '44444444-4444-4444-8444-444444444444';
const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const OTHER_OFFICE = '22222222-2222-4222-8222-222222222222';
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
      server: {
        organizationService: {
          getOfficeByCode: vi.fn().mockResolvedValue({ officeId: 'sps-123' }),
        },
      },
    } as any,
    requestId: 'test-request-id',
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

      await expect(caller.getInstance({ instanceId: VALID_UUID })).rejects.toThrowError(
        /Workflow instance not found/,
      );
    });

    it('allows read when user has operational role in own office', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([
        {
          id: VALID_UUID,
          documentId: VALID_UUID,
          status: 'active',
          definitionVersionId: VALID_UUID,
          slaDeadline: null,
        },
      ]); // 1. instance
      mockDb.mockResponse([
        { id: VALID_UUID, ownedByOfficeId: OWN_OFFICE, classificationLevel: 'internal' },
      ]); // 2. parent document
      mockDb.mockResponse([
        { stepInstanceId: VALID_UUID, stepType: 'approval', assignedTo: [{ user_id: USER_ID }] },
      ]); // 3. current steps lookup
      mockDb.mockResponse([]); // 4. resolveAssigneeName lookup for the first assignee's user_id
      mockDb.mockResponse([]); // 5. all steps lookup (for lapse status)

      const result = await caller.getInstance({ instanceId: VALID_UUID });

      expect(result.instanceId).toBe(VALID_UUID);
      expect(result.status).toBe('Active');
      expect(result.currentStepType).toBe('approval');
    });

    it('denies read when user has operational role in another office', async () => {
      const subject = makeSubject();
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: VALID_UUID, documentId: VALID_UUID, status: 'active' }]);
      mockDb.mockResponse([
        { id: VALID_UUID, ownedByOfficeId: OTHER_OFFICE, classificationLevel: 'internal' },
      ]);

      await expect(caller.getInstance({ instanceId: VALID_UUID })).rejects.toThrowError(
        /You do not have permission/,
      );
    });

    it('allows read for SP secretary on SP document in other office scope', async () => {
      const subject = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([
        {
          id: VALID_UUID,
          documentId: VALID_UUID,
          status: 'active',
          definitionVersionId: VALID_UUID,
          slaDeadline: null,
        },
      ]);
      mockDb.mockResponse([
        { id: VALID_UUID, ownedByOfficeId: OTHER_OFFICE, classificationLevel: 'internal' },
      ]);
      mockDb.mockResponse([{ code: 'SP' }]); // 3. offices select (check SP code)
      mockDb.mockResponse([{ stepInstanceId: VALID_UUID, stepType: 'action', assignedTo: [] }]); // 4. current steps
      mockDb.mockResponse([]); // 5. lapse status check

      const result = await caller.getInstance({ instanceId: VALID_UUID });
      expect(result.instanceId).toBe(VALID_UUID);
    });

    it('allows cross-office read for senior roles on public/internal documents', async () => {
      const subject = makeSubject({
        roles: ['mayor'],
        effectiveRoles: ['mayor'],
        effectiveOfficeIds: ['mayor-office'],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([
        {
          id: VALID_UUID,
          documentId: VALID_UUID,
          status: 'active',
          definitionVersionId: VALID_UUID,
          slaDeadline: null,
        },
      ]);
      mockDb.mockResponse([
        { id: VALID_UUID, ownedByOfficeId: OTHER_OFFICE, classificationLevel: 'internal' },
      ]); // internal document
      mockDb.mockResponse([{ stepInstanceId: VALID_UUID, stepType: 'decision', assignedTo: [] }]);
      mockDb.mockResponse([]);

      const result = await caller.getInstance({ instanceId: VALID_UUID });
      expect(result.instanceId).toBe(VALID_UUID);
    });

    it('denies cross-office read for senior roles on confidential/restricted documents', async () => {
      const subject = makeSubject({
        roles: ['mayor'],
        effectiveRoles: ['mayor'],
        effectiveOfficeIds: ['mayor-office'],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse([{ id: VALID_UUID, documentId: VALID_UUID, status: 'active' }]);
      mockDb.mockResponse([
        { id: VALID_UUID, ownedByOfficeId: OTHER_OFFICE, classificationLevel: 'confidential' },
      ]); // confidential

      await expect(caller.getInstance({ instanceId: VALID_UUID })).rejects.toThrowError(
        /You do not have permission/,
      );
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

      mockDb.mockResponse([
        {
          id: VALID_UUID,
          documentId: VALID_UUID,
          status: 'active',
          definitionVersionId: VALID_UUID,
          slaDeadline: null,
        },
      ]);
      mockDb.mockResponse([
        { id: VALID_UUID, ownedByOfficeId: OWN_OFFICE, classificationLevel: 'public' },
      ]);
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

      await expect(caller.getSlaComplianceData({})).rejects.toThrowError(
        /Your role is not permitted to access SLA compliance data/,
      );
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
  const STEP_INSTANCE_ID = '55555555-5555-4555-8555-555555555555';
  const INSTANCE_ID = '66666666-6666-4666-8666-666666666666';
  const DOCUMENT_ID = '77777777-7777-4777-8777-777777777777';
  const STEP_ID = '88888888-8888-8888-8888-888888888888';
  const ENCODER_USER_ID = '99999999-9999-4999-8999-999999999999';

  /** A single joined row returned by fetchStepContext's query */
  function makeStepContextRow(
    overrides: {
      stepType?: string;
      stepStatus?: string;
      assignedTo?: any[];
      metadata?: Record<string, any>;
      isFinalApproval?: boolean;
      instanceCreatedBy?: string;
      documentCreatedBy?: string;
    } = {},
  ) {
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
            ? {
                is_final_approval: true,
                allowed_outcomes: ['APPROVED', 'REJECTED', 'RETURNED_FOR_REVISION'],
              }
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
        caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws FORBIDDEN when user role is not permitted for action steps', async () => {
      // records_officer is not in ACTION_STEP_ROLES
      const subject = makeSubject({
        roles: ['records_officer'],
        effectiveRoles: ['records_officer'],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(makeStepContextRow());

      await expect(
        caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID }),
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
      mockDb.mockResponse(makeStepContextRow({ assignedTo: [{ user_id: USER_ID }] }));

      await expect(
        caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID }),
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
        makeStepContextRow({ assignedTo: [{ user_id: 'other-user', office_id: OWN_OFFICE }] }),
      );

      await expect(
        caller.completeActionStep({ stepInstanceId: STEP_INSTANCE_ID }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('succeeds and calls submitStepAction for direct assignee', async () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      // fetchStepContext returns step assigned to USER_ID
      mockDb.mockResponse(makeStepContextRow({ assignedTo: [{ user_id: USER_ID }] }));
      // transaction mock is already set up in makeMockDb

      const result = await caller.completeActionStep({
        stepInstanceId: STEP_INSTANCE_ID,
        comment: 'Done.',
      });

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

      mockDb.mockResponse(makeStepContextRow({ assignedTo: [{ office_id: OWN_OFFICE }] }));

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

      await expect(caller.approveStep({ stepInstanceId: STEP_INSTANCE_ID })).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('throws FORBIDDEN when dept_encoder tries to approve (not in APPROVAL_STEP_ROLES)', async () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(makeStepContextRow({ stepType: 'approval' }));

      await expect(caller.approveStep({ stepInstanceId: STEP_INSTANCE_ID })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
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
        }),
      );

      await expect(caller.approveStep({ stepInstanceId: STEP_INSTANCE_ID })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('throws FORBIDDEN when step type is not approval', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      // stepType = 'action' — policy guard should reject
      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'action', assignedTo: [{ user_id: USER_ID }] }),
      );

      await expect(caller.approveStep({ stepInstanceId: STEP_INSTANCE_ID })).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    });

    it('succeeds for authorized approver and calls submitStepApproval with APPROVED', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ user_id: USER_ID }] }),
      );

      const result = await caller.approveStep({
        stepInstanceId: STEP_INSTANCE_ID,
        comment: 'Looks good.',
      });

      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval).toHaveBeenCalledOnce();
      // Third positional arg (after instance, stepInstance, actorId, actorType) is outcome
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('APPROVED');
    });
  });

  // ── logSecretariatDecision ────────────────────────────────────────────────
  describe('logSecretariatDecision', () => {
    it('throws FORBIDDEN when user does not have sp_secretary role', async () => {
      const subject = makeSubject({ roles: ['dept_encoder'], effectiveRoles: ['dept_encoder'] });
      const ctx = makeCtx(subject, mockDb);
      (ctx.req.server as any).organizationService = {
        getOfficeByCode: vi.fn().mockResolvedValue({ officeId: 'sps-123' }),
      };
      const caller = callerFor(ctx);

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ office_id: 'sps-123' }] }),
      );

      await expect(
        caller.logSecretariatDecision({
          documentId: VALID_UUID,
          stepInstanceId: STEP_INSTANCE_ID,
          decision: 'approve',
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN', message: /Only the SP Secretary/ });
    });

    it('throws FORBIDDEN when step is not assigned to the SP Secretariat office', async () => {
      const subject = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });
      const ctx = makeCtx(subject, mockDb);
      (ctx.req.server as any).organizationService = {
        getOfficeByCode: vi.fn().mockResolvedValue({ officeId: 'sps-123' }),
      };
      const caller = callerFor(ctx);

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ office_id: 'other-office' }] }),
      );

      await expect(
        caller.logSecretariatDecision({
          documentId: VALID_UUID,
          stepInstanceId: STEP_INSTANCE_ID,
          decision: 'approve',
        }),
      ).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: /not assigned to the SP Secretariat office/,
      });
    });

    it('succeeds for sp_secretary in correct office and passes APPROVED to handler', async () => {
      const subject = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });
      const ctx = makeCtx(subject, mockDb);
      (ctx.req.server as any).organizationService = {
        getOfficeByCode: vi.fn().mockResolvedValue({ officeId: 'sps-123' }),
      };
      const caller = callerFor(ctx);

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ office_id: 'sps-123' }] }),
      );

      const result = await caller.logSecretariatDecision({
        documentId: VALID_UUID,
        stepInstanceId: STEP_INSTANCE_ID,
        decision: 'approve',
      });
      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval).toHaveBeenCalledOnce();
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('APPROVED');
    });

    it('succeeds for sp_secretary and passes AMENDED to handler', async () => {
      const subject = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });
      const ctx = makeCtx(subject, mockDb);
      (ctx.req.server as any).organizationService = {
        getOfficeByCode: vi.fn().mockResolvedValue({ officeId: 'sps-123' }),
      };
      const caller = callerFor(ctx);

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ office_id: 'sps-123' }] }),
      );

      const result = await caller.logSecretariatDecision({
        documentId: VALID_UUID,
        stepInstanceId: STEP_INSTANCE_ID,
        decision: 'amended',
        remarks: 'Fix typos',
      });
      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('AMENDED');
      expect(mockSubmitStepApproval.mock.calls[0]![5]).toBe('Fix typos');
    });
  });

  // ── rejectStep ────────────────────────────────────────────────────────────

  describe('rejectStep', () => {
    it('requires a non-empty comment (Zod-enforced)', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      await expect(
        caller.rejectStep({ stepInstanceId: STEP_INSTANCE_ID, comment: '' }),
      ).rejects.toThrow();
    });

    it('succeeds and calls submitStepApproval with REJECTED', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ user_id: USER_ID }] }),
      );

      const result = await caller.rejectStep({
        stepInstanceId: STEP_INSTANCE_ID,
        comment: 'Not compliant.',
      });

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
        caller.returnStepForRevision({ stepInstanceId: STEP_INSTANCE_ID, comment: '' }),
      ).rejects.toThrow();
    });

    it('succeeds and calls submitStepApproval with RETURNED_FOR_REVISION', async () => {
      const subject = makeSubject({ roles: ['dept_approver'], effectiveRoles: ['dept_approver'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({ stepType: 'approval', assignedTo: [{ user_id: USER_ID }] }),
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
        committeeIds: ['22222222-2222-4222-8222-222222222222'],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({
          stepType: 'multi_referral',
          metadata: {
            assigned_committees: [{ committee_id: '11111111-1111-4111-8111-111111111111' }],
          },
        }),
      );

      await expect(
        caller.submitCommitteeReport({
          stepInstanceId: STEP_INSTANCE_ID,
          committeeId: '11111111-1111-4111-8111-111111111111',
          reportText: 'Test report',
        }),
      ).rejects.toThrow(/You are not a member of any committee assigned/);
    });

    it('succeeds for assigned sp_member and does not complete if not last', async () => {
      const subject = makeSubject({
        roles: ['sp_member'],
        effectiveRoles: ['sp_member'],
        committeeIds: ['11111111-1111-4111-8111-111111111111'],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      // First query: fetch context
      mockDb.mockResponse(
        makeStepContextRow({
          stepType: 'multi_referral',
          metadata: {
            assigned_committees: [
              { committee_id: '11111111-1111-4111-8111-111111111111' },
              { committee_id: '33333333-3333-4333-8333-333333333333' },
            ],
          },
        }),
      );

      // Second query: fetch updated instance in transaction
      mockDb.mockResponse([
        {
          id: STEP_INSTANCE_ID,
          metadata: {
            assigned_committees: [
              { committee_id: '11111111-1111-4111-8111-111111111111' },
              { committee_id: '33333333-3333-4333-8333-333333333333' },
            ],
            submissions: [{ committee_id: '11111111-1111-4111-8111-111111111111' }], // only 1 submission
          },
        },
      ]);

      const result = await caller.submitCommitteeReport({
        stepInstanceId: STEP_INSTANCE_ID,
        committeeId: '11111111-1111-4111-8111-111111111111',
        reportText: 'Test report',
      });

      expect(result.allCommitteesSubmitted).toBe(false);
      expect(mockSubmitCommitteeReport).toHaveBeenCalledOnce();
      expect(mockSubmitStepMultiReferral).not.toHaveBeenCalled();
    });

    it('returns allCommitteesSubmitted = true when last committee submits, but does NOT complete the step', async () => {
      const subject = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      // First query: fetch context
      mockDb.mockResponse(
        makeStepContextRow({
          stepType: 'multi_referral',
          metadata: {
            assigned_committees: [{ committee_id: '11111111-1111-4111-8111-111111111111' }],
          },
        }),
      );

      // Second query: fetch updated instance in transaction
      mockDb.mockResponse([
        {
          id: STEP_INSTANCE_ID,
          metadata: {
            assigned_committees: [{ committee_id: '11111111-1111-4111-8111-111111111111' }],
            submissions: [{ committee_id: '11111111-1111-4111-8111-111111111111' }], // all assigned submitted
          },
        },
      ]);

      const result = await caller.submitCommitteeReport({
        stepInstanceId: STEP_INSTANCE_ID,
        committeeId: '11111111-1111-4111-8111-111111111111',
        reportText: 'Test report',
      });

      expect(result.allCommitteesSubmitted).toBe(true);
      expect(mockSubmitCommitteeReport).toHaveBeenCalledOnce();
      expect(mockSubmitStepMultiReferral).not.toHaveBeenCalled();
    });
  });

  // ── acceptUnifiedReport ────────────────────────────────────────────────────

  describe('acceptUnifiedReport', () => {
    it('throws FORBIDDEN for non-secretary', async () => {
      const subject = makeSubject({ roles: ['sp_member'], effectiveRoles: ['sp_member'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(
        makeStepContextRow({
          stepType: 'multi_referral',
          stepStatus: 'active',
        }),
      );

      await expect(
        caller.acceptUnifiedReport({
          instanceId: INSTANCE_ID,
          stepInstanceId: STEP_INSTANCE_ID,
          unifiedReportDocumentId: VALID_UUID,
        }),
      ).rejects.toThrow(/Only the SP Secretary can accept/);
    });

    it('successfully calls submitStepMultiReferral with REPORT_ACCEPTED for secretary', async () => {
      const subject = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });
      const caller = callerFor(makeCtx(subject, mockDb));

      // First query: fetch context
      mockDb.mockResponse(
        makeStepContextRow({
          stepType: 'multi_referral',
          stepStatus: 'active',
        }),
      );

      // Second query: fetch fresh instance in transaction
      mockDb.mockResponse([
        {
          id: STEP_INSTANCE_ID,
          metadata: {
            assigned_committees: [{ committee_id: '11111111-1111-4111-8111-111111111111' }],
            submissions: [{ committee_id: '11111111-1111-4111-8111-111111111111' }], // all submitted
          },
        },
      ]);

      // Third query: updateStepInstance
      mockDb.mockResponse([
        {
          id: STEP_INSTANCE_ID,
        },
      ]);

      const result = await caller.acceptUnifiedReport({
        instanceId: INSTANCE_ID,
        stepInstanceId: STEP_INSTANCE_ID,
        unifiedReportDocumentId: VALID_UUID,
      });

      expect(result.success).toBe(true);
      expect(mockSubmitStepMultiReferral).toHaveBeenCalledOnce();
      expect(mockSubmitStepMultiReferral.mock.calls[0]![4]).toBe('REPORT_ACCEPTED');
    });
  });

  // ── manuallyAdvanceMultiReferralStep ───────────────────────────────────────

  describe('manuallyAdvanceMultiReferralStep', () => {
    it('throws FORBIDDEN for non-secretary', async () => {
      const subject = makeSubject({
        roles: ['sp_presiding_officer'],
        effectiveRoles: ['sp_presiding_officer'],
      });
      const caller = callerFor(makeCtx(subject, mockDb));

      mockDb.mockResponse(makeStepContextRow({ stepType: 'multi_referral' }));

      await expect(
        caller.manuallyAdvanceMultiReferralStep({
          stepInstanceId: STEP_INSTANCE_ID,
          mandatoryComment: 'Override',
        }),
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

// ─────────────────────────────────────────────────────────────────────────────
// TASK-WF-021: Mayor/Panlalawigan/Publication Lapse Procedures
// ─────────────────────────────────────────────────────────────────────────────

// Mock WorkflowRepository methods using spies so we don't break other tests that use the real class
const mockLockStepInstanceForUpdate = vi.fn();
const mockUpdateStepInstance = vi.fn().mockResolvedValue({});
const mockCreateWorkflowEvent = vi.fn().mockResolvedValue({});
const mockUpdateInstanceContext = vi.fn().mockResolvedValue(undefined);
const mockGetInstanceById = vi.fn();
const mockGetActiveInstanceForDocument = vi.fn();

describe('TASK-WF-021 Procedures', () => {
  let mockDb: ReturnType<typeof makeMockDb>;

  const STEP_INSTANCE_ID = '55555555-5555-4555-8555-555555555555';
  const INSTANCE_ID = '66666666-6666-4666-8666-666666666666';
  const DOCUMENT_ID = '77777777-7777-4777-8777-777777777777';
  const STEP_ID = '88888888-8888-8888-8888-888888888888';
  const COMMITTEE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const CHAIR_USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  /** Default step context row for fetchStepContext (joined query via makeMockDb) */
  function makeWF021StepContextRow(
    overrides: {
      stepKey?: string;
      instanceContext?: Record<string, any>;
      metadata?: Record<string, any>;
    } = {},
  ) {
    return [
      {
        stepInstance: {
          id: STEP_INSTANCE_ID,
          stepId: STEP_ID,
          instanceId: INSTANCE_ID,
          status: 'active',
          assignedTo: [{ user_id: USER_ID }],
          metadata: overrides.metadata ?? {},
          deletedAt: null,
        },
        step: {
          id: STEP_ID,
          stepType: 'approval',
          stepKey: overrides.stepKey ?? 'panlalawigan_review',
          config: { allowed_outcomes: ['VALID', 'VALID_IN_PART', 'RETURNED'] },
        },
        instance: {
          id: INSTANCE_ID,
          documentId: DOCUMENT_ID,
          definitionVersionId: VALID_UUID,
          createdBy: USER_ID,
          status: 'active',
          cityId: CITY_ID,
          context: overrides.instanceContext ?? {},
        },
        doc: {
          id: DOCUMENT_ID,
          ownedByOfficeId: OWN_OFFICE,
          classificationLevel: 'internal',
          createdBy: USER_ID,
          cityId: CITY_ID,
        },
      },
    ];
  }

  const SP_SECRETARY = makeSubject({ roles: ['sp_secretary'], effectiveRoles: ['sp_secretary'] });

  function makeCtxWithServer(subject: AuthContext, db: ReturnType<typeof makeMockDb>) {
    return {
      auth: subject,
      db: db as any,
      requestId: 'test-req',
      req: {
        server: {
          eventBus: { emit: vi.fn() },
          organizationService: {
            getCommitteeChair: vi.fn().mockResolvedValue({ userId: CHAIR_USER_ID }),
          },
          documentsService: {
            transitionState: vi.fn().mockResolvedValue(undefined),
          },
          delegationService: {},
        } as any,
      } as any,
    };
  }

  beforeEach(() => {
    mockDb = makeMockDb();
    mockSubmitStepAction.mockClear();
    mockSubmitStepApproval.mockClear();
    mockLockStepInstanceForUpdate.mockClear();
    mockUpdateStepInstance.mockClear().mockResolvedValue({});
    mockCreateWorkflowEvent.mockClear().mockResolvedValue({});
    mockUpdateInstanceContext.mockClear().mockResolvedValue(undefined);
    mockGetInstanceById.mockClear();
    mockGetActiveInstanceForDocument.mockClear();

    vi.spyOn(WorkflowRepository.prototype, 'lockStepInstanceForUpdate').mockImplementation(
      mockLockStepInstanceForUpdate as any,
    );
    vi.spyOn(WorkflowRepository.prototype, 'updateStepInstance').mockImplementation(
      mockUpdateStepInstance as any,
    );
    vi.spyOn(WorkflowRepository.prototype, 'createWorkflowEvent').mockImplementation(
      mockCreateWorkflowEvent as any,
    );
    vi.spyOn(WorkflowRepository.prototype, 'updateInstanceContext').mockImplementation(
      mockUpdateInstanceContext as any,
    );
    vi.spyOn(WorkflowRepository.prototype, 'getInstanceById').mockImplementation(
      mockGetInstanceById as any,
    );
    vi.spyOn(WorkflowRepository.prototype, 'getActiveInstanceForDocument').mockImplementation(
      mockGetActiveInstanceForDocument as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── logMayorLapseConfirmation ──────────────────────────────────────────────

  describe('logMayorLapseConfirmation', () => {
    it('throws NOT_FOUND when step instance does not exist', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse([]); // fetchStepContext returns empty
      await expect(
        caller.logMayorLapseConfirmation({ stepInstanceId: STEP_INSTANCE_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws PRECONDITION_FAILED when no mayor_action_deadline in context', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse(makeWF021StepContextRow({ instanceContext: {} }));
      await expect(
        caller.logMayorLapseConfirmation({ stepInstanceId: STEP_INSTANCE_ID }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });

    it('is idempotent: second call returns success without creating a duplicate audit entry', async () => {
      const ctx = makeCtxWithServer(SP_SECRETARY, mockDb);
      const caller = callerFor(ctx);

      // Already-confirmed metadata
      const alreadyConfirmedMetadata = { lapse_confirmed_at: new Date().toISOString() };
      mockLockStepInstanceForUpdate.mockResolvedValue({
        id: STEP_INSTANCE_ID,
        metadata: alreadyConfirmedMetadata,
      });

      mockDb.mockResponse(
        makeWF021StepContextRow({
          instanceContext: { mayor_action_deadline: new Date(Date.now() - 86400000).toISOString() },
        }),
      );

      const result = await caller.logMayorLapseConfirmation({ stepInstanceId: STEP_INSTANCE_ID });

      expect(result).toEqual({ success: true, legalBasis: 'RA7160_S47' });
      // On idempotent path: updateStepInstance and createWorkflowEvent must NOT be called
      expect(mockUpdateStepInstance).not.toHaveBeenCalled();
      expect(mockCreateWorkflowEvent).not.toHaveBeenCalled();
    });

    it('writes audit metadata and creates workflow event on first confirmation', async () => {
      const ctx = makeCtxWithServer(SP_SECRETARY, mockDb);
      const caller = callerFor(ctx);

      // No previous confirmation
      mockLockStepInstanceForUpdate.mockResolvedValue({
        id: STEP_INSTANCE_ID,
        metadata: {},
      });

      mockDb.mockResponse(
        makeWF021StepContextRow({
          instanceContext: { mayor_action_deadline: new Date(Date.now() - 86400000).toISOString() },
        }),
      );

      const result = await caller.logMayorLapseConfirmation({ stepInstanceId: STEP_INSTANCE_ID });

      expect(result).toEqual({ success: true, legalBasis: 'RA7160_S47' });
      expect(mockUpdateStepInstance).toHaveBeenCalledOnce();
      expect(mockCreateWorkflowEvent).toHaveBeenCalledOnce();
      // Metadata should include lapse_confirmed_at and lapse_confirmed_by
      const updatedMeta = mockUpdateStepInstance.mock.calls[0]![1] as {
        metadata: Record<string, any>;
      };
      expect(updatedMeta.metadata['lapse_confirmed_at']).toBeDefined();
      expect(updatedMeta.metadata['lapse_confirmed_by']).toBe(USER_ID);
    });
  });

  // ── recordVetoOverrideVote ──────────────────────────────────────────────────

  describe('recordVetoOverrideVote', () => {
    it('throws NOT_FOUND when step instance does not exist', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse([]);
      await expect(
        caller.recordVetoOverrideVote({
          stepInstanceId: STEP_INSTANCE_ID,
          votesFor: 8,
          votesAgainst: 4,
          absentCouncilorIds: [],
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('records OVERRIDE_SUCCEEDED when votesFor >= 8', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse(makeWF021StepContextRow());
      mockGetInstanceById.mockResolvedValue({
        id: INSTANCE_ID,
        status: 'active',
        documentId: DOCUMENT_ID,
        context: {},
      });

      const result = await caller.recordVetoOverrideVote({
        stepInstanceId: STEP_INSTANCE_ID,
        votesFor: 8,
        votesAgainst: 4,
        absentCouncilorIds: [],
      });

      expect(result).toEqual({ success: true });
      expect(mockUpdateInstanceContext).toHaveBeenCalledOnce();
      const patch = mockUpdateInstanceContext.mock.calls[0]![1] as Record<string, any>;
      expect(patch['veto_override_votes_for']).toBe(8);

      expect(mockSubmitStepApproval).toHaveBeenCalledOnce();
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('OVERRIDE_SUCCEEDED');
    });

    it('records OVERRIDE_FAILED when votesFor < 8', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse(makeWF021StepContextRow());
      mockGetInstanceById.mockResolvedValue({
        id: INSTANCE_ID,
        status: 'active',
        documentId: DOCUMENT_ID,
        context: {},
      });

      const result = await caller.recordVetoOverrideVote({
        stepInstanceId: STEP_INSTANCE_ID,
        votesFor: 7,
        votesAgainst: 5,
        absentCouncilorIds: [],
      });

      expect(result).toEqual({ success: true });
      expect(mockUpdateInstanceContext).toHaveBeenCalledOnce();
      const patch = mockUpdateInstanceContext.mock.calls[0]![1] as Record<string, any>;
      expect(patch['veto_override_votes_for']).toBe(7);

      expect(mockSubmitStepApproval).toHaveBeenCalledOnce();
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('OVERRIDE_FAILED');
    });
  });

  // ── logDocketingCompletion ─────────────────────────────────────────────────

  describe('logDocketingCompletion', () => {
    it('throws NOT_FOUND when step instance does not exist', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse([]);
      await expect(
        caller.logDocketingCompletion({ stepInstanceId: STEP_INSTANCE_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('calls submitStepAction with correct args', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse(makeWF021StepContextRow({ stepKey: 'docketing' }));

      const result = await caller.logDocketingCompletion({ stepInstanceId: STEP_INSTANCE_ID });

      expect(result.success).toBe(true);
      expect(mockSubmitStepAction).toHaveBeenCalledOnce();
      // 3rd arg = actorId, 4th arg = comment (null)
      expect(mockSubmitStepAction.mock.calls[0]![2]).toBe(USER_ID);
      expect(mockSubmitStepAction.mock.calls[0]![3]).toBeNull();
    });
  });

  // ── recordPanlalawiganOutcome ──────────────────────────────────────────────

  describe('recordPanlalawiganOutcome', () => {
    it('throws NOT_FOUND when step instance does not exist', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse([]);
      await expect(
        caller.recordPanlalawiganOutcome({ stepInstanceId: STEP_INSTANCE_ID, outcome: 'VALID' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('writes panlalawigan fields to instance context and calls submitStepApproval (RETURNED outcome)', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse(makeWF021StepContextRow());

      // Inside transaction: getInstanceById returns updated instance
      const updatedInstance = {
        id: INSTANCE_ID,
        status: 'active',
        documentId: DOCUMENT_ID,
        context: { panlalawigan_outcome: 'RETURNED', panlalawigan_control_number: 'PN-001' },
      };
      mockGetInstanceById.mockResolvedValue(updatedInstance);

      const result = await caller.recordPanlalawiganOutcome({
        stepInstanceId: STEP_INSTANCE_ID,
        outcome: 'RETURNED',
        controlNumber: 'PN-001',
        panlalawiganResolutionNumber: 'RES-2026-001',
        remarks: 'Returned for corrections',
      });

      expect(result.success).toBe(true);
      // updateInstanceContext should have been called with all panlalawigan fields
      expect(mockUpdateInstanceContext).toHaveBeenCalledOnce();
      const contextPatch = mockUpdateInstanceContext.mock.calls[0]![1] as Record<string, any>;
      expect(contextPatch['panlalawigan_outcome']).toBe('RETURNED');
      expect(contextPatch['panlalawigan_control_number']).toBe('PN-001');
      expect(contextPatch['panlalawigan_resolution_number']).toBe('RES-2026-001');
      expect(contextPatch['panlalawigan_remarks']).toBe('Returned for corrections');
      // submitStepApproval called with RETURNED outcome
      expect(mockSubmitStepApproval).toHaveBeenCalledOnce();
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('RETURNED');
    });

    it('writes context and calls submitStepApproval for VALID_IN_PART outcome', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse(makeWF021StepContextRow());

      mockGetInstanceById.mockResolvedValue({
        id: INSTANCE_ID,
        status: 'active',
        documentId: DOCUMENT_ID,
        context: { panlalawigan_outcome: 'VALID_IN_PART' },
      });

      const result = await caller.recordPanlalawiganOutcome({
        stepInstanceId: STEP_INSTANCE_ID,
        outcome: 'VALID_IN_PART',
      });

      expect(result.success).toBe(true);
      const contextPatch = mockUpdateInstanceContext.mock.calls[0]![1] as Record<string, any>;
      expect(contextPatch['panlalawigan_outcome']).toBe('VALID_IN_PART');
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('VALID_IN_PART');
    });
  });

  // ── resolveValidInPart ─────────────────────────────────────────────────────

  describe('resolveValidInPart', () => {
    it('rejects empty mandatoryComment (Zod .min(1))', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      await expect(
        caller.resolveValidInPart({
          documentId: DOCUMENT_ID,
          resolutionPath: 'resolve_as_is',
          mandatoryComment: '',
        }),
      ).rejects.toThrow();
    });

    function setupResolveValidInPartMocks(
      resolutionPath:
        | 'resolve_as_is'
        | 'route_to_legal'
        | 'route_to_committee'
        | 'implement_directly',
    ) {
      const instance = {
        id: INSTANCE_ID,
        documentId: DOCUMENT_ID,
        status: 'active',
        context: { panlalawigan_outcome: 'VALID_IN_PART' },
      };
      mockGetActiveInstanceForDocument.mockResolvedValue(instance);

      // fetchStepContext: first select returns stepInstances+steps rows (valid_in_part_decision)
      mockDb.mockResponse([{ stepInstanceId: STEP_INSTANCE_ID }]); // rows query for valid_in_part_decision
      mockDb.mockResponse(makeWF021StepContextRow({ stepKey: 'valid_in_part_decision' })); // fetchStepContext

      if (resolutionPath === 'route_to_committee') {
        // committeeRows query inside transaction
        mockDb.mockResponse([
          { metadata: { assigned_committees: [{ committee_id: COMMITTEE_ID }] } },
        ]);
      }

      mockGetInstanceById.mockResolvedValue(instance);
    }

    it('resolve_as_is → maps to RESOLVED_IN_PLACE outcome and is audit-logged', async () => {
      const ctx = makeCtxWithServer(SP_SECRETARY, mockDb);
      const caller = callerFor(ctx);
      setupResolveValidInPartMocks('resolve_as_is');

      const result = await caller.resolveValidInPart({
        documentId: DOCUMENT_ID,
        resolutionPath: 'resolve_as_is',
        mandatoryComment: 'Accept as-is per SP ruling.',
      });

      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval).toHaveBeenCalledOnce();
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('RESOLVED_IN_PLACE');
      expect(mockSubmitStepApproval.mock.calls[0]![5]).toBe('Accept as-is per SP ruling.');

      expect(ctx.req.server.eventBus.emit).toHaveBeenCalledWith(
        'workflow.step.completed',
        expect.objectContaining({
          payload: expect.objectContaining({
            outcome: 'RESOLVED_IN_PLACE',
            comment: 'Accept as-is per SP ruling.',
          }),
        }),
      );
    });

    it('route_to_legal → maps to ROUTED_TO_LEGAL outcome', async () => {
      const ctx = makeCtxWithServer(SP_SECRETARY, mockDb);
      const caller = callerFor(ctx);
      setupResolveValidInPartMocks('route_to_legal');

      const result = await caller.resolveValidInPart({
        documentId: DOCUMENT_ID,
        resolutionPath: 'route_to_legal',
        mandatoryComment: 'Needs legal review.',
      });

      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('ROUTED_TO_LEGAL');
    });

    it('route_to_committee → maps to ROUTED_TO_COMMITTEE and writes referred_committee_chair_id to context', async () => {
      const ctx = makeCtxWithServer(SP_SECRETARY, mockDb);
      // Override orgService to verify it's called
      (ctx.req.server as any).organizationService.getCommitteeChair = vi
        .fn()
        .mockResolvedValue({ userId: CHAIR_USER_ID });
      const caller = callerFor(ctx);
      setupResolveValidInPartMocks('route_to_committee');

      const result = await caller.resolveValidInPart({
        documentId: DOCUMENT_ID,
        resolutionPath: 'route_to_committee',
        mandatoryComment: 'Route back to committee.',
      });

      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('ROUTED_TO_COMMITTEE');
      // updateInstanceContext should have been called with referred_committee_chair_id
      expect(mockUpdateInstanceContext).toHaveBeenCalledWith(
        INSTANCE_ID,
        expect.objectContaining({ referred_committee_chair_id: CHAIR_USER_ID }),
        expect.anything(),
      );
    });

    it('implement_directly → maps to REVISED_DIRECTLY outcome', async () => {
      const ctx = makeCtxWithServer(SP_SECRETARY, mockDb);
      const caller = callerFor(ctx);
      setupResolveValidInPartMocks('implement_directly');

      const result = await caller.resolveValidInPart({
        documentId: DOCUMENT_ID,
        resolutionPath: 'implement_directly',
        mandatoryComment: 'Secretariat will implement.',
      });

      expect(result.success).toBe(true);
      expect(mockSubmitStepApproval.mock.calls[0]![4]).toBe('REVISED_DIRECTLY');
    });
  });

  // ── confirmPanlalawiganDeemedApproved ─────────────────────────────────────

  describe('confirmPanlalawiganDeemedApproved', () => {
    it('throws NOT_FOUND when step instance does not exist', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse([]);
      await expect(
        caller.confirmPanlalawiganDeemedApproved({ stepInstanceId: STEP_INSTANCE_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws PRECONDITION_FAILED when no panlalawigan_action_deadline in context', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockDb.mockResponse(makeWF021StepContextRow({ instanceContext: {} }));
      await expect(
        caller.confirmPanlalawiganDeemedApproved({ stepInstanceId: STEP_INSTANCE_ID }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });

    it('throws PRECONDITION_FAILED when 30-day window has not yet elapsed', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      const futureDeadline = new Date(Date.now() + 86400000 * 5).toISOString(); // 5 days in future
      mockDb.mockResponse(
        makeWF021StepContextRow({
          instanceContext: { panlalawigan_action_deadline: futureDeadline },
        }),
      );
      await expect(
        caller.confirmPanlalawiganDeemedApproved({ stepInstanceId: STEP_INSTANCE_ID }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });

    it('is idempotent: second call returns success without creating a duplicate audit entry', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      const pastDeadline = new Date(Date.now() - 86400000 * 35).toISOString();
      mockDb.mockResponse(
        makeWF021StepContextRow({
          instanceContext: { panlalawigan_action_deadline: pastDeadline },
        }),
      );

      // Already confirmed
      mockLockStepInstanceForUpdate.mockResolvedValue({
        id: STEP_INSTANCE_ID,
        metadata: { deemed_approved_confirmed_at: new Date().toISOString() },
      });

      const result = await caller.confirmPanlalawiganDeemedApproved({
        stepInstanceId: STEP_INSTANCE_ID,
      });

      expect(result).toEqual({ success: true, legalBasis: 'RA7160_S56D' });
      expect(mockUpdateStepInstance).not.toHaveBeenCalled();
      expect(mockCreateWorkflowEvent).not.toHaveBeenCalled();
    });

    it('returns { success: true, legalBasis: "RA7160_S56D" } on first confirmation', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      const pastDeadline = new Date(Date.now() - 86400000 * 35).toISOString();
      mockDb.mockResponse(
        makeWF021StepContextRow({
          instanceContext: { panlalawigan_action_deadline: pastDeadline },
        }),
      );

      mockLockStepInstanceForUpdate.mockResolvedValue({
        id: STEP_INSTANCE_ID,
        metadata: {},
      });

      const result = await caller.confirmPanlalawiganDeemedApproved({
        stepInstanceId: STEP_INSTANCE_ID,
      });

      expect(result).toEqual({ success: true, legalBasis: 'RA7160_S56D' });
    });

    it('does NOT call submitStepApproval (confirmation-only procedure)', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      const pastDeadline = new Date(Date.now() - 86400000 * 35).toISOString();
      mockDb.mockResponse(
        makeWF021StepContextRow({
          instanceContext: { panlalawigan_action_deadline: pastDeadline },
        }),
      );

      mockLockStepInstanceForUpdate.mockResolvedValue({ id: STEP_INSTANCE_ID, metadata: {} });

      await caller.confirmPanlalawiganDeemedApproved({ stepInstanceId: STEP_INSTANCE_ID });

      expect(mockSubmitStepApproval).not.toHaveBeenCalled();
    });

    it('writes deemed_approved_confirmed_at and deemed_approved_confirmed_by to step metadata', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      const pastDeadline = new Date(Date.now() - 86400000 * 35).toISOString();
      mockDb.mockResponse(
        makeWF021StepContextRow({
          instanceContext: { panlalawigan_action_deadline: pastDeadline },
        }),
      );

      mockLockStepInstanceForUpdate.mockResolvedValue({ id: STEP_INSTANCE_ID, metadata: {} });

      await caller.confirmPanlalawiganDeemedApproved({ stepInstanceId: STEP_INSTANCE_ID });

      expect(mockUpdateStepInstance).toHaveBeenCalledOnce();
      const updatedMeta = mockUpdateStepInstance.mock.calls[0]![1] as {
        metadata: Record<string, any>;
      };
      expect(updatedMeta.metadata['deemed_approved_confirmed_at']).toBeDefined();
      expect(updatedMeta.metadata['deemed_approved_confirmed_by']).toBe(USER_ID);
    });
  });

  // ── recordNewspaperPublicationDate ─────────────────────────────────────────

  describe('recordNewspaperPublicationDate', () => {
    it('throws NOT_FOUND when no active workflow instance exists for document', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockGetActiveInstanceForDocument.mockResolvedValue(null);
      await expect(
        caller.recordNewspaperPublicationDate({
          documentId: DOCUMENT_ID,
          publicationDate: new Date('2026-07-01'),
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('throws PRECONDITION_FAILED for non-Ordinance document types', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockGetActiveInstanceForDocument.mockResolvedValue({
        id: INSTANCE_ID,
        documentId: DOCUMENT_ID,
      });
      mockDb.mockResponse([{ code: 'SP_RESOLUTION', metadata: {} }]); // document type lookup
      await expect(
        caller.recordNewspaperPublicationDate({
          documentId: DOCUMENT_ID,
          publicationDate: new Date('2026-07-01'),
        }),
      ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    });

    it('throws PRECONDITION_FAILED when has_penalty_provision is false', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockGetActiveInstanceForDocument.mockResolvedValue({
        id: INSTANCE_ID,
        documentId: DOCUMENT_ID,
      });
      mockDb.mockResponse([{ code: 'SP_ORDINANCE', metadata: { has_penalty_provision: false } }]); // document type lookup
      await expect(
        caller.recordNewspaperPublicationDate({
          documentId: DOCUMENT_ID,
          publicationDate: new Date('2026-07-01'),
        }),
      ).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: expect.stringContaining('penalty provision'),
      });
    });

    it('throws NOT_FOUND when no active newspaper_publication step found', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockGetActiveInstanceForDocument.mockResolvedValue({
        id: INSTANCE_ID,
        documentId: DOCUMENT_ID,
      });
      mockDb.mockResponse([{ code: 'SP_ORDINANCE', metadata: { has_penalty_provision: true } }]); // document type lookup
      mockDb.mockResponse([]); // active step query returns empty
      await expect(
        caller.recordNewspaperPublicationDate({
          documentId: DOCUMENT_ID,
          publicationDate: new Date('2026-07-01'),
        }),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('newspaper_publication step'),
      });
    });

    it('writes publication_date and publication_newspaper to context for SP_ORDINANCE', async () => {
      const ctx = makeCtxWithServer(SP_SECRETARY, mockDb);
      const caller = callerFor(ctx);
      mockGetActiveInstanceForDocument.mockResolvedValue({
        id: INSTANCE_ID,
        documentId: DOCUMENT_ID,
      });
      mockDb.mockResponse([{ code: 'SP_ORDINANCE', metadata: { has_penalty_provision: true } }]); // document type lookup
      mockDb.mockResponse([{ stepInstanceId: STEP_INSTANCE_ID }]); // active step query
      mockDb.mockResponse(makeWF021StepContextRow({ stepKey: 'newspaper_publication' })); // fetchStepContext

      const publicationDate = new Date('2026-07-09T00:00:00.000Z');
      const result = await caller.recordNewspaperPublicationDate({
        documentId: DOCUMENT_ID,
        publicationDate,
        newspaperName: 'Ilocos Times',
      });

      expect(result.success).toBe(true);
      expect(mockUpdateInstanceContext).toHaveBeenCalledOnce();
      const patch = mockUpdateInstanceContext.mock.calls[0]![1] as Record<string, any>;
      expect(patch['publication_date']).toBe('2026-07-09'); // YYYY-MM-DD only
      expect(patch['publication_newspaper']).toBe('Ilocos Times');

      expect(mockSubmitStepAction).toHaveBeenCalledOnce();
      expect(ctx.req.server.eventBus.emit).toHaveBeenCalledWith(
        'workflow.step.completed',
        expect.objectContaining({
          payload: expect.objectContaining({
            outcome: 'DONE',
          }),
        }),
      );
    });

    it('writes correct context for SP_APPROPRIATION_ORDINANCE', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockGetActiveInstanceForDocument.mockResolvedValue({
        id: INSTANCE_ID,
        documentId: DOCUMENT_ID,
      });
      mockDb.mockResponse([
        { code: 'SP_APPROPRIATION_ORDINANCE', metadata: { has_penalty_provision: true } },
      ]); // document type lookup
      mockDb.mockResponse([{ stepInstanceId: STEP_INSTANCE_ID }]); // active step query
      mockDb.mockResponse(makeWF021StepContextRow({ stepKey: 'newspaper_publication' })); // fetchStepContext

      const result = await caller.recordNewspaperPublicationDate({
        documentId: DOCUMENT_ID,
        publicationDate: new Date('2026-07-09T00:00:00.000Z'),
      });

      expect(result.success).toBe(true);
      const patch = mockUpdateInstanceContext.mock.calls[0]![1] as Record<string, any>;
      expect(patch['publication_date']).toBe('2026-07-09');
      expect(patch['publication_newspaper']).toBe('Ilocos Times'); // default value
    });

    it('throws NOT_FOUND when document row not found', async () => {
      const caller = callerFor(makeCtxWithServer(SP_SECRETARY, mockDb) as any);
      mockGetActiveInstanceForDocument.mockResolvedValue({
        id: INSTANCE_ID,
        documentId: DOCUMENT_ID,
      });
      mockDb.mockResponse([]); // empty docRows
      await expect(
        caller.recordNewspaperPublicationDate({
          documentId: DOCUMENT_ID,
          publicationDate: new Date('2026-07-01'),
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
