import 'reflect-metadata';
import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { Crypto } from '@peculiar/webcrypto';
import { Signer } from '@signpdf/utils';

// Set up pkijs crypto engine with @peculiar/webcrypto
const crypto = new Crypto();
const engineName = 'zetrix-cms-engine';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
pkijs.setEngine(engineName, new pkijs.CryptoEngine({ name: engineName, crypto: crypto.subtle as any }));

/**
 * Pad a raw unsigned integer for ASN.1 DER INTEGER encoding.
 *
 * ASN.1 INTEGERs are signed (two's complement). If the MSB of a positive
 * integer's first byte is set (≥ 0x80), a 0x00 byte must be prepended to
 * prevent it from being interpreted as negative. Leading zero bytes that
 * aren't needed for sign disambiguation are also stripped for minimal DER.
 */
function padUnsignedInteger(raw: Uint8Array): Uint8Array {
  // Strip leading zeros (keep at least one byte)
  let start = 0;
  while (start < raw.length - 1 && raw[start] === 0) {
    start++;
  }
  const trimmed = raw.slice(start);

  // Prepend 0x00 if MSB is set (would be interpreted as negative)
  if (trimmed[0] & 0x80) {
    const padded = new Uint8Array(trimmed.length + 1);
    padded[0] = 0x00;
    padded.set(trimmed, 1);
    return padded;
  }
  return trimmed;
}

/**
 * Convert an IEEE P1363 ECDSA signature (r || s) to DER format
 * (SEQUENCE { INTEGER r, INTEGER s }) as required by CMS/PKCS#7.
 *
 * WebCrypto returns raw r||s but CMS expects DER-encoded ECDSA-Sig-Value.
 * The r and s values are properly zero-padded to avoid two's complement
 * misinterpretation per ASN.1 DER rules.
 */
function rawEcdsaToDer(rawSignature: ArrayBuffer): ArrayBuffer {
  const raw = new Uint8Array(rawSignature);
  const half = raw.length / 2;

  const rPadded = padUnsignedInteger(raw.slice(0, half));
  const sPadded = padUnsignedInteger(raw.slice(half));

  const rInt = new asn1js.Integer({
    valueHex: rPadded.buffer.slice(
      rPadded.byteOffset,
      rPadded.byteOffset + rPadded.byteLength
    ) as ArrayBuffer,
  });

  const sInt = new asn1js.Integer({
    valueHex: sPadded.buffer.slice(
      sPadded.byteOffset,
      sPadded.byteOffset + sPadded.byteLength
    ) as ArrayBuffer,
  });

  return new asn1js.Sequence({
    value: [rInt, sInt],
  }).toBER(false);
}

/**
 * Encode an array of CMS Attributes as a DER SET OF (tag 0x31) with
 * elements sorted in ascending lexicographic order of their DER encodings.
 *
 * This is required by RFC 5652 §5.4 for computing the message digest
 * over signedAttrs. PDF readers (Foxit, Adobe) enforce strict DER and
 * will re-sort when validating — if we don't sort identically, the
 * signature hash won't match.
 */
function encodeSignedAttrsDer(attributes: pkijs.Attribute[]): Uint8Array {
  // 1. DER-encode each attribute individually
  const encodedAttrs = attributes.map((attr) => {
    const schema = attr.toSchema();
    const ber = schema.toBER(false);
    return new Uint8Array(ber);
  });

  // 2. Sort lexicographically by their DER-encoded bytes
  encodedAttrs.sort((a, b) => {
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
  });

  // 3. Calculate total length of all encoded attributes
  const totalContentLength = encodedAttrs.reduce((sum, e) => sum + e.length, 0);

  // 4. Build the SET OF (tag 0x31) TLV manually with proper DER length encoding
  const lengthBytes = derEncodeLength(totalContentLength);
  const result = new Uint8Array(1 + lengthBytes.length + totalContentLength);
  result[0] = 0x31; // SET OF tag
  result.set(lengthBytes, 1);

  let offset = 1 + lengthBytes.length;
  for (const encoded of encodedAttrs) {
    result.set(encoded, offset);
    offset += encoded.length;
  }

  return result;
}

/**
 * DER length encoding: short form for lengths < 128,
 * long form (0x80 | numBytes, then length bytes big-endian) otherwise.
 */
function derEncodeLength(length: number): Uint8Array {
  if (length < 128) {
    return new Uint8Array([length]);
  }
  // Determine how many bytes needed to represent the length
  const bytes: number[] = [];
  let temp = length;
  while (temp > 0) {
    bytes.unshift(temp & 0xff);
    temp >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

/**
 * Custom CMS/PKCS#7 signer for @signpdf.
 *
 * @signpdf passes the concatenated byte ranges (the PDF content minus the
 * /Contents placeholder) to sign(). This signer:
 * 1. Hashes the byte range content (SHA-256)
 * 2. Builds CMS signed attributes with the hash as messageDigest
 * 3. Signs the attributes with the ephemeral ECDSA P-256 key
 * 4. Wraps everything in a ContentInfo → SignedData → DER
 */
export class EphemeralCmsSigner extends Signer {
  private certDer: Uint8Array;
  private signingKey: CryptoKey;
  private signingTime: Date;

  constructor(certDer: Uint8Array, signingKey: CryptoKey, signingTime: Date) {
    super();
    this.certDer = certDer;
    this.signingKey = signingKey;
    this.signingTime = signingTime;
  }

  async sign(pdfBuffer: Buffer): Promise<Buffer> {
    // 1. Compute SHA-256 of the byte range content
    //    Explicitly enforce memory boundaries to avoid Node.js Buffer pool issues:
    //    Buffer.from() may share an underlying ArrayBuffer with other allocations,
    //    so we must pass a properly-scoped Uint8Array to WebCrypto.
    const safeBytes = new Uint8Array(
      pdfBuffer.buffer,
      pdfBuffer.byteOffset,
      pdfBuffer.byteLength
    );
    const hashBuffer = await crypto.subtle.digest('SHA-256', safeBytes as ArrayBufferView<ArrayBuffer>);
    const documentHash = new Uint8Array(hashBuffer);

    // 2. Parse the DER-encoded X.509 certificate
    const certBuf = this.certDer.buffer.slice(
      this.certDer.byteOffset,
      this.certDer.byteOffset + this.certDer.byteLength
    ) as ArrayBuffer;
    const asn1Cert = asn1js.fromBER(certBuf);
    if (asn1Cert.offset === -1) {
      throw new Error('Failed to parse certificate DER');
    }
    const cert = new pkijs.Certificate({ schema: asn1Cert.result });

    // 3. Build the three authenticated attributes
    const contentTypeAttr = new pkijs.Attribute({
      type: '1.2.840.113549.1.9.3', // contentType
      values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })], // data
    });

    const signingTimeAttr = new pkijs.Attribute({
      type: '1.2.840.113549.1.9.5', // signingTime
      values: [new asn1js.UTCTime({ valueDate: this.signingTime })],
    });

    const messageDigestAttr = new pkijs.Attribute({
      type: '1.2.840.113549.1.9.4', // messageDigest
      values: [
        new asn1js.OctetString({
          valueHex: documentHash.buffer.slice(
            documentHash.byteOffset,
            documentHash.byteOffset + documentHash.byteLength
          ) as ArrayBuffer,
        }),
      ],
    });

    // 4. Build SignerInfo
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

    // 5. Build SignedData
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

    // 6. Encode signed attributes to DER with proper lexicographic sorting.
    //
    //    Per RFC 5652 §5.4, when signing, the IMPLICIT [0] tag (0xA0) on
    //    signedAttrs must be replaced with an EXPLICIT SET OF tag (0x31).
    //    Additionally, DER requires SET OF elements to be sorted in
    //    ascending lexicographic order of their encoded bytes.
    //
    //    pkijs.toBER() produces BER which does NOT sort SET OF elements.
    //    Simply swapping 0xA0→0x31 without sorting causes Foxit/Adobe to
    //    compute a different hash (they re-encode with proper DER sorting),
    //    resulting in "altered or corrupted" validation failure.
    const signedAttrsDerBytes = encodeSignedAttrsDer(
      [contentTypeAttr, signingTimeAttr, messageDigestAttr]
    );

    // 7. Sign the encoded attributes with ECDSA P-256
    const rawSig = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      this.signingKey,
      signedAttrsDerBytes as ArrayBufferView<ArrayBuffer>
    );

    // 8. Convert raw ECDSA (r||s) to DER format for CMS
    const derSig = rawEcdsaToDer(rawSig);

    // 9. Set the signature on SignerInfo
    signedData.signerInfos[0].signature = new asn1js.OctetString({
      valueHex: derSig,
    });

    // 10. Wrap in ContentInfo and export as DER
    const cms = new pkijs.ContentInfo({
      contentType: '1.2.840.113549.1.7.2', // signedData
      content: signedData.toSchema(true),
    });

    return Buffer.from(new Uint8Array(cms.toSchema().toBER(false)));
  }
}
