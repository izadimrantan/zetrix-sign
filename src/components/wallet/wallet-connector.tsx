'use client';

import { Monitor, Smartphone } from 'lucide-react';
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

  return (
    <div className="space-y-1">
      {/* Header */}
      <h3 className="text-lg font-bold tracking-tight text-[var(--zetrix-text)]">
        Connect Your Wallet
      </h3>
      <p className="text-sm font-light text-[var(--zetrix-text-muted)]">
        Connect your Zetrix Wallet to authenticate and sign the document. Choose your preferred connection method.
      </p>

      {/* Browser Extension Option */}
      <div className="mt-5 rounded-xl border border-[var(--zetrix-border)] bg-white p-5 transition-all hover:border-primary/20 hover:shadow-sm">
        <div className="flex items-start gap-4">
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
            <div className="mt-3">
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
      <div className="rounded-xl border border-[var(--zetrix-border)] bg-white p-5 transition-all hover:border-primary/20 hover:shadow-sm">
        <div className="flex items-start gap-4">
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
            <div className="mt-3">
              <MobileConnect onConnected={onConnected} inline />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
