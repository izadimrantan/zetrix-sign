# Zetrix Sign — Design Specification

**Product:** Zetrix Sign (Chain-Sign-Ease)
**Date:** 2026-03-12
**Status:** Approved — Updated 2026-03-16
**Author:** Claude Opus 4.6 with @izadi

---

## 1. Overview

Zetrix Sign is a blockchain-anchored PDF digital signing platform built on the Zetrix blockchain. Users upload a PDF, authenticate via Zetrix Wallet, present a Verifiable Credential, apply a visual signature, and anchor the signed document's cryptographic hash on-chain for permanent, tamper-proof verification.

### Goals
- Provide a complete, functioning signing workflow from upload to blockchain anchoring
- Support both desktop (browser extension) and mobile (QR code) wallet connections
- Enable anyone to verify a signed document's authenticity against the blockchain
- Deliver a modern, responsive UI using shadcn/ui with Zetrix Sign branding

### Non-Goals (for MVP)
- Real Verifiable Credential integration (hardcoded dummy data for now)
- Multi-signer workflows
- Server-side PDF storage or cloud storage
- Production deployment optimizations

---

## 2. Architecture

### 2.1 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router), TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| PDF Processing | pdf-lib (client-side) |
| PDF Rendering | react-pdf / pdfjs-dist (client-side viewer) |
| Hashing | Web Crypto API (SHA256) |
| Signature Drawing | react-signature-canvas |
| Wallet (Extension) | window.zetrix API |
| Wallet (Mobile) | zetrix-connect-wallet-sdk |
| Contract Queries | zetrix-sdk-nodejs (primary) / microservice API (fallback) |
| Contract TX | Wallet SDK sendTransaction |
| Blockchain | Zetrix Testnet |
| Testing | Vitest + React Testing Library (TDD approach) |
| Database | Prisma ORM + Neon Postgres (serverless) |
| Analytics | Google Analytics 4 (gtag.js) |
| Hosting | Vercel |

### 2.2 Project Structure

```
zetrix-sign-official/
└── web/                           # Next.js application
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx             # Root layout (header, footer, theme)
    │   │   ├── page.tsx               # Landing page (/)
    │   │   ├── sign/
    │   │   │   └── page.tsx           # Signing flow stepper (/sign)
    │   │   ├── verify/
    │   │   │   └── page.tsx           # Document verification (/verify)
    │   │   └── api/
    │   │       └── contract/
    │   │           ├── query/route.ts         # Contract read queries
    │   │           ├── validate/route.ts      # Document validation endpoint
    │   │           ├── build-blob/route.ts    # Build TX blob (extension flow)
    │   │           └── submit-signed/route.ts # Submit signed blob
    │   ├── components/
    │   │   ├── ui/                    # shadcn/ui components
    │   │   ├── analytics/
    │   │   │   └── google-analytics.tsx  # GA4 script loader
    │   │   ├── layout/
    │   │   │   ├── header.tsx
    │   │   │   └── footer.tsx
    │   │   ├── signing/
    │   │   │   ├── signing-stepper.tsx     # Main stepper container
    │   │   │   ├── step-upload.tsx         # Step 1: PDF upload
    │   │   │   ├── step-wallet-identity.tsx # Step 2: Wallet & Identity (combined)
    │   │   │   ├── step-signature.tsx      # Step 3: Create signature
    │   │   │   ├── step-placement.tsx      # Step 4: Place signature on PDF
    │   │   │   ├── step-review.tsx         # Step 5: Review & confirm
    │   │   │   ├── step-anchoring.tsx      # Step 6: Blockchain anchoring
    │   │   │   └── step-complete.tsx       # Step 7: Completion
    │   │   ├── wallet/
    │   │   │   ├── wallet-connector.tsx    # Wallet connection modal
    │   │   │   ├── extension-connect.tsx   # Browser extension flow
    │   │   │   └── mobile-connect.tsx      # QR code flow
    │   │   ├── pdf/
    │   │   │   ├── pdf-viewer.tsx          # PDF preview component
    │   │   │   └── signature-overlay.tsx   # Draggable signature on PDF
    │   │   └── verify/
    │   │       ├── verify-upload.tsx       # Upload for verification
    │   │       └── verify-result.tsx       # Verification result display
    │   ├── lib/
    │   │   ├── analytics.ts          # GA4 event tracking utility
    │   │   ├── db.ts                 # Prisma client singleton (Neon adapter)
    │   │   ├── wallet.ts              # Wallet connection logic (ext + mobile)
    │   │   ├── pdf.ts                 # PDF processing (insert sig, metadata)
    │   │   ├── hash.ts                # SHA256 hashing utility
    │   │   ├── blockchain.ts          # Contract query/interaction layer
    │   │   ├── vc.ts                  # VC handling (dummy data)
    │   │   └── utils.ts               # Shared utilities
    │   ├── types/
    │   │   ├── wallet.ts              # Wallet-related types
    │   │   ├── signing.ts             # Signing session types
    │   │   └── contract.ts            # Contract interaction types
    │   └── hooks/
    │       ├── use-signing-session.ts # Signing flow state management
    │       └── use-wallet.ts          # Wallet connection hook
    ├── __tests__/                     # Test files (TDD)
    │   ├── lib/
    │   │   ├── hash.test.ts
    │   │   ├── pdf.test.ts
    │   │   ├── wallet.test.ts
    │   │   └── blockchain.test.ts
    │   └── components/
    │       ├── signing/
    │       └── verify/
    ├── public/                        # Static assets
    ├── .env.local                     # Environment variables
    ├── .env.example                   # Template for env vars
    ├── tailwind.config.ts
    ├── vitest.config.ts
    └── package.json
```

### 2.3 Routes

| Route | Purpose | Type |
|-------|---------|------|
| `/` | Landing page — hero, features, CTAs | Static page |
| `/sign` | Signing flow — single-page stepper | Client-side interactive |
| `/verify` | Document verification — upload + result | Client-side + API call |
| `/api/contract/query` | Smart contract read queries | API route |
| `/api/contract/validate` | Document hash validation | API route |
| `/api/contract/build-blob` | Build transaction blob (for extension wallet flow) | API route |
| `/api/contract/submit-signed` | Submit wallet-signed blob to blockchain | API route |
| `/api/sessions` | Save/list signing session records | API route |
| `/api/sessions/[id]` | Get single session details | API route |

---

## 3. Signing Flow (Single-Page Stepper)

The `/sign` page contains a multi-step stepper. All state is managed by a custom `useSigningSession` hook. Progress indicator at the top shows current step.

### Step 1: Upload PDF

**Component:** `step-upload.tsx`
**User action:** Drag & drop or click to select a PDF file.
**Validation:** File type = application/pdf, max size = 10MB, minimum 1 page.
**Output:** File object stored in signing session state. PDF rendered in a preview component.
**UI:** Drag-and-drop zone with file icon, dashed border. Shows file name and page count after upload.

### Step 2: Wallet & Identity

**Component:** `step-wallet-identity.tsx` + `wallet-connector.tsx`
**User action:** Choose connection method (extension or mobile QR), connect wallet, then review and confirm identity.
**Extension flow:**
1. Check `window.zetrix` availability
2. Call `window.zetrix.authorize({ method: "changeAccounts" })` to get address
3. Call `window.zetrix.authorize({ method: "sendRandom", param: { random: "zetrix-sign-auth" } })` inside callback to get publicKey + signData
**Mobile QR flow:**
1. Initialize `zetrix-connect-wallet-sdk` with bridge URL (`wss://wscw.zetrix.com`) and `customQrUi: true` + `qrDataCallback` for custom QR rendering
2. Call `sdk.connect()` — establishes WebSocket to bridge (resolves immediately, no QR yet)
3. Call `sdk.auth()` — sends `H5_bind` request, generates QR code via `qrDataCallback`. User scans with Zetrix mobile app. Returns `{ address }` (note: `publicKey` is NOT returned by `auth()` — it comes later from `signMessage()` during anchoring)
4. The WebSocket session between browser ↔ bridge ↔ phone is now established but will expire if idle for several minutes (relevant for Step 6 — see "Mobile Wallet Re-authentication")
**Important:** The bridge server (`wss://wscw.zetrix.com`) is a relay only — it does not interact with the blockchain. The mobile wallet app only connects to the mainnet bridge regardless of which chain is used for transactions. The SDK's `testnet` flag only controls deeplink URL schemes (`zetrixnew://` vs `zetrixnew-uat://`), not bridge selection.
**Output:** walletAddress, publicKey, signerName, signerDID, credentialID stored in session state. Both wallet credentials and identity are required for later steps (signing and anchoring).
**Identity (current implementation):** Display hardcoded dummy VC data as a credential card.
**Dummy data:**
```
Name: John Tan
DID: did:zetrix:test123
Issuer: ZCert Test Authority
Credential ID: vc_test_credential_001
```
**User action (identity):** After wallet is connected, review the credential card and click "Confirm Identity" to proceed.
**Future:** The identity portion will be replaced with a wallet-prompted VC presentation flow using `sdk.getVP()`.
**UI:** Two-tab interface for wallet: "Browser Extension" tab and "Mobile Wallet" tab. Extension tab shows connect button. Mobile tab shows QR code. After wallet connection, identity card with credential details, shield/verified icon, confirm button.

### Step 3: Create Signature

**Component:** `step-signature.tsx`
**User action:** Choose between auto-generated text signature or hand-drawn signature.
**Auto signature:** Generates a styled text block: "Signed by: [Name]" with timestamp. Rendered to a canvas and exported as base64 PNG.
**Drawn signature:** HTML5 canvas with react-signature-canvas. User draws with mouse/touch. Export as base64 PNG. Clear/redo button.
**Output:** signatureType ("auto" | "drawn"), signatureImage (base64 PNG data URL).
**UI:** Two tabs: "Auto Signature" and "Draw Signature". Preview of the generated signature below.

### Step 4: Place Signature on PDF

**Component:** `step-placement.tsx` + `pdf-viewer.tsx` + `signature-overlay.tsx`
**User action:** Drag the signature image onto the PDF preview to position it. Can resize. Can switch pages if multi-page PDF.
**Output:** signaturePosition: { x, y, page, width, height } (relative coordinates 0-1).
**Coordinate system:**
- Origin: top-left of the page (matching browser DOM convention)
- `x`, `y`: relative position (0-1) where 0,0 is top-left and 1,1 is bottom-right
- `width`, `height`: relative dimensions of the signature (0-1 of page size)
- `page`: 0-based page index
- During PDF generation (pdf-lib), coordinates are converted from top-left to pdf-lib's bottom-left origin: `pdfY = pageHeight - (y * pageHeight) - (height * pageHeight)`
**UI:** PDF preview (rendered via react-pdf/pdfjs-dist) with draggable/resizable signature overlay. Page navigation controls for multi-page PDFs.

### Step 5: Review & Confirm

**Component:** `step-review.tsx`
**User action:** Review summary of all details before proceeding.
**Display:**
- Document name and page count
- Wallet address (truncated)
- Signer identity (from VC)
- Signature preview
- Signature position on PDF
**UI:** Summary card with all details. "Sign & Anchor" button to proceed. "Back" button to revise.

### Step 6: Blockchain Anchoring

**Component:** `step-anchoring.tsx`
**Automated process (user waits):**
1. Generate final signed PDF using pdf-lib:
   - Insert signature image at specified coordinates
   - Insert visible text block: "Signed by: [Name] | Wallet: [Address] | [Timestamp]"
   - Export as Uint8Array — **this is the canonical signed PDF**
2. Compute SHA256 hash of the final PDF bytes:
   - `crypto.subtle.digest('SHA-256', pdfBytes)` → 64-char hex (documentHash)
   - **CRITICAL:** The hash is computed on the PDF with signature but WITHOUT blockchain metadata. This is the version the user downloads. No metadata is embedded into the PDF after hashing to avoid the hash-metadata paradox (adding metadata would change the PDF bytes, making the on-chain hash not match the downloaded file).
3. Wallet signs the document hash:
   - Extension: `window.zetrix.signMessage({ message: documentHash })`
   - Mobile: **Requires a fresh QR scan** (see "Mobile Wallet Re-authentication" below)
   - Returns: digitalSignature, publicKey
4. Build transaction blob (same for both extension and mobile):
   - Call `POST /api/contract/build-blob` to build transaction blob server-side (proxies to microservice at `/ztx/contract/generate-blob`)
   - Returns: `{ transactionBlob, hash }`
5. Sign the transaction blob:
   - Extension: **Wait 3 seconds** for extension to reset after first `signMessage` call (Chrome extension message channel limitation), then sign via `window.zetrix.signMessage({ message: blob })`
   - Mobile: `sdk.signMessage({ message: blob })` — uses the same WebSocket session from sub-step 3, phone receives a popup to approve (no second QR needed)
6. Submit signed transaction:
   - `POST /api/contract/submit-signed` (proxies to microservice at `/ztx/contract/submit` with body: `{ txInitiator, blob, listSigner: [{ signBlob: signData, publicKey }], hash }`)
   - Returns: txHash
7. Store blockchain proof in session state (NOT embedded in PDF):
   - documentHash, txHash, signerName, walletAddress, timestamp
   - These are displayed on the completion page
   - The downloadable PDF = the exact bytes that were hashed in step 2

**Mobile Wallet Re-authentication (Why a New QR Code Appears at Step 6):**

When using the mobile wallet, the user first connects and authenticates at Step 2 via the `zetrix-connect-wallet-sdk`. This establishes a WebSocket session between the browser and the Zetrix mobile app, relayed through a bridge server (`wss://wscw.zetrix.com`). However, by the time the user reaches Step 6 (after going through Steps 3-5 for signature creation, placement, and review), **the WebSocket session has expired**. The bridge server closes idle connections, and the mobile app may have gone to background.

Because of this session expiry, the mobile wallet flow at Step 6 uses `reconnectAndSignMobile()` which performs:
1. **Create a fresh SDK instance** — disconnects any stale previous connection
2. **`sdk.connect()`** — establishes a new WebSocket to the bridge
3. **`sdk.auth()`** — generates an `H5_bind` QR code. The user scans this QR with the Zetrix mobile app to re-establish the pairing.
4. **`sdk.signMessage({ message: documentHash })`** — immediately after auth succeeds, the hash signing request is sent over the same fresh WebSocket. The phone receives a popup notification to approve the signing (no second QR needed).

After the hash is signed, the transaction blob is built server-side and then signed via another `sdk.signMessage()` call on the same session. The phone receives a second popup to approve the blob signing.

**Why not use `authAndSignMessage()`?** The SDK provides a combined `authAndSignMessage()` method that generates an `H5_bindAndSignMessage` QR type. However, some versions of the Zetrix mobile app do not recognize this QR type and display "Invalid QR Code". The two-step approach (`auth()` + `signMessage()`) uses the well-supported `H5_bind` QR type instead.

**Why not use `sdk.sendTransaction()` for mobile?** The SDK's `sendTransaction()` sends a request over the WebSocket expecting the phone to show a transaction approval dialog. However, in QR mode (desktop browser), the SDK does not generate a deeplink notification to bring the phone app back to the foreground. If the app went to background after the signing step, the `sendTransaction` request goes unnoticed and hangs indefinitely. Instead, we build the transaction blob server-side, sign it via `signMessage()` (which reliably prompts the phone), and submit the signed blob directly to the blockchain node.

**Known Extension Quirks:**
- `window.zetrix.signBlob()` rejects valid transaction blobs with "Invalid Blob string" — use `signMessage` instead
- Consecutive `signMessage` calls fail silently (callback never fires) due to Chrome extension message channel limitations — a 3-second delay between calls is required

**Hash-Metadata Integrity Design:**
The downloaded PDF does NOT contain embedded blockchain metadata (txHash, etc.). This ensures that:
- `SHA256(downloaded_pdf) === on-chain documentHash` — always true
- Verification: user uploads the PDF → system computes hash → compares with blockchain → match
- Blockchain proof details (txHash, signer, timestamp) are displayed on the completion page and are retrievable by querying the smart contract with the documentHash

**UI:** Progress indicator showing each sub-step with status icons. Animated loading states. For mobile wallet users, a QR code panel appears during sub-step 3 with instructions to scan and approve. Error handling with retry for each sub-step.

### Step 7: Completion

**Component:** `step-complete.tsx`
**Display:**
- Success message with checkmark animation
- Document name
- Signer name and wallet address
- Signature type
- Transaction hash (linked to block explorer if available)
- Document hash
- Timestamp
**Actions:**
- Download Signed PDF (blob download)
- Verify On Chain (link to /verify with hash pre-filled)
**UI:** Success card with confetti/celebration animation. Two prominent action buttons.

---

## 4. Verification Flow

### Route: `/verify`

**Component:** `verify-upload.tsx` + `verify-result.tsx`

**Flow:**
1. User uploads a PDF (drag & drop or file picker)
2. Client computes SHA256 hash of the uploaded file
3. Client sends POST to `/api/contract/validate` with the document hash
4. API route queries smart contract's `isValidated` function:
   ```
   sdk.contract.call({
     optType: 2,
     contractAddress: CONTRACT_ADDRESS,
     input: JSON.stringify({ method: "isValidated", params: { documentHash } })
   })
   ```
5. Display verification result

**Contract response shape (isValidated):**
```typescript
// Success
{ isValid: true, reason: string, signerAddress: string, credentialID: string, timestamp: number }
// Failure
{ isValid: false, reason: string }
```

**Result states (mapped from contract `reason` field):**
- **Valid:** Green checkmark. Shows: signerAddress, credentialID, timestamp, reason, transaction hash (linked to explorer), explorer link
- **Invalid — not found:** Red X. reason: "No record found for this documentHash"
- **Invalid — revoked:** Orange warning. reason: "Document has been revoked"
- **Invalid — crypto failed:** Red X. reason: "Cryptographic verification failed"

**Explorer link:** Valid results include a "View on Zetrix Explorer" link using `NEXT_PUBLIC_ZETRIX_EXPLORER_URL` env var.

**Timestamp handling:** Contract stores timestamps in microseconds. The `formatTimestamp()` utility detects microsecond timestamps (>1e15) and divides by 1000 before formatting to UTC string.

**Note:** The contract also exposes `getRecord` which returns the full data bundle (including digitalSignature, signerPublicKey). This is not used in the verification UI but is available for future features like detailed audit views.

**Fallback:** If zetrix-sdk-nodejs query fails, fall back to microservice API:
```
POST {MICROSERVICE_BASE_URL}/ztx/contract/query-address
{
  address: CONTRACT_ADDRESS,
  method: "isValidated",
  inputParameters: { documentHash }
}
```

---

## 5. Landing Page

### Route: `/`

**Sections:**
1. **Hero:** "Zetrix Sign" heading, tagline about blockchain-verified signatures, "Upload Document to Start" CTA button (links to /sign), "Verify a Document" secondary link (links to /verify)
2. **Features:** Three cards — "Simple Upload", "Verified Identity", "Blockchain Secure" (matching the reference mockup)
3. **Footer:** "Protected by Cloudflare" + "Powered by Zetrix Blockchain"

**Theme:** Dark red/maroon primary color (#7B1E1E or similar), light background, matching the reference mockup's visual style.

---

## 6. Contract Interaction Layer

### 6.1 Primary: zetrix-sdk-nodejs (Server-Side API Routes)

```typescript
// /api/contract/query — Generic contract query
// /api/contract/validate — Document validation
import ZtxChainSDK from 'zetrix-sdk-nodejs';

const sdk = new ZtxChainSDK({ host: process.env.ZETRIX_NODE_URL });

// Read-only query
const result = await sdk.contract.call({
  optType: 2,
  contractAddress: process.env.NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS,
  input: JSON.stringify({ method, params })
});
```

### 6.2 Fallback: Microservice API

```typescript
const response = await fetch(
  process.env.NEXT_PUBLIC_MICROSERVICE_BASE_URL + "/ztx/contract/query-address",
  {
    method: "POST",
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MICROSERVICE_AUTH_TOKEN}`
    },
    body: JSON.stringify({
      address: contractAddress,
      method: methodName,
      inputParameters: params
    })
  }
);
```

### 6.3 Transaction Submission (Unified Build-Sign-Submit Flow)

Both extension and mobile wallet use the same server-assisted transaction flow. The transaction blob is built server-side, signed by the user's wallet (via `signMessage`), and submitted through the microservice. This unified approach avoids the mobile SDK's `sendTransaction()` which is unreliable in QR mode (see Step 6 documentation for details).

Transactions MUST be signed by the user's wallet because the smart contract verifies `Chain.msg.sender === toAddress(signerPublicKey)`.

**Flow (same for extension and mobile):**

1. Client calls `POST /api/contract/build-blob` with transaction parameters
2. API route proxies to microservice `POST {MICROSERVICE_BASE_URL}/ztx/contract/generate-blob`:
   ```typescript
   // Request body sent to microservice:
   {
     sourceAddress: walletAddress,
     contractAddress,
     method: "anchorDocument",
     inputParam: JSON.stringify({ documentHash, digitalSignature, signerPublicKey, credentialID })
   }
   // Returns: { blob, hash }
   ```
3. Client signs the blob:
   - Extension: **Wait 3 seconds** for extension reset (Chrome message channel limitation), then `window.zetrix.signMessage({ message: blob })`
   - Mobile: `sdk.signMessage({ message: blob })` — uses the WebSocket session established during hash signing (phone gets a popup)
   - Returns: `{ signData, publicKey }`
4. Client submits signed blob via `POST /api/contract/submit-signed`
5. API route proxies to microservice `POST {MICROSERVICE_BASE_URL}/ztx/contract/submit`:
   ```typescript
   // Request body sent to microservice:
   {
     txInitiator: sourceAddress,
     blob,
     listSigner: [{ signBlob: signData, publicKey }],
     hash
   }
   ```
6. Returns: txHash

**API routes for transaction flow:**
| Route | Purpose |
|-------|---------|
| `POST /api/contract/build-blob` | Build transaction blob server-side |
| `POST /api/contract/submit-signed` | Submit wallet-signed blob to blockchain |

---

## 7. Signing Session Persistence (Database)

Completed signing sessions are persisted to a Neon Postgres database via Prisma ORM with the `@prisma/adapter-neon` serverless adapter. This enables audit trails, signing history, and future features like a "My Documents" dashboard.

**Stored fields (metadata only — NO PDF files stored):**
```prisma
model SigningSession {
  id                String   @id @default(cuid())
  documentName      String
  walletAddress     String
  signerName        String
  signerDID         String
  credentialID      String
  signatureType     String   // "auto" | "drawn"
  documentHash      String   @unique
  digitalSignature  String
  signerPublicKey   String
  txHash            String
  createdAt         DateTime @default(now())
  completedAt       DateTime?
}
```

**Security decision:** PDF files (original and signed) are NOT stored on the server. This prevents the storage service from becoming a honeypot for sensitive documents. Users retain their own signed PDFs. Blockchain proof is retrievable by querying the smart contract with the documentHash.

**When persisted:** After successful blockchain anchoring (Step 7, sub-step 5), the session metadata is saved via `POST /api/sessions` before showing the completion page.

**API routes:**
| Route | Purpose |
|-------|---------|
| `POST /api/sessions` | Save completed signing session |
| `GET /api/sessions` | List signing history (filtered by wallet address) |
| `GET /api/sessions/[id]` | Get single session details |

---

## 8. State Management

### Signing Session State (useSigningSession hook)

```typescript
interface SigningSession {
  // Step 1
  pdfFile: File | null;
  pdfPageCount: number;

  // Step 2 (Wallet & Identity - combined)
  walletAddress: string;
  publicKey: string;
  connectionMethod: "extension" | "mobile";
  signerName: string;
  signerDID: string;
  credentialID: string;

  // Step 3
  signatureType: "auto" | "drawn";
  signatureImage: string; // base64 data URL

  // Step 4
  signaturePosition: {
    x: number;
    y: number;
    page: number;
    width: number;
    height: number;
  };

  // Step 6 (generated)
  documentHash: string;
  digitalSignature: string;
  txHash: string;

  // Meta
  currentStep: number;
  timestamp: string;
}
```

State lives in React state. No global state library needed.

**Session persistence:** Only serializable fields are backed up to sessionStorage on step transitions (walletAddress, publicKey, signerName, credentialID, signatureType, signatureImage, signaturePosition, currentStep). The `pdfFile` (File object) CANNOT be serialized — a page refresh during the signing flow requires re-uploading the PDF. The stepper detects missing PDF on restoration and redirects the user back to Step 1.

**Cleanup:** sessionStorage is cleared on flow completion or when the user navigates away from `/sign`.

---

## 8. Error Handling

| Error | User-Facing Message | Recovery |
|-------|---------------------|----------|
| Wallet extension not installed | "Zetrix wallet extension not found. Install it or use mobile QR." | Link to extension download + mobile tab |
| Wallet connection rejected | "Wallet connection was cancelled. Please try again." | Retry button |
| Wallet signing rejected | "Signing was cancelled in your wallet. Please try again." | Retry button |
| Transaction failed | "Transaction failed: [reason]. Please try again." | Retry button |
| PDF too large | "PDF must be under 10MB." | Re-upload |
| Invalid file type | "Please upload a PDF file." | Re-upload |
| Contract query failed (SDK) | Fall back to microservice silently | Automatic |
| Contract query failed (both) | "Unable to verify document. Please try again later." | Retry button |
| Network error | "Connection error. Check your internet and try again." | Retry button |

Errors displayed via shadcn/ui toast notifications.

---

## 9. Environment Variables

```env
# Zetrix Blockchain
NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS=ZTX3S4ntGLTJw9vVNpCX6Ash6wZhaLLV9BS5S
NEXT_PUBLIC_ZETRIX_BRIDGE=wss://wscw.zetrix.com       # Must be mainnet bridge — mobile app only connects here
NEXT_PUBLIC_ZETRIX_TESTNET=true
NEXT_PUBLIC_ZETRIX_CHAIN_ID=2
NEXT_PUBLIC_ZETRIX_EXPLORER_URL=https://explorer.testnet.zetrix.com

# Microservice (for build-blob, submit-signed, and fallback queries)
MICROSERVICE_BASE_URL=             # Server-side only
MICROSERVICE_AUTH_TOKEN=           # Server-side only (Bearer token)
MICROSERVICE_API_KEY=              # Server-side only (x-api-key header)

# Database (Neon Postgres)
DATABASE_URL=                      # Pooled connection string
DIRECT_DATABASE_URL=               # Direct connection string (for migrations)

# Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=     # Google Analytics 4 measurement ID
```

---

## 10. Testing Strategy (TDD)

Development follows Test-Driven Development: write tests first, then implement.

### Unit Tests (Vitest)
- `lib/hash.ts` — SHA256 hashing produces correct 64-char hex output
- `lib/pdf.ts` — Signature insertion at coordinates, metadata embedding
- `lib/blockchain.ts` — Contract query formatting, response parsing, fallback logic
- `lib/vc.ts` — Dummy VC data structure
- `lib/wallet.ts` — Connection flow logic (mocked window.zetrix and SDK)

### Component Tests (React Testing Library)
- Each step component renders correctly
- Step transitions work (next/back)
- Form validation (file type, size)
- Wallet connection UI states (loading, connected, error)
- Verification result display (valid, invalid, revoked)

### Integration Tests
- Full signing flow (with mocked wallet and contract)
- Verification flow (with mocked API)

---

## 11. Google Analytics 4 Event Tracking

**Implementation:** `src/lib/analytics.ts` provides typed event functions. `src/components/analytics/google-analytics.tsx` loads the GA4 script. All events are gated by `window.gtag` availability.

### Tracked Events (30+)

| Event Name | Location | Trigger |
|------------|----------|---------|
| `landing_sign_cta_click` | Landing page | "Upload Document to Start" button |
| `landing_verify_cta_click` | Landing page | "Verify a Document" link |
| `nav_sign_click` | Header | "Sign" nav link |
| `nav_verify_click` | Header | "Verify" nav link |
| `nav_home_click` | Header | Logo/home link |
| `step_upload_start` | Step 1 | File selected |
| `step_upload_complete` | Step 1 | File validated, proceeding |
| `step_upload_error` | Step 1 | File validation failed |
| `step_wallet_start` | Step 2 | Step entered |
| `step_wallet_connect_extension` | Step 2 | Extension connect clicked |
| `step_wallet_connect_mobile` | Step 2 | Mobile QR connect clicked |
| `step_wallet_connected` | Step 2 | Wallet connected successfully |
| `step_wallet_error` | Step 2 | Wallet connection failed |
| `step_identity_confirmed` | Step 2 | Identity confirmed |
| `step_signature_start` | Step 3 | Step entered |
| `step_signature_type_selected` | Step 3 | Auto/drawn tab selected |
| `step_signature_complete` | Step 3 | Signature created |
| `step_placement_start` | Step 4 | Step entered |
| `step_placement_complete` | Step 4 | Signature placed |
| `step_review_start` | Step 5 | Step entered |
| `step_review_complete` | Step 5 | "Sign & Anchor" clicked |
| `step_anchoring_start` | Step 6 | Anchoring begins |
| `anchoring_pdf_generated` | Step 6 | PDF with signature generated |
| `anchoring_hash_computed` | Step 6 | SHA256 hash computed |
| `anchoring_hash_signed` | Step 6 | Wallet signed the hash |
| `anchoring_blob_built` | Step 6 | Transaction blob built |
| `anchoring_blob_signed` | Step 6 | Wallet signed the blob |
| `anchoring_tx_submitted` | Step 6 | Transaction submitted |
| `anchoring_success` | Step 6 | Full anchoring complete |
| `anchoring_error` | Step 6 | Any anchoring sub-step failed |
| `anchoring_retry` | Step 6 | User clicked retry |
| `step_complete_download` | Step 7 | Download signed PDF |
| `step_complete_verify` | Step 7 | "Verify On Chain" clicked |
| `verify_upload_start` | Verify page | File selected for verification |
| `verify_upload_complete` | Verify page | Hash computed, query sent |
| `verify_result_valid` | Verify page | Document verified valid |
| `verify_result_invalid` | Verify page | Document not found/invalid |
| `verify_explorer_click` | Verify page | Explorer link clicked |

---

## 12. Future Requirements

### Verifiable Credential Integration
The VC presentation step (Step 3) is hardcoded with dummy data. Future implementation requires:
- `sdk.getVP()` to request a Verifiable Presentation from the wallet
- `sdk.verifyVC()` to verify the credential
- Server-side VC issuer/signature verification
- Extracting signer identity from VC claims
- The `credentialID` from the real VC flows into `anchorDocument`

### Other Future Enhancements
- Multi-signer workflows
- Document audit trail
- Document revocation UI
- Batch signing
- Enterprise identity integration

---

## 13. Dependencies

### Production
- `next` — Framework
- `react`, `react-dom` — UI
- `tailwindcss` — Styling
- `@radix-ui/*` — shadcn/ui primitives
- `pdf-lib` — Client-side PDF manipulation
- `react-pdf` — PDF rendering/viewing in browser (uses pdfjs-dist)
- `react-signature-canvas` — Drawn signature
- `zetrix-connect-wallet-sdk` — Mobile wallet SDK
- `zetrix-sdk-nodejs` — Server-side contract queries
- `class-variance-authority`, `clsx`, `tailwind-merge` — shadcn/ui utilities
- `lucide-react` — Icons
- `@prisma/client` + `@prisma/adapter-neon` — Database ORM with Neon serverless adapter
- `@neondatabase/serverless` — Neon Postgres serverless driver

### TypeScript Declarations
A `window.zetrix` type declaration must be created in `types/wallet.ts`:
```typescript
interface ZetrixExtension {
  authorize(params: { method: string; param?: Record<string, unknown> }, callback: (res: ZetrixResponse) => void): void;
  signMessage(params: { message: string }, callback: (res: ZetrixResponse) => void): void;
}

interface ZetrixResponse {
  code: number;
  data?: { address?: string; publicKey?: string; signData?: string };
  message?: string;
}

declare global {
  interface Window {
    zetrix?: ZetrixExtension;
  }
}
```

### Development
- `vitest` — Test runner
- `@testing-library/react` — Component testing
- `@testing-library/jest-dom` — DOM matchers
- `jsdom` — Browser environment for tests
- `typescript` — Type checking
- `eslint` — Linting