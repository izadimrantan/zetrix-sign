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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--zetrix-border)] bg-[var(--zetrix-bg)]/90 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--zetrix-bg)]/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => trackNavClick('home')}>
          <FileSignature className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight text-primary">Zetrix Sign</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <a href="/sign" onClick={(e) => {
            e.preventDefault();
            trackNavClick('sign');
            window.location.href = '/sign';
          }}>
            <Button variant="default" size="sm" className="text-xs sm:text-sm">Sign Document</Button>
          </a>
          <a href="/verify" onClick={handleVerifyClick}>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm">Verify</Button>
          </a>
        </nav>
      </div>
    </header>
  );
}
