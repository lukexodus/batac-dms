import { createHash } from 'node:crypto';
import type PgBoss            from 'pg-boss';
import type { AuditWriteService } from './audit.write-service.js';
import type { AuditRepository }   from './audit.repository.js';
import { StubTsaClient }          from './tsa.stub.js';
import type { RfcTsaClient }      from './tsa.interface.js';

export const TSA_JOB_NAME = 'audit:monthly-tsa-export';
export const TSA_CRON     = '0 0 1 * *'; // first of each month, midnight UTC

export async function registerTsaExportJob(deps: {
  boss:         PgBoss;
  repo:         AuditRepository;
  writeService: AuditWriteService;
  env: {
    AUDIT_TSA_ENABLED:  boolean;
    AUDIT_TSA_URL?:     string;
    AUDIT_EXPORT_ENABLED: boolean;
    CITY_ID:            string;
  };
}): Promise<void> {
  const { boss, repo, writeService, env } = deps;

  // Provider selection: stub until D-AUTH-08 is resolved.
  // Replace StubTsaClient with real client when provider is confirmed.
  const tsaClient: RfcTsaClient = new StubTsaClient();

  await boss.schedule(TSA_JOB_NAME, TSA_CRON, {}, { tz: 'UTC' });

  await boss.work<void>(TSA_JOB_NAME, async () => {
    // 1. Compile the monthly snapshot.
    //    compileMonthlySnapshot() fetches all audit.events rows from the
    //    previous calendar month (or all rows if no prior export event exists),
    //    serialized as newline-delimited JSON in sequence_number ASC order.
    //    Output must be deterministic: same rows → same bytes.
    const snapshotJson = await repo.compileMonthlySnapshot();

    // 2. Hash the snapshot. Only the digest is transmitted externally.
    const digest = createHash('sha256').update(snapshotJson).digest();

    // 3. Submit to TSA (stub no-ops when AUDIT_TSA_ENABLED=false).
    const token = await tsaClient.timestamp(digest);

    // 4. Record the export as an audit event so it becomes part of the
    //    tamper-evident chain (ADR-API-002: "The export itself is recorded
    //    as an audit event, so the act of exporting becomes part of the
    //    chain it is meant to protect").
    await writeService.writeEvent({
      eventType:  'audit_log_exported',
      actorId:    null,   // system event
      targetType: 'audit_snapshot',
      payload: {
        snapshotDigest:  digest.toString('hex'),
        tsaSerialNumber: token.serialNumber,
        tsaUrl:          token.tsaUrl,
        exportedAt:      new Date().toISOString(),
      },
      cityId: env.CITY_ID,
    });
  });
}
