'use client';

import { CheckCircle, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { truncateAddress, formatTimestamp } from '@/lib/utils';
import { trackExplorerLinkClick } from '@/lib/analytics';
import type { ValidationResult } from '@/types/contract';

interface Props {
  result: ValidationResult;
  documentHash: string;
  fileName: string;
}

function getResultDisplay(result: ValidationResult) {
  if (result.isValid) {
    return {
      icon: CheckCircle,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-50 border-green-200',
      badge: 'Valid',
      badgeVariant: 'default' as const,
      title: 'Document Verified',
      description: 'This document is authentic and has been cryptographically verified on the Zetrix blockchain.',
    };
  }

  if (result.reason?.includes('revoked')) {
    return {
      icon: AlertTriangle,
      iconColor: 'text-orange-500',
      bgColor: 'bg-orange-50 border-orange-200',
      badge: 'Revoked',
      badgeVariant: 'secondary' as const,
      title: 'Document Revoked',
      description: 'This document was previously valid but has been revoked by the original signer.',
    };
  }

  if (result.reason?.includes('No record')) {
    return {
      icon: XCircle,
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50 border-red-200',
      badge: 'Not Found',
      badgeVariant: 'destructive' as const,
      title: 'No Record Found',
      description: 'No blockchain record exists for this document. It may not have been signed with Zetrix Sign.',
    };
  }

  // Cryptographic verification failed
  return {
    icon: XCircle,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50 border-red-200',
    badge: 'Invalid',
    badgeVariant: 'destructive' as const,
    title: 'Verification Failed',
    description: 'Cryptographic verification failed. The document may have been tampered with.',
  };
}

export function VerifyResult({ result, documentHash, fileName }: Props) {
  const display = getResultDisplay(result);
  const Icon = display.icon;

  return (
    <div style={{ animation: 'fadeUp 0.4s ease both' }}>
    <Card className={`relative overflow-hidden border-[var(--zetrix-border)] shadow-sm border ${display.bgColor}`}>
      <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
      <CardHeader className="text-center">
        <Icon className={`mx-auto h-12 w-12 ${display.iconColor}`} />
        <div className="flex items-center justify-center gap-2">
          <CardTitle>{display.title}</CardTitle>
          <Badge variant={display.badgeVariant}>{display.badge}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{display.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">File</span>
          <span className="font-medium">{fileName}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Document Hash</span>
          <span className="font-mono text-xs">{truncateAddress(documentHash, 10, 10)}</span>
        </div>
        {result.isValid && (
          <>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Signer</span>
              <span className="font-mono text-xs">{truncateAddress(result.signerAddress || '', 10, 8)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Credential ID</span>
              <span className="font-mono text-xs">{result.credentialID}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Signed At</span>
              <span>{result.timestamp ? formatTimestamp(result.timestamp) : 'Unknown'}</span>
            </div>
            {result.txHash && (
              <>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Transaction Hash</span>
                  <span className="font-mono text-xs">{truncateAddress(result.txHash, 10, 10)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Explorer</span>
                  <a
                    href={`${process.env.NEXT_PUBLIC_ZETRIX_EXPLORER_URL}/tx/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={() => trackExplorerLinkClick(result.txHash!)}
                  >
                    View on Zetrix Explorer
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
