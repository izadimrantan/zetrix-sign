'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle, XCircle, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { embedSignatureOnPdf } from '@/lib/pdf';
import { signMessageExtension, signMessageMobile, reconnectAndSignMobile } from '@/lib/wallet';
import { buildTransactionBlob, submitSignedTransaction } from '@/lib/blockchain';
import { trackAnchoringStart, trackAnchoringSubStep, trackAnchoringSuccess, trackAnchoringError, trackAnchoringRetry } from '@/lib/analytics';
import type { SigningSession } from '@/types/signing';

interface StepProps {
  session: SigningSession;
  updateSession: (partial: Partial<SigningSession>) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  signedPdfBytesRef: React.MutableRefObject<Uint8Array | null>;
}

type SubStep =
  | 'embedding'
  | 'cms-signing'
  | 'signing'
  | 'anchoring'
  | 'anchor-xmp'
  | 'saving'
  | 'done'
  | 'error';

export function StepAnchoring({ session, updateSession, nextStep, signedPdfBytesRef }: StepProps) {
  const [subStep, setSubStep] = useState<SubStep>('embedding');
  const [error, setError] = useState('');
  const [failedAt, setFailedAt] = useState<SubStep | null>(null);
  const [mobileQrData, setMobileQrData] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runAnchoringFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAnchoringFlow() {
    try {
      trackAnchoringStart();
      setMobileQrData('');

      // ── Step 1: Embed visual signature into PDF (client-side) ──
      setSubStep('embedding');
      trackAnchoringSubStep('embedding');
      const pdfBytes = new Uint8Array(await session.pdfFile!.arrayBuffer());
      const visualPdf = await embedSignatureOnPdf(pdfBytes, {
        signatureImage: session.signatureImage,
        position: session.signaturePosition!,
        signerName: session.signerName,
        walletAddress: session.walletAddress,
      });

      // ── Step 2: Server applies CMS/PKCS#7 signature (single step) ──
      setSubStep('cms-signing');
      trackAnchoringSubStep('cms-signing');
      console.log('[Anchoring] Sending PDF to server for CMS signing...');

      const pdfBase64 = Buffer.from(visualPdf).toString('base64');
      const cmsSignRes = await fetch('/api/signing/cms-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          signerName: session.signerName,
          signerDid: session.signerDID || `did:zetrix:${session.walletAddress}`,
          signerAddress: session.walletAddress,
          signerPublicKey: session.publicKey,
          credentialId: session.credentialID,
          credentialIssuer: 'ZCert Test Authority',
        }),
      });

      if (!cmsSignRes.ok) {
        const errBody = await cmsSignRes.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error || `CMS signing failed (${cmsSignRes.status})`);
      }

      const { signedPdfBase64, documentHash } = await cmsSignRes.json();
      console.log('[Anchoring] CMS signature applied. Document hash:', documentHash?.slice(0, 20) + '...');

      // Store the CMS-signed PDF bytes for later download
      const cmsSignedPdfBytes = Uint8Array.from(atob(signedPdfBase64), (c) => c.charCodeAt(0));

      // ── Step 4: Wallet signs the document hash ──
      // This signature is stored on-chain and verified by the smart contract's
      // ecVerify(documentHash, digitalSignature, signerPublicKey).
      setSubStep('signing');
      trackAnchoringSubStep('signing');

      let walletSignature: string;
      let signerPublicKey: string;

      if (session.connectionMethod === 'extension') {
        console.log('[Anchoring] Requesting extension to sign document hash...');
        const signResult = await signMessageExtension(documentHash);
        walletSignature = signResult.signData;
        signerPublicKey = signResult.publicKey || session.publicKey;
      } else {
        console.log('[Anchoring] Mobile: reconnecting for sign...');
        const signResult = await reconnectAndSignMobile(documentHash, (qrContent) => {
          setMobileQrData(qrContent);
        });
        setMobileQrData('');
        walletSignature = signResult.signData;
        signerPublicKey = signResult.publicKey || session.publicKey;
      }

      // ── Step 5: Submit anchorDocument transaction ──
      setSubStep('anchoring');
      trackAnchoringSubStep('anchoring');
      const contractAddress = process.env.NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS!;
      const anchorInput = {
        method: 'anchorDocument',
        params: {
          documentHash,
          digitalSignature: walletSignature,
          signerPublicKey,
          credentialID: session.credentialID,
        },
      };

      console.log('[Anchoring] Building transaction blob...');
      const { transactionBlob: blob, hash: blobHash } = await buildTransactionBlob(session.walletAddress, anchorInput);

      let txHash: string;

      if (session.connectionMethod === 'mobile') {
        console.log('[Anchoring] Mobile: signing blob...');
        const blobSign = await signMessageMobile(blob);
        txHash = await submitSignedTransaction(blob, blobSign.signData, blobSign.publicKey || signerPublicKey, blobHash, session.walletAddress);
      } else {
        console.log('[Anchoring] Waiting 3s for extension to reset...');
        await new Promise(r => setTimeout(r, 3_000));
        const blobSign = await signMessageExtension(blob);
        txHash = await submitSignedTransaction(blob, blobSign.signData, blobSign.publicKey || session.publicKey, blobHash, session.walletAddress);
      }
      console.log('[Anchoring] TX submitted:', txHash);

      // ── Step 6: Append anchor XMP via incremental update ──
      setSubStep('anchor-xmp');
      trackAnchoringSubStep('anchor-xmp');
      console.log('[Anchoring] Appending anchor XMP to signed PDF...');

      const anchorRes = await fetch('/api/signing/cms-anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedPdfBase64,
          txHash,
          blockNumber: 0, // Will be populated when we have block info
          blockTimestamp: new Date().toISOString(),
          documentHash,
          chainId: 'zetrix-testnet',
        }),
      });

      if (!anchorRes.ok) {
        // Non-critical: if anchor XMP fails, we still have the signed PDF
        console.warn('[Anchoring] Anchor XMP append failed, using PDF without anchor metadata');
        signedPdfBytesRef.current = cmsSignedPdfBytes;
      } else {
        const { finalPdfBase64 } = await anchorRes.json();
        signedPdfBytesRef.current = Uint8Array.from(atob(finalPdfBase64), (c) => c.charCodeAt(0));
      }

      // ── Step 7: Save session to DB ──
      setSubStep('saving');
      trackAnchoringSubStep('saving');
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: session.pdfFile!.name,
          walletAddress: session.walletAddress,
          signerName: session.signerName,
          signerDID: session.signerDID,
          credentialID: session.credentialID,
          signatureType: session.signatureType,
          documentHash,
          digitalSignature: walletSignature,
          signerPublicKey,
          txHash,
          anchorVersion: '2.0',
        }),
      });

      updateSession({
        documentHash,
        digitalSignature: walletSignature,
        txHash,
        anchorVersion: '2.0',
        timestamp: new Date().toISOString(),
      });

      setSubStep('done');
      trackAnchoringSuccess(txHash);
      setTimeout(() => nextStep(), 1500);
    } catch (err) {
      setMobileQrData('');
      console.error('[Anchoring] Failed at sub-step:', subStep, err);
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      trackAnchoringError(subStep, message || 'Unknown error');
      setError(message || 'Anchoring failed');
      setFailedAt(subStep);
      setSubStep('error');
    }
  }

  const steps: { key: SubStep; label: string }[] = [
    { key: 'embedding', label: 'Embedding visual signature...' },
    { key: 'cms-signing', label: 'Applying CMS/PKCS#7 digital signature...' },
    { key: 'signing', label: 'Signing document hash with wallet...' },
    { key: 'anchoring', label: 'Submitting to Zetrix blockchain...' },
    { key: 'anchor-xmp', label: 'Embedding blockchain proof in PDF...' },
    { key: 'saving', label: 'Saving session record...' },
    { key: 'done', label: 'Anchoring complete!' },
  ];

  const isError = subStep === 'error';
  const activeStep = isError ? failedAt : subStep;
  const currentIdx = steps.findIndex((s) => s.key === activeStep);

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
    <Card className="relative overflow-hidden border-[var(--zetrix-border)] shadow-sm">
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <CardHeader>
        <CardTitle>Blockchain Anchoring</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={step.key} className="flex items-center gap-3">
              {idx < currentIdx && <CheckCircle className="h-5 w-5 text-green-500" />}
              {idx === currentIdx && !isError && subStep !== 'done' && (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              {idx === currentIdx && subStep === 'done' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {idx === currentIdx && isError && <XCircle className="h-5 w-5 text-destructive" />}
              {idx > currentIdx && <div className="h-5 w-5 rounded-full border" />}
              <span className={idx <= currentIdx ? 'font-medium' : 'text-muted-foreground'}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Mobile QR for signing during anchoring */}
        {mobileQrData && subStep === 'signing' && (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium">Approve on your Zetrix App</p>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-[280px]">
              Scan this QR code to reconnect your wallet, then approve the signing request on your phone.
            </p>
            <div className="rounded-xl border bg-white p-3">
              <QRCodeSVG value={mobileQrData} size={180} level="M" />
            </div>
          </div>
        )}

        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => { trackAnchoringRetry(); started.current = false; setError(''); setFailedAt(null); runAnchoringFlow(); }}>
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
