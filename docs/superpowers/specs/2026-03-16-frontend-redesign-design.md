# Zetrix Sign — Frontend Redesign Specification

**Product:** Zetrix Sign
**Date:** 2026-03-16
**Status:** Approved
**Author:** Claude Opus 4.6 with @izadi

---

## 1. Overview

Visual refresh of all Zetrix Sign pages using a Light Editorial design language inspired by JMYR's corporate fintech style. Layouts remain unchanged — this is a polish layer adding typography contrast, subtle animations, background textures, and refined card/button styling across every page.

### Goals
- Apply consistent editorial visual language across all pages (landing, sign, verify)
- Add subtle scroll-triggered animations for professional feel
- Improve typographic hierarchy with bold/light weight contrast
- Add visual depth through textures, wireframe shapes, and ambient glows
- Keep maroon (#7B1E1E) as primary brand color

### Non-Goals
- Layout restructuring (all existing layouts stay)
- New functionality or features
- Dark mode (light-only editorial theme)
- Heavy animations or 3D transforms (subtle & professional only)
- New font families (Inter stays, just add weight contrast)

---

## 2. Design System

### 2.1 Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--maroon` | `#7B1E1E` | Primary accent, buttons, links |
| `--maroon-light` | `#9B3030` | Hover states |
| `--maroon-dark` | `#5a1515` | Active/pressed states |
| `--bg` | `#FAFAF8` | Page background (warm off-white) |
| `--bg2` | `#F1EFEB` | Alternating section backgrounds |
| `--card` | `#FFFFFF` | Card surfaces |
| `--text` | `#1a1a1a` | Primary text |
| `--text-muted` | `#6b6b6b` | Secondary/descriptive text |
| `--text-light` | `#999999` | Tertiary/footer text |
| `--border` | `rgba(123,30,30,0.08)` | Card borders, dividers |

These are CSS custom properties on `:root`, integrated alongside the existing oklch shadcn variables. The shadcn `--primary` maps to maroon.

### 2.2 Typography (Inter)

| Element | Weight | Size | Letter-spacing | Style |
|---------|--------|------|----------------|-------|
| Page titles (h1) | 800 | clamp(2.5rem, 5vw, 3.8rem) | -0.03em | Dark, impactful |
| Subtitles | 300 | clamp(2rem, 4vw, 3rem) | normal | Light, maroon-colored — creates editorial contrast |
| Section headings (h2) | 800 | clamp(1.8rem, 3vw, 2.5rem) | -0.02em | |
| Card headings (h3) | 700 | 16px | -0.01em | |
| Body text | 400 | 16px | normal | line-height: 1.7 |
| Descriptions | 300 | 14-16px | normal | Muted color, light weight |
| Section eyebrow labels | 600 | 11px | 0.2em | Uppercase, maroon, preceded by 35px horizontal line |
| Monospace values | 600 | 12px | normal | font-family: monospace (hashes, addresses) |

### 2.3 Shared Visual Elements

**Film-grain noise overlay:**
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  opacity: 0.03;
  pointer-events: none;
  z-index: 9999;
  background-image: url("data:image/svg+xml,...feTurbulence...");
  background-size: 200px 200px;
}
```

**Card styling:**
- Background: white
- Border: 1px solid var(--border)
- Border-radius: 16px
- Hover: translateY(-4px), box-shadow 0 12px 40px rgba(123,30,30,0.08), border-color intensifies
- Top-edge light line on hover: `::before` pseudo-element, `linear-gradient(90deg, transparent, rgba(123,30,30,0.15), transparent)`
- Transition: all 0.4s ease

**Button styling:**
- Primary: maroon background, white text, 8px radius, shadow 0 2px 8px rgba(123,30,30,0.2)
- Primary hover: lighter maroon, translateY(-1px), deeper shadow
- Outline: transparent background, maroon text, 1px maroon-tinted border
- Outline hover: subtle maroon background tint, translateY(-1px)

**Section eyebrow pattern:**
```html
<div class="section-label">
  <div class="section-label-line"></div> <!-- 35px × 1px maroon line -->
  <span class="section-label-text">SECTION NAME</span>
</div>
```

---

## 3. Animation System

### 3.1 Entrance Animations

**fadeUp keyframe:**
```css
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
```

**Usage:**
- Landing hero elements: staggered delays (0.2s → 0.4s → 0.6s → 0.8s → 1.0s)
- Signing step transitions: 0.3s fadeUp on mount
- Verify result appearance: 0.3s fadeUp

### 3.2 Scroll Reveal

**`useScrollReveal` hook:**
- Uses IntersectionObserver with threshold 0.1
- Adds `.visible` class with staggered setTimeout(index × 80ms) delays
- Initial state: `opacity: 0; transform: translateY(40px)`
- Visible state: `opacity: 1; transform: translateY(0); transition: opacity 0.8s ease, transform 0.8s ease`
- Applied to: feature cards, how-it-works steps, CTA section on landing page

**`<RevealOnScroll>` wrapper component:**
```tsx
// Wraps children, applies the reveal animation
<RevealOnScroll delay={0}>{children}</RevealOnScroll>
```

### 3.3 Hover Effects

- Cards: translateY(-4px) + shadow deepens + top-edge line appears (0.4s ease)
- Buttons: translateY(-1px) + shadow deepens (0.3s ease)
- Step number circles (landing): background fills with maroon, text turns white (0.3s ease)

### 3.4 Background Animations

**Floating wireframe shapes (landing hero only):**
```css
@keyframes float {
  0%, 100% { transform: translate(0, 0) rotate(0deg); }
  50% { transform: translate(0, -15px) rotate(2deg); }
}
```
- 2 large (400-500px) absolutely-positioned elements
- Very faint maroon-tinted borders (opacity ~0.05)
- Organic border-radius values
- 12-15s infinite animation, pointer-events: none

---

## 4. Page-by-Page Specifications

### 4.1 Header (all pages)

**Changes:**
- Background: `rgba(250,250,248,0.9)` with `backdrop-filter: blur(8px)`
- Border-bottom: 1px solid var(--border)
- Logo: maroon color, weight 700, letter-spacing -0.02em
- Buttons: use updated primary/outline styles
- No layout changes

### 4.2 Footer (all pages)

**Changes:**
- Typography: weight 400, var(--text-light) color, 12px
- Border-top: 1px solid var(--border)
- No layout changes

### 4.3 Landing Page (`/`)

**Full redesign of content and styling, same semantic sections:**

**Hero section:**
- Min-height: 85vh, centered vertically
- 2-column grid: content left, visual card right
- Background elements:
  - Subtle grid pattern (60px spacing, masked with radial-gradient to fade)
  - 2 floating wireframe shapes (large, faint, organic curves)
  - Ambient maroon glow (radial-gradient, blurred)
- Left column:
  - Eyebrow: line + "BLOCKCHAIN VERIFIED" label
  - Title: "Sign Documents" (weight 800, large)
  - Subtitle: "with Confidence" (weight 300, maroon)
  - Description: 1-2 sentences (weight 300, muted)
  - CTA buttons: "Upload Document to Start" (primary) + "Verify a Document" (outline)
- Right column:
  - Sample "Document Signed" card showing mock signed document data
  - Card has top-edge light line, subtle shadow
- Staggered entrance animation: eyebrow 0.2s → title 0.4s → subtitle 0.6s → desc 0.8s → buttons 1.0s → card 0.6s

**Features section:**
- Section eyebrow: "FEATURES"
- Heading: "Why Zetrix Sign?" (weight 800)
- Subtitle: 1 sentence (weight 300, muted)
- 3-card grid: Simple Upload, Verified Identity, Blockchain Secure
- Each card: icon (48px maroon-tinted bg), title (700), description (300, muted)
- Cards use scroll-reveal with staggered delays

**How It Works section:**
- Background: var(--bg2)
- Section eyebrow: "PROCESS"
- Heading: "How It Works"
- 4-column grid: Upload → Connect → Sign → Anchor
- Each: numbered circle (border-only) + title + short description
- Circles fill on hover
- Scroll-reveal with stagger

**CTA section:**
- Centered layout
- Radial maroon glow behind (::before pseudo)
- Centered eyebrow with lines on both sides
- Heading: "Ready to Sign?"
- Description + 2 CTA buttons
- Scroll-reveal

### 4.4 Signing Flow (`/sign`)

**Stepper indicator:**
- Active/completed steps: maroon background
- Upcoming steps: outline with muted border
- Connection lines: match existing but use var(--border)

**Step cards:**
- White background, var(--border), 16px radius
- Step content fades up on step transition (animation: fadeUp 0.3s ease)
- Drag-drop zones: dashed border using maroon-tinted color, hover → maroon border
- Form inputs, tabs, buttons: use updated design system styles
- No layout restructuring — same content, same forms, same step logic

### 4.5 Verify Page (`/verify`)

**Upload section:**
- Same card treatment as signing steps
- Drag-drop zone with updated styling

**Result section:**
- Card with updated styling
- Badge variants: keep existing colors (green valid, red invalid, orange revoked)
- Monospace values for hashes/addresses
- fadeUp animation when result appears

---

## 5. Implementation Plan

### 5.1 New Files

| File | Purpose |
|------|---------|
| `src/components/ui/scroll-reveal.tsx` | `useScrollReveal` hook + `<RevealOnScroll>` wrapper |
| `src/components/landing/hero-background.tsx` | Grid pattern, wireframe shapes, ambient glow |

### 5.2 Modified Files

| File | Changes |
|------|---------|
| `src/app/globals.css` | CSS custom properties, noise overlay, fadeUp keyframe, typography utilities |
| `src/app/layout.tsx` | Inter weight imports (300-800) |
| `src/app/page.tsx` | Full landing page redesign |
| `src/components/layout/header.tsx` | Frosted glass background |
| `src/components/layout/footer.tsx` | Updated typography and border |
| `src/components/signing/signing-stepper.tsx` | Step indicator color updates |
| `src/components/signing/step-upload.tsx` | Card styling, drag-drop zone update |
| `src/components/signing/step-wallet-identity.tsx` | Card styling |
| `src/components/signing/step-signature.tsx` | Card styling |
| `src/components/signing/step-placement.tsx` | Card styling |
| `src/components/signing/step-review.tsx` | Card styling |
| `src/components/signing/step-anchoring.tsx` | Card styling |
| `src/components/signing/step-complete.tsx` | Card styling, fadeUp |
| `src/components/verify/verify-upload.tsx` | Card styling, drag-drop zone |
| `src/components/verify/verify-result.tsx` | Card styling, fadeUp |

### 5.3 Dependencies

No new npm dependencies. All effects use:
- CSS animations and keyframes
- IntersectionObserver API (browser-native)
- Existing Tailwind CSS utilities
- Existing tw-animate-css library

---

## 6. Constraints

- **No layout changes:** All existing component layouts, form structures, and step logic remain identical
- **No functionality changes:** Wallet connection, signing, anchoring, verification logic untouched
- **No new fonts:** Inter (already the Next.js default) with weight contrast only
- **Performance:** All animations use CSS transforms/opacity only (GPU-accelerated, no layout thrash). Noise overlay is a fixed background (painted once). IntersectionObserver is lightweight.
- **Accessibility:** Animations respect `prefers-reduced-motion` — wrap keyframe usage in `@media (prefers-reduced-motion: no-preference)`
- **Browser support:** backdrop-filter has `supports` fallback already in header. All other features are baseline 2023+.