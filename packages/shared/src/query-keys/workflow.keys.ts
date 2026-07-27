export const workflowKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['workflow']] as const,

  // ── workflow.getInstance ──────────────────────────────────────────────────
  details: () => [['workflow', 'getInstance']] as const,
  detail: (instanceId: string) =>
    [['workflow', 'getInstance'], { input: { instanceId }, type: 'query' as const }] as const,

  // ── workflow.getActiveInstanceForDocument ─────────────────────────────────
  forDocuments: () => [['workflow', 'getActiveInstanceForDocument']] as const,
  forDocument: (documentId: string) =>
    [['workflow', 'getActiveInstanceForDocument'], { input: { documentId }, type: 'query' as const }] as const,

  // ── workflow.listMyAssignedSteps ──────────────────────────────────────────
  mySteps: () => [['workflow', 'listMyAssignedSteps']] as const,
  myStepsList: (input: { cursor?: string | null; limit?: number; stepKeyIn?: string[] }) =>
    [['workflow', 'listMyAssignedSteps'], { input, type: 'query' as const }] as const,

  // ── workflow.getSlaComplianceData ─────────────────────────────────────────
  slaComplianceData: () => [['workflow', 'getSlaComplianceData']] as const,
  getSlaComplianceData: (input: {
    officeId?: string;
    documentTypeId?: string;
    breachedOnly?: boolean;
    from?: Date | null;
    to?: Date | null;
  }) => [['workflow', 'getSlaComplianceData'], { input, type: 'query' as const }] as const,
} as const;
