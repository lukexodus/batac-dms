import { z } from 'zod';

/**
 * WorkflowContextSchema
 *
 * Zod validation schema for the JSONB context stored on `workflow.instances.context`.
 * Used to store mutable workflow instance context state variables.
 * All keys are optional/nullable at initialization and transition to set values
 * as the workflow progresses.
 *
 * Source: B4 Appendix B + H1 (VALID_IN_PART routing)
 */
export const WorkflowContextSchema = z.object({
  // Set at instance creation
  document_id: z.string().uuid().optional(),
  document_type: z.enum(['sp_resolution', 'sp_ordinance', 'appropriation_ordinance']).optional(),
  created_by: z.string().uuid().optional(), // encoder reference for invariant 11: encoder ≠ final approver

  // Written by documents module callbacks
  series_number_preliminary: z.string().nullable().optional(),
  series_number_final: z.string().nullable().optional(),
  qr_tracking_id: z.string().uuid().nullable().optional(),

  // Certified Urgent (set by bypass handler)
  certified_urgent: z.boolean().optional().default(false),
  certified_urgent_document_id: z.string().uuid().nullable().optional(),

  // Thursday cutoff scheduler output (ISO date string YYYY-MM-DD)
  second_reading_eligible_date: z.string().nullable().optional(),

  // Mayor review (set by context writer on transmittal_letter_to_mayor completion)
  mayor_transmittal_date: z.string().nullable().optional(), // TIMESTAMPTZ string
  mayor_action_deadline: z.string().nullable().optional(), // TIMESTAMPTZ string
  mayor_action: z.enum(['SIGNED', 'VETOED', 'LAPSED']).nullable().optional(),
  mayor_action_date: z.string().nullable().optional(),

  // Veto override (set by override approval step)
  veto_override_vote_count: z.number().int().nullable().optional(),
  veto_override_outcome: z.enum(['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED']).nullable().optional(),

  // Panlalawigan review (set by context writer on panlalawigan_transmission_logging completion)
  panlalawigan_transmission_date: z.string().nullable().optional(),
  panlalawigan_action_deadline: z.string().nullable().optional(),
  panlalawigan_outcome: z
    .enum(['VALID', 'VALID_IN_PART', 'RETURNED', 'DEEMED_APPROVED', 'OPERATIVE_IN_ITS_ENTIRETY'])
    .nullable()
    .optional(),
  panlalawigan_response_date: z.string().nullable().optional(),
  panlalawigan_resolution_number: z.string().nullable().optional(),

  // Newspaper publication (set by decision and action steps)
  requires_publication: z.boolean().optional(),
  publication_date: z.string().nullable().optional(),
  publication_newspaper: z.string().nullable().optional(),

  // VALID_IN_PART routing (referred committee chairperson ID)
  referred_committee_chair_id: z.string().uuid().nullable().optional(),

  // SLA control (always false in Phase 1; reserved)
  sla_paused: z.literal(false).optional(),
});

export type WorkflowContext = z.infer<typeof WorkflowContextSchema>;
