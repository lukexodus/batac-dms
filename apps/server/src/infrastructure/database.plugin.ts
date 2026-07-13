/**
 * database.plugin.ts — decorates `fastify.db` with an AsyncLocalStorage-aware
 * proxy around the Drizzle ORM client for the `batac_app` PostgreSQL role.
 *
 * The proxy transparently delegates to a request-scoped transaction when one is
 * active (set by Hook 3 in iam.middleware.ts), ensuring that SET LOCAL GUC
 * values used by RLS policies persist across all queries within a request.
 * When no transaction is active, the proxy falls back to the base Drizzle
 * client for direct auto-committed queries.
 *
 * Source: TASK-IAM-014 (original db decoration); TASK-IAM-041 (proxy).
 */
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { env } from '../config/env.js';
import type { AppDb } from '../db.js';

/**
 * Request-scoped database context stored in AsyncLocalStorage.
 * When a transaction is active, `tx` holds the drizzle transaction handle
 * (which operates within the open PostgreSQL transaction). When null, the
 * proxy falls back to the base drizzle client.
 */
interface RlsStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any;
}

/**
 * Module-level AsyncLocalStorage instance. Each incoming request runs within
 * a `store.run(...)` scope so that the proxy can access the request's
 * transaction handle without explicit parameter threading.
 */
export const rlsStore = new AsyncLocalStorage<RlsStore>();

async function databasePlugin(fastify: FastifyInstance): Promise<void> {
  const client = postgres(env.DATABASE_URL_APP);
  const baseDb: AppDb = drizzle(client);

  /**
   * Proxy handler: intercepts method calls on the Drizzle client.
   * When a method is called, it checks AsyncLocalStorage for an active
   * request-scoped transaction. If found, it delegates to that transaction's
   * method. If not found, it delegates to the base client.
   * Non-function properties (e.g. $table, $schema) pass through to the base
   * client directly, since they are static metadata.
   */
  const proxyHandler: ProxyHandler<AppDb> = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (typeof value !== 'function') {
        return value;
      }

      return function (this: unknown, ...args: unknown[]) {
        const store = rlsStore.getStore();
        const activeTarget = store?.tx ?? target;
        const activeValue = Reflect.get(activeTarget, prop,
          activeTarget === target ? receiver : activeTarget);
        if (typeof activeValue === 'function') {
          return activeValue.apply(activeTarget, args);
        }
        return activeValue;
      };
    },
  };

  const db = new Proxy(baseDb, proxyHandler) as AppDb;

  fastify.decorate('db', db);
}

export default fp(databasePlugin, {
  name: 'database',
});
