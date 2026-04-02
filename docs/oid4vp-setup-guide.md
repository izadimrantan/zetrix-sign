# OID4VP Setup Guide — SDK Direct Approach

## Prerequisites
- MyID mobile app with a real MyKad or Passport VC
- Template IDs for MyKad and Passport
- VP verification endpoint URL and Bearer token

## Environment Variables

### Development / Test (`.env.local`)

```env
# VP verification endpoint (server-side)
OID4VP_VERIFY_URL=https://api-sandbox.zetrix.com/cred/v1/vp/verify
OID4VP_VERIFY_TOKEN=<test-bearer-token>

# VC Template IDs (client-side)
NEXT_PUBLIC_MYKAD_TEMPLATE_ID=did:zid:<test-mykad-hash>
NEXT_PUBLIC_PASSPORT_TEMPLATE_ID=did:zid:<test-passport-hash>

# MyID app download links (client-side)
NEXT_PUBLIC_MYID_ANDROID_URL=https://play.google.com/store/apps/details?id=my.mimos.mydigitalsuper
NEXT_PUBLIC_MYID_IOS_URL=https://apps.apple.com/my/app/myid-super-app/id6749565922
```

### Production (`.env.production.local`)

```env
# VP verification endpoint (server-side)
OID4VP_VERIFY_URL=https://api-v2.zetrix.com/cred/v1/vp/verify
OID4VP_VERIFY_TOKEN=<production-bearer-token>

# VC Template IDs (client-side)
NEXT_PUBLIC_MYKAD_TEMPLATE_ID=did:zid:<prod-mykad-hash>
NEXT_PUBLIC_PASSPORT_TEMPLATE_ID=did:zid:<prod-passport-hash>

# MyID app download links (client-side)
NEXT_PUBLIC_MYID_ANDROID_URL=https://play.google.com/store/apps/details?id=my.mimos.mydigitalsuper
NEXT_PUBLIC_MYID_IOS_URL=https://apps.apple.com/my/app/myid-super-app/id6749565922
```

### Differences Between Environments

| Variable | Dev/Test | Production |
|----------|----------|------------|
| `OID4VP_VERIFY_URL` | `api-sandbox.zetrix.com` | `api-v2.zetrix.com` |
| `OID4VP_VERIFY_TOKEN` | Test token | Production token |
| `NEXT_PUBLIC_MYKAD_TEMPLATE_ID` | Test template DID | Production template DID |
| `NEXT_PUBLIC_PASSPORT_TEMPLATE_ID` | Test template DID | Production template DID |

> **Note on token consolidation:** `MICROSERVICE_AUTH_TOKEN` and `OID4VP_VERIFY_TOKEN`
> are currently separate tokens. Both authenticate against the Zetrix API
> (`api-sandbox` / `api-v2`). If confirmed that a single token works for both
> the microservice endpoints and the VP verify endpoint, these can be merged into
> a single `ZETRIX_API_TOKEN` env var in a future refactor. Keeping them separate
> for now to avoid coupling unrelated services.

## How It Works

1. **User selects credential type** (MyKad or Passport)
2. **SDK connects to MyID** via WebSocket (`appType: 'myid'`)
3. **QR code appears** — user scans with MyID app
4. **SDK calls `getVP()`** with templateId + attributes
5. **MyID shows disclosure prompt** — user approves
6. **SDK returns UUID** — the VP identifier
7. **Frontend sends UUID to backend** (`POST /api/oid4vp/verify`)
8. **Backend calls Zetrix API** — `GET {OID4VP_VERIFY_URL}?id={uuid}` with Bearer token
9. **Claims returned** — name, IC/passport number displayed in UI
10. **Claims feed into CMS signing** — X.509 cert subject includes real identity

## Mock Mode

When `OID4VP_VERIFY_URL` is not set, the verify endpoint returns sample claims
automatically. The SDK `getVP()` call still requires template IDs and a MyID
wallet to work — mock mode only bypasses the backend verification step.

## Testing

1. Set all env vars in `.env.local`
2. Start dev server: `npm run dev`
3. Go through signing flow → "Wallet & Identity" step
4. Connect wallet, then select MyKad → "Verify with MyID"
5. Scan QR with MyID → approve disclosure
6. Claims appear in UI
7. Continue to signing → check Foxit cert subject for real identity

## Adjusting Claim Field Mappings

If the verification endpoint returns claims in a different structure than
expected, update the `extractClaims()` function in:
`src/app/api/oid4vp/verify/route.ts`

The function currently expects fields like `name`, `icNo`, `passportNumber`
at the top level of the response data. If the actual response nests them
differently (e.g., under `credentialSubject`), adjust the field paths there.
