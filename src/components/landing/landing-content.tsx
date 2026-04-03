'use client';

import { Upload, ShieldCheck, Link2, Fingerprint, FileCheck, BadgeCheck, Scan, PenTool, Anchor, Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HeroBackground } from '@/components/landing/hero-background';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { trackLandingCTA } from '@/lib/analytics';

const features = [
  {
    icon: Fingerprint,
    title: 'Verifiable Identity',
    description:
      'Prove who you are using government-issued digital credentials from your MyID wallet — no copies of your IC or passport needed. Only the claims you approve are shared.',
  },
  {
    icon: FileCheck,
    title: 'Standards-Compliant Signatures',
    description:
      'Documents are signed with CMS/PKCS#7 digital signatures — the same standard recognized by Adobe Acrobat and Foxit Reader. Tamper detection is built in.',
  },
  {
    icon: Link2,
    title: 'Blockchain Anchored',
    description:
      'Every signed document is permanently anchored on the Zetrix blockchain. Anyone can independently verify its authenticity — forever.',
  },
];

const steps = [
  { number: '1', icon: Upload, title: 'Upload', description: 'Upload your PDF document to begin the signing process' },
  { number: '2', icon: Scan, title: 'Verify Identity', description: 'Scan the QR code with your MyID app and approve credential sharing' },
  { number: '3', icon: PenTool, title: 'Sign', description: 'Create your digital signature and place it on the document' },
  { number: '4', icon: Anchor, title: 'Anchor', description: 'Your signed document is permanently anchored on-chain' },
];

const trustPoints = [
  {
    icon: BadgeCheck,
    title: 'Verifiable Credentials',
    description:
      'Your identity is verified through cryptographic credentials issued by trusted authorities and stored in your MyID wallet. No personal data is stored on our servers — only a yes/no verification result and the claims you choose to share.',
  },
  {
    icon: FileCheck,
    title: 'CMS/PKCS#7 Digital Signatures',
    description:
      'Every document receives an industry-standard digital signature embedded directly in the PDF. Open it in any PDF reader to see the signature panel, signer identity, and tamper detection — no special software required.',
  },
  {
    icon: Search,
    title: 'Document Verification',
    description:
      'Anyone with the signed PDF can verify its authenticity. Upload it to our verification page to check the blockchain record, confirm the signer\'s identity, and detect any modifications made after signing.',
  },
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
  const trustRef = useScrollReveal<HTMLDivElement>();
  const partnerRef = useScrollReveal<HTMLDivElement>();
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
                Identity-Verified Digital Signatures
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
              with Verified Identity
            </p>
            <p
              className="mx-auto mt-6 max-w-md text-base font-light leading-relaxed text-[var(--zetrix-text-muted)] lg:mx-0"
              style={{ animation: 'fadeUp 0.8s ease both', animationDelay: '0.8s' }}
            >
              Prove your identity with your{' '}
              <strong className="font-medium text-[var(--zetrix-text)]">MyID</strong> digital
              credentials, sign with industry-standard CMS/PKCS#7 signatures, and anchor the proof
              permanently on the Zetrix blockchain.
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

          {/* Right: Sample card */}
          <div className="hidden lg:block" style={{ animation: 'fadeUp 1s ease both', animationDelay: '0.6s' }}>
            <div className="relative overflow-hidden rounded-2xl border border-[var(--zetrix-border)] bg-white p-6 shadow-xl shadow-primary/[0.04]">
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
                ['Document', 'Agreement_v2.pdf'],
                ['Signer', 'Ahmad bin Ali'],
                ['Identity', 'MyKad (Verified via MyID)'],
                ['Signature', 'CMS/PKCS#7 (Valid)'],
                ['TX Hash', '7818869dc4...e486efd195'],
                ['Anchored', '2026-04-04 10:15 UTC'],
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
            Enterprise-grade document signing backed by verifiable credentials, cryptographic
            signatures, and blockchain proof.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="reveal group relative overflow-hidden rounded-2xl border border-[var(--zetrix-border)] bg-white p-6 transition-all duration-400 hover:-translate-y-1 hover:border-primary/[0.12] hover:shadow-lg hover:shadow-primary/[0.06]"
              >
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
            Four simple steps to a blockchain-verified, identity-backed signature.
          </p>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="reveal group text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-primary/20 bg-primary/[0.04] transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:shadow-md group-hover:shadow-primary/20">
                  <step.icon className="h-6 w-6 text-primary transition-colors group-hover:text-white" />
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

      {/* Trust & Technology Section */}
      <section className="px-4 py-12 sm:py-20" ref={trustRef}>
        <div className="container mx-auto max-w-5xl">
          <SectionLabel label="Technology" />
          <h2 className="reveal mb-2 text-3xl font-extrabold tracking-tight text-[var(--zetrix-text)] sm:text-4xl">
            Built on Open Standards
          </h2>
          <p className="reveal mb-10 max-w-lg text-base font-light text-[var(--zetrix-text-muted)]">
            Every layer of Zetrix Sign uses internationally recognized standards — from identity
            verification to digital signatures to on-chain anchoring.
          </p>

          <div className="space-y-6">
            {trustPoints.map((point, i) => (
              <div
                key={point.title}
                className="reveal group relative overflow-hidden rounded-2xl border border-[var(--zetrix-border)] bg-white transition-all duration-300 hover:border-primary/[0.12] hover:shadow-md hover:shadow-primary/[0.04]"
              >
                <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                <div className="flex items-start gap-4 p-5 sm:gap-5 sm:p-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/[0.06] sm:h-12 sm:w-12">
                    <point.icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-[15px] font-bold tracking-tight text-[var(--zetrix-text)]">
                        {point.title}
                      </h3>
                      {i === 0 && (
                        <span className="rounded-full bg-primary/[0.07] px-2 py-0.5 text-[10px] font-semibold text-primary">
                          OID4VP
                        </span>
                      )}
                      {i === 1 && (
                        <span className="rounded-full bg-primary/[0.07] px-2 py-0.5 text-[10px] font-semibold text-primary">
                          RFC 5652
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-light leading-relaxed text-[var(--zetrix-text-muted)]">
                      {point.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MyID Partnership Section */}
      <section className="bg-[var(--zetrix-bg2)] px-4 py-12 sm:py-20" ref={partnerRef}>
        <div className="container mx-auto max-w-4xl">
          <div className="reveal text-center">
            <SectionLabel label="Powered By" centered />
            <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-[var(--zetrix-text)] sm:text-4xl">
              Identity Verification with MyID
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-base font-light leading-relaxed text-[var(--zetrix-text-muted)]">
              Zetrix Sign exclusively uses{' '}
              <strong className="font-medium text-[var(--zetrix-text)]">MyID</strong> — a digital
              identity wallet developed in partnership with{' '}
              <strong className="font-medium text-[var(--zetrix-text)]">MIMOS</strong>, Malaysia's
              national applied research centre. MyID stores government-issued Verifiable Credentials
              such as MyKad and Passport, allowing you to prove your identity without sharing
              copies of your physical documents.
            </p>
          </div>

          <div className="reveal grid gap-5 sm:grid-cols-3">
            {[
              {
                title: 'Privacy-Preserving',
                desc: 'Only the specific claims you approve are shared. Your full IC details stay in your wallet.',
              },
              {
                title: 'Cryptographically Verified',
                desc: 'Credentials are signed by trusted issuers using BBS+ signatures and verified via zero-knowledge proofs.',
              },
              {
                title: 'Government-Grade',
                desc: 'Built on W3C Verifiable Credentials and OpenID for Verifiable Presentations (OID4VP) standards.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[var(--zetrix-border)] bg-white p-5 text-center"
              >
                <h3 className="mb-1.5 text-[14px] font-bold tracking-tight text-[var(--zetrix-text)]">
                  {item.title}
                </h3>
                <p className="text-[13px] font-light leading-relaxed text-[var(--zetrix-text-muted)]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="reveal mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href={process.env.NEXT_PUBLIC_MYID_ANDROID_URL || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--zetrix-border)] bg-white px-4 py-2 text-xs font-medium text-[var(--zetrix-text)] transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm"
            >
              Get MyID for Android
            </a>
            <a
              href={process.env.NEXT_PUBLIC_MYID_IOS_URL || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--zetrix-border)] bg-white px-4 py-2 text-xs font-medium text-[var(--zetrix-text)] transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm"
            >
              Get MyID for iOS
            </a>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative px-4 py-12 sm:py-20" ref={ctaRef}>
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
            Start securing your documents with verified identity and blockchain proof. All you need
            is your MyID wallet.
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
