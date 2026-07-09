import { TRPCError } from '@trpc/server';
import type { AuthContext } from '../iam/iam.types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * The authenticated subject's ABAC attributes, as pre-fetched by the caller
 * (tRPC procedure) from the JWT/session context.
 *
 * This is a local alias for the IAM module's real `AuthContext` type —
 * identical to the alias used by `DocumentPolicyGuard` in TASK-DOCS-009.
 * The field names (`isItAdmin`, `isPlatformAdmin`, `committeeIds`, etc.) match
 * the real `AuthContext` shape shipped by TASK-IAM-004, not the shorthand
 * names used in the I1 §1 reference table. See LOG-0026 for the reconciliation.
 *
 * Source: I1 §1 Subject Attributes Reference; TASK-IAM-004.
 */
export type SubjectContext = AuthContext;

// ─── Step type / status enums (I1 §6 resource attributes) ───────────────────

export type StepType =
  | 'action'
  | 'approval'
  | 'multi_referral'
  | 'decision'
  | 'notification'
  | 'termination'
  | 'parallel_split'
  | 'parallel_join';

export type StepStatus =
  | 'pending'
  | 'active'
  | 'completed'
  | 'skipped'
  | 'overridden';

// ─── Resource attribute types ─────────────────────────────────────────────────

/**
 * Attributes for a `workflow_instance` read check (I1 §5.1).
 * Pre-fetched by the calling procedure before invoking the guard.
 */
export interface WorkflowInstanceReadAttrs {
  /** `instances.document_id` resolved to `documents.office_id` */
  documentOfficeId: string;
  /** Resolved `documents.classification_level` */
  classificationLevel: 'public' | 'internal' | 'confidential' | 'restricted';
}

/**
 * Attributes for any step-instance action check (I1 §6.2–6.9).
 *
 * **DB fetch contract (caller responsibility):**
 * The calling procedure must fetch and join:
 *   - `workflow.step_instances` row (status, assignedTo JSONB, metadata JSONB)
 *   - `workflow.steps` row (stepType, stepKey, isFinalApprovalStep)
 *   - `workflow.instances` row (documentId, createdBy)
 *   - resolved `documents.created_by` and `documents.office_id`
 *
 * `assignedTo` is the JSONB blob stored on `step_instances.assigned_to`.
 * The guard reads `assignedTo.user_id` and `assignedTo.office_id` from this
 * blob. Both may be null when the step is office-queue–assigned with no named user.
 *
 * Source: I1 §6 Resource Attributes Used; workflow.schema.ts.
 */
export interface StepInstanceAttrs {
  /** `step_instances.status` */
  stepStatus: StepStatus;
  /** `steps.step_type` */
  stepType: StepType;
  /** `steps.step_key` (logical name, e.g. 'vp_certification', 'mayor_review') */
  stepKey: string;
  /**
   * `is_final_approval_step` — declared boolean on `workflow.steps`, set by
   * the workflow definition author and validated at publish time.
   * [Resolved — D-ABAC-05] See I1 §6.3 for the full resolution.
   */
  isFinalApprovalStep: boolean;
  /**
   * `step_instances.assigned_to->>'user_id'` — specific user directly assigned
   * to this step instance; null when the step is office-queue only.
   */
  assigneeUserId: string | null;
  /**
   * `step_instances.assigned_to->>'office_id'` — office responsible for this step.
   */
  assigneeOfficeId: string | null;
  /**
   * `step_instances.metadata->>'assigned_committee_ids'` — for multi_referral
   * steps; the set of committee UUIDs that must provide a report.
   * Null/undefined when not a multi_referral step.
   */
  assignedCommitteeIds?: string[] | null;
  /**
   * `workflow.instances.created_by` — the user who created the parent
   * workflow instance. Used for Invariant #13 (encoder cannot be final approver)
   * and for encoder-restriction checks (I1 §6.2).
   */
  instanceCreatedBy: string;
  /**
   * Resolved `documents.created_by` (the document author). Used for the
   * encoder restriction (I1 §6.2): a dept_encoder or brgy_encoder may complete
   * a step on a document they authored, even if not directly assigned.
   */
  documentCreatedBy: string;
}

// ─── Role sets (I1 §5, §6; I2 §6) ───────────────────────────────────────────

/** I1 §5.1 own-office read for `workflow_instance:read`. */
const INSTANCE_OWN_OFFICE_READ_ROLES: ReadonlySet<string> = new Set([
  'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
  'records_officer', 'auditor', 'plat_admin',
]);

/** I1 §5.1 cross-office read — additionally requires classification in {'public','internal'}. */
const INSTANCE_CROSS_OFFICE_READ_ROLES: ReadonlySet<string> = new Set([
  'records_officer', 'sp_presiding_officer', 'mayor', 'auditor',
]);

/** I1 §6.2 `step_instance:complete_action` base role set (encoder restriction applied separately). */
const ACTION_STEP_ROLES: ReadonlySet<string> = new Set([
  'dept_encoder', 'dept_approver', 'sp_secretary',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
]);

/** I1 §6.3 `step_instance:approve` / `reject` / `return` base role set. */
const APPROVAL_STEP_ROLES: ReadonlySet<string> = new Set([
  'dept_approver', 'sp_secretary', 'mayor', 'brgy_captain',
]);

/** I1 §6.2 ENCODER RESTRICTION — roles blocked from claiming general office queue steps. */
const ENCODER_ROLES: ReadonlySet<string> = new Set(['dept_encoder', 'brgy_encoder']);

/**
 * I2 §16 "View ARTA SLA compliance report" — five permitted roles, cross-office,
 * no office scoping applied. [Confirmed — I2 §16; acceptance criteria]
 */
const SLA_READ_ROLES: ReadonlySet<string> = new Set([
  'records_officer', 'sp_secretary', 'sp_presiding_officer', 'mayor', 'auditor',
]);

/** I1 §6.5 — valid step keys for mayor actions. */
const MAYOR_STEP_KEYS: ReadonlySet<string> = new Set(['mayor_review', 'mayor_signature']);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rolesIntersect(subjectRoles: readonly string[], allowed: ReadonlySet<string>): boolean {
  return subjectRoles.some((role) => allowed.has(role));
}

function isEncoderRole(subjectRoles: readonly string[]): boolean {
  return subjectRoles.some((r) => ENCODER_ROLES.has(r));
}

// ─── WorkflowPolicyGuard ─────────────────────────────────────────────────────

/**
 * ABAC policy guard for the WF module's `workflow_instance` and
 * `workflow_step_instance` resource types.
 *
 * Called by every tRPC procedure before execution. Performs **no DB queries** —
 * all attributes (subject and resource) are pre-fetched by the caller. This
 * mirrors the established pattern from `DocumentPolicyGuard` (TASK-DOCS-009).
 *
 * **Dispatch contract:**
 * Every tRPC procedure in the WF module calls the appropriate per-procedure
 * method below (or `checkProcedureAccess` for dispatch-by-name). Methods throw
 * `TRPCError` with `code: 'FORBIDDEN'` and a `cause` string naming the
 * violated clause on failure, or return `void` on success.
 *
 * **Gate scope:**
 * - Gate 1 (tenant isolation) is enforced globally by `PolicyGuard.checkGates`
 *   in `iam.policy.ts` — not re-implemented here.
 * - Gate 3 (Platform Admin operational exclusion) falls out naturally:
 *   `plat_admin` does not appear in any step-action ALLOW set below except
 *   `canMigrateInstance`, `canCancelInstance`, and `canBypassStep`, which are
 *   on the explicit platform-admin action allowlist (I1 §5.2).
 *
 * Source: I1 §5, §6; I2 §6, §16; TASK-WF-017.
 */
export class WorkflowPolicyGuard {
  // ─── 5.1 workflow_instance:read ────────────────────────────────────────────

  /**
   * I1 §5.1 `workflow_instance:read`.
   *
   * Branch 1 (own-office): role ∈ INSTANCE_OWN_OFFICE_READ_ROLES AND
   *   documentOfficeId ∈ subject.effectiveOfficeIds.
   * Branch 2 (SP Secretary): unconditional cross-instance visibility.
   * Branch 3 (cross-office): role ∈ INSTANCE_CROSS_OFFICE_READ_ROLES AND
   *   classification ∈ {'public','internal'}.
   *
   * Maps to: `getInstance`, `getActiveInstanceForDocument` procedures.
   */
  canReadInstance(subject: SubjectContext, attrs: WorkflowInstanceReadAttrs): void {
    // Branch 2: SP Secretary — unconditional
    if (subject.roles.includes('sp_secretary')) return;

    // Branch 1: own-office
    const ownOffice =
      rolesIntersect(subject.roles, INSTANCE_OWN_OFFICE_READ_ROLES) &&
      subject.effectiveOfficeIds.includes(attrs.documentOfficeId);
    if (ownOffice) return;

    // Branch 3: cross-office (classification gate)
    const crossOffice =
      rolesIntersect(subject.roles, INSTANCE_CROSS_OFFICE_READ_ROLES) &&
      (attrs.classificationLevel === 'public' || attrs.classificationLevel === 'internal');
    if (crossOffice) return;

    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'workflow_instance_read_denied',
      message: 'You do not have read access to this workflow instance.',
    });
  }

  // ─── 5.2 workflow_instance:migrate ─────────────────────────────────────────

  /**
   * I1 §5.2 `workflow_instance:migrate` — `plat_admin` ONLY.
   * Maps to: `migrateInstanceToNewDefinitionVersion` procedure.
   */
  canMigrateInstance(subject: SubjectContext): void {
    if (subject.isPlatformAdmin && subject.roles.includes('plat_admin')) return;
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'workflow_migrate_requires_plat_admin',
      message: 'Only the Platform Administrator may migrate a workflow instance to a new definition version.',
    });
  }

  // ─── 6.2 step_instance:complete_action ────────────────────────────────────

  /**
   * I1 §6.2 `step_instance:complete_action`.
   *
   * Evaluation order:
   *   1. Role gate: role ∈ ACTION_STEP_ROLES.
   *   2. Step type gate: stepType = 'action'.
   *   3. Step status gate: stepStatus ∈ {'pending','active'}.
   *   4a. If encoder role: must be direct assignee OR document author.
   *       Cannot claim from general office queue.
   *   4b. If non-encoder role: direct assignee OR office-match.
   *
   * Encoder restriction source: I1 §6.2; I2 Conditional Note ¹².
   * Maps to: `completeActionStep` procedure.
   */
  canCompleteActionStep(subject: SubjectContext, attrs: StepInstanceAttrs): void {
    // Role gate
    if (!rolesIntersect(subject.roles, ACTION_STEP_ROLES)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'complete_action_role_denied',
        message: 'Your role is not permitted to complete action steps.',
      });
    }

    // Step type gate
    if (attrs.stepType !== 'action') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'complete_action_wrong_step_type',
        message: 'This step is not an action step.',
      });
    }

    // Step status gate
    if (attrs.stepStatus !== 'pending' && attrs.stepStatus !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'complete_action_step_not_active',
        message: 'This step is not in an actionable state.',
      });
    }

    const isDirectAssignee = attrs.assigneeUserId === subject.userId;

    // Encoder restriction — evaluated before the general office-queue path
    if (isEncoderRole(subject.roles)) {
      const isDocumentAuthor = attrs.documentCreatedBy === subject.userId;
      if (!isDirectAssignee && !isDocumentAuthor) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          cause: 'encoder_cannot_claim_from_office_queue',
          message:
            'Encoders may only complete steps that are directly assigned to them ' +
            'or on documents they originally created.',
        });
      }
      return; // Encoder passes
    }

    // General assignment gate (non-Encoder roles)
    const officeMatch =
      attrs.assigneeOfficeId !== null &&
      subject.effectiveOfficeIds.includes(attrs.assigneeOfficeId);

    if (!isDirectAssignee && !officeMatch) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'complete_action_not_assigned',
        message: 'You are not assigned to this step.',
      });
    }
  }

  // ─── 6.3 step_instance:approve / reject / return ──────────────────────────

  /**
   * I1 §6.3 `step_instance:approve` / `step_instance:reject` / `step_instance:return`.
   *
   * Evaluation order — the order is non-negotiable per I1 §6.3 and
   * acceptance criterion ("Invariant #11 is verified to run strictly AFTER
   * the role/assignment gate, not before"):
   *   1. Role gate + step type/status + assignment gate.
   *   2. Invariant #13 (encoder ≠ final approver) — strictly AFTER gate 1.
   *
   * A user who fails Gate 1 is denied before Invariant #13 runs. This mirrors
   * TASK-WF-007's approval handler validation order.
   *
   * Maps to: `approveStep`, `rejectStep`, `returnStepForRevision` procedures.
   */
  canApproveStep(subject: SubjectContext, attrs: StepInstanceAttrs): void {
    // ── Gate 1a: Role ──────────────────────────────────────────────────────
    if (!rolesIntersect(subject.roles, APPROVAL_STEP_ROLES)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'approve_step_role_denied',
        message: 'Your role is not permitted to approve, reject, or return steps.',
      });
    }

    // ── Gate 1b: Step type ─────────────────────────────────────────────────
    if (attrs.stepType !== 'approval') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'approve_step_wrong_step_type',
        message: 'This step is not an approval step.',
      });
    }

    // ── Gate 1c: Step status ───────────────────────────────────────────────
    if (attrs.stepStatus !== 'pending' && attrs.stepStatus !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'approve_step_not_active',
        message: 'This step is not in an actionable state.',
      });
    }

    // ── Gate 1d: Assignment ────────────────────────────────────────────────
    const isDirectAssignee = attrs.assigneeUserId === subject.userId;
    const officeMatch =
      attrs.assigneeOfficeId !== null &&
      subject.effectiveOfficeIds.includes(attrs.assigneeOfficeId);

    if (!isDirectAssignee && !officeMatch) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'approve_step_not_assigned',
        message: 'You are not assigned to this approval step.',
      });
    }

    // ── Gate 2: Invariant #13 — Encoder ≠ Final Approver ──────────────────
    // Checked strictly AFTER Gate 1 passes. [Confirmed — I1 §6.3; I1 §15]
    if (attrs.isFinalApprovalStep) {
      const isSameAsInstanceCreator = subject.userId === attrs.instanceCreatedBy;
      const isSameAsDocumentAuthor = subject.userId === attrs.documentCreatedBy;
      if (isSameAsInstanceCreator || isSameAsDocumentAuthor) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          cause: 'encoder_final_approver_same_user_prohibited',
          message:
            'The encoder or submitter of a document cannot act as its final approver (Invariant #13).',
        });
      }
    }
  }

  // ─── 6.4 step_instance:certify ────────────────────────────────────────────

  /**
   * I1 §6.4 `step_instance:certify` — SP Presiding Officer ONLY.
   * Step key must be 'vp_certification'. Direct assignee OR active delegation.
   *
   * Delegation: `subject.effectiveRoles` (populated by `loadDelegationContext`)
   * is checked for 'sp_presiding_officer' to cover the delegation case.
   *
   * Maps to: `certifyAsPresidingOfficer` procedure.
   */
  canCertifyAsPresidingOfficer(subject: SubjectContext, attrs: StepInstanceAttrs): void {
    const hasRole =
      subject.roles.includes('sp_presiding_officer') ||
      subject.effectiveRoles.includes('sp_presiding_officer');

    if (!hasRole) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'certify_requires_sp_presiding_officer',
        message: 'Only the SP Presiding Officer may certify this step.',
      });
    }

    if (attrs.stepKey !== 'vp_certification') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'certify_wrong_step_key',
        message: 'This step is not a VP certification step.',
      });
    }

    const isDirectAssignee = attrs.assigneeUserId === subject.userId;
    // A delegation that grants sp_presiding_officer scope populates effectiveRoles.
    const hasDelegatedAccess = subject.effectiveRoles.includes('sp_presiding_officer');

    if (!isDirectAssignee && !hasDelegatedAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'certify_not_assigned',
        message: 'You are not assigned to this certification step.',
      });
    }
  }

  // ─── 6.5 step_instance:mayor_sign / mayor_veto ────────────────────────────

  /**
   * I1 §6.5 `step_instance:mayor_sign` / `step_instance:mayor_veto`.
   * Mayor ONLY. Step key must be in {'mayor_review','mayor_signature'}.
   * Direct assignee OR active delegation granting mayor authority.
   *
   * Maps to: `mayorSign`, `mayorVeto` procedures.
   */
  canMayorSign(subject: SubjectContext, attrs: StepInstanceAttrs): void {
    const hasRole =
      subject.roles.includes('mayor') || subject.effectiveRoles.includes('mayor');

    if (!hasRole) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'mayor_sign_requires_mayor',
        message: 'Only the Mayor may sign or veto at this step.',
      });
    }

    if (!MAYOR_STEP_KEYS.has(attrs.stepKey)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'mayor_sign_wrong_step_key',
        message: `This step (${attrs.stepKey}) is not a mayor review or signature step.`,
      });
    }

    const isDirectAssignee = attrs.assigneeUserId === subject.userId;
    const hasDelegatedAccess = subject.effectiveRoles.includes('mayor');

    if (!isDirectAssignee && !hasDelegatedAccess) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'mayor_sign_not_assigned',
        message: 'You are not assigned to this mayor review step.',
      });
    }
  }

  // ─── 6.6 step_instance:submit_committee_report ────────────────────────────

  /**
   * I1 §6.6 `step_instance:submit_committee_report`.
   *
   * Allowed: sp_secretary (unconditional), sp_member (committee-scoped).
   *
   * For sp_member: subject.committeeIds ∩ attrs.assignedCommitteeIds ≠ ∅.
   * `committeeIds` is JWT-cached (I1 §1 D-ABAC-06) — no fresh DB lookup.
   * This matches the established claim-caching pattern for roles/permissions.
   *
   * Maps to: `submitCommitteeReport` procedure.
   */
  canSubmitCommitteeReport(subject: SubjectContext, attrs: StepInstanceAttrs): void {
    if (attrs.stepType !== 'multi_referral') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'committee_report_wrong_step_type',
        message: 'This step is not a multi-referral step.',
      });
    }
    if (attrs.stepStatus !== 'pending' && attrs.stepStatus !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'committee_report_step_not_active',
        message: 'This step is not in an actionable state.',
      });
    }

    // SP Secretary — unconditional
    if (subject.roles.includes('sp_secretary')) return;

    // SP Member — committee-scoped (I1 §6.6; I2 Conditional Note ¹⁴)
    if (subject.roles.includes('sp_member')) {
      const assignedCommittees = attrs.assignedCommitteeIds ?? [];
      const hasCommitteeOverlap = subject.committeeIds.some((cid) =>
        assignedCommittees.includes(cid)
      );
      if (!hasCommitteeOverlap) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          cause: 'sp_member_not_in_assigned_committee',
          message:
            'You are not a member of any committee assigned to this referral step.',
        });
      }
      return;
    }

    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'committee_report_role_denied',
      message:
        'Only the SP Secretary or an assigned committee member (SP Member) may submit a committee report.',
    });
  }

  /**
   * I1 §6.8 `step_instance:accept_unified_report` — SP Secretary accepts the unified report.
   *
   * sp_secretary ONLY. No other role may use this.
   *
   * Maps to: `acceptUnifiedReport` procedure.
   */
  canAcceptUnifiedReport(subject: SubjectContext): void {
    if (!subject.roles.includes('sp_secretary')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'sp_secretary_role_required',
        message: 'Only the SP Secretary can accept the unified committee report.',
      });
    }
  }

  // ─── 6.7 step_instance:advance ────────────────────────────────────────────

  /**
   * I1 §6.7 `step_instance:advance` — manual multi-referral override.
   *
   * sp_secretary ONLY. No other role — including plat_admin — may use this.
   * Platform Administrators must use `bypassStep` (the admin-surface override)
   * instead. [Confirmed — I1 §6.7 explicit negative; I2 §6]
   *
   * Maps to: `manuallyAdvanceMultiReferralStep` procedure.
   */
  canManuallyAdvanceMultiReferral(subject: SubjectContext): void {
    if (subject.roles.includes('sp_secretary')) return;
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'only_sp_secretary_may_manually_advance',
      message:
        'Only the SP Secretary may manually advance a multi-referral step. ' +
        'Platform Administrators must use bypassStep instead (I1 §6.7).',
    });
  }

  // ─── 6.8 Secretariat Decision Actions ─────────────────────────────────────

  /**
   * I1 §6.8 `step_instance:log_secretariat_decision`.
   * sp_secretary ONLY, and the step must be assigned to the SP Secretariat office.
   *
   * `isSpSecretariatOffice` is pre-computed by the caller — the SP Secretariat's
   * office UUID is seeded at runtime (office code 'SPS'); this DB-query-free
   * guard cannot resolve it internally.
   *
   * Maps to: `recordVetoOverrideVote` when used in a secretariat decision context.
   */
  canLogSecretariatDecision(
    subject: SubjectContext,
    attrs: { isSpSecretariatOffice: boolean }
  ): void {
    if (!subject.roles.includes('sp_secretary')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'secretariat_decision_requires_sp_secretary',
        message: 'Only the SP Secretary may log a secretariat decision.',
      });
    }
    if (!attrs.isSpSecretariatOffice) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'secretariat_decision_wrong_office',
        message: 'This step is not assigned to the SP Secretariat office.',
      });
    }
  }

  // ─── 6.9 Panlalawigan Review Actions ──────────────────────────────────────

  /**
   * I1 §6.9 `step_instance:record_panlalawigan_outcome` /
   *          `step_instance:confirm_panlalawigan_deemed_approved`.
   *
   * sp_secretary ONLY. Step key must be 'panlalawigan_review', status pending/active.
   *
   * Maps to: `recordPanlalawiganOutcome`, `confirmPanlalawiganDeemedApproved`,
   *          `resolveValidInPart` procedures.
   */
  canLogPanlalawiganAction(subject: SubjectContext, attrs: StepInstanceAttrs): void {
    if (!subject.roles.includes('sp_secretary')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'panlalawigan_action_requires_sp_secretary',
        message: 'Only the SP Secretary may log Panlalawigan review actions.',
      });
    }
    if (attrs.stepKey !== 'panlalawigan_review') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'panlalawigan_action_wrong_step_key',
        message: 'This step is not a Panlalawigan review step.',
      });
    }
    if (attrs.stepStatus !== 'pending' && attrs.stepStatus !== 'active') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        cause: 'panlalawigan_action_step_not_active',
        message: 'This Panlalawigan review step is not in an actionable state.',
      });
    }
  }

  // ─── 6.9b Resolve Valid-In-Part ────────────────────────────────────────────

  /**
   * I1 §6.9 extension — `step_instance:resolve_valid_in_part`.
   *
   * sp_secretary ONLY. The step-key check for 'valid_in_part_decision' is
   * enforced inline in the tRPC procedure (the step instance is fetched via
   * a stepKey-filtered query, so a wrong key yields NOT_FOUND, not FORBIDDEN).
   * This guard covers only the role gate, consistent with the minimal-guard
   * pattern used for `canManuallyAdvanceMultiReferral`.
   *
   * Maps to: `resolveValidInPart` procedure.
   */
  canResolveValidInPart(subject: SubjectContext): void {
    if (subject.roles.includes('sp_secretary')) return;
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'resolve_valid_in_part_requires_sp_secretary',
      message: 'Only the SP Secretary may resolve a valid-in-part Panlalawigan determination.',
    });
  }

  // ─── SP Secretary administrative logging actions ───────────────────────────

  /**
   * Guard for SP Secretary–only administrative logging actions that do not
   * require a specific step-key check. Covers:
   *   - `logMayorLapseConfirmation` (I2 §6 "Log 10-day Mayor lapse")
   *   - `logDocketingCompletion` (I2 §6 "Log docketing step completion")
   *   - `recordNewspaperPublicationDate` (I2 §6 "Record newspaper publication date")
   *   - `recordVetoOverrideVote` (I2 §6 "Record veto override vote")
   *
   * All four are ✅ sp_secretary, ❌ for every other role in I2 §6.
   */
  canLogSpSecretaryAction(subject: SubjectContext): void {
    if (subject.roles.includes('sp_secretary')) return;
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'sp_secretary_action_role_denied',
      message: 'Only the SP Secretary may perform this action.',
    });
  }

  // ─── Admin: cancel instance ────────────────────────────────────────────────

  /**
   * `cancelInstance` — admin surface.
   *
   * Allowed:
   *   - `plat_admin` — unconditional.
   *   - `records_officer` — own-office scope (attrs.documentOfficeId ∈
   *     subject.effectiveOfficeIds).
   *
   * The broader operational cancel authority (dept_approver, sp_secretary, etc.)
   * is handled by the DOCS module's `document:cancel` guard. This guard covers
   * only the WF admin-surface cancel procedure.
   *
   * [Inference] — logged as LOG-0048.
   */
  canCancelInstance(subject: SubjectContext, attrs: WorkflowInstanceReadAttrs): void {
    if (subject.isPlatformAdmin && subject.roles.includes('plat_admin')) return;
    if (
      subject.roles.includes('records_officer') &&
      subject.effectiveOfficeIds.includes(attrs.documentOfficeId)
    ) {
      return;
    }
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'cancel_instance_role_denied',
      message:
        'Only the Platform Administrator (or Records Officer for own-office) may cancel a workflow instance.',
    });
  }

  // ─── Admin: bypass step ────────────────────────────────────────────────────

  /**
   * `bypassStep` — `plat_admin` ONLY.
   *
   * This is the admin-surface override that plat_admin must use instead of
   * `manuallyAdvanceMultiReferralStep` (I1 §6.7 explicit negative).
   */
  canBypassStep(subject: SubjectContext): void {
    if (subject.isPlatformAdmin && subject.roles.includes('plat_admin')) return;
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'bypass_step_requires_plat_admin',
      message: 'Only the Platform Administrator may bypass a workflow step.',
    });
  }

  // ─── Reporting: getSlaComplianceData ──────────────────────────────────────

  /**
   * I2 §16 `getSlaComplianceData` — ARTA SLA compliance reporting.
   *
   * Accessible by: records_officer, sp_secretary, sp_presiding_officer, mayor, auditor.
   * NOT office-scoped — ARTA compliance reporting must be cross-office for
   * these roles. [Confirmed — I2 §16; task acceptance criteria]
   *
   * Maps to: `getSlaComplianceData` procedure.
   */
  canAccessSlaData(subject: SubjectContext): void {
    if (rolesIntersect(subject.roles, SLA_READ_ROLES)) return;
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'sla_data_role_denied',
      message: 'Your role is not permitted to access SLA compliance data.',
    });
  }

  // ─── Read: listMyAssignedSteps ─────────────────────────────────────────────

  /**
   * I1 §6.1 `step_instance:read` — own assigned steps.
   *
   * All operational roles may call this procedure. The query-level filter
   * (`assigneeUserId = subject.userId OR office-scoped queue membership`) is
   * applied by the repository, not by this guard. This guard enforces the
   * minimum role requirement only.
   *
   * Maps to: `listMyAssignedSteps` procedure.
   */
  canListAssignedSteps(subject: SubjectContext): void {
    const OPERATIONAL_ROLES: ReadonlySet<string> = new Set([
      'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
      'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
      'records_officer', 'auditor',
    ]);
    if (rolesIntersect(subject.roles, OPERATIONAL_ROLES)) return;
    throw new TRPCError({
      code: 'FORBIDDEN',
      cause: 'list_assigned_steps_role_denied',
      message: 'Your role is not permitted to list workflow step assignments.',
    });
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

/**
 * Module-level singleton. Matches the `DocumentPolicyGuard` pattern from
 * TASK-DOCS-009 (`export const documentPolicy = new DocumentPolicyGuard()`).
 * WF module tRPC procedures import and call this directly.
 */
export const workflowPolicy = new WorkflowPolicyGuard();
