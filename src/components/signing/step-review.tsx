'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { truncateAddress } from '@/lib/utils';
import { trackReviewConfirmed } from '@/lib/analytics';
import type { SigningSession } from '@/types/signing';

interface StepProps {
  session: SigningSession;
  updateSession: (partial: Partial<SigningSession>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export function StepReview({ session, nextStep, prevStep }: StepProps) {
  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
    <Card className="relative overflow-hidden border-[var(--zetrix-border)] shadow-sm">
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <CardHeader>
        <CardTitle>Review & Confirm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Document</span>
            <span className="font-medium">{session.pdfFile?.name} ({session.pdfPageCount} pages)</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Wallet</span>
            <span className="font-mono">{truncateAddress(session.walletAddress)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Signer</span>
            <span>{session.signerName}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Credential</span>
            <span className="font-mono">{session.credentialID}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Signature Type</span>
            <span className="capitalize">{session.signatureType}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Signature Preview</span>
            <img src={session.signatureImage} alt="Signature" className="max-h-12" />
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>Back</Button>
          <Button onClick={() => { trackReviewConfirmed(); nextStep(); }}>Sign & Anchor on Blockchain</Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
