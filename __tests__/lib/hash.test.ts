import { describe, it, expect } from 'vitest';
import { computeSHA256 } from '@/lib/hash';

describe('computeSHA256', () => {
  it('returns a 64-character hex string', async () => {
    const data = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const hash = await computeSHA256(data);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces correct SHA256 for known input', async () => {
    // SHA256("Hello") = 185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969
    const data = new TextEncoder().encode('Hello');
    const hash = await computeSHA256(data);
    expect(hash).toBe('185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969');
  });

  it('produces different hashes for different inputs', async () => {
    const data1 = new TextEncoder().encode('Hello');
    const data2 = new TextEncoder().encode('World');
    const hash1 = await computeSHA256(data1);
    const hash2 = await computeSHA256(data2);
    expect(hash1).not.toBe(hash2);
  });

  it('produces same hash for same input (deterministic)', async () => {
    const data = new TextEncoder().encode('test data');
    const hash1 = await computeSHA256(data);
    const hash2 = await computeSHA256(data);
    expect(hash1).toBe(hash2);
  });

  it('works with File-like ArrayBuffer input', async () => {
    const buffer = new TextEncoder().encode('file content');
    const hash = await computeSHA256(buffer);
    expect(hash).toHaveLength(64);
  });
});
