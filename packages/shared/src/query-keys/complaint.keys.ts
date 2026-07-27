export const complaintKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['complaints']] as const,

  // TODO: procedure complaints.listAll not found in live router — factory function not built, needs a decision
} as const;
