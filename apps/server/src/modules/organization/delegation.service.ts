import type { DelegationService, DelegationServiceDeps, DelegationSummary } from './organization.types.js';
import { eq, and, isNull, lte, gte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  employees,
  delegationGrants,
} from '@batac/database/schema/organization.schema.js';

export function createDelegationService(deps: DelegationServiceDeps): DelegationService {
  return {
    async getActiveDelegationForUser(userId: string): Promise<DelegationSummary | null> {
      const db = deps.db;
      const nowStr = new Date().toISOString().split('T')[0]!;

      const delegatorEmp = alias(employees, 'delegator_emp');
      const delegateeEmp = alias(employees, 'delegatee_emp');

      const rows = await db.select({
        id: delegationGrants.id,
        designationDocumentId: delegationGrants.designationDocumentId,
        scope: delegationGrants.scope,
        officeId: delegationGrants.officeId,
        positionId: delegationGrants.positionId,
        startDate: delegationGrants.startDate,
        endDate: delegationGrants.endDate,
        delegatingUserId: delegatorEmp.userId,
        delegatedToUserId: delegateeEmp.userId,
      })
      .from(delegationGrants)
      .innerJoin(delegatorEmp, eq(delegationGrants.delegatingEmployeeId, delegatorEmp.id))
      .innerJoin(delegateeEmp, eq(delegationGrants.delegatedToEmployeeId, delegateeEmp.id))
      .where(and(
        eq(delegateeEmp.userId, userId),
        eq(delegationGrants.isActive, true),
        isNull(delegationGrants.revokedAt),
        isNull(delegationGrants.deletedAt),
        lte(delegationGrants.startDate, nowStr),
        gte(delegationGrants.endDate, nowStr)
      ))
      .limit(1);

      if (rows.length === 0) return null;
      const row = rows[0]!;
      return {
        delegationId: row.id,
        designationDocumentId: row.designationDocumentId || '',
        delegatingUserId: row.delegatingUserId || '',
        delegatedToUserId: row.delegatedToUserId || '',
        scope: {
          officeId: row.officeId,
          positionId: row.positionId,
        },
        validFrom: new Date(row.startDate),
        validUntil: new Date(row.endDate),
      };
    },

    async getDelegationGrantById(delegationGrantId: string): Promise<{ scope: { roles: string[]; officeIds: string[]; actions: string[] } } | null> {
      const db = deps.db;
      const nowStr = new Date().toISOString().split('T')[0]!;

      const [row] = await db.select({
        scope: delegationGrants.scope,
      })
      .from(delegationGrants)
      .where(and(
        eq(delegationGrants.id, delegationGrantId),
        eq(delegationGrants.isActive, true),
        isNull(delegationGrants.revokedAt),
        isNull(delegationGrants.deletedAt),
        gte(delegationGrants.endDate, nowStr)
      ));

      if (!row) return null;

      const scope = row.scope as any;
      return {
        scope: {
          roles: Array.isArray(scope?.roles) ? scope.roles : [],
          officeIds: Array.isArray(scope?.officeIds) ? scope.officeIds : [],
          actions: Array.isArray(scope?.actions) ? scope.actions : [],
        }
      };
    },
  };
}
