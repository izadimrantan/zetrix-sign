'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, CheckCircle, XCircle, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { embedSignatureOnPdf } from '@/lib/pdf';
import { signMessageExtension, signMessageMobile, reconnectAndSignMobile } from '@/lib/wallet';
import { buildTransactionBlob, submitSignedTransaction } from '@/lib/blockchain';
import { trackAnchoringStart, trackAnchoringSubStep, trackAnchoringSuccess, trackAnchoringError, trackAnchoringRetry } from '@/lib/analytics';
import { getIdentifierFromClaims, getIssuerFromClaims } from '@/lib/oid4vp/claims';
import type { SigningSession } from '@/types/signing';

function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/** Convert SDK QR data (rms&sessionId&type) to a MyID deeplink URL */
function qrDataToDeeplink(qrContent: string): string {
  const parts = qrContent.split('&');
  const rms = parts[0] || '';
  const sessionId = parts[1] || '';
  const type = parts[2] || 'H5_bind';

  const bridge = process.env.NEXT_PUBLIC_ZETRIX_BRIDGE || '';
  const isTestnet = bridge.includes('test-');
  const scheme = isTestnet ? 'myid-uat' : 'myid';
  const host = window.location.protocol + '//' + window.location.host;

  const params = new URLSearchParams({
    linkTo: type,
    type: type,
    rms: rms,
    sessionId: sessionId,
    host: host,
    source: 'mobile',
  });

  return `${scheme}://myid.com/app/flutter?${params.toString()}`;
}

/** Build a simple MyID deeplink to bring the app to foreground */
function buildMyIdDeeplink(): string {
  const bridge = process.env.NEXT_PUBLIC_ZETRIX_BRIDGE || '';
  const isTestnet = bridge.includes('test-');
  const scheme = isTestnet ? 'myid-uat' : 'myid';
  return `${scheme}://myid.com/app/flutter`;
}


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
  const currentSubStepRef = useRef<SubStep>('embedding');
  const [isMobile] = useState(() => getIsMobile());
  const deeplinkFiredRef = useRef(false);

  // On mobile: auto-deeplink to MyID when QR data arrives (signing step)
  useEffect(() => {
    if (isMobile && mobileQrData && !deeplinkFiredRef.current) {
      deeplinkFiredRef.current = true;
      const deeplink = qrDataToDeeplink(mobileQrData);
      console.log('[Anchoring] Mobile deeplink:', deeplink);
      window.location.href = deeplink;
    }
    if (!mobileQrData) {
      deeplinkFiredRef.current = false;
    }
  }, [isMobile, mobileQrData]);

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
      currentSubStepRef.current = 'embedding';
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
      currentSubStepRef.current = 'cms-signing';
      setSubStep('cms-signing');
      trackAnchoringSubStep('cms-signing');
      console.log('[Anchoring] Sending PDF to server for CMS signing via FormData...');

      // Extract identity details from verified claims
      const credentialIssuer = session.verifiedClaims
        ? getIssuerFromClaims(session.verifiedClaims)
        : '';
      const identityNumber = session.verifiedClaims
        ? getIdentifierFromClaims(session.verifiedClaims)
        : '';

      // Build FormData with raw PDF binary (no base64 encoding — saves 33% size
      // and avoids iOS memory pressure from atob/Buffer polyfill)
      const formData = new FormData();
      formData.append('pdf', new Blob([visualPdf.buffer as ArrayBuffer], { type: 'application/pdf' }), session.pdfFile!.name);
      formData.append('signerName', session.signerName);
      formData.append('signerDid', session.signerDID || `did:zetrix:${session.walletAddress}`);
      formData.append('signerAddress', session.walletAddress);
      if (session.publicKey) formData.append('signerPublicKey', session.publicKey);
      formData.append('credentialId', session.credentialID);
      formData.append('credentialIssuer', credentialIssuer);
      if (session.credentialType) formData.append('credentialType', session.credentialType);
      if (identityNumber) formData.append('identityNumber', identityNumber);

      const cmsSignRes = await fetch('/api/signing/cms-sign', {
        method: 'POST',
        // No Content-Type header — browser auto-sets multipart/form-data with boundary
        body: formData,
      });

      if (!cmsSignRes.ok) {
        const errBody = await cmsSignRes.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error || `CMS signing failed (${cmsSignRes.status})`);
      }

      // Server returns only documentHash + downloadToken (no base64 PDF payload)
      const { documentHash, downloadToken: cmsDownloadToken } = await cmsSignRes.json();
      console.log('[Anchoring] CMS signature applied. Document hash:', documentHash?.slice(0, 20) + '...');
      console.log('[Anchoring] CMS download token:', cmsDownloadToken?.slice(0, 8) + '...');

      // Track the latest download token (will be updated if anchor XMP succeeds)
      let downloadToken = cmsDownloadToken || '';

      // ── Step 4: Wallet signs the document hash ──
      // This signature is stored on-chain and verified by the smart contract's
      // ecVerify(documentHash, digitalSignature, signerPublicKey).
      currentSubStepRef.current = 'signing';
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
        // Try existing SDK session first — only reconnect if it fails
        try {
          console.log('[Anchoring] Mobile: signing with existing session...');
          // Start sign request (sends over WebSocket immediately)
          const signPromise = signMessageMobile(documentHash);
          // Redirect to MyID so user can see and approve the signing popup
          if (isMobile) {
            console.log('[Anchoring] Mobile: redirecting to MyID for signing approval...');
            window.location.href = buildMyIdDeeplink();
          }
          const signResult = await signPromise;
          walletSignature = signResult.signData;
          signerPublicKey = signResult.publicKey || session.publicKey;
        } catch (existingSessionErr) {
          console.log('[Anchoring] Existing session failed, reconnecting...', existingSessionErr);
          const signResult = await reconnectAndSignMobile(documentHash, (qrContent) => {
            setMobileQrData(qrContent);
          });
          setMobileQrData('');
          walletSignature = signResult.signData;
          signerPublicKey = signResult.publicKey || session.publicKey;
        }
      }

      // ── Step 5: Submit anchorDocument transaction ──
      currentSubStepRef.current = 'anchoring';
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
        // Start sign request then redirect to MyID for approval
        const blobSignPromise = signMessageMobile(blob);
        if (isMobile) {
          console.log('[Anchoring] Mobile: redirecting to MyID for blob signing approval...');
          window.location.href = buildMyIdDeeplink();
        }
        const blobSign = await blobSignPromise;
        txHash = await submitSignedTransaction(blob, blobSign.signData, blobSign.publicKey || signerPublicKey, blobHash, session.walletAddress);
      } else {
        console.log('[Anchoring] Waiting 3s for extension to reset...');
        await new Promise(r => setTimeout(r, 3_000));
        const blobSign = await signMessageExtension(blob);
        txHash = await submitSignedTransaction(blob, blobSign.signData, blobSign.publicKey || session.publicKey, blobHash, session.walletAddress);
      }
      console.log('[Anchoring] TX submitted:', txHash);

      // ── Step 6: Append anchor XMP via incremental update ──
      currentSubStepRef.current = 'anchor-xmp';
      setSubStep('anchor-xmp');
      trackAnchoringSubStep('anchor-xmp');
      console.log('[Anchoring] Appending anchor XMP to signed PDF...');

      // Send only the download token — server retrieves PDF from its own store
      // (eliminates the ~2.5MB base64 round-trip that caused iOS corruption)
      const anchorRes = await fetch('/api/signing/cms-anchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          downloadToken,
          txHash,
          blockNumber: 0, // Will be populated when we have block info
          blockTimestamp: new Date().toISOString(),
          documentHash,
          chainId: 'zetrix-testnet',
        }),
      });

      if (!anchorRes.ok) {
        // Non-critical: if anchor XMP fails, we still have the CMS-signed PDF via download token
        console.warn('[Anchoring] Anchor XMP append failed, using PDF without anchor metadata');
        // downloadToken stays as cmsDownloadToken
      } else {
        const { downloadToken: anchorDownloadToken } = await anchorRes.json();
        // Use the anchor token (points to final PDF with XMP metadata)
        if (anchorDownloadToken) {
          downloadToken = anchorDownloadToken;
          console.log('[Anchoring] Anchor download token:', downloadToken.slice(0, 8) + '...');
        }
      }

      // ── Step 7: Save session to DB ──
      currentSubStepRef.current = 'saving';
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
        downloadToken,
        timestamp: new Date().toISOString(),
      });

      setSubStep('done');
      trackAnchoringSuccess(txHash);
      setTimeout(() => nextStep(), 1500);
    } catch (err) {
      setMobileQrData('');
      const failedStep = currentSubStepRef.current;
      console.error('[Anchoring] Failed at sub-step:', failedStep, err);
      const message = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
      trackAnchoringError(failedStep, message || 'Unknown error');
      setError(message || 'Anchoring failed');
      setFailedAt(failedStep);
      setSubStep('error');
    }
  }

  const steps: { key: SubStep; label: ReactNode }[] = isMobile
    ? [
        { key: 'embedding', label: 'Embedding visual signature...' },
        { key: 'cms-signing', label: 'Applying digital signature...' },
        { key: 'signing', label: <><b>Sign document hash in your MyID App</b></> },
        { key: 'anchoring', label: <><b>Submit to Zetrix blockchain using your MyID App</b></> },
        { key: 'anchor-xmp', label: 'Embedding blockchain proof in PDF...' },
        { key: 'saving', label: 'Saving session record...' },
        { key: 'done', label: 'Anchoring complete!' },
      ]
    : [
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

        {/* Signing approval: QR on desktop, deeplink on mobile */}
        {mobileQrData && subStep === 'signing' && !isMobile && (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium">Approve on your MyID App</p>
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-[280px]">
              Scan this QR code to reconnect your wallet, then approve the signing request on your phone.
            </p>
            <div className="rounded-xl border bg-white p-3">
              <QRCodeSVG value={mobileQrData} size={180} level="M" />
            </div>
          </div>
        )}
        {mobileQrData && subStep === 'signing' && isMobile && (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium">Approve in MyID App</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Opening MyID... Approve the signing request on your phone.
            </p>
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
