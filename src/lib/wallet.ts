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

const TESTNET = process.env.NEXT_PUBLIC_ZETRIX_TESTNET === 'true';
const DEFAULT_BRIDGE = TESTNET ? 'wss://test-wscw.zetrix.com' : 'wss://wscw.zetrix.com';
const BRIDGE = process.env.NEXT_PUBLIC_ZETRIX_BRIDGE || DEFAULT_BRIDGE;

/**
 * Create a fresh SDK instance each time (do NOT cache).
 * The SDK's WebSocket connection is tied to a single session,
 * and reusing a stale instance causes silent failures.
 */
async function createSDK(qrDataCallback?: (qrContent: string) => void): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('SDK can only be used in the browser');
  }

  // Disconnect any previous instance
  if (sdkInstance) {
    try { await (sdkInstance as any).disconnect(); } catch { /* ignore */ }
    sdkInstance = null;
  }

  const module = await import('zetrix-connect-wallet-sdk');
  const ZetrixWalletConnect = module.default || module;

  const options: Record<string, unknown> = {
    bridge: BRIDGE,
    callMode: 'web',
    qrcode: true,
    appType: 'zetrix',
    testnet: TESTNET,
  };

  if (qrDataCallback) {
    options.customQrUi = true;
    options.qrDataCallback = qrDataCallback;
  }

  const sdk = new ZetrixWalletConnect(options);
  sdkInstance = sdk;
  return sdk;
}

/**
 * Mobile wallet connection flow (based on working reference implementation):
 * 1. sdk.connect() — establishes WebSocket connection
 * 2. sdk.auth() — generates H5_bind QR code, returns { address }
 *    (this is the QR the user scans with the Zetrix mobile app)
 * 3. Returns address + publicKey for use in signing steps
 *
 * The `qrDataCallback` receives the QR content string so the UI
 * can render it with a custom QR component (QRCodeSVG).
 */
export async function connectMobile(
  qrDataCallback?: (qrContent: string) => void
): Promise<WalletConnectResult> {
  const sdk = await createSDK(qrDataCallback);

  // Step 1: sdk.connect() — establishes WebSocket and generates QR.
  // The QR is delivered via qrDataCallback. The promise resolves
  // once the user scans the QR with the mobile app.
  console.log('[wallet-mobile] Calling sdk.connect()...');
  const connectResult = await Promise.race([
    sdk.connect(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('QR code scan timed out. Please try again.')), 180_000)
    ),
  ]);
  console.log('[wallet-mobile] sdk.connect() resolved:', JSON.stringify(connectResult));

  // Step 2: sdk.auth() — sends H5_bind request over existing WebSocket.
  // This prompts the mobile app to approve the binding (no second QR).
  console.log('[wallet-mobile] Calling sdk.auth()...');
  const authResult = await Promise.race([
    sdk.auth(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Wallet auth timed out. Please try again.')), 60_000)
    ),
  ]);
  console.log('[wallet-mobile] sdk.auth() resolved:', JSON.stringify(authResult));

  if (!authResult || authResult.code !== 0) {
    throw new Error(authResult?.message || 'Mobile wallet auth failed');
  }

  const address = authResult.data?.address;
  const publicKey = authResult.data?.publicKey || '';

  if (!address) {
    throw new Error('Mobile wallet did not return an address');
  }

  console.log('[wallet-mobile] Auth successful, address:', address.slice(0, 10) + '...');

  return {
    address,
    publicKey,
    connectionMethod: 'mobile',
  };
}

/**
 * Sign a message using the mobile wallet.
 * Uses the existing WebSocket connection — no second QR needed.
 */
export async function signMessageMobile(message: string): Promise<WalletSignResult> {
  if (!sdkInstance) {
    throw new Error('Mobile wallet not connected. Please connect first.');
  }

  console.log('[wallet-mobile] Calling sdk.signMessage(), message length:', message.length);

  const result = await Promise.race([
    (sdkInstance as any).signMessage({ message }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Mobile signing timed out. Please try again.')), 60_000)
    ),
  ]);

  if (!result || result.code !== 0 || !result.data?.signData) {
    throw new Error(result?.message || 'Mobile signing failed');
  }

  console.log('[wallet-mobile] signMessage successful');

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
  if (!sdkInstance) {
    throw new Error('Mobile wallet not connected. Please connect first.');
  }

  const chainId = process.env.NEXT_PUBLIC_ZETRIX_CHAIN_ID || '2';
  const result = await (sdkInstance as any).sendTransaction({ ...params, chainId });
  if (result.code !== 0 || !result.data?.txHash) {
    throw new Error(result.message || 'Transaction submission failed');
  }
  return result.data.txHash;
}

export async function signBlobMobile(blob: string): Promise<WalletSignResult> {
  if (!sdkInstance) {
    throw new Error('Mobile wallet not connected. Please connect first.');
  }

  const result = await (sdkInstance as any).signBlob({ message: blob });
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
