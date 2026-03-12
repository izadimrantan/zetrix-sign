/**
 * Verifiable Credential shape.
 * FUTURE: Replace with real VC types from wallet SDK (sdk.getVP()).
 */
export interface VerifiableCredential {
  name: string;
  did: string;
  issuer: string;
  credentialID: string;
}

/**
 * Returns hardcoded dummy credential for development.
 * In production, this will be replaced by a wallet-prompted VC selection flow.
 */
export function getDummyCredential(): VerifiableCredential {
  return {
    name: 'John Tan',
    did: 'did:zetrix:test123',
    issuer: 'ZCert Test Authority',
    credentialID: 'vc_test_credential_001',
  };
}
