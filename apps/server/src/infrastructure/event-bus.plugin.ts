/**
 * event-bus.plugin.ts — decorates `fastify.eventBus` with the shared, typed,
 * in-process EventBus (@batac/shared), wired to the Postgres-backed
 * DeadLetterRepository for failed-handler routing.
 *
 * [Unverified — gap-fill] Same situation as ./database.plugin.ts: not an
 * explicit TASK-IAM-014 deliverable, but required for the existing
 * `dependencies: ['database', 'event-bus', 'audit']` arrays (already present
 * in audit.plugin.ts, organization.plugin.ts, and the iam.plugin.ts stub) to
 * resolve at startup at all. See development-findings-log.md.
 *
 * Note this file deliberately does NOT use the `TypedEventBus` /
 * `apps/server/src/infrastructure/event-bus.ts` shape shown in J1
 * ("Domain Event Pattern"). That shape is superseded by what TASK-INFRA-023
 * actually built: a single `EventBus` class living in `packages/shared`
 * (confirmed both by development-findings-log.md's TASK-INFRA-023 entry and
 * by audit.plugin.ts's existing `import type { EventBus } from
 * '@batac/shared/event-bus'`). Per AGENTS.md's conflict-resolution order,
 * actual already-built code is followed here over the stale J1 example.
 *
 * Depends on `database` for `fastify.db`, which `DeadLetterRepository`
 * needs.
 *
 * `fastify.eventBus`'s ambient type (`EventBus`) is already declared in
 * modules/audit/audit.plugin.ts's `declare module 'fastify'` block, so it
 * is not redeclared here.
 *
 * Source: TASK-IAM-014. Instantiation pattern copied verbatim from the
 * worked example in packages/shared/src/event-bus.ts's class doc comment.
 */
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { EventBus } from '@batac/shared';
import { DeadLetterRepository } from './dead-letter.repository.js';

async function eventBusPlugin(fastify: FastifyInstance): Promise<void> {
  const deadLetterRepo = new DeadLetterRepository(fastify.db);
  // fastify.log is typed as FastifyBaseLogger, which matches IEventBusLogger structurally.
  const eventBus = new EventBus(fastify.log, deadLetterRepo);

  fastify.decorate('eventBus', eventBus);
}

export default fp(eventBusPlugin, {
  name: 'event-bus',
  dependencies: ['database'],
});
