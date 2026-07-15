/**
 * DeadLetterRepository — concrete implementation of IDeadLetterRepository.
 *
 * Persists dead-lettered domain event handler failures to
 * `shared.event_bus_dead_letters` using the batac_app Drizzle instance.
 *
 * Implements the interface defined in @batac/shared so that EventBus can
 * depend on the interface without creating a packages → apps dependency.
 *
 * Sources: TASK-INFRA-023; ADR-INFRA-023-01 (IDeadLetterRepository DI pattern);
 *          ADR-API-001 §4 (dead-letter semantics).
 */
import { and, lt, isNull, asc, eq, sql } from 'drizzle-orm';
import { eventBusDeadLetters } from '@batac/database/schema/shared.schema.js';
import type { IDeadLetterRepository, PendingDeadLetter } from '@batac/shared';
import type { AppDb } from '../db.js';

export class DeadLetterRepository implements IDeadLetterRepository {
  constructor(private readonly db: AppDb) {}

  /**
   * Insert a new dead-letter row immediately after a handler failure.
   * Called fire-and-forget from EventBus.onHandlerFailure.
   */
  async insert(row: {
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    failedModule: string;
    errorMessage: string;
  }): Promise<void> {
    await this.db.insert(eventBusDeadLetters).values({
      eventId: row.eventId,
      eventType: row.eventType,
      payload: row.payload,
      failedModule: row.failedModule,
      errorMessage: row.errorMessage,
    });
  }

  /**
   * Fetch rows eligible for retry: retryCount < maxRetries AND exhaustedAt IS NULL.
   * Ordered oldest-first so that stale events are retried before recent ones.
   * Limit 100 per run to bound the job's runtime.
   */
  async fetchPending(opts: { maxRetries: number }): Promise<PendingDeadLetter[]> {
    const rows = await this.db
      .select()
      .from(eventBusDeadLetters)
      .where(
        and(
          lt(eventBusDeadLetters.retryCount, opts.maxRetries),
          isNull(eventBusDeadLetters.exhaustedAt),
        ),
      )
      .orderBy(asc(eventBusDeadLetters.failedAt))
      .limit(100);

    return rows.map((r) => ({
      id: r.id,
      eventId: r.eventId,
      eventType: r.eventType,
      payload: r.payload as Record<string, unknown>,
      failedModule: r.failedModule,
      errorMessage: r.errorMessage,
      failedAt: r.failedAt,
      retryCount: r.retryCount,
      exhaustedAt: r.exhaustedAt,
    }));
  }

  /**
   * Delete a successfully retried row.
   * Called by the retry job on each successful re-emit.
   */
  async markRetried(id: string): Promise<void> {
    await this.db.delete(eventBusDeadLetters).where(eq(eventBusDeadLetters.id, id));
  }

  /**
   * Increment retryCount and advance failedAt by backoffSeconds so the
   * next `fetchPending` call naturally skips it until the backoff expires.
   *
   * Uses raw SQL via Drizzle's sql`` template because Drizzle's update()
   * builder does not support column-relative arithmetic (retry_count + 1)
   * or interval arithmetic without a raw SQL fragment.
   */
  async incrementRetry(id: string, backoffSeconds: number): Promise<void> {
    await this.db.execute(
      sql`
        UPDATE shared.event_bus_dead_letters
        SET
          retry_count = retry_count + 1,
          failed_at   = NOW() + (${backoffSeconds} * interval '1 second')
        WHERE id = ${id}
      `,
    );
  }

  /**
   * Mark a row as permanently exhausted (all retries consumed).
   * Sets exhausted_at = NOW(); no further automatic retries will occur.
   * Row is kept permanently for manual investigation.
   */
  async markExhausted(id: string): Promise<void> {
    await this.db
      .update(eventBusDeadLetters)
      .set({ exhaustedAt: new Date() })
      .where(eq(eventBusDeadLetters.id, id));
  }
}
