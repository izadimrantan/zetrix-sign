import { describe, it, expect } from 'vitest';
import { embedSignatureOnPdf, getPdfPageCount } from '@/lib/pdf';
import { PDFDocument } from 'pdf-lib';

// Helper: create a minimal 1-page PDF for testing
async function createTestPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  page.drawText('Test PDF Content', { x: 50, y: 700, size: 12 });
  return doc.save();
}

// Minimal 1x1 transparent PNG as base64 data URL
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

describe('getPdfPageCount', () => {
  it('returns correct page count for a 1-page PDF', async () => {
    const pdfBytes = await createTestPdf();
    const count = await getPdfPageCount(pdfBytes);
    expect(count).toBe(1);
  });

  it('returns correct count for multi-page PDF', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    doc.addPage();
    const pdfBytes = await doc.save();
    const count = await getPdfPageCount(pdfBytes);
    expect(count).toBe(3);
  });
});

describe('embedSignatureOnPdf', () => {
  it('returns a Uint8Array (valid PDF bytes)', async () => {
    const pdfBytes = await createTestPdf();
    const result = await embedSignatureOnPdf(pdfBytes, {
      signatureImage: TINY_PNG,
      position: { x: 0.5, y: 0.8, page: 0, width: 0.2, height: 0.05 },
      signerName: 'John Tan',
      walletAddress: 'ZTX3S4ntGLTJw9vVNpCX6Ash6wZhaLLV9BS5S',
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it('produces a valid PDF that can be re-loaded', async () => {
    const pdfBytes = await createTestPdf();
    const result = await embedSignatureOnPdf(pdfBytes, {
      signatureImage: TINY_PNG,
      position: { x: 0.1, y: 0.1, page: 0, width: 0.3, height: 0.1 },
      signerName: 'John Tan',
      walletAddress: 'ZTX_ADDR',
    });
    const reloaded = await PDFDocument.load(result);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it('produces different bytes than the original (signature was added)', async () => {
    const pdfBytes = await createTestPdf();
    const result = await embedSignatureOnPdf(pdfBytes, {
      signatureImage: TINY_PNG,
      position: { x: 0.5, y: 0.5, page: 0, width: 0.2, height: 0.05 },
      signerName: 'Test',
      walletAddress: 'ZTX_ADDR',
    });
    expect(result.length).not.toBe(pdfBytes.length);
  });
});
