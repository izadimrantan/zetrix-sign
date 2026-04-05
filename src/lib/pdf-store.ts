/**
 * Ephemeral in-memory store for signed PDFs.
 *
 * Allows the download endpoint to serve PDFs with proper HTTP headers
 * (Content-Type: application/octet-stream, Content-Disposition: attachment),
 * bypassing iOS WebKit's blob URL and QuickLook rendering issues.
 *
 * Entries auto-expire after 1 hour. The Map lives in the same Node.js
 * process that runs the Next.js API routes.
 */

import { randomUUID } from 'crypto';

interface StoredPdf {
  bytes: Buffer;
  createdAt: number;
}

const store = new Map<string, StoredPdf>();

const TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Validate PDF integrity: must start with %PDF header and end with %%EOF.
 * Catches silent truncation from base64 decoding, network issues, or memory pressure.
 */
export function validatePdfIntegrity(bytes: Buffer | Uint8Array): { valid: boolean; error?: string } {
  if (bytes.length < 8) {
    return { valid: false, error: 'PDF too small to be valid' };
  }

  // Check %PDF header (bytes 0x25 0x50 0x44 0x46)
  if (bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    return { valid: false, error: 'Missing %PDF header — file is not a valid PDF' };
  }

  // Check %%EOF at the end (allow trailing whitespace/newlines per PDF spec)
  // Search the last 64 bytes for %%EOF
  const tailStart = Math.max(0, bytes.length - 64);
  const tail = Buffer.from(bytes.slice(tailStart)).toString('ascii');
  if (!tail.includes('%%EOF')) {
    return { valid: false, error: 'Missing %%EOF — PDF appears truncated' };
  }

  return { valid: true };
}

/** Store a PDF buffer and return a unique download token */
export function storePdf(bytes: Buffer): string {
  cleanup();

  // Validate PDF integrity before storing
  const integrity = validatePdfIntegrity(bytes);
  if (!integrity.valid) {
    console.error(`[pdf-store] PDF integrity check failed: ${integrity.error}`);
    throw new Error(`PDF integrity check failed: ${integrity.error}`);
  }

  const token = randomUUID();
  store.set(token, { bytes, createdAt: Date.now() });
  console.log(`[pdf-store] Stored PDF (${bytes.length} bytes), token: ${token.slice(0, 8)}...`);
  return token;
}

/** Retrieve a stored PDF by token. Returns null if not found or expired. */
export function getPdf(token: string): Buffer | null {
  const entry = store.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(token);
    return null;
  }
  return entry.bytes;
}

/** Remove expired entries */
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now - entry.createdAt > TTL_MS) {
      store.delete(key);
    }
  }
}
