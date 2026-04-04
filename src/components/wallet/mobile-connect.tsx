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
  isMobile?: boolean;
}

export function MobileConnect({ onConnected, inline, isMobile }: Props) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'scanning' | 'error'>('idle');
  const [qrData, setQrData] = useState('');
  const [error, setError] = useState('');
  const connectingRef = useRef(false);

  // On mobile: SDK gives us QR data (rms&sessionId&type) via callback,
  // then we convert it to a deeplink URL so MyID gets the rms token
  // it needs to join the bridge room and show the connection popup.
  const deeplinkFiredRef = useRef(false);

  useEffect(() => {
    if (isMobile && qrData && status === 'scanning' && !deeplinkFiredRef.current) {
      deeplinkFiredRef.current = true;

      // QR data format: "rms&sessionId&type" e.g. "abc123&uuid&H5_bind"
      const parts = qrData.split('&');
      const rms = parts[0] || '';
      const sessionId = parts[1] || '';
      const type = parts[2] || 'H5_bind';

      // Determine scheme: myid-uat (testnet) or myid (production)
      const bridge = process.env.NEXT_PUBLIC_ZETRIX_BRIDGE || '';
      const isTestnet = bridge.includes('test-');
      const scheme = isTestnet ? 'myid-uat' : 'myid';
      const host = window.location.protocol + '//' + window.location.host;

      // Construct deeplink with rms token — same data MyID gets from QR scan
      const params = new URLSearchParams({
        linkTo: type,
        type: type,
        rms: rms,
        sessionId: sessionId,
        host: host,
        source: 'mobile',
      });

      const deeplink = `${scheme}://myid.com/app/flutter?${params.toString()}`;
      console.log('[MobileConnect] Deeplink:', deeplink);
      window.location.href = deeplink;
    }
  }, [isMobile, qrData, status]);

  // Reset deeplink guard when going back to idle
  useEffect(() => {
    if (status === 'idle') {
      deeplinkFiredRef.current = false;
    }
  }, [status]);

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
      // Both mobile & desktop use qrcode=true so H5_put is sent (gets rms token).
      // Desktop: renders QR. Mobile: converts QR data to deeplink (via useEffect).
      const result = await connectMobile(!!isMobile, (qrContent) => {
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

  /* ---- Idle ---- */
  if (status === 'idle') {
    if (inline) {
      return (
        <div className="animate-in fade-in duration-300">
          <Button size="sm" variant="outline" onClick={handleConnect}>
            <Smartphone className="mr-2 h-4 w-4" />
            {isMobile ? 'Connect using MyID' : 'Generate QR Code for MyID'}
          </Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-8 animate-in fade-in duration-300">
        <Smartphone className="h-10 w-10 text-primary" />
        <p className="text-sm text-muted-foreground">
          {isMobile
            ? 'Connect directly using the MyID app on your device.'
            : 'Scan a QR code with the MyID app to connect.'}
        </p>
        <Button onClick={handleConnect}>
          {isMobile ? 'Connect using MyID' : 'Generate QR Code for MyID'}
        </Button>
      </div>
    );
  }

  /* ---- Connecting (spinner) ---- */
  if (status === 'connecting' && !qrData) {
    if (inline) {
      return (
        <div className="flex items-center gap-3 animate-in fade-in duration-300">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            {isMobile ? 'Connecting to MyID...' : 'Generating QR code...'}
          </span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-8 animate-in fade-in duration-300">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {isMobile ? 'Connecting to MyID...' : 'Generating QR code...'}
        </p>
        <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
      </div>
    );
  }

  /* ---- Error ---- */
  if (status === 'error') {
    if (inline) {
      return (
        <div className="flex items-center gap-3 animate-in fade-in duration-300">
          <span className="text-xs text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={handleConnect}>Try Again</Button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-4 py-8 animate-in fade-in duration-300">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={handleConnect}>Try Again</Button>
      </div>
    );
  }

  /* ---- Scanning: desktop = QR, mobile = waiting (auto-deeplinked) ---- */
  if (isMobile) {
    return (
      <div className={`animate-in fade-in slide-in-from-bottom-2 duration-400 ${inline ? 'mt-2' : 'flex flex-col items-center gap-4 py-6'}`}>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <p className="text-xs">Waiting for MyID response...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`animate-in fade-in slide-in-from-bottom-2 duration-400 ${inline ? 'mt-2 space-y-3' : 'flex flex-col items-center gap-4 py-6'}`}>
      <p className={inline ? 'text-xs font-medium text-[var(--zetrix-text)]' : 'text-sm font-medium'}>
        Scan with MyID App
      </p>
      {!inline && (
        <p className="text-xs text-muted-foreground text-center max-w-[280px]">
          Open the MyID app and scan this QR code to connect your wallet.
        </p>
      )}
      {qrData && (
        <div className={`animate-in fade-in zoom-in-95 duration-300 ${inline ? 'rounded-xl border border-[var(--zetrix-border)] bg-white p-3 w-fit' : 'rounded-xl border bg-white p-4'}`}>
          <QRCodeSVG value={qrData} size={inline ? 180 : 220} level="M" />
        </div>
      )}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <p className="text-xs">Waiting for MyID response...</p>
      </div>
      <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
    </div>
  );
}
