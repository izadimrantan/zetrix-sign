// --- Credential Types ---

export type CredentialType = 'mykad' | 'passport';

// MyKad VC claims
export interface MyKadClaims {
  name: string;
  icNumber: string;
  myDigitalIdExpiry: string;
}

// Passport VC claims
export interface PassportClaims {
  type: string;
  countryCode: string;
  passportNumber: string;
  name: string;
  identityNumber: string;
  dateOfBirth: string;
  gender: string;
  height: string;
  dateOfIssue: string;
  dateOfExpiry: string;
  issuingOffice: string;
  photo: string; // base64-encoded
}

// Discriminated union for verified claims
export type VerifiedClaims =
  | { credentialType: 'mykad'; claims: MyKadClaims }
  | { credentialType: 'passport'; claims: PassportClaims };

// --- SDK getVP flow types ---

export interface GetVPResult {
  uuid: string;
}

// POST /api/oid4vp/verify request/response
export interface Oid4vpVerifyRequest {
  uuid: string;
  credentialType: CredentialType;
}

export interface Oid4vpVerifyResponse {
  success: boolean;
  verified: boolean;
  claims?: VerifiedClaims;
  error?: string;
}
