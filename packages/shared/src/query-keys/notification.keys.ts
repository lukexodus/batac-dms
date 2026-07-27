export const notificationKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['notifications']] as const,

  // TODO: procedure notifications.listMine not found in live router — factory function not built, needs a decision
  // TODO: procedure notifications.getOwnPreferences not found in live router — factory function not built, needs a decision
  // TODO: procedure notifications.listDeliveryLogs not found in live router — factory function not built, needs a decision
} as const;
