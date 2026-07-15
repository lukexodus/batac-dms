import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOrgRepository } from '../organization.repository.js';
import type { DbClient, DbTransaction } from '../organization.types.js';

describe('Organization Repository', () => {
  let mockDb: any;
  let repo: ReturnType<typeof createOrgRepository>;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      $dynamic: vi.fn().mockReturnThis(),
    };

    repo = createOrgRepository(mockDb as unknown as DbClient);
  });

  describe('offices', () => {
    it('findById returns null for a non-existent ID without throwing', async () => {
      mockDb.where.mockResolvedValueOnce([]); // Mock returning empty array
      const result = await repo.offices.findById('non-existent-id');
      expect(result).toBeNull();
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('findById returns row when found', async () => {
      const mockRow = { id: 'some-id', name: 'Office 1' };
      mockDb.where.mockResolvedValueOnce([mockRow]);
      const result = await repo.offices.findById('some-id');
      expect(result).toEqual(mockRow);
    });

    it('findAll excludes soft-deleted records by default', async () => {
      mockDb.where.mockResolvedValueOnce([]);
      await repo.offices.findAll();
      // Should have called where with isNull(offices.deletedAt)
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('findAll includes deleted records when option is true', async () => {
      mockDb.$dynamic.mockResolvedValueOnce([]);
      await repo.offices.findAll({ includeDeleted: true });
      expect(mockDb.where).not.toHaveBeenCalled();
    });

    it('softDelete sets deletedAt and deletedBy', async () => {
      mockDb.where.mockResolvedValueOnce([]);
      await repo.offices.softDelete('office-id', 'user-id');
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedBy: 'user-id',
          deletedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('assignments', () => {
    it('setPrimaryAssignment atomically clears other primary rows and sets target', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      } as unknown as DbTransaction;

      await repo.assignments.setPrimaryAssignment('emp-id', 'assignment-id', mockTx);

      // Verify it was called twice
      expect(mockTx.update).toHaveBeenCalledTimes(2);

      // First call clears isPrimary
      expect(mockTx.set).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          isPrimary: false,
        }),
      );

      // Second call sets isPrimary for target
      expect(mockTx.set).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          isPrimary: true,
        }),
      );
    });
  });
});
