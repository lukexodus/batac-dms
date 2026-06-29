import type { AuthContext } from './iam.types.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type EvaluationResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export type SubjectContext = AuthContext;

export type ResourceDescriptor = {
  type:                  string;
  id:                    string;
  cityId:                string;
  classificationLevel?:  string;
  deletedAt?:            Date | null;
  userId?:               string;       // for session resources
  officeId?:             string;
  documentTypeId?:       string;
  [key: string]: unknown;
};

export type ResourcePolicyHandler = (
  subject: SubjectContext,
  resource: ResourceDescriptor,
  action: string,
  context?: Record<string, unknown>,
) => Promise<EvaluationResult> | EvaluationResult;

export type PolicyGuardOptions = {
  /**
   * Injected async function that returns the role codes allowed to access
   * a classified (confidential/restricted) document type.
   * Default: returns [] (deny all classified access until DOCS module injects the real lookup).
   */
  getAllowlistRoles?: (documentTypeId: string) => Promise<string[]>;
};

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Actions that Platform Administrators are permitted to perform.
 * All other actions are denied by Gate 3.
 * Source: I1 §2 Gate 3; B5 §5.5 Step 3.
 */
const PLATFORM_ADMIN_ALLOWED_ACTIONS: ReadonlySet<string> = new Set([
  'manage_roles',
  'manage_workflow_def',
  'manage_document_types',
  'manage_number_series',
  'manage_retention_schedules',
  'manage_sla_config',
  'manage_notification_templates',
  'manage_office_hierarchy',
  'manage_standing_committees',
  'manage_public_visibility_rules',
  'read_org_structure',
  'read_workflow_definitions',
  'read_user_directory',
  'post_announcement',
  'run_report',
  'export_report',
]);

/**
 * Resource types subject to IT Admin content isolation (Gate 2).
 * Source: I1 §2 Gate 2.
 */
const IT_ADMIN_ISOLATED_RESOURCE_TYPES: ReadonlySet<string> = new Set([
  'document_version',
  'document_attachment',
]);

/**
 * Actions blocked for IT Admin on isolated resource types (Gate 2).
 * Source: I1 §2 Gate 2.
 */
const IT_ADMIN_ISOLATED_ACTIONS: ReadonlySet<string> = new Set([
  'read',
  'download',
  'export',
  'bulk_export',
  'scan_qr_content',
]);

/**
 * Classification levels that trigger Gate 4.
 * Source: I1 §2 Gate 4.
 */
const CLASSIFIED_LEVELS: ReadonlySet<string> = new Set([
  'confidential',
  'restricted',
]);

/**
 * Actions still permitted on soft-deleted resources (Gate 5).
 * Source: I1 §2 Gate 5.
 */
const SOFT_DELETE_ALLOWED_ACTIONS: ReadonlySet<string> = new Set([
  'read',
  'read_metadata',
  'view_audit_trail',
]);

// ─── PolicyGuard ────────────────────────────────────────────────────────────

/**
 * Evaluates the 5 hardcoded cascade gates (I1 §2; B5 §5.5 Steps 1–5).
 * These are pre-RBAC security checks that are not configurable by any role.
 * The first DENY terminates evaluation immediately.
 *
 * Gates 1–3 and 5 are synchronous (no DB access).
 * Gate 4 (classification) requires an async allowlist lookup and is exposed
 * as a separate method called by PolicyEvaluator.
 */
export class PolicyGuard {
  private readonly getAllowlistRoles: (documentTypeId: string) => Promise<string[]>;

  constructor(options?: PolicyGuardOptions) {
    this.getAllowlistRoles = options?.getAllowlistRoles ?? (() => Promise.resolve([]));
  }

  /**
   * Synchronous gates (1–3, 5). Called first by PolicyEvaluator.
   * Returns DENY on the first failing gate, or ALLOW if all pass.
   */
  checkGates(subject: SubjectContext, resource: ResourceDescriptor, action: string): EvaluationResult {
    // Gate 1 — City Isolation (Invariant #8)
    // Source: I1 §2 Gate 1; Consolidated Reference Part 11.9
    if (resource.cityId !== subject.cityId) {
      return { allowed: false, reason: 'tenant_isolation' };
    }

    // Gate 2 — IT Admin Content Isolation (Invariant #10)
    // Source: I1 §2 Gate 2; Consolidated Reference Part 12 Invariant #10
    if (
      subject.isItAdmin &&
      IT_ADMIN_ISOLATED_RESOURCE_TYPES.has(resource.type) &&
      typeof resource.classificationLevel === 'string' &&
      CLASSIFIED_LEVELS.has(resource.classificationLevel) &&
      IT_ADMIN_ISOLATED_ACTIONS.has(action)
    ) {
      return { allowed: false, reason: 'it_admin_content_isolation_invariant' };
    }

    // Gate 3 — Platform Administrator Operational Exclusion (Invariant #12)
    // Source: I1 §2 Gate 3; Consolidated Reference Part 12 Invariant #12
    if (subject.isPlatformAdmin && !PLATFORM_ADMIN_ALLOWED_ACTIONS.has(action)) {
      return { allowed: false, reason: 'platform_admin_operational_exclusion_invariant' };
    }

    // Gate 5 — Soft-Delete Gate (Invariant #2)
    // Source: I1 §2 Gate 5; Consolidated Reference Part 12 Invariant #2
    if (resource.deletedAt != null && !SOFT_DELETE_ALLOWED_ACTIONS.has(action)) {
      return { allowed: false, reason: 'resource_soft_deleted' };
    }

    return { allowed: true };
  }

  /**
   * Async Gate 4 — Classification Gate.
   * Source: I1 §2 Gate 4; I1 §15 resolved D-ABAC-02.
   *
   * Called by PolicyEvaluator between sync gates and RBAC step.
   * Returns DENY if the resource has a classified level and the subject's
   * roles do not appear in the allowlist for that document type.
   */
  async checkClassificationGateAsync(
    subject: SubjectContext,
    resource: ResourceDescriptor,
  ): Promise<EvaluationResult> {
    if (
      typeof resource.classificationLevel !== 'string' ||
      !CLASSIFIED_LEVELS.has(resource.classificationLevel)
    ) {
      // Not classified — gate does not apply
      return { allowed: true };
    }

    const documentTypeId = resource.documentTypeId;
    if (!documentTypeId) {
      // No document type context available — deny by default for classified resources
      return { allowed: false, reason: 'classification_denied' };
    }

    const allowedRoles = await this.getAllowlistRoles(documentTypeId);
    const hasAllowedRole = subject.roles.some((role) => allowedRoles.includes(role));

    if (!hasAllowedRole) {
      return { allowed: false, reason: 'classification_denied' };
    }

    return { allowed: true };
  }
}

// ─── PolicyEvaluator ────────────────────────────────────────────────────────

/**
 * Full ABAC policy evaluator implementing B5 §5.5 Steps 1–8.
 *
 * Delegates Gates 1–5 to PolicyGuard, then runs:
 *   Step 6: RBAC check (permission claim lookup)
 *   Steps 7–8: ABAC refinements via registered resource handlers
 *
 * Resource handlers are registered per resource type. When no handler is
 * registered for a resource type, RBAC alone is sufficient (ALLOW after Step 6).
 */
export class PolicyEvaluator {
  private readonly guard: PolicyGuard;
  private readonly handlers = new Map<string, ResourcePolicyHandler>();

  constructor(guard: PolicyGuard) {
    this.guard = guard;

    // Register the session resource handler at construction time
    // Source: TASK-IAM-004 spec; I1 §12
    this.registerResourceHandler('session', sessionResourceHandler);
  }

  /**
   * Evaluate an authorization request through the full cascade.
   *
   * @param subject  - The authenticated user's context (from JWT/session)
   * @param resource - Descriptor of the resource being accessed
   * @param action   - The action being attempted
   * @param context  - Optional additional context (e.g., reason for force_terminate)
   * @returns EvaluationResult — { allowed: true } or { allowed: false, reason }
   */
  async evaluate(
    subject: SubjectContext,
    resource: ResourceDescriptor,
    action: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    // Steps 1–3, 5: Synchronous PolicyGuard gates
    const gateResult = this.guard.checkGates(subject, resource, action);
    if (!gateResult.allowed) return gateResult;

    // Step 4: Async classification gate
    const classificationResult = await this.guard.checkClassificationGateAsync(subject, resource);
    if (!classificationResult.allowed) return classificationResult;

    // Step 6: RBAC check — permission claim is a pre-computed list in the JWT
    // Source: B5 §5.5 Step 6
    const permKey = `${resource.type}:${action}`;
    if (!subject.permissions.includes(permKey)) {
      return { allowed: false, reason: 'rbac_no_matching_permission' };
    }

    // Steps 7–8: ABAC refinements via registered resource handler
    // Source: B5 §5.5 Steps 7–8
    const handler = this.handlers.get(resource.type);
    if (!handler) {
      // No handler registered for this resource type — RBAC is sufficient
      return { allowed: true };
    }

    return handler(subject, resource, action, context);
  }

  /**
   * Register an ABAC resource handler for a specific resource type.
   * Other modules (e.g., Documents, Workflow) register their handlers
   * during plugin initialization.
   */
  registerResourceHandler(resourceType: string, handler: ResourcePolicyHandler): void {
    this.handlers.set(resourceType, handler);
  }
}

// ─── Session Resource Handler ───────────────────────────────────────────────

/**
 * ABAC handler for `session` resource type.
 * Source: TASK-IAM-004 spec; I1 §12.
 *
 * session:read_own       → ALLOW if resource.userId === subject.userId
 * session:read_all       → ALLOW if subject.isItAdmin
 * session:force_terminate → ALLOW if subject.isItAdmin AND context.reason is non-empty
 * All other actions       → DENY
 */
function sessionResourceHandler(
  subject: SubjectContext,
  resource: ResourceDescriptor,
  action: string,
  context?: Record<string, unknown>,
): EvaluationResult {
  switch (action) {
    case 'read_own':
      if (resource.userId === subject.userId) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'session_action_not_permitted' };

    case 'read_all':
      if (subject.isItAdmin) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'session_action_not_permitted' };

    case 'force_terminate': {
      const reason = context?.['reason'];
      if (
        subject.isItAdmin &&
        typeof reason === 'string' &&
        reason.length > 0
      ) {
        return { allowed: true };
      }
      return { allowed: false, reason: 'session_action_not_permitted' };
    }

    default:
      return { allowed: false, reason: 'session_action_not_permitted' };
  }
}
