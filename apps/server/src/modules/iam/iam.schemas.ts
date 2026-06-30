import { z } from 'zod';

/**
 * Request body schema for POST /api/auth/login.
 * PKCE S256 method only — RFC 7636. All three PKCE fields are required.
 * Source: TASK-IAM-006 AI Prompt (PKCE section).
 */
export const LoginInputSchema = z.object({
  username:               z.string().min(1),
  password:               z.string().min(1),
  code_verifier:          z.string().min(43).max(128),
  code_challenge:         z.string().min(43).max(128),
  code_challenge_method:  z.literal('S256'),
});

export type LoginInput = z.infer<typeof LoginInputSchema>;

/**
 * Response body schema for a successful POST /api/auth/login.
 * Tokens are never in this body — they are in the two Set-Cookie headers.
 * This body exists so `/web`'s useSessionStore (F2 §5, ADR-UI-012) can
 * hydrate identity synchronously from the login response.
 * Source: TASK-IAM-006 Acceptance Criteria; Module Summary "login response body".
 */
export const AuthResponseSchema = z.object({
  user: z.object({
    id:         z.string().uuid(),
    username:   z.string(),
    email:      z.string().email(),
    cityId:     z.string(),
    status:     z.string(),
    mfaEnabled: z.boolean(),
    createdAt:  z.date(),
    updatedAt:  z.date(),
  }),
  sessionId:     z.string().uuid(),
  expiresAt:     z.date(),
  roleCodes:     z.array(z.string()),
  officeScopeId: z.string().uuid().nullable(),
  officeCode:    z.string().nullable(),
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
