/**
 * database.plugin.ts — decorates `fastify.db` with the Drizzle ORM client
 * for the `batac_app` PostgreSQL role.
 *
 * [Unverified — gap-fill] This file was not part of TASK-IAM-014's deliverables
 * list, but TASK-IAM-014's own "app.ts registration order" example imports it
 * from this exact path, `iam.plugin.ts`'s pre-existing fp() stub already
 * declares `dependencies: ['database', 'event-bus', 'audit']`, and
 * `iam.middleware.ts` / `iam.types.ts` already reference `fastify.db` as
 * something "registered on the Fastify instance by the database plugin."
 * No prior task in this snapshot of the repo created it. Per AGENTS.md
 * Section 4 ("Fastify plugin registration order" is explicitly listed as a
 * question no document answers in advance), this is implemented as the most
 * conservative reasonable default rather than blocking TASK-IAM-014 on a
 * missing prerequisite — see development-findings-log.md for the logged
 * entry.
 *
 * No module dependencies — this is the root of the Wave B plugin
 * dependency chain; `event-bus`, `audit`, and `iam` all depend on it
 * (directly or transitively) for `fastify.db`.
 *
 * `fastify.db`'s ambient type (`DbClient`, an alias of `AppDb`) is declared
 * in modules/iam/iam.types.ts, not here — that file's `declare module
 * 'fastify'` block already covers it. This file only needs to supply a
 * runtime value satisfying that type.
 *
 * Source: TASK-IAM-014. Instantiation pattern copied verbatim from the
 * worked example in src/db.ts's `AppDb` doc comment (itself sourced to
 * TASK-INFRA-023 / TASK-INFRA-006).
 */
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../config/env.js';

async function databasePlugin(fastify: FastifyInstance): Promise<void> {
  const client = postgres(env.DATABASE_URL_APP);
  const db = drizzle(client);

  fastify.decorate('db', db);
}

export default fp(databasePlugin, {
  name: 'database',
});
