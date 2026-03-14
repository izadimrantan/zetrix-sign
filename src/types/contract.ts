// anchorDocument params (sent as data in sendTransaction)
export interface AnchorDocumentParams {
  documentHash: string;
  digitalSignature: string;
  signerPublicKey: string;
  credentialID: string;
}

// isValidated response from contract
export interface ValidationResult {
  isValid: boolean;
  reason: string;
  signerAddress?: string;
  credentialID?: string;
  timestamp?: number;
  txHash?: string;
}

// getRecord response from contract
export interface DocumentRecord {
  exists: boolean;
  signerAddress?: string;
  digitalSignature?: string;
  signerPublicKey?: string;
  credentialID?: string;
  timestamp?: number;
  isRevoked?: boolean;
}

// API request/response shapes
export interface ContractQueryRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface ContractQueryResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Build-blob API
export interface BuildBlobRequest {
  sourceAddress: string;
  contractAddress: string;
  input: string; // JSON string: { method, params }
}

export interface BuildBlobResponse {
  success: boolean;
  transactionBlob?: string;
  hash?: string;
  error?: string;
}

// Submit-signed API
export interface SubmitSignedRequest {
  transactionBlob: string;
  signData: string;
  publicKey: string;
  hash: string;
}

export interface SubmitSignedResponse {
  success: boolean;
  hash?: string;
  error?: string;
}
