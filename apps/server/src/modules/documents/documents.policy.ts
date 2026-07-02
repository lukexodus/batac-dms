import type { AuthContext } from '../iam/iam.types.js';

import type { ClassificationLevel, DocumentLifecycleState } from './documents.types.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * The authenticated subject's ABAC attributes, as pre-fetched by the caller
 * (tRPC procedure) from the JWT/session context.
 *
 * This is a local alias for the IAM module's real `AuthContext` type — the
 * same type `SubjectContext` aliases to in `iam/iam.policy.ts` — not a
 * redeclared shape. See the "Deviation from the task prompt" note below.
 *
 * Source: I1 §1 Subject Attributes Reference; TASK-IAM-004.
 */
export type SubjectContext = AuthContext;

/**
 * ─── Deviation from the task prompt ─────────────────────────────────────
 * The TASK-DOCS-009 AI Prompt describes `SubjectContext` with fields
 * `isIta`/`isPa` (mirroring I1 §1's raw JWT-claim names `subject.is_ita` /
 * `subject.is_pa`). The actual `AuthContext` type already shipped by
 * TASK-IAM-004 (`apps/server/src/modules/iam/iam.types.ts`) instead uses
 * `isItAdmin`/`isPlatformAdmin`, and additionally carries `sessionId`,
 * `permissions`, `delegationGrantId`, and `effectiveRoles`, none of which
 * the prompt's shorthand mentions. Since this guard must typecheck against
 * the real objects tRPC procedures will actually pass in (`ctx.auth`), this
 * file uses the real `AuthContext` field names throughout. [Unverified]
 * whether the prompt's naming was a deliberate spec choice or a paraphrase
 * of I1's claim names written before TASK-IAM-004 shipped — flagged rather
 * than silently reconciled. See docs/development-findings-log.md LOG-0026.
 * ─────────────────────────────────────────────────────────────────────────
 */

const SP_WORKFLOW_DOCUMENT_TYPE_CODES: ReadonlySet<string> = new Set([
  'SP_RESOLUTION',
  'SP_ORDINANCE',
  'SP_APPROPRIATION_ORDINANCE',
]);

const CERTIFICATION_OF_URGENCY_TYPE_CODE = 'CERTIFICATION_OF_URGENCY';

/** Matches `documents.document_types.public_visibility_rule`'s CHECK constraint value (C1/schema — lowercase snake_case), not I1 §3.11's prose casing. */
const TITLE_AND_FIRST_PAGE_PUBLIC_RULE = 'title_and_first_page_public';

const CLASSIFIED_LEVELS: ReadonlySet<ClassificationLevel> = new Set(['confidential', 'restricted']);

// ─── Role sets (I1 §3, §4, §14) ─────────────────────────────────────────────

/** I1 §3.1 `document:create`. */
const CREATE_ROLES: ReadonlySet<string> = new Set([
  'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
]);

/** I1 §3.2 branch 1 / I1 §4.1 branch 1 — own-office metadata & content read. */
const OWN_OFFICE_READ_ROLES: ReadonlySet<string> = new Set([
  'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
  'records_officer', 'auditor',
]);

/** I1 §3.2 branch 2 / I1 §4.1 branch 2 — cross-office metadata & content read. */
const CROSS_OFFICE_READ_ROLES: ReadonlySet<string> = new Set([
  'records_officer', 'sp_secretary', 'sp_presiding_officer', 'mayor', 'auditor',
]);

/** I1 §3.3 `document:update` base role set (sp_member handled separately as an additional grant). */
const UPDATE_ROLES: ReadonlySet<string> = new Set([
  'dept_encoder', 'dept_approver', 'sp_secretary',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
]);

/**
 * I1 §3.4 `document:delete` (soft-delete).
 *
 * [Fixed relative to I1's literal ALLOW-clause role list — see LOG-0028]
 * I1 §3.4's own ALLOW clause omits `brgy_encoder`, but the "RESTRICTED
 * ENCODER RULE" note immediately below that same clause explicitly says
 * "dept_encoder AND brgy_encoder may soft-delete only while...", and I2's
 * "Delete document in Draft state (soft delete)" row independently shows
 * Barangay Encoder = ✅. Both corroborating sources agree; `brgy_encoder`
 * is included here.
 */
const SOFT_DELETE_ROLES: ReadonlySet<string> = new Set([
  'dept_encoder', 'dept_approver', 'sp_secretary',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
]);

/** I1 §3.5 `document:submit`. */
const SUBMIT_ROLES: ReadonlySet<string> = new Set([
  'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
]);

/** I1 §3.6 `document:cancel` base role set (dept_encoder/brgy_encoder handled as conditional grants). */
const CANCEL_BASE_ROLES: ReadonlySet<string> = new Set([
  'dept_approver', 'sp_secretary', 'sp_presiding_officer', 'mayor', 'brgy_captain',
]);

/** I1 §4.2 `document_version:create` / `document_attachment:create`. */
const VERSION_CREATE_ROLES: ReadonlySet<string> = new Set([
  'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain',
]);

/** I1 §4.4 scan quality indicator access — no `auditor`, unlike other content reads. */
const SCAN_QUALITY_ROLES: ReadonlySet<string> = new Set([
  'dept_encoder', 'dept_approver', 'sp_secretary', 'sp_member',
  'sp_presiding_officer', 'mayor', 'brgy_encoder', 'brgy_captain', 'records_officer',
]);

/** I1 §14.1 `number_series:read`. */
const NUMBER_SERIES_READ_ROLES: ReadonlySet<string> = new Set([
  'plat_admin', 'records_officer', 'sp_secretary', 'sys_admin', 'auditor',
]);

// ─── State-Action Compatibility Matrix (I1 §17) ─────────────────────────────

/**
 * [Extended relative to I1 §17 — see LOG-0027]
 * I1 §17's matrix (and the TASK-DOCS-009 prompt's copy of it) has one row
 * per lifecycle state but omits `pending_panlalawigan_review`, which is a
 * real, valid `DocumentLifecycleState` — confirmed in
 * `documents.documents_lifecycle_state_check`, in this module's own
 * `DocumentLifecycleState` union (documents.types.ts), and in D3 (ADR-013's
 * split of the old single "Pending Approval" state into
 * `pending_mayor_action` and `pending_panlalawigan_review`). I1 itself
 * predates that split and never mentions the second state.
 *
 * Using `Record<DocumentLifecycleState, ...>` below makes an omitted key a
 * compile error, so the gap could not be silently reproduced by leaving the
 * key out entirely.
 *
 * [Inference] Only `read` and `cancel` are populated for this state:
 *  - `read` matches I1 §17's own pattern of allowing read in literally
 *    every other row, including terminal states (Disposed, Cancelled).
 *  - `cancel` is corroborated by the DB trigger
 *    `documents.check_lifecycle_transition()` (C1 §"Discovered Issue #1"),
 *    which explicitly allows `pending_panlalawigan_review -> cancelled`.
 * D3 also documents `pending_panlalawigan_review -> completed` (event
 * `FINAL_APPROVAL_GRANTED`) and `-> superseded` (event
 * `DOCUMENT_SUPERSEDED`), but neither of those two transitions has a
 * clearly corresponding entry in this matrix's action vocabulary
 * (`approve`/`reject`/`number_promote` are not confirmed for this specific
 * state anywhere), so they are deliberately left out rather than guessed.
 * A human should confirm the full action set for this state.
 */
const STATE_ACTION_MATRIX: Record<DocumentLifecycleState, readonly string[]> = {
  draft: ['create', 'read', 'update', 'submit', 'cancel'],
  submitted: ['read', 'cancel', 'number_assign'],
  in_workflow: ['read', 'approve', 'reject', 'cancel', 'number_assign'],
  pending_mayor_action: ['read', 'approve', 'reject', 'cancel', 'number_promote'],
  pending_panlalawigan_review: ['read', 'cancel'],
  completed: ['read', 'cancel', 'archive'],
  released: ['read', 'cancel', 'archive'],
  archived: ['read', 'dispose'],
  disposed: ['read'],
  cancelled: ['read'],
  superseded: ['read'],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function rolesIntersect(subjectRoles: readonly string[], allowed: ReadonlySet<string>): boolean {
  return subjectRoles.some((role) => allowed.has(role));
}

/** I1 §3.2 / §4.1 third branch — SP Member committee- or session-scoped access. Source: I1 §1 D-ABAC-06 (`subject.committeeIds` is JWT-cached). */
function hasCommitteeOrSessionAccess(
  subject: SubjectContext,
  attrs: { documentCommitteeId?: string | null; isInSpSession?: boolean },
): boolean {
  if (attrs.documentCommitteeId != null && subject.committeeIds.includes(attrs.documentCommitteeId)) {
    return true;
  }
  return attrs.isInSpSession === true;
}

// ─── Resource attribute types ──────────────────────────────────────────────

export interface CreateDocumentAttrs {
  /** Office the new document will be owned by. */
  ownedByOfficeId: string;
}

export interface ReadMetadataAttrs {
  ownedByOfficeId?: string;
  classificationLevel: ClassificationLevel;
  /** Gate 4 — pre-fetched by the caller from `documents.classification_allowlists`. Required when classificationLevel is confidential/restricted; ignored otherwise. */
  hasAllowlistEntry?: boolean;
  /** Pre-fetched by the caller via `has_cross_office_read_grant(subject.userId, ownedByOfficeId)` (I1 §3.2, D-ABAC-03). */
  hasCrossOfficeGrant?: boolean;
  documentCommitteeId?: string | null;
  isInSpSession?: boolean;
}

export interface UpdateDocumentAttrs {
  lifecycleState: DocumentLifecycleState;
  ownedByOfficeId: string;
  /** Required to evaluate the SP Member self-authored carve-out. */
  createdBy?: string;
}

export interface SoftDeleteDocumentAttrs {
  lifecycleState: DocumentLifecycleState;
  workflowInstanceId?: string | null;
  ownedByOfficeId: string;
}

export interface SubmitDocumentAttrs {
  lifecycleState: DocumentLifecycleState;
  ownedByOfficeId: string;
}

export interface CancelDocumentAttrs {
  lifecycleState: DocumentLifecycleState;
  workflowInstanceId?: string | null;
  ownedByOfficeId: string;
}

export interface AssignPreliminaryNumberAttrs {
  documentTypeCode: string;
  lifecycleState: DocumentLifecycleState;
  preliminaryNumber?: string | null;
}

export interface AssignFinalNumberAttrs {
  documentTypeCode: string;
  preliminaryNumber?: string | null;
  finalNumber?: string | null;
  /**
   * I1 §3.8 additionally requires the current workflow step to be
   * `second_reading_vote_completed` (Resolutions) / `third_reading_vote_completed`
   * (Ordinances/Appropriation Ordinances). Per the TASK-DOCS-009 prompt,
   * that workflow-step check is done at the procedure level, not here —
   * this guard evaluates only the number-state condition.
   */
}

export interface CertifyUrgentAttrs {
  certifyingDocumentTypeCode: string;
  /**
   * I1 §3.9 additionally requires validating every `associated_measure_id`
   * referenced in the Certification's metadata against its own
   * lifecycle_state and workflow step — a multi-document check that would
   * require the caller to fetch several other documents' attributes. That
   * validation is left to the calling procedure; this guard evaluates only
   * the role + certifying-document-type condition.
   */
}

export interface ArchiveDocumentAttrs {
  lifecycleState: DocumentLifecycleState;
  ownedByOfficeId: string;
  /**
   * Pre-computed by the caller: whether `ownedByOfficeId` is the SP
   * Secretariat's office. I1 §3.10 references a fixed `SP_SECRETARIAT_OFFICE_ID`,
   * but no such constant exists in this codebase — offices are seeded with
   * runtime-generated UUIDs (office code `'SPS'`), so the comparison must
   * happen where the real office ID is known, not inside this DB-query-free
   * guard.
   */
  isSpSecretariatOffice?: boolean;
}

export interface PublishPortalAttrs {
  documentTypeCode: string;
  lifecycleState: DocumentLifecycleState;
  classificationLevel: ClassificationLevel;
  /** `documents.document_types.public_visibility_rule` value, e.g. `'title_and_first_page_public'`. */
  publicVisibilityRule?: string;
}

/**
 * Shared shape for `document_version:read` / `document_attachment:read`
 * (I1 §4.1) and OCR text access (I1 §4.3, which I1 itself says shares "the
 * same conditions as document_version:read").
 */
export interface ContentReadAttrs {
  ownedByOfficeId?: string;
  classificationLevel: ClassificationLevel;
  hasAllowlistEntry?: boolean;
  documentCommitteeId?: string | null;
  isInSpSession?: boolean;
}

export interface CreateVersionAttrs {
  ownedByOfficeId: string;
  /** Required to evaluate the SP Member self-authored restriction. */
  createdBy?: string;
}

export interface ScanQualityAttrs {
  ownedByOfficeId?: string;
  createdBy?: string;
}

// ─── DocumentPolicyGuard ────────────────────────────────────────────────────

/**
 * ABAC policy guard for the DOCS module's `document`, `document_version`,
 * `document_attachment`, and `number_series` resource types.
 *
 * Called by every tRPC procedure before execution. Performs no DB queries —
 * all attributes (subject and resource) are pre-fetched by the caller.
 *
 * Source: I1 §3, §4, §14, §17; I2; B5 §5.5.
 *
 * Scope notes:
 *  - Gate 1 (tenant/city isolation, I1 §2) is not implemented here. Phase 1
 *    is single-city ("Always Batac City UUID" — I1 §1), and IAM's own
 *    `PolicyGuard.checkGates` (`apps/server/src/modules/iam/iam.policy.ts`)
 *    already enforces it generically for every resource type. Duplicating
 *    it here was not requested by TASK-DOCS-009's deliverables.
 *  - Gate 3 (Platform Administrator operational exclusion, I1 §2) is not
 *    implemented as a separate check. It falls out naturally: `plat_admin`
 *    never appears in any ALLOW role set below except `canManageNumberSeries`
 *    (I1 §14.2), which matches Gate 3's own exemption list including
 *    `manage_number_series`.
 *  - Gate 2 (IT Admin content isolation) and Gate 4 (classification
 *    allowlist) are implemented per-method below, on the read/content
 *    methods only, per the TASK-DOCS-009 prompt's explicit scoping.
 */
export class DocumentPolicyGuard {
  // ─── document (I1 §3) ─────────────────────────────────────────────────

  /**
   * I1 §3.1 `document:create`.
   *
   * [Deviation from I1's literal text — see reasoning below]
   * I1's own ALLOW clause reads `subject.office_id ∈ subject.effective_office_ids`,
   * which is a tautology: I1 §1 defines `effective_office_ids` as always
   * including `office_id`, so this condition is true for any subject with a
   * non-null office, regardless of the target document. The clause's own
   * parenthetical ("i.e. the user is creating a document for their own
   * office or a delegation-extended office") and the TASK-DOCS-009
   * acceptance criteria both point to the intended check being the
   * *resource's* target office against the subject's effective offices.
   * That is what is implemented here.
   */
  canCreate(subject: SubjectContext, attrs: CreateDocumentAttrs): boolean {
    if (!rolesIntersect(subject.roles, CREATE_ROLES)) {
      return false;
    }
    return subject.effectiveOfficeIds.includes(attrs.ownedByOfficeId);
  }

  /** I1 §3.2 `document:read` (metadata). Gate 4 applies; Gate 2 does not (metadata is not content). */
  canReadMetadata(subject: SubjectContext, attrs: ReadMetadataAttrs): boolean {
    if (CLASSIFIED_LEVELS.has(attrs.classificationLevel) && attrs.hasAllowlistEntry !== true) {
      return false;
    }

    const ownOffice =
      attrs.ownedByOfficeId != null &&
      subject.effectiveOfficeIds.includes(attrs.ownedByOfficeId) &&
      rolesIntersect(subject.roles, OWN_OFFICE_READ_ROLES);

    const crossOffice =
      rolesIntersect(subject.roles, CROSS_OFFICE_READ_ROLES) &&
      (attrs.classificationLevel === 'public' || attrs.classificationLevel === 'internal') &&
      attrs.hasCrossOfficeGrant === true;

    const spMemberScoped = subject.roles.includes('sp_member') && hasCommitteeOrSessionAccess(subject, attrs);

    const isPublic = attrs.classificationLevel === 'public';

    return ownOffice || crossOffice || spMemberScoped || isPublic;
  }

  /** I1 §3.3 `document:update` (non-state-change edits). Only Draft-state documents are directly editable. */
  canUpdate(subject: SubjectContext, attrs: UpdateDocumentAttrs): boolean {
    if (attrs.lifecycleState !== 'draft') {
      return false;
    }
    if (!subject.effectiveOfficeIds.includes(attrs.ownedByOfficeId)) {
      return false;
    }
    if (rolesIntersect(subject.roles, UPDATE_ROLES)) {
      return true;
    }
    if (subject.roles.includes('sp_member')) {
      return attrs.createdBy != null && attrs.createdBy === subject.userId;
    }
    return false;
  }

  /**
   * I1 §3.4 `document:delete` (soft-delete only; no role may hard-delete — Invariant #2).
   *
   * [Verified against the cited source — see LOG-0030]
   * I1 §3.4's base ALLOW clause has an unconditional, top-level
   * `AND document.workflow_instance_id IS NULL`, applying to every role in the
   * prior set, not just encoders. Its "RESTRICTED ENCODER RULE" paragraph closes
   * with "Once a workflow instance exists, deletion requires dept_approver or
   * sp_secretary," citing I2 Conditional Note 7 — but Note 7 is attached to
   * I2's *Cancel document* row and is explicitly about the cancel action's
   * encoder restriction (I1 §3.6), not soft-delete. That closing sentence
   * in §3.4 is a misattributed copy from §3.6, not a real exception to
   * §3.4's own `workflow_instance_id IS NULL` condition. Implemented here
   * as a blanket requirement for all roles; `canCancel` below is where
   * dept_approver/sp_secretary retain access once a workflow is active.
   */
  canSoftDelete(subject: SubjectContext, attrs: SoftDeleteDocumentAttrs): boolean {
    if (attrs.lifecycleState !== 'draft' && attrs.lifecycleState !== 'submitted') {
      return false;
    }
    if (attrs.workflowInstanceId != null) {
      return false;
    }
    if (!subject.effectiveOfficeIds.includes(attrs.ownedByOfficeId)) {
      return false;
    }
    return rolesIntersect(subject.roles, SOFT_DELETE_ROLES);
  }

  /** I1 §3.5 `document:submit` (Draft → Submitted). */
  canSubmit(subject: SubjectContext, attrs: SubmitDocumentAttrs): boolean {
    if (attrs.lifecycleState !== 'draft') {
      return false;
    }
    if (!subject.effectiveOfficeIds.includes(attrs.ownedByOfficeId)) {
      return false;
    }
    return rolesIntersect(subject.roles, SUBMIT_ROLES);
  }

  /**
   * I1 §3.5 special rule: for SP workflow document types, formal submission
   * (workflow-instance creation + QR assignment) additionally requires the
   * `sp_secretary` role on top of `canSubmit`'s base check. Exposed
   * separately per the TASK-DOCS-009 prompt so the calling procedure can
   * apply it only for SP measures.
   */
  requiresSpSecretaryForSubmit(documentTypeCode: string): boolean {
    return SP_WORKFLOW_DOCUMENT_TYPE_CODES.has(documentTypeCode);
  }

  /** I1 §3.6 `document:cancel` (any active state → Cancelled). Every cancellation requires a mandatory audit-logged reason, enforced by the calling procedure, not this guard. */
  canCancel(subject: SubjectContext, attrs: CancelDocumentAttrs): boolean {
    if (attrs.lifecycleState === 'archived' || attrs.lifecycleState === 'disposed' || attrs.lifecycleState === 'cancelled') {
      return false;
    }
    if (!subject.effectiveOfficeIds.includes(attrs.ownedByOfficeId)) {
      return false;
    }
    if (rolesIntersect(subject.roles, CANCEL_BASE_ROLES)) {
      return true;
    }

    const preWorkflow =
      (attrs.lifecycleState === 'draft' || attrs.lifecycleState === 'submitted') && attrs.workflowInstanceId == null;

    if (subject.roles.includes('dept_encoder') && preWorkflow) {
      return true;
    }
    if (subject.roles.includes('brgy_encoder') && preWorkflow) {
      return true;
    }
    return false;
  }

  /** I1 §3.7 `document:number_assign` (preliminary number, at secretariat logging). */
  canAssignPreliminaryNumber(subject: SubjectContext, attrs: AssignPreliminaryNumberAttrs): boolean {
    if (!SP_WORKFLOW_DOCUMENT_TYPE_CODES.has(attrs.documentTypeCode)) {
      return false;
    }
    if (attrs.lifecycleState !== 'submitted' && attrs.lifecycleState !== 'in_workflow') {
      return false;
    }
    if (!subject.roles.includes('sp_secretary')) {
      return false;
    }
    return attrs.preliminaryNumber == null;
  }

  /** I1 §3.8 `document:number_promote` (final number; immutable once assigned — Invariant #9). */
  canAssignFinalNumber(subject: SubjectContext, attrs: AssignFinalNumberAttrs): boolean {
    if (!SP_WORKFLOW_DOCUMENT_TYPE_CODES.has(attrs.documentTypeCode)) {
      return false;
    }
    if (!subject.roles.includes('sp_secretary')) {
      return false;
    }
    if (attrs.preliminaryNumber == null) {
      return false;
    }
    return attrs.finalNumber == null;
  }

  /** I1 §3.9 `document:certify_urgent` (log Certification of Urgency; the Mayor issues it, the SP Secretary logs it). */
  canCertifyUrgent(subject: SubjectContext, attrs: CertifyUrgentAttrs): boolean {
    if (!subject.roles.includes('sp_secretary')) {
      return false;
    }
    return attrs.certifyingDocumentTypeCode === CERTIFICATION_OF_URGENCY_TYPE_CODE;
  }

  /** I1 §3.10 `document:archive` (Completed/Released → Archived). */
  canArchive(subject: SubjectContext, attrs: ArchiveDocumentAttrs): boolean {
    if (attrs.lifecycleState !== 'completed' && attrs.lifecycleState !== 'released') {
      return false;
    }
    if (subject.roles.includes('records_officer')) {
      return true;
    }
    return subject.roles.includes('sp_secretary') && attrs.isSpSecretariatOffice === true;
  }

  /** I1 §3.11 `document:publish_portal` (publish to public portal). */
  canPublishPortal(subject: SubjectContext, attrs: PublishPortalAttrs): boolean {
    if (!SP_WORKFLOW_DOCUMENT_TYPE_CODES.has(attrs.documentTypeCode)) {
      return false;
    }
    if (attrs.lifecycleState !== 'released' && attrs.lifecycleState !== 'archived') {
      return false;
    }
    const visibilityOk =
      attrs.classificationLevel === 'public' ||
      (attrs.classificationLevel === 'internal' && attrs.publicVisibilityRule === TITLE_AND_FIRST_PAGE_PUBLIC_RULE);
    if (!visibilityOk) {
      return false;
    }
    return subject.roles.includes('sp_secretary');
  }

  // ─── document_version / document_attachment (I1 §4) ───────────────────

  /**
   * I1 §4.1 `document_version:read` / `document_attachment:read` (file
   * content). Gate 2 (IT Admin content isolation) and Gate 4
   * (classification allowlist) both apply.
   *
   * Gate 2 is checked explicitly below for confidential/restricted
   * classification, matching I1 §2 Gate 2's literal scope. Separately, none
   * of this method's three ALLOW branches list `sys_admin`/`is_ita` in
   * their role sets for *any* classification — that is what actually
   * produces "IT Admin has no content access regardless of classification"
   * (I2 §5 + its Architectural Invariants table; confirmed by the
   * TASK-DOCS-009 prompt's own note that I1 §4.1's ALLOW clause has no
   * `sys_admin` entry "not even for public documents"). The explicit Gate 2
   * check below is the documented, non-overridable backstop for the
   * confidential/restricted case specifically (I1 §2 Gate 2: "cannot be
   * overridden by any configuration").
   *
   * [Deviation from the TASK-DOCS-009 prompt — see LOG-0029]
   * The prompt describes this method as using "the same
   * own-office/cross-office/committee rules as document:read metadata."
   * I1 §4.1's actual cross-office branch, unlike I1 §3.2's, does not
   * include a `has_cross_office_read_grant` condition — it only requires
   * the role set plus `classification_level IN ('public','internal')`.
   * Implemented per I1 §4.1's literal text (no grant check in `canReadContent`'s
   * cross-office branch), not per the prompt's "same rules" paraphrase.
   */
  canReadContent(subject: SubjectContext, attrs: ContentReadAttrs): boolean {
    if (subject.isItAdmin && CLASSIFIED_LEVELS.has(attrs.classificationLevel)) {
      return false;
    }
    if (CLASSIFIED_LEVELS.has(attrs.classificationLevel) && attrs.hasAllowlistEntry !== true) {
      return false;
    }

    const ownOffice =
      attrs.ownedByOfficeId != null &&
      subject.effectiveOfficeIds.includes(attrs.ownedByOfficeId) &&
      rolesIntersect(subject.roles, OWN_OFFICE_READ_ROLES);

    const crossOffice =
      rolesIntersect(subject.roles, CROSS_OFFICE_READ_ROLES) &&
      (attrs.classificationLevel === 'public' || attrs.classificationLevel === 'internal');

    const spMemberScoped =
      subject.roles.includes('sp_member') &&
      (attrs.classificationLevel === 'public' || attrs.classificationLevel === 'internal') &&
      hasCommitteeOrSessionAccess(subject, attrs);

    return ownOffice || crossOffice || spMemberScoped;
  }

  /**
   * I1 §4.1 named specifically for `document_version` resources. I1 groups
   * `document_version:read` and `document_attachment:read` under one rule;
   * `canReadContent` above is that shared predicate (also used directly for
   * `document_attachment` reads, since the deliverables list does not name
   * a separate attachment-specific method). This is a thin, explicitly
   * named wrapper for call sites that read a specific version. [Inference —
   * neither I1 nor the TASK-DOCS-009 prompt explains why both
   * `canReadContent` and `canReadVersionContent` are named as distinct
   * deliverables for what is one rule; this is the most direct reading.]
   */
  canReadVersionContent(subject: SubjectContext, attrs: ContentReadAttrs): boolean {
    return this.canReadContent(subject, attrs);
  }

  /** I1 §4.2 `document_version:create` / `document_attachment:create` (upload). */
  canCreateVersion(subject: SubjectContext, attrs: CreateVersionAttrs): boolean {
    if (!subject.effectiveOfficeIds.includes(attrs.ownedByOfficeId)) {
      return false;
    }
    if (!rolesIntersect(subject.roles, VERSION_CREATE_ROLES)) {
      return false;
    }
    if (subject.roles.includes('sp_member')) {
      return attrs.createdBy != null && attrs.createdBy === subject.userId;
    }
    return true;
  }

  /**
   * I1 §4.3 OCR text access. I1's own text: "Same conditions as
   * document_version:read" plus Gate 2 extended to OCR text
   * ([Inference] per I1 §2's own "Extended to OCR text" note). Delegates to
   * `canReadContent` rather than re-implementing an equivalent predicate.
   */
  canReadOcrText(subject: SubjectContext, attrs: ContentReadAttrs): boolean {
    return this.canReadContent(subject, attrs);
  }

  /**
   * I1 §4.4 scan quality indicator access. Distinct from content read: no
   * Gate 2, no Gate 4, no `auditor` in the role set, and scope is
   * "own-authored OR own-office" rather than own-office/cross-office/committee.
   */
  canReadScanQuality(subject: SubjectContext, attrs: ScanQualityAttrs): boolean {
    if (!rolesIntersect(subject.roles, SCAN_QUALITY_ROLES)) {
      return false;
    }
    const ownAuthored = attrs.createdBy != null && attrs.createdBy === subject.userId;
    const ownOffice = attrs.ownedByOfficeId != null && subject.effectiveOfficeIds.includes(attrs.ownedByOfficeId);
    return ownAuthored || ownOffice;
  }

  // ─── number_series (I1 §14) ────────────────────────────────────────────

  /** I1 §14.1 `number_series:read`. No resource-attribute condition is defined for this action — role membership alone determines the result. */
  canReadNumberSeries(subject: SubjectContext): boolean {
    return rolesIntersect(subject.roles, NUMBER_SERIES_READ_ROLES);
  }

  /** I1 §14.2 `number_series:create` / `number_series:update`. Requires both the `plat_admin` role and `isPlatformAdmin` (Gate 3 exempts `manage_number_series` for Platform Admin). */
  canManageNumberSeries(subject: SubjectContext): boolean {
    return subject.roles.includes('plat_admin') && subject.isPlatformAdmin;
  }

  // ─── State-Action Compatibility (I1 §17) ───────────────────────────────

  /**
   * Returns whether `action` is valid for a document currently in
   * `lifecycleState`, per I1 §17's matrix (extended — see
   * `STATE_ACTION_MATRIX`'s comment above for the `pending_panlalawigan_review`
   * gap-fill and its [Inference] label).
   */
  checkStateActionCompatibility(action: string, lifecycleState: DocumentLifecycleState): boolean {
    return STATE_ACTION_MATRIX[lifecycleState].includes(action);
  }
}
