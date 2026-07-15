import { describe, it, expect, vi, beforeEach } from 'vitest';
import { migrateInstance, reverseMigration } from '../engine/admin-operations.js';
import {
  ValidationFailedError,
  NoAdminApprovalError,
  ApprovalExpiredError,
  InstanceNotActiveError,
  StepKeyNotFoundInTargetVersionError,
} from '../../../errors/domain/workflow.js';
import * as StepResolution from '../engine/step-resolution.js';

describe('Admin Operations — Migrate Instance (VER)', () => {
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
      transaction: vi.fn(async (cb: any) => cb(mockTrx)),
    };

    mockDeps = {
      db: dbMock,
      workflowRepository: {
        getInstanceById: vi.fn(),
        getDefinitionVersionWithSteps: vi.fn(),
        getApprovalGrant: vi.fn(),
        getActiveStepInstancesForInstance: vi.fn().mockResolvedValue([]),
        migrateInstanceVersion: vi.fn(),
        updateStepInstance: vi.fn(),
        markApprovalGrantUsed: vi.fn(),
        updateInstanceStatus: vi.fn(),
        createWorkflowEvent: vi
          .fn()
          .mockResolvedValue({ id: 'mock-event-id', createdAt: new Date() }),
      },
    };

    vi.spyOn(StepResolution, 'resolveNextStep').mockResolvedValue(undefined);
  });

  describe('VER-V: Valid migration scenarios', () => {
    it('VER-04: successfully migrates with step mapping and consumes grant', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
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
              transitionRules: [],
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
        expect.objectContaining({ eventType: 'workflow.instance.migration.started' }),
        mockTrx,
      );
      expect(mockDeps.workflowRepository.createWorkflowEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'workflow.instance.migration.completed' }),
        mockTrx,
      );
    });

    it('VER-13: reversibleUntil is 24 hours from completion', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
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
              transitionRules: [],
            };
          return null;
        },
      );
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue({
        id: 'grant-1',
        expiresAt: new Date(Date.now() + 100000).toISOString(),
      });
      const before = new Date();
      const res = await migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps);
      const after = new Date();
      expect(res.reversibleUntil.getTime()).toBeGreaterThanOrEqual(
        before.getTime() + 23 * 60 * 60 * 1000,
      );
      expect(res.reversibleUntil.getTime()).toBeLessThanOrEqual(
        after.getTime() + 25 * 60 * 60 * 1000,
      );
    });
  });

  describe('VER-I: Invalid migration scenarios', () => {
    it('VER-08 (INV10): empty reason throws ValidationFailedError', async () => {
      await expect(
        migrateInstance('inst-1', 'target-v2', 'admin-1', '   ', mockDeps),
      ).rejects.toThrow(ValidationFailedError);
    });

    it('VER-09: non-active instance throws InstanceNotActiveError', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'suspended',
      });
      await expect(
        migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps),
      ).rejects.toThrow(InstanceNotActiveError);
    });

    it('VER-05 (INV8): no admin approval grant throws NoAdminApprovalError', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionVersionId: 'v1',
      });
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        version: { publishedAt: new Date(), definitionId: 'def-1' },
        steps: [],
        transitionRules: [],
      });
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue(null);

      await expect(
        migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps),
      ).rejects.toThrow(NoAdminApprovalError);
    });

    it('VER-06 (INV8): expired admin approval grant throws ApprovalExpiredError', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionVersionId: 'v1',
      });
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockResolvedValue({
        version: { publishedAt: new Date(), definitionId: 'def-1' },
        steps: [],
        transitionRules: [],
      });
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValue({
        id: 'grant-expired',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });

      await expect(
        migrateInstance('inst-1', 'target-v2', 'admin-1', 'reason', mockDeps),
      ).rejects.toThrow(ApprovalExpiredError);
    });

    it('VER-10 (INV12): missing step keys in target version throws StepKeyNotFoundInTargetVersionError', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionVersionId: 'v1',
      });
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
      expect(err).toBeInstanceOf(StepKeyNotFoundInTargetVersionError);
      expect(err.missingStepKeys).toEqual(['missing_key_1', 'missing_key_2']);
    });

    it('VER-14: stale transition references → instance stuck after migration', async () => {
      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
        definitionVersionId: 'v1',
      });
      mockDeps.workflowRepository.getDefinitionVersionWithSteps.mockImplementation(
        async (id: string) => {
          if (id === 'target-v2')
            return {
              version: { publishedAt: new Date(), definitionId: 'def-1' },
              steps: [{ id: 'new-step-1', stepKey: 'key_1' }],
              transitionRules: [{ fromStepId: 'new-step-1', toStepId: 'stale-step-id' }],
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
        expect.objectContaining({ eventType: 'workflow.instance.stuck' }),
        mockTrx,
      );
    });
  });

  describe('VER-REV: Reverse migration', () => {
    it('VER-11: reverses within 24 hours without requiring a new grant', async () => {
      mockTrx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: 'orig-evt',
                eventType: 'workflow.instance.migration.completed',
                createdAt: new Date(Date.now() - 1000), // very recent
                payload: { from_version_id: 'v1' },
              },
            ]),
          }),
        }),
      });

      mockDeps.workflowRepository.getInstanceById.mockResolvedValue({
        id: 'inst-1',
        status: 'active',
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

    it('VER-12: past 24 hours requires a new unexpired grant', async () => {
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

      // Expired grant → ApprovalExpiredError
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValueOnce({
        id: 'grant-expired',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      });
      await expect(
        reverseMigration('inst-1', 'admin-1', 'reverse reason', 'orig-evt', mockDeps),
      ).rejects.toThrow(ApprovalExpiredError);

      // No grant → NoAdminApprovalError
      mockDeps.workflowRepository.getApprovalGrant.mockResolvedValueOnce(null);
      await expect(
        reverseMigration('inst-1', 'admin-1', 'reverse reason', 'orig-evt', mockDeps),
      ).rejects.toThrow(NoAdminApprovalError);
    });

    it('VER-REV-I-01 (INV10): empty reversal reason throws ValidationFailedError', async () => {
      await expect(reverseMigration('inst-1', 'admin-1', '', 'orig-evt', mockDeps)).rejects.toThrow(
        ValidationFailedError,
      );
    });
  });
});
