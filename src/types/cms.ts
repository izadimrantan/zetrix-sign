// CMS/PKCS#7 signing session (server-side, in-memory)
export interface CmsSigningSession {
  id: string;
  pdfBytesWithPlaceholder: Uint8Array;
  byteRange: [number, number, number, number];
  cert: Uint8Array; // DER-encoded X.509 cert
  signerPublicKey: string; // Hex-encoded
  signedAttrsDer: Uint8Array; // DER of authenticated attributes
  signedAttrsSet: unknown; // pkijs attribute objects (for later assembly)
  documentHash: string; // SHA-256 of byte ranges
  createdAt: number;
  expiresAt: number; // Auto-expire after 5 minutes
}

// --- API Request/Response Types ---

export interface CmsSignRequest {
  pdfBase64: string;
  signerName: string;
  signerDid: string;
  signerAddress: string;
  signerPublicKey: string; // Hex-encoded public key from wallet
  credentialId: string;
  credentialIssuer: string;
  credentialType?: 'mykad' | 'passport';
  identityNumber?: string; // IC number or passport number
}

export interface CmsSignResponse {
  hashToSign: string; // Hex-encoded DER of signedAttrs
  sessionId: string;
}

export interface CmsCompleteRequest {
  sessionId: string;
  walletSignature: string; // Hex-encoded
}

export interface CmsCompleteResponse {
  signedPdfBase64: string;
  documentHash: string;
}

export interface CmsAnchorRequest {
  signedPdfBase64: string;
  txHash: string;
  blockNumber: number;
  blockTimestamp: string; // ISO 8601
  documentHash: string;
  chainId: string;
}

export interface CmsAnchorResponse {
  finalPdfBase64: string;
}

// --- Certificate Generation Types ---

export interface CertGenerationParams {
  signerName: string;
  signerDid: string;
  signerAddress: string;
  signerPublicKey: string; // Hex-encoded secp256k1 public key
  credentialId: string;
  credentialIssuer: string;
  credentialType?: 'mykad' | 'passport';
  identityNumber?: string; // IC number or passport number
  vcVerifiedAt?: string; // ISO 8601
}

export interface CertGenerationResult {
  certDer: Uint8Array; // DER-encoded certificate
  certPem: string; // PEM for debugging
  signingKey: CryptoKey; // Ephemeral key that signed the cert
}

// --- XMP Metadata Types ---

export interface VcXmpParams {
  signerName: string;
  signerDid: string;
  signerAddress: string;
  credentialId: string;
  credentialIssuer: string;
  vcVerifiedAt: string; // ISO 8601
}

export interface AnchorXmpParams {
  documentHash: string;
  hashAlgorithm: string;
  hashScope: string;
  txHash: string;
  blockNumber: number;
  blockTimestamp: string; // ISO 8601
  chainId: string;
  verificationUrl: string;
}
