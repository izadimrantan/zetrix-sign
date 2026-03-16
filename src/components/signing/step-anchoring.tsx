'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle, XCircle, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { embedSignatureOnPdf } from '@/lib/pdf';
import { computeSHA256 } from '@/lib/hash';
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

type SubStep = 'embedding' | 'hashing' | 'signing' | 'anchoring' | 'saving' | 'done' | 'error';

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

      // Step 1: Embed signature into PDF
      setSubStep('embedding');
      trackAnchoringSubStep('embedding');
      const pdfBytes = new Uint8Array(await session.pdfFile!.arrayBuffer());
      const finalPdf = await embedSignatureOnPdf(pdfBytes, {
        signatureImage: session.signatureImage,
        position: session.signaturePosition!,
        signerName: session.signerName,
        walletAddress: session.walletAddress,
      });
      signedPdfBytesRef.current = finalPdf;

      // Step 2: Hash the final PDF (CRITICAL: this is the canonical hash)
      setSubStep('hashing');
      trackAnchoringSubStep('hashing');
      const documentHash = await computeSHA256(finalPdf);

      // Step 3: Wallet signs the document hash
      setSubStep('signing');
      trackAnchoringSubStep('signing');
      let digitalSignature: string;
      let signerPublicKey: string;

      if (session.connectionMethod === 'extension') {
        console.log('[Anchoring] Requesting extension to sign document hash...');
        const signResult = await signMessageExtension(documentHash);
        console.log('[Anchoring] Document hash signed:', { signData: signResult.signData?.slice(0, 20) + '...', publicKey: signResult.publicKey?.slice(0, 20) + '...' });
        digitalSignature = signResult.signData;
        signerPublicKey = signResult.publicKey || session.publicKey;
      } else {
        // Mobile: reconnect with a fresh QR for auth+sign combined
        console.log('[Anchoring] Mobile: reconnecting for authAndSignMessage...');
        const signResult = await reconnectAndSignMobile(documentHash, (qrContent) => {
          setMobileQrData(qrContent);
        });
        setMobileQrData(''); // Clear QR after successful sign
        console.log('[Anchoring] Mobile hash signed, publicKey:', signResult.publicKey?.slice(0, 20) + '...');
        digitalSignature = signResult.signData;
        signerPublicKey = signResult.publicKey || session.publicKey;
      }

      // Step 4: Submit anchorDocument transaction
      setSubStep('anchoring');
      trackAnchoringSubStep('anchoring');
      const contractAddress = process.env.NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS!;
      const anchorInput = {
        method: 'anchorDocument',
        params: { documentHash, digitalSignature, signerPublicKey, credentialID: session.credentialID },
      };

      let txHash: string;

      // Both extension and mobile use the same pattern:
      // build-blob → sign blob → submit signed transaction
      console.log('[Anchoring] Building transaction blob...');
      const { transactionBlob: blob, hash: blobHash } = await buildTransactionBlob(session.walletAddress, anchorInput);
      console.log('[Anchoring] Blob built (length:', blob.length, '), blob preview:', blob.slice(0, 40) + '...');

      if (session.connectionMethod === 'mobile') {
        // Mobile: sign blob over the same WebSocket session from reconnectAndSignMobile
        // (no QR needed — phone gets a popup to approve)
        console.log('[Anchoring] Mobile: signing blob via signMessageMobile...');
        const blobSign = await signMessageMobile(blob);
        console.log('[Anchoring] Mobile blob signed, submitting to blockchain...');
        txHash = await submitSignedTransaction(blob, blobSign.signData, blobSign.publicKey || signerPublicKey, blobHash, session.walletAddress);
        console.log('[Anchoring] Transaction submitted, txHash:', txHash);
      } else {
        // Extension: delay to let the extension reset after the first signMessage call
        console.log('[Anchoring] Waiting 5s for extension to reset before second signMessage...');
        await new Promise(r => setTimeout(r, 3_000));
        console.log('[Anchoring] Requesting extension to sign blob via signMessage...');
        const blobSign = await signMessageExtension(blob);
        console.log('[Anchoring] Blob signed, submitting to blockchain...');
        txHash = await submitSignedTransaction(blob, blobSign.signData, blobSign.publicKey || session.publicKey, blobHash, session.walletAddress);
        console.log('[Anchoring] Transaction submitted, txHash:', txHash);
      }

      // Step 5: Save session to DB
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
          digitalSignature,
          signerPublicKey,
          txHash,
        }),
      });

      // Update session state with results
      updateSession({
        documentHash,
        digitalSignature,
        txHash,
        timestamp: new Date().toISOString(),
      });

      setSubStep('done');
      trackAnchoringSuccess(txHash);
      // Auto-advance after brief delay
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
    { key: 'embedding', label: 'Embedding signature into PDF...' },
    { key: 'hashing', label: 'Computing document hash (SHA256)...' },
    { key: 'signing', label: 'Signing document hash with wallet...' },
    { key: 'anchoring', label: 'Submitting to Zetrix blockchain...' },
    { key: 'saving', label: 'Saving session record...' },
    { key: 'done', label: 'Anchoring complete!' },
  ];

  const isError = subStep === 'error';
  const activeStep = isError ? failedAt : subStep;
  const currentIdx = steps.findIndex((s) => s.key === activeStep);

  return (
    <Card>
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
  );
}
