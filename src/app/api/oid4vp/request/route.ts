import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createEntry } from '@/lib/oid4vp/verification-store';
import type { CredentialType } from '@/types/oid4vp';

// --- Environment ---
const OID4VP_API_BASE = process.env.OID4VP_API_BASE || '';
const OID4VP_API_KEY = process.env.OID4VP_API_KEY || '';
const OID4VP_CALLBACK_URL = process.env.OID4VP_CALLBACK_URL || '';

// Template IDs (server-side — no longer needs NEXT_PUBLIC)
const MYKAD_TEMPLATE_ID = process.env.MYKAD_TEMPLATE_ID || process.env.NEXT_PUBLIC_MYKAD_TEMPLATE_ID || '';
const PASSPORT_TEMPLATE_ID = process.env.PASSPORT_TEMPLATE_ID || process.env.NEXT_PUBLIC_PASSPORT_TEMPLATE_ID || '';

// Claim paths for each credential type
const CREDENTIAL_CLAIMS: Record<CredentialType, Array<{ path: string[] }>> = {
  mykad: [
    { path: ['name'] },
    { path: ['icNo'] },
  ],
  passport: [
    { path: ['name'] },
    { path: ['passportNumber'] },
  ],
};

/**
 * POST /api/oid4vp/request
 *
 * Creates a verification request with the OID4VP hosted verifier.
 * Returns QR code data for the frontend to display.
 *
 * Flow:
 *   1. Generate a unique stateId
 *   2. Call POST {OID4VP_API_BASE}/v1/verification/request
 *   3. Store pending entry in verification store
 *   4. Return qrCodeData + stateId to frontend
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const credentialType = body.credentialType as CredentialType;

    // Validate credential type
    if (!credentialType || !['mykad', 'passport'].includes(credentialType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentialType. Must be "mykad" or "passport".' },
        { status: 400 }
      );
    }

    // Check configuration
    if (!OID4VP_API_BASE || !OID4VP_API_KEY) {
      console.error('[oid4vp/request] Missing OID4VP_API_BASE or OID4VP_API_KEY');
      return NextResponse.json(
        { success: false, error: 'OID4VP service not configured' },
        { status: 500 }
      );
    }

    if (!OID4VP_CALLBACK_URL) {
      console.error('[oid4vp/request] Missing OID4VP_CALLBACK_URL');
      return NextResponse.json(
        { success: false, error: 'Callback URL not configured' },
        { status: 500 }
      );
    }

    const templateId = credentialType === 'mykad' ? MYKAD_TEMPLATE_ID : PASSPORT_TEMPLATE_ID;
    if (!templateId) {
      return NextResponse.json(
        { success: false, error: `Template ID for ${credentialType} not configured` },
        { status: 500 }
      );
    }

    // Generate a unique stateId to correlate request ↔ callback ↔ frontend poll
    const stateId = randomUUID();

    // Build the verification request body
    const verificationBody = {
      callbackUrl: OID4VP_CALLBACK_URL,
      stateId,
      requirements: {
        credentials: [
          {
            id: templateId,
            claims: CREDENTIAL_CLAIMS[credentialType],
          },
        ],
      },
    };

    console.log('[oid4vp/request] Creating verification request:', JSON.stringify(verificationBody));

    // Call the OID4VP hosted verifier API
    const apiUrl = `${OID4VP_API_BASE}/v1/verification/request`;
    const apiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OID4VP_API_KEY}`,
      },
      body: JSON.stringify(verificationBody),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.json().catch(() => ({}));
      console.error('[oid4vp/request] OID4VP API error:', apiRes.status, errBody);
      const messages = (errBody as { messages?: string[] }).messages;
      return NextResponse.json(
        {
          success: false,
          error: messages?.[0] || `OID4VP API returned ${apiRes.status}`,
        },
        { status: 502 }
      );
    }

    const apiData = await apiRes.json();
    console.log('[oid4vp/request] OID4VP API response:', JSON.stringify(apiData));

    const obj = apiData.object;
    if (!obj?.qrCodeData) {
      return NextResponse.json(
        { success: false, error: 'No QR code data in response' },
        { status: 502 }
      );
    }

    // Store pending verification entry
    createEntry(stateId, credentialType);

    return NextResponse.json({
      success: true,
      stateId,
      presentationId: obj.presentationId,
      qrCodeData: obj.qrCodeData,
      deepLinkUrl: obj.deepLinkUrl,
      expiresAt: obj.expiresAt,
    });
  } catch (error) {
    console.error('[oid4vp/request] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create verification request';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
