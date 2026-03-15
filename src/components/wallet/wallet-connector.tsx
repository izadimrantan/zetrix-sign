'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExtensionConnect } from './extension-connect';
import type { WalletConnectResult } from '@/types/wallet';

interface Props {
  onConnected: (result: WalletConnectResult) => void;
}

export function WalletConnector({ onConnected }: Props) {
  return (
    <Tabs defaultValue="extension">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="extension">Browser Extension</TabsTrigger>
        <TabsTrigger value="mobile" disabled className="opacity-50">
          Mobile Wallet
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Coming soon
          </span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="extension">
        <ExtensionConnect onConnected={onConnected} />
      </TabsContent>
    </Tabs>
  );
}
