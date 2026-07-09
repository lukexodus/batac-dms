import type { TrackingPublicAPI, TrackingRecordSummary, RoutingEntry } from './index.js';
import type { TrackingRepository } from './tracking.repository.js';

export function createTrackingService(
  repository: TrackingRepository
): TrackingPublicAPI {
  return {
    async getTrackingRecordForDocument(
      documentId: string
    ): Promise<TrackingRecordSummary | null> {
      return repository.findTrackingRecordByDocumentId(documentId);
    },

    async getRoutingHistory(
      documentId: string,
      actorId: string
    ): Promise<RoutingEntry[]> {
      return repository.getRoutingHistory(documentId);
    },
  };
}
