import { NextRequest, NextResponse } from 'next/server';
import { getPdf } from '@/lib/pdf-store';

/**
 * GET /api/signing/download?token=xxx&filename=doc-signed.pdf
 *
 * Serves a signed PDF from the in-memory store with headers that force
 * a native file download on all platforms, including iOS Safari/Chrome.
 *
 * Key headers:
 * - Content-Type: application/octet-stream — prevents iOS QuickLook
 *   from intercepting and trying to render the PDF inline (which causes
 *   grey/black screen crashes on memory-constrained WKWebView).
 * - Content-Disposition: attachment — forces the browser's native
 *   download manager instead of inline viewing.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json(
      { error: 'Missing download token' },
      { status: 400 }
    );
  }

  const pdfBytes = getPdf(token);

  if (!pdfBytes) {
    return NextResponse.json(
      { error: 'PDF not found or expired. Please sign the document again.' },
      { status: 404 }
    );
  }

  // Use the filename from the query string, or fall back to a default
  const rawFilename = request.nextUrl.searchParams.get('filename') || 'signed-document.pdf';
  // Sanitize: remove path separators and null bytes
  const filename = rawFilename.replace(/[/\\:\0]/g, '_');

  // RFC 5987 encoding for non-ASCII filenames
  const encodedFilename = encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': pdfBytes.length.toString(),
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      'Cache-Control': 'no-store',
    },
  });
}
