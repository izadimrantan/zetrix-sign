import { describe, it, expect, beforeAll } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  preparePdfForSigning,
  extractByteRange,
  computeByteRangeHash,
} from '@/lib/cms/pdf-cms-sign';
import { buildVcXmp } from '@/lib/cms/xmp-metadata';
import type { VcXmpParams } from '@/types/cms';

/**
 * Create a minimal PDF document for testing.
 */
async function createMinimalPdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([200, 200]);
  page.drawText('Test PDF for signing', { x: 10, y: 100, size: 12 });
  const bytes = await pdfDoc.save();
  return new Uint8Array(bytes);
}

const vcParams: VcXmpParams = {
  signerName: 'John Tan',
  signerDid: 'did:zetrix:ZTX3abc123',
  signerAddress: 'ZTX3abc123',
  credentialId: 'vc-001',
  credentialIssuer: 'did:zetrix:ZTXissuer456',
  vcVerifiedAt: '2026-03-30T12:00:00Z',
};

describe('preparePdfForSigning', () => {
  let minimalPdf: Uint8Array;
  let vcXmp: string;

  beforeAll(async () => {
    minimalPdf = await createMinimalPdf();
    vcXmp = buildVcXmp(vcParams);
  });

  it('returns a PDF with a signature placeholder', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    // Output should be a Uint8Array
    expect(result.pdfWithPlaceholder).toBeInstanceOf(Uint8Array);
    // Output PDF should be larger than input (placeholder + metadata added)
    expect(result.pdfWithPlaceholder.length).toBeGreaterThan(minimalPdf.length);
  });

  it('embeds a /ByteRange entry in the output PDF', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(result.pdfWithPlaceholder);
    expect(pdfString).toContain('/ByteRange');
  });

  it('embeds a /Sig dictionary with adbe.pkcs7.detached subfilter', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(result.pdfWithPlaceholder);
    expect(pdfString).toContain('adbe.pkcs7.detached');
  });

  it('includes the signer name in the signature dictionary', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(result.pdfWithPlaceholder);
    expect(pdfString).toContain('John Tan');
  });

  it('embeds VC XMP metadata in the PDF', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(result.pdfWithPlaceholder);
    expect(pdfString).toContain('zetrix');
    expect(pdfString).toContain('SignerDID');
  });
});

describe('byteRange extraction and validation', () => {
  let minimalPdf: Uint8Array;
  let vcXmp: string;

  beforeAll(async () => {
    minimalPdf = await createMinimalPdf();
    vcXmp = buildVcXmp(vcParams);
  });

  it('returns a byteRange with 4 numbers', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    expect(result.byteRange).toHaveLength(4);
    result.byteRange.forEach((n) => {
      expect(typeof n).toBe('number');
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
    });
  });

  it('byteRange[0] starts at 0', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    // The first range should start at offset 0 (beginning of file)
    expect(result.byteRange[0]).toBe(0);
  });

  it('byteRange covers the full PDF with a gap for /Contents', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    const [offset1, length1, offset2, length2] = result.byteRange;
    const totalPdfLength = result.pdfWithPlaceholder.length;

    // offset2 + length2 should equal total PDF length
    expect(offset2 + length2).toBe(totalPdfLength);
    // offset1 + length1 should be less than offset2 (there's a gap for /Contents)
    expect(offset1 + length1).toBeLessThan(offset2);
    // The gap should be at least 2 * signatureLength hex chars + 2 angle brackets
    expect(offset2 - (offset1 + length1)).toBeGreaterThan(0);
  });

  it('extractByteRange throws for PDF without signature placeholder', async () => {
    // A plain PDF without a signature placeholder
    expect(() => extractByteRange(minimalPdf)).toThrow(/ByteRange/);
  });
});

describe('computeByteRangeHash', () => {
  let minimalPdf: Uint8Array;
  let vcXmp: string;

  beforeAll(async () => {
    minimalPdf = await createMinimalPdf();
    vcXmp = buildVcXmp(vcParams);
  });

  it('returns a 64-character hex string (SHA-256)', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    const hash = await computeByteRangeHash(
      result.pdfWithPlaceholder,
      result.byteRange
    );

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a deterministic hash for the same input', async () => {
    const result = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    const hash1 = await computeByteRangeHash(
      result.pdfWithPlaceholder,
      result.byteRange
    );
    const hash2 = await computeByteRangeHash(
      result.pdfWithPlaceholder,
      result.byteRange
    );

    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different PDFs', async () => {
    const result1 = await preparePdfForSigning(
      minimalPdf,
      'John Tan',
      vcXmp,
      new Date('2026-03-30T12:00:00Z')
    );

    // Create a different PDF
    const pdfDoc2 = await PDFDocument.create();
    const page2 = pdfDoc2.addPage([300, 300]);
    page2.drawText('Different content', { x: 10, y: 100, size: 14 });
    const pdf2Bytes = new Uint8Array(await pdfDoc2.save());

    const result2 = await preparePdfForSigning(
      pdf2Bytes,
      'Jane Doe',
      vcXmp,
      new Date('2026-03-31T12:00:00Z')
    );

    const hash1 = await computeByteRangeHash(
      result1.pdfWithPlaceholder,
      result1.byteRange
    );
    const hash2 = await computeByteRangeHash(
      result2.pdfWithPlaceholder,
      result2.byteRange
    );

    expect(hash1).not.toBe(hash2);
  });
});
