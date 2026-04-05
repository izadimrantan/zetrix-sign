'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, ShieldCheck, CreditCard, BookOpen, ChevronDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  CredentialType,
  VerifiedClaims,
  Oid4vpCreateResponse,
  Oid4vpStatusResponse,
} from '@/types/oid4vp';

// Polling interval in milliseconds
const POLL_INTERVAL_MS = 3000;

interface Props {
  onVerified: (claims: VerifiedClaims, presentationId: string) => void;
  initialClaims?: VerifiedClaims;
  initialPresentationId?: string;
  isMobile: boolean;
}

type Phase = 'select' | 'loading' | 'scanning' | 'verifying' | 'verified' | 'failed';

export function IdentityVerifier({ onVerified, initialClaims, initialPresentationId, isMobile }: Props) {
  const [credentialType, setCredentialType] = useState<CredentialType>(
    initialClaims?.credentialType || 'mykad'
  );
  const [phase, setPhase] = useState<Phase>(initialClaims ? 'verified' : 'select');
  const [qrData, setQrData] = useState('');
  const [deepLinkUrl, setDeepLinkUrl] = useState('');
  const [error, setError] = useState('');
  const [verifiedClaims, setVerifiedClaims] = useState<VerifiedClaims | null>(
    initialClaims || null
  );
  const [presentationId, setPresentationId] = useState(initialPresentationId || '');

  // Polling state
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateIdRef = useRef('');

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  /** Start polling for verification result */
  const startPolling = useCallback(
    (stateId: string) => {
      stateIdRef.current = stateId;

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/oid4vp/status?stateId=${encodeURIComponent(stateId)}`);
          if (!res.ok) {
            if (res.status === 404) {
              stopPolling();
              setError('Verification request expired. Please try again.');
              setPhase('failed');
            }
            return;
          }

          const data = (await res.json()) as Oid4vpStatusResponse;

          if (data.status === 'verified' && data.claims) {
            stopPolling();
            setVerifiedClaims(data.claims);
            setPresentationId(data.presentationId || '');
            setPhase('verified');
            onVerified(data.claims, data.presentationId || '');
          } else if (data.status === 'failed') {
            stopPolling();
            setError(data.error || 'Verification failed');
            setPhase('failed');
          } else if (data.status === 'expired') {
            stopPolling();
            setError('Verification request expired. Please try again.');
            setPhase('failed');
          }
        } catch {
          // Network error — keep polling (transient)
        }
      }, POLL_INTERVAL_MS);
    },
    [onVerified]
  );

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  /** Main flow: create verification request → show QR → poll for result */
  async function startVerification() {
    setError('');
    setPhase('loading');

    try {
      const res = await fetch('/api/oid4vp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialType }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          (errBody as { error?: string }).error || `Request failed (${res.status})`
        );
      }

      const data = (await res.json()) as Oid4vpCreateResponse;

      if (!data.success || !data.qrCodeData || !data.stateId) {
        throw new Error(data.error || 'Failed to create verification request');
      }

      setQrData(data.qrCodeData);
      setDeepLinkUrl(data.deepLinkUrl || '');
      startPolling(data.stateId);

      // Mobile: immediately redirect to MyID deeplink, skip the QR/button phase
      if (isMobile && data.deepLinkUrl) {
        console.log('[IdentityVerifier] Mobile deeplink:', data.deepLinkUrl);
        window.location.href = data.deepLinkUrl;
      }

      setPhase('scanning');
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to start verification';
      setError(message);
      setPhase('failed');
    }
  }

  function handleRetry() {
    stopPolling();
    setError('');
    setQrData('');
    setDeepLinkUrl('');
    setVerifiedClaims(null);
    setPresentationId('');
    setPhase('select');
  }

  return (
    <div className="space-y-4">
      {/* Credential Type Selector — accordion cards */}
      {phase === 'select' && (
        <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 space-y-4">
          {/* MyKad Option */}
          <div
            className={`rounded-xl border bg-white transition-all duration-200 ${
              credentialType === 'mykad'
                ? 'border-primary/30 shadow-sm'
                : 'border-[var(--zetrix-border)] hover:border-primary/20 hover:shadow-sm'
            }`}
          >
            <button
              type="button"
              className="flex w-full items-start gap-3 p-4 text-left sm:gap-4 sm:p-5"
              onClick={() => setCredentialType('mykad')}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] sm:h-11 sm:w-11">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-sm font-bold tracking-tight text-[var(--zetrix-text)] sm:text-[15px]">
                    MyKad
                  </span>
                  <Badge variant="outline" className="text-[10px] font-semibold border-[var(--zetrix-border)] text-[var(--zetrix-text-muted)]">
                    Malaysian IC
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs font-light text-[var(--zetrix-text-muted)] sm:text-sm">
                  Verify using your Malaysian Identity Card credential stored in MyID.
                </p>
              </div>
              <ChevronDown
                className={`mt-1 h-5 w-5 shrink-0 text-[var(--zetrix-text-muted)] transition-transform duration-200 ${
                  credentialType === 'mykad' ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                credentialType === 'mykad' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 sm:pl-[76px]">
                  <Button onClick={startVerification} size="sm">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Verify with MyID
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Or Divider */}
          <div className="relative flex items-center py-1">
            <div className="flex-1 border-t border-[var(--zetrix-border)]" />
            <span className="px-4 text-xs font-medium text-[var(--zetrix-text-muted)]">or</span>
            <div className="flex-1 border-t border-[var(--zetrix-border)]" />
          </div>

          {/* Passport Option */}
          <div
            className={`rounded-xl border bg-white transition-all duration-200 ${
              credentialType === 'passport'
                ? 'border-primary/30 shadow-sm'
                : 'border-[var(--zetrix-border)] hover:border-primary/20 hover:shadow-sm'
            }`}
          >
            <button
              type="button"
              className="flex w-full items-start gap-3 p-4 text-left sm:gap-4 sm:p-5"
              onClick={() => setCredentialType('passport')}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] sm:h-11 sm:w-11">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <span className="text-sm font-bold tracking-tight text-[var(--zetrix-text)] sm:text-[15px]">
                    Passport
                  </span>
                  <Badge variant="outline" className="text-[10px] font-semibold border-[var(--zetrix-border)] text-[var(--zetrix-text-muted)]">
                    Malaysian Passport
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs font-light text-[var(--zetrix-text-muted)] sm:text-sm">
                  Verify using your Passport credential stored in MyID.
                </p>
              </div>
              <ChevronDown
                className={`mt-1 h-5 w-5 shrink-0 text-[var(--zetrix-text-muted)] transition-transform duration-200 ${
                  credentialType === 'passport' ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                credentialType === 'passport' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 sm:pl-[76px]">
                  <Button onClick={startVerification} size="sm">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Verify with MyID
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Phase */}
      {phase === 'loading' && (
        <div className="flex items-center justify-center gap-2 p-8 animate-in fade-in duration-300">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">Creating verification request...</span>
        </div>
      )}

      {/* Scanning Phase — desktop: QR, mobile: deeplink button */}
      {phase === 'scanning' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 space-y-4">
          {isMobile ? (
            /* ---- Mobile: already deeplinked, just show waiting ---- */
            <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/30 p-6">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <p className="text-sm font-medium">Waiting for MyID approval...</p>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Approve the credential disclosure in MyID to continue.
              </p>
            </div>
          ) : (
            /* ---- Desktop: QR code ---- */
            qrData && (
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4 animate-in fade-in zoom-in-95 duration-300">
                <p className="text-sm font-medium">Scan with MyID to verify your identity</p>
                <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                  Open your MyID app and scan this QR code. Approve the credential
                  disclosure to continue.
                </p>
                <div className="rounded-xl border bg-white p-3 animate-in fade-in zoom-in-95 duration-500 delay-150">
                  <QRCodeSVG value={qrData} size={200} level="M" />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Waiting for MyID approval...
                </div>
              </div>
            )
          )}

          <Button variant="outline" onClick={handleRetry} className="w-full">
            Cancel
          </Button>
        </div>
      )}

      {/* Verifying Phase */}
      {phase === 'verifying' && (
        <div className="flex items-center justify-center gap-2 p-8 animate-in fade-in duration-300">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm">Verifying credentials...</span>
        </div>
      )}

      {/* Verified Phase */}
      {phase === 'verified' && verifiedClaims && (
        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-400">
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-4 py-2.5">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Identity Verified</span>
          </div>

          <div className="rounded-lg border border-[var(--zetrix-border)] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--zetrix-text-muted)]">
              {verifiedClaims.credentialType === 'mykad'
                ? 'MyKad Credential'
                : 'Passport Credential'}
            </p>

            <div className="space-y-2 text-sm">
              <div className="flex items-baseline gap-3">
                <span className="text-muted-foreground shrink-0 w-28">Name</span>
                <span className="font-medium">{verifiedClaims.claims.name}</span>
              </div>

              {verifiedClaims.credentialType === 'mykad' && (
                <div className="flex items-baseline gap-3">
                  <span className="text-muted-foreground shrink-0 w-28">IC Number</span>
                  <span className="font-mono">{verifiedClaims.claims.icNumber}</span>
                </div>
              )}

              {verifiedClaims.credentialType === 'passport' && (
                <div className="flex items-baseline gap-3">
                  <span className="text-muted-foreground shrink-0 w-28">Passport No.</span>
                  <span className="font-mono">{verifiedClaims.claims.passportNumber}</span>
                </div>
              )}

              {presentationId && (
                <div className="flex items-baseline gap-3 pt-1 border-t border-[var(--zetrix-border)]">
                  <span className="text-muted-foreground shrink-0 w-28">VP ID</span>
                  <span className="font-mono break-all">{presentationId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Failed Phase */}
      {phase === 'failed' && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-2.5">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-700">
              {error || 'Verification failed'}
            </span>
          </div>
          <Button onClick={handleRetry} className="w-full">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}
