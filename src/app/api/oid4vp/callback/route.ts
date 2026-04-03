import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import {
  getEntry,
  completeEntry,
  failEntry,
  expireEntry,
} from '@/lib/oid4vp/verification-store';
import type { VerifiedClaims, MyKadClaims, PassportClaims, CredentialType } from '@/types/oid4vp';

// --- Environment ---
const CALLBACK_SECRET = process.env.OID4VP_CALLBACK_SECRET || '';

// Maximum age of a callback timestamp (5 minutes) to prevent replay attacks
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;

/**
 * Verify the HMAC-SHA256 signature on the callback.
 *
 * The OID4VP service computes:
 *   HMAC-SHA256(secret, "{timestamp}.{json_body}")
 * and sends the result as a Base64-encoded string in X-Callback-Signature.
 */
function verifySignature(
  payload: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  if (!payload || !timestamp || !signature || !secret) return false;

  const message = `${timestamp}.${payload}`;
  const expected = createHmac('sha256', secret)
    .update(message)
    .digest('base64');

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    // Lengths differ — not equal
    return false;
  }
}

/**
 * Check that the callback timestamp is recent (within 5 minutes).
 * Timestamp is ISO-8601 format: "2026-04-02T08:17:36.678022Z"
 */
function isTimestampFresh(timestamp: string): boolean {
  const callbackTime = new Date(timestamp).getTime();
  if (isNaN(callbackTime)) return false;
  const age = Math.abs(Date.now() - callbackTime);
  return age <= MAX_TIMESTAMP_AGE_MS;
}

/**
 * Extract typed claims from the OID4VP callback payload.
 *
 * The actual claim data lives inside the credentials array:
 *   credentials[0].credential_subject.mykad.name
 *   credentials[0].credential_subject.mykad.icNo
 *
 * The verified_claims field uses JSON $ref pointers back to credentials,
 * so we resolve claims directly from the credentials array.
 */
function extractClaims(
  credentialType: CredentialType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fullPayload: Record<string, any>
): VerifiedClaims | null {
  // Resolve actual claim data from the credentials array
  const credentials = fullPayload.credentials as Array<{
    credential_subject?: Record<string, Record<string, unknown>>;
  }> | undefined;

  if (!credentials?.length) {
    console.warn('[oid4vp/callback] No credentials array in payload');
    return null;
  }

  // Look for claim data in credential_subject under known keys
  const credSubject = credentials[0].credential_subject;
  if (!credSubject) {
    console.warn('[oid4vp/callback] No credential_subject in first credential');
    return null;
  }

  // Try to find the claims data under the credential type key or any nested object
  // e.g., credential_subject.mykad or credential_subject.passport
  const claimData =
    credSubject.mykad ??
    credSubject.passport ??
    credSubject.identityCardMalaysia ??
    credSubject;

  console.log('[oid4vp/callback] Extracted claim data:', JSON.stringify(claimData));

  if (credentialType === 'mykad') {
    const claims: MyKadClaims = {
      name: String(claimData.name || ''),
      icNumber: String(claimData.icNo || claimData.icNumber || ''),
    };
    if (!claims.name) return null;
    return { credentialType: 'mykad', claims };
  }

  const claims: PassportClaims = {
    name: String(claimData.name || ''),
    passportNumber: String(claimData.passportNumber || ''),
  };
  if (!claims.name) return null;
  return { credentialType: 'passport', claims };
}

/**
 * POST /api/oid4vp/callback
 *
 * Receives the verification result from the OID4VP hosted verifier service.
 * Verifies HMAC signature, then stores the result for frontend polling.
 *
 * Headers:
 *   X-Callback-Timestamp: ISO-8601 timestamp
 *   X-Callback-Signature: Base64-encoded HMAC-SHA256
 */
export async function POST(request: NextRequest) {
  try {
    const timestamp = request.headers.get('x-callback-timestamp') || '';
    const signature = request.headers.get('x-callback-signature') || '';

    // Read raw body for HMAC verification
    const rawBody = await request.text();

    // 1. Verify HMAC signature
    if (!CALLBACK_SECRET) {
      console.error('[oid4vp/callback] OID4VP_CALLBACK_SECRET not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    if (!timestamp || !signature) {
      console.warn('[oid4vp/callback] Missing signature headers');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!verifySignature(rawBody, timestamp, signature, CALLBACK_SECRET)) {
      console.warn('[oid4vp/callback] Invalid HMAC signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Check timestamp freshness (replay protection)
    if (!isTimestampFresh(timestamp)) {
      console.warn('[oid4vp/callback] Stale timestamp:', timestamp);
      return NextResponse.json({ error: 'Stale callback' }, { status: 401 });
    }

    // 3. Parse payload — handle both snake_case and camelCase field names
    //    (the OID4VP service sends snake_case, but docs show both conventions)
    const payload = JSON.parse(rawBody);

    // Log raw payload for debugging
    console.log('[oid4vp/callback] Raw payload:', JSON.stringify(payload));

    // Normalize field names: support both snake_case and camelCase
    const presentationId = payload.presentation_id ?? payload.presentationId;
    const stateId = payload.state_id ?? payload.stateId;
    const verified = payload.verified;
    const status = payload.status;
    const verifiedClaimsData = payload.verified_claims ?? payload.verifiedClaims;
    const verificationResults = payload.verification_results ?? payload.verificationResults;
    const errorMessage = payload.error_message ?? payload.errorMessage;

    console.log('[oid4vp/callback] Parsed callback:', {
      presentationId,
      stateId,
      status,
      verified,
      hasVerifiedClaims: !!verifiedClaimsData,
      hasVerificationResults: !!verificationResults,
    });

    // 4. Lookup the pending verification entry
    const entry = getEntry(stateId);
    if (!entry) {
      console.warn('[oid4vp/callback] Unknown stateId:', stateId);
      // Still return 200 to acknowledge receipt (avoid retries)
      return NextResponse.json({ received: true, warning: 'Unknown stateId' });
    }

    // 5. Idempotency — skip if already processed
    if (entry.status !== 'pending') {
      console.log('[oid4vp/callback] Already processed stateId:', stateId, 'status:', entry.status);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // 6. Process by status
    //    Claims are in credentials[0].credential_subject, not in verified_claims
    //    (verified_claims uses $ref pointers back to credentials)

    if (status === 'VERIFIED' && verified) {
      const claims = extractClaims(entry.credentialType, payload as Record<string, unknown>);
      if (claims) {
        completeEntry(stateId, claims, presentationId);
        console.log('[oid4vp/callback] Verified:', stateId, 'claims:', JSON.stringify(claims));
      } else {
        failEntry(stateId, 'Could not extract claims from callback');
        console.error('[oid4vp/callback] Failed to extract claims. Full payload logged above.');
      }
    } else if (status === 'EXPIRED') {
      expireEntry(stateId);
      console.log('[oid4vp/callback] Expired:', stateId);
    } else {
      failEntry(stateId, errorMessage || `Verification ${status}`);
      console.log('[oid4vp/callback] Failed:', stateId, status, errorMessage);
    }

    // 7. Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[oid4vp/callback] Error:', error);
    // Return 200 anyway to prevent the OID4VP service from retrying
    return NextResponse.json({ received: true, error: 'Internal processing error' });
  }
}
