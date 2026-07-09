/**
 * AppDb — Drizzle instance type for the batac_app role connection.
 *
 * This file exports the `AppDb` type so that repositories and services can
 * reference it without importing the concrete connection setup (which lives
 * in the server bootstrap). The actual instance is created at Fastify startup
 * and injected via dependency injection.
 *
 * Source: TASK-INFRA-023; TASK-INFRA-006 established the Drizzle pattern.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
/**
 * The Drizzle database instance type for the `batac_app` PostgreSQL role.
 *
 * Usage:
 *   Repositories declare their constructor parameter as `AppDb`.
 *   The actual instance is created in the server bootstrap:
 *
 *   ```typescript
 *   import postgres from 'postgres';
 *   import { drizzle } from 'drizzle-orm/postgres-js';
 *   const client = postgres(env.DATABASE_URL_APP);
 *   const db: AppDb = drizzle(client);
 *   ```
 */
export type AppDb = ReturnType<typeof drizzle>;
//# sourceMappingURL=db.d.ts.map