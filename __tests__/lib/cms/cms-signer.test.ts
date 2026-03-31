import 'reflect-metadata';
import { describe, it, expect, beforeAll } from 'vitest';
import { prepareSignedAttributes, buildCmsSignedData } from '@/lib/cms/cms-signer';
import { generateSignerCertificate } from '@/lib/cms/x509-cert';
import type { CertGenerationParams } from '@/types/cms';
import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { Crypto } from '@peculiar/webcrypto';

const crypto = new Crypto();

const TEST_PARAMS: CertGenerationParams = {
  signerName: 'CMS Test Signer',
  signerDid: 'did:zetrix:ZTXcmstest123',
  signerAddress: 'ZTXcmstest123',
  signerPublicKey: 'b00168cmstestkey456',
  credentialId: 'vc-cms-test-001',
  credentialIssuer: 'did:zetrix:issuer-cms',
  credentialType: 'ZetrixKYCCredential',
  vcVerifiedAt: '2026-03-31T00:00:00Z',
};

// Shared test fixtures generated once
let certDer: Uint8Array;
let signingKey: CryptoKey;
let documentHash: Uint8Array;

beforeAll(async () => {
  const certResult = await generateSignerCertificate(TEST_PARAMS);
  certDer = certResult.certDer;
  signingKey = certResult.signingKey;

  // Create a mock document hash (SHA-256 of some dummy content)
  const dummyContent = new TextEncoder().encode('Hello, this is a test PDF content.');
  const hashBuffer = await crypto.subtle.digest('SHA-256', dummyContent);
  documentHash = new Uint8Array(hashBuffer);
});

describe('prepareSignedAttributes', () => {
  it('returns non-empty signedAttrsDer', async () => {
    const result = await prepareSignedAttributes(documentHash, new Date(), certDer);

    expect(result.signedAttrsDer).toBeInstanceOf(Uint8Array);
    expect(result.signedAttrsDer.length).toBeGreaterThan(0);
  });

  it('returns a signedAttrsRaw object (pkijs SignedData)', async () => {
    const result = await prepareSignedAttributes(documentHash, new Date(), certDer);

    expect(result.signedAttrsRaw).toBeDefined();
    expect(result.signedAttrsRaw.signerInfos).toHaveLength(1);
    expect(result.signedAttrsRaw.certificates).toHaveLength(1);
  });

  it('signedAttrsDer starts with SET tag (0x31)', async () => {
    const result = await prepareSignedAttributes(documentHash, new Date(), certDer);

    // Per CMS spec, signed attributes are encoded with SET tag for signing
    expect(result.signedAttrsDer[0]).toBe(0x31);
  });

  it('includes three authenticated attributes', async () => {
    const result = await prepareSignedAttributes(documentHash, new Date(), certDer);
    const signerInfo = result.signedAttrsRaw.signerInfos[0];

    expect(signerInfo.signedAttrs).toBeDefined();
    expect(signerInfo.signedAttrs!.attributes).toHaveLength(3);
  });
});

describe('buildCmsSignedData', () => {
  it('returns a DER buffer', async () => {
    const prepared = await prepareSignedAttributes(documentHash, new Date(), certDer);
    const cms = await buildCmsSignedData(
      signingKey,
      prepared.signedAttrsDer,
      prepared.signedAttrsRaw,
      certDer,
      documentHash
    );

    expect(cms).toBeInstanceOf(Uint8Array);
    expect(cms.length).toBeGreaterThan(0);
  });

  it('output can be parsed back by pkijs as ContentInfo', async () => {
    const prepared = await prepareSignedAttributes(documentHash, new Date(), certDer);
    const cmsDer = await buildCmsSignedData(
      signingKey,
      prepared.signedAttrsDer,
      prepared.signedAttrsRaw,
      certDer,
      documentHash
    );

    // Parse as ASN.1
    const asn1 = asn1js.fromBER((cmsDer.buffer as ArrayBuffer).slice(cmsDer.byteOffset, cmsDer.byteOffset + cmsDer.byteLength));
    expect(asn1.offset).not.toBe(-1);

    // Parse as ContentInfo
    const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });
    expect(contentInfo.contentType).toBe('1.2.840.113549.1.7.2'); // signedData OID
  });

  it('output contains valid SignedData structure', async () => {
    const prepared = await prepareSignedAttributes(documentHash, new Date(), certDer);
    const cmsDer = await buildCmsSignedData(
      signingKey,
      prepared.signedAttrsDer,
      prepared.signedAttrsRaw,
      certDer,
      documentHash
    );

    // Parse ContentInfo and extract SignedData
    const asn1 = asn1js.fromBER((cmsDer.buffer as ArrayBuffer).slice(cmsDer.byteOffset, cmsDer.byteOffset + cmsDer.byteLength));
    const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });
    const signedData = new pkijs.SignedData({ schema: contentInfo.content });

    // Verify structure
    expect(signedData.version).toBe(1);
    expect(signedData.signerInfos).toHaveLength(1);
    expect(signedData.certificates).toBeDefined();
    expect(signedData.certificates!.length).toBe(1);
    expect(signedData.encapContentInfo.eContentType).toBe('1.2.840.113549.1.7.1');

    // Verify signer info has a signature
    const signerInfo = signedData.signerInfos[0];
    expect(signerInfo.signature).toBeDefined();
    expect(signerInfo.signature.valueBlock.valueHexView.length).toBeGreaterThan(0);
  });

  it('output is <= 16384 bytes (fits in PDF placeholder)', async () => {
    const prepared = await prepareSignedAttributes(documentHash, new Date(), certDer);
    const cmsDer = await buildCmsSignedData(
      signingKey,
      prepared.signedAttrsDer,
      prepared.signedAttrsRaw,
      certDer,
      documentHash
    );

    expect(cmsDer.length).toBeLessThanOrEqual(16384);
  });
});

describe('end-to-end CMS signing flow', () => {
  it('produces a complete CMS structure from cert generation through signing', async () => {
    // 1. Generate cert (already done in beforeAll, but do it fresh here)
    const certResult = await generateSignerCertificate(TEST_PARAMS);

    // 2. Create document hash
    const content = new TextEncoder().encode('End-to-end test PDF content');
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', content));

    // 3. Prepare signed attributes
    const prepared = await prepareSignedAttributes(hash, new Date(), certResult.certDer);

    // 4. Build complete CMS
    const cmsDer = await buildCmsSignedData(
      certResult.signingKey,
      prepared.signedAttrsDer,
      prepared.signedAttrsRaw,
      certResult.certDer,
      hash
    );

    // 5. Verify it parses correctly
    const asn1 = asn1js.fromBER((cmsDer.buffer as ArrayBuffer).slice(cmsDer.byteOffset, cmsDer.byteOffset + cmsDer.byteLength));
    expect(asn1.offset).not.toBe(-1);

    const contentInfo = new pkijs.ContentInfo({ schema: asn1.result });
    expect(contentInfo.contentType).toBe('1.2.840.113549.1.7.2');

    const signedData = new pkijs.SignedData({ schema: contentInfo.content });
    expect(signedData.signerInfos[0].signedAttrs).toBeDefined();
    expect(signedData.signerInfos[0].signedAttrs!.attributes.length).toBe(3);
  });
});
