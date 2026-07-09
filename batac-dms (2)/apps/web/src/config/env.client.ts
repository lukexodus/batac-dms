import { z } from 'zod';

export const clientEnvSchema = z.object({
  VITE_APP_NAME: z.string().default('Batac City LGU'),
  VITE_API_URL: z.string().url(),
  VITE_APP_URL: z.string().url(),
  VITE_SENTRY_DSN: z.string().url().optional(),
  VITE_SENTRY_ENVIRONMENT: z.string().optional(),
});

export const clientEnv = clientEnvSchema.parse({
  VITE_APP_NAME: import.meta.env['VITE_APP_NAME'] as string,
  VITE_API_URL: import.meta.env['VITE_API_URL'] as string,
  VITE_APP_URL: import.meta.env['VITE_APP_URL'] as string,
  VITE_SENTRY_DSN: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  VITE_SENTRY_ENVIRONMENT: import.meta.env['VITE_SENTRY_ENVIRONMENT'] as string | undefined,
});
