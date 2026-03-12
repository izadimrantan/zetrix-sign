'use client';

import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDummyCredential } from '@/lib/vc';
import type { SigningSession } from '@/types/signing';

interface StepProps {
  session: SigningSession;
  updateSession: (partial: Partial<SigningSession>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

export function StepCredential({ session, updateSession, nextStep, prevStep }: StepProps) {
  const vc = getDummyCredential();
  const isConfirmed = !!session.credentialID;

  const handleConfirm = () => {
    updateSession({
      signerName: vc.name,
      signerDID: vc.did,
      credentialID: vc.credentialID,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify Identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <Button onClick={handleConfirm} className="w-full">Confirm Identity</Button>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>Back</Button>
          <Button onClick={nextStep} disabled={!isConfirmed}>Continue</Button>
        </div>
      </CardContent>
    </Card>
  );
}
