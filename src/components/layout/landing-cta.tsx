'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { trackLandingCTA } from '@/lib/analytics';

export function LandingCTA() {
  return (
    <div className="flex gap-4">
      <Link href="/sign" onClick={() => trackLandingCTA('upload_document')}>
        <Button size="lg">Upload Document to Start</Button>
      </Link>
      <Link href="/verify" onClick={() => trackLandingCTA('verify_document')}>
        <Button size="lg" variant="outline">Verify a Document</Button>
      </Link>
    </div>
  );
}
