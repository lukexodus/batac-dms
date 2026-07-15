import { z } from 'zod';
import { OfficeSummarySchema } from '@batac/shared/schemas/organization';

/**
 * organization.schemas.ts
 *
 * Zod input/output schemas for the Organization tRPC router (TASK-ORG-008).
 * Style mirrors apps/server/src/modules/iam/iam.schemas.ts.
 *
 * [Unverified] Two value-level conflicts were found between the TASK-ORG-008
 * AI Prompt text and the already-implemented codebase. Both are resolved here
 * in favor of the codebase (see PR summary for full detail and citations):
 *
 *  1. officeType — the AI Prompt's enum
 *     ['sp_office','mayors_office','city_department','barangay','other'] does not
 *     match the live `ck_offices_office_type` CHECK constraint in
 *     packages/database/schema/organization.schema.ts, the `OfficeSummary.type`
 *     comment in organization.types.ts, the already-seeded rows in
 *     organization.seed.ts, or @batac/shared's OfficeSummarySchema — all four
 *     independently agree on ('executive'|'legislative'|'department'|'barangay'
 *     |'external'). Using the AI Prompt's literal enum would let Zod-valid input
 *     fail the database CHECK constraint on every createOffice/updateOffice call,
 *     so the DB-verified set is used instead.
 *
 *  2. employeeNumber / chairedByEmployeeId — the AI Prompt marks both nullish,
 *     but `employees.employee_number` and `committees.chaired_by_employee_id`
 *     are NOT NULL in the schema (employee_number NOT NULL is documented as
 *     "Decision 3.8"). The public input shape below keeps the AI Prompt's
 *     literal `.nullish()` contract; organization.router.ts validates presence
 *     explicitly and returns a clean BAD_REQUEST rather than letting a NOT NULL
 *     violation surface as an opaque 500.
 */

// ───────────────────────── shared primitives ─────────────────────────

/**
 * No shared cross-module `paginationInput` exists yet (IAM's is module-local,
 * in apps/server/src/modules/iam/iam.schemas.ts, and is not re-exported via
 * IAM's public index.ts). Following the established per-module convention,
 * this is ORG's own local copy with an identical shape.
 */
export const paginationInput = z.object({
  cursor: z.string().nullish(),
  pageSize: z.number().int().min(1).max(100).default(20),
});

/** [Inference] DB-verified set — see file header note 1. */
export const officeTypeEnum = z.enum([
  'executive',
  'legislative',
  'department',
  'barangay',
  'external',
]);

export const authorityLevelEnum = z.enum(['executive', 'managerial', 'staff', 'support']);

export const committeeRoleEnum = z.enum(['chairman', 'vice_chairman', 'member']);

/**
 * Reuse the already-established shared schema rather than redefining a
 * parallel (and, per the AI Prompt's literal text, conflicting) one.
 */
export const officeSummaryOutput = OfficeSummarySchema;

// ───────────────────────── offices ─────────────────────────

export const CreateOfficeInput = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(32),
  officeType: officeTypeEnum,
  parentOfficeId: z.string().uuid().nullish(),
});
export type CreateOfficeInput = z.infer<typeof CreateOfficeInput>;

export const UpdateOfficeInput = z
  .object({
    officeId: z.string().uuid(),
  })
  .merge(CreateOfficeInput.partial());
export type UpdateOfficeInput = z.infer<typeof UpdateOfficeInput>;

export const DeactivateOfficeInput = z.object({
  officeId: z.string().uuid(),
});

// ───────────────────────── positions ─────────────────────────

export const CreatePositionInput = z.object({
  officeId: z.string().uuid(),
  title: z.string().min(1),
  code: z.string().min(1).max(32),
  authorityLevel: authorityLevelEnum,
});
export type CreatePositionInput = z.infer<typeof CreatePositionInput>;

/**
 * [Inference] The AI Prompt gives Input(create) only for positions and states
 * a single shared Output for the create/update pair. No separate
 * Input(update) is given. Following the literal pattern used for
 * updateOffice (`z.object({ officeId }).merge(createInput.partial())`).
 */
export const UpdatePositionInput = z
  .object({
    positionId: z.string().uuid(),
  })
  .merge(CreatePositionInput.partial());
export type UpdatePositionInput = z.infer<typeof UpdatePositionInput>;

export const positionOutput = z.object({
  positionId: z.string().uuid(),
  title: z.string(),
});

// ───────────────────────── employees ─────────────────────────

export const CreateEmployeeInput = z.object({
  userId: z.string().uuid().nullish(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().nullish(),
  phoneNumber: z.string().nullish(),
  employeeNumber: z.string().nullish(), // see file header note 2
});
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeInput>;

/** [Inference] same update-shape pattern as positions/offices — see note above. */
export const UpdateEmployeeInput = z
  .object({
    employeeId: z.string().uuid(),
  })
  .merge(CreateEmployeeInput.partial());
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeInput>;

export const employeeOutput = z.object({
  employeeId: z.string().uuid(),
});

export const ListEmployeesInput = z.object({
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  cursor: z.string().nullish(), // UUID cursor for keyset pagination, or skip cursor for simple usage
});
export type ListEmployeesInput = z.infer<typeof ListEmployeesInput>;

// ───────────────────────── assignments ─────────────────────────

export const AssignEmployeeToPositionInput = z.object({
  employeeId: z.string().uuid(),
  positionId: z.string().uuid(),
  officeId: z.string().uuid(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullish(),
});
export type AssignEmployeeToPositionInput = z.infer<typeof AssignEmployeeToPositionInput>;

export const assignmentOutput = z.object({
  assignmentId: z.string().uuid(),
});

// ───────────────────────── designations (delegation reads only — see router header) ─────────────────────────

export const designationOutput = z.object({
  delegationId: z.string().uuid(),
  designationDocumentId: z.string().uuid(),
  delegatingUserId: z.string().uuid(),
  delegatingDisplayName: z.string(),
  delegatedToUserId: z.string().uuid(),
  delegatedToDisplayName: z.string(),
  officeId: z.string().uuid(),
  positionTitle: z.string(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});

export const GetDesignationHistoryInput = paginationInput.extend({
  employeeId: z.string().uuid().optional(),
});
export type GetDesignationHistoryInput = z.infer<typeof GetDesignationHistoryInput>;

export const designationHistoryItemOutput = z.object({
  delegationId: z.string().uuid(),
  designationDocumentId: z.string().uuid(),
  delegatingDisplayName: z.string(),
  delegatedToDisplayName: z.string(),
  positionTitle: z.string(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  isActive: z.boolean(),
  revokedAt: z.coerce.date().nullable(),
});

export const CreateDesignationGrantInput = z.object({
  designationDocumentId: z.string().uuid(),
  delegatingEmployeeId: z.string().uuid(),
  delegatedToEmployeeId: z.string().uuid(),
  officeId: z.string().uuid(),
  positionId: z.string().uuid(),
  scopeDescription: z.string().min(1),
  legalBasis: z.string().nullish(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
});
export type CreateDesignationGrantInput = z.infer<typeof CreateDesignationGrantInput>;

export const RevokeDesignationGrantEarlyInput = z.object({
  delegationId: z.string().uuid(),
  writtenInstructionReference: z.string().min(1).optional(),
});
export type RevokeDesignationGrantEarlyInput = z.infer<typeof RevokeDesignationGrantEarlyInput>;

// ───────────────────────── committees ─────────────────────────

export const CreateCommitteeInput = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(32),
  chairedByEmployeeId: z.string().uuid().nullish(), // see file header note 2
});
export type CreateCommitteeInput = z.infer<typeof CreateCommitteeInput>;

/** [Inference] same update-shape pattern as offices — see note above. */
export const UpdateCommitteeInput = z
  .object({
    committeeId: z.string().uuid(),
  })
  .merge(CreateCommitteeInput.partial());
export type UpdateCommitteeInput = z.infer<typeof UpdateCommitteeInput>;

export const committeeOutput = z.object({
  committeeId: z.string().uuid(),
});

export const AssignCommitteeMembershipInput = z.object({
  committeeId: z.string().uuid(),
  employeeId: z.string().uuid(),
  committeeRole: committeeRoleEnum,
  startDate: z.coerce.date(),
});
export type AssignCommitteeMembershipInput = z.infer<typeof AssignCommitteeMembershipInput>;

export const committeeMembershipOutput = z.object({
  membershipId: z.string().uuid(),
});
