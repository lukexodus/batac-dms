import type { DbClient, DbTransaction } from './organization.types.js';
import { NotImplementedError } from '../../errors/not-implemented.js';

export interface OrgRepository {
  offices: {
    findById(id: string): Promise<any>;
    findAll(opts: any): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
  };
  positions: {
    findById(id: string): Promise<any>;
    findAll(opts: any): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
  };
  employees: {
    findById(id: string): Promise<any>;
    findByUserId(userId: string): Promise<any>;
    findAll(opts: any): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
  };
  assignments: {
    findById(id: string): Promise<any>;
    findAll(opts: any): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
    setPrimaryAssignment(employeeId: string, assignmentId: string, tx?: DbClient | DbTransaction): Promise<any>;
  };
  delegationGrants: {
    findById(id: string): Promise<any>;
    findAll(opts: any): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
    findActiveByUserId(userId: string): Promise<any>;
    findByIdAndActive(id: string): Promise<any>;
  };
  committees: {
    findById(id: string): Promise<any>;
    findAll(opts: any): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
  };
  committeeMemberships: {
    findById(id: string): Promise<any>;
    findAll(opts: any): Promise<any>;
    create(input: any): Promise<any>;
    update(id: string, input: any): Promise<any>;
    softDelete(id: string, deletedBy: string): Promise<any>;
    findActiveByUserId(userId: string): Promise<any>;
  };
}

export function createOrgRepository(db: DbClient | DbTransaction): OrgRepository {
  return {
    offices: {
      findById: async () => { throw new NotImplementedError(); },
      findAll: async () => { throw new NotImplementedError(); },
      create: async () => { throw new NotImplementedError(); },
      update: async () => { throw new NotImplementedError(); },
      softDelete: async () => { throw new NotImplementedError(); },
    },
    positions: {
      findById: async () => { throw new NotImplementedError(); },
      findAll: async () => { throw new NotImplementedError(); },
      create: async () => { throw new NotImplementedError(); },
      update: async () => { throw new NotImplementedError(); },
      softDelete: async () => { throw new NotImplementedError(); },
    },
    employees: {
      findById: async () => { throw new NotImplementedError(); },
      findByUserId: async () => { throw new NotImplementedError(); },
      findAll: async () => { throw new NotImplementedError(); },
      create: async () => { throw new NotImplementedError(); },
      update: async () => { throw new NotImplementedError(); },
      softDelete: async () => { throw new NotImplementedError(); },
    },
    assignments: {
      findById: async () => { throw new NotImplementedError(); },
      findAll: async () => { throw new NotImplementedError(); },
      create: async () => { throw new NotImplementedError(); },
      update: async () => { throw new NotImplementedError(); },
      softDelete: async () => { throw new NotImplementedError(); },
      setPrimaryAssignment: async () => { throw new NotImplementedError(); },
    },
    delegationGrants: {
      findById: async () => { throw new NotImplementedError(); },
      findAll: async () => { throw new NotImplementedError(); },
      create: async () => { throw new NotImplementedError(); },
      update: async () => { throw new NotImplementedError(); },
      softDelete: async () => { throw new NotImplementedError(); },
      findActiveByUserId: async () => { throw new NotImplementedError(); },
      findByIdAndActive: async () => { throw new NotImplementedError(); },
    },
    committees: {
      findById: async () => { throw new NotImplementedError(); },
      findAll: async () => { throw new NotImplementedError(); },
      create: async () => { throw new NotImplementedError(); },
      update: async () => { throw new NotImplementedError(); },
      softDelete: async () => { throw new NotImplementedError(); },
    },
    committeeMemberships: {
      findById: async () => { throw new NotImplementedError(); },
      findAll: async () => { throw new NotImplementedError(); },
      create: async () => { throw new NotImplementedError(); },
      update: async () => { throw new NotImplementedError(); },
      softDelete: async () => { throw new NotImplementedError(); },
      findActiveByUserId: async () => { throw new NotImplementedError(); },
    },
  };
}
