export const trackingKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['tracking']] as const,

  // ── tracking.getTrackingRecord ────────────────────────────────────────────
  records: () => [['tracking', 'getTrackingRecord']] as const,
  record: (documentId: string) =>
    [['tracking', 'getTrackingRecord'], { input: { documentId }, type: 'query' as const }] as const,

  // ── tracking.printQrCoverSheet ────────────────────────────────────────────
  qrCoverSheets: () => [['tracking', 'printQrCoverSheet']] as const,
  qrCoverSheet: (input: { documentIds: string[]; layout?: 'single' | 'multi_per_page' }) =>
    [['tracking', 'printQrCoverSheet'], { input, type: 'query' as const }] as const,

  // ── tracking.getRoutingHistory ────────────────────────────────────────────
  routingHistories: () => [['tracking', 'getRoutingHistory']] as const,
  routingHistory: (documentId: string) =>
    [['tracking', 'getRoutingHistory'], { input: { documentId }, type: 'query' as const }] as const,

  // ── tracking.scanQrCodeAuthenticated ─────────────────────────────────────
  qrScans: () => [['tracking', 'scanQrCodeAuthenticated']] as const,
  qrScan: (qrTrackingNumber: string) =>
    [['tracking', 'scanQrCodeAuthenticated'], { input: { qrTrackingNumber }, type: 'query' as const }] as const,
} as const;
