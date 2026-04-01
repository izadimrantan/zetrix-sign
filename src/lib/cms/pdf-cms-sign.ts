import { PDFDocument, PDFName } from 'pdf-lib';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import {
  SUBFILTER_ADOBE_PKCS7_DETACHED,
} from '@signpdf/utils';

/**
 * Signature placeholder size: 16384 bytes to accommodate CMS/PKCS#7 signature
 * with room for an RFC 3161 timestamp token.
 */
const SIGNATURE_LENGTH = 16384;

/**
 * Inject VC XMP metadata and a CMS/PKCS#7 signature placeholder into a PDF.
 *
 * Returns the modified PDF bytes ready for @signpdf's SignPdf.sign().
 */
export async function preparePdfForSigning(
  pdfBytes: Uint8Array,
  signerName: string,
  vcXmp: string,
  signingTime: Date
): Promise<Uint8Array> {
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

  // 4. Save and return — @signpdf handles ByteRange extraction and injection
  const savedBytes = await pdfDoc.save();
  return new Uint8Array(savedBytes);
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
