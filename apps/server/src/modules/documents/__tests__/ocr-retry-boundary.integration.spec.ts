import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import PgBoss from 'pg-boss';
import 'dotenv/config';
import { randomUUID } from 'crypto';

describe('OCR Retry Boundary (Integration)', () => {
  const databaseUrlApp = process.env.DATABASE_URL_APP;

  if (!databaseUrlApp) {
    console.warn('Skipping integration tests: DATABASE_URL_APP is not set');
    it.skip('Skipped due to missing env var', () => {});
    return;
  }

  let boss: PgBoss;

  beforeAll(async () => {
    boss = new PgBoss(databaseUrlApp);
    boss.on('error', (err) => console.error('pg-boss error:', err));
    await boss.start();
  });

  afterAll(async () => {
    if (boss) {
      await boss.stop();
    }
  });

  it('verifies job.retryCount and job.retryLimit for retryLimit = 0', async () => {
    const queueName = `test.ocr.retry.limit.0.${randomUUID()}`;
    let handledCount = 0;
    let recordedRetryCount = -1;
    let recordedRetryLimit = -1;

    await boss.createQueue(queueName);
    await boss.send(queueName, { versionId: 'test-1' }, { retryLimit: 0, retryDelay: 1 });

    await new Promise<void>((resolve, reject) => {
      boss.work(queueName, { newJobCheckInterval: 500, includeMetadata: true }, async (jobs: any[]) => {
        console.log(`[retryLimit 0] Picked up ${jobs.length} jobs`);
        const job = jobs[0];
        handledCount++;
        recordedRetryCount = job.retryCount ?? 0;
        recordedRetryLimit = job.retryLimit ?? 0;
        
        if (handledCount === 1) {
          setTimeout(resolve, 50);
          throw new Error('Force failure');
        }
      }).catch(reject);
    });

    expect(handledCount).toBe(1);
    expect(recordedRetryCount).toBe(0);
    expect(recordedRetryLimit).toBe(0);
    expect(recordedRetryCount >= recordedRetryLimit).toBe(true);
  }, 10000);

  it('verifies job.retryCount and job.retryLimit for retryLimit = 1', async () => {
    const queueName = `test.ocr.retry.limit.1.${randomUUID()}`;
    let handledCount = 0;
    const retryCounts: number[] = [];

    await boss.createQueue(queueName);
    await boss.send(queueName, { versionId: 'test-2' }, { retryLimit: 1, retryDelay: 1, retryBackoff: true });

    await new Promise<void>((resolve, reject) => {
      boss.work(queueName, { newJobCheckInterval: 500, includeMetadata: true }, async (jobs: any[]) => {
        const job = jobs[0];
        handledCount++;
        retryCounts.push(job.retryCount ?? 0);
        
        if (handledCount === 2) {
          setTimeout(resolve, 50);
        }
        throw new Error('Force failure');
      }).catch(reject);
    });

    expect(handledCount).toBe(2);
    expect(retryCounts).toEqual([0, 1]);
  }, 15000);
});
