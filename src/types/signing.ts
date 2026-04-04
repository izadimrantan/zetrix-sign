import type { VerifiedClaims } from './oid4vp';

export enum SigningStep {
  Upload = 0,
  WalletIdentity = 1,
  Signature = 2,
  Placement = 3,
  Review = 4,
  Anchoring = 5,
  Complete = 6,
}

export interface SignaturePosition {
  x: number;      // 0-1 relative, origin top-left
  y: number;      // 0-1 relative, origin top-left
  page: number;   // 0-based page index
  width: number;  // 0-1 relative to page width
  height: number; // 0-1 relative to page height
}

export type SignatureType = 'auto' | 'drawn';

export interface SigningSession {
  // Step 1
  pdfFile: File | null;
  pdfPageCount: number;

  // Step 2
  walletAddress: string;
  publicKey: string;
  connectionMethod: 'extension' | 'mobile' | '';

  // Step 3 (identity verification via OID4VP)
  signerName: string;
  signerDID: string;
  credentialID: string;
  credentialType: 'mykad' | 'passport' | '';
  verifiedClaims: VerifiedClaims | null;

  // Step 4
  signatureType: SignatureType | '';
  signatureImage: string; // base64 data URL

  // Step 5
  signaturePosition: SignaturePosition | null;

  // Step 7 (generated during anchoring)
  documentHash: string;
  digitalSignature: string;
  txHash: string;

  // CMS/PKCS#7 signing (added in v2.0)
  anchorVersion: string; // '1.0' (legacy) or '2.0' (CMS)
  cmsSessionId: string; // Server-side CMS session ID
  downloadToken: string; // Server-side PDF download token

  // Meta
  currentStep: SigningStep;
  timestamp: string;
}

// Fields safe to persist to sessionStorage (File objects excluded)
export interface SerializableSession {
  walletAddress: string;
  publicKey: string;
  connectionMethod: string;
  signerName: string;
  signerDID: string;
  credentialID: string;
  credentialType: string;
  verifiedClaims: VerifiedClaims | null;
  signatureType: string;
  signatureImage: string;
  signaturePosition: SignaturePosition | null;
  currentStep: number;
  documentHash: string;
  digitalSignature: string;
  txHash: string;
  anchorVersion: string;
  cmsSessionId: string;
  downloadToken: string;
  timestamp: string;
}
