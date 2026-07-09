import type { AppDb } from '../../db.js';
import type { EventBus } from '@batac/shared';
import type { InferSelectModel } from 'drizzle-orm';
import type { AuditPublicAPI } from '../audit/index.js';
import type { PolicyEvaluator } from '../iam/iam.policy.js';
import type PgBoss from 'pg-boss';
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

/**
 * Input shape for creating a delegation grant.
 * Source: TASK-ORG-005 AI Prompt; org schema DDL (TASK-ORG-001).
 */
export interface CreateDelegationGrantInput {
  /** employee_id of the delegating authority (Mayor or Vice Mayor) */
  delegatingEmployeeId: string;
  /** employee_id of the person receiving the delegation */
  delegatedToEmployeeId: string;
  /** office the delegation covers */
  officeId: string;
  /** position being delegated */
  positionId: string;
  /**
   * Designation document that triggered the grant.
   * Required (non-empty UUID) as the proxy for "received and logged" (I1 §11.1).
   * Full document existence is NOT validated here — documents schema is added in a later wave.
   */
  designationDocumentId: string;
  /** Human-readable scope description */
  scopeDescription: string;
  /** JSONB scope: roles, office_ids, actions the delegatee may exercise */
  scope?: {
    roles: string[];
    officeIds: string[];
    actions: string[];
  };
  legalBasis?: string;
  /** ISO date string YYYY-MM-DD */
  startDate: string;
  /** ISO date string YYYY-MM-DD. Open-ended delegations are prohibited. */
  endDate: string;
  cityId: string;
}

export interface RevokeEarlyDelegationGrantInput {
  /** 
   * Reference to the formal written instruction from the delegating authority.
   * Required if the subject is sp_secretary and not the delegating authority.
   */
  writtenInstructionReference?: string;
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
  auditService: AuditPublicAPI;
  policyEvaluator: PolicyEvaluator;
  boss: PgBoss;
}

/** Subject context passed to service write methods (subset of AuthContext). */
export interface DelegationSubject {
  userId: string;
  roles: string[];
  cityId: string;
}

export interface OrgService {
  resolveCurrentHolder(positionId: string, asOf?: Date): Promise<UserSummary | null>;
  getOfficeById(officeId: string): Promise<OfficeSummary | null>;
  /**
   * [Inference — TASK-DOCS-011] Added because documents.router.ts (general
   * CRUD) needs to resolve the SP Secretariat office by its office code
   * ('SPS') rather than a hardcoded UUID, matching the lookup-by-code
   * pattern already used in apps/server/src/database/seeds/number-series.seed.ts.
   * No prior public API method covered this (getOfficeById needs an id you
   * don't have yet; getOfficeHierarchy doesn't expose `code`). The documents
   * module must not query organization.offices directly (see the "no
   * cross-schema joins" contract in documents.repository.ts), so this is
   * exposed here instead.
   */
  getOfficeByCode(code: string, cityId: string): Promise<OfficeSummary | null>;
  getOfficeHierarchy(): Promise<OfficeTree>;
  getEmployeeByUserId(userId: string): Promise<EmployeeSummary | null>;
  getPrimaryOfficeForUser(userId: string): Promise<{ officeId: string; officeCode: string } | null>;
  getCommitteeIdsForUser(userId: string): Promise<string[]>;
}

export interface DesignationView {
  delegationId: string;
  designationDocumentId: string;
  delegatingUserId: string;
  delegatingDisplayName: string;
  delegatedToUserId: string;
  delegatedToDisplayName: string;
  officeId: string;
  positionTitle: string;
  validFrom: Date;
  validUntil: Date;
}

export interface DesignationHistoryItem {
  delegationId: string;
  designationDocumentId: string;
  delegatingDisplayName: string;
  delegatedToDisplayName: string;
  positionTitle: string;
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;
  revokedAt: Date | null;
}

export interface DesignationParty {
  delegatingUserId: string;
  delegatedToUserId: string;
}

export interface DelegationService {
  getActiveDelegationForUser(userId: string): Promise<DelegationSummary | null>;
  getDelegationGrantById(delegationGrantId: string): Promise<{ scope: { roles: string[]; officeIds: string[]; actions: string[] } } | null>;

  /**
   * Create a delegation grant.
   *
   * Enforces:
   *   - I1 §11.1 ABAC policy: subject must hold the `sp_secretary` role
   *   - Invariant #16: at most one active delegation per delegatee
   *
   * After a successful insert:
   *   - Emits `delegation.granted` on the event bus
   *   - Writes a `delegation_grant.created` audit event via auditService
   *
   * Source: TASK-ORG-005.
   *
   * [Inference] `trx` is an optional caller-supplied transaction handle,
   * added to support TASK-DOCS-018's cross-module atomicity requirement
   * (see docs/development-findings-log.md). When supplied, the Invariant
   * #16 pre-check and the grant INSERT run against `trx` instead of
   * `deps.db`/`deps.orgRepository`, so this call can be composed into an
   * outer transaction (e.g. one that also transitions a DESIGNATION
   * document's lifecycle state).
   *
   * KNOWN LIMITATION, not fixed by this parameter: the `delegation.granted`
   * event-bus emission and the `delegation_grant.created` audit write are
   * NOT transactional even when `trx` is supplied — EventBus.emit is a
   * synchronous in-process dispatch with no transaction participation, and
   * AuditWriteService.writeEvent opens its own separate internal
   * transaction. If a later step in the outer transaction fails and rolls
   * back, an already-fired event or already-committed audit row describing
   * the (now rolled-back) grant is not undone. This is a pre-existing
   * property of this method's Steps 6–7, not something introduced or
   * corrected by the `trx` parameter. See docs/development-findings-log.md.
   */
  createDelegationGrant(
    input: CreateDelegationGrantInput,
    subject: DelegationSubject,
    trx?: DbTransaction,
  ): Promise<DelegationGrantRow>;

  /**
   * Revoke a delegation grant early.
   *
   * Enforces:
   *   - I1 §11.2 ABAC policy: subject must be the delegating authority OR
   *     have the `sp_secretary` role AND a `writtenInstructionReference`.
   *
   * After a successful update:
   *   - Emits `delegation.revoked` on the event bus
   *   - Writes a `delegation_grant.revoked_early` audit event via auditService
   *
   * Source: TASK-ORG-006.
   *
   * [Inference] `trx` is an optional caller-supplied transaction handle,
   * same rationale and same known limitation (event/audit side effects are
   * not transactional) as documented on createDelegationGrant above.
   */
  revokeEarlyDelegationGrant(
    grantId: string,
    input: RevokeEarlyDelegationGrantInput,
    subject: DelegationSubject,
    trx?: DbTransaction,
  ): Promise<DelegationGrantRow>;
  listActiveDesignations(): Promise<DesignationView[]>;
  listDesignationHistory(opts: {
    limit: number;
    employeeId?: string;
  }): Promise<DesignationHistoryItem[]>;
  listActiveDesignationParties(): Promise<DesignationParty[]>;
}

/**
 * Dependencies for organization.router.ts's createOrgRouter(ctx) factory.
 * policyEvaluator is accepted here and threaded through so the signature
 * matches the AI Prompt instruction; see organization.router.ts header for
 * why the router uses direct ctx.auth checks instead of evaluate() calls.
 */
export interface OrgRouterDeps {
  orgRepository: OrgRepository;
  orgService: OrgService;
  delegationService: DelegationService;
  policyEvaluator: import('../iam/index.js').PolicyEvaluator;
}

declare module 'fastify' {
  interface FastifyInstance {
    orgRepository: ReturnType<typeof import('./organization.repository.js').createOrgRepository>;
    organizationService: ReturnType<typeof import('./organization.service.js').createOrgService>;
    delegationService: ReturnType<typeof import('./delegation.service.js').createDelegationService>;
    orgTrpcRouter: ReturnType<typeof import('./organization.router.js').createOrgRouter>;
  }
}
