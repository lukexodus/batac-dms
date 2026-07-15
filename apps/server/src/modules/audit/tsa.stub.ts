import type { RfcTsaClient, TsaTimestampToken } from './tsa.interface.js';

/** No-op TSA client used when AUDIT_TSA_ENABLED=false or D-AUTH-08 unresolved. */
export class StubTsaClient implements RfcTsaClient {
  async timestamp(digest: Buffer): Promise<TsaTimestampToken> {
    console.warn(
      '[audit:tsa] TSA submission skipped (AUDIT_TSA_ENABLED=false / D-AUTH-08 open). ' +
        'Snapshot digest (hex):',
      digest.toString('hex'),
    );
    return {
      token: Buffer.alloc(0),
      serialNumber: 'STUB-' + Date.now(),
      tsaUrl: 'stub://disabled',
    };
  }
}
