import type { VerifiedClaims } from '@/types/oid4vp';

export function getSignerNameFromClaims(vc: VerifiedClaims): string {
  return vc.claims.name;
}

export function getIdentifierFromClaims(vc: VerifiedClaims): string {
  if (vc.credentialType === 'mykad') {
    return vc.claims.icNumber;
  }
  return vc.claims.passportNumber;
}

export function getIssuerFromClaims(vc: VerifiedClaims): string {
  if (vc.credentialType === 'mykad') {
    return 'JPN'; // Jabatan Pendaftaran Negara (National Registration Department)
  }
  return 'Immigration Department';
}
