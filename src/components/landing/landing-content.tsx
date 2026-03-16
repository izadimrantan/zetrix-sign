'use client';

import { Upload, ShieldCheck, Link2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HeroBackground } from '@/components/landing/hero-background';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { trackLandingCTA } from '@/lib/analytics';

const features = [
  {
    icon: Upload,
    title: 'Simple Upload',
    description:
      'Drag and drop your PDF document to begin the signing process. We handle the cryptography, hashing, and blockchain anchoring automatically.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified Identity',
    description:
      'Connect your Zetrix wallet — browser extension or mobile app — to cryptographically prove your identity.',
  },
  {
    icon: Link2,
    title: 'Blockchain Secure',
    description:
      'Your document hash is permanently anchored on the Zetrix blockchain. Anyone can verify it — forever.',
  },
];

const steps = [
  { number: '1', title: 'Upload', description: 'Upload your PDF document to get started' },
  { number: '2', title: 'Connect', description: 'Link your Zetrix wallet and verify identity' },
  { number: '3', title: 'Sign', description: 'Create and place your digital signature' },
  { number: '4', title: 'Anchor', description: 'Hash is anchored permanently on-chain' },
];

function SectionLabel({ label, centered }: { label: string; centered?: boolean }) {
  return (
    <div className={`mb-4 flex items-center gap-2.5 ${centered ? 'justify-center' : ''}`}>
      <div className="h-px w-9 bg-primary" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
        {label}
      </span>
      {centered && <div className="h-px w-9 bg-primary" />}
    </div>
  );
}

export function LandingContent() {
  const featuresRef = useScrollReveal<HTMLDivElement>();
  const stepsRef = useScrollReveal<HTMLDivElement>();
  const ctaRef = useScrollReveal<HTMLDivElement>();

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative flex items-center overflow-hidden py-12 sm:py-16 lg:py-20">
        <HeroBackground />

        <div className="container relative z-10 mx-auto grid max-w-6xl gap-10 px-4 sm:gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Content */}
          <div className="text-center lg:text-left">
            <div
              className="mb-6 flex items-center justify-center gap-2.5 lg:justify-start"
              style={{ animation: 'fadeUp 0.8s ease both', animationDelay: '0.2s' }}
            >
              <div className="h-px w-9 bg-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                Blockchain Verified
              </span>
            </div>
            <h1
              className="text-4xl font-extrabold tracking-tight text-[var(--zetrix-text)] sm:text-5xl lg:text-6xl"
              style={{
                animation: 'fadeUp 0.8s ease both',
                animationDelay: '0.4s',
                lineHeight: '1.08',
              }}
            >
              Sign Documents
            </h1>
            <p
              className="mt-2 text-3xl font-light text-primary sm:text-4xl"
              style={{
                animation: 'fadeUp 0.8s ease both',
                animationDelay: '0.6s',
                lineHeight: '1.1',
              }}
            >
              with Confidence
            </p>
            <p
              className="mx-auto mt-6 max-w-md text-base font-light leading-relaxed text-[var(--zetrix-text-muted)] lg:mx-0"
              style={{ animation: 'fadeUp 0.8s ease both', animationDelay: '0.8s' }}
            >
              Tamper-proof digital signatures anchored on the Zetrix blockchain. Upload, sign, and
              verify — permanently secured on-chain.
            </p>
            <div
              className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start"
              style={{ animation: 'fadeUp 0.8s ease both', animationDelay: '1.0s' }}
            >
              <Link href="/sign" onClick={() => trackLandingCTA('upload_document')}>
                <Button
                  size="lg"
                  className="w-full shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 sm:w-auto"
                >
                  Upload Document to Start
                </Button>
              </Link>
              <Link href="/verify" onClick={() => trackLandingCTA('verify_document')}>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full transition-all hover:-translate-y-0.5 sm:w-auto"
                >
                  Verify a Document
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Sample card (hidden on mobile, shown on lg when grid is 2-col) */}
          <div className="hidden lg:block" style={{ animation: 'fadeUp 1s ease both', animationDelay: '0.6s' }}>
            <div className="relative overflow-hidden rounded-2xl border border-[var(--zetrix-border)] bg-white p-6 shadow-xl shadow-primary/[0.04]">
              {/* Top edge light line */}
              <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              <div className="mb-4 flex items-center justify-between border-b border-[var(--zetrix-border)] pb-4">
                <span className="text-[15px] font-bold text-[var(--zetrix-text)]">
                  Document Signed
                </span>
                <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                  Verified
                </span>
              </div>

              {[
                ['Document', 'Contract_v3.pdf'],
                ['Signer', 'John Tan'],
                ['Wallet', 'ZTX3Mf...wy8q44'],
                ['TX Hash', '7818869dc4...e486efd195'],
                ['Timestamp', '2026-03-16 03:23 UTC'],
              ].map(([label, value], i, arr) => (
                <div
                  key={label}
                  className={`flex justify-between py-2.5 text-sm ${
                    i < arr.length - 1 ? 'border-b border-[var(--zetrix-border)]/50' : ''
                  }`}
                >
                  <span className="text-[var(--zetrix-text-muted)]">{label}</span>
                  <span className="font-mono text-xs font-semibold text-[var(--zetrix-text)]">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-12 sm:py-20" ref={featuresRef}>
        <div className="container mx-auto max-w-5xl">
          <SectionLabel label="Features" />
          <h2 className="reveal mb-2 text-3xl font-extrabold tracking-tight text-[var(--zetrix-text)] sm:text-4xl">
            Why Zetrix Sign?
          </h2>
          <p className="reveal mb-10 max-w-lg text-base font-light text-[var(--zetrix-text-muted)]">
            Enterprise-grade document signing with blockchain-backed proof of authenticity.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="reveal group relative overflow-hidden rounded-2xl border border-[var(--zetrix-border)] bg-white p-6 transition-all duration-400 hover:-translate-y-1 hover:border-primary/[0.12] hover:shadow-lg hover:shadow-primary/[0.06]"
              >
                {/* Top edge light line (visible on hover) */}
                <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/[0.06]">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-base font-bold tracking-tight">{feature.title}</h3>
                <p className="text-sm font-light leading-relaxed text-[var(--zetrix-text-muted)]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-[var(--zetrix-bg2)] px-4 py-12 sm:py-20" ref={stepsRef}>
        <div className="container mx-auto max-w-5xl">
          <SectionLabel label="Process" />
          <h2 className="reveal mb-2 text-3xl font-extrabold tracking-tight text-[var(--zetrix-text)] sm:text-4xl">
            How It Works
          </h2>
          <p className="reveal mb-10 max-w-lg text-base font-light text-[var(--zetrix-text-muted)]">
            Four simple steps to a blockchain-verified signature.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="reveal group text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary text-base font-bold text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white">
                  {step.number}
                </div>
                <h3 className="mb-1 text-[15px] font-bold">{step.title}</h3>
                <p className="text-[13px] font-light leading-relaxed text-[var(--zetrix-text-muted)]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-4 py-12 sm:py-20" ref={ctaRef}>
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 50% 70% at center, rgba(123,30,30,0.04), transparent 70%)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-xl text-center">
          <SectionLabel label="Get Started" centered />
          <h2 className="reveal mb-4 text-3xl font-extrabold tracking-tight text-[var(--zetrix-text)] sm:text-4xl">
            Ready to Sign?
          </h2>
          <p className="reveal mb-8 text-base font-light text-[var(--zetrix-text-muted)]">
            Start securing your documents on the blockchain in minutes. No account needed — just
            your Zetrix wallet.
          </p>
          <div className="reveal flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/sign" onClick={() => trackLandingCTA('upload_document')}>
              <Button
                size="lg"
                className="w-full shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 sm:w-auto"
              >
                Upload Document
              </Button>
            </Link>
            <Link href="/verify" onClick={() => trackLandingCTA('verify_document')}>
              <Button
                size="lg"
                variant="outline"
                className="w-full transition-all hover:-translate-y-0.5 sm:w-auto"
              >
                Verify a Document
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
