export interface TrackingPublicAPI {
  /**
   * Get the QR tracking record for a document.
   * Used by Documents cover sheet generator. Returns null if not yet assigned.
   */
  getTrackingRecordForDocument(
    documentId: string
  ): Promise<TrackingRecordSummary | null>;

  /**
   * Get the full routing history for a document.
   * Used by the Documents Router for the authenticated internal routing history view.
   * The public unauthenticated scan is served by the REST publicLookupHandler, not this.
   * Caller must perform authorization before calling.
   */
  getRoutingHistory(
    documentId: string,
    actorId: string
  ): Promise<RoutingEntry[]>;
}

export interface TrackingRecordSummary {
  trackingId: string;      // qr_codes.tracking_id UUID — immutable for document lifetime
  documentId: string;
  trackingNumber: string;  // human-readable label e.g. 'DTS-2026-0001'
  qrCodeS3Key: string;     // qr_codes.qr_image_file_key (UUID key, not a full URL)
  assignedAt: Date;
  physicalLocation: string | null;
}

export interface RoutingEntry {
  entryId: string;
  trackingId: string;      // qr_codes.tracking_id of the parent tracking record
  fromOfficeId: string | null;
  toOfficeId: string | null;
  actorId: string;
  actionDescription: string;
  timestamp: Date;
}

export { default } from './tracking.plugin.js';
