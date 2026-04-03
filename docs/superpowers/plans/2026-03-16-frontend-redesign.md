# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Light Editorial visual refresh across all pages — typography contrast, subtle animations, background textures, refined cards — while keeping all layouts and logic unchanged.

**Architecture:** Pure CSS/styling changes. New CSS custom properties + keyframes in globals.css. One new hook (`useScrollReveal`) for IntersectionObserver animations. One new component (`HeroBackground`) for landing page decorative elements. All existing component logic untouched.

**Tech Stack:** CSS animations, IntersectionObserver API, Tailwind CSS, existing Inter font (weight 300-800)

---

## Chunk 1: Foundation (globals.css + layout.tsx + shared components)

### Task 1: Update globals.css with design system tokens, noise overlay, and animations

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add editorial CSS custom properties and noise overlay**

Add after the existing `:root { ... }` block (before `.dark {`):

```css
/* Editorial design system tokens */
:root {
  --zetrix-maroon: #7B1E1E;
  --zetrix-maroon-light: #9B3030;
  --zetrix-maroon-dark: #5a1515;
  --zetrix-bg: #FAFAF8;
  --zetrix-bg2: #F1EFEB;
  --zetrix-text: #1a1a1a;
  --zetrix-text-muted: #6b6b6b;
  --zetrix-text-light: #999999;
  --zetrix-border: rgba(123,30,30,0.08);
}
```

Add after the `@layer base { ... }` block:

```css
/* Film-grain noise texture overlay */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  opacity: 0.03;
  pointer-events: none;
  z-index: 9999;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  background-size: 200px 200px;
}

/* Animations */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(0, -15px) rotate(2deg); }
}

/* Scroll reveal base styles */
.reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.8s ease, transform 0.8s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .reveal { opacity: 1; transform: none; transition: none; }
  * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
```

- [ ] **Step 2: Update body background color**

In the `@layer base` block, change `body` to use the warm off-white:

```css
body {
  @apply bg-background text-foreground;
  background-color: var(--zetrix-bg);
}
```

- [ ] **Step 3: Verify the app still builds**

Run: `cd web && npx next build --no-lint` (or just check the dev server isn't broken)

- [ ] **Step 4: Commit**

```
feat: add editorial design system tokens, noise overlay, and animations
```

---

### Task 2: Update layout.tsx with Inter weight range

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update Inter font import to include weight range**

Change:
```tsx
const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
```
To:
```tsx
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['300', '400', '500', '600', '700', '800'],
});
```

- [ ] **Step 2: Commit**

```
feat: load Inter font weights 300-800 for editorial typography
```

---

### Task 3: Create scroll-reveal hook

**Files:**
- Create: `src/hooks/use-scroll-reveal.ts`

- [ ] **Step 1: Create the hook**

```tsx
'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook that observes an element and adds 'visible' class when it enters viewport.
 * Uses IntersectionObserver with staggered delays for child .reveal elements.
 */
export function useScrollReveal<T extends HTMLElement>(
  options?: { threshold?: number; staggerDelay?: number }
) {
  const ref = useRef<T>(null);
  const { threshold = 0.1, staggerDelay = 80 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Check for reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.querySelectorAll('.reveal').forEach((child) => child.classList.add('visible'));
      if (el.classList.contains('reveal')) el.classList.add('visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // If the element itself has .reveal, reveal it
            if (el.classList.contains('reveal')) {
              el.classList.add('visible');
            }
            // Reveal child .reveal elements with stagger
            const children = el.querySelectorAll('.reveal');
            children.forEach((child, index) => {
              setTimeout(() => child.classList.add('visible'), index * staggerDelay);
            });
            observer.unobserve(el);
          }
        });
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, staggerDelay]);

  return ref;
}
```

- [ ] **Step 2: Commit**

```
feat: add useScrollReveal hook for intersection-based animations
```

---

### Task 4: Update header with frosted glass effect

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Update header background styling**

The header already has `bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60`. Update it to use the warm off-white with stronger blur:

Change:
```tsx
<header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
```
To:
```tsx
<header className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--zetrix-border)] bg-[var(--zetrix-bg)]/90 backdrop-blur-md supports-[backdrop-filter]:bg-[var(--zetrix-bg)]/80">
```

- [ ] **Step 2: Update logo styling for editorial feel**

Change the logo span:
```tsx
<span className="text-xl font-bold text-primary">Zetrix Sign</span>
```
To:
```tsx
<span className="text-xl font-bold tracking-tight text-primary">Zetrix Sign</span>
```

- [ ] **Step 3: Add top padding to main content for fixed header**

In `src/app/layout.tsx`, add `pt-16` to main:
```tsx
<main className="flex-1 pt-16">{children}</main>
```

- [ ] **Step 4: Commit**

```
feat: update header with frosted glass effect and fixed position
```

---

### Task 5: Update footer typography

**Files:**
- Modify: `src/components/layout/footer.tsx`

- [ ] **Step 1: Update footer styling**

Replace the entire footer component:

```tsx
import { Shield } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-[var(--zetrix-border)] py-6">
      <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 sm:flex-row">
        <span className="text-xs font-normal text-[var(--zetrix-text-light)]">
          Protected by Cloudflare
        </span>
        <span className="text-xs font-normal text-[var(--zetrix-text-light)]">
          Powered by Zetrix Blockchain
        </span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```
feat: update footer with editorial typography
```

---

## Chunk 2: Landing Page Redesign

### Task 6: Create hero background component

**Files:**
- Create: `src/components/landing/hero-background.tsx`

- [ ] **Step 1: Create the component**

```tsx
export function HeroBackground() {
  return (
    <>
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'linear-gradient(rgba(123,30,30,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(123,30,30,0.04) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 30% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 30% 50%, black, transparent)',
        }}
      />

      {/* Geometric wireframe shapes */}
      <div
        className="pointer-events-none absolute -top-24 -right-20 h-[500px] w-[500px] animate-[float_12s_ease-in-out_infinite]"
        style={{
          border: '2px solid rgba(123,30,30,0.05)',
          borderRadius: '200px 40px 200px 40px',
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-36 -left-24 h-[400px] w-[400px] animate-[float_15s_ease-in-out_infinite_reverse]"
        style={{
          border: '2px solid rgba(123,30,30,0.04)',
          borderRadius: '40px 200px 40px 200px',
        }}
      />

      {/* Ambient maroon glow */}
      <div
        className="pointer-events-none absolute top-[20%] right-[15%] h-[400px] w-[400px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(123,30,30,0.06), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```
feat: add hero background component with grid, wireframes, and glow
```

---

### Task 7: Redesign landing page

**Files:**
- Modify: `src/app/page.tsx`
- Delete reference to: `src/components/layout/landing-cta.tsx` (we inline the CTAs)

- [ ] **Step 1: Rewrite the landing page**

Replace entire `src/app/page.tsx`:

```tsx
import { Upload, ShieldCheck, Link2 } from 'lucide-react';
import { HeroBackground } from '@/components/landing/hero-background';
import { LandingCTA } from '@/components/layout/landing-cta';
import { LandingContent } from '@/components/landing/landing-content';

export default function LandingPage() {
  return <LandingContent />;
}
```

- [ ] **Step 2: Create the landing content client component**

Create `src/components/landing/landing-content.tsx`:

```tsx
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
    description: 'Drag and drop your PDF document to begin the signing process. We handle the cryptography, hashing, and blockchain anchoring automatically.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified Identity',
    description: 'Connect your Zetrix wallet — browser extension or mobile app — to cryptographically prove your identity.',
  },
  {
    icon: Link2,
    title: 'Blockchain Secure',
    description: 'Your document hash is permanently anchored on the Zetrix blockchain. Anyone can verify it — forever.',
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
      <section className="relative flex min-h-[85vh] items-center overflow-hidden">
        <HeroBackground />

        <div className="container relative z-10 mx-auto grid gap-12 px-4 lg:grid-cols-2 lg:gap-16">
          {/* Left: Content */}
          <div>
            <div className="mb-6 flex items-center gap-2.5" style={{ animation: 'fadeUp 0.8s ease both', animationDelay: '0.2s' }}>
              <div className="h-px w-9 bg-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                Blockchain Verified
              </span>
            </div>
            <h1
              className="text-4xl font-extrabold tracking-tight text-[var(--zetrix-text)] sm:text-5xl lg:text-6xl"
              style={{ animation: 'fadeUp 0.8s ease both', animationDelay: '0.4s', lineHeight: '1.08' }}
            >
              Sign Documents
            </h1>
            <p
              className="mt-2 text-3xl font-light text-primary sm:text-4xl"
              style={{ animation: 'fadeUp 0.8s ease both', animationDelay: '0.6s', lineHeight: '1.1' }}
            >
              with Confidence
            </p>
            <p
              className="mt-6 max-w-md text-base font-light leading-relaxed text-[var(--zetrix-text-muted)]"
              style={{ animation: 'fadeUp 0.8s ease both', animationDelay: '0.8s' }}
            >
              Tamper-proof digital signatures anchored on the Zetrix blockchain.
              Upload, sign, and verify — permanently secured on-chain.
            </p>
            <div
              className="mt-8 flex gap-3"
              style={{ animation: 'fadeUp 0.8s ease both', animationDelay: '1.0s' }}
            >
              <Link href="/sign" onClick={() => trackLandingCTA('upload_document')}>
                <Button size="lg" className="shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30">
                  Upload Document to Start
                </Button>
              </Link>
              <Link href="/verify" onClick={() => trackLandingCTA('verify_document')}>
                <Button size="lg" variant="outline" className="transition-all hover:-translate-y-0.5">
                  Verify a Document
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: Sample card */}
          <div style={{ animation: 'fadeUp 1s ease both', animationDelay: '0.6s' }}>
            <div className="relative overflow-hidden rounded-2xl border border-[var(--zetrix-border)] bg-white p-6 shadow-xl shadow-primary/[0.04]">
              {/* Top edge light line */}
              <div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

              <div className="mb-4 flex items-center justify-between border-b border-[var(--zetrix-border)] pb-4">
                <span className="text-[15px] font-bold text-[var(--zetrix-text)]">Document Signed</span>
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
                <div key={label} className={`flex justify-between py-2.5 text-sm ${i < arr.length - 1 ? 'border-b border-[var(--zetrix-border)]/50' : ''}`}>
                  <span className="text-[var(--zetrix-text-muted)]">{label}</span>
                  <span className="font-mono text-xs font-semibold text-[var(--zetrix-text)]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20" ref={featuresRef}>
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
      <section className="bg-[var(--zetrix-bg2)] px-4 py-20" ref={stepsRef}>
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
      <section className="relative px-4 py-20" ref={ctaRef}>
        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 50% 70% at center, rgba(123,30,30,0.04), transparent 70%)' }}
        />

        <div className="relative z-10 mx-auto max-w-xl text-center">
          <SectionLabel label="Get Started" centered />
          <h2 className="reveal mb-4 text-3xl font-extrabold tracking-tight text-[var(--zetrix-text)] sm:text-4xl">
            Ready to Sign?
          </h2>
          <p className="reveal mb-8 text-base font-light text-[var(--zetrix-text-muted)]">
            Start securing your documents on the blockchain in minutes.
            No account needed — just your Zetrix wallet.
          </p>
          <div className="reveal flex justify-center gap-3">
            <Link href="/sign" onClick={() => trackLandingCTA('upload_document')}>
              <Button size="lg" className="shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30">
                Upload Document
              </Button>
            </Link>
            <Link href="/verify" onClick={() => trackLandingCTA('verify_document')}>
              <Button size="lg" variant="outline" className="transition-all hover:-translate-y-0.5">
                Verify a Document
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify landing page renders correctly**

Run dev server and check `http://localhost:3000`:
- Hero: 2-column layout with staggered animations
- Scroll down: features and steps fade in with stagger
- Cards hover lift
- Wireframe shapes floating in background

- [ ] **Step 4: Commit**

```
feat: redesign landing page with editorial layout and animations
```

---

## Chunk 3: Signing Flow + Verify Page Polish

### Task 8: Add fadeUp animation to signing step components

**Files:**
- Modify: `src/components/signing/step-upload.tsx`
- Modify: `src/components/signing/step-wallet-identity.tsx`
- Modify: `src/components/signing/step-signature.tsx`
- Modify: `src/components/signing/step-placement.tsx`
- Modify: `src/components/signing/step-review.tsx`
- Modify: `src/components/signing/step-anchoring.tsx`
- Modify: `src/components/signing/step-complete.tsx`

- [ ] **Step 1: Add fadeUp wrapper to each step component**

For each step component, wrap the outermost `<Card>` in an animated div. The pattern is the same for all — add a wrapping div with the fadeUp animation:

In each file, change:
```tsx
return (
  <Card>
```
To:
```tsx
return (
  <div style={{ animation: 'fadeUp 0.4s ease both' }}>
  <Card className="overflow-hidden border-[var(--zetrix-border)] shadow-sm">
```

And close the wrapping `</div>` at the end before the function's closing.

Also add a top-edge light line inside each Card's CardHeader (or as first child of Card):
```tsx
{/* Top edge light line */}
<div className="absolute top-0 left-[10%] right-[10%] h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />
```

Note: Add `relative` to the Card className for the absolute positioning to work.

Do this for all 7 step components.

- [ ] **Step 2: Verify signing flow renders correctly**

Navigate to `/sign`, go through steps — each step should fade up smoothly. Cards should have the subtle top-edge line. All existing functionality must work unchanged.

- [ ] **Step 3: Commit**

```
feat: add fadeUp animation and editorial card styling to signing steps
```

---

### Task 9: Polish verify page components

**Files:**
- Modify: `src/components/verify/verify-upload.tsx`
- Modify: `src/components/verify/verify-result.tsx`

- [ ] **Step 1: Add fadeUp and editorial styling to verify-upload.tsx**

Same pattern as signing steps: wrap in animated div, add border token, add top-edge line.

- [ ] **Step 2: Add fadeUp to verify-result.tsx**

Same pattern. The result card should fade up when it appears.

- [ ] **Step 3: Verify the verify page works**

Navigate to `/verify`, upload a PDF — card styling updated, result fades in.

- [ ] **Step 4: Commit**

```
feat: add editorial styling to verify page components
```

---

### Task 10: Update stepper indicator colors

**Files:**
- Modify: `src/components/signing/signing-stepper.tsx`

- [ ] **Step 1: Update connector and circle colors**

The stepper already uses `bg-primary` and `bg-muted` which map to the maroon theme. The only change needed is making the overall container have the warm background:

Add top padding and background class to the signing page wrapper. In `signing-stepper.tsx`, update the outer div:

```tsx
<div className="container mx-auto max-w-4xl px-4 py-8">
```

No changes needed — `bg-primary` already resolves to maroon. The stepper indicator is already correct.

- [ ] **Step 2: Commit (skip if no changes needed)**

---

### Task 11: Final verification and cleanup

- [ ] **Step 1: Test full signing flow end-to-end**

1. Go to `/` — verify landing page looks correct
2. Click "Upload Document to Start" → `/sign`
3. Walk through all 7 steps — verify cards fade in, styling is consistent
4. Go to `/verify` — verify upload and result cards are styled

- [ ] **Step 2: Remove landing-cta.tsx if no longer imported**

Check if `landing-cta.tsx` is still referenced. If the new landing page doesn't use it, it can remain (no harm) — the page.tsx now renders `LandingContent` which has inline CTAs.

- [ ] **Step 3: Final commit**

```
feat: frontend redesign complete — editorial visual refresh
```
