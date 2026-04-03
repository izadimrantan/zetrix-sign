'use client';

import { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletConnector } from '@/components/wallet/wallet-connector';
import { truncateAddress } from '@/lib/utils';
import type { SigningSession } from '@/types/signing';
import type { WalletConnectResult } from '@/types/wallet';

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

export function StepWallet({ session, updateSession, nextStep, prevStep }: StepProps) {
  const isConnected = !!session.walletAddress && !!session.publicKey;
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Wallet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Wallet Connected</p>
              <p className="text-sm text-green-600">{truncateAddress(session.walletAddress)}</p>
            </div>
          </div>
        ) : (
          <WalletConnector onConnected={handleConnected} isMobile={isMobile} />
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>Back</Button>
          <Button onClick={nextStep} disabled={!isConnected}>Continue</Button>
        </div>
      </CardContent>
    </Card>
  );
}
