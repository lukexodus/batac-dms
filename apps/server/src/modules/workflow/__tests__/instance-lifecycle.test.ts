import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowRepository } from '../workflow.repository.js';
import { InvalidWorkflowTransitionError } from '../../../errors/domain/workflow.js';

// We test WorkflowRepository.updateInstanceStatus directly for lifecycle guard behavior.
// The mockDb pattern mirrors workflow.repository.test.ts.

describe('Instance Lifecycle (INST)', () => {
  let mockDb: any;
  let repo: WorkflowRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      execute: vi.fn().mockReturnThis(),
      for: vi.fn().mockReturnThis(),
      $dynamic: vi.fn().mockReturnThis(),
    };
    repo = new WorkflowRepository(mockDb);
  });

  describe('INST-V: Valid lifecycle transitions', () => {
    it('INST-V-01: active → suspended is allowed', async () => {
      mockDb.where.mockResolvedValueOnce([{ status: 'active' }]);
      mockDb.where.mockResolvedValueOnce(undefined);
      await expect(repo.updateInstanceStatus('inst-1', 'suspended')).resolves.not.toThrow();
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'suspended' }));
    });

    it('INST-V-02: active → stuck is allowed', async () => {
      mockDb.where.mockResolvedValueOnce([{ status: 'active' }]);
      mockDb.where.mockResolvedValueOnce(undefined);
      await expect(repo.updateInstanceStatus('inst-1', 'stuck')).resolves.not.toThrow();
    });

    it('INST-V-03: active → completed is allowed', async () => {
      mockDb.where.mockResolvedValueOnce([{ status: 'active' }]);
      mockDb.where.mockResolvedValueOnce(undefined);
      await expect(repo.updateInstanceStatus('inst-1', 'completed')).resolves.not.toThrow();
    });

    it('INST-V-04: active → cancelled is allowed', async () => {
      mockDb.where.mockResolvedValueOnce([{ status: 'active' }]);
      mockDb.where.mockResolvedValueOnce(undefined);
      await expect(repo.updateInstanceStatus('inst-1', 'cancelled')).resolves.not.toThrow();
    });
  });

  describe('INST-I: B4 Invariant #6 — no writes to terminal instances', () => {
    it('INST-I-01 (INV6): writing to completed instance throws InvalidWorkflowTransitionError', async () => {
      mockDb.where.mockResolvedValue([{ status: 'completed' }]);
      await expect(
        repo.updateInstanceStatus('inst-1', 'active')
      ).rejects.toThrow(InvalidWorkflowTransitionError);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('INST-I-02 (INV6): writing to cancelled instance throws InvalidWorkflowTransitionError', async () => {
      mockDb.where.mockResolvedValue([{ status: 'cancelled' }]);
      await expect(
        repo.updateInstanceStatus('inst-1', 'active')
      ).rejects.toThrow(InvalidWorkflowTransitionError);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('INST-I-03 (INV6): CONFLICT trpcCode on completed instance', async () => {
      mockDb.where.mockResolvedValue([{ status: 'completed' }]);
      try {
        await repo.updateInstanceStatus('inst-1', 'stuck');
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(InvalidWorkflowTransitionError);
        expect(err.trpcCode).toBe('CONFLICT');
      }
    });
  });
});
