'use client';

import { useRef, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eraser } from 'lucide-react';
import { trackSignatureCreated, trackSignatureCleared, trackSignatureTabSwitch } from '@/lib/analytics';
import type { SigningSession, SignatureType } from '@/types/signing';

interface StepProps {
  session: SigningSession;
  updateSession: (partial: Partial<SigningSession>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

function generateAutoSignature(name: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 100;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'italic 24px serif';
  ctx.fillText(`Signed by: ${name}`, 20, 40);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#666666';
  ctx.fillText(new Date().toLocaleString(), 20, 70);
  return canvas.toDataURL('image/png');
}

export function StepSignature({ session, updateSession, nextStep, prevStep }: StepProps) {
  const canvasRef = useRef<SignatureCanvas>(null);
  const [activeTab, setActiveTab] = useState<SignatureType>(
    (session.signatureType as SignatureType) || 'auto'
  );

  const handleAutoGenerate = useCallback(() => {
    const image = generateAutoSignature(session.signerName || 'Signer');
    updateSession({ signatureType: 'auto', signatureImage: image });
    trackSignatureCreated('auto');
  }, [session.signerName, updateSession]);

  const handleDrawnSave = useCallback(() => {
    if (canvasRef.current && !canvasRef.current.isEmpty()) {
      const image = canvasRef.current.toDataURL('image/png');
      updateSession({ signatureType: 'drawn', signatureImage: image });
      trackSignatureCreated('drawn');
    }
  }, [updateSession]);

  const handleClear = () => {
    canvasRef.current?.clear();
    updateSession({ signatureImage: '', signatureType: '' });
    trackSignatureCleared();
  };

  const hasSignature = !!session.signatureImage;

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
    <Card className="relative overflow-hidden border-[var(--zetrix-border)] shadow-sm">
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <CardHeader>
        <CardTitle>Create Signature</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as SignatureType); trackSignatureTabSwitch(v as 'auto' | 'draw'); }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="auto">Auto Signature</TabsTrigger>
            <TabsTrigger value="drawn">Draw Signature</TabsTrigger>
          </TabsList>
          <TabsContent value="auto" className="space-y-4">
            <Button onClick={handleAutoGenerate} variant="outline" className="w-full">
              Generate Signature
            </Button>
          </TabsContent>
          <TabsContent value="drawn" className="space-y-4">
            <div className="rounded-lg border bg-white">
              <SignatureCanvas
                ref={canvasRef}
                canvasProps={{ className: 'w-full h-40', width: 600, height: 160 }}
                penColor="black"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleClear} variant="outline" size="sm">
                <Eraser className="mr-2 h-4 w-4" /> Clear
              </Button>
              <Button onClick={handleDrawnSave} size="sm">Save Drawn Signature</Button>
            </div>
          </TabsContent>
        </Tabs>

        {hasSignature && (
          <div className="rounded-lg border p-4">
            <p className="mb-2 text-sm text-muted-foreground">Preview:</p>
            <img src={session.signatureImage} alt="Signature preview" className="max-h-24" />
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>Back</Button>
          <Button onClick={nextStep} disabled={!hasSignature}>Continue</Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
