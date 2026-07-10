import { Component, computed, input } from '@angular/core';

/** Scale each value to a pixel height against `max` (0 when max ≤ 0 — avoids NaN). */
export function barScale(values: number[], max: number, height: number): number[] {
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => Math.round((Math.max(0, v) / max) * height));
}

/**
 * Dependency-free inline-SVG bar chart. Bars scale to the max of the values (and the
 * threshold, so the threshold line always fits); an optional dashed threshold line
 * marks a limit; `colorFor` lets the caller shade bars (e.g. by % of a quota).
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  template: `
    <svg [attr.viewBox]="'0 0 ' + width() + ' ' + (height() + 16)" class="w-full" role="img" preserveAspectRatio="none">
      @if (threshold() !== undefined) {
        <line
          data-testid="threshold"
          [attr.x1]="0" [attr.x2]="width()"
          [attr.y1]="height() - scaledThreshold()" [attr.y2]="height() - scaledThreshold()"
          stroke="var(--color-sf-red)" stroke-width="1" stroke-dasharray="3 3"
        />
      }
      @for (b of bars(); track b.i) {
        <rect
          data-testid="bar"
          [attr.x]="b.x" [attr.y]="height() - b.h" [attr.width]="barWidth" [attr.height]="b.h"
          [attr.fill]="b.color" rx="1"
        >
          <title>{{ labels()[b.i] }}: {{ values()[b.i] }}</title>
        </rect>
      }
    </svg>
  `,
})
export class BarChartComponent {
  readonly values = input<number[]>([]);
  readonly labels = input<string[]>([]);
  readonly threshold = input<number | undefined>(undefined);
  readonly colorFor = input<((v: number) => string) | undefined>(undefined);
  readonly height = input<number>(80);

  protected readonly barWidth = 10;
  private readonly slot = 14; // bar width + gap

  protected readonly width = computed(() => Math.max(1, this.values().length) * this.slot);
  protected readonly max = computed(() => Math.max(this.threshold() ?? 0, ...this.values(), 1));
  protected readonly scaledThreshold = computed(
    () => barScale([this.threshold() ?? 0], this.max(), this.height())[0],
  );
  protected readonly bars = computed(() => {
    const hs = barScale(this.values(), this.max(), this.height());
    const color = this.colorFor();
    return this.values().map((v, i) => ({
      i,
      x: i * this.slot,
      h: hs[i],
      color: color ? color(v) : 'var(--color-sf-gold)',
    }));
  });
}
