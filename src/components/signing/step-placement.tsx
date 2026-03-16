'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PdfViewer } from '@/components/pdf/pdf-viewer';
import { SignatureOverlay } from '@/components/pdf/signature-overlay';
import { toast } from 'sonner';
import { trackSignatureMoved } from '@/lib/analytics';
import type { SigningSession, SignaturePosition } from '@/types/signing';

interface StepProps {
  session: SigningSession;
  updateSession: (partial: Partial<SigningSession>) => void;
  nextStep: () => void;
  prevStep: () => void;
}

const PDF_WIDTH = 600;
const PDF_HEIGHT = 800; // Approximate, will adjust

export function StepPlacement({ session, updateSession, nextStep, prevStep }: StepProps) {
  const [currentPage, setCurrentPage] = useState(session.signaturePosition?.page ?? 0);

  useEffect(() => {
    toast.info('Drag the signature box to reposition it on the document.', { duration: 4000 });
  }, []);

  const handlePositionChange = (position: SignaturePosition) => {
    updateSession({ signaturePosition: position });
    trackSignatureMoved();
  };

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
    <Card className="relative overflow-hidden border-[var(--zetrix-border)] shadow-sm">
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <CardHeader>
        <CardTitle>Place Signature on Document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Drag your signature to position it on the document.
        </p>

        {session.pdfFile && (
          <div className="flex justify-center">
            <PdfViewer
              file={session.pdfFile}
              pageCount={session.pdfPageCount}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              width={PDF_WIDTH}
            >
              <SignatureOverlay
                signatureImage={session.signatureImage}
                position={session.signaturePosition}
                onPositionChange={handlePositionChange}
                containerWidth={PDF_WIDTH}
                containerHeight={PDF_HEIGHT}
                currentPage={currentPage}
              />
            </PdfViewer>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>Back</Button>
          <Button onClick={nextStep} disabled={!session.signaturePosition}>Continue</Button>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
