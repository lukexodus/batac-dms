import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initializePublishedAPI,
  resolveCurrentHolder,
  getActiveDelegationForUser,
  getOfficeById,
  getOfficeHierarchy,
  getEmployeeByUserId,
  getPrimaryOfficeForUser,
  getCommitteeIdsForUser,
  getDelegationGrantById,
} from '../index.js';

describe('Organization Published API', () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
    initializePublishedAPI(mockDb);
  });

  describe('resolveCurrentHolder', () => {
    it('returns delegated-to employee summary when active delegation grant exists', async () => {
      // Mock delegationGrants join returning a user
      mockDb.limit.mockResolvedValueOnce([
        {
          userId: 'delegatee-user-id',
          firstName: 'John',
          lastName: 'Doe',
        },
      ]);

      const result = await resolveCurrentHolder('position-id');
      expect(result).toEqual({
        userId: 'delegatee-user-id',
        displayName: 'John Doe',
      });
      expect(mockDb.from).toHaveBeenCalledWith(expect.any(Object)); // delegationGrants
    });

    it('falls back to active assignment when no delegation exists', async () => {
      // Mock delegation query returning empty, assignment query returning a user
      mockDb.limit
        .mockResolvedValueOnce([]) // Delegation query empty
        .mockResolvedValueOnce([
          {
            // Assignment query finds holder
            userId: 'assigned-user-id',
            firstName: 'Jane',
            lastName: 'Smith',
          },
        ]);

      const result = await resolveCurrentHolder('position-id');
      expect(result).toEqual({
        userId: 'assigned-user-id',
        displayName: 'Jane Smith',
      });
    });

    it('returns null if neither delegation nor assignment is found', async () => {
      mockDb.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await resolveCurrentHolder('position-id');
      expect(result).toBeNull();
    });
  });

  describe('getPrimaryOfficeForUser', () => {
    it('returns office details when user has active primary assignment', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          officeId: 'office-id',
          officeCode: 'CODE',
        },
      ]);

      const result = await getPrimaryOfficeForUser('user-id');
      expect(result).toEqual({
        officeId: 'office-id',
        officeCode: 'CODE',
      });
    });

    it('returns null when no employee record exists or no primary assignment', async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const result = await getPrimaryOfficeForUser('user-id');
      expect(result).toBeNull();
    });
  });

  describe('getCommitteeIdsForUser', () => {
    it('returns committee ids when memberships are found', async () => {
      mockDb.where.mockResolvedValueOnce([{ committeeId: 'comm-1' }, { committeeId: 'comm-2' }]);

      const result = await getCommitteeIdsForUser('user-id');
      expect(result).toEqual(['comm-1', 'comm-2']);
    });

    it('returns empty array when no memberships are found', async () => {
      mockDb.where.mockResolvedValueOnce([]);

      const result = await getCommitteeIdsForUser('user-id');
      expect(result).toEqual([]);
    });
  });

  describe('getDelegationGrantById', () => {
    it('returns scope object when active grant is found', async () => {
      mockDb.where.mockResolvedValueOnce([
        {
          scope: { roles: ['r1'], officeIds: ['o1'], actions: ['a1'] },
        },
      ]);

      const result = await getDelegationGrantById('grant-id');
      expect(result).toEqual({
        scope: {
          roles: ['r1'],
          officeIds: ['o1'],
          actions: ['a1'],
        },
      });
    });

    it('returns null when grant is inactive, revoked, or expired', async () => {
      mockDb.where.mockResolvedValueOnce([]);

      const result = await getDelegationGrantById('grant-id');
      expect(result).toBeNull();
    });
  });
});
