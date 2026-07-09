import type { DelegationService, OrgService } from '../../organization/organization.types.js';

export interface AssigneeSnapshot {
  user_id: string;
  resolved_via: string;
}

export interface ResolveAssigneesDeps {
  orgService: OrgService;
  delegationService: DelegationService;
}

/**
 * Resolves step assignees based on B4 §3.5 rules.
 * 
 * @param assigneeExpression The `config.assignee` string from the step definition.
 * @param context The current workflow instance context.
 * @param deps Injected dependencies, particularly the Organization Published API.
 * @returns Array of authoritative assignee snapshots for the step instance.
 */
export async function resolveAssignees(
  assigneeExpression: string,
  context: Record<string, any>,
  deps: ResolveAssigneesDeps
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
    // Gap 2: Organization Published API currently lacks getUsersByRole
    throw new Error(`NotImplemented: The Organization module does not currently support role-based bulk lookups for '${assigneeExpression}'.`);
  }

  if (assigneeExpression.startsWith('office_role:')) {
    // Gap 2: Organization Published API currently lacks getUserByOfficeRole
    throw new Error(`NotImplemented: The Organization module does not currently support office-role lookups for '${assigneeExpression}'.`);
  }

  if (assigneeExpression.startsWith('delegation_aware:')) {
    const roleKey = assigneeExpression.replace('delegation_aware:', '');
    
    // First, resolve the base role users. 
    // Gap 2: We would call getUsersByRole(roleKey) here, but it doesn't exist yet.
    // For now, this will throw to prevent silent failures.
    throw new Error(`NotImplemented: delegation_aware requires role resolution which is missing for role '${roleKey}'.`);
    
    /* 
    // Planned implementation once Organization API is updated:
    const baseUsers = await deps.organizationService.getUsersByRole(roleKey);
    const resolved: AssigneeSnapshot[] = [];

    for (const baseUser of baseUsers) {
      const activeDelegation = await deps.organizationService.getActiveDelegationForUser(baseUser.userId);
      if (activeDelegation) {
        resolved.push({ user_id: activeDelegation.delegatedToUserId, resolved_via: `delegated_from:${baseUser.userId}` });
      } else {
        resolved.push({ user_id: baseUser.userId, resolved_via: `role:${roleKey}` });
      }
    }
    return resolved;
    */
  }

  // Fallback for unknown or unsupported expressions
  throw new Error(`Unsupported assignee expression format: ${assigneeExpression}`);
}
