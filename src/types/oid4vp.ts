// =============================================================================
// OID4VP Hosted Verifier — Type Definitions
// =============================================================================
// Flow: Backend creates verification request → QR displayed → user scans with
// MyID → OID4VP service sends HMAC-signed callback with verified claims →
// frontend polls for result.
// =============================================================================

// --- Credential Types ---

export type CredentialType = 'mykad' | 'passport';

// MyKad VC claims (returned in callback verifiedClaims)
export interface MyKadClaims {
  name: string;
  icNumber: string;
}

// Passport VC claims (returned in callback verifiedClaims)
export interface PassportClaims {
  name: string;
  passportNumber: string;
}

// Discriminated union for verified claims
export type VerifiedClaims =
  | { credentialType: 'mykad'; claims: MyKadClaims }
  | { credentialType: 'passport'; claims: PassportClaims };

// --- API: Create Verification Request ---

// POST /api/oid4vp/request — frontend sends this
export interface Oid4vpCreateRequest {
  credentialType: CredentialType;
}

// POST /api/oid4vp/request — backend returns this
export interface Oid4vpCreateResponse {
  success: boolean;
  stateId?: string;
  presentationId?: string;
  qrCodeData?: string;
  deepLinkUrl?: string;
  expiresAt?: string;
  error?: string;
}

// --- API: Callback from OID4VP Service ---

// Callback payload (FULL mode — includes actual user data)
export interface Oid4vpCallbackPayload {
  presentationId: string;
  stateId: string;
  verified: boolean;
  status: 'VERIFIED' | 'FAILED' | 'EXPIRED';
  verifiedClaims?: Record<string, unknown>;
  credentials?: Array<{
    id: string;
    issuer: string;
    credentialSubject: Record<string, unknown>;
  }>;
  verificationResults?: Record<string, unknown>;
  timestamp: string;
  errorMessage?: string;
}

// --- API: Poll for Status ---

// GET /api/oid4vp/status?stateId=... — frontend polls this
export interface Oid4vpStatusResponse {
  success: boolean;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  claims?: VerifiedClaims;
  presentationId?: string;
  error?: string;
}

// --- Verification Store Entry ---

export interface VerificationEntry {
  stateId: string;
  credentialType: CredentialType;
  status: 'pending' | 'verified' | 'failed' | 'expired';
  claims?: VerifiedClaims;
  presentationId?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
}
