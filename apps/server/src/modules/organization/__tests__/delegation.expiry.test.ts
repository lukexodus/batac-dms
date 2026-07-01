import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerDelegationExpiryJob } from '../delegation-expiry.job.js';

describe('delegation-expiry.job', () => {
  let mockBoss: any;
  let mockEventBus: any;
  let mockAuditService: any;
  let jobHandler: (job: any) => Promise<void>;

  beforeEach(() => {
    mockBoss = {
      work: vi.fn().mockImplementation((name, handler) => {
        jobHandler = handler;
      }),
    };
    mockEventBus = { emit: vi.fn() };
    mockAuditService = { writeEvent: vi.fn().mockResolvedValue(undefined) };
  });

  function setupDb(updateResult: any[], empRowResult?: any) {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue(updateResult),
    };

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(empRowResult ? [empRowResult] : []),
    };

    const trx = {
      update: vi.fn(() => updateChain),
      select: vi.fn(() => selectChain),
    };

    return {
      transaction: vi.fn(async (cb) => cb(trx)),
      _trx: trx,
      _updateChain: updateChain,
    };
  }

  it('registers the job handler with boss.work', async () => {
    const mockDb = setupDb([]);
    await registerDelegationExpiryJob({
      boss: mockBoss,
      db: mockDb as any,
      eventBus: mockEventBus,
      auditService: mockAuditService,
    });

    expect(mockBoss.work).toHaveBeenCalledWith('delegation.expire', expect.any(Function));
  });

  it('is idempotent: does nothing if the grant is already deactivated', async () => {
    const mockDb = setupDb([]); // empty result -> already deactivated
    await registerDelegationExpiryJob({
      boss: mockBoss,
      db: mockDb as any,
      eventBus: mockEventBus,
      auditService: mockAuditService,
    });

    await jobHandler([{ data: { delegationGrantId: 'test-grant-id' } }]);

    expect(mockDb._trx.update).toHaveBeenCalled();
    // Event and audit should NOT be called
    expect(mockEventBus.emit).not.toHaveBeenCalled();
    expect(mockAuditService.writeEvent).not.toHaveBeenCalled();
  });

  it('deactivates the grant, emits domain event, and writes audit event on success', async () => {
    const mockGrant = {
      id: 'test-grant-id',
      delegatingEmployeeId: 'emp-1',
      delegatedToEmployeeId: 'emp-2',
      cityId: 'city-1',
      officeId: 'office-1',
      designationDocumentId: 'doc-1',
    };
    const mockEmpRow = {
      delegatingUserId: 'user-1',
      delegatedToUserId: 'user-2',
    };

    const mockDb = setupDb([mockGrant], mockEmpRow);
    await registerDelegationExpiryJob({
      boss: mockBoss,
      db: mockDb as any,
      eventBus: mockEventBus,
      auditService: mockAuditService,
    });

    await jobHandler([{ data: { delegationGrantId: 'test-grant-id' } }]);

    expect(mockDb._trx.update).toHaveBeenCalled();
    expect(mockDb._updateChain.set).toHaveBeenCalledWith({ isActive: false, updatedAt: expect.any(Date) });

    expect(mockEventBus.emit).toHaveBeenCalledTimes(1);
    expect(mockEventBus.emit).toHaveBeenCalledWith('delegation.expired', expect.objectContaining({
      eventType: 'delegation.expired',
      cityId: 'city-1',
      payload: expect.objectContaining({
        delegationId: 'test-grant-id',
        delegatingUserId: 'user-1',
        delegatedToUserId: 'user-2',
        expiredAt: expect.any(String),
      }),
    }));

    expect(mockAuditService.writeEvent).toHaveBeenCalledTimes(1);
    expect(mockAuditService.writeEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'delegation_grant.expired',
      actorId: null,
      targetId: 'test-grant-id',
      targetType: 'delegation_grant',
      payload: expect.objectContaining({
        delegationId: 'test-grant-id',
        designationDocumentId: 'doc-1',
      }),
    }));
  });
});
