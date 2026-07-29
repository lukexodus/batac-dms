import type { DelegationService, OrgService } from '../../organization/organization.types.js';
import type { IamPublicAPI } from '../../iam/iam.types.js';

export interface AssigneeSnapshot {
  user_id: string;
  resolved_via: string;
  office_id: string | null;
}

export interface ResolveAssigneesDeps {
  orgService: OrgService;
  delegationService: DelegationService;
  iamService: IamPublicAPI;
}

async function resolvePrimaryOfficeId(
  userId: string,
  deps: ResolveAssigneesDeps,
): Promise<string | null> {
  const office = await deps.orgService.getPrimaryOfficeForUser(userId);
  return office?.officeId ?? null;
}

/**
 * Resolves step assignees based on B4 §3.5 rules.
 *
 * @param assigneeExpression The `config.assignee` string from the step definition.
 * @param context The current workflow instance context.
 * @param deps Injected dependencies — role-based resolution (`role:`,
 *   `delegation_aware:`) calls the IAM Published API; office-based and
 *   delegation-lookup resolution call the Organization Published API.
 * @returns Array of authoritative assignee snapshots for the step instance.
 */
export async function resolveAssignees(
  assigneeExpression: string,
  context: Record<string, any>,
  deps: ResolveAssigneesDeps,
): Promise<AssigneeSnapshot[]> {
  if (assigneeExpression.startsWith('static:')) {
    const userId = assigneeExpression.replace('static:', '');
    const officeId = await resolvePrimaryOfficeId(userId, deps);
    return [{ user_id: userId, resolved_via: assigneeExpression, office_id: officeId }];
  }

  if (assigneeExpression.startsWith('actor_from_context:')) {
    const contextKey = assigneeExpression.replace('actor_from_context:', '');
    const userId = context[contextKey];
    if (typeof userId === 'string') {
      const officeId = await resolvePrimaryOfficeId(userId, deps);
      return [{ user_id: userId, resolved_via: assigneeExpression, office_id: officeId }];
    }
    return [];
  }

  if (assigneeExpression.startsWith('role:')) {
    const roleCode = assigneeExpression.replace('role:', '');
    const matchedUsers = await deps.iamService.getUsersByRole(roleCode);
    const resolved: AssigneeSnapshot[] = [];
    for (const u of matchedUsers) {
      const officeId = await resolvePrimaryOfficeId(u.userId, deps);
      resolved.push({
        user_id: u.userId,
        resolved_via: assigneeExpression,
        office_id: officeId,
      });
    }
    return resolved;
  }

  if (assigneeExpression.startsWith('office_role:')) {
    // Gap 2: Organization Published API currently lacks getUserByOfficeRole
    throw new Error(
      `NotImplemented: The Organization module does not currently support office-role lookups for '${assigneeExpression}'.`,
    );
  }

  if (assigneeExpression.startsWith('delegation_aware:')) {
    const roleKey = assigneeExpression.replace('delegation_aware:', '');

    const baseUsers = await deps.iamService.getUsersByRole(roleKey);
    const resolved: AssigneeSnapshot[] = [];

    for (const baseUser of baseUsers) {
      const activeDelegation = await deps.delegationService.getActiveDelegationForUser(
        baseUser.userId,
      );
      if (activeDelegation) {
        const officeId = await resolvePrimaryOfficeId(activeDelegation.delegatedToUserId, deps);
        resolved.push({
          user_id: activeDelegation.delegatedToUserId,
          resolved_via: `delegated_from:${baseUser.userId}`,
          office_id: officeId,
        });
      } else {
        const officeId = await resolvePrimaryOfficeId(baseUser.userId, deps);
        resolved.push({
          user_id: baseUser.userId,
          resolved_via: `role:${roleKey}`,
          office_id: officeId,
        });
      }
    }
    return resolved;
  }

  // Fallback for unknown or unsupported expressions
  throw new Error(`Unsupported assignee expression format: ${assigneeExpression}`);
}
