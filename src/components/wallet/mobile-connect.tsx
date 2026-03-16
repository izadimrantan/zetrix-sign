'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Smartphone } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { connectMobile, disconnectMobile } from '@/lib/wallet';
import type { WalletConnectResult } from '@/types/wallet';

interface Props {
  onConnected: (result: WalletConnectResult) => void;
}

export function MobileConnect({ onConnected }: Props) {
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
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating QR code...</p>
        <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={handleConnect}>Try Again</Button>
      </div>
    );
  }

  // Scanning state — show QR code
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <p className="text-sm font-medium">Scan with Zetrix App</p>
      <p className="text-xs text-muted-foreground text-center max-w-[280px]">
        Open the Zetrix mobile app and scan this QR code to connect your wallet.
      </p>
      {qrData && (
        <div className="rounded-xl border bg-white p-4">
          <QRCodeSVG value={qrData} size={220} level="M" />
        </div>
      )}
      {/* Debug: show raw QR data like reference implementation */}
      {qrData && (
        <p className="max-w-[300px] break-all text-center text-[10px] text-muted-foreground/50">
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
