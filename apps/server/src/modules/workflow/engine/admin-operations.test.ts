import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cancelInstance,
  bypassStep,
  migrateInstance,
  reverseMigration,
} from './admin-operations.js';
import * as StepResolution from './step-resolution.js';

describe('Admin Operations', () => {
  let mockDeps: any;
  let mockTrx: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrx = {
      _isMockTrx: true,
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    const dbMock = {
      transaction: vi.fn(async (cb) => {
        return cb(mockTrx);
      }),
      query: {
        workflowEvents: {
          findFirst: vi.fn(),
        },
      },
    };

    mockDeps = {
      db: dbMock,
      workflowRepository: {
        updateInstanceStatus: vi.fn(),
        cancelActiveAndPendingStepInstancesForInstance: vi.fn(),
        createWorkflowEvent: vi
          .fn()
          .mockResolvedValue({ id: 'mock-event-id', createdAt: new Date() }),
        getStepInstanceById: vi.fn(),
        getInstanceById: vi.fn(),
        updateStepInstance: vi.fn(),
        getDefinitionVersionWithSteps: vi.fn(),
        getActiveStepInstancesForInstance: vi.fn(),
        migrateInstanceVersion: vi.fn(),
        getApprovalGrant: vi.fn(),
        markApprovalGrantUsed: vi.fn(),
      },
    };

    vi.spyOn(StepResolution, 'resolveNextStep').mockResolvedValue(undefined);
  });

  describe('cancelInstance', () => {
    it('throws VALIDATION_FAILED if reason is empty', async () => {
      await expect(cancelInstance('inst-1', 'admin-1', '   ', mockDeps)).rejects.toThrowError(
        'cancellation reason must not be empty',
      );
      await expect(cancelInstance('inst-1', 'admin-1', '', mockDeps)).rejects.toThrowError(
        'cancellation reason must not be empty',
      );
    });

    it('propagates already-terminal error from updateInstanceStatus', async () => {
      mockDeps.workflowRepository.updateInstanceStatus.mockRejectedValue(
        new Error('Cannot update status of a completed workflow instance.'),
      );

      await expect(cancelInstance('inst-1', 'admin-1', 'reason', mockDeps)).rejects.toThrowError(
        'Cannot update status',
      );
    });

    it('cancels instance and updates step instances', async () => {
      await cancelInstance('inst-1', 'admin-1', 'Testing cancel', mockDeps);

      expect(mockDeps.workflowRepository.updateInstanceStatus).toHaveBeenCalledWith(
        'inst-1',
        'cancelled',
        expect.any(Date),
        mockTrx,
      );
      expect(
        mockDeps.workflowRepository.cancelActiveAndPendingStepInstancesForInstance,
      ).toHaveBeenCalledWith('inst-1', mockTrx);

      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.instance.cancelled',
          actorType: 'user',
          actorId: 'admin-1',
          payload: {
            instance_id: 'inst-1',
            cancelled_by: 'admin-1',
            cancellation_reason: 'Testing cancel',
          },
        }),
        mockTrx,
      );
    });
  });

  describe('bypassStep', () => {
    it('throws VALIDATION_FAILED if comment or outcomeCode is empty', async () => {
      await expect(
        bypassStep('step-1', 'admin-1', 'reason', '   ', 'OUTCOME', mockDeps),
      ).rejects.toThrowError('bypass comment must not be empty');
      await expect(
        bypassStep('step-1', 'admin-1', 'reason', 'comment', '', mockDeps),
      ).rejects.toThrowError('bypass outcomeCode must not be empty');
    });

    it('throws if step instance is not active', async () => {
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue({
        id: 'step-1',
        status: 'completed',
      });
      await expect(
        bypassStep('step-1', 'admin-1', 'reason', 'comment', 'OUTCOME', mockDeps),
      ).rejects.toThrowError('Cannot bypass a step instance that is not active');
    });

    it('successfully bypasses step and delegates to resolveNextStep', async () => {
      mockDeps.workflowRepository.getStepInstanceById.mockResolvedValue({
        id: 'step-1',
        status: 'active',
        instanceId: 'inst-1',
      });
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
      });
      mockDeps.workflowRepository.updateStepInstance.mockResolvedValue({
        id: 'step-1',
        status: 'bypassed',
      });

      await bypassStep(
        'step-1',
        'admin-1',
        'ADMIN_OVERRIDE',
        'Justification',
        'ADMIN_BYPASS_OUTCOME',
        mockDeps,
      );

      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'step-1',
        expect.objectContaining({
          status: 'bypassed',
          bypassedBy: 'admin-1',
          bypassReason: 'ADMIN_OVERRIDE',
          outcomeComment: 'Justification',
        }),
        mockTrx,
      );

      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.step.bypassed',
          actorType: 'user',
          actorId: 'admin-1',
          payload: expect.objectContaining({
            bypassed_by: 'admin-1',
            bypass_reason: 'ADMIN_OVERRIDE',
          }),
        }),
        mockTrx,
      );

      expect(StepResolution.resolveNextStep).toHaveBeenCalledWith(
        { id: 'inst-1', status: 'active' },
        { id: 'step-1', status: 'bypassed' },
        'ADMIN_BYPASS_OUTCOME',
        mockDeps,
        mockTrx,
      );
    });
  });

  describe('migrateInstance', () => {
    it('VER-08: throws VALIDATION_FAILED if reason is empty', async () => {
      await expect(
        migrateInstance('inst-1', 'target-v2', 'admin-1', '  ', mockDeps),
      ).rejects.toThrowError('migration reason must not be empty');
    });

    it('VER-09: throws INSTANCE_NOT_ACTIVE if instance is not active', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'suspended',
      });
      await expect(
        migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps),
      ).rejects.toThrowError('Cannot migrate instance that is not active');
    });

    it('VER-05: throws NO_ADMIN_APPROVAL if grant not found', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionId: 'def-1',
      });
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        version: { publishedAt: new Date(), definitionId: 'def-1' },
        steps: [],
        transitionRules: [],
      });
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue(null);

      await expect(
        migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps),
      ).rejects.toThrowError('No admin approval grant found');
    });

    it('VER-06: throws APPROVAL_EXPIRED if grant is expired', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionId: 'def-1',
      });
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        version: { publishedAt: new Date(), definitionId: 'def-1' },
        steps: [],
        transitionRules: [],
      });
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue({
        id: 'grant-1',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      await expect(
        migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps),
      ).rejects.toThrowError('Admin approval grant has expired');
    });

    it('VER-10: throws STEP_KEY_NOT_FOUND_IN_TARGET_VERSION with full list of missing keys', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionId: 'def-1',
        definitionVersionId: 'v1',
      });

      // Target version has NO steps
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockImplementation(
        async (id: string) => {
          if (id === 'target-v2')
            return {
              version: { publishedAt: new Date(), definitionId: 'def-1' },
              steps: [],
              transitionRules: [],
            };
          if (id === 'v1')
            return {
              version: { definitionId: 'def-1' },
              steps: [
                { id: 'old-step-1', stepKey: 'missing_key_1' },
                { id: 'old-step-2', stepKey: 'missing_key_2' },
              ],
            };
          return null;
        },
      );

      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue({
        id: 'grant-1',
        expiresAt: new Date(Date.now() + 100000).toISOString(),
      });

      mockDeps.workflowRepository.getActiveStepInstancesForInstance.mockResolvedValue([
        { id: 'inst-step-1', stepId: 'old-step-1' },
        { id: 'inst-step-2', stepId: 'old-step-2' },
      ]);

      const err = await migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps).catch(
        (e) => e,
      );
      expect(err.code).toBe('STEP_KEY_NOT_FOUND_IN_TARGET_VERSION');
      expect(err.missingStepKeys).toEqual(['missing_key_1', 'missing_key_2']);
    });

    it('VER-04, VER-13: successfully migrates and consumes grant atomically', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionId: 'def-1',
        definitionVersionId: 'v1',
      });

      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockImplementation(
        async (id: string) => {
          if (id === 'target-v2')
            return {
              version: { publishedAt: new Date(), definitionId: 'def-1' },
              steps: [{ id: 'new-step-1', stepKey: 'key_1' }],
              transitionRules: [],
            };
          if (id === 'v1')
            return {
              version: { definitionId: 'def-1' },
              steps: [{ id: 'old-step-1', stepKey: 'key_1' }],
            };
          return null;
        },
      );

      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue({
        id: 'grant-1',
        expiresAt: new Date(Date.now() + 100000).toISOString(),
      });

      mockDeps.workflowRepository.getActiveStepInstancesForInstance.mockResolvedValue([
        { id: 'inst-step-1', stepId: 'old-step-1' },
      ]);

      const res = await migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps);
      expect(res.migrationId).toBe('mock-event-id');

      expect(mockDeps.workflowRepository.migrateInstanceVersion).toHaveBeenCalledWith(
        'inst-1',
        'target-v2',
        mockTrx,
      );
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'inst-step-1',
        { stepId: 'new-step-1' },
        mockTrx,
      );
      expect(mockDeps.workflowRepository.markApprovalGrantUsed).toHaveBeenCalledWith(
        'grant-1',
        mockTrx,
      );

      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.instance.migration.started',
          payload: expect.objectContaining({ from_version_id: 'v1', to_version_id: 'target-v2' }),
        }),
        mockTrx,
      );
      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.instance.migration.completed',
        }),
        mockTrx,
      );
    });

    it('VER-14: sets instance to stuck if transition rules reference stale steps', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionId: 'def-1',
        definitionVersionId: 'v1',
      });

      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockImplementation(
        async (id: string) => {
          if (id === 'target-v2')
            return {
              version: { publishedAt: new Date(), definitionId: 'def-1' },
              steps: [{ id: 'new-step-1', stepKey: 'key_1' }], // missing new-step-2
              transitionRules: [{ fromStepId: 'new-step-1', toStepId: 'stale-step-2' }], // reference doesn't exist in steps
            };
          if (id === 'v1')
            return {
              version: { definitionId: 'def-1' },
              steps: [{ id: 'old-step-1', stepKey: 'key_1' }],
            };
          return null;
        },
      );

      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue({
        id: 'grant-1',
        expiresAt: new Date(Date.now() + 100000).toISOString(),
      });

      mockDeps.workflowRepository.getActiveStepInstancesForInstance.mockResolvedValue([
        { id: 'inst-step-1', stepId: 'old-step-1' },
      ]);

      await migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps);

      expect(mockDeps.workflowRepository.updateInstanceStatus).toHaveBeenCalledWith(
        'inst-1',
        'stuck',
        undefined,
        mockTrx,
      );
      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'workflow.instance.stuck',
        }),
        mockTrx,
      );
    });
  });

  describe('reverseMigration', () => {
    it('VER-11: reverses within 24 hours without new grant', async () => {
      mockTrx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'orig-evt',
                eventType: 'workflow.instance.migration.completed',
                createdAt: new Date(Date.now() - 1000), // very recently
                payload: { from_version_id: 'v1' },
              },
            ]),
          }),
        }),
      });

      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionId: 'def-1',
        definitionVersionId: 'target-v2',
      });

      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockImplementation(
        async (id: string) => {
          if (id === 'v1')
            return {
              version: { definitionId: 'def-1' },
              steps: [{ id: 'old-step-1', stepKey: 'key_1' }],
              transitionRules: [],
            };
          if (id === 'target-v2')
            return {
              version: { definitionId: 'def-1' },
              steps: [{ id: 'new-step-1', stepKey: 'key_1' }],
            };
          return null;
        },
      );

      mockDeps.workflowRepository.getActiveStepInstancesForInstance.mockResolvedValue([
        { id: 'inst-step-1', stepId: 'new-step-1' },
      ]);

      await reverseMigration('inst-1', 'admin-1', 'reverse reason', 'orig-evt', mockDeps);

      expect(mockDeps.workflowRepository.getApprovalGrant).not.toHaveBeenCalled();
      expect(mockDeps.workflowRepository.migrateInstanceVersion).toHaveBeenCalledWith(
        'inst-1',
        'v1',
        mockTrx,
      );
      expect(mockDeps.workflowRepository.updateStepInstance).toHaveBeenCalledWith(
        'inst-step-1',
        { stepId: 'old-step-1' },
        mockTrx,
      );
    });

    it('VER-12: requires new unexpired grant if past 24 hours', async () => {
      mockTrx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'orig-evt',
                eventType: 'workflow.instance.migration.completed',
                createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h ago
                payload: { from_version_id: 'v1' },
              },
            ]),
          }),
        }),
      });

      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionId: 'def-1',
        definitionVersionId: 'target-v2',
      });

      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockImplementation(
        async (id: string) => {
          if (id === 'v1')
            return {
              version: { definitionId: 'def-1' },
              steps: [{ id: 'old-step-1', stepKey: 'key_1' }],
              transitionRules: [],
            };
          if (id === 'target-v2')
            return {
              version: { definitionId: 'def-1' },
              steps: [{ id: 'new-step-1', stepKey: 'key_1' }],
            };
          return null;
        },
      );

      mockDeps.workflowRepository.getActiveStepInstancesForInstance.mockResolvedValue([
        { id: 'inst-step-1', stepId: 'new-step-1' },
      ]);

      // Mock expired grant => APPROVAL_EXPIRED
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue({
        id: 'grant-2',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      await expect(
        reverseMigration('inst-1', 'admin-1', 'reverse reason', 'orig-evt', mockDeps),
      ).rejects.toThrowError('Admin approval grant has expired');

      // Mock missing grant => NO_ADMIN_APPROVAL
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue(null);
      await expect(
        reverseMigration('inst-1', 'admin-1', 'reverse reason', 'orig-evt', mockDeps),
      ).rejects.toThrowError('No admin approval grant found');

      // Mock valid grant => successful reversal
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue({
        id: 'grant-3',
        expiresAt: new Date(Date.now() + 100000).toISOString(),
      });
      await reverseMigration('inst-1', 'admin-1', 'reverse reason', 'orig-evt', mockDeps);
      expect(mockDeps.workflowRepository.markApprovalGrantUsed).toHaveBeenCalledWith(
        'grant-3',
        mockTrx,
      );
    });
  });
});
