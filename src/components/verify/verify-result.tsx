'use client';

import { CheckCircle, XCircle, AlertTriangle, ExternalLink, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { truncateAddress, formatTimestamp } from '@/lib/utils';
import { trackExplorerLinkClick } from '@/lib/analytics';
import type { ValidationResult } from '@/types/contract';

interface CmsInfo {
  hasCmsSignature: boolean;
  subFilter?: string;
  signerName?: string;
  reason?: string;
  location?: string;
  signatureStandard?: string;
}

interface Props {
  result: ValidationResult;
  documentHash: string;
  fileName: string;
  cmsInfo?: CmsInfo;
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

export function VerifyResult({ result, documentHash, fileName, cmsInfo }: Props) {
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
        <div className="flex justify-between gap-4 text-sm">
          <span className="shrink-0 text-muted-foreground">File</span>
          <span className="text-right font-medium">{fileName}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Document Hash</span>
          <span className="font-mono">{truncateAddress(documentHash, 10, 10)}</span>
        </div>
        {result.isValid && (
          <>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Signer</span>
              <span className="font-mono">{truncateAddress(result.signerAddress || '', 10, 8)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Credential ID</span>
              <span className="font-mono">{result.credentialID}</span>
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
                  <span className="font-mono">{truncateAddress(result.txHash, 10, 10)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Explorer</span>
                  <a
                    href={`${process.env.NEXT_PUBLIC_ZETRIX_EXPLORER_URL}/tx/${result.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
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

        {/* CMS/PKCS#7 Signature Info */}
        {cmsInfo?.hasCmsSignature && (
          <>
            <Separator className="my-2" />
            <div className="flex items-center gap-2 pt-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-[var(--zetrix-text)]">Digital Signature</span>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold hover:bg-primary/10">
                CMS/PKCS#7
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Standard</span>
              <span>{cmsInfo.subFilter || 'adbe.pkcs7.detached'}</span>
            </div>
            {cmsInfo.signerName && (
              <>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Signed By</span>
                  <span>{cmsInfo.signerName}</span>
                </div>
              </>
            )}
            {cmsInfo.location && (
              <>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Location</span>
                  <span>{cmsInfo.location}</span>
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
