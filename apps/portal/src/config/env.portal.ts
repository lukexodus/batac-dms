import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_NAME: z.string().default('Batac City LGU — Public Portal'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
  NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
  NEXT_PUBLIC_APP_NAME: process.env['NEXT_PUBLIC_APP_NAME'],
  NEXT_PUBLIC_SENTRY_DSN: process.env['NEXT_PUBLIC_SENTRY_DSN'],
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env['NEXT_PUBLIC_SENTRY_ENVIRONMENT'],
});
