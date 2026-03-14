'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { truncateAddress } from '@/lib/utils';
import type { SigningSession } from '@/types/signing';

interface StepProps {
  session: SigningSession;
  updateSession: (partial: Partial<SigningSession>) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetSession: () => void;
  signedPdfBytesRef: React.MutableRefObject<Uint8Array | null>;
}

export function StepComplete({ session, resetSession, signedPdfBytesRef }: StepProps) {
  const handleDownload = useCallback(() => {
    const bytes = signedPdfBytesRef.current;
    if (!bytes) {
      alert('Signed PDF is no longer in memory. Please sign the document again.');
      return;
    }
    // Create a blob from the exact bytes that were hashed and anchored on-chain
    const blob = new Blob([new Uint8Array(bytes) as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = session.pdfFile?.name?.replace('.pdf', '-signed.pdf') || 'signed-document.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [signedPdfBytesRef, session.pdfFile?.name]);

  return (
    <Card>
      <CardHeader className="text-center">
        <CheckCircle className="mx-auto mb-2 h-16 w-16 text-green-500" />
        <CardTitle className="text-2xl">Document Signed Successfully!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Document</span>
            <span className="font-medium">{session.pdfFile?.name}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Signer</span>
            <span>{session.signerName}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Wallet</span>
            <span className="font-mono text-xs">{truncateAddress(session.walletAddress)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Document Hash</span>
            <span className="font-mono text-xs">{truncateAddress(session.documentHash, 10, 10)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">TX Hash</span>
            <span className="font-mono text-xs">{truncateAddress(session.txHash, 10, 10)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Timestamp</span>
            <span>{session.timestamp}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" /> Download Signed PDF
          </Button>
          <Link href={`/verify?hash=${session.documentHash}&file=${encodeURIComponent(session.pdfFile?.name || '')}`} className="flex-1">
            <Button variant="outline" className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" /> Verify On Chain
            </Button>
          </Link>
        </div>

        <div className="text-center">
          <Button variant="ghost" onClick={resetSession}>Sign Another Document</Button>
        </div>
      </CardContent>
    </Card>
  );
}
