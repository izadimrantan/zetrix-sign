/**
 * Compute SHA256 hash of a Uint8Array or ArrayBuffer.
 * Uses the Web Crypto API (available in browsers and Node 20+).
 * Returns a 64-character lowercase hex string.
 */
export async function computeSHA256(data: Uint8Array | ArrayBuffer): Promise<string> {
  // Ensure we have a plain ArrayBuffer for crypto.subtle.digest compatibility
  const buffer: ArrayBuffer = data instanceof Uint8Array
    ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    : data;
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
