import type { WalletConnectResult, WalletSignResult } from '@/types/wallet';

// ---- State ----
let sdkInstance: unknown = null;
let extensionAddress: string = '';

// ============================================
// Browser Extension (window.zetrix)
// ============================================

export function isExtensionAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.zetrix;
}

/**
 * Two-step extension flow: changeAccounts -> sendRandom.
 * sendRandom MUST be called inside the changeAccounts callback
 * to preserve the extension's internal session context.
 */
export function connectExtension(): Promise<WalletConnectResult> {
  return new Promise((resolve, reject) => {
    if (!window.zetrix) {
      reject(new Error('Zetrix wallet extension not installed'));
      return;
    }

    window.zetrix.authorize({ method: 'changeAccounts' }, (resp) => {
      if (resp.code !== 0 || !resp.data?.address) {
        reject(new Error(resp.message || 'Failed to connect wallet extension'));
        return;
      }

      const address = resp.data.address;
      extensionAddress = address;

      // Nested call: sendRandom for publicKey
      window.zetrix!.authorize(
        { method: 'sendRandom', param: { random: 'zetrix-sign-auth' } },
        (authResp) => {
          if (authResp.code !== 0 || !authResp.data?.publicKey) {
            reject(new Error(authResp.message || 'Extension auth failed'));
            return;
          }
          resolve({
            address,
            publicKey: authResp.data.publicKey,
            connectionMethod: 'extension',
          });
        }
      );
    });
  });
}

export function signMessageExtension(message: string): Promise<WalletSignResult> {
  return new Promise((resolve, reject) => {
    if (!window.zetrix) {
      reject(new Error('Zetrix wallet extension not installed'));
      return;
    }

    // Timeout to prevent hanging if extension channel closes silently
    const timeout = setTimeout(() => {
      reject(new Error('Extension signing timed out — wallet did not respond within 120s'));
    }, 120_000);

    console.log('[wallet] signMessage called, message length:', message.length);

    window.zetrix.signMessage({ message }, (res) => {
      clearTimeout(timeout);
      console.log('[wallet] signMessage callback received, code:', res.code);
      if (res.code !== 0 || !res.data?.signData) {
        reject(new Error(res.message || `Extension signing failed (code: ${res.code})`));
        return;
      }
      resolve({
        signData: res.data.signData,
        publicKey: res.data.publicKey || '',
      });
    });
  });
}

export function signBlobExtension(blob: string): Promise<WalletSignResult> {
  return new Promise((resolve, reject) => {
    if (!window.zetrix) {
      reject(new Error('Zetrix wallet extension not installed'));
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('Extension blob signing timed out — wallet did not respond within 120s'));
    }, 120_000);

    // Normalize to lowercase hex — the extension may reject mixed/uppercase hex
    const normalizedBlob = blob.toLowerCase();
    console.log('[wallet] signBlob called, blob length:', normalizedBlob.length, ', first 20 chars:', normalizedBlob.slice(0, 20));

    window.zetrix.signBlob({ message: normalizedBlob }, (res) => {
      clearTimeout(timeout);
      console.log('[wallet] signBlob callback received, code:', res.code);
      if (res.code !== 0 || !res.data?.signData) {
        reject(new Error(res.message || `Extension blob signing failed (code: ${res.code})`));
        return;
      }
      resolve({
        signData: res.data.signData,
        publicKey: res.data.publicKey || '',
      });
    });
  });
}

// ============================================
// Mobile SDK (zetrix-connect-wallet-sdk)
// ============================================

async function getSDK(qrDataCallback?: (qrContent: string) => void): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('SDK can only be used in the browser');
  }

  if (!sdkInstance) {
    const module = await import('zetrix-connect-wallet-sdk');
    const ZetrixWalletConnect = module.default || module;

    const options: Record<string, unknown> = {
      bridge: process.env.NEXT_PUBLIC_ZETRIX_BRIDGE || 'wss://test-wscw.zetrix.com',
      callMode: 'web',
      qrcode: true,
      appType: 'zetrix',
      testnet: process.env.NEXT_PUBLIC_ZETRIX_TESTNET === 'true',
    };

    if (qrDataCallback) {
      options.customQrUi = true;
      options.qrDataCallback = qrDataCallback;
    }

    sdkInstance = new ZetrixWalletConnect(options);
  }

  return sdkInstance;
}

export async function connectMobile(
  qrDataCallback?: (qrContent: string) => void
): Promise<WalletConnectResult> {
  const sdk = await getSDK(qrDataCallback);
  const connectResult = await sdk.connect();

  if (connectResult.code !== 0 || !connectResult.data?.address) {
    throw new Error(connectResult.message || 'Mobile wallet connection failed');
  }

  let publicKey = connectResult.data.publicKey || '';

  // If connect() didn't return publicKey, call auth() to get it
  if (!publicKey) {
    const authResult = await sdk.auth();
    if (authResult.code !== 0 || !authResult.data?.publicKey) {
      throw new Error('Failed to obtain public key from mobile wallet');
    }
    publicKey = authResult.data.publicKey;
  }

  return {
    address: connectResult.data.address,
    publicKey,
    connectionMethod: 'mobile',
  };
}

export async function signMessageMobile(message: string): Promise<WalletSignResult> {
  const sdk = await getSDK();
  const result = await sdk.signMessage({ message });
  if (result.code !== 0 || !result.data?.signData) {
    throw new Error(result.message || 'Mobile signing failed');
  }
  return {
    signData: result.data.signData,
    publicKey: result.data.publicKey || '',
  };
}

export async function sendTransactionMobile(params: {
  from: string;
  to: string;
  nonce: number;
  amount: string;
  gasFee: string;
  data: string;
}): Promise<string> {
  const sdk = await getSDK();
  const chainId = process.env.NEXT_PUBLIC_ZETRIX_CHAIN_ID || '2';
  const result = await sdk.sendTransaction({ ...params, chainId });
  if (result.code !== 0 || !result.data?.txHash) {
    throw new Error(result.message || 'Transaction submission failed');
  }
  return result.data.txHash;
}

export async function signBlobMobile(blob: string): Promise<WalletSignResult> {
  const sdk = await getSDK();
  const result = await sdk.signBlob({ message: blob });
  if (result.code !== 0 || !result.data?.signData) {
    throw new Error(result.message || 'Blob signing failed');
  }
  return {
    signData: result.data.signData,
    publicKey: result.data.publicKey || '',
  };
}

export async function disconnectMobile(): Promise<void> {
  if (sdkInstance) {
    try {
      await (sdkInstance as any).disconnect();
    } catch {
      // Ignore disconnect errors
    }
    sdkInstance = null;
  }
}

export function resetSDK(): void {
  sdkInstance = null;
  extensionAddress = '';
}
