'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExtensionConnect } from './extension-connect';
import { MobileConnect } from './mobile-connect';
import type { WalletConnectResult } from '@/types/wallet';

interface Props {
  onConnected: (result: WalletConnectResult) => void;
}

export function WalletConnector({ onConnected }: Props) {
  return (
    <Tabs defaultValue="extension">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="extension">Browser Extension</TabsTrigger>
        <TabsTrigger value="mobile">Mobile Wallet</TabsTrigger>
      </TabsList>
      <TabsContent value="extension">
        <ExtensionConnect onConnected={onConnected} />
      </TabsContent>
      <TabsContent value="mobile">
        <MobileConnect onConnected={onConnected} />
      </TabsContent>
    </Tabs>
  );
}
