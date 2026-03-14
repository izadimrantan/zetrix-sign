import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateDocument, queryContract, buildTransactionBlob, submitSignedTransaction } from '@/lib/blockchain';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('queryContract', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends correct request to /api/contract/query', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { exists: true } }),
    });

    const result = await queryContract('getRecord', { documentHash: 'abc123' });
    expect(mockFetch).toHaveBeenCalledWith('/api/contract/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'getRecord', params: { documentHash: 'abc123' } }),
    });
    expect(result).toEqual({ exists: true });
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Contract error' }),
    });

    await expect(queryContract('getRecord', {})).rejects.toThrow('Contract error');
  });
});

describe('validateDocument', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends hash to /api/contract/validate and returns ValidationResult', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { isValid: true, reason: 'Valid', signerAddress: 'ZTX_ADDR', credentialID: 'vc_001', timestamp: 1710000000 },
      }),
    });

    const result = await validateDocument('a'.repeat(64));
    expect(result.isValid).toBe(true);
    expect(result.signerAddress).toBe('ZTX_ADDR');
  });

  it('returns invalid result for unknown hash', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { isValid: false, reason: 'No record found for this documentHash' },
      }),
    });

    const result = await validateDocument('b'.repeat(64));
    expect(result.isValid).toBe(false);
  });
});

describe('buildTransactionBlob', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends correct request to /api/contract/build-blob and returns blob + hash', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, transactionBlob: 'BLOB_HEX_123', hash: 'HASH_456' }),
    });

    const result = await buildTransactionBlob('ZTX_ADDR', { method: 'anchorDocument', params: {} });
    expect(result).toEqual({ transactionBlob: 'BLOB_HEX_123', hash: 'HASH_456' });
  });
});

describe('submitSignedTransaction', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('sends blob + signature to /api/contract/submit-signed', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, hash: 'TX_HASH_ABC' }),
    });

    const txHash = await submitSignedTransaction('BLOB_HEX', 'SIGN_DATA', 'PUB_KEY', 'HASH_789', 'ZTX_ADDR');
    expect(txHash).toBe('TX_HASH_ABC');
  });
});
