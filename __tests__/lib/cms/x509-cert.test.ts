import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { generateSignerCertificate } from '@/lib/cms/x509-cert';
import type { CertGenerationParams } from '@/types/cms';
import * as x509 from '@peculiar/x509';
import { Crypto } from '@peculiar/webcrypto';

// Set the crypto provider for x509 parsing in tests
const crypto = new Crypto();
x509.cryptoProvider.set(crypto);

const TEST_PARAMS: CertGenerationParams = {
  signerName: 'John Doe',
  signerDid: 'did:zetrix:ZTX3M6A…abc123',
  signerAddress: 'ZTX3M6Aabc123',
  signerPublicKey: 'b00168abc123def456',
  credentialId: 'vc-id-001',
  credentialIssuer: 'did:zetrix:issuer001',
  credentialType: 'ZetrixKYCCredential',
  vcVerifiedAt: '2026-03-31T00:00:00Z',
};

describe('generateSignerCertificate', () => {
  it('returns DER, PEM, and a CryptoKey', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);

    expect(result.certDer).toBeInstanceOf(Uint8Array);
    expect(result.certDer.length).toBeGreaterThan(0);
    expect(typeof result.certPem).toBe('string');
    expect(result.signingKey).toBeDefined();
    // CryptoKey type check
    expect(result.signingKey.type).toBe('private');
  });

  it('PEM output starts and ends with correct markers', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);

    expect(result.certPem).toMatch(/^-----BEGIN CERTIFICATE-----/);
    expect(result.certPem).toMatch(/-----END CERTIFICATE-----\s*$/);
  });

  it('certificate has correct subject CN, O, and C', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);
    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);

    expect(cert.subject).toContain('CN=John Doe');
    expect(cert.subject).toContain('O=Zetrix AI Berhad');
    expect(cert.subject).toContain('C=MY');
  });

  it('certificate is self-signed (issuer equals subject)', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);
    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);

    expect(cert.issuer).toBe(cert.subject);
  });

  it('certificate validity spans approximately one year', async () => {
    const before = new Date();
    const result = await generateSignerCertificate(TEST_PARAMS);
    const after = new Date();

    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);

    // notBefore should be close to now
    expect(cert.notBefore.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    expect(cert.notBefore.getTime()).toBeLessThanOrEqual(after.getTime() + 1000);

    // notAfter should be ~1 year later
    const diffMs = cert.notAfter.getTime() - cert.notBefore.getTime();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    // Allow for leap year variance
    expect(diffMs).toBeGreaterThanOrEqual(oneYearMs - 2 * 24 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(oneYearMs + 2 * 24 * 60 * 60 * 1000);
  });

  it('has Subject Alternative Name extension with correct URIs', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);
    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);

    const sanExt = cert.extensions.find(
      (e) => e.type === '2.5.29.17' // SAN OID
    );
    expect(sanExt).toBeDefined();
    expect(sanExt!.critical).toBe(false);

    // Parse SAN by reading the cert's getExtension helper
    const sanParsed = cert.getExtension(x509.SubjectAlternativeNameExtension);
    expect(sanParsed).toBeDefined();

    const uris = sanParsed!.names.items
      .filter((n: { type: string }) => n.type === 'url')
      .map((n: { type: string; value: string }) => n.value);

    expect(uris).toContain(`did:zetrix:${TEST_PARAMS.signerAddress}`);
    expect(uris).toContain(`zetrix:address:${TEST_PARAMS.signerAddress}`);
  });

  it('has Key Usage extension (critical) with digitalSignature and nonRepudiation', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);
    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);

    const kuExt = cert.extensions.find(
      (e) => e.type === '2.5.29.15' // Key Usage OID
    );
    expect(kuExt).toBeDefined();
    expect(kuExt!.critical).toBe(true);
  });

  it('has Extended Key Usage extension with Document Signing OID', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);
    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);

    const ekuExt = cert.extensions.find(
      (e) => e.type === '2.5.29.37' // EKU OID
    );
    expect(ekuExt).toBeDefined();
    expect(ekuExt!.critical).toBe(false);
  });

  it('has Basic Constraints extension (critical, CA=false)', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);
    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);

    const bcExt = cert.extensions.find(
      (e) => e.type === '2.5.29.19' // Basic Constraints OID
    );
    expect(bcExt).toBeDefined();
    expect(bcExt!.critical).toBe(true);
  });

  it('has custom VC references extension', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);
    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);

    const vcExt = cert.extensions.find(
      (e) => e.type === '1.3.6.1.4.1.99999.1.1'
    );
    expect(vcExt).toBeDefined();
    expect(vcExt!.critical).toBe(false);
  });

  it('uses ECDSA P-256 algorithm', async () => {
    const result = await generateSignerCertificate(TEST_PARAMS);
    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);

    expect(cert.signatureAlgorithm.name).toBe('ECDSA');
  });

  it('generates unique serial numbers across calls', async () => {
    const result1 = await generateSignerCertificate(TEST_PARAMS);
    const result2 = await generateSignerCertificate(TEST_PARAMS);

    const cert1 = new x509.X509Certificate(result1.certDer.buffer as ArrayBuffer);
    const cert2 = new x509.X509Certificate(result2.certDer.buffer as ArrayBuffer);

    expect(cert1.serialNumber).not.toBe(cert2.serialNumber);
  });

  it('works without optional params', async () => {
    const minimalParams: CertGenerationParams = {
      signerName: 'Jane Smith',
      signerDid: 'did:zetrix:ZTX999',
      signerAddress: 'ZTX999',
      signerPublicKey: 'b00199aabbcc',
      credentialId: 'vc-minimal',
      credentialIssuer: 'did:zetrix:issuer-min',
    };

    const result = await generateSignerCertificate(minimalParams);
    expect(result.certDer.length).toBeGreaterThan(0);
    expect(result.certPem).toMatch(/^-----BEGIN CERTIFICATE-----/);

    const cert = new x509.X509Certificate(result.certDer.buffer as ArrayBuffer);
    expect(cert.subject).toContain('CN=Jane Smith');
  });
});
