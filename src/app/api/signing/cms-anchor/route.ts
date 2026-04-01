import { NextRequest, NextResponse } from 'next/server';
import { appendAnchorXmp } from '@/lib/cms/incremental-update';
import type { CmsAnchorRequest, CmsAnchorResponse } from '@/types/cms';

/**
 * POST /api/signing/cms-anchor
 *
 * Phase 3 of CMS signing: After the blockchain transaction is confirmed,
 * appends anchor metadata (tx hash, block number, verification URL) to the
 * signed PDF via incremental update. This does NOT invalidate the CMS
 * signature because it appends after %%EOF.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CmsAnchorRequest;

    const {
      signedPdfBase64,
      txHash,
      blockNumber,
      blockTimestamp,
      documentHash,
      chainId,
    } = body;

    if (!signedPdfBase64 || !txHash || !documentHash) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: signedPdfBase64, txHash, documentHash' },
        { status: 400 }
      );
    }

    // 1. Decode the signed PDF
    const signedPdfBytes = new Uint8Array(Buffer.from(signedPdfBase64, 'base64'));

    // 2. Build explorer URL
    const explorerBaseUrl = process.env.NEXT_PUBLIC_ZETRIX_EXPLORER_URL || 'https://explorer.testnet.zetrix.com';
    const verificationUrl = `${explorerBaseUrl}/tx/${txHash}`;

    // 3. Append anchor XMP via incremental update
    const finalPdfBytes = await appendAnchorXmp(signedPdfBytes, {
      documentHash,
      txHash,
      blockNumber: blockNumber || 0,
      blockTimestamp: blockTimestamp || new Date().toISOString(),
      chainId: chainId || 'zetrix-testnet',
      verificationUrl,
    });

    // 4. Return final PDF
    const finalPdfBase64 = Buffer.from(finalPdfBytes).toString('base64');

    const response: CmsAnchorResponse = { finalPdfBase64 };

    return NextResponse.json({ success: true, ...response });
  } catch (error) {
    console.error('[cms-anchor] Error:', error);
    const message = error instanceof Error ? error.message : 'Anchor XMP append failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
