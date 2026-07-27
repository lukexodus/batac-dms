export const recordsKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['records']] as const,

  // TODO: procedure records.getRetentionSchedule not found in live router — factory function not built, needs a decision
  // TODO: procedure records.isUnderLegalHold not found in live router — factory function not built, needs a decision
} as const;
