'use client';

import { useEffect, useState } from 'react';
import { Smartphone, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
// import { ExtensionConnect } from './extension-connect';
import { MobileConnect } from './mobile-connect';
// import { isExtensionAvailable } from '@/lib/wallet';
import type { WalletConnectResult } from '@/types/wallet';

/* ------------------------------------------------------------------ */
/* Browser Extension support is temporarily paused.                    */
/* See vibecode/DECISIONS.md (2026-04-04) for rationale.              */
/* When re-enabling:                                                   */
/*   1. Uncomment the extension imports above                          */
/*   2. Restore the accordion UI with both options                     */
/*   3. Remove the isMobile passthrough                                */
/* ------------------------------------------------------------------ */

interface Props {
  onConnected: (result: WalletConnectResult) => void;
  isMobile: boolean;
}

export function WalletConnector({ onConnected, isMobile }: Props) {
  return (
    <div className="space-y-1">
      {/* Header */}
      <h3 className="text-lg font-bold tracking-tight text-[var(--zetrix-text)]">
        Connect Your Wallet
      </h3>
      <p className="text-sm font-light text-[var(--zetrix-text-muted)]">
        Connect your Zetrix Wallet to authenticate and sign the document.
      </p>

      {/* MyID Wallet Option — single card, no accordion */}
      <div className="mt-5 rounded-xl border border-primary/30 bg-white shadow-sm">
        <div className="flex items-start gap-3 p-4 sm:gap-4 sm:p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] sm:h-11 sm:w-11">
            {isMobile ? (
              <ShieldCheck className="h-5 w-5 text-primary" />
            ) : (
              <Smartphone className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-sm font-bold tracking-tight text-[var(--zetrix-text)] sm:text-[15px]">
                MyID Wallet
              </span>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold border-[var(--zetrix-border)] text-[var(--zetrix-text-muted)]"
              >
                {isMobile ? 'Deeplink' : 'QR Code'}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs font-light text-[var(--zetrix-text-muted)] sm:text-sm">
              {isMobile
                ? 'Connect directly using the MyID app on your device.'
                : 'Scan a QR code with the MyID app to connect.'}
            </p>
          </div>
        </div>
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 sm:pl-[76px]">
          <MobileConnect onConnected={onConnected} inline isMobile={isMobile} />
        </div>
      </div>
    </div>
  );
}
