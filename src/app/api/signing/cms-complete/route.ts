import { NextResponse } from 'next/server';

/**
 * POST /api/signing/cms-complete
 *
 * DEPRECATED: CMS signing is now handled entirely by /api/signing/cms-sign
 * in a single step using @signpdf's proven signing pipeline.
 */
export async function POST() {
  return NextResponse.json(
    { success: false, error: 'This endpoint is deprecated. CMS signing is now handled by /api/signing/cms-sign.' },
    { status: 410 }
  );
}
