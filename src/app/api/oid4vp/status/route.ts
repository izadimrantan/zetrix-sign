import { NextRequest, NextResponse } from 'next/server';
import { getEntry, cleanup } from '@/lib/oid4vp/verification-store';
import type { Oid4vpStatusResponse } from '@/types/oid4vp';

/**
 * GET /api/oid4vp/status?stateId=...
 *
 * Frontend polls this endpoint to check if the OID4VP callback has arrived
 * for a given verification request.
 *
 * Returns:
 *   - { status: 'pending' } while waiting for the user to scan QR and approve
 *   - { status: 'verified', claims, presentationId } on success
 *   - { status: 'failed' | 'expired', error } on failure
 */
export async function GET(request: NextRequest) {
  // Run periodic cleanup of expired entries
  cleanup();

  const stateId = request.nextUrl.searchParams.get('stateId');

  if (!stateId) {
    return NextResponse.json(
      { success: false, status: 'failed', error: 'Missing stateId parameter' } satisfies Oid4vpStatusResponse,
      { status: 400 }
    );
  }

  const entry = getEntry(stateId);

  if (!entry) {
    return NextResponse.json(
      { success: false, status: 'expired', error: 'Verification request not found or expired' } satisfies Oid4vpStatusResponse,
      { status: 404 }
    );
  }

  const response: Oid4vpStatusResponse = {
    success: true,
    status: entry.status,
  };

  if (entry.status === 'verified' && entry.claims) {
    response.claims = entry.claims;
    response.presentationId = entry.presentationId;
  }

  if (entry.status === 'failed' || entry.status === 'expired') {
    response.error = entry.error;
  }

  return NextResponse.json(response);
}
