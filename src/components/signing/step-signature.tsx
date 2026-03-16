'use client';

import { useRef, useState, useCallback } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Type, PenTool, Eraser, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { trackSignatureCreated, trackSignatureCleared } from '@/lib/analytics';
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
  const [expanded, setExpanded] = useState<'auto' | 'drawn' | null>(
    (session.signatureType as 'auto' | 'drawn') || null
  );

  const toggleExpand = (method: 'auto' | 'drawn') => {
    setExpanded(prev => prev === method ? null : method);
  };

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
        <div className="space-y-1">
          <h3 className="text-lg font-bold tracking-tight text-[var(--zetrix-text)]">
            Choose Signature Method
          </h3>
          <p className="text-sm font-light text-[var(--zetrix-text-muted)]">
            Generate an automatic signature or draw your own. Select an option below.
          </p>
        </div>

        {/* Auto Signature Option */}
        <div
          className={`rounded-xl border bg-white transition-all ${
            expanded === 'auto'
              ? 'border-primary/30 shadow-sm'
              : 'border-[var(--zetrix-border)] hover:border-primary/20 hover:shadow-sm'
          }`}
        >
          <button
            type="button"
            className="flex w-full items-start gap-4 p-5 text-left"
            onClick={() => toggleExpand('auto')}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08]">
              <Type className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold tracking-tight text-[var(--zetrix-text)]">
                  Auto Signature
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold border-[var(--zetrix-border)] text-[var(--zetrix-text-muted)]">
                  Recommended
                </Badge>
              </div>
              <p className="mt-0.5 text-sm font-light text-[var(--zetrix-text-muted)]">
                Automatically generate a signature from your verified name.
              </p>
            </div>
            <ChevronDown
              className={`mt-1 h-5 w-5 shrink-0 text-[var(--zetrix-text-muted)] transition-transform duration-200 ${
                expanded === 'auto' ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className={`grid transition-all duration-200 ease-in-out ${
              expanded === 'auto' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="px-5 pb-5 pl-20">
                <Button size="sm" onClick={handleAutoGenerate}>
                  <Type className="mr-2 h-4 w-4" />
                  Generate Signature
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

        {/* Draw Signature Option */}
        <div
          className={`rounded-xl border bg-white transition-all ${
            expanded === 'drawn'
              ? 'border-primary/30 shadow-sm'
              : 'border-[var(--zetrix-border)] hover:border-primary/20 hover:shadow-sm'
          }`}
        >
          <button
            type="button"
            className="flex w-full items-start gap-4 p-5 text-left"
            onClick={() => toggleExpand('drawn')}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08]">
              <PenTool className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold tracking-tight text-[var(--zetrix-text)]">
                  Draw Signature
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold border-[var(--zetrix-border)] text-[var(--zetrix-text-muted)]">
                  Freehand
                </Badge>
              </div>
              <p className="mt-0.5 text-sm font-light text-[var(--zetrix-text-muted)]">
                Draw your signature using your mouse or touchscreen.
              </p>
            </div>
            <ChevronDown
              className={`mt-1 h-5 w-5 shrink-0 text-[var(--zetrix-text-muted)] transition-transform duration-200 ${
                expanded === 'drawn' ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className={`grid transition-all duration-200 ease-in-out ${
              expanded === 'drawn' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden">
              <div className="space-y-3 px-5 pb-5 pl-20">
                <div className="rounded-lg border border-[var(--zetrix-border)] bg-white">
                  <SignatureCanvas
                    ref={canvasRef}
                    canvasProps={{ className: 'w-full h-40', width: 600, height: 160 }}
                    penColor="black"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleClear} variant="outline" size="sm">
                    <Eraser className="mr-2 h-4 w-4" /> Clear
                  </Button>
                  <Button onClick={handleDrawnSave} size="sm">
                    <PenTool className="mr-2 h-4 w-4" /> Save Signature
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Preview */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            hasSignature ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <p className="mb-2 text-sm font-medium text-green-700">Signature Preview:</p>
              {hasSignature && (
                <img src={session.signatureImage} alt="Signature preview" className="max-h-24" />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>Back</Button>
          <Button onClick={nextStep} disabled={!hasSignature}>Continue</Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
