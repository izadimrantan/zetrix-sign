import { PDFDocument, PDFName } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import {
  SUBFILTER_ADOBE_PKCS7_DETACHED,
  DEFAULT_BYTE_RANGE_PLACEHOLDER,
} from '@signpdf/utils';

/**
 * Signature placeholder size: 16384 bytes to accommodate CMS/PKCS#7 signature
 * with room for an RFC 3161 timestamp token.
 */
const SIGNATURE_LENGTH = 16384;

/**
 * Inject VC XMP metadata and a CMS/PKCS#7 signature placeholder into a PDF.
 *
 * Returns the modified PDF bytes and the ByteRange that identifies which bytes
 * must be hashed for signature computation.
 */
export async function preparePdfForSigning(
  pdfBytes: Uint8Array,
  signerName: string,
  vcXmp: string,
  signingTime: Date
): Promise<{
  pdfWithPlaceholder: Uint8Array;
  byteRange: [number, number, number, number];
}> {
  // 1. Load the PDF
  const pdfDoc = await PDFDocument.load(pdfBytes);

  // 2. Embed VC XMP metadata into the PDF catalog's Metadata stream
  embedXmpMetadata(pdfDoc, vcXmp);

  // 3. Add signature placeholder via @signpdf/placeholder-pdf-lib
  pdflibAddPlaceholder({
    pdfDoc,
    reason:
      'Digitally signed with Zetrix blockchain key, identity verified via Verifiable Credentials',
    location: 'Kuala Lumpur, Malaysia',
    name: signerName,
    contactInfo: 'verify@zetrix.com',
    signingTime,
    signatureLength: SIGNATURE_LENGTH,
    subFilter: SUBFILTER_ADOBE_PKCS7_DETACHED,
    widgetRect: [0, 0, 0, 0], // invisible signature widget
  });

  // 4. Save and extract ByteRange
  const savedBytes = await pdfDoc.save();
  const pdfWithPlaceholder = new Uint8Array(savedBytes);
  const byteRange = extractByteRange(pdfWithPlaceholder);

  // 5. Replace the ByteRange placeholder values with actual integers
  //    so the PDF is ready for hash computation and signing
  const updatedPdf = replaceByteRangePlaceholder(pdfWithPlaceholder, byteRange);

  return { pdfWithPlaceholder: updatedPdf, byteRange };
}

/**
 * Embed raw XMP XML into the PDF document's catalog Metadata stream.
 */
function embedXmpMetadata(pdfDoc: PDFDocument, xmpXml: string): void {
  const context = pdfDoc.context;

  // context.stream() expects a string (it converts via charCodeAt internally)
  const metadataStream = context.stream(xmpXml, {
    Type: 'Metadata',
    Subtype: 'XML',
  });

  // Register the stream and set it on the catalog
  const metadataRef = context.register(metadataStream);
  pdfDoc.catalog.set(PDFName.of('Metadata'), metadataRef);
}

/**
 * Compute the actual ByteRange values from a PDF with a signature placeholder.
 *
 * The @signpdf placeholder library inserts:
 *   /ByteRange [0 /********** /********** /**********]
 *   /Contents <0000...0000>
 *
 * We locate the /Contents hex string `<...>` and derive the real byte range:
 *   [0, contentsTagStart, contentsTagEnd, totalLength - contentsTagEnd]
 *
 * If the ByteRange already has resolved integers (all 4 numbers), parse those directly.
 */
export function extractByteRange(
  pdfBytes: Uint8Array
): [number, number, number, number] {
  const decoder = new TextDecoder('latin1');
  const pdfString = decoder.decode(pdfBytes);

  // First, try to match already-resolved integer ByteRange
  const resolvedMatch = pdfString.match(
    /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/
  );
  if (resolvedMatch) {
    return [
      parseInt(resolvedMatch[1], 10),
      parseInt(resolvedMatch[2], 10),
      parseInt(resolvedMatch[3], 10),
      parseInt(resolvedMatch[4], 10),
    ];
  }

  // The placeholder uses /********** for the 3 unknown values.
  // We need to find the /Contents <hex> in the signature dictionary and compute ranges.
  const byteRangePlaceholderMatch = pdfString.match(
    /\/ByteRange\s*\[/
  );
  if (!byteRangePlaceholderMatch) {
    throw new Error(
      'Failed to find /ByteRange in PDF. The signature placeholder may not have been inserted correctly.'
    );
  }

  // Find the /Contents hex string by searching for the byte pattern.
  // The placeholder library writes raw null bytes inside <...>:
  //   /Contents <\x00\x00...\x00>
  // We search the raw bytes for the pattern: "/Contents <" ... ">"
  const contentsKeyword = '/Contents <';
  const contentsKeywordIdx = pdfString.indexOf(contentsKeyword);
  if (contentsKeywordIdx === -1) {
    throw new Error(
      'Failed to find /Contents hex string in PDF signature dictionary.'
    );
  }

  // The '<' is at contentsKeywordIdx + '/Contents '.length
  const contentsHexStart = contentsKeywordIdx + contentsKeyword.length - 1; // position of '<'
  // Find the closing '>'
  const closingBracketIdx = pdfString.indexOf('>', contentsHexStart + 1);
  if (closingBracketIdx === -1) {
    throw new Error(
      'Failed to find closing > of /Contents hex string in PDF.'
    );
  }
  const contentsHexEnd = closingBracketIdx + 1; // position after '>'

  const totalLength = pdfBytes.length;

  return [
    0,
    contentsHexStart,
    contentsHexEnd,
    totalLength - contentsHexEnd,
  ];
}

/**
 * Replace the /ByteRange placeholder values in the PDF bytes with the actual
 * integer values. The placeholder format from @signpdf is:
 *   /ByteRange [0 /********** /********** /**********]
 * We replace it with:
 *   /ByteRange [0 offset1Len offset2Start offset2Len    ]
 * Padded with spaces to maintain the same byte length.
 */
function replaceByteRangePlaceholder(
  pdfBytes: Uint8Array,
  byteRange: [number, number, number, number]
): Uint8Array {
  const decoder = new TextDecoder('latin1');
  const pdfString = decoder.decode(pdfBytes);

  // Find the full ByteRange placeholder pattern
  const byteRangePattern = /\/ByteRange\s*\[([^\]]+)\]/;
  const match = pdfString.match(byteRangePattern);

  if (!match || match.index === undefined) {
    return pdfBytes; // No placeholder to replace
  }

  const originalByteRangeStr = match[0];
  const [r0, r1, r2, r3] = byteRange;
  const newByteRangeContent = `${r0} ${r1} ${r2} ${r3}`;
  // Build replacement string with same total length (pad with spaces before closing bracket)
  const prefix = '/ByteRange [';
  const suffix = ']';
  const targetLength = originalByteRangeStr.length;
  const contentSpace = targetLength - prefix.length - suffix.length;
  const paddedContent = newByteRangeContent.padEnd(contentSpace, ' ');
  const replacement = prefix + paddedContent + suffix;

  const result = new Uint8Array(pdfBytes.length);
  result.set(pdfBytes);

  // Write the replacement bytes at the match position
  const encoder = new TextEncoder();
  const replacementBytes = encoder.encode(replacement);
  result.set(replacementBytes, match.index);

  return result;
}

/**
 * Compute SHA-256 hash over the byte ranges of a PDF (everything except the
 * /Contents hex string placeholder).
 *
 * ByteRange format: [offset1, length1, offset2, length2]
 * Hash covers: pdfBytes[offset1 .. offset1+length1] + pdfBytes[offset2 .. offset2+length2]
 *
 * Returns a lowercase hex-encoded SHA-256 digest.
 */
export async function computeByteRangeHash(
  pdfBytes: Uint8Array,
  byteRange: [number, number, number, number]
): Promise<string> {
  const [offset1, length1, offset2, length2] = byteRange;

  // Extract the two byte ranges
  const part1 = pdfBytes.slice(offset1, offset1 + length1);
  const part2 = pdfBytes.slice(offset2, offset2 + length2);

  // Concatenate parts
  const combined = new Uint8Array(part1.length + part2.length);
  combined.set(part1, 0);
  combined.set(part2, part1.length);

  // Compute SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = new Uint8Array(hashBuffer);

  // Convert to hex string
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
