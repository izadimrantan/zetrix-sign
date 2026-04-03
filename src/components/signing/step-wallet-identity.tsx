'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Smartphone, Download, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletConnector } from '@/components/wallet/wallet-connector';
import { truncateAddress } from '@/lib/utils';
import { IdentityVerifier } from './identity-verifier';
import { getSignerNameFromClaims } from '@/lib/oid4vp/claims';
import { trackIdentityConfirmed } from '@/lib/analytics';
import type { SigningSession } from '@/types/signing';
import type { WalletConnectResult } from '@/types/wallet';
import type { VerifiedClaims } from '@/types/oid4vp';

interface StepProps {
  session: SigningSession;
  updateSession: (partial: Partial<SigningSession>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function StepWalletIdentity({ session, updateSession, nextStep, prevStep }: StepProps) {
  const isConnected = !!session.walletAddress;
  const isVerified = !!session.credentialID;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(getIsMobile());
  }, []);

  const handleConnected = (result: WalletConnectResult) => {
    updateSession({
      walletAddress: result.address,
      publicKey: result.publicKey,
      connectionMethod: result.connectionMethod,
    });
  };

  const handleVerified = (claims: VerifiedClaims, presentationId: string) => {
    const signerName = getSignerNameFromClaims(claims);
    updateSession({
      signerName,
      signerDID: `did:zetrix:${session.walletAddress}`,
      credentialID: presentationId,
      credentialType: claims.credentialType,
      verifiedClaims: claims,
    });
    trackIdentityConfirmed(presentationId);
  };

  const androidUrl = process.env.NEXT_PUBLIC_MYID_ANDROID_URL;
  const iosUrl = process.env.NEXT_PUBLIC_MYID_IOS_URL;

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
    <Card className="relative overflow-hidden border-[var(--zetrix-border)] shadow-sm">
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <CardHeader>
        <CardTitle>Connect Wallet & Verify Identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* MyID app notice — shown before wallet connection */}
        {!isConnected && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 animate-in fade-in duration-300">
            <div className="flex items-start gap-2">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-800">
                  You need the MyID app to connect your wallet and verify your identity with verifiable credentials in the app.
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
        )}

        {/* Wallet Section */}
        {isConnected ? (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Wallet Connected</p>
              <p className="text-sm text-green-600">{truncateAddress(session.walletAddress)}</p>
            </div>
          </div>
        ) : (
          <WalletConnector onConnected={handleConnected} isMobile={isMobile} />
        )}

        {/* Identity Verification — appears after wallet connects */}
        {isConnected && !isVerified && (
          <div className="rounded-lg border border-[var(--zetrix-border)] p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--zetrix-text-muted)]">
              Identity Verification
            </p>
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2.5 mb-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <p className="text-xs text-blue-700">
                Identity verification currently supports{' '}
                <strong>MyKad</strong> (Malaysian IC) and <strong>Malaysian Passports</strong> only.
              </p>
            </div>
            <IdentityVerifier onVerified={handleVerified} isMobile={isMobile} />
          </div>
        )}

        {/* Verified Identity Display */}
        {isConnected && isVerified && session.verifiedClaims && (
          <div className="rounded-lg border border-[var(--zetrix-border)] p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--zetrix-text-muted)]">
              Identity Verification
            </p>
            <IdentityVerifier
              onVerified={handleVerified}
              initialClaims={session.verifiedClaims}
              initialPresentationId={session.credentialID}
              isMobile={isMobile}
            />
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>Back</Button>
          <Button onClick={nextStep} disabled={!isConnected || !isVerified}>Continue</Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
