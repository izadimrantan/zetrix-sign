declare module 'zetrix-connect-wallet-sdk' {
  interface SDKResponse {
    code: number;
    data?: any;
    message?: string;
  }

  interface GetVPParams {
    templateId: string;
    attributes: string[];
  }

  interface GetVPResponse {
    code: number;
    data?: { uuid: string };
    message?: string;
  }

  interface VerifyVCParams {
    templateId: string;
  }

  interface VerifyVCResponse {
    code: number;
    data?: { status: string; details: unknown };
    message?: string;
  }

  class ZetrixWalletConnect {
    constructor(options: Record<string, unknown>);
    connect(): Promise<SDKResponse>;
    auth(): Promise<SDKResponse>;
    signMessage(params: { message: string }): Promise<SDKResponse>;
    signBlob(params: { message: string }): Promise<SDKResponse>;
    sendTransaction(params: Record<string, unknown>): Promise<SDKResponse>;
    getVP(params: GetVPParams): Promise<GetVPResponse>;
    verifyVC(params: VerifyVCParams): Promise<VerifyVCResponse>;
    disconnect(): Promise<void>;
  }

  export default ZetrixWalletConnect;
}
