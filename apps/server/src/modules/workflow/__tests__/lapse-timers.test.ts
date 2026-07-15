import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateMayorLapseTimers } from '../jobs/evaluate-mayor-lapse-timers.js';
import { evaluatePanlalawiganTimers } from '../jobs/evaluate-panlalawigan-timers.js';
import { buildMockRepo } from './fixtures/workflow-test-helpers.js';

vi.mock('../engine/step-resolution.js', () => ({
  resolveNextStep: vi.fn(),
}));

describe('Lapse Timer Scheduler Jobs (LAPSE)', () => {
  let mockRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = buildMockRepo();
  });

  // ─── Mayor Lapse (evaluateMayorLapseTimers) ─────────────────────────────────

  describe('MAYOR: evaluateMayorLapseTimers', () => {
    const makeSetup = (context: Record<string, any>, stepConfig: Record<string, any> = {}) => {
      const deadline = new Date('2023-11-15T12:00:00Z');
      const now = new Date('2023-11-20T12:00:00Z');

      mockRepo.getActiveInstancesByDefinitionAndStepConfig.mockResolvedValue([
        {
          instance: {
            id: 'inst-1',
            definitionVersionId: 'ver-1',
            context: { mayor_action_deadline: deadline.toISOString(), ...context },
          },
          stepInstance: { id: 'step-inst-1', stepId: 'step-1', outcome: null },
        },
      ]);

      mockRepo.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [
          {
            id: 'step-1',
            config: { allowed_outcomes: ['APPROVED', 'VETOED', 'LAPSED'], ...stepConfig },
          },
        ],
      });

      mockRepo.lockStepInstanceForUpdate.mockResolvedValue({ id: 'step-inst-1', outcome: null });
      mockRepo.getInstanceById.mockResolvedValue({ id: 'inst-1' });
      return { deadline, now };
    };

    it('MAYOR-01: deadline elapsed → step completes LAPSED with deadline as completedAt', async () => {
      const { deadline, now } = makeSetup({});
      await evaluateMayorLapseTimers({ workflowRepository: mockRepo } as any, { now });

      expect(mockRepo.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-1',
        {
          status: 'completed',
          outcome: 'LAPSED',
          outcomeComment:
            'Mayor took no action within 10 calendar days. Lapsed into law per RA 7160 Section 47.',
          completedAt: deadline, // CRITICAL: NOT now
        },
        'mock-tx',
      );
    });

    it('MAYOR-02: context updated with LAPSED outcome', async () => {
      const { deadline, now } = makeSetup({});
      await evaluateMayorLapseTimers({ workflowRepository: mockRepo } as any, { now });

      expect(mockRepo.updateInstanceContext).toHaveBeenCalledWith(
        'inst-1',
        {
          mayor_action: 'LAPSED',
          mayor_action_date: deadline.toISOString(),
        },
        'mock-tx',
      );
    });

    it('MAYOR-03: workflow.approval.lapsed event emitted with correct payload', async () => {
      const { deadline, now } = makeSetup({});
      await evaluateMayorLapseTimers({ workflowRepository: mockRepo } as any, { now });

      expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
        {
          instanceId: 'inst-1',
          eventType: 'workflow.approval.lapsed',
          actorType: 'scheduler',
          actorId: null,
          payload: {
            stepInstanceId: 'step-inst-1',
            legalBasis: 'RA 7160 Section 47',
            deadlineWas: deadline.toISOString(),
          },
        },
        'mock-tx',
      );
    });

    it('MAYOR-04: now <= deadline → job skips instance entirely', async () => {
      mockRepo.getActiveInstancesByDefinitionAndStepConfig.mockResolvedValue([
        {
          instance: {
            id: 'inst-1',
            definitionVersionId: 'ver-1',
            context: { mayor_action_deadline: new Date('2023-11-25T12:00:00Z').toISOString() },
          },
          stepInstance: { id: 'step-inst-1', stepId: 'step-1', outcome: null },
        },
      ]);
      mockRepo.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [{ id: 'step-1', config: { allowed_outcomes: ['APPROVED', 'LAPSED'] } }],
      });
      await evaluateMayorLapseTimers({ workflowRepository: mockRepo } as any, {
        now: new Date('2023-11-20T12:00:00Z'),
      });
      expect(mockRepo.runInTransaction).not.toHaveBeenCalled();
    });

    it('MAYOR-RC: race condition — mayor acts between SELECT and lock → no update (INV3)', async () => {
      const { now } = makeSetup({});
      // Lock reveals outcome already set
      mockRepo.lockStepInstanceForUpdate.mockResolvedValue({
        id: 'step-inst-1',
        outcome: 'APPROVED',
      });
      await evaluateMayorLapseTimers({ workflowRepository: mockRepo } as any, { now });

      expect(mockRepo.updateStepInstance).not.toHaveBeenCalled();
      expect(mockRepo.updateInstanceContext).not.toHaveBeenCalled();
      expect(mockRepo.createWorkflowEvent).not.toHaveBeenCalled();
    });

    it('MAYOR-SKIP: step without LAPSED in allowed_outcomes is skipped', async () => {
      mockRepo.getActiveInstancesByDefinitionAndStepConfig.mockResolvedValue([
        {
          instance: {
            id: 'inst-1',
            definitionVersionId: 'ver-1',
            context: { mayor_action_deadline: new Date('2023-11-01T12:00:00Z').toISOString() },
          },
          stepInstance: { id: 'step-inst-1', stepId: 'step-1', outcome: null },
        },
      ]);
      mockRepo.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [{ id: 'step-1', config: { allowed_outcomes: ['APPROVED', 'VETOED'] } }], // no LAPSED
      });
      await evaluateMayorLapseTimers({ workflowRepository: mockRepo } as any, {
        now: new Date('2023-11-20T12:00:00Z'),
      });
      expect(mockRepo.runInTransaction).not.toHaveBeenCalled();
    });
  });

  // ─── Panlalawigan (evaluatePanlalawiganTimers) ────────────────────────────────

  describe('PANLA: evaluatePanlalawiganTimers', () => {
    const makeSetup = () => {
      const deadline = new Date('2023-11-15T12:00:00Z');
      const now = new Date('2023-11-20T12:00:00Z');
      const transmissionDate = new Date('2023-10-15T12:00:00Z').toISOString();

      mockRepo.getActiveInstancesByDefinitionAndStepConfig.mockResolvedValue([
        {
          instance: {
            id: 'inst-2',
            definitionVersionId: 'ver-2',
            context: {
              panlalawigan_action_deadline: deadline.toISOString(),
              panlalawigan_transmission_date: transmissionDate,
            },
          },
          stepInstance: { id: 'step-inst-2', stepId: 'step-2', outcome: null },
        },
      ]);

      mockRepo.getDefinitionVersionWithSteps.mockResolvedValue({
        steps: [
          { id: 'step-2', config: { allowed_outcomes: ['VALID', 'RETURNED', 'DEEMED_APPROVED'] } },
        ],
      });

      mockRepo.lockStepInstanceForUpdate.mockResolvedValue({ id: 'step-inst-2', outcome: null });
      mockRepo.getInstanceById.mockResolvedValue({ id: 'inst-2' });
      return { deadline, now, transmissionDate };
    };

    it('PANLA-01: 30 days elapsed → step completes DEEMED_APPROVED with deadline as completedAt', async () => {
      const { deadline, now } = makeSetup();
      await evaluatePanlalawiganTimers({ workflowRepository: mockRepo } as any, { now });

      expect(mockRepo.updateStepInstance).toHaveBeenCalledWith(
        'step-inst-2',
        {
          status: 'completed',
          outcome: 'DEEMED_APPROVED',
          outcomeComment:
            'Deemed approved per RA 7160 Section 56(d) — 30 calendar days elapsed with no action from the Sangguniang Panlalawigan.',
          completedAt: deadline, // CRITICAL: NOT now
        },
        'mock-tx',
      );
    });

    it('PANLA-02: context updated with DEEMED_APPROVED outcome', async () => {
      const { deadline, now } = makeSetup();
      await evaluatePanlalawiganTimers({ workflowRepository: mockRepo } as any, { now });

      expect(mockRepo.updateInstanceContext).toHaveBeenCalledWith(
        'inst-2',
        {
          panlalawigan_outcome: 'DEEMED_APPROVED',
          panlalawigan_response_date: deadline.toISOString(),
        },
        'mock-tx',
      );
    });

    it('PANLA-03: workflow.panlalawigan.deemed_approved event emitted with correct legal basis', async () => {
      const { deadline, now, transmissionDate } = makeSetup();
      await evaluatePanlalawiganTimers({ workflowRepository: mockRepo } as any, { now });

      expect(mockRepo.createWorkflowEvent).toHaveBeenCalledWith(
        {
          instanceId: 'inst-2',
          eventType: 'workflow.panlalawigan.deemed_approved',
          actorType: 'scheduler',
          actorId: null,
          payload: {
            stepInstanceId: 'step-inst-2',
            legalBasis: 'RA 7160 Section 56(d)',
            transmissionDate,
            deadlineWas: deadline.toISOString(),
          },
        },
        'mock-tx',
      );
    });

    it('PANLA-RC: race condition — secretariat acts between SELECT and lock → no update (INV3)', async () => {
      const { now } = makeSetup();
      // Lock reveals outcome already set
      mockRepo.lockStepInstanceForUpdate.mockResolvedValue({ id: 'step-inst-2', outcome: 'VALID' });
      await evaluatePanlalawiganTimers({ workflowRepository: mockRepo } as any, { now });

      expect(mockRepo.updateStepInstance).not.toHaveBeenCalled();
      expect(mockRepo.updateInstanceContext).not.toHaveBeenCalled();
      expect(mockRepo.createWorkflowEvent).not.toHaveBeenCalled();
    });
  });

  // ─── INV13: workflow_events immutability (DB-level guard) ─────────────────────

  describe('INV13: workflow_events immutability', () => {
    it.skip('INV13: workflow_events table has no UPDATE/DELETE — requires real batac_app role DB connection to verify REVOKE grants', () => {
      // This invariant is enforced at the PostgreSQL level via REVOKE UPDATE, DELETE
      // on the `batac_app` role. It cannot be tested with mock DB.
      // Verification: connect to the actual DB as batac_app and attempt:
      //   UPDATE workflow_events SET event_type = 'tampered' WHERE id = '<any>';
      //   DELETE FROM workflow_events WHERE id = '<any>';
      // Both should fail with permission denied.
    });
  });
});
