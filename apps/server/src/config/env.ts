import 'dotenv/config';
import { loadDockerSecrets } from './load-docker-secrets';
import { serverEnvSchema } from './env.server';

// Load container secrets into process.env before validation runs
loadDockerSecrets();

const result = serverEnvSchema.safeParse(process.env);

if (!result.success) {
  console.error('\n[FATAL] Environment variable validation failed at startup:');
  console.error(result.error.flatten().fieldErrors);
  console.error('\nThe application cannot start with an invalid configuration.');
  process.exit(1);
}

export const env = result.data;
