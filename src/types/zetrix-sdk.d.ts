declare module 'zetrix-sdk-nodejs' {
  interface SDKResult {
    errorCode: number;
    errorDesc?: string;
    result?: any;
  }

  interface ContractCallParams {
    optType: number;
    contractAddress: string;
    input: string;
    sourceAddress?: string;
  }

  interface ContractInvokeParams {
    sourceAddress: string;
    contractAddress: string;
    amount: string;
    input: string;
  }

  interface BuildBlobParams {
    sourceAddress: string;
    gasPrice: string;
    feeLimit: string;
    nonce: string;
    operations: any[];
  }

  interface SubmitParams {
    items: Array<{
      transactionBlob: string;
      signatures: Array<{
        signData: string;
        publicKey: string;
      }>;
    }>;
  }

  class ZtxChainSDK {
    constructor(options: { host: string });
    contract: {
      call(params: ContractCallParams): Promise<SDKResult>;
    };
    account: {
      getNonce(address: string): Promise<SDKResult>;
    };
    operation: {
      contractInvokeByGasOperation(params: ContractInvokeParams): Promise<SDKResult>;
    };
    transaction: {
      buildBlob(params: BuildBlobParams): Promise<SDKResult>;
      submit(params: SubmitParams): Promise<SDKResult>;
    };
  }

  export default ZtxChainSDK;
}

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
