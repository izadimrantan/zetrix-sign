import { NextRequest, NextResponse } from 'next/server';
import { SignPdf } from '@signpdf/signpdf';
import { generateSignerCertificate } from '@/lib/cms/x509-cert';
import { EphemeralCmsSigner } from '@/lib/cms/cms-signer';
import { buildVcXmp } from '@/lib/cms/xmp-metadata';
import { preparePdfForSigning } from '@/lib/cms/pdf-cms-sign';
import type { CmsSignRequest } from '@/types/cms';

/**
 * POST /api/signing/cms-sign
 *
 * Complete CMS/PKCS#7 signing in a single step:
 * 1. Receives PDF with visual signature embedded
 * 2. Generates X.509 cert with signer's identity
 * 3. Embeds VC XMP metadata
 * 4. Adds signature placeholder via @signpdf/placeholder-pdf-lib
 * 5. Signs using @signpdf with our custom EphemeralCmsSigner
 * 6. Returns the fully signed PDF + document hash
 *
 * Uses @signpdf's proven ByteRange extraction and placeholder injection
 * to ensure compatibility with PDF readers (Adobe, Foxit, etc.).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CmsSignRequest;

    const {
      pdfBase64,
      signerName,
      signerDid,
      signerAddress,
      signerPublicKey,
      credentialId,
      credentialIssuer,
      credentialType,
      identityNumber,
    } = body;

    // Validate required fields (signerPublicKey is optional — mobile wallet
    // SDK doesn't return it during auth, only during signMessage)
    const missing = [
      !pdfBase64 && 'pdfBase64',
      !signerName && 'signerName',
      !signerAddress && 'signerAddress',
    ].filter(Boolean);
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // 1. Decode the PDF from base64
    const pdfBytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));

    // 2. Generate X.509 certificate wrapping the signer's identity
    const signingTime = new Date();
    const { certDer, signingKey } = await generateSignerCertificate({
      signerName,
      signerDid: signerDid || `did:zetrix:${signerAddress}`,
      signerAddress,
      signerPublicKey,
      credentialId: credentialId || '',
      credentialIssuer: credentialIssuer || '',
      credentialType,
      identityNumber,
    });

    // 3. Build VC XMP metadata
    const vcXmp = buildVcXmp({
      signerName,
      signerDid: signerDid || `did:zetrix:${signerAddress}`,
      signerAddress,
      credentialId: credentialId || '',
      credentialIssuer: credentialIssuer || '',
      vcVerifiedAt: new Date().toISOString(),
    });

    // 4. Prepare PDF with XMP metadata and signature placeholder
    const pdfWithPlaceholder = await preparePdfForSigning(
      pdfBytes,
      signerName,
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

    // 7. Return signed PDF + document hash
    const signedPdfBase64 = Buffer.from(signedPdf).toString('base64');

    return NextResponse.json({
      success: true,
      signedPdfBase64,
      documentHash,
    });
  } catch (error) {
    console.error('[cms-sign] Error:', error);
    const message = error instanceof Error ? error.message : 'CMS signing failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
