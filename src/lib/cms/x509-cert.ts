import 'reflect-metadata';
import * as x509 from '@peculiar/x509';
import { Crypto } from '@peculiar/webcrypto';
import type { CertGenerationParams, CertGenerationResult } from '@/types/cms';

// Use @peculiar/webcrypto which supports the algorithms we need
const crypto = new Crypto();
x509.cryptoProvider.set(crypto);

/** OID for Document Signing extended key usage (Microsoft) */
const OID_DOCUMENT_SIGNING = '1.3.6.1.4.1.311.10.3.12';

/** OID for custom VC references extension */
const OID_VC_REFERENCES = '1.3.6.1.4.1.99999.1.1';

/**
 * Generate a random 20-byte serial number as a hex string.
 */
function generateSerialNumber(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build the VC references JSON payload for the custom extension.
 */
function buildVcReferencesPayload(params: CertGenerationParams): string {
  return JSON.stringify({
    credentialId: params.credentialId,
    credentialIssuer: params.credentialIssuer,
    credentialType: params.credentialType ?? 'VerifiableCredential',
    vcVerifiedAt: params.vcVerifiedAt ?? new Date().toISOString(),
    signerPublicKey: params.signerPublicKey,
  });
}

/**
 * Encode a UTF-8 string as a DER UTF8String (tag 0x0C).
 */
function derUtf8String(value: string): ArrayBuffer {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const length = valueBytes.length;

  // DER encoding: tag (0x0C) + length + value
  let lengthBytes: Uint8Array;
  if (length < 128) {
    lengthBytes = new Uint8Array([length]);
  } else if (length < 256) {
    lengthBytes = new Uint8Array([0x81, length]);
  } else {
    lengthBytes = new Uint8Array([0x82, (length >> 8) & 0xff, length & 0xff]);
  }

  const result = new Uint8Array(1 + lengthBytes.length + length);
  result[0] = 0x0c; // UTF8String tag
  result.set(lengthBytes, 1);
  result.set(valueBytes, 1 + lengthBytes.length);

  return result.buffer;
}

/**
 * Generate a self-signed X.509 v3 certificate for a signing session.
 *
 * Uses an ephemeral ECDSA P-256 keypair for cert signing and CMS signing.
 * The signer's Zetrix wallet identity is embedded in SAN and custom extensions.
 */
export async function generateSignerCertificate(
  params: CertGenerationParams
): Promise<CertGenerationResult> {
  const { signerName, signerDid, signerAddress } = params;

  // 1. Generate ephemeral ECDSA P-256 keypair
  const algorithm: EcKeyGenParams = {
    name: 'ECDSA',
    namedCurve: 'P-256',
  };
  const keyPair = await crypto.subtle.generateKey(algorithm, false, [
    'sign',
    'verify',
  ]);

  // 2. Build certificate
  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  const subjectName = `CN=${signerName}, O=Zetrix AI Berhad, C=MY`;

  // Build extensions array
  const extensions: x509.Extension[] = [
    // Subject Alternative Name — DID and Zetrix address URIs
    new x509.SubjectAlternativeNameExtension([
      { type: 'url', value: `did:zetrix:${signerAddress}` },
      { type: 'url', value: `zetrix:address:${signerAddress}` },
    ], false),

    // Key Usage — digitalSignature + nonRepudiation (critical)
    new x509.KeyUsagesExtension(
      x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.nonRepudiation,
      true
    ),

    // Extended Key Usage — Document Signing
    new x509.ExtendedKeyUsageExtension(
      [OID_DOCUMENT_SIGNING],
      false
    ),

    // Basic Constraints — CA=false (critical)
    new x509.BasicConstraintsExtension(false, undefined, true),

    // Custom VC References extension
    new x509.Extension(
      OID_VC_REFERENCES,
      false,
      new Uint8Array(derUtf8String(buildVcReferencesPayload(params)))
    ),
  ];

  const cert = await x509.X509CertificateGenerator.createSelfSigned(
    {
      serialNumber: generateSerialNumber(),
      name: subjectName,
      notBefore: now,
      notAfter: oneYearLater,
      keys: keyPair,
      signingAlgorithm: { name: 'ECDSA', hash: 'SHA-256' },
      extensions,
    },
    crypto
  );

  // 3. Extract outputs
  const certDer = new Uint8Array(cert.rawData);
  const certPem = cert.toString('pem');

  return {
    certDer,
    certPem,
    signingKey: keyPair.privateKey,
  };
}
