# CMS/PKCS#7 PDF Signing — Step-by-Step Technical Flow

> **Purpose:** Detailed technical breakdown of the CMS/PKCS#7 signing implementation for debugging and review.
> **Status:** Signature validates as "altered or corrupted" in Foxit PDF Reader — diagnosis needed.

---

## Goal

Produce a PDF with an embedded CMS/PKCS#7 detached signature that Adobe Acrobat and Foxit PDF Reader recognize as valid (or "validity unknown" for self-signed certs).

**Current issue:** Foxit shows **"The document has been altered or corrupted since the Signature was applied"**, meaning either:
- The byte-range hash doesn't match the `messageDigest` signed attribute, OR
- The ECDSA signature over the signed attributes doesn't verify

---

## Libraries Used

| Library | Version | Purpose |
|---------|---------|---------|
| `pdf-lib` | 1.x | PDF manipulation (visual signature client-side, XMP + placeholder server-side) |
| `@signpdf/signpdf` | 3.3.0 | Handles ByteRange extraction, placeholder replacement, CMS DER injection |
| `@signpdf/placeholder-pdf-lib` | 3.3.0 | Adds `/Sig` placeholder to pdf-lib PDFDocument |
| `pkijs` | 3.4.0 | Builds CMS SignedData structure (RFC 5652) |
| `asn1js` | 3.0.7 | ASN.1 DER encoding |
| `@peculiar/webcrypto` | 1.5.0 | WebCrypto implementation for Node.js server-side |
| `@peculiar/x509` | 2.0.0 | X.509 v3 certificate generation |

## Environment

- Next.js 14+ (App Router), TypeScript, Node.js server-side API routes
- ECDSA P-256 key pair (ephemeral, generated per signing session on the server)
- Self-signed X.509 v3 certificate (not from a trusted CA)

---

## Phase 1: PDF Preparation

**File:** `src/lib/cms/pdf-cms-sign.ts` — `preparePdfForSigning()`

**Input:** PDF bytes with visual signature already embedded by pdf-lib on the client side.

### Step 1.1: Load PDF

```js
const pdfDoc = await PDFDocument.load(pdfBytes);
```

### Step 1.2: Embed VC XMP Metadata

Creates a `/Metadata` stream on the catalog containing XML with signer identity (name, DID, wallet address). This metadata is covered by the CMS signature (it's part of the byte ranges).

```js
const metadataStream = context.stream(xmpXml, {
  Type: 'Metadata',
  Subtype: 'XML',
});
const metadataRef = context.register(metadataStream);
pdfDoc.catalog.set(PDFName.of('Metadata'), metadataRef);
```

The XMP XML uses a custom namespace `https://zetrix.com/ns/pdfsig/1.0/` with attributes like `zetrix:SignerName`, `zetrix:SignerDID`, `zetrix:CredentialId`, etc.

### Step 1.3: Add Signature Placeholder

Uses `@signpdf/placeholder-pdf-lib` to add a `/Sig` dictionary:

```js
pdflibAddPlaceholder({
  pdfDoc,
  reason: 'Digitally signed with Zetrix blockchain key, identity verified via Verifiable Credentials',
  location: 'Kuala Lumpur, Malaysia',
  name: signerName,
  contactInfo: 'verify@zetrix.com',
  signingTime,
  signatureLength: 16384,    // max bytes for CMS DER
  subFilter: SUBFILTER_ADOBE_PKCS7_DETACHED,
  widgetRect: [0, 0, 0, 0],  // invisible signature widget
});
```

This creates in the PDF:
- `/SubFilter /adbe.pkcs7.detached`
- `/ByteRange [0 /********** /********** /**********]` (placeholder values)
- `/Contents <0000...0000>` (32768 hex chars = 16384 bytes placeholder)
- `/Name (John Tan)`
- `/Reason (Digitally signed with Zetrix...)`
- `/Location (Kuala Lumpur, Malaysia)`

### Step 1.4: Save

```js
const savedBytes = await pdfDoc.save();
return new Uint8Array(savedBytes);
```

**Output:** `Uint8Array` — PDF with placeholder (ByteRange has `/**********` stars, `/Contents` has zeroes).

---

## Phase 2: Signing with @signpdf

**File:** `src/app/api/signing/cms-sign/route.ts`

**Input:** PDF with placeholder + `EphemeralCmsSigner` instance.

```js
const signPdf = new SignPdf();
const signedPdfBuffer = await signPdf.sign(pdfWithPlaceholder, signer, signingTime);
```

### What @signpdf Does Internally (from its v3.3.0 source code)

#### Step 2.1: Remove Trailing Newline
```js
let pdf = removeTrailingNewLine(convertBuffer(pdfBuffer, 'PDF'));
```
If the PDF ends with `\n`, that byte is stripped.

#### Step 2.2: Find ByteRange Placeholder
Locates the `/ByteRange [0 /********** /********** /**********]` string in the PDF.

#### Step 2.3: Calculate Actual ByteRange
Finds `/Contents <...>` after the ByteRange placeholder:
```js
const contentsTagPos = pdf.indexOf('/Contents ', byteRangeEnd);
const placeholderPos = pdf.indexOf('<', contentsTagPos);
const placeholderEnd = pdf.indexOf('>', placeholderPos);

byteRange[0] = 0;
byteRange[1] = placeholderPos;               // position of '<'
byteRange[2] = placeholderPos + placeholderLengthWithBrackets;  // position after '>'
byteRange[3] = pdf.length - byteRange[2];    // remaining bytes
```

#### Step 2.4: Replace ByteRange Placeholder
Writes actual integer values into the ByteRange field, padded with spaces to maintain exact byte length:
```js
let actualByteRange = `/ByteRange [${byteRange.join(' ')}]`;
actualByteRange += ' '.repeat(byteRangePlaceholder.length - actualByteRange.length);
pdf = Buffer.concat([
  pdf.slice(0, byteRangePlaceholderPosition),
  Buffer.from(actualByteRange),
  pdf.slice(byteRangeEnd)
]);
```

#### Step 2.5: Concatenate Byte Ranges (Remove /Contents)
Creates a Buffer of only the signed content — everything EXCEPT the `/Contents <hex>`:
```js
pdf = Buffer.concat([
  pdf.slice(0, byteRange[1]),
  pdf.slice(byteRange[2], byteRange[2] + byteRange[3])
]);
```

**This concatenated buffer is what gets passed to our signer.**

#### Step 2.6: Call Signer
```js
const raw = await signer.sign(pdf, signingTime);
```
Our `EphemeralCmsSigner.sign()` receives the concatenated byte ranges and returns CMS DER bytes.

#### Step 2.7: Inject CMS Back Into PDF
```js
let signature = Buffer.from(raw, 'binary').toString('hex');
signature += Buffer.from(
  String.fromCharCode(0).repeat(placeholderLength / 2 - raw.length)
).toString('hex');
pdf = Buffer.concat([
  pdf.slice(0, byteRange[1]),
  Buffer.from(`<${signature}>`),
  pdf.slice(byteRange[1])
]);
```

**Output:** `Buffer` — the fully signed PDF with CMS DER injected into `/Contents`.

---

## Phase 3: CMS Construction

**File:** `src/lib/cms/cms-signer.ts` — `EphemeralCmsSigner.sign()`

**Input:** `Buffer` containing the concatenated byte ranges (from @signpdf step 2.5).

### Step 3.1: Hash the Byte Range Content

```js
const hashBuffer = await crypto.subtle.digest('SHA-256', pdfBuffer as unknown as ArrayBuffer);
const documentHash = new Uint8Array(hashBuffer);  // 32 bytes
```

**Note:** `crypto` here is `new Crypto()` from `@peculiar/webcrypto`, NOT the global Node.js crypto. The `pdfBuffer` is a Node.js `Buffer` (subclass of `Uint8Array`), cast to `ArrayBuffer` for `crypto.subtle.digest`.

### Step 3.2: Parse the X.509 Certificate

```js
const certBuf = this.certDer.buffer.slice(
  this.certDer.byteOffset,
  this.certDer.byteOffset + this.certDer.byteLength
) as ArrayBuffer;
const asn1Cert = asn1js.fromBER(certBuf);
const cert = new pkijs.Certificate({ schema: asn1Cert.result });
```

Certificate was generated by `@peculiar/x509.X509CertificateGenerator.createSelfSigned()`:
- **Algorithm:** ECDSA P-256 with SHA-256
- **Subject:** `CN=John Tan, O=Zetrix AI Berhad, C=MY`
- **Key Usage:** digitalSignature + nonRepudiation (critical)
- **Extended Key Usage:** Document Signing (`1.3.6.1.4.1.311.10.3.12`)
- **Basic Constraints:** CA=false (critical)
- **SAN:** URIs for DID and Zetrix address

### Step 3.3: Build Signed Attributes

Three attributes in a SET:

```js
// 1. Content Type (OID 1.2.840.113549.1.9.3)
const contentTypeAttr = new pkijs.Attribute({
  type: '1.2.840.113549.1.9.3',
  values: [new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })],  // data
});

// 2. Signing Time (OID 1.2.840.113549.1.9.5)
const signingTimeAttr = new pkijs.Attribute({
  type: '1.2.840.113549.1.9.5',
  values: [new asn1js.UTCTime({ valueDate: this.signingTime })],
});

// 3. Message Digest (OID 1.2.840.113549.1.9.4)
const messageDigestAttr = new pkijs.Attribute({
  type: '1.2.840.113549.1.9.4',
  values: [new asn1js.OctetString({
    valueHex: documentHash.buffer.slice(
      documentHash.byteOffset,
      documentHash.byteOffset + documentHash.byteLength
    ) as ArrayBuffer,
  })],
});
```

### Step 3.4: Build SignerInfo

```js
const signerInfo = new pkijs.SignerInfo({
  version: 1,
  sid: new pkijs.IssuerAndSerialNumber({
    issuer: cert.issuer,
    serialNumber: cert.serialNumber,
  }),
  digestAlgorithm: new pkijs.AlgorithmIdentifier({
    algorithmId: '2.16.840.1.101.3.4.2.1',  // SHA-256
  }),
  signatureAlgorithm: new pkijs.AlgorithmIdentifier({
    algorithmId: '1.2.840.10045.4.3.2',  // ECDSA-with-SHA256
  }),
  signedAttrs: new pkijs.SignedAndUnsignedAttributes({
    type: 0,  // signed attributes
    attributes: [contentTypeAttr, signingTimeAttr, messageDigestAttr],
  }),
});
```

### Step 3.5: Build SignedData

```js
const signedData = new pkijs.SignedData({
  version: 1,
  digestAlgorithms: [
    new pkijs.AlgorithmIdentifier({
      algorithmId: '2.16.840.1.101.3.4.2.1',  // SHA-256
    }),
  ],
  encapContentInfo: new pkijs.EncapsulatedContentInfo({
    eContentType: '1.2.840.113549.1.7.1',  // data (detached, no eContent)
  }),
  certificates: [cert],
  signerInfos: [signerInfo],
});
```

### Step 3.6: Encode Signed Attributes for Signing

Per RFC 5652 Section 5.4, signed attributes must be DER-encoded as a SET (tag 0x31) for signing, even though they're stored with IMPLICIT [0] tag (0xA0) in the CMS structure.

```js
const signedAttrsSchema = signerInfo.signedAttrs!.toSchema();
const signedAttrsBer = signedAttrsSchema.toBER(false);
const signedAttrsDerBytes = new Uint8Array(signedAttrsBer);

// pkijs outputs tag 0xA0 (implicit [0]). Change to 0x31 (SET) for signing.
if (signedAttrsDerBytes[0] === 0xA0) {
  signedAttrsDerBytes[0] = 0x31;
}
```

### Step 3.7: Sign with ECDSA P-256

```js
const rawSig = await crypto.subtle.sign(
  { name: 'ECDSA', hash: 'SHA-256' },
  this.signingKey,      // ephemeral P-256 private key from cert generation
  signedAttrsDerBytes   // the 0x31-tagged signed attributes
);
// rawSig is IEEE P1363 format: r || s (64 bytes for P-256)
```

**Important:** `crypto.subtle.sign` with ECDSA and `hash: 'SHA-256'` first hashes the input with SHA-256, then signs the hash. So the actual data signed is `SHA-256(signedAttrsDerBytes)`, not `signedAttrsDerBytes` directly.

### Step 3.8: Convert ECDSA Signature to DER Format

WebCrypto returns IEEE P1363 format (`r || s`, 64 bytes). CMS/PKCS#7 requires DER-encoded ECDSA-Sig-Value (`SEQUENCE { INTEGER r, INTEGER s }`, ~70-72 bytes).

```js
function rawEcdsaToDer(rawSignature: ArrayBuffer): ArrayBuffer {
  const raw = new Uint8Array(rawSignature);
  const half = raw.length / 2;  // 32 for P-256

  const rRaw = raw.slice(0, half);
  const sRaw = raw.slice(half);

  const rInt = new asn1js.Integer({ valueHex: new ArrayBuffer(rRaw.length) });
  new Uint8Array(rInt.valueBlock.valueHexView).set(rRaw);

  const sInt = new asn1js.Integer({ valueHex: new ArrayBuffer(sRaw.length) });
  new Uint8Array(sInt.valueBlock.valueHexView).set(sRaw);

  return new asn1js.Sequence({
    value: [rInt.convertToDER(), sInt.convertToDER()],
  }).toBER(false);
}
```

`convertToDER()` on `asn1js.Integer` handles:
- Stripping leading zero bytes
- Adding a leading `0x00` byte if the high bit is set (to prevent the integer being interpreted as negative)

### Step 3.9: Set Signature on SignerInfo

```js
signedData.signerInfos[0].signature = new asn1js.OctetString({
  valueHex: derSignature,
});
```

### Step 3.10: Wrap in ContentInfo and Export

```js
const cms = new pkijs.ContentInfo({
  contentType: '1.2.840.113549.1.7.2',  // signedData
  content: signedData.toSchema(true),
});

return Buffer.from(new Uint8Array(cms.toSchema().toBER(false)));
```

**Output:** `Buffer` containing DER-encoded CMS ContentInfo.

---

## What Foxit Does When Validating

1. **Read** `/ByteRange [0, X, Y, Z]` from the `/Sig` dictionary
2. **Extract** `bytes[0..X)` and `bytes[Y..Y+Z)` from the PDF file
3. **Hash** the concatenation of those byte ranges with SHA-256
4. **Parse** the CMS ContentInfo from `/Contents`
5. **Extract** the `messageDigest` attribute from SignerInfo's signedAttrs
6. **Compare** the computed hash (step 3) with messageDigest (step 5)
   - If mismatch → **"The document has been altered or corrupted"**
7. **Re-encode** the signed attributes with tag `0x31` (SET)
8. **Verify** the ECDSA signature over the re-encoded attributes using the cert's public key
   - If fails → **"The document has been altered or corrupted"** (same message)
9. **Check** certificate trust chain
   - If self-signed / untrusted → **"Signature validity is unknown"** (this is expected)

**Current result:** Step 6 or 8 fails.

---

## Possible Issues to Investigate

1. **Buffer/ArrayBuffer conversion in `crypto.subtle.digest`:** The `pdfBuffer` parameter is a Node.js `Buffer`. The cast `pdfBuffer as unknown as ArrayBuffer` — does `@peculiar/webcrypto` correctly handle a Buffer input to `digest()`? Could it be hashing different bytes than what @signpdf provides?

2. **BER vs DER encoding of signed attributes:** pkijs uses `toBER(false)` — is the output canonical DER? If pkijs produces non-canonical BER (e.g., different length encoding), and Foxit re-encodes with canonical DER when verifying, the bytes would differ and signature verification would fail.

3. **Signed attributes stored in CMS:** After we change byte 0 from `0xA0` to `0x31` for signing, the actual signed attributes in the final CMS structure still have tag `0xA0` (because we only modified the copy used for signing). When Foxit extracts the signed attributes from the CMS, it re-encodes with `0x31` — but does it get the exact same bytes as what we signed?

4. **`signedData.toSchema(true)` encoding:** Does pkijs re-serialize the signed attributes when building the final CMS? If it re-serializes them differently from how they were encoded in step 3.6, the bytes stored in the CMS won't match what was signed.

5. **ECDSA DER conversion:** Is `asn1js.Integer.convertToDER()` producing correct output? For example, if `r` or `s` has leading zeroes, does it handle them correctly?

6. **Certificate parsed by pkijs:** The cert was generated by `@peculiar/x509` and parsed by `pkijs`. Are these compatible? Could the issuer/serialNumber in SignerInfo not match what Foxit extracts from the embedded cert?

7. **`@peculiar/webcrypto` vs pkijs crypto engine:** The signing key was generated by `@peculiar/x509` (which uses its own `Crypto` instance). The signing in `EphemeralCmsSigner` uses a different `@peculiar/webcrypto` `Crypto` instance. Is the `CryptoKey` transferable between instances?

---

## CMS Structure Summary (Expected DER)

```
ContentInfo {
  contentType: 1.2.840.113549.1.7.2 (signedData)
  content: SignedData {
    version: 1
    digestAlgorithms: { SHA-256 }
    encapContentInfo: {
      eContentType: 1.2.840.113549.1.7.1 (data)
      // no eContent (detached signature)
    }
    certificates: [
      X.509 v3 Certificate (self-signed, ECDSA P-256)
    ]
    signerInfos: [
      SignerInfo {
        version: 1
        sid: IssuerAndSerialNumber
        digestAlgorithm: SHA-256
        signedAttrs [0] IMPLICIT {
          contentType: 1.2.840.113549.1.7.1
          signingTime: UTCTime
          messageDigest: OCTET STRING (32 bytes SHA-256)
        }
        signatureAlgorithm: ECDSA-with-SHA256 (1.2.840.10045.4.3.2)
        signature: OCTET STRING (DER-encoded SEQUENCE { INTEGER r, INTEGER s })
      }
    ]
  }
}
```

---

*Last updated: 2026-04-01*
