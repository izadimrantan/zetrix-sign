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
