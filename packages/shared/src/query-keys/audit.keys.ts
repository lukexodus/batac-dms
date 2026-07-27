export const auditKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['audit']] as const,

  // ── audit.listOwnActions ──────────────────────────────────────────────────
  ownActions: () => [['audit', 'listOwnActions']] as const,
  ownAction: (input: {
    cursor?: string | null;
    pageSize?: number;
    from?: Date | null;
    to?: Date | null;
  }) => [['audit', 'listOwnActions'], { input, type: 'query' as const }] as const,

  // ── audit.listOwnOfficeDocumentActions ────────────────────────────────────
  officeActions: () => [['audit', 'listOwnOfficeDocumentActions']] as const,
  officeAction: (input: {
    cursor?: string | null;
    pageSize?: number;
    officeId?: string;
    from?: Date | null;
    to?: Date | null;
  }) => [['audit', 'listOwnOfficeDocumentActions'], { input, type: 'query' as const }] as const,

  // ── audit.listFullLog ─────────────────────────────────────────────────────
  fullLogs: () => [['audit', 'listFullLog']] as const,
  fullLog: (input: {
    cursor?: string | null;
    pageSize?: number;
    actorId?: string;
    eventTypes?: string[];
    from?: Date | null;
    to?: Date | null;
  }) => [['audit', 'listFullLog'], { input, type: 'query' as const }] as const,

  // ── audit.validateChainIntegrity ──────────────────────────────────────────
  chainIntegrity: (input?: { fromEventId?: string }) =>
    input !== undefined
      ? [['audit', 'validateChainIntegrity'], { input, type: 'query' as const }] as const
      : [['audit', 'validateChainIntegrity'], { type: 'query' as const }] as const,
} as const;
