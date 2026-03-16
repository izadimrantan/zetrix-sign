'use client';

import { CheckCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { WalletConnector } from '@/components/wallet/wallet-connector';
import { truncateAddress } from '@/lib/utils';
import { getDummyCredential } from '@/lib/vc';
import type { SigningSession } from '@/types/signing';
import { trackIdentityConfirmed } from '@/lib/analytics';
import type { WalletConnectResult } from '@/types/wallet';

interface StepProps {
  session: SigningSession;
  updateSession: (partial: Partial<SigningSession>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export function StepWalletIdentity({ session, updateSession, nextStep, prevStep }: StepProps) {
  // Mobile auth returns address but not publicKey (publicKey comes from signMessage later)
  const isConnected = !!session.walletAddress;
  const isConfirmed = !!session.credentialID;
  const vc = getDummyCredential();

  const handleConnected = (result: WalletConnectResult) => {
    updateSession({
      walletAddress: result.address,
      publicKey: result.publicKey,
      connectionMethod: result.connectionMethod,
    });
  };

  const handleConfirmIdentity = () => {
    updateSession({
      signerName: vc.name,
      signerDID: vc.did,
      credentialID: vc.credentialID,
    });
    trackIdentityConfirmed(vc.credentialID);
  };

  return (
    <Card>
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

        {/* Identity Section — appears after wallet connects */}
        {isConnected && (
          <div className="space-y-4">
            <div className="rounded-lg border p-6">
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold">{vc.name}</h3>
                  <p className="text-sm text-muted-foreground">{vc.did}</p>
                </div>
                <Badge variant="secondary" className="ml-auto">Verified</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Issuer</span>
                  <span>{vc.issuer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credential ID</span>
                  <span className="font-mono text-xs">{vc.credentialID}</span>
                </div>
              </div>
            </div>

            {!isConfirmed && (
              <Button onClick={handleConfirmIdentity} className="w-full">Confirm Identity</Button>
            )}
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>Back</Button>
          <Button onClick={nextStep} disabled={!isConnected || !isConfirmed}>Continue</Button>
        </div>
      </CardContent>
    </Card>
  );
}
