import { buildAnchorXmp } from './xmp-metadata';

/**
 * Append blockchain anchor XMP metadata to a CMS-signed PDF via incremental
 * update. This preserves the existing CMS signature by appending new data
 * after the existing %%EOF marker rather than rewriting the PDF.
 *
 * This approach is necessary because any modification to the byte ranges
 * covered by the CMS signature would invalidate it.
 */
export async function appendAnchorXmp(
  signedPdfBytes: Uint8Array,
  anchorData: {
    documentHash: string;
    txHash: string;
    blockNumber: number;
    blockTimestamp: string;
    chainId: string;
    verificationUrl: string;
  }
): Promise<Uint8Array> {
  const xmpXml = buildAnchorXmp({
    documentHash: anchorData.documentHash,
    hashAlgorithm: 'SHA-256',
    hashScope: 'cms-signed-document',
    txHash: anchorData.txHash,
    blockNumber: anchorData.blockNumber,
    blockTimestamp: anchorData.blockTimestamp,
    chainId: anchorData.chainId,
    verificationUrl: anchorData.verificationUrl,
  });

  return appendIncrementalXmp(signedPdfBytes, xmpXml);
}

/**
 * Low-level: append an XMP metadata stream to a PDF as an incremental update.
 *
 * Simplified strategy that works with all PDF structures (including compressed
 * object streams where the catalog is not a standalone object):
 *
 * 1. Find the last startxref offset and /Root reference
 * 2. Create a new standalone XMP stream object
 * 3. Write a minimal xref table for just the new object
 * 4. Write a new trailer with /Prev pointing to the old xref
 * 5. Append everything after the existing content
 *
 * Note: The XMP stream is NOT linked to the catalog's /Metadata key.
 * Instead, our detect-cms.ts extractAnchorXmp() scans the raw PDF bytes
 * for the zetrix namespace, so it finds the data regardless of catalog linkage.
 */
function appendIncrementalXmp(
  pdfBytes: Uint8Array,
  xmpXml: string
): Uint8Array {
  const decoder = new TextDecoder('latin1');
  const pdfString = decoder.decode(pdfBytes);

  // 1. Find the last startxref offset (points to the previous xref table)
  const startxrefMatch = pdfString.match(/startxref\s+(\d+)\s+%%EOF/g);
  if (!startxrefMatch) {
    throw new Error('Failed to find startxref in PDF');
  }
  const lastStartxref = startxrefMatch[startxrefMatch.length - 1];
  const prevXrefOffset = parseInt(
    lastStartxref.match(/startxref\s+(\d+)/)![1],
    10
  );

  // 2. Find the highest object number in the PDF
  const objMatches = pdfString.matchAll(/(\d+)\s+\d+\s+obj/g);
  let maxObjNum = 0;
  for (const m of objMatches) {
    const num = parseInt(m[1], 10);
    if (num > maxObjNum) maxObjNum = num;
  }

  // 3. Find the /Root reference (needed for the trailer, but we don't modify it)
  const rootMatch = pdfString.match(/\/Root\s+(\d+\s+\d+\s+R)/);
  if (!rootMatch) {
    throw new Error('Failed to find /Root in PDF trailer');
  }
  const rootRef = rootMatch[1];

  // Find /Size from the existing trailer (or compute from maxObjNum)
  const sizeMatch = pdfString.match(/\/Size\s+(\d+)/);
  const existingSize = sizeMatch ? parseInt(sizeMatch[1], 10) : maxObjNum + 1;

  // 4. Assign new object number
  const xmpObjNum = Math.max(maxObjNum + 1, existingSize);

  // 5. Build the new XMP stream object
  const encoder = new TextEncoder();
  const xmpBytes = encoder.encode(xmpXml);
  const appendOffset = pdfBytes.length;

  const xmpStreamObj = [
    `${xmpObjNum} 0 obj`,
    `<< /Type /Metadata /Subtype /XML /Length ${xmpBytes.length} >>`,
    'stream',
    xmpXml,
    'endstream',
    'endobj',
    '',
  ].join('\n');

  // 6. Build xref table (just one new object)
  const xmpStreamOffset = appendOffset;

  const xrefContent = [
    'xref',
    `${xmpObjNum} 1`,
    `${String(xmpStreamOffset).padStart(10, '0')} 00000 n `,
    '',
  ].join('\n');

  // 7. Build trailer
  const xrefOffset = appendOffset + encoder.encode(xmpStreamObj).length;

  const trailer = [
    xrefContent,
    'trailer',
    `<< /Root ${rootRef} /Prev ${prevXrefOffset} /Size ${xmpObjNum + 1} >>`,
    'startxref',
    `${xrefOffset}`,
    '%%EOF',
    '',
  ].join('\n');

  // 8. Combine: original PDF + xmpStream + xref + trailer
  const appendContent = xmpStreamObj + trailer;
  const appendBytes = encoder.encode(appendContent);

  // 9. Build final PDF
  const result = new Uint8Array(pdfBytes.length + appendBytes.length);
  result.set(pdfBytes, 0);
  result.set(appendBytes, pdfBytes.length);

  return result;
}
