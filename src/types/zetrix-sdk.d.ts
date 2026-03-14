declare module 'zetrix-connect-wallet-sdk' {
  interface SDKResponse {
    code: number;
    data?: any;
    message?: string;
  }

  class ZetrixWalletConnect {
    constructor(options: Record<string, unknown>);
    connect(): Promise<SDKResponse>;
    auth(): Promise<SDKResponse>;
    signMessage(params: { message: string }): Promise<SDKResponse>;
    signBlob(params: { message: string }): Promise<SDKResponse>;
    sendTransaction(params: Record<string, unknown>): Promise<SDKResponse>;
    disconnect(): Promise<void>;
  }

  export default ZetrixWalletConnect;
}
