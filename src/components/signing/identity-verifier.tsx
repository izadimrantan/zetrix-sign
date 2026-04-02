'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, ShieldCheck, Smartphone, Download, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getVPMobile } from '@/lib/wallet';
import type { CredentialType, VerifiedClaims, Oid4vpVerifyResponse } from '@/types/oid4vp';

// Template IDs for MyKad and Passport VCs — configure via env vars
const MYKAD_TEMPLATE_ID = process.env.NEXT_PUBLIC_MYKAD_TEMPLATE_ID || '';
const PASSPORT_TEMPLATE_ID = process.env.NEXT_PUBLIC_PASSPORT_TEMPLATE_ID || '';

// Attributes to request from each credential type
const CREDENTIAL_ATTRIBUTES: Record<CredentialType, string[]> = {
  mykad: ['name', 'icNo'],
  passport: ['name', 'passportNumber'],
};

interface Props {
  onVerified: (claims: VerifiedClaims, presentationId: string) => void;
  initialClaims?: VerifiedClaims;
  initialPresentationId?: string;
}

type Phase = 'select' | 'connecting' | 'verifying' | 'verified' | 'failed';

export function IdentityVerifier({ onVerified, initialClaims, initialPresentationId }: Props) {
  const [credentialType, setCredentialType] = useState<CredentialType>(initialClaims?.credentialType || 'mykad');
  const [phase, setPhase] = useState<Phase>(initialClaims ? 'verified' : 'select');
  const [qrData, setQrData] = useState('');
  const [error, setError] = useState('');
  const [verifiedClaims, setVerifiedClaims] = useState<VerifiedClaims | null>(initialClaims || null);
  const [presentationId, setPresentationId] = useState(initialPresentationId || '');

  async function startVerification() {
    setError('');
    setPhase('connecting');

    const templateId = credentialType === 'mykad' ? MYKAD_TEMPLATE_ID : PASSPORT_TEMPLATE_ID;
    const attributes = CREDENTIAL_ATTRIBUTES[credentialType];

    if (!templateId) {
      setError(`Template ID for ${credentialType} is not configured. Set NEXT_PUBLIC_${credentialType.toUpperCase()}_TEMPLATE_ID in your environment.`);
      setPhase('failed');
      return;
    }

    try {
      // Step 1: SDK connect + auth + getVP (shows QR for MyID)
      const { uuid, address, publicKey } = await getVPMobile(
        templateId,
        attributes,
        (qrContent) => setQrData(qrContent)
      );

      setQrData('');
      setPhase('verifying');

      // Step 2: Send uuid to backend to verify and extract claims
      const res = await fetch('/api/oid4vp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, credentialType }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error || 'Verification failed');
      }

      const data = (await res.json()) as Oid4vpVerifyResponse;

      if (!data.verified || !data.claims) {
        throw new Error(data.error || 'VP verification returned no claims');
      }

      setVerifiedClaims(data.claims);
      setPresentationId(uuid);
      setPhase('verified');
      onVerified(data.claims, uuid);
    } catch (err) {
      setQrData('');
      // Extract message from Error objects or SDK rejection objects (plain objects with .message)
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Verification failed';
      // User cancel is not an error
      if (message === 'Cancelled') {
        handleRetry();
        return;
      }
      setError(message);
      setPhase('failed');
    }
  }

  function handleRetry() {
    setError('');
    setQrData('');
    setVerifiedClaims(null);
    setPresentationId('');
    setPhase('select');
  }

  const androidUrl = process.env.NEXT_PUBLIC_MYID_ANDROID_URL;
  const iosUrl = process.env.NEXT_PUBLIC_MYID_IOS_URL;

  return (
    <div className="space-y-4">
      {/* Credential Type Selector */}
      {phase === 'select' && (
        <>
          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-xs text-blue-700">
              Identity verification currently supports <strong>MyKad</strong> (Malaysian IC) and <strong>Passport</strong> only.
            </p>
          </div>

          <Tabs
            value={credentialType}
            onValueChange={(v) => setCredentialType(v as CredentialType)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="mykad">MyKad</TabsTrigger>
              <TabsTrigger value="passport">Passport</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="rounded-lg border border-[var(--zetrix-border)] p-4">
            <p className="text-sm text-muted-foreground">
              {credentialType === 'mykad'
                ? 'Verify using your Malaysian Identity Card (MyKad) credential stored in MyID.'
                : 'Verify using your Passport credential stored in MyID.'}
            </p>
          </div>

          <Button onClick={startVerification} className="w-full">
            <ShieldCheck className="mr-2 h-4 w-4" />
            Verify with MyID
          </Button>
        </>
      )}

      {/* Connecting / QR Phase */}
      {(phase === 'connecting') && (
        <>
          {/* MyID download info */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start gap-2">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-800">
                  You need the MyID app to verify your identity.
                </p>
                <p className="text-xs text-amber-700">
                  Currently supports MyKad and Passport credentials only.
                </p>
                {(androidUrl || iosUrl) && (
                  <div className="flex gap-3 pt-1">
                    {androidUrl && (
                      <a
                        href={androidUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline decoration-amber-400 hover:text-amber-700"
                      >
                        <Download className="h-3 w-3" />
                        Android
                      </a>
                    )}
                    {iosUrl && (
                      <a
                        href={iosUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 underline decoration-amber-400 hover:text-amber-700"
                      >
                        <Download className="h-3 w-3" />
                        iOS
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {qrData ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">Scan with MyID to verify your identity</p>
              <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                Open your MyID app and scan this QR code. Approve the credential disclosure to continue.
              </p>
              <div className="rounded-xl border bg-white p-3">
                <QRCodeSVG value={qrData} size={200} level="M" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for MyID approval...
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 p-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Connecting to MyID...</span>
            </div>
          )}

          <Button variant="outline" onClick={handleRetry} className="w-full">
            Cancel
          </Button>
        </>
      )}

      {/* Verifying Phase (backend checking uuid) */}
      {phase === 'verifying' && (
        <div className="flex items-center justify-center gap-2 p-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">Verifying credentials...</span>
        </div>
      )}

      {/* Verified Phase */}
      {phase === 'verified' && verifiedClaims && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-4 py-2.5">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Identity Verified</span>
          </div>

          <div className="rounded-lg border border-[var(--zetrix-border)] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--zetrix-text-muted)]">
              {verifiedClaims.credentialType === 'mykad' ? 'MyKad Credential' : 'Passport Credential'}
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-muted-foreground shrink-0 w-28">Name</span>
                <span className="font-medium">{verifiedClaims.claims.name}</span>
              </div>

              {verifiedClaims.credentialType === 'mykad' && (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-muted-foreground shrink-0 w-28">IC Number</span>
                    <span className="font-mono">{verifiedClaims.claims.icNumber}</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-muted-foreground shrink-0 w-28">ID Expiry</span>
                    <span>{verifiedClaims.claims.myDigitalIdExpiry}</span>
                  </div>
                </>
              )}

              {verifiedClaims.credentialType === 'passport' && (
                <>
                  <div className="flex items-baseline gap-3">
                    <span className="text-muted-foreground shrink-0 w-28">Passport No.</span>
                    <span className="font-mono">{verifiedClaims.claims.passportNumber}</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-muted-foreground shrink-0 w-28">Country</span>
                    <span>{verifiedClaims.claims.countryCode}</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-muted-foreground shrink-0 w-28">Date of Birth</span>
                    <span>{verifiedClaims.claims.dateOfBirth}</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-muted-foreground shrink-0 w-28">Gender</span>
                    <span>{verifiedClaims.claims.gender}</span>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span className="text-muted-foreground shrink-0 w-28">Expiry</span>
                    <span>{verifiedClaims.claims.dateOfExpiry}</span>
                  </div>
                </>
              )}

              {presentationId && (
                <div className="flex items-baseline gap-3 pt-1 border-t border-[var(--zetrix-border)]">
                  <span className="text-muted-foreground shrink-0 w-28">VP ID</span>
                  <span className="font-mono text-xs break-all">{presentationId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Failed Phase */}
      {phase === 'failed' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-2.5">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">{error || 'Verification failed'}</span>
          </div>
          <Button onClick={handleRetry} className="w-full">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
