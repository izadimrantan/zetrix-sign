import { PDFDocument } from 'pdf-lib';
import type { SignaturePosition } from '@/types/signing';

interface EmbedSignatureOptions {
  signatureImage: string; // base64 data URL (PNG)
  position: SignaturePosition;
  signerName: string;
  walletAddress: string;
}

/**
 * Get the number of pages in a PDF.
 */
export async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}

/**
 * Embed a signature image and text annotation onto a PDF page.
 * Returns the modified PDF as Uint8Array.
 *
 * Coordinate conversion:
 * - Input: top-left origin, 0-1 relative values
 * - pdf-lib: bottom-left origin, absolute points
 * - Formula: pdfY = pageHeight - (y * pageHeight) - (sigHeight)
 */
export async function embedSignatureOnPdf(
  pdfBytes: Uint8Array,
  options: EmbedSignatureOptions
): Promise<Uint8Array> {
  const { signatureImage, position, signerName, walletAddress } = options;

  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPage(position.page);
  const { width: pageWidth, height: pageHeight } = page.getSize();

  // Convert relative coords to absolute pdf-lib coords
  const sigWidth = position.width * pageWidth;
  const sigHeight = position.height * pageHeight;
  const sigX = position.x * pageWidth;
  // Convert from top-left origin to bottom-left origin
  const sigY = pageHeight - (position.y * pageHeight) - sigHeight;

  // Embed signature image
  const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, '');
  const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const pngImage = await doc.embedPng(imageBytes);

  page.drawImage(pngImage, {
    x: sigX,
    y: sigY,
    width: sigWidth,
    height: sigHeight,
  });

  // Add text annotation below signature
  const fontSize = 6;
  const timestamp = new Date().toISOString();
  const text = `Signed by: ${signerName} | Wallet: ${walletAddress} | ${timestamp}`;
  page.drawText(text, {
    x: sigX,
    y: sigY - fontSize - 2,
    size: fontSize,
  });

  // Disable Object Streams for maximum compatibility with iOS viewers
  // and older PDF readers (produces slightly larger but more portable PDFs)
  return doc.save({ useObjectStreams: false });
}
