export const iamKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['iam']] as const,

  // ── iam.getCurrentUser ────────────────────────────────────────────────────
  currentUser: () => [['iam', 'getCurrentUser'], { type: 'query' as const }] as const,

  // ── iam.listActiveSessions ────────────────────────────────────────────────
  ownSessions: () => [['iam', 'listActiveSessions'], { type: 'query' as const }] as const,

  // ── iam.listAllActiveSessions ─────────────────────────────────────────────
  allSessions: () => [['iam', 'listAllActiveSessions']] as const,
  allSessionsList: (input: { cursor?: string | null; pageSize?: number }) =>
    [['iam', 'listAllActiveSessions'], { input, type: 'query' as const }] as const,

  // ── iam.listUserDirectory ─────────────────────────────────────────────────
  userDirectory: () => [['iam', 'listUserDirectory']] as const,
  userDirectoryList: (input: {
    cursor?: string | null;
    pageSize?: number;
    officeId?: string;
    search?: string;
  }) => [['iam', 'listUserDirectory'], { input, type: 'query' as const }] as const,
} as const;
