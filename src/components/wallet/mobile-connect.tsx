'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, QrCode } from 'lucide-react';
import { connectMobile } from '@/lib/wallet';
import type { WalletConnectResult } from '@/types/wallet';

interface Props {
  onConnected: (result: WalletConnectResult) => void;
}

export function MobileConnect({ onConnected }: Props) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [qrData, setQrData] = useState('');
  const [error, setError] = useState('');
  const initiated = useRef(false);

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    const connect = async () => {
      try {
        const result = await connectMobile((qr) => {
          setQrData(qr);
          setStatus('ready');
        });
        onConnected(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
        setStatus('error');
      }
    };
    connect();
  }, [onConnected]);

  if (status === 'loading' && !qrData) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating QR code...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <QrCode className="h-6 w-6 text-primary" />
      <p className="text-sm text-muted-foreground">Scan with Zetrix mobile app</p>
      {qrData && (
        <div className="rounded-lg border p-4">
          {/* QR code is rendered by SDK or we show the data for a QR library */}
          <div id="zetrix-qr-container" className="min-h-[200px] min-w-[200px]" />
        </div>
      )}
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <p className="text-xs text-muted-foreground">Waiting for wallet connection...</p>
    </div>
  );
}
