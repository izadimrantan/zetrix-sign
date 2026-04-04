import { NextRequest, NextResponse } from 'next/server';
import { SignPdf } from '@signpdf/signpdf';
import { generateSignerCertificate } from '@/lib/cms/x509-cert';
import { EphemeralCmsSigner } from '@/lib/cms/cms-signer';
import { buildVcXmp } from '@/lib/cms/xmp-metadata';
import { preparePdfForSigning } from '@/lib/cms/pdf-cms-sign';
import { storePdf } from '@/lib/pdf-store';

/**
 * POST /api/signing/cms-sign
 *
 * Complete CMS/PKCS#7 signing in a single step:
 * 1. Receives PDF as multipart/form-data (raw binary — no base64)
 * 2. Generates X.509 cert with signer's identity
 * 3. Embeds VC XMP metadata
 * 4. Adds signature placeholder via @signpdf/placeholder-pdf-lib
 * 5. Signs using @signpdf with our custom EphemeralCmsSigner
 * 6. Stores signed PDF server-side, returns download token + hash
 *
 * Uses FormData instead of JSON to avoid base64 encoding overhead
 * (33% size bloat + iOS memory pressure from atob/btoa).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract PDF file from FormData
    const pdfFile = formData.get('pdf') as File | null;
    const signerName = formData.get('signerName') as string | null;
    const signerDid = formData.get('signerDid') as string | null;
    const signerAddress = formData.get('signerAddress') as string | null;
    const signerPublicKey = formData.get('signerPublicKey') as string | null;
    const credentialId = formData.get('credentialId') as string | null;
    const credentialIssuer = formData.get('credentialIssuer') as string | null;
    const credentialType = formData.get('credentialType') as string | null;
    const identityNumber = formData.get('identityNumber') as string | null;

    // Validate required fields
    const missing = [
      !pdfFile && 'pdf',
      !signerName && 'signerName',
      !signerAddress && 'signerAddress',
    ].filter(Boolean);
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // 1. Read PDF bytes from the uploaded file (no base64 decoding needed)
    const pdfBytes = new Uint8Array(await pdfFile!.arrayBuffer());
    console.log(`[cms-sign] Received PDF via FormData: ${pdfBytes.length} bytes`);

    // 2. Generate X.509 certificate wrapping the signer's identity
    const signingTime = new Date();
    const { certDer, signingKey } = await generateSignerCertificate({
      signerName: signerName!,
      signerDid: signerDid || `did:zetrix:${signerAddress}`,
      signerAddress: signerAddress!,
      signerPublicKey: signerPublicKey || undefined,
      credentialId: credentialId || '',
      credentialIssuer: credentialIssuer || '',
      credentialType: credentialType as 'mykad' | 'passport' | undefined,
      identityNumber: identityNumber || undefined,
    });

    // 3. Build VC XMP metadata
    const vcXmp = buildVcXmp({
      signerName: signerName!,
      signerDid: signerDid || `did:zetrix:${signerAddress}`,
      signerAddress: signerAddress!,
      credentialId: credentialId || '',
      credentialIssuer: credentialIssuer || '',
      vcVerifiedAt: new Date().toISOString(),
    });

    // 4. Prepare PDF with XMP metadata and signature placeholder
    const pdfWithPlaceholder = await preparePdfForSigning(
      pdfBytes,
      signerName!,
      vcXmp,
      signingTime
    );

    // 5. Sign using @signpdf with our custom CMS signer
    const signer = new EphemeralCmsSigner(certDer, signingKey, signingTime);
    const signPdf = new SignPdf();
    const signedPdfBuffer = await signPdf.sign(
      pdfWithPlaceholder,
      signer,
      signingTime
    );

    // 6. Compute SHA-256 of the complete signed PDF (for blockchain anchoring)
    const signedPdf = new Uint8Array(signedPdfBuffer);
    const finalHashBuffer = await crypto.subtle.digest('SHA-256', signedPdf);
    const documentHash = Array.from(new Uint8Array(finalHashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 7. Store signed PDF server-side (no base64 response — client uses download token)
    const signedPdfNodeBuffer = Buffer.from(signedPdf);
    const downloadToken = storePdf(signedPdfNodeBuffer);
    console.log(`[cms-sign] Stored signed PDF (${signedPdfNodeBuffer.length} bytes), token: ${downloadToken.slice(0, 8)}...`);

    // 8. Return only the document hash + download token (NO base64 PDF)
    return NextResponse.json({
      success: true,
      documentHash,
      downloadToken,
    });
  } catch (error) {
    console.error('[cms-sign] Error:', error);
    const message = error instanceof Error ? error.message : 'CMS signing failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
