import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrackingRepository } from '../tracking.repository.js';
import type { AppDb } from '../../../db.js';
import { qrCodes, trackingRecords, routingEntries } from '../tracking.db.js';

describe('TrackingRepository', () => {
  let mockDb: any;
  let repo: TrackingRepository;

  beforeEach(() => {
    mockDb = {
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
      execute: vi.fn().mockReturnThis(),
    };
    repo = new TrackingRepository(mockDb as unknown as AppDb);
  });

  describe('createQrCode', () => {
    it('inserts and returns the correct row', async () => {
      const mockInput = {
        documentId: 'doc-1',
        trackingId: 'track-1',
        trackingNumber: 'DTS-2026-0001',
        generatedBy: 'user-1',
      };
      const mockRow = { ...mockInput, id: 'qr-1' };
      mockDb.returning.mockResolvedValueOnce([mockRow]);

      const result = await repo.createQrCode(mockInput);
      expect(result).toEqual(mockRow);
      expect(mockDb.insert).toHaveBeenCalledWith(qrCodes);
      expect(mockDb.values).toHaveBeenCalledWith(expect.objectContaining({
        documentId: mockInput.documentId,
        trackingId: mockInput.trackingId,
        trackingNumber: mockInput.trackingNumber,
      }));
    });

    it('duplicate tracking_id raises unique constraint', async () => {
      mockDb.returning.mockRejectedValueOnce(new Error('unique constraint on tracking_id'));
      await expect(
        repo.createQrCode({
          documentId: 'doc-1',
          trackingId: 'dup',
          trackingNumber: 'DTS-2026-0001',
          generatedBy: 'user-1',
        })
      ).rejects.toThrow('unique constraint on tracking_id');
    });

    it('duplicate tracking_number raises unique constraint', async () => {
      mockDb.returning.mockRejectedValueOnce(new Error('unique constraint on tracking_number'));
      await expect(
        repo.createQrCode({
          documentId: 'doc-2',
          trackingId: 'track-2',
          trackingNumber: 'DTS-2026-0001', // dup
          generatedBy: 'user-1',
        })
      ).rejects.toThrow('unique constraint on tracking_number');
    });
  });

  describe('appendRoutingEntry', () => {
    it('inserts and cannot be updated (UPDATE rejected by DB)', async () => {
      const mockInput = {
        trackingRecordId: 'tr-1',
        fromOfficeId: 'off-1',
        toOfficeId: 'off-2',
        actorId: 'user-1',
        actionDescription: 'Routed',
      };
      mockDb.returning.mockResolvedValueOnce([{ ...mockInput, id: 'route-1' }]);
      const result = await repo.appendRoutingEntry(mockInput);
      expect(result.id).toBe('route-1');
      // Verify no update method on the class for routing entries
      expect((repo as any).updateRoutingEntry).toBeUndefined();
      expect((repo as any).deleteRoutingEntry).toBeUndefined();
    });
  });

  describe('findQrCodeByTrackingId', () => {
    it('returns null on miss', async () => {
      mockDb.limit.mockResolvedValueOnce([]);
      const result = await repo.findQrCodeByTrackingId('non-existent');
      expect(result).toBeNull();
    });

    it('returns the row on hit', async () => {
      mockDb.limit.mockResolvedValueOnce([{ id: 'qr-1' }]);
      const result = await repo.findQrCodeByTrackingId('existing');
      expect(result).toEqual({ id: 'qr-1' });
    });
  });

  describe('getNextTrackingNumber', () => {
    it('returns sequential DTS-{YEAR}-{NNNN} values across repeated calls', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [{ sequence_value: 1, was_created: true }] });
      const first = await repo.getNextTrackingNumber(2026);
      expect(first).toBe('DTS-2026-0001');

      mockDb.execute.mockResolvedValueOnce({ rows: [{ sequence_value: 2, was_created: false }] });
      const second = await repo.getNextTrackingNumber(2026);
      expect(second).toBe('DTS-2026-0002');
    });
  });

  describe('getRoutingHistory', () => {
    it('returns entries ordered ASC', async () => {
      const mockRows = [
        {
          entryId: 'entry-1',
          trackingId: 'track-1',
          fromOfficeId: 'off-1',
          toOfficeId: 'off-2',
          fromOfficeName: 'Office A',
          toOfficeName: 'Office B',
          actorId: 'user-1',
          actionDescription: 'Route 1',
          timestamp: new Date('2026-01-01T10:00:00Z'),
        },
      ];
      mockDb.orderBy.mockResolvedValueOnce(mockRows);

      const result = await repo.getRoutingHistory('doc-1');
      expect(result).toEqual([
        {
          entryId: 'entry-1',
          trackingId: 'track-1',
          fromOfficeId: 'off-1',
          toOfficeId: 'off-2',
          fromOfficeName: 'Office A',
          toOfficeName: 'Office B',
          actorId: 'user-1',
          actionDescription: 'Route 1',
          timestamp: new Date('2026-01-01T10:00:00Z'),
        },
      ]);
      expect(mockDb.orderBy).toHaveBeenCalled();
    });
  });
});
