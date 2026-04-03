/**
 * Detect if a PDF contains a CMS/PKCS#7 digital signature and extract
 * basic metadata from it.
 *
 * This performs a lightweight scan of the PDF structure without full
 * signature validation (which requires pkijs and the certificate chain).
 */
export function detectCmsSignature(pdfBytes: Uint8Array): {
  hasCmsSignature: boolean;
  subFilter?: string;
  signerName?: string;
  reason?: string;
  location?: string;
} {
  const decoder = new TextDecoder('latin1');
  const pdfString = decoder.decode(pdfBytes);

  // Look for /SubFilter /adbe.pkcs7.detached or /ETSI.CAdES.detached
  const subFilterMatch = pdfString.match(
    /\/SubFilter\s*\/(adbe\.pkcs7\.detached|ETSI\.CAdES\.detached)/
  );

  if (!subFilterMatch) {
    return { hasCmsSignature: false };
  }

  const subFilter = subFilterMatch[1];

  // Extract signer name from /Name in the signature dictionary
  const nameMatch = pdfString.match(/\/Name\s*\(([^)]*)\)/);
  const signerName = nameMatch ? nameMatch[1] : undefined;

  // Extract reason
  const reasonMatch = pdfString.match(/\/Reason\s*\(([^)]*)\)/);
  const reason = reasonMatch ? reasonMatch[1] : undefined;

  // Extract location
  const locationMatch = pdfString.match(/\/Location\s*\(([^)]*)\)/);
  const location = locationMatch ? locationMatch[1] : undefined;

  return {
    hasCmsSignature: true,
    subFilter,
    signerName,
    reason,
    location,
  };
}

/**
 * Strip the anchor XMP incremental update from the end of a PDF.
 * Returns the PDF bytes before the anchor appendage, or null if no anchor
 * XMP is detected.
 *
 * The anchor XMP is always the last incremental update, appended after the
 * CMS-signed PDF's %%EOF. By finding the second-to-last %%EOF, we recover
 * the original CMS-signed bytes whose hash was anchored on-chain.
 */
export function stripAnchorUpdate(pdfBytes: Uint8Array): Uint8Array | null {
  const decoder = new TextDecoder('latin1');
  const pdfString = decoder.decode(pdfBytes);

  // Only strip if this PDF actually has anchor XMP
  if (!pdfString.includes('zetrix.com/ns/pdfsig')) {
    return null;
  }

  // Find all %%EOF positions
  const eofPositions: number[] = [];
  let searchFrom = 0;
  while (true) {
    const pos = pdfString.indexOf('%%EOF', searchFrom);
    if (pos === -1) break;
    eofPositions.push(pos);
    searchFrom = pos + 5;
  }

  if (eofPositions.length < 2) return null;

  // The second-to-last %%EOF is the end of the pre-anchor PDF
  const boundaryEof = eofPositions[eofPositions.length - 2];
  let endPos = boundaryEof + 5; // "%%EOF" is 5 chars
  // Include trailing newline characters
  if (endPos < pdfBytes.length && pdfBytes[endPos] === 0x0d) endPos++; // \r
  if (endPos < pdfBytes.length && pdfBytes[endPos] === 0x0a) endPos++; // \n

  return pdfBytes.slice(0, endPos);
}

/**
 * Extract XMP anchor metadata from a PDF (if present).
 */
export function extractAnchorXmp(pdfBytes: Uint8Array): {
  hasAnchorXmp: boolean;
  anchorTxHash?: string;
  anchorBlockNumber?: string;
  anchorTimestamp?: string;
  anchorChainId?: string;
  verificationUrl?: string;
  documentHash?: string;
  signatureStandard?: string;
} {
  const decoder = new TextDecoder('latin1');
  const pdfString = decoder.decode(pdfBytes);

  // Check for zetrix namespace
  if (!pdfString.includes('zetrix.com/ns/pdfsig')) {
    return { hasAnchorXmp: false };
  }

  const extract = (key: string): string | undefined => {
    const match = pdfString.match(new RegExp(`zetrix:${key}="([^"]*)"`));
    return match ? match[1] : undefined;
  };

  const anchorTxHash = extract('AnchorTxHash');

  return {
    hasAnchorXmp: !!anchorTxHash,
    anchorTxHash,
    anchorBlockNumber: extract('AnchorBlockNumber'),
    anchorTimestamp: extract('AnchorTimestamp'),
    anchorChainId: extract('AnchorChainId'),
    verificationUrl: extract('VerificationURL'),
    documentHash: extract('DocumentHash'),
    signatureStandard: extract('SignatureStandard'),
  };
}
