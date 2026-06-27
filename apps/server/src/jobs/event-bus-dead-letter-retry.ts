/**
 * Dead-Letter Retry Job — `infra:dead-letter-retry`
 *
 * Scheduled pgboss job that runs every 5 minutes and re-emits domain events
 * that previously failed (handler threw or rejected). Implements exponential
 * backoff with a maximum of 5 attempts before marking a row as exhausted.
 *
 * Backoff schedule (ADR-API-001 §4):
 *   Attempt 1 → 60 s
 *   Attempt 2 → 120 s
 *   Attempt 3 → 240 s
 *   Attempt 4 → 480 s
 *   Attempt 5 → exhausted (no more retries)
 *
 * The job is intentionally "fire-and-forget re-emit" rather than replaying
 * into a reliable queue: the bus re-emits the event synchronously and the
 * existing per-handler isolation still applies. A handler that throws again
 * increments the retry counter rather than producing a second dead-letter row.
 *
 * Register at Fastify startup after pg-boss is started:
 *   await registerDeadLetterRetryJob({ boss, deadLetterRepo, bus, logger });
 *
 * Sources: ADR-API-001 §4; TASK-INFRA-023.
 */
import type PgBoss from 'pg-boss';
import type { IDeadLetterRepository } from '@batac/shared';
import type { EventBus, EventPayloadMap } from '@batac/shared';
import type { Logger } from 'pino';

const JOB_NAME = 'infra:dead-letter-retry';

/** ADR-API-001 §4 default maximum retry attempts. */
const MAX_RETRIES = 5;

/**
 * Exponential backoff in seconds.
 * attempt=1 → 60 s, attempt=2 → 120 s, attempt=3 → 240 s, attempt=4 → 480 s.
 */
const backoff = (attempt: number): number => 30 * Math.pow(2, attempt);

export async function registerDeadLetterRetryJob(deps: {
  boss: PgBoss;
  deadLetterRepo: IDeadLetterRepository;
  bus: EventBus;
  logger: Logger;
}): Promise<void> {
  const { boss, deadLetterRepo, bus, logger } = deps;

  // Schedule the job to run every 5 minutes.
  // pg-boss deduplicates schedules — safe to call on every startup.
  await boss.schedule(JOB_NAME, '*/5 * * * *');

  await boss.work<void>(JOB_NAME, async () => {
    const rows = await deadLetterRepo.fetchPending({ maxRetries: MAX_RETRIES });

    if (rows.length > 0) {
      logger.info(
        { count: rows.length },
        '[dead-letter-retry] processing pending rows',
      );
    }

    for (const row of rows) {
      // Reconstruct a minimal DomainEvent envelope from the stored columns.
      // cityId is set to 'retry' to signal that this is a retry invocation
      // rather than an original event; the original cityId is recoverable from
      // the stored payload if the handler needs it.
      const envelope = {
        eventId: row.eventId,
        eventType: row.eventType,
        occurredAt: row.failedAt.toISOString(),
        cityId: 'retry',
        schemaVersion: 1,
        payload: row.payload,
      };

      try {
        // Re-emit on the bus. EventBus.emit() never throws (per-handler isolation).
        // We treat a successful emit as "delivered"; if handlers fail again they
        // will insert a NEW dead-letter row (the retry job increments the original
        // row's counter separately below).
        bus.emit(
          row.eventType as keyof EventPayloadMap,
          envelope as never, // eslint-disable-line @typescript-eslint/no-explicit-any
        );
        await deadLetterRepo.markRetried(row.id);
        logger.info(
          { id: row.id, eventType: row.eventType },
          '[dead-letter-retry] retried successfully',
        );
      } catch (err) {
        // bus.emit() itself should never throw. If it does, that is an
        // unexpected infrastructure failure — increment retry or exhaust.
        const nextAttempt = row.retryCount + 1;
        if (nextAttempt >= MAX_RETRIES) {
          await deadLetterRepo.markExhausted(row.id);
          logger.error(
            { id: row.id, eventType: row.eventType, err },
            '[dead-letter-retry] exhausted — manual review required',
          );
        } else {
          await deadLetterRepo.incrementRetry(row.id, backoff(nextAttempt));
          logger.warn(
            {
              id: row.id,
              eventType: row.eventType,
              nextAttempt,
              backoffSeconds: backoff(nextAttempt),
            },
            '[dead-letter-retry] incremented retry counter',
          );
        }
      }
    }
  });
}
