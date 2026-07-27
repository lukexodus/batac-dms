export const documentRequestKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['documentRequests']] as const,

  // ── documentRequests.generatePrintableForm ────────────────────────────────
  printableForms: () => [['documentRequests', 'generatePrintableForm']] as const,
  printableForm: (requestId: string) =>
    [['documentRequests', 'generatePrintableForm'], { input: { requestId }, type: 'query' as const }] as const,

  // ── documentRequests.listAllDocumentRequests ──────────────────────────────
  // Extended beyond F3's original spec: requesterName and documentNumber are
  // real live filter fields (document-requests.router.ts) that F3's written
  // text never specified. Included deliberately — do not remove.
  lists: () => [['documentRequests', 'listAllDocumentRequests']] as const,
  list: (input: {
    cursor?: string;
    limit?: number;
    requesterName?: string;
    documentNumber?: string;
  }) => [['documentRequests', 'listAllDocumentRequests'], { input, type: 'query' as const }] as const,
} as const;
