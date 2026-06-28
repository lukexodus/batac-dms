export interface TsaTimestampToken {
  token:        Buffer;   // Raw DER-encoded RFC 3161 timestamp token
  serialNumber: string;   // Token serial number for verification records
  tsaUrl:       string;   // TSA URL used
}

export interface RfcTsaClient {
  /**
   * Submit a SHA-256 digest to the TSA and receive a timestamp token.
   * MUST transmit only the digest — never the raw snapshot payload.
   * @param digest 32-byte SHA-256 digest of the monthly audit snapshot
   */
  timestamp(digest: Buffer): Promise<TsaTimestampToken>;
}
