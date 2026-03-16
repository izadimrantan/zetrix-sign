'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { connectMobile, disconnectMobile } from '@/lib/wallet';
import type { WalletConnectResult } from '@/types/wallet';

interface Props {
  onConnected: (result: WalletConnectResult) => void;
  inline?: boolean;
}

export function MobileConnect({ onConnected, inline }: Props) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'scanning' | 'error'>('idle');
  const [qrData, setQrData] = useState('');
  const [error, setError] = useState('');
  const connectingRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectingRef.current) {
        disconnectMobile();
      }
    };
  }, []);

  const handleConnect = async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;

    setStatus('connecting');
    setQrData('');
    setError('');

    try {
      const result = await connectMobile((qrContent) => {
        console.log('[MobileConnect] QR data received, length:', qrContent.length);
        setQrData(qrContent);
        setStatus('scanning');
      });

      connectingRef.current = false;
      onConnected(result);
    } catch (err) {
      connectingRef.current = false;
      const msg = err instanceof Error ? err.message : 'Mobile wallet connection failed';
      console.error('[MobileConnect] Error:', msg);
      setError(msg);
      setStatus('error');
    }
  };

  const handleCancel = () => {
    connectingRef.current = false;
    disconnectMobile();
    setQrData('');
    setStatus('idle');
    setError('');
  };

  if (status === 'idle') {
    if (inline) {
      return (
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={handleConnect}>
            <Smartphone className="mr-2 h-4 w-4" />
            Generate QR Code
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Smartphone className="h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">
          Scan a QR code with the Zetrix mobile app to connect.
        </p>
        <Button onClick={handleConnect}>Generate QR Code</Button>
      </div>
    );
  }

  if (status === 'connecting' && !qrData) {
    if (inline) {
      return (
        <div className="flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Connecting...</span>
          <Button variant="ghost" size="sm" onClick={handleCancel}>Cancel</Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating QR code...</p>
        <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
      </div>
    );
  }

  if (status === 'error') {
    if (inline) {
      return (
        <div className="flex items-center gap-3">
          <span className="text-xs text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={handleConnect}>Try Again</Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={handleConnect}>Try Again</Button>
      </div>
    );
  }

  // Scanning state — show QR code
  return (
    <div className={inline ? "mt-2 space-y-3" : "flex flex-col items-center gap-4 py-6"}>
      <p className={inline ? "text-xs font-medium text-[var(--zetrix-text)]" : "text-sm font-medium"}>
        Scan with Zetrix App
      </p>
      {!inline && (
        <p className="text-xs text-muted-foreground text-center max-w-[280px]">
          Open the Zetrix mobile app and scan this QR code to connect your wallet.
        </p>
      )}
      {qrData && (
        <div className={inline ? "rounded-xl border border-[var(--zetrix-border)] bg-white p-3 w-fit" : "rounded-xl border bg-white p-4"}>
          <QRCodeSVG value={qrData} size={inline ? 180 : 220} level="M" />
        </div>
      )}
      {/* Debug: show raw QR data */}
      {qrData && (
        <p className="max-w-[300px] break-all text-[10px] text-muted-foreground/50">
          {qrData}
        </p>
      )}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <p className="text-xs">Waiting for wallet response...</p>
      </div>
      <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
    </div>
  );
}
