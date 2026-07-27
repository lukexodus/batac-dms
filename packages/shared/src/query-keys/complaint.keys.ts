export const complaintKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['complaints']] as const,

  // ── complaints.listAllComplaints ──────────────────────────────────────────
  lists: () => [['complaints', 'listAllComplaints']] as const,
  list: (input: {
    cursor?: string;
    limit?: number;
    outcomeState?: 'pending_hearing' | 'received_seen' | 'dismissed' | 'resolved';
  }) => [['complaints', 'listAllComplaints'], { input, type: 'query' as const }] as const,
} as const;
