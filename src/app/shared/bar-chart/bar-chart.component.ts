import { Component, computed, input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';

/** Scale each value to a pixel height against `max` (0 when max ≤ 0 — avoids NaN). */
export function barScale(values: number[], max: number, height: number): number[] {
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => Math.round((Math.max(0, v) / max) * height));
}

/** Compact number for axis labels: 950000 → "950K", 1_000_000 → "1M", 500 → "500". */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return +(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (n >= 1_000) return +(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K';
  return String(n);
}

/**
 * Dependency-free inline-SVG bar chart with a fixed pixel height (so `w-full` can't
 * inflate it via the viewBox aspect ratio). Optional Y-axis (`scaleMax` + `showAxis`)
 * anchors bar heights to a reference (e.g. a quota ceiling), so bars read as a
 * proportion of that max. Hover a column for its value (full-height hit areas +
 * a readout, so even tiny bars are hoverable).
 */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <div class="flex items-stretch gap-2">
      @if (showAxis()) {
        <div
          class="flex flex-col justify-between items-end text-[9px] shrink-0 leading-none"
          [style.height.px]="height()"
          style="color: var(--color-text-muted);"
        >
          <span data-testid="axis-max">{{ axisMaxLabel() }}</span>
          <span>0</span>
        </div>
      }
      <div class="flex-1 min-w-0">
        <svg
          [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
          class="w-full block"
          [style.height.px]="height()"
          role="img"
          preserveAspectRatio="none"
        >
          @if (threshold() !== undefined) {
            <line
              data-testid="threshold"
              [attr.x1]="0" [attr.x2]="width()"
              [attr.y1]="height() - scaledThreshold()" [attr.y2]="height() - scaledThreshold()"
              stroke="var(--color-sf-red)" stroke-width="1" stroke-dasharray="3 3"
            />
          }
          <!-- Visible bars -->
          @for (b of bars(); track b.i) {
            <rect
              data-testid="bar"
              [attr.x]="b.x" [attr.y]="height() - b.h" [attr.width]="barWidth" [attr.height]="b.h"
              [attr.fill]="b.color"
              [attr.opacity]="hovered() === null || hovered() === b.i ? 1 : 0.4"
            />
          }
          <!-- Full-height transparent hit areas (on top) so any column is hoverable -->
          @for (b of bars(); track b.i) {
            <rect
              [attr.x]="b.x" [attr.width]="slot" y="0" [attr.height]="height()"
              fill="transparent" style="cursor: pointer;"
              (mouseenter)="hovered.set(b.i)" (mouseleave)="hovered.set(null)"
            >
              <title>{{ labels()[b.i] }}: {{ values()[b.i] }}</title>
            </rect>
          }
        </svg>
        <div class="text-[10px] h-4 mt-0.5" style="color: var(--color-text-muted);" data-testid="bar-hover">
          @if (hovered() !== null) {
            {{ labels()[hovered()!] }} · <strong style="color: var(--color-text);">{{ values()[hovered()!] | number }}</strong>
          }
        </div>
      </div>
    </div>
  `,
})
export class BarChartComponent {
  readonly values = input<number[]>([]);
  readonly labels = input<string[]>([]);
  readonly threshold = input<number | undefined>(undefined);
  readonly scaleMax = input<number | undefined>(undefined);
  readonly showAxis = input<boolean>(false);
  readonly colorFor = input<((v: number) => string) | undefined>(undefined);
  readonly color = input<string>('var(--color-sf-gold)');
  readonly height = input<number>(80);

  readonly hovered = signal<number | null>(null);

  protected readonly barWidth = 10;
  protected readonly slot = 14; // bar width + gap

  protected readonly width = computed(() => Math.max(1, this.values().length) * this.slot);
  // Y-axis max: an explicit scaleMax wins (anchor to a reference like a quota ceiling),
  // else the largest of the data / threshold.
  protected readonly max = computed(() =>
    this.scaleMax() ?? Math.max(this.threshold() ?? 0, ...this.values(), 1),
  );
  protected readonly axisMaxLabel = computed(() => formatCompact(this.max()));
  protected readonly scaledThreshold = computed(
    () => barScale([this.threshold() ?? 0], this.max(), this.height())[0],
  );
  protected readonly bars = computed(() => {
    const hs = barScale(this.values(), this.max(), this.height());
    const colorFor = this.colorFor();
    const solid = this.color();
    return this.values().map((v, i) => ({
      i,
      x: i * this.slot,
      h: hs[i],
      color: colorFor ? colorFor(v) : solid,
    }));
  });
}
