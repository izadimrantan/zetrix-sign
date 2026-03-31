# CMS/PKCS#7 PDF Signing — Design Specification

**Date:** 2026-03-30
**Author:** @izadi with AI input
**Status:** Draft
**Depends on:** Original signing flow (2026-03-12 spec)

---

## 1. Overview

### 1.1 Context

The current Zetrix Sign system produces PDFs with:
- A visual signature image embedded via `pdf-lib` (client-side)
- A SHA-256 hash of the signed PDF stored on the Zetrix blockchain
- Verification only via the Zetrix Sign website or blockchain explorer

This works for blockchain-native verification but is **not recognized by standard PDF readers** (Adobe Acrobat, Foxit, macOS Preview). The PDF appears as a normal document with an image pasted on it — no signature panel, no tamper detection, no trust indicator.

### 1.2 Goal

Add **CMS/PKCS#7 digital signatures** to the PDF so that:
1. Adobe Acrobat shows a signature panel with signer identity and tamper detection
2. The signer's Zetrix keypair is wrapped in an X.509 certificate that PDF readers understand
3. Verifiable Credential (VC) metadata is embedded as XMP before signing (covered by the signature)
4. Blockchain anchor proof is appended after signing via incremental PDF update (does not break signature)
5. The final PDF is self-contained: standards-compliant signature + blockchain proof + VC identity

### 1.3 Non-Goals

- Certificate Authority (CA) trust chain — this is a self-signed cert for POC. CA integration is a future concern.
- Long-term validation (LTV) / RFC 3161 timestamps — placeholder space is reserved but not implemented.
- Real VC integration — continues using dummy credential data for now.
- Replacing the existing visual signature — the image overlay is retained alongside the CMS signature.

---

## 2. Architecture

### 2.1 Stack Decision: Node.js (not Python)

The original engineer spec recommended Python (pyHanko + pikepdf). After analysis, we are implementing in **Node.js** to keep the entire stack unified (Next.js + TypeScript).

**Key trade-off:** The Node.js PDF signing ecosystem is less mature than Python's pyHanko, requiring more glue code. However, it avoids deploying and maintaining a separate Python microservice.

### 2.2 Library Stack

| Concern | Library | Role |
|---------|---------|------|
| X.509 cert generation | `@peculiar/x509` | Create self-signed certs with Ed25519/secp256k1 |
| WebCrypto provider | Node.js native `crypto.webcrypto` (>=18.4) | Ed25519 key operations |
| CMS/PKCS#7 structure | `pkijs` + `asn1js` | Build SignedData for PDF signature |
| PDF signature placeholder | `@signpdf/placeholder-pdf-lib` | Inject `/Sig` dict with ByteRange into PDF |
| PDF signature injection | `@signpdf/signpdf` | Locate placeholder, inject CMS bytes |
| Custom signer | Custom (extends `@signpdf/signpdf` Signer) | Bridge between @signpdf and pkijs/webcrypto |
| XMP metadata | Manual XML construction | No mature Node.js XMP library |
| Incremental PDF update | `muhammara` or manual append | Post-signature anchor XMP |
| PDF manipulation | `pdf-lib` (existing) | Visual signature embedding, placeholder prep |
| PKCS#12 bundling | `@peculiar/x509` + `asn1js` | Bundle cert + key for storage |

### 2.3 Key Type

The spec mentions Ed25519 with a note to "confirm with infra — if secp256k1, tell Claude Code to adjust."

**Important constraint:** `pkijs` CMS SignedData does **not** support vanilla Ed25519 for signing (Ed25519 is a one-shot algorithm that doesn't support streaming/pre-hashing, which CMS requires for the `DigestAlgorithm` + `SignatureAlgorithm` separation).

**Options:**
1. **secp256k1 + SHA-256** — Works with pkijs CMS SignedData. Zetrix blockchain uses secp256k1 natively. Recommended.
2. **Ed25519** — Would require bypassing pkijs's CMS signing and manually constructing the SignedData ASN.1 structure with a single-pass Ed25519 signature. Complex and non-standard.
3. **RSA-2048 + SHA-256** — Maximum PDF reader compatibility. But doesn't match Zetrix's native key type.

**Decision:** Use **secp256k1 with SHA-256** for the CMS signature. This aligns with Zetrix's native key type and works with pkijs. If infra confirms Ed25519, we will implement a custom CMS signer that handles Ed25519's one-shot signing model.

### 2.4 Where This Runs

The CMS signing **must happen server-side** because:
- The private key is needed to create the X.509 cert and sign the CMS structure
- The Zetrix wallet (browser extension or mobile) holds the private key but only exposes `signMessage()` — it cannot produce X.509 certs or CMS structures

**Two approaches:**

**Approach A — Server holds a signing key (simpler, less secure):**
- Server generates a dedicated signing keypair
- Cert is created server-side with the signer's VC identity
- PDF is signed server-side
- The CMS signature proves "this server, on behalf of signer X, signed this document"
- Blockchain anchoring still uses the user's wallet key (unchanged)

**Approach B — Wallet-delegated signing (more complex, more secure):**
- Server prepares the PDF with placeholder and computes the hash
- The hash-to-sign is sent to the user's wallet for signing via `signMessage()`
- Server receives the raw signature and wraps it in the CMS/PKCS#7 structure
- The CMS signature proves "wallet owner X directly signed this document"
- Requires the wallet's public key to be wrapped in the X.509 cert

**Decision:** **Approach B (wallet-delegated)** — the wallet signs the actual document hash, preserving the security model where the server never holds private keys. The server only constructs the CMS wrapper around the wallet's signature.

---

## 3. Three Components

### 3.1 Component 1: X.509 Certificate Generation

Generate a self-signed X.509 v3 certificate that wraps the signer's Zetrix public key. This cert is created **per-signing-session** (not cached long-term) because it encodes session-specific VC references.

**Inputs:**
- Signer's public key (from wallet connection, step 2)
- Signer's name (from VC — currently dummy "John Tan")
- Signer's DID (`did:zetrix:{address}`)
- Signer's Zetrix address
- VC reference summary (VC IDs + issuer DIDs)

**Certificate fields:**

| Field | Value |
|-------|-------|
| Subject CN | Signer's real name (from MyKad VC) |
| Subject O | "Zetrix AI Berhad" |
| Subject C | "MY" |
| Issuer | Same as Subject (self-signed) |
| Serial | Random 20-byte integer |
| Not Before | Current time |
| Not After | Current time + 1 year |
| Public Key | Signer's Zetrix public key (secp256k1 or Ed25519) |

**Extensions:**

| Extension | Critical | Value |
|-----------|----------|-------|
| Subject Alternative Name | No | URI: `did:zetrix:{address}`, URI: `zetrix:address:{address}` |
| Key Usage | Yes | digitalSignature, nonRepudiation (contentCommitment) |
| Extended Key Usage | No | Document Signing (OID `1.3.6.1.4.1.311.10.3.12`) |
| Basic Constraints | Yes | CA = false |
| Custom VC References | No | OID `1.3.6.1.4.1.99999.1.1` — JSON payload as DER UTF8String |

**Custom extension JSON payload:**
```json
{
  "vcReferences": [
    {
      "vcId": "vc_test_credential_001",
      "issuerDid": "did:zetrix:zcert_test_authority",
      "credentialType": "MyKadVerification",
      "issuanceDate": "2026-01-15T00:00:00Z"
    }
  ],
  "verifiedAt": "2026-03-30T08:00:00Z"
}
```

**Output:** X.509 certificate in DER format (for CMS embedding). Optionally PEM for debugging.

**Implementation:** `@peculiar/x509` with `X509CertificateGenerator.createSelfSigned()`.

**Note:** Since the wallet holds the private key and only exposes `signMessage()`, the cert is created with the wallet's **public key** but signed by a server-side ephemeral key. The cert's signature is not the document signature — it merely binds the public key to the identity. The actual document signature comes from the wallet.

---

### 3.2 Component 2: CMS/PKCS#7 PDF Signing

Two sub-steps in strict order.

#### Step A — Embed VC Identity XMP (before signing)

XMP metadata is embedded into the PDF **before** the CMS signature is applied, so the signature covers this data.

**XMP Namespace:** `https://zetrix.com/ns/pdfsig/1.0/` (prefix: `zetrix`)

**Properties:**

| Property | Value |
|----------|-------|
| `zetrix:SignerName` | From VC (currently "John Tan") |
| `zetrix:SignerDID` | `did:zetrix:{address}` |
| `zetrix:SignerAddress` | Zetrix wallet address |
| `zetrix:CredentialId` | VC ID (currently "vc_test_credential_001") |
| `zetrix:CredentialIssuer` | Issuer DID (currently "ZCert Test Authority") |
| `zetrix:VCVerifiedAt` | ISO 8601 timestamp |
| `zetrix:SignatureStandard` | `CMS-PKCS7` |
| `zetrix:AnchorVersion` | `2.0` |

**Implementation:** Construct XMP XML string manually, inject into PDF metadata stream using `pdf-lib`.

#### Step B — Apply CMS/PKCS#7 Detached Signature

**Flow:**

1. **Prepare PDF with placeholder:** Use `pdf-lib` + `@signpdf/placeholder-pdf-lib` to add a `/Sig` dictionary with:
   - `/Filter`: `Adobe.PPKLite`
   - `/SubFilter`: `adbe.pkcs7.detached`
   - `/ByteRange`: Placeholder `[0 /********** /********** /**********]`
   - `/Contents`: Zeroed hex string (16384 bytes reserved — room for future RFC 3161 timestamp)
   - `/Reason`: `"Digitally signed with Zetrix blockchain key, identity verified via Verifiable Credentials"`
   - `/Location`: `"Kuala Lumpur, Malaysia"`
   - `/Name`: Signer's name
   - `/ContactInfo`: `"verify@zetrix.com"`
   - `/M`: Signing time (PDF date format)

2. **Compute document hash:** Using the `ByteRange` from the placeholder, hash the PDF bytes excluding the `/Contents` placeholder region. Algorithm: SHA-256.

3. **Send hash to wallet for signing:** The hash is sent to the user's browser, which calls `wallet.signMessage(hash)`. The wallet returns a raw signature.

4. **Build CMS SignedData:** Using `pkijs`, construct:
   ```
   ContentInfo {
     contentType: signedData (1.2.840.113549.1.7.2)
     content: SignedData {
       version: 1
       digestAlgorithms: { SHA-256 }
       encapContentInfo: { contentType: data (empty — detached) }
       certificates: [ signer's X.509 cert ]
       signerInfos: [{
         version: 1
         sid: issuerAndSerialNumber
         digestAlgorithm: SHA-256
         signedAttrs: {
           contentType: data
           signingTime: current time
           messageDigest: SHA-256 of PDF byte ranges
         }
         signatureAlgorithm: ECDSA-with-SHA256 (or Ed25519)
         signature: wallet's raw signature over DER-encoded signedAttrs
       }]
     }
   }
   ```

5. **Inject CMS into PDF:** Use `@signpdf/signpdf` to replace the zeroed `/Contents` with the DER-encoded CMS structure.

**Output:** Signed PDF bytes with CMS/PKCS#7 signature that Adobe Acrobat can validate.

**Critical detail — wallet signing alignment:**

The wallet's `signMessage()` expects a string/hex input and returns a signature. For CMS compatibility:
- The **signedAttrs** (authenticated attributes) are DER-encoded
- The DER bytes are sent to the wallet as a hex string for signing
- The returned signature is placed into `signerInfos[0].signature`

This means the wallet signs the **DER-encoded authenticated attributes** (which include the document hash as `messageDigest`), not the document bytes directly. This is standard CMS behavior.

---

### 3.3 Component 3: On-Chain Anchoring + XMP Metadata

#### Step A — Hash and Anchor (modified from current flow)

After the CMS signature is applied:

1. SHA-256 the **entire signed PDF** (including the CMS signature)
2. Submit to Zetrix blockchain with metadata payload:

```json
{
  "type": "PDF_DOCUMENT_ANCHOR",
  "version": "2.0",
  "hash_algorithm": "SHA-256",
  "document_hash": "<hash of signed PDF>",
  "hash_scope": "cms-signed-document",
  "signer_did": "did:zetrix:<address>",
  "signed_at": "<ISO 8601>",
  "credential_id": "<vc_id>",
  "signature_standard": "CMS-PKCS7"
}
```

3. Wait for TX confirmation, capture `txHash`, `blockNumber`, `blockTimestamp`

**Change from current flow:** The hash is now of the **CMS-signed PDF** (not the visual-signature-only PDF). The `hash_scope` field changes from `"signed-document"` to `"cms-signed-document"` and `version` changes to `"2.0"`.

#### Step B — Append Anchor XMP via Incremental Update

After the blockchain TX is confirmed, append anchor metadata to the PDF **without invalidating the CMS signature**.

**Additional XMP properties (same `zetrix:` namespace):**

| Property | Value |
|----------|-------|
| `zetrix:DocumentHash` | SHA-256 of CMS-signed PDF |
| `zetrix:HashAlgorithm` | `SHA-256` |
| `zetrix:HashScope` | `cms-signed-document` |
| `zetrix:AnchorTxHash` | Zetrix transaction hash |
| `zetrix:AnchorBlockNumber` | Block number |
| `zetrix:AnchorTimestamp` | Block timestamp (ISO 8601) |
| `zetrix:AnchorChainId` | `zetrix-testnet` (or `zetrix-mainnet`) |
| `zetrix:VerificationURL` | `https://explorer.zetrix.com/tx/{txHash}` |

**Critical constraint:** This MUST be an **incremental PDF update** (append after `%%EOF`). A full save would rewrite the PDF structure and invalidate the CMS signature's `ByteRange`.

**Implementation:** Use `muhammara` (maintained C++ bindings for PDFHummus) which supports incremental writes. Alternative: manual byte-level append of a new cross-reference section and XMP stream after `%%EOF`.

**Output:** Final PDF containing:
1. Original document content
2. Visual signature image (existing)
3. VC identity XMP metadata (covered by CMS signature)
4. CMS/PKCS#7 detached signature
5. Blockchain anchor XMP metadata (incremental update, not covered by CMS)

---

## 4. Updated Signing Flow

The 7-step UI flow remains the same, but **Step 6 (Anchoring)** gains additional sub-steps:

### Step 6 Sub-Steps (Updated)

| # | Sub-Step | Description | Where |
|---|----------|-------------|-------|
| 1 | Embed visual signature | Paste signature image onto PDF page | Client (pdf-lib) |
| 2 | Upload PDF to server | Send PDF bytes to API for CMS signing | Client → Server |
| 3 | Embed VC XMP | Write identity metadata into PDF | Server (pdf-lib) |
| 4 | Add signature placeholder | Inject `/Sig` dict with ByteRange | Server (pdf-lib + @signpdf) |
| 5 | Compute document hash | SHA-256 of PDF byte ranges | Server |
| 6 | Wallet signs hash | Send hash to client, wallet signs | Client (wallet SDK) |
| 7 | Build CMS structure | Wrap signature in PKCS#7 SignedData | Server (pkijs) |
| 8 | Inject CMS into PDF | Replace placeholder with CMS bytes | Server (@signpdf) |
| 9 | Hash signed PDF | SHA-256 of complete signed PDF | Server |
| 10 | Build TX blob | Prepare blockchain transaction | Server (existing) |
| 11 | Wallet signs TX blob | Send blob to client, wallet signs | Client (wallet SDK) |
| 12 | Submit TX | Submit signed transaction | Server (existing) |
| 13 | Append anchor XMP | Incremental update with TX proof | Server (muhammara) |
| 14 | Save session | Store metadata in database | Server (Prisma) |
| 15 | Return final PDF | Send completed PDF to client | Server → Client |

**Key change:** The PDF now makes a **round-trip to the server** (sub-steps 2-8, 13, 15). Previously, all PDF processing was client-side. The server never stores the PDF permanently — it processes it in memory and returns it.

### Privacy Consideration

The PDF is transmitted to the server for CMS signing. This is a necessary trade-off because:
- CMS/PKCS#7 structure construction requires server-side libraries
- The wallet only exposes `signMessage()`, not full CMS signing capabilities

The server processes the PDF **in memory only** — no disk storage, no logging of PDF content. The API endpoint should enforce HTTPS and appropriate rate limiting.

---

## 5. Verification Logic

### 5.1 Simple Verification (Hash Check — Current)

1. Find the second-to-last `%%EOF` in the PDF (boundary before anchor XMP)
2. SHA-256 everything up to that boundary
3. Read `zetrix:AnchorTxHash` from XMP
4. Query Zetrix chain → get stored hash
5. Compare: computed hash == on-chain hash → document is untampered

### 5.2 Full Verification (CMS + Blockchain)

Adds to the above:

6. Verify CMS signature structure (pkijs `SignedData.verify()`)
7. Extract signer identity from cert: CN, SAN URIs, custom VC extension
8. Confirm cert's public key matches on-chain signer address
9. Optionally check VC revocation status

### 5.3 Adobe Reader Verification

When opening the PDF in Adobe Acrobat:
- Signature panel appears automatically
- Shows signer name, signing time, reason
- Shows "signature is valid" (tamper detection works)
- Shows "signer's identity is unknown" (expected — self-signed cert, no CA trust chain)
- User can manually trust the cert if desired

---

## 6. API Changes

### New API Endpoint

**`POST /api/signing/cms-sign`**

Handles the server-side CMS signing pipeline (sub-steps 3-5, 7-8 from Section 4).

**Request:**
```typescript
{
  pdfBytes: string;          // Base64-encoded PDF with visual signature
  signerName: string;        // From VC
  signerDid: string;         // did:zetrix:{address}
  signerAddress: string;     // Zetrix wallet address
  signerPublicKey: string;   // Hex-encoded public key from wallet
  credentialId: string;      // VC ID
  credentialIssuer: string;  // VC issuer
}
```

**Response (Phase 1 — hash for wallet signing):**
```typescript
{
  hashToSign: string;        // Hex-encoded DER of signedAttrs to be signed by wallet
  sessionId: string;         // Server-side session ID to continue after wallet signs
}
```

**`POST /api/signing/cms-complete`**

Completes the CMS structure after receiving the wallet's signature.

**Request:**
```typescript
{
  sessionId: string;         // From cms-sign response
  walletSignature: string;   // Hex-encoded signature from wallet
}
```

**Response:**
```typescript
{
  signedPdfBytes: string;    // Base64-encoded CMS-signed PDF
  documentHash: string;      // SHA-256 of signed PDF (for blockchain anchoring)
}
```

**`POST /api/signing/cms-anchor`**

Appends blockchain anchor XMP after TX confirmation.

**Request:**
```typescript
{
  signedPdfBytes: string;    // Base64-encoded CMS-signed PDF
  txHash: string;
  blockNumber: number;
  blockTimestamp: string;     // ISO 8601
  documentHash: string;
}
```

**Response:**
```typescript
{
  finalPdfBytes: string;     // Base64-encoded final PDF with anchor XMP
}
```

---

## 7. New Dependencies

```json
{
  "@peculiar/x509": "^2.0.0",
  "@signpdf/signpdf": "^3.3.0",
  "@signpdf/placeholder-pdf-lib": "^3.3.0",
  "pkijs": "^3.2.0",
  "asn1js": "^3.0.0",
  "muhammara": "^4.0.0"
}
```

**Note on `muhammara`:** This is a native C++ addon (PDFHummus bindings). It requires a C++ build toolchain. If deployment constraints prevent native addons (e.g., Vercel serverless), the incremental XMP append can be done with manual byte-level operations instead.

---

## 8. Execution Order Summary

```
1. Client: User completes steps 1-5 (upload, wallet, signature, placement, review)
2. Client: Embed visual signature into PDF (pdf-lib, existing)
3. Client → Server: POST /api/signing/cms-sign (PDF bytes + signer info)
4. Server: Embed VC XMP → Add signature placeholder → Compute hash
5. Server → Client: Return hashToSign
6. Client: wallet.signMessage(hashToSign) → get walletSignature
7. Client → Server: POST /api/signing/cms-complete (sessionId + walletSignature)
8. Server: Build CMS SignedData → Inject into PDF → Hash signed PDF
9. Server → Client: Return signedPdfBytes + documentHash
10. Client: Build TX blob (existing flow)
11. Client: wallet.signMessage(txBlob) → get txSignature
12. Client → Server: Submit signed TX (existing flow)
13. Client → Server: POST /api/signing/cms-anchor (signedPdfBytes + TX details)
14. Server: Incremental XMP update → Return finalPdfBytes
15. Client: Display success, offer download
```

---

## 9. Key Constraints

1. **XMP before signing, anchor after signing.** VC identity metadata goes in before the CMS signature. Anchor proof goes in after, via incremental update.
2. **Incremental update only for post-signature changes.** Never full-save after CMS signing.
3. **Privacy:** No IC numbers or passport numbers in PDF metadata. Only VC reference IDs and issuer DIDs.
4. **Custom OID `1.3.6.1.4.1.99999.1.1`** is a placeholder for POC. Register a proper PEN with IANA before production.
5. **`bytes_reserved=16384`** in the signature placeholder to leave room for future RFC 3161 timestamp token.
6. **Server never stores PDFs** — in-memory processing only.
7. **The wallet signs the DER-encoded signedAttrs**, not raw PDF bytes. This is standard CMS behavior but important for implementation correctness.
