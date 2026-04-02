/**
 * Verifiable Credential types are now defined in @/types/oid4vp.ts
 * (VerifiedClaims, MyKadClaims, PassportClaims).
 *
 * Identity verification is handled via OID4VP with the MyID wallet.
 * See: src/components/signing/identity-verifier.tsx
 */

export type { VerifiedClaims, MyKadClaims, PassportClaims } from '@/types/oid4vp';
