import 'reflect-metadata';
import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { Crypto } from '@peculiar/webcrypto';

// Set up pkijs crypto engine with @peculiar/webcrypto
const crypto = new Crypto();
const engineName = 'zetrix-cms-engine';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
pkijs.setEngine(engineName, new pkijs.CryptoEngine({ name: engineName, crypto: crypto.subtle as any }));

/**
 * Prepare the authenticated attributes and return DER for signing.
 *
 * Builds a partial pkijs SignedData structure with the signer's certificate,
 * digest algorithms, and signer info. Returns the DER-encoded signed attributes
 * (which will be signed in the second phase) and the raw SignedData object for
 * later assembly.
 */
export async function prepareSignedAttributes(
  documentHash: Uint8Array,
  signingTime: Date,
  certDer: Uint8Array
): Promise<{
  signedAttrsDer: Uint8Array;
  signedAttrsRaw: pkijs.SignedData;
}> {
  // Parse the DER-encoded X.509 certificate
  const certBuf = certDer.buffer.slice(certDer.byteOffset, certDer.byteOffset + certDer.byteLength) as ArrayBuffer;
  const asn1Cert = asn1js.fromBER(certBuf);
  if (asn1Cert.offset === -1) {
    throw new Error('Failed to parse certificate DER');
  }
  const cert = new pkijs.Certificate({ schema: asn1Cert.result });

  // Build the three authenticated attributes
  const contentTypeAttr = new pkijs.Attribute({
    type: '1.2.840.113549.1.9.3', // contentType
    values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })], // data
  });

  const signingTimeAttr = new pkijs.Attribute({
    type: '1.2.840.113549.1.9.5', // signingTime
    values: [new asn1js.UTCTime({ valueDate: signingTime })],
  });

  const messageDigestAttr = new pkijs.Attribute({
    type: '1.2.840.113549.1.9.4', // messageDigest
    values: [new asn1js.OctetString({ valueHex: documentHash.buffer.slice(documentHash.byteOffset, documentHash.byteOffset + documentHash.byteLength) as ArrayBuffer })],
  });

  // Build SignerInfo
  const signerInfo = new pkijs.SignerInfo({
    version: 1,
    sid: new pkijs.IssuerAndSerialNumber({
      issuer: cert.issuer,
      serialNumber: cert.serialNumber,
    }),
    digestAlgorithm: new pkijs.AlgorithmIdentifier({
      algorithmId: '2.16.840.1.101.3.4.2.1', // SHA-256
    }),
    signatureAlgorithm: new pkijs.AlgorithmIdentifier({
      algorithmId: '1.2.840.10045.4.3.2', // ECDSA-with-SHA256
    }),
    signedAttrs: new pkijs.SignedAndUnsignedAttributes({
      type: 0, // signed attributes
      attributes: [contentTypeAttr, signingTimeAttr, messageDigestAttr],
    }),
  });

  // Build partial SignedData
  const signedData = new pkijs.SignedData({
    version: 1,
    digestAlgorithms: [
      new pkijs.AlgorithmIdentifier({
        algorithmId: '2.16.840.1.101.3.4.2.1', // SHA-256
      }),
    ],
    encapContentInfo: new pkijs.EncapsulatedContentInfo({
      eContentType: '1.2.840.113549.1.7.1', // data (detached — no eContent)
    }),
    certificates: [cert],
    signerInfos: [signerInfo],
  });

  // Encode the signed attributes to DER for external signing.
  // Per CMS spec, the attributes are encoded as a SET (tag 0x31) for signing.
  const signedAttrsSchema = signerInfo.signedAttrs!.toSchema();
  const signedAttrsBer = signedAttrsSchema.toBER(false);
  const signedAttrsDerBytes = new Uint8Array(signedAttrsBer);

  // Replace the implicit [0] tag (0xA0) with SET tag (0x31) for signing
  if (signedAttrsDerBytes[0] === 0xa0) {
    signedAttrsDerBytes[0] = 0x31;
  }

  return {
    signedAttrsDer: signedAttrsDerBytes,
    signedAttrsRaw: signedData,
  };
}

/**
 * Assemble the complete CMS SignedData and sign it with the server's private key.
 *
 * Takes the partially-built SignedData from prepareSignedAttributes, signs
 * the authenticated attributes with the ECDSA P-256 private key, and wraps
 * everything in a ContentInfo structure.
 *
 * Returns the DER-encoded ContentInfo (complete CMS/PKCS#7 signature).
 */
export async function buildCmsSignedData(
  signingKey: CryptoKey,
  signedAttrsDer: Uint8Array,
  signedAttrsRaw: pkijs.SignedData,
  certDer: Uint8Array,
  documentHash: Uint8Array
): Promise<Uint8Array> {
  // Sign the DER-encoded signed attributes using the ECDSA P-256 private key
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey,
    signedAttrsDer as ArrayBufferView<ArrayBuffer>
  );

  // Set the signature on the signer info
  signedAttrsRaw.signerInfos[0].signature = new asn1js.OctetString({
    valueHex: signature,
  });

  // Wrap in ContentInfo
  const cms = new pkijs.ContentInfo({
    contentType: '1.2.840.113549.1.7.2', // signedData
    content: signedAttrsRaw.toSchema(true),
  });

  // Export as DER
  const cmsder = cms.toSchema().toBER(false);
  return new Uint8Array(cmsder);
}
