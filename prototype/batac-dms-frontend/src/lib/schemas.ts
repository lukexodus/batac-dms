import { z } from "zod"

export const DocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  office: z.string().optional(),
  date: z.string().optional(),
  status: z.string(),
  classification: z.string().optional(),
  size: z.string().optional(),
  ver: z.number().optional(),
  submittedBy: z.string().optional(),
  dueDate: z.string().optional(),
  daysInQueue: z.number().optional(),
  priority: z.string().optional(),
  committee: z.string().optional(),
  author: z.string().optional(),
  session: z.string().optional(),
})

export const SLADataSchema = z.object({
  id: z.string(),
  name: z.string(),
  compliant: z.number(),
  breach: z.number()
})

export const DeptWorkloadSchema = z.object({
  id: z.string(),
  subject: z.string(),
  A: z.number(),
  fullMark: z.number()
})

export const SessionCalendarSchema = z.object({
  id: z.string(),
  date: z.string(),
  day: z.string().optional(),
  title: z.string().optional(),
  time: z.string().optional(),
  type: z.string(),
  items: z.number()
})

export const LegislativeOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  resolutions: z.number(),
  ordinances: z.number()
})

export const RoutingHistorySchema = z.object({
  id: z.string(),
  office: z.string(),
  action: z.string(),
  detail: z.string(),
  timestamp: z.string(),
  status: z.string(),
  user: z.string(),
  role: z.string()
})

export type Document = z.infer<typeof DocumentSchema>
export type SLAData = z.infer<typeof SLADataSchema>
export type DeptWorkload = z.infer<typeof DeptWorkloadSchema>
export type SessionCalendar = z.infer<typeof SessionCalendarSchema>
export type LegislativeOutput = z.infer<typeof LegislativeOutputSchema>
export type RoutingHistory = z.infer<typeof RoutingHistorySchema>
