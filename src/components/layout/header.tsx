'use client';

import Link from 'next/link';
import { FileSignature } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackNavClick } from '@/lib/analytics';

export function Header() {
  const handleVerifyClick = (e: React.MouseEvent) => {
    e.preventDefault();
    trackNavClick('verify');
    // Use window.location to force a full page load, ensuring
    // query params are cleared and verify page state resets
    window.location.href = '/verify';
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => trackNavClick('home')}>
          <FileSignature className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-primary">Zetrix Sign</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/sign" onClick={() => trackNavClick('sign')}>
            <Button variant="default" size="sm">Sign Document</Button>
          </Link>
          <a href="/verify" onClick={handleVerifyClick}>
            <Button variant="outline" size="sm">Verify</Button>
          </a>
        </nav>
      </div>
    </header>
  );
}
