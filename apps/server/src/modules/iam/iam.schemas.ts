import { z } from 'zod';

/**
 * Request body schema for POST /api/auth/login.
 * PKCE S256 method only — RFC 7636. All three PKCE fields are required.
 * Source: TASK-IAM-006 AI Prompt (PKCE section).
 */
export const LoginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

export const UnlockInputSchema = z.object({
  password: z.string().min(1),
});

/**
 * Response body schema for a successful POST /api/auth/login.
 * Tokens are never in this body — they are in the two Set-Cookie headers.
 * This body exists so `/web`'s useSessionStore (F2 §5, ADR-UI-012) can
 * hydrate identity synchronously from the login response.
 * Source: TASK-IAM-006 Acceptance Criteria; Module Summary "login response body".
 */
export const AuthResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    username: z.string(),
    email: z.string().email(),
    cityId: z.string(),
    status: z.string(),
    mfaEnabled: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
  sessionId: z.string().uuid(),
  expiresAt: z.date(),
  roleCodes: z.array(z.string()),
  officeScopeId: z.string().uuid().nullable(),
  officeCode: z.string().nullable(),
  committeeIds: z.array(z.string()),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * Request body schema for POST /api/admin/sessions/:id/terminate.
 * `reason` is a mandatory, non-empty string — validated BEFORE the ABAC
 * call so that a missing or empty reason produces 400, not 403.
 * Source: TASK-IAM-010 AI Prompt.
 */
export const TerminateSessionInputSchema = z.object({
  reason: z.string().min(1, 'reason is required and must not be empty'),
});

export type TerminateSessionInput = z.infer<typeof TerminateSessionInputSchema>;
export const paginationInput = z.object({
  cursor: z.string().nullish(),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const dateRangeInput = z.object({
  from: z.coerce.date().nullish(),
  to: z.coerce.date().nullish(),
});

export const userSummaryOutput = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  email: z.string().email(),
  officeId: z.string().uuid().nullable(),
  positionTitle: z.string().nullable(),
});

export const roleCodeEnum = z.enum([
  'sys_admin',
  'plat_admin',
  'records_officer',
  'dept_encoder',
  'dept_approver',
  'sp_secretary',
  'sp_member',
  'sp_presiding_officer',
  'mayor',
  'brgy_encoder',
  'brgy_captain',
  'auditor',
  'citizen',
]);

export const GetProfileInput = z.object({
  userId: z.string().uuid().optional(),
});

export const UpdateProfileInput = z.object({
  displayName: z.string().min(1).max(200).optional(),
  phoneNumber: z.string().max(32).optional(),
});

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});

export const ForceTerminateSessionInput = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().min(1),
});

export const ListUserDirectoryInput = paginationInput.extend({
  officeId: z.string().uuid().optional(),
  search: z.string().max(200).optional(),
});

export const CreateUserAccountInput = z.object({
  username: z.string().min(3).max(64),
  email: z.string().email(),
  employeeId: z.string().uuid(),
});

export const EditUserAccountInput = z.object({
  userId: z.string().uuid(),
  email: z.string().email().optional(),
  officeId: z.string().uuid().optional(),
  status: z.enum(['active', 'deactivated']).optional(),
});

export const DeactivateUserAccountInput = z.object({
  userId: z.string().uuid(),
});

export const AssignRoleInput = z.object({
  userId: z.string().uuid(),
  roleCode: roleCodeEnum,
  officeScopeId: z.string().uuid().nullish(),
});

export const RevokeRoleInput = z.object({
  roleAssignmentId: z.string().uuid(),
});

export const RegisterCitizenClerkAssistedInput = z.object({
  fullName: z.string().min(1),
  birthdate: z.coerce.date(),
  phone: z.string().min(7),
  email: z.string().email(),
  idType: z.string(),
  idReference: z.string().optional(),
});
