export const documentKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['documents']] as const,

  // ── documents.get ─────────────────────────────────────────────────────────
  details: () => [['documents', 'get']] as const,
  detail: (documentId: string) =>
    [['documents', 'get'], { input: { documentId }, type: 'query' as const }] as const,

  // ── documents.getMetadataForAdmin ─────────────────────────────────────────
  adminMetadatas: () => [['documents', 'getMetadataForAdmin']] as const,
  adminMetadata: (documentId: string) =>
    [['documents', 'getMetadataForAdmin'], { input: { documentId }, type: 'query' as const }] as const,

  // ── documents.list ────────────────────────────────────────────────────────
  lists: () => [['documents', 'list']] as const,
  list: (input: {
    cursor?: string | null;
    limit?: number;
    documentTypeId?: string;
    lifecycleState?: string;
    officeId?: string;
    dateFrom?: Date | null;
    dateTo?: Date | null;
  }) => [['documents', 'list'], { input, type: 'query' as const }] as const,

  // ── documents.search ──────────────────────────────────────────────────────
  searches: () => [['documents', 'search']] as const,
  search: (input: {
    cursor?: string | null;
    limit?: number;
    queryText: string;
    documentTypeIds?: string[];
    classificationLevels?: string[];
    dateFrom?: Date | null;
    dateTo?: Date | null;
  }) => [['documents', 'search'], { input, type: 'query' as const }] as const,

  // ── documents.getVersionHistory ───────────────────────────────────────────
  versionHistories: () => [['documents', 'getVersionHistory']] as const,
  versionHistory: (documentId: string) =>
    [['documents', 'getVersionHistory'], { input: { documentId }, type: 'query' as const }] as const,

  // ── documents.getOcrText ──────────────────────────────────────────────────
  ocrTexts: () => [['documents', 'getOcrText']] as const,
  ocrText: (versionId: string) =>
    [['documents', 'getOcrText'], { input: { versionId }, type: 'query' as const }] as const,

  // ── documents.getScanQualityIndicator ─────────────────────────────────────
  scanQualities: () => [['documents', 'getScanQualityIndicator']] as const,
  scanQuality: (versionId: string) =>
    [['documents', 'getScanQualityIndicator'], { input: { versionId }, type: 'query' as const }] as const,

  // ── documents.getPanlalawiganReview ───────────────────────────────────────
  // Not in F3's original documentKeys spec — added because the procedure
  // exists in the live router and was previously uncovered.
  panlalawiganReviews: () => [['documents', 'getPanlalawiganReview']] as const,
  panlalawiganReview: (documentId: string) =>
    [['documents', 'getPanlalawiganReview'], { input: { documentId }, type: 'query' as const }] as const,

  // ── documents.getSignatureRecords ─────────────────────────────────────────
  // Not in F3's original documentKeys spec — added because the procedure
  // exists in the live router and was previously uncovered.
  signatureRecordsList: () => [['documents', 'getSignatureRecords']] as const,
  signatureRecords: (documentId: string) =>
    [['documents', 'getSignatureRecords'], { input: { documentId }, type: 'query' as const }] as const,
} as const;
