import { describe, it, expect } from 'vitest';
import type { VerifiedClaims, MyKadClaims, PassportClaims } from '@/lib/vc';

describe('vc module re-exports', () => {
  it('exports VerifiedClaims type (compile-time check)', () => {
    const mykadClaims: VerifiedClaims = {
      credentialType: 'mykad',
      claims: {
        name: 'Ahmad bin Ali',
        icNumber: '901234-10-5678',
        myDigitalIdExpiry: '2028-12-31',
      },
    };
    expect(mykadClaims.credentialType).toBe('mykad');
    expect(mykadClaims.claims.name).toBe('Ahmad bin Ali');
  });

  it('supports MyKad claims', () => {
    const claims: MyKadClaims = {
      name: 'Test User',
      icNumber: '000000-00-0000',
      myDigitalIdExpiry: '2030-01-01',
    };
    expect(claims.icNumber).toBeDefined();
  });

  it('supports Passport claims', () => {
    const claims: PassportClaims = {
      type: 'P',
      countryCode: 'MYS',
      passportNumber: 'A12345678',
      name: 'Test User',
      identityNumber: '000000-00-0000',
      dateOfBirth: '1990-01-01',
      gender: 'M',
      height: '175',
      dateOfIssue: '2023-01-01',
      dateOfExpiry: '2028-01-01',
      issuingOffice: 'Immigration Department',
      photo: '',
    };
    expect(claims.passportNumber).toBeDefined();
  });
});
