import { NextRequest, NextResponse } from 'next/server';
import { appendAnchorXmp } from '@/lib/cms/incremental-update';
import { storePdf, getPdf } from '@/lib/pdf-store';
import type { CmsAnchorRequest } from '@/types/cms';

/**
 * POST /api/signing/cms-anchor
 *
 * Phase 3 of CMS signing: After the blockchain transaction is confirmed,
 * appends anchor metadata (tx hash, block number, verification URL) to the
 * signed PDF via incremental update. This does NOT invalidate the CMS
 * signature because it appends after %%EOF.
 *
 * The signed PDF is retrieved from the server-side store using the download
 * token — the client never sends the PDF bytes back. This eliminates the
 * ~2.5MB base64 round-trip that caused empty/corrupted downloads on iOS.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CmsAnchorRequest;

    const {
      downloadToken: sourceToken,
      txHash,
      blockNumber,
      blockTimestamp,
      documentHash,
      chainId,
    } = body;

    if (!sourceToken || !txHash || !documentHash) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: downloadToken, txHash, documentHash' },
        { status: 400 }
      );
    }

    // 1. Retrieve the CMS-signed PDF from the server-side store
    const signedPdfBuffer = getPdf(sourceToken);
    if (!signedPdfBuffer) {
      return NextResponse.json(
        { success: false, error: 'Signed PDF not found or expired. Please sign the document again.' },
        { status: 404 }
      );
    }

    const signedPdfBytes = new Uint8Array(signedPdfBuffer);
    console.log(`[cms-anchor] Retrieved signed PDF from store: ${signedPdfBytes.length} bytes`);

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

    // 4. Store final PDF server-side for reliable mobile download
    const finalPdfBuffer = Buffer.from(finalPdfBytes);
    const downloadToken = storePdf(finalPdfBuffer);
    console.log(`[cms-anchor] Stored final PDF (${finalPdfBuffer.length} bytes), token: ${downloadToken.slice(0, 8)}...`);

    // 5. Return only the new download token (NO base64 PDF response)
    return NextResponse.json({
      success: true,
      downloadToken,
    });
  } catch (error) {
    console.error('[cms-anchor] Error:', error);
    const message = error instanceof Error ? error.message : 'Anchor XMP append failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
