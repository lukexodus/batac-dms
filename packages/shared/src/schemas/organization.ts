import { z } from 'zod';

export const OfficeSummarySchema = z.object({
  officeId: z.uuid(),
  name: z.string(),
  parentOfficeId: z.uuid().nullable(),
  type: z.enum(['executive', 'legislative', 'department', 'barangay', 'external']),
});

export type OfficeSummary = z.infer<typeof OfficeSummarySchema>;
