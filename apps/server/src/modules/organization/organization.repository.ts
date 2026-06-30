import { eq, and, isNull } from 'drizzle-orm';
import {
  offices,
  positions,
  employees,
  assignments,
  delegationGrants,
  committees,
  committeeMemberships,
} from '@batac/database/schema/organization.schema.js';
import type { DbClient, DbTransaction } from './organization.types.js';

export interface OrgRepository {
  offices: {
    findById(id: string): Promise<any>;
    findAll(opts?: { includeDeleted?: boolean }): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
  };
  positions: {
    findById(id: string): Promise<any>;
    findAll(opts?: { includeDeleted?: boolean }): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
  };
  employees: {
    findById(id: string): Promise<any>;
    findByUserId(userId: string): Promise<any>;
    findAll(opts?: { includeDeleted?: boolean }): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
  };
  assignments: {
    findById(id: string): Promise<any>;
    findAll(opts?: { includeDeleted?: boolean }): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
    setPrimaryAssignment(employeeId: string, assignmentId: string, tx: DbTransaction): Promise<void>;
  };
  delegationGrants: {
    findById(id: string): Promise<any>;
    findAll(opts?: { includeDeleted?: boolean }): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
    findActiveByUserId(userId: string): Promise<any>;
    findByIdAndActive(id: string): Promise<any>;
  };
  committees: {
    findById(id: string): Promise<any>;
    findAll(opts?: { includeDeleted?: boolean }): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
  };
  committeeMemberships: {
    findById(id: string): Promise<any>;
    findAll(opts?: { includeDeleted?: boolean }): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
    findActiveByUserId(userId: string): Promise<any>;
  };
}

export function createOrgRepository(db: DbClient | DbTransaction): OrgRepository {
  return {
    offices: {
      findById: async (id) => {
        const [row] = await db.select().from(offices).where(eq(offices.id, id));
        return row || null;
      },
      findAll: async (opts) => {
        let query = db.select().from(offices).$dynamic();
        if (!opts?.includeDeleted) {
          query = query.where(isNull(offices.deletedAt));
        }
        return await query;
      },
      create: async (input) => {
        const [row] = await db.insert(offices).values(input).returning();
        return row!;
      },
      update: async (id, input) => {
        const [row] = await db.update(offices).set({ ...input, updatedAt: new Date() }).where(eq(offices.id, id)).returning();
        return row!;
      },
      softDelete: async (id, deletedBy) => {
        await db.update(offices).set({ deletedAt: new Date(), deletedBy }).where(eq(offices.id, id));
      },
    },
    positions: {
      findById: async (id) => {
        const [row] = await db.select().from(positions).where(eq(positions.id, id));
        return row || null;
      },
      findAll: async (opts) => {
        let query = db.select().from(positions).$dynamic();
        if (!opts?.includeDeleted) {
          query = query.where(isNull(positions.deletedAt));
        }
        return await query;
      },
      create: async (input) => {
        const [row] = await db.insert(positions).values(input).returning();
        return row!;
      },
      update: async (id, input) => {
        const [row] = await db.update(positions).set({ ...input, updatedAt: new Date() }).where(eq(positions.id, id)).returning();
        return row!;
      },
      softDelete: async (id, deletedBy) => {
        await db.update(positions).set({ deletedAt: new Date(), deletedBy }).where(eq(positions.id, id));
      },
    },
    employees: {
      findById: async (id) => {
        const [row] = await db.select().from(employees).where(eq(employees.id, id));
        return row || null;
      },
      findByUserId: async (userId) => {
        const [row] = await db.select().from(employees).where(and(eq(employees.userId, userId), isNull(employees.deletedAt)));
        return row || null;
      },
      findAll: async (opts) => {
        let query = db.select().from(employees).$dynamic();
        if (!opts?.includeDeleted) {
          query = query.where(isNull(employees.deletedAt));
        }
        return await query;
      },
      create: async (input) => {
        const [row] = await db.insert(employees).values(input).returning();
        return row!;
      },
      update: async (id, input) => {
        const [row] = await db.update(employees).set({ ...input, updatedAt: new Date() }).where(eq(employees.id, id)).returning();
        return row!;
      },
      softDelete: async (id, deletedBy) => {
        await db.update(employees).set({ deletedAt: new Date(), deletedBy }).where(eq(employees.id, id));
      },
    },
    assignments: {
      findById: async (id) => {
        const [row] = await db.select().from(assignments).where(eq(assignments.id, id));
        return row || null;
      },
      findAll: async (opts) => {
        let query = db.select().from(assignments).$dynamic();
        if (!opts?.includeDeleted) {
          query = query.where(isNull(assignments.deletedAt));
        }
        return await query;
      },
      create: async (input) => {
        const [row] = await db.insert(assignments).values(input).returning();
        return row!;
      },
      update: async (id, input) => {
        const [row] = await db.update(assignments).set({ ...input, updatedAt: new Date() }).where(eq(assignments.id, id)).returning();
        return row!;
      },
      softDelete: async (id, deletedBy) => {
        await db.update(assignments).set({ deletedAt: new Date(), deletedBy }).where(eq(assignments.id, id));
      },
      setPrimaryAssignment: async (employeeId, targetAssignmentId, tx) => {
        // Step 1: unset all current primary assignments for this employee
        await tx.update(assignments)
          .set({ isPrimary: false, updatedAt: new Date() })
          .where(and(
            eq(assignments.employeeId, employeeId),
            eq(assignments.isPrimary, true),
            isNull(assignments.deletedAt)
          ));
        // Step 2: set the new primary
        await tx.update(assignments)
          .set({ isPrimary: true, updatedAt: new Date() })
          .where(eq(assignments.id, targetAssignmentId));
      },
    },
    delegationGrants: {
      findById: async (id) => {
        const [row] = await db.select().from(delegationGrants).where(eq(delegationGrants.id, id));
        return row || null;
      },
      findAll: async (opts) => {
        let query = db.select().from(delegationGrants).$dynamic();
        if (!opts?.includeDeleted) {
          query = query.where(isNull(delegationGrants.deletedAt));
        }
        return await query;
      },
      create: async (input) => {
        const [row] = await db.insert(delegationGrants).values(input).returning();
        return row!;
      },
      update: async (id, input) => {
        const [row] = await db.update(delegationGrants).set({ ...input, updatedAt: new Date() }).where(eq(delegationGrants.id, id)).returning();
        return row!;
      },
      softDelete: async (id, deletedBy) => {
        await db.update(delegationGrants).set({ deletedAt: new Date(), deletedBy }).where(eq(delegationGrants.id, id));
      },
      findActiveByUserId: async (userId) => {
        const rows = await db.select({ grant: delegationGrants })
          .from(delegationGrants)
          .innerJoin(employees, eq(delegationGrants.delegatedToEmployeeId, employees.id))
          .where(and(
            eq(employees.userId, userId),
            eq(delegationGrants.isActive, true),
            isNull(delegationGrants.revokedAt),
            isNull(delegationGrants.deletedAt)
          ));
        return rows.map(r => r.grant);
      },
      findByIdAndActive: async (id) => {
        const [row] = await db.select().from(delegationGrants).where(and(
          eq(delegationGrants.id, id),
          eq(delegationGrants.isActive, true),
          isNull(delegationGrants.revokedAt),
          isNull(delegationGrants.deletedAt)
        ));
        return row || null;
      },
    },
    committees: {
      findById: async (id) => {
        const [row] = await db.select().from(committees).where(eq(committees.id, id));
        return row || null;
      },
      findAll: async (opts) => {
        let query = db.select().from(committees).$dynamic();
        if (!opts?.includeDeleted) {
          query = query.where(isNull(committees.deletedAt));
        }
        return await query;
      },
      create: async (input) => {
        const [row] = await db.insert(committees).values(input).returning();
        return row!;
      },
      update: async (id, input) => {
        const [row] = await db.update(committees).set({ ...input, updatedAt: new Date() }).where(eq(committees.id, id)).returning();
        return row!;
      },
      softDelete: async (id, deletedBy) => {
        await db.update(committees).set({ deletedAt: new Date(), deletedBy }).where(eq(committees.id, id));
      },
    },
    committeeMemberships: {
      findById: async (id) => {
        const [row] = await db.select().from(committeeMemberships).where(eq(committeeMemberships.id, id));
        return row || null;
      },
      findAll: async (opts) => {
        let query = db.select().from(committeeMemberships).$dynamic();
        if (!opts?.includeDeleted) {
          query = query.where(isNull(committeeMemberships.deletedAt));
        }
        return await query;
      },
      create: async (input) => {
        const [row] = await db.insert(committeeMemberships).values(input).returning();
        return row!;
      },
      update: async (id, input) => {
        const [row] = await db.update(committeeMemberships).set({ ...input, updatedAt: new Date() }).where(eq(committeeMemberships.id, id)).returning();
        return row!;
      },
      softDelete: async (id, deletedBy) => {
        await db.update(committeeMemberships).set({ deletedAt: new Date(), deletedBy }).where(eq(committeeMemberships.id, id));
      },
      findActiveByUserId: async (userId) => {
        const rows = await db.select({ membership: committeeMemberships })
          .from(committeeMemberships)
          .innerJoin(employees, eq(committeeMemberships.employeeId, employees.id))
          .where(and(
            eq(employees.userId, userId),
            eq(committeeMemberships.isActive, true),
            isNull(committeeMemberships.deletedAt)
          ));
        return rows.map(r => r.membership);
      },
    },
  };
}
