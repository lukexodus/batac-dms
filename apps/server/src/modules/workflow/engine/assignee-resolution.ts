import type { DelegationService, OrgService } from '../../organization/organization.types.js';
import type { IamPublicAPI } from '../../iam/iam.types.js';

export interface AssigneeSnapshot {
  user_id: string;
  resolved_via: string;
}

export interface ResolveAssigneesDeps {
  orgService: OrgService;
  delegationService: DelegationService;
  iamService: IamPublicAPI;
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
    return [{ user_id: userId, resolved_via: assigneeExpression }];
  }

  if (assigneeExpression.startsWith('actor_from_context:')) {
    const contextKey = assigneeExpression.replace('actor_from_context:', '');
    const userId = context[contextKey];
    if (typeof userId === 'string') {
      return [{ user_id: userId, resolved_via: assigneeExpression }];
    }
    return [];
  }

  if (assigneeExpression.startsWith('role:')) {
    const roleCode = assigneeExpression.replace('role:', '');
    const matchedUsers = await deps.iamService.getUsersByRole(roleCode);
    return matchedUsers.map((u) => ({
      user_id: u.userId,
      resolved_via: assigneeExpression,
    }));
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
        resolved.push({
          user_id: activeDelegation.delegatedToUserId,
          resolved_via: `delegated_from:${baseUser.userId}`,
        });
      } else {
        resolved.push({
          user_id: baseUser.userId,
          resolved_via: `role:${roleKey}`,
        });
      }
    }
    return resolved;
  }

  // Fallback for unknown or unsupported expressions
  throw new Error(`Unsupported assignee expression format: ${assigneeExpression}`);
}
