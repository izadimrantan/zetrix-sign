# OID4VP Setup Guide — Hosted Verifier Approach

## Overview

Zetrix Sign uses the OID4VP hosted verifier API to verify user identity via
MyKad or Passport Verifiable Credentials stored in the MyID mobile wallet.

**Flow:** Backend creates verification request → QR displayed → user scans
with MyID → OID4VP service sends HMAC-signed callback → frontend polls for
result → verified claims feed into CMS document signing.

## Prerequisites

- MyID mobile app with a real MyKad or Passport VC
- OID4VP API key (`ztx_<key>`) from the verifier admin
- HMAC callback secret (generated via API)
- VC template IDs for MyKad and Passport
- For local development: ngrok or similar tunnel for callback reachability

## Environment Variables

### Development / Test (`.env.local`)

```env
# OID4VP Hosted Verifier (Sandbox)
OID4VP_API_BASE=https://zid-oid4vp-sandbox.zetrix.com/api
OID4VP_API_KEY=ztx_<your-test-api-key>
OID4VP_CALLBACK_SECRET=<your-hmac-secret>
OID4VP_CALLBACK_URL=https://<your-ngrok-subdomain>.ngrok-free.dev/api/oid4vp/callback

# VC Template IDs (server-side)
MYKAD_TEMPLATE_ID=did:zid:<test-mykad-template-hash>
PASSPORT_TEMPLATE_ID=did:zid:<test-passport-template-hash>

# MyID app download links (client-side)
NEXT_PUBLIC_MYID_ANDROID_URL=https://play.google.com/store/apps/details?id=my.mimos.mydigitalsuper
NEXT_PUBLIC_MYID_IOS_URL=https://apps.apple.com/my/app/myid-super-app/id6749565922
```

### Production (`.env.production.local`)

```env
# OID4VP Hosted Verifier (Production)
OID4VP_API_BASE=https://zid-oid4vp.zetrix.com/api
OID4VP_API_KEY=ztx_<your-production-api-key>
OID4VP_CALLBACK_SECRET=<your-production-hmac-secret>
OID4VP_CALLBACK_URL=https://your-domain.com/api/oid4vp/callback

# VC Template IDs (server-side)
MYKAD_TEMPLATE_ID=did:zid:<prod-mykad-template-hash>
PASSPORT_TEMPLATE_ID=did:zid:<prod-passport-template-hash>

# MyID app download links (client-side)
NEXT_PUBLIC_MYID_ANDROID_URL=https://play.google.com/store/apps/details?id=my.mimos.mydigitalsuper
NEXT_PUBLIC_MYID_IOS_URL=https://apps.apple.com/my/app/myid-super-app/id6749565922
```

### Environment Differences

| Variable | Dev/Test | Production |
|----------|----------|------------|
| `OID4VP_API_BASE` | `zid-oid4vp-sandbox.zetrix.com/api` | `zid-oid4vp.zetrix.com/api` |
| `OID4VP_API_KEY` | Test key | Production key |
| `OID4VP_CALLBACK_SECRET` | Test secret | Production secret |
| `OID4VP_CALLBACK_URL` | ngrok tunnel URL | Production domain URL |
| `MYKAD_TEMPLATE_ID` | Test template DID | Production template DID |
| `PASSPORT_TEMPLATE_ID` | Test template DID | Production template DID |

## Initial Setup

### 1. Test Your API Key

```bash
curl -X GET "https://zid-oid4vp-sandbox.zetrix.com/api/v1/verification/test" \
  -H "Authorization: Bearer ztx_your_api_key_here"
```

Expected:
```json
{
  "object": {
    "message": "API key authentication successful",
    "clientName": "Your Platform Name"
  },
  "success": true
}
```

### 2. Generate Callback Secret (if not already provided)

```bash
curl -X POST "https://zid-oid4vp-sandbox.zetrix.com/api/v1/client/callback-secret" \
  -H "Authorization: Bearer ztx_your_api_key_here"
```

Response:
```json
{
  "object": {
    "callbackSecretKey": "hex_or_base64_encoded_secret"
  },
  "success": true
}
```

Store this as `OID4VP_CALLBACK_SECRET` in your env file.

### 3. Set Up ngrok (Local Development Only)

```bash
ngrok http 3000
```

Copy the HTTPS forwarding URL and set:
```
OID4VP_CALLBACK_URL=https://your-subdomain.ngrok-free.dev/api/oid4vp/callback
```

> **Note:** In production, the callback URL is simply your public domain:
> `https://your-domain.com/api/oid4vp/callback`

## How It Works

1. **User selects credential type** — MyKad or Passport tab
2. **Frontend calls backend** — `POST /api/oid4vp/request` with `{credentialType}`
3. **Backend calls OID4VP API** — `POST /v1/verification/request` with callback URL, stateId, and claim requirements
4. **QR code returned** — backend returns `qrCodeData` to frontend
5. **User scans QR** — opens MyID wallet, views disclosure prompt
6. **User approves sharing** — MyID sends VP to verifier service
7. **Verifier validates VP** — checks crypto proofs, revocation status
8. **Callback sent to backend** — `POST /api/oid4vp/callback` with HMAC-signed payload containing verified claims
9. **Backend verifies HMAC** — signature + timestamp freshness check
10. **Backend extracts claims** — from `credentials[0].credential_subject.mykad` (or `.passport`)
11. **Frontend polls and gets result** — `GET /api/oid4vp/status?stateId=...` returns verified claims
12. **Claims feed into CMS signing** — X.509 cert subject includes `CN=name, SERIALNUMBER=IC`

## Claim Requirements

### MyKad

```json
{
  "requirements": {
    "credentials": [{
      "id": "did:zid:<mykad-template-id>",
      "claims": [
        { "path": ["name"] },
        { "path": ["icNo"] }
      ]
    }]
  }
}
```

### Passport

```json
{
  "requirements": {
    "credentials": [{
      "id": "did:zid:<passport-template-id>",
      "claims": [
        { "path": ["name"] },
        { "path": ["passportNumber"] }
      ]
    }]
  }
}
```

## Callback Payload Structure

The actual callback from the OID4VP service uses **snake_case** field names.
The actual claim data lives in the `credentials` array, not in `verified_claims`
(which contains `$ref` pointers).

```json
{
  "presentation_id": "pres_...",
  "state_id": "your-uuid-stateId",
  "status": "VERIFIED",
  "verified": true,
  "timestamp": 1775231465595,
  "credentials": [
    {
      "credential_subject": {
        "mykad": {
          "name": "FULL NAME HERE",
          "icNo": "123456789012"
        }
      },
      "id": "did:zid:...",
      "issuer": "did:zid:...",
      "proof_types": ["BbsBlsSignatureProof2020"]
    }
  ],
  "verified_claims": {
    "mykad": { "$ref": "$.credentials[0].credential_subject.mykad" }
  }
}
```

## Security

- **HMAC-SHA256 callback verification** — every callback is signed with `X-Callback-Signature` (Base64) and `X-Callback-Timestamp` (ISO-8601)
- **Timestamp freshness** — callbacks older than 5 minutes are rejected
- **Idempotency** — duplicate callbacks for the same stateId are ignored
- **Constant-time comparison** — prevents timing attacks on signature verification
- **API key stored server-side** — never exposed to the client

See: https://docs.zetrix.com/oid4vp/security-best-practices

## Testing

1. Set all env vars in `.env.local` (API key, callback secret, ngrok URL, template IDs)
2. Start ngrok: `ngrok http 3000`
3. Start dev server: `npm run dev`
4. Go through signing flow → "Wallet & Identity" step
5. Connect wallet, then select MyKad → "Verify with MyID"
6. Scan QR with MyID → approve credential disclosure
7. Watch terminal for `[oid4vp/callback] Verified:` log
8. Frontend shows verified claims (name, IC number)
9. Continue to signing → verify cert subject includes real identity

## Adjusting Claim Field Mappings

If the callback payload structure changes, update the `extractClaims()` function in:
`src/app/api/oid4vp/callback/route.ts`

The function currently reads claims from:
```
credentials[0].credential_subject.mykad.name
credentials[0].credential_subject.mykad.icNo
credentials[0].credential_subject.passport.name
credentials[0].credential_subject.passport.passportNumber
```

It also tries fallback keys like `identityCardMalaysia` in case the service
uses different nesting.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `401` on API calls | Invalid API key | Check `OID4VP_API_KEY` format: `ztx_<key>` |
| No callback received | Callback URL not reachable | Check ngrok is running, URL is correct |
| `Invalid signature` on callback | Wrong HMAC secret | Regenerate via `POST /v1/client/callback-secret` |
| `Unknown stateId` in callback | Field name mismatch | Callback uses `state_id` (snake_case) — already handled |
| Claims extraction fails | Payload structure changed | Log raw payload, update `extractClaims()` |
| QR doesn't scan | MyID app version mismatch | Ensure using UAT version for sandbox |
| `EXPIRED` status | User took too long | Default 30 min expiry, retry verification |

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/verification/test` | GET | Test API key validity |
| `/v1/client/callback-secret` | POST | Generate/regenerate HMAC secret |
| `/v1/verification/request` | POST | Create verification request (returns QR) |

Full reference: https://docs.zetrix.com/oid4vp/api-references
