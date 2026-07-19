// @ts-ignore
import type { WorkflowDefinitionSeed } from '@batac/shared/workflow/step-config.schema.js';
import { eq, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  definitions,
  definitionVersions,
  steps,
  transitionRules,
} from '../../../schema/workflow.schema.js';
import { documentTypes } from '../../../schema/documents.schema.js';
import { WORKFLOW_SEED_NAMESPACE, SEED_SYSTEM_USER_ID, CITY_ID } from './constants.js';
import { uuidv5 } from './uuidv5.js';

const ROLE = {
  // [Corrected — Category 1] 'secretariat_staff' is not a system role code;
  // Part 3.3 of the consolidated reference names one SP Secretary at the
  // head of this office. Affects 6 usage sites: intake_logging,
  // amendments_logging, transmittal_letter_to_mayor, docketing,
  // panlalawigan_transmission_logging, portal_publication.
  SECRETARIAT_STAFF: 'role:sp_secretary',
  SP_SECRETARY: 'role:sp_secretary',
  // [Corrected — Category 2] Was 'role:vice_mayor' (wrong role code AND
  // wrong expression format). H1 §5.2 and wf.md both specify
  // delegation-awareness for this step (vp_certification); 'sp_presiding_officer'
  // is the correct role code per the consolidated reference Part 3.1 and
  // the demo-credentials seed.
  VICE_MAYOR: 'delegation_aware:sp_presiding_officer',
  // [Corrected — Category 2] Was 'role:mayor' (correct role code, wrong
  // expression format — lost delegation-awareness). H1 §5.2 and wf.md both
  // specify delegation-awareness for this step (mayor_review).
  MAYOR: 'delegation_aware:mayor',
  COMMITTEE_LAWS: 'role:committee_laws',
  // [Corrected — Category 4, temporary operational proxy — see LOG-0120]
  // 'legal_officer' does not exist in iam.roles or roleCodeEnum, and the
  // City Legal Office (org code CLO) has no seeded employees. This is a
  // stand-in, not a real fix — see the TODO at this step's usage site
  // (legal_office_review, below) for what the real fix requires.
  LEGAL_OFFICER: 'role:sp_secretary',
  COMMITTEE_CHAIR: 'actor_from_context:referred_committee_chair_id',
  RECORDS_OFFICER: 'role:records_officer',
};

export const SP_RESOLUTION_WORKFLOW: WorkflowDefinitionSeed = {
  definition: {
    name: 'SP Resolution — 7th Sangguniang Panlungsod',
    description: 'Full legislative lifecycle for SP Resolutions',
    document_type_code: 'SP_RESOLUTION',
    is_active: true,
  },
  version: {
    version_number: 1,
    steps: [
      {
        step_key: 'intake_logging',
        step_type: 'action',
        label: 'Secretariat Intake and Logging',
        is_start: true,
        position: 1,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: 'form.sp_resolution.intake',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        },
      },
      {
        step_key: 'order_of_business_scheduling',
        step_type: 'action',
        label: 'Order of Business Scheduling',
        is_start: false,
        position: 2,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: 'form.sp_resolution.order_of_business',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        },
      },
      {
        step_key: 'first_reading',
        step_type: 'action',
        label: 'First Reading — SP Session',
        is_start: false,
        position: 3,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: 'form.sp_resolution.first_reading',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        },
      },
      {
        step_key: 'committee_referral',
        step_type: 'multi_referral',
        label: 'Committee Referral and Hearing',
        is_start: false,
        position: 4,
        legally_mandated: true,
        config: {
          default_committee_roles: [ROLE.COMMITTEE_LAWS],
          report_acceptor_role: ROLE.SP_SECRETARY,
          thursday_cutoff_enabled: true,
          cutoff_time_pht: '23:59:59',
          require_all_committee_signatures: true,
          allow_secretary_advance: true,
        },
      },
      {
        step_key: 'second_reading_vote',
        step_type: 'approval',
        label: 'Second Reading — Vote',
        is_start: false,
        position: 5,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ['APPROVED', 'AMENDED', 'RETURNED_FOR_REVISION', 'REJECTED'],
          require_comment_on: ['REJECTED'],
        },
      },
      {
        step_key: 'amendments_logging',
        step_type: 'action',
        label: 'Amendments Logging — Second Reading',
        is_start: false,
        position: 6,
        legally_mandated: false,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: 'form.sp_resolution.amendments_logging',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        },
      },
      {
        step_key: 'second_reading_amended_vote',
        step_type: 'approval',
        label: 'Second Reading — Final Vote on Amended Version',
        is_start: false,
        position: 7,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ['APPROVED', 'AMENDED', 'REJECTED'],
          require_comment_on: ['REJECTED'],
        },
      },
      {
        step_key: 'final_number_assignment',
        step_type: 'action',
        label: 'Final Series Number Assignment',
        is_start: false,
        position: 8,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: 'form.document.final_number_assignment',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        },
      },
      {
        step_key: 'vp_certification',
        step_type: 'approval',
        label: 'Vice Mayor Signs Certified Copy',
        is_start: false,
        position: 9,
        legally_mandated: true,
        config: { assignee: ROLE.VICE_MAYOR, allowed_outcomes: ['SIGNED'], require_comment_on: [] },
      },
      {
        step_key: 'transmittal_letter_to_mayor',
        step_type: 'action',
        label: 'Transmittal Letter to Mayor',
        is_start: false,
        position: 10,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: 'form.document.transmittal_letter_to_mayor',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
          triggers_mayor_lapse_timer: true,
        },
      },
      {
        step_key: 'mayor_review',
        step_type: 'approval',
        label: 'Mayor Review — 10-Day Window',
        is_start: false,
        position: 11,
        legally_mandated: true,
        config: {
          assignee: ROLE.MAYOR,
          allowed_outcomes: ['SIGNED', 'VETOED', 'LAPSED'],
          require_comment_on: ['VETOED'],
        },
      },
      {
        step_key: 'veto_override_vote',
        step_type: 'approval',
        label: 'Veto Override Vote',
        is_start: false,
        position: 12,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ['OVERRIDE_SUCCEEDED', 'OVERRIDE_FAILED'],
          require_comment_on: [],
        },
      },
      {
        step_key: 'docketing',
        step_type: 'action',
        label: 'Docketing',
        is_start: false,
        position: 13,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: 'form.document.docketing',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        },
      },
      {
        step_key: 'panlalawigan_transmission_logging',
        step_type: 'action',
        label: 'Panlalawigan Transmission Logging',
        is_start: false,
        position: 14,
        legally_mandated: false,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: 'form.panlalawigan.transmission_logging',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
          triggers_panlalawigan_timer: true,
        },
      },
      {
        step_key: 'panlalawigan_review',
        step_type: 'approval',
        label: 'Sangguniang Panlalawigan Review — 30-Day Window',
        is_start: false,
        position: 15,
        legally_mandated: true,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ['VALID', 'VALID_IN_PART', 'RETURNED', 'DEEMED_APPROVED'],
          require_comment_on: ['VALID_IN_PART', 'RETURNED'],
        },
      },
      {
        step_key: 'valid_in_part_action',
        step_type: 'action',
        label: 'VALID-IN-PART — Secretary Documentation',
        is_start: false,
        position: 16,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          form_key: 'form.panlalawigan.valid_in_part_action',
          require_comment: true,
          allow_comment: true,
          auto_complete: false,
        },
      },
      {
        step_key: 'valid_in_part_decision',
        step_type: 'approval',
        label: 'VALID-IN-PART — Secretary Selects Resolution Path',
        is_start: false,
        position: 17,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: [
            'RESOLVED_IN_PLACE',
            'ROUTED_TO_LEGAL',
            'ROUTED_TO_COMMITTEE',
            'REVISED_DIRECTLY',
          ],
          require_comment_on: ['RESOLVED_IN_PLACE', 'REVISED_DIRECTLY'],
        },
      },
      {
        step_key: 'legal_office_review',
        step_type: 'approval',
        label: 'Legal Office Review — VALID_IN_PART',
        is_start: false,
        position: 18,
        legally_mandated: false,
        config: {
          // TODO: Re-route to office_role:city_legal:legal_officer once the
          // IAM legal_officer role is introduced and the engine's
          // office_role: resolution branch is implemented. Currently a
          // temporary operational proxy assigned to SP Secretary — see
          // findings-log LOG-0120.
          assignee: ROLE.LEGAL_OFFICER,
          allowed_outcomes: ['RESOLVED_IN_PLACE'],
          require_comment_on: ['RESOLVED_IN_PLACE'],
        },
      },
      {
        step_key: 'committee_revisions_review',
        step_type: 'approval',
        label: 'Committee Revisions Review — VALID_IN_PART',
        is_start: false,
        position: 19,
        legally_mandated: false,
        config: {
          assignee: ROLE.COMMITTEE_CHAIR,
          allowed_outcomes: ['RESOLVED_IN_PLACE'],
          require_comment_on: ['RESOLVED_IN_PLACE'],
        },
      },
      {
        step_key: 'returned_review',
        step_type: 'approval',
        label: 'RETURNED — Secretariat Decision',
        is_start: false,
        position: 20,
        legally_mandated: false,
        config: {
          assignee: ROLE.SP_SECRETARY,
          allowed_outcomes: ['REPASS', 'RESOLVED_DIRECTLY'],
          require_comment_on: ['REPASS', 'RESOLVED_DIRECTLY'],
        },
      },
      {
        step_key: 'portal_publication',
        step_type: 'action',
        label: 'Public Portal Publication',
        is_start: false,
        position: 21,
        legally_mandated: true,
        config: {
          assignee: ROLE.SECRETARIAT_STAFF,
          form_key: 'form.document.portal_publication',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        },
      },
      {
        step_key: 'archive',
        step_type: 'action',
        label: 'Permanent Archive',
        is_start: false,
        position: 22,
        legally_mandated: false,
        config: {
          assignee: ROLE.RECORDS_OFFICER,
          form_key: 'form.document.archive',
          require_comment: false,
          allow_comment: true,
          auto_complete: false,
        },
      },
      {
        step_key: 'final_outcome_check',
        step_type: 'decision',
        label: 'Final Outcome Check',
        is_start: false,
        position: 23,
        legally_mandated: false,
        config: {
          condition_expression: JSON.stringify({
            in: [{ var: 'panlalawigan_outcome' }, ['VALID', 'DEEMED_APPROVED']],
          }),
          true_outcome: 'TRUE',
          false_outcome: 'FALSE',
        },
      },
      {
        step_key: 'end_approved_and_released',
        step_type: 'termination',
        label: 'Document Approved and Released',
        is_start: false,
        position: 24,
        legally_mandated: false,
        config: { outcome_code: 'APPROVED_AND_RELEASED', final_document_status: 'ARCHIVED' },
      },
      {
        step_key: 'end_valid_in_part_resolved',
        step_type: 'termination',
        label: 'VALID-IN-PART / RETURNED — Resolved by Secretariat',
        is_start: false,
        position: 25,
        legally_mandated: false,
        config: { outcome_code: 'VALID_IN_PART_RESOLVED', final_document_status: 'ARCHIVED' },
      },
      {
        step_key: 'end_rejected_at_vote',
        step_type: 'termination',
        label: 'Document Voted Down',
        is_start: false,
        position: 26,
        legally_mandated: false,
        config: { outcome_code: 'REJECTED_AT_VOTE', final_document_status: 'CANCELLED' },
      },
      {
        step_key: 'end_vetoed_override_failed',
        step_type: 'termination',
        label: 'Veto Override Failed',
        is_start: false,
        position: 27,
        legally_mandated: false,
        config: { outcome_code: 'VETOED_OVERRIDE_FAILED', final_document_status: 'CANCELLED' },
      },
      {
        step_key: 'end_repassed',
        step_type: 'termination',
        label: 'Document Repassed to Drafting',
        is_start: false,
        position: 28,
        legally_mandated: false,
        config: {
          outcome_code: 'REPASSED',
          final_document_status: null,
          emit_event: 'workflow.instance.repassed',
        },
      },
    ],
    transition_rules: [
      {
        from_step_key: 'intake_logging',
        to_step_key: 'order_of_business_scheduling',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },
      {
        from_step_key: 'order_of_business_scheduling',
        to_step_key: 'first_reading',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },
      {
        from_step_key: 'first_reading',
        to_step_key: 'committee_referral',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },

      {
        from_step_key: 'committee_referral',
        to_step_key: 'second_reading_vote',
        outcome_filter: 'REPORT_ACCEPTED',
        condition_expression: null,
        priority: 1,
        label: 'Committee report accepted by SP Secretary',
      },
      {
        from_step_key: 'committee_referral',
        to_step_key: 'second_reading_vote',
        outcome_filter: 'SECRETARY_ADVANCED',
        condition_expression: null,
        priority: 2,
        label: 'SP Secretary manually advanced',
      },
      {
        from_step_key: 'committee_referral',
        to_step_key: 'second_reading_vote',
        outcome_filter: 'BYPASSED_CERTIFIED_URGENT',
        condition_expression: null,
        priority: 3,
        label: 'Certified Urgent bypass',
      },

      {
        from_step_key: 'second_reading_vote',
        to_step_key: 'final_number_assignment',
        outcome_filter: 'APPROVED',
        condition_expression: null,
        priority: 1,
        label: 'Approved — no amendments',
      },
      {
        from_step_key: 'second_reading_vote',
        to_step_key: 'final_number_assignment',
        outcome_filter: 'AMENDED',
        condition_expression: null,
        priority: 1,
        label: 'Amended — no amendments',
      },
      {
        from_step_key: 'second_reading_vote',
        to_step_key: 'amendments_logging',
        outcome_filter: 'RETURNED_FOR_REVISION',
        condition_expression: null,
        priority: 2,
        label: 'Approved with amendments',
      },
      {
        from_step_key: 'second_reading_vote',
        to_step_key: 'end_rejected_at_vote',
        outcome_filter: 'REJECTED',
        condition_expression: null,
        priority: 3,
        label: 'Voted down',
      },

      {
        from_step_key: 'amendments_logging',
        to_step_key: 'second_reading_amended_vote',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },

      {
        from_step_key: 'second_reading_amended_vote',
        to_step_key: 'final_number_assignment',
        outcome_filter: 'APPROVED',
        condition_expression: null,
        priority: 1,
        label: 'Amended version approved',
      },
      {
        from_step_key: 'second_reading_amended_vote',
        to_step_key: 'final_number_assignment',
        outcome_filter: 'AMENDED',
        condition_expression: null,
        priority: 1,
        label: 'Amended version approved (Amended)',
      },
      {
        from_step_key: 'second_reading_amended_vote',
        to_step_key: 'end_rejected_at_vote',
        outcome_filter: 'REJECTED',
        condition_expression: null,
        priority: 2,
        label: 'Amended version voted down',
      },

      {
        from_step_key: 'final_number_assignment',
        to_step_key: 'vp_certification',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },
      {
        from_step_key: 'vp_certification',
        to_step_key: 'transmittal_letter_to_mayor',
        outcome_filter: 'SIGNED',
        condition_expression: null,
        priority: 1,
        label: 'Vice Mayor signed certified copy',
      },
      {
        from_step_key: 'transmittal_letter_to_mayor',
        to_step_key: 'mayor_review',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },

      {
        from_step_key: 'mayor_review',
        to_step_key: 'docketing',
        outcome_filter: 'SIGNED',
        condition_expression: null,
        priority: 1,
        label: 'Mayor signed',
      },
      {
        from_step_key: 'mayor_review',
        to_step_key: 'docketing',
        outcome_filter: 'LAPSED',
        condition_expression: null,
        priority: 2,
        label: 'Lapsed into law',
      },
      {
        from_step_key: 'mayor_review',
        to_step_key: 'veto_override_vote',
        outcome_filter: 'VETOED',
        condition_expression: null,
        priority: 3,
        label: 'Mayor vetoed',
      },

      {
        from_step_key: 'veto_override_vote',
        to_step_key: 'docketing',
        outcome_filter: 'OVERRIDE_SUCCEEDED',
        condition_expression: null,
        priority: 1,
        label: 'Override succeeded',
      },
      {
        from_step_key: 'veto_override_vote',
        to_step_key: 'end_vetoed_override_failed',
        outcome_filter: 'OVERRIDE_FAILED',
        condition_expression: null,
        priority: 2,
        label: 'Override failed',
      },

      {
        from_step_key: 'docketing',
        to_step_key: 'panlalawigan_transmission_logging',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },
      {
        from_step_key: 'panlalawigan_transmission_logging',
        to_step_key: 'panlalawigan_review',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },

      {
        from_step_key: 'panlalawigan_review',
        to_step_key: 'portal_publication',
        outcome_filter: 'VALID',
        condition_expression: null,
        priority: 1,
        label: null,
      },
      {
        from_step_key: 'panlalawigan_review',
        to_step_key: 'portal_publication',
        outcome_filter: 'DEEMED_APPROVED',
        condition_expression: null,
        priority: 2,
        label: 'Deemed approved',
      },
      {
        from_step_key: 'panlalawigan_review',
        to_step_key: 'valid_in_part_action',
        outcome_filter: 'VALID_IN_PART',
        condition_expression: null,
        priority: 3,
        label: null,
      },
      {
        from_step_key: 'panlalawigan_review',
        to_step_key: 'returned_review',
        outcome_filter: 'RETURNED',
        condition_expression: null,
        priority: 4,
        label: 'Returned with objections',
      },

      {
        from_step_key: 'valid_in_part_action',
        to_step_key: 'valid_in_part_decision',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },

      {
        from_step_key: 'valid_in_part_decision',
        to_step_key: 'portal_publication',
        outcome_filter: 'RESOLVED_IN_PLACE',
        condition_expression: null,
        priority: 1,
        label: 'Resolved as-is',
      },
      {
        from_step_key: 'valid_in_part_decision',
        to_step_key: 'legal_office_review',
        outcome_filter: 'ROUTED_TO_LEGAL',
        condition_expression: null,
        priority: 2,
        label: null,
      },
      {
        from_step_key: 'valid_in_part_decision',
        to_step_key: 'committee_revisions_review',
        outcome_filter: 'ROUTED_TO_COMMITTEE',
        condition_expression: null,
        priority: 3,
        label: null,
      },
      {
        from_step_key: 'valid_in_part_decision',
        to_step_key: 'portal_publication',
        outcome_filter: 'REVISED_DIRECTLY',
        condition_expression: null,
        priority: 4,
        label: 'Secretariat implements revisions',
      },

      {
        from_step_key: 'legal_office_review',
        to_step_key: 'portal_publication',
        outcome_filter: 'RESOLVED_IN_PLACE',
        condition_expression: null,
        priority: 1,
        label: "Legal Officer's recommendation logged",
      },
      {
        from_step_key: 'committee_revisions_review',
        to_step_key: 'portal_publication',
        outcome_filter: 'RESOLVED_IN_PLACE',
        condition_expression: null,
        priority: 1,
        label: "Committee Chair's recommendation logged",
      },

      {
        from_step_key: 'returned_review',
        to_step_key: 'portal_publication',
        outcome_filter: 'RESOLVED_DIRECTLY',
        condition_expression: null,
        priority: 1,
        label: 'Secretariat implements Panlalawigan recommendations',
      },
      {
        from_step_key: 'returned_review',
        to_step_key: 'end_repassed',
        outcome_filter: 'REPASS',
        condition_expression: null,
        priority: 2,
        label: 'Document returned to drafting',
      },

      {
        from_step_key: 'portal_publication',
        to_step_key: 'archive',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },
      {
        from_step_key: 'archive',
        to_step_key: 'final_outcome_check',
        outcome_filter: null,
        condition_expression: null,
        priority: 1,
        label: null,
      },

      {
        from_step_key: 'final_outcome_check',
        to_step_key: 'end_approved_and_released',
        outcome_filter: 'TRUE',
        condition_expression: null,
        priority: 1,
        label: 'panlalawigan_outcome in VALID, DEEMED_APPROVED',
      },
      {
        from_step_key: 'final_outcome_check',
        to_step_key: 'end_valid_in_part_resolved',
        outcome_filter: 'FALSE',
        condition_expression: null,
        priority: 2,
        label: 'panlalawigan_outcome in VALID_IN_PART, RETURNED',
      },
    ],
  },
};

const cloneWorkflow = (wf: typeof SP_RESOLUTION_WORKFLOW) =>
  JSON.parse(JSON.stringify(wf)) as typeof SP_RESOLUTION_WORKFLOW;

export const SP_ORDINANCE_WORKFLOW: WorkflowDefinitionSeed = (() => {
  const wf = cloneWorkflow(SP_RESOLUTION_WORKFLOW);
  wf.definition.name = 'SP Ordinance — 7th Sangguniang Panlungsod';
  wf.definition.document_type_code = 'SP_ORDINANCE';
  wf.definition.description = 'Same as SP Resolution, except for Ordinance document type.';

  const ordSteps = wf.version.steps;
  const ordRules = wf.version.transition_rules;

  // 1. Replace second_reading_amended_vote with third_reading_vote
  const stepIndex7 = ordSteps.findIndex((s: any) => s.step_key === 'second_reading_amended_vote');
  if (stepIndex7 !== -1) {
    ordSteps[stepIndex7] = {
      step_key: 'third_reading_vote',
      step_type: 'approval',
      label: 'Third Reading — Final Vote',
      position: ordSteps[stepIndex7]!.position,
      legally_mandated: true,
      config: {
        assignee: ROLE.SP_SECRETARY,
        allowed_outcomes: ['APPROVED', 'AMENDED', 'REJECTED'],
        require_comment_on: ['REJECTED'],
      },
    } as any;
  }

  // 2. Change second_reading_vote → final_number_assignment (APPROVED) to third_reading_vote
  const rule1 = ordRules.find(
    (r: any) => r.from_step_key === 'second_reading_vote' && r.outcome_filter === 'APPROVED',
  );
  if (rule1) rule1.to_step_key = 'third_reading_vote';

  // 3. Change amendments_logging → second_reading_amended_vote to third_reading_vote
  const rule2 = ordRules.find(
    (r: any) =>
      r.from_step_key === 'amendments_logging' && r.to_step_key === 'second_reading_amended_vote',
  );
  if (rule2) rule2.to_step_key = 'third_reading_vote';

  // 4. Add third_reading_vote transition rules
  ordRules.push(
    {
      from_step_key: 'third_reading_vote',
      to_step_key: 'final_number_assignment',
      outcome_filter: 'APPROVED',
      condition_expression: null,
      priority: 1,
      label: null,
    },
    {
      from_step_key: 'third_reading_vote',
      to_step_key: 'amendments_logging',
      outcome_filter: 'AMENDED',
      condition_expression: null,
      priority: 2,
      label: 'Amended at third reading',
    },
    {
      from_step_key: 'third_reading_vote',
      to_step_key: 'end_rejected_at_vote',
      outcome_filter: 'REJECTED',
      condition_expression: null,
      priority: 3,
      label: null,
    },
  );

  // 5. Insert publication_check and newspaper_publication after archive
  const archiveIndex = ordSteps.findIndex((s: any) => s.step_key === 'archive');
  const pubCheckStep = {
    step_key: 'publication_check',
    step_type: 'decision',
    label: 'Check Publication Requirement',
    position: 0,
    legally_mandated: false,
    config: {
      condition_expression: JSON.stringify({ '==': [{ var: 'requires_publication' }, true] }),
      true_outcome: 'TRUE',
      false_outcome: 'FALSE',
    },
  };
  const newsPubStep = {
    step_key: 'newspaper_publication',
    step_type: 'action',
    label: 'Newspaper Publication',
    position: 0,
    legally_mandated: false,
    config: {
      assignee: ROLE.SP_SECRETARY,
      form_key: 'form.document.newspaper_publication',
      require_comment: false,
      allow_comment: true,
      auto_complete: false,
    },
  };

  if (archiveIndex !== -1) {
    ordSteps.splice(archiveIndex + 1, 0, pubCheckStep as any, newsPubStep as any);
  }

  // Renumber remaining
  ordSteps.forEach((s: any, idx: number) => (s.position = idx + 1));

  // 6. Redirect rules targeting portal_publication to publication_check
  ordRules.forEach((r: any) => {
    if (r.to_step_key === 'portal_publication') {
      r.to_step_key = 'publication_check';
    }
  });

  // 7. Add publication_check rules
  ordRules.push(
    {
      from_step_key: 'publication_check',
      to_step_key: 'newspaper_publication',
      outcome_filter: 'TRUE',
      condition_expression: null,
      priority: 1,
      label: null,
    },
    {
      from_step_key: 'publication_check',
      to_step_key: 'portal_publication',
      outcome_filter: 'FALSE',
      condition_expression: null,
      priority: 2,
      label: null,
    },
    {
      from_step_key: 'newspaper_publication',
      to_step_key: 'portal_publication',
      outcome_filter: null,
      condition_expression: null,
      priority: 1,
      label: null,
    },
  );

  wf.version.transition_rules = ordRules.filter(
    (r: any) => r.from_step_key !== 'second_reading_amended_vote',
  );
  return wf;
})();

export const APPROPRIATION_ORDINANCE_WORKFLOW: WorkflowDefinitionSeed = (() => {
  const wf = cloneWorkflow(SP_RESOLUTION_WORKFLOW);
  wf.definition.name = 'Appropriation Ordinance — 7th Sangguniang Panlungsod';
  wf.definition.document_type_code = 'SP_APPROPRIATION_ORDINANCE';
  wf.definition.description =
    'Same as SP Resolution, except for Appropriation Ordinance document type.';

  const appOrdSteps = wf.version.steps;
  const appOrdRules = wf.version.transition_rules;

  const stepIndex7App = appOrdSteps.findIndex(
    (s: any) => s.step_key === 'second_reading_amended_vote',
  );
  if (stepIndex7App !== -1) {
    appOrdSteps[stepIndex7App] = {
      step_key: 'third_reading_vote',
      step_type: 'approval',
      label: 'Third Reading — Final Vote',
      position: appOrdSteps[stepIndex7App]!.position,
      legally_mandated: true,
      config: {
        assignee: ROLE.SP_SECRETARY,
        allowed_outcomes: ['APPROVED', 'AMENDED', 'REJECTED'],
        require_comment_on: ['REJECTED'],
      },
    } as any;
  }

  const appRule1 = appOrdRules.find(
    (r: any) => r.from_step_key === 'second_reading_vote' && r.outcome_filter === 'APPROVED',
  );
  if (appRule1) appRule1.to_step_key = 'third_reading_vote';

  const appRule2 = appOrdRules.find(
    (r: any) =>
      r.from_step_key === 'amendments_logging' && r.to_step_key === 'second_reading_amended_vote',
  );
  if (appRule2) appRule2.to_step_key = 'third_reading_vote';

  appOrdRules.push(
    {
      from_step_key: 'third_reading_vote',
      to_step_key: 'final_number_assignment',
      outcome_filter: 'APPROVED',
      condition_expression: null,
      priority: 1,
      label: null,
    },
    {
      from_step_key: 'third_reading_vote',
      to_step_key: 'amendments_logging',
      outcome_filter: 'AMENDED',
      condition_expression: null,
      priority: 2,
      label: 'Amended at third reading',
    },
    {
      from_step_key: 'third_reading_vote',
      to_step_key: 'end_rejected_at_vote',
      outcome_filter: 'REJECTED',
      condition_expression: null,
      priority: 3,
      label: null,
    },
  );

  // 1. Add "OPERATIVE_IN_ITS_ENTIRETY" to panlalawigan_review allowed_outcomes
  const panRevStep = appOrdSteps.find((s: any) => s.step_key === 'panlalawigan_review');
  if (panRevStep) {
    (panRevStep.config as any).allowed_outcomes.push('OPERATIVE_IN_ITS_ENTIRETY');
  }

  // 2. Add transition rule panlalawigan_review → portal_publication (OPERATIVE_IN_ITS_ENTIRETY)
  appOrdRules.push({
    from_step_key: 'panlalawigan_review',
    to_step_key: 'portal_publication',
    outcome_filter: 'OPERATIVE_IN_ITS_ENTIRETY',
    condition_expression: null,
    priority: 1,
    label: 'Operative in its entirety',
  });

  // 3. Change final_outcome_check condition
  const finalOutcomeCheckStep = appOrdSteps.find((s: any) => s.step_key === 'final_outcome_check');
  if (finalOutcomeCheckStep) {
    (finalOutcomeCheckStep.config as any).condition_expression = JSON.stringify({
      in: [
        { var: 'panlalawigan_outcome' },
        ['VALID', 'DEEMED_APPROVED', 'OPERATIVE_IN_ITS_ENTIRETY'],
      ],
    });
  }

  wf.version.transition_rules = appOrdRules.filter(
    (r: any) => r.from_step_key !== 'second_reading_amended_vote',
  );
  return wf;
})();

const ALL_WORKFLOWS = [
  SP_RESOLUTION_WORKFLOW,
  SP_ORDINANCE_WORKFLOW,
  APPROPRIATION_ORDINANCE_WORKFLOW,
];

export async function seedPhase1WorkflowDefinitions(
  db: any,
  documentTypeIds?: Record<string, string>,
) {
  const transaction = db as PgDatabase<any, any, any>;

  for (const wf of ALL_WORKFLOWS) {
    let documentTypeId = documentTypeIds?.[wf.definition.document_type_code];
    if (!documentTypeId) {
      const docTypeRes = await transaction
        .select({ id: documentTypes.id })
        .from(documentTypes)
        .where(sql`${documentTypes.code} = ${wf.definition.document_type_code}`)
        .limit(1);
      if (!docTypeRes.length) {
        throw new Error(
          `[seed] Failed to resolve Document Type ID for ${wf.definition.document_type_code}. Ensure document-types seed has run.`,
        );
      }
      documentTypeId = docTypeRes[0]!.id;
    }

    const defId = uuidv5(`wf-def-${wf.definition.document_type_code}`, WORKFLOW_SEED_NAMESPACE);
    const versionId = uuidv5(
      `wf-ver-${wf.definition.document_type_code}-${wf.version.version_number}`,
      WORKFLOW_SEED_NAMESPACE,
    );

    await transaction
      .insert(definitions)
      .values({
        id: defId,
        cityId: CITY_ID,
        name: wf.definition.name,
        description: wf.definition.description,
        documentTypeId,
        isActive: false, // deferred until after validation
        createdBy: SEED_SYSTEM_USER_ID,
      })
      .onConflictDoNothing();

    await transaction
      .insert(definitionVersions)
      .values({
        id: versionId,
        definitionId: defId,
        versionNumber: wf.version.version_number,
        snapshot: wf.version,
        publishedAt: null, // deferred until after validation
        publishedBy: null,
      })
      .onConflictDoNothing();

    const stepsToInsert = wf.version.steps.map((step: any) => ({
      id: uuidv5(`wf-step-${versionId}-${step.step_key}`, WORKFLOW_SEED_NAMESPACE),
      definitionVersionId: versionId,
      stepKey: step.step_key,
      stepType: step.step_type as any,
      isStart: step.is_start,
      legallyMandated: step.legally_mandated,
      position: step.position,
      label: step.label,
      config: step.config,
    }));

    if (stepsToInsert.length > 0) {
      await transaction.insert(steps).values(stepsToInsert).onConflictDoNothing();
    }

    const stepIdMap = Object.fromEntries(stepsToInsert.map((s: any) => [s.stepKey, s.id]));

    const rulesToInsert = wf.version.transition_rules.map((rule: any, idx: number) => ({
      id: uuidv5(
        `wf-rule-${versionId}-${rule.from_step_key}-${rule.to_step_key}-${idx}`,
        WORKFLOW_SEED_NAMESPACE,
      ),
      definitionVersionId: versionId,
      fromStepId: stepIdMap[rule.from_step_key],
      toStepId: stepIdMap[rule.to_step_key],
      outcomeFilter: rule.outcome_filter,
      conditionExpression: rule.condition_expression,
      priority: rule.priority,
      label: rule.label,
    }));

    if (rulesToInsert.length > 0) {
      await transaction.insert(transitionRules).values(rulesToInsert).onConflictDoNothing();
    }

    // Validate before publishing — let import failures propagate so the
    // outer db.transaction() catches them and rolls back cleanly.
    const deps = {
      workflowRepository: {
        getStepsAndRulesForValidation: async () => ({
          steps: stepsToInsert,
          transitionRules: rulesToInsert,
        }),
      },
    };

    const validatorPath =
      '../../../../../apps/server/src/modules/workflow/engine/definition-validator.ts';
    const validatorMod = await import(validatorPath);
    const validateDefinitionForPublish = validatorMod.validateDefinitionForPublish;

    const result = await validateDefinitionForPublish(versionId, deps as any);
    if (!result.valid) {
      throw new Error(
        `[seed] Validation failed for ${wf.definition.document_type_code}: ${JSON.stringify(result.errors)}`,
      );
    }

    // Validation passed — mark published and activate.
    await transaction
      .update(definitionVersions)
      .set({
        publishedAt: new Date(),
        publishedBy: SEED_SYSTEM_USER_ID,
        isCurrent: true,
      })
      .where(eq(definitionVersions.id, versionId));

    await transaction
      .update(definitions)
      .set({
        isActive: true,
      })
      .where(eq(definitions.id, defId));
  }
}
