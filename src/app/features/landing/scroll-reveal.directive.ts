import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/**
 * Adds the `sf-reveal` class up-front (sets the hidden/offset start state via CSS)
 * and toggles `sf-reveal-in` once the element scrolls into view, triggering the
 * fade/slide-up transition. Respects `prefers-reduced-motion`: when reduced, the
 * element is revealed immediately with no transform/transition.
 *
 * Usage: `<div sfScrollReveal>…</div>`. Stagger via an inline
 * `style="transition-delay: 120ms"` on the host.
 */
@Directive({
  selector: '[sfScrollReveal]',
  standalone: true,
})
export class ScrollRevealDirective implements AfterViewInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // No IntersectionObserver (SSR/old browser) or reduced motion → just show it.
    if (reduced || typeof IntersectionObserver === 'undefined') {
      node.classList.add('sf-reveal', 'sf-reveal-in');
      return;
    }

    node.classList.add('sf-reveal');
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('sf-reveal-in');
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    this.observer.observe(node);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
