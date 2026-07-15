import { describe, it, expect, vi } from 'vitest';
import { createTrackingService } from '../tracking.service.js';
import type { TrackingRepository } from '../tracking.repository.js';
import type { RoutingEntry } from '../index.js';

describe('TrackingService', () => {
  it('getTrackingRecordForDocument returns null when repository returns null', async () => {
    const repository = {
      findTrackingRecordByDocumentId: vi.fn().mockResolvedValue(null),
    } as unknown as TrackingRepository;

    const service = createTrackingService(repository);
    const result = await service.getTrackingRecordForDocument('doc-1');

    expect(result).toBeNull();
    expect(repository.findTrackingRecordByDocumentId).toHaveBeenCalledWith('doc-1');
  });

  it('getTrackingRecordForDocument returns the repository value unchanged on success', async () => {
    const mockRecord = { trackingId: 'track-1', documentId: 'doc-1' };
    const repository = {
      findTrackingRecordByDocumentId: vi.fn().mockResolvedValue(mockRecord),
    } as unknown as TrackingRepository;

    const service = createTrackingService(repository);
    const result = await service.getTrackingRecordForDocument('doc-1');

    expect(result).toBe(mockRecord);
    expect(repository.findTrackingRecordByDocumentId).toHaveBeenCalledWith('doc-1');
  });

  it('getRoutingHistory returns the repository value unchanged and calls with only documentId', async () => {
    const mockHistory: RoutingEntry[] = [
      {
        entryId: 'entry-1',
        trackingId: 'track-1',
        fromOfficeId: null,
        toOfficeId: 'office-1',
        fromOfficeName: null,
        toOfficeName: 'Office B',
        actorId: 'actor-1',
        actionDescription: 'Routed',
        timestamp: new Date(),
      },
    ];

    const repository = {
      getRoutingHistory: vi.fn().mockResolvedValue(mockHistory),
    } as unknown as TrackingRepository;

    const service = createTrackingService(repository);
    const result = await service.getRoutingHistory('doc-1', 'actor-1');

    expect(result).toBe(mockHistory);
    expect(repository.getRoutingHistory).toHaveBeenCalledWith('doc-1');
    expect(repository.getRoutingHistory).toHaveBeenCalledTimes(1);
  });
});
