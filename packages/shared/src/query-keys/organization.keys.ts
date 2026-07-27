export const orgKeys = {
  // ── Router scope ──────────────────────────────────────────────────────────
  all: () => [['organization']] as const,

  // ── organization.getOfficeHierarchy ───────────────────────────────────────
  officeHierarchy: () => [['organization', 'getOfficeHierarchy'], { type: 'query' as const }] as const,

  // ── organization.getActiveDesignations ────────────────────────────────────
  activeDesignations: () => [['organization', 'getActiveDesignations'], { type: 'query' as const }] as const,

  // ── organization.getDesignationHistory ────────────────────────────────────
  designationHistories: () => [['organization', 'getDesignationHistory']] as const,
  designationHistory: (input: {
    cursor?: string | null;
    pageSize?: number;
    employeeId?: string;
  }) => [['organization', 'getDesignationHistory'], { input, type: 'query' as const }] as const,
} as const;
