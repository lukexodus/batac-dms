import { randomUUID } from 'node:crypto';
import type {
  DelegationService,
  DelegationServiceDeps,
  DelegationSummary,
  CreateDelegationGrantInput,
  RevokeEarlyDelegationGrantInput,
  DelegationSubject,
  DelegationGrantRow,
  DesignationView,
  DesignationHistoryItem,
  DesignationParty,
} from './organization.types.js';
import { eq, and, or, isNull, lte, gte, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  employees,
  delegationGrants,
  positions,
} from '@batac/database/schema/organization.schema.js';
import {
  PolicyDeniedError,
  ActiveDesignationExistsError,
  DelegationGrantNotFoundError,
} from '../../errors/domain/organization.js';

export function createDelegationService(deps: DelegationServiceDeps): DelegationService {
  return {
    // ── Read methods ───────────────────────────────────────────────────────────

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

    // ── Write methods ──────────────────────────────────────────────────────────

    /**
     * Create a delegation grant.
     *
     * Enforcement order (I1 §11.1; TASK-ORG-005):
     *   1. ABAC gate via PolicyEvaluator — requires 'sp_secretary' role
     *   2. designationDocumentId presence — proxy for "received and logged"
     *   3. Invariant #16 pre-check — no existing active grant for same delegatee
     *   4. INSERT via repository
     *   5. Emit delegation.granted on event bus
     *   6. Write delegation_grant.created audit event
     */
    async createDelegationGrant(
      input: CreateDelegationGrantInput,
      subject: DelegationSubject,
    ): Promise<DelegationGrantRow> {
      // ── Step 1: ABAC evaluation (I1 §11.1) ────────────────────────────────
      //
      // We synthesise a minimal SubjectContext for PolicyEvaluator. The gate
      // only checks role membership; remaining fields not relevant to this gate
      // are set to safe defaults.
      const policySubject = {
        userId:             subject.userId,
        sessionId:          '',
        officeId:           null,
        cityId:             subject.cityId,
        roles:              subject.roles,
        permissions:        ['delegation_grant:create'], // RBAC pre-checked: the caller holds this route
        committeeIds:       [],
        delegationGrantId:  null,
        effectiveOfficeIds: [],
        effectiveRoles:     subject.roles,
        isItAdmin:          false,
        isPlatformAdmin:    false,
      };

      const policyResource = {
        type:   'delegation_grant',
        id:     'new',
        cityId: subject.cityId,
      };

      const evaluation = await deps.policyEvaluator.evaluate(
        policySubject,
        policyResource,
        'create',
      );

      if (!evaluation.allowed) {
        throw new PolicyDeniedError({
          reason: evaluation.reason,
          action:  'delegation_grant:create',
        });
      }

      // ── Step 2: Designation document presence check ─────────────────────────
      if (!input.designationDocumentId || input.designationDocumentId.trim() === '') {
        throw new PolicyDeniedError({
          reason: 'designation_document_id_required',
          action: 'delegation_grant:create',
        });
      }

      // ── Step 3: Invariant #16 pre-check ────────────────────────────────────
      // Application-layer guard before the DB unique index fires.
      const existing = await deps.db
        .select({ id: delegationGrants.id })
        .from(delegationGrants)
        .where(and(
          eq(delegationGrants.delegatedToEmployeeId, input.delegatedToEmployeeId),
          eq(delegationGrants.isActive, true),
          isNull(delegationGrants.deletedAt),
        ))
        .limit(1);

      if (existing.length > 0) {
        throw new ActiveDesignationExistsError({
          delegatedToEmployeeId: input.delegatedToEmployeeId,
        });
      }

      // ── Step 4: INSERT ─────────────────────────────────────────────────────
      const grant = await deps.orgRepository.delegationGrants.create({
        cityId:                 input.cityId,
        delegatingEmployeeId:   input.delegatingEmployeeId,
        delegatedToEmployeeId:  input.delegatedToEmployeeId,
        officeId:               input.officeId,
        positionId:             input.positionId,
        designationDocumentId:  input.designationDocumentId,
        scopeDescription:       input.scopeDescription,
        scope: input.scope ?? { roles: [], officeIds: [], actions: [] },
        legalBasis: input.legalBasis ?? null,
        startDate:  input.startDate,
        endDate:    input.endDate,
        isActive:   true,
      }) as DelegationGrantRow;

      // ── Step 5: Resolve employee → user IDs for the event payload ───────────
      const delegatorEmp = alias(employees, 'delegator_emp');
      const delegateeEmp = alias(employees, 'delegatee_emp');

      const [empRow] = await deps.db
        .select({
          delegatingUserId:  delegatorEmp.userId,
          delegatedToUserId: delegateeEmp.userId,
        })
        .from(delegatorEmp)
        .innerJoin(delegateeEmp, eq(
          delegateeEmp.id, input.delegatedToEmployeeId
        ))
        .where(eq(delegatorEmp.id, input.delegatingEmployeeId))
        .limit(1);

      const delegatingUserId  = empRow?.delegatingUserId  ?? '';
      const delegatedToUserId = empRow?.delegatedToUserId ?? '';

      // ── Step 6: Emit delegation.granted domain event ────────────────────────
      deps.eventBus.emit('delegation.granted', {
        eventId:       randomUUID(),
        eventType:     'delegation.granted',
        occurredAt:    new Date().toISOString(),
        cityId:        input.cityId,
        schemaVersion: 1,
        payload: {
          delegationId:           grant.id,
          designationDocumentId:  grant.designationDocumentId,
          delegatingUserId,
          delegatedToUserId,
          // grantorId maps to actorId field read by audit.event-consumer.ts
          grantorId:  subject.userId,
          scope: {
            officeId:   grant.officeId,
            positionId: grant.positionId,
          },
          validFrom:   grant.startDate,
          validUntil:  grant.endDate,
        },
      });

      // ── Step 7: Write audit event directly ─────────────────────────────────
      // Direct call approved by AuditPublicAPI docs for callers that need
      // atomicity guarantees between their write and the audit record.
      // Source: TASK-ORG-005 AI Prompt; audit/index.ts AuditPublicAPI comment.
      await deps.auditService.writeEvent({
        eventType:        'delegation_grant.created',
        actorId:          subject.userId,
        targetId:         grant.id,
        targetType:       'delegation_grant',
        resourceOfficeId: null, // cross-office grants have no single owning office
        payload: {
          delegationId:          grant.id,
          designationDocumentId: grant.designationDocumentId,
          delegatingEmployeeId:  grant.delegatingEmployeeId,
          delegatedToEmployeeId: grant.delegatedToEmployeeId,
          officeId:              grant.officeId,
          positionId:            grant.positionId,
          startDate:             grant.startDate,
          endDate:               grant.endDate,
        },
        cityId: input.cityId,
      });

      return grant;
    },

    async revokeEarlyDelegationGrant(
      grantId: string,
      input: RevokeEarlyDelegationGrantInput,
      subject: DelegationSubject,
    ): Promise<DelegationGrantRow> {
      const db = deps.db;
      const delegatorEmp = alias(employees, 'delegator_emp');
      const delegateeEmp = alias(employees, 'delegatee_emp');

      const rows = await db.select({
        grant: delegationGrants,
        delegatingUserId: delegatorEmp.userId,
        delegatedToUserId: delegateeEmp.userId,
      })
      .from(delegationGrants)
      .innerJoin(delegatorEmp, eq(delegationGrants.delegatingEmployeeId, delegatorEmp.id))
      .innerJoin(delegateeEmp, eq(delegationGrants.delegatedToEmployeeId, delegateeEmp.id))
      .where(eq(delegationGrants.id, grantId))
      .limit(1);

      if (rows.length === 0) {
        throw new DelegationGrantNotFoundError({ grantId });
      }

      const row = rows[0]!;
      const grant = row.grant;

      if (!grant.isActive || grant.deletedAt || grant.revokedAt) {
        // Idempotent or already revoked/inactive
        throw new PolicyDeniedError({
          reason: 'delegation_grant_not_active',
          action: 'delegation_grant:revoke_early',
        });
      }

      // Step 1: ABAC evaluation
      const policySubject = {
        userId: subject.userId,
        sessionId: '',
        officeId: null,
        cityId: subject.cityId,
        roles: subject.roles,
        permissions: ['delegation_grant:revoke_early'], // RBAC pre-checked
        committeeIds: [],
        delegationGrantId: null,
        effectiveOfficeIds: [],
        effectiveRoles: subject.roles,
        isItAdmin: false,
        isPlatformAdmin: false,
      };

      const policyResource = {
        type: 'delegation_grant',
        id: grant.id,
        cityId: grant.cityId,
        delegatingUserId: row.delegatingUserId, // For the handler to check
      };

      const evaluation = await deps.policyEvaluator.evaluate(
        policySubject,
        policyResource,
        'revoke_early',
        { writtenInstructionReference: input.writtenInstructionReference }
      );

      if (!evaluation.allowed) {
        throw new PolicyDeniedError({
          reason: evaluation.reason,
          action: 'delegation_grant:revoke_early',
        });
      }

      const now = new Date();

      // Step 2: UPDATE
      const [updatedGrant] = await db.update(delegationGrants)
        .set({
          isActive: false,
          revokedAt: now,
          revokedBy: subject.userId,
          updatedAt: now,
        })
        .where(eq(delegationGrants.id, grantId))
        .returning();

      // Step 3: Emit delegation.revoked domain event
      deps.eventBus.emit('delegation.revoked', {
        eventId: randomUUID(),
        eventType: 'delegation.revoked',
        occurredAt: now.toISOString(),
        cityId: grant.cityId,
        schemaVersion: 1,
        payload: {
          delegationId: grant.id,
          delegatingUserId: row.delegatingUserId || '',
          delegatedToUserId: row.delegatedToUserId || '',
          revokedBy: subject.userId,
          revokedAt: now,
        },
      });

      // Step 4: Write audit event directly
      await deps.auditService.writeEvent({
        eventType: 'delegation_grant.revoked_early',
        actorId: subject.userId,
        targetId: grant.id,
        targetType: 'delegation_grant',
        resourceOfficeId: grant.officeId, // cross-office grants have no single owning office
        payload: {
          delegationId: grant.id,
          designationDocumentId: grant.designationDocumentId,
          writtenInstructionReference: input.writtenInstructionReference,
          delegatingEmployeeId: grant.delegatingEmployeeId,
          delegatedToEmployeeId: grant.delegatedToEmployeeId,
          officeId: grant.officeId,
          positionId: grant.positionId,
          revokedAt: now.toISOString(),
          revokedBy: subject.userId,
        },
        cityId: grant.cityId,
      });

      return updatedGrant as DelegationGrantRow;
    },

    async listActiveDesignations(): Promise<DesignationView[]> {
      const db = deps.db;
      const delegatorEmp = alias(employees, 'delegator_emp');
      const delegateeEmp = alias(employees, 'delegatee_emp');

      const rows = await db.select({
        id: delegationGrants.id,
        designationDocumentId: delegationGrants.designationDocumentId,
        officeId: delegationGrants.officeId,
        startDate: delegationGrants.startDate,
        endDate: delegationGrants.endDate,
        delegatingUserId: delegatorEmp.userId,
        delegatingFirstName: delegatorEmp.firstName,
        delegatingLastName: delegatorEmp.lastName,
        delegatedToUserId: delegateeEmp.userId,
        delegatedToFirstName: delegateeEmp.firstName,
        delegatedToLastName: delegateeEmp.lastName,
        positionTitle: positions.title,
      })
      .from(delegationGrants)
      .innerJoin(delegatorEmp, eq(delegationGrants.delegatingEmployeeId, delegatorEmp.id))
      .innerJoin(delegateeEmp, eq(delegationGrants.delegatedToEmployeeId, delegateeEmp.id))
      .leftJoin(positions, eq(delegationGrants.positionId, positions.id))
      .where(and(
        eq(delegationGrants.isActive, true),
        isNull(delegationGrants.revokedAt),
        isNull(delegationGrants.deletedAt),
      ))
      .orderBy(desc(delegationGrants.startDate));

      return rows.map(row => ({
        delegationId: row.id,
        designationDocumentId: row.designationDocumentId || '',
        delegatingUserId: row.delegatingUserId || '',
        delegatingDisplayName: `${row.delegatingFirstName} ${row.delegatingLastName}`,
        delegatedToUserId: row.delegatedToUserId || '',
        delegatedToDisplayName: `${row.delegatedToFirstName} ${row.delegatedToLastName}`,
        officeId: row.officeId,
        positionTitle: row.positionTitle || '',
        validFrom: new Date(row.startDate),
        validUntil: new Date(row.endDate),
      }));
    },

    async listDesignationHistory(opts: { limit: number; employeeId?: string }): Promise<DesignationHistoryItem[]> {
      const db = deps.db;
      const delegatorEmp = alias(employees, 'delegator_emp');
      const delegateeEmp = alias(employees, 'delegatee_emp');

      const conditions = [isNull(delegationGrants.deletedAt)];
      if (opts.employeeId) {
        conditions.push(or(
          eq(delegationGrants.delegatingEmployeeId, opts.employeeId),
          eq(delegationGrants.delegatedToEmployeeId, opts.employeeId),
        )!);
      }

      const rows = await db.select({
        id: delegationGrants.id,
        designationDocumentId: delegationGrants.designationDocumentId,
        startDate: delegationGrants.startDate,
        endDate: delegationGrants.endDate,
        isActive: delegationGrants.isActive,
        revokedAt: delegationGrants.revokedAt,
        delegatingFirstName: delegatorEmp.firstName,
        delegatingLastName: delegatorEmp.lastName,
        delegatedToFirstName: delegateeEmp.firstName,
        delegatedToLastName: delegateeEmp.lastName,
        positionTitle: positions.title,
      })
      .from(delegationGrants)
      .innerJoin(delegatorEmp, eq(delegationGrants.delegatingEmployeeId, delegatorEmp.id))
      .innerJoin(delegateeEmp, eq(delegationGrants.delegatedToEmployeeId, delegateeEmp.id))
      .leftJoin(positions, eq(delegationGrants.positionId, positions.id))
      .where(and(...conditions))
      .orderBy(desc(delegationGrants.startDate))
      .limit(opts.limit);

      return rows.map(row => ({
        delegationId: row.id,
        designationDocumentId: row.designationDocumentId || '',
        delegatingDisplayName: `${row.delegatingFirstName} ${row.delegatingLastName}`,
        delegatedToDisplayName: `${row.delegatedToFirstName} ${row.delegatedToLastName}`,
        positionTitle: row.positionTitle || '',
        validFrom: new Date(row.startDate),
        validUntil: new Date(row.endDate),
        isActive: row.isActive,
        revokedAt: row.revokedAt ? new Date(row.revokedAt) : null,
      }));
    },

    async listActiveDesignationParties(): Promise<DesignationParty[]> {
      const db = deps.db;
      const delegatorEmp = alias(employees, 'delegator_emp');
      const delegateeEmp = alias(employees, 'delegatee_emp');

      const rows = await db.select({
        delegatingUserId: delegatorEmp.userId,
        delegatedToUserId: delegateeEmp.userId,
      })
      .from(delegationGrants)
      .innerJoin(delegatorEmp, eq(delegationGrants.delegatingEmployeeId, delegatorEmp.id))
      .innerJoin(delegateeEmp, eq(delegationGrants.delegatedToEmployeeId, delegateeEmp.id))
      .where(and(
        eq(delegationGrants.isActive, true),
        isNull(delegationGrants.revokedAt),
        isNull(delegationGrants.deletedAt),
      ));

      return rows.map(row => ({
        delegatingUserId: row.delegatingUserId || '',
        delegatedToUserId: row.delegatedToUserId || '',
      }));
    },
  };
}
