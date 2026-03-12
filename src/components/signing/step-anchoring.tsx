'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { embedSignatureOnPdf } from '@/lib/pdf';
import { computeSHA256 } from '@/lib/hash';
import { signMessageExtension, signMessageMobile, sendTransactionMobile, signBlobMobile } from '@/lib/wallet';
import { buildTransactionBlob, submitSignedTransaction } from '@/lib/blockchain';
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
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runAnchoringFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runAnchoringFlow() {
    try {
      // Step 1: Embed signature into PDF
      setSubStep('embedding');
      const pdfBytes = new Uint8Array(await session.pdfFile!.arrayBuffer());
      const finalPdf = await embedSignatureOnPdf(pdfBytes, {
        signatureImage: session.signatureImage,
        position: session.signaturePosition!,
        signerName: session.signerName,
        walletAddress: session.walletAddress,
      });
      // Store in ref so completion step can download the exact bytes that were hashed
      signedPdfBytesRef.current = finalPdf;

      // Step 2: Hash the final PDF (CRITICAL: this is the canonical hash)
      setSubStep('hashing');
      const documentHash = await computeSHA256(finalPdf);

      // Step 3: Wallet signs the document hash
      setSubStep('signing');
      let digitalSignature: string;
      let signerPublicKey: string;

      if (session.connectionMethod === 'extension') {
        const signResult = await signMessageExtension(documentHash);
        digitalSignature = signResult.signData;
        signerPublicKey = signResult.publicKey || session.publicKey;
      } else {
        const signResult = await signMessageMobile(documentHash);
        digitalSignature = signResult.signData;
        signerPublicKey = signResult.publicKey || session.publicKey;
      }

      // Step 4: Submit anchorDocument transaction
      setSubStep('anchoring');
      const contractAddress = process.env.NEXT_PUBLIC_ZETRIX_CONTRACT_ADDRESS!;
      const anchorInput = {
        method: 'anchorDocument',
        params: { documentHash, digitalSignature, signerPublicKey, credentialID: session.credentialID },
      };

      let txHash: string;

      if (session.connectionMethod === 'mobile') {
        // Use sendTransaction via mobile SDK -- SDK handles nonce internally
        txHash = await sendTransactionMobile({
          from: session.walletAddress,
          to: contractAddress,
          nonce: 0, // SDK handles nonce
          amount: '0',
          gasFee: '0.01',
          data: JSON.stringify(anchorInput),
        });
      } else {
        // Extension: build-blob -> signBlob -> submit-signed
        const blob = await buildTransactionBlob(session.walletAddress, anchorInput);
        const blobSign = await signBlobMobile(blob); // signBlob is available in wallet SDK
        txHash = await submitSignedTransaction(blob, blobSign.signData, blobSign.publicKey || session.publicKey);
      }

      // Step 5: Save session to DB
      setSubStep('saving');
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
      // Auto-advance after brief delay
      setTimeout(() => nextStep(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Anchoring failed');
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

  const currentIdx = steps.findIndex((s) => s.key === subStep);

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
              {idx === currentIdx && subStep !== 'error' && subStep !== 'done' && (
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              )}
              {idx === currentIdx && subStep === 'done' && <CheckCircle className="h-5 w-5 text-green-500" />}
              {idx === currentIdx && subStep === 'error' && <XCircle className="h-5 w-5 text-destructive" />}
              {idx > currentIdx && <div className="h-5 w-5 rounded-full border" />}
              <span className={idx <= currentIdx ? 'font-medium' : 'text-muted-foreground'}>
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={() => { started.current = false; setError(''); runAnchoringFlow(); }}>
              Retry
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
