/**
 * IDeadLetterRepository — interface for dead-letter persistence.
 *
 * Defined in packages/shared so that EventBus can depend on the interface
 * without creating a packages → apps/server circular dependency. The concrete
 * implementation (DeadLetterRepository) lives in apps/server and is injected
 * at Fastify startup.
 *
 * This is the dependency-inversion resolution for ADR-INFRA-023-01.
 */
export interface PendingDeadLetter {
  id: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  failedModule: string;
  errorMessage: string;
  failedAt: Date;
  retryCount: number;
  exhaustedAt: Date | null;
}

export interface IDeadLetterRepository {
  insert(row: {
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
    failedModule: string;
    errorMessage: string;
  }): Promise<void>;

  fetchPending(opts: { maxRetries: number }): Promise<PendingDeadLetter[]>;

  markRetried(id: string): Promise<void>;

  incrementRetry(id: string, backoffSeconds: number): Promise<void>;

  markExhausted(id: string): Promise<void>;
}
