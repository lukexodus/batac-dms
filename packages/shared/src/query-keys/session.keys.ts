export const sessionKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['session']] as const,

  // ── session.getAttendanceRecord ───────────────────────────────────────────
  attendances: () => [['session', 'getAttendanceRecord']] as const,
  attendance: (sessionDate: Date) =>
    [['session', 'getAttendanceRecord'], { input: { sessionDate }, type: 'query' as const }] as const,

  // ── session.getAttendanceStatistics ──────────────────────────────────────
  attendanceStats: () => [['session', 'getAttendanceStatistics']] as const,
  attendanceStat: (input: { from?: Date | null; to?: Date | null }) =>
    [['session', 'getAttendanceStatistics'], { input, type: 'query' as const }] as const,

  // ── session.getOrderOfBusiness ────────────────────────────────────────────
  orderOfBusinesses: () => [['session', 'getOrderOfBusiness']] as const,
  orderOfBusiness: (input?: { sessionDate?: Date }) =>
    input !== undefined
      ? [['session', 'getOrderOfBusiness'], { input, type: 'query' as const }] as const
      : [['session', 'getOrderOfBusiness'], { type: 'query' as const }] as const,
} as const;
