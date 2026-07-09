import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The genesis hash for the audit chain. 64 zeros.
 */
export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Deterministically serializes a payload by explicitly sorting object keys.
 * This ensures that structurally identical objects produce the exact same JSON string,
 * which is critical for consistent hashing.
 * 
 * Handles undefined values properly (omitting them from objects or returning empty string at top level).
 */
export function canonicalizePayload(payload: unknown): string {
  if (payload === undefined) {
    return '';
  }

  const replacer = (_key: string, value: unknown) => {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const sortedObj: Record<string, unknown> = {};
      Object.keys(value)
        .sort()
        .forEach((k) => {
          sortedObj[k] = (value as Record<string, unknown>)[k];
        });
      return sortedObj;
    }
    return value;
  };

  return JSON.stringify(payload, replacer) ?? '';
}

/**
 * Computes the SHA-256 chain hash given the previous hash and the serialized payload.
 * The chain hash is payload-sensitive.
 */
export function computeChainHash(previousHash: string, payload: string): string {
  const hash = createHash('sha256');
  hash.update(previousHash);
  hash.update(payload);
  return hash.digest('hex');
}

/**
 * Signs a payload using HMAC-SHA-256.
 */
export function signHmac(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

/**
 * Verifies an HMAC signature against the payload and secret.
 */
export function verifyHmac(payload: string, secret: string, signature: string): boolean {
  if (typeof signature !== 'string' || signature.length !== 64) {
    return false;
  }
  
  const expected = signHmac(payload, secret);
  
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}
