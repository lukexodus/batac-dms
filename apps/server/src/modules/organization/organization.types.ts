import type { AppDb } from '../../db.js';
import type { EventBus } from '@batac/shared';
import type { InferSelectModel } from 'drizzle-orm';
import {
  offices,
  positions,
  employees,
  assignments,
  delegationGrants,
  committees,
  committeeMemberships,
} from '@batac/database/schema/organization.schema.js';
import type { OrgRepository } from './organization.repository.js';

export type DbClient = AppDb;
export type DbTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

// Drizzle Row Types
export type OfficeRow = InferSelectModel<typeof offices>;
export type PositionRow = InferSelectModel<typeof positions>;
export type EmployeeRow = InferSelectModel<typeof employees>;
export type AssignmentRow = InferSelectModel<typeof assignments>;
export type DelegationGrantRow = InferSelectModel<typeof delegationGrants>;
export type CommitteeRow = InferSelectModel<typeof committees>;
export type CommitteeMembershipRow = InferSelectModel<typeof committeeMemberships>;

// B2 published interfaces
export interface UserSummary {
  userId: string;
  displayName: string;
}

export interface OfficeSummary {
  officeId: string;
  name: string;
  parentOfficeId: string | null;
  type: string;  // 'executive' | 'legislative' | 'department' | 'barangay' | 'external'
}

export interface OfficeTree {
  offices: OfficeSummary[];
}

export interface EmployeeSummary {
  employeeId: string;
  userId: string;
  displayName: string;
  positionId: string | null;
  positionTitle: string | null;
  officeId: string | null;
}

export interface DelegationSummary {
  delegationId: string;
  designationDocumentId: string;   // D YEAR-NN control number reference
  delegatingUserId: string;
  delegatedToUserId: string;
  scope: {
    officeId: string;
    positionId: string;
  };
  validFrom: Date;
  validUntil: Date;
}

export interface AssignmentSummary {
  assignmentId: string;
  employeeId: string;
  positionId: string;
  officeId: string;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
  isPrimary: boolean;
}

export interface CommitteeSummary {
  committeeId: string;
  name: string;
  code: string;
  chairedByEmployeeId: string;
}

// Service Dependency & API Interfaces
export interface OrgServiceDeps {
  db: DbClient;
  orgRepository: OrgRepository;
  eventBus: EventBus;
}

export interface DelegationServiceDeps {
  db: DbClient;
  orgRepository: OrgRepository;
  eventBus: EventBus;
}

export interface OrgService {
  resolveCurrentHolder(positionId: string, asOf?: Date): Promise<UserSummary | null>;
  getOfficeById(officeId: string): Promise<OfficeSummary | null>;
  getOfficeHierarchy(): Promise<OfficeTree>;
  getEmployeeByUserId(userId: string): Promise<EmployeeSummary | null>;
  getPrimaryOfficeForUser(userId: string): Promise<{ officeId: string; officeCode: string } | null>;
  getCommitteeIdsForUser(userId: string): Promise<string[]>;
}

export interface DelegationService {
  getActiveDelegationForUser(userId: string): Promise<DelegationSummary | null>;
  getDelegationGrantById(delegationGrantId: string): Promise<{ scope: { roles: string[]; officeIds: string[]; actions: string[] } } | null>;
}

declare module 'fastify' {
  interface FastifyInstance {
    organizationService: ReturnType<typeof import('./organization.service.js').createOrgService>;
  }
}
