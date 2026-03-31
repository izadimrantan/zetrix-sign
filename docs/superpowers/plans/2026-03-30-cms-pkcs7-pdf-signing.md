# CMS/PKCS#7 PDF Signing — Implementation Plan

**Date:** 2026-03-30
**Spec:** `docs/superpowers/specs/2026-03-30-cms-pkcs7-pdf-signing-design.md`
**Status:** Draft

---

## File Structure Map

### New Files

```
web/
├── src/
│   ├── lib/
│   │   ├── cms/
│   │   │   ├── x509-cert.ts          # X.509 certificate generation
│   │   │   ├── cms-signer.ts         # Custom CMS/PKCS#7 SignedData builder
│   │   │   ├── pdf-cms-sign.ts       # Full CMS signing pipeline (server-side)
│   │   │   ├── xmp-metadata.ts       # XMP XML construction helpers
│   │   │   └── incremental-update.ts # Post-signature incremental PDF update
│   │   └── signing-session-store.ts  # In-memory server-side session store for CMS flow
│   ├── app/
│   │   └── api/
│   │       └── signing/
│   │           ├── cms-sign/route.ts      # Phase 1: Prep PDF + return hash
│   │           ├── cms-complete/route.ts  # Phase 2: Inject wallet signature
│   │           └── cms-anchor/route.ts    # Phase 3: Append anchor XMP
│   └── types/
│       └── cms.ts                    # CMS-specific type definitions
├── package.json                      # New dependencies added
```

### Modified Files

```
web/
├── src/
│   ├── components/
│   │   └── signing/
│   │       └── step-anchoring.tsx    # Updated sub-steps for CMS flow
│   ├── types/
│   │   └── signing.ts               # Extended SigningSession type
│   └── lib/
│       └── blockchain.ts            # New function for anchor XMP step
```

---

## Chunk 1: Foundation — Types, X.509, XMP

### Task 1: Define CMS Types

**File:** `src/types/cms.ts`

```typescript
// CMS signing session (server-side, in-memory)
export interface CmsSigningSession {
  id: string;
  pdfBytesWithPlaceholder: Uint8Array;
  byteRange: [number, number, number, number];
  cert: Uint8Array;             // DER-encoded X.509 cert
  signerPublicKey: string;      // Hex-encoded
  signedAttrsDer: Uint8Array;   // DER of authenticated attributes
  documentHash: string;         // SHA-256 of byte ranges
  createdAt: number;
  expiresAt: number;            // Auto-expire after 5 minutes
}

// API request/response types
export interface CmsSignRequest {
  pdfBase64: string;
  signerName: string;
  signerDid: string;
  signerAddress: string;
  signerPublicKey: string;
  credentialId: string;
  credentialIssuer: string;
}

export interface CmsSignResponse {
  hashToSign: string;           // Hex-encoded DER of signedAttrs
  sessionId: string;
}

export interface CmsCompleteRequest {
  sessionId: string;
  walletSignature: string;      // Hex-encoded
}

export interface CmsCompleteResponse {
  signedPdfBase64: string;
  documentHash: string;
}

export interface CmsAnchorRequest {
  signedPdfBase64: string;
  txHash: string;
  blockNumber: number;
  blockTimestamp: string;
  documentHash: string;
  chainId: string;
}

export interface CmsAnchorResponse {
  finalPdfBase64: string;
}
```

**Steps:**
1. Create `src/types/cms.ts` with the types above
2. Extend `SigningSession` in `src/types/signing.ts` to add `cmsSignedPdfBytes?: Uint8Array` and `anchorVersion?: string`

---

### Task 2: Install Dependencies

```bash
cd web
npm install @peculiar/x509 @signpdf/signpdf @signpdf/placeholder-pdf-lib pkijs asn1js
```

**Note on `muhammara`:** Defer installation until Chunk 3. If native addon is problematic on the deployment target, implement manual byte-level incremental update instead.

**Steps:**
1. Run `npm install` for the 5 packages above
2. Verify build still passes (`npm run build`)
3. Check that `@signpdf/placeholder-pdf-lib` is compatible with the project's `pdf-lib` version

---

### Task 3: X.509 Certificate Generation

**File:** `src/lib/cms/x509-cert.ts`

Generates a self-signed X.509 v3 certificate wrapping the signer's public key.

**Function signature:**
```typescript
export async function generateSignerCertificate(params: {
  signerName: string;
  signerDid: string;
  signerAddress: string;
  signerPublicKey: string;       // Hex-encoded secp256k1 or Ed25519 public key
  credentialId: string;
  credentialIssuer: string;
  credentialType?: string;
  vcVerifiedAt?: string;
}): Promise<{
  certDer: Uint8Array;           // DER-encoded certificate
  certPem: string;               // PEM for debugging
  signingKey: CryptoKey;         // Ephemeral key that signed the cert
}>
```

**Implementation details:**
1. Import secp256k1 public key as WebCrypto `CryptoKey` (ECDSA P-256k1 or fallback)
2. Generate ephemeral signing keypair (for cert self-signature — NOT the document signature)
3. Build cert with `@peculiar/x509`:
   - Subject/Issuer: `CN={name}, O=Zetrix AI Berhad, C=MY`
   - Validity: now → now + 1 year
   - SAN: two URIs (DID + zetrix address)
   - Key Usage: digitalSignature + nonRepudiation
   - Extended Key Usage: Document Signing OID
   - Basic Constraints: CA=false
   - Custom extension: VC references JSON
4. Export DER and PEM

**Important WebCrypto note:** Node.js native WebCrypto may not support secp256k1 (it supports P-256, P-384, P-521). If secp256k1 is needed:
- Use `@peculiar/webcrypto` which has broader curve support
- Or import the raw public key bytes directly into the cert structure via ASN.1 without WebCrypto key import

**Steps:**
1. Create the file with the function
2. Write a unit test that generates a cert and parses it back to verify extensions
3. Handle the secp256k1 vs P-256 WebCrypto limitation

---

### Task 4: XMP Metadata Builder

**File:** `src/lib/cms/xmp-metadata.ts`

Constructs XMP XML strings for VC identity and blockchain anchor metadata.

**Functions:**
```typescript
// Build VC identity XMP (embedded before CMS signing)
export function buildVcXmp(params: {
  signerName: string;
  signerDid: string;
  signerAddress: string;
  credentialId: string;
  credentialIssuer: string;
  vcVerifiedAt: string;
}): string   // Returns XMP XML string

// Build anchor XMP (appended after CMS signing)
export function buildAnchorXmp(params: {
  documentHash: string;
  hashAlgorithm: string;
  hashScope: string;
  txHash: string;
  blockNumber: number;
  blockTimestamp: string;
  chainId: string;
  verificationUrl: string;
}): string   // Returns XMP XML string

// Merge new XMP into existing PDF XMP metadata
export function mergeXmpIntoExisting(
  existingXmp: string | null,
  newXmp: string
): string
```

**XMP XML structure:**
```xml
<?xpacket begin="..." id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:zetrix="https://zetrix.com/ns/pdfsig/1.0/"
      zetrix:SignerName="John Tan"
      zetrix:SignerDID="did:zetrix:ZTX3..."
      ...
    />
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
```

**Steps:**
1. Create the file with both builder functions
2. Write unit tests verifying valid XMP XML output
3. Test `mergeXmpIntoExisting` with and without pre-existing XMP

---

## Chunk 2: CMS Signing Pipeline

### Task 5: PDF Signature Placeholder

**File:** `src/lib/cms/pdf-cms-sign.ts` (partial — placeholder step)

**Function:**
```typescript
export async function preparePdfForSigning(
  pdfBytes: Uint8Array,
  signerName: string,
  signingTime: Date
): Promise<{
  pdfWithPlaceholder: Uint8Array;
  byteRange: [number, number, number, number];
}>
```

**Implementation:**
1. Load PDF with `pdf-lib`
2. Embed VC XMP metadata (call `buildVcXmp` + inject into PDF metadata)
3. Use `@signpdf/placeholder-pdf-lib` to add `/Sig` dictionary
4. Configure placeholder with 16384 bytes reserved, SubFilter `adbe.pkcs7.detached`
5. Save PDF and extract `ByteRange` values

**Steps:**
1. Implement placeholder injection
2. Verify that the placeholder is correctly positioned in the PDF
3. Test with various PDF sizes (small, large, multi-page)

---

### Task 6: Custom CMS Signer

**File:** `src/lib/cms/cms-signer.ts`

This is the most complex component. Builds a CMS `SignedData` structure compatible with PDF detached signatures.

**Functions:**
```typescript
// Prepare the authenticated attributes and return DER for wallet signing
export async function prepareSignedAttributes(
  documentHash: Uint8Array,      // SHA-256 of PDF byte ranges
  signingTime: Date,
  cert: Uint8Array               // DER-encoded X.509 cert
): Promise<{
  signedAttrsDer: Uint8Array;    // DER to be signed by wallet
  signedAttrsSet: any;           // pkijs attribute objects (for later assembly)
}>

// Assemble the complete CMS SignedData from wallet signature
export async function buildCmsSignedData(
  walletSignature: Uint8Array,   // Raw signature from wallet
  signedAttrsSet: any,           // From prepareSignedAttributes
  cert: Uint8Array,              // DER X.509 cert
  digestAlgorithm: string        // "SHA-256"
): Promise<Uint8Array>           // DER-encoded ContentInfo (CMS)
```

**CMS structure built with pkijs:**
1. Create `SignedData` with version 1
2. Add SHA-256 to `digestAlgorithms`
3. Set `encapContentInfo` to empty `data` OID (detached mode)
4. Add X.509 cert to `certificates`
5. Build `SignerInfo`:
   - `sid`: `issuerAndSerialNumber` from cert
   - `digestAlgorithm`: SHA-256
   - `signedAttrs`: contentType + signingTime + messageDigest
   - `signatureAlgorithm`: ECDSA-with-SHA256 (OID `1.2.840.10045.4.3.2`)
   - `signature`: wallet's raw signature bytes
6. Wrap in `ContentInfo` with `signedData` OID
7. Export as DER

**Steps:**
1. Implement `prepareSignedAttributes`
2. Implement `buildCmsSignedData`
3. Test: generate a CMS structure, verify with pkijs `SignedData.verify()`
4. Test: the DER output fits within 16384 bytes

---

### Task 7: In-Memory Session Store

**File:** `src/lib/signing-session-store.ts`

Server-side store for CMS signing sessions (between the two API calls).

```typescript
const sessions = new Map<string, CmsSigningSession>();

export function createSession(session: CmsSigningSession): void
export function getSession(id: string): CmsSigningSession | null
export function deleteSession(id: string): void
export function cleanExpiredSessions(): void  // Called periodically
```

Sessions expire after 5 minutes. `cleanExpiredSessions` is called on every `createSession` to prevent memory leaks.

**Note:** This uses in-memory storage, which means it won't work across multiple serverless function instances. For Vercel deployment, consider using Redis or Vercel KV. For POC, in-memory is acceptable.

**Steps:**
1. Implement the session store with auto-expiry
2. Test creation, retrieval, expiry, and cleanup

---

### Task 8: CMS Signing API Routes

**File:** `src/app/api/signing/cms-sign/route.ts`

```typescript
// POST /api/signing/cms-sign
// 1. Decode PDF from base64
// 2. Generate X.509 cert from signer info
// 3. Embed VC XMP into PDF
// 4. Add signature placeholder
// 5. Compute SHA-256 of byte ranges
// 6. Prepare signedAttrs DER
// 7. Store session (PDF + cert + signedAttrs)
// 8. Return hashToSign + sessionId
```

**File:** `src/app/api/signing/cms-complete/route.ts`

```typescript
// POST /api/signing/cms-complete
// 1. Retrieve session by ID
// 2. Build CMS SignedData with wallet signature
// 3. Inject CMS into PDF placeholder
// 4. SHA-256 the complete signed PDF
// 5. Delete session
// 6. Return signed PDF + document hash
```

**Steps:**
1. Implement `cms-sign` route
2. Implement `cms-complete` route
3. Test the full round-trip: prepare → sign (mock wallet) → complete
4. Verify the output PDF has a valid signature structure (parse with pkijs)

---

## Chunk 3: Incremental Update + UI Integration

### Task 9: Incremental PDF Update for Anchor XMP

**File:** `src/lib/cms/incremental-update.ts`

Appends blockchain anchor metadata to a CMS-signed PDF without breaking the signature.

**Function:**
```typescript
export async function appendAnchorXmp(
  signedPdfBytes: Uint8Array,
  anchorData: {
    documentHash: string;
    txHash: string;
    blockNumber: number;
    blockTimestamp: string;
    chainId: string;
    verificationUrl: string;
  }
): Promise<Uint8Array>  // Final PDF with anchor XMP appended
```

**Implementation approach (ordered by preference):**

1. **`muhammara`** — Load signed PDF with `createWriterToModify`, add XMP metadata stream, save. This preserves the existing PDF structure and appends incrementally.

2. **Manual byte-level append** — If `muhammara` can't be used (native addon issues on Vercel):
   - Parse the existing cross-reference table
   - Create a new XMP metadata stream object
   - Update the document catalog to point to new XMP
   - Write new cross-reference section + trailer
   - Append after existing `%%EOF`

**Steps:**
1. Try `muhammara` first — install and test
2. If native addon fails on target platform, implement manual approach
3. Verify the CMS signature still validates after the incremental update
4. Test with Adobe Acrobat (if available) or pkijs verification

---

### Task 10: Anchor XMP API Route

**File:** `src/app/api/signing/cms-anchor/route.ts`

```typescript
// POST /api/signing/cms-anchor
// 1. Decode signed PDF from base64
// 2. Call appendAnchorXmp with TX details
// 3. Return final PDF as base64
```

**Steps:**
1. Implement the route
2. Test: signed PDF in → final PDF out with XMP appended
3. Verify CMS signature integrity after anchor append

---

### Task 11: Update Step Anchoring UI

**File:** `src/components/signing/step-anchoring.tsx`

Update the anchoring sub-steps to include the CMS signing flow.

**New sub-step sequence:**
1. `embedding` — Embed visual signature (existing, client-side)
2. `uploading` — Send PDF to server for CMS signing (NEW)
3. `cms-preparing` — Server prepares PDF + returns hash (NEW)
4. `signing` — Wallet signs the hash (existing, modified)
5. `cms-completing` — Server builds CMS + injects signature (NEW)
6. `hashing` — Display document hash (existing, now from server response)
7. `anchoring` — Build & submit blockchain TX (existing)
8. `anchor-xmp` — Server appends anchor XMP to PDF (NEW)
9. `saving` — Save session to database (existing)
10. `done` — Success (existing)

**Changes:**
- After visual signature embedding, POST PDF bytes to `/api/signing/cms-sign`
- Show "Preparing secure signature..." status
- When hash comes back, send to wallet for signing (same UX as today)
- POST wallet signature to `/api/signing/cms-complete`
- Show "Applying digital signature..." status
- After blockchain TX confirms, POST to `/api/signing/cms-anchor`
- Show "Embedding blockchain proof..." status
- Store final PDF bytes in ref for download

**Steps:**
1. Add new sub-step states to the component
2. Implement the three API call sequences
3. Handle errors at each stage with retry
4. Update progress indicators
5. Test with extension wallet
6. Test with mobile wallet

---

### Task 12: Update Verification Page

**File:** `src/components/verify/verify-result.tsx`

For CMS-signed documents (version 2.0), show additional information:
- "CMS/PKCS#7 Signature: Valid" indicator
- Signer certificate details (CN, O, C)
- VC references extracted from cert custom extension
- Signature standard: CMS-PKCS7

**File:** `src/lib/blockchain.ts`

Add function to detect whether a PDF has CMS signature and extract metadata:
```typescript
export async function extractCmsInfo(pdfBytes: Uint8Array): Promise<{
  hasCmsSignature: boolean;
  signerName?: string;
  signerDid?: string;
  signatureValid?: boolean;
  certDetails?: { cn: string; org: string; country: string };
} | null>
```

**Steps:**
1. Implement CMS detection and extraction
2. Update verify-result UI conditionally (show CMS info if present)
3. Test with both old-format PDFs (no CMS) and new-format PDFs (with CMS)

---

## Chunk 4: Testing & Validation

### Task 13: End-to-End Testing

1. **Unit tests:**
   - X.509 cert generation with various inputs
   - XMP metadata construction
   - CMS SignedData structure building
   - Session store CRUD + expiry

2. **Integration tests:**
   - Full CMS signing pipeline (mock wallet signature)
   - Incremental update doesn't break CMS signature
   - Verification of CMS-signed PDFs

3. **Manual testing:**
   - Complete signing flow with browser extension
   - Complete signing flow with mobile wallet
   - Open signed PDF in Adobe Acrobat — verify signature panel appears
   - Verify on Zetrix Sign website — hash matches on-chain
   - Test with old (pre-CMS) PDFs — backward compatibility

**Steps:**
1. Write unit tests for each `src/lib/cms/` module
2. Write integration test for the full API round-trip
3. Manual test with real wallet
4. Document test results

---

## Execution Order

| Order | Chunk | Tasks | Dependencies |
|-------|-------|-------|--------------|
| 1 | Foundation | Tasks 1-4 | None |
| 2 | CMS Pipeline | Tasks 5-8 | Chunk 1 |
| 3 | Integration | Tasks 9-12 | Chunk 2 |
| 4 | Testing | Task 13 | Chunk 3 |

**Estimated complexity:** This is a significant feature addition. The CMS signer (Task 6) is the hardest component due to ASN.1 structure construction and wallet signature alignment.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| secp256k1 not supported by Node.js WebCrypto | Blocks cert generation | Use `@peculiar/webcrypto` or raw ASN.1 key encoding |
| `muhammara` native addon fails on Vercel | Blocks anchor XMP | Implement manual byte-level incremental append |
| Wallet `signMessage()` output format doesn't match CMS expectations | Blocks CMS completion | Investigate wallet signature format early; may need DER encoding adjustment |
| In-memory session store doesn't work across Vercel serverless instances | Sessions lost between API calls | Use Vercel KV or Redis for session storage |
| PDF byte sizes exceed Vercel request body limit (4.5MB) | Large PDFs fail | Implement chunked upload or increase limit via Vercel config |
| pkijs Ed25519 CMS limitation | Can't use Ed25519 for CMS | Use secp256k1 (Zetrix native) or implement custom signer |
