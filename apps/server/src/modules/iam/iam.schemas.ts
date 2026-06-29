import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
  code_verifier: z.string().optional(),
  code_challenge: z.string().optional(),
  code_challenge_method: z.string().optional(),
});
