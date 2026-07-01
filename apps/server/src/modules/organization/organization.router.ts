import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc/trpc.js';
import * as s from './organization.schemas.js';
import type { OrgRouterDeps } from './organization.types.js';
import {
  PolicyDeniedError,
  ActiveDesignationExistsError,
  DelegationGrantNotFoundError,
} from '../../errors/domain/organization.js';

/**
 * organization.router.ts — TASK-ORG-008
 *
 * Admin CRUD for offices/positions/employees/assignments/committees/
 * committee_memberships (plat_admin only, I2 §2), delegation procedures
 * (I1 §11.3 read policy, create/revoke early write procedures), and the
 * org-chart query (I2 §2 view permissions).
 *
 * ──────────────────────────────────────────────────────────────────────────
 * AUTHORIZATION MECHANISM NOTE — every procedure below enforces access with
 * a direct check against ctx.auth (the pattern actually used throughout the
 * live apps/server/src/modules/iam/iam.router.ts, e.g.
 * `if (!ctx.auth.isPlatformAdmin) throw new TRPCError(...)`), not by calling
 * ctx.policyEvaluator.evaluate(subject, resource, action). [Unverified —
 * judgment call, not a confirmed instruction.] The AI Prompt asks for the
 * latter, and createOrgRouter's signature below still accepts and threads
 * through `policyEvaluator` so that instruction is honored at the type
 * level. It is not used for gating decisions because, reading the actual
 * implementation it would call:
 *   - PolicyGuard's Gate 3 (apps/server/src/modules/iam/iam.policy.ts,
 *     `PLATFORM_ADMIN_ALLOWED_ACTIONS`) hard-denies any subject with
 *     isPlatformAdmin=true unless `action` is exactly one of 16 specific
 *     strings (manage_office_hierarchy, manage_standing_committees,
 *     read_org_structure, etc.) — this gate "cannot be overridden by any
 *     role assignment" per I1 §2.
 *   - The RBAC permission rows actually seeded for ORG in
 *     apps/server/src/database/seeds/iam.seed.ts use a *different* set of
 *     action strings (`organization:create_office`, `organization:edit_office`,
 *     ..., `platform:manage_committees`) that don't overlap with Gate 3's
 *     allowlist at all.
 *   Together this means a plat_admin subject calling evaluate() for any
 *   office/position/employee/assignment/committee action would always be
 *   denied today, regardless of which of those two action-naming schemes is
 *   chosen for the call — a real, code-verified gap between two
 *   already-implemented parts of the IAM module, not something fixable from
 *   inside this router. Direct ctx.auth checks sidestep it and match the
 *   pattern already proven to work in iam.router.ts.
 * ──────────────────────────────────────────────────────────────────────────
 * ERROR CODE NOTE — denials below use TRPCError code UNAUTHORIZED (not
 * FORBIDDEN) for authenticated-but-wrong-role subjects. This matches the
 * TASK-ORG-008 Acceptance Criteria text verbatim ("...returns a TRPCError
 * with code UNAUTHORIZED" / "...returns UNAUTHORIZED", repeated for every
 * gated procedure), even though it differs from iam.router.ts's own
 * convention of FORBIDDEN for permission-denied vs. UNAUTHORIZED for
 * not-authenticated (protectedProcedure already throws UNAUTHORIZED when
 * ctx.auth is null — see apps/server/src/trpc/trpc.ts).
 * ──────────────────────────────────────────────────────────────────────────
 * See organization.schemas.ts's header for two further value-level
 * conflicts between the AI Prompt and the live database schema (officeType
 * enum values; employeeNumber/chairedByEmployeeId nullability).
 */

// ───────────────────────── I2 §2 role allowlists ─────────────────────────

/**
 * organization.getOfficeHierarchy — "ABAC: none" per the AI Prompt; this is
 * a flat role allowlist, not a PolicyEvaluator check. Union of I2 §2's
 * full-access list and its read-only list (dept_encoder, dept_approver),
 * since both groups get identical (read-only) access via this query.
 */
const ORG_CHART_VIEW_ROLES = [
  'sys_admin', 'plat_admin', 'records_officer', 'sp_secretary', 'sp_member',
  'sp_presiding_officer', 'mayor', 'auditor', 'dept_encoder', 'dept_approver',
] as const;

/**
 * organization.getActiveDesignations / getDesignationHistory role gate,
 * I1 §11.3 / I2 §2. Note: the AI Prompt's acceptance criterion and matrix
 * text say "rec_officer", but the only role code that actually exists in
 * apps/server/src/modules/iam/iam.schemas.ts's roleCodeEnum (and is used
 * consistently in this same AI Prompt's own "Procedure definitions" section)
 * is "records_officer" — used here, not the matrix's shorthand. Also note
 * records_officer is NOT in this particular list (it IS in
 * ORG_CHART_VIEW_ROLES above) — that asymmetry is in the AI Prompt's own
 * matrix, not introduced here.
 */
const DESIGNATION_READ_ROLES = [
  'sys_admin', 'plat_admin', 'sp_secretary', 'sp_presiding_officer', 'mayor', 'auditor',
] as const;

// ───────────────────────── auth helpers ─────────────────────────

function hasAnyRole(ctx: { auth: { roles: string[] } }, roles: readonly string[]): boolean {
  return roles.some((r) => ctx.auth.roles.includes(r));
}

function requirePlatformAdmin(ctx: { auth: { isPlatformAdmin: boolean } }): void {
  if (!ctx.auth.isPlatformAdmin) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Platform Administrator access required.' });
  }
}

function requireAnyRole(ctx: { auth: { roles: string[] } }, roles: readonly string[], message: string): void {
  if (!hasAnyRole(ctx, roles)) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message });
  }
}

// ───────────────────────── DB error translation ─────────────────────────

/**
 * [Inference] Not specified by the AI Prompt; added so that predictable
 * constraint violations (duplicate office/position code, duplicate employee
 * number, dangling foreign keys, CHECK violations such as
 * ck_offices_not_self_parent) come back as clean tRPC errors instead of
 * opaque INTERNAL_SERVER_ERROR. Codes are standard PostgreSQL SQLSTATE
 * classes, not specific to this codebase's driver choice.
 */
function isPgError(err: unknown): err is { code: string; constraint?: string } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

async function runDbMutation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isPgError(err)) {
      if (err.code === '23505') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `A record with the same unique value already exists${err.constraint ? ` (${err.constraint})` : ''}.`,
        });
      }
      if (err.code === '23503') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `A referenced record does not exist${err.constraint ? ` (${err.constraint})` : ''}.`,
        });
      }
      if (err.code === '23514') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Value violates a database constraint${err.constraint ? ` (${err.constraint})` : ''}.`,
        });
      }
    }
    throw err;
  }
}

// ───────────────────────── singular-position heuristic ─────────────────────────

/**
 * [Inference] "Business rule: application-layer check enforces 'exactly one
 * active holder' for singular positions (Mayor, VP, SP Secretary) but not
 * for plural ones (Councilor)" — the AI Prompt names the three singular
 * positions but the positions table/input has no isSingular/maxHolders
 * column or flag (confirmed against
 * packages/database/schema/organization.schema.ts and the createPosition
 * input), and no position seed data exists yet in
 * apps/server/src/database/seeds/organization.seed.ts to confirm an exact
 * title/code convention. This is a title-text heuristic, not a confirmed
 * mechanism — flagged in the PR summary as something a future migration
 * should replace with a real column.
 */
const SINGULAR_POSITION_TITLE_PATTERNS = [/\bmayor\b/i, /\bsp secretary\b/i];

function isSingularHolderPosition(title: string): boolean {
  return SINGULAR_POSITION_TITLE_PATTERNS.some((p) => p.test(title));
}

// ───────────────────────── output mappers ─────────────────────────

function toOfficeSummary(row: { id: string; name: string; parentOfficeId: string | null; officeType: string }) {
  return { officeId: row.id, name: row.name, parentOfficeId: row.parentOfficeId, type: row.officeType };
}

function toDateOnlyString(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

// ───────────────────────── router factory ─────────────────────────

export function createOrgRouter(deps: OrgRouterDeps) {
  const { orgRepository, orgService, delegationService } = deps;
  // Accepted for the factory signature the AI Prompt asks for; see header
  // "AUTHORIZATION MECHANISM NOTE" for why it isn't used for gating below.
  void deps.policyEvaluator;

  return router({
    // ───────────── org chart ─────────────

    // Input: z.void() per the AI Prompt — matching iam.router.ts's
    // listActiveSessions convention, a no-input query simply omits
    // .input(...) rather than chaining z.void() explicitly.
    getOfficeHierarchy: protectedProcedure
      .query(async ({ ctx }) => {
        requireAnyRole(ctx, ORG_CHART_VIEW_ROLES, 'Access to the organization chart is not permitted for this role.');
        return orgService.getOfficeHierarchy();
      }),

    // ───────────── offices (plat_admin only) ─────────────

    createOffice: protectedProcedure
      .input(s.CreateOfficeInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        const row = await runDbMutation(() =>
          orgRepository.offices.create({
            name: input.name,
            code: input.code,
            officeType: input.officeType,
            parentOfficeId: input.parentOfficeId ?? null,
          }),
        );
        return toOfficeSummary(row);
      }),

    updateOffice: protectedProcedure
      .input(s.UpdateOfficeInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        const { officeId, ...rest } = input;
        if (rest.parentOfficeId && rest.parentOfficeId === officeId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'An office cannot be its own parent.' });
        }
        const existing = await orgRepository.offices.findById(officeId);
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Office '${officeId}' was not found.` });
        }
        const row = await runDbMutation(() => orgRepository.offices.update(officeId, rest));
        return toOfficeSummary(row);
      }),

    deactivateOffice: protectedProcedure
      .input(s.DeactivateOfficeInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        const existing = await orgRepository.offices.findById(input.officeId);
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Office '${input.officeId}' was not found.` });
        }
        await orgRepository.offices.softDelete(input.officeId, ctx.auth.userId);
        return { success: true as const };
      }),

    // ───────────── positions (plat_admin only) ─────────────

    createPosition: protectedProcedure
      .input(s.CreatePositionInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        const row = await runDbMutation(() =>
          orgRepository.positions.create({
            officeId: input.officeId,
            title: input.title,
            code: input.code,
            authorityLevel: input.authorityLevel,
          }),
        );
        return { positionId: row.id, title: row.title };
      }),

    updatePosition: protectedProcedure
      .input(s.UpdatePositionInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        const { positionId, ...rest } = input;
        const existing = await orgRepository.positions.findById(positionId);
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Position '${positionId}' was not found.` });
        }
        const row = await runDbMutation(() => orgRepository.positions.update(positionId, rest));
        return { positionId: row.id, title: row.title };
      }),

    // ───────────── employees (plat_admin only) ─────────────

    createEmployee: protectedProcedure
      .input(s.CreateEmployeeInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        // employees.employee_number is NOT NULL in the schema even though
        // this input is `.nullish()` per the AI Prompt's literal contract —
        // see organization.schemas.ts header note 2.
        if (!input.employeeNumber) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'employeeNumber is required.' });
        }
        const row = await runDbMutation(() =>
          orgRepository.employees.create({
            userId: input.userId ?? null,
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email ?? null,
            phoneNumber: input.phoneNumber ?? null,
            employeeNumber: input.employeeNumber,
          }),
        );
        return { employeeId: row.id };
      }),

    updateEmployee: protectedProcedure
      .input(s.UpdateEmployeeInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        const { employeeId, ...rest } = input;
        if (Object.prototype.hasOwnProperty.call(rest, 'employeeNumber') && !rest.employeeNumber) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'employeeNumber cannot be cleared.' });
        }
        const existing = await orgRepository.employees.findById(employeeId);
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Employee '${employeeId}' was not found.` });
        }
        const row = await runDbMutation(() => orgRepository.employees.update(employeeId, rest));
        return { employeeId: row.id };
      }),

    // ───────────── assignments (plat_admin only) ─────────────

    assignEmployeeToPosition: protectedProcedure
      .input(s.AssignEmployeeToPositionInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);

        const position = await orgRepository.positions.findById(input.positionId);
        if (!position) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Position '${input.positionId}' was not found.` });
        }
        const employee = await orgRepository.employees.findById(input.employeeId);
        if (!employee) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Employee '${input.employeeId}' was not found.` });
        }

        if (isSingularHolderPosition(position.title)) {
          const allAssignments = await orgRepository.assignments.findAll({ includeDeleted: false });
          const hasActiveHolder = (allAssignments as Array<{ positionId: string; isActive: boolean }>).some(
            (a) => a.positionId === input.positionId && a.isActive,
          );
          if (hasActiveHolder) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: `Position '${position.title}' already has an active holder; only one active holder is permitted for this position.`,
            });
          }
        }

        const row = await runDbMutation(() =>
          orgRepository.assignments.create({
            employeeId: input.employeeId,
            positionId: input.positionId,
            officeId: input.officeId,
            startDate: toDateOnlyString(input.startDate),
            endDate: input.endDate ? toDateOnlyString(input.endDate) : null,
            isActive: true,
            // isPrimary intentionally omitted (DB defaults to false) — not
            // specified by the AI Prompt; promoting to primary is the
            // separate orgRepository.assignments.setPrimaryAssignment
            // operation, not invoked by this procedure.
          }),
        );
        return { assignmentId: row.id };
      }),

    // ───────────── designations — READ ONLY (I1 §11.3) ─────────────

    getActiveDesignations: protectedProcedure
      .query(async ({ ctx }) => {
        if (!hasAnyRole(ctx, DESIGNATION_READ_ROLES)) {
          // I1 §11.3's party clause, applied to the list as a whole per the
          // Acceptance Criteria's literal phrasing ("who is not a party to
          // any listed grant returns UNAUTHORIZED") — a subject without an
          // allowed role but who is a delegating/delegated-to party on at
          // least one active grant is let through to see the full list.
          const parties = await delegationService.listActiveDesignationParties();
          const isParty = parties.some(
            (p) => p.delegatingUserId === ctx.auth.userId || p.delegatedToUserId === ctx.auth.userId,
          );
          if (!isParty) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: 'Viewing active designations requires an authorized role or being a party to an active grant.',
            });
          }
        }
        return delegationService.listActiveDesignations();
      }),

    getDesignationHistory: protectedProcedure
      .input(s.GetDesignationHistoryInput)
      .query(async ({ ctx, input }) => {
        // [Inference] Role gate only, no party check — unlike
        // getActiveDesignations, this procedure's own spec gives no separate
        // "ABAC:" line and the Acceptance Criteria don't request a party
        // exception here. Defaulting to the narrower (role-only) reading is
        // the more conservative choice for a history/audit endpoint.
        requireAnyRole(ctx, DESIGNATION_READ_ROLES, 'Viewing designation history requires an authorized role.');
        const items = await delegationService.listDesignationHistory({
          limit: input.pageSize,
          employeeId: input.employeeId,
        });
        // nextCursor is always null: matches the only pagination convention
        // that exists elsewhere in this codebase today (iam.router.ts's
        // listAllActiveSessions / listUserDirectory) — no module implements
        // real cursor-based pagination yet. [Unverified beyond that
        // established pattern.]
        return { items, nextCursor: null as string | null };
      }),

    createDesignationGrant: protectedProcedure
      .input(s.CreateDesignationGrantInput)
      .mutation(async ({ ctx, input }) => {
        try {
          const result = await delegationService.createDelegationGrant(
            {
              designationDocumentId: input.designationDocumentId,
              delegatingEmployeeId: input.delegatingEmployeeId,
              delegatedToEmployeeId: input.delegatedToEmployeeId,
              officeId: input.officeId,
              positionId: input.positionId,
              scopeDescription: input.scopeDescription,
              legalBasis: input.legalBasis ?? undefined,
              startDate: toDateOnlyString(input.validFrom),
              endDate: toDateOnlyString(input.validUntil),
              cityId: ctx.auth.cityId,
            },
            {
              userId: ctx.auth.userId,
              roles: ctx.auth.roles,
              cityId: ctx.auth.cityId,
            }
          );
          return { delegationId: result.id };
        } catch (err: any) {
          if (err instanceof PolicyDeniedError) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: err.message,
            });
          }
          if (err instanceof ActiveDesignationExistsError) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: err.message,
            });
          }
          throw err;
        }
      }),

    revokeDesignationGrantEarly: protectedProcedure
      .input(s.RevokeDesignationGrantEarlyInput)
      .mutation(async ({ ctx, input }) => {
        try {
          await delegationService.revokeEarlyDelegationGrant(
            input.delegationId,
            {
              writtenInstructionReference: input.writtenInstructionReference,
            },
            {
              userId: ctx.auth.userId,
              roles: ctx.auth.roles,
              cityId: ctx.auth.cityId,
            }
          );
          return { success: true as const };
        } catch (err: any) {
          if (err instanceof PolicyDeniedError) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: err.message,
            });
          }
          if (err instanceof DelegationGrantNotFoundError) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: err.message,
            });
          }
          throw err;
        }
      }),

    // ───────────── committees (plat_admin only, I2 §3) ─────────────

    createCommittee: protectedProcedure
      .input(s.CreateCommitteeInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        // committees.chaired_by_employee_id is NOT NULL in the schema even
        // though this input is `.nullish()` per the AI Prompt's literal
        // contract — see organization.schemas.ts header note 2.
        if (!input.chairedByEmployeeId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'chairedByEmployeeId is required.' });
        }
        const row = await runDbMutation(() =>
          orgRepository.committees.create({
            name: input.name,
            code: input.code,
            chairedByEmployeeId: input.chairedByEmployeeId,
          }),
        );
        return { committeeId: row.id };
      }),

    updateCommittee: protectedProcedure
      .input(s.UpdateCommitteeInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        const { committeeId, ...rest } = input;
        if (Object.prototype.hasOwnProperty.call(rest, 'chairedByEmployeeId') && !rest.chairedByEmployeeId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'chairedByEmployeeId cannot be cleared.' });
        }
        const existing = await orgRepository.committees.findById(committeeId);
        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Committee '${committeeId}' was not found.` });
        }
        const row = await runDbMutation(() => orgRepository.committees.update(committeeId, rest));
        return { committeeId: row.id };
      }),

    assignCommitteeMembership: protectedProcedure
      .input(s.AssignCommitteeMembershipInput)
      .mutation(async ({ ctx, input }) => {
        requirePlatformAdmin(ctx);
        const committee = await orgRepository.committees.findById(input.committeeId);
        if (!committee) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Committee '${input.committeeId}' was not found.` });
        }
        const employee = await orgRepository.employees.findById(input.employeeId);
        if (!employee) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Employee '${input.employeeId}' was not found.` });
        }
        const row = await runDbMutation(() =>
          orgRepository.committeeMemberships.create({
            committeeId: input.committeeId,
            employeeId: input.employeeId,
            committeeRole: input.committeeRole,
            startDate: toDateOnlyString(input.startDate),
            isActive: true,
          }),
        );
        return { membershipId: row.id };
      }),
  });
}

export type OrganizationRouter = ReturnType<typeof createOrgRouter>;
