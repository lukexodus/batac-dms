import { describe, it, expect } from 'vitest';
import {
  GENESIS_HASH,
  canonicalizePayload,
  computeChainHash,
  signHmac,
  verifyHmac,
} from '../audit.crypto.js';

describe('Audit Crypto Utilities', () => {
  describe('computeChainHash', () => {
    it('returns a 64-character lowercase hex string matching /^[a-f0-9]{64}$/', () => {
      const hash = computeChainHash(GENESIS_HASH, '{}');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash.length).toBe(64);
    });

    it('produces a value that differs when payload differs (payload-sensitive)', () => {
      const payloadA = '{"event":"A"}';
      const payloadB = '{"event":"B"}';
      const hashA = computeChainHash(GENESIS_HASH, payloadA);
      const hashB = computeChainHash(GENESIS_HASH, payloadB);
      
      expect(hashA).not.toBe(hashB);
    });
  });

  describe('HMAC Sign and Verify', () => {
    it('signHmac returns a 64-character hex string and verifyHmac correctly verifies it', () => {
      const payload = 'test_payload';
      const secret = 'super_secret_key';
      
      const signature = signHmac(payload, secret);
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
      
      // Verify with matching signature
      expect(verifyHmac(payload, secret, signature)).toBe(true);
      
      // Verify with modified payload
      expect(verifyHmac('modified_payload', secret, signature)).toBe(false);
      
      // Verify with modified secret
      expect(verifyHmac(payload, 'wrong_secret', signature)).toBe(false);
      
      // Verify with modified signature
      let modifiedSignature = signature.replace(/a/g, 'b');
      if (modifiedSignature === signature) {
        modifiedSignature = signature.replace(/0/g, '1');
      }
      expect(verifyHmac(payload, secret, modifiedSignature)).toBe(false);
    });
  });

  describe('canonicalizePayload', () => {
    it('deterministically serializes JS objects, explicitly sorting keys', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, a: 1 };
      
      expect(canonicalizePayload(obj1)).toBe('{"a":1,"b":2}');
      expect(canonicalizePayload(obj2)).toBe('{"a":1,"b":2}');
      expect(canonicalizePayload(obj1)).toBe(canonicalizePayload(obj2));
    });

    it('handles null and undefined correctly', () => {
      expect(canonicalizePayload(null)).toBe('null');
      expect(canonicalizePayload(undefined)).toBe('');
      
      const objWithNull = { a: null, b: 1 };
      const objWithUndefined = { a: undefined, b: 1 };
      
      expect(canonicalizePayload(objWithNull)).toBe('{"a":null,"b":1}');
      expect(canonicalizePayload(objWithUndefined)).toBe('{"b":1}');
    });
    
    it('handles nested objects recursively', () => {
      const obj1 = { x: { c: 3, b: 2, a: 1 }, y: [1, 2, { e: 5, d: 4 }] };
      const obj2 = { y: [1, 2, { d: 4, e: 5 }], x: { a: 1, c: 3, b: 2 } };
      
      expect(canonicalizePayload(obj1)).toBe('{"x":{"a":1,"b":2,"c":3},"y":[1,2,{"d":4,"e":5}]}');
      expect(canonicalizePayload(obj1)).toBe(canonicalizePayload(obj2));
    });
  });
});
