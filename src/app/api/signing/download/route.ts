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
  const sanitized = rawFilename.replace(/[/\\:\0]/g, '_');

  // ASCII-safe fallback for the basic `filename="..."` parameter.
  // HTTP headers are Latin-1 (ISO-8859-1) only — characters above code point
  // 255 (e.g. emojis like ⭐) crash the Response constructor with
  // "Cannot convert argument to a ByteString".
  // Strip all non-ASCII characters for the fallback filename.
  const asciiFilename = sanitized.replace(/[^\x20-\x7E]/g, '').trim() || 'signed-document.pdf';

  // RFC 5987 encoding for the full Unicode filename (filename* parameter).
  // Modern browsers prefer filename* and will display the original name
  // including emojis, CJK characters, etc.
  const encodedFilename = encodeURIComponent(sanitized)
    .replace(/['()]/g, escape)
    .replace(/\*/g, '%2A');

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': pdfBytes.length.toString(),
      'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`,
      'Cache-Control': 'no-store',
    },
  });
}
