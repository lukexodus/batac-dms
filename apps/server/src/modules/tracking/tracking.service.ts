import type { TrackingPublicAPI, TrackingRecordSummary, RoutingEntry } from './index.js';
import type { TrackingRepository } from './tracking.repository.js';

export function createTrackingService(deps: {
  repository: TrackingRepository;
}): TrackingPublicAPI {
  return {
    async getTrackingRecordForDocument(
      documentId: string
    ): Promise<TrackingRecordSummary | null> {
      throw new Error('not implemented');
    },

    async getRoutingHistory(
      documentId: string,
      actorId: string
    ): Promise<RoutingEntry[]> {
      throw new Error('not implemented');
    },
  };
}
