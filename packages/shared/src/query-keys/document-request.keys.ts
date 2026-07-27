export const documentRequestKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['documentRequests']] as const,

  // ── documentRequests.generatePrintableForm ────────────────────────────────
  printableForms: () => [['documentRequests', 'generatePrintableForm']] as const,
  printableForm: (requestId: string) =>
    [['documentRequests', 'generatePrintableForm'], { input: { requestId }, type: 'query' as const }] as const,

  // TODO: procedure documentRequests.listAll not found in live router — factory function not built, needs a decision
} as const;
