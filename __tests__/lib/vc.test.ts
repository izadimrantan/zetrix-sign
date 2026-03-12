import { describe, it, expect } from 'vitest';
import { getDummyCredential, type VerifiableCredential } from '@/lib/vc';

describe('getDummyCredential', () => {
  it('returns a credential with all required fields', () => {
    const vc: VerifiableCredential = getDummyCredential();
    expect(vc.name).toBeDefined();
    expect(vc.did).toBeDefined();
    expect(vc.issuer).toBeDefined();
    expect(vc.credentialID).toBeDefined();
  });

  it('returns the hardcoded test identity', () => {
    const vc = getDummyCredential();
    expect(vc.name).toBe('John Tan');
    expect(vc.did).toBe('did:zetrix:test123');
    expect(vc.issuer).toBe('ZCert Test Authority');
    expect(vc.credentialID).toBe('vc_test_credential_001');
  });

  it('returns consistent data across calls', () => {
    const vc1 = getDummyCredential();
    const vc2 = getDummyCredential();
    expect(vc1).toEqual(vc2);
  });
});
