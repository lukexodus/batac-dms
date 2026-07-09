import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowRepository } from './workflow.repository.js';
import type { AppDb } from '../../db.js';
import { InvalidWorkflowTransitionError } from '../../errors/domain/workflow.js';
import { instances, definitionVersions, workflowEvents, stepInstances } from '@batac/database/schema/workflow.schema.js';
import { sql } from 'drizzle-orm';

describe('WorkflowRepository', () => {
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
    repo = new WorkflowRepository(mockDb as unknown as AppDb);
  });

  describe('updateInstanceStatus', () => {
    it('updates status if current status is not terminal', async () => {
      mockDb.where.mockResolvedValueOnce([{ status: 'active' }]);
      mockDb.where.mockResolvedValueOnce(undefined); // update result

      await repo.updateInstanceStatus('inst-1', 'suspended');

      expect(mockDb.update).toHaveBeenCalledWith(instances);
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({ status: 'suspended' }));
    });

    it('throws CONFLICT if current status is completed', async () => {
      mockDb.where.mockResolvedValue([{ status: 'completed' }]);

      try {
        await repo.updateInstanceStatus('inst-1', 'stuck');
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err).toBeInstanceOf(InvalidWorkflowTransitionError);
        expect(err.trpcCode).toBe('CONFLICT');
      }
      
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('throws CONFLICT if current status is cancelled', async () => {
      mockDb.where.mockResolvedValue([{ status: 'cancelled' }]);

      await expect(
        repo.updateInstanceStatus('inst-1', 'active')
      ).rejects.toThrowError(InvalidWorkflowTransitionError);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('updateInstanceContext', () => {
    it('uses JSONB merge operator (||) for context', async () => {
      await repo.updateInstanceContext('inst-1', { foo: 'bar' });

      expect(mockDb.update).toHaveBeenCalledWith(instances);
      
      const setArg = mockDb.set.mock.calls[0][0];
      expect(setArg).toHaveProperty('context');
      // Safely stringify the SQL object to verify it contains the merge operator
      const stringified = JSON.stringify(setArg.context, (key, value) => {
        if (key === 'table') return undefined; // break circular reference
        return value;
      });
      expect(stringified).toContain('||');
    });
  });

  describe('createWorkflowEvent', () => {
    it('inserts a workflow event successfully', async () => {
      const mockEvent = {
        instanceId: 'inst-1',
        eventType: 'started',
        actorType: 'system' as const,
        payload: { test: true },
      };
      
      mockDb.returning.mockResolvedValueOnce([{ ...mockEvent, id: 'event-1' }]);

      const result = await repo.createWorkflowEvent(mockEvent);
      
      expect(result.id).toBe('event-1');
      expect(mockDb.insert).toHaveBeenCalledWith(workflowEvents);
      expect(mockDb.values).toHaveBeenCalledWith(mockEvent);

      // Verify no update/delete methods exist
      expect((repo as any).updateWorkflowEvent).toBeUndefined();
      expect((repo as any).deleteWorkflowEvent).toBeUndefined();
    });
  });

  describe('migrateInstanceVersion', () => {
    it('updates definition_version_id', async () => {
      await repo.migrateInstanceVersion('inst-1', 'version-2');

      expect(mockDb.update).toHaveBeenCalledWith(instances);
      expect(mockDb.set).toHaveBeenCalledWith(expect.objectContaining({
        definitionVersionId: 'version-2'
      }));
    });
  });

  describe('lockStepInstanceForUpdate', () => {
    it('uses FOR UPDATE in Drizzle', async () => {
      mockDb.for.mockResolvedValueOnce([{ id: 'step-1' }]);
      
      const result = await repo.lockStepInstanceForUpdate('step-1', mockDb);
      
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(stepInstances);
      expect(mockDb.for).toHaveBeenCalledWith('update');
      expect(result).toEqual({ id: 'step-1' });
    });
  });

  describe('getActiveInstancesByDefinitionAndStepConfig', () => {
    it('queries for active, suspended, and stuck statuses and returns matched rows', async () => {
      const mockRows = [
        {
          instance: { id: 'inst-1', status: 'stuck', deletedAt: null },
          stepInstance: { id: 'step-inst-1', slaDeadline: new Date(), startedAt: new Date() }
        }
      ];
      mockDb.where.mockReturnThis();
      mockDb.$dynamic.mockResolvedValueOnce(mockRows);

      const result = await repo.getActiveInstancesByDefinitionAndStepConfig({});

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(instances);
      expect(mockDb.innerJoin).toHaveBeenCalledTimes(2); // innerJoin stepInstances, steps
      expect(mockDb.where).toHaveBeenCalled();
      expect(result).toEqual(mockRows);
    });
  });
});
