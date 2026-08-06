import type {
  OrgService,
  OrgServiceDeps,
  UserSummary,
  OfficeSummary,
  OfficeTree,
  EmployeeSummary,
} from './organization.types.js';
import { eq, and, or, isNull, isNotNull, lte, gte, inArray } from 'drizzle-orm';
import {
  offices,
  positions,
  employees,
  assignments,
  delegationGrants,
} from '@batac/database/schema/organization.schema.js';
import {
  roleAssignments,
  roles,
} from '@batac/database/schema/iam.schema.js';

export function createOrgService(deps: OrgServiceDeps): OrgService {
  return {
    async resolveCurrentHolder(positionId: string, asOf?: Date): Promise<UserSummary | null> {
      const db = deps.db;
      const asOfDate = asOf || new Date();
      const asOfStr = asOfDate.toISOString().split('T')[0]!;

      // 1. Find active delegation covering positionId (delegated-to wins)
      const delegations = await db
        .select({
          userId: employees.userId,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(delegationGrants)
        .innerJoin(employees, eq(delegationGrants.delegatedToEmployeeId, employees.id))
        .where(
          and(
            eq(delegationGrants.positionId, positionId),
            eq(delegationGrants.isActive, true),
            isNull(delegationGrants.revokedAt),
            isNull(delegationGrants.deletedAt),
            lte(delegationGrants.startDate, asOfStr),
            gte(delegationGrants.endDate, asOfStr),
            isNotNull(employees.userId),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (delegations.length > 0 && delegations[0]?.userId) {
        return {
          userId: delegations[0].userId,
          displayName: `${delegations[0].firstName} ${delegations[0].lastName}`,
        };
      }

      // 2. Fall back to active assignment for positionId
      const activeAssignments = await db
        .select({
          userId: employees.userId,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(assignments)
        .innerJoin(employees, eq(assignments.employeeId, employees.id))
        .where(
          and(
            eq(assignments.positionId, positionId),
            eq(assignments.isActive, true),
            isNull(assignments.deletedAt),
            lte(assignments.startDate, asOfStr),
            or(isNull(assignments.endDate), gte(assignments.endDate, asOfStr)),
            isNotNull(employees.userId),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (activeAssignments.length > 0 && activeAssignments[0]?.userId) {
        return {
          userId: activeAssignments[0].userId,
          displayName: `${activeAssignments[0].firstName} ${activeAssignments[0].lastName}`,
        };
      }

      return null;
    },

    async getOfficeById(officeId: string): Promise<OfficeSummary | null> {
      const db = deps.db;
      const [row] = await db
        .select()
        .from(offices)
        .where(and(eq(offices.id, officeId), isNull(offices.deletedAt)));
      if (!row) return null;
      return {
        officeId: row.id,
        name: row.name,
        parentOfficeId: row.parentOfficeId,
        // officeType is text() at the Drizzle level, but DB-enforced narrower
        // by ck_offices_office_type (organization.schema.ts) to exactly
        // OfficeSummary['type']'s five literal values.
        type: row.officeType as OfficeSummary['type'],
      };
    },

    async getOfficeByCode(code: string, cityId: string): Promise<OfficeSummary | null> {
      const db = deps.db;
      const [row] = await db
        .select()
        .from(offices)
        .where(and(eq(offices.code, code), eq(offices.cityId, cityId), isNull(offices.deletedAt)));
      if (!row) return null;
      return {
        officeId: row.id,
        name: row.name,
        parentOfficeId: row.parentOfficeId,
        // See getOfficeById above re: officeType's DB-enforced narrowing.
        type: row.officeType as OfficeSummary['type'],
      };
    },

    async getOfficeHierarchy(): Promise<OfficeTree> {
      const db = deps.db;
      const rows = await db.select().from(offices).where(isNull(offices.deletedAt));

      return {
        offices: rows.map((row) => ({
          officeId: row.id,
          name: row.name,
          parentOfficeId: row.parentOfficeId,
          // See getOfficeById above re: officeType's DB-enforced narrowing.
          type: row.officeType as OfficeSummary['type'],
        })),
      };
    },

    async getEmployeeByUserId(userId: string): Promise<EmployeeSummary | null> {
      const db = deps.db;
      const rows = await db
        .select({
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
        .leftJoin(
          assignments,
          and(
            eq(employees.id, assignments.employeeId),
            eq(assignments.isActive, true),
            isNull(assignments.deletedAt),
          ),
        )
        .leftJoin(positions, eq(assignments.positionId, positions.id))
        .where(and(eq(employees.userId, userId), isNull(employees.deletedAt)));

      if (rows.length === 0) return null;

      let bestRow = rows[0]!;
      const activeAssignments = rows.filter(
        (r) => r.assignmentId && r.isActive && !r.assignmentDeletedAt,
      );
      if (activeAssignments.length > 0) {
        const primary = activeAssignments.find((r) => r.isPrimary);
        bestRow = primary || activeAssignments[0]!;
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

    async getPrimaryOfficeForUser(
      userId: string,
    ): Promise<{ officeId: string; officeCode: string } | null> {
      const db = deps.db;
      const rows = await db
        .select({
          officeId: assignments.officeId,
          officeCode: offices.code,
        })
        .from(employees)
        .innerJoin(assignments, eq(assignments.employeeId, employees.id))
        .innerJoin(offices, eq(offices.id, assignments.officeId))
        .where(
          and(
            eq(employees.userId, userId),
            eq(assignments.isPrimary, true),
            eq(assignments.isActive, true),
            isNull(assignments.deletedAt),
            isNull(employees.deletedAt),
            isNull(offices.deletedAt),
          ),
        )
        .limit(1);

      if (rows.length === 0) return null;
      return rows[0] || null;
    },

    async getCommitteeIdsForUser(userId: string): Promise<string[]> {
      const db = deps.db;
      const nowStr = new Date().toISOString().split('T')[0]!;
      const { committeeMemberships } =
        await import('@batac/database/schema/organization.schema.js');

      const rows = await db
        .select({
          committeeId: committeeMemberships.committeeId,
        })
        .from(committeeMemberships)
        .innerJoin(employees, eq(committeeMemberships.employeeId, employees.id))
        .where(
          and(
            eq(employees.userId, userId),
            eq(committeeMemberships.isActive, true),
            isNull(committeeMemberships.deletedAt),
            isNull(employees.deletedAt),
            or(isNull(committeeMemberships.endDate), gte(committeeMemberships.endDate, nowStr)),
          ),
        );

      return rows.map((r) => r.committeeId);
    },

    async getCommitteeChair(committeeId: string): Promise<UserSummary | null> {
      const db = deps.db;
      const { committees } = await import('@batac/database/schema/organization.schema.js');
      const rows = await db
        .select({
          userId: employees.userId,
          firstName: employees.firstName,
          lastName: employees.lastName,
        })
        .from(committees)
        .innerJoin(employees, eq(committees.chairedByEmployeeId, employees.id))
        .where(
          and(
            eq(committees.id, committeeId),
            isNull(committees.deletedAt),
            isNotNull(employees.userId),
            isNull(employees.deletedAt),
          ),
        )
        .limit(1);

      if (rows.length === 0 || !rows[0]?.userId) return null;

      return {
        userId: rows[0].userId,
        displayName: `${rows[0].firstName} ${rows[0].lastName}`,
      };
    },

    async listSpMembers(cityId: string): Promise<EmployeeSummary[]> {
      const db = deps.db;

      const query = db
        .select({
          employeeId: employees.id,
          userId: employees.userId,
          firstName: employees.firstName,
          lastName: employees.lastName,
          positionId: assignments.positionId,
          positionTitle: positions.title,
          officeId: assignments.officeId,
        })
        .from(employees)
        .innerJoin(
          assignments,
          and(
            eq(employees.id, assignments.employeeId),
            eq(assignments.isActive, true),
            eq(assignments.isPrimary, true),
            isNull(assignments.deletedAt),
          ),
        )
        .innerJoin(positions, eq(assignments.positionId, positions.id))
        .innerJoin(offices, eq(assignments.officeId, offices.id))
        .where(
          and(
            eq(employees.cityId, cityId),
            isNull(employees.deletedAt),
            inArray(offices.code, ['SP', 'OVM']),
          ),
        )
        .orderBy(employees.lastName, employees.firstName, employees.id);

      const rows = await query;

      return rows.map((r) => ({
        employeeId: r.employeeId,
        userId: r.userId || '',
        displayName: `${r.firstName} ${r.lastName}`,
        positionId: r.positionId,
        positionTitle: r.positionTitle,
        officeId: r.officeId,
      }));
    },

    async listAllEmployees(cityId: string): Promise<EmployeeSummary[]> {
      const db = deps.db;

      const query = db
        .select({
          employeeId: employees.id,
          userId: employees.userId,
          firstName: employees.firstName,
          lastName: employees.lastName,
          positionId: assignments.positionId,
          positionTitle: positions.title,
          officeId: assignments.officeId,
        })
        .from(employees)
        .leftJoin(
          assignments,
          and(
            eq(employees.id, assignments.employeeId),
            eq(assignments.isActive, true),
            eq(assignments.isPrimary, true),
            isNull(assignments.deletedAt),
          ),
        )
        .leftJoin(positions, eq(assignments.positionId, positions.id))
        .where(
          and(
            eq(employees.cityId, cityId),
            isNull(employees.deletedAt),
          ),
        )
        .orderBy(employees.lastName, employees.firstName, employees.id);

      const rows = await query;

      return rows.map((r) => ({
        employeeId: r.employeeId,
        userId: r.userId || '',
        displayName: `${r.firstName} ${r.lastName}`,
        positionId: r.positionId,
        positionTitle: r.positionTitle,
        officeId: r.officeId,
      }));
    },

    async listAllOffices(): Promise<{ id: string; name: string }[]> {
      const db = deps.db;
      
      const query = db
        .select({
          id: offices.id,
          name: offices.name,
        })
        .from(offices)
        .where(isNull(offices.deletedAt))
        .orderBy(offices.name);
        
      return query;
    },

    async listEmployees(
      cityId: string,
      limit: number,
      cursor?: string | null,
      search?: string,
    ): Promise<{ items: EmployeeSummary[]; nextCursor: string | null }> {
      const db = deps.db;
      const { ilike } = await import('drizzle-orm');

      const query = db
        .select({
          employeeId: employees.id,
          userId: employees.userId,
          firstName: employees.firstName,
          lastName: employees.lastName,
          positionId: assignments.positionId,
          positionTitle: positions.title,
          officeId: assignments.officeId,
        })
        .from(employees)
        .leftJoin(
          assignments,
          and(
            eq(employees.id, assignments.employeeId),
            eq(assignments.isActive, true),
            eq(assignments.isPrimary, true),
            isNull(assignments.deletedAt),
          ),
        )
        .leftJoin(positions, eq(assignments.positionId, positions.id))
        .where(
          and(
            eq(employees.cityId, cityId),
            isNull(employees.deletedAt),
            search
              ? or(
                  ilike(employees.firstName, `%${search}%`),
                  ilike(employees.lastName, `%${search}%`),
                )
              : undefined,
          ),
        )
        .limit(limit + 1)
        .orderBy(employees.lastName, employees.firstName, employees.id);

      let offset = 0;
      if (cursor) {
        offset = parseInt(cursor, 10);
        if (isNaN(offset)) offset = 0;
      }
      if (offset > 0) {
        query.offset(offset);
      }

      const rows = await query;
      let nextCursor: string | null = null;
      if (rows.length > limit) {
        rows.pop();
        nextCursor = (offset + limit).toString();
      }

      const items = rows.map((r) => ({
        employeeId: r.employeeId,
        userId: r.userId || '',
        displayName: `${r.firstName} ${r.lastName}`,
        positionId: r.positionId,
        positionTitle: r.positionTitle,
        officeId: r.officeId,
      }));

      return { items, nextCursor };
    },

    async listEmployeesByRoleAndOffice(
      roleCode: string,
      officeId: string,
    ): Promise<EmployeeSummary[]> {
      const db = deps.db;
      const { roleAssignments, roles } = await import('@batac/database/schema/iam.schema.js');

      // Join employees -> assignments -> roleAssignments -> roles
      // We look for employees currently assigned to the given office
      // whose userId also holds the specified roleCode.
      const rows = await db
        .select({
          employee: employees,
          assignment: assignments,
          position: positions,
        })
        .from(employees)
        .innerJoin(
          assignments,
          and(
            eq(assignments.employeeId, employees.id),
            eq(assignments.isActive, true),
            eq(assignments.officeId, officeId),
            isNull(assignments.deletedAt),
          ),
        )
        .leftJoin(positions, eq(assignments.positionId, positions.id))
        .innerJoin(roleAssignments, eq(roleAssignments.userId, employees.userId))
        .innerJoin(roles, eq(roles.id, roleAssignments.roleId))
        .where(
          and(
            eq(roles.code, roleCode),
            isNull(roleAssignments.revokedAt),
            isNull(employees.deletedAt),
          ),
        );

      return rows.map(({ employee, assignment, position }) => ({
        employeeId: employee.id,
        userId: employee.userId!,
        displayName: `${employee.firstName} ${employee.lastName}`.trim(),
        positionId: assignment.positionId,
        positionTitle: position?.title ?? null,
        officeId: assignment.officeId,
      }));
    },
  };
}
