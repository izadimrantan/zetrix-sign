'use client';

import { CheckCircle } from 'lucide-react';
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

export function StepWalletIdentity({ session, updateSession, nextStep, prevStep }: StepProps) {
  const isConnected = !!session.walletAddress;
  const isVerified = !!session.credentialID;

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

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
    <Card className="relative overflow-hidden border-[var(--zetrix-border)] shadow-sm">
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <CardHeader>
        <CardTitle>Connect Wallet & Verify Identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wallet Section */}
        {isConnected ? (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Wallet Connected</p>
              <p className="text-sm text-green-600">{truncateAddress(session.walletAddress)}</p>
            </div>
          </div>
        ) : (
          <WalletConnector onConnected={handleConnected} />
        )}

        {/* Identity Verification — appears after wallet connects */}
        {isConnected && !isVerified && (
          <div className="rounded-lg border border-[var(--zetrix-border)] p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--zetrix-text-muted)]">
              Identity Verification
            </p>
            <IdentityVerifier onVerified={handleVerified} />
          </div>
        )}

        {/* Verified Identity Display */}
        {isConnected && isVerified && session.verifiedClaims && (
          <div className="rounded-lg border border-[var(--zetrix-border)] p-6">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[var(--zetrix-text-muted)]">
              Identity Verification
            </p>
            <IdentityVerifier
              onVerified={handleVerified}
              initialClaims={session.verifiedClaims}
              initialPresentationId={session.credentialID}
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
