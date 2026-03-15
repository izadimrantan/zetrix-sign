# Decision Log

> **Purpose:** Record architectural and technical decisions for future reference.
> **When:** Log decisions on architecture, tech stack, major patterns, or significant trade-offs.

---

## Decisions

<!-- Newest decision at top -->

### 2026-03-15 - Google Analytics Event Tracking

**Context:** Need to track user behavior, funnel drop-offs, and feature usage across the signing and verification flows.

**Decision:** Implement comprehensive GA4 custom event tracking via a centralized `src/lib/analytics.ts` utility. 30+ custom events cover every user interaction from landing page CTAs through signing completion and document verification.

**Rationale:** The single-page stepper doesn't generate automatic page views per step. Custom events provide granular funnel analytics — can track exactly where users drop off (e.g., wallet connection, signature creation, blockchain anchoring). All events fire via `gtag('event', ...)` and are gated by the `NEXT_PUBLIC_GA_MEASUREMENT_ID` env var.

**Decided By:** @izadi with AI input

---

### 2026-03-15 - Database Migration: SQLite → Neon Postgres

**Context:** SQLite (file-based) doesn't work on Vercel's ephemeral filesystem. Need a hosted database for production deployment.

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| Neon Postgres (serverless) | Free tier, Vercel integration, Prisma adapter, serverless-friendly | Requires connection pooling config |
| Supabase Postgres | Full Postgres, built-in auth | Heavier than needed |
| Turso (serverless SQLite) | SQLite compatible, minimal migration | Less mature ecosystem |

**Decision:** Neon Postgres with `@prisma/adapter-neon`

**Rationale:** Neon integrates directly with Vercel's Storage marketplace. Serverless connection pooling works well with Vercel's serverless functions. Free tier is sufficient for testnet usage. Prisma schema only needed provider change from `sqlite` to `postgresql`.

**Decided By:** @izadi with AI input

---

### 2026-03-15 - Combine Wallet + Identity Steps

**Context:** The original 8-step flow had separate steps for wallet connection and identity confirmation. Users found 8 steps visually overwhelming.

**Decision:** Combine Step 2 (Wallet) and Step 3 (Identity) into a single "Wallet & Identity" step. Identity section appears automatically after wallet connects.

**Rationale:** Reduces the stepper from 8 to 7 steps, making the flow feel shorter. The identity confirmation naturally follows wallet connection since the VC is tied to the wallet. No functional change — both actions still happen, just on the same screen.

**Decided By:** @izadi with AI input

---

### 2026-03-15 - Extension Blob Signing Workaround

**Context:** The Zetrix wallet browser extension's `signMessage` method silently fails when called twice in rapid succession (document hash signing + blob signing). The extension's internal message channel closes after the first call.

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| 5-second delay between signMessage calls | Simple, works reliably | Adds 5s wait to the flow |
| Use signBlob for blob signing | Proper API separation | Extension's signBlob rejects valid blobs ("Invalid Blob string") |
| Re-initialize extension between calls | Clean state | May require user re-authorization |

**Decision:** Use `signMessage` for both calls with a 5-second delay between them

**Rationale:** The reference codebase uses `signMessage` for blob signing successfully. The extension can't handle two consecutive calls without a reset period. 5 seconds is the minimum reliable delay (10s works, 5s works, lower untested). The `signBlob` extension method rejects valid hex blobs for unknown reasons.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - Test-Driven Development Approach

**Context:** Need to decide on the development methodology for building the web application.

**Decision:** Use TDD (Test-Driven Development) via the superpowers:test-driven-development skill

**Rationale:** Write tests first for each feature/component, then implement code to pass the tests. Ensures correctness from the start, prevents regressions, and produces a well-tested codebase. Particularly important for the blockchain interaction layer, PDF processing, and wallet integration where bugs are hard to catch manually.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - Contract Interaction Layer

**Context:** Need to decide how the web app queries the smart contract (read-only) and submits transactions (state-changing).

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| zetrix-sdk-nodejs (server-side in API routes) | Direct node interaction, no external dependency, full control | Untested in this project, may have compatibility issues with Next.js |
| Microservice API (POST /ztx/contract/query-address) | Proven pattern, already used in other projects, has auth | External dependency, requires microservice to be running |
| Direct client-side node calls | No server needed for queries | Exposes node URLs to client, no auth layer |

**Decision:** zetrix-sdk-nodejs as primary, microservice API as fallback

**Rationale:** Prefer direct SDK integration for fewer external dependencies. Microservice is the proven fallback if the SDK has issues. For transaction submission specifically, the wallet SDK's sendTransaction is the only viable option because the smart contract's `anchorDocument` checks that `Chain.msg.sender` matches the signer's public key — server-side submission would break this identity check.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - Signing Flow UX Pattern

**Context:** The BR doc specifies separate routes per step (/upload, /wallet-connect, /signature-options, etc.) suggesting a multi-page wizard. Need to decide on the actual UX pattern.

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| Single-page stepper | Instant transitions, simpler state management (all in React state), modern UX (DocuSign-like), no route guards needed, file objects stay in memory | No bookmarkable URLs per step, refresh loses progress (mitigated by sessionStorage), GA requires custom events |
| Multi-page wizard (per BR spec) | Bookmarkable/shareable steps, automatic GA page view tracking, matches BR spec exactly, natural browser history | State must be serialized across routes, page transition flickers, more boilerplate (route guards, redirect logic), PDF File object can't be serialized to localStorage |
| Hybrid (2-3 grouped pages) | Balance of both approaches | Complex to decide groupings, still has some state persistence issues |

**Decision:** Single-page stepper with custom GA events

**Rationale:** Better UX for a signing flow completed in one sitting. All state lives in React state — no serialization issues with File objects. Custom GA events provide equivalent (or better) funnel analytics with minimal extra code. Landing page (/) and verify (/verify) remain separate routes.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - PDF Processing Strategy

**Context:** The BR doc describes server-side PDF processing with cloud storage (S3/MinIO). Need to decide where PDF operations happen and how files are stored.

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| Client-side processing (pdf-lib in browser) | PDFs never leave user's device, no server storage needed, no cloud storage costs, works on Vercel's ephemeral filesystem, privacy-preserving | Processing limited by browser capabilities, no server-side backup of files |
| Cloud storage (S3/R2/Blob) | Persistent file storage, shareable download URLs, server-side PDF manipulation | Requires cloud storage setup, credentials, costs, files stored externally |
| Local filesystem (dev only) | Simplest setup | Doesn't work on Vercel (ephemeral), files lost on redeploy |

**Decision:** Client-side PDF processing with pdf-lib

**Rationale:** PDFs processed entirely in the browser. Signature insertion, hash computation, and final PDF generation all happen client-side. No cloud storage dependency. Download is a browser-generated blob. Verification = user re-uploads the file and we hash+compare against on-chain data. Privacy-preserving and Vercel-compatible.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - Wallet Connection Modes

**Context:** Zetrix Wallet can be connected via browser extension (window.zetrix) or mobile app (QR code via zetrix-connect-wallet-sdk). Need to decide which modes to support.

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| Both extension + mobile QR | Covers all user scenarios (desktop + mobile), maximum accessibility | More implementation work, need to handle two different APIs |
| Browser extension only | Simpler implementation | Limits to desktop users with extension installed |
| Mobile QR only | Works on all devices | Requires mobile wallet app, no native desktop experience |

**Decision:** Support both browser extension and mobile QR

**Rationale:** Maximum user accessibility. Desktop users with the extension get a seamless experience. Mobile users or those without the extension can scan a QR code with the Zetrix mobile app.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - Verifiable Credential Handling

**Context:** The BR requires users to present a Verifiable Credential before signing. The test wallet does not have real VCs available yet.

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| Hardcoded test identity | Allows full flow testing, VC step is visible in UI, credentialID flows to smart contract | Not real verification, needs replacement later |
| User-entered name | More realistic UX, personalized | Still fake VC, more UI work for temporary feature |
| Skip VC step entirely | Less code, simpler flow | Misses a critical step, harder to add back later, credentialID gap in contract |

**Decision:** Hardcoded test identity (Name: "John Tan", DID: "did:zetrix:test123", Issuer: "ZCert Test Authority")

**Rationale:** Keeps the VC step visible in the UI so the full flow is testable. The credentialID ("vc_test_credential_001" or similar) is sent to the smart contract, maintaining data integrity. The UI for this step is designed to accommodate future real VC integration. See PROJECT_CONTEXT.md "Verifiable Credentials — Future Integration" section for detailed requirements.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - Application Architecture

**Context:** Need to decide the overall architecture — whether to use a separate backend or Next.js API routes, and where to host the Next.js app.

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| Next.js API Routes (single project) | Single codebase, simpler deployment, API routes for contract queries | Server-side limited to what Next.js API routes can do |
| Separate backend (Express/Fastify) | Clear separation of concerns, independent scaling | Two projects to maintain, CORS setup, more complex deployment |
| Frontend-only (no backend) | Simplest architecture | No server-side validation, node URLs exposed to client |

**Decision:** Next.js API Routes (single project)

**Rationale:** Single codebase with Route Handlers for contract query endpoints. PDF processing is client-side so the server load is minimal. API routes handle zetrix-sdk-nodejs calls to query the smart contract. Simpler deployment to Vercel.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - UI Theme and Component Library

**Context:** Need to choose a component library and visual theme for the application.

**Decision:** shadcn/ui with dark red/maroon color theme matching the reference mockup

**Rationale:** shadcn/ui provides beautiful, accessible, customizable components built on Radix UI. The dark red/maroon theme follows the existing Zetrix Sign branding from the reference mockup. Responsive design for desktop and mobile.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - Project Directory Structure

**Context:** Need to decide where the Next.js app lives relative to existing project files.

**Decision:** New subdirectory `/zetrix-sign-official/web/`

**Rationale:** Keeps the smart contract code, reference files, and vibecode docs separate from the web app. Clean separation of concerns.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - Signature Creation Options

**Context:** The BR doc specifies two signature types: auto-generated text and hand-drawn canvas.

**Decision:** Implement both auto text signature and hand-drawn canvas signature

**Rationale:** Matches the BR spec. Auto signature is quick and professional. Drawn signature adds a personal touch. Tab interface lets users choose.

**Decided By:** @izadi with AI input

---

### 2026-03-12 - Transaction Gas Payment

**Context:** Need to decide who pays gas for the anchorDocument blockchain transaction.

**Options Considered:**
| Option | Pros | Cons |
|--------|------|------|
| Wallet SDK sendTransaction (user pays gas) | Most decentralized, identity check works (Chain.msg.sender = user) | User needs testnet ZTX tokens |
| Server-side funded account | Better UX, user doesn't need tokens | Breaks identity check in smart contract, requires funded server wallet |

**Decision:** Wallet SDK sendTransaction (user pays gas)

**Rationale:** The smart contract's `anchorDocument` verifies that `Chain.msg.sender` matches the signer's public key via `publicKeyMatchesAddress()`. Server-side submission would make the server the sender, breaking this critical identity verification. Users must have testnet ZTX tokens.

**Decided By:** @izadi with AI input

---

*Template Version: 2.0*