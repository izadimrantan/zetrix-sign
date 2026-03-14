'use client';

import { useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { isExtensionAvailable, connectExtension } from '@/lib/wallet';
import { trackWalletConnectStart, trackWalletConnectSuccess, trackWalletConnectError } from '@/lib/analytics';
import type { WalletConnectResult } from '@/types/wallet';

interface Props {
  onConnected: (result: WalletConnectResult) => void;
}

export function ExtensionConnect({ onConnected }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const available = isExtensionAvailable();

  const handleConnect = async () => {
    setStatus('loading');
    setError('');
    trackWalletConnectStart('extension');
    try {
      const result = await connectExtension();
      trackWalletConnectSuccess('extension', result.address);
      onConnected(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      trackWalletConnectError('extension', msg);
      setError(msg);
      setStatus('error');
    }
  };

  if (!available) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Zetrix wallet extension not detected.</p>
        <a
          href="https://chromewebstore.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: 'outline' })}
        >
          Install Extension
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Button onClick={handleConnect} disabled={status === 'loading'}>
        {status === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Connect Extension
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
