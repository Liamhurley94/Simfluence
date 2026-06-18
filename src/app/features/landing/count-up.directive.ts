import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';

/**
 * Animates a number from 0 → `sfCountUp` once the host scrolls into view.
 * `prefix`/`suffix` wrap the value; `decimals` controls precision. Respects
 * `prefers-reduced-motion` (renders the final value instantly).
 *
 * Usage: `<span sfCountUp [sfCountUp]="68" suffix="%"></span>`
 */
@Directive({
  selector: '[sfCountUp]',
  standalone: true,
})
export class CountUpDirective implements AfterViewInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;
  private frame?: number;

  readonly sfCountUp = input.required<number>();
  readonly prefix = input<string>('');
  readonly suffix = input<string>('');
  readonly decimals = input<number>(0);
  readonly durationMs = input<number>(1400);

  ngAfterViewInit(): void {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduced || typeof IntersectionObserver === 'undefined') {
      this.render(this.sfCountUp());
      return;
    }

    this.render(0);
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.animate();
            this.observer?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.4 },
    );
    this.observer.observe(this.el.nativeElement);
  }

  private animate(): void {
    const target = this.sfCountUp();
    const duration = this.durationMs();
    const start = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast start, gentle landing.
      const eased = 1 - Math.pow(1 - t, 3);
      this.render(target * eased);
      if (t < 1) {
        this.frame = requestAnimationFrame(step);
      } else {
        this.render(target);
      }
    };
    this.frame = requestAnimationFrame(step);
  }

  private render(value: number): void {
    const fixed = value.toFixed(this.decimals());
    this.el.nativeElement.textContent = `${this.prefix()}${fixed}${this.suffix()}`;
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.frame) cancelAnimationFrame(this.frame);
  }
}
