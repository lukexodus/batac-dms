import type { OrgService, OrgServiceDeps, UserSummary, OfficeSummary, OfficeTree, EmployeeSummary } from './organization.types.js';
import { eq, and, or, isNull, isNotNull, lte, gte } from 'drizzle-orm';
import {
  offices,
  positions,
  employees,
  assignments,
  delegationGrants,
} from '@batac/database/schema/organization.schema.js';

export function createOrgService(deps: OrgServiceDeps): OrgService {
  return {
    async resolveCurrentHolder(positionId: string, asOf?: Date): Promise<UserSummary | null> {
      const db = deps.db;
      const asOfDate = asOf || new Date();
      const asOfStr = asOfDate.toISOString().split('T')[0];

      // 1. Find active delegation covering positionId (delegated-to wins)
      const delegations = await db.select({
        userId: employees.userId,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(delegationGrants)
      .innerJoin(employees, eq(delegationGrants.delegatedToEmployeeId, employees.id))
      .where(and(
        eq(delegationGrants.positionId, positionId),
        eq(delegationGrants.isActive, true),
        isNull(delegationGrants.revokedAt),
        isNull(delegationGrants.deletedAt),
        lte(delegationGrants.startDate, asOfStr),
        gte(delegationGrants.endDate, asOfStr),
        isNotNull(employees.userId),
        isNull(employees.deletedAt)
      ))
      .limit(1);

      if (delegations.length > 0 && delegations[0].userId) {
        return {
          userId: delegations[0].userId,
          displayName: `${delegations[0].firstName} ${delegations[0].lastName}`,
        };
      }

      // 2. Fall back to active assignment for positionId
      const activeAssignments = await db.select({
        userId: employees.userId,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(assignments)
      .innerJoin(employees, eq(assignments.employeeId, employees.id))
      .where(and(
        eq(assignments.positionId, positionId),
        eq(assignments.isActive, true),
        isNull(assignments.deletedAt),
        lte(assignments.startDate, asOfStr),
        or(
          isNull(assignments.endDate),
          gte(assignments.endDate, asOfStr)
        ),
        isNotNull(employees.userId),
        isNull(employees.deletedAt)
      ))
      .limit(1);

      if (activeAssignments.length > 0 && activeAssignments[0].userId) {
        return {
          userId: activeAssignments[0].userId,
          displayName: `${activeAssignments[0].firstName} ${activeAssignments[0].lastName}`,
        };
      }

      return null;
    },

    async getOfficeById(officeId: string): Promise<OfficeSummary | null> {
      const db = deps.db;
      const [row] = await db.select()
        .from(offices)
        .where(and(
          eq(offices.id, officeId),
          isNull(offices.deletedAt)
        ));
      if (!row) return null;
      return {
        officeId: row.id,
        name: row.name,
        parentOfficeId: row.parentOfficeId,
        type: row.officeType,
      };
    },

    async getOfficeHierarchy(): Promise<OfficeTree> {
      const db = deps.db;
      const rows = await db.select()
        .from(offices)
        .where(isNull(offices.deletedAt));

      return {
        offices: rows.map(row => ({
          officeId: row.id,
          name: row.name,
          parentOfficeId: row.parentOfficeId,
          type: row.officeType,
        }))
      };
    },

    async getEmployeeByUserId(userId: string): Promise<EmployeeSummary | null> {
      const db = deps.db;
      const rows = await db.select({
        employeeId: employees.id,
        userId: employees.userId,
        firstName: employees.firstName,
        lastName: employees.lastName,
        assignmentId: assignments.id,
        positionId: assignments.positionId,
        positionTitle: positions.title,
        officeId: assignments.officeId,
        isPrimary: assignments.isPrimary,
        isActive: assignments.isActive,
        assignmentDeletedAt: assignments.deletedAt,
      })
      .from(employees)
      .leftJoin(assignments, and(
        eq(employees.id, assignments.employeeId),
        eq(assignments.isActive, true),
        isNull(assignments.deletedAt)
      ))
      .leftJoin(positions, eq(assignments.positionId, positions.id))
      .where(and(
        eq(employees.userId, userId),
        isNull(employees.deletedAt)
      ));

      if (rows.length === 0) return null;

      let bestRow = rows[0];
      const activeAssignments = rows.filter(r => r.assignmentId && r.isActive && !r.assignmentDeletedAt);
      if (activeAssignments.length > 0) {
        const primary = activeAssignments.find(r => r.isPrimary);
        bestRow = primary || activeAssignments[0];
      }

      return {
        employeeId: bestRow.employeeId,
        userId: bestRow.userId || '',
        displayName: `${bestRow.firstName} ${bestRow.lastName}`,
        positionId: bestRow.assignmentId ? bestRow.positionId : null,
        positionTitle: bestRow.assignmentId ? bestRow.positionTitle : null,
        officeId: bestRow.assignmentId ? bestRow.officeId : null,
      };
    },

    async getPrimaryOfficeForUser(userId: string): Promise<{ officeId: string; officeCode: string } | null> {
      const db = deps.db;
      const rows = await db.select({
        officeId: assignments.officeId,
        officeCode: offices.code,
      })
      .from(employees)
      .innerJoin(assignments, eq(assignments.employeeId, employees.id))
      .innerJoin(offices, eq(offices.id, assignments.officeId))
      .where(and(
        eq(employees.userId, userId),
        eq(assignments.isPrimary, true),
        eq(assignments.isActive, true),
        isNull(assignments.deletedAt),
        isNull(employees.deletedAt),
        isNull(offices.deletedAt)
      ))
      .limit(1);

      if (rows.length === 0) return null;
      return rows[0];
    },

    async getCommitteeIdsForUser(userId: string): Promise<string[]> {
      const db = deps.db;
      const nowStr = new Date().toISOString().split('T')[0];
      const { committeeMemberships } = await import('@batac/database/schema/organization.schema.js');

      const rows = await db.select({
        committeeId: committeeMemberships.committeeId,
      })
      .from(committeeMemberships)
      .innerJoin(employees, eq(committeeMemberships.employeeId, employees.id))
      .where(and(
        eq(employees.userId, userId),
        eq(committeeMemberships.isActive, true),
        isNull(committeeMemberships.deletedAt),
        isNull(employees.deletedAt),
        or(
          isNull(committeeMemberships.endDate),
          gte(committeeMemberships.endDate, nowStr)
        )
      ));

      return rows.map(r => r.committeeId);
    },
  };
}
