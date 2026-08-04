import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitStepApproval } from '../engine/step-handlers/approval.handler.js';
import { submitStepMultiReferral } from '../engine/step-handlers/multi-referral.handler.js';
import { executeTerminationStep } from '../engine/step-handlers/termination.handler.js';
import { validateDefinitionForPublish } from '../engine/definition-validator.js';
import { cancelInstance, migrateInstance } from '../engine/admin-operations.js';
import { WorkflowRepository } from '../workflow.repository.js';
import {
  InvalidWorkflowTransitionError,
  ValidationFailedError,
} from '../../../errors/domain/workflow.js';
import {
  buildMockApprovalDeps,
  buildMockInstance,
  buildMockStepInstance,
  buildMockRepo,
} from './fixtures/workflow-test-helpers.js';

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('B4 Engine Invariants', () => {
  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #1: definition_version_id immutable outside migrateInstance', () => {
    it('INV1-01: updating definitionVersionId directly on an instance is disallowed at the repo level', () => {
      // The repository does not expose a public method to update definitionVersionId
      // outside of migrateInstanceVersion. This is enforced by absence of API.
      const repo = buildMockRepo();
      expect(typeof repo.migrateInstanceVersion).toBe('function');
      // There is no updateInstanceVersionId or similar escape hatch on the mock.
      expect((repo as any).updateDefinitionVersionId).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #2: multi_referral REPORT_ACCEPTED requires all committees + secretary acceptance', () => {
    it('INV2-01: REPORT_ACCEPTED with incomplete submissions → CONFLICT with REQUIRE_ALL_COMMITTEE_SIGNATURES_VIOLATED cause', async () => {
      const mockDeps = buildMockApprovalDeps();
      const mockInstance = buildMockInstance();
      const mockStepInstance = buildMockStepInstance({
        metadata: {
          assigned_committees: [{ committee_id: 'c1' }, { committee_id: 'c2' }],
          submissions: [{ committee_id: 'c1', submitted_by: 'u', submitted_at: 'ts' }], // only 1 of 2
        },
      });
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [{ id: 'step-mayor', stepType: 'multi_referral', config: {} }],
      });

      try {
        await submitStepMultiReferral(
          mockInstance,
          mockStepInstance,
          'user-sec',
          'user',
          'REPORT_ACCEPTED',
          null,
          mockDeps,
        );
        expect.unreachable('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('all assigned committees must submit');
        expect(e.cause).toBe('REQUIRE_ALL_COMMITTEE_SIGNATURES_VIOLATED');
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #3: LAPSED/DEEMED_APPROVED are scheduler-only outcomes', () => {
    let mockDeps: any;
    let mockInstance: any;
    let mockStepInstance: any;

    beforeEach(() => {
      mockDeps = buildMockApprovalDeps();
      mockInstance = buildMockInstance();
      mockStepInstance = buildMockStepInstance();
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [
          {
            id: 'step-mayor',
            stepType: 'approval',
            config: { allowed_outcomes: ['LAPSED', 'DEEMED_APPROVED'] },
          },
        ],
      });
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(mockStepInstance);
    });

    it('INV3-01a: LAPSED submitted by user → FORBIDDEN with LAPSED_IS_SCHEDULER_ONLY', async () => {
      try {
        await submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-1',
          'user',
          'LAPSED',
          null,
          mockDeps,
        );
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toContain('FORBIDDEN');
        expect(e.cause).toBe('LAPSED_IS_SCHEDULER_ONLY');
      }
    });

    it('INV3-01b: DEEMED_APPROVED submitted by user → FORBIDDEN with DEEMED_APPROVED_IS_SCHEDULER_ONLY', async () => {
      try {
        await submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-1',
          'user',
          'DEEMED_APPROVED',
          null,
          mockDeps,
        );
        expect.unreachable();
      } catch (e: any) {
        expect(e.message).toContain('FORBIDDEN');
        expect(e.cause).toBe('DEEMED_APPROVED_IS_SCHEDULER_ONLY');
      }
    });

    it('INV3-02: LAPSED submitted by scheduler succeeds', async () => {
      await expect(
        submitStepApproval(
          mockInstance,
          mockStepInstance,
          'scheduler',
          'scheduler',
          'LAPSED',
          null,
          mockDeps,
        ),
      ).resolves.not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #4: every allowed_outcome has a covering transition rule at publish time', () => {
    it('INV4-01: MISSING_OUTCOME_TRANSITION raised when outcome has no covering rule', async () => {
      const mockRepo = buildMockRepo();
      mockRepo.getStepsAndRulesForValidation.mockResolvedValue({
        steps: [
          {
            id: 's1',
            stepKey: 'vote',
            stepType: 'approval',
            isStart: true,
            config: { allowed_outcomes: ['APPROVED', 'REJECTED'] },
          },
        ],
        transitionRules: [
          { id: 'r1', fromStepId: 's1', toStepId: 's2', outcomeFilter: 'APPROVED' },
          // REJECTED has no rule → should fail
        ],
      });
      const result = await validateDefinitionForPublish('ver-1', {
        workflowRepository: mockRepo as any,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            code: 'MISSING_OUTCOME_TRANSITION',
            missing_outcome_code: 'REJECTED',
          }),
        );
      }
    });

    it('INV4-02: MISSING_LAPSE_TRANSITION is raised specifically for LAPSED (not MISSING_OUTCOME_TRANSITION)', async () => {
      const mockRepo = buildMockRepo();
      mockRepo.getStepsAndRulesForValidation.mockResolvedValue({
        steps: [
          {
            id: 's1',
            stepKey: 'mayor',
            stepType: 'approval',
            isStart: true,
            config: { allowed_outcomes: ['APPROVED', 'LAPSED'] },
          },
        ],
        transitionRules: [
          { id: 'r1', fromStepId: 's1', toStepId: 's2', outcomeFilter: 'APPROVED' },
        ],
      });
      const result = await validateDefinitionForPublish('ver-1', {
        workflowRepository: mockRepo as any,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        const codes = result.errors.map((e) => e.code);
        expect(codes).toContain('MISSING_LAPSE_TRANSITION');
        // LAPSED should NOT also raise MISSING_OUTCOME_TRANSITION
        const hasOutcomeErr = result.errors.some(
          (e) => e.code === 'MISSING_OUTCOME_TRANSITION' && e.missing_outcome_code === 'LAPSED',
        );
        expect(hasOutcomeErr).toBe(false);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #5: parallel_split/parallel_join unavailable in Phase 1', () => {
    it('INV5-01: parallel_split in definition → STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1', async () => {
      const mockRepo = buildMockRepo();
      mockRepo.getStepsAndRulesForValidation.mockResolvedValue({
        steps: [
          { id: 's1', stepKey: 'par', stepType: 'parallel_split', isStart: true, config: {} },
        ],
        transitionRules: [],
      });
      const result = await validateDefinitionForPublish('ver-1', {
        workflowRepository: mockRepo as any,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1' }),
        );
      }
    });

    it('INV5-02: parallel_join in definition → STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1', async () => {
      const mockRepo = buildMockRepo();
      mockRepo.getStepsAndRulesForValidation.mockResolvedValue({
        steps: [{ id: 's1', stepKey: 'par', stepType: 'parallel_join', isStart: true, config: {} }],
        transitionRules: [],
      });
      const result = await validateDefinitionForPublish('ver-1', {
        workflowRepository: mockRepo as any,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'STEP_TYPE_NOT_AVAILABLE_IN_PHASE_1' }),
        );
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #6: no writes permitted to Completed/Cancelled instances', () => {
    it('INV6-01: writing to completed instance → InvalidWorkflowTransitionError (CONFLICT)', async () => {
      let mockDb: any;
      mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ status: 'completed' }]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        execute: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        $dynamic: vi.fn().mockReturnThis(),
      };
      const repo = new WorkflowRepository(mockDb);
      await expect(repo.updateInstanceStatus('inst-1', 'active')).rejects.toThrow(
        InvalidWorkflowTransitionError,
      );
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('INV6-02: writing to cancelled instance → InvalidWorkflowTransitionError (CONFLICT)', async () => {
      let mockDb: any;
      mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([{ status: 'cancelled' }]),
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockReturnThis(),
        execute: vi.fn().mockReturnThis(),
        for: vi.fn().mockReturnThis(),
        $dynamic: vi.fn().mockReturnThis(),
      };
      const repo = new WorkflowRepository(mockDb);
      await expect(repo.updateInstanceStatus('inst-1', 'active')).rejects.toThrow(
        InvalidWorkflowTransitionError,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #7: SECRETARY_ADVANCED requires non-empty comment', () => {
    it('INV7-01: SECRETARY_ADVANCED with empty comment → COMMENT_REQUIRED', async () => {
      const mockDeps = buildMockApprovalDeps();
      const mockInstance = buildMockInstance();
      const mockStepInstance = buildMockStepInstance({
        metadata: {
          assigned_committees: [{ committee_id: 'c1' }],
          submissions: [],
        },
      });
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [
          {
            id: 'step-mayor',
            stepType: 'multi_referral',
            config: { allow_secretary_advance: true },
          },
        ],
      });
      await expect(
        submitStepMultiReferral(
          mockInstance,
          mockStepInstance,
          'user-sec',
          'user',
          'SECRETARY_ADVANCED',
          '',
          mockDeps,
        ),
      ).rejects.toThrow('COMMENT_REQUIRED');
    });

    it('INV7-02: SECRETARY_ADVANCED with null comment → COMMENT_REQUIRED', async () => {
      const mockDeps = buildMockApprovalDeps();
      const mockInstance = buildMockInstance();
      const mockStepInstance = buildMockStepInstance({
        metadata: {
          assigned_committees: [{ committee_id: 'c1' }],
          submissions: [],
        },
      });
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [
          {
            id: 'step-mayor',
            stepType: 'multi_referral',
            config: { allow_secretary_advance: true },
          },
        ],
      });
      await expect(
        submitStepMultiReferral(
          mockInstance,
          mockStepInstance,
          'user-sec',
          'user',
          'SECRETARY_ADVANCED',
          null,
          mockDeps,
        ),
      ).rejects.toThrow('COMMENT_REQUIRED');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #8: migrateInstance requires unexpired City Administrator approval', () => {
    it('INV8-01: migrate with no approval grant → NoAdminApprovalError', async () => {
      const mockRepo = buildMockRepo();
      mockRepo.getInstanceById.mockResolvedValue(buildMockInstance());
      mockRepo.getApprovalGrant.mockResolvedValue(null); // no grant exists

      const mockDb = {
        transaction: vi.fn(async (cb: any) => cb('mock-tx' as any)),
      } as any;

      await expect(
        migrateInstance('inst-1', 'ver-2', 'admin-1', 'reason', {
          db: mockDb,
          workflowRepository: mockRepo as any,
        }),
      ).rejects.toThrow(); // NoAdminApprovalError or similar
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #9: A termination step with outcome_code = REPASSED must not set instances.status = completed', () => {
    it('INV9-01 (RES-V35, PANLA-10): REPASSED outcome → instance.status stays active, emits workflow.instance.repassed', async () => {
      const mockDeps = {
        db: { transaction: vi.fn(async (cb: any) => cb('mock-tx')) },
        workflowRepository: buildMockRepo(),
        documentsService: { getDocumentById: vi.fn(), transitionState: vi.fn() },
        eventBus: { publish: vi.fn() },
      };
      const mockInstance = buildMockInstance();
      const mockStepInstance = buildMockStepInstance({ stepId: 'step-term' });

      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [{ id: 'step-term', stepType: 'termination', config: { outcome_code: 'REPASSED' } }],
      });

      await executeTerminationStep(mockInstance, mockStepInstance, mockDeps as any);

      // Instance status must NOT have been updated to 'completed'
      expect(mockDeps.workflowRepository.updateInstanceStatus).not.toHaveBeenCalled();

      // Step instance must be completed
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        expect.objectContaining({ status: 'completed', outcome: 'REPASSED' }),
        mockDeps.db,
      );

      // Must emit repassed event, not completed
      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'workflow.instance.repassed' }),
        mockDeps.db,
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #10: admin operations (cancel, bypass, migrate) require non-empty reason/comment', () => {
    it('INV10-01: cancelInstance with empty reason → ValidationFailedError', async () => {
      const mockDb = { transaction: vi.fn(async (cb: any) => cb('mock-tx')) } as any;
      const mockRepo = buildMockRepo();
      await expect(
        cancelInstance('inst-1', 'admin-1', '', {
          db: mockDb,
          workflowRepository: mockRepo as any,
        }),
      ).rejects.toThrow(ValidationFailedError);
    });

    it('INV10-02: cancelInstance with whitespace-only reason → ValidationFailedError', async () => {
      const mockDb = { transaction: vi.fn(async (cb: any) => cb('mock-tx')) } as any;
      const mockRepo = buildMockRepo();
      await expect(
        cancelInstance('inst-1', 'admin-1', '   ', {
          db: mockDb,
          workflowRepository: mockRepo as any,
        }),
      ).rejects.toThrow(ValidationFailedError);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #11: encoder cannot be the final approver on is_final_approval steps', () => {
    let mockDeps: any;
    let mockInstance: any;
    let mockStepInstance: any;

    beforeEach(() => {
      mockDeps = buildMockApprovalDeps();
      // Instance context.created_by = 'user-encoder' (the encoder/submitter)
      mockInstance = buildMockInstance({
        context: { created_by: 'user-encoder', document_type: 'resolution' },
      });
      mockStepInstance = buildMockStepInstance({
        assignedTo: [{ user_id: 'user-encoder' }], // encoder IS assigned
      });
    });

    it('INV11-01a (INV11): vp_certification step rejects encoder as approver → ENCODER_CANNOT_BE_FINAL_APPROVER', async () => {
      // The is_final_approval flag lives in step config (JSONB), not a column
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [
          {
            id: 'step-mayor',
            stepType: 'approval',
            config: { allowed_outcomes: ['APPROVED', 'REJECTED'], is_final_approval: true },
          },
        ],
      });
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(mockStepInstance);

      await expect(
        submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-encoder',
          'user',
          'APPROVED',
          null,
          mockDeps,
        ),
      ).rejects.toThrow('ENCODER_CANNOT_BE_FINAL_APPROVER');
    });

    it('INV11-01b (INV11): non-encoder actor succeeds on is_final_approval step', async () => {
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [
          {
            id: 'step-mayor',
            stepType: 'approval',
            config: { allowed_outcomes: ['APPROVED'], is_final_approval: true },
          },
        ],
      });
      // Assign a different user
      const nonEncoderStep = buildMockStepInstance({ assignedTo: [{ user_id: 'user-vp' }] });
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(nonEncoderStep);

      await expect(
        submitStepApproval(
          mockInstance,
          nonEncoderStep,
          'user-vp',
          'user',
          'APPROVED',
          null,
          mockDeps,
        ),
      ).resolves.not.toThrow();
    });

    it('INV11-02: non-final-approval step allows encoder to approve', async () => {
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [
          {
            id: 'step-mayor',
            stepType: 'approval',
            config: { allowed_outcomes: ['APPROVED'], is_final_approval: false },
          },
        ],
      });
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue(mockStepInstance);

      await expect(
        submitStepApproval(
          mockInstance,
          mockStepInstance,
          'user-encoder',
          'user',
          'APPROVED',
          null,
          mockDeps,
        ),
      ).resolves.not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #12: transition rules cannot reference steps from a different definition_version_id', () => {
    it('INV12-01: cross-version rule → CROSS_VERSION_TRANSITION_REFERENCE error at publish time', async () => {
      const mockRepo = buildMockRepo();
      mockRepo.getStepsAndRulesForValidation.mockResolvedValue({
        steps: [
          { id: 's1', stepKey: 'action_step', stepType: 'action', isStart: true, config: {} },
        ],
        transitionRules: [
          // toStepId 'other-version-step' is not in the version's steps list
          { id: 'r1', fromStepId: 's1', toStepId: 'other-version-step', outcomeFilter: null },
        ],
      });
      const result = await validateDefinitionForPublish('ver-1', {
        workflowRepository: mockRepo as any,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors).toContainEqual(
          expect.objectContaining({ code: 'CROSS_VERSION_TRANSITION_REFERENCE' }),
        );
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe('Invariant #13: workflow_events immutability (DB-level REVOKE UPDATE, DELETE via batac_app role)', () => {
    it.skip('INV13-01a: UPDATE on workflow_events as batac_app → permission denied', async () => {
      /**
       * This invariant is enforced at the PostgreSQL level via:
       *   REVOKE UPDATE, DELETE ON workflow.workflow_events FROM batac_app;
       * (see post-migrate-grants.sql line 99)
       *
       * Verification requires a real DB connection using the batac_app role:
       *   const db = createDbConnection({ role: 'batac_app', ... });
       *   await db.execute(sql`UPDATE workflow_events SET event_type = 'tampered' WHERE FALSE`);
       *   // Should throw: ERROR: permission denied for table workflow_events
       *
       * Note: B4 spec refers to this role as workflow_app_user but the actual
       * deployed role is batac_app (confirmed in post-migrate-grants.sql).
       */
    });

    it.skip('INV13-01b: DELETE on workflow_events as batac_app → permission denied', async () => {
      /**
       * Same as INV13-01a — requires real DB with batac_app role.
       * DELETE was never granted (post-migrate-grants.sql grants only SELECT, INSERT, UPDATE
       * on domain schemas at line 78, and the explicit REVOKE DELETE at line 99 is
       * defensive/belt-and-suspenders).
       */
    });

    it('INV13-semantic: WorkflowRepository.createWorkflowEvent has no corresponding updateWorkflowEvent/deleteWorkflowEvent method', () => {
      const mockDb: any = {};
      const repo = new WorkflowRepository(mockDb);
      // The public API intentionally omits update/delete for workflow_events
      expect((repo as any).updateWorkflowEvent).toBeUndefined();
      expect((repo as any).deleteWorkflowEvent).toBeUndefined();
      expect(typeof (repo as any).createWorkflowEvent).toBe('function');
    });
  });
});
