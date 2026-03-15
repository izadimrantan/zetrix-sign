# Project Context

> **Purpose:** Essential information for AI onboarding. New AI reads this to understand the project.

---

## Overview

**Project Name:** Zetrix Sign
**Description:** A blockchain-anchored PDF digital signing platform. Users upload a PDF, authenticate via Zetrix Wallet, present a Verifiable Credential, apply a visual signature, hash the signed PDF, sign the hash with their wallet, anchor it on the Zetrix blockchain, and later verify documents against on-chain records.
**Status:** Production (Testnet)

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Language | TypeScript | 5.x |
| Framework | Next.js (App Router) | 14+ |
| Styling | Tailwind CSS | 3.x |
| Component Library | shadcn/ui | latest |
| PDF Processing | pdf-lib (client-side) | latest |
| PDF Rendering | react-pdf / pdfjs-dist (client-side viewer) | latest |
| Hashing | Web Crypto API (SHA256) | native |
| Signature Drawing | react-signature-canvas | latest |
| Wallet (Extension) | window.zetrix API | native |
| Wallet (Mobile) | zetrix-connect-wallet-sdk | latest |
| Contract Queries | zetrix-sdk-nodejs (preferred) / microservice API (fallback) | latest |
| Contract TX Submission | Wallet SDK sendTransaction (user pays gas) | - |
| Database | Prisma ORM + Neon Postgres (serverless) | latest |
| Analytics | Google Analytics 4 (gtag.js) | GA4 |
| Hosting | Vercel | - |
| Blockchain | Zetrix (testnet) | - |

---

## Architecture

### Structure
```
zetrix-sign-official/
├── vibecode/                  # Project documentation (vibecode workflow)
├── zetrix-sign-sc/            # Smart contract dev environment
├── merged-contract.js         # Reference: merged smart contract source
├── zetrix-wallet.ts           # Reference: wallet connection implementation
├── br-chain-signs.docx        # Business requirements document
└── web/                       # Next.js web application
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx           # Landing page (/)
    │   │   ├── sign/page.tsx      # Signing flow stepper (/sign)
    │   │   ├── verify/page.tsx    # Document verification (/verify)
    │   │   └── api/               # Next.js API routes
    │   │       └── contract/      # Contract query endpoints
    │   ├── components/
    │   │   ├── ui/                # shadcn/ui components
    │   │   ├── signing/           # Signing flow step components
    │   │   ├── wallet/            # Wallet connection components
    │   │   ├── analytics/
    │   │   │   └── google-analytics.tsx
    │   │   └── layout/            # Header, footer, shared layout
    │   │       └── landing-cta.tsx
    │   ├── lib/
    │   │   ├── wallet.ts          # Wallet connection logic (extension + mobile)
    │   │   ├── pdf.ts             # PDF processing (pdf-lib)
    │   │   ├── hash.ts            # SHA256 hashing utilities
    │   │   ├── blockchain.ts      # Contract interaction layer
    │   │   ├── vc.ts              # VC handling (dummy now, real later)
    │   │   ├── analytics.ts       # GA event tracking
    │   │   └── db.ts              # Prisma client singleton
    │   └── types/                 # TypeScript type definitions
    ├── prisma/
    │   ├── schema.prisma
    │   └── prisma.config.ts
    └── .env.local                 # Environment variables
```

### Key Patterns
- **Client-side PDF processing:** PDFs are processed entirely in the browser using pdf-lib. No server-side file storage needed. Files never leave the user's device.
- **Single-page stepper:** The signing flow (/sign) uses a multi-step stepper on a single page. All state is managed in React state with sessionStorage backup.
- **Dual wallet support:** Browser extension (window.zetrix) for desktop + QR code via zetrix-connect-wallet-sdk for mobile.
- **Contract interaction layer:** Read-only queries go through Next.js API routes (using zetrix-sdk-nodejs). Transaction submission goes directly through the wallet SDK.

### Critical Files (Don't Modify Without Approval)
| File | Purpose | Risk |
|------|---------|------|
| `web/src/lib/wallet.ts` | Wallet connection logic | High - security critical |
| `web/src/lib/blockchain.ts` | Contract interaction | High - blockchain operations |
| `web/.env.local` | Environment variables & secrets | Critical |
| `merged-contract.js` | Smart contract reference | Critical - deployed on-chain |

---

## Smart Contract

**Contract Address (Testnet):** `ZTX3S4ntGLTJw9vVNpCX6Ash6wZhaLLV9BS5S`
**Network:** Zetrix Testnet

### Transaction Methods (state-changing)
- `anchorDocument(params)` — Records a signed document on-chain. Params: documentHash, digitalSignature, signerPublicKey, credentialID. The contract verifies that signerPublicKey derives to Chain.msg.sender.
- `revokeDocument(params)` — Invalidates a previously signed document. Only the original signer can revoke. Params: documentHash.
- `transferOwnership(params)` — Transfers contract ownership. Params: newOwner.

### Query Methods (read-only)
- `getRecord(params)` — Returns the full record for a document hash. Returns: exists, signerAddress, digitalSignature, signerPublicKey, credentialID, timestamp, isRevoked.
- `isValidated(params)` — Active cryptographic validation. Checks existence, revocation status, signature validity (ecVerify), and identity chain (toAddress). Returns: isValid, reason.
- `getContractInfo()` — Returns contract metadata and total record count.
- `getOwner()` — Returns the current contract owner address.

---

## Signing Flow (Single-Page Stepper)

Steps within the `/sign` route:
1. **Upload PDF** — Drag & drop or file picker. Validates: PDF type, max 10MB.
2. **Wallet & Identity** — Connect wallet (browser extension or mobile QR code) and present Verifiable Credential. Returns wallet address + public key. VC currently hardcoded dummy data.
3. **Create Signature** — Two options: auto-generated text signature or hand-drawn canvas signature.
4. **Place Signature** — Drag signature onto PDF preview to position it.
5. **Review & Sign** — Summary of all details. Confirm to proceed.
6. **Blockchain Anchoring** — System generates final PDF with signature embedded, computes SHA256 hash, wallet signs the hash, wallet submits anchorDocument transaction, receives TX hash.
7. **Complete** — Displays TX hash, document details, download button, verify link.

---

## Verification Flow (/verify)

1. User uploads a previously signed PDF.
2. System computes SHA256 hash of the uploaded file.
3. System queries smart contract's `isValidated` method via API.
4. Displays result: valid/invalid, signer address, credential ID, timestamp, revocation status.
5. Shows explorer link to view transaction on Zetrix block explorer

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS` | Smart contract address on testnet | Yes |
| `NEXT_PUBLIC_ZETRIX_BRIDGE` | WebSocket bridge for mobile wallet SDK | Yes |
| `NEXT_PUBLIC_ZETRIX_TESTNET` | Flag for testnet mode ("true") | Yes |
| `NEXT_PUBLIC_ZETRIX_CHAIN_ID` | Chain ID for testnet ("2") | Yes |
| `NEXT_PUBLIC_ZETRIX_EXPLORER_URL` | Block explorer base URL | Yes |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics 4 measurement ID | Optional |
| `MICROSERVICE_BASE_URL` | Microservice API base URL | Yes |
| `MICROSERVICE_API_KEY` | API key for microservice auth | Yes |
| `MICROSERVICE_AUTH_TOKEN` | Auth token for microservice (server-side only, NOT exposed to client) | Yes |
| `DATABASE_URL` | Neon Postgres pooled connection URL | Yes |
| `DATABASE_URL_UNPOOLED` | Neon Postgres direct connection URL | Yes |

> Never commit actual values. Use `.env.example` for reference.

---

## Google Analytics Event Tracking

### Events Tracked

| Event | Location | Description |
|-------|----------|-------------|
| `landing_cta_click` | Landing page | CTA button clicked (upload_document / verify_document) |
| `nav_click` | Header | Navigation link clicked (home / sign / verify) |
| `signing_step_enter` | Signing stepper | Step entered (step number + name) — tracks funnel drop-offs |
| `file_upload` | Step 1: Upload | PDF uploaded (file name, page count, file size MB) |
| `file_remove` | Step 1: Upload | Uploaded file removed |
| `file_upload_error` | Step 1: Upload | Upload failed (invalid_type / file_too_large / read_failed) |
| `wallet_connect_start` | Step 2: Wallet & Identity | Wallet connection initiated (extension / mobile) |
| `wallet_connect_success` | Step 2: Wallet & Identity | Wallet connected (method + address) |
| `wallet_connect_error` | Step 2: Wallet & Identity | Wallet connection failed (method + error) |
| `identity_confirmed` | Step 2: Wallet & Identity | Identity credential confirmed (credential ID) |
| `signature_created` | Step 3: Signature | Signature created (auto / drawn) |
| `signature_cleared` | Step 3: Signature | Signature cleared |
| `signature_tab_switch` | Step 3: Signature | Tab switched (auto / draw) |
| `signature_moved` | Step 4: Placement | Signature repositioned on PDF |
| `review_confirmed` | Step 5: Review | "Sign & Anchor" button clicked |
| `anchoring_start` | Step 6: Anchoring | Anchoring flow started |
| `anchoring_substep` | Step 6: Anchoring | Sub-step reached (embedding / hashing / signing / anchoring / saving) |
| `anchoring_success` | Step 6: Anchoring | Transaction anchored (tx hash) |
| `anchoring_error` | Step 6: Anchoring | Anchoring failed (sub-step + error message) |
| `anchoring_retry` | Step 6: Anchoring | Retry button clicked |
| `signed_pdf_download` | Step 7: Complete | Signed PDF downloaded |
| `verify_on_chain_click` | Step 7: Complete | "Verify On Chain" button clicked (document hash) |
| `sign_another_document` | Step 7: Complete | "Sign Another Document" clicked |
| `verify_file_upload` | Verify page | PDF uploaded for verification (file name) |
| `verify_start` | Verify page | Verification started (file_upload / query_param) |
| `verify_result` | Verify page | Result received (valid / invalid / not_found / revoked) |
| `verify_error` | Verify page | Verification failed (error message) |
| `verify_another_document` | Verify page | "Verify Another Document" clicked |
| `explorer_link_click` | Verify result | Explorer link clicked (tx hash) |

All events are defined in `src/lib/analytics.ts` and use the `gtag('event', ...)` API. Events fire client-side only when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set.

---

## Verifiable Credentials — Future Integration

> **IMPORTANT:** This section documents a critical future requirement.

The VC presentation step is currently implemented with hardcoded dummy data:
- Name: "John Tan"
- DID: "did:zetrix:test123"
- Issuer: "ZCert Test Authority"

In the production version, users MUST present a real Verifiable Credential from their Zetrix Wallet before they can sign documents. The VC's `credentialID` is stored on-chain as part of the `anchorDocument` call, creating a verifiable link between the signer's identity credential and the signed document.

**Future implementation requires:**
- Wallet SDK's `getVP()` method to request a Verifiable Presentation
- Wallet SDK's `verifyVC()` method to verify the credential
- Backend verification of the VC issuer, signature, and validity
- Extracting signer identity (name, DID) from the VC claims

The UI for the VC step should be designed to accommodate this transition — currently showing a pre-filled confirmation card, which will later be replaced with a wallet-prompted VC selection flow.

---

## Coding Conventions

- **Naming:** camelCase for functions/variables, PascalCase for components/types
- **Files:** kebab-case for files (e.g., `wallet-connection.tsx`)
- **Components:** One component per file, named exports
- **Error handling:** Try-catch with user-friendly error messages via toast notifications
- **State management:** React useState/useReducer for local state. No global state library needed.

---

## Human Preferences

- Modern, clean UI using shadcn/ui components
- Dark red/maroon color theme (matching Zetrix Sign branding from mockup)
- Responsive design (desktop and mobile friendly)
- Follow vibecode workflow: AI proposes, human approves, AI implements, human tests
- Solo mode development
- **Test-Driven Development (TDD):** Use the superpowers:test-driven-development skill during implementation. Write tests first, then implement to pass them.

---

## Known Limitations / Tech Debt

- [x] Browser extension signing works (uses signMessage with 5s delay between calls)
- [ ] Mobile wallet connection not tested yet
- [ ] Verifiable Credential presentation is hardcoded with dummy data
- [ ] No persistent file storage — PDFs processed client-side only
- [x] Contract interaction uses microservice API (SDK fallback not implemented)
- [x] Database: migrated from SQLite to Neon Postgres

---

*Last updated: 2026-03-15*