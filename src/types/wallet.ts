// Browser extension types
export interface ZetrixExtension {
  authorize(
    params: { method: string; param?: Record<string, unknown> },
    callback: (res: ZetrixExtensionResponse) => void
  ): void;
  signMessage(
    params: { message: string },
    callback: (res: ZetrixExtensionResponse) => void
  ): void;
}

export interface ZetrixExtensionResponse {
  code: number;
  data?: {
    address?: string;
    publicKey?: string;
    signData?: string;
  };
  message?: string;
}

// Global window augmentation
declare global {
  interface Window {
    zetrix?: ZetrixExtension;
  }
}

// Shared wallet result types (used by both extension and mobile)
export type ConnectionMethod = 'extension' | 'mobile';

export interface WalletConnectResult {
  address: string;
  publicKey: string;
  connectionMethod: ConnectionMethod;
}

export interface WalletSignResult {
  signData: string;
  publicKey: string;
}

export interface WalletTransactionResult {
  txHash: string;
}
