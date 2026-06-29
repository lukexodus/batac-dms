import { randomUUID } from 'node:crypto';
import type { IamService, IamServiceDeps, RoleAssignmentRow } from './iam.types.js';
import { RoleCombinationForbiddenError } from './iam.errors.js';
import { NotFoundError } from '../../errors/domain/not-found.js';
import { IAM_EVENTS } from './iam.events.js';

/**
 * Type codes that participate in the Platform Admin exclusion invariant.
 * A user may never hold both a `platform_admin` role and a `document_processor`
 * role simultaneously. Enforced at two layers:
 *   1. Application layer (this service): pre-INSERT check.
 *   2. Database layer (TASK-IAM-001): trg_enforce_platform_admin_exclusion trigger.
 */
const EXCLUSIVE_TYPE_CODES = new Set(['platform_admin', 'document_processor'] as const);

type ExclusiveTypeCode = 'platform_admin' | 'document_processor';

function conflictingTypeCode(typeCode: ExclusiveTypeCode): ExclusiveTypeCode {
  return typeCode === 'platform_admin' ? 'document_processor' : 'platform_admin';
}

export function createIamService(deps: IamServiceDeps): IamService {
  const { iamRepository: iamRepo, eventBus } = deps;

  return {
    evaluatePolicy: () => { throw new Error('not implemented'); },
    getUserById: () => { throw new Error('not implemented'); },
    login: () => { throw new Error('not implemented'); },
    logout: () => { throw new Error('not implemented'); },
    refresh: () => { throw new Error('not implemented'); },
    verifyAccessToken: () => { throw new Error('not implemented'); },
    resolveActiveDelegationGrant: () => { throw new Error('not implemented'); },

    /**
     * Assign a role to a user.
     *
     * @remarks
     * Role changes take effect on the **next token refresh** (next POST /api/auth/refresh),
     * not immediately. If instant permission enforcement is required, use the
     * force-terminate session functionality implemented in TASK-IAM-010.
     */
    async assignRole(input: {
      actorId: string;
      targetUserId: string;
      roleId: string;
      officeScopeId: string | null;
    }): Promise<RoleAssignmentRow> {
      const { actorId, targetUserId, roleId, officeScopeId } = input;

      // ── Step 1: Load incoming role ─────────────────────────────────────────
      const incomingRole = await iamRepo.findRoleById(roleId);
      if (!incomingRole) {
        throw new NotFoundError('Role', roleId);
      }

      // ── Step 2: Platform Admin exclusion check (BEFORE any INSERT) ─────────
      if (EXCLUSIVE_TYPE_CODES.has(incomingRole.typeCode as ExclusiveTypeCode)) {
        const conflictType = conflictingTypeCode(incomingRole.typeCode as ExclusiveTypeCode);
        const existingConflict = await iamRepo.findConflictingTypeCodeForUser(
          targetUserId,
          conflictType,
        );
        if (existingConflict) {
          throw new RoleCombinationForbiddenError({
            incomingRoleType: incomingRole.typeCode,
            conflictingRoleType: conflictType,
            userId: targetUserId,
          });
        }
      }

      // ── Step 3: Load target user (needed for cityId on the event envelope) ─
      const targetUser = await iamRepo.findUserById(targetUserId);
      if (!targetUser) {
        throw new NotFoundError('User', targetUserId);
      }

      // ── Step 4: Create the assignment ──────────────────────────────────────
      let assignment: RoleAssignmentRow;
      try {
        assignment = await iamRepo.createRoleAssignment({
          userId: targetUserId,
          roleId,
          assignedBy: actorId,
          officeScopeId,
          cityId: targetUser.cityId,
        });
      } catch (err: unknown) {
        // Surface DB trigger violations (e.g. race-condition bypass) as 500.
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.includes('enforce_platform_admin_exclusion') ||
          message.includes('role_combination')
        ) {
          throw new Error(
            'Role assignment constraint violated at database layer — possible race condition',
          );
        }
        throw err;
      }

      // ── Step 5: Emit role.assigned domain event ───────────────────────────
      eventBus.emit(IAM_EVENTS.ROLE_ASSIGNED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.ROLE_ASSIGNED,
        occurredAt: new Date().toISOString(),
        cityId: targetUser.cityId,
        schemaVersion: 1,
        payload: {
          actorId,
          targetUserId,
          roleId,
          roleName: incomingRole.name,
        },
      });

      return assignment;
    },

    /**
     * Revoke an active role assignment from a user.
     *
     * @remarks
     * Role changes take effect on the **next token refresh** (next POST /api/auth/refresh),
     * not immediately. If instant permission enforcement is required, use the
     * force-terminate session functionality implemented in TASK-IAM-010.
     */
    async revokeRole(input: {
      actorId: string;
      targetUserId: string;
      roleAssignmentId: string;
      reason: string;
    }): Promise<void> {
      const { actorId, targetUserId, roleAssignmentId, reason } = input;

      // ── Step 1: Load the assignment ────────────────────────────────────────
      const assignments = await iamRepo.findAssignmentsByUserId(targetUserId);
      const assignment = assignments.find((a) => a.id === roleAssignmentId);

      if (!assignment) {
        throw new NotFoundError('RoleAssignment', roleAssignmentId);
      }

      // Idempotent: already revoked — return without re-emitting an event.
      if (!assignment.isActive) {
        return;
      }

      // ── Step 2: Revoke the assignment ──────────────────────────────────────
      await iamRepo.revokeRoleAssignment(roleAssignmentId, actorId);

      // ── Step 3: Load role name for audit ──────────────────────────────────
      const role = await iamRepo.findRoleById(assignment.roleId);
      const roleName = role?.name ?? assignment.roleId;

      // ── Step 4: Load target user for cityId ───────────────────────────────
      const targetUser = await iamRepo.findUserById(targetUserId);
      const cityId = targetUser?.cityId ?? '';

      // ── Step 5: Emit role.revoked domain event ────────────────────────────
      eventBus.emit(IAM_EVENTS.ROLE_REVOKED, {
        eventId: randomUUID(),
        eventType: IAM_EVENTS.ROLE_REVOKED,
        occurredAt: new Date().toISOString(),
        cityId,
        schemaVersion: 1,
        payload: {
          actorId,
          targetUserId,
          roleId: assignment.roleId,
          roleName,
          reason,
        },
      });
    },
  };
}
