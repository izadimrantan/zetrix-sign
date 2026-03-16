'use client';

import { useState } from 'react';
import { Monitor, Smartphone, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ExtensionConnect } from './extension-connect';
import { MobileConnect } from './mobile-connect';
import { isExtensionAvailable } from '@/lib/wallet';
import type { WalletConnectResult } from '@/types/wallet';

interface Props {
  onConnected: (result: WalletConnectResult) => void;
}

export function WalletConnector({ onConnected }: Props) {
  const extensionDetected = isExtensionAvailable();
  const [expanded, setExpanded] = useState<'extension' | 'mobile' | null>(null);

  const toggleExpand = (option: 'extension' | 'mobile') => {
    setExpanded(prev => prev === option ? null : option);
  };

  return (
    <div className="space-y-1">
      {/* Header */}
      <h3 className="text-lg font-bold tracking-tight text-[var(--zetrix-text)]">
        Connect Your Wallet
      </h3>
      <p className="text-sm font-light text-[var(--zetrix-text-muted)]">
        Connect your Zetrix Wallet to authenticate and sign the document. Select an option below.
      </p>

      {/* Browser Extension Option */}
      <div
        className={`mt-5 rounded-xl border bg-white transition-all ${
          expanded === 'extension'
            ? 'border-primary/30 shadow-sm'
            : 'border-[var(--zetrix-border)] hover:border-primary/20 hover:shadow-sm'
        }`}
      >
        <button
          type="button"
          className="flex w-full items-start gap-4 p-5 text-left"
          onClick={() => toggleExpand('extension')}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08]">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold tracking-tight text-[var(--zetrix-text)]">
                Browser Extension
              </span>
              {extensionDetected && (
                <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] font-semibold hover:bg-green-50">
                  Detected
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm font-light text-[var(--zetrix-text-muted)]">
              Connect using the Zetrix Wallet Chrome extension.
            </p>
          </div>
          <ChevronDown
            className={`mt-1 h-5 w-5 shrink-0 text-[var(--zetrix-text-muted)] transition-transform duration-200 ${
              expanded === 'extension' ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div
          className={`grid transition-all duration-200 ease-in-out ${
            expanded === 'extension' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-5 pl-20">
              <ExtensionConnect onConnected={onConnected} inline />
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

      {/* Mobile Wallet Option */}
      <div
        className={`rounded-xl border bg-white transition-all ${
          expanded === 'mobile'
            ? 'border-primary/30 shadow-sm'
            : 'border-[var(--zetrix-border)] hover:border-primary/20 hover:shadow-sm'
        }`}
      >
        <button
          type="button"
          className="flex w-full items-start gap-4 p-5 text-left"
          onClick={() => toggleExpand('mobile')}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08]">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-bold tracking-tight text-[var(--zetrix-text)]">
                Mobile Wallet
              </span>
              <Badge variant="outline" className="text-[10px] font-semibold border-[var(--zetrix-border)] text-[var(--zetrix-text-muted)]">
                QR Code
              </Badge>
            </div>
            <p className="mt-0.5 text-sm font-light text-[var(--zetrix-text-muted)]">
              Scan a QR code with the Zetrix mobile app to connect.
            </p>
          </div>
          <ChevronDown
            className={`mt-1 h-5 w-5 shrink-0 text-[var(--zetrix-text-muted)] transition-transform duration-200 ${
              expanded === 'mobile' ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div
          className={`grid transition-all duration-200 ease-in-out ${
            expanded === 'mobile' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-5 pl-20">
              <MobileConnect onConnected={onConnected} inline />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
