import { NextRequest, NextResponse } from 'next/server';
import type { Oid4vpVerifyRequest, VerifiedClaims, MyKadClaims, PassportClaims } from '@/types/oid4vp';

const VP_VERIFY_URL = process.env.OID4VP_VERIFY_URL;
const VP_VERIFY_TOKEN = process.env.OID4VP_VERIFY_TOKEN;

/**
 * Extract typed claims from the verification endpoint response.
 * The response structure may vary — adjust field mappings here.
 */
function extractClaims(
  credentialType: 'mykad' | 'passport',
  data: Record<string, unknown>
): VerifiedClaims | null {
  if (credentialType === 'mykad') {
    const claims: MyKadClaims = {
      name: String(data.name || ''),
      icNumber: String(data.icNo || data.icNumber || ''),
      myDigitalIdExpiry: String(data.expiryDate || data.myDigitalIdExpiry || ''),
    };
    if (!claims.name) return null;
    return { credentialType: 'mykad', claims };
  }

  const claims: PassportClaims = {
    type: String(data.type || ''),
    countryCode: String(data.countryCode || ''),
    passportNumber: String(data.passportNumber || ''),
    name: String(data.name || ''),
    identityNumber: String(data.identityNumber || ''),
    dateOfBirth: String(data.dateOfBirth || ''),
    gender: String(data.gender || ''),
    height: String(data.height || ''),
    dateOfIssue: String(data.dateOfIssue || ''),
    dateOfExpiry: String(data.dateOfExpiry || ''),
    issuingOffice: String(data.issuingOffice || ''),
    photo: String(data.photo || ''),
  };
  if (!claims.name) return null;
  return { credentialType: 'passport', claims };
}

/**
 * POST /api/oid4vp/verify
 *
 * Takes a VP uuid (from SDK getVP()) and calls the external verification
 * endpoint to retrieve and validate the VP claims.
 *
 * In mock mode (no verify URL configured), returns sample claims.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Oid4vpVerifyRequest;
    const { uuid, credentialType } = body;

    if (!uuid) {
      return NextResponse.json(
        { success: false, error: 'Missing uuid' },
        { status: 400 }
      );
    }

    if (!credentialType || !['mykad', 'passport'].includes(credentialType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentialType' },
        { status: 400 }
      );
    }

    // Mock mode for development
    if (!VP_VERIFY_URL || !VP_VERIFY_TOKEN) {
      console.warn('[oid4vp/verify] No verify endpoint configured — using mock mode');
      const mockClaims: VerifiedClaims = credentialType === 'mykad'
        ? {
            credentialType: 'mykad',
            claims: {
              name: 'Ahmad bin Ali',
              icNumber: '901234-10-5678',
              myDigitalIdExpiry: '2028-12-31',
            },
          }
        : {
            credentialType: 'passport',
            claims: {
              type: 'P',
              countryCode: 'MYS',
              passportNumber: 'A12345678',
              name: 'Ahmad bin Ali',
              identityNumber: '901234-10-5678',
              dateOfBirth: '1990-01-15',
              gender: 'M',
              height: '175',
              dateOfIssue: '2023-01-01',
              dateOfExpiry: '2028-01-01',
              issuingOffice: 'Immigration Department Malaysia',
              photo: '',
            },
          };

      return NextResponse.json({
        success: true,
        verified: true,
        claims: mockClaims,
      });
    }

    // Call external verification endpoint: GET {VP_VERIFY_URL}?id={uuid}
    const verifyUrl = `${VP_VERIFY_URL}?id=${encodeURIComponent(uuid)}`;
    const verifyRes = await fetch(verifyUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${VP_VERIFY_TOKEN}`,
      },
    });

    if (!verifyRes.ok) {
      const errBody = await verifyRes.json().catch(() => ({}));
      console.error('[oid4vp/verify] Verification endpoint error:', verifyRes.status, errBody);
      return NextResponse.json(
        { success: false, verified: false, error: 'VP verification failed' },
        { status: 502 }
      );
    }

    const verifyData = await verifyRes.json();
    console.log('[oid4vp/verify] Endpoint response:', JSON.stringify(verifyData));

    // Extract claims from the response — adjust field path if needed
    const responseData = verifyData.data || verifyData;
    const claims = extractClaims(credentialType, responseData as Record<string, unknown>);

    if (!claims) {
      return NextResponse.json({
        success: true,
        verified: false,
        error: 'Could not extract claims from verification response',
      });
    }

    return NextResponse.json({
      success: true,
      verified: true,
      claims,
    });
  } catch (error) {
    console.error('[oid4vp/verify] Error:', error);
    const message = error instanceof Error ? error.message : 'Verification failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
