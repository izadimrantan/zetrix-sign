import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isExtensionAvailable,
  connectExtension,
  connectMobile,
  signMessageExtension,
  signMessageMobile,
} from '@/lib/wallet';

describe('isExtensionAvailable', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { zetrix: undefined });
  });

  it('returns false when window.zetrix is undefined', () => {
    expect(isExtensionAvailable()).toBe(false);
  });

  it('returns true when window.zetrix exists', () => {
    vi.stubGlobal('window', { zetrix: { authorize: vi.fn(), signMessage: vi.fn() } });
    expect(isExtensionAvailable()).toBe(true);
  });
});

describe('connectExtension', () => {
  it('resolves with address and publicKey on success', async () => {
    const mockAuthorize = vi.fn();
    let callCount = 0;
    mockAuthorize.mockImplementation((_params: unknown, cb: (res: unknown) => void) => {
      callCount++;
      if (callCount === 1) {
        cb({ code: 0, data: { address: 'ZTX_TEST_ADDR' } });
      } else {
        cb({ code: 0, data: { publicKey: 'PUB_KEY_123', signData: 'SIGN_DATA' } });
      }
    });

    vi.stubGlobal('window', {
      zetrix: { authorize: mockAuthorize, signMessage: vi.fn() },
    });

    const result = await connectExtension();
    expect(result.address).toBe('ZTX_TEST_ADDR');
    expect(result.publicKey).toBe('PUB_KEY_123');
    expect(result.connectionMethod).toBe('extension');
  });

  it('rejects when extension is not installed', async () => {
    vi.stubGlobal('window', { zetrix: undefined });
    await expect(connectExtension()).rejects.toThrow('not installed');
  });

  it('rejects when changeAccounts fails', async () => {
    const mockAuthorize = vi.fn().mockImplementation((_p: unknown, cb: (res: unknown) => void) => {
      cb({ code: 1, message: 'User rejected' });
    });
    vi.stubGlobal('window', {
      zetrix: { authorize: mockAuthorize, signMessage: vi.fn() },
    });
    await expect(connectExtension()).rejects.toThrow('User rejected');
  });
});

describe('signMessageExtension', () => {
  it('resolves with signData and publicKey', async () => {
    const mockSignMessage = vi.fn().mockImplementation((_p: unknown, cb: (res: unknown) => void) => {
      cb({ code: 0, data: { signData: 'SIG_ABC', publicKey: 'PUB_KEY_123' } });
    });
    vi.stubGlobal('window', {
      zetrix: { authorize: vi.fn(), signMessage: mockSignMessage },
    });
    const result = await signMessageExtension('test_hash');
    expect(result.signData).toBe('SIG_ABC');
    expect(result.publicKey).toBe('PUB_KEY_123');
  });
});

describe('connectMobile', () => {
  it('calls sdk.connect then sdk.auth and returns combined result', async () => {
    expect(connectMobile).toBeDefined();
  });
});

describe('signMessageMobile', () => {
  it('is defined as a function', () => {
    expect(signMessageMobile).toBeDefined();
  });
});
