'use client';

import dynamic from 'next/dynamic';

// Dynamic import to prevent SSR of client-only components (react-signature-canvas, react-pdf)
const SigningStepper = dynamic(
  () => import('@/components/signing/signing-stepper').then((mod) => mod.SigningStepper),
  { ssr: false }
);

export default function SignPage() {
  return <SigningStepper />;
}
