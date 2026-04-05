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

// The bridge is a relay server for QR-based mobile wallet pairing.
// It does NOT interact with the blockchain, so it can differ from the chain network.
// The mobile wallet app only connects to the mainnet bridge, so we default to mainnet.
const BRIDGE = process.env.NEXT_PUBLIC_ZETRIX_BRIDGE || 'wss://wscw.zetrix.com';
// The SDK's testnet flag controls deeplink URL schemes (zetrixnew:// vs zetrixnew-uat://).
// It should match the bridge/wallet app, NOT the blockchain network.
const SDK_TESTNET = BRIDGE.includes('test-') ? true : false;

/**
 * Create a fresh SDK instance each time (do NOT cache).
 * The SDK's WebSocket connection is tied to a single session,
 * and reusing a stale instance causes silent failures.
 */
async function createSDK(opts?: {
  qrDataCallback?: (qrContent: string, closeCb?: (data?: unknown) => void) => void;
  appType?: string;
  /** Set false on mobile so the SDK uses deeplink (linkTo) instead of QR */
  qrcode?: boolean;
}): Promise<any> {
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

  const appType = opts?.appType ?? 'myid';
  const useQrcode = opts?.qrcode ?? true;
  const qrDataCallback = opts?.qrDataCallback;

  const options: Record<string, unknown> = {
    bridge: BRIDGE,
    callMode: 'web',
    qrcode: useQrcode,
    appType,
    testnet: SDK_TESTNET,
  };

  if (qrDataCallback && useQrcode) {
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
  isMobile: boolean = false,
  qrDataCallback?: (qrContent: string) => void
): Promise<WalletConnectResult> {
  // Wrap the user's callback to also accept the SDK's close callback
  // The SDK passes (qrContent, closeCallback) — we need to store the closeCallback
  // so auth() can resolve via the QR path if h5Bind doesn't respond
  let sdkCloseCallback: ((data?: unknown) => void) | null = null;
  const wrappedCallback = qrDataCallback
    ? (qrContent: string, closeCb?: (data?: unknown) => void) => {
        console.log('[wallet-mobile] qrDataCallback received, content length:', qrContent.length);
        if (closeCb) {
          sdkCloseCallback = closeCb;
        }
        qrDataCallback(qrContent);
      }
    : undefined;

  // Always use qrcode=true so the SDK sends H5_put to the bridge
  // and we get the rms token. On mobile we convert QR data → deeplink.
  const sdk = await createSDK({
    qrDataCallback: wrappedCallback,
  });

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

/**
 * Fresh connect + auth + sign in two steps (single QR scan).
 * Used during anchoring step because the WebSocket session from Step 2
 * likely expired by the time the user reaches Step 6.
 *
 * Flow: connect() → auth() (user scans QR) → signMessage() (over same WebSocket, no second QR).
 * We use auth() + signMessage() instead of authAndSignMessage() because
 * some Zetrix app versions don't recognize the H5_bindAndSignMessage QR type.
 */
export async function reconnectAndSignMobile(
  message: string,
  qrDataCallback?: (qrContent: string) => void
): Promise<{ address: string; signData: string; publicKey: string }> {
  const wrappedCallback = qrDataCallback
    ? (qrContent: string, _closeCb?: (data?: unknown) => void) => {
        console.log('[wallet-mobile] reconnect qrDataCallback, content length:', qrContent.length);
        qrDataCallback(qrContent);
      }
    : undefined;

  const sdk = await createSDK({ qrDataCallback: wrappedCallback });

  // Step 1: Establish WebSocket
  console.log('[wallet-mobile] Reconnecting...');
  await sdk.connect();
  console.log('[wallet-mobile] Reconnected, calling auth() (QR will appear)...');

  // Step 2: Auth — generates H5_bind QR, user scans
  const authResult = await Promise.race([
    sdk.auth(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Mobile auth timed out. Please try again.')), 180_000)
    ),
  ]);

  console.log('[wallet-mobile] auth() resolved:', JSON.stringify(authResult));

  if (!authResult || authResult.code !== 0) {
    throw new Error(authResult?.message || 'Mobile re-auth failed');
  }

  const address = authResult.data?.address || '';
  // Clear QR after auth succeeds — signMessage uses the same WebSocket, no QR needed
  if (qrDataCallback) qrDataCallback('');

  // Step 3: Sign message over existing WebSocket (no QR, phone gets popup)
  console.log('[wallet-mobile] Auth done, calling signMessage() over same session...');
  const signResult = await Promise.race([
    sdk.signMessage({ message }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Mobile signing timed out. Please try again.')), 120_000)
    ),
  ]);

  console.log('[wallet-mobile] signMessage resolved:', JSON.stringify(signResult));

  if (!signResult || signResult.code !== 0 || !signResult.data?.signData) {
    throw new Error(signResult?.message || 'Mobile signing failed');
  }

  return {
    address: address || signResult.data.address || '',
    signData: signResult.data.signData,
    publicKey: signResult.data.publicKey || '',
  };
}

/**
 * Get the current nonce for an address via the SDK.
 * The SDK queries the chain's wallet API (test-wallet or wallet.zetrix.com).
 */
export async function getNonceMobile(address: string): Promise<number> {
  if (!sdkInstance) {
    throw new Error('Mobile wallet not connected. Please connect first.');
  }

  const chainId = process.env.NEXT_PUBLIC_ZETRIX_CHAIN_ID || '2';
  console.log('[wallet-mobile] Getting nonce for', address, 'chainId:', chainId);
  const result = await (sdkInstance as any).getNonce({ address, chainId });
  const nonce = result?.data?.nonce ?? 0;
  console.log('[wallet-mobile] Current nonce:', nonce);
  return typeof nonce === 'string' ? parseInt(nonce, 10) : nonce;
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
  console.log('[wallet-mobile] sendTransaction with nonce:', params.nonce);
  const result = await (sdkInstance as any).sendTransaction({ ...params, chainId });
  if (result.code !== 0 || !result.data?.hash) {
    throw new Error(result.message || 'Transaction submission failed');
  }
  return result.data.hash;
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

/**
 * Request a Verifiable Presentation from MyID via the SDK.
 * Requires an active SDK session (connectMobile must have been called first).
 *
 * Uses appType: 'myid' — creates a fresh SDK instance connected to MyID.
 * Flow: connect() → auth() (user scans QR) → getVP() (user approves disclosure on phone)
 *
 * Returns the VP uuid which can be sent to the verification endpoint.
 */
export async function getVPMobile(
  templateId: string,
  attributes: string[],
  qrDataCallback?: (qrContent: string) => void
): Promise<{ uuid: string; address: string; publicKey: string }> {
  const wrappedCallback = qrDataCallback
    ? (qrContent: string, _closeCb?: (data?: unknown) => void) => {
        console.log('[wallet-mobile] getVP qrDataCallback, content length:', qrContent.length);
        qrDataCallback(qrContent);
      }
    : undefined;

  // Create SDK with appType 'myid' for MyID wallet
  const sdk = await createSDK({ qrDataCallback: wrappedCallback, appType: 'myid' });

  // Step 1: Establish WebSocket
  console.log('[wallet-mobile] getVP: connecting...');
  await sdk.connect();

  // Step 2: Auth — generates QR, user scans with MyID
  console.log('[wallet-mobile] getVP: authenticating (QR will appear)...');
  const authResult = await Promise.race([
    sdk.auth(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('MyID auth timed out. Please try again.')), 180_000)
    ),
  ]);

  if (!authResult || authResult.code !== 0) {
    throw new Error(authResult?.message || 'MyID auth failed');
  }

  const address = authResult.data?.address || '';
  const publicKey = authResult.data?.publicKey || '';
  console.log('[wallet-mobile] getVP: auth done, address:', address.slice(0, 10) + '...');

  // Clear QR after auth
  if (qrDataCallback) qrDataCallback('');

  // Step 3: Request VP — user approves disclosure on phone
  console.log('[wallet-mobile] getVP: requesting VP with templateId:', templateId, 'attributes:', attributes);
  const vpResult = await Promise.race([
    sdk.getVP({ templateId, attributes }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('VP request timed out. Please try again.')), 120_000)
    ),
  ]);

  console.log('[wallet-mobile] getVP result:', JSON.stringify(vpResult));

  if (!vpResult || vpResult.code !== 0 || !vpResult.data?.uuid) {
    throw new Error(vpResult?.message || 'Failed to get Verifiable Presentation');
  }

  return {
    uuid: vpResult.data.uuid,
    address,
    publicKey,
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
