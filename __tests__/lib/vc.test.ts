import { describe, it, expect } from 'vitest';
import type { VerifiedClaims, MyKadClaims, PassportClaims } from '@/lib/vc';

describe('vc module re-exports', () => {
  it('exports VerifiedClaims type (compile-time check)', () => {
    const mykadClaims: VerifiedClaims = {
      credentialType: 'mykad',
      claims: {
        name: 'Ahmad bin Ali',
        icNumber: '901234-10-5678',
      },
    };
    expect(mykadClaims.credentialType).toBe('mykad');
    expect(mykadClaims.claims.name).toBe('Ahmad bin Ali');
  });

  it('supports MyKad claims', () => {
    const claims: MyKadClaims = {
      name: 'Test User',
      icNumber: '000000-00-0000',
    };
    expect(claims.icNumber).toBeDefined();
  });

  it('supports Passport claims', () => {
    const claims: PassportClaims = {
      name: 'Test User',
      passportNumber: 'A12345678',
    };
    expect(claims.passportNumber).toBeDefined();
  });
});
