import { z } from 'zod';

// --- Workflow Enums ---

export const StepTypeSchema = z.enum([
  'action',
  'approval',
  'multi_referral', // Phase 1: all assigned committees must sign unified report
  'decision',
  'notification',
  'termination',
  'parallel_split', // Phase 2 (reserved in data model)
  'parallel_join', // Phase 2 (reserved in data model)
]);
export type StepType = z.infer<typeof StepTypeSchema>;

export const WorkflowInstanceStatusSchema = z.enum([
  'pending',
  'active',
  'completed',
  'cancelled',
  'suspended',
]);
export type WorkflowInstanceStatus = z.infer<typeof WorkflowInstanceStatusSchema>;

export const StepInstanceStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'pending_action',
  'completed',
  'skipped',
  'bypassed',
  'cancelled',
]);
export type StepInstanceStatus = z.infer<typeof StepInstanceStatusSchema>;

export const ApprovalDecisionSchema = z.enum([
  'approved',
  'rejected',
  'returned_for_revision',
  'amended',
]);
export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;

// --- Step Configurations ---

export const ActionStepConfigSchema = z.object({
  assignee: z.string().min(1),
  form_key: z.string().optional(),
  require_comment: z.boolean().default(false),
  allow_comment: z.boolean().default(true),
  auto_complete: z.boolean().default(false),
  deadline_hours: z.number().int().positive().optional(),
  triggers_mayor_lapse_timer: z.boolean().optional(),
  triggers_panlalawigan_timer: z.boolean().optional(),
});
export type ActionStepConfig = z.infer<typeof ActionStepConfigSchema>;

export const ApprovalStepConfigSchema = z.object({
  assignee: z.string().min(1),
  allowed_outcomes: z.array(z.string()).min(1),
  require_comment_on: z.array(z.string()).default(['REJECTED', 'RETURNED_FOR_REVISION']),
  deadline_hours: z.number().int().positive().optional(),
  is_final_approval: z.boolean().optional(),
});
export type ApprovalStepConfig = z.infer<typeof ApprovalStepConfigSchema>;

export const MultiReferralStepConfigSchema = z.object({
  default_committee_roles: z.array(z.string()),
  report_acceptor_role: z.string().min(1),
  thursday_cutoff_enabled: z.boolean(),
  cutoff_time_pht: z.string().default('23:59:59'),
  require_all_committee_signatures: z.boolean(),
  allow_secretary_advance: z.boolean(),
});
export type MultiReferralStepConfig = z.infer<typeof MultiReferralStepConfigSchema>;

export const DecisionStepConfigSchema = z.object({
  condition_expression: z.string().min(1),
  true_outcome: z.string().default('TRUE'),
  false_outcome: z.string().default('FALSE'),
});
export type DecisionStepConfig = z.infer<typeof DecisionStepConfigSchema>;

export const NotificationStepConfigSchema = z.object({
  template_key: z.string().min(1),
  recipients: z.array(z.string()).min(1),
  channels: z.array(z.string()).default(['in_app']),
  payload_context_keys: z.array(z.string()).optional(),
});
export type NotificationStepConfig = z.infer<typeof NotificationStepConfigSchema>;

export const TerminationStepConfigSchema = z.object({
  outcome_code: z.enum([
    'APPROVED_AND_RELEASED',
    'LAPSED_INTO_LAW',
    'DEEMED_APPROVED_PANLALAWIGAN',
    'VETOED_OVERRIDE_FAILED',
    'REJECTED_AT_VOTE',
    'ARCHIVED_NO_ACTION',
    'CANCELLED',
    'VALID_IN_PART_RESOLVED',
    'REPASSED',
  ]),
  final_document_status: z.enum(['RELEASED', 'ARCHIVED', 'CANCELLED']).nullable(),
  emit_event: z.string().optional(),
});
export type TerminationStepConfig = z.infer<typeof TerminationStepConfigSchema>;

// --- Step, Transition, and Seed structures ---

const CommonStepDefFields = {
  step_key: z.string().min(1),
  label: z.string().min(1),
  is_start: z.boolean(),
  position: z.number().int().nonnegative(),
  legally_mandated: z.boolean(),
};

export const WorkflowStepDefSchema = z.discriminatedUnion('step_type', [
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('action'),
    config: ActionStepConfigSchema,
  }),
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('approval'),
    config: ApprovalStepConfigSchema,
  }),
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('multi_referral'),
    config: MultiReferralStepConfigSchema,
  }),
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('decision'),
    config: DecisionStepConfigSchema,
  }),
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('notification'),
    config: NotificationStepConfigSchema,
  }),
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('termination'),
    config: TerminationStepConfigSchema,
  }),
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('parallel_split'),
    config: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    ...CommonStepDefFields,
    step_type: z.literal('parallel_join'),
    config: z.record(z.string(), z.unknown()).optional(),
  }),
]);
export type WorkflowStepDef = z.infer<typeof WorkflowStepDefSchema>;

export const WorkflowTransitionRuleDefSchema = z.object({
  from_step_key: z.string().min(1),
  to_step_key: z.string().min(1),
  outcome_filter: z.string().nullable(),
  condition_expression: z.string().nullable(),
  priority: z.number().int(),
  label: z.string().nullable(),
});
export type WorkflowTransitionRuleDef = z.infer<typeof WorkflowTransitionRuleDefSchema>;

export const WorkflowDefinitionSeedSchema = z.object({
  definition: z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    document_type_code: z.string().min(1),
    is_active: z.boolean(),
  }),
  version: z.object({
    version_number: z.number().int().positive(),
    steps: z.array(WorkflowStepDefSchema),
    transition_rules: z.array(WorkflowTransitionRuleDefSchema),
  }),
});
export type WorkflowDefinitionSeed = z.infer<typeof WorkflowDefinitionSeedSchema>;
