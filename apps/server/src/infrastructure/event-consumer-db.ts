import { AsyncLocalStorage } from 'node:async_hooks';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../config/env.js';
import type { AppDb, AppTx } from '../db.js';

/**
 * Dedicated `batac_app` connection(s) for fire-and-forget event consumers.
 *
 * Why a dedicated connection exists at all: the in-process EventBus runs
 * handlers synchronously *inside* the emitter's ALS scope, so a consumer that
 * captures `fastify.db` executes inside the emitter's request-scoped RLS
 * transaction on the same physical connection. Any nested `db.transaction(...)`
 * then throws ("transaction already open") and the consumer write is lost
 * without the producer being rolled back. See docs/development-findings-log.md
 * LOG-0207 / LOG-0210 and B3 §2.4 Rule 5.
 *
 * Two pieces make this connection usable the way the request path is:
 *
 * 1. Constant system RLS context primed at connection creation. Only
 *    `documents.documents` has RLS among the consumer-writable tables
 *    (migrations 0004/0016/0018/0019), and its SELECT/UPDATE policies are
 *    satisfied by `app.bypass_office_isolation='true'` + `app.current_city_id`
 *    (the phase-1 city id never varies). These are session-scoped
 *    (is_local=false), so they apply to both top-level pool queries and to
 *    transactions on the connection. [Inference] A system-triggered consumer
 *    only ever touches the exact documentId/instanceId named by an event
 *    produced by an authorized request, so bypassing office isolation here is
 *    equivalent to a trusted system account, not privilege escalation.
 *
 * 2. An ALS-aware proxy mirroring database.plugin.ts but with a *private*
 *    AsyncLocalStorage, so event-consumer transactions never collide with
 *    request-scoped ones. When a consumer opens `eventDb.db.transaction(...)`,
 *    the callback runs inside a store whose `tx` is that transaction, so
 *    service-internal pool queries (e.g. `documentsService.getDocumentById`
 *    called from inside createInstance) route to the SAME connection instead
 *    of re-acquiring a held single connection (which deadlocks a max:1 pool).
 */
export interface EventConsumerDb {
  db: AppDb;
  close(): Promise<void>;
}

const eventStore = new AsyncLocalStorage<{ tx: AppTx }>();

export async function createEventConsumerDb(
  opts: { max?: number } = {},
): Promise<EventConsumerDb> {
  const max = opts.max ?? 1;
  // idle_timeout: 0 keeps the primed connection alive for the pool's lifetime.
  // postgres.js 3.4.9 exposes no connection-established hook (no onconnect), so
  // priming cannot ride along on new connections; an idle_timeout would close
  // the primed connection and the next consumer would open a fresh UNPRIMED
  // one, silently failing its RLS reads (LOG-0210 — live-verified: server
  // worked 13s after boot but failed 2min later once the connection idled out).
  // Defense-in-depth: the proxy below also re-primes before beginning a new
  // transaction, so a network-level reconnect re-establishes the RLS context
  // before the first write through this connection.
  const client = postgres(env.DATABASE_URL_APP, {
    max,
    idle_timeout: 0,
  });
  const baseDb: AppDb = drizzle(client);

  // Prime the session RLS context. Session-scoped (is_local=false) so it
  // applies to both top-level pool queries and transactions on the same
  // connection. Idempotent, so re-priming on every operation is safe.
  const prime = () =>
    client`
      select
        set_config('app.current_city_id', ${env.CITY_ID}, false),
        set_config('app.bypass_office_isolation', 'true', false)
    `;
  // Prime the first connection eagerly at creation.
  await prime();

  const proxy: AppDb = new Proxy(baseDb, {
    get(target, prop, receiver) {
      if (prop === 'transaction') {
        return async (cb: (tx: AppTx) => unknown, options?: unknown) => {
          const active = eventStore.getStore()?.tx;
          if (active) {
            // Nested transaction inside an open event transaction: route to it.
            // Must NOT prime here — the single pool connection is held by the
            // open transaction, so a prime query would queue forever (max:1
            // deadlock). The outer transaction already primed this connection.
            return (active as unknown as AppDb).transaction(cb as never, options as never);
          }
          await prime();
          return baseDb.transaction(
            (tx: AppTx) => eventStore.run({ tx }, () => cb(tx)) as Promise<unknown>,
            options as never,
          );
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') {
        return value;
      }
      return function (this: unknown, ...args: unknown[]) {
        const activeTarget = eventStore.getStore()?.tx ?? target;
        const activeValue = Reflect.get(activeTarget, prop, activeTarget);
        if (typeof activeValue === 'function') {
          return activeValue.apply(activeTarget, args);
        }
        return activeValue;
      };
    },
  });

  let closed = false;
  return {
    db: proxy,
    async close() {
      if (closed) return;
      closed = true;
      await client.end({ timeout: 5 });
    },
  };
}
